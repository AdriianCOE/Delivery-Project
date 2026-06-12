import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import AnimatedSegmentedControl from '../../components/ui/AnimatedSegmentedControl'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import {
  FiActivity,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiMapPin,
  FiPercent,
  FiPieChart,
  FiRefreshCw,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
  FiXCircle,
  FiZap,
} from 'react-icons/fi'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import LockedFeatureCard from '../../components/billing/LockedFeatureCard'
import { hasPlanFeature } from '../../utils/planCatalog'

// ─── Constants ────────────────────────────────────────────────────────────────
const BILLING_PENDING_STATUSES = new Set([
  'checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method',
])
const OPERATIONAL_STATUSES = new Set(['trialing', 'active'])
const SELECTED_STATISTICS_STORE_KEY = 'pratoby:selected_statistics_store'

// Períodos simplificados: Hoje / 7 dias / Mês (sem redundância de "30 dias" + "Este mês")
const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today', days: 0 },
  { label: '7 dias', value: '7d', days: 7 },
  { label: 'Este mês', value: 'month', days: 'current_month' },
]

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Pure utilities ───────────────────────────────────────────────────────────
function normalizeBillingStatus(s) {
  const v = String(s || '').trim()
  return v === 'pending_checkout' ? 'checkout_pending' : v
}
function normalizeAccessRole(r) {
  const v = String(r || '').trim().toLowerCase()
  if (v === 'lojista') return 'merchant'
  if (v === 'dev') return 'developer'
  return v
}
function canLoadOperationalOrders({ role, selectedStore, userData }) {
  if (!selectedStore) return false
  const nr = normalizeAccessRole(role || userData?.role)
  if (!['merchant', 'admin', 'developer'].includes(nr)) return false
  const ss = normalizeBillingStatus(selectedStore?.subscriptionStatus)
  const us = normalizeBillingStatus(userData?.subscriptionStatus)
  if (selectedStore?.isBillingBlocked || BILLING_PENDING_STATUSES.has(ss) || BILLING_PENDING_STATUSES.has(us) || userData?.onboardingStatus === 'billing_pending') return false
  const eff = ss || us
  return OPERATIONAL_STATUSES.has(eff) || !eff
}
function normalizeStatus(status) {
  const v = String(status || 'pendente').toLowerCase().trim()
  const map = {
    pending: 'pendente',
    pending_payment: 'pendente_pagamento',
    awaiting_payment: 'pendente_pagamento',
    aguardando_pagamento: 'pendente_pagamento',
    pendente_pagamento: 'pendente_pagamento',
    confirmed: 'confirmado',
    accepted: 'confirmado',
    preparing: 'preparando',
    ready: 'pronto',
    out_for_delivery: 'entregando',
    em_rota: 'entregando',
    rota: 'entregando',
    delivered: 'entregue',
    completed: 'entregue',
    complete: 'entregue',
    finalizado: 'entregue',
    concluido: 'entregue',
    concluído: 'entregue',
    canceled: 'cancelado',
    cancelled: 'cancelado',
  }
  return map[v] || v || 'pendente'
}
function formatMoney(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmt(cents) { return formatMoney(Number(cents || 0) / 100) }

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function getOrderDate(o) {
  return toDate(o?.createdAt || o?.created_at || o?.date || o?.orderDate)
}
function getPaidDate(o) {
  return toDate(o?.payment?.paidAt || o?.paidAt || o?.paymentPaidAt || o?.payment?.confirmedAt)
}
function getScheduledDate(o) {
  return toDate(
    o?.scheduledFor ||
    o?.scheduledAt ||
    o?.schedule?.scheduledFor ||
    o?.scheduling?.scheduledFor ||
    (o?.scheduledDateKey && o?.scheduledTimeLabel ? `${o.scheduledDateKey}T${o.scheduledTimeLabel}:00` : null) ||
    (o?.scheduledDate && o?.scheduledTime ? `${o.scheduledDate}T${o.scheduledTime}:00` : null)
  )
}
function getMetricDate(o) {
  return getPaidDate(o) || getOrderDate(o)
}
function getPhone(o) { return o?.customerPhone || o?.customer?.phone || o?.phone || '' }

function normalizePaymentStatus(order) {
  return String(order?.payment?.status || order?.paymentStatus || order?.asaasPaymentStatus || '')
    .toLowerCase()
    .trim()
}

function isOnlinePayment(order) {
  const mode = String(order?.payment?.mode || order?.paymentMode || '').toLowerCase()
  const provider = String(order?.payment?.provider || order?.paymentProvider || '').toLowerCase()
  return mode === 'online' || provider === 'asaas' || Boolean(order?.payment?.asaasPaymentId || order?.asaasPaymentId)
}

function isPaidOrder(order) {
  const paymentStatus = normalizePaymentStatus(order)
  return Boolean(
    order?.isPaid ||
    order?.paid ||
    paymentStatus === 'paid' ||
    paymentStatus === 'pago' ||
    paymentStatus === 'received' ||
    paymentStatus === 'confirmed' ||
    paymentStatus === 'payment_confirmed' ||
    paymentStatus === 'payment_received'
  )
}

function isPaymentPending(order) {
  const paymentStatus = normalizePaymentStatus(order)
  return Boolean(
    isOnlinePayment(order) &&
    !isPaidOrder(order) &&
    !isCanceled(order) &&
    ['pending', 'created', 'checkout_pending', 'aguardando_pagamento', 'pendente', ''].includes(paymentStatus)
  )
}

function getPayMethod(o) {
  if (isOnlinePayment(o)) return 'online'

  const r = String(o?.payment?.method || o?.paymentMethod || o?.paymentType || o?.payment?.label || '').toLowerCase()
  if (r.includes('pix')) return 'pix'
  if (r.includes('dinheiro') || r.includes('cash')) return 'cash'
  if (r.includes('débito') || r.includes('debito') || r.includes('debit')) return 'debit'
  if (r.includes('crédito') || r.includes('credito') || r.includes('credit')) return 'credit'
  if (r.includes('cart') || r.includes('card') || r.includes('maquininha')) return 'card'
  return 'other'
}

function getPaymentGroup(o) {
  const method = getPayMethod(o)
  if (method === 'online') return 'online'
  if (method === 'pix') return 'pix'
  if (method === 'cash') return 'cash'
  if (['credit', 'debit', 'card'].includes(method)) return 'card'
  return 'other'
}
function getTotalCents(o) {
  const paymentGross = o?.payment?.grossAmountCents
  if (paymentGross != null && Number.isFinite(Number(paymentGross))) return Number(paymentGross)
  return o?.totalCents != null ? Number(o.totalCents) : Math.round(Number(o?.total || o?.totalAmount || o?.amount || 0) * 100)
}
function getDeliveryCents(o) {
  const cents = o?.deliveryFeeCents ?? o?.delivery?.feeCents
  if (cents != null) return Number(cents) || 0
  const v = o?.deliveryFee ?? o?.delivery?.fee
  return Math.round(Number(v || 0) * 100)
}
function getDiscountCents(o) {
  const cents = o?.discountCents ?? o?.couponDiscountCents ?? o?.discount?.amountCents ?? o?.discount?.valueCents
  if (cents != null) return Number(cents) || 0
  const v = o?.discount ?? o?.discountAmount ?? o?.couponDiscount ?? o?.discount?.amount
  return Math.round(Number(v || 0) * 100)
}
function getNeighborhood(o) {
  const v = o?.neighborhood || o?.deliveryNeighborhood || o?.customer?.neighborhood || o?.delivery?.neighborhood || o?.address?.neighborhood || o?.customerAddress?.neighborhood || ''
  return String(v).trim() || 'Não informado'
}
function getItems(o) { return Array.isArray(o?.items) ? o.items : [] }
function isCompleted(o) { return normalizeStatus(o?.status) === 'entregue' }
function isCanceled(o) { return normalizeStatus(o?.status) === 'cancelado' }
function isRevenueOrder(o) {
  if (isCanceled(o)) return false
  return isCompleted(o) || isPaidOrder(o)
}
function isScheduledOrder(o) {
  return Boolean(
    o?.orderTiming === 'scheduled' ||
    o?.scheduledFor ||
    o?.scheduledAt ||
    o?.scheduledDate ||
    o?.scheduledDateKey ||
    o?.scheduledTime ||
    o?.schedule?.scheduledFor ||
    o?.scheduling?.scheduledFor
  )
}
function isCounterOrder(o) {
  const raw = String(o?.source || o?.channel || o?.orderType || o?.type || o?.fulfillmentType || o?.deliveryType || '').toLowerCase()
  return Boolean(
    o?.isCounterOrder ||
    raw.includes('counter') ||
    raw.includes('balcao') ||
    raw.includes('balcão')
  )
}
function isTableOrder(o) {
  const raw = String(o?.source || o?.channel || o?.orderType || o?.type || o?.fulfillmentType || o?.deliveryType || '').toLowerCase()
  return Boolean(
    o?.isTableOrder ||
    o?.tableId ||
    o?.tableToken ||
    o?.tableNumber ||
    o?.tableLabel ||
    raw === 'table_qr' ||
    raw.includes('mesa') ||
    raw.includes('table') ||
    raw.includes('dine_in') ||
    raw.includes('dine-in') ||
    raw.includes('consumo_local')
  )
}
function getFulfillmentType(o) {
  if (isCounterOrder(o)) return 'counter'
  if (isTableOrder(o)) return 'table'
  const raw = String(o?.fulfillmentType || o?.deliveryType || o?.orderType || o?.type || '').toLowerCase()
  if (raw.includes('balcao') || raw.includes('balcão') || raw.includes('counter')) return 'counter'
  if (raw.includes('retirada') || raw.includes('pickup') || raw.includes('takeout')) return 'pickup'
  if (o?.isPickup || o?.pickup) return 'pickup'
  if (o?.isDelivery === false || o?.acceptDelivery === false) return 'pickup'
  return 'delivery'
}
function getDeliveryDuration(o) {
  const created = getOrderDate(o)
  if (!created) return null
  const h = (o?.statusHistory || []).find(x => ['entregue', 'finalizado', 'concluido', 'concluído', 'delivered'].includes(String(x.status || '').toLowerCase()))
  let delivered = null
  if (h?.timestamp) delivered = toDate(h.timestamp)
  else if (o?.deliveredAt) delivered = toDate(o.deliveredAt)
  else if (o?.completedAt) delivered = toDate(o.completedAt)
  else if (o?.updatedAt && normalizeStatus(o.status) === 'entregue') delivered = toDate(o.updatedAt)
  if (delivered && !Number.isNaN(delivered.getTime())) {
    const m = Math.round((delivered - created) / 60000)
    if (m > 0 && m < 600) return m
  }
  return null
}
function safeLS(key) { try { return localStorage.getItem(key) || '' } catch { return '' } }
function setLS(key, v) { try { localStorage.setItem(key, v) } catch { /* noop */ } }
function normalizeStoreDoc(snap) {
  const d = snap.data() || {}
  return { ...d, id: snap.id, storeId: d.storeId || snap.id, storeSlug: d.storeSlug || d.slug || '', slug: d.slug || d.storeSlug || '' }
}
function storeKeys(s) { return [s?.id, s?.storeId, s?.storeSlug, s?.slug].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i) }

function getCutoff(period) {
  if (period.days === 0) return new Date().setHours(0, 0, 0, 0)
  if (period.days === 'current_month') return new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  return Date.now() - period.days * 86400000
}
function getPrevRange(period) {
  const now = Date.now()
  if (period.days === 0) {
    const y = new Date(); y.setDate(y.getDate() - 1)
    return { start: y.setHours(0, 0, 0, 0), end: new Date().setHours(0, 0, 0, 0) }
  }
  if (period.days === 'current_month') {
    const n = new Date()
    return { start: new Date(n.getFullYear(), n.getMonth() - 1, 1).getTime(), end: new Date(n.getFullYear(), n.getMonth(), 1).getTime() }
  }
  const ms = period.days * 86400000
  return { start: now - 2 * ms, end: now - ms }
}
function delta(cur, prev) { return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null }
function kpisFrom(orders) {
  const canceled = orders.filter(isCanceled)
  const revenueOrders = orders.filter(isRevenueOrder)
  const revenue = revenueOrders.reduce((s, o) => s + getTotalCents(o), 0)
  return {
    revenue,
    valid: orders.filter(o => !isCanceled(o)).length,
    canceled: canceled.length,
    completed: orders.filter(isCompleted).length,
    ticket: revenueOrders.length > 0 ? revenue / revenueOrders.length : 0,
  }
}

function getOrderId(o) { return o?.orderNumber || o?.shortId || o?.id || '' }
function getCustomerName(o) { return o?.customerName || o?.customer?.name || o?.clientName || o?.name || '' }
function getCouponCode(o) { return String(o?.couponCode || o?.coupon?.code || o?.coupon?.couponCode || o?.discountCoupon || o?.counterCouponCode || '').trim() }
function getOrderTimingLabel(o) { return isScheduledOrder(o) ? 'agendado' : 'agora' }
function getScheduledLabel(o) {
  const d = getScheduledDate(o)
  if (d) return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return o?.scheduledTimeLabel || o?.scheduledTime || ''
}
function getFulfillmentLabel(o) {
  const labels = { delivery: 'Delivery', pickup: 'Retirada', counter: 'Balcão', table: 'Mesa / Atendimento local' }
  return labels[getFulfillmentType(o)] || 'Outro'
}
function getPaymentLabel(o) {
  const labels = { online: 'Pagamento online', pix: 'Pix manual', cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', card: 'Maquininha', other: 'Outro' }
  return labels[getPayMethod(o)] || 'Outro'
}
function getItemsText(o) {
  return getItems(o).map(item => {
    const qty = Number(item.quantity || item.qty || 1)
    const name = item.name || item.productName || 'Produto'
    return `${qty}x ${name}`
  }).join(' | ')
}
function makeFileSafe(value) {
  return String(value || 'loja')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'loja'
}
function csvCell(value) {
  const text = value == null ? '' : String(value)
  const escaped = text.replace(/"/g, '""')
  return /[;"\r\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function buildCsv(headers, rows) {
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(';'))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function KpiCard({ icon: Icon, label, value, sub, tone = 'green', delta: d, highlight = false }) {
  const tones = {
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-[#f97316]',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
  }
  const hasDelta = d !== null && d !== undefined
  const pos = hasDelta && d >= 0
  return (
    <div className={`group relative rounded-2xl border bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md min-w-0 overflow-hidden ${highlight ? 'border-orange-200 dark:border-orange-800/60 ring-1 ring-orange-100 dark:ring-orange-900/40' : 'border-zinc-100 dark:border-zinc-800 hover:shadow-zinc-200/60 dark:hover:shadow-zinc-900/60'}`}>
      {highlight && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#f97316] to-[#fb923c] rounded-t-2xl" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 truncate">{label}</p>
          <p className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">{sub}</p>}
          {hasDelta && (
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${pos ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'}`}>
              {pos ? <FiTrendingUp size={10} /> : <FiTrendingDown size={10} />}
              {pos ? '+' : ''}{d}% vs anterior
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function Card({ title, description, icon: Icon, iconTone = 'orange', children, fullWidth = false, className = '', headerRight }) {
  const tones = {
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-[#f97316]',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  }
  return (
    <div className={`rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col ${fullWidth ? 'lg:col-span-2' : ''} ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[iconTone]}`}>
                <Icon size={15} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-50 leading-tight truncate">{title}</h2>
              {description && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{description}</p>}
            </div>
          </div>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      <div className="p-5 flex-1 flex flex-col gap-0">{children}</div>
    </div>
  )
}

function HBar({ label, value, total, color = 'bg-[#f97316]', rank, sub }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {rank !== undefined && <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 w-4 shrink-0 text-right">{rank}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="min-w-0">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate block">{label}</span>
            {sub && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{sub}</span>}
          </div>
          <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 shrink-0 ml-2">{value}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 w-7 shrink-0 text-right">{pct}%</span>
    </div>
  )
}

function Empty({ icon: Icon = FiPieChart, title = 'Sem dados neste período', description }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-3">
        <Icon size={22} />
      </div>
      <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">{title}</p>
      {description && <p className="mt-1 max-w-[260px] text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">{description}</p>}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1,2,3,4].map(i => <div key={i} className="h-56 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />)}
      </div>
    </div>
  )
}

// Daily/hourly bar chart
function RevenueChart({ series, mode = 'revenue' }) {
  if (!series?.length) return <Empty icon={FiBarChart2} title="Sem dados" description="Nenhum pedido no período." />
  const isOrdersMode = mode === 'orders'
  const max = Math.max(...series.map(d => isOrdersMode ? Number(d.orders || 0) : Number(d.revenueCents || 0)), 1)
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <div className="flex items-end gap-1 h-24 min-w-[280px]">
        {series.map(({ label, revenueCents, orders }) => {
          const value = isOrdersMode ? Number(orders || 0) : Number(revenueCents || 0)
          const pct = value > 0 ? Math.max((value / max) * 100, 5) : 0
          return (
            <div key={label} className="group relative flex flex-1 flex-col items-center gap-1 min-w-[20px]">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center rounded-lg bg-zinc-900 dark:bg-zinc-700 px-2 py-1.5 text-[9px] font-black text-white whitespace-nowrap z-20 shadow-xl gap-0.5">
                <span>{isOrdersMode ? `${orders} ped.` : fmt(revenueCents)}</span>
                <span className="opacity-70 font-medium">{isOrdersMode ? fmt(revenueCents) : `${orders} ped.`}</span>
              </div>
              <div className={`w-full rounded-t-sm transition-all duration-500 ${value > 0 ? 'bg-[#f97316] hover:bg-[#ea580c] cursor-default' : 'bg-zinc-100 dark:bg-zinc-800'}`} style={{ height: `${pct}%` }} />
              <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-600 truncate w-full text-center leading-tight">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 24h heatmap columns
function PeakChart({ peakHours, max }) {
  const visible = peakHours.map((c, h) => ({ c, h })).filter(({ c, h }) => c > 0 || (h >= 7 && h <= 23))
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <div className="flex items-end gap-0.5 h-20 min-w-[280px]">
        {visible.map(({ c, h }) => {
          const pct = c > 0 ? Math.max((c / Math.max(max, 1)) * 100, 6) : 0
          return (
            <div key={h} className="group relative flex flex-1 flex-col items-center gap-1 min-w-[14px]">
              {c > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex rounded bg-zinc-900 dark:bg-zinc-700 px-1.5 py-0.5 text-[9px] font-black text-white whitespace-nowrap z-20">
                  {c}×
                </div>
              )}
              <div className={`w-full rounded-t-sm transition-all duration-500 ${c > 0 ? 'bg-[#f97316]/80 hover:bg-[#f97316]' : 'bg-zinc-100 dark:bg-zinc-800'}`} style={{ height: `${pct}%` }} />
              <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-600">{h}h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Day-of-week heatmap (new feature)
function WeekdayHeatmap({ weekdays }) {
  const max = Math.max(...weekdays, 1)
  const intensities = ['bg-zinc-100 dark:bg-zinc-800', 'bg-orange-100 dark:bg-orange-900/30', 'bg-orange-200 dark:bg-orange-800/40', 'bg-orange-300 dark:bg-orange-700/60', 'bg-[#f97316]/70', 'bg-[#f97316]']
  return (
    <div className="grid grid-cols-7 gap-1.5 mt-1">
      {WEEKDAYS_PT.map((day, i) => {
        const count = weekdays[i] || 0
        const level = count === 0 ? 0 : Math.ceil((count / max) * (intensities.length - 1))
        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <div className={`w-full aspect-square rounded-lg transition-colors ${intensities[level]}`} title={`${day}: ${count} pedidos`} />
            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600">{day}</span>
          </div>
        )
      })}
    </div>
  )
}

// Insight row
function Insight({ icon: Icon, text, tone = 'orange' }) {
  const tones = {
    orange: 'text-[#f97316] bg-orange-50 dark:bg-orange-500/10',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10',
  }
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={13} />
      </div>
      <p className="text-xs font-semibold leading-5 text-zinc-700 dark:text-zinc-300">{text}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Statistics() {
  const { user, userData, role, loading: authLoading, storeId: authStoreId, storeIds: authStoreIds = [] } = useAuth()

  const knownStoreIds = useMemo(() => {
    const raw = [authStoreId, ...(Array.isArray(authStoreIds) ? authStoreIds : []), user?.storeId, ...(Array.isArray(user?.storeIds) ? user.storeIds : [])]
    return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 10)
  }, [authStoreId, authStoreIds, user])

  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [periodValue, setPeriodValue] = useState('7d')
  const [bairrosTab, setBairrosTab] = useState('orders')
  const [showAllBairros, setShowAllBairros] = useState(false)
  const [chartMode, setChartMode] = useState('revenue') // 'revenue' | 'orders'
  const [lastUpdated, setLastUpdated] = useState(null)
  const [_refreshNonce, setRefreshNonce] = useState(0)

  const period = PERIOD_OPTIONS.find(p => p.value === periodValue) || PERIOD_OPTIONS[1]

  const selectedStore = useMemo(() => {
    if (!stores.length) return null
    return stores.find(s => storeKeys(s).includes(selectedStoreId)) || stores[0] || null
  }, [selectedStoreId, stores])

  const canRead = canLoadOperationalOrders({ role, selectedStore, userData })

  // ── Store listeners (one per known storeId)
  useEffect(() => {
    let cancelled = false
    const scheduleState = (callback) => {
      queueMicrotask(() => {
        if (!cancelled) callback()
      })
    }

    if (!user?.uid || !knownStoreIds.length) {
      scheduleState(() => { setStores([]); setOrders([]); setLoading(false) })
      return () => { cancelled = true }
    }

    scheduleState(() => setLoading(true))
    const map = new Map()
    const unsubs = []
    function publish() {
      const s = Array.from(map.values()).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      setStores(s)
      if (!s.length) { setOrders([]); setLoading(false) }
    }
    knownStoreIds.forEach(id => {
      if (!id) return
      const u = onSnapshot(doc(db, 'stores', id), snap => {
        snap.exists() ? map.set(snap.id, normalizeStoreDoc(snap)) : map.delete(id)
        publish()
      }, err => { console.error('[Stats] store err', err); publish() })
      unsubs.push(u)
    })
    if (!unsubs.length) {
      scheduleState(() => { setStores([]); setOrders([]); setLoading(false) })
    }
    return () => {
      cancelled = true
      unsubs.forEach(u => u())
    }
  }, [user?.uid, knownStoreIds])

  // ── Auto-select store
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!stores.length) { setSelectedStoreId(''); return }
      setSelectedStoreId(cur => {
        if (stores.some(s => storeKeys(s).includes(cur))) return cur
        const saved = safeLS(SELECTED_STATISTICS_STORE_KEY)
        if (stores.some(s => storeKeys(s).includes(saved))) return saved
        return storeKeys(stores[0])[0] || stores[0].id
      })
    })

    return () => { cancelled = true }
  }, [stores])

  // ── Orders load (62-day window so prev-period comparison works)
  useEffect(() => {
    let mounted = true
    const scheduleState = (callback) => {
      queueMicrotask(() => {
        if (mounted) callback()
      })
    }

    if (authLoading) {
      scheduleState(() => { setOrders([]); setLoading(true) })
      return () => { mounted = false }
    }
    if (!selectedStore || !canRead) {
      scheduleState(() => { setOrders([]); setLoading(false) })
      return () => { mounted = false }
    }

    const idKeys = [selectedStore?.id, selectedStore?.storeId, selectedStore?.storeDocId].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10)
    const slugKeys = [selectedStore?.storeSlug, selectedStore?.slug].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i && !idKeys.includes(v)).slice(0, 10)
    if (!idKeys.length) {
      scheduleState(() => { setOrders([]); setLoading(false) })
      return () => { mounted = false }
    }

    scheduleState(() => setLoading(true))
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 62 * 86400000))

    async function loadOrders() {
      const map = new Map()

      try {
        const idSnap = await getDocs(query(collection(db, 'orders'), where('storeId', 'in', idKeys), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')))
        idSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }))

        if (slugKeys.length) {
          try {
            const slugSnap = await getDocs(query(collection(db, 'orders'), where('storeSlug', 'in', slugKeys), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')))
            slugSnap.docs.forEach(d => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() }) })
          } catch (e) {
            if (e?.code !== 'permission-denied') console.warn('[Stats] slug fallback', e.message)
          }
        }
      } catch (e) {
        if (e?.code !== 'permission-denied') console.error('[Stats] orders err', e)

        if (slugKeys.length) {
          try {
            const slugSnap = await getDocs(query(collection(db, 'orders'), where('storeSlug', 'in', slugKeys), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')))
            slugSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
          } catch (slugError) {
            if (slugError?.code !== 'permission-denied') console.warn('[Stats] slug fallback after id query error', slugError.message)
          }
        }
      }

      if (!mounted) return
      const data = Array.from(map.values()).sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0))
      setOrders(data)
      setLastUpdated(new Date())
      setLoading(false)
    }

    void loadOrders()

    return () => { mounted = false }
  }, [authLoading, canRead, selectedStore, _refreshNonce])

  const handleRefresh = useCallback(() => { setRefreshNonce((value) => value + 1); setOrders([]); setLoading(true) }, [])

  // ── Computed analytics
  const data = useMemo(() => {
    const cutoff = getCutoff(period)
    const { start: ps, end: pe } = getPrevRange(period)

    const cur = orders.filter(o => { const d = getOrderDate(o); return d ? d.getTime() >= cutoff : false })
    const prev = orders.filter(o => { const d = getOrderDate(o); return d ? d.getTime() >= ps && d.getTime() < pe : false })

    const canceled = cur.filter(isCanceled)
    const valid = cur.filter(o => !isCanceled(o))
    const completed = cur.filter(isCompleted)
    const revenueOrders = cur.filter(isRevenueOrder)

    const revenueCents = revenueOrders.reduce((s, o) => s + getTotalCents(o), 0)
    const totalOrders = valid.length
    const canceledCount = canceled.length
    const ticket = revenueOrders.length > 0 ? revenueCents / revenueOrders.length : 0

    const pk = kpisFrom(prev)
    const revDelta = delta(revenueCents, pk.revenue)
    const ordDelta = delta(totalOrders, pk.valid)
    const tikDelta = delta(ticket, pk.ticket)

    // Unique customers
    const phones = new Set(valid.map(getPhone).filter(Boolean))
    const totalCustomers = phones.size
    const recurrence = totalOrders > 0 && totalCustomers > 0 ? Math.max(0, Math.round(((totalOrders - totalCustomers) / totalOrders) * 100)) : 0

    // Newer PratoBy dimensions: online payment, balcão, agendamento and pickup/delivery.
    const payments = { online: 0, pix: 0, card: 0, cash: 0, other: 0 }
    const paymentRevenueCents = { online: 0, pix: 0, card: 0, cash: 0, other: 0 }
    const delTypes = { delivery: 0, pickup: 0, counter: 0, table: 0 }
    const channelRevenueCents = { delivery: 0, pickup: 0, counter: 0, table: 0 }
    const paymentStatusCounts = { paid: 0, pending: 0, refunded: 0, chargeback: 0, failed: 0 }
    const peakH = Array(24).fill(0)
    const timeB = { manhã: 0, tarde: 0, noite: 0, madrugada: 0 }
    const weekdays = Array(7).fill(0)

    let scheduledCount = 0
    let scheduledCompleted = 0
    let scheduledRevenueCents = 0
    let counterCount = 0
    let counterRevenueCents = 0
    let onlineCount = 0
    let onlinePaidCount = 0
    let onlinePendingCount = 0
    let pixManualCount = 0

    let delivSum = 0, delivCnt = 0
    completed.forEach(o => { const m = getDeliveryDuration(o); if (m !== null) { delivSum += m; delivCnt++ } })
    const avgDelivery = delivCnt > 0 ? Math.round(delivSum / delivCnt) : null

    valid.forEach(o => {
      const m = getPayMethod(o)
      const paymentGroup = getPaymentGroup(o)
      payments[paymentGroup] = (payments[paymentGroup] || 0) + 1

      if (isOnlinePayment(o)) {
        onlineCount++
        if (isPaidOrder(o)) onlinePaidCount++
        if (isPaymentPending(o)) onlinePendingCount++
      } else if (m === 'pix') {
        pixManualCount++
      }

      const ps = normalizePaymentStatus(o)
      if (isPaidOrder(o)) paymentStatusCounts.paid++
      else if (isPaymentPending(o)) paymentStatusCounts.pending++
      else if (ps.includes('refund')) paymentStatusCounts.refunded++
      else if (ps.includes('chargeback')) paymentStatusCounts.chargeback++
      else if (ps.includes('failed') || ps.includes('refused') || ps.includes('denied')) paymentStatusCounts.failed++

      const fulfillment = getFulfillmentType(o)
      delTypes[fulfillment] = (delTypes[fulfillment] || 0) + 1

      if (isRevenueOrder(o)) {
        const total = getTotalCents(o)
        paymentRevenueCents[paymentGroup] = (paymentRevenueCents[paymentGroup] || 0) + total
        channelRevenueCents[fulfillment] = (channelRevenueCents[fulfillment] || 0) + total
      }

      if (isScheduledOrder(o)) {
        scheduledCount++
        if (isCompleted(o)) scheduledCompleted++
        if (isRevenueOrder(o)) scheduledRevenueCents += getTotalCents(o)
      }

      if (isCounterOrder(o)) {
        counterCount++
        if (isRevenueOrder(o)) counterRevenueCents += getTotalCents(o)
      }

      const d = getOrderDate(o)
      if (d) {
        const hr = d.getHours()
        peakH[hr]++
        weekdays[d.getDay()]++
        if (hr >= 6 && hr < 12) timeB.manhã++
        else if (hr >= 12 && hr < 18) timeB.tarde++
        else if (hr >= 18 && hr < 24) timeB.noite++
        else timeB.madrugada++
      }
    })

    const maxPeak = Math.max(...peakH, 1)
    const peakHourIdx = peakH.indexOf(Math.max(...peakH))
    const bestWeekday = weekdays.indexOf(Math.max(...weekdays))

    // Neighborhoods only make sense for delivery. Pickup/counter stays out of the regional ranking.
    const nbMap = new Map()
    cur.forEach(o => {
      if (getFulfillmentType(o) !== 'delivery') return
      const nb = getNeighborhood(o)
      const p = nbMap.get(nb) || { neighborhood: nb, ordersCount: 0, completedCount: 0, revenueCents: 0, feeSumCents: 0, feeCnt: 0 }
      if (!isCanceled(o)) p.ordersCount++
      if (isRevenueOrder(o)) { p.completedCount++; p.revenueCents += getTotalCents(o) }
      const fee = getDeliveryCents(o)
      if (fee > 0) { p.feeSumCents += fee; p.feeCnt++ }
      nbMap.set(nb, p)
    })
    const nbList = Array.from(nbMap.values()).map(n => ({
      ...n,
      ticketCents: n.completedCount > 0 ? n.revenueCents / n.completedCount : 0,
      avgFeeCents: n.feeCnt > 0 ? n.feeSumCents / n.feeCnt : 0,
      pct: totalOrders > 0 ? Math.round((n.ordersCount / totalOrders) * 100) : 0,
    }))
    const nbByOrders = [...nbList].filter(n => n.ordersCount > 0).sort((a, b) => b.ordersCount - a.ordersCount)
    const nbByRevenue = [...nbList].filter(n => n.revenueCents > 0).sort((a, b) => b.revenueCents - a.revenueCents)

    // Products
    const prodMap = new Map()
    revenueOrders.forEach(o => getItems(o).forEach(item => {
      const id = item.productId || item.id || item.name || 'Produto'
      const name = item.name || item.productName || 'Produto'
      const qty = Number(item.quantity || item.qty || 1)
      const pc = item.priceCents != null ? Number(item.priceCents) : Math.round(Number(item.price || 0) * 100)
      const rc = item.totalCents != null ? Number(item.totalCents) : item.subtotalCents != null ? Number(item.subtotalCents) : qty * pc
      const p = prodMap.get(id) || { name, qty: 0, revenueCents: 0, ordersCount: 0 }
      prodMap.set(id, { name, qty: p.qty + qty, revenueCents: p.revenueCents + rc, ordersCount: p.ordersCount + 1 })
    }))
    const topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty)

    // Top customers (by order count, keyed by phone)
    const custMap = new Map()
    valid.forEach(o => {
      const ph = getPhone(o)
      if (!ph) return
      const name = o?.customerName || o?.customer?.name || o?.clientName || ''
      const p = custMap.get(ph) || { phone: ph, name, orders: 0, revenueCents: 0 }
      p.orders++; if (isRevenueOrder(o)) p.revenueCents += getTotalCents(o)
      if (!p.name && name) p.name = name
      custMap.set(ph, p)
    })
    const topCustomers = Array.from(custMap.values()).sort((a, b) => b.orders - a.orders).slice(0, 5)

    // Status executivo para lojista: menos operacional, mais decisão.
    const statusSummary = { completed: 0, canceled: 0, scheduled: 0, paymentPending: 0, ongoing: 0 }
    cur.forEach(o => {
      if (isCompleted(o)) statusSummary.completed++
      else if (isCanceled(o)) statusSummary.canceled++
      else if (isPaymentPending(o)) statusSummary.paymentPending++
      else statusSummary.ongoing++

      if (isScheduledOrder(o)) statusSummary.scheduled++
    })

    // Coupons
    const couponMap = new Map()
    let couponOrders = 0, discountCents = 0
    valid.forEach(o => {
      const code = o.couponCode || o.coupon?.code || o.coupon?.couponCode || o.discountCoupon || o.counterCouponCode || ''
      const disc = getDiscountCents(o)
      if (code && String(code).trim()) {
        const c = String(code).trim().toUpperCase()
        const p = couponMap.get(c) || { code: c, count: 0, discountCents: 0 }
        p.count++; p.discountCents += disc; couponMap.set(c, p)
        couponOrders++; discountCents += disc
      } else if (disc > 0) { discountCents += disc }
    })
    const topCoupon = Array.from(couponMap.values()).sort((a, b) => b.count - a.count)[0] || null

    // Daily / hourly series uses revenue orders, so paid online and counter sales count even if status is not "entregue".
    const dayMap = new Map()
    cur.forEach(o => {
      if (isCanceled(o)) return
      const d = getMetricDate(o); if (!d) return
      let key
      let sortKey
      if (period.days === 0) {
        key = `${d.getHours()}h`
        sortKey = d.getHours()
      } else {
        key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
        const dayStart = new Date(d)
        dayStart.setHours(0, 0, 0, 0)
        sortKey = dayStart.getTime()
      }
      const p = dayMap.get(key) || { label: key, sortKey, revenueCents: 0, orders: 0 }
      if (isRevenueOrder(o)) p.revenueCents += getTotalCents(o)
      p.orders++
      dayMap.set(key, p)
    })
    const dailySeries = Array.from(dayMap.values()).sort((a, b) => a.sortKey - b.sortKey)

    // Best day
    const bestDay = dailySeries.reduce((best, d) => (!best || d.revenueCents > best.revenueCents) ? d : best, null)

    const cancelRate = cur.length > 0 ? Math.round((canceledCount / cur.length) * 100) : 0
    const onlinePaidRate = onlineCount > 0 ? Math.round((onlinePaidCount / onlineCount) * 100) : null

    // Insights
    const insights = []
    const peakBlock = Object.entries(timeB).sort((a, b) => b[1] - a[1])[0]
    if (peakBlock?.[1] > 0) insights.push({ icon: FiClock, tone: 'orange', text: `Horário de pico: ${peakHourIdx}h. Turno mais movimentado: ${peakBlock[0]}.` })
    if (ticket > 0) insights.push({ icon: FiDollarSign, tone: 'green', text: `Ticket médio de ${fmt(ticket)} sobre ${revenueOrders.length} pedido${revenueOrders.length !== 1 ? 's' : ''} pago${revenueOrders.length !== 1 ? 's' : ''}/concluído${revenueOrders.length !== 1 ? 's' : ''}.` })
    if (cancelRate >= 10) insights.push({ icon: FiXCircle, tone: 'red', text: `Taxa de cancelamento em ${cancelRate}% — acima do ideal. Revise tempos de preparo e confirmação.` })
    if (topProducts[0]) insights.push({ icon: FiShoppingBag, tone: 'blue', text: `Produto estrela: "${topProducts[0].name}" com ${topProducts[0].qty} un. vendidas e ${fmt(topProducts[0].revenueCents)} em receita.` })
    if (scheduledCount > 0) insights.push({ icon: FiCalendar, tone: 'amber', text: `${scheduledCount} pedido${scheduledCount !== 1 ? 's' : ''} agendado${scheduledCount !== 1 ? 's' : ''} no período, com ${fmt(scheduledRevenueCents)} em receita.` })
    if (counterCount > 0) insights.push({ icon: FiShoppingBag, tone: 'purple', text: `${counterCount} pedido${counterCount !== 1 ? 's' : ''} de balcão registrado${counterCount !== 1 ? 's' : ''} (${fmt(counterRevenueCents)}).` })
    if (onlineCount > 0) insights.push({ icon: FiCreditCard, tone: onlinePendingCount > 0 ? 'red' : 'green', text: `Pagamento online: ${onlinePaidCount}/${onlineCount} pagamento${onlineCount !== 1 ? 's' : ''} confirmado${onlinePaidCount !== 1 ? 's' : ''}${onlinePendingCount > 0 ? `, ${onlinePendingCount} pendente${onlinePendingCount !== 1 ? 's' : ''}.` : '.'}` })
    if (recurrence > 20) insights.push({ icon: FiUsers, tone: 'amber', text: `${recurrence}% dos pedidos são de clientes recorrentes — excelente fidelização!` })
    if (topCoupon) insights.push({ icon: FiTag, tone: 'purple', text: `Cupom mais ativo: "${topCoupon.code}" usado ${topCoupon.count}× (${fmt(topCoupon.discountCents)} em descontos concedidos).` })
    if (bestDay && dailySeries.length > 1) insights.push({ icon: FiStar, tone: 'green', text: `Melhor dia: ${bestDay.label} com ${fmt(bestDay.revenueCents)} em faturamento e ${bestDay.orders} pedido${bestDay.orders !== 1 ? 's' : ''}.` })
    if (bestWeekday >= 0 && weekdays[bestWeekday] > 0) insights.push({ icon: FiActivity, tone: 'blue', text: `${WEEKDAYS_PT[bestWeekday]}feira é o dia da semana com mais pedidos (${weekdays[bestWeekday]}× no período).` })

    return {
      cur, canceledCount, cancelRate, totalOrders, revenueCents, revDelta, ordDelta, tikDelta,
      ticket, totalCustomers, recurrence, avgDelivery,
      completedCount: completed.length,
      revenueOrdersCount: revenueOrders.length,
      payments, paymentRevenueCents, delTypes, channelRevenueCents, paymentStatusCounts,
      scheduledCount, scheduledCompleted, scheduledRevenueCents,
      counterCount, counterRevenueCents,
      onlineCount, onlinePaidCount, onlinePendingCount, onlinePaidRate, pixManualCount,
      peakH, maxPeak, peakHourIdx, timeB, weekdays, bestWeekday,
      nbByOrders, nbByRevenue, topProducts, topCustomers,
      statusSummary, couponOrders, discountCents, topCoupon, dailySeries, bestDay, insights,
    }
  }, [orders, period])

  const activeBairros = bairrosTab === 'orders' ? data.nbByOrders : data.nbByRevenue
  const displayedBairros = showAllBairros ? activeBairros : activeBairros.slice(0, 5)
  const storeName = selectedStore?.name || selectedStore?.storeName || null
  const advancedReportsAllowed = hasPlanFeature(selectedStore || {}, 'advancedReports')

  const handleExportCsv = useCallback((type) => {
    const storeSlug = makeFileSafe(storeName || selectedStoreId || 'loja')
    const periodSlug = makeFileSafe(period.label)
    const baseName = `pratoby-${type}-${periodSlug}-${storeSlug}.csv`

    if (type === 'pedidos') {
      const headers = ['id', 'dataCriacao', 'status', 'canal', 'tipoPedido', 'agendadoPara', 'pagamentoMetodo', 'pagamentoStatus', 'clienteNome', 'clienteTelefone', 'bairro', 'cupom', 'desconto', 'taxaEntrega', 'total', 'itens']
      const rows = data.cur.map(order => [
        getOrderId(order),
        getOrderDate(order)?.toLocaleString('pt-BR') || '',
        normalizeStatus(order?.status),
        getFulfillmentLabel(order),
        getOrderTimingLabel(order),
        getScheduledLabel(order),
        getPaymentLabel(order),
        normalizePaymentStatus(order),
        getCustomerName(order),
        getPhone(order),
        getFulfillmentType(order) === 'delivery' ? getNeighborhood(order) : '',
        getCouponCode(order),
        fmt(getDiscountCents(order)),
        fmt(getDeliveryCents(order)),
        fmt(getTotalCents(order)),
        getItemsText(order),
      ])
      downloadCsv(baseName, buildCsv(headers, rows))
      return
    }

    if (type === 'produtos') {
      const headers = ['produto', 'quantidadeVendida', 'pedidos', 'receita']
      const rows = data.topProducts.map(product => [product.name, product.qty, product.ordersCount, fmt(product.revenueCents)])
      downloadCsv(baseName, buildCsv(headers, rows))
      return
    }

    if (type === 'bairros') {
      const headers = ['bairro', 'pedidos', 'pedidosConcluidos', 'receita', 'ticketMedio', 'taxaEntregaMedia', 'percentualPedidos']
      const rows = data.nbByOrders.map(item => [
        item.neighborhood,
        item.ordersCount,
        item.completedCount,
        fmt(item.revenueCents),
        fmt(item.ticketCents),
        fmt(item.avgFeeCents),
        `${item.pct}%`,
      ])
      downloadCsv(baseName, buildCsv(headers, rows))
    }
  }, [data, period.label, selectedStoreId, storeName])

  return (
    <main className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen">
      <DashboardPageHeader
        title="Estatísticas"
        description="Visão executiva de vendas, canais, pagamentos e operação da loja."
        icon={FiBarChart2}
      >
        {/* ── Controles alinhados numa única linha ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Store selector */}
          {stores.length > 1 && (
            <select
              value={selectedStoreId}
              onChange={e => { setSelectedStoreId(e.target.value); setLS(SELECTED_STATISTICS_STORE_KEY, e.target.value) }}
              className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs font-bold text-zinc-800 dark:text-zinc-100 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30"
            >
              {stores.map(s => { const v = storeKeys(s)[0] || s.id; return <option key={s.id} value={v}>{s.name || s.storeName || `Loja ${s.id}`}</option> })}
            </select>
          )}

          {/* Period chips */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPeriodValue(p.value); setShowAllBairros(false) }}
                className={`shrink-0 rounded-lg px-3 h-7 text-xs font-black transition-all ${periodValue === p.value ? 'bg-[#f97316] text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* CSV export */}
          <label className="sr-only" htmlFor="statistics-csv-export">Exportar CSV</label>
          <select
            id="statistics-csv-export"
            value=""
            onChange={(event) => {
              const value = event.target.value
              if (value) handleExportCsv(value)
            }}
            disabled={!data.cur?.length}
            className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs font-black text-zinc-700 dark:text-zinc-100 outline-none transition-colors hover:border-orange-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-orange-900/30"
            title="Exportar dados do período em CSV"
          >
            <option value="">Exportar CSV</option>
            <option value="pedidos">Pedidos do período</option>
            <option value="produtos">Produtos vendidos</option>
            <option value="bairros">Bairros/regiões</option>
          </select>

          {/* Refresh — mesma linha */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Atualizar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-[#f97316] hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </DashboardPageHeader>

      <section className="mx-auto max-w-7xl px-4 pt-5 pb-28 lg:pb-10 sm:px-6 lg:px-8">

        {/* Context badge row */}
        {!loading && selectedStore && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {storeName && (
              <span className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                {storeName}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-[#f97316]">
              <FiActivity size={10} />
              {period.label}
            </span>
            {data.bestDay && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                <FiStar size={10} />
                Melhor dia: {data.bestDay.label}
              </span>
            )}
            {lastUpdated && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {!loading && selectedStore && !advancedReportsAllowed && (
          <div className="mb-4">
            <LockedFeatureCard
              featureKey="advancedReports"
              featureName="Relatórios avançados"
              description="Os relatórios básicos continuam disponíveis. Exportações e análises avançadas ficam liberadas no Premium."
            />
          </div>
        )}

        {/* ── States ── */}
        {loading ? <Skeleton /> : !selectedStore ? (
          <Empty icon={FiShoppingBag} title="Nenhuma loja vinculada" description="Conclua o onboarding ou fale com o suporte." />
        ) : !canRead ? (
          <Empty icon={FiCreditCard} title="Configure a cobrança" description="Os relatórios ficam disponíveis após a operação ser liberada." />
        ) : data.cur.length === 0 ? (
          <Empty icon={FiPieChart} title="Sem dados neste período" description={`Nenhum pedido para ${storeName || 'esta loja'} em ${period.label.toLowerCase()}. Quando houver pedidos, as estatísticas aparecerão aqui.`} />
        ) : (
          <>
            {/* ── Faixa principal com faturamento destacado ── */}
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                icon={FiDollarSign} label="Faturamento" tone="green" highlight
                value={fmt(data.revenueCents)}
                sub={`${data.revenueOrdersCount} pagos/concluídos`}
                delta={data.revDelta}
              />
              <KpiCard
                icon={FiShoppingBag} label="Pedidos" tone="blue"
                value={data.totalOrders}
                sub={`${data.canceledCount} cancelados`}
                delta={data.ordDelta}
              />
              <KpiCard
                icon={FiTrendingUp} label="Ticket Médio" tone="orange"
                value={fmt(data.ticket)}
                sub="Por pedido pago/concluído"
                delta={data.tikDelta}
              />
              <KpiCard
                icon={FiUsers} label="Clientes Únicos" tone="purple"
                value={data.totalCustomers}
                sub={`${data.recurrence}% recorrentes`}
              />
            </div>

            {/* ── KPIs executivos ── */}
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={FiCheckCircle} label="Entregues/Concluídos" tone="green" value={`${data.completedCount}`} sub="Operação concluída" />
              <KpiCard icon={FiXCircle} label="Cancelados" tone="red" value={`${data.canceledCount}`} sub={`Taxa de ${data.cancelRate}%`} />
              <KpiCard icon={FiCalendar} label="Agendados" tone="amber" value={data.scheduledCount} sub={`${fmt(data.scheduledRevenueCents)} em receita`} />
              <KpiCard icon={FiCreditCard} label="Pagamento pendente" tone={data.onlinePendingCount > 0 ? 'red' : 'blue'} value={data.onlinePendingCount} sub={data.onlineCount > 0 ? `${data.onlinePaidCount}/${data.onlineCount} online pagos` : 'Sem pendências online'} />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={FiShoppingBag} label="Balcão" tone="purple" value={data.counterCount} sub={`${fmt(data.counterRevenueCents)} presencial`} />
              <KpiCard icon={FiZap} label="Pagamento online" tone="blue" value={data.onlineCount} sub={data.onlineCount > 0 ? `${data.onlinePaidRate ?? 0}% confirmados` : 'Pix/cartão via Mercado Pago'} />
              <KpiCard icon={FiClock} label="Tempo de conclusão" tone="amber" value={data.avgDelivery !== null ? `${data.avgDelivery} min` : '—'} sub="Criação até finalização" />
              <KpiCard icon={FiTag} label="Descontos" tone="teal" value={fmt(data.discountCents)} sub={`${data.couponOrders} c/ cupom`} />
            </div>

            {/* ── Grid principal ── */}
            <div className="grid gap-4 lg:grid-cols-2">

              {/* Gráfico faturamento/pedidos por dia com toggle */}
              <Card
                title={period.days === 0 ? 'Evolução por Hora' : 'Evolução por Dia'}
                description={chartMode === 'revenue' ? 'Receita acumulada no período' : 'Volume de pedidos no período'}
                icon={FiBarChart2}
                iconTone="orange"
                fullWidth
                headerRight={
                  <AnimatedSegmentedControl
                    options={[{ label: 'Receita', value: 'revenue' }, { label: 'Pedidos', value: 'orders' }]}
                    value={chartMode}
                    onChange={setChartMode}
                    size="sm"
                    variant="primary"
                  />
                }
              >
                <RevenueChart series={data.dailySeries} mode={chartMode} />
                {data.bestDay && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 p-3 text-xs font-semibold text-orange-800 dark:text-orange-300">
                    <FiStar size={13} className="text-[#f97316] shrink-0" />
                    <span>Melhor {period.days === 0 ? 'hora' : 'dia'}: <strong>{data.bestDay.label}</strong> — {chartMode === 'revenue' ? `${fmt(data.bestDay.revenueCents)} em ${data.bestDay.orders} pedidos` : `${data.bestDay.orders} pedidos · ${fmt(data.bestDay.revenueCents)}`}</span>
                  </div>
                )}
              </Card>

              {/* Insights */}
              {data.insights.length > 0 && (
                <Card title="Resumo Inteligente" description="Análise automática dos seus dados" icon={FiZap} iconTone="amber" fullWidth>
                  <div className="columns-1 sm:columns-2 gap-4">
                    {data.insights.map((ins, i) => <Insight key={i} icon={ins.icon} tone={ins.tone} text={ins.text} />)}
                  </div>
                </Card>
              )}

              {/* Status executivo */}
              <Card title="Resumo dos Pedidos" description="Visão executiva do período" icon={FiActivity} iconTone="blue">
                <div className="space-y-1">
                  {[
                    { key: 'completed', label: 'Entregues/Concluídos', color: 'bg-emerald-500' },
                    { key: 'canceled', label: 'Cancelados', color: 'bg-red-500' },
                    { key: 'scheduled', label: 'Agendados', color: 'bg-amber-500' },
                    { key: 'paymentPending', label: 'Pagamento pendente', color: 'bg-orange-500' },
                  ].map(({ key, label, color }) => (
                    <HBar key={key} label={label} value={data.statusSummary[key]} total={data.cur.length} color={color} />
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-zinc-50 p-3 text-center dark:bg-white/[0.04]">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Em andamento</p>
                    <p className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-50">{data.statusSummary.ongoing}</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-3 text-center dark:bg-orange-500/10">
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Cancelamento</p>
                    <p className="mt-1 text-lg font-black text-orange-900 dark:text-orange-100">{data.cancelRate}%</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 p-2.5 text-[11px] font-semibold text-blue-900 dark:text-blue-300 leading-5">
                  <FiActivity className="shrink-0 text-blue-500 mt-0.5" size={12} />
                  <span>Use esta visão para acompanhar conclusão, cancelamentos, agenda e pagamentos pendentes sem misturar etapas internas da cozinha.</span>
                </div>
              </Card>

              {/* Horários de pico */}
              <Card title="Horários de Pico" description="Volume de pedidos por hora e dia da semana" icon={FiClock} iconTone="amber">
                <PeakChart peakHours={data.peakH} max={data.maxPeak} />
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-2">Dias da semana</p>
                  <WeekdayHeatmap weekdays={data.weekdays} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {[
                    { label: '🌞 Manhã', key: 'manhã', color: 'bg-amber-400' },
                    { label: '🌇 Tarde', key: 'tarde', color: 'bg-orange-500' },
                    { label: '🌃 Noite', key: 'noite', color: 'bg-indigo-500' },
                    { label: '🌌 Madrugada', key: 'madrugada', color: 'bg-zinc-500' },
                  ].map(({ label, key, color }) => (
                    <HBar key={key} label={label} value={data.timeB[key]} total={data.totalOrders} color={color} />
                  ))}
                </div>
              </Card>

              {/* Produtos mais vendidos */}
              <Card title="Produtos Mais Vendidos" description="Top 5 por quantidade" icon={FiBarChart2} iconTone="orange">
                {data.topProducts.length === 0 ? (
                  <Empty icon={FiShoppingBag} title="Sem dados" description="Pedidos sem itens detalhados." />
                ) : (
                  <div>
                    {data.topProducts.slice(0, 5).map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${i === 0 ? 'bg-[#f97316] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{p.ordersCount} pedidos</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-[#f97316]">{p.qty} un.</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{fmt(p.revenueCents)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Clientes mais fiéis (novo!) */}
              <Card title="Clientes Mais Fiéis" description="Por quantidade de pedidos no período" icon={FiStar} iconTone="purple">
                {data.topCustomers.length === 0 ? (
                  <Empty icon={FiUsers} title="Sem dados" description="Pedidos sem telefone de cliente." />
                ) : (
                  <div>
                    {data.topCustomers.map((c, i) => (
                      <div key={c.phone} className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${i === 0 ? 'bg-purple-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{c.name || 'Cliente'}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{c.phone}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-purple-600 dark:text-purple-400">{c.orders} ped.</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{fmt(c.revenueCents)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Pagamentos + canais */}
              <Card title="Pagamentos e Canais" description="Como o cliente pagou e por onde a venda entrou" icon={FiCreditCard} iconTone="purple">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Pagamentos</p>
                <div className="space-y-1 mb-4">
                  {[
                    { key: 'online', label: 'Pagamento online', color: 'bg-indigo-500', sub: 'Pix/cartão via Mercado Pago' },
                    { key: 'pix', label: 'Pix manual', color: 'bg-[#f97316]', sub: 'Confirmado pela loja' },
                    { key: 'card', label: 'Maquininha', color: 'bg-blue-500', sub: 'Crédito/débito/cartão presencial' },
                    { key: 'cash', label: 'Dinheiro', color: 'bg-emerald-500', sub: 'Recebido no balcão/entrega' },
                    { key: 'other', label: 'Outros', color: 'bg-zinc-400 dark:bg-zinc-600' },
                  ].map(({ key, label, color, sub }) => (
                    <HBar key={key} label={label} sub={`${fmt(data.paymentRevenueCents[key])} no período${sub ? ` · ${sub}` : ''}`} value={data.payments[key]} total={data.totalOrders} color={color} />
                  ))}
                </div>

                {data.onlineCount > 0 && (
                  <div className="mb-4 rounded-xl bg-indigo-50 p-3 text-[11px] font-semibold leading-5 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200">
                    <p className="font-black uppercase tracking-wider">Pagamento online</p>
                    <p>{data.onlinePaidCount} confirmado(s), {data.onlinePendingCount} pendente(s){data.onlinePaidRate !== null ? ` · confirmação ${data.onlinePaidRate}%` : ''}.</p>
                  </div>
                )}

                <div className="grid gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Canais</p>
                    <div className="space-y-1">
                      {[
                        { key: 'delivery', label: 'Delivery', color: 'bg-[#f97316]' },
                        { key: 'pickup', label: 'Retirada', color: 'bg-blue-500' },
                        { key: 'counter', label: 'Balcão', color: 'bg-purple-500' },
                        { key: 'table', label: 'Mesa / Atendimento local', color: 'bg-teal-500' },
                      ].map(({ key, label, color }) => (
                        <HBar key={key} label={label} sub={`${fmt(data.channelRevenueCents[key])} no período`} value={data.delTypes[key]} total={data.totalOrders} color={color} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Tipo de pedido</p>
                    <div className="space-y-1">
                      <HBar label="Agora" value={Math.max(data.totalOrders - data.scheduledCount, 0)} total={data.totalOrders} color="bg-emerald-500" />
                      <HBar label="Agendados" value={data.scheduledCount} total={data.totalOrders} color="bg-amber-500" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Bairros */}
              <Card
                title="Bairros e Regiões"
                description="Áreas com mais pedidos e receita"
                icon={FiMapPin}
                iconTone="teal"
                headerRight={
                  <AnimatedSegmentedControl
                    options={[{ label: 'Pedidos', value: 'orders' }, { label: 'Receita', value: 'revenue' }]}
                    value={bairrosTab}
                    onChange={t => { setBairrosTab(t); setShowAllBairros(false) }}
                    size="sm"
                    variant="primary"
                  />
                }
              >
                {activeBairros.length === 0 ? (
                  <Empty icon={FiMapPin} title="Sem dados de bairros" description="Pedidos sem campo de bairro preenchido." />
                ) : (
                  <>
                    {displayedBairros.map((item, idx) => (
                      <div key={item.neighborhood} className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${idx === 0 ? 'bg-teal-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.neighborhood}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {item.pct}% · {item.avgFeeCents > 0 ? `taxa média ${fmt(item.avgFeeCents)}` : 'entrega grátis'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-teal-600 dark:text-teal-400">{bairrosTab === 'orders' ? `${item.ordersCount} ped.` : fmt(item.revenueCents)}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Ticket: {fmt(item.ticketCents)}</p>
                        </div>
                      </div>
                    ))}
                    {activeBairros.length > 5 && (
                      <button type="button" onClick={() => setShowAllBairros(v => !v)} className="mt-2 text-xs font-black text-[#f97316] hover:text-[#ea580c] transition-colors">
                        {showAllBairros ? 'Ver menos' : `Ver todos os ${activeBairros.length} bairros`}
                      </button>
                    )}
                  </>
                )}
              </Card>

              {/* Cupons */}
              <Card title="Cupons e Campanhas" description="Impacto de promoções nas vendas" icon={FiPercent} iconTone="purple" fullWidth>
                {data.discountCents === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 mb-3">
                      <FiTag size={22} />
                    </div>
                    <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">Nenhum cupom usado ainda</p>
                    <p className="mt-1 max-w-xs text-xs text-zinc-400 dark:text-zinc-500">Crie campanhas em <strong>Cardápio › Cupons</strong> para atrair e fidelizar clientes.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Cupom Mais Usado', value: data.topCoupon?.code || '—', sub: data.topCoupon ? `Usado ${data.topCoupon.count}× · ${fmt(data.topCoupon.discountCents)} em desc.` : '', bg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20', txt: 'text-purple-900 dark:text-purple-200', lbl: 'text-purple-700 dark:text-purple-400' },
                      { label: 'Total Descontado', value: fmt(data.discountCents), sub: 'Soma de descontos concedidos', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', txt: 'text-emerald-900 dark:text-emerald-200', lbl: 'text-emerald-700 dark:text-emerald-400' },
                      { label: 'Desconto Médio', value: data.couponOrders > 0 ? fmt(data.discountCents / data.couponOrders) : '—', sub: 'Por pedido com cupom', bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20', txt: 'text-blue-900 dark:text-blue-200', lbl: 'text-blue-700 dark:text-blue-400' },
                    ].map(({ label, value, sub, bg, txt, lbl }) => (
                      <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                        <p className={`text-[10px] font-black uppercase tracking-wider ${lbl}`}>{label}</p>
                        <p className={`mt-2 text-xl font-black ${txt} truncate`}>{value}</p>
                        <p className={`mt-1.5 text-[11px] font-semibold ${lbl}`}>{sub}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

            </div>
          </>
        )}

        <DashboardFooter store={selectedStore} />
      </section>
    </main>
  )
}
