import { useCallback, useEffect, useState } from 'react'
import { FiBell, FiX } from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'
import { requestBrowserNotificationPermission } from '../../utils/browserNotifications'

const DISMISS_KEY = 'pratoby_notification_prompt_dismissed_v1'

function canShowNotificationPrompt() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    window.Notification.permission === 'default'
  )
}

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, 'true')
  } catch {
    // localStorage can be unavailable in private or hardened browsers.
  }
}

export default function NotificationsOnboardingBanner() {
  const { isAdmin, role, userData } = useAuth()
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)

  const userIsAdmin =
    isAdmin === true ||
    role === 'admin' ||
    role === 'developer' ||
    userData?.role === 'admin' ||
    userData?.role === 'developer'

  useEffect(() => {
    if (userIsAdmin || !canShowNotificationPrompt() || isDismissed()) {
      setVisible(false)
      return
    }

    setVisible(true)
  }, [userIsAdmin])

  const dismiss = useCallback(() => {
    markDismissed()
    setVisible(false)
  }, [])

  const requestPermission = useCallback(async () => {
    setRequesting(true)
    try {
      const permission = await requestBrowserNotificationPermission()
      if (permission === 'granted') {
        markDismissed()
        setVisible(false)
        return
      }

      if (permission === 'denied') {
        setDenied(true)
      }
    } finally {
      setRequesting(false)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="border-b border-orange-100 bg-orange-50/80 px-4 py-3 text-orange-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#f97316] shadow-sm ring-1 ring-orange-100 dark:bg-zinc-950 dark:ring-zinc-800">
            <FiBell size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black">
              Ative as notificações para saber imediatamente quando um pedido chegar.
            </p>
            {denied && (
              <p className="mt-1 text-xs font-semibold text-orange-800 dark:text-zinc-300">
                Para ativar depois, clique no cadeado na barra do navegador.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          {!denied && (
            <button
              type="button"
              onClick={requestPermission}
              disabled={requesting}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f97316] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requesting ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-orange-900 ring-1 ring-orange-100 transition hover:text-[#f97316] dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800"
          >
            {denied ? 'Fechar' : 'Agora não'}
            <FiX size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
