import { useEffect, useState, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../contexts/AuthContext'
import { getTrialDaysRemaining } from '../utils/billingStatus'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'

function resolveActiveStoreId(userData) {
  if (!userData) return null

  const linkedStoreIds = new Set([
    userData.storeId,
    ...(Array.isArray(userData.storeIds) ? userData.storeIds : []),
    ...(Array.isArray(userData.storeKeys) ? userData.storeKeys : []),
  ].filter(Boolean).map(String))

  const fallbackStoreId = userData.storeId || (Array.isArray(userData.storeIds) ? userData.storeIds[0] : null) || null
  let selectedStoreId = null
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

/**
 * Hook para gerenciar e derivar notificações do painel do lojista (frontend-only).
 * As notificações lidas são persistidas no localStorage de forma isolada por usuário e loja.
 */
export function useDashboardNotifications() {
  const { user, userData } = useAuth()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  const activeStoreId = useMemo(() => resolveActiveStoreId(userData), [userData])

  // Estado de notificações lidas carregado dinamicamente com base no uid e storeId
  const [readNotifications, setReadNotifications] = useState([])

  // Sincroniza estado de notificações lidas do localStorage
  useEffect(() => {
    if (!user?.uid || !activeStoreId) {
      setReadNotifications([])
      return
    }

    try {
      const key = `pratoby:notifications-read:${user.uid}:${activeStoreId}`
      const saved = localStorage.getItem(key)
      setReadNotifications(saved ? JSON.parse(saved) : [])
    } catch (e) {
      console.error('[Notifications] Error loading read notifications from localStorage:', e)
      setReadNotifications([])
    }
  }, [user?.uid, activeStoreId])

  // Salva no localStorage quando o array de lidas muda
  const saveReadNotifications = (nextList) => {
    if (!user?.uid || !activeStoreId) return
    try {
      const key = `pratoby:notifications-read:${user.uid}:${activeStoreId}`
      localStorage.setItem(key, JSON.stringify(nextList))
      setReadNotifications(nextList)
    } catch (e) {
      console.error('[Notifications] Error saving read notifications to localStorage:', e)
    }
  }

  // Listener em tempo real para a loja ativa do Firestore
  useEffect(() => {
    if (!user?.uid || !activeStoreId) {
      setStore(null)
      setLoading(false)
      return
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
  }, [user?.uid, activeStoreId])

  // Derivação das notificações com base nos dados do usuário e loja
  const notifications = useMemo(() => {
    if (loading || !user?.uid || !activeStoreId) return []

    const list = []

    // Normalização do status de faturamento
    const rawSubscriptionStatus = store?.subscriptionStatus || userData?.subscriptionStatus || ''
    const subscriptionStatus = rawSubscriptionStatus === 'pending_checkout' ? 'checkout_pending' : rawSubscriptionStatus

    const isPending = ['checkout_pending', 'billing_pending', 'billing_pending_payment_method'].includes(subscriptionStatus)
    const isTrial = subscriptionStatus === 'trialing'
    const isPastDue = subscriptionStatus === 'past_due'
    const isBlocked = subscriptionStatus === 'blocked'
    const isCanceled = subscriptionStatus === 'canceled'
    const trialEndsAt = store?.trialEndsAt || userData?.trialEndsAt

    // 1. Faturamento pendente
    if (isPending) {
      list.push({
        id: 'billing_required',
        title: 'Faturamento pendente',
        description: 'Finalize sua cobrança para ativar o teste grátis.',
        link: '/dashboard/billing',
        type: 'critical',
        timestamp: Date.now(),
      })
    }

    // 2. & 3. Trial terminando / crítico
    if (isTrial && trialEndsAt) {
      const daysLeft = getTrialDaysRemaining(trialEndsAt)
      if (daysLeft !== null) {
        if (daysLeft === 0) {
          list.push({
            id: 'trial_expired',
            title: 'Período de testes expirado',
            description: 'Seu período de teste grátis expirou. Configure o faturamento para reativar sua loja.',
            link: '/dashboard/billing',
            type: 'critical',
            timestamp: Date.now(),
          })
        } else if (daysLeft <= 3) {
          list.push({
            id: 'trial_critical',
            title: 'Teste grátis terminando!',
            description: `Seu teste grátis termina em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}.`,
            link: '/dashboard/billing',
            type: 'critical',
            timestamp: Date.now(),
          })
        } else if (daysLeft <= 7) {
          list.push({
            id: 'trial_ending',
            title: 'Teste grátis terminando',
            description: `Seu teste grátis termina em ${daysLeft} dias.`,
            link: '/dashboard/billing',
            type: 'warning',
            timestamp: Date.now(),
          })
        }
      }
    }

    // 4. Assinatura past_due / blocked / canceled
    if (isPastDue) {
      list.push({
        id: 'past_due',
        title: 'Regularize sua assinatura',
        description: 'Regularize sua assinatura para manter sua loja ativa.',
        link: '/dashboard/billing',
        type: 'critical',
        timestamp: Date.now(),
      })
    }

    if (isBlocked || isCanceled) {
      list.push({
        id: 'blocked_canceled',
        title: 'Assinatura bloqueada',
        description: 'Regularize sua assinatura para manter sua loja ativa.',
        link: '/dashboard/billing',
        type: 'critical',
        timestamp: Date.now(),
      })
    }

    // 5. Loja fechada para pedidos
    if (store && store.isOpen === false) {
      list.push({
        id: 'store_closed',
        title: 'Loja fechada',
        description: 'Sua loja está fechada para pedidos.',
        link: '/dashboard',
        type: 'warning',
        timestamp: Date.now(),
      })
    }

    // 6. FASE FUTURA: Notificações de pedidos pendentes
    // Como acordado, a contagem de novos pedidos não cria listeners pesados globais nesta fase.
    // Fica registrada para implementação futura quando integrarmos um barramento global de eventos de pedidos.

    return list
  }, [loading, user?.uid, activeStoreId, store, userData])

  // Filtra notificações não lidas
  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !readNotifications.includes(n.id))
  }, [notifications, readNotifications])

  // Ações de gerenciamento de notificações
  const markAsRead = (id) => {
    if (readNotifications.includes(id)) return
    const nextList = [...readNotifications, id]
    saveReadNotifications(nextList)
  }

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    saveReadNotifications(allIds)
  }

  return {
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    markAsRead,
    markAllAsRead,
    store,
    loading,
  }
}
