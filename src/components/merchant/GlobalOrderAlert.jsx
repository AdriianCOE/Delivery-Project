import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiMessageCircle,
  FiShoppingBag,
  FiVolume2,
  FiX,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardNotifications } from '../../hooks/useDashboardNotifications'
import { getOrderDisplayNumber } from '../../utils/orderNumber'
import {
  getBrowserNotificationPermission,
  showNewOrderBrowserNotification,
} from '../../utils/browserNotifications'
import { notificationPreferenceEnabled } from '../../utils/notificationPreferences'
import {
  buildOrderClipboardSummary,
  buildOrderWhatsAppUrl,
  getOrderCustomerName,
  hasValidOrderWhatsAppPhone,
} from '../../utils/orderSummary'
import {
  getScheduledOperationalState,
  isScheduledOrder,
} from '../../utils/orderScheduling'
import { markMerchantOrderNotificationSeen } from '../../utils/fcmNotifications'

const ALERT_PERMISSION_KEY = '@PratoBy:alertsEnabled'
const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const SCHEDULED_DUE_ALERTS_KEY_PREFIX = '@PratoBy:scheduledDueAlerts'
const RECENT_ORDERS_LIMIT = 250
const STORE_QUERY_CHUNK_SIZE = 10
const SCHEDULED_ALERT_INTERVAL_MS = 60 * 1000
const NEW_ORDER_STATUSES = new Set([
  'pending',
  'pendente',
  'novo',
  'new',
  'received',
  'recebido',
  'aguardando',
  'aguardando_confirmacao',
])
const ACTIVE_SCHEDULED_ALERT_STATUSES = new Set([
  ...NEW_ORDER_STATUSES,
  'accepted',
  'aceito',
  'confirmed',
  'confirmado',
  'preparing',
  'preparando',
  'em_preparo',
  'preparo',
])

function shouldUseNativeNotificationForOpenDashboard() {
  if (typeof document === 'undefined') return false
  return document.visibilityState !== 'visible' || document.hasFocus?.() !== true
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean).map(String))]
}

function chunkArray(array, size = STORE_QUERY_CHUNK_SIZE) {
  const chunks = []
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase().trim()
}

function isNewOrderStatus(status) {
  return NEW_ORDER_STATUSES.has(normalizeStatus(status))
}

function isActiveScheduledAlertStatus(status) {
  return ACTIVE_SCHEDULED_ALERT_STATUSES.has(normalizeStatus(status))
}

function getOrderId(order) {
  return String(order?.firestoreId || order?.docId || order?._docId || order?.id || '').trim()
}

function getOrderTotal(order) {
  const cents = order?.totalCents ?? order?.totalAmountCents ?? order?.amountCents
  if (Number(cents) > 0) return Number(cents) / 100

  const total = order?.total ?? order?.totalAmount ?? order?.amount
  return Number(total) || 0
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getScheduledAlertsStorageKey(uid, storeId) {
  return `${SCHEDULED_DUE_ALERTS_KEY_PREFIX}:${uid || 'anon'}:${storeId || 'store'}`
}

function loadScheduledAlertKeys(uid, storeId) {
  try {
    const payload = localStorage.getItem(getScheduledAlertsStorageKey(uid, storeId))
    const keys = JSON.parse(payload || '[]')
    return new Set(Array.isArray(keys) ? keys.filter(Boolean).map(String) : [])
  } catch {
    return new Set()
  }
}

function saveScheduledAlertKeys(uid, storeId, keys) {
  try {
    localStorage.setItem(
      getScheduledAlertsStorageKey(uid, storeId),
      JSON.stringify([...keys].slice(-300))
    )
  } catch {
    // localStorage can be unavailable in hardened browsers.
  }
}

function resolveActiveStoreId({ storeId, storeIds, userData, user }) {
  const linkedStoreIds = uniqueArray([
    storeId,
    ...(Array.isArray(storeIds) ? storeIds : []),
    userData?.storeId,
    ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
    user?.storeId,
    ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
  ])

  const fallbackStoreId = linkedStoreIds[0] || ''

  try {
    const selectedStoreId = localStorage.getItem(SELECTED_STORE_KEY)
    if (selectedStoreId && linkedStoreIds.includes(String(selectedStoreId))) {
      return selectedStoreId
    }
  } catch {
    return fallbackStoreId
  }

  return fallbackStoreId
}

function NewOrderToast({ order, copied, onOpenOrder, onViewOrders, onCopy, onWhatsApp, onDismiss }) {
  const orderId = getOrderId(order)
  const canOpenWhatsApp = hasValidOrderWhatsAppPhone(order)

  return (
    <div className="fixed inset-x-3 top-20 z-[100] mx-auto w-[calc(100vw-1.5rem)] max-w-md rounded-[1.5rem] border border-orange-100 bg-white p-4 shadow-2xl shadow-orange-900/15 ring-1 ring-white/70 dark:border-orange-900/30 dark:bg-zinc-900 dark:ring-zinc-800 sm:inset-x-auto sm:right-6 sm:mx-0">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-950/25">
          <FiShoppingBag size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#f97316]">
            Novo pedido recebido
          </p>
          <h3 className="mt-1 text-base font-black text-[#111827] dark:text-white">
            {getOrderDisplayNumber(order, orderId)} · {formatMoney(getOrderTotal(order))}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
            {getOrderCustomerName(order)} enviou um pedido agora.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dispensar alerta de novo pedido"
        >
          <FiX size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenOrder}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white transition hover:bg-black active:scale-[0.98] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          Abrir pedido
          <FiChevronRight size={14} />
        </button>

        <button
          type="button"
          onClick={onViewOrders}
          className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-black text-[#111827] transition hover:bg-gray-100 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Ver pedidos
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 text-xs font-black text-[#6b7280] transition hover:bg-gray-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied ? <FiCheck size={14} className="text-emerald-500" /> : <FiCopy size={14} />}
          {copied ? 'Copiado' : 'Copiar resumo'}
        </button>

        {canOpenWhatsApp ? (
          <button
            type="button"
            onClick={onWhatsApp}
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/35"
          >
            <FiMessageCircle size={14} />
            Chamar cliente
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-2xl border border-gray-100 bg-white px-3 py-2.5 text-xs font-black text-[#6b7280] transition hover:bg-gray-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dispensar
          </button>
        )}
      </div>
    </div>
  )
}

function ScheduledOrderToast({ alert, onViewOrders, onDismiss }) {
  const severityClass = alert?.severity === 'danger'
    ? 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300'
    : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'

  return (
    <div className="fixed inset-x-3 top-20 z-[100] mx-auto w-[calc(100vw-1.5rem)] max-w-md rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-2xl shadow-orange-900/15 ring-1 ring-white/70 dark:border-amber-900/30 dark:bg-zinc-900 dark:ring-zinc-800 sm:inset-x-auto sm:right-6 sm:mx-0">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${severityClass}`}>
          <FiAlertTriangle size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#f97316]">
            {alert?.title || 'Agendamento'}
          </p>
          <h3 className="mt-1 text-base font-black text-[#111827] dark:text-white">
            {alert?.orderLabel || 'Pedido agendado'}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
            {alert?.message || 'Confira o pedido agendado.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dispensar alerta de agendamento"
        >
          <FiX size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onViewOrders}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white transition hover:bg-black active:scale-[0.98] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          Ver agendados
          <FiChevronRight size={14} />
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-black text-[#111827] transition hover:bg-gray-100 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Dispensar
        </button>
      </div>
    </div>
  )
}

export function GlobalOrderAlert() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const { user, userData, storeId, storeIds } = auth
  const userUid = user?.uid || ''
  const { addLocalNotification, markAsRead, preferences } = useDashboardNotifications()

  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(ALERT_PERMISSION_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [latestOrder, setLatestOrder] = useState(null)
  const [latestScheduledAlert, setLatestScheduledAlert] = useState(null)
  const [titleAlertActive, setTitleAlertActive] = useState(false)
  const [titleAlertText, setTitleAlertText] = useState('Novo pedido! | PratoBy')
  const [copied, setCopied] = useState(false)
  const [activeStoreId, setActiveStoreId] = useState(() =>
    resolveActiveStoreId({ storeId, storeIds, userData, user })
  )

  const seenOrderIdsRef = useRef(new Set())
  const orderUnsubscribersRef = useRef([])
  const initialSnapshotsPendingRef = useRef(0)
  const isBootingOrdersRef = useRef(true)
  const originalTitleRef = useRef(null)
  const scheduledOrdersRef = useRef(new Map())
  const scheduledAlertKeysRef = useRef(new Set())

  const activeOrderId = getOrderId(latestOrder)
  const activeNotificationId = activeOrderId ? `order:${activeOrderId}` : ''

  const activeStoreKeys = useMemo(() => uniqueArray([activeStoreId]), [activeStoreId])

  useEffect(() => {
    const syncActiveStoreId = () => {
      setActiveStoreId(resolveActiveStoreId({ storeId, storeIds, userData, user }))
    }

    syncActiveStoreId()

    const interval = window.setInterval(syncActiveStoreId, 1500)
    window.addEventListener('storage', syncActiveStoreId)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', syncActiveStoreId)
    }
  }, [storeId, storeIds, user, userData])

  const clearLatestOrder = useCallback((markRead = false) => {
    if (markRead && activeNotificationId) {
      markAsRead(activeNotificationId)
    }

    setLatestOrder(null)
    setLatestScheduledAlert(null)
    setTitleAlertActive(false)
    setCopied(false)
  }, [activeNotificationId, markAsRead])

  useEffect(() => {
    if (!titleAlertActive) return undefined

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title || 'PratoBy'
    }

    document.title = '🔔 Novo pedido! | PratoBy'

    return () => {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current
        originalTitleRef.current = null
      }
    }
  }, [titleAlertActive])

  useEffect(() => {
    const hasActiveAlert = latestOrder || latestScheduledAlert || titleAlertActive

    if (location.pathname !== '/dashboard/orders' || !hasActiveAlert) return undefined

    const timer = window.setTimeout(() => clearLatestOrder(false), 0)
    return () => window.clearTimeout(timer)
  }, [
    clearLatestOrder,
    latestOrder,
    latestScheduledAlert,
    location.pathname,
    titleAlertActive,
  ])

  useEffect(() => {
    if (!latestOrder && !latestScheduledAlert && !titleAlertActive) return undefined

    const timer = window.setTimeout(() => {
      clearLatestOrder(false)
    }, 10000)

    return () => window.clearTimeout(timer)
  }, [
    clearLatestOrder,
    latestOrder,
    latestScheduledAlert,
    titleAlertActive,
  ])

  useEffect(() => {
    if (!titleAlertActive || !titleAlertText) return
    document.title = titleAlertText
  }, [titleAlertActive, titleAlertText])

  const goToActiveOrder = useCallback(() => {
    const orderId = getOrderId(latestOrder)
    clearLatestOrder(false)
    navigate(orderId ? `/dashboard/orders?orderId=${encodeURIComponent(orderId)}` : '/dashboard/orders')
  }, [clearLatestOrder, latestOrder, navigate])

  const goToOrders = useCallback(() => {
    clearLatestOrder(false)
    navigate('/dashboard/orders')
  }, [clearLatestOrder, navigate])

  const goToScheduledOrders = useCallback(() => {
    clearLatestOrder(false)
    navigate('/dashboard/orders?filter=scheduled')
  }, [clearLatestOrder, navigate])

  const trackScheduledOrder = useCallback((order) => {
    const orderId = getOrderId(order)
    if (!orderId) return

    if (isScheduledOrder(order) && isActiveScheduledAlertStatus(order.status)) {
      scheduledOrdersRef.current.set(orderId, order)
      return
    }

    scheduledOrdersRef.current.delete(orderId)
  }, [])

  const checkScheduledOperationalAlerts = useCallback(() => {
    if (!userUid || !activeStoreId) return

    const now = new Date()
    const allowNotification = notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowToast = notificationPreferenceEnabled(preferences, 'channels', 'toast')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowSound = notificationPreferenceEnabled(preferences, 'channels', 'sound')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowTitle = notificationPreferenceEnabled(preferences, 'channels', 'title')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')

    scheduledOrdersRef.current.forEach((order, orderId) => {
      if (!isScheduledOrder(order) || !isActiveScheduledAlertStatus(order.status)) {
        scheduledOrdersRef.current.delete(orderId)
        return
      }

      const state = getScheduledOperationalState(order, { now })
      if (!['scheduled_due_soon', 'scheduled_late'].includes(state)) return

      const alertKey = `${orderId}:${state}`
      if (scheduledAlertKeysRef.current.has(alertKey)) return

      scheduledAlertKeysRef.current.add(alertKey)
      saveScheduledAlertKeys(userUid, activeStoreId, scheduledAlertKeysRef.current)

      const late = state === 'scheduled_late'
      const title = late ? 'Agendamento atrasado' : 'Agendamento chegando'
      const message = late
        ? 'O horário agendado já passou. Confira o pedido.'
        : 'Pedido agendado entrando na janela operacional.'
      const orderNumber = getOrderDisplayNumber(order, orderId)
      const body = `${orderNumber} - ${formatMoney(getOrderTotal(order))}`

      if (allowNotification) {
        addLocalNotification({
          id: `scheduled:${alertKey}`,
          area: 'orders',
          channel: 'local_dashboard',
          sourceType: 'order',
          sourceId: orderId,
          title,
          message: body,
          href: '/dashboard/orders?filter=scheduled',
          severity: late ? 'danger' : 'warning',
          critical: true,
          createdAt: Date.now(),
        })
      }

      if (allowToast) {
        setLatestScheduledAlert({
          id: alertKey,
          title,
          message,
          orderLabel: body,
          severity: late ? 'danger' : 'warning',
        })
      }

      if (allowSound) {
        window.dispatchEvent(new Event('play-new-order-sound'))
      }

      if (allowSound && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(late ? [250, 120, 250, 120, 250] : [200, 100, 200])
      }

      if (allowTitle) {
        setTitleAlertText(`${title} | PratoBy`)
        setTitleAlertActive(true)
      }
    })
  }, [activeStoreId, addLocalNotification, preferences, userUid])

  const notifyNewOrder = useCallback((order) => {
    const orderId = getOrderId(order)
    const orderNumber = getOrderDisplayNumber(order, orderId)
    const scheduledFuture =
      isScheduledOrder(order) &&
      getScheduledOperationalState(order, { now: new Date() }) === 'scheduled_future'
    const internalBody = `${orderNumber} - ${formatMoney(getOrderTotal(order))}`
    const publicBody = `${orderNumber} aguardando confirmação`
    const allowLightNotification = notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowToast = notificationPreferenceEnabled(preferences, 'channels', 'toast')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowSound = notificationPreferenceEnabled(preferences, 'channels', 'sound')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowBrowser = notificationPreferenceEnabled(preferences, 'channels', 'browser')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')
    const allowTitle = notificationPreferenceEnabled(preferences, 'channels', 'title')
      && notificationPreferenceEnabled(preferences, 'events', 'newOrder')

    if (scheduledFuture) {
      if (allowLightNotification) {
        addLocalNotification({
          id: `order:${orderId}`,
          area: 'orders',
          channel: 'local_dashboard',
          sourceType: 'order',
          sourceId: orderId,
          title: 'Pedido agendado recebido',
          message: internalBody,
          href: '/dashboard/orders?filter=scheduled',
          severity: 'info',
          critical: false,
          createdAt: order?.createdAt || Date.now(),
        })
      }
      return
    }

    setLatestOrder(allowToast ? order : null)
    setLatestScheduledAlert(null)
    setTitleAlertText('Novo pedido! | PratoBy')
    setTitleAlertActive(allowTitle)
    setCopied(false)
    markMerchantOrderNotificationSeen(orderId)

    if (allowSound) {
      window.dispatchEvent(new Event('play-new-order-sound'))
    }

    if (allowSound && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }

    addLocalNotification({
      id: `order:${orderId}`,
      area: 'orders',
      channel: 'local_dashboard',
      sourceType: 'order',
      sourceId: orderId,
      title: 'Novo pedido recebido',
      message: internalBody,
      href: '/dashboard/orders',
      severity: 'success',
      critical: true,
      createdAt: order?.createdAt || Date.now(),
    })

    if (
      allowBrowser &&
      shouldUseNativeNotificationForOpenDashboard() &&
      getBrowserNotificationPermission() === 'granted'
    ) {
      showNewOrderBrowserNotification(order, {
        orderId,
        body: publicBody,
        onClick: () => navigate(`/dashboard/orders?orderId=${encodeURIComponent(orderId)}`),
      })
    }
  }, [addLocalNotification, navigate, preferences])

  useEffect(() => {
    if (!userUid) return undefined

    const clearOrderListeners = () => {
      orderUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
      orderUnsubscribersRef.current = []
    }

    clearOrderListeners()

    if (!activeStoreKeys.length) {
      seenOrderIdsRef.current = new Set()
      scheduledOrdersRef.current = new Map()
      isBootingOrdersRef.current = false
      return undefined
    }

    const storeKeyChunks = chunkArray(activeStoreKeys)
    seenOrderIdsRef.current = new Set()
    scheduledOrdersRef.current = new Map()
    scheduledAlertKeysRef.current = loadScheduledAlertKeys(userUid, activeStoreId)
    isBootingOrdersRef.current = true
    initialSnapshotsPendingRef.current = storeKeyChunks.length

    const scheduledAlertInterval = window.setInterval(
      checkScheduledOperationalAlerts,
      SCHEDULED_ALERT_INTERVAL_MS
    )

    storeKeyChunks.forEach((storeKeyChunk) => {
      let isFirstChunkSnapshot = true

      const qOrders = query(
        collection(db, 'orders'),
        where('storeId', 'in', storeKeyChunk),
        orderBy('createdAt', 'desc'),
        limit(RECENT_ORDERS_LIMIT)
      )

      const unsubscribeOrders = onSnapshot(qOrders, (ordersSnapshot) => {
        if (isFirstChunkSnapshot) {
          ordersSnapshot.docs.forEach((orderDoc) => {
            seenOrderIdsRef.current.add(orderDoc.id)
            trackScheduledOrder({
              id: orderDoc.id,
              firestoreId: orderDoc.id,
              ...orderDoc.data(),
            })
          })

          isFirstChunkSnapshot = false
          initialSnapshotsPendingRef.current -= 1
          if (initialSnapshotsPendingRef.current <= 0) {
            isBootingOrdersRef.current = false
            checkScheduledOperationalAlerts()
          }
          return
        }

        ordersSnapshot.docChanges().forEach((change) => {
          if (change.doc.metadata.hasPendingWrites) return

          const order = {
            id: change.doc.id,
            firestoreId: change.doc.id,
            ...change.doc.data(),
          }
          const orderId = getOrderId(order)

          if (change.type === 'removed') {
            scheduledOrdersRef.current.delete(orderId)
            return
          }

          trackScheduledOrder(order)

          if (change.type !== 'added') return
          if (!orderId || seenOrderIdsRef.current.has(orderId)) return

          seenOrderIdsRef.current.add(orderId)

          if (isBootingOrdersRef.current) return
          if (!isNewOrderStatus(order.status)) return

          notifyNewOrder(order)
        })
      }, (error) => {
        console.error('[GlobalOrderAlert] Erro no listener de orders:', error)
      })

      orderUnsubscribersRef.current.push(unsubscribeOrders)
    })

    return () => {
      window.clearInterval(scheduledAlertInterval)
      clearOrderListeners()
    }
  }, [activeStoreId, activeStoreKeys, checkScheduledOperationalAlerts, notifyNewOrder, trackScheduledOrder, userUid])

  const handleEnable = async () => {
    setEnabled(true)
    try {
      localStorage.setItem(ALERT_PERMISSION_KEY, 'true')
    } catch {
      // localStorage can be unavailable in hardened browsers.
    }

    window.dispatchEvent(new Event('play-new-order-sound'))
  }

  const handleCopySummary = async () => {
    if (!latestOrder) return

    try {
      await navigator.clipboard.writeText(buildOrderClipboardSummary(latestOrder, {
        totalLabel: formatMoney(getOrderTotal(latestOrder)),
      }))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.warn('[GlobalOrderAlert] Não foi possível copiar resumo do pedido:', error)
    }
  }

  const handleWhatsApp = () => {
    if (!latestOrder) return

    const url = buildOrderWhatsAppUrl(latestOrder, {
      totalLabel: formatMoney(getOrderTotal(latestOrder)),
    })
    if (!url) return

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (location.pathname.includes('/store')) return null
  if (!userUid) return null

  return (
    <>
      {!enabled && (
        <div className="fixed bottom-6 left-6 z-[100] animate-bounce-slow">
          <button
            type="button"
            onClick={handleEnable}
            className="flex items-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3.5 font-black text-white shadow-2xl shadow-orange-900/20 ring-4 ring-white transition hover:scale-105 active:scale-95 dark:ring-zinc-900"
          >
            <FiVolume2 size={20} />
            Ativar alertas do painel
          </button>
        </div>
      )}

      {latestOrder && (
        <NewOrderToast
          order={latestOrder}
          copied={copied}
          onOpenOrder={goToActiveOrder}
          onViewOrders={goToOrders}
          onCopy={handleCopySummary}
          onWhatsApp={handleWhatsApp}
          onDismiss={() => clearLatestOrder(true)}
        />
      )}

      {latestScheduledAlert && !latestOrder && (
        <ScheduledOrderToast
          alert={latestScheduledAlert}
          onViewOrders={goToScheduledOrders}
          onDismiss={() => {
            setLatestScheduledAlert(null)
            setTitleAlertActive(false)
          }}
        />
      )}
    </>
  )
}
