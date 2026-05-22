// src/pages/merchant/menu/components/CouponEditorDrawer.jsx
// Drawer lateral para criação e edição de cupons.

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiDollarSign,
  FiHash,
  FiInfo,
  FiLoader,
  FiPercent,
  FiX,
} from 'react-icons/fi'

import { EMPTY_COUPON_FORM, dateToInputString } from '../utils/couponPayloads'
import { parseCurrency, formatMoney, moneyToInput } from '../utils/menuFormatters'

const DRAWER_SECTIONS = [
  { id: 'basic', label: 'Informações' },
  { id: 'rules', label: 'Regras e Vigência' },
  { id: 'products', label: 'Produtos Elegíveis' },
]

/**
 * @param {{
 *   open: boolean,
 *   onClose: fn,
 *   editingCoupon: object|null,
 *   store: object,
 *   onSave: fn, // (couponId, form, store, showToast) => Promise<boolean>
 *   onToast: fn,
 * }} props
 */
export default function CouponEditorDrawer({ open, onClose, editingCoupon, store, products = [], onSave, onToast }) {
  const [form, setForm]       = useState(EMPTY_COUPON_FORM)
  const [saving, setSaving]   = useState(false)
  const [section, setSection] = useState('basic')
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = (products || []).filter((p) =>
    p.isDeleted !== true &&
    !p.deletedAt &&
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  // Inicialização do formulário ao abrir ou alterar cupom ativo
  useEffect(() => {
    if (!open) return
    setSection('basic')
    setProductSearch('')
    if (editingCoupon) {
      setForm({
        code:        editingCoupon.code || '',
        description: editingCoupon.description || '',
        type:        editingCoupon.type || 'percent',
        value:       editingCoupon.type === 'percent'
                       ? String(editingCoupon.value || '')
                       : moneyToInput(editingCoupon.value, editingCoupon.valueCents),
        minOrder:    editingCoupon.minOrder != null
                       ? moneyToInput(editingCoupon.minOrder, editingCoupon.minOrderCents)
                       : '',
        maxDiscount: editingCoupon.maxDiscount != null
                       ? moneyToInput(editingCoupon.maxDiscount, editingCoupon.maxDiscountCents)
                       : '',
        startsAt:    dateToInputString(editingCoupon.startsAt),
        expiresAt:   dateToInputString(editingCoupon.expiresAt),
        usageLimit:  editingCoupon.usageLimit != null ? String(editingCoupon.usageLimit) : '',
        active:      editingCoupon.active !== false,
        appliesTo:   editingCoupon.appliesTo || 'all',
        productIds:  Array.isArray(editingCoupon.productIds) ? editingCoupon.productIds : [],
      })
    } else {
      setForm(EMPTY_COUPON_FORM)
    }
  }, [open, editingCoupon])

  const setField = useCallback((field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
  }, [])

  const handleSave = async () => {
    // 1. Validações Locais
    const code = String(form.code || '').trim().toUpperCase()
    if (!code) {
      onToast({ type: 'error', message: 'O código do cupom é obrigatório.' })
      return
    }
    if (code.length < 3) {
      onToast({ type: 'error', message: 'O código deve ter pelo menos 3 caracteres.' })
      return
    }

    const valueNum = form.type === 'percent' ? Number(form.value) : parseCurrency(form.value)
    if (Number.isNaN(valueNum) || valueNum <= 0) {
      onToast({ type: 'error', message: 'O valor do desconto deve ser maior que zero.' })
      return
    }

    if (form.type === 'percent' && (valueNum < 1 || valueNum > 100)) {
      onToast({ type: 'error', message: 'Porcentagem de desconto deve ser entre 1% e 100%.' })
      return
    }

    if (form.minOrder) {
      const minOrderNum = parseCurrency(form.minOrder)
      if (Number.isNaN(minOrderNum) || minOrderNum < 0) {
        onToast({ type: 'error', message: 'O pedido mínimo deve ser um valor válido.' })
        return
      }
    }

    if (form.type === 'percent' && form.maxDiscount) {
      const maxDiscountNum = parseCurrency(form.maxDiscount)
      if (Number.isNaN(maxDiscountNum) || maxDiscountNum < 0) {
        onToast({ type: 'error', message: 'O desconto máximo deve ser um valor válido.' })
        return
      }
    }

    if (form.usageLimit) {
      const limitNum = Number(form.usageLimit)
      if (!Number.isInteger(limitNum) || limitNum <= 0) {
        onToast({ type: 'error', message: 'O limite de uso deve ser um número inteiro maior que zero.' })
        return
      }
    }

    if (form.startsAt && form.expiresAt) {
      const start = new Date(form.startsAt)
      const expire = new Date(form.expiresAt)
      if (expire <= start) {
        onToast({ type: 'error', message: 'A data de expiração deve ser após a data de início.' })
        return
      }
    }

    if (form.appliesTo === 'includeProducts' && (!form.productIds || form.productIds.length === 0)) {
      onToast({ type: 'error', message: 'Selecione pelo menos um produto para o cupom específico.' })
      return
    }

    setSaving(true)
    try {
      // Chama o handler do hook useMenuManagementData
      const success = await onSave(editingCoupon?.id || null, form, store, onToast)
      if (success) {
        onClose()
      }
    } catch (err) {
      console.error('[CouponEditorDrawer] handleSave:', err)
      onToast({ type: 'error', message: 'Erro ao salvar o cupom. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer Body */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-white shadow-2xl md:w-[500px] lg:w-[560px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-[#111827]">
                  {editingCoupon ? 'Editar cupom' : 'Novo cupom'}
                </h2>
                <p className="mt-0.5 text-xs font-bold text-[#9ca3af]">
                  {editingCoupon ? `Editando código ${editingCoupon.code}` : 'Crie promoções e fidelize seus clientes'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100"
                aria-label="Fechar"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DRAWER_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSection(sec.id)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    section === sec.id
                      ? 'bg-[#f97316] text-white'
                      : 'bg-gray-50 text-[#6b7280] hover:bg-gray-100'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
              {section === 'basic' && (
                <div className="space-y-4">
                  {/* Código */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Código do Cupom *
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setField('code', e.target.value.toUpperCase())}
                      placeholder="Ex: PROMO10"
                      maxLength={30}
                      className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    />
                    <p className="mt-1 text-xs text-[#9ca3af]">Apenas letras maiúsculas e números. Sem espaços.</p>
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Descrição / Regra visual
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      placeholder="Ex: R$ 10 de desconto em compras acima de R$ 50"
                      maxLength={150}
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-orange-100/80 bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                    />
                    <p className="mt-1 text-right text-xs text-[#9ca3af]">{form.description.length}/150</p>
                  </div>

                  {/* Tipo de Desconto */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Tipo de Desconto
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setField('type', 'percent')
                          setField('value', '')
                        }}
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl border-2 font-black transition ${
                          form.type === 'percent'
                            ? 'border-[#f97316] bg-orange-50/20 text-[#f97316]'
                            : 'border-gray-100 bg-gray-50 text-[#6b7280] hover:bg-gray-100'
                        }`}
                      >
                        <FiPercent size={15} /> Porcentagem
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setField('type', 'fixed')
                          setField('value', '')
                        }}
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl border-2 font-black transition ${
                          form.type === 'fixed'
                            ? 'border-[#f97316] bg-orange-50/20 text-[#f97316]'
                            : 'border-gray-100 bg-gray-50 text-[#6b7280] hover:bg-gray-100'
                        }`}
                      >
                        <FiDollarSign size={15} /> Valor Fixo (R$)
                      </button>
                    </div>
                  </div>

                  {/* Valor do Desconto */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Desconto *
                    </label>
                    <div className="relative">
                      {form.type === 'fixed' ? (
                        <>
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={form.value}
                            onChange={(e) => setField('value', e.target.value)}
                            placeholder="0,00"
                            className="h-14 w-full rounded-2xl border border-orange-100/80 bg-white pl-11 pr-4 text-xl font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                          />
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={form.value}
                            onChange={(e) => setField('value', e.target.value)}
                            placeholder="Ex: 15"
                            className="h-14 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-xl font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">
                            %
                          </span>
                        </>
                      )}
                    </div>
                    {form.type === 'fixed' && form.value ? (
                      <p className="mt-1 text-xs text-[#9ca3af]">
                        Será convertido para {Math.round(parseCurrency(form.value) * 100)} centavos no banco.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {section === 'rules' && (
                <div className="space-y-4">
                  {/* Informativo de Cents */}
                  <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
                    <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" size={16} />
                    <p className="text-xs font-semibold leading-5 text-[#6b7280]">
                      As regras financeiras são normalizadas em centavos para total precisão em pedidos do carrinho.
                    </p>
                  </div>

                  {/* Pedido Mínimo */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Pedido Mínimo (opcional)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.minOrder}
                        onChange={(e) => setField('minOrder', e.target.value)}
                        placeholder="0,00"
                        className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af]">O cupom só funcionará se o subtotal atingir este valor.</p>
                  </div>

                  {/* Desconto Máximo (Apenas se for percentual) */}
                  {form.type === 'percent' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                        Desconto Máximo (opcional)
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.maxDiscount}
                          onChange={(e) => setField('maxDiscount', e.target.value)}
                          placeholder="0,00"
                          className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#9ca3af]">Limita o desconto do cupom caso o valor percentual ultrapasse este teto.</p>
                    </div>
                  )}

                  {/* Limite de uso */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Limite total de usos (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={form.usageLimit}
                        onChange={(e) => setField('usageLimit', e.target.value)}
                        placeholder="Ex: 50"
                        className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#9ca3af]">
                        <FiHash size={14} />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af]">Máximo de pedidos que podem aplicar este cupom.</p>
                  </div>

                  {/* Validade do Cupom */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                        Início da vigência
                      </label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={form.startsAt}
                          onChange={(e) => setField('startsAt', e.target.value)}
                          className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-3 text-xs font-bold text-[#111827] outline-none focus:border-[#f97316]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                        Fim / Expiração
                      </label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={form.expiresAt}
                          onChange={(e) => setField('expiresAt', e.target.value)}
                          className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-3 text-xs font-bold text-[#111827] outline-none focus:border-[#f97316]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status Inicial / Toggle */}
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 transition hover:border-orange-100 hover:bg-orange-50/30">
                    <div>
                      <p className="text-sm font-black text-[#111827]">Cupom ativo</p>
                      <p className="mt-0.5 text-xs text-[#9ca3af]">Indica se o cupom pode ser buscado e aplicado por clientes</p>
                    </div>
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(form.active)}
                        onChange={(e) => setField('active', e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-6 w-11 rounded-full transition-colors ${
                          form.active ? 'bg-[#f97316]' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            form.active ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {section === 'products' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Aplicar desconto a:
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: 'all', label: ' Todos os produtos', desc: 'O cupom se aplica a todos os itens que aceitam cupom.' },
                        { id: 'includeProducts', label: ' Apenas produtos específicos', desc: 'Selecione a lista de produtos elegíveis ao desconto.' },
                        { id: 'excludeProducts', label: ' Todos, exceto específicos', desc: 'Exclua itens específicos da vigência deste cupom.' },
                      ].map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${
                            form.appliesTo === opt.id
                              ? 'border-[#f97316] bg-orange-50/20'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="appliesTo"
                            value={opt.id}
                            checked={form.appliesTo === opt.id}
                            onChange={() => {
                              setField('appliesTo', opt.id)
                              if (opt.id === 'all') setField('productIds', [])
                            }}
                            className="mt-1 accent-[#f97316]"
                          />
                          <div>
                            <p className="text-sm font-black text-[#111827]">{opt.label}</p>
                            <p className="mt-0.5 text-xs text-[#6b7280]">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {form.appliesTo !== 'all' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                          Selecionar Produtos ({form.productIds?.length || 0} selecionados)
                        </label>
                        {form.productIds?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setField('productIds', [])}
                            className="text-xs font-black text-red-500 hover:text-red-600 transition"
                          >
                            Limpar seleção
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder=" Buscar produto por nome..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-[#111827] outline-none focus:border-[#f97316]"
                      />

                      <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 space-y-1 [scrollbar-width:thin]">
                        {filteredProducts.length === 0 ? (
                          <p className="p-4 text-center text-xs font-bold text-[#9ca3af]">Nenhum produto encontrado.</p>
                        ) : (
                          filteredProducts.map((p) => {
                            const isChecked = form.productIds?.includes(p.id)
                            const hasOutOfStock = p.isAvailable === false
                            const isHidden = p.isVisible === false
                            const doesNotAccept = p.acceptsCoupons === false || p.acceptsCoupon === false || p.couponEligible === false

                            return (
                              <label
                                key={p.id}
                                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-gray-50 ${
                                  isChecked ? 'bg-orange-50/10' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const newIds = isChecked
                                        ? form.productIds.filter((id) => id !== p.id)
                                        : [...(form.productIds || []), p.id]
                                      setField('productIds', newIds)
                                    }}
                                    className="accent-[#f97316] h-4 w-4 shrink-0 rounded"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-black text-[#111827]">{p.name}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {doesNotAccept && (
                                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-500">
                                          Não aceita cupons
                                        </span>
                                      )}
                                      {hasOutOfStock && (
                                        <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[9px] font-black text-yellow-600">
                                          Esgotado
                                        </span>
                                      )}
                                      {isHidden && (
                                        <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[9px] font-black text-gray-500">
                                          Oculto
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="shrink-0 text-xs font-black text-[#4b5563]">
                                  {p.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-3 border-t border-gray-100 px-5 py-4 bg-white">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.code.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-[#ea580c] disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <FiLoader className="animate-spin" size={15} /> Salvando...
                  </>
                ) : (
                  <>
                    <FiCheck size={15} /> {editingCoupon ? 'Salvar alterações' : 'Criar cupom'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
