// src/pages/merchant/menu/components/MenuCouponsTab.jsx
// Aba de cupons: lista com buscas, filtros, cards mobile-first e tabela desktop premium.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiEdit2,
  FiPlus,
  FiSearch,
  FiTag,
  FiTrash2,
} from 'react-icons/fi'

import MenuEmptyState from './MenuEmptyState'
import { formatMoney } from '../utils/menuFormatters'
import { COUPON_STATUS_FILTERS } from '../utils/couponPayloads'
import AnimatedSegmentedControl from '../../../../components/ui/AnimatedSegmentedControl'
import { UPGRADE_PROMPT_COPY } from '../../../../utils/planCatalog'
import LockedFeatureCard from '../../../../components/billing/LockedFeatureCard'

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
  if (!coupon.active) return { code: 'inactive', label: 'Inativo', color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 border' }
  
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
    return { code: 'scheduled', label: 'Agendado', color: 'bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20' }
  }
  if (expire && now > expire) {
    return { code: 'expired', label: 'Expirado', color: 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' }
  }
  return { code: 'valid', label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' }
}

/**
 * @param {{
 *   coupons: object[],
 *   couponsAllowed: boolean,
 *   onEdit: fn,
 *   onDelete: fn,
 *   onToggleActive: fn,
 *   onCreateCoupon: fn,
 * }} props
 */
export default function MenuCouponsTab({ coupons, couponsAllowed = true, onEdit, onDelete, onToggleActive, onCreateCoupon }) {
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
    <div className="space-y-6">
      {!couponsAllowed && (
        <LockedFeatureCard featureKey="coupons" featureName="Cupons de desconto" />
      )}

      {/* Top Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-[2rem] border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
            <FiSearch size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className="h-11 md:h-10 w-full rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-11 pr-4 text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 focus:border-[#f97316] dark:focus:border-[#f97316] focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 placeholder-slate-400"
          />
        </div>

        {/* Buttons / Actions */}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {/* Status Selectors */}
          <div className="w-full shrink-0 sm:w-auto">
            <AnimatedSegmentedControl
              size="md"
              variant="neutral"
              fullWidthMobile={true}
              value={filter}
              onChange={setFilter}
              options={COUPON_STATUS_FILTERS.map((s) => ({
                value: s.id,
                label: s.label
              }))}
            />
          </div>

          {/* Create Button */}
          {couponsAllowed ? (
            <button
              type="button"
              onClick={onCreateCoupon}
              className="inline-flex h-11 md:h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 text-sm md:text-xs font-black text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-orange-500/40 active:translate-y-0 active:scale-95 sm:w-auto shrink-0"
            >
              <FiPlus size={15} /> Novo cupom
            </button>
          ) : (
            <Link
              to="/dashboard/billing"
              className="inline-flex h-11 md:h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-4 text-sm md:text-xs font-black text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:bg-[#ea580c] active:scale-95 sm:w-auto shrink-0"
            >
              {UPGRADE_PROMPT_COPY.primaryAction}
            </Link>
          )}
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
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="group rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 transition-all hover:shadow-md hover:border-orange-100 dark:hover:border-slate-700"
                  >
                    {/* Header: Code & Active Switch */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-[#f97316]">
                          <FiTag size={16} />
                        </div>
                        <div>
                          <p className="text-base font-black text-[#111827] dark:text-slate-50 tracking-wider">{coupon.code}</p>
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
                          disabled={!couponsAllowed && !coupon.active}
                          className="peer sr-only"
                          id={`toggle-mob-${coupon.id}`}
                        />
                        <label
                          htmlFor={`toggle-mob-${coupon.id}`}
                          className={`block h-6 w-11 rounded-full transition-colors duration-300 ${!couponsAllowed && !coupon.active ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
                            coupon.active ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-700 shadow-inner'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                              coupon.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Description */}
                    {coupon.description && (
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/30 rounded-2xl p-3 border border-gray-50 dark:border-slate-800/50">
                        {coupon.description}
                      </p>
                    )}

                    {/* Promo Values */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Desconto</p>
                        <p className="font-black text-[#111827] dark:text-slate-50 text-sm mt-0.5">
                          {coupon.type === 'percent' ? `${coupon.value}%` : formatMoney(coupon.value)}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Pedido Mínimo</p>
                        <p className="font-bold text-[#111827] dark:text-slate-50 text-sm mt-0.5">
                          {coupon.minOrder ? formatMoney(coupon.minOrder) : 'Nenhum'}
                        </p>
                      </div>
                    </div>

                    {/* Secondary rules: limit and validity */}
                    <div className="border-t border-gray-100 dark:border-slate-800 pt-3 space-y-2 text-xs">
                      {(coupon.maxDiscount || coupon.usageLimit || coupon.startsAt || coupon.expiresAt) ? (
                        <>
                          {coupon.type === 'percent' && coupon.maxDiscount && (
                            <div className="flex justify-between font-bold text-slate-500 dark:text-slate-400">
                              <span>Teto desconto:</span>
                              <span className="text-[#111827] dark:text-slate-50 font-extrabold">{formatMoney(coupon.maxDiscount)}</span>
                            </div>
                          )}
                          {coupon.usageLimit && (
                            <div className="flex justify-between font-bold text-slate-500 dark:text-slate-400">
                              <span>Usos:</span>
                              <span className="text-[#111827] dark:text-slate-50 font-extrabold">
                                {coupon.usedCount || 0} / {coupon.usageLimit}
                              </span>
                            </div>
                          )}
                          {coupon.startsAt && (
                            <div className="flex justify-between font-bold text-slate-400 text-[10px]">
                              <span>Vigência inicia:</span>
                              <span className="text-slate-600 dark:text-slate-300 font-bold">{formatDateTime(coupon.startsAt)}</span>
                            </div>
                          )}
                          {coupon.expiresAt && (
                            <div className="flex justify-between font-bold text-slate-400 text-[10px]">
                              <span>Expira em:</span>
                              <span className="text-slate-600 dark:text-slate-300 font-bold">{formatDateTime(coupon.expiresAt)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold">Sem regras adicionais ou vigência.</p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-2 border-t border-gray-100 dark:border-slate-800 pt-3">
                      <button
                        type="button"
                        onClick={() => onEdit(coupon)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 py-3 text-xs font-black text-orange-600 dark:text-orange-400 transition-all hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-95"
                      >
                        <FiEdit2 size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(coupon.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 py-3 text-xs font-black text-red-500 dark:text-red-400 transition-all hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95"
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
          <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-4 px-6">Código / Descrição</th>
                  <th className="py-4 px-4">Desconto</th>
                  <th className="py-4 px-4">Pedido Mínimo</th>
                  <th className="py-4 px-4">Vigência</th>
                  <th className="py-4 px-4">Usos</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 text-sm font-bold text-[#111827] dark:text-slate-50">
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
                        className="transition-colors group hover:bg-orange-50/30 dark:hover:bg-slate-800/50"
                      >
                        {/* Código & Descrição */}
                        <td className="py-4 px-6 max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f97316]">
                              <FiTag size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black tracking-wider text-sm">{coupon.code}</p>
                              {coupon.description && (
                                <p className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-slate-500 truncate" title={coupon.description}>
                                  {coupon.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Desconto */}
                        <td className="py-4 px-4">
                          <p className="font-extrabold text-[#111827] dark:text-slate-50">
                            {coupon.type === 'percent' ? `${coupon.value}%` : formatMoney(coupon.value)}
                          </p>
                          {coupon.type === 'percent' && coupon.maxDiscount && (
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              Teto: {formatMoney(coupon.maxDiscount)}
                            </p>
                          )}
                        </td>

                        {/* Pedido Mínimo */}
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                          {coupon.minOrder ? formatMoney(coupon.minOrder) : '—'}
                        </td>

                        {/* Vigência */}
                        <td className="py-4 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 space-y-0.5">
                          {coupon.startsAt || coupon.expiresAt ? (
                            <>
                              {coupon.startsAt && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Início:</span>
                                  <span>{formatDateTime(coupon.startsAt)}</span>
                                </div>
                              )}
                              {coupon.expiresAt && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Fim:</span>
                                  <span>{formatDateTime(coupon.expiresAt)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic font-medium">Sem expiração</span>
                          )}
                        </td>

                        {/* Usos */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-black text-[#111827] dark:text-slate-50">{coupon.usedCount || 0}</span>
                            {coupon.usageLimit ? (
                              <>
                                <span>/</span>
                                <span className="font-bold">{coupon.usageLimit}</span>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">(ilimitado)</span>
                            )}
                          </div>
                        </td>

                        {/* Status Toggle Switch */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${status.color}`}>
                              {status.label}
                            </span>
                            
                            {/* Toggle active switch */}
                            <div className="relative shrink-0">
                              <input
                                type="checkbox"
                                checked={Boolean(coupon.active)}
                                onChange={() => onToggleActive(coupon.id, coupon.active !== false)}
                                disabled={!couponsAllowed && !coupon.active}
                                className="sr-only"
                                id={`toggle-dt-${coupon.id}`}
                              />
                              <label
                                htmlFor={`toggle-dt-${coupon.id}`}
                                className={`block h-6 w-11 rounded-full transition-colors duration-300 ${!couponsAllowed && !coupon.active ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
                                  coupon.active ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-700 shadow-inner'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                                    coupon.active ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </label>
                            </div>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-80 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              title="Editar cupom"
                              onClick={() => onEdit(coupon)}
                              className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 transition-all hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-90"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              type="button"
                              title="Arquivar/Deletar cupom"
                              onClick={() => onDelete(coupon.id)}
                              className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 transition-all hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90"
                            >
                              <FiTrash2 size={14} />
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
              : couponsAllowed
                ? { label: 'Criar meu primeiro cupom', onClick: onCreateCoupon }
                : { label: UPGRADE_PROMPT_COPY.primaryAction, onClick: onCreateCoupon }
          }
        />
      )}
    </div>
  )
}
