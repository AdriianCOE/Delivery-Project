// src/pages/merchant/menu/components/ProductEditorDrawer.jsx
// Drawer lateral para criação e edição de produto.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiAlertCircle,
  FiCheck,
  FiImage,
  FiInfo,
  FiLoader,
  FiPlus,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

import { db } from '../../../../services/firebase'
import { uploadImageToCloudinary } from '../../../../services/cloudinary'
import { buildStoreScopedPayload } from '../../../../utils/storeIdentity'
import {
  EMPTY_PRODUCT_FORM,
  createEmptyOption,
  createEmptyOptionGroup,
  normalizeProductOptionGroupsForForm,
  sanitizeOptionGroupsForSave,
  cleanObject,
} from '../utils/menuPayloads'
import { parseCurrency, formatMoney, moneyToInput } from '../utils/menuFormatters'

// ── OptionGroupsEditor ─────────────────────────────────────────────────────────

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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/30 dark:bg-orange-500/5 p-5 shadow-sm transition-all"
          >
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-xs font-black text-white shadow-sm">{gi + 1}</div>
                <span className="text-sm font-black text-[#111827] dark:text-slate-50">Grupo de opções</span>
              </div>
              <button type="button" onClick={() => rmGroup(gi)}
                className="grid h-8 w-8 md:h-8 md:w-8 place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 active:scale-90" aria-label="Remover grupo">
                <FiX size={15} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome do grupo *</label>
                <input type="text" value={group.title} onChange={(e) => upGroup(gi, 'title', e.target.value)}
                  placeholder="Ex: Escolha o tamanho" maxLength={80}
                  className="h-12 md:h-11 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tipo</label>
                  <select value={group.type}
                    onChange={(e) => { upGroup(gi, 'type', e.target.value); if (e.target.value === 'single') upGroup(gi, 'max', '1') }}
                    className="h-12 md:h-11 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm">
                    <option value="single">Escolha única</option>
                    <option value="multiple">Múltipla escolha</option>
                    <option value="quantity">Com quantidade</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Obrigatoriedade</label>
                  <select value={group.required ? 'true' : 'false'}
                    onChange={(e) => upGroup(gi, 'required', e.target.value === 'true')}
                    className="h-12 md:h-11 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm">
                    <option value="true">Obrigatório</option>
                    <option value="false">Opcional</option>
                  </select>
                </div>
              </div>

              {group.type !== 'single' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mínimo</label>
                    <input type="number" min="0" value={group.min} onChange={(e) => upGroup(gi, 'min', e.target.value)}
                      className="h-12 md:h-11 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Máximo</label>
                    <input type="number" min="1" value={group.max} onChange={(e) => upGroup(gi, 'max', e.target.value)}
                      className="h-12 md:h-11 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Opções ({group.options.length})</p>
                <div className="space-y-2">
                  {group.options.map((opt, oi) => (
                    <div key={opt.id} className="flex gap-2 group/opt">
                      <input type="text" value={opt.name} onChange={(e) => upOption(gi, oi, 'name', e.target.value)}
                        placeholder={`Opção ${oi + 1}`}
                        className="h-12 md:h-11 min-w-0 flex-1 rounded-xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] shadow-sm" />
                      <input type="text" inputMode="decimal" value={opt.price} onChange={(e) => upOption(gi, oi, 'price', e.target.value)}
                        placeholder="R$ 0,00"
                        className="h-12 md:h-11 w-24 shrink-0 rounded-xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] shadow-sm" />
                      <button type="button" onClick={() => rmOption(gi, oi)} disabled={group.options.length <= 1}
                        className="grid h-12 md:h-11 w-12 md:w-11 shrink-0 place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-400 transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-30 active:scale-90 opacity-80 group-hover/opt:opacity-100" aria-label="Remover opção">
                        <FiX size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addOption(gi)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 py-3 text-sm font-black text-[#f97316] transition-all duration-200 hover:bg-orange-100 dark:hover:bg-orange-500/10 hover:border-orange-300 active:scale-[0.98]">
                  <FiPlus size={14} /> Adicionar opção
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button type="button" onClick={addGroup}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-300 dark:border-orange-500/40 bg-orange-50/50 dark:bg-orange-500/5 py-4 text-sm font-black text-[#f97316] transition-all duration-200 hover:bg-orange-100 dark:hover:bg-orange-500/10 hover:border-orange-400 active:scale-[0.98]">
        <FiPlus size={16} /> Novo grupo de opções
      </button>
    </div>
  )
}

// ── Section tabs config ────────────────────────────────────────────────────────

const DRAWER_SECTIONS = [
  { id: 'basic',   label: 'Informações' },
  { id: 'price',   label: 'Preços' },
  { id: 'image',   label: 'Imagem' },
  { id: 'status',  label: 'Status' },
  { id: 'options', label: 'Opções' },
]

// ── ProductEditorDrawer ────────────────────────────────────────────────────────

/**
 * @param {{
 *   open: boolean,
 *   onClose: fn,
 *   editingProduct: object|null,
 *   categories: object[],
 *   store: object,
 *   storeId: string,
 *   onToast: fn,
 * }} props
 */
export default function ProductEditorDrawer({ open, onClose, editingProduct, categories, store, storeId, onToast }) {
  const [form, setForm]                 = useState(EMPTY_PRODUCT_FORM)
  const [imageFile, setImageFile]       = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [section, setSection]           = useState('basic')
  const imgRef = useRef(null)

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
        acceptsCoupons:  editingProduct.acceptsCoupons !== undefined
          ? Boolean(editingProduct.acceptsCoupons)
          : (editingProduct.acceptsCoupon !== undefined
              ? Boolean(editingProduct.acceptsCoupon)
              : (editingProduct.couponEligible !== undefined
                  ? Boolean(editingProduct.couponEligible)
                  : true)),
        order:           editingProduct.order || 0,
        optionGroups:    normalizeProductOptionGroupsForForm(editingProduct),
        extras:          editingProduct.extras || [],
      })
    } else {
      setForm({ ...EMPTY_PRODUCT_FORM, optionGroups: [], extras: [] })
    }
  }, [open, editingProduct])

  useEffect(() => {
    return () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [open])

  const setField = useCallback((field, value) => setForm((p) => ({ ...p, [field]: value })), [])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { onToast({ type: 'error', message: 'Selecione uma imagem válida.' }); return }
    if (file.size > 5 * 1024 * 1024)    { onToast({ type: 'error', message: 'Imagem muito grande. Máximo 5MB.' }); return }
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
    if (priceValue < 0) { onToast({ type: 'error', message: 'Preço inválido.' }); return }

    setSaving(true)
    try {
      let finalImageUrl      = form.imageUrl
      let finalImagePublicId = form.imagePublicId

      if (imageFile) {
        setImageUploading(true)
        const res = await uploadImageToCloudinary(imageFile, 'PratoBy/produtos')
        finalImageUrl      = res.secure_url || res.url || ''
        finalImagePublicId = res.public_id || ''
        setImageUploading(false)
      }

      const oldPriceValue = form.oldPrice ? parseCurrency(form.oldPrice) : null
      const scope = buildStoreScopedPayload(store)
      const catName = categories.find((c) => c.id === form.categoryId)?.name || ''

      if (import.meta.env.DEV) console.log('[ProductEditorDrawer] Salvando produto scope:', scope)

      const data = cleanObject({
        ...scope,
        name:           form.name.trim().slice(0, 120),
        description:    form.description.trim().slice(0, 500),
        categoryId:     form.categoryId || '',
        categoryName:   catName,
        price:          priceValue,
        priceCents:     Math.round(priceValue * 100),
        oldPrice:       oldPriceValue,
        oldPriceCents:  oldPriceValue != null ? Math.round(oldPriceValue * 100) : null,
        imageUrl:       finalImageUrl,
        imagePublicId:  finalImagePublicId,
        isActive:       Boolean(form.isActive),
        isAvailable:    Boolean(form.isAvailable),
        isVisible:      Boolean(form.isVisible),
        isFeatured:     Boolean(form.isFeatured),
        isPromotion:    Boolean(form.isPromotion),
        acceptsCoupons: Boolean(form.acceptsCoupons),
        order:          Number(form.order) || 0,
        position:       Number(form.order) || 0,
        preparationTime: form.preparationTime?.trim() || '',
        optionGroups:   sanitizeOptionGroupsForSave(form.optionGroups),
        extras:         Array.isArray(form.extras) ? form.extras : [],
        isDeleted:      false,
        updatedAt:      serverTimestamp(),
      })

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
      console.error('[ProductEditorDrawer] handleSave:', err)
      onToast({ type: 'error', message: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setSaving(false)
      setImageUploading(false)
    }
  }

  const visibleImage = imagePreview || form.imageUrl

  const drawerContent = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/70 backdrop-blur-md transition-all duration-300"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-white dark:bg-slate-900 shadow-2xl md:w-[640px] lg:w-[720px] ring-1 ring-black/5 dark:ring-white/10"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-slate-800 px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:pt-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-10 sticky top-0">
              <div>
                <h2 className="text-xl font-black text-[#111827] dark:text-slate-50 tracking-tight">
                  {editingProduct ? 'Editar produto' : 'Novo produto'}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {editingProduct ? editingProduct.name : 'Preencha as informações abaixo'}
                </p>
              </div>
              <button type="button" onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-full bg-gray-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all duration-200 hover:bg-gray-200 dark:hover:bg-slate-700 hover:rotate-90 active:scale-90" aria-label="Fechar">
                <FiX size={18} />
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-100 dark:border-slate-800 px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DRAWER_SECTIONS.map((sec) => (
                <button key={sec.id} type="button" onClick={() => setSection(sec.id)}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 active:scale-95 ${
                    section === sec.id ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-md shadow-orange-500/20' : 'bg-gray-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}>
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8 [scrollbar-width:thin]">
              {section === 'basic' && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome *</label>
                    <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                      placeholder="Ex: X-Burguer Artesanal" maxLength={120}
                      className="h-14 md:h-12 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descrição</label>
                    <textarea value={form.description} onChange={(e) => setField('description', e.target.value)}
                      placeholder="Ingredientes, diferenciais, tamanho..." maxLength={500} rows={4}
                      className="w-full resize-none rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 md:py-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm leading-relaxed" />
                    <p className="mt-1.5 text-right text-[11px] font-bold text-slate-400">{form.description.length}/500</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoria</label>
                    <select value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}
                      className="h-14 md:h-12 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm">
                      <option value="">Sem categoria</option>
                      {categories.filter((c) => !c.isDeleted).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tempo de preparo</label>
                      <input type="text" value={form.preparationTime} onChange={(e) => setField('preparationTime', e.target.value)}
                        placeholder="Ex: 20-30 min"
                        className="h-14 md:h-12 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-400 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ordem de exibição</label>
                      <input type="number" min="0" value={form.order} onChange={(e) => setField('order', Number(e.target.value))}
                        className="h-14 md:h-12 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                    </div>
                  </div>
                </div>
              )}

              {section === 'price' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-4 rounded-2xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5 p-5">
                    <div className="mt-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 p-1.5 text-[#f97316]">
                      <FiInfo size={16} />
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                      Os valores são salvos em centavos no banco de dados (ex: <span className="font-bold">2990 = R$&nbsp;29,90</span>). Utilize a vírgula para as casas decimais.
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço Principal *</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">R$</span>
                      <input type="text" inputMode="decimal" value={form.price} onChange={(e) => setField('price', e.target.value)}
                        placeholder="0,00"
                        className="h-16 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-4 text-2xl font-black text-[#111827] dark:text-slate-50 placeholder-slate-300 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                    </div>
                    {form.price && (
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        Convertido: {formatMoney(parseCurrency(form.price))} <span className="mx-1 text-slate-300">•</span> {Math.round(parseCurrency(form.price) * 100)} centavos
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço "De" / Riscado (opcional)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">R$</span>
                      <input type="text" inputMode="decimal" value={form.oldPrice} onChange={(e) => setField('oldPrice', e.target.value)}
                        placeholder="0,00"
                        className="h-14 md:h-12 w-full rounded-2xl border border-orange-100 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-4 text-base md:text-sm font-bold text-[#111827] dark:text-slate-50 placeholder-slate-300 outline-none transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 shadow-sm" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">Este valor aparecerá riscado na loja para indicar promoção.</p>
                  </div>
                </div>
              )}

              {section === 'image' && (
                <div className="space-y-6">
                  {visibleImage ? (
                    <div className="relative group overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                      <img src={visibleImage} alt="Preview" className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
                      <button type="button" onClick={handleRemoveImage}
                        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-red-500/90 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-red-600 hover:scale-110 active:scale-95" aria-label="Remover imagem">
                        <FiTrash2 size={16} />
                      </button>
                      {imagePreview && (
                        <div className="absolute bottom-4 left-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-xs font-black text-white shadow-lg">
                          Nova imagem pendente
                        </div>
                      )}
                    </div>
                  ) : (
                    <button type="button" onClick={() => imgRef.current?.click()}
                      className="group flex h-60 w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-orange-200 dark:border-slate-700 bg-orange-50/30 dark:bg-slate-800/50 transition-all duration-200 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-slate-800 dark:hover:border-slate-600">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white dark:bg-slate-800 text-[#f97316] shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
                        <FiImage size={28} />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-black text-[#111827] dark:text-slate-50">Clique para selecionar</p>
                        <p className="mt-1.5 text-xs font-bold text-slate-400">PNG, JPG, WEBP (máx. 5 MB)</p>
                      </div>
                    </button>
                  )}
                  <input ref={imgRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <button type="button" onClick={() => imgRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-[#f97316] dark:hover:text-[#f97316] hover:border-orange-200 dark:hover:border-slate-600 active:scale-[0.98] shadow-sm">
                    <FiImage size={16} />
                    {visibleImage ? 'Trocar imagem' : 'Selecionar imagem'}
                  </button>
                </div>
              )}

              {section === 'status' && (
                <div className="space-y-4">
                  {[
                    { key: 'isActive',      label: 'Produto ativo',          desc: 'Produto habilitado no sistema' },
                    { key: 'isAvailable',   label: 'Disponível',             desc: 'Disponível para compra agora (indisponível = aparece no card mas sem botão de comprar)' },
                    { key: 'isVisible',     label: 'Visível no cardápio',    desc: 'Aparece para clientes na loja (oculto = não aparece de forma alguma)' },
                    { key: 'isFeatured',    label: '⭐ Destaque',            desc: 'Aparece na seção de destaques' },
                    { key: 'isPromotion',   label: '🏷️ Promoção',            desc: 'Marcado como item promocional' },
                    { key: 'acceptsCoupons', label: '🎟️ Aceita cupons',       desc: 'Se desligado, este item nunca entra em descontos de cupom.' },
                  ].map(({ key, label, desc }) => (
                    <label key={key}
                      className="group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 p-5 transition-all duration-200 hover:border-orange-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md">
                      <div>
                        <p className="text-base font-black text-[#111827] dark:text-slate-50 transition-colors group-hover:text-[#f97316]">{label}</p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                      </div>
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={Boolean(form[key])}
                          onChange={(e) => setField(key, e.target.checked)} className="sr-only" />
                        <div className={`h-7 w-12 rounded-full transition-colors duration-300 ${form[key] ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-600 shadow-inner'}`}>
                          <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {section === 'options' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-4 rounded-2xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5 p-5">
                    <div className="mt-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 p-1.5 text-[#f97316]">
                      <FiInfo size={16} />
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
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
            <div className="flex shrink-0 gap-3 border-t border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 md:pb-5 backdrop-blur-xl z-10 sticky bottom-0">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3.5 text-sm md:text-base font-bold text-slate-600 dark:text-slate-300 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving || imageUploading || !form.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] py-3.5 text-sm md:text-base font-black text-white shadow-lg shadow-orange-500/20 transition-all duration-200 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none">
                {saving || imageUploading ? (
                  <><FiLoader className="animate-spin" size={16} />{imageUploading ? 'Enviando...' : 'Salvando...'}</>
                ) : (
                  <><FiCheck size={16} />{editingProduct ? 'Salvar alterações' : 'Criar produto'}</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  if (typeof window === 'undefined') return null
  return createPortal(drawerContent, document.body)
}
