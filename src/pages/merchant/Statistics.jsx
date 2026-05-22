import { useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import {
  collection,
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
  FiCreditCard,
  FiDollarSign,
  FiMapPin,
  FiPieChart,
  FiShoppingBag,
  FiTag,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 0 },
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
]

// --- UTILIDADES ---
function normalizeStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()
  const map = {
    novo: 'pendente', received: 'pendente', aguardando: 'pendente', pendente: 'pendente',
    aceito: 'preparando', confirmado: 'preparando', preparo: 'preparando', preparando: 'preparando',
    entregando: 'em_rota', saiu_para_entrega: 'em_rota', em_rota: 'em_rota',
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

function getOrderDiscountTotal(order) {
  const discount = normalizeMoney(order?.discount, order?.discountCents)
  const promo = normalizeMoney(order?.promotionSavings, order?.promotionSavingsCents)
  return discount + promo
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
    <div className="group rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-gray-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[#6b7280]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-[#111827]">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs font-bold text-[#9ca3af]">
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

function ProgressBar({ label, value, total, colorClass, bgClass }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="text-[#6b7280]">{percentage}% ({value})</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }} />
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
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [periodIdx, setPeriodIdx] = useState(1) // Default: 7 dias

  const period = PERIOD_OPTIONS[periodIdx]
  const selectedStore = useMemo(() => {
  if (!stores.length) return null

  return (
    stores.find((store) => getStoreKeys(store).includes(selectedStoreId)) ||
    stores[0] ||
    null
  )
}, [selectedStoreId, stores])

  useEffect(() => {
  if (!user?.uid) {
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

  function handleStoresSnapshot(snapshot) {
    snapshot.docs.forEach((storeDoc) => {
      storesMap.set(storeDoc.id, normalizeStoreDoc(storeDoc))
    })

    publishStores()
  }

  function handleStoresError(error) {
    console.error('Erro ao carregar lojas nas estatísticas:', error)
    setStores([])
    setOrders([])
    setLoading(false)
  }

  function subscribeStores(storesQuery) {
    const unsubscribe = onSnapshot(
      storesQuery,
      handleStoresSnapshot,
      handleStoresError
    )

    unsubscribers.push(unsubscribe)
  }

  subscribeStores(query(collection(db, 'stores'), where('ownerId', '==', uid)))
  subscribeStores(query(collection(db, 'stores'), where('ownerUid', '==', uid)))
  subscribeStores(query(collection(db, 'stores'), where('owner.uid', '==', uid)))
  subscribeStores(query(collection(db, 'stores'), where('allowedUserIds', 'array-contains', uid)))
  subscribeStores(query(collection(db, 'stores'), where('merchantUids', 'array-contains', uid)))

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}, [user?.uid])

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
  if (!selectedStore) {
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
let finishedQueries = 0
const queryTargets = [
  { field: 'storeId', values: baseKeys },
  { field: 'storeSlug', values: baseKeys },
]

function publishOrders() {
  const data = Array.from(ordersMap.values()).sort((a, b) => {
    const dateA = getOrderDate(a)?.getTime?.() || 0
    const dateB = getOrderDate(b)?.getTime?.() || 0

    return dateB - dateA
  })

  setOrders(data)
  setLoading(false)
}

function handleQueryDone() {
  finishedQueries += 1

  if (finishedQueries >= queryTargets.length) {
    publishOrders()
  }
}

queryTargets.forEach(({ field, values }) => {
  const qOrders = query(
    collection(db, 'orders'),
    where(field, 'in', values),
    where('createdAt', '>=', cutoffDate),
    orderBy('createdAt', 'desc')
  )

  const unsubscribe = onSnapshot(
    qOrders,
    (ordersSnap) => {
      ordersSnap.docs.forEach((orderDoc) => {
        ordersMap.set(orderDoc.id, {
          id: orderDoc.id,
          ...orderDoc.data(),
        })
      })

      handleQueryDone()
    },
    (error) => {
      console.error(`Erro ao carregar pedidos por ${field}:`, error)
      handleQueryDone()
    }
  )

  unsubscribers.push(unsubscribe)
})

return () => {
  unsubscribers.forEach((unsubscribe) => unsubscribe())
}
}, [selectedStore])

  const dashboardData = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const cutoff = period.days === 0 ? startOfToday : now - period.days * 24 * 60 * 60 * 1000

    const periodOrders = orders.filter((order) => {
      const date = getOrderDate(order)
      return date ? date.getTime() >= cutoff : false
    })

    const validOrders = periodOrders.filter(o => normalizeStatus(o.status) !== 'cancelado')
    const canceledOrders = periodOrders.filter(o => normalizeStatus(o.status) === 'cancelado')
    
    // Faturamento e Perdas
    const revenue = validOrders.reduce((acc, o) => acc + normalizeMoney(o.total, o.totalCents), 0)
    const losses = canceledOrders.reduce((acc, o) => acc + normalizeMoney(o.total, o.totalCents), 0)
    const totalDiscounts = validOrders.reduce((acc, o) => acc + getOrderDiscountTotal(o), 0)
    
    const totalOrders = validOrders.length
    const averageTicket = totalOrders > 0 ? revenue / totalOrders : 0
    
    // Clientes Únicos
    const uniquePhones = new Set(validOrders.map(getCustomerPhone).filter(Boolean))
const totalCustomers = uniquePhones.size
const recurrenceRate =
  totalOrders > 0 && totalCustomers > 0
    ? Math.max(0, Math.round(((totalOrders - totalCustomers) / totalOrders) * 100))
    : 0

    // Ranking de Produtos
    const productMap = new Map()
    validOrders.forEach((order) => {
      if (!Array.isArray(order.items)) return
      order.items.forEach((item) => {
        const name = item.name || 'Produto'
        const qty = Number(item.quantity || 1)
        const itemTotal = normalizeMoney(item.total, item.totalCents) || 0
        const previous = productMap.get(name) || { name, qty: 0, revenue: 0 }
        productMap.set(name, { ...previous, qty: previous.qty + qty, revenue: previous.revenue + itemTotal })
      })
    })
    const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)

    // Formas de Pagamento e Entrega
    const payments = { pix: 0, card: 0, cash: 0, other: 0 }
    const deliveryTypes = { delivery: 0, pickup: 0, table: 0 }

    
    // Gráfico de Horários (0h às 23h)
    const peakHours = Array(24).fill(0)

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
        peakHours[date.getHours()]++
      }
    })

    const maxPeakHour = Math.max(...peakHours, 1) // Prevent division by zero

    return {
      periodOrders,
      revenue,
      losses,
      totalDiscounts,
      totalOrders,
      canceledCount: canceledOrders.length,
      averageTicket,
      totalCustomers,
      recurrenceRate,
      topProducts,
      payments,
      deliveryTypes,
      peakHours,
      maxPeakHour
    }
  }, [orders, period.days])

  return (
    <main className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiBarChart2 size={18} />
                </span>
                <h1 className="text-2xl font-black tracking-tight text-[#111827]">
                  Estatísticas e Relatórios
                </h1>
              </div>
              <p className="mt-1 text-sm text-[#6b7280]">
                Inteligência de vendas e acompanhamento de resultados.
              </p>
            </div>
          </div>

          {stores.length > 1 && (
  <select
    value={selectedStoreId}
    onChange={(event) => {
      setSelectedStoreId(event.target.value)
      safeSetLocalStorage(SELECTED_STATISTICS_STORE_KEY, event.target.value)
    }}
    className="h-11 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-orange-200 focus:ring-4 focus:ring-orange-100"
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

          <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
            {PERIOD_OPTIONS.map((option, index) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setPeriodIdx(index)}
                className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-black transition ${
                  periodIdx === index
                    ? 'bg-[#f97316] text-white shadow-sm'
                    : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[120px] animate-pulse rounded-3xl border border-gray-100 bg-white shadow-sm" />
              ))}
            </div>
            <div className="h-[400px] animate-pulse rounded-[2rem] border border-gray-100 bg-white shadow-sm" />
          </div>
        ) : dashboardData.periodOrders.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-gray-50 text-gray-400">
              <FiPieChart size={30} />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#111827]">
              Sem dados neste período
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
              Nenhum pedido encontrado para {selectedStore?.name || 'esta loja'} em {period.label.toLowerCase()}.
            </p>
          </div>
        ) : (
          <>
            {/* LINHA 1: KPIs Principais */}
            <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FiDollarSign}
                label="Faturamento Real"
                value={formatMoney(dashboardData.revenue)}
                sub="Receita de pedidos válidos"
                tone="green"
              />
              <StatCard
                icon={FiShoppingBag}
                label="Pedidos Finalizados"
                value={dashboardData.totalOrders}
                sub="Sem cancelamentos"
                tone="blue"
              />
              <StatCard
                icon={FiTrendingUp}
                label="Ticket Médio"
                value={formatMoney(dashboardData.averageTicket)}
                sub="Gasto médio por cliente"
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

            {/* LINHA 2 e 3: Gráficos e Detalhamentos */}
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr_1fr]">
              
              {/* COLUNA 1: Ranking de Produtos & Horários */}
              <div className="flex flex-col gap-6">
                
                {/* Ranking de Produtos */}
                <div className="flex-1 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-[#111827]">Ranking de Produtos</h2>
                      <p className="text-sm text-[#6b7280]">Os 5 mais vendidos do período</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                      <FiBarChart2 size={20} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    {dashboardData.topProducts.map((product, index) => {
                      const maxQty = dashboardData.topProducts[0]?.qty || 1
                      const percentage = (product.qty / maxQty) * 100

                      return (
                        <div key={product.name}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-[#111827]">
                              {index + 1}. {product.name}
                            </span>
                            <span className="font-black text-[#f97316]">
                              {formatMoney(product.revenue)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-[#f97316] transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-xs font-bold text-[#6b7280]">
                              {product.qty} un.
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {dashboardData.topProducts.length === 0 && (
                      <p className="text-center text-sm font-medium text-gray-500 py-4">Sem dados de produtos ainda.</p>
                    )}
                  </div>
                </div>

                {/* Gráfico de Horários de Pico */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-lg font-black text-[#111827]">Horários de Pico</h2>
                    <p className="text-sm text-[#6b7280]">Volume de pedidos por hora do dia</p>
                  </div>
                  
                  <div className="flex h-32 items-end gap-1 sm:gap-2">
                    {dashboardData.peakHours.map((count, hour) => {
                      const heightPercent = count > 0 ? Math.max((count / dashboardData.maxPeakHour) * 100, 10) : 0
                      // Mostrar apenas horas com algum dado ou horas específicas para não poluir muito
                      if(count === 0 && (hour < 8 || hour > 23)) return null
                      
                      return (
                        <div key={hour} className="group relative flex flex-1 flex-col items-center gap-2">
                          {/* Tooltip invisível até o hover */}
                          <div className="absolute -top-8 hidden rounded bg-[#111827] px-2 py-1 text-xs font-black text-white group-hover:block">
                            {count}
                          </div>
                          {/* Barra */}
                          <div 
                            className={`w-full rounded-t-sm transition-all duration-300 hover:bg-[#ea580c] ${count > 0 ? 'bg-[#f97316]' : 'bg-gray-100'}`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          {/* Label da hora */}
                          <span className="text-[10px] font-bold text-gray-400">{hour}h</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* COLUNA 2: Comportamento de Operação */}
              <div className="flex flex-col gap-6">
                
                {/* Formas de Pagamento */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                      <FiCreditCard size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[#111827]">Pagamentos</h2>
                    </div>
                  </div>
                  <ProgressBar label="Pix" value={dashboardData.payments.pix} total={dashboardData.totalOrders} colorClass="bg-teal-500" />
                  <ProgressBar label="Cartão" value={dashboardData.payments.card} total={dashboardData.totalOrders} colorClass="bg-blue-500" />
                  <ProgressBar label="Dinheiro" value={dashboardData.payments.cash} total={dashboardData.totalOrders} colorClass="bg-emerald-500" />
                </div>

                {/* Tipos de Entrega */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <FiMapPin size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[#111827]">Modalidade</h2>
                    </div>
                  </div>
                  <ProgressBar label="Delivery" value={dashboardData.deliveryTypes.delivery} total={dashboardData.totalOrders} colorClass="bg-sky-500" />
                  <ProgressBar label="Retirada no Balcão" value={dashboardData.deliveryTypes.pickup} total={dashboardData.totalOrders} colorClass="bg-indigo-500" />
                  <ProgressBar label="Consumo na Mesa" value={dashboardData.deliveryTypes.table} total={dashboardData.totalOrders} colorClass="bg-fuchsia-500" />
                </div>

                {/* Dica de Operação */}
                <div className="flex-1 rounded-[2rem] border border-blue-100 bg-blue-50 p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-blue-800">
                    <FiActivity size={18} />
                    <p className="font-black uppercase tracking-wide text-[11px]">Inteligência PratoBy</p>
                  </div>
                  <p className="text-sm font-semibold leading-6 text-blue-900">
                    Sua taxa de recompra está em <strong>{dashboardData.recurrenceRate}%</strong>. {dashboardData.recurrenceRate < 30 ? "Ofereça cupons para clientes antigos e veja esse número crescer!" : "Excelente retenção! Seus clientes adoram seus produtos."}
                  </p>
                </div>
              </div>

              {/* COLUNA 3: Perdas e Descontos */}
              <div className="flex flex-col gap-6">
                
                {/* Cancelamentos */}
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wide text-red-800">
                        Cancelamentos
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-red-600/80">
                        Dinheiro que deixou de entrar
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
                      <FiTrendingDown size={24} />
                    </div>
                  </div>

                  <p className="text-3xl font-black tracking-tight text-red-700">
                    {formatMoney(dashboardData.losses)}
                  </p>
                  
                  <div className="mt-4 flex items-center justify-between border-t border-red-200/50 pt-4 text-sm font-bold text-red-800">
                    <span>Total perdidos</span>
                    <span className="rounded-full bg-white px-3 py-1 shadow-sm">{dashboardData.canceledCount} pedidos</span>
                  </div>
                </div>

                {/* Descontos Concedidos */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wide text-[#6b7280]">
                        Economia Gerada
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-[#9ca3af]">
                        Cupons e promoções ativas
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 shadow-sm">
                      <FiTag size={24} />
                    </div>
                  </div>

                  <p className="text-3xl font-black tracking-tight text-[#111827]">
                    {formatMoney(dashboardData.totalDiscounts)}
                  </p>
                  
                  <div className="mt-4 border-t border-gray-100 pt-4 text-xs font-semibold leading-5 text-[#6b7280]">
                    Descontos atraem vendas. Compare este valor com o seu faturamento para medir o impacto das suas campanhas.
                  </div>
                </div>

                {/* Card de Atalho Futuro */}
                <div className="flex-1 rounded-[2rem] border border-dashed border-gray-200 bg-gray-50 p-6 text-center flex flex-col items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-200 text-gray-400 mb-3">
                    <FiArrowUpRight size={24} />
                  </div>
                  <p className="text-sm font-black text-[#111827]">Exportar Relatórios</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280]">Em breve: baixe em Excel/PDF</p>
                </div>

              </div>
            </div>
          </>
        )}
        <DashboardFooter store={selectedStore} />
      </section>
    </main>
  )
}

