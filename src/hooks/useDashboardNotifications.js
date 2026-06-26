import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'

import { db } from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { getTrialDaysRemaining } from '../utils/billingStatus'
import {
  deriveBillingAccessState,
  getBillingAccessCopy,
  mergeBillingAccessData,
} from '../utils/billingAccessState'
import {
  createReadEntry,
  getNotificationPreferences,
  getNotificationReadIds,
  loadNotificationReadState,
  saveNotificationPreference,
  saveNotificationReadState,
  saveNotificationPreferences,
  saveStructuredNotificationPreference,
} from '../utils/notificationStorage'
import {
  DASHBOARD_NOTIFICATION_EVENT,
  DASHBOARD_NOTIFICATION_READ_EVENT,
  NOTIFICATION_AREAS,
  dispatchDashboardNotification,
  normalizeDashboardNotification,
} from '../utils/notificationFormatters'
import {
  NOTIFICATION_PREFERENCES_EVENT,
  dispatchNotificationPreferencesUpdated,
  shouldShowInternalNotification,
} from '../utils/notificationPreferences'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const RECENT_ORDER_NOTIFICATIONS_LIMIT = 30

const ACTIONABLE_ORDER_STATUSES = new Set([
  '',
  'novo',
  'new',
  'pendente',
  'pending',
  'recebido',
  'received',
  'aguardando_pagamento',
  'payment_pending',
])

function toNotificationDate(value) {
  if (!value) return Date.now()
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

function formatMoneyFromOrder(order) {
  const cents = Number(order?.totalCents ?? order?.totals?.totalCents ?? order?.payment?.amountCents)
  if (Number.isFinite(cents) && cents > 0) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  const total = Number(order?.total ?? order?.payment?.amount)
  if (Number.isFinite(total) && total > 0) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(total)
  }

  return 'valor pendente'
}

function getOrderCustomerName(order) {
  return String(
    order?.customerName ||
    order?.customer?.name ||
    order?.clientName ||
    'Cliente'
  ).trim()
}

function getOrderDisplayNumber(order, fallbackId) {
  const value =
    order?.orderNumber ||
    order?.displayNumber ||
    order?.shortId ||
    String(fallbackId || '').slice(0, 8)

  return value ? `#${String(value).replace(/^#/, '')}` : 'Pedido'
}

function isOnlinePaymentPending(order) {
  const paymentType = String(order?.paymentType || order?.payment?.type || '').toLowerCase()
  const paymentProvider = String(order?.paymentProvider || order?.payment?.provider || '').toLowerCase()
  const paymentStatus = String(order?.paymentStatus || order?.payment?.status || '').toLowerCase()

  return (
    ['asaas', 'mercadopago', 'mercado_pago'].some((provider) =>
      paymentProvider.includes(provider) || paymentType.includes(provider)
    ) &&
    !['paid', 'approved', 'confirmado', 'pago'].includes(paymentStatus)
  )
}

function shouldNotifyOrder(order) {
  const normalizedStatus = String(order?.status || '').toLowerCase()
  return ACTIONABLE_ORDER_STATUSES.has(normalizedStatus) || isOnlinePaymentPending(order)
}

function createOrderNotification(order, orderId) {
  const orderNumber = getOrderDisplayNumber(order, orderId)
  const customerName = getOrderCustomerName(order)
  const amount = formatMoneyFromOrder(order)
  const onlinePaymentPending = isOnlinePaymentPending(order)

  return {
    id: `order:${orderId}`,
    area: 'orders',
    channel: 'firestore',
    title: onlinePaymentPending ? 'Pagamento online pendente' : 'Novo pedido recebido',
    message: `${orderNumber} - ${customerName} - ${amount}`,
    severity: onlinePaymentPending ? 'warning' : 'success',
    href: `/dashboard/orders?orderId=${encodeURIComponent(orderId)}`,
    createdAt: toNotificationDate(order?.createdAt || order?.updatedAt),
    sourceType: 'order',
    sourceId: orderId,
    critical: !onlinePaymentPending,
  }
}

function getStoreSlug(store) {
  return String(
    store?.storeSlug ||
    store?.slug ||
    store?.publicSlug ||
    store?.store?.slug ||
    ''
  ).trim()
}

function createOrderQuerySpecs(activeStoreId, store) {
  const storeId = String(activeStoreId || '').trim()
  const storeSlug = getStoreSlug(store)
  const specs = []
  const seen = new Set()

  function add(field, operator, value) {
    const cleanValue = String(value || '').trim()
    if (!cleanValue) return

    const key = `${field}:${operator}:${cleanValue}`
    if (seen.has(key)) return

    seen.add(key)
    specs.push({ key, field, operator, value: cleanValue })
  }

  add('storeId', '==', storeId)
  add('storeDocId', '==', storeId)
  add('storeSlug', '==', storeSlug)

  return specs
}

function dedupeNotifications(notifications) {
  const byId = new Map()

  notifications.forEach((notification) => {
    const normalized = normalizeDashboardNotification(notification)
    const current = byId.get(normalized.id)

    if (!current || normalized.createdAt >= current.createdAt) {
      byId.set(normalized.id, normalized)
    }
  })

  return [...byId.values()]
}

function resolveActiveStoreId(userData) {
  if (!userData) return null

  const linkedStoreIds = new Set([
    userData.storeId,
    ...(Array.isArray(userData.storeIds) ? userData.storeIds : []),
    ...(Array.isArray(userData.storeKeys) ? userData.storeKeys : []),
  ].filter(Boolean).map(String))

  const fallbackStoreId =
    userData.storeId ||
    (Array.isArray(userData.storeIds) ? userData.storeIds[0] : null) ||
    null

  let selectedStoreId
  try {
    selectedStoreId = localStorage.getItem(SELECTED_STORE_KEY)
  } catch {
    selectedStoreId = null
  }

  if (!selectedStoreId) return fallbackStoreId
  if (linkedStoreIds.has(String(selectedStoreId))) return selectedStoreId

  try {
    localStorage.removeItem(SELECTED_STORE_KEY)
  } catch {
    // localStorage can be unavailable in hardened browsers; ignore and fall back.
  }
  return fallbackStoreId
}

function createBillingNotification({ id, title, message, severity = 'warning', createdAt }) {
  return {
    id,
    area: 'billing',
    channel: 'local_dashboard',
    title,
    message,
    severity,
    href: '/dashboard/billing',
    createdAt,
    sourceType: 'billing',
    sourceId: id,
    critical: severity === 'danger',
  }
}

export function useDashboardNotifications() {
  const { user, userData } = useAuth()
  const uid = user?.uid
  const instanceId = useId()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localNotifications, setLocalNotifications] = useState([])
  const [orderNotifications, setOrderNotifications] = useState([])
  const [reviewNotifications, setReviewNotifications] = useState([])
  const [readState, setReadState] = useState(() => loadNotificationReadState(null, null))

  const activeStoreId = useMemo(() => resolveActiveStoreId(userData), [userData])
  const orderQuerySpecs = useMemo(
    () => createOrderQuerySpecs(activeStoreId, store),
    [activeStoreId, store]
  )

  useEffect(() => {
    if (!uid || !activeStoreId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadState(loadNotificationReadState(null, null))
      return
    }

    setReadState(loadNotificationReadState(uid, activeStoreId))
  }, [uid, activeStoreId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalNotifications([])
    setOrderNotifications([])
  }, [activeStoreId])

  useEffect(() => {
    if (!uid || !activeStoreId || !orderQuerySpecs.length || user?.isAnonymous) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderNotifications([])
      return undefined
    }

    const ordersByQuery = new Map()
    const unsubscribers = []

    function publishOrderNotifications() {
      const ordersById = new Map()

      ordersByQuery.forEach((orders) => {
        orders.forEach((order) => {
          ordersById.set(order.id, order)
        })
      })

      setOrderNotifications(
        [...ordersById.values()]
          .filter(shouldNotifyOrder)
          .sort((a, b) => toNotificationDate(b.createdAt || b.updatedAt) - toNotificationDate(a.createdAt || a.updatedAt))
          .slice(0, RECENT_ORDER_NOTIFICATIONS_LIMIT)
          .map((order) => createOrderNotification(order, order.id))
      )
    }

    orderQuerySpecs.forEach((spec) => {
      const ordersQuery = query(
        collection(db, 'orders'),
        where(spec.field, spec.operator, spec.value),
        orderBy('createdAt', 'desc'),
        limit(RECENT_ORDER_NOTIFICATIONS_LIMIT)
      )

      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          ordersByQuery.set(
            spec.key,
            snapshot.docs.map((orderDoc) => ({
              id: orderDoc.id,
              firestoreId: orderDoc.id,
              ...(orderDoc.data() || {}),
            }))
          )
          publishOrderNotifications()
        },
        (error) => {
          ordersByQuery.delete(spec.key)
          if (error?.code === 'permission-denied') {
            console.warn('[useDashboardNotifications] orders listener denied for active store:', {
              activeStoreId,
              field: spec.field,
            })
          } else {
            console.error('[useDashboardNotifications] error fetching recent orders:', error)
          }
          publishOrderNotifications()
        }
      )

      unsubscribers.push(unsubscribe)
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [activeStoreId, orderQuerySpecs, uid, user?.isAnonymous])

  useEffect(() => {
    if (!uid || !activeStoreId || user?.isAnonymous) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewNotifications([])
      return undefined
    }

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('storeId', '==', activeStoreId),
      orderBy('createdAt', 'desc'),
      limit(50)
    )

    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        setReviewNotifications(snapshot.docs.map((reviewDoc) => {
          const review = reviewDoc.data() || {}
          const rating = Number(review.rating || 0)

          return {
            id: `review:${reviewDoc.id}`,
            area: 'reviews',
            channel: 'firestore',
            title: rating > 0 ? `Nova avaliação: ${rating} estrela${rating !== 1 ? 's' : ''}` : 'Nova avaliação recebida',
            message: review.comment || 'Um cliente avaliou um pedido da sua loja.',
            severity: rating > 0 && rating <= 3 ? 'warning' : 'info',
            href: '/dashboard/reviews',
            createdAt: review.createdAt || review.updatedAt,
            sourceType: 'review',
            sourceId: reviewDoc.id,
          }
        }))
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          console.warn('[useDashboardNotifications] reviews listener denied for active store:', activeStoreId)
        } else {
          console.error('[useDashboardNotifications] error fetching reviews:', error)
        }
        setReviewNotifications([])
      }
    )

    return () => unsubscribe()
  }, [activeStoreId, uid, user?.isAnonymous])

  const readIds = useMemo(() => new Set(getNotificationReadIds(readState)), [readState])
  const preferences = useMemo(() => getNotificationPreferences(readState), [readState])

  const pushLocalNotification = useCallback((notification) => {
    const normalized = normalizeDashboardNotification(notification)

    setLocalNotifications((currentNotifications) => [
      normalized,
      ...currentNotifications.filter((item) => item.id !== normalized.id),
    ].slice(0, 30))

    return normalized.id
  }, [])

  const persistReadState = useCallback((updater) => {
    if (!uid || !activeStoreId) return

    setReadState((currentState) => {
      const nextState = typeof updater === 'function' ? updater(currentState) : updater
      const savedState = saveNotificationReadState(uid, activeStoreId, nextState)

      if (typeof window !== 'undefined') {
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent(DASHBOARD_NOTIFICATION_READ_EVENT, {
            detail: {
              uid,
              storeId: activeStoreId,
              state: savedState,
              instanceId,
            },
          }))
        })
      }

      return savedState
    })
  }, [activeStoreId, instanceId, uid])

  const addReadEntries = useCallback((entries) => {
    const safeEntries = entries.filter((entry) => entry?.id)
    if (!safeEntries.length) return

    persistReadState((currentState) => {
      const nextRead = { ...(currentState?.read || {}) }

      safeEntries.forEach(({ id, area }) => {
        nextRead[String(id)] = createReadEntry(area)
      })

      return {
        version: currentState?.version || 1,
        read: nextRead,
        preferences: currentState?.preferences || {},
      }
    })
  }, [persistReadState])

  useEffect(() => {
    if (!uid || !activeStoreId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStore(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, 'stores', activeStoreId),
      (snapshot) => {
        if (snapshot.exists()) {
          setStore({ id: snapshot.id, ...snapshot.data() })
        } else {
          setStore(null)
        }
        setLoading(false)
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          console.warn('[useDashboardNotifications] ignored stale or unauthorized store selection:', activeStoreId)
        } else {
          console.error('[useDashboardNotifications] error fetching store doc:', error)
        }
        setStore(null)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [uid, activeStoreId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleNotification = (event) => {
      const { notification, storeId, instanceId: eventInstanceId } = event.detail || {}
      if (eventInstanceId === instanceId) return
      if (storeId && activeStoreId && String(storeId) !== String(activeStoreId)) return
      if (!notification) return

      pushLocalNotification(notification)
    }

    const handleReadState = (event) => {
      const { uid: eventUid, storeId, state, instanceId: eventInstanceId } = event.detail || {}
      if (eventInstanceId === instanceId) return
      if (eventUid && uid && String(eventUid) !== String(uid)) return
      if (storeId && activeStoreId && String(storeId) !== String(activeStoreId)) return
      if (!state) return

      setReadState(state)
    }

    const handlePreferencesState = (event) => {
      const { uid: eventUid, storeId, preferences: nextPreferences, instanceId: eventInstanceId } = event.detail || {}
      if (eventInstanceId === instanceId) return
      if (eventUid && uid && String(eventUid) !== String(uid)) return
      if (storeId && activeStoreId && String(storeId) !== String(activeStoreId)) return
      if (!nextPreferences) return

      setReadState((currentState) => ({
        version: currentState?.version || 1,
        read: currentState?.read || {},
        preferences: nextPreferences,
      }))
    }

    window.addEventListener(DASHBOARD_NOTIFICATION_EVENT, handleNotification)
    window.addEventListener(DASHBOARD_NOTIFICATION_READ_EVENT, handleReadState)
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, handlePreferencesState)

    return () => {
      window.removeEventListener(DASHBOARD_NOTIFICATION_EVENT, handleNotification)
      window.removeEventListener(DASHBOARD_NOTIFICATION_READ_EVENT, handleReadState)
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, handlePreferencesState)
    }
  }, [activeStoreId, instanceId, pushLocalNotification, uid])

  const notifications = useMemo(() => {
    if (loading || !uid || !activeStoreId) return []

    const list = []

    const allowLegacyAccess = Boolean(store?.id || store?.storeDocId || store?.storeId || store?.slug || store?.storeSlug)
    const billingAccessState = deriveBillingAccessState(
      mergeBillingAccessData(store, userData),
      { allowLegacyAccess }
    )
    const billingAccessCopy = getBillingAccessCopy(billingAccessState)
    const isPending = billingAccessState.state === 'subscription_pending'
    const isTrial = billingAccessState.state === 'trial_active'
    const isTrialExpired = billingAccessState.state === 'trial_expired'
    const isPastDue = ['subscription_grace_period', 'subscription_overdue'].includes(billingAccessState.state)
    const isBlocked = billingAccessState.state === 'blocked'
    const isCanceled = billingAccessState.state === 'subscription_cancelled'
    const trialEndsAt = store?.trialEndsAt || userData?.trialEndsAt
    const derivedCreatedAt =
      store?.updatedAt ||
      userData?.updatedAt ||
      store?.createdAt ||
      userData?.createdAt ||
      '2026-01-01T00:00:00.000Z'

    if (isPending) {
      list.push(createBillingNotification({
        id: 'billing_required',
        title: billingAccessCopy.title,
        message: billingAccessCopy.message,
        severity: 'danger',
        createdAt: derivedCreatedAt,
      }))
    }

    if (isTrialExpired) {
      list.push(createBillingNotification({
        id: 'trial_expired',
        title: billingAccessCopy.title,
        message: billingAccessCopy.message,
        severity: 'danger',
        createdAt: derivedCreatedAt,
      }))
    }

    if (isTrial && trialEndsAt) {
      const daysLeft = getTrialDaysRemaining(trialEndsAt)
      if (daysLeft !== null) {
        if (daysLeft === 0) {
          list.push(createBillingNotification({
            id: 'trial_expired',
            title: 'Período de testes expirado',
            message: 'Seu período de teste grátis expirou. Configure o faturamento para reativar sua loja.',
            severity: 'danger',
            createdAt: derivedCreatedAt,
          }))
        } else if (daysLeft <= 3) {
          list.push(createBillingNotification({
            id: 'trial_critical',
            title: 'Teste grátis terminando!',
            message: `Seu teste grátis termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}.`,
            severity: 'danger',
            createdAt: derivedCreatedAt,
          }))
        } else if (daysLeft <= 7) {
          list.push(createBillingNotification({
            id: 'trial_ending',
            title: 'Teste grátis terminando',
            message: `Seu teste grátis termina em ${daysLeft} dias.`,
            createdAt: derivedCreatedAt,
          }))
        }
      }
    }

    if (isPastDue) {
      list.push(createBillingNotification({
        id: 'past_due',
        title: billingAccessCopy.title,
        message: billingAccessCopy.message,
        severity: billingAccessState.state === 'subscription_grace_period' ? 'warning' : 'danger',
        createdAt: derivedCreatedAt,
      }))
    }

    if (isBlocked || isCanceled) {
      list.push(createBillingNotification({
        id: 'blocked_canceled',
        title: billingAccessCopy.title,
        message: billingAccessCopy.message,
        severity: 'danger',
        createdAt: derivedCreatedAt,
      }))
    }

    if (store && store.isOpen === false) {
      list.push({
        id: 'store_closed',
        area: 'settings',
        channel: 'local_dashboard',
        title: 'Loja fechada',
        message: 'Sua loja está fechada para pedidos.',
        severity: 'warning',
        href: '/dashboard/settings',
        createdAt: derivedCreatedAt,
        sourceType: 'store',
        sourceId: 'store_closed',
      })
    }

    return dedupeNotifications([...list, ...reviewNotifications, ...orderNotifications, ...localNotifications])
      .map((notification) => {
        return {
          ...notification,
          read: readIds.has(notification.id),
        }
      })
      .filter((notification) => shouldShowInternalNotification(notification, preferences))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [activeStoreId, loading, localNotifications, orderNotifications, preferences, readIds, reviewNotifications, store, uid, userData])

  const unreadNotifications = useMemo(() => {
    return notifications.filter((notification) => !notification.read)
  }, [notifications])

  const countsByArea = useMemo(() => {
    const counts = NOTIFICATION_AREAS.reduce((acc, area) => {
      acc[area] = 0
      return acc
    }, {})

    unreadNotifications.forEach((notification) => {
      counts[notification.area] = (counts[notification.area] || 0) + 1
    })

    return counts
  }, [unreadNotifications])

  const markAsRead = useCallback((id) => {
    if (!id || readIds.has(String(id))) return

    const notification = notifications.find((item) => item.id === String(id))
    addReadEntries([{ id, area: notification?.area || 'general' }])
  }, [addReadEntries, notifications, readIds])

  const markAreaAsRead = useCallback((area) => {
    if (!NOTIFICATION_AREAS.includes(area)) return

    addReadEntries(
      notifications
        .filter((notification) => notification.area === area && !notification.read)
        .map((notification) => ({ id: notification.id, area: notification.area }))
    )
  }, [addReadEntries, notifications])

  const markAllAsRead = useCallback(() => {
    addReadEntries(
      notifications
        .filter((notification) => !notification.read)
        .map((notification) => ({ id: notification.id, area: notification.area }))
    )
  }, [addReadEntries, notifications])

  const addLocalNotification = useCallback((notification) => {
    const normalized = normalizeDashboardNotification({
      ...notification,
      channel: notification?.channel || 'local_dashboard',
      createdAt: notification?.createdAt || Date.now(),
    })

    if (!shouldShowInternalNotification(normalized, preferences)) {
      return normalized.id
    }

    pushLocalNotification(normalized)
    dispatchDashboardNotification(normalized, {
      storeId: activeStoreId,
      instanceId,
    })

    return normalized.id
  }, [activeStoreId, instanceId, preferences, pushLocalNotification])

  const setLocalPreference = useCallback((key, value) => {
    if (!uid || !activeStoreId || !key) return

    const savedState = saveNotificationPreference(uid, activeStoreId, key, value)
    setReadState(savedState)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DASHBOARD_NOTIFICATION_READ_EVENT, {
        detail: {
          uid,
          storeId: activeStoreId,
          state: savedState,
          instanceId,
        },
      }))
    }
  }, [activeStoreId, instanceId, uid])

  const setNotificationPreferences = useCallback((nextPreferences) => {
    if (!uid || !activeStoreId) return

    const savedState = saveNotificationPreferences(uid, activeStoreId, nextPreferences)
    setReadState(savedState)
    dispatchNotificationPreferencesUpdated({
      uid,
      storeId: activeStoreId,
      preferences: savedState.preferences,
      instanceId,
    })
  }, [activeStoreId, instanceId, uid])

  const setNotificationPreference = useCallback((group, key, value) => {
    if (!uid || !activeStoreId || !group || !key) return

    const savedState = saveStructuredNotificationPreference(uid, activeStoreId, group, key, value)
    setReadState(savedState)
    dispatchNotificationPreferencesUpdated({
      uid,
      storeId: activeStoreId,
      preferences: savedState.preferences,
      instanceId,
    })
  }, [activeStoreId, instanceId, uid])

  return {
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    countsByArea,
    markAsRead,
    markAreaAsRead,
    markAllAsRead,
    addLocalNotification,
    preferences,
    setLocalPreference,
    setNotificationPreferences,
    setNotificationPreference,
    uid,
    activeStoreId,
    store,
    loading,
  }
}
