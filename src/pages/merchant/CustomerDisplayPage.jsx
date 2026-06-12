/**
 * Painel do Cliente — Customer Display
 * PratoBy · Tela de TV para o Balcão
 *
 * Renderiza FORA do DashboardLayout — 100vw × 100vh.
 *
 * PRIVACIDADE: Este painel exibe APENAS número/senha e status.
 * Nunca exibe: nome, telefone, endereço, itens, valor, pagamento, observações.
 *
 * Pedidos "pronto" somem após READY_TTL_MINUTES (45min) usando updatedAt ou createdAt.
 *
 * TODO P1 publicDisplays:
 * materializar publicDisplays/{storeId}/activeOrders/{orderId} apenas com
 * orderNumber, status, displayStatus, timestamps e type, sem PII.
 *
 * Layout:
 *   Desktop/TV: Em preparo (40%) | Prontos para retirada (60%)
 *   Mobile/tablet: empilhado, Prontos primeiro
 *
 * Pico: adapta card size automaticamente por quantidade. Máx. visível = 12 por seção.
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import {
  FiCheck,
  FiMaximize,
  FiMinimize,
  FiPackage,
  FiArrowLeft,
  FiSun,
  FiMoon,
  FiRefreshCw,
  FiAlertCircle,
  FiMonitor,
  FiVolume2,
  FiVolumeX,
  FiClock,
  FiShoppingBag,
  FiBell,
} from 'react-icons/fi'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import {
  getDisplayStoreName,
  getMerchantDisplayLogoUrl,
} from '../../utils/merchantDisplayBranding'
import { UPGRADE_PROMPT_COPY, hasPlanFeature } from '../../utils/planCatalog'

// ─── Config ───────────────────────────────────────────────────────────────────

const READY_TTL_MINUTES = 45
const CUSTOMER_THEME_KEY = 'pratoby_kds_theme'

/** Máximo de cards visíveis por seção antes de mostrar "+X na fila" */
const MAX_VISIBLE_READY     = 12
const MAX_VISIBLE_PREPARING = 12

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes) { return classes.filter(Boolean).join(' ') }

function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}

function isWithinTTL(order) {
  const ts = order.updatedAt || order.createdAt
  if (!ts) return true
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return (Date.now() - d.getTime()) < READY_TTL_MINUTES * 60 * 1000
  } catch { return true }
}

function fmtReadyTime(order) {
  const ts = order.updatedAt || order.createdAt
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function orderNum(order) {
  const n = order.orderNumber || order.ticketNumber || order.number
    || String(order.id).slice(-4).toUpperCase()
  return String(n).startsWith('#') ? n : `#${String(n).toUpperCase()}`
}

function isDeliveryOrder(order) {
  const type = String(order?.deliveryType || order?.orderType || order?.type || '').toLowerCase().trim()
  return order?.isDelivery === true || ['delivery', 'entrega'].includes(type)
}

/** Retorna o label de tipo do pedido para exibição discreta. Nunca expõe dados sensíveis. */
function orderTypeLabel(order) {
  if (isDeliveryOrder(order)) return null // delivery não aparece aqui
  const type = String(order?.deliveryType || order?.orderType || order?.type || '').toLowerCase().trim()
  if (['local', 'mesa', 'table', 'dine_in', 'dine-in'].includes(type)) return 'Local'
  return 'Retirada'
}

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

// ─── Adaptive layout helpers ──────────────────────────────────────────────────

/**
 * Retorna classes de grid e tamanho de card para a seção Prontos.
 * Metas: 1-3 → enorme (TV de longe), 4-8 → médio, 9+ → compacto legível.
 */
function readyLayoutConfig(count) {
  if (count <= 1)  return { grid: 'grid-cols-1 max-w-md mx-auto w-full', size: 'xl' }
  if (count <= 2)  return { grid: 'grid-cols-2', size: 'xl' }
  if (count <= 3)  return { grid: 'grid-cols-3', size: 'lg' }
  if (count <= 6)  return { grid: 'grid-cols-2 sm:grid-cols-3', size: 'md' }
  if (count <= 9)  return { grid: 'grid-cols-3', size: 'md' }
  return               { grid: 'grid-cols-3 sm:grid-cols-4', size: 'sm' }
}

/**
 * Retorna classes de grid para a seção Em Preparo.
 * Números discretos — cliente só precisa saber que está sendo feito.
 */
function preparingGridCols(count) {
  if (count <= 4)  return 'grid-cols-2 sm:grid-cols-4'
  if (count <= 8)  return 'grid-cols-3 sm:grid-cols-4'
  if (count <= 12) return 'grid-cols-4'
  return 'grid-cols-4 sm:grid-cols-6'
}

// ─── Theme hook ────────────────────────────────────────────────────────────────

function useKdsTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(CUSTOMER_THEME_KEY) || 'dark' } catch { return 'dark' }
  })
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(CUSTOMER_THEME_KEY, next) } catch {}
      return next
    })
  }, [])
  const isDark = theme === 'dark'
  const t = (dark, light) => isDark ? dark : light
  return { theme, isDark, toggleTheme, t }
}

// ─── Sound engine ─────────────────────────────────────────────────────────────

function useSoundEngine() {
  const ctxRef = useRef(null)
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('pratoby_kds_sound') !== 'false' } catch { return true }
  })

  const play = useCallback(() => {
    if (!enabled) return
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      // Ascending chime — C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const start = ctx.currentTime + i * 0.16
        gain.gain.setValueAtTime(0.4, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4)
        osc.start(start); osc.stop(start + 0.4)
      })
    } catch {}
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('pratoby_kds_sound', String(next)) } catch {}
      if (next) setTimeout(() => play(), 50)
      return next
    })
  }, [play])

  return { enabled, toggle, play }
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock({ t }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={cn('text-right tabular-nums leading-tight', t('text-zinc-400', 'text-gray-500'))}>
      <p className="text-2xl font-black">
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-xs font-semibold capitalize">
        {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
      </p>
    </div>
  )
}

// ─── TTL countdown display ────────────────────────────────────────────────────

function TTLCountdown({ order, t, compact = false }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    function calc() {
      const ts = order.updatedAt || order.createdAt
      if (!ts) { setRemaining(''); return }
      const d = ts.toDate ? ts.toDate() : new Date(ts)
      const elapsed = Math.floor((Date.now() - d.getTime()) / 60000)
      const rem = READY_TTL_MINUTES - elapsed
      setRemaining(rem > 0 ? `${rem}min` : '')
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [order])

  if (!remaining) return null
  return (
    <p className={cn(
      'inline-flex items-center justify-center gap-1 tabular-nums',
      compact ? 'text-[10px] font-bold' : 'text-sm font-semibold',
      t('text-emerald-500', 'text-emerald-600')
    )}>
      <FiClock size={compact ? 10 : 12} className="shrink-0" />
      <span>{remaining}</span>
    </p>
  )
}

// ─── Overflow Indicator ───────────────────────────────────────────────────────

function OverflowBadge({ count, t }) {
  if (count <= 0) return null
  return (
    <div className={cn(
      'col-span-full mt-1 flex items-center justify-center rounded-2xl border-2 border-dashed py-3',
      t('border-zinc-700 text-zinc-500', 'border-gray-300 text-gray-400')
    )}>
      <p className="text-base font-black tracking-wide">
        +{count} {count === 1 ? 'pedido' : 'pedidos'} na fila
      </p>
    </div>
  )
}

// ─── Preparing Order Card ──────────────────────────────────────────────────────
// Discreto — número grande para visibilidade, sem dados sensíveis.

function PreparingCard({ order, isNew, t }) {
  const num = orderNum(order)
  const typeLabel = orderTypeLabel(order)

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 sm:p-4 text-center transition-all duration-500',
      t('border-zinc-800 bg-zinc-900/60', 'border-gray-200 bg-gray-50/60'),
      isNew && 'ring-4 ring-amber-500/80 border-amber-500/50 scale-105',
      isNew && t('ring-offset-2 ring-offset-zinc-950', 'ring-offset-2 ring-offset-gray-100'),
    )}>
      {/* Tipo discreto */}
      {typeLabel && (
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
          t('bg-zinc-800 text-zinc-500', 'bg-gray-100 text-gray-400')
        )}>
          {typeLabel}
        </span>
      )}

      {/* Número do pedido */}
      <p className={cn(
        'font-black tracking-tight leading-none tabular-nums',
        'text-3xl sm:text-4xl',
        t('text-zinc-400', 'text-gray-400')
      )}>
        {num}
      </p>
    </div>
  )
}

// ─── Ready Order Card ─────────────────────────────────────────────────────────
// Destaque máximo para TV. Tamanho varia por `size` prop: 'xl' | 'lg' | 'md' | 'sm'.

const READY_SIZE_STYLES = {
  xl: {
    wrapper: 'gap-4 rounded-3xl p-6 sm:p-8',
    icon: 'h-16 w-16 rounded-2xl',
    iconSize: 30,
    num: 'text-[clamp(4rem,8vw,8.5rem)]',
    label: 'text-lg',
    time: 'text-base',
  },
  lg: {
    wrapper: 'gap-3 rounded-3xl p-5 sm:p-6',
    icon: 'h-14 w-14 rounded-2xl',
    iconSize: 26,
    num: 'text-[clamp(3.4rem,6.5vw,6.75rem)]',
    label: 'text-base',
    time: 'text-sm',
  },
  md: {
    wrapper: 'gap-3 rounded-2xl p-5',
    icon: 'h-12 w-12 rounded-xl',
    iconSize: 24,
    num: 'text-4xl sm:text-5xl lg:text-6xl',
    label: 'text-base',
    time: 'text-sm',
  },
  sm: {
    wrapper: 'gap-2 rounded-2xl p-4',
    icon: 'h-10 w-10 rounded-xl',
    iconSize: 20,
    num: 'text-3xl sm:text-4xl',
    label: 'text-sm',
    time: null, // sem tempo no compacto extremo
  },
}

function ReadyCard({ order, isNew, t, isDark, size = 'lg' }) {
  const num = orderNum(order)
  const readyAt = fmtReadyTime(order)
  const s = READY_SIZE_STYLES[size] || READY_SIZE_STYLES.lg
  const isCompact = size === 'sm'

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center border transition-all duration-500 shadow-lg',
      s.wrapper,
      t('border-emerald-500/25 bg-emerald-500/10 shadow-emerald-950/20', 'border-emerald-200 bg-emerald-50 shadow-emerald-200/40'),
      // Destaque para recém-prontos: ring pulsante ao invés de pulsar o card todo
      isNew && 'ring-4 ring-emerald-400',
      isNew && t('ring-offset-2 ring-offset-zinc-950', 'ring-offset-2 ring-offset-gray-100'),
    )}>
      {/* Ícone de check */}
      <div className={cn(
        'flex shrink-0 items-center justify-center',
        s.icon,
        t('bg-emerald-500/20 text-emerald-400', 'bg-emerald-100 text-emerald-600')
      )}>
        <FiCheck size={s.iconSize} strokeWidth={2.5} />
      </div>

      {/* Número — muito grande para TV */}
      <p className={cn(
        'font-black tracking-tight leading-none tabular-nums',
        s.num,
        t('text-emerald-400', 'text-emerald-600'),
        isNew && 'animate-bounce'
      )}>
        {num}
      </p>

      {/* Label e hora */}
      <div className="flex flex-col items-center space-y-0.5 text-center">
        <p className={cn('font-black', s.label, t('text-emerald-300', 'text-emerald-700'))}>
          Pedido pronto!
        </p>

        {readyAt && !isCompact && (
          <p className={cn('font-semibold', s.time, t('text-emerald-600', 'text-emerald-500'))}>
            Pronto às {readyAt}
          </p>
        )}

        {!isCompact && <TTLCountdown order={order} t={t} compact={size === 'sm'} />}
      </div>
    </div>
  )
}

// ─── Control Button ────────────────────────────────────────────────────────────

function CtrlBtn({ onClick, title, children, t }) {
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle, t, size = 'md', isPremiumReady = false, compact = false }) {
  const isLg = size === 'lg'
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center rounded-3xl border border-dashed transition-all duration-300',
      compact ? 'min-h-[150px] p-5' : 'flex-1 p-8',
      t('border-zinc-800/80 bg-zinc-900/10', 'border-gray-200/80 bg-gray-50/20'),
      isPremiumReady && t('border-emerald-500/20 bg-emerald-500/[0.02]', 'border-emerald-200 bg-emerald-50/[0.02]')
    )}>
      {Icon && (
        <div className={cn(
          'flex items-center justify-center rounded-2xl mb-4 shrink-0 transition-transform duration-300 hover:scale-105',
          compact ? 'h-10 w-10' : isLg ? 'h-16 w-16' : 'h-12 w-12',
          isPremiumReady
            ? t('bg-emerald-500/10 text-emerald-400', 'bg-emerald-50 text-emerald-600')
            : t('bg-zinc-900 text-zinc-500', 'bg-zinc-100 text-zinc-400')
        )}>
          <Icon size={compact ? 18 : isLg ? 28 : 22} />
        </div>
      )}
      <div className="space-y-2 max-w-sm">
        <h3 className={cn(
          'font-black tracking-tight leading-snug',
          compact ? 'text-base sm:text-lg' : isLg ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
          isPremiumReady
            ? t('text-emerald-400', 'text-emerald-600')
            : t('text-zinc-300', 'text-gray-700')
        )}>
          {title}
        </h3>
        {subtitle && (
          <p className={cn(
            'font-medium leading-relaxed',
            isLg ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
            isPremiumReady
              ? t('text-emerald-600/80', 'text-emerald-700/80')
              : t('text-zinc-500', 'text-gray-500')
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDisplayPage() {
  const { user, userData } = useAuth()
  const storeId = userData?.storeId || user?.storeId || ''

  const { isDark, toggleTheme, t } = useKdsTheme()
  const sound = useSoundEngine()

  const [allOrders, setAllOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [newIds, setNewIds] = useState(new Set())
  const [newPrepIds, setNewPrepIds] = useState(new Set())
  const [storeData, setStoreData] = useState(undefined)

  const containerRef = useRef(null)
  const isFirstLoadRef = useRef(true)
  const prevReadyIdsRef = useRef(new Set())
  const prevPrepIdsRef = useRef(new Set())
  const newIdTimers = useRef({})
  const newPrepIdTimers = useRef({})

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement || isFullscreen) {
      try { await document.exitFullscreen() } catch {}
      setIsFullscreen(false)
    } else {
      try {
        await (containerRef.current?.requestFullscreen?.() || document.documentElement.requestFullscreen())
      } catch { setIsFullscreen(true) }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Store data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) { setStoreData(null); return undefined }
    return onSnapshot(
      doc(db, 'stores', storeId),
      (snapshot) => {
        setStoreData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
      },
      () => { setStoreData(null) }
    )
  }, [storeId])

  const storeLoaded = storeData !== undefined
  const pickupDisplayAllowed = storeLoaded && storeData
    ? hasPlanFeature(storeData, 'pickupDisplay')
    : false

  // ── Firestore listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) { setError(new Error('Loja não identificada.')); setLoading(false); return }
    if (!storeLoaded) { setLoading(true); return }
    if (!pickupDisplayAllowed) {
      setAllOrders([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true); setError(null)
    isFirstLoadRef.current = true

    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
      where('status', 'in', ['preparando', 'pronto']),
      where('createdAt', '>=', todayStart()),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // IDs de prontos não-delivery
      const incomingReadyIds = docs
        .filter(o => o.status === 'pronto' && !isDeliveryOrder(o))
        .map(o => o.id)

      // IDs de preparando não-delivery
      const incomingPrepIds = docs
        .filter(o => o.status === 'preparando' && !isDeliveryOrder(o))
        .map(o => o.id)

      if (!isFirstLoadRef.current) {
        const newReady = incomingReadyIds.filter(id => !prevReadyIdsRef.current.has(id))
        const newPrep = incomingPrepIds.filter(id => !prevPrepIdsRef.current.has(id))

        if (newReady.length > 0) {
          // Som toca uma única vez por snapshot, mesmo que N pedidos fiquem prontos
          sound.play()
          setNewIds(prev => new Set([...prev, ...newReady]))
          newReady.forEach(id => {
            clearTimeout(newIdTimers.current[id])
            // 8 segundos de destaque — suficiente sem poluir
            newIdTimers.current[id] = setTimeout(() => {
              setNewIds(prev => { const s = new Set(prev); s.delete(id); return s })
            }, 8000)
          })
        }

        if (newPrep.length > 0) {
          setNewPrepIds(prev => new Set([...prev, ...newPrep]))
          newPrep.forEach(id => {
            clearTimeout(newPrepIdTimers.current[id])
            // 8 segundos de destaque
            newPrepIdTimers.current[id] = setTimeout(() => {
              setNewPrepIds(prev => { const s = new Set(prev); s.delete(id); return s })
            }, 8000)
          })
        }
      } else {
        isFirstLoadRef.current = false
      }

      prevReadyIdsRef.current = new Set(incomingReadyIds)
      prevPrepIdsRef.current = new Set(incomingPrepIds)
      setAllOrders(docs)
      setLoading(false)
    }, (err) => {
      setError(err); setLoading(false)
    })

    return () => unsub()
  }, [storeId, retryKey, storeLoaded, pickupDisplayAllowed])

  // ── Auto-refresh TTL every 2 min ───────────────────────────────────────────
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(v => v + 1), 120000)
    return () => clearInterval(id)
  }, [])

  // ── Filtered orders ────────────────────────────────────────────────────────
  const visibleOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (isDeliveryOrder(order)) return false       // delivery nunca aparece aqui
      if (order.status === 'preparando') return true  // preparando nunca some por TTL
      return isWithinTTL(order)                       // pronto: respeita TTL de 45min
    })
  }, [allOrders, tick]) // eslint-disable-line

  const preparingOrders = useMemo(
    () => visibleOrders.filter(o => o.status === 'preparando').sort(compareOrdersOldestFirst),
    [visibleOrders]
  )
  const readyOrders = useMemo(
    () => visibleOrders.filter(o => o.status === 'pronto').sort(compareOrdersOldestFirst),
    [visibleOrders]
  )

  // Fatia visível com overflow badge
  const visibleReady     = readyOrders.slice(0, MAX_VISIBLE_READY)
  const hiddenReadyCount = Math.max(0, readyOrders.length - MAX_VISIBLE_READY)
  const visiblePreparing     = preparingOrders.slice(0, MAX_VISIBLE_PREPARING)
  const hiddenPreparingCount = Math.max(0, preparingOrders.length - MAX_VISIBLE_PREPARING)

  // Layout adaptativo para prontos
  const { grid: readyGrid, size: readySize } = readyLayoutConfig(visibleReady.length)
  const prepGrid = preparingGridCols(visiblePreparing.length)

  const storeName = getDisplayStoreName(storeData, userData)
  const logoUrl   = getMerchantDisplayLogoUrl(storeData, userData)
  const isCSSFullscreen = isFullscreen && !document.fullscreenElement

  if (storeLoaded && storeData && !pickupDisplayAllowed) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center px-4', t('bg-zinc-950 text-zinc-100', 'bg-gray-50 text-gray-900'))}>
        <div className={cn('max-w-md rounded-3xl border p-6 text-center shadow-sm', t('border-zinc-800 bg-zinc-900', 'border-orange-100 bg-white'))}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
            <FiMonitor size={24} />
          </div>
          <h1 className="mt-5 text-xl font-black">{UPGRADE_PROMPT_COPY.title}</h1>
          <p className={cn('mt-2 text-sm font-semibold leading-6', t('text-zinc-300', 'text-gray-600'))}>
            {UPGRADE_PROMPT_COPY.description}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
            >
              {UPGRADE_PROMPT_COPY.primaryAction}
            </Link>
            <Link
              to="/dashboard"
              className={cn('inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-black transition', t('border-zinc-700 text-zinc-200 hover:bg-zinc-800', 'border-gray-200 text-gray-700 hover:bg-gray-50'))}
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
        'shrink-0 flex items-center gap-4 px-5 py-4 border-b sticky top-0 z-30 backdrop-blur-xl',
        t('bg-zinc-950/95 border-zinc-800', 'bg-white/95 border-gray-200')
      )}>
        {/* Logo + título */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1',
            t('bg-orange-500/10 text-orange-400 ring-orange-500/30', 'bg-orange-50 text-orange-500 ring-orange-200')
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <FiMonitor size={22} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xl font-black leading-tight tracking-tight">
                Painel de Retirada
              </p>
              {/* Ao vivo badge */}
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-500 ring-1 ring-inset ring-red-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Ao vivo
              </span>
            </div>

            <p className={cn('text-sm font-semibold mt-1 truncate', t('text-zinc-500', 'text-gray-500'))}>
              {storeName}
              <span className={cn('mx-2', t('text-zinc-500', 'text-gray-300'))}>·</span>
              <span className={t('text-yellow-400', 'text-yellow-600')}>
                {preparingOrders.length} em preparo
              </span>
              <span className={cn('mx-2', t('text-zinc-500', 'text-gray-300'))}>·</span>
              <span className={t('text-emerald-400', 'text-emerald-600')}>
                {readyOrders.length} pronto{readyOrders.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Relógio */}
        <LiveClock t={t} />

        {/* Controles */}
        <div className="flex items-center gap-2">
          <CtrlBtn onClick={sound.toggle} title={sound.enabled ? 'Desativar som' : 'Ativar som'} t={t}>
            {sound.enabled ? <FiVolume2 size={16} /> : <FiVolumeX size={16} />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleTheme} title="Alternar tema" t={t}>
            {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} t={t}>
            {isFullscreen ? <FiMinimize size={16} /> : <FiMaximize size={16} />}
          </CtrlBtn>
          <Link
            to="/dashboard/"
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition',
              t(
                'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
                'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
              )
            )}
          >
            <FiArrowLeft size={13} />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
        </div>
      </header>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-800 border-t-orange-500" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <FiAlertCircle size={48} className="text-red-400" />
          <p className="text-2xl font-black text-center">Erro ao carregar</p>
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            className="flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 font-black text-white hover:bg-orange-400"
          >
            <FiRefreshCw size={16} /> Tentar novamente
          </button>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <main className="flex-1 overflow-y-auto p-5 sm:p-8 pratoby-scrollbar">
          {/*
            Layout: mobile empilha Prontos primeiro.
            Desktop/TV: Em preparo 40% | Prontos 60%
            Grid com order- para mobile (ready aparece acima)
          */}
          <div className="grid min-h-full grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,2fr)] lg:gap-7">

            {/* ── Em preparo — mobile: order-2, desktop: order-1 ─────────── */}
            <section className="flex flex-col order-2 min-h-0 lg:order-1">
              <div className={cn(
                'flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 mb-6 shrink-0',
                t('bg-zinc-900/40 border-zinc-800/80 text-zinc-400', 'bg-white border-gray-200 text-gray-500')
              )}>
                <FiClock size={16} className="shrink-0" />
                <h2 className="min-w-0 truncate text-base font-black uppercase tracking-[0.12em] sm:text-lg sm:tracking-[0.15em]">
                  Em preparo
                </h2>
                <span className={cn(
                  'ml-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border px-1.5 text-xs font-black',
                  t('bg-zinc-800 border-zinc-700 text-zinc-400', 'bg-gray-100 border-gray-200 text-gray-600')
                )}>
                  {preparingOrders.length}
                </span>
              </div>

              {preparingOrders.length === 0 ? (
                <EmptyState
                  icon={FiClock}
                  title="Nenhum pedido em preparo"
                  subtitle="Os pedidos em produção aparecerão aqui."
                  t={t}
                  compact
                />
              ) : (
                <div className={cn('grid gap-3', prepGrid)}>
                  {visiblePreparing.map(order => (
                    <PreparingCard key={order.id} order={order} isNew={newPrepIds.has(order.id)} t={t} />
                  ))}
                  <OverflowBadge count={hiddenPreparingCount} t={t} />
                </div>
              )}
            </section>

            {/* ── Prontos para retirada — mobile: order-1, desktop: order-2 */}
            <section className={cn(
              'flex flex-col order-1 min-h-[42vh] lg:order-2 lg:min-h-0',
              'border-b-2 lg:border-b-0 lg:border-l-2 pb-6 lg:pb-0 lg:pl-7 border-dashed',
              t('border-zinc-800', 'border-gray-200')
            )}>
              <div className={cn(
                'flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 mb-6 shrink-0',
                t('bg-emerald-500/10 border-emerald-500/20 text-emerald-400', 'bg-emerald-50 border-emerald-200 text-emerald-700')
              )}>
                <FiBell size={16} className="shrink-0" />
                <h2 className="min-w-0 truncate text-base font-black uppercase tracking-[0.12em] sm:text-lg sm:tracking-[0.15em]">
                  Prontos para retirada
                </h2>
                <span className={cn(
                  'ml-1 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border px-1.5 text-xs font-black',
                  t('bg-emerald-500/20 border-emerald-500/30 text-emerald-400', 'bg-emerald-100 border-emerald-200 text-emerald-700')
                )}>
                  {readyOrders.length}
                </span>
              </div>

              {readyOrders.length === 0 ? (
                <EmptyState
                  icon={FiBell}
                  title="Aguardando pedidos prontos"
                  subtitle="Assim que um pedido ficar pronto, o número aparecerá aqui."
                  t={t}
                  size="lg"
                  isPremiumReady={true}
                />
              ) : (
                <div className={cn('grid gap-4', readyGrid)}>
                  {visibleReady.map(order => (
                    <ReadyCard
                      key={order.id}
                      order={order}
                      isNew={newIds.has(order.id)}
                      t={t}
                      isDark={isDark}
                      size={readySize}
                    />
                  ))}
                  <OverflowBadge count={hiddenReadyCount} t={t} />
                </div>
              )}
            </section>

          </div>
        </main>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className={cn(
        'shrink-0 px-6 py-4 border-t',
        t('bg-zinc-950 border-zinc-900', 'bg-gray-100 border-gray-200')
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className={cn('text-xs font-black uppercase tracking-widest', t('text-zinc-700', 'text-gray-400'))}>
            PratoBy · Painel de Retirada
          </p>
          <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold', t('text-zinc-500', 'text-gray-400'))}>
            <span> Acompanhe seu número no balcão.</span>
            <span> Pedidos prontos ficam visíveis por {READY_TTL_MINUTES} minutos.</span>
            <span> Não encontrou seu número? Fale com o atendente.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
