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
} from 'react-icons/fi'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Config ───────────────────────────────────────────────────────────────────

const READY_TTL_MINUTES = 45
const CUSTOMER_THEME_KEY = 'pratoby_kds_theme'

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

// ─── Theme hook (shared with KDS) ─────────────────────────────────────────────

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
      if (next) {
        // Run a small timeout so the state updates, but because we are in a user interaction event, 
        // AudioContext should unlock. We call play directly.
        setTimeout(() => play(), 50)
      }
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

function TTLCountdown({ order, t }) {
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
    <p className={cn('text-sm font-semibold flex items-center gap-1',
      t('text-emerald-600', 'text-emerald-700'))}>
      <FiClock size={12} />
      Disponível por {remaining}
    </p>
  )
}

// ─── Ready Order Card ─────────────────────────────────────────────────────────

function ReadyCard({ order, isNew, t, isDark }) {
  const num = orderNum(order)
  const readyAt = fmtReadyTime(order)

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-4 rounded-3xl border-2 p-6 sm:p-8 text-center transition-all',
      t('border-emerald-500/40 bg-emerald-500/10', 'border-emerald-400 bg-emerald-50'),
      isNew && 'ring-4 ring-emerald-400 ring-offset-2',
      isNew && t('ring-offset-zinc-950', 'ring-offset-gray-100'),
      isNew && 'animate-pulse'
    )}>
      {/* Check icon */}
      <div className={cn(
        'flex h-16 w-16 items-center justify-center rounded-2xl',
        t('bg-emerald-500/20 text-emerald-400', 'bg-emerald-100 text-emerald-600')
      )}>
        <FiCheck size={32} strokeWidth={2.5} />
      </div>

      {/* Number — very large for TV */}
      <p className={cn(
        'font-black tracking-tight leading-none tabular-nums',
        'text-5xl sm:text-6xl lg:text-7xl',
        t('text-emerald-400', 'text-emerald-600')
      )}>
        {num}
      </p>

      <div className="space-y-1">
        <p className={cn('text-lg font-black', t('text-emerald-300', 'text-emerald-700'))}>
          Pronto para retirada!
        </p>
        {readyAt && (
          <p className={cn('text-sm font-semibold', t('text-emerald-600', 'text-emerald-500'))}>
            Ficou pronto às {readyAt}
          </p>
        )}
        <TTLCountdown order={order} t={t} />
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

  const containerRef = useRef(null)
  const prevIdsRef = useRef(new Set())
  const newIdTimers = useRef({})

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

  // ── Firestore ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) { setError(new Error('Loja não identificada.')); setLoading(false); return }
    setLoading(true); setError(null)

    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
      where('status', '==', 'pronto'),
      where('createdAt', '>=', todayStart()),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (prevIdsRef.current.size > 0) {
        const incoming = docs.filter(o => !prevIdsRef.current.has(o.id))
        if (incoming.length > 0) {
          sound.play()
          const newSet = new Set(incoming.map(o => o.id))
          setNewIds(prev => new Set([...prev, ...newSet]))
          incoming.forEach(o => {
            clearTimeout(newIdTimers.current[o.id])
            newIdTimers.current[o.id] = setTimeout(() => {
              setNewIds(prev => { const s = new Set(prev); s.delete(o.id); return s })
            }, 12000)
          })
        }
      }
      prevIdsRef.current = new Set(docs.map(o => o.id))
      setAllOrders(docs)
      setLoading(false)
    }, (err) => {
      setError(err); setLoading(false)
    })

    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, retryKey])



  // ── Auto-refresh TTL every 2min ────────────────────────────────────────────
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(v => v + 1), 120000)
    return () => clearInterval(id)
  }, [])
  // re-compute when tick changes
  const visibleOrders = useMemo(() => allOrders.filter(isWithinTTL), [allOrders, tick]) // eslint-disable-line

  const storeName = userData?.storeName || userData?.name || 'PratoBy'
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
        'shrink-0 flex items-center gap-4 px-5 py-4 border-b sticky top-0 z-30 backdrop-blur-xl',
        t('bg-zinc-950/95 border-zinc-800', 'bg-white/95 border-gray-200')
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1',
            t('bg-orange-500/10 text-orange-400 ring-orange-500/30', 'bg-orange-50 text-orange-500 ring-orange-200')
          )}>
            <FiMonitor size={22} />
          </div>
          <div>
            <p className="text-lg font-black leading-tight">
              {storeName} <span className="text-orange-500">·</span>{' '}
              <span className={t('text-zinc-400', 'text-gray-500')}>Retirada</span>
            </p>
            <p className={cn('text-xs font-semibold', t('text-zinc-600', 'text-gray-400'))}>
              {visibleOrders.length > 0
                ? `${visibleOrders.length} pedido${visibleOrders.length !== 1 ? 's' : ''} pronto${visibleOrders.length !== 1 ? 's' : ''} para retirada`
                : 'Aguardando pedidos...'}
            </p>
          </div>
        </div>

        {/* Clock */}
        <LiveClock t={t} />

        {/* Controls */}
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
            to="/dashboard/out-screen"
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition',
              t('border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100',
                'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900')
            )}
          >
            <FiArrowLeft size={13} />
            <span className="hidden sm:inline">Cozinha</span>
          </Link>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-800 border-t-orange-500" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <FiAlertCircle size={48} className="text-red-400" />
          <p className="text-2xl font-black text-center">Erro ao carregar</p>
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            className="flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 font-black text-white hover:bg-orange-400"
          >
            <FiRefreshCw size={16} />Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          {visibleOrders.length === 0 ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-8">
              <div className={cn(
                'flex h-28 w-28 items-center justify-center rounded-3xl ring-1',
                t('bg-zinc-900 text-zinc-700 ring-zinc-800', 'bg-gray-100 text-gray-400 ring-gray-200')
              )}>
                <FiPackage size={52} />
              </div>
              <div className="text-center">
                <p className={cn('text-4xl font-black', t('text-zinc-300', 'text-gray-700'))}>
                  Aguarde...
                </p>
                <p className={cn('mt-3 text-lg font-semibold', t('text-zinc-600', 'text-gray-400'))}>
                  Seu pedido aparecerá aqui quando estiver pronto.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className={cn(
                'mb-6 text-center text-sm font-black uppercase tracking-widest',
                t('text-zinc-600', 'text-gray-400')
              )}>
                🔔 Retire seu pedido no balcão
              </p>
              {/* Grid: adapts from 1 to 6 columns based on count */}
              <div className={cn(
                'grid gap-5',
                visibleOrders.length === 1 ? 'grid-cols-1 max-w-sm mx-auto'
                  : visibleOrders.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                  : visibleOrders.length <= 4 ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              )}>
                {visibleOrders.map(order => (
                  <ReadyCard
                    key={order.id}
                    order={order}
                    isNew={newIds.has(order.id)}
                    t={t}
                    isDark={isDark}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className={cn(
        'shrink-0 border-t px-5 py-2 flex items-center justify-between',
        t('border-zinc-800 bg-zinc-950/80', 'border-gray-200 bg-white/80')
      )}>
        <p className={cn('text-xs font-bold', t('text-zinc-700', 'text-gray-400'))}>
          PratoBy · Painel do Cliente
        </p>
        <p className={cn('text-xs font-semibold', t('text-zinc-700', 'text-gray-400'))}>
          Pedidos prontos ficam visíveis por {READY_TTL_MINUTES} minutos
        </p>
      </footer>
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
