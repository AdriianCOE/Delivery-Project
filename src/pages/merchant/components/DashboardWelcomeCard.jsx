import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FiArrowRight,
  FiCoffee,
  FiEdit3,
  FiShoppingBag,
  FiSmile,
  FiX,
  FiZap,
} from 'react-icons/fi'

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 5) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getFirstName(user, store) {
  const name =
    user?.displayName ||
    user?.name ||
    user?.firstName ||
    store?.ownerName ||
    ''

  return String(name).trim().split(/\s+/)[0] || 'chef'
}

function getStoreName(store) {
  return store?.name || store?.storeName || store?.displayName || 'sua loja'
}

function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

const dailyMissions = [
  'Dê uma olhada nos pedidos pendentes antes do movimento começar.',
  'Confira se os produtos principais estão disponíveis no cardápio.',
  'Revise seus pagamentos e evite pedido parado por falta de confirmação.',
  'Compartilhe o QR Code do cardápio e facilite o pedido do cliente.',
  'Veja suas estatísticas e descubra o que mais vendeu no período.',
]

function getMissionOfTheDay() {
  const date = new Date()
  const index = date.getDate() % dailyMissions.length
  return dailyMissions[index]
}

export default function DashboardWelcomeCard({
  user,
  store,
  storeId,
  ordersTodayCount = 0,
  pendingOrdersCount = 0,
  scheduledTodayCount = 0,
  className = '',
}) {
  const [visible, setVisible] = useState(false)

  const storageKey = useMemo(() => {
    const uid = user?.uid || user?.id || 'anon'
    const sid = store?.id || storeId || 'store'
    return `pratoby:dashboard-welcome:${uid}:${sid}:${getTodayKey()}`
  }, [user?.uid, user?.id, store?.id, storeId])

useEffect(() => {
  let hiddenToday = false

  try {
    hiddenToday = localStorage.getItem(storageKey) === 'hidden'
  } catch {
    hiddenToday = false
  }

  if (hiddenToday) {
    setVisible(false)
    return undefined
  }

  const timer = window.setTimeout(() => {
    setVisible(true)
  }, 450)

  return () => window.clearTimeout(timer)
}, [storageKey])

const handleDismiss = () => {
  try {
    localStorage.setItem(storageKey, 'hidden')
  } catch {
    // LocalStorage indisponível não deve quebrar o dashboard.
  }

  setVisible(false)
}


  const greeting = getGreeting()
  const firstName = getFirstName(user, store)
  const storeName = getStoreName(store)
  const mission = getMissionOfTheDay()

return (
  <AnimatePresence>
    {visible ? (
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.99 }}
        transition={{
          type: 'spring',
          stiffness: 180,
          damping: 22,
          mass: 0.85,
        }}
        className={`relative overflow-hidden rounded-[2rem] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-sm dark:border-orange-400/20 dark:from-orange-500/10 dark:via-slate-950 dark:to-amber-500/10 sm:p-6 ${className}`}
      >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl" />

        <button
        type="button"
        onClick={handleDismiss}
        title="Ocultar por hoje"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-200/70 bg-white/80 text-slate-500 shadow-sm transition hover:scale-105 hover:text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
        aria-label="Ocultar mensagem de boas-vindas por hoje"
        >
        <FiX className="h-4 w-4" />
        </button>

      <div className="relative pr-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-700 shadow-sm dark:border-orange-400/20 dark:bg-white/10 dark:text-orange-200">
          <FiZap className="h-3.5 w-3.5" />
          Painel pronto
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                <FiSmile className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  {greeting}, {firstName}! 👋
                </h2>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Bora deixar a <span className="font-bold text-orange-700 dark:text-orange-200">{storeName}</span> vendendo bonito hoje?
                </p>
              </div>
            </div>

            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Seu painel está pronto para acompanhar pedidos, cuidar do cardápio,
              ver pagamentos e manter a operação redondinha sem correria.
            </p>

            <div className="mt-4 rounded-2xl border border-orange-200/70 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                  <FiCoffee className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                    Missão de hoje
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {mission}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Hoje
              </p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {ordersTodayCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                pedidos no período
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Atenção
              </p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {pendingOrdersCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                pedidos pendentes
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Agendados
              </p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {scheduledTodayCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                para hoje
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <FiShoppingBag className="h-4 w-4" />
            Ver pedidos
            <FiArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to="/dashboard/menu"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white/80 px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            <FiEdit3 className="h-4 w-4" />
            Editar cardápio
          </Link>

                    </div>
                </div>
            </motion.section>
        ) : null}
    </AnimatePresence>
    )
}