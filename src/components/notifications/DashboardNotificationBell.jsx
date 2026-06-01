import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { FiAlertCircle, FiAlertTriangle, FiBell, FiCheck, FiInfo, FiSettings, FiX } from 'react-icons/fi'

import {
  getBrowserNotificationPermission,
  isBrowserNotificationsSupported,
  requestBrowserNotificationPermission,
} from '../../utils/browserNotifications'
import {
  disableMerchantFcmToken,
  ensureMerchantForegroundFcmListener,
  isFcmSupported,
  requestFcmPermissionAndToken,
  saveMerchantFcmToken,
  showLocalMerchantPushTestNotification,
} from '../../utils/fcmNotifications'
import { formatNotificationTime } from '../../utils/notificationFormatters'
import {
  NOTIFICATION_EVENT_TYPES,
  normalizeNotificationPreferences,
} from '../../utils/notificationPreferences'

const NOTIFICATION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Nao lidas' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'reviews', label: 'Avaliacoes' },
]

const CHANNEL_SETTINGS = [
  { group: 'channels', key: 'internal', label: 'Notificacoes internas no sino', locked: true },
  { group: 'channels', key: 'sound', label: 'Som de novo pedido' },
  { group: 'channels', key: 'toast', label: 'Toasts no dashboard' },
  { group: 'channels', key: 'browser', label: 'Notificacoes do navegador' },
  { group: 'channels', key: 'fcm', label: 'Push FCM neste dispositivo' },
  { group: 'channels', key: 'title', label: 'Alterar titulo da aba' },
]

const EVENT_SETTINGS = [
  { group: 'events', key: 'newOrder', label: 'Novos pedidos', critical: true },
  { group: 'events', key: 'reviews', label: 'Avaliacoes' },
  { group: 'events', key: 'billing', label: 'Assinatura e cobranca', critical: true },
  { group: 'events', key: 'settings', label: 'Configuracoes da loja' },
  { group: 'events', key: 'reports', label: 'Promocoes e relatorios', future: true },
]

const DROPDOWN_VARIANTS = {
  closed: {
    opacity: 0,
    y: -10,
    scale: 0.96,
    filter: 'blur(8px)',
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 34,
      mass: 0.75,
      staggerChildren: 0.035,
      delayChildren: 0.04,
    },
  },
}

const NOTIFICATION_ITEM_VARIANTS = {
  closed: {
    opacity: 0,
    y: 8,
    scale: 0.98,
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

const SOFT_SECTION_VARIANTS = {
  closed: {
    opacity: 0,
    y: 6,
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

function NotificationIcon({ severity }) {
  if (severity === 'danger') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
        <FiAlertCircle size={16} />
      </span>
    )
  }

  if (severity === 'warning') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
        <FiAlertTriangle size={16} />
      </span>
    )
  }

  if (severity === 'success') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
        <FiCheck size={16} />
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
      <FiInfo size={16} />
    </span>
  )
}

function getPushStatusLabel(status, loading) {
  if (loading) return 'Verificando...'
  if (status === 'enabled') return 'Ativado'
  if (status === 'denied') return 'Permissao negada'
  if (status === 'unsupported') return 'Sem suporte'
  if (status === 'missing-vapid-key') return 'VAPID ausente'
  if (status === 'push-service-error') return 'Erro no push'
  if (status === 'invalid-vapid-key') return 'VAPID invalida'
  if (status === 'service-worker-error') return 'Erro no service worker'
  return 'Desativado'
}

function playNotificationSoundPreview() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return false

  const context = new AudioContextCtor()
  const sequence = [
    { frequency: 784, start: 0, duration: 0.16 },
    { frequency: 988, start: 0.18, duration: 0.2 },
  ]

  sequence.forEach(({ frequency, start, duration }) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const startsAt = context.currentTime + start
    gain.gain.setValueAtTime(0.2, startsAt)
    gain.gain.exponentialRampToValueAtTime(0.001, startsAt + duration)
    oscillator.start(startsAt)
    oscillator.stop(startsAt + duration)
  })

  return true
}

export default function DashboardNotificationBell({ notificationState, storeId }) {
  const {
    notifications = [],
    unreadCount = 0,
    markAsRead = () => {},
    markAllAsRead = () => {},
    setLocalPreference = () => {},
    preferences: rawPreferences = {},
    setNotificationPreference = () => {},
    loading = false,
  } = notificationState || {}

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState('all')
  const [browserPermission, setBrowserPermission] = useState(() => getBrowserNotificationPermission())
  const [pushStatus, setPushStatus] = useState('disabled')
  const [pushStatusReason, setPushStatusReason] = useState('')
  const [pushTestMessage, setPushTestMessage] = useState('')
  const [soundTestMessage, setSoundTestMessage] = useState('')
  const [pushLoading, setPushLoading] = useState(false)
  const dropdownRef = useRef(null)
  const supportsBrowserNotifications = isBrowserNotificationsSupported()
  const preferences = normalizeNotificationPreferences(rawPreferences)
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.read
    if (filter === 'orders') return notification.area === 'orders'
    if (filter === 'reviews') return notification.area === 'reviews'
    return true
  })

  useEffect(() => {
    let mounted = true

    async function refreshPushStatus() {
      const support = await isFcmSupported()
      if (!mounted) return

      if (!support.supported) {
        setPushStatus('unsupported')
        setPushStatusReason(support.reason)
        return
      }

      if (support.permission === 'denied') {
        setPushStatus('denied')
        setPushStatusReason('permission-denied')
        return
      }

      if (support.permission === 'granted') {
        try {
          const saved = localStorage.getItem(`pratoby:fcm-enabled:${storeId || 'none'}`)
          setPushStatus(saved === 'true' ? 'enabled' : 'disabled')
          setPushStatusReason(saved === 'true' ? 'token-saved' : 'permission-granted')
          if (saved === 'true') {
            ensureMerchantForegroundFcmListener({ preferences }).catch((error) => {
              console.warn('[FCM] Nao foi possivel ativar listener foreground.', error)
            })
          }
        } catch {
          setPushStatus('disabled')
          setPushStatusReason('permission-granted')
        }
        return
      }

      setPushStatus('disabled')
      setPushStatusReason('permission-default')
    }

    refreshPushStatus()

    return () => {
      mounted = false
    }
  }, [storeId])

  useEffect(() => {
    if (pushStatus !== 'enabled') return undefined

    let mounted = true
    ensureMerchantForegroundFcmListener({ preferences }).catch((error) => {
      if (mounted) {
        console.warn('[FCM] Nao foi possivel atualizar listener foreground.', error)
      }
    })

    return () => {
      mounted = false
    }
  }, [preferences, pushStatus])

  useEffect(() => {
    if (!isOpen) return undefined

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleEnableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission()
    setBrowserPermission(permission)
    setLocalPreference('browserNotificationsPermission', permission)
    setNotificationPreference('channels', 'browser', permission === 'granted')
  }

  const handleEnablePushNotifications = async () => {
    if (!storeId || pushLoading) return

    try {
      setPushLoading(true)
      const result = await requestFcmPermissionAndToken()

      if (result.permission === 'denied') {
        setPushStatus('denied')
        setPushStatusReason('permission-denied')
        return
      }

      if (!result.supported) {
        setPushStatus('unsupported')
        setPushStatusReason(result.reason)
        return
      }

      if (result.reason === 'missing-vapid-key') {
        setPushStatus('missing-vapid-key')
        setPushStatusReason(result.reason)
        return
      }

      if (!result.token || !result.tokenHash) {
        setPushStatus([
          'push-service-error',
          'invalid-vapid-key',
          'service-worker-error',
        ].includes(result.reason) ? result.reason : 'disabled')
        setPushStatusReason(result.reason || 'token-empty')
        return
      }

      await saveMerchantFcmToken({
        storeId,
        token: result.token,
        tokenHash: result.tokenHash,
      })
      setNotificationPreference('channels', 'fcm', true)

      try {
        localStorage.setItem(`pratoby:fcm-enabled:${storeId}`, 'true')
      } catch (storageError) {
        console.warn('[FCM] Nao foi possivel salvar preferencia local.', storageError)
      }

      await ensureMerchantForegroundFcmListener({ preferences })
      const testResult = showLocalMerchantPushTestNotification()
      setPushTestMessage(testResult.shown
        ? 'Notificacao de teste enviada neste navegador.'
        : 'Push ativado. O navegador nao exibiu o teste local.')
      setPushStatus('enabled')
      setPushStatusReason('token-saved')
    } catch (error) {
      console.error('[FCM] Erro ao ativar notificacoes push:', error)
      setPushStatus('disabled')
      setPushStatusReason('enable-failed')
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePushNotifications = async () => {
    if (!storeId || pushLoading) return

    try {
      setPushLoading(true)
      await disableMerchantFcmToken({ storeId })
      setNotificationPreference('channels', 'fcm', false)

      try {
        localStorage.removeItem(`pratoby:fcm-enabled:${storeId}`)
      } catch (storageError) {
        console.warn('[FCM] Nao foi possivel remover preferencia local.', storageError)
      }

      setPushStatus('disabled')
      setPushStatusReason('disabled-by-user')
      setPushTestMessage('')
    } finally {
      setPushLoading(false)
    }
  }

  const handleSendPushTest = async () => {
    if (pushLoading || pushStatus !== 'enabled') return

    try {
      setPushLoading(true)
      await ensureMerchantForegroundFcmListener({ preferences })
      const result = showLocalMerchantPushTestNotification()
      setPushTestMessage(result.shown
        ? 'Notificacao de teste enviada neste navegador.'
        : 'Nao foi possivel exibir o teste. Confira a permissao do navegador.')
    } catch (error) {
      console.warn('[FCM] Falha ao exibir notificacao de teste.', error)
      setPushTestMessage('Nao foi possivel exibir o teste neste navegador.')
    } finally {
      setPushLoading(false)
    }
  }

  const handleTogglePreference = async (group, key, value) => {
    if (group === 'channels' && key === 'fcm') {
      if (value) {
        await handleEnablePushNotifications()
      } else {
        await handleDisablePushNotifications()
      }
      return
    }

    if (group === 'channels' && key === 'browser' && value && browserPermission === 'default') {
      await handleEnableBrowserNotifications()
      return
    }

    setNotificationPreference(group, key, value)
  }

  const handleTestSound = () => {
    setNotificationPreference('channels', 'sound', true)
    const played = playNotificationSoundPreview()
    setSoundTestMessage(played
      ? 'Som de teste reproduzido neste dispositivo.'
      : 'Este navegador nao liberou o som de teste.')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
  type="button"
  onClick={() => setIsOpen((value) => !value)}
  whileHover={{ y: -2 }}
  whileTap={{ scale: 0.96 }}
  animate={isOpen ? { y: -1, scale: 1.02 } : { y: 0, scale: 1 }}
  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
  className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
  aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
  aria-expanded={isOpen}
>
  <motion.span
    animate={isOpen ? { rotate: -12, scale: 1.05 } : { rotate: 0, scale: 1 }}
    transition={{ type: 'spring', stiffness: 360, damping: 22 }}
    className="grid place-items-center"
  >
    <FiBell size={18} />
  </motion.span>

  <AnimatePresence>
    {unreadCount > 0 && (
      <motion.span
        initial={{ opacity: 0, scale: 0.5, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-900"
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </motion.span>
    )}
  </AnimatePresence>
</motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
              variants={DROPDOWN_VARIANTS}
              initial="closed"
              animate="open"
              exit="closed"
              style={{ transformOrigin: 'top right' }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.75,
              }}
              className="fixed right-4 top-[4.75rem] z-[90] w-[calc(100vw-2rem)] max-w-[22.5rem] overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-2xl shadow-gray-900/10 ring-1 ring-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[22.5rem]"
            >
            <motion.div
                  variants={SOFT_SECTION_VARIANTS}
                  className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800"
                >
              <div className="min-w-0">
                <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100">
                  Notificações
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                  {unreadCount === 0
                    ? 'Nenhuma notificação nova'
                    : `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="rounded-full px-2 py-1 text-[11px] font-black text-[#f97316] transition hover:bg-orange-50 hover:text-[#ea580c] dark:hover:bg-orange-950/20"
                  >
                    Marcar tudo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setView((currentView) => currentView === 'settings' ? 'list' : 'settings')}
                  className="grid h-8 w-8 place-items-center rounded-xl text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Configurar notificacoes"
                  title="Configurar notificacoes"
                >
                  <FiSettings size={15} />
                </button>
              </div>
            </motion.div>

            <div className="max-h-[min(420px,70vh)] space-y-2 overflow-y-auto p-2.5 pratoby-scrollbar">
              {view === 'settings' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                    <h4 className="text-xs font-black text-gray-900 dark:text-zinc-100">
                      Preferencias de notificacao
                    </h4>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-gray-500 dark:text-zinc-400">
                      Escolha canais e tipos de aviso neste dispositivo.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                      Canais
                    </p>
                    <div className="mt-2 space-y-2">
                      {CHANNEL_SETTINGS.map((setting) => {
                        const checked = preferences[setting.group][setting.key] === true
                        const disabled = setting.locked || pushLoading

                        return (
                          <label
                            key={`${setting.group}:${setting.key}`}
                            className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-gray-800 dark:text-zinc-100">
                                {setting.label}
                              </span>
                              {setting.locked && (
                                <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">
                                  Essencial para o painel
                                </span>
                              )}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(event) => handleTogglePreference(setting.group, setting.key, event.target.checked)}
                              className="h-4 w-4 accent-[#f97316] disabled:opacity-50"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-gray-900 dark:text-zinc-100">
                          Push FCM neste dispositivo
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-gray-500 dark:text-zinc-400">
                          {pushStatus === 'enabled'
                            ? 'Ativo. Use o teste para conferir o aviso local.'
                            : 'Ative manualmente para receber avisos do navegador.'}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                        pushStatus === 'enabled'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {getPushStatusLabel(pushStatus, pushLoading)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {pushStatus === 'enabled' ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSendPushTest}
                            disabled={pushLoading || !storeId}
                            className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Enviar teste
                          </button>
                          <button
                            type="button"
                            onClick={handleDisablePushNotifications}
                            disabled={pushLoading || !storeId}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-black text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Desativar push
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleEnablePushNotifications}
                          disabled={pushLoading || !storeId || pushStatus === 'unsupported' || pushStatus === 'denied'}
                          className="inline-flex h-8 items-center justify-center rounded-xl bg-[#f97316] px-3 text-[11px] font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Ativar notificacoes push
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {pushTestMessage && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          className="mt-2 text-[10px] font-bold leading-4 text-emerald-700 dark:text-emerald-300"
                        >
                          {pushTestMessage}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3 dark:border-orange-900/30 dark:bg-orange-950/15">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-gray-900 dark:text-zinc-100">
                          Som de novo pedido
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-gray-500 dark:text-zinc-400">
                          Teste o aviso sonoro sem precisar criar um pedido.
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={handleTestSound}
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl bg-[#f97316] px-3 text-[11px] font-black text-white transition hover:bg-[#ea580c]"
                      >
                        Testar som
                      </button>
                    </div>
                    <AnimatePresence>
                      {soundTestMessage && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          className="mt-2 text-[10px] font-bold leading-4 text-orange-700 dark:text-orange-300"
                        >
                          {soundTestMessage}
                        </motion.p>
                      )}
                    </AnimatePresence>  
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                      Tipos de evento
                    </p>
                    <div className="mt-2 space-y-2">
                      {EVENT_SETTINGS.map((setting) => {
                        const checked = preferences[setting.group][setting.key] === true
                        const eventMeta = NOTIFICATION_EVENT_TYPES[setting.key]

                        return (
                          <label
                            key={`${setting.group}:${setting.key}`}
                            className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-gray-800 dark:text-zinc-100">
                                {setting.label}
                              </span>
                              <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">
                                {setting.critical ? 'Critico, nao recomendado desligar' : setting.future ? 'Preparado para uso futuro' : `Area: ${eventMeta?.area || 'painel'}`}
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => handleTogglePreference(setting.group, setting.key, event.target.checked)}
                              className="h-4 w-4 accent-[#f97316]"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                {NOTIFICATION_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                      filter === item.id
                        ? 'bg-[#111827] text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {pushStatus !== 'enabled' && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-gray-900 dark:text-zinc-100">
                      Push de novo pedido
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-gray-500 dark:text-zinc-400">
                      {pushStatus === 'enabled'
                        ? 'Avisos chegam mesmo com o painel em segundo plano.'
                        : 'Ative por clique para receber novo pedido no navegador.'}
                    </span>
                    {pushStatusReason === 'missing-vapid-key' && (
                      <span className="mt-1 block text-[10px] font-bold text-amber-600 dark:text-amber-300">
                        Configure VITE_FIREBASE_MESSAGING_VAPID_KEY.
                      </span>
                    )}
                    {pushStatusReason === 'push-service-error' && (
                      <span className="mt-1 block text-[10px] font-bold text-amber-600 dark:text-amber-300">
                        O navegador falhou ao registrar no servico push. Tente outro perfil/navegador ou confira bloqueios de push.
                      </span>
                    )}
                    {pushStatusReason === 'invalid-vapid-key' && (
                      <span className="mt-1 block text-[10px] font-bold text-amber-600 dark:text-amber-300">
                        A chave VAPID publicada nao foi aceita pelo navegador.
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                    pushStatus === 'enabled'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : pushStatus === 'denied' || pushStatus === 'unsupported' || pushStatus === 'missing-vapid-key' || pushStatus === 'push-service-error' || pushStatus === 'invalid-vapid-key' || pushStatus === 'service-worker-error'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                  >
                    {getPushStatusLabel(pushStatus, pushLoading)}
                  </span>
                </div>

                {pushStatus === 'enabled' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSendPushTest}
                      disabled={pushLoading || !storeId}
                      className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Enviar teste
                    </button>
                    <button
                      type="button"
                      onClick={handleDisablePushNotifications}
                      disabled={pushLoading || !storeId}
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-black text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Desativar push
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnablePushNotifications}
                    disabled={pushLoading || !storeId || pushStatus === 'unsupported' || pushStatus === 'denied'}
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-xl bg-[#f97316] px-3 text-[11px] font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Ativar notificacoes push
                  </button>
                )}
                {pushTestMessage && (
                  <p className="mt-2 text-[10px] font-bold leading-4 text-emerald-700 dark:text-emerald-300">
                    {pushTestMessage}
                  </p>
                )}
              </div>
              )}

              {preferences.channels.browser === true && supportsBrowserNotifications && browserPermission === 'default' && (
                <button
                  type="button"
                  onClick={handleEnableBrowserNotifications}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-3 py-3 text-left transition hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/15 dark:hover:bg-orange-950/25"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-gray-900 dark:text-zinc-100">
                      Ativar notificações do Windows
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-gray-500 dark:text-zinc-400">
                      Receba avisos locais enquanto o painel estiver aberto.
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#f97316] px-2.5 py-1 text-[10px] font-black text-white">
                    Ativar
                  </span>
                </button>
              )}

              {preferences.channels.browser === true && supportsBrowserNotifications && browserPermission === 'denied' && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[11px] font-semibold leading-4 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/15 dark:text-amber-300">
                  Notificações do navegador estão bloqueadas. Libere nas configurações do navegador para receber avisos do Windows.
                </div>
              )}

              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-5 text-xs font-bold text-gray-500 dark:bg-zinc-950 dark:text-zinc-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                  Carregando notificações...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center dark:bg-zinc-950">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <FiCheck size={18} />
                  </span>
                  <p className="mt-3 text-sm font-black text-gray-900 dark:text-zinc-100">
                    Nenhuma notificacao por enquanto
                  </p>
                  <p className="mx-auto mt-1 max-w-[15rem] text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                    Sua loja está em dia com as tarefas e faturamento.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const isUnread = !notification.read

                  return (
                   <motion.article
                          key={notification.id}
                          layout
                          variants={NOTIFICATION_ITEM_VARIANTS}
                          whileHover={{ y: -2, scale: 1.01 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                          className={`group relative flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
                            isUnread
                              ? 'border-orange-100 bg-orange-50/60 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/10 dark:hover:bg-orange-950/20'
                              : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40'
                          }`}
                        >
                      <AnimatePresence>
                        {isUnread && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                            className="absolute left-2 top-2 h-2 w-2 rounded-full bg-[#f97316]"
                          />
                        )}
                      </AnimatePresence>

                      <div className="shrink-0 pl-1">
                        <NotificationIcon severity={notification.severity} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          to={notification.href}
                          onClick={() => {
                            markAsRead(notification.id)
                            setIsOpen(false)
                          }}
                          className="block"
                        >
                          <h4 className="text-xs font-black leading-5 text-gray-900 transition group-hover:text-[#f97316] dark:text-zinc-100">
                            {notification.title}
                          </h4>
                          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                            {notification.label} · {formatNotificationTime(notification.createdAt)}
                          </p>
                        </Link>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification.id)}
                          className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label="Marcar notificação como lida"
                          title="Marcar como lida"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </motion.article>
                  )
                })
              )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
