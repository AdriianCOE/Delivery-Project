// src/pages/merchant/menu/components/ProductEditorDrawer.jsx
// Drawer lateral para criação e edição de produto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiImage,
  FiInfo,
  FiLayers,
  FiLoader,
  FiPackage,
  FiPercent,
  FiPlus,
  FiStar,
  FiTag,
  FiTrash2,
  FiTruck,
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
  normalizeProductSchedulingForForm,
  sanitizeOptionGroupsForSave,
  sanitizeProductSchedulingForSave,
  cleanObject,
} from '../utils/menuPayloads'
import { parseCurrency, formatMoney, moneyToInput } from '../utils/menuFormatters'

const ui = {
  drawer:
    'fixed top-0 bottom-0 right-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[#FFFBF7] text-slate-950 shadow-2xl ring-1 ring-black/5 dark:bg-[#0F1115] dark:text-slate-50 dark:ring-white/10 md:w-[660px] lg:w-[760px]',
  header:
    'sticky top-0 z-10 shrink-0 border-b border-orange-100/80 bg-[#FFFBF7]/90 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0F1115]/90 md:px-7 md:pt-6',
  footer:
    'sticky bottom-0 z-10 shrink-0 border-t border-orange-100/80 bg-[#FFFBF7]/90 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0F1115]/90 md:px-7 md:pb-5',
  body:
    'min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#FFFBF7] via-white to-[#FFF7ED] p-5 [scrollbar-width:thin] dark:from-[#0F1115] dark:via-[#11141B] dark:to-[#0F1115] md:p-7',
  panel:
    'rounded-[1.7rem] border border-orange-100/80 bg-white/90 p-5 shadow-sm shadow-orange-950/5 ring-1 ring-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#151922]/90 dark:shadow-black/25 dark:ring-white/5 md:p-6',
  panelSoft:
    'rounded-2xl border border-orange-100/70 bg-orange-50/50 p-4 dark:border-white/10 dark:bg-white/[0.035]',
  input:
    'h-14 w-full rounded-2xl border border-orange-100/90 bg-white px-4 text-base font-bold text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-orange-200 hover:bg-white focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-50 dark:placeholder:text-slate-500 dark:hover:border-orange-500/40 dark:hover:bg-[#202637] dark:focus:border-[#f97316] dark:focus:ring-orange-500/20 md:h-12 md:text-sm',
  textarea:
    'w-full resize-none rounded-2xl border border-orange-100/90 bg-white px-4 py-3 text-base font-bold leading-relaxed text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-orange-200 hover:bg-white focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-50 dark:placeholder:text-slate-500 dark:hover:border-orange-500/40 dark:hover:bg-[#202637] dark:focus:border-[#f97316] dark:focus:ring-orange-500/20 md:py-4 md:text-sm',
  label:
    'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400',
  hint: 'mt-2 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400',
  muted: 'text-slate-500 dark:text-slate-400',
  secondaryButton:
    'rounded-2xl border border-orange-100 bg-white px-4 py-3.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-200 dark:hover:border-orange-500/30 dark:hover:bg-[#202637]',
  primaryButton:
    'rounded-2xl bg-gradient-to-r from-[#f97316] via-[#fb6a14] to-[#ea580c] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-orange-500/40 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0',
}

const statusItems = [
  {
    key: 'isActive',
    icon: FiPackage,
    label: 'Produto ativo',
    desc: 'Produto habilitado no sistema e pronto para operar no painel.',
  },
  {
    key: 'isAvailable',
    icon: FiClock,
    label: 'Disponível agora',
    desc: 'Quando desligado, aparece no cardápio sem botão de comprar.',
  },
  {
    key: 'isVisible',
    icon: FiEye,
    label: 'Visível no cardápio',
    desc: 'Quando desligado, fica oculto para os clientes da loja pública.',
  },
  {
    key: 'isFeatured',
    icon: FiStar,
    label: 'Destaque',
    desc: 'Aparece com mais força nas áreas de destaque da loja.',
  },
  {
    key: 'isPromotion',
    icon: FiTag,
    label: 'Promoção',
    desc: 'Marca o item como promocional para reforçar a oferta.',
  },
  {
    key: 'acceptsCoupons',
    icon: FiPercent,
    label: 'Aceita cupons',
    desc: 'Se desligado, este item não entra em descontos de cupom.',
  },
]

// ── UI helpers ────────────────────────────────────────────────────────────────

function splitSchedulingMinutes(minutes) {
  if (minutes === null || minutes === undefined || minutes === '') {
    return { value: '', unit: 'hours' }
  }

  const value = Number(minutes)
  if (Number.isFinite(value) && value > 0 && value % 1440 === 0) {
    return { value: String(value / 1440), unit: 'days' }
  }
  if (Number.isFinite(value) && value > 0 && value % 60 === 0) {
    return { value: String(value / 60), unit: 'hours' }
  }
  return { value: String(Number.isFinite(value) ? value : ''), unit: 'minutes' }
}

function schedulingInputToMinutes(value, unit) {
  if (value === '') return null
  const amount = Math.max(0, Number.parseInt(value, 10) || 0)
  if (unit === 'days') return amount * 1440
  if (unit === 'hours') return amount * 60
  return amount
}

function FieldLabel({ children, required }) {
  return (
    <label className={ui.label}>
      {children}{required ? <span className="text-[#f97316]"> *</span> : null}
    </label>
  )
}

function SectionCard({ title, description, icon: Icon, children, aside }) {
  return (
    <section className={ui.panel}>
      {(title || description || Icon || aside) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 text-[#f97316] ring-1 ring-orange-100 dark:from-orange-500/20 dark:to-orange-500/5 dark:ring-orange-500/20">
                <Icon size={18} />
              </div>
            ) : null}
            <div className="min-w-0">
              {title ? <h3 className="text-sm font-black text-slate-950 dark:text-slate-50 md:text-base">{title}</h3> : null}
              {description ? <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
            </div>
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

function InfoCallout({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white p-4 text-sm font-semibold leading-relaxed text-slate-600 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-white/[0.03] dark:text-slate-300">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-100 text-[#f97316] dark:bg-orange-500/20">
        <FiInfo size={15} />
      </div>
      <p>{children}</p>
    </div>
  )
}

function Counter({ value, max }) {
  return <p className="mt-1.5 text-right text-[11px] font-black text-slate-400 dark:text-slate-500">{value}/{max}</p>
}

function ToggleSwitch({ checked }) {
  return (
    <div className={`relative h-7 w-12 rounded-full transition-all duration-300 ${checked ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-950/20' : 'bg-slate-200 shadow-inner dark:bg-white/20'}`}>
      <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
  )
}

function StatusToggleCard({ item, checked, onChange }) {
  const Icon = item.icon

  return (
    <label
      className={`group flex cursor-pointer items-center justify-between gap-4 rounded-3xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
        checked
          ? 'border-orange-200 bg-orange-50/80 shadow-orange-950/5 dark:border-orange-500/30 dark:bg-orange-500/10'
          : 'border-orange-100/70 bg-white/90 hover:border-orange-200 hover:bg-white dark:border-white/10 dark:bg-[#151922]/80 dark:hover:border-white/20 dark:hover:bg-[#1A1F2B]'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition-colors ${checked ? 'bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-lg shadow-orange-500/20' : 'bg-slate-100 text-slate-500 group-hover:text-[#f97316] dark:bg-white/10 dark:text-slate-400'}`}>
          <Icon size={17} />
        </div>
        <div>
          <p className="text-sm font-black text-slate-950 transition-colors group-hover:text-[#f97316] dark:text-slate-50 md:text-base">{item.label}</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{item.desc}</p>
        </div>
      </div>
      <div className="relative shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <ToggleSwitch checked={checked} />
      </div>
    </label>
  )
}

function ProductSummary({ form, visibleImage, categoryName, discountPct }) {
  const price = parseCurrency(form.price)
  const hasPrice = Number.isFinite(price) && price > 0

  return (
    <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-orange-100/80 bg-white/80 p-3 shadow-sm shadow-orange-950/5 ring-1 ring-white/70 dark:border-white/10 dark:bg-[#151922]/80 dark:ring-white/5">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 ring-1 ring-orange-100 dark:from-white/10 dark:to-white/5 dark:ring-white/10">
          {visibleImage ? (
            <img src={visibleImage} alt="Preview do produto" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[#f97316]">
              <FiImage size={22} />
            </div>
          )}
          {form.isPromotion ? (
            <span className="absolute bottom-1 right-1 rounded-full bg-[#f97316] px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">OFF</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-slate-950 dark:text-slate-50 md:text-base">{form.name.trim() || 'Produto sem nome'}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${form.isActive && form.isAvailable && form.isVisible ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
              {form.isActive && form.isAvailable && form.isVisible ? 'Publicado' : 'Revisar'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{categoryName || 'Sem categoria'}</span>
            {form.preparationTime ? <><span className="text-slate-300 dark:text-white/20">•</span><span>{form.preparationTime}</span></> : null}
            {typeof discountPct === 'number' ? <><span className="text-slate-300 dark:text-white/20">•</span><span className="text-emerald-600 dark:text-emerald-300">-{discountPct}%</span></> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Preço</p>
          <p className="mt-0.5 text-base font-black text-[#f97316] md:text-lg">{hasPrice ? formatMoney(price) : 'R$ 0,00'}</p>
        </div>
      </div>
    </div>
  )
}

// ── OptionGroupsEditor ───────────────────────────────────────────────────────

function OptionGroupsEditor({ groups, onChange }) {
  const addGroup = () => onChange([...groups, createEmptyOptionGroup()])
  const rmGroup = (gi) => onChange(groups.filter((_, i) => i !== gi))
  const upGroup = (gi, field, val) => onChange(groups.map((g, i) => i === gi ? { ...g, [field]: val } : g))
  const addOption = (gi) => onChange(groups.map((g, i) => i === gi ? { ...g, options: [...g.options, createEmptyOption()] } : g))
  const rmOption = (gi, oi) => onChange(groups.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g))
  const upOption = (gi, oi, field, val) => onChange(groups.map((g, i) => (
    i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, [field]: val } : o) } : g
  )))

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
            className="rounded-[1.6rem] border border-orange-100/80 bg-white/90 p-5 shadow-sm shadow-orange-950/5 ring-1 ring-white/70 transition-all dark:border-white/10 dark:bg-[#151922]/90 dark:ring-white/5"
          >
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-xs font-black text-white shadow-lg shadow-orange-500/20">{gi + 1}</div>
                <div>
                  <span className="block text-sm font-black text-slate-950 dark:text-slate-50">Grupo de opções</span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Configure escolhas, adicionais e limites</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => rmGroup(gi)}
                className="grid h-9 w-9 place-items-center rounded-2xl bg-red-50 text-red-500 transition-all duration-200 hover:bg-red-100 hover:text-red-600 active:scale-90 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                aria-label="Remover grupo"
              >
                <FiX size={15} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <FieldLabel required>Nome do grupo</FieldLabel>
                <input
                  type="text"
                  value={group.title}
                  onChange={(e) => upGroup(gi, 'title', e.target.value)}
                  placeholder="Ex: Escolha o tamanho"
                  maxLength={80}
                  className={ui.input}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <select
                    value={group.type}
                    onChange={(e) => {
                      upGroup(gi, 'type', e.target.value)
                      if (e.target.value === 'single') upGroup(gi, 'max', '1')
                    }}
                    className={ui.input}
                  >
                    <option value="single">Escolha única</option>
                    <option value="multiple">Múltipla escolha</option>
                    <option value="quantity">Com quantidade</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Obrigatoriedade</FieldLabel>
                  <select
                    value={group.required ? 'true' : 'false'}
                    onChange={(e) => upGroup(gi, 'required', e.target.value === 'true')}
                    className={ui.input}
                  >
                    <option value="true">Obrigatório</option>
                    <option value="false">Opcional</option>
                  </select>
                </div>
              </div>

              {group.type !== 'single' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Mínimo</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      value={group.min}
                      onChange={(e) => upGroup(gi, 'min', e.target.value)}
                      className={ui.input}
                    />
                  </div>
                  <div>
                    <FieldLabel>Máximo</FieldLabel>
                    <input
                      type="number"
                      min="1"
                      value={group.max}
                      onChange={(e) => upGroup(gi, 'max', e.target.value)}
                      className={ui.input}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Opções ({group.options.length})</p>
                <div className="space-y-2.5">
                  {group.options.map((opt, oi) => (
                    <div key={opt.id} className="group/opt flex gap-2">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => upOption(gi, oi, 'name', e.target.value)}
                        placeholder={`Opção ${oi + 1}`}
                        className="h-12 min-w-0 flex-1 rounded-2xl border border-orange-100/80 bg-white px-3 text-base font-bold text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-orange-200 focus:border-[#f97316] dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-50 dark:placeholder:text-slate-500 dark:hover:border-orange-500/40 md:h-11 md:text-sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={opt.price}
                        onChange={(e) => upOption(gi, oi, 'price', e.target.value)}
                        placeholder="R$ 0,00"
                        className="h-12 w-28 shrink-0 rounded-2xl border border-orange-100/80 bg-white px-3 text-base font-bold text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-orange-200 focus:border-[#f97316] dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-50 dark:placeholder:text-slate-500 dark:hover:border-orange-500/40 md:h-11 md:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => rmOption(gi, oi)}
                        disabled={group.options.length <= 1}
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-400 opacity-80 transition-all duration-200 hover:bg-red-100 active:scale-90 disabled:opacity-30 group-hover/opt:opacity-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 md:h-11 md:w-11"
                        aria-label="Remover opção"
                      >
                        <FiX size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addOption(gi)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 py-3 text-sm font-black text-[#f97316] transition-all duration-200 hover:border-orange-300 hover:bg-orange-100 active:scale-[0.98] dark:border-orange-500/30 dark:bg-orange-500/10 dark:hover:bg-orange-500/20"
                >
                  <FiPlus size={14} /> Adicionar opção
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={addGroup}
        className="flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-orange-300 bg-orange-50/80 py-4 text-sm font-black text-[#f97316] transition-all duration-200 hover:border-orange-400 hover:bg-orange-100 active:scale-[0.98] dark:border-orange-500/40 dark:bg-orange-500/10 dark:hover:bg-orange-500/20"
      >
        <FiPlus size={16} /> Novo grupo de opções
      </button>
    </div>
  )
}

// ── Section tabs config ──────────────────────────────────────────────────────

const DRAWER_SECTIONS = [
  { id: 'basic', label: 'Informações', icon: FiInfo },
  { id: 'price', label: 'Preços', icon: FiDollarSign },
  { id: 'image', label: 'Imagem', icon: FiImage },
  { id: 'status', label: 'Status', icon: FiPackage },
  { id: 'options', label: 'Opções', icon: FiLayers },
  { id: 'scheduling', label: 'Encomenda', icon: FiCalendar },
]

// ── ProductEditorDrawer ──────────────────────────────────────────────────────

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
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState('basic')
  const imgRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setSection('basic')
    setImageFile(null)
    setImagePreview('')
    if (editingProduct) {
      setForm({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: moneyToInput(editingProduct.price, editingProduct.priceCents),
        oldPrice: editingProduct.oldPrice != null ? moneyToInput(editingProduct.oldPrice, editingProduct.oldPriceCents) : '',
        categoryId: editingProduct.categoryId || '',
        imageUrl: editingProduct.imageUrl || '',
        imagePublicId: editingProduct.imagePublicId || '',
        preparationTime: editingProduct.preparationTime || '',
        isActive: editingProduct.isActive !== false,
        isAvailable: editingProduct.isAvailable !== false,
        isVisible: editingProduct.isVisible !== false,
        isFeatured: Boolean(editingProduct.isFeatured),
        isPromotion: Boolean(editingProduct.isPromotion),
        acceptsCoupons: editingProduct.acceptsCoupons !== undefined
          ? Boolean(editingProduct.acceptsCoupons)
          : (editingProduct.acceptsCoupon !== undefined
              ? Boolean(editingProduct.acceptsCoupon)
              : (editingProduct.couponEligible !== undefined
                  ? Boolean(editingProduct.couponEligible)
                  : true)),
        order: editingProduct.order || 0,
        optionGroups: normalizeProductOptionGroupsForForm(editingProduct),
        extras: editingProduct.extras || [],
        scheduling: normalizeProductSchedulingForForm(editingProduct.scheduling),
      })
    } else {
      setForm({
        ...EMPTY_PRODUCT_FORM,
        optionGroups: [],
        extras: [],
        scheduling: normalizeProductSchedulingForForm(),
      })
    }
  }, [open, editingProduct])

  useEffect(() => {
    return () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const setField = useCallback((field, value) => setForm((p) => ({ ...p, [field]: value })), [])
  const setSchedulingField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      scheduling: {
        ...normalizeProductSchedulingForForm(prev.scheduling),
        [field]: value,
      },
    }))
  }, [])

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onToast({ type: 'error', message: 'Selecione uma imagem válida.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast({ type: 'error', message: 'Imagem muito grande. Máximo 5MB.' })
      return
    }
    setImageFile(file)
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }, [imagePreview, onToast])

  const handleRemoveImage = useCallback(() => {
    setImageFile(null)
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview('')
    setField('imageUrl', '')
    setField('imagePublicId', '')
    if (imgRef.current) imgRef.current.value = ''
  }, [imagePreview, setField])

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setSection('basic')
      onToast({ type: 'error', message: 'Nome do produto é obrigatório.' })
      return
    }
    const priceValue = parseCurrency(form.price)
    if (priceValue < 0) {
      setSection('price')
      onToast({ type: 'error', message: 'Preço inválido.' })
      return
    }

    setSaving(true)
    try {
      let finalImageUrl = form.imageUrl
      let finalImagePublicId = form.imagePublicId

      if (imageFile) {
        setImageUploading(true)
        const res = await uploadImageToCloudinary(imageFile, 'PratoBy/produtos')
        finalImageUrl = res.secure_url || res.url || ''
        finalImagePublicId = res.public_id || ''
        setImageUploading(false)
      }

      const oldPriceValue = form.oldPrice ? parseCurrency(form.oldPrice) : null
      const scope = buildStoreScopedPayload(store)
      const catName = categories.find((c) => c.id === form.categoryId)?.name || ''

      if (import.meta.env.DEV) console.log('[ProductEditorDrawer] Salvando produto scope:', scope)

      const data = cleanObject({
        ...scope,
        name: form.name.trim().slice(0, 120),
        description: form.description.trim().slice(0, 500),
        categoryId: form.categoryId || '',
        categoryName: catName,
        price: priceValue,
        priceCents: Math.round(priceValue * 100),
        oldPrice: oldPriceValue,
        oldPriceCents: oldPriceValue != null ? Math.round(oldPriceValue * 100) : null,
        imageUrl: finalImageUrl,
        imagePublicId: finalImagePublicId,
        isActive: Boolean(form.isActive),
        isAvailable: Boolean(form.isAvailable),
        isVisible: Boolean(form.isVisible),
        isFeatured: Boolean(form.isFeatured),
        isPromotion: Boolean(form.isPromotion),
        acceptsCoupons: Boolean(form.acceptsCoupons),
        order: Number(form.order) || 0,
        position: Number(form.order) || 0,
        preparationTime: form.preparationTime?.trim() || '',
        optionGroups: sanitizeOptionGroupsForSave(form.optionGroups),
        extras: Array.isArray(form.extras) ? form.extras : [],
        scheduling: sanitizeProductSchedulingForSave(form.scheduling),
        isDeleted: false,
        updatedAt: serverTimestamp(),
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
  }, [form, imageFile, store, categories, editingProduct, onToast, onClose])

  const visibleImage = imagePreview || form.imageUrl
  const activeCategory = useMemo(() => categories.find((c) => c.id === form.categoryId), [categories, form.categoryId])
  const productScheduling = useMemo(
    () => normalizeProductSchedulingForForm(form.scheduling),
    [form.scheduling]
  )
  const productLeadInput = useMemo(
    () => splitSchedulingMinutes(productScheduling.minLeadMinutes),
    [productScheduling.minLeadMinutes]
  )

  const handleSetSection = useCallback((id) => {
    setSection(id)
    requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' }))
  }, [])

  const tabStatus = useMemo(() => ({
    basic: !form.name.trim() ? 'error' : null,
    price: !form.price ? 'warn' : null,
    image: form.imageUrl || imagePreview ? 'has' : null,
    status: null,
    options: form.optionGroups?.length > 0 ? form.optionGroups.length : null,
    scheduling: form.scheduling?.mode === 'scheduled_only' || form.scheduling?.prepaymentPolicy === 'pix_required'
      ? 'has'
      : null,
  }), [form.name, form.price, form.imageUrl, imagePreview, form.optionGroups, form.scheduling])

  const discountPct = useMemo(() => {
    if (!form.oldPrice || !form.price) return null
    const price = parseCurrency(form.price)
    const old = parseCurrency(form.oldPrice)
    if (!price || !old || old <= price) return null
    return Math.round((1 - price / old) * 100)
  }, [form.price, form.oldPrice])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  const drawerContent = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
            className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-md transition-all duration-300 dark:bg-black/80"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={ui.drawer}
          >
            {/* Header */}
            <div className={ui.header}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ea580c] dark:bg-orange-500/10 dark:text-orange-300">
                      Cardápio
                    </span>
                    {editingProduct ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
                        Editando
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                    {editingProduct ? 'Editar produto' : 'Novo produto'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {editingProduct ? 'Ajuste informações, preço, imagem, status e opções.' : 'Crie um item com aparência profissional para sua loja.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-orange-100 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:rotate-90 hover:border-orange-200 hover:bg-orange-50 hover:text-slate-900 active:scale-90 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                  aria-label="Fechar"
                >
                  <FiX size={18} />
                </button>
              </div>

              <ProductSummary
                form={form}
                visibleImage={visibleImage}
                categoryName={activeCategory?.name}
                discountPct={discountPct}
              />
            </div>

            {/* Section tabs */}
            <div role="tablist" className="flex shrink-0 gap-2 overflow-x-auto border-b border-orange-100/80 bg-white/70 px-5 py-3 backdrop-blur-xl [scrollbar-width:none] dark:border-white/10 dark:bg-[#11141B]/90 md:px-7 [&::-webkit-scrollbar]:hidden">
              {DRAWER_SECTIONS.map((sec) => {
                const active = section === sec.id
                const status = tabStatus[sec.id]
                const Icon = sec.icon
                return (
                  <button
                    key={sec.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => handleSetSection(sec.id)}
                    className={`relative inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all duration-200 active:scale-95 ${
                      active
                        ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-lg shadow-orange-500/25'
                        : 'border border-transparent bg-orange-50/70 text-slate-600 hover:border-orange-100 hover:bg-orange-100 dark:bg-white/10 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} />
                    {sec.label}
                    {status === 'error' && <span className={`h-2 w-2 rounded-full ${active ? 'bg-white/80' : 'bg-red-400'}`} />}
                    {status === 'warn' && <span className={`h-2 w-2 rounded-full ${active ? 'bg-white/80' : 'bg-amber-400'}`} />}
                    {status === 'has' && <span className={`h-2 w-2 rounded-full ${active ? 'bg-white/80' : 'bg-emerald-400'}`} />}
                    {typeof status === 'number' && (
                      <span className={`rounded-full px-1.5 py-px text-[10px] font-black leading-none ${active ? 'bg-white/25 text-white' : 'bg-orange-100 text-[#f97316] dark:bg-orange-500/20'}`}>
                        {status}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Body */}
            <div ref={bodyRef} className={ui.body}>
              {section === 'basic' && (
                <div className="space-y-5">
                  <SectionCard title="Informações principais" description="Nome, descrição e categoria definem como o cliente encontra este produto." icon={FiInfo}>
                    <div className="space-y-5">
                      <div>
                        <FieldLabel required>Nome</FieldLabel>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setField('name', e.target.value)}
                          placeholder="Ex: X-Burguer Artesanal"
                          maxLength={120}
                          className={ui.input}
                        />
                        <Counter value={form.name.length} max={120} />
                      </div>

                      <div>
                        <FieldLabel>Descrição</FieldLabel>
                        <textarea
                          value={form.description}
                          onChange={(e) => setField('description', e.target.value)}
                          placeholder="Ingredientes, diferenciais, tamanho..."
                          maxLength={500}
                          rows={4}
                          className={ui.textarea}
                        />
                        <Counter value={form.description.length} max={500} />
                      </div>

                      <div>
                        <FieldLabel>Categoria</FieldLabel>
                        <select
                          value={form.categoryId}
                          onChange={(e) => setField('categoryId', e.target.value)}
                          className={ui.input}
                        >
                          <option value="">Sem categoria</option>
                          {categories.filter((c) => !c.isDeleted).map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Operação no cardápio" description="Use preparo e ordem para organizar a experiência do cliente." icon={FiClock}>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Tempo de preparo</FieldLabel>
                        <input
                          type="text"
                          value={form.preparationTime}
                          onChange={(e) => setField('preparationTime', e.target.value)}
                          placeholder="Ex: 20-30 min"
                          className={ui.input}
                        />
                      </div>
                      <div>
                        <FieldLabel>Ordem de exibição</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          value={form.order}
                          onChange={(e) => setField('order', Number(e.target.value))}
                          className={ui.input}
                        />
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {section === 'price' && (
                <div className="space-y-5">
                  <InfoCallout>
                    Os valores são salvos em centavos no banco de dados. Exemplo: <span className="font-black">2990 = R$&nbsp;29,90</span>. Use vírgula para casas decimais.
                  </InfoCallout>

                  <SectionCard title="Preço de venda" description="Esse é o valor principal exibido no cardápio." icon={FiDollarSign}>
                    <div>
                      <FieldLabel required>Preço principal</FieldLabel>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 dark:text-slate-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.price}
                          onChange={(e) => setField('price', e.target.value)}
                          placeholder="0,00"
                          onBlur={() => {
                            const v = parseCurrency(form.price)
                            if (v > 0) setField('price', moneyToInput(v, Math.round(v * 100)))
                          }}
                          className="h-16 w-full rounded-[1.4rem] border border-orange-100 bg-white pl-12 pr-4 text-2xl font-black text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-300 hover:border-orange-200 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-50 dark:hover:border-orange-500/40 dark:focus:ring-orange-500/20"
                        />
                      </div>
                      {form.price ? (
                        <p className="mt-2 text-xs font-black text-slate-400 dark:text-slate-500">
                          Convertido: {formatMoney(parseCurrency(form.price))} <span className="mx-1 text-slate-300 dark:text-white/20">•</span> {Math.round(parseCurrency(form.price) * 100)} centavos
                        </p>
                      ) : null}
                    </div>
                  </SectionCard>

                  <SectionCard title="Preço promocional" description="Use preço riscado para mostrar economia sem alterar a lógica de cupons." icon={FiTag} aside={discountPct !== null ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">-{discountPct}%</span> : null}>
                    <div>
                      <FieldLabel>Preço “De” / riscado</FieldLabel>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-slate-400 dark:text-slate-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.oldPrice}
                          onChange={(e) => setField('oldPrice', e.target.value)}
                          placeholder="0,00"
                          onBlur={() => {
                            const v = parseCurrency(form.oldPrice)
                            if (v > 0) setField('oldPrice', moneyToInput(v, Math.round(v * 100)))
                          }}
                          className={`${ui.input} pl-12`}
                        />
                      </div>
                      <p className={ui.hint}>Este valor aparecerá riscado na loja para indicar promoção.</p>
                    </div>
                  </SectionCard>
                </div>
              )}

              {section === 'image' && (
                <div className="space-y-5">
                  <SectionCard title="Imagem do produto" description="Uma foto boa aumenta a confiança e melhora a conversão do cardápio." icon={FiImage}>
                    {visibleImage ? (
                      <div className="group relative overflow-hidden rounded-[1.6rem] border border-orange-100 shadow-sm dark:border-white/10">
                        <img src={visibleImage} alt="Preview" className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent opacity-80" />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-red-500/90 text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-red-600 active:scale-95"
                          aria-label="Remover imagem"
                        >
                          <FiTrash2 size={16} />
                        </button>
                        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900 shadow-lg backdrop-blur-sm">
                            {imagePreview ? 'Nova imagem pendente' : 'Imagem atual'}
                          </span>
                          <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                            PratoBy
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => imgRef.current?.click()}
                        className="group flex h-72 w-full flex-col items-center justify-center gap-4 rounded-[1.6rem] border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50 to-white transition-all duration-200 hover:border-orange-300 hover:from-orange-100 hover:to-orange-50 dark:border-white/10 dark:from-white/[0.045] dark:to-white/[0.02] dark:hover:border-orange-500/30 dark:hover:from-orange-500/10"
                      >
                        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-[#f97316] shadow-lg shadow-orange-950/10 ring-1 ring-orange-100 transition-transform duration-300 group-hover:scale-110 dark:bg-[#1A1F2B] dark:ring-white/10">
                          <FiImage size={28} />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-black text-slate-950 dark:text-slate-50">Clique para selecionar</p>
                          <p className="mt-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">PNG, JPG, WEBP (máx. 5 MB)</p>
                        </div>
                      </button>
                    )}

                    <input ref={imgRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                    <button
                      type="button"
                      onClick={() => imgRef.current?.click()}
                      className={`mt-4 flex w-full items-center justify-center gap-2 ${ui.secondaryButton}`}
                    >
                      <FiImage size={16} />
                      {visibleImage ? 'Trocar imagem' : 'Selecionar imagem'}
                    </button>
                  </SectionCard>
                </div>
              )}

              {section === 'status' && (
                <div className="space-y-5">
                  <InfoCallout>
                    Controle o que aparece para o cliente sem apagar o produto. Para pausar venda temporária, desligue “Disponível agora”.
                  </InfoCallout>
                  <div className="grid grid-cols-1 gap-3">
                    {statusItems.map((item) => (
                      <StatusToggleCard
                        key={item.key}
                        item={item}
                        checked={Boolean(form[item.key])}
                        onChange={(e) => setField(item.key, e.target.checked)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {section === 'options' && (
                <div className="space-y-5">
                  <InfoCallout>
                    Grupos de opções permitem customização do produto. Compatível com o modal de opções e o carrinho da loja pública.
                  </InfoCallout>
                  <OptionGroupsEditor
                    groups={form.optionGroups}
                    onChange={(groups) => setField('optionGroups', groups)}
                  />
                </div>
              )}
              {section === 'scheduling' && (
                <div className="space-y-5">
                  <InfoCallout>
                    Use esta seção para vender bolos, kits festa, marmitas programadas e outros produtos que precisam de data marcada.
                  </InfoCallout>

                  <SectionCard title="Como este produto pode ser vendido?" description="Defina se o produto segue a loja, aceita pedido imediato ou exige data marcada." icon={FiCalendar}>
                    <div className="grid gap-3">
                      {[
                        ['store_default', 'Seguir regra da loja', 'Usa a configuração geral de agendamento.'],
                        ['asap_only', 'Só pedido imediato', 'Não permite escolher data futura.'],
                        ['asap_and_scheduled', 'Imediato e agendado', 'Cliente pode pedir agora ou escolher horário.'],
                        ['scheduled_only', 'Somente sob encomenda/agendado', 'Cliente será obrigado a escolher data e horário.'],
                      ].map(([mode, title, description]) => {
                        const active = productScheduling.mode === mode
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSchedulingField('mode', mode)}
                            className={`rounded-2xl border p-4 text-left transition-all ${
                              active
                                ? 'border-orange-300 bg-orange-50 text-[#f97316] ring-4 ring-orange-100 dark:border-orange-500/50 dark:bg-orange-500/10 dark:ring-orange-500/15'
                                : 'border-orange-100 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/60 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-200 dark:hover:border-orange-500/30'
                            }`}
                          >
                            <p className="text-sm font-black">{title}</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </SectionCard>

                  {productScheduling.mode === 'scheduled_only' && (
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <FiCheck size={18} className="mt-0.5 shrink-0" />
                      <p className="text-sm font-black">Este produto só poderá ser comprado com data e horário escolhidos.</p>
                    </div>
                  )}

                  <SectionCard title="Regras especificas" description="Deixe em branco para seguir a regra geral da loja." icon={FiClock}>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                        <div>
                          <FieldLabel>Antecedência mínima</FieldLabel>
                          <input
                            type="number"
                            min="0"
                            value={productLeadInput.value}
                            onChange={(event) => setSchedulingField(
                              'minLeadMinutes',
                              schedulingInputToMinutes(event.target.value, productLeadInput.unit)
                            )}
                            placeholder="Seguir loja"
                            className={ui.input}
                          />
                          <p className={ui.hint}>Ex: bolo com 2 dias = 2880 minutos.</p>
                        </div>

                        <div>
                          <FieldLabel>Unidade</FieldLabel>
                          <select
                            value={productLeadInput.unit}
                            onChange={(event) => setSchedulingField(
                              'minLeadMinutes',
                              schedulingInputToMinutes(productLeadInput.value, event.target.value)
                            )}
                            className={ui.input}
                          >
                            <option value="minutes">Minutos</option>
                            <option value="hours">Horas</option>
                            <option value="days">Dias</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <FieldLabel>Limite de dias à frente</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={productScheduling.maxDaysAhead ?? ''}
                          onChange={(event) => setSchedulingField('maxDaysAhead', event.target.value === '' ? null : Number(event.target.value))}
                          placeholder="Seguir loja"
                          className={ui.input}
                        />
                      </div>

                      <div>
                        <FieldLabel>Intervalo dos horários</FieldLabel>
                        <select
                          value={productScheduling.slotIntervalMinutes ?? ''}
                          onChange={(event) => setSchedulingField('slotIntervalMinutes', event.target.value === '' ? null : Number(event.target.value))}
                          className={ui.input}
                        >
                          <option value="">Seguir loja</option>
                          <option value={10}>10 minutos</option>
                          <option value={15}>15 minutos</option>
                          <option value={30}>30 minutos</option>
                          <option value={60}>60 minutos</option>
                        </select>
                        <p className={ui.hint}>Permite casos como bolo em intervalos de 10 minutos mesmo se a loja usa 30.</p>
                      </div>

                      <div>
                        <FieldLabel>Pagamento</FieldLabel>
                        <select
                          value={productScheduling.prepaymentPolicy}
                          onChange={(event) => setSchedulingField('prepaymentPolicy', event.target.value)}
                          className={ui.input}
                        >
                          <option value="store_default">Seguir regra da loja</option>
                          <option value="none">Não exigir Pix</option>
                          <option value="pix_required">Exigir Pix antecipado</option>
                        </select>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Tipos aceitos" description="Use seguir loja para herdar entrega e retirada da configuração geral." icon={FiTruck}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setSchedulingField('fulfillmentTypes', null)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                          productScheduling.fulfillmentTypes === null
                            ? 'border-orange-300 bg-orange-50 text-[#f97316] dark:border-orange-500/40 dark:bg-orange-500/10'
                            : 'border-orange-100 bg-white text-slate-600 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-300'
                        }`}
                      >
                        Seguir loja
                      </button>

                      {[
                        ['delivery', 'Entrega'],
                        ['pickup', 'Retirada'],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-[#1A1F2B] dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={(productScheduling.fulfillmentTypes || { delivery: true, pickup: true })[key] !== false}
                            onChange={(event) => setSchedulingField('fulfillmentTypes', {
                              ...(productScheduling.fulfillmentTypes || { delivery: true, pickup: true }),
                              [key]: event.target.checked,
                            })}
                            className="h-4 w-4 accent-[#f97316]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </SectionCard>

                  {productScheduling.prepaymentPolicy === 'pix_required' && (
                    <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200">
                      <FiCreditCard size={18} className="mt-0.5 shrink-0" />
                      <p className="text-sm font-black">O checkout exigirá Pix para confirmar esta encomenda.</p>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      'Bolo personalizado: 2 dias de antecedência + Pix antecipado',
                      'Pizza: imediato e agendado',
                      'Marmita: agendamento com retirada programada',
                    ].map((example) => (
                      <div key={example} className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-xs font-black leading-5 text-[#9a3412] dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
                        {example}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <FiAlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <p className="text-sm font-bold leading-6">
                      Horarios personalizados por produto e capacidade por slot ficam fora desta fase.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={ui.footer}>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className={`flex-1 ${ui.secondaryButton}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || imageUploading || !form.name.trim()}
                  className={`flex flex-1 items-center justify-center gap-2 ${ui.primaryButton}`}
                >
                  {saving || imageUploading ? (
                    <><FiLoader className="animate-spin" size={16} />{imageUploading ? 'Enviando...' : 'Salvando...'}</>
                  ) : (
                    <><FiCheck size={16} />{editingProduct ? 'Salvar alterações' : 'Criar produto'}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  if (typeof window === 'undefined') return null
  return createPortal(drawerContent, document.body)
}
