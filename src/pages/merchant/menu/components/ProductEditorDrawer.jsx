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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-[#f97316] text-xs font-black text-white">{gi + 1}</div>
                <span className="text-sm font-black text-[#111827]">Grupo de opções</span>
              </div>
              <button type="button" onClick={() => rmGroup(gi)}
                className="grid h-7 w-7 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100" aria-label="Remover grupo">
                <FiX size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Nome do grupo *</label>
                <input type="text" value={group.title} onChange={(e) => upGroup(gi, 'title', e.target.value)}
                  placeholder="Ex: Escolha o tamanho" maxLength={80}
                  className="h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" />
              </div>

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
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
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

              {section === 'status' && (
                <div className="space-y-3">
                  {[
                    { key: 'isActive',      label: 'Produto ativo',          desc: 'Produto habilitado no sistema' },
                    { key: 'isAvailable',   label: 'Disponível',             desc: 'Disponível para compra agora (indisponível = aparece no card mas sem CTA)' },
                    { key: 'isVisible',     label: 'Visível no cardápio',    desc: 'Aparece para clientes na loja (oculto = não aparece)' },
                    { key: 'isFeatured',    label: '⭐ Destaque',            desc: 'Aparece na seção de destaques' },
                    { key: 'isPromotion',   label: '🏷️ Promoção',            desc: 'Marcado como item promocional' },
                    { key: 'acceptsCoupons', label: '🎟️ Aceita cupons',       desc: 'Se desligado, este item nunca entra em descontos de cupom.' },
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

  if (typeof window === 'undefined') return null
  return createPortal(drawerContent, document.body)
}
