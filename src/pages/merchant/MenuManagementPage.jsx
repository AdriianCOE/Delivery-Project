// ─────────────────────────────────────────────────────────────────────────────
// src/pages/merchant/MenuManagementPage.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiGrid,
  FiImage,
  FiInfo,
  FiList,
  FiLoader,
  FiPackage,
  FiPlus,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadImageToCloudinary } from '../../services/cloudinary'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import {
  getStoreDocId,
  getStorePublicSlug,
  getStoreKeys,
  buildStoreScopedPayload,
} from '../../utils/storeIdentity'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  oldPrice: '',
  categoryId: '',
  imageUrl: '',
  imagePublicId: '',
  preparationTime: '',
  isActive: true,
  isAvailable: true,
  isVisible: true,
  isFeatured: false,
  isPromotion: false,
  acceptsCoupon: true,
  order: 0,
  optionGroups: [],
  extras: [],
}

const STATUS_FILTERS = [
  { id: 'all',         label: 'Todos' },
  { id: 'active',      label: 'Ativos' },
  { id: 'unavailable', label: 'Indisponíveis' },
  { id: 'hidden',      label: 'Ocultos' },
  { id: 'featured',    label: 'Destaques' },
  { id: 'promo',       label: 'Promoção' },
  { id: 'no-image',    label: 'Sem imagem' },
]

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS  (idênticos ao MerchantDrawer para manter compatibilidade total)
// ─────────────────────────────────────────────────────────────────────────────

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) return Number(centsValue || 0) / 100
  const n = Number(value || 0)
  return n > 999 ? n / 100 : n
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

function createLocalId(prefix = 'item') {
  try { return crypto.randomUUID() } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

function createEmptyOption() {
  return { id: createLocalId('option'), name: '', description: '', price: '', available: true }
}

function createEmptyOptionGroup() {
  return {
    id: createLocalId('group'),
    title: '', description: '', type: 'single',
    required: true, min: '1', max: '1',
    pricingMode: 'additive', includedQuantity: '1',
    options: [createEmptyOption()],
  }
}

function normalizeProductOptionGroupsForForm(product) {
  const rawGroups = Array.isArray(product?.optionGroups) ? product.optionGroups
    : Array.isArray(product?.optionsGroups) ? product.optionsGroups
    : Array.isArray(product?.customizationGroups) ? product.customizationGroups
    : []

  return rawGroups.map((group, gi) => {
    const type = ['single', 'multiple', 'quantity'].includes(group?.type) ? group.type
      : group?.allowQuantity ? 'quantity'
      : Number(group?.max || group?.maxSelections || 1) === 1 ? 'single' : 'multiple'
    const required = Boolean(group?.required || group?.isRequired || Number(group?.min || 0) > 0)
    const min = Number(group?.min ?? group?.minSelections ?? (required ? 1 : 0))
    const max = type === 'single' ? 1 : Number(group?.max ?? group?.maxSelections ?? 0)

    return {
      id: group?.id || group?.groupId || createLocalId(`group-${gi}`),
      title: group?.title || group?.name || '',
      description: group?.description || group?.subtitle || '',
      type, required,
      min: String(Number.isFinite(min) ? min : required ? 1 : 0),
      max: String(Number.isFinite(max) ? max : type === 'single' ? 1 : 0),
      pricingMode: group?.pricingMode || 'additive',
      includedQuantity: String(group?.includedQuantity ?? (min || 1)),
      options: Array.isArray(group?.options) ? group.options.map((opt, oi) => ({
        id: opt?.id || opt?.optionId || createLocalId(`opt-${oi}`),
        name: opt?.name || opt?.title || '',
        description: opt?.description || '',
        price: moneyToInput(opt?.price, opt?.priceCents),
        available: opt?.available !== false && opt?.isAvailable !== false,
      })) : [],
    }
  })
}

function sanitizeOptionGroupsForSave(optionGroups = []) {
  return optionGroups
    .map((group) => {
      const type = ['single', 'multiple', 'quantity'].includes(group.type) ? group.type : 'single'
      const required = Boolean(group.required)
      const min = Math.max(required ? 1 : 0, Number(group.min || 0))
      const max = type === 'single' ? 1 : Math.max(min, Number(group.max || 0))
      const options = (Array.isArray(group.options) ? group.options : [])
        .filter((o) => o.name.trim())
        .map((o) => {
          const price = parseCurrency(o.price)
          const optionId = o.id || createLocalId('option')
          return {
            id: optionId, optionId,
            name: o.name.trim(), description: (o.description || '').trim(),
            price, priceCents: Math.round(price * 100),
            available: o.available !== false, isAvailable: o.available !== false,
          }
        })
      const groupId = group.id || createLocalId('group')
      return {
        id: groupId, groupId,
        title: (group.title || '').trim(), name: (group.title || '').trim(),
        description: (group.description || '').trim(),
        type, required, isRequired: required,
        min, minSelections: min, max, maxSelections: max,
        allowQuantity: type === 'quantity',
        pricingMode: group.pricingMode || 'additive',
        includedQuantity: Math.max(0, Number(group.includedQuantity || min || 1)),
        options,
      }
    })
    .filter((g) => g.title && g.options.length > 0)
}

function cleanObject(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const isError = toast.type === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      className={`fixed bottom-24 left-1/2 z-[200] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl shadow-gray-900/10 backdrop-blur-xl lg:bottom-6 ${
        isError ? 'border-red-100 text-red-700' : 'border-orange-100 text-[#111827]'
      }`}
    >
      {isError
        ? <FiAlertCircle className="shrink-0 text-red-500" size={18} />
        : <FiCheckCircle className="shrink-0 text-[#f97316]" size={18} />}
      <span className="text-sm font-bold">{toast.message}</span>
    </motion.div>
  )
}

function StatCard({ icon: Icon, label, value, color, onClick, active }) {
  const palettes = {
    orange: 'bg-orange-50 text-[#f97316]',
    green:  'bg-emerald-50 text-emerald-600',
    red:    'bg-red-50 text-red-500',
    blue:   'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray:   'bg-gray-100 text-gray-500',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-[1.5rem] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        active ? 'border-[#f97316] ring-2 ring-orange-100' : 'border-gray-100'
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${palettes[color] || palettes.orange}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-[#9ca3af]">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-[#111827]">{value}</p>
      </div>
    </button>
  )
}

function SkeletonProductRow() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
      <div className="h-16 w-16 shrink-0 rounded-2xl bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-gray-100" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
        <div className="h-3 w-1/4 rounded bg-gray-100" />
      </div>
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

function ProductBadges({ product }) {
  const badges = []
  if (product.isFeatured)          badges.push({ l: '⭐ Destaque',    c: 'bg-yellow-50 text-yellow-700 ring-yellow-200' })
  if (product.isPromotion)         badges.push({ l: '🏷️ Promoção',    c: 'bg-red-50 text-red-600 ring-red-200' })
  if (product.isAvailable === false) badges.push({ l: 'Indisponível',  c: 'bg-gray-100 text-gray-600 ring-gray-200' })
  if (product.isVisible === false)   badges.push({ l: 'Oculto',        c: 'bg-gray-100 text-gray-500 ring-gray-200' })
  if (product.isActive === false)    badges.push({ l: 'Inativo',       c: 'bg-red-50 text-red-500 ring-red-200' })
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b.l} className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${b.c}`}>
          {b.l}
        </span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION GROUPS EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function OptionGroupsEditor({ groups, onChange }) {
  const addGroup  = () => onChange([...groups, createEmptyOptionGroup()])
  const rmGroup   = (gi) => onChange(groups.filter((_, i) => i !== gi))
  const upGroup   = (gi, field, val) => onChange(groups.map((g, i) => i === gi ? { ...g, [field]: val } : g))
  const addOption = (gi) => onChange(groups.map((g, i) => i === gi ? { ...g, options: [...g.options, createEmptyOption()] } : g))
  const rmOption  = (gi, oi) => onChange(groups.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g))
  const upOption  = (gi, oi, field, val) => onChange(groups.map((g, i) =>
    i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, [field]: val } : o) } : g
  ))

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {groups.map((group, gi) => (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
          >
            {/* Group header */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-[#f97316] text-xs font-black text-white">
                  {gi + 1}
                </div>
                <span className="text-sm font-black text-[#111827]">Grupo de opções</span>
              </div>
              <button type="button" onClick={() => rmGroup(gi)}
                className="grid h-7 w-7 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100" aria-label="Remover grupo">
                <FiX size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Nome do grupo *</label>
                <input type="text" value={group.title} onChange={(e) => upGroup(gi, 'title', e.target.value)}
                  placeholder="Ex: Escolha o tamanho" maxLength={80}
                  className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>

              {/* Type + Required */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Tipo</label>
                  <select value={group.type}
                    onChange={(e) => { upGroup(gi, 'type', e.target.value); if (e.target.value === 'single') upGroup(gi, 'max', '1') }}
                    className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]">
                    <option value="single">Escolha única</option>
                    <option value="multiple">Múltipla escolha</option>
                    <option value="quantity">Com quantidade</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Obrigatoriedade</label>
                  <select value={group.required ? 'true' : 'false'}
                    onChange={(e) => upGroup(gi, 'required', e.target.value === 'true')}
                    className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]">
                    <option value="true">Obrigatório</option>
                    <option value="false">Opcional</option>
                  </select>
                </div>
              </div>

              {/* Min / Max for multiple/quantity */}
              {group.type !== 'single' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Mín</label>
                    <input type="number" min="0" value={group.min} onChange={(e) => upGroup(gi, 'min', e.target.value)}
                      className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Máx</label>
                    <input type="number" min="1" value={group.max} onChange={(e) => upGroup(gi, 'max', e.target.value)}
                      className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]" />
                  </div>
                </div>
              )}

              {/* Options list */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">Opções ({group.options.length})</p>
                {group.options.map((opt, oi) => (
                  <div key={opt.id} className="flex gap-2">
                    <input type="text" value={opt.name} onChange={(e) => upOption(gi, oi, 'name', e.target.value)}
                      placeholder={`Opção ${oi + 1}`}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-orange-100 bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]" />
                    <input type="text" inputMode="decimal" value={opt.price} onChange={(e) => upOption(gi, oi, 'price', e.target.value)}
                      placeholder="R$ 0,00"
                      className="h-10 w-24 shrink-0 rounded-xl border border-orange-100 bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]" />
                    <button type="button" onClick={() => rmOption(gi, oi)} disabled={group.options.length <= 1}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-400 transition hover:bg-red-100 disabled:opacity-30" aria-label="Remover opção">
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(gi)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 py-2 text-xs font-black text-[#f97316] transition hover:bg-orange-100">
                  <FiPlus size={13} /> Adicionar opção
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button type="button" onClick={addGroup}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 py-3 text-sm font-black text-[#f97316] transition hover:bg-orange-100">
        <FiPlus size={15} /> Novo grupo de opções
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DRAWER
// ─────────────────────────────────────────────────────────────────────────────

const DRAWER_SECTIONS = [
  { id: 'basic',   label: 'Informações' },
  { id: 'price',   label: 'Preços' },
  { id: 'image',   label: 'Imagem' },
  { id: 'status',  label: 'Status' },
  { id: 'options', label: 'Opções' },
]

function ProductDrawer({ open, onClose, editingProduct, categories, store, storeId, onToast }) {
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState('basic')
  const imgRef = useRef(null)

  // Initialize form on open
  useEffect(() => {
    if (!open) return
    setSection('basic')
    setImageFile(null)
    setImagePreview('')
    if (editingProduct) {
      setForm({
        name:            editingProduct.name || '',
        description:     editingProduct.description || '',
        price:           moneyToInput(editingProduct.price, editingProduct.priceCents),
        oldPrice:        editingProduct.oldPrice != null ? moneyToInput(editingProduct.oldPrice, editingProduct.oldPriceCents) : '',
        categoryId:      editingProduct.categoryId || '',
        imageUrl:        editingProduct.imageUrl || '',
        imagePublicId:   editingProduct.imagePublicId || '',
        preparationTime: editingProduct.preparationTime || '',
        isActive:        editingProduct.isActive !== false,
        isAvailable:     editingProduct.isAvailable !== false,
        isVisible:       editingProduct.isVisible !== false,
        isFeatured:      Boolean(editingProduct.isFeatured),
        isPromotion:     Boolean(editingProduct.isPromotion),
        acceptsCoupon:   editingProduct.acceptsCoupon !== false,
        order:           editingProduct.order || 0,
        optionGroups:    normalizeProductOptionGroupsForForm(editingProduct),
        extras:          editingProduct.extras || [],
      })
    } else {
      setForm({ ...EMPTY_PRODUCT_FORM, optionGroups: [], extras: [] })
    }
  }, [open, editingProduct])

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  const setField = useCallback((field, value) => setForm((p) => ({ ...p, [field]: value })), [])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { onToast({ type: 'error', message: 'Selecione uma imagem válida.' }); return }
    if (file.size > 5 * 1024 * 1024)   { onToast({ type: 'error', message: 'Imagem muito grande. Máximo 5MB.' }); return }
    setImageFile(file)
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview('')
    setField('imageUrl', '')
    setField('imagePublicId', '')
    if (imgRef.current) imgRef.current.value = ''
  }

  const handleSave = async () => {
    if (!form.name.trim()) { onToast({ type: 'error', message: 'Nome do produto é obrigatório.' }); return }
    const priceValue = parseCurrency(form.price)
    if (priceValue < 0)   { onToast({ type: 'error', message: 'Preço inválido.' }); return }

    setSaving(true)
    try {
      let finalImageUrl       = form.imageUrl
      let finalImagePublicId  = form.imagePublicId

      if (imageFile) {
        setImageUploading(true)
        const res = await uploadImageToCloudinary(imageFile, 'PratoBy/produtos')
        finalImageUrl       = res.secure_url || res.url || ''
        finalImagePublicId  = res.public_id || ''
        setImageUploading(false)
      }

      const oldPriceValue = form.oldPrice ? parseCurrency(form.oldPrice) : null
      const scope = buildStoreScopedPayload(store)
      const catName       = categories.find((c) => c.id === form.categoryId)?.name || ''

      const data = cleanObject({
        ...scope,
        name:         form.name.trim().slice(0, 120),
        description:  form.description.trim().slice(0, 500),
        categoryId:   form.categoryId || '',
        categoryName: catName,
        price:        priceValue,
        priceCents:   Math.round(priceValue * 100),
        oldPrice:     oldPriceValue,
        oldPriceCents: oldPriceValue != null ? Math.round(oldPriceValue * 100) : null,
        imageUrl:     finalImageUrl,
        imagePublicId: finalImagePublicId,
        isActive:     Boolean(form.isActive),
        isAvailable:  Boolean(form.isAvailable),
        isVisible:    Boolean(form.isVisible),
        isFeatured:   Boolean(form.isFeatured),
        isPromotion:  Boolean(form.isPromotion),
        acceptsCoupon: Boolean(form.acceptsCoupon),
        couponEligible: Boolean(form.acceptsCoupon),
        order:        Number(form.order) || 0,
        position:     Number(form.order) || 0,
        preparationTime: form.preparationTime?.trim() || '',
        optionGroups: sanitizeOptionGroupsForSave(form.optionGroups),
        extras:       Array.isArray(form.extras) ? form.extras : [],
        isDeleted:    false,
        updatedAt:    serverTimestamp(),
      })

      if (import.meta.env.DEV) {
        console.log('[MenuManagementPage] Salvando produto scope:', scope)
      }

      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), data)
        onToast({ type: 'success', message: 'Produto atualizado com sucesso!' })
      } else {
        data.createdAt = serverTimestamp()
        await addDoc(collection(db, 'products'), data)
        onToast({ type: 'success', message: 'Produto criado!' })
      }
      onClose()
    } catch (err) {
      console.error('[MenuManagementPage] handleSave:', err)
      onToast({ type: 'error', message: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setSaving(false)
      setImageUploading(false)
    }
  }

  const visibleImage = imagePreview || form.imageUrl

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-white shadow-2xl md:w-[640px] lg:w-[720px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-[#111827]">
                  {editingProduct ? 'Editar produto' : 'Novo produto'}
                </h2>
                <p className="mt-0.5 text-xs font-bold text-[#9ca3af]">
                  {editingProduct ? editingProduct.name : 'Preencha as informações abaixo'}
                </p>
              </div>
              <button type="button" onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100" aria-label="Fechar">
                <FiX size={18} />
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DRAWER_SECTIONS.map((sec) => (
                <button key={sec.id} type="button" onClick={() => setSection(sec.id)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    section === sec.id ? 'bg-[#f97316] text-white' : 'bg-gray-50 text-[#6b7280] hover:bg-gray-100'
                  }`}>
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">

              {/* ── Informações básicas ── */}
              {section === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Nome *</label>
                    <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                      placeholder="Ex: X-Burguer Artesanal" maxLength={120}
                      className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Descrição</label>
                    <textarea value={form.description} onChange={(e) => setField('description', e.target.value)}
                      placeholder="Ingredientes, diferenciais, tamanho..." maxLength={500} rows={3}
                      className="w-full resize-none rounded-2xl border border-orange-100/80 bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                    <p className="mt-1 text-right text-xs text-[#9ca3af]">{form.description.length}/500</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Categoria</label>
                    <select value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}
                      className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316]">
                      <option value="">Sem categoria</option>
                      {categories.filter((c) => !c.isDeleted).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Tempo de preparo</label>
                      <input type="text" value={form.preparationTime} onChange={(e) => setField('preparationTime', e.target.value)}
                        placeholder="Ex: 20-30 min"
                        className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Ordem</label>
                      <input type="number" min="0" value={form.order} onChange={(e) => setField('order', Number(e.target.value))}
                        className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Preços ── */}
              {section === 'price' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
                    <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" size={16} />
                    <p className="text-xs font-semibold leading-5 text-[#6b7280]">
                      Valores salvos em centavos internamente (2990 = R$&nbsp;29,90). Use vírgula para decimais.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Preço *</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">R$</span>
                      <input type="text" inputMode="decimal" value={form.price} onChange={(e) => setField('price', e.target.value)}
                        placeholder="0,00"
                        className="h-14 w-full rounded-2xl border border-orange-100/80 bg-white pl-11 pr-4 text-xl font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                    </div>
                    {form.price ? (
                      <p className="mt-1.5 text-xs font-bold text-[#9ca3af]">
                        {formatMoney(parseCurrency(form.price))} · {Math.round(parseCurrency(form.price) * 100)} centavos
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Preço "De" / Riscado (opcional)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">R$</span>
                      <input type="text" inputMode="decimal" value={form.oldPrice} onChange={(e) => setField('oldPrice', e.target.value)}
                        placeholder="0,00"
                        className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af]">Aparece riscado na loja indicando promoção.</p>
                  </div>
                </div>
              )}

              {/* ── Imagem ── */}
              {section === 'image' && (
                <div className="space-y-4">
                  {visibleImage ? (
                    <div className="relative">
                      <img src={visibleImage} alt="Preview" className="h-60 w-full rounded-2xl object-cover" />
                      <button type="button" onClick={handleRemoveImage}
                        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-red-500 text-white shadow-lg transition hover:bg-red-600" aria-label="Remover imagem">
                        <FiTrash2 size={15} />
                      </button>
                      {imagePreview && (
                        <div className="absolute bottom-3 left-3 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-black text-white shadow">
                          Nova imagem — aguardando salvar
                        </div>
                      )}
                    </div>
                  ) : (
                    <button type="button" onClick={() => imgRef.current?.click()}
                      className="flex h-52 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 transition hover:bg-orange-50">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-100 text-[#f97316]">
                        <FiImage size={26} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-[#111827]">Clique para selecionar</p>
                        <p className="mt-1 text-xs text-[#9ca3af]">PNG, JPG, WEBP · máx. 5 MB</p>
                      </div>
                    </button>
                  )}
                  <input ref={imgRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <button type="button" onClick={() => imgRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white py-3 text-sm font-black text-[#6b7280] transition hover:bg-orange-50 hover:text-[#f97316]">
                    <FiImage size={16} />
                    {visibleImage ? 'Trocar imagem' : 'Selecionar imagem'}
                  </button>
                </div>
              )}

              {/* ── Status ── */}
              {section === 'status' && (
                <div className="space-y-3">
                  {[
                    { key: 'isActive',     label: 'Produto ativo',         desc: 'Produto habilitado no sistema' },
                    { key: 'isAvailable',  label: 'Disponível',            desc: 'Disponível para compra agora' },
                    { key: 'isVisible',    label: 'Visível no cardápio',   desc: 'Aparece para clientes na loja' },
                    { key: 'isFeatured',   label: '⭐ Destaque',           desc: 'Aparece na seção de destaques' },
                    { key: 'isPromotion',  label: '🏷️ Promoção',           desc: 'Marcado como item promocional' },
                    { key: 'acceptsCoupon',label: '🎟️ Aceita cupom',       desc: 'Permite aplicar cupons de desconto' },
                  ].map(({ key, label, desc }) => (
                    <label key={key}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 transition hover:border-orange-100 hover:bg-orange-50/30">
                      <div>
                        <p className="text-sm font-black text-[#111827]">{label}</p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">{desc}</p>
                      </div>
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={Boolean(form[key])}
                          onChange={(e) => setField(key, e.target.checked)} className="sr-only" />
                        <div className={`h-6 w-11 rounded-full transition-colors ${form[key] ? 'bg-[#f97316]' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* ── Opções/Adicionais ── */}
              {section === 'options' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
                    <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" size={16} />
                    <p className="text-xs font-semibold leading-5 text-[#6b7280]">
                      Grupos de opções permitem customização do produto. Compatível com o modal de opções e o carrinho da loja pública.
                    </p>
                  </div>
                  <OptionGroupsEditor
                    groups={form.optionGroups}
                    onChange={(groups) => setField('optionGroups', groups)}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-3 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving || imageUploading || !form.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-[#ea580c] disabled:opacity-60">
                {saving || imageUploading ? (
                  <><FiLoader className="animate-spin" size={15} />{imageUploading ? 'Enviando imagem...' : 'Salvando...'}</>
                ) : (
                  <><FiCheck size={15} />{editingProduct ? 'Salvar alterações' : 'Criar produto'}</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY DRAWER (modal centrado)
// ─────────────────────────────────────────────────────────────────────────────

function CategoryDrawer({ open, onClose, editingCategory, storeId, store, categories, onToast }) {
  const [form, setForm] = useState({ name: '', description: '', isActive: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editingCategory
      ? { name: editingCategory.name || '', description: editingCategory.description || '', isActive: editingCategory.isActive !== false }
      : { name: '', description: '', isActive: true }
    )
  }, [open, editingCategory])

  const handleSave = async () => {
    if (!form.name.trim()) { onToast({ type: 'error', message: 'Nome da categoria é obrigatório.' }); return }
    setSaving(true)
    try {
      const scope = buildStoreScopedPayload(store)
      const nextOrder = categories.filter((c) => !c.isDeleted).length

      const data = cleanObject({
        ...scope,
        name:        form.name.trim().slice(0, 60),
        description: form.description.trim().slice(0, 300),
        order:       nextOrder,
        position:    nextOrder,
        isActive:    Boolean(form.isActive),
        isDeleted:   false,
        updatedAt:   serverTimestamp(),
      })

      if (import.meta.env.DEV) {
        console.log('[MenuManagementPage] Salvando categoria scope:', scope)
      }

      if (editingCategory?.id) {
        await updateDoc(doc(db, 'categories', editingCategory.id), data)
        onToast({ type: 'success', message: 'Categoria atualizada!' })
      } else {
        data.createdAt = serverTimestamp()
        await addDoc(collection(db, 'categories'), data)
        onToast({ type: 'success', message: 'Categoria criada!' })
      }
      onClose()
    } catch (err) {
      console.error('[MenuManagementPage] handleSaveCategory:', err)
      onToast({ type: 'error', message: 'Erro ao salvar categoria.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-[2rem] bg-white p-6 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#111827]">
                {editingCategory ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              <button type="button" onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 text-[#6b7280] transition hover:bg-gray-100" aria-label="Fechar">
                <FiX size={17} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Nome *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Hambúrgueres, Bebidas, Sobremesas..." maxLength={60} autoFocus
                  className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Descrição (opcional)</label>
                <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Breve descrição" maxLength={200}
                  className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[#111827]">Categoria ativa</p>
                  <p className="text-xs text-[#9ca3af]">Aparece na loja quando ativa</p>
                </div>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-[#f97316]" />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:bg-[#ea580c] disabled:opacity-60">
                {saving ? <><FiLoader className="animate-spin" size={14} /> Salvando...</> : <><FiCheck size={14} />{editingCategory ? 'Salvar' : 'Criar'}</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT ROW
// ─────────────────────────────────────────────────────────────────────────────

function ProductRow({ product, categories, onEdit, onDuplicate, onDelete, onToggle }) {
  const price    = normalizeMoney(product.price, product.priceCents)
  const catName  = categories.find((c) => c.id === product.categoryId)?.name || ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-100 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-16 shrink-0">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name}
            className="h-full w-full rounded-2xl object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <FiImage size={22} />
          </div>
        )}
        {product.isFeatured && (
          <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-yellow-400 text-[10px]">⭐</div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="truncate text-sm font-black text-[#111827]">{product.name}</p>
          {catName && (
            <span className="text-xs font-bold text-[#9ca3af]">{catName}</span>
          )}
        </div>

        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[#9ca3af]">{product.description}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-[#f97316]">{formatMoney(price)}</span>
          {product.oldPrice != null && normalizeMoney(product.oldPrice, product.oldPriceCents) > 0 && (
            <span className="text-xs font-bold text-gray-400 line-through">
              {formatMoney(normalizeMoney(product.oldPrice, product.oldPriceCents))}
            </span>
          )}
          <ProductBadges product={product} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Toggle disponível */}
        <button type="button" title={product.isAvailable !== false ? 'Marcar indisponível' : 'Marcar disponível'}
          onClick={() => onToggle(product.id, 'isAvailable', product.isAvailable !== false)}
          className={`grid h-8 w-8 place-items-center rounded-xl transition ${
            product.isAvailable !== false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
          }`}>
          {product.isAvailable !== false ? <FiCheck size={14} /> : <FiX size={14} />}
        </button>

        {/* Toggle visível */}
        <button type="button" title={product.isVisible !== false ? 'Ocultar' : 'Exibir'}
          onClick={() => onToggle(product.id, 'isVisible', product.isVisible !== false)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100">
          {product.isVisible !== false ? <FiEye size={14} /> : <FiEyeOff size={14} />}
        </button>

        {/* Editar */}
        <button type="button" title="Editar" onClick={() => onEdit(product)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100">
          <FiEdit2 size={14} />
        </button>

        {/* Duplicar */}
        <button type="button" title="Duplicar" onClick={() => onDuplicate(product)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100">
          <FiCopy size={14} />
        </button>

        {/* Excluir */}
        <button type="button" title="Excluir" onClick={() => onDelete(product.id)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100">
          <FiTrash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY ROW
// ─────────────────────────────────────────────────────────────────────────────

function CategoryRow({ category, productCount, index, total, onEdit, onDelete, onMoveUp, onMoveDown, onToggleActive }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-100 hover:shadow-md"
    >
      {/* Order controls */}
      <div className="flex shrink-0 flex-col gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={index === 0}
          className="grid h-6 w-6 place-items-center rounded-lg bg-gray-50 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30" aria-label="Subir">
          <FiChevronUp size={13} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1}
          className="grid h-6 w-6 place-items-center rounded-lg bg-gray-50 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30" aria-label="Descer">
          <FiChevronDown size={13} />
        </button>
      </div>

      {/* Icon */}
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
        <FiList size={18} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-[#111827]">{category.name}</p>
        {category.description && (
          <p className="mt-0.5 text-xs text-[#9ca3af] line-clamp-1">{category.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs font-bold text-[#6b7280]">{productCount} produto{productCount !== 1 ? 's' : ''}</span>
          {!category.isActive && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500">Inativa</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" title={category.isActive !== false ? 'Desativar' : 'Ativar'}
          onClick={() => onToggleActive(category.id, category.isActive !== false)}
          className={`grid h-8 w-8 place-items-center rounded-xl transition ${
            category.isActive !== false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}>
          {category.isActive !== false ? <FiCheck size={14} /> : <FiX size={14} />}
        </button>
        <button type="button" title="Editar" onClick={() => onEdit(category)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100">
          <FiEdit2 size={14} />
        </button>
        <button type="button" title="Excluir" onClick={() => onDelete(category)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100">
          <FiTrash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-orange-50 text-[#f97316]">
        <Icon size={36} />
      </div>
      <h3 className="mt-5 text-xl font-black text-[#111827]">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#6b7280]">{description}</p>}
      {action && (
        <button type="button" onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]">
          <FiPlus size={16} /> {action.label}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MenuManagementPage() {
  const { storeId: authStoreId, storeIds, userData, user, loading: authLoading } = useAuth()

  // ── Data state ──
  const [store,       setStore]       = useState(null)
  const [storeId,     setStoreId]     = useState(null)
  const [categories,  setCategories]  = useState([])
  const [products,    setProducts]    = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [storeError,  setStoreError]  = useState(null) // 'no-store' | 'not-found'

  // ── UI state ──
  const [activeTab,       setActiveTab]       = useState('products')
  const [search,          setSearch]          = useState('')
  const [filterCategoryId,setFilterCategoryId]= useState('all')
  const [filterStatus,    setFilterStatus]    = useState('all')

  // ── Drawer state ──
  const [productDrawerOpen,  setProductDrawerOpen]  = useState(false)
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [editingProduct,     setEditingProduct]     = useState(null)
  const [editingCategory,    setEditingCategory]    = useState(null)

  // ── Toast ──
  const [toast, setToast] = useState(null)
  const showToast = useCallback((t) => setToast(t), [])

  // ── 1. Resolve storeId ──
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

  // ── 2. Fetch store document ──
  useEffect(() => {
    if (!storeId) return
    getDoc(doc(db, 'stores', storeId))
      .then((snap) => {
        if (!snap.exists()) { setStoreError('not-found'); return }
        setStore({ id: snap.id, ...snap.data() })
      })
      .catch(() => setStoreError('not-found'))
      .finally(() => setPageLoading(false))
  }, [storeId])

  // ── 3. onSnapshot: categories ──
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'categories'), where('storeId', '==', storeId))
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, (err) => console.error('[MenuManagementPage] categories listener:', err))
    return () => unsub()
  }, [storeId])

  // ── 4. onSnapshot: products ──
  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'products'), where('storeId', '==', storeId))
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, (err) => console.error('[MenuManagementPage] products listener:', err))
    return () => unsub()
  }, [storeId])

  // ── Computed ──
  const sortedCategories = useMemo(() =>
    categories
      .filter((c) => !c.isDeleted)
      .sort((a, b) =>
        (Number(a?.order ?? 9999) - Number(b?.order ?? 9999)) ||
        (a.name || '').localeCompare(b.name || '')
      ),
    [categories]
  )

  const activeProducts = useMemo(() => products.filter((p) => !p.isDeleted), [products])

  const stats = useMemo(() => ({
    total:       activeProducts.length,
    active:      activeProducts.filter((p) => p.isActive !== false && p.isAvailable !== false && p.isVisible !== false).length,
    unavailable: activeProducts.filter((p) => p.isAvailable === false).length,
    featured:    activeProducts.filter((p) => p.isFeatured).length,
    noImage:     activeProducts.filter((p) => !p.imageUrl).length,
    categories:  sortedCategories.length,
  }), [activeProducts, sortedCategories])

  const filteredProducts = useMemo(() => {
    return activeProducts
      .filter((p) => filterCategoryId === 'all' || p.categoryId === filterCategoryId)
      .filter((p) => {
        switch (filterStatus) {
          case 'active':      return p.isActive !== false && p.isAvailable !== false && p.isVisible !== false
          case 'unavailable': return p.isAvailable === false
          case 'hidden':      return p.isVisible === false
          case 'featured':    return p.isFeatured === true
          case 'promo':       return p.isPromotion === true
          case 'no-image':    return !p.imageUrl
          default:            return true
        }
      })
      .filter((p) =>
        !search.trim() ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        (Number(a?.order ?? 9999) - Number(b?.order ?? 9999)) ||
        (a.name || '').localeCompare(b.name || '')
      )
  }, [activeProducts, filterCategoryId, filterStatus, search])

  const productCountByCategory = useMemo(() => {
    const counts = {}
    activeProducts.forEach((p) => {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1
    })
    return counts
  }, [activeProducts])

  // ── Handlers ──
  const openProductDrawer  = useCallback((product = null) => { setEditingProduct(product);  setProductDrawerOpen(true)  }, [])
  const closeProductDrawer = useCallback(() => { setProductDrawerOpen(false);  setEditingProduct(null)  }, [])
  const openCategoryDrawer = useCallback((cat = null)     => { setEditingCategory(cat);     setCategoryDrawerOpen(true) }, [])
  const closeCategoryDrawer= useCallback(() => { setCategoryDrawerOpen(false); setEditingCategory(null) }, [])

  const handleToggleProductField = useCallback(async (productId, field, currentValue) => {
    try {
      await updateDoc(doc(db, 'products', productId), { [field]: !currentValue, updatedAt: serverTimestamp() })
    } catch { showToast({ type: 'error', message: 'Erro ao atualizar produto.' }) }
  }, [showToast])

  const handleDuplicateProduct = useCallback(async (product) => {
    if (!storeId || !store) return
    try {
      const scope = buildStoreScopedPayload(store)
      
      if (import.meta.env.DEV) {
        console.log('[MenuManagementPage] Duplicando produto scope:', scope)
      }

      const { id: _id, createdAt: _ca, ...rest } = product
      await addDoc(collection(db, 'products'), cleanObject({
        ...rest,
        ...scope,
        name:      `${product.name} (cópia)`,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }))
      showToast({ type: 'success', message: 'Produto duplicado!' })
    } catch { showToast({ type: 'error', message: 'Erro ao duplicar produto.' }) }
  }, [storeId, store, showToast])

  const handleDeleteProduct = useCallback(async (productId) => {
    if (!window.confirm('Excluir este produto? Ele ficará oculto mas pode ser recuperado pelo suporte.')) return
    try {
      await updateDoc(doc(db, 'products', productId), { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      showToast({ type: 'success', message: 'Produto excluído.' })
    } catch { showToast({ type: 'error', message: 'Erro ao excluir produto.' }) }
  }, [showToast])

  const handleDeleteCategory = useCallback(async (category) => {
    if (productCountByCategory[category.id] > 0) {
      showToast({ type: 'error', message: 'Mova os produtos desta categoria antes de excluí-la.' })
      return
    }
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return
    try {
      await updateDoc(doc(db, 'categories', category.id), { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      showToast({ type: 'success', message: 'Categoria excluída.' })
    } catch { showToast({ type: 'error', message: 'Erro ao excluir categoria.' }) }
  }, [productCountByCategory, showToast])

  const handleToggleCategoryActive = useCallback(async (catId, currentValue) => {
    try {
      await updateDoc(doc(db, 'categories', catId), { isActive: !currentValue, updatedAt: serverTimestamp() })
    } catch { showToast({ type: 'error', message: 'Erro ao atualizar categoria.' }) }
  }, [showToast])

  const handleMoveCategoryOrder = useCallback(async (category, direction) => {
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
    } catch { showToast({ type: 'error', message: 'Erro ao reordenar categoria.' }) }
  }, [sortedCategories, showToast])

  // ── Error / loading states ──
  if (pageLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonProductRow key={i} />)}
        </div>
      </div>
    )
  }

  if (storeError === 'no-store') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-orange-50 text-[#f97316]">
          <FiBox size={36} />
        </div>
        <h2 className="mt-5 text-2xl font-black text-[#111827]">Sua loja ainda não foi ativada</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6b7280]">
          Complete o processo de configuração inicial para começar a gerenciar seu cardápio.
        </p>
        <Link to="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]">
          Configurar minha loja
        </Link>
      </div>
    )
  }

  if (storeError === 'not-found') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-red-50 text-red-500">
          <FiAlertTriangle size={36} />
        </div>
        <h2 className="mt-5 text-2xl font-black text-[#111827]">Loja não encontrada</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6b7280]">
          Não foi possível carregar os dados da sua loja. Entre em contato com o suporte.
        </p>
      </div>
    )
  }

  const storeSlugForUrl = getStorePublicSlug(store)

  // ── Main render ──
  return (
    <>
      <DashboardPageHeader
        title="Cardápio"
        description={store?.name || 'Gerencie produtos, categorias e adicionais.'}
        icon={FiGrid}
        badge={
          store
            ? {
                label: store.isOpen ? 'Loja aberta' : 'Loja fechada',
                color: store.isOpen ? 'green' : 'red',
                dot: true,
                pulse: store.isOpen,
              }
            : undefined
        }
        actions={
          <>
            {storeSlugForUrl && (
              <a
                href={`/${storeSlugForUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#6b7280] transition hover:border-orange-200 hover:text-[#f97316]"
              >
                <FiExternalLink size={13} /> Ver loja
              </a>
            )}
            <button
              type="button"
              onClick={() => openCategoryDrawer()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316] transition hover:bg-orange-100"
            >
              <FiPlus size={13} /> Categoria
            </button>
            <button
              type="button"
              onClick={() => openProductDrawer()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
            >
              <FiPlus size={15} /> Novo produto
            </button>
          </>
        }
      />

      <div className="min-h-screen space-y-6 p-4 md:p-8">

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={FiPackage} label="Total"        value={stats.total}       color="orange" onClick={() => { setActiveTab('products'); setFilterStatus('all') }}        active={activeTab === 'products' && filterStatus === 'all'} />
          <StatCard icon={FiCheck}   label="Ativos"       value={stats.active}      color="green"  onClick={() => { setActiveTab('products'); setFilterStatus('active') }}     active={activeTab === 'products' && filterStatus === 'active'} />
          <StatCard icon={FiX}       label="Indisponíveis"value={stats.unavailable} color="red"    onClick={() => { setActiveTab('products'); setFilterStatus('unavailable') }}active={activeTab === 'products' && filterStatus === 'unavailable'} />
          <StatCard icon={FiList}    label="Categorias"   value={stats.categories}  color="blue"   onClick={() => setActiveTab('categories')}                                  active={activeTab === 'categories'} />
          <StatCard icon={FiStar}    label="Destaques"    value={stats.featured}    color="yellow" onClick={() => { setActiveTab('products'); setFilterStatus('featured') }}   active={activeTab === 'products' && filterStatus === 'featured'} />
          <StatCard icon={FiImage}   label="Sem imagem"   value={stats.noImage}     color="gray"   onClick={() => { setActiveTab('products'); setFilterStatus('no-image') }}   active={activeTab === 'products' && filterStatus === 'no-image'} />
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2">
          {[
            { id: 'products',   label: `Produtos (${stats.total})`,       icon: FiBox },
            { id: 'categories', label: `Categorias (${stats.categories})`, icon: FiList },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-[#f97316] text-white shadow-md shadow-orange-200'
                  : 'bg-white text-[#6b7280] border border-gray-200 hover:border-orange-200 hover:text-[#f97316]'
              }`}>
              <tab.icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'products' ? 'Produtos' : 'Categorias'}</span>
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Search */}
              <div className="relative flex-1">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou descrição..."
                  className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                    <FiX size={15} />
                  </button>
                )}
              </div>

              {/* Category filter */}
              <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}
                className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] sm:w-48">
                <option value="all">Todas as categorias</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Status filter */}
              <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_FILTERS.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFilterStatus(f.id)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                      filterStatus === f.id ? 'bg-[#f97316] text-white' : 'bg-white border border-gray-200 text-[#6b7280] hover:border-orange-200'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results info */}
            {(search || filterStatus !== 'all' || filterCategoryId !== 'all') && (
              <p className="text-xs font-bold text-[#9ca3af]">
                {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
              </p>
            )}

            {/* Product list */}
            {filteredProducts.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    categories={sortedCategories}
                    onEdit={openProductDrawer}
                    onDuplicate={handleDuplicateProduct}
                    onDelete={handleDeleteProduct}
                    onToggle={handleToggleProductField}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <EmptyState
                icon={FiBox}
                title={search || filterStatus !== 'all' || filterCategoryId !== 'all'
                  ? 'Nenhum produto encontrado'
                  : 'Adicione seu primeiro produto'}
                description={search || filterStatus !== 'all' || filterCategoryId !== 'all'
                  ? 'Tente ajustar os filtros ou a busca.'
                  : 'Crie produtos para que apareçam no seu cardápio digital.'}
                action={!search && filterStatus === 'all' && filterCategoryId === 'all'
                  ? { label: 'Criar primeiro produto', onClick: () => openProductDrawer() }
                  : undefined}
              />
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#9ca3af]">
                {sortedCategories.length} categoria{sortedCategories.length !== 1 ? 's' : ''} · use ↑↓ para reordenar
              </p>
              <button type="button" onClick={() => openCategoryDrawer()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]">
                <FiPlus size={15} /> Nova categoria
              </button>
            </div>

            {sortedCategories.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {sortedCategories.map((cat, idx) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    index={idx}
                    total={sortedCategories.length}
                    productCount={productCountByCategory[cat.id] || 0}
                    onEdit={openCategoryDrawer}
                    onDelete={handleDeleteCategory}
                    onToggleActive={handleToggleCategoryActive}
                    onMoveUp={() => handleMoveCategoryOrder(cat, 'up')}
                    onMoveDown={() => handleMoveCategoryOrder(cat, 'down')}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <EmptyState
                icon={FiList}
                title="Crie sua primeira categoria"
                description="Organize os produtos em categorias como Hambúrgueres, Bebidas, Sobremesas..."
                action={{ label: 'Criar categoria', onClick: () => openCategoryDrawer() }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── DRAWERS ── */}
      <ProductDrawer
        open={productDrawerOpen}
        onClose={closeProductDrawer}
        editingProduct={editingProduct}
        categories={sortedCategories}
        store={store}
        storeId={storeId}
        onToast={showToast}
      />

      <CategoryDrawer
        open={categoryDrawerOpen}
        onClose={closeCategoryDrawer}
        editingCategory={editingCategory}
        storeId={storeId}
        store={store}
        categories={categories}
        onToast={showToast}
      />

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && <Toast key="toast" toast={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  )
}