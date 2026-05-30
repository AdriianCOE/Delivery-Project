import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { Link, useParams } from 'react-router-dom'
import { formatBrazilianPhone, normalizeBrazilianPhoneForWhatsApp } from '../../utils/phone'

import {
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiHeart,
  FiLoader,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiShoppingBag,
  FiStar,
  FiTrash2,
  FiTruck,
  FiUser,
  FiX,
  FiXCircle,
} from 'react-icons/fi'

import { db, functions } from '../../services/firebase'
import { useCart } from '../../contexts/CartContext'

const CUSTOMER_KEY = '@PratoBy:customer'
const LEGACY_CUSTOMER_KEY = '@DeliveryApp:customer'
const TRACKING_TOKENS_KEY = '@PratoBy:trackingTokens'

const STATUS_META = {
  pendente: {
    label: 'Aguardando',
    description: 'A loja recebeu seu pedido.',
    icon: FiClock,
    className: 'bg-amber-50 text-amber-700 border-amber-100',
    bar: 'w-1/4 bg-amber-500',
  },
  preparando: {
    label: 'Preparando',
    description: 'Seu pedido está em preparo.',
    icon: FiPackage,
    className: 'bg-purple-50 text-purple-700 border-purple-100',
    bar: 'w-2/4 bg-purple-500',
  },
  em_rota: {
    label: 'Em rota',
    description: 'Seu pedido saiu para entrega.',
    icon: FiTruck,
    className: 'bg-sky-50 text-sky-700 border-sky-100',
    bar: 'w-3/4 bg-sky-500',
  },
  entregue: {
    label: 'Entregue',
    description: 'Pedido finalizado.',
    icon: FiCheckCircle,
    className: 'bg-orange-50 text-[#f97316] border-orange-100',
    bar: 'w-full bg-[#f97316]',
  },
  cancelado: {
    label: 'Cancelado',
    description: 'Pedido cancelado.',
    icon: FiXCircle,
    className: 'bg-red-50 text-red-600 border-red-100',
    bar: 'w-full bg-red-500',
  },
}

const EMPTY_PROFILE = {
  name: '',
  phone: '',
  neighborhood: '',
  street: '',
  number: '',
  complement: '',
  reference: '',
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function loadTrackingTokens() {
  try {
    const tokens = safeJsonParse(
      localStorage.getItem(TRACKING_TOKENS_KEY),
      []
    )

    if (!Array.isArray(tokens)) return []

    return uniqueArray(
      tokens
        .map((token) => String(token || '').trim())
        .filter(Boolean)
    ).slice(0, 30)
  } catch {
    return []
  }
}

function loadCustomerProfile() {
  try {
    const legacy = safeJsonParse(localStorage.getItem(LEGACY_CUSTOMER_KEY), null)
    const current = safeJsonParse(localStorage.getItem(CUSTOMER_KEY), null)

    const merged = {
      ...EMPTY_PROFILE,
      ...(legacy || {}),
      ...(current || {}),
    }

    if (!merged.name && !merged.phone) return null

    return merged
  } catch {
    return null
  }
}

function saveCustomerProfile(profile) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile))
    localStorage.setItem(LEGACY_CUSTOMER_KEY, JSON.stringify(profile))
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function clearCustomerProfile() {
  try {
    localStorage.removeItem(CUSTOMER_KEY)
    localStorage.removeItem(LEGACY_CUSTOMER_KEY)
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function normalizeStatus(status) {
  if (status === 'entregando') return 'em_rota'
  return status || 'pendente'
}



function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  // Compatibilidade com pedidos antigos salvos em centavos.
  if (numericValue > 300) return numericValue / 100

  return numericValue
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function toDate(value) {
  if (!value) return null
  if (value?.toDate) return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = toDate(value)

  if (!date) return '—'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getOrderTotal(order) {
  return normalizeMoney(order?.total, order?.totalCents)
}

function getOrderStoreId(order, fallbackSlug) {
  return order?.storeSlug || order?.storeId || order?.storeDocId || fallbackSlug
}

function getOrderStoreKeys(order) {
  return uniqueArray([order?.storeSlug, order?.storeId, order?.storeDocId])
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function getItemQuantity(item) {
  return Number(item?.quantity || item?.qty || 1)
}

function getItemName(item) {
  return item?.name || item?.productName || item?.title || 'Produto'
}

function getItemsSummary(order) {
  if (order?.itemsSummary) return order.itemsSummary

  const items = getOrderItems(order)

  if (!items.length) return 'Itens do pedido'

  const summary = items
    .slice(0, 3)
    .map((item) => `${getItemQuantity(item)}x ${getItemName(item)}`)
    .join(', ')

  return items.length > 3 ? `${summary}...` : summary
}

function isActiveOrder(order) {
  return ['pendente', 'preparando', 'em_rota'].includes(
    normalizeStatus(order?.status)
  )
}

function canReviewOrder(order) {
  return (
    normalizeStatus(order?.status) === 'entregue' &&
    !order?.review?.submitted &&
    !order?.reviewId
  )
}

function isProductAvailable(product) {
  if (!product) return false
  if (product.deletedAt || product.isDeleted) return false
  if (product.isAvailable === false) return false
  if (product.isVisible === false) return false
  if (product.isActive === false) return false
  if (product.active === false) return false
  if (Number(product.stock) === 0) return false

  return true
}

function StatusBadge({ status }) {
  const currentStatus = normalizeStatus(status)
  const meta = STATUS_META[currentStatus] || STATUS_META.pendente
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${meta.className}`}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <Icon size={25} />
      </div>

      <h3 className="mt-4 text-base font-black text-[#111827]">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#6b7280]">
        {description}
      </p>
    </div>
  )
}

export default function CustomerDrawer({
  isOpen,
  onClose,
  products = [],
  store = null,
}) {
  const { slug } = useParams()
  const { addToCart, clearCart } = useCart()

  const [orders, setOrders] = useState([])
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [reorderingId, setReorderingId] = useState(null)
  const [toast, setToast] = useState('')
  const [showOnlyCurrentStore, setShowOnlyCurrentStore] = useState(true)

  const currentStoreKeys = useMemo(() => {
    return uniqueArray([
      store?.storeSlug,
      store?.slug,
      store?.storeId,
      store?.id,
      slug,
    ])
  }, [slug, store])

  const visibleOrders = useMemo(() => {
    if (!showOnlyCurrentStore || currentStoreKeys.length === 0) return orders

    return orders.filter((order) => {
      const orderKeys = getOrderStoreKeys(order)

      if (!orderKeys.length) return true

      return orderKeys.some((key) => currentStoreKeys.includes(key))
    })
  }, [currentStoreKeys, orders, showOnlyCurrentStore])

  const activeOrders = useMemo(() => {
    return visibleOrders.filter(isActiveOrder)
  }, [visibleOrders])

  const deliveredOrders = useMemo(() => {
    return visibleOrders.filter(
      (order) => normalizeStatus(order.status) === 'entregue'
    )
  }, [visibleOrders])

  const totalSpent = useMemo(() => {
    return deliveredOrders.reduce((acc, order) => acc + getOrderTotal(order), 0)
  }, [deliveredOrders])

  const reviewPendingCount = useMemo(() => {
    return visibleOrders.filter(canReviewOrder).length
  }, [visibleOrders])

const firstName = useMemo(() => {
  return profile?.name?.split(' ')?.[0] || 'Cliente'
}, [profile?.name])

const [greetingIndex] = useState(() => Math.floor(Math.random() * 4))

const greeting = useMemo(() => {
  if (!profile?.name) return 'Seu histórico PratoBy'

  const messages = [
    `Olá, ${firstName}! Bora pedir de novo? 😋`,
    `${firstName}, seus pedidos estão aqui.`,
    `Oi, ${firstName}! Que bom te ver de volta.`,
    `${firstName}, acompanhe seus pedidos em tempo real.`,
  ]

  return messages[greetingIndex] || messages[0]
}, [firstName, greetingIndex, profile?.name])

  const loading = loadingProfile || loadingOrders

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const loadedProfile = loadCustomerProfile()

    if (loadedProfile) {
      const normalizedProfile = {
        ...loadedProfile,
        phone: normalizeBrazilianPhoneForWhatsApp(loadedProfile.phone),
      }

      saveCustomerProfile(normalizedProfile)
      setProfile(normalizedProfile)
    } else {
      setProfile(null)
    }

    setLoadingProfile(false)
  }, [isOpen])

  useEffect(() => {
  if (!isOpen) {
    setOrders([])
    setLoadingOrders(false)
    return undefined
  }

  const trackingTokens = loadTrackingTokens()

  if (!trackingTokens.length) {
    setOrders([])
    setLoadingOrders(false)
    return undefined
  }

  setLoadingOrders(true)

  const ordersById = new Map()
  const loadedTokens = new Set()

  const updateOrders = () => {
    const data = [...ordersById.values()].sort((a, b) => {
      const dateA = toDate(a.createdAt)?.getTime() || 0
      const dateB = toDate(b.createdAt)?.getTime() || 0

      return dateB - dateA
    })

    setOrders(data)

    if (loadedTokens.size >= trackingTokens.length) {
      setLoadingOrders(false)
    }
  }

  const unsubscribes = trackingTokens.map((token) => {
    const orderRef = doc(db, 'orders', token)

    return onSnapshot(
      orderRef,
      (snapshot) => {
        loadedTokens.add(token)

        if (snapshot.exists()) {
          ordersById.set(snapshot.id, {
            id: snapshot.id,
            ...snapshot.data(),
          })
        } else {
          ordersById.delete(token)
        }

        updateOrders()
      },
      () => {
        loadedTokens.add(token)
        updateOrders()
      }
    )
  })

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe())
  }
}, [isOpen])

  const handleClearProfile = useCallback(() => {
    const confirmed = window.confirm(
      'Deseja limpar os dados salvos neste aparelho?'
    )

    if (!confirmed) return

    clearCustomerProfile()
    setProfile(null)
    setOrders([])
    showToast('Dados removidos deste aparelho.')
  }, [showToast])

  const fetchProductsForOrder = useCallback(
    async (order) => {
      if (products?.length > 0) return products

      const orderStoreId = getOrderStoreId(order, slug)

      if (!orderStoreId) return []

      const productsQuery = query(collection(db, 'publicStores', orderStoreId, 'products'))
      const snapshot = await getDocs(productsQuery)
      const publicProducts = snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...productDoc.data(),
      }))

      if (publicProducts.length > 0) return publicProducts

      const getPublicCatalog = httpsCallable(functions, 'getPublicCatalog')
      const result = await getPublicCatalog({
        storeId: orderStoreId,
        storeSlug: order?.storeSlug || slug,
      })

      return Array.isArray(result?.data?.products) ? result.data.products : []
    },
    [products, slug]
  )

  const handleReorder = useCallback(
    async (order) => {
      if (!order?.id || reorderingId) return

      const confirmed = window.confirm(
        'Deseja refazer este pedido? Seu carrinho atual será esvaziado.'
      )

      if (!confirmed) return

      setReorderingId(order.id)

      try {
        const menuItems = await fetchProductsForOrder(order)

        if (!menuItems.length) {
          showToast('O cardápio da loja está indisponível no momento.')
          return
        }

        const unavailable = []
        const itemsToAdd = []

        getOrderItems(order).forEach((orderItem) => {
          const currentProduct = menuItems.find(
            (product) => product.id === orderItem.id
          )

          if (isProductAvailable(currentProduct)) {
            itemsToAdd.push({
              product: {
                ...currentProduct,
                extras: orderItem.extras || orderItem.addons || [],
                observation: orderItem.observation || '',
              },
              quantity: getItemQuantity(orderItem),
            })
          } else {
            unavailable.push(getItemName(orderItem))
          }
        })

        if (unavailable.length > 0) {
          alert(
            `Alguns itens não estão mais disponíveis e foram removidos:\n\n- ${unavailable.join(
              '\n- '
            )}`
          )
        }

        if (!itemsToAdd.length) {
          showToast('Nenhum item desse pedido está disponível hoje.')
          return
        }

        clearCart()

        itemsToAdd.forEach(({ product, quantity }) => {
          for (let index = 0; index < quantity; index += 1) {
            addToCart(product)
          }
        })

        onClose()
        showToast('Itens adicionados ao carrinho.')
      } catch (error) {
        console.error(error)
        showToast('Erro ao repetir pedido. Tente novamente.')
      } finally {
        setReorderingId(null)
      }
    },
    [
      addToCart,
      clearCart,
      fetchProductsForOrder,
      onClose,
      reorderingId,
      showToast,
    ]
  )

  return (
    <div 
      className={`fixed inset-0 z-[90] flex justify-end transition-all duration-300 ${
        isOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
      }`}
    >
      {/* Fundo escuro com animação de fade */}
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Fechar perfil"
      />

      {/* Painel lateral com animação de deslizar (slide) */}
      <aside 
        className={`relative flex h-full w-full max-w-md flex-col bg-[#f9fafb] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="sticky top-0 z-20 border-b border-gray-100 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                <FiUser size={23} />
              </div>

              <div>
                <h2 className="text-xl font-black tracking-tight text-[#111827]">
                  Meu perfil
                </h2>

                <p className="mt-1 text-sm text-[#6b7280]">
                  Histórico, recibos e pedidos ativos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
              aria-label="Fechar"
            >
              <FiX size={20} />
            </button>
          </div>

          {profile && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-3">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Exibição
                  </p>

                  <p className="mt-0.5 text-sm font-bold text-[#111827]">
                    Apenas pedidos desta loja
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={showOnlyCurrentStore}
                  onChange={(event) =>
                    setShowOnlyCurrentStore(event.target.checked)
                  }
                  className="h-5 w-5 accent-[#f97316]"
                />
              </label>
            </div>
          )}
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {toast && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-sm font-black text-[#f97316]">
              {toast}
            </div>
          )}

          <section className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm">
            {profile ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-tight text-[#111827]">
                      {greeting}
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#6b7280]">
                        <FiPhone className="text-[#f97316]" />
                        {formatBrazilianPhone(profile.phone) || 'Telefone não informado'}
                      </div>

                      {profile.neighborhood && (
                        <div className="flex items-center gap-2 text-sm font-bold text-[#6b7280]">
                          <FiMapPin className="text-[#f97316]" />
                          {profile.neighborhood}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-[112px] rounded-2xl bg-[#111827] px-4 py-3 text-right text-white">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/60">
                      Total gasto
                    </p>

                    <p className="mt-1 text-lg font-black leading-tight">
                      {formatMoney(totalSpent)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[#f9fafb] p-3 text-center">
                    <p className="text-lg font-black text-[#111827]">
                      {visibleOrders.length}
                    </p>
                    <p className="text-[11px] font-bold text-[#6b7280]">
                      pedidos
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 p-3 text-center">
                    <p className="text-lg font-black text-[#f97316]">
                      {deliveredOrders.length}
                    </p>
                    <p className="text-[11px] font-bold text-orange-700">
                      entregues
                    </p>
                  </div>

                  <div className="rounded-2xl bg-amber-50 p-3 text-center">
                    <p className="text-lg font-black text-amber-700">
                      {activeOrders.length}
                    </p>
                    <p className="text-[11px] font-bold text-amber-700">
                      ativos
                    </p>
                  </div>
                </div>

                {activeOrders.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600">
                        <FiClock className="animate-pulse" />
                      </div>

                      <div>
                        <p className="text-sm font-black text-amber-900">
                          Você possui pedido ativo
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          Acompanhe o andamento em tempo real.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {reviewPendingCount > 0 && (
                  <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#f97316]">
                        <FiStar />
                      </div>

                      <div>
                        <p className="text-sm font-black text-orange-900">
                          Avaliação disponível
                        </p>

                        <p className="mt-1 text-xs leading-5 text-orange-800">
                          Você tem {reviewPendingCount} pedido entregue aguardando avaliação privada.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleClearProfile}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 text-sm font-black text-red-600 transition hover:bg-red-100"
                >
                  <FiTrash2 />
                  Sair / limpar dados
                </button>
              </>
            ) : (
              <EmptyState
                icon={FiHeart}
                title="Nenhum perfil salvo"
                description="Faça seu primeiro pedido para salvar seus dados neste aparelho e acompanhar seus pedidos mais rápido."
              />
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3 px-1">
              <div>
                <h3 className="text-xl font-black tracking-tight text-[#111827]">
                  Seus pedidos
                </h3>

                <p className="mt-1 text-sm text-[#6b7280]">
                  Histórico e recibos salvos.
                </p>
              </div>

              {visibleOrders.length > 0 && (
                <span className="rounded-2xl border border-gray-100 bg-white px-3 py-2 text-xs font-black text-[#6b7280]">
                  {visibleOrders.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-11 w-11 animate-spin rounded-full border-4 border-orange-100 border-t-[#f97316]" />
              </div>
            ) : !profile ? (
              <EmptyState
                icon={FiShoppingBag}
                title="Faça seu primeiro pedido"
                description="Depois de finalizar uma compra, seus pedidos aparecerão aqui automaticamente."
              />
            ) : visibleOrders.length === 0 ? (
              <EmptyState
                icon={FiFileText}
                title="Nenhum pedido encontrado"
                description={
                  showOnlyCurrentStore
                    ? 'Você ainda não fez pedidos nesta loja.'
                    : 'Nenhum pedido foi encontrado para este telefone.'
                }
              />
            ) : (
              <div className="space-y-4">
                {visibleOrders.map((order) => {
                  const status = normalizeStatus(order.status)
                  const meta = STATUS_META[status] || STATUS_META.pendente
                  const isActive = isActiveOrder(order)
                  const orderStore = getOrderStoreId(order, slug)
                  const Icon = meta.icon

                  return (
                    <article
                      key={order.id}
                      className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-xl hover:shadow-gray-200/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-[#6b7280]">
                            {formatDate(order.createdAt)}
                          </p>

                          <h4 className="mt-1 text-base font-black text-[#111827]">
                            Pedido #{order.id.slice(-5).toUpperCase()}
                          </h4>
                        </div>

                        <StatusBadge status={status} />
                      </div>

                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#6b7280]">
                        {getItemsSummary(order)}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-xl bg-gray-50 px-2.5 py-1.5 text-xs font-black text-[#6b7280]">
                            {getOrderItems(order).length} item
                            {getOrderItems(order).length !== 1 ? 's' : ''}
                          </span>

                          {order.neighborhood && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-[#6b7280]">
                              <FiMapPin />
                              {order.neighborhood}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                            Total
                          </p>

                          <p className="text-xl font-black text-[#111827]">
                            {formatMoney(getOrderTotal(order))}
                          </p>
                        </div>
                      </div>

                      {isActive && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center gap-2 text-xs font-black text-[#6b7280]">
                            <Icon className="animate-pulse" />
                            {meta.description}
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${meta.bar}`} />
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4">
                        <Link
                          to={`/store/${orderStore}/order/${order.id}`}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black transition ${
                            isActive
                              ? 'bg-orange-50 text-[#f97316] hover:bg-orange-100'
                              : canReviewOrder(order)
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-gray-100 text-[#111827] hover:bg-gray-200'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <FiClock className="animate-pulse" />
                              Acompanhar
                            </>
                          ) : canReviewOrder(order) ? (
                            <>
                              <FiStar />
                              Avaliar
                            </>
                          ) : (
                            <>
                              <FiFileText />
                              Recibo
                            </>
                          )}
                        </Link>

                        {!isActive && status !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => handleReorder(order)}
                            disabled={reorderingId === order.id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-3 py-3 text-xs font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reorderingId === order.id ? (
                              <>
                                <FiLoader className="animate-spin" />
                                Adicionando
                              </>
                            ) : (
                              <>
                                <FiRefreshCw />
                                Pedir novamente
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="shrink-0 border-t border-gray-100 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-4 text-sm font-black text-white transition hover:bg-[#ea580c]"
          >
            Fechar
            <FiChevronRight />
          </button>
        </footer>
      </aside>
    </div>
  )
}

