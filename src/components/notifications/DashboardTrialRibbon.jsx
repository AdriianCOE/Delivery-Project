import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { FiArrowRight, FiClock, FiShield } from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { formatBillingDate, getTrialDaysRemaining } from '../../utils/billingStatus'

function normalizeStatus(status) {
  return status === 'pending_checkout' ? 'checkout_pending' : status || ''
}

export default function DashboardTrialRibbon() {
  const { userData } = useAuth()

  const subscriptionStatus = normalizeStatus(userData?.subscriptionStatus)
  const trialEndsAt = userData?.trialEndsAt
  const isTrial = subscriptionStatus === 'trialing'

  const daysLeft = useMemo(() => {
    if (!trialEndsAt) return null
    return getTrialDaysRemaining(trialEndsAt)
  }, [trialEndsAt])

  const theme = useMemo(() => {
    if (daysLeft === null) return null

    if (daysLeft <= 0) {
      return {
        wrap: 'border-red-200 bg-red-50/90 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
        icon: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        bar: 'bg-red-500',
        label: 'Teste expirado',
      }
    }

    if (daysLeft <= 3) {
      return {
        wrap: 'border-red-200 bg-red-50/90 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
        icon: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        bar: 'bg-red-500',
        label: `Restam ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
      }
    }

    if (daysLeft <= 7) {
      return {
        wrap: 'border-amber-200 bg-amber-50/90 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
        icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        bar: 'bg-amber-500',
        label: `Restam ${daysLeft} dias`,
      }
    }

    return {
      wrap: 'border-blue-200 bg-blue-50/90 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300',
      icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      bar: 'bg-blue-500',
      label: `Restam ${daysLeft} dias`,
    }
  }, [daysLeft])

  if (!isTrial || daysLeft === null || !theme) return null

  const elapsedPercent = Math.max(0, Math.min(100, ((14 - daysLeft) / 14) * 100))

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`border-b px-4 py-2.5 transition-colors sm:px-6 lg:px-8 ${theme.wrap}`}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}>
            {daysLeft <= 3 ? <FiClock size={15} /> : <FiShield size={15} />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black sm:text-sm">
              <span>Teste grátis ativo</span>
              <span className="hidden text-current/35 sm:inline">·</span>
              <span>{theme.label}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-current/75 sm:text-xs">
              Primeira cobrança prevista em {formatBillingDate(trialEndsAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:min-w-[17rem]">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/70 dark:bg-zinc-900/70">
            <div
              className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
              style={{ width: `${elapsedPercent}%` }}
            />
          </div>

          <Link
            to="/dashboard/billing"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-black text-[#111827] shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:text-[#f97316] dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:hover:text-[#f97316]"
          >
            Ver assinatura
            <FiArrowRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
