import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  FiActivity,
  FiAlertTriangle,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiEdit2,
  FiEyeOff,
  FiExternalLink,
  FiLayout,
  FiPercent,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiTrendingUp,
  FiX,
  FiTrash2
} from 'react-icons/fi'

import { db, functions } from '../../services/firebase'
import { saveMenuItem } from '../../services/menuManagement'
import {
  getStoreDocId,
  getStorePublicSlug,
  getStoreKeys,
  buildStoreScopedPayload,
} from '../../utils/storeIdentity'
import { getCallableErrorMessage } from '../../utils/callableError'
import { useConfirmDialog } from '../../components/ui/ConfirmDialogProvider'

import {
  isProductDeleted,
  isProductHidden,
  isProductUnavailable,
  hasOutOfStock,
} from '../../utils/productStatus'

// --- Utility Helpers for formatting and parsing BRL Currency ---
function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }
  const numericValue = Number(value || 0)
  if (numericValue > 999) return numericValue / 100
  return numericValue
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// --- Diacritics-insensitive string normalizer for duplicate category checks ---
function normalizeString(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatLeadTime(minutes) {
  const value = Number(minutes || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1440) {
    const days = Math.round(value / 1440)
    return `${days} dia${days > 1 ? 's' : ''}`
  }
  if (value >= 60) {
    const hours = Math.round(value / 60)
    return `${hours} hora${hours > 1 ? 's' : ''}`
  }
  return `${value} min`
}

function getProductSchedulingBadges(product) {
  const scheduling = product?.scheduling || {}
  const badges = []

  if (scheduling.mode === 'scheduled_only') {
    badges.push({ id: 'scheduled-only', label: 'Sob encomenda', tone: 'amber' })
  } else if (scheduling.mode === 'asap_and_scheduled') {
    badges.push({ id: 'scheduled-enabled', label: 'Agenda', tone: 'green' })
  } else if (scheduling.mode === 'asap_only') {
    badges.push({ id: 'asap-only', label: 'Só imediato', tone: 'gray' })
  }

  if (scheduling.minLeadMinutes) {
    const lead = formatLeadTime(scheduling.minLeadMinutes)
    if (lead) badges.push({ id: 'lead-time', label: lead, tone: 'gray' })
  }

  if (scheduling.prepaymentPolicy === 'pix_required') {
    badges.push({ id: 'pix-required', label: 'Pix antecipado', tone: 'orange' })
  }

  return badges
}

function getProductFlags(product) {
  return [
    product?.isFeatured && { id: 'featured', label: 'Destaque', tone: 'orange' },
    product?.isPopular && { id: 'popular', label: 'Mais pedido', tone: 'green' },
    product?.isPromotion && { id: 'promotion', label: 'Promoção', tone: 'red' },
    product?.acceptsCoupons === false && { id: 'no-coupons', label: 'Sem cupom', tone: 'gray' },
  ].filter(Boolean)
}

function getBadgeClass(tone) {
  const classes = {
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    orange: 'bg-orange-50 text-[#f97316] ring-orange-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
  }
  return classes[tone] || classes.gray
}

const EMPTY_PRODUCT_QUICK_FORM = {
  name: '',
  price: '0,00',
  categoryId: '',
  isAvailable: true,
  isVisible: true,
  isFeatured: false,
  isPopular: false,
  isPromotion: false,
  acceptsCoupons: true,
}

const EMPTY_CATEGORY_QUICK_FORM = {
  name: '',
  description: '',
  isVisible: true,
  isActive: true,
}

// --- Premium Custom Toggle Switch component ---
function PremiumToggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[#f97316]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function ProductFlagToggles({ value, onChange, disabled = false }) {
  const items = [
    {
      key: 'isFeatured',
      icon: FiStar,
      label: 'Destaque',
      description: 'Aparece com mais força nas áreas de destaque.',
    },
    {
      key: 'isPopular',
      icon: FiTrendingUp,
      label: 'Mais pedido',
      description: 'Mostra o selo de popularidade na vitrine pública.',
    },
    {
      key: 'isPromotion',
      icon: FiTag,
      label: 'Promoção',
      description: 'Reforça ofertas e campanhas no cardápio.',
    },
    {
      key: 'acceptsCoupons',
      icon: FiPercent,
      label: 'Aceita cupons',
      description: 'Permite aplicar cupons de desconto neste item.',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon
        const checked = item.key === 'acceptsCoupons'
          ? value?.acceptsCoupons !== false
          : Boolean(value?.[item.key])

        return (
          <label
            key={item.key}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition ${
              checked
                ? 'border-orange-100 bg-orange-50/60'
                : 'border-gray-100 bg-[#f9fafb] hover:bg-white'
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${checked ? 'bg-white text-[#f97316]' : 'bg-white text-gray-400'}`}>
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-[#111827]">{item.label}</p>
                <p className="mt-0.5 text-[10px] leading-normal text-[#6b7280]">{item.description}</p>
              </div>
            </div>
            <PremiumToggle
              checked={checked}
              disabled={disabled}
              onChange={(val) => onChange(item.key, val)}
            />
          </label>
        )
      })}
    </div>
  )
}

// --- Main MerchantDrawer Component ---
export default function MerchantDrawer({
  isOpen,
  onClose,
  store,
  categories = [],
  products = [],
  quickEditProduct = null,
  onQuickEditHandled,
}) {
  const { confirm } = useConfirmDialog()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  
  // Quick Search & Edit states
  const [productSearch, setProductSearch] = useState('')
  const [quickEditProductState, setQuickEditProductState] = useState(null)
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_QUICK_FORM)

  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_QUICK_FORM)

  // Quick Creation states
  const [showCreateProductForm, setShowCreateProductForm] = useState(false)
  const [newProductForm, setNewProductForm] = useState(EMPTY_PRODUCT_QUICK_FORM)

  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false)
  const [newCategoryForm, setNewCategoryForm] = useState(EMPTY_CATEGORY_QUICK_FORM)

  const storeDocId = getStoreDocId(store)
  const storeKeys = useMemo(() => getStoreKeys(store), [store])

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }, [])

  // --- Strict Shop Ownership Security Helper ---
  const belongsToCurrentStore = useCallback((item) => {
    const itemStoreId = String(item?.storeId || '').trim()
    return Boolean(item?.id && itemStoreId && storeKeys.includes(itemStoreId))
  }, [storeKeys])

  // --- Ownership Filtered Lists ---
  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.isDeleted !== true && !c.deletedAt)
      .filter((c) => {
        const catStoreId = c?.storeId
        return catStoreId && storeKeys.includes(catStoreId)
      })
      .sort((a, b) => Number(a?.order ?? 9999) - Number(b?.order ?? 9999))
  }, [categories, storeKeys])

  const activeProducts = useMemo(() => {
    return [...products]
      .filter((p) => !isProductDeleted(p))
      .filter((p) => {
        const pStoreId = p?.storeId
        return pStoreId && storeKeys.includes(pStoreId)
      })
  }, [products, storeKeys])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return activeProducts
    return activeProducts.filter((product) => {
      return [product.name, product.description, product.categoryName]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [productSearch, activeProducts])

  // --- Category Map & Dynamic Name Resolver ---
  const categoryById = useMemo(() => {
    return new Map(sortedCategories.map((cat) => [cat.id, cat]))
  }, [sortedCategories])

  const getProductCategoryLabel = useCallback((product) => {
    if (!product.categoryId) return 'Sem categoria'
    const category = categoryById.get(product.categoryId)
    return category?.name || 'Categoria removida'
  }, [categoryById])

  // Populate quick product edit when triggered from storefront prop
  const handleQuickEditProduct = useCallback((product) => {
    setQuickEditProductState(product)
    setEditingCategoryId(null)
    setShowCreateProductForm(false)
    setShowCreateCategoryForm(false)
    setProductForm({
      ...EMPTY_PRODUCT_QUICK_FORM,
      name: product.name || '',
      price: moneyToInput(product.price, product.priceCents),
      categoryId: product.categoryId || '',
      isAvailable: product.isAvailable !== false,
      isVisible: product.isVisible !== false,
      isFeatured: Boolean(product.isFeatured),
      isPopular: Boolean(product.isPopular),
      isPromotion: Boolean(product.isPromotion),
      acceptsCoupons: product.acceptsCoupons !== false,
    })
  }, [])

  useEffect(() => {
    if (isOpen && quickEditProduct) {
      handleQuickEditProduct(quickEditProduct)
      onQuickEditHandled?.()
    }
  }, [isOpen, quickEditProduct, handleQuickEditProduct, onQuickEditHandled])

  // --- Real-time Metrics Computations ---
  const metrics = useMemo(() => {
    const totalProducts = activeProducts.length
    const outOfStock = activeProducts.filter((p) => hasOutOfStock(p)).length
    const hidden = activeProducts.filter((p) => isProductHidden(p)).length
    const totalCategories = sortedCategories.length
    const scheduledProducts = activeProducts.filter((p) => p?.scheduling?.mode === 'scheduled_only').length
    const highlighted = activeProducts.filter((p) => p.isFeatured || p.isPopular || p.isPromotion).length

    return {
      totalProducts,
      outOfStock,
      hidden,
      totalCategories,
      scheduledProducts,
      highlighted,
    }
  }, [activeProducts, sortedCategories])

  // --- Firestore Actions ---
  const handleToggleStoreOpen = async (newStatus) => {
    if (!storeDocId) return
    setLoading(true)
    try {
      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId: storeDocId,
        payload: {
          isOpen: newStatus,
        },
      })
      showToast(newStatus ? 'Boas vendas! A loja foi aberta.' : 'Loja fechada com sucesso.')
    } catch (error) {
      console.error(error)
      showToast(getCallableErrorMessage(error, 'Falha ao alterar status da loja.'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyStoreLink = async () => {
    const slug = getStorePublicSlug(store) || storeDocId
    if (!slug) return
    const url = typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : `/${slug}`
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      showToast('Link da loja copiado!')
    } catch {
      showToast('Não foi possível copiar o link automaticamente.')
    }
  }

  // --- Product Inline Switch Update ---
  const handleToggleProductField = async (product, field, value) => {
    if (!belongsToCurrentStore(product)) {
      showToast('Este item não pertence a esta loja.')
      return
    }
    try {
      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'product',
        entityId: product.id,
        payload: { [field]: value },
      })
      showToast(`Produto "${product.name}" atualizado com sucesso.`)
    } catch (error) {
      console.error(error)
      showToast('Erro ao atualizar produto.')
    }
  }

  // --- Product Form Edit Actions ---
  const handlePriceMask = (val, stateSetter) => {
    const digits = String(val).replace(/\D/g, '')
    if (!digits) {
      stateSetter((prev) => ({ ...prev, price: '0,00' }))
      return
    }
    const numeric = Number(digits) / 100
    const formatted = numeric.toFixed(2).replace('.', ',')
    stateSetter((prev) => ({ ...prev, price: formatted }))
  }

  const handleSaveProduct = async () => {
    if (!quickEditProductState?.id) return
    if (!belongsToCurrentStore(quickEditProductState)) {
      showToast('Este item não pertence a esta loja.')
      return
    }
    setLoading(true)
    try {
      const price = parseCurrency(productForm.price)
      const priceCents = Math.round(price * 100)
      const category = categoryById.get(productForm.categoryId)

      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'product',
        entityId: quickEditProductState.id,
        payload: {
          name: productForm.name.trim(),
          priceCents,
          categoryId: productForm.categoryId || '',
          categoryName: category?.name || '',
          isAvailable: productForm.isAvailable,
          isVisible: productForm.isVisible,
          isFeatured: Boolean(productForm.isFeatured),
          isPopular: Boolean(productForm.isPopular),
          isPromotion: Boolean(productForm.isPromotion),
          acceptsCoupons: productForm.acceptsCoupons !== false,
        },
      })
      showToast('Produto atualizado com sucesso!')
      setQuickEditProductState(null)
    } catch (error) {
      console.error(error)
      showToast('Erro ao salvar alterações.')
    } finally {
      setLoading(false)
    }
  }

  // --- Product Creation ---
  const handleCreateProduct = async () => {
    if (!storeDocId) return
    if (!newProductForm.name.trim()) {
      showToast('O nome do produto é obrigatório.')
      return
    }
    const price = parseCurrency(newProductForm.price)
    if (price < 0) {
      showToast('O preço deve ser maior ou igual a zero.')
      return
    }
    if (sortedCategories.length > 0 && !newProductForm.categoryId) {
      showToast('Selecione uma categoria para o produto.')
      return
    }

    setLoading(true)
    try {
      const scope = buildStoreScopedPayload(store)
      const priceCents = Math.round(price * 100)
      const category = categoryById.get(newProductForm.categoryId)

      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'product',
        payload: {
        ...scope,
        name: newProductForm.name.trim(),
        description: '',
        categoryId: newProductForm.categoryId || '',
        categoryName: category?.name || '',
        price,
        priceCents,
        oldPrice: null,
        oldPriceCents: null,
        isAvailable: newProductForm.isAvailable,
        isVisible: newProductForm.isVisible,
        isFeatured: Boolean(newProductForm.isFeatured),
        isPopular: Boolean(newProductForm.isPopular),
        isPromotion: Boolean(newProductForm.isPromotion),
        isActive: true,
        isDeleted: false,
        acceptsCoupons: newProductForm.acceptsCoupons !== false,
        scheduling: {
          mode: 'store_default',
          minLeadMinutes: null,
          maxDaysAhead: null,
          slotIntervalMinutes: null,
          fulfillmentTypes: null,
          weeklyWindows: null,
          blockedDates: [],
          prepaymentPolicy: 'store_default',
        },
        stock: null,
        },
      })

      showToast('Produto criado com sucesso!')
      setNewProductForm({
        ...EMPTY_PRODUCT_QUICK_FORM,
        categoryId: sortedCategories[0]?.id || '',
      })
      setShowCreateProductForm(false)
    } catch (error) {
      console.error(error)
      showToast('Erro ao criar produto.')
    } finally {
      setLoading(false)
    }
  }

  // --- Product Archival (Soft Delete) ---
  const handleArchiveProduct = async (product) => {
    if (!belongsToCurrentStore(product)) {
      showToast('Este item não pertence a esta loja.')
      return
    }
    const confirmed = await confirm({
      title: 'Arquivar produto?',
      description: `O produto "${product.name}" será removido do cardápio.`,
      confirmLabel: 'Arquivar produto',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      await updateDoc(doc(db, 'products', product.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      showToast(`Produto "${product.name}" arquivado.`)
    } catch (error) {
      console.error(error)
      showToast('Erro ao arquivar produto.')
    }
  }

  // --- Category Inline Switch Update ---
  const handleToggleCategoryField = async (category, field, value) => {
    if (!belongsToCurrentStore(category)) {
      showToast('Este item não pertence a esta loja.')
      return
    }
    try {
      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'category',
        entityId: category.id,
        payload: { [field]: value },
      })
      showToast(`Categoria "${category.name}" atualizada.`)
    } catch (error) {
      console.error(error)
      showToast('Erro ao atualizar categoria.')
    }
  }

  // --- Category Form Edit Actions ---
  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id)
    setQuickEditProductState(null)
    setShowCreateProductForm(false)
    setShowCreateCategoryForm(false)
    setCategoryForm({
      ...EMPTY_CATEGORY_QUICK_FORM,
      name: category.name || '',
      description: category.description || '',
      isVisible: category.isVisible !== false,
      isActive: category.isActive !== false,
    })
  }

  const handleSaveCategory = async () => {
    if (!editingCategoryId) return
    const cat = sortedCategories.find((c) => c.id === editingCategoryId)
    if (!cat || !belongsToCurrentStore(cat)) {
      showToast('Este item não pertence a esta loja.')
      return
    }
    if (!categoryForm.name.trim()) {
      showToast('O nome da categoria é obrigatório.')
      return
    }
    const isDuplicate = sortedCategories.some(
      (c) => c.id !== editingCategoryId && normalizeString(c.name) === normalizeString(categoryForm.name)
    )
    if (isDuplicate) {
      showToast('Já existe uma categoria ativa com este nome nesta loja.')
      return
    }
    setLoading(true)
    try {
      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'category',
        entityId: editingCategoryId,
        payload: {
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          isVisible: categoryForm.isVisible,
          isActive: categoryForm.isActive,
        },
      })
      showToast('Categoria atualizada com sucesso!')
      setEditingCategoryId(null)
    } catch (error) {
      console.error(error)
      showToast('Erro ao atualizar categoria.')
    } finally {
      setLoading(false)
    }
  }

  // --- Category Creation ---
  const handleCreateCategory = async () => {
    if (!storeDocId) return
    if (!newCategoryForm.name.trim()) {
      showToast('O nome da categoria é obrigatório.')
      return
    }

    // Accents/Case-insensitive check for duplicate name
    const isDuplicate = sortedCategories.some(
      (c) => normalizeString(c.name) === normalizeString(newCategoryForm.name)
    )
    if (isDuplicate) {
      showToast('Já existe uma categoria ativa com este nome nesta loja.')
      return
    }

    setLoading(true)
    try {
      const scope = buildStoreScopedPayload(store)
      const order = sortedCategories.length
      const position = order

      await saveMenuItem({
        storeId: storeDocId,
        entityType: 'category',
        payload: {
        ...scope,
        name: newCategoryForm.name.trim(),
        description: newCategoryForm.description.trim(),
        isVisible: newCategoryForm.isVisible,
        isActive: newCategoryForm.isActive,
        isDeleted: false,
        order,
        position,
        },
      })

      showToast('Categoria criada com sucesso!')
      setNewCategoryForm(EMPTY_CATEGORY_QUICK_FORM)
      setShowCreateCategoryForm(false)
    } catch (error) {
      console.error(error)
      showToast('Erro ao criar categoria.')
    } finally {
      setLoading(false)
    }
  }

  // --- Category Archival (Soft Delete) ---
  const handleArchiveCategory = async (category) => {
    if (!belongsToCurrentStore(category)) {
      showToast('Este item não pertence a esta loja.')
      return
    }

    const count = activeProducts.filter((p) => p.categoryId === category.id).length
    let msg = `Tem certeza de que deseja arquivar a categoria "${category.name}"?`
    if (count > 0) {
      msg = `Esta categoria possui ${count} produto(s) ativo(s) vinculado(s). Se você a arquivar, esses produtos ficarão órfãos e sem categoria visível no cardápio público. Deseja continuar?`
    }

    const confirmed = await confirm({
      title: 'Arquivar categoria?',
      description: msg,
      confirmLabel: 'Arquivar categoria',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      await updateDoc(doc(db, 'categories', category.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      showToast(`Categoria "${category.name}" arquivada.`)
    } catch (error) {
      console.error(error)
      showToast('Erro ao arquivar categoria.')
    }
  }

  if (!isOpen) return null

  const inputClass =
    'h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-semibold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100'

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      {/* Overlay Background */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="Fechar painel"
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col bg-[#f9fafb] shadow-2xl">
        {/* Compact Header */}
        <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                <FiSettings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-[#111827]">
                  Atalhos da loja
                </h2>
                <p className="text-xs text-[#6b7280]">
                  Ajustes rápidos de vitrine e operação
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
              aria-label="Fechar"
            >
              <FiX size={18} />
            </button>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#111827]">
                {store?.name || 'Sua loja'}
              </p>
              <p className="truncate text-xs text-[#6b7280]">
                /{getStorePublicSlug(store) || storeDocId}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyStoreLink}
              className="flex h-9 px-3 items-center justify-center gap-2 rounded-xl bg-white text-[#f97316] border border-orange-100 shadow-sm transition hover:bg-orange-50 text-xs font-bold shrink-0"
              title="Copiar link da loja"
            >
              <FiCopy size={14} />
              Copiar Link
            </button>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5">
          {toast && (
            <div className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-xs font-bold text-[#f97316] shadow-sm animate-fade-in">
              <FiCheck size={16} />
              {toast}
            </div>
          )}

          {/* MAIN DASHBOARD PANEL VIEW */}
          {!quickEditProductState && !editingCategoryId && !showCreateProductForm && !showCreateCategoryForm && (
            <>
              {/* Operation Toggle Switch Card */}
              <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`relative flex h-3.5 w-3.5 rounded-full ${
                        store?.isOpen ? 'bg-[#f97316]' : 'bg-red-500'
                      }`}
                    >
                      {store?.isOpen && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f97316] opacity-75" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-[#111827] uppercase tracking-wider">
                        {store?.isOpen ? 'LOJA ABERTA' : 'LOJA FECHADA'}
                      </h3>
                      <p className="text-xs text-[#6b7280]">
                        {store?.isOpen
                          ? 'Clientes podem ver e finalizar pedidos.'
                          : 'Clientes apenas visualizam, compras bloqueadas.'}
                      </p>
                    </div>
                  </div>

                  <PremiumToggle
                    checked={Boolean(store?.isOpen)}
                    disabled={loading}
                    onChange={handleToggleStoreOpen}
                  />
                </div>
              </div>

              {/* Stat Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
                    <FiBox size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Produtos</p>
                    <p className="text-lg font-black text-[#111827]">{metrics.totalProducts}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
                    <FiActivity size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Esgotados</p>
                    <p className="text-lg font-black text-red-600">{metrics.outOfStock}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                    <FiEyeOff size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Ocultos</p>
                    <p className="text-lg font-black text-[#111827]">{metrics.hidden}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                    <FiLayout size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Categorias</p>
                    <p className="text-lg font-black text-[#111827]">{metrics.totalCategories}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <FiCalendar size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Sob encomenda</p>
                    <p className="text-lg font-black text-[#111827]">{metrics.scheduledProducts}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <FiStar size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#6b7280] font-medium">Vitrine</p>
                    <p className="text-lg font-black text-[#111827]">{metrics.highlighted}</p>
                  </div>
                </div>
              </div>

              {/* Dashboard Shortcuts Panel */}
              <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-[#111827]">Atalhos do painel</h3>
                  <p className="text-xs text-[#6b7280]">Acesse o painel completo para edições profundas.</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <Link
                    to="/dashboard/menu?tab=produtos"
                    className="group flex flex-col justify-between p-3.5 rounded-2xl bg-[#f9fafb] border border-gray-100 transition hover:bg-orange-50/50 hover:border-orange-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white transition-all">
                        <FiLayout size={15} />
                      </div>
                      <FiExternalLink size={12} className="text-gray-400 group-hover:text-[#f97316] transition-colors" />
                    </div>
                    <span className="text-xs font-black text-[#111827]">Cardápio Completo</span>
                  </Link>

                  <Link
                    to="/dashboard/settings"
                    className="group flex flex-col justify-between p-3.5 rounded-2xl bg-[#f9fafb] border border-gray-100 transition hover:bg-orange-50/50 hover:border-orange-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white transition-all">
                        <FiSettings size={15} />
                      </div>
                      <FiExternalLink size={12} className="text-gray-400 group-hover:text-[#f97316] transition-colors" />
                    </div>
                    <span className="text-xs font-black text-[#111827]">Configurações</span>
                  </Link>

                  <Link
                    to="/dashboard/orders"
                    className="group flex flex-col justify-between p-3.5 rounded-2xl bg-[#f9fafb] border border-gray-100 transition hover:bg-orange-50/50 hover:border-orange-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white transition-all">
                        <FiShoppingBag size={15} />
                      </div>
                      <FiExternalLink size={12} className="text-gray-400 group-hover:text-[#f97316] transition-colors" />
                    </div>
                    <span className="text-xs font-black text-[#111827]">Ver Pedidos</span>
                  </Link>

                  <Link
                    to="/dashboard/reviews"
                    className="group flex flex-col justify-between p-3.5 rounded-2xl bg-[#f9fafb] border border-gray-100 transition hover:bg-orange-50/50 hover:border-orange-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white transition-all">
                        <FiStar size={15} />
                      </div>
                      <FiExternalLink size={12} className="text-gray-400 group-hover:text-[#f97316] transition-colors" />
                    </div>
                    <span className="text-xs font-black text-[#111827]">Avaliações</span>
                  </Link>
                </div>
              </div>

              {/* Categorias Quick Edit Section */}
              <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-[#111827]">Gestão de Categorias</h3>
                    <p className="text-xs text-[#6b7280]">Status instantâneo e remoções rápidas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCategoryForm(true)}
                    className="rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] transition hover:bg-[#f97316] hover:text-white shrink-0"
                  >
                    + Categoria
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto pr-1">
                  {sortedCategories.map((cat) => {
                    const productCount = activeProducts.filter((p) => p.categoryId === cat.id).length

                    return (
                      <div key={cat.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-[#111827] truncate">{cat.name}</p>
                            <span className="rounded-lg bg-orange-50 px-1.5 py-0.5 text-[9px] font-black text-[#f97316] uppercase shrink-0">
                              {productCount} {productCount === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-[10px] text-[#6b7280] truncate mt-0.5">{cat.description}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-50">
                          {/* Visible Switch */}
                          <div className="flex items-center sm:flex-col gap-2 sm:gap-0.5">
                            <span className="text-[9px] uppercase tracking-wide font-black text-[#6b7280] w-12 sm:w-auto text-left sm:text-center">Menu</span>
                            <PremiumToggle
                              checked={cat.isVisible !== false}
                              onChange={(val) => handleToggleCategoryField(cat, 'isVisible', val)}
                            />
                          </div>

                          {/* Active Switch */}
                          <div className="flex items-center sm:flex-col gap-2 sm:gap-0.5">
                            <span className="text-[9px] uppercase tracking-wide font-black text-[#6b7280] w-12 sm:w-auto text-left sm:text-center">Ativa</span>
                            <PremiumToggle
                              checked={cat.isActive !== false}
                              onChange={(val) => handleToggleCategoryField(cat, 'isActive', val)}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEditCategory(cat)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#f97316] transition hover:bg-[#f97316] hover:text-white"
                              title="Editar Categoria"
                            >
                              <FiEdit2 size={13} />
                            </button>

                            {/* Archive Button */}
                            <button
                              type="button"
                              onClick={() => handleArchiveCategory(cat)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white"
                              title="Arquivar Categoria"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {sortedCategories.length === 0 && (
                    <p className="text-center py-4 text-xs font-medium text-gray-400">Nenhuma categoria ativa.</p>
                  )}
                </div>
              </div>

              {/* Produtos Search & Quick Edit Section */}
              <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-[#111827]">Gestão de Produtos</h3>
                    <p className="text-xs text-[#6b7280]">Altere preços, status e arquive com facilidade.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewProductForm({
                        ...EMPTY_PRODUCT_QUICK_FORM,
                        categoryId: sortedCategories[0]?.id || '',
                      })
                      setShowCreateProductForm(true)
                    }}
                    className="rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] transition hover:bg-[#f97316] hover:text-white shrink-0"
                  >
                    + Produto Rápido
                  </button>
                </div>

                <div className="relative">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Pesquisar produto..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto pr-1 space-y-0.5">
                  {filteredProducts.map((p) => {
                    const outOfStock = hasOutOfStock(p)
                    const unavailable = isProductUnavailable(p)
                    const hidden = isProductHidden(p)

                    return (
                      <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-[#111827] truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-bold text-[#f97316]">
                              {formatMoney(normalizeMoney(p.price, p.priceCents))}
                            </span>
                            <span className="text-[10px] text-gray-400">•</span>
                            <span className="text-[10px] text-gray-400 truncate">{getProductCategoryLabel(p)}</span>
                          </div>
                          
                          {/* Badges */}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {hidden && (
                              <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-gray-500 ring-1 ring-gray-200">
                                Oculto
                              </span>
                            )}
                            {unavailable && (
                              <span className="rounded-lg bg-red-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-500 ring-1 ring-red-100">
                                Indisponível
                              </span>
                            )}
                            {outOfStock && (
                              <span className="rounded-lg bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-600 ring-1 ring-amber-100">
                                Esgotado
                              </span>
                            )}
                            {[...getProductFlags(p), ...getProductSchedulingBadges(p)].slice(0, 4).map((badge) => (
                              <span
                                key={badge.id}
                                className={`rounded-lg px-1.5 py-0.5 text-[9px] font-black uppercase ring-1 ${getBadgeClass(badge.tone)}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-50">
                          {/* Visible Toggle */}
                          <div className="flex items-center sm:flex-col gap-2 sm:gap-0.5">
                            <span className="text-[9px] uppercase tracking-wide font-black text-[#6b7280] w-12 sm:w-auto text-left sm:text-center">Visível</span>
                            <PremiumToggle
                              checked={!hidden}
                              onChange={(val) => handleToggleProductField(p, 'isVisible', val)}
                            />
                          </div>

                          {/* Available Toggle */}
                          <div className="flex items-center sm:flex-col gap-2 sm:gap-0.5">
                            <span className="text-[9px] uppercase tracking-wide font-black text-[#6b7280] w-12 sm:w-auto text-left sm:text-center">Disp.</span>
                            <PremiumToggle
                              checked={p.isAvailable !== false}
                              onChange={(val) => handleToggleProductField(p, 'isAvailable', val)}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Quick Edit */}
                            <button
                              type="button"
                              onClick={() => handleQuickEditProduct(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#f97316] transition hover:bg-[#f97316] hover:text-white"
                              title="Editar Produto"
                            >
                              <FiEdit2 size={13} />
                            </button>

                            {/* Archive Button */}
                            <button
                              type="button"
                              onClick={() => handleArchiveProduct(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white"
                              title="Arquivar Produto"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-xs font-medium text-gray-400">Nenhum produto encontrado.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* NEW PRODUCT FORM (QUICK CREATE) OVERLAY */}
          {showCreateProductForm && (
            <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#111827]">Criar Produto (Rápido)</h3>
                  <p className="text-xs text-[#6b7280]">Criação simples. Para opcionais, imagem e encomenda, use o editor completo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateProductForm(false)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                >
                  Voltar
                </button>
              </div>

              {sortedCategories.length === 0 && (
                <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center space-y-3">
                  <FiAlertTriangle className="mx-auto text-orange-500" size={24} />
                  <p className="text-xs font-bold text-gray-700 leading-relaxed">
                    Sua loja não possui nenhuma categoria ativa ainda. Para cadastrar um produto, você precisa criar uma categoria primeiro.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCategoryForm(true)
                      setShowCreateProductForm(false)
                    }}
                    className="mx-auto inline-flex items-center gap-1.5 rounded-xl bg-[#f97316] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ea580c]"
                  >
                    + Criar Categoria Agora
                  </button>
                </div>
              )}

              {/* Warnings for Products without category */}
              {sortedCategories.length > 0 && !newProductForm.categoryId && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 flex gap-2.5 items-start">
                  <FiAlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={16} />
                  <p className="text-[11px] font-bold text-amber-800 leading-normal">
                    Aviso: O produto será criado sem categoria. Recomendamos selecionar uma categoria para que ele fique organizado no menu do cliente.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Coca-Cola Lata 350ml"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Preço *
                    </label>
                    <input
                      type="text"
                      value={newProductForm.price}
                      onChange={(e) => handlePriceMask(e.target.value, setNewProductForm)}
                      placeholder="0,00"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Categoria
                    </label>
                    <select
                      value={newProductForm.categoryId}
                      onChange={(e) => setNewProductForm((p) => ({ ...p, categoryId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Selecione...</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Disponível</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Permitir venda</p>
                    </div>
                    <PremiumToggle
                      checked={newProductForm.isAvailable}
                      onChange={(val) => setNewProductForm((p) => ({ ...p, isAvailable: val }))}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Visível</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Mostrar no cardápio</p>
                    </div>
                    <PremiumToggle
                      checked={newProductForm.isVisible}
                      onChange={(val) => setNewProductForm((p) => ({ ...p, isVisible: val }))}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">Vitrine e descontos</p>
                  <ProductFlagToggles
                    value={newProductForm}
                    disabled={loading}
                    onChange={(key, val) => setNewProductForm((p) => ({ ...p, [key]: val }))}
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateProductForm(false)}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-xs font-black text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateProduct}
                    disabled={loading || !newProductForm.name.trim()}
                    className="flex-1 rounded-2xl bg-[#f97316] py-3.5 text-xs font-black text-white hover:bg-[#ea580c] shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : 'Adicionar Produto'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT QUICK EDIT PANEL */}
          {quickEditProductState && (
            <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#111827]">Editar Produto (Rápido)</h3>
                  <p className="text-xs text-[#6b7280]">Ajuste direto e seguro no banco de dados.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickEditProductState(null)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-4">
                {quickEditProductState?.scheduling?.mode && quickEditProductState.scheduling.mode !== 'store_default' && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600">
                        <FiCalendar size={16} />
                      </span>
                      <div>
                        <p className="text-xs font-black text-amber-900">Produto com regra de encomenda</p>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-800">
                          Este item tem regras de agendamento/Pix. Use o editor completo para alterar antecedência, horários ou pagamento.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome do produto"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Preço (R$) *
                    </label>
                    <input
                      type="text"
                      value={productForm.price}
                      onChange={(e) => handlePriceMask(e.target.value, setProductForm)}
                      placeholder="0,00"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Categoria
                    </label>
                    <select
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm((p) => ({ ...p, categoryId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Sem categoria</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Disponível</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Permitir venda</p>
                    </div>
                    <PremiumToggle
                      checked={productForm.isAvailable}
                      onChange={(val) => setProductForm((p) => ({ ...p, isAvailable: val }))}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Visível</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Mostrar no cardápio</p>
                    </div>
                    <PremiumToggle
                      checked={productForm.isVisible}
                      onChange={(val) => setProductForm((p) => ({ ...p, isVisible: val }))}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">Vitrine e descontos</p>
                  <ProductFlagToggles
                    value={productForm}
                    disabled={loading}
                    onChange={(key, val) => setProductForm((p) => ({ ...p, [key]: val }))}
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setQuickEditProductState(null)}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-xs font-black text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProduct}
                    disabled={loading || !productForm.name.trim()}
                    className="flex-1 rounded-2xl bg-[#f97316] py-3.5 text-xs font-black text-white hover:bg-[#ea580c] shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NEW CATEGORY FORM (QUICK CREATE) OVERLAY */}
          {showCreateCategoryForm && (
            <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#111827]">Criar Categoria (Rápido)</h3>
                  <p className="text-xs text-[#6b7280]">Adicione um novo agrupador ao seu cardápio público.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateCategoryForm(false)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    value={newCategoryForm.name}
                    onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Pizzas Clássicas"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Descrição Curta
                  </label>
                  <input
                    type="text"
                    value={newCategoryForm.description}
                    onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Assadas no forno a lenha com queijo artesanal"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Ativa</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Disponível na loja</p>
                    </div>
                    <PremiumToggle
                      checked={newCategoryForm.isActive}
                      onChange={(val) => setNewCategoryForm((prev) => ({ ...prev, isActive: val }))}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Visível Menu</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Listar no topo</p>
                    </div>
                    <PremiumToggle
                      checked={newCategoryForm.isVisible}
                      onChange={(val) => setNewCategoryForm((prev) => ({ ...prev, isVisible: val }))}
                    />
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateCategoryForm(false)}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-xs font-black text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={loading || !newCategoryForm.name.trim()}
                    className="flex-1 rounded-2xl bg-[#f97316] py-3.5 text-xs font-black text-white hover:bg-[#ea580c] shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : 'Adicionar Categoria'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY QUICK EDIT PANEL */}
          {editingCategoryId && (
            <div className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#111827]">Editar Categoria (Rápido)</h3>
                  <p className="text-xs text-[#6b7280]">Atualização imediata de cabeçalho do cardápio.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCategoryId(null)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome da categoria"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Descrição Curta
                  </label>
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Pizzas quentinhas assadas no forno"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Ativa</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Publicada na loja</p>
                    </div>
                    <PremiumToggle
                      checked={categoryForm.isActive}
                      onChange={(val) => setCategoryForm((prev) => ({ ...prev, isActive: val }))}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-50 bg-[#f9fafb] p-4">
                    <div>
                      <p className="text-xs font-black text-[#111827]">Visível Menu</p>
                      <p className="text-[10px] text-[#6b7280] leading-normal">Mostrar no topo</p>
                    </div>
                    <PremiumToggle
                      checked={categoryForm.isVisible}
                      onChange={(val) => setCategoryForm((prev) => ({ ...prev, isVisible: val }))}
                    />
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingCategoryId(null)}
                    disabled={loading}
                    className="flex-1 rounded-2xl border border-gray-200 py-3.5 text-xs font-black text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCategory}
                    disabled={loading || !categoryForm.name.trim()}
                    className="flex-1 rounded-2xl bg-[#f97316] py-3.5 text-xs font-black text-white hover:bg-[#ea580c] shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
