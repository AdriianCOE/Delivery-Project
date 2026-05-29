// src/pages/merchant/menu/components/MenuCouponsTab.jsx
// Aba de cupons: lista com buscas, filtros, cards mobile-first e tabela desktop premium.

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiCalendar,
  FiCheck,
  FiEdit2,
  FiHash,
  FiPlus,
  FiSearch,
  FiTag,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

import MenuEmptyState from './MenuEmptyState'
import { formatMoney } from '../utils/menuFormatters'
import { COUPON_STATUS_FILTERS } from '../utils/couponPayloads'

// Formata data e hora para exibição amigável em PT-BR
function formatDateTime(value) {
  if (!value) return null
  let d = null
  if (typeof value.toDate === 'function') {
    d = value.toDate()
  } else if (value.seconds) {
    d = new Date(value.seconds * 1000)
  } else {
    d = new Date(value)
  }
  if (!d || Number.isNaN(d.getTime())) return null
  
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Analisa a vigência do cupom em tempo real
function getCouponVigencyStatus(coupon) {
  if (!coupon.active) return { code: 'inactive', label: 'Inativo', color: 'bg-gray-100 text-gray-600' }
  
  const now = new Date()
  let start = null
  if (coupon.startsAt?.toDate) start = coupon.startsAt.toDate()
  else if (coupon.startsAt?.seconds) start = new Date(coupon.startsAt.seconds * 1000)
  else if (coupon.startsAt) start = new Date(coupon.startsAt)
  
  let expire = null
  if (coupon.expiresAt?.toDate) expire = coupon.expiresAt.toDate()
  else if (coupon.expiresAt?.seconds) expire = new Date(coupon.expiresAt.seconds * 1000)
  else if (coupon.expiresAt) expire = new Date(coupon.expiresAt)

  if (start && now < start) {
    return { code: 'scheduled', label: 'Agendado', color: 'bg-blue-50 text-blue-600 border border-blue-100' }
  }
  if (expire && now > expire) {
    return { code: 'expired', label: 'Expirado', color: 'bg-red-50 text-red-600 border border-red-100' }
  }
  return { code: 'valid', label: 'Vigente', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }
}

/**
 * @param {{
 *   coupons: object[],
 *   onEdit: fn,
 *   onDelete: fn,
 *   onToggleActive: fn,
 *   onCreateCoupon: fn,
 * }} props
 */
export default function MenuCouponsTab({ coupons, onEdit, onDelete, onToggleActive, onCreateCoupon }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // Filtros combinados de busca e status
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchesSearch =
        c.code?.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && c.active) ||
        (filter === 'inactive' && !c.active)

      return matchesSearch && matchesStatus
    })
  }, [coupons, search, filter])

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <FiSearch size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className="h-11 w-full rounded-2xl border border-gray-100 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none shadow-sm transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100/50"
          />
        </div>

        {/* Buttons / Actions */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          {/* Status Selectors */}
          <div className="grid grid-cols-3 rounded-xl bg-gray-50 p-1 sm:flex">
            {COUPON_STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFilter(s.id)}
                className={`rounded-lg px-3 py-2 text-xs font-black transition sm:py-1.5 ${
                  filter === s.id
                    ? 'bg-white text-[#f97316] shadow-sm'
                    : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Create Button */}
          <button
            type="button"
            onClick={onCreateCoupon}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c] sm:w-auto"
          >
            <FiPlus size={15} /> Novo cupom
          </button>
        </div>
      </div>

      {filteredCoupons.length > 0 ? (
        <>
          {/* ────────────────── VIEW MOBILE (CARDS) ────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            <AnimatePresence mode="popLayout">
              {filteredCoupons.map((coupon) => {
                const status = getCouponVigencyStatus(coupon)
                return (
                  <motion.div
                    key={coupon.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4 transition hover:shadow-md hover:border-orange-100"
                  >
                    {/* Header: Code & Active Switch */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
                          <FiTag size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#111827] tracking-wider">{coupon.code}</p>
                          <span className={`inline-block rounded-full px-2 py-0.5 mt-0.5 text-[10px] font-black ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Active Switch */}
                      <div className="relative shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(coupon.active)}
                          onChange={() => onToggleActive(coupon.id, coupon.active !== false)}
                          className="sr-only"
                          id={`toggle-mob-${coupon.id}`}
                        />
                        <label
                          htmlFor={`toggle-mob-${coupon.id}`}
                          className={`block h-6 w-11 cursor-pointer rounded-full transition-colors ${
                            coupon.active ? 'bg-[#f97316]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              coupon.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Description */}
                    {coupon.description && (
                      <p className="text-xs font-bold text-gray-500 bg-gray-50/50 rounded-2xl p-3 border border-gray-50">
                        {coupon.description}
                      </p>
                    )}

                    {/* Promo Values */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-bold text-gray-400 uppercase tracking-wide text-[9px]">Desconto</p>
                        <p className="font-black text-gray-800 text-sm mt-0.5">
                          {coupon.type === 'percent' ? `${coupon.value}%` : formatMoney(coupon.value)}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-gray-400 uppercase tracking-wide text-[9px]">Pedido Mínimo</p>
                        <p className="font-bold text-gray-800 text-sm mt-0.5">
                          {coupon.minOrder ? formatMoney(coupon.minOrder) : 'Nenhum'}
                        </p>
                      </div>
                    </div>

                    {/* Secondary rules: limit and validity */}
                    <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                      {(coupon.maxDiscount || coupon.usageLimit || coupon.startsAt || coupon.expiresAt) ? (
                        <>
                          {coupon.type === 'percent' && coupon.maxDiscount && (
                            <div className="flex justify-between font-bold text-gray-500">
                              <span>Teto desconto:</span>
                              <span className="text-gray-800 font-extrabold">{formatMoney(coupon.maxDiscount)}</span>
                            </div>
                          )}
                          {coupon.usageLimit && (
                            <div className="flex justify-between font-bold text-gray-500">
                              <span>Usos:</span>
                              <span className="text-gray-800 font-extrabold">
                                {coupon.usedCount || 0} / {coupon.usageLimit}
                              </span>
                            </div>
                          )}
                          {coupon.startsAt && (
                            <div className="flex justify-between font-bold text-gray-400 text-[10px]">
                              <span>Vigência inicia:</span>
                              <span className="text-gray-600 font-bold">{formatDateTime(coupon.startsAt)}</span>
                            </div>
                          )}
                          {coupon.expiresAt && (
                            <div className="flex justify-between font-bold text-gray-400 text-[10px]">
                              <span>Expira em:</span>
                              <span className="text-gray-600 font-bold">{formatDateTime(coupon.expiresAt)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-bold">Sem regras adicionais ou vigência.</p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-2 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => onEdit(coupon)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-blue-50 py-2.5 text-xs font-black text-blue-600 transition hover:bg-blue-100"
                      >
                        <FiEdit2 size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(coupon.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-red-50 py-2.5 text-xs font-black text-red-500 transition hover:bg-red-100"
                      >
                        <FiTrash2 size={13} /> Arquivar
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* ────────────────── VIEW DESKTOP (TABLE) ────────────────── */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="py-4 px-6">Código / Descrição</th>
                  <th className="py-4 px-4">Desconto</th>
                  <th className="py-4 px-4">Pedido Mínimo</th>
                  <th className="py-4 px-4">Vigência</th>
                  <th className="py-4 px-4">Usos</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-bold text-[#111827]">
                <AnimatePresence mode="popLayout">
                  {filteredCoupons.map((coupon) => {
                    const status = getCouponVigencyStatus(coupon)
                    return (
                      <motion.tr
                        key={coupon.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="transition hover:bg-orange-50/10"
                      >
                        {/* Código & Descrição */}
                        <td className="py-4 px-6 max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#f97316]">
                              <FiTag size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black tracking-wider text-sm">{coupon.code}</p>
                              {coupon.description && (
                                <p className="mt-0.5 text-xs font-semibold text-[#9ca3af] truncate" title={coupon.description}>
                                  {coupon.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Desconto */}
                        <td className="py-4 px-4">
                          <p className="font-extrabold text-gray-800">
                            {coupon.type === 'percent' ? `${coupon.value}%` : formatMoney(coupon.value)}
                          </p>
                          {coupon.type === 'percent' && coupon.maxDiscount && (
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                              Teto: {formatMoney(coupon.maxDiscount)}
                            </p>
                          )}
                        </td>

                        {/* Pedido Mínimo */}
                        <td className="py-4 px-4 text-[#6b7280]">
                          {coupon.minOrder ? formatMoney(coupon.minOrder) : '—'}
                        </td>

                        {/* Vigência */}
                        <td className="py-4 px-4 text-xs font-bold text-[#6b7280] space-y-0.5">
                          {coupon.startsAt || coupon.expiresAt ? (
                            <>
                              {coupon.startsAt && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black uppercase text-gray-400">Início:</span>
                                  <span>{formatDateTime(coupon.startsAt)}</span>
                                </div>
                              )}
                              {coupon.expiresAt && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black uppercase text-gray-400">Fim:</span>
                                  <span>{formatDateTime(coupon.expiresAt)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Sem expiração</span>
                          )}
                        </td>

                        {/* Usos */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
                            <span className="font-black text-gray-800">{coupon.usedCount || 0}</span>
                            {coupon.usageLimit ? (
                              <>
                                <span>/</span>
                                <span className="font-bold">{coupon.usageLimit}</span>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400">(ilimitado)</span>
                            )}
                          </div>
                        </td>

                        {/* Status Toggle Switch */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${status.color}`}>
                              {status.label}
                            </span>
                            
                            {/* Toggle active switch */}
                            <div className="relative shrink-0">
                              <input
                                type="checkbox"
                                checked={Boolean(coupon.active)}
                                onChange={() => onToggleActive(coupon.id, coupon.active !== false)}
                                className="sr-only"
                                id={`toggle-dt-${coupon.id}`}
                              />
                              <label
                                htmlFor={`toggle-dt-${coupon.id}`}
                                className={`block h-6 w-11 cursor-pointer rounded-full transition-colors ${
                                  coupon.active ? 'bg-[#f97316]' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                    coupon.active ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </label>
                            </div>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Editar cupom"
                              onClick={() => onEdit(coupon)}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                            >
                              <FiEdit2 size={13} />
                            </button>
                            <button
                              type="button"
                              title="Arquivar/Deletar cupom"
                              onClick={() => onDelete(coupon.id)}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Empty State */
        <MenuEmptyState
          icon={FiTag}
          title={search || filter !== 'all' ? 'Nenhum cupom encontrado' : 'Nenhum cupom ativo ou cadastrado'}
          description={
            search || filter !== 'all'
              ? 'Tente mudar os filtros de busca ou status para encontrar o cupom desejado.'
              : 'Cupons atraem novos clientes e ajudam na fidelização. Comece criando o seu primeiro cupom promocional agora mesmo!'
          }
          action={
            search || filter !== 'all'
              ? { label: 'Limpar filtros', onClick: () => { setSearch(''); setFilter('all'); } }
              : { label: 'Criar meu primeiro cupom', onClick: onCreateCoupon }
          }
        />
      )}
    </div>
  )
}
