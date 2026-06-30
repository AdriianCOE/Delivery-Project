// src/pages/merchant/menu/hooks/useMenuManagementData.js
// Hook centralizado de dados do MenuManagement.
// Encapsula resolução de storeId, fetch do store, e listeners de categories/products/coupons.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, functions } from '../../../../services/firebase'
import { saveMenuItem } from '../../../../services/menuManagement'
import { getCallableErrorMessage } from '../../../../utils/callableError'
import { useConfirmDialog } from '../../../../components/ui/ConfirmDialogProvider'
import { useAuth } from '../../../../contexts/AuthContext'
import { buildStoreScopedPayload } from '../../../../utils/storeIdentity'
import { cleanObject } from '../utils/menuPayloads'
import { sanitizeCouponForSave } from '../utils/couponPayloads'

export function useMenuManagementData() {
  const { confirm } = useConfirmDialog()
  const { storeId: authStoreId, storeIds, userData, user, loading: authLoading } = useAuth()

  const [store,       setStore]       = useState(null)
  const [storeId,     setStoreId]     = useState(null)
  const [categories,  setCategories]  = useState([])
  const [products,    setProducts]    = useState([])
  const [coupons,     setCoupons]     = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [storeError,  setStoreError]  = useState(null) // 'no-store' | 'not-found'

  // 1. Resolve storeId
  useEffect(() => {
    if (authLoading) return
    const resolved =
      authStoreId ||
      userData?.storeId ||
      user?.storeId ||
      storeIds?.[0] ||
      userData?.storeIds?.[0] ||
      null
    if (!resolved) {
      setStoreError('no-store')
      setPageLoading(false)
      return
    }
    if (resolved !== storeId) {
      setStoreId(resolved)
      setStoreError(null)
      setPageLoading(true)
    }
  }, [authLoading, authStoreId, storeIds, userData, user, storeId])

  // 2. Listen to store document in real-time
  useEffect(() => {
    if (!storeId) return
    setPageLoading(true)
    const unsub = onSnapshot(
      doc(db, 'stores', storeId),
      (snap) => {
        if (!snap.exists()) {
          setStoreError('not-found')
        } else {
          setStore({ id: snap.id, ...snap.data() })
          setStoreError(null)
        }
        setPageLoading(false)
      },
      (err) => {
        console.error('[useMenuManagementData] store snapshot error:', err)
        setStoreError('not-found')
        setPageLoading(false)
      }
    )
    return () => unsub()
  }, [storeId])

  // 3. onSnapshot: categories
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'categories'), where('storeId', '==', storeId))
    const unsub = onSnapshot(q,
      (snap) => setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('[useMenuManagementData] categories:', err)
    )
    return () => unsub()
  }, [storeId])

  // 4. onSnapshot: products
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'products'), where('storeId', '==', storeId))
    const unsub = onSnapshot(q,
      (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('[useMenuManagementData] products:', err)
    )
    return () => unsub()
  }, [storeId])

  // 5. onSnapshot: coupons
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'coupons'), where('storeId', '==', storeId))
    const unsub = onSnapshot(q,
      (snap) => setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('[useMenuManagementData] coupons:', err)
    )
    return () => unsub()
  }, [storeId])

  // Computed categories & products
  const sortedCategories = useMemo(() =>
    categories
      .filter((c) => c.isDeleted !== true && !c.deletedAt)
      .sort((a, b) =>
        (Number(a?.order ?? 9999) - Number(b?.order ?? 9999)) ||
        (a.name || '').localeCompare(b.name || '')
      ),
    [categories]
  )

  const activeProducts = useMemo(() => products.filter((p) => p.isDeleted !== true && !p.deletedAt), [products])

  const activeCoupons = useMemo(() =>
    coupons.filter((c) => c.isDeleted !== true && !c.deletedAt),
    [coupons]
  )

  const stats = useMemo(() => {
    const now = new Date()
    const couponsValidNow = activeCoupons.filter((c) => {
      if (!c.active) return false
      
      let startsAt = null
      if (c.startsAt?.toDate) startsAt = c.startsAt.toDate()
      else if (c.startsAt?.seconds) startsAt = new Date(c.startsAt.seconds * 1000)
      else if (c.startsAt) startsAt = new Date(c.startsAt)
      
      let expiresAt = null
      if (c.expiresAt?.toDate) expiresAt = c.expiresAt.toDate()
      else if (c.expiresAt?.seconds) expiresAt = new Date(c.expiresAt.seconds * 1000)
      else if (c.expiresAt) expiresAt = new Date(c.expiresAt)
      
      if (startsAt && now < startsAt) return false
      if (expiresAt && now > expiresAt) return false
      return true
    }).length

    return {
      total:       activeProducts.length,
      active:      activeProducts.filter((p) => p.isActive !== false && p.isAvailable !== false && p.isVisible !== false).length,
      unavailable: activeProducts.filter((p) => p.isAvailable === false).length,
      featured:    activeProducts.filter((p) => p.isFeatured).length,
      noImage:     activeProducts.filter((p) => !p.imageUrl).length,
      categories:  sortedCategories.length,
      couponsTotal: activeCoupons.length,
      couponsActive: activeCoupons.filter((c) => c.active).length,
      couponsValidNow,
      deliveryActive: Object.entries(store?.deliveryFees || {}).filter(
        ([, value]) => value !== '' && value !== null && value !== undefined
      ).length,
    }
  }, [activeProducts, sortedCategories, activeCoupons, store?.deliveryFees])

  const productCountByCategory = useMemo(() => {
    const counts = {}
    activeProducts.forEach((p) => {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1
    })
    return counts
  }, [activeProducts])

  // Handlers: Products
  const handleToggleProductField = useCallback(async (productId, field, currentValue, showToast) => {
    try {
      await saveMenuItem({
        storeId,
        entityType: 'product',
        entityId: productId,
        payload: { [field]: !currentValue },
      })
    } catch (error) {
      showToast?.({ type: 'error', message: getCallableErrorMessage(error, 'Erro ao atualizar produto.') })
    }
  }, [storeId])

  const handleDuplicateProduct = useCallback(async (product, store, showToast) => {
    if (!storeId || !store) return
    try {
      const scope = buildStoreScopedPayload(store)
      if (import.meta.env.DEV) console.log('[useMenuManagementData] Duplicando produto scope:', scope)
      const { id: _id, createdAt: _ca, ...rest } = product
      await saveMenuItem({
        storeId,
        entityType: 'product',
        payload: cleanObject({
          ...rest,
          ...scope,
          name: `${product.name} (cópia)`,
          priceCents: Number.isInteger(product.priceCents)
            ? product.priceCents
            : Math.round(Number(product.price || 0) * 100),
          isDeleted: false,
        }),
      })
      showToast?.({ type: 'success', message: 'Produto duplicado!' })
    } catch (error) {
      showToast?.({ type: 'error', message: getCallableErrorMessage(error, 'Erro ao duplicar produto.') })
    }
  }, [storeId])

  const handleDeleteProduct = useCallback(async (productId, showToast) => {
    const confirmed = await confirm({
      title: 'Excluir produto?',
      description: 'Ele ficará oculto e só poderá ser recuperado pelo suporte.',
      confirmLabel: 'Excluir produto',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await updateDoc(doc(db, 'products', productId), { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      showToast?.({ type: 'success', message: 'Produto excluído.' })
    } catch { showToast?.({ type: 'error', message: 'Erro ao excluir produto.' }) }
  }, [confirm])

  // Handlers: Categories
  const handleDeleteCategory = useCallback(async (category, productCountByCategory, showToast) => {
    if ((productCountByCategory[category.id] || 0) > 0) {
      showToast?.({ type: 'error', message: 'Mova os produtos desta categoria antes de excluí-la.' })
      return
    }
    const confirmed = await confirm({
      title: 'Excluir categoria?',
      description: `A categoria "${category.name}" será removida do cardápio.`,
      confirmLabel: 'Excluir categoria',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await updateDoc(doc(db, 'categories', category.id), { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      showToast?.({ type: 'success', message: 'Categoria excluída.' })
    } catch { showToast?.({ type: 'error', message: 'Erro ao excluir categoria.' }) }
  }, [confirm])

  const handleToggleCategoryActive = useCallback(async (catId, currentValue, showToast) => {
    try {
      await saveMenuItem({
        storeId,
        entityType: 'category',
        entityId: catId,
        payload: { isActive: !currentValue },
      })
    } catch (error) {
      showToast?.({ type: 'error', message: getCallableErrorMessage(error, 'Erro ao atualizar categoria.') })
    }
  }, [storeId])

  const handleMoveCategoryOrder = useCallback(async (category, direction, sortedCategories, showToast) => {
    const idx     = sortedCategories.findIndex((c) => c.id === category.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedCategories.length) return
    try {
      const a = sortedCategories[idx]
      const b = sortedCategories[swapIdx]
      const aO = Number(a.order ?? idx)
      const bO = Number(b.order ?? swapIdx)
      await Promise.all([
        updateDoc(doc(db, 'categories', a.id), { order: bO, updatedAt: serverTimestamp() }),
        updateDoc(doc(db, 'categories', b.id), { order: aO, updatedAt: serverTimestamp() }),
      ])
    } catch { showToast?.({ type: 'error', message: 'Erro ao reordenar categoria.' }) }
  }, [])

  // Handlers: Coupons
  const handleSaveCoupon = useCallback(async (couponId, couponForm, store, showToast) => {
    if (!storeId || !store) return false
    
    const codeUpper = String(couponForm.code || '').trim().toUpperCase()
    if (!codeUpper || codeUpper.length < 3) {
      showToast?.({ type: 'error', message: 'O código do cupom deve ter pelo menos 3 caracteres.' })
      return false
    }

    // Validação de duplicidade por loja (apenas cupons não deletados)
    const isDuplicate = activeCoupons.some(
      (c) => c.id !== couponId && c.code === codeUpper
    )
    if (isDuplicate) {
      showToast?.({ type: 'error', message: 'Já existe um cupom cadastrado com este código nesta loja.' })
      return false
    }

    try {
      const isEdit = Boolean(couponId)
      const payload = sanitizeCouponForSave(couponForm, store, isEdit)
      payload.updatedAt = serverTimestamp()

      if (isEdit) {
        await updateDoc(doc(db, 'coupons', couponId), payload)
        showToast?.({ type: 'success', message: 'Cupom atualizado com sucesso!' })
      } else {
        payload.createdAt = serverTimestamp()
        await addDoc(collection(db, 'coupons'), payload)
        showToast?.({ type: 'success', message: 'Cupom criado com sucesso!' })
      }
      return true
    } catch (err) {
      console.error(err)
      showToast?.({ type: 'error', message: 'Erro ao salvar o cupom no banco.' })
      return false
    }
  }, [storeId, activeCoupons])

  const handleToggleCoupon = useCallback(async (couponId, currentStatus, showToast) => {
    try {
      await updateDoc(doc(db, 'coupons', couponId), {
        active: !currentStatus,
        updatedAt: serverTimestamp(),
      })
      showToast?.({ type: 'success', message: `Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.` })
    } catch (err) {
      console.error(err)
      showToast?.({ type: 'error', message: 'Erro ao alterar o status do cupom.' })
    }
  }, [])

  const handleDeleteCoupon = useCallback(async (couponId, showToast) => {
    const confirmed = await confirm({
      title: 'Arquivar cupom?',
      description: 'O cupom deixará de ser aceito imediatamente.',
      confirmLabel: 'Arquivar cupom',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await updateDoc(doc(db, 'coupons', couponId), {
        active: false,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      showToast?.({ type: 'success', message: 'Cupom arquivado com sucesso.' })
    } catch (err) {
      console.error(err)
      showToast?.({ type: 'error', message: 'Erro ao arquivar o cupom.' })
    }
  }, [confirm])

  const handleSaveDeliveryFees = useCallback(async (newFees) => {
    if (!storeId) return false
    try {
      const sanitized = {}
      Object.entries(newFees).forEach(([bairro, val]) => {
        if (val === null || val === undefined || val === '') {
          sanitized[bairro] = null
          return
        }
        const num = Number(val)
        if (Number.isFinite(num) && num >= 0) {
          sanitized[bairro] = num
        }
      })

      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId,
        payload: { deliveryFees: sanitized },
      })
      return true
    } catch (err) {
      console.error('[useMenuManagementData] handleSaveDeliveryFees error:', err)
      throw err
    }
  }, [storeId])

  return {
    store, storeId, categories, products, coupons,
    pageLoading, storeError,
    sortedCategories, activeProducts, activeCoupons, stats, productCountByCategory,
    handleToggleProductField,
    handleDuplicateProduct,
    handleDeleteProduct,
    handleDeleteCategory,
    handleToggleCategoryActive,
    handleMoveCategoryOrder,
    handleSaveCoupon,
    handleToggleCoupon,
    handleDeleteCoupon,
    handleSaveDeliveryFees,
  }
}
