/**
 * KDS — Kitchen Display System
 * PratoBy · Tela de Cozinha
 *
 * Renderiza FORA do DashboardLayout (sem sidebar/topbar/banner).
 * Ocupa 100vw × 100vh. Projetado para TV e tablet de cozinha.
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  FiMonitor,
  FiMaximize,
  FiMinimize,
  FiRefreshCw,
  FiAlertCircle,
  FiClock,
  FiPackage,
  FiPlay,
  FiZap,
  FiTruck,
  FiShoppingBag,
  FiVolume2,
  FiVolumeX,
  FiSun,
  FiMoon,
  FiArrowLeft,
  FiGrid,
  FiList,
  FiTag,
  FiUsers,
  FiChevronRight,
  FiCheckCircle,
} from 'react-icons/fi'
import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import {
  getDisplayStoreName,
  getMerchantDisplayLogoUrl,
} from '../../utils/merchantDisplayBranding'

// ─── Constants ────────────────────────────────────────────────────────────────

const KDS_QUERY_STATUSES = ['confirmado', 'preparando', 'pronto']
const KDS_COLUMNS = ['confirmado', 'preparando', 'pronto']
const KDS_THEME_KEY = 'pratoby_kds_theme'

const STATUS_CFG = {
  confirmado: {
    label: 'Confirmado',
    colLabel: 'Aguardando preparo',
    color: { dark: 'text-sky-400', light: 'text-sky-600' },
    bg: { dark: 'bg-sky-400/10', light: 'bg-sky-50' },
    border: { dark: 'border-sky-400/30', light: 'border-sky-300' },
    dot: { dark: 'bg-sky-400', light: 'bg-sky-500' },
    actionBg: { dark: 'bg-sky-500 hover:bg-sky-400', light: 'bg-sky-500 hover:bg-sky-600' },
    pulse: true,
    nextAction: { label: 'Iniciar preparo', status: 'preparando', icon: FiPlay },
  },

  preparando: {
    label: 'Preparando',
    colLabel: 'Em preparo',
    color: { dark: 'text-orange-400', light: 'text-orange-600' },
    bg: { dark: 'bg-orange-400/10', light: 'bg-orange-50' },
    border: { dark: 'border-orange-400/30', light: 'border-orange-300' },
    dot: { dark: 'bg-orange-500', light: 'bg-orange-500' },
    actionBg: { dark: 'bg-orange-500 hover:bg-orange-400', light: 'bg-orange-500 hover:bg-orange-600' },
    pulse: false,
    nextAction: { label: 'Marcar como pronto', status: 'pronto', icon: FiZap },
  },

  pronto: {
    label: 'Pronto',
    colLabel: 'Prontos',
    color: { dark: 'text-emerald-400', light: 'text-emerald-600' },
    bg: { dark: 'bg-emerald-400/10', light: 'bg-emerald-50' },
    border: { dark: 'border-emerald-400/30', light: 'border-emerald-300' },
    dot: { dark: 'bg-emerald-500', light: 'bg-emerald-500' },
    actionBg: { dark: 'bg-emerald-500 hover:bg-emerald-400', light: 'bg-emerald-500 hover:bg-emerald-600' },
    pulse: false,
    nextAction: null,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}

function fmtTime(ts) {
  if (!ts) return '--:--'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

function useElapsed(ts) {
  const [elapsed, setElapsed] = useState('')
  const [diffMin, setDiffMin] = useState(0)
  useEffect(() => {
    if (!ts) return
    function calc() {
      const d = ts?.toDate ? ts.toDate() : new Date(ts)
      const diff = Math.floor((Date.now() - d.getTime()) / 1000)
      const mins = Math.floor(diff / 60)
      setDiffMin(mins)
      if (diff < 60) setElapsed(`${diff}s`)
      else if (diff < 3600) setElapsed(`${mins}min`)
      else setElapsed(`${Math.floor(diff / 3600)}h ${mins % 60}min`)
    }
    calc()
    const id = setInterval(calc, 15000)
    return () => clearInterval(id)
  }, [ts])
  return { elapsed, diffMin }
}

function cn(...classes) { return classes.filter(Boolean).join(' ') }

function getSortTimestamp(order) {
  const val = order.confirmedAt || order.acceptedAt || order.updatedAt || order.createdAt
  if (!val) return 0
  if (val.toDate) return val.toDate().getTime()
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'number') return val
  try {
    return new Date(val).getTime()
  } catch {
    return 0
  }
}

function compareOrdersOldestFirst(a, b) {
  const tsA = getSortTimestamp(a)
  const tsB = getSortTimestamp(b)
  return tsA - tsB
}

function normalizeKdsStatus(status) {
  const value = String(status || '').toLowerCase().trim()

  if (['confirmado', 'aceito', 'accepted'].includes(value)) return 'confirmado'
  if (['preparando', 'em_preparo', 'preparo', 'in_progress'].includes(value)) return 'preparando'
  if (['pronto', 'ready'].includes(value)) return 'pronto'

  // Pedido novo/pendente não deve entrar na cozinha até o atendente confirmar.
  if (['pendente', 'novo', 'new', 'recebido'].includes(value)) return 'pendente'

  return value || 'pendente'
}

function getOrderFulfillmentType(order) {
  const type = String(order?.deliveryType || order?.orderType || order?.type || '').toLowerCase().trim()
  if (order?.isDelivery === true || ['delivery', 'entrega'].includes(type)) return 'delivery'
  if (['dine_in', 'mesa', 'table', 'local', 'eat_in'].includes(type)) return 'dine_in'
  return 'pickup'
}

function getKdsNextAction(_order, _status, cfg) {
  return cfg.nextAction
}

// ─── Sound engine ─────────────────────────────────────────────────────────────

function useSoundEngine() {
  const ctxRef = useRef(null)
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('pratoby_kds_sound') !== 'false' } catch { return true }
  })

  const play = useCallback((type = 'new') => {
    if (!enabled) return
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const sequences = {
        new: [{ f: 880, t: 0 }, { f: 1100, t: 0.18 }],
        ready: [{ f: 523, t: 0 }, { f: 659, t: 0.14 }, { f: 784, t: 0.28 }],
      }
      const seq = sequences[type] || sequences.new
      seq.forEach(({ f, t }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = f
        const start = ctx.currentTime + t
        gain.gain.setValueAtTime(0.38, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
        osc.start(start); osc.stop(start + 0.22)
      })
    } catch { /* autoplay blocked */ }
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('pratoby_kds_sound', String(next)) } catch {}
      if (next) {
        setTimeout(() => play('new'), 50)
      }
      return next
    })
  }, [play])

  return { enabled, toggle, play }
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useKdsTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(KDS_THEME_KEY) || 'dark' } catch { return 'dark' }
  })

  const setTheme = useCallback((t) => {
    setThemeState(t)
    try { localStorage.setItem(KDS_THEME_KEY, t) } catch {}
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  const isDark = theme === 'dark'
  // Theme-aware class helper: t(dark_class, light_class)
  const t = (dark, light) => isDark ? dark : light

  return { theme, isDark, toggleTheme, t }
}

// ─── Elapsed badge ────────────────────────────────────────────────────────────

function ElapsedBadge({ createdAt, status, t }) {
  const { elapsed, diffMin } = useElapsed(createdAt)
  const showDelay = status === 'confirmado' || status === 'preparando'
  const urgent = showDelay && diffMin >= 20
  const warning = showDelay && diffMin >= 10
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
      urgent ? 'animate-pulse bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
        : warning ? t('bg-amber-500/15 text-amber-400', 'bg-amber-100 text-amber-700')
        : t('bg-zinc-800 text-zinc-400', 'bg-gray-100 text-gray-600')
    )}>
      <FiClock size={12} />
      {elapsed}
    </span>
  )
}

// ─── Order Type Badge ─────────────────────────────────────────────────────────

function OrderTypeBadge({ order, t }) {
  const fulfillmentType = getOrderFulfillmentType(order)

  if (fulfillmentType === 'delivery') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold',
        t('bg-indigo-500/15 text-indigo-400', 'bg-indigo-50 text-indigo-600'))}>
        <FiTruck size={12} />Entrega
      </span>
    )
  }

  if (fulfillmentType === 'dine_in') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold',
        t('bg-sky-500/15 text-sky-400', 'bg-sky-50 text-sky-600'))}>
        <FiUsers size={12} />Local
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold',
      t('bg-emerald-500/15 text-emerald-400', 'bg-emerald-50 text-emerald-600'))}>
      <FiShoppingBag size={12} />Retirada
    </span>
  )
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onUpdateStatus, compact, isNew, t, isDark }) {
  const normalizedStatus = normalizeKdsStatus(order.status)
  const cfg = STATUS_CFG[normalizedStatus] || STATUS_CFG.pendente
  const nextAction = getKdsNextAction(order, normalizedStatus, cfg)
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const handleAction = useCallback(async () => {
    if (!nextAction || loading) return
    setActionError('')
    setLoading(true)
    try {
      await onUpdateStatus(order.id, nextAction.status)
    } catch (err) {
      console.error('[KDS] Erro ao atualizar status:', err)
      setActionError(err?.message || 'Nao foi possivel atualizar o pedido.')
    } finally {
      setLoading(false)
    }
  }, [order.id, nextAction, loading, onUpdateStatus])

  const fulfillmentType = getOrderFulfillmentType(order)

  const handleFinish = useCallback(async () => {
    if (loading) return
    if (!window.confirm('Finalizar este pedido? Ele será removido da cozinha.')) return
    setActionError('')
    setLoading(true)
    try {
      await onUpdateStatus(order.id, 'entregue')
    } catch (err) {
      console.error('[KDS] Erro ao finalizar:', err)
      setActionError(err?.message || 'Erro ao finalizar pedido.')
    } finally {
      setLoading(false)
    }
  }, [order.id, loading, onUpdateStatus])

  const num = order.orderNumber || order.ticketNumber || order.number
    || `#${String(order.id).slice(-4).toUpperCase()}`
  const displayNum = String(num).startsWith('#') ? num : `#${String(num).toUpperCase()}`

  const items = order.items || order.cart || []
  const customerNote = order.customerNote || order.note || order.observations || ''
  const internalNote = order.internalNote || order.kitchenNote || ''

  return (
    <article className={cn(
      'relative flex flex-col rounded-2xl border transition-all duration-300',
      t('bg-zinc-900', 'bg-white shadow-md'),
      cfg.border[isDark ? 'dark' : 'light'],
      isNew && 'ring-2 ring-orange-500 ring-offset-2',
      isNew && t('ring-offset-zinc-950', 'ring-offset-gray-100'),
    )}>
      {/* NEW flash overlay */}
      {isNew && (
        <div className="absolute inset-0 rounded-2xl bg-orange-500/10 pointer-events-none animate-pulse" />
      )}

      {/* Header */}
      <div className={cn('flex items-center justify-between rounded-t-2xl px-4 py-3',
        cfg.bg[isDark ? 'dark' : 'light'])}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            {cfg.pulse && (
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                cfg.dot[isDark ? 'dark' : 'light'])} />
            )}
            <span className={cn('relative inline-flex h-3 w-3 rounded-full',
              cfg.dot[isDark ? 'dark' : 'light'])} />
          </span>
          <span className={cn('text-2xl font-black tracking-tight tabular-nums',
            cfg.color[isDark ? 'dark' : 'light'])}>
            {displayNum}
          </span>
          {isNew && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white animate-bounce">
              NOVO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OrderTypeBadge order={order} t={t} />
          <ElapsedBadge createdAt={order.createdAt} status={normalizedStatus} t={t} />
        </div>
      </div>

      {/* Time row */}
      <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2 text-sm',
        t('border-zinc-800 text-zinc-500', 'border-gray-100 text-gray-500'))}>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <FiClock size={12} />
          <span>Criado às {fmtTime(order.createdAt)}</span>
        </div>

        {normalizedStatus === 'pronto' && order.readyAt && (
          <>
            <span className={t('text-zinc-700', 'text-gray-300')}>·</span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <FiCheckCircle size={12} className={t('text-emerald-500', 'text-emerald-600')} />
              <span className={t('text-emerald-400 font-medium', 'text-emerald-700 font-bold')}>
                Pronto às {fmtTime(order.readyAt)}
              </span>
            </div>
          </>
        )}

        <span className={t('text-zinc-700', 'text-gray-300')}>·</span>
        <span className={cn('font-bold truncate', cfg.color[isDark ? 'dark' : 'light'])}>
          {cfg.label}
        </span>
      </div>

      {actionError && (
        <div className={cn(
          'mx-4 mt-3 rounded-xl border px-3 py-2 text-xs font-bold',
          t('border-red-500/30 bg-red-500/10 text-red-300', 'border-red-100 bg-red-50 text-red-700')
        )}>
          {actionError}
        </div>
      )}

      {/* Items */}
      <div className={cn('flex-1 space-y-3 px-4', compact ? 'py-3' : 'py-4')}>
        {items.length === 0 && (
          <p className={t('text-zinc-600 italic text-sm', 'text-gray-400 italic text-sm')}>
            Sem itens registrados.
          </p>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-start gap-3">
              <span className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black',
                t('bg-zinc-800 text-zinc-100', 'bg-gray-100 text-gray-800')
              )}>
                {item.quantity || item.qty || 1}×
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('font-bold leading-tight',
                  compact ? 'text-base' : 'text-lg',
                  t('text-zinc-100', 'text-gray-900'))}>
                  {item.name || item.productName || 'Item'}
                </p>

                {/* Options */}
                {item.options && item.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.options.map((opt, oi) => (
                      <span key={oi} className={cn(
                        'rounded-lg px-2 py-0.5 text-xs font-semibold',
                        t('bg-zinc-800 text-zinc-400', 'bg-gray-100 text-gray-600')
                      )}>
                        {typeof opt === 'string' ? opt : opt.label || opt.name || opt.value || ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Extras */}
                {item.extras && item.extras.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.extras.map((ex, ei) => (
                      <span key={ei} className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold',
                        t('bg-orange-500/10 text-orange-400', 'bg-orange-50 text-orange-600')
                      )}>
                        <FiTag size={10} />
                        {typeof ex === 'string' ? ex : ex.name || ex.label || ex.value || ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Item note */}
                {item.note && (
                  <p className="mt-1 text-xs italic text-amber-500">↳ {item.note}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {(customerNote || internalNote) && (
        <div className={cn('space-y-2 border-t px-4 py-3',
          t('border-zinc-800', 'border-gray-100'))}>
          {customerNote && (
            <div className={cn('rounded-xl px-3 py-2',
              t('bg-amber-500/10', 'bg-amber-50'))}>
              <p className="mb-0.5 text-xs font-black uppercase tracking-wider text-amber-500">
                Obs. do cliente
              </p>
              <p className={cn('text-sm font-semibold',
                t('text-amber-300', 'text-amber-700'))}>{customerNote}</p>
            </div>
          )}
          {internalNote && (
            <div className={cn('rounded-xl px-3 py-2',
              t('bg-violet-500/10', 'bg-violet-50'))}>
              <p className="mb-0.5 text-xs font-black uppercase tracking-wider text-violet-500">
                Nota interna
              </p>
              <p className={cn('text-sm font-semibold',
                t('text-violet-300', 'text-violet-700'))}>{internalNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {nextAction ? (
        <div className="px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className={cn(
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-base font-black transition-all active:scale-[0.98] disabled:opacity-60 text-white',
              cfg.actionBg[isDark ? 'dark' : 'light']
            )}
          >
            {loading
              ? <FiRefreshCw size={18} className="animate-spin" />
              : <nextAction.icon size={18} />}
            {loading ? 'Atualizando...' : nextAction.label}
          </button>
        </div>
      ) : normalizedStatus === 'pronto' && fulfillmentType === 'delivery' ? (
        <div className="px-4 pb-4 pt-2">
          <div className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-center border-2 border-dashed',
            t('border-zinc-800 text-zinc-500', 'border-gray-200 text-gray-400')
          )}>
            <FiTruck size={14} />
            Delivery: Despache pela tela de Pedidos
          </div>
        </div>
      ) : normalizedStatus === 'pronto' ? (
        <div className="px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={handleFinish}
            disabled={loading}
            title="Finalizar pedido"
            aria-label="Finalizar pedido pronto"
            className={cn(
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-60',
              cfg.actionBg[isDark ? 'dark' : 'light']
            )}
          >
            {loading ? <FiRefreshCw size={18} className="animate-spin" /> : <FiCheckCircle size={18} />}
            {loading ? 'Finalizando...' : 'Finalizar pedido'}
          </button>
        </div>
      ) : null}
    </article>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KDSColumn({ status, orders, onUpdateStatus, compact, newIds, t, isDark }) {
  const cfg = STATUS_CFG[status]
  if (!cfg) return null
  const colColor = cfg.color[isDark ? 'dark' : 'light']
  const colBg = cfg.bg[isDark ? 'dark' : 'light']
  const colBorder = cfg.border[isDark ? 'dark' : 'light']

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 min-h-0">
      {/* Column header */}
      <div className={cn('flex items-center justify-between rounded-2xl border px-4 py-3',
        colBg, colBorder)}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className={cn('h-3 w-3 rounded-full', cfg.dot[isDark ? 'dark' : 'light'],
              cfg.pulse ? 'animate-pulse' : '')} />
          </span>
          <h2 className={cn('text-xl font-black', colColor)}>{cfg.colLabel}</h2>
        </div>
        <span className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-base font-black',
          colBg, colColor, 'border', colBorder
        )}>
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4 overflow-y-auto flex-1 pb-2 [scrollbar-width:thin]">
        {orders.length === 0 ? (
          <div className={cn(
            'flex flex-col items-center justify-center rounded-2xl border border-dashed py-14',
            t('border-zinc-800 text-zinc-700', 'border-gray-200 text-gray-400')
          )}>
            <FiPackage size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-semibold">Nenhum pedido aqui</p>
          </div>
        ) : orders.map((order) => (
          <div key={order.id} className="relative">
            <OrderCard
              order={order}
              onUpdateStatus={onUpdateStatus}
              compact={compact}
              isNew={newIds.has(order.id)}
              t={t}
              isDark={isDark}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock({ t }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={cn('flex flex-col items-end tabular-nums',
      t('text-zinc-500', 'text-gray-400'))}>
      <span className="text-xl font-black leading-none">
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="text-xs font-semibold mt-0.5 capitalize">
        {now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KitchenDisplayPage() {
  const navigate = useNavigate()
  const { user, userData } = useAuth()
  const storeId = userData?.storeId || user?.storeId || ''

  const { theme, isDark, toggleTheme, t } = useKdsTheme()
  const sound = useSoundEngine()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [compact, setCompact] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [newIds, setNewIds] = useState(new Set())
  const [storeData, setStoreData] = useState(null)

  const containerRef = useRef(null)
  const isFirstLoadRef = useRef(true)
  const prevIdsRef = useRef(new Set())
  const newIdTimers = useRef({})

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    try {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen()
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Fallback: CSS fullscreen
      setIsFullscreen(true)
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {}
    setIsFullscreen(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement || isFullscreen) exitFullscreen()
    else enterFullscreen()
  }, [isFullscreen, enterFullscreen, exitFullscreen])

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    if (!storeId) {
      setStoreData(null)
      return undefined
    }

    return onSnapshot(
      doc(db, 'stores', storeId),
      (snapshot) => {
        setStoreData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
      },
      () => {
        setStoreData(null)
      }
    )
  }, [storeId])

  // ── Firestore ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) {
      setError(new Error('Loja não identificada. Faça login novamente.'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    isFirstLoadRef.current = true

    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
      where('status', 'in', KDS_QUERY_STATUSES),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Detect truly new orders (not first load)
      if (!isFirstLoadRef.current) {
        const incoming = docs.filter(o => !prevIdsRef.current.has(o.id))
        if (incoming.length > 0) {
          sound.play('new')
          const newSet = new Set(incoming.map(o => o.id))
          setNewIds(prev => new Set([...prev, ...newSet]))
          // Clear "new" flag after 8s
          incoming.forEach(o => {
            clearTimeout(newIdTimers.current[o.id])
            newIdTimers.current[o.id] = setTimeout(() => {
              setNewIds(prev => {
                const next = new Set(prev)
                next.delete(o.id)
                return next
              })
            }, 8000)
          })
        }
      } else {
        isFirstLoadRef.current = false
      }
      prevIdsRef.current = new Set(docs.map(o => o.id))
      setOrders(docs)
      setLoading(false)
    }, (err) => {
      console.error('[KDS] Firestore error:', err)
      setError(err)
      setLoading(false)
    })

    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, retryKey])

  // ── Status update ──────────────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(async (orderId, newStatus) => {
    if (!orderId || !storeId) return
    const updateMerchantOrder = httpsCallable(functions, 'updateMerchantOrder')
    await updateMerchantOrder({
      orderId,
      action: 'updateStatus',
      status: newStatus,
    })
  }, [storeId])

  // ── Group by status ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = { confirmado: [], preparando: [], pronto: [] }
    orders.forEach(o => {
      const status = normalizeKdsStatus(o.status)
      if (map[status]) map[status].push(o)
    })

    // Sort each status column from oldest to newest
    map.confirmado.sort(compareOrdersOldestFirst)
    map.preparando.sort(compareOrdersOldestFirst)
    map.pronto.sort(compareOrdersOldestFirst)

    return map
  }, [orders])

  const totalActive = orders.length
  const storeName = getDisplayStoreName(storeData, userData)
  const logoUrl = getMerchantDisplayLogoUrl(storeData, userData)

  // ── CSS fullscreen fallback classes ───────────────────────────────────────
  const isCSSFullscreen = isFullscreen && !document.fullscreenElement

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col select-none',
        t('bg-zinc-950 text-zinc-100', 'bg-gray-50 text-gray-900'),
        isCSSFullscreen ? 'fixed inset-0 z-[9999]' : 'min-h-screen'
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className={cn(
        'shrink-0 flex items-center gap-3 px-4 py-3 border-b',
        t('bg-zinc-950/95 border-zinc-800', 'bg-white border-gray-200'),
        'backdrop-blur-xl sticky top-0 z-30'
      )}>
        {/* Left — logo + store */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1',
            t('bg-orange-500/10 text-orange-400 ring-orange-500/30', 'bg-orange-50 text-orange-600 ring-orange-200')
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <FiMonitor size={20} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight">
              Tela de Cozinha
            </p>
            <p className={cn('text-xs font-semibold mt-0.5', t('text-zinc-500', 'text-gray-500'))}>
              {loading ? 'Conectando...'
                : error ? 'Erro de conexão'
                : <>{storeName} <span className="text-orange-500 mx-1">·</span> {totalActive} pedido{totalActive !== 1 ? 's' : ''} ativo{totalActive !== 1 ? 's' : ''}</>}
            </p>
          </div>
        </div>

        {/* Center — spacer */}
        <div className="flex-1" />

        {/* Right — controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Clock */}
          <LiveClock t={t} />

          <div className={cn('w-px h-8 mx-1', t('bg-zinc-800', 'bg-gray-200'))} />

          {/* Sound */}
          <CtrlButton onClick={sound.toggle} title={sound.enabled ? 'Desativar som' : 'Ativar som'} t={t}>
            {sound.enabled ? <FiVolume2 size={16} /> : <FiVolumeX size={16} />}
          </CtrlButton>

          {/* Compact */}
          <CtrlButton onClick={() => setCompact(v => !v)} title={compact ? 'Expandido' : 'Compacto'} t={t}>
            {compact ? <FiGrid size={16} /> : <FiList size={16} />}
          </CtrlButton>

          {/* Theme */}
          <CtrlButton onClick={toggleTheme} title={isDark ? 'Modo claro' : 'Modo escuro'} t={t}>
            {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
          </CtrlButton>

          {/* Fullscreen */}
          <CtrlButton onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} t={t}>
            {isFullscreen ? <FiMinimize size={16} /> : <FiMaximize size={16} />}
          </CtrlButton>

          <div className={cn('w-px h-8 mx-1', t('bg-zinc-800', 'bg-gray-200'))} />

          {/* Painel do cliente */}
          <Link
            to="/dashboard/out-screen/customer"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition',
              t('border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400',
                'border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300 hover:text-orange-600')
            )}
          >
            <FiUsers size={13} />
            <span className="hidden sm:inline">Painel de Retirada</span>
            <FiChevronRight size={12} />
          </Link>

          {/* Back to dashboard */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition',
              t('border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
                'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900')
            )}
          >
            <FiArrowLeft size={13} />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}

      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-zinc-800 border-t-orange-500" />
          <p className={t('text-zinc-500 text-sm font-semibold', 'text-gray-500 text-sm font-semibold')}>
            Conectando ao Firestore...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className={cn('flex h-20 w-20 items-center justify-center rounded-3xl ring-1',
            t('bg-red-500/10 text-red-400 ring-red-500/20', 'bg-red-50 text-red-500 ring-red-200'))}>
            <FiAlertCircle size={36} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black">Erro ao carregar pedidos</p>
            <p className={cn('mt-2 text-sm', t('text-zinc-500', 'text-gray-500'))}>{error.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            className="flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-400 active:scale-[0.98]"
          >
            <FiRefreshCw size={16} />Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {totalActive === 0 ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6">
              <div className={cn('flex h-24 w-24 items-center justify-center rounded-3xl ring-1',
                t('bg-zinc-900 text-zinc-700 ring-zinc-800', 'bg-gray-100 text-gray-400 ring-gray-200'))}>
                <FiPackage size={44} />
              </div>
              <div className="text-center">
                <p className="text-3xl font-black">Nenhum pedido em preparo agora</p>
                <p className={cn('mt-2 text-base', t('text-zinc-600', 'text-gray-500'))}>
                  Novos pedidos aparecem aqui em tempo real.
                </p>
              </div>
            </div>
          ) : (
            /* TV: 3 cols — tablet: 1 col */
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:h-[calc(100vh-120px)]">
              {KDS_COLUMNS.map(status => (
                <KDSColumn
                  key={status}
                  status={status}
                  orders={grouped[status] || []}
                  onUpdateStatus={handleUpdateStatus}
                  compact={compact}
                  newIds={newIds}
                  t={t}
                  isDark={isDark}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className={cn(
        'shrink-0 flex items-center justify-between border-t px-5 py-2',
        t('border-zinc-800 bg-zinc-950/80', 'border-gray-200 bg-white/80')
      )}>
        <div className="flex items-center gap-4">
          {/* Status legend */}
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <div key={key} className="hidden sm:flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot[isDark ? 'dark' : 'light'])} />
              <span className={cn('text-xs font-semibold', t('text-zinc-500', 'text-gray-500'))}>
                {cfg.colLabel}
              </span>
            </div>
          ))}
        </div>
        <p className={cn('text-xs font-bold', t('text-zinc-700', 'text-gray-400'))}>
          PratoBy KDS · {theme === 'dark' ? 'Modo escuro' : 'Modo claro'}
        </p>
      </footer>
    </div>
  )
}

// ─── Small control button ──────────────────────────────────────────────────────

function CtrlButton({ onClick, title, children, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition',
        t(
          'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100',
          'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-900'
        )
      )}
    >
      {children}
    </button>
  )
}
