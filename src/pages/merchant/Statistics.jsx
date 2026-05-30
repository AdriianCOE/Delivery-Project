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
  { label: '30 dias', value: 'month', days: 'current_month' },
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
    novo: 'pendente', received: 'pendente', aguardando: 'pendente', pendente: 'pendente',
    aceito: 'preparando', confirmado: 'preparando', preparo: 'preparando', preparando: 'preparando',
    entregando: 'entregando', saiu_para_entrega: 'entregando', em_rota: 'entregando',
    finalizado: 'entregue', delivered: 'entregue', entregue: 'entregue',
    canceled: 'cancelado', cancelled: 'cancelado', cancelado: 'cancelado',
  }
  return map[v] || 'pendente'
}
function formatMoney(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmt(cents) { return formatMoney(Number(cents || 0) / 100) }

function getOrderDate(o) {
  const c = o?.createdAt
  if (!c) return null
  if (c?.toDate) return c.toDate()
  if (c instanceof Date) return c
  const d = new Date(c)
  return isNaN(d.getTime()) ? null : d
}
function getPhone(o) { return o?.customerPhone || o?.customer?.phone || o?.phone || '' }
function getPayMethod(o) {
  const r = String(o?.payment?.method || o?.paymentMethod || o?.paymentType || '').toLowerCase()
  if (r.includes('pix')) return 'pix'
  if (r.includes('card') || r.includes('cartao') || r.includes('cartão') || r.includes('credit') || r.includes('debit')) return 'card'
  if (r.includes('cash') || r.includes('dinheiro')) return 'cash'
  return 'other'
}
function getTotalCents(o) { return o?.totalCents != null ? Number(o.totalCents) : Math.round(Number(o?.total || 0) * 100) }
function getDeliveryCents(o) {
  if (o?.deliveryFeeCents != null) return Number(o.deliveryFeeCents)
  if (o?.deliveryFee != null) return Math.round(Number(o.deliveryFee) * 100)
  return 0
}
function getDiscountCents(o) {
  if (o?.discountCents != null) return Number(o.discountCents)
  if (o?.discount != null) return Math.round(Number(o.discount) * 100)
  return 0
}
function getNeighborhood(o) {
  const v = o?.neighborhood || o?.deliveryNeighborhood || o?.customer?.neighborhood || o?.delivery?.neighborhood || o?.address?.neighborhood || o?.customerAddress?.neighborhood || ''
  return String(v).trim() || 'Não informado'
}
function getItems(o) { return Array.isArray(o?.items) ? o.items : [] }
function isCompleted(o) { return normalizeStatus(o?.status) === 'entregue' }
function isCanceled(o) { return normalizeStatus(o?.status) === 'cancelado' }
function getDeliveryDuration(o) {
  const created = getOrderDate(o)
  if (!created) return null
  const h = (o?.statusHistory || []).find(x => ['entregue', 'finalizado', 'delivered'].includes(String(x.status || '').toLowerCase()))
  let delivered = null
  if (h?.timestamp) delivered = h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp)
  else if (o?.deliveredAt) delivered = o.deliveredAt.toDate ? o.deliveredAt.toDate() : new Date(o.deliveredAt)
  else if (o?.updatedAt && normalizeStatus(o.status) === 'entregue') delivered = o.updatedAt.toDate ? o.updatedAt.toDate() : new Date(o.updatedAt)
  if (delivered && !isNaN(delivered.getTime())) {
    const m = Math.round((delivered - created) / 60000)
    if (m > 0 && m < 300) return m
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
  const completed = orders.filter(isCompleted)
  const revenue = completed.reduce((s, o) => s + getTotalCents(o), 0)
  return { revenue, valid: orders.filter(o => !isCanceled(o)).length, canceled: canceled.length, completed: completed.length, ticket: completed.length > 0 ? revenue / completed.length : 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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
function RevenueChart({ series }) {
  if (!series?.length) return <Empty icon={FiBarChart2} title="Sem dados" description="Nenhum pedido no período." />
  const max = Math.max(...series.map(d => d.revenueCents), 1)
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <div className="flex items-end gap-1 h-24 min-w-[280px]">
        {series.map(({ label, revenueCents, orders }) => {
          const pct = revenueCents > 0 ? Math.max((revenueCents / max) * 100, 5) : 0
          return (
            <div key={label} className="group relative flex flex-1 flex-col items-center gap-1 min-w-[20px]">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center rounded-lg bg-zinc-900 dark:bg-zinc-700 px-2 py-1.5 text-[9px] font-black text-white whitespace-nowrap z-20 shadow-xl gap-0.5">
                <span>{fmt(revenueCents)}</span>
                <span className="opacity-70 font-medium">{orders} ped.</span>
              </div>
              <div className={`w-full rounded-t-sm transition-all duration-500 ${revenueCents > 0 ? 'bg-[#f97316] hover:bg-[#ea580c] cursor-default' : 'bg-zinc-100 dark:bg-zinc-800'}`} style={{ height: `${pct}%` }} />
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
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])
  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])

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
    if (!user?.uid || !knownStoreIds.length) { setStores([]); setOrders([]); setLoading(false); return }
    setLoading(true)
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
    if (!unsubs.length) { setStores([]); setOrders([]); setLoading(false) }
    return () => unsubs.forEach(u => u())
  }, [user?.uid, knownStoreIdsKey])

  // ── Auto-select store
  useEffect(() => {
    if (!stores.length) { setSelectedStoreId(''); return }
    setSelectedStoreId(cur => {
      if (stores.some(s => storeKeys(s).includes(cur))) return cur
      const saved = safeLS(SELECTED_STATISTICS_STORE_KEY)
      if (stores.some(s => storeKeys(s).includes(saved))) return saved
      return storeKeys(stores[0])[0] || stores[0].id
    })
  }, [stores])

  // ── Orders listener (62-day window so prev-period comparison works)
  useEffect(() => {
    if (authLoading) { setOrders([]); setLoading(true); return }
    if (!selectedStore || !canRead) { setOrders([]); setLoading(false); return }

    const idKeys = [selectedStore?.id, selectedStore?.storeId, selectedStore?.storeDocId].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10)
    const slugKeys = [selectedStore?.storeSlug, selectedStore?.slug].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i && !idKeys.includes(v)).slice(0, 10)
    if (!idKeys.length) { setOrders([]); setLoading(false); return }

    setLoading(true)
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 62 * 86400000))
    const map = new Map()
    let slugDone = false, mounted = true

    function publish() {
      if (!mounted) return
      const data = Array.from(map.values()).sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0))
      setOrders(data)
      setLastUpdated(new Date())
      setLoading(false)
    }

    async function slugFallback(why) {
      if (slugDone || !slugKeys.length) return
      slugDone = true
      try {
        const snap = await getDocs(query(collection(db, 'orders'), where('storeSlug', 'in', slugKeys), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')))
        snap.docs.forEach(d => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() }) })
      } catch (e) { if (e?.code !== 'permission-denied') console.warn('[Stats] slug fallback', why, e.message) }
      finally { publish() }
    }

    const unsub = onSnapshot(
      query(collection(db, 'orders'), where('storeId', 'in', idKeys), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')),
      snap => {
        snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }))
        if (slugKeys.length && !slugDone) { void slugFallback('compat'); if (snap.empty) return }
        publish()
      },
      err => {
        if (err?.code !== 'permission-denied') console.error('[Stats] orders err', err)
        void slugFallback('id query error')
        publish()
      }
    )
    return () => { mounted = false; unsub() }
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

    const revenueCents = completed.reduce((s, o) => s + getTotalCents(o), 0)
    const totalOrders = valid.length
    const canceledCount = canceled.length
    const ticket = completed.length > 0 ? revenueCents / completed.length : 0

    const pk = kpisFrom(prev)
    const revDelta = delta(revenueCents, pk.revenue)
    const ordDelta = delta(totalOrders, pk.valid)
    const tikDelta = delta(ticket, pk.ticket)

    // Unique customers
    const phones = new Set(valid.map(getPhone).filter(Boolean))
    const totalCustomers = phones.size
    const recurrence = totalOrders > 0 && totalCustomers > 0 ? Math.max(0, Math.round(((totalOrders - totalCustomers) / totalOrders) * 100)) : 0

    // Payments / delivery types
    const payments = { pix: 0, card: 0, cash: 0, other: 0 }
    const delTypes = { delivery: 0, pickup: 0, table: 0 }
    const peakH = Array(24).fill(0)
    const timeB = { manhã: 0, tarde: 0, noite: 0, madrugada: 0 }
    const weekdays = Array(7).fill(0)

    let delivSum = 0, delivCnt = 0
    completed.forEach(o => { const m = getDeliveryDuration(o); if (m !== null) { delivSum += m; delivCnt++ } })
    const avgDelivery = delivCnt > 0 ? Math.round(delivSum / delivCnt) : null

    valid.forEach(o => {
      const m = getPayMethod(o); payments[m] = (payments[m] || 0) + 1
      const t = String(o.orderType || o.type || '').toLowerCase()
      if (t === 'pickup' || t === 'retirada') delTypes.pickup++
      else if (t === 'dine_in' || t === 'mesa') delTypes.table++
      else delTypes.delivery++
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

    // Neighborhoods
    const nbMap = new Map()
    cur.forEach(o => {
      const nb = getNeighborhood(o)
      const p = nbMap.get(nb) || { neighborhood: nb, ordersCount: 0, completedCount: 0, revenueCents: 0, feeSumCents: 0, feeCnt: 0 }
      if (!isCanceled(o)) p.ordersCount++
      if (isCompleted(o)) { p.completedCount++; p.revenueCents += getTotalCents(o) }
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
    valid.forEach(o => getItems(o).forEach(item => {
      const id = item.productId || item.id || item.name || 'Produto'
      const name = item.name || 'Produto'
      const qty = Number(item.quantity || 1)
      const pc = item.priceCents != null ? Number(item.priceCents) : Math.round(Number(item.price || 0) * 100)
      const rc = item.totalCents != null ? Number(item.totalCents) : qty * pc
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
      p.orders++; p.revenueCents += getTotalCents(o)
      if (!p.name && name) p.name = name
      custMap.set(ph, p)
    })
    const topCustomers = Array.from(custMap.values()).sort((a, b) => b.orders - a.orders).slice(0, 5)

    // Status
    const statusCounts = { pendente: 0, preparando: 0, entregando: 0, entregue: 0, cancelado: 0 }
    cur.forEach(o => { const s = normalizeStatus(o.status); if (s in statusCounts) statusCounts[s]++ })

    // Coupons
    const couponMap = new Map()
    let couponOrders = 0, discountCents = 0
    valid.forEach(o => {
      const code = o.couponCode || o.coupon?.code || o.coupon?.couponCode || o.discountCoupon || ''
      const disc = getDiscountCents(o)
      if (code && String(code).trim()) {
        const c = String(code).trim().toUpperCase()
        const p = couponMap.get(c) || { code: c, count: 0, discountCents: 0 }
        p.count++; p.discountCents += disc; couponMap.set(c, p)
        couponOrders++; discountCents += disc
      } else if (disc > 0) { discountCents += disc }
    })
    const topCoupon = Array.from(couponMap.values()).sort((a, b) => b.count - a.count)[0] || null

    // Daily / hourly series (toggle revenue vs orders)
    const dayMap = new Map()
    cur.forEach(o => {
      if (isCanceled(o)) return
      const d = getOrderDate(o); if (!d) return
      let key = period.days === 0 ? `${d.getHours()}h` : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
      const p = dayMap.get(key) || { label: key, revenueCents: 0, orders: 0 }
      p.revenueCents += getTotalCents(o); p.orders++
      dayMap.set(key, p)
    })
    const dailySeries = Array.from(dayMap.values())

    // Best day
    const bestDay = dailySeries.reduce((best, d) => (!best || d.revenueCents > best.revenueCents) ? d : best, null)

    const cancelRate = cur.length > 0 ? Math.round((canceledCount / cur.length) * 100) : 0

    // Insights
    const insights = []
    const peakBlock = Object.entries(timeB).sort((a, b) => b[1] - a[1])[0]
    if (peakBlock?.[1] > 0) insights.push({ icon: FiClock, tone: 'orange', text: `Horário de pico: ${peakHourIdx}h. Turno mais movimentado: ${peakBlock[0]}.` })
    if (ticket > 0) insights.push({ icon: FiDollarSign, tone: 'green', text: `Ticket médio de ${fmt(ticket)} sobre ${completed.length} pedido${completed.length !== 1 ? 's' : ''} entregue${completed.length !== 1 ? 's' : ''}.` })
    if (cancelRate >= 10) insights.push({ icon: FiXCircle, tone: 'red', text: `Taxa de cancelamento em ${cancelRate}% — acima do ideal. Revise tempos de preparo e confirmação.` })
    if (topProducts[0]) insights.push({ icon: FiShoppingBag, tone: 'blue', text: `Produto estrela: "${topProducts[0].name}" com ${topProducts[0].qty} un. vendidas e ${fmt(topProducts[0].revenueCents)} em receita.` })
    if (recurrence > 20) insights.push({ icon: FiUsers, tone: 'amber', text: `${recurrence}% dos pedidos são de clientes recorrentes — excelente fidelização!` })
    if (topCoupon) insights.push({ icon: FiTag, tone: 'purple', text: `Cupom mais ativo: "${topCoupon.code}" usado ${topCoupon.count}× (${fmt(topCoupon.discountCents)} em descontos concedidos).` })
    if (bestDay && dailySeries.length > 1) insights.push({ icon: FiStar, tone: 'green', text: `Melhor dia: ${bestDay.label} com ${fmt(bestDay.revenueCents)} em faturamento e ${bestDay.orders} pedido${bestDay.orders !== 1 ? 's' : ''}.` })
    if (bestWeekday >= 0 && weekdays[bestWeekday] > 0) insights.push({ icon: FiActivity, tone: 'blue', text: `${WEEKDAYS_PT[bestWeekday]}feira é o dia da semana com mais pedidos (${weekdays[bestWeekday]}× no período).` })

    return {
      cur, canceledCount, cancelRate, totalOrders, revenueCents, revDelta, ordDelta, tikDelta,
      ticket, totalCustomers, recurrence, avgDelivery, completedCount: completed.length,
      payments, delTypes, peakH, maxPeak, peakHourIdx, timeB, weekdays, bestWeekday,
      nbByOrders, nbByRevenue, topProducts, topCustomers,
      statusCounts, couponOrders, discountCents, topCoupon, dailySeries, bestDay, insights,
    }
  }, [orders, period])

  const activeBairros = bairrosTab === 'orders' ? data.nbByOrders : data.nbByRevenue
  const displayedBairros = showAllBairros ? activeBairros : activeBairros.slice(0, 5)
  const storeName = selectedStore?.name || selectedStore?.storeName || null

  return (
    <main className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen">
      <DashboardPageHeader
        title="Estatísticas"
        description="Acompanhe vendas, pedidos e desempenho da sua loja."
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
                sub={`${data.completedCount} entregues`}
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
                sub="Por pedido entregue"
                delta={data.tikDelta}
              />
              <KpiCard
                icon={FiUsers} label="Clientes Únicos" tone="purple"
                value={data.totalCustomers}
                sub={`${data.recurrence}% recorrentes`}
              />
            </div>

            {/* ── KPIs operacionais ── */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={FiCheckCircle} label="Entregues" tone="green" value={`${data.completedCount}`} sub="Operação concluída" />
              <KpiCard icon={FiXCircle} label="Cancelamentos" tone="red" value={`${data.canceledCount}`} sub={`Taxa de ${data.cancelRate}%`} />
              <KpiCard icon={FiClock} label="Tempo Médio" tone="amber" value={data.avgDelivery !== null ? `${data.avgDelivery} min` : '—'} sub="Criação até entrega" />
              <KpiCard icon={FiTag} label="Descontos" tone="teal" value={fmt(data.discountCents)} sub={`${data.couponOrders} c/ cupom`} />
            </div>

            {/* ── Grid principal ── */}
            <div className="grid gap-4 lg:grid-cols-2">

              {/* Gráfico faturamento/pedidos por dia com toggle */}
              <Card
                title={period.days === 0 ? 'Evolução por Hora' : 'Evolução por Dia'}
                description="Receita acumulada no período"
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
                <RevenueChart
                  series={chartMode === 'revenue'
                    ? data.dailySeries
                    : data.dailySeries.map(d => ({ ...d, revenueCents: d.orders * 100 })) /* orders as bar height */
                  }
                />
                {data.bestDay && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 p-3 text-xs font-semibold text-orange-800 dark:text-orange-300">
                    <FiStar size={13} className="text-[#f97316] shrink-0" />
                    <span>Melhor {period.days === 0 ? 'hora' : 'dia'}: <strong>{data.bestDay.label}</strong> — {fmt(data.bestDay.revenueCents)} em {data.bestDay.orders} pedidos</span>
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

              {/* Status */}
              <Card title="Fluxo de Status" description="Distribuição dos pedidos no período" icon={FiActivity} iconTone="blue">
                <div className="space-y-1">
                  {[
                    { key: 'pendente', label: 'Pendente', color: 'bg-amber-400' },
                    { key: 'preparando', label: 'Preparando', color: 'bg-blue-500' },
                    { key: 'entregando', label: 'Em Rota', color: 'bg-sky-500' },
                    { key: 'entregue', label: 'Entregue', color: 'bg-emerald-500' },
                    { key: 'cancelado', label: 'Cancelado', color: 'bg-red-500' },
                  ].map(({ key, label, color }) => (
                    <HBar key={key} label={label} value={data.statusCounts[key]} total={data.cur.length} color={color} />
                  ))}
                </div>
                <div className="mt-3 flex gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 p-2.5 text-[11px] font-semibold text-blue-900 dark:text-blue-300 leading-5">
                  <FiActivity className="shrink-0 text-blue-500 mt-0.5" size={12} />
                  <span>Cancelamento em <strong>{data.cancelRate}%</strong>. Monitore o tempo de preparo para reduzir desistências.</span>
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

              {/* Pagamentos + tipos de entrega */}
              <Card title="Pagamentos e Entrega" description="Como seus clientes pagam e recebem" icon={FiCreditCard} iconTone="purple">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Forma de pagamento</p>
                <div className="space-y-1 mb-4">
                  {[
                    { key: 'pix', label: 'PIX', color: 'bg-[#f97316]' },
                    { key: 'card', label: 'Cartão', color: 'bg-blue-500' },
                    { key: 'cash', label: 'Dinheiro', color: 'bg-emerald-500' },
                    { key: 'other', label: 'Outros', color: 'bg-zinc-400 dark:bg-zinc-600' },
                  ].map(({ key, label, color }) => (
                    <HBar key={key} label={label} value={data.payments[key]} total={data.totalOrders} color={color} />
                  ))}
                </div>
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">Tipo de entrega</p>
                  <div className="space-y-1">
                    {[
                      { key: 'delivery', label: '🛵 Delivery', color: 'bg-[#f97316]' },
                      { key: 'pickup', label: '🏃 Retirada', color: 'bg-blue-500' },
                      { key: 'table', label: '🍽️ Mesa', color: 'bg-purple-500' },
                    ].map(({ key, label, color }) => (
                      <HBar key={key} label={label} value={data.delTypes[key]} total={data.totalOrders} color={color} />
                    ))}
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
