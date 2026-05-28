import { useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import AnimatedSegmentedControl from '../../components/ui/AnimatedSegmentedControl'
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
  FiActivity,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiMapPin,
  FiPieChart,
  FiShoppingBag,
  FiTag,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
  FiXCircle,
  FiPercent,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

const BILLING_PENDING_STATUSES = new Set(['checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'])
const OPERATIONAL_STATUSES = new Set(['trialing', 'active'])
const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 0 },
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
]

function normalizeBillingStatus(status) {
  const value = String(status || '').trim()
  return value === 'pending_checkout' ? 'checkout_pending' : value
}

function normalizeAccessRole(role) {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'lojista') return 'merchant'
  if (value === 'dev') return 'developer'
  return value
}

function canLoadOperationalOrders({ role, selectedStore, userData }) {
  if (!selectedStore) return false

  const normalizedRole = normalizeAccessRole(role || userData?.role)
  if (!['merchant', 'admin', 'developer'].includes(normalizedRole)) return false

  const storeStatus = normalizeBillingStatus(selectedStore?.subscriptionStatus)
  const userStatus = normalizeBillingStatus(userData?.subscriptionStatus)

  if (
    selectedStore?.isBillingBlocked === true ||
    BILLING_PENDING_STATUSES.has(storeStatus) ||
    BILLING_PENDING_STATUSES.has(userStatus) ||
    userData?.onboardingStatus === 'billing_pending'
  ) {
    return false
  }

  const effectiveStatus = storeStatus || userStatus
  return OPERATIONAL_STATUSES.has(effectiveStatus) || !effectiveStatus
}

// --- UTILIDADES ---
function normalizeStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()
  const map = {
    novo: 'pendente', received: 'pendente', aguardando: 'pendente', pendente: 'pendente',
    aceito: 'preparando', confirmado: 'preparando', preparo: 'preparando', preparando: 'preparando',
    entregando: 'entregando', saiu_para_entrega: 'entregando', em_rota: 'entregando',
    finalizado: 'entregue', delivered: 'entregue', entregue: 'entregue',
    canceled: 'cancelado', cancelled: 'cancelado', cancelado: 'cancelado',
  }
  return map[value] || 'pendente'
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) return Number(centsValue || 0) / 100
  const numericValue = Number(value || 0)
  if (numericValue > 999) return numericValue / 100
  return numericValue
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getOrderDate(order) {
  const createdAt = order?.createdAt
  if (!createdAt) return null
  if (createdAt?.toDate) return createdAt.toDate()
  if (createdAt instanceof Date) return createdAt
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

function getCustomerPhone(order) {
  return order?.customerPhone || order?.customer?.phone || order?.phone || ''
}

function getPaymentMethodId(order) {
  const raw = String(order?.payment?.method || order?.paymentMethod || order?.paymentType || '').toLowerCase()
  if (raw.includes('pix')) return 'pix'
  if (raw.includes('card') || raw.includes('cartao') || raw.includes('cartão') || raw.includes('credit') || raw.includes('debit')) return 'card'
  if (raw.includes('cash') || raw.includes('dinheiro')) return 'cash'
  return 'other'
}

function getOrderTotalCents(order) {
  if (order?.totalCents !== undefined && order?.totalCents !== null) return Number(order.totalCents)
  return Math.round(Number(order?.total || 0) * 100)
}

function getOrderSubtotalCents(order) {
  if (order?.subtotalCents !== undefined && order?.subtotalCents !== null) return Number(order.subtotalCents)
  return Math.round(Number(order?.subtotal || 0) * 100)
}

function getOrderDeliveryFeeCents(order) {
  if (order?.deliveryFeeCents !== undefined && order?.deliveryFeeCents !== null) return Number(order.deliveryFeeCents)
  if (order?.deliveryFee !== undefined && order?.deliveryFee !== null) return Math.round(Number(order.deliveryFee) * 100)
  return 0
}

function getOrderDiscountCents(order) {
  if (order?.discountCents !== undefined && order?.discountCents !== null) return Number(order.discountCents)
  if (order?.discount !== undefined && order?.discount !== null) return Math.round(Number(order.discount) * 100)
  return 0
}

function getOrderNeighborhood(order) {
  const path = order?.neighborhood ||
               order?.deliveryNeighborhood ||
               order?.customer?.neighborhood ||
               order?.delivery?.neighborhood ||
               order?.address?.neighborhood ||
               order?.customerAddress?.neighborhood ||
               ''
  const trimmed = String(path).trim()
  return trimmed ? trimmed : 'Não informado'
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function isCompletedOrder(order) {
  return normalizeStatus(order?.status) === 'entregue'
}

function isCanceledOrder(order) {
  return normalizeStatus(order?.status) === 'cancelado'
}

function getOrderDeliveryDuration(order) {
  const created = getOrderDate(order)
  if (!created) return null
  
  const history = order?.statusHistory || []
  const deliveryStep = history.find(h => 
    ['entregue', 'finalizado', 'delivered'].includes(String(h.status || '').toLowerCase())
  )
  let delivered = null
  if (deliveryStep?.timestamp) {
    delivered = deliveryStep.timestamp.toDate ? deliveryStep.timestamp.toDate() : new Date(deliveryStep.timestamp)
  } else if (order?.deliveredAt) {
    delivered = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt)
  } else if (order?.updatedAt && normalizeStatus(order.status) === 'entregue') {
    delivered = order.updatedAt.toDate ? order.updatedAt.toDate() : new Date(order.updatedAt)
  }
  
  if (delivered && !isNaN(delivered.getTime())) {
    const diffMinutes = Math.round((delivered.getTime() - created.getTime()) / 60000)
    if (diffMinutes > 0 && diffMinutes < 300) {
      return diffMinutes
    }
  }
  return null
}

function formatMoneyCents(valueCents) {
  return formatMoney(Number(valueCents || 0) / 100)
}

// --- COMPONENTES VISUAIS ---
function StatCard({ icon: Icon, label, value, sub, tone = 'green' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-[#f97316]',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <div className="group rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-gray-200/60 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#6b7280] truncate">
            {label}
          </p>
          <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-[#111827] truncate">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs font-bold text-[#9ca3af] truncate">
              {sub}
            </p>
          )}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${tones[tone] || tones.green}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ label, value, total, colorClass, bgClass = 'bg-gray-100' }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs font-bold">
        <span className="text-[#111827] truncate">{label}</span>
        <span className="text-[#6b7280] shrink-0 ml-2">{percentage}% ({value})</span>
      </div>
      <div className={`h-2.5 w-full overflow-hidden rounded-full ${bgClass}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

const SELECTED_STATISTICS_STORE_KEY = 'pratoby:selected_statistics_store'

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage indisponível
  }
}

function normalizeStoreDoc(storeDoc) {
  const data = storeDoc.data() || {}
  return {
    ...data,
    id: storeDoc.id,
    storeId: data.storeId || storeDoc.id,
    storeSlug: data.storeSlug || data.slug || '',
    slug: data.slug || data.storeSlug || '',
  }
}

function getStoreKeys(store) {
  return [
    store?.id,
    store?.storeId,
    store?.storeSlug,
    store?.slug,
  ]
    .filter(Boolean)
    .map(String)
    .filter((value, index, array) => array.indexOf(value) === index)
}

export default function Statistics() {
  const {
    user,
    userData,
    role,
    loading: authLoading,
    storeId: authStoreId,
    storeIds: authStoreIds = [],
  } = useAuth()

  const knownStoreIds = useMemo(() => {
    const rawList = [
      authStoreId,
      ...(Array.isArray(authStoreIds) ? authStoreIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ]
    return [...new Set(rawList.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 10)
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [periodIdx, setPeriodIdx] = useState(1) // Default: 7 dias
  
  const [bairrosTab, setBairrosTab] = useState('orders') // 'orders' | 'revenue'
  const [showAllBairros, setShowAllBairros] = useState(false)

  const period = PERIOD_OPTIONS[periodIdx]
  const selectedStore = useMemo(() => {
    if (!stores.length) return null
    return (
      stores.find((store) => getStoreKeys(store).includes(selectedStoreId)) ||
      stores[0] ||
      null
    )
  }, [selectedStoreId, stores])
  const canReadOrders = canLoadOperationalOrders({ role, selectedStore, userData })

  useEffect(() => {
    if (!user?.uid || !knownStoreIds.length) {
      setStores([])
      setOrders([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const uid = user.uid
    const storesMap = new Map()
    const unsubscribers = []

    function publishStores() {
      const nextStores = Array.from(storesMap.values()).sort((a, b) =>
        String(a?.name || '').localeCompare(String(b?.name || ''))
      )
      setStores(nextStores)
      if (nextStores.length === 0) {
        setOrders([])
        setLoading(false)
      }
    }

    function subscribeToStoreDoc(storeDocId) {
      if (!storeDocId) return

      const unsubscribe = onSnapshot(
        doc(db, 'stores', storeDocId),
        (snapshot) => {
          if (snapshot.exists()) {
            storesMap.set(snapshot.id, normalizeStoreDoc(snapshot))
          } else {
            storesMap.delete(storeDocId)
          }

          publishStores()
        },
        (error) => {
          console.error('Erro ao carregar loja por ID nas estatísticas:', error)
          publishStores()
        }
      )

      unsubscribers.push(unsubscribe)
    }

    knownStoreIds.forEach(subscribeToStoreDoc)

    if (!unsubscribers.length) {
      setStores([])
      setOrders([])
      setLoading(false)
      return undefined
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [user?.uid, knownStoreIds, knownStoreIdsKey])

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId('')
      return
    }

    setSelectedStoreId((current) => {
      if (stores.some((store) => getStoreKeys(store).includes(current))) {
        return current
      }
      const savedStoreId = safeGetLocalStorage(SELECTED_STATISTICS_STORE_KEY)
      if (stores.some((store) => getStoreKeys(store).includes(savedStoreId))) {
        return savedStoreId
      }
      return getStoreKeys(stores[0])[0] || stores[0].id
    })
  }, [stores])

  useEffect(() => {
    if (authLoading) {
      setOrders([])
      setLoading(true)
      return undefined
    }

    if (!selectedStore) {
      setOrders([])
      setLoading(false)
      return undefined
    }

    if (!canReadOrders) {
      setOrders([])
      setLoading(false)
      return undefined
    }

    const storeKeys = getStoreKeys(selectedStore)
    if (!storeKeys.length) {
      setOrders([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const cutoffDate = Timestamp.fromDate(new Date(Date.now() - 31 * 86400000))
    const baseKeys = storeKeys.slice(0, 10)

    const ordersMap = new Map()
    const unsubscribers = []

    function publishOrders() {
      const data = Array.from(ordersMap.values()).sort((a, b) => {
        const dateA = getOrderDate(a)?.getTime?.() || 0
        const dateB = getOrderDate(b)?.getTime?.() || 0
        return dateB - dateA
      })
      setOrders(data)
      setLoading(false)
    }

    // 1. Query Principal por storeId
    const qOrdersId = query(
      collection(db, 'orders'),
      where('storeId', 'in', baseKeys),
      where('createdAt', '>=', cutoffDate),
      orderBy('createdAt', 'desc')
    )

    const unsubId = onSnapshot(
      qOrdersId,
      (ordersSnap) => {
        ordersSnap.docs.forEach((orderDoc) => {
          ordersMap.set(orderDoc.id, {
            id: orderDoc.id,
            ...orderDoc.data(),
          })
        })
        publishOrders()
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          console.warn('Query de pedidos por storeId ignorada por permissao insuficiente.')
        } else {
          console.error('Erro ao carregar pedidos por storeId:', error)
        }
        publishOrders()
      }
    )
    unsubscribers.push(unsubId)

    // 2. Query Fallback por storeSlug (silenciosa e opcional)
    try {
      const qOrdersSlug = query(
        collection(db, 'orders'),
        where('storeSlug', 'in', baseKeys),
        where('createdAt', '>=', cutoffDate),
        orderBy('createdAt', 'desc')
      )

      const unsubSlug = onSnapshot(
        qOrdersSlug,
        (ordersSnap) => {
          ordersSnap.docs.forEach((orderDoc) => {
            if (!ordersMap.has(orderDoc.id)) {
              ordersMap.set(orderDoc.id, {
                id: orderDoc.id,
                ...orderDoc.data(),
              })
            }
          })
          publishOrders()
        },
        (error) => {
          if (error?.code !== 'permission-denied') {
            console.warn('Query opcional por storeSlug ignorada (pode requerer indice/permissao):', error.message)
          }
        }
      )
      unsubscribers.push(unsubSlug)
    } catch (e) {
      console.warn('Erro ao criar query de storeSlug opcional:', e)
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [authLoading, canReadOrders, selectedStore])

  const dashboardData = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

    let cutoff
    if (period.days === 0) {
      cutoff = startOfToday
    } else if (period.days === 'current_month') {
      cutoff = startOfCurrentMonth
    } else {
      cutoff = now - period.days * 24 * 60 * 60 * 1000
    }

    const periodOrders = orders.filter((order) => {
      const date = getOrderDate(order)
      return date ? date.getTime() >= cutoff : false
    })

    const validOrders = periodOrders.filter(o => !isCanceledOrder(o))
    const canceledOrders = periodOrders.filter(o => isCanceledOrder(o))
    const completedOrders = periodOrders.filter(o => isCompletedOrder(o))
    
    // Faturamento e Perdas
    const revenueCents = completedOrders.reduce((acc, o) => acc + getOrderTotalCents(o), 0)
    const lossesCents = canceledOrders.reduce((acc, o) => acc + getOrderTotalCents(o), 0)
    
    const totalOrders = validOrders.length
    const averageTicketCents = completedOrders.length > 0 ? revenueCents / completedOrders.length : 0
    
    // Clientes Únicos
    const uniquePhones = new Set(validOrders.map(getCustomerPhone).filter(Boolean))
    const totalCustomers = uniquePhones.size
    const recurrenceRate =
      totalOrders > 0 && totalCustomers > 0
        ? Math.max(0, Math.round(((totalOrders - totalCustomers) / totalOrders) * 100))
        : 0

    // Formas de Pagamento e Entrega
    const payments = { pix: 0, card: 0, cash: 0, other: 0 }
    const deliveryTypes = { delivery: 0, pickup: 0, table: 0 }

    // Tempo médio de entrega
    let totalDeliveryDuration = 0
    let countDeliveryDuration = 0
    completedOrders.forEach(o => {
      const duration = getOrderDeliveryDuration(o)
      if (duration !== null) {
        totalDeliveryDuration += duration
        countDeliveryDuration++
      }
    })
    const averageDeliveryTime = countDeliveryDuration > 0 
      ? Math.round(totalDeliveryDuration / countDeliveryDuration)
      : null

    // Horários de Pico
    const peakHours = Array(24).fill(0)
    const timeBlocks = { manhã: 0, tarde: 0, noite: 0, madrugada: 0 }

    validOrders.forEach((order) => {
      // Pagamentos
      const method = getPaymentMethodId(order)
      if (payments[method] !== undefined) payments[method]++
      else payments.other++

      // Entrega vs Retirada
      const orderType = String(order.orderType || order.type || '').toLowerCase()
      if (orderType === 'pickup' || orderType === 'retirada') deliveryTypes.pickup++
      else if (orderType === 'dine_in' || orderType === 'mesa') deliveryTypes.table++
      else deliveryTypes.delivery++

      // Horários de Pico
      const date = getOrderDate(order)
      if (date) {
        const hour = date.getHours()
        peakHours[hour]++
        if (hour >= 6 && hour < 12) timeBlocks.manhã++
        else if (hour >= 12 && hour < 18) timeBlocks.tarde++
        else if (hour >= 18 && hour < 24) timeBlocks.noite++
        else timeBlocks.madrugada++
      }
    })

    const maxPeakHour = Math.max(...peakHours, 1)

    // Bairros mais pedidos & que mais faturam
    const neighborhoodMap = new Map()
    periodOrders.forEach((order) => {
      const neighborhood = getOrderNeighborhood(order)
      const isCanceled = isCanceledOrder(order)
      const isCompleted = isCompletedOrder(order)
      const totalCents = getOrderTotalCents(order)
      const feeCents = getOrderDeliveryFeeCents(order)
      
      const prev = neighborhoodMap.get(neighborhood) || {
        neighborhood,
        ordersCount: 0,
        completedOrdersCount: 0,
        revenueCents: 0,
        deliveryFeesSumCents: 0,
        deliveryFeesCount: 0
      }
      
      if (!isCanceled) {
        prev.ordersCount += 1
      }
      if (isCompleted) {
        prev.completedOrdersCount += 1
        prev.revenueCents += totalCents
      }
      if (feeCents > 0) {
        prev.deliveryFeesSumCents += feeCents
        prev.deliveryFeesCount += 1
      }
      
      neighborhoodMap.set(neighborhood, prev)
    })
    
    const neighborhoodsList = Array.from(neighborhoodMap.values()).map(n => ({
      ...n,
      ticketAverageCents: n.completedOrdersCount > 0 ? n.revenueCents / n.completedOrdersCount : 0,
      deliveryFeeAverageCents: n.deliveryFeesCount > 0 ? n.deliveryFeesSumCents / n.deliveryFeesCount : 0,
      percentageOfOrders: totalOrders > 0 ? Math.round((n.ordersCount / totalOrders) * 100) : 0
    }))
    
    const topNeighborhoodsByOrders = [...neighborhoodsList]
      .filter(n => n.ordersCount > 0)
      .sort((a, b) => b.ordersCount - a.ordersCount)
      
    const topNeighborhoodsByRevenue = [...neighborhoodsList]
      .filter(n => n.revenueCents > 0)
      .sort((a, b) => b.revenueCents - a.revenueCents)

    // Ranking de Produtos
    const productMap = new Map()
    validOrders.forEach((order) => {
      getOrderItems(order).forEach((item) => {
        const id = item.productId || item.id || item.name || 'Produto'
        const name = item.name || 'Produto'
        const qty = Number(item.quantity || 1)
        const priceCents = item.priceCents !== undefined && item.priceCents !== null
          ? Number(item.priceCents)
          : Math.round(Number(item.price || 0) * 100)
        
        const itemRevenueCents = (item.totalCents !== undefined && item.totalCents !== null)
          ? Number(item.totalCents)
          : qty * priceCents

        const previous = productMap.get(id) || { name, qty: 0, revenueCents: 0, ordersCount: 0 }
        productMap.set(id, {
          name,
          qty: previous.qty + qty,
          revenueCents: previous.revenueCents + itemRevenueCents,
          ordersCount: previous.ordersCount + 1
        })
      })
    })
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty)

    // Status dos pedidos
    const statusCounts = { pendente: 0, preparando: 0, entregando: 0, entregue: 0, cancelado: 0 }
    periodOrders.forEach((order) => {
      const stat = normalizeStatus(order.status)
      if (statusCounts[stat] !== undefined) {
        statusCounts[stat]++
      }
    })

    // Cupons e Descontos
    const couponMap = new Map()
    let couponOrdersCount = 0
    let totalDiscountCents = 0
    
    validOrders.forEach((order) => {
      const couponCode = order.couponCode || order.coupon?.code || order.coupon?.couponCode || order.discountCoupon || ''
      const discountCents = getOrderDiscountCents(order)
      
      if (couponCode && String(couponCode).trim()) {
        const code = String(couponCode).trim().toUpperCase()
        const prev = couponMap.get(code) || { code, count: 0, discountCents: 0 }
        prev.count += 1
        prev.discountCents += discountCents
        couponMap.set(code, prev)
        
        couponOrdersCount++
        totalDiscountCents += discountCents
      } else if (discountCents > 0) {
        totalDiscountCents += discountCents
      }
    })
    
    const topCoupon = Array.from(couponMap.values()).sort((a, b) => b.count - a.count)[0] || null

    return {
      periodOrders,
      revenueCents,
      lossesCents,
      totalOrders,
      canceledCount: canceledOrders.length,
      averageTicketCents,
      totalCustomers,
      recurrenceRate,
      deliveryTypes,
      averageDeliveryTime,
      topNeighborhoodsByOrders,
      topNeighborhoodsByRevenue,
      topProducts,
      peakHours,
      timeBlocks,
      maxPeakHour,
      statusCounts,
      couponOrdersCount,
      totalDiscountCents,
      topCoupon,
      payments
    }
  }, [orders, period])

  // Helpers de visualização de bairros
  const activeBairrosList = bairrosTab === 'orders' 
    ? dashboardData.topNeighborhoodsByOrders 
    : dashboardData.topNeighborhoodsByRevenue

  const displayedBairros = showAllBairros ? activeBairrosList : activeBairrosList.slice(0, 5)

  return (
    <main className="bg-[#f9fafb] text-[#111827]">
      <DashboardPageHeader
        title="Estatísticas e Relatórios"
        description="Acompanhe de forma prática o desempenho financeiro, produtos favoritos e dados logísticos."
        icon={FiBarChart2}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {stores.length > 1 && (
            <select
              value={selectedStoreId}
              onChange={(event) => {
                setSelectedStoreId(event.target.value)
                safeSetLocalStorage(SELECTED_STATISTICS_STORE_KEY, event.target.value)
              }}
              className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-orange-200 focus:ring-4 focus:ring-orange-100"
            >
              {stores.map((store) => {
                const value = getStoreKeys(store)[0] || store.id
                return (
                  <option key={store.id} value={value}>
                    {store.name || store.storeName || `Loja ${store.id}`}
                  </option>
                )
              })}
            </select>
          )}

          <AnimatedSegmentedControl
            options={PERIOD_OPTIONS.map((opt, i) => ({ label: opt.label, value: i }))}
            value={periodIdx}
            onChange={(newIdx) => {
              setPeriodIdx(newIdx)
              setShowAllBairros(false)
            }}
            size="md"
            variant="primary"
          />
        </div>
      </DashboardPageHeader>

      <section className="mx-auto max-w-7xl px-4 pt-6 pb-28 lg:pb-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[120px] animate-pulse rounded-3xl border border-gray-100 bg-white shadow-sm" />
              ))}
            </div>
            <div className="h-[400px] animate-pulse rounded-[2rem] border border-gray-100 bg-white shadow-sm" />
          </div>
        ) : !selectedStore ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-gray-50 text-gray-400">
              <FiShoppingBag size={30} />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#111827]">
              Nenhuma loja vinculada
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
              Nenhuma loja vinculada à sua conta. Conclua o onboarding ou fale com o suporte.
            </p>
          </div>
        ) : !canReadOrders ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-orange-50 text-[#f97316]">
              <FiCreditCard size={30} />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#111827]">
              Configure a cobrança para acessar estatísticas.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
              Os relatórios de pedidos ficam disponíveis depois que a operação da loja é liberada.
            </p>
          </div>
        ) : dashboardData.periodOrders.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-gray-50 text-gray-400">
              <FiPieChart size={30} />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#111827]">
              Ainda não há dados suficientes neste período.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
              Nenhum pedido foi encontrado para {selectedStore?.name || 'esta loja'} em {period.label.toLowerCase()}.
            </p>
          </div>
        ) : (
          <>
            {/* LINHA 1: KPIs Principais */}
            <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FiDollarSign}
                label="Faturamento Real"
                value={formatMoneyCents(dashboardData.revenueCents)}
                sub="Receita de pedidos entregues"
                tone="green"
              />
              <StatCard
                icon={FiShoppingBag}
                label="Pedidos no Período"
                value={dashboardData.totalOrders}
                sub={`Exclui ${dashboardData.canceledCount} cancelados`}
                tone="blue"
              />
              <StatCard
                icon={FiTrendingUp}
                label="Ticket Médio"
                value={formatMoneyCents(dashboardData.averageTicketCents)}
                sub="Gasto médio por pedido"
                tone="orange"
              />
              <StatCard
                icon={FiUsers}
                label="Clientes Únicos"
                value={dashboardData.totalCustomers}
                sub={`${dashboardData.recurrenceRate}% de compras repetidas`}
                tone="purple"
              />
            </div>

            {/* Outros 4 KPIs menores e operacionais */}
            <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FiCheckCircle}
                label="Entregues / Finalizados"
                value={`${dashboardData.periodOrders.filter(isCompletedOrder).length} un.`}
                sub="Operação concluída"
                tone="green"
              />
              <StatCard
                icon={FiXCircle}
                label="Cancelados / Taxa"
                value={`${dashboardData.canceledCount} un.`}
                sub={`Taxa de ${dashboardData.totalOrders + dashboardData.canceledCount > 0 ? Math.round((dashboardData.canceledCount / (dashboardData.totalOrders + dashboardData.canceledCount)) * 100) : 0}%`}
                tone="red"
              />
              <StatCard
                icon={FiClock}
                label="Tempo Médio de Entrega"
                value={dashboardData.averageDeliveryTime !== null ? `${dashboardData.averageDeliveryTime} min.` : '—'}
                sub="Tempo desde a criação"
                tone="amber"
              />
              <StatCard
                icon={FiTag}
                label="Cupons e Descontos"
                value={formatMoneyCents(dashboardData.totalDiscountCents)}
                sub={`${dashboardData.couponOrdersCount} pedidos usaram cupom`}
                tone="purple"
              />
            </div>

            {/* GRID PRINCIPAL */}
            <div className="grid gap-6 lg:grid-cols-2">

              {/* WIDGET 1: BAIRROS E REGIÕES */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm flex flex-col">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-[#111827]">Bairros e Regiões</h2>
                    <p className="text-xs text-[#6b7280]">Informações de vendas e bairros atendidos</p>
                  </div>
                  
                  {/* Tabs internas */}
                  <AnimatedSegmentedControl
                    options={[
                      { label: 'Mais Pedidos', value: 'orders' },
                      { label: 'Mais Faturamento', value: 'revenue' }
                    ]}
                    value={bairrosTab}
                    onChange={(newTab) => {
                      setBairrosTab(newTab)
                      setShowAllBairros(false)
                    }}
                    size="sm"
                    variant="primary"
                  />
                </div>

                {activeBairrosList.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <FiMapPin size={24} className="mb-2" />
                    <p className="text-sm font-semibold">Sem informações de bairros ainda.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-x-auto min-w-0 -mx-6 px-6">
                      <table className="w-full text-left border-collapse min-w-[400px]">
                        <thead>
                          <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">
                            <th className="py-2.5">Bairro</th>
                            <th className="py-2.5 text-center">Pedidos</th>
                            <th className="py-2.5 text-right">Total Vendido</th>
                            <th className="py-2.5 text-right">Ticket Médio</th>
                            <th className="py-2.5 text-right">Taxa Entrega</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedBairros.map((item, idx) => (
                            <tr key={item.neighborhood} className="border-b border-gray-50 text-xs font-bold hover:bg-gray-50 transition-colors">
                              <td className="py-3 text-[#111827]">
                                <span className="font-bold text-[#9ca3af] mr-1.5">{idx + 1}.</span>
                                {item.neighborhood}
                              </td>
                              <td className="py-3 text-center text-[#6b7280]">
                                {item.ordersCount} <span className="text-[10px] text-gray-400 font-medium">({item.percentageOfOrders}%)</span>
                              </td>
                              <td className="py-3 text-right text-[#f97316] font-black">
                                {formatMoneyCents(item.revenueCents)}
                              </td>
                              <td className="py-3 text-right text-[#111827]">
                                {formatMoneyCents(item.ticketAverageCents)}
                              </td>
                              <td className="py-3 text-right text-teal-600 font-semibold">
                                {item.deliveryFeeAverageCents > 0 ? formatMoneyCents(item.deliveryFeeAverageCents) : 'Grátis'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {activeBairrosList.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllBairros(!showAllBairros)}
                        className="mt-3 text-xs font-black text-[#f97316] hover:text-[#ea580c] self-center transition-colors"
                      >
                        {showAllBairros ? 'Ver menos' : `Ver todos os ${activeBairrosList.length} bairros`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* WIDGET 2: PRODUTOS MAIS VENDIDOS */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#111827]">Produtos Mais Vendidos</h2>
                    <p className="text-xs text-[#6b7280]">Itens favoritos dos seus clientes</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                    <FiBarChart2 size={20} />
                  </div>
                </div>

                {dashboardData.topProducts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <FiShoppingBag size={24} className="mb-2" />
                    <p className="text-sm font-semibold">Sem dados de produtos no período.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-x-auto min-w-0 -mx-6 px-6">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">
                          <th className="py-2.5">Produto</th>
                          <th className="py-2.5 text-center">Unidades</th>
                          <th className="py-2.5 text-center">Aparic. em Pedidos</th>
                          <th className="py-2.5 text-right">Total Faturado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.topProducts.slice(0, 5).map((product, idx) => (
                          <tr key={product.name} className="border-b border-gray-50 text-xs font-bold hover:bg-gray-50 transition-colors">
                            <td className="py-3 text-[#111827]">
                              <span className="font-bold text-[#9ca3af] mr-1.5">{idx + 1}.</span>
                              {product.name}
                            </td>
                            <td className="py-3 text-center text-[#f97316] font-black">
                              {product.qty} un.
                            </td>
                            <td className="py-3 text-center text-[#6b7280]">
                              {product.ordersCount} pedidos
                            </td>
                            <td className="py-3 text-right text-[#111827]">
                              {formatMoneyCents(product.revenueCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* WIDGET 3: HORÁRIOS DE PICO & TURNOS */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-black text-[#111827]">Horários e Turnos de Pico</h2>
                  <p className="text-xs text-[#6b7280]">Volume de pedidos por hora e faixa de horário</p>
                </div>

                {/* 24h Bar graph */}
                <div className="flex h-28 items-end gap-1 sm:gap-2 mb-6 border-b border-gray-100 pb-4">
                  {dashboardData.peakHours.map((count, hour) => {
                    const heightPercent = count > 0 ? Math.max((count / dashboardData.maxPeakHour) * 100, 10) : 0
                    if (count === 0 && (hour < 8 || hour > 23)) return null
                    
                    return (
                      <div key={hour} className="group relative flex flex-1 flex-col items-center gap-2">
                        <div className="absolute -top-8 hidden rounded bg-[#111827] px-2 py-1 text-[10px] font-black text-white group-hover:block whitespace-nowrap z-10">
                          {count} ped.
                        </div>
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-300 hover:bg-[#ea580c] ${count > 0 ? 'bg-[#f97316]' : 'bg-gray-100'}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[9px] font-bold text-gray-400">{hour}h</span>
                      </div>
                    )
                  })}
                </div>

                {/* Turnos Progress */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProgressBar label="🌞 Manhã (06h - 12h)" value={dashboardData.timeBlocks.manhã} total={dashboardData.totalOrders} colorClass="bg-amber-400" />
                  <ProgressBar label="🌇 Tarde (12h - 18h)" value={dashboardData.timeBlocks.tarde} total={dashboardData.totalOrders} colorClass="bg-orange-400" />
                  <ProgressBar label="🌃 Noite (18h - 00h)" value={dashboardData.timeBlocks.noite} total={dashboardData.totalOrders} colorClass="bg-indigo-500" />
                  <ProgressBar label="🌌 Madrugada (00h - 06h)" value={dashboardData.timeBlocks.madrugada} total={dashboardData.totalOrders} colorClass="bg-slate-700" />
                </div>
              </div>

              {/* WIDGET 4: STATUS & FLUXO DE PEDIDOS */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-4">
                    <h2 className="text-lg font-black text-[#111827]">Fluxo e Status dos Pedidos</h2>
                    <p className="text-xs text-[#6b7280]">Distribuição percentual da operação</p>
                  </div>

                  <ProgressBar label="Pendente" value={dashboardData.statusCounts.pendente} total={dashboardData.periodOrders.length} colorClass="bg-amber-500" />
                  <ProgressBar label="Preparando" value={dashboardData.statusCounts.preparando} total={dashboardData.periodOrders.length} colorClass="bg-blue-500" />
                  <ProgressBar label="Em Rota (Entregando)" value={dashboardData.statusCounts.entregando} total={dashboardData.periodOrders.length} colorClass="bg-sky-500" />
                  <ProgressBar label="Entregue" value={dashboardData.statusCounts.entregue} total={dashboardData.periodOrders.length} colorClass="bg-green-500" />
                  <ProgressBar label="Cancelado" value={dashboardData.statusCounts.cancelado} total={dashboardData.periodOrders.length} colorClass="bg-red-500" />
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4 flex gap-2 rounded-2xl bg-blue-50/50 p-3 text-[11px] font-semibold text-blue-900 leading-5">
                  <FiActivity className="shrink-0 text-blue-600 mt-0.5" size={14} />
                  <span>
                    A taxa de cancelamento está em <strong>{dashboardData.periodOrders.length > 0 ? Math.round((dashboardData.statusCounts.cancelado / dashboardData.periodOrders.length) * 100) : 0}%</strong>. Monitore o tempo de preparo para evitar que os clientes desistam dos pedidos.
                  </span>
                </div>
              </div>

              {/* WIDGET 5: CUPONS E CAMPANHAS */}
              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#111827]">Uso de Cupons e Campanhas</h2>
                    <p className="text-xs text-[#6b7280]">Impacto de promoções nas vendas da loja</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                    <FiPercent size={18} />
                  </div>
                </div>

                {dashboardData.totalDiscountCents === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-purple-50 text-purple-600 mb-3">
                      <FiTag size={24} />
                    </div>
                    <h3 className="text-sm font-black text-[#111827]">Nenhum cupom ou desconto ativado ainda</h3>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-[#6b7280]">
                      Cupons de desconto atraem e fidelizam clientes. Crie campanhas no menu "Cardápio &gt; Cupons" e impulsione o seu faturamento.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-3 items-center">
                    <div className="bg-[#fdf4ff] rounded-[1.5rem] border border-purple-100 p-5 flex flex-col justify-between h-full">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">Cupom Mais Usado</p>
                        <p className="mt-2 text-2xl font-black text-purple-900 tracking-tight">
                          {dashboardData.topCoupon ? dashboardData.topCoupon.code : 'Nenhum'}
                        </p>
                      </div>
                      {dashboardData.topCoupon && (
                        <p className="mt-3 text-xs font-semibold text-purple-700">
                          Usado <strong>{dashboardData.topCoupon.count} vezes</strong>, gerando <strong>{formatMoneyCents(dashboardData.topCoupon.discountCents)}</strong> em descontos.
                        </p>
                      )}
                    </div>

                    <div className="bg-emerald-50/50 rounded-[1.5rem] border border-emerald-100 p-5 flex flex-col justify-between h-full">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Descontado</p>
                        <p className="mt-2 text-2xl font-black text-emerald-950 tracking-tight">
                          {formatMoneyCents(dashboardData.totalDiscountCents)}
                        </p>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-emerald-700">
                        Soma total economizada pelos clientes no período.
                      </p>
                    </div>

                    <div className="bg-blue-50/50 rounded-[1.5rem] border border-blue-100 p-5 flex flex-col justify-between h-full">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Impacto Médio</p>
                        <p className="mt-2 text-2xl font-black text-blue-950 tracking-tight">
                          {dashboardData.couponOrdersCount > 0 ? formatMoneyCents(dashboardData.totalDiscountCents / dashboardData.couponOrdersCount) : '—'}
                        </p>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-blue-700">
                        Desconto médio concedido por pedido participante.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </>
        )}
        <DashboardFooter store={selectedStore} />
      </section>
    </main>
  )
}
