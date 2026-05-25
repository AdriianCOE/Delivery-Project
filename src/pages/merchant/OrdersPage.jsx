import { useCallback, useEffect, useMemo, useState } from 'react'
import { getItemDisplayOptionGroups } from '../../utils/orderItems'
import {
  getPricingValidation,
  shouldBlockOrderAcceptance,
  shouldWarnOrderAcceptance,
} from '../../utils/orderValidation'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiFilter,
  FiHome,
  FiInbox,
  FiMapPin,
  FiMessageCircle,
  FiNavigation,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTruck,
  FiUser,
  FiX,
  FiPrinter,
  FiXCircle,
  FiZap,
  FiLoader,
  FiPower,
  FiPlay,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const BILLING_PENDING_STATUSES = new Set(['checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'])
const OPERATIONAL_STATUSES = new Set(['trialing', 'active'])

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

const STATUS_META = {
  pendente: {
    label: 'Pendente',
    description: 'Aguardando aceite',
    icon: FiClock,
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    dotClass: 'bg-amber-500',
    buttonClass: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  preparando: {
    label: 'Preparando',
    description: 'Pedido em produção',
    icon: FiPackage,
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200',
    dotClass: 'bg-purple-500',
    buttonClass: 'border-purple-200 bg-purple-50 text-purple-700',
  },
  em_rota: {
    label: 'Em rota',
    description: 'Saiu para entrega',
    icon: FiTruck,
    badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200',
    dotClass: 'bg-sky-500',
    buttonClass: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  entregue: {
    label: 'Entregue',
    description: 'Pedido finalizado',
    icon: FiCheckCircle,
    badgeClass: 'bg-orange-50 text-orange-700 ring-green-200',
    dotClass: 'bg-[#f97316]',
    buttonClass: 'border-green-200 bg-orange-50 text-orange-700',
  },
  cancelado: {
    label: 'Cancelado',
    description: 'Pedido cancelado',
    icon: FiXCircle,
    badgeClass: 'bg-red-50 text-red-700 ring-red-200',
    dotClass: 'bg-red-500',
    buttonClass: 'border-red-200 bg-red-50 text-red-700',
  },
}

const STATUS_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'em_rota', label: 'Em rota' },
  { key: 'entregue', label: 'Entregues' },
  { key: 'cancelado', label: 'Cancelados' },
]

const STATUS_FLOW = ['pendente', 'preparando', 'em_rota', 'entregue', 'cancelado']
const ACTIVE_STATUSES = ['pendente', 'preparando', 'em_rota']

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()

  const map = {
    novo: 'pendente',
    new: 'pendente',
    recebido: 'pendente',
    aguardando: 'pendente',
    pendente: 'pendente',

    aceito: 'preparando',
    confirmado: 'preparando',
    em_preparo: 'preparando',
    preparo: 'preparando',
    preparando: 'preparando',

    entregando: 'em_rota',
    saiu_para_entrega: 'em_rota',
    saiu_entrega: 'em_rota',
    em_entrega: 'em_rota',
    out_for_delivery: 'em_rota',
    em_rota: 'em_rota',

    finalizado: 'entregue',
    delivered: 'entregue',
    entregue: 'entregue',

    canceled: 'cancelado',
    cancelled: 'cancelado',
    cancelado: 'cancelado',
  }

  return map[value] || value || 'pendente'
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

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

function formatDate(order) {
  const date = getOrderDate(order)

  if (!date) return '—'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


function getOrderDisplayNumber(order) {
  const internalId = String(
    order?.firestoreId || order?.docId || order?._docId || order?.id || ''
  ).trim()

  if (internalId) return `#${internalId.slice(-4).toUpperCase()}`

  const rawNumber =
    order?.displayNumber ||
    order?.orderNumber ||
    order?.dailyNumber ||
    order?.orderCode ||
    order?.number ||
    ''

  const value = String(rawNumber || '').trim()

  if (!value) return '#----'
  if (value.startsWith('#') || value.toUpperCase().startsWith('BP-')) return value
  if (/^\d+$/.test(value)) return `#${value.padStart(3, '0')}`

  return `#${value}`
}

function timeAgo(order) {
  const date = getOrderDate(order)

  if (!date) return '—'

  const diff = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diff < 30) return 'agora'
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`

  return `${Math.floor(diff / 86400)}d atrás`
}

function getPendingMinutes(order) {
  const date = getOrderDate(order)

  if (!date) return 0

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
}

function isLatePending(order) {
  if (normalizeStatus(order?.status) !== 'pendente') return false

  const date = getOrderDate(order)

  if (!date) return false

  return Date.now() - date.getTime() > 3 * 60 * 1000
}

function shouldShowCustomerThanksAction(order) {
  return (
    normalizeStatus(order?.status) === 'entregue' &&
    Boolean(order?.customerConfirmedDeliveryAt) &&
    !(order?.storeThankedCustomerAt || order?.thankYouSentAt)
  )
}

function getCustomerName(order) {
  return order?.customerName || order?.customer?.name || order?.clientName || 'Cliente'
}

function getCustomerPhone(order) {
  return order?.customerPhone || order?.customer?.phone || order?.phone || ''
}

function getPaymentMethod(order) {
  const raw = String(
    order?.payment?.method || order?.paymentMethod || order?.paymentType || ''
  ).toLowerCase()

  const map = {
    pix: 'Pix',
    pix_manual: 'Pix manual',
    card: 'Cartão',
    cartao: 'Cartão',
    cartão: 'Cartão',
    card_on_delivery: 'Maquininha',
    credit: 'Cartão de crédito',
    debit: 'Cartão de débito',
    dinheiro: 'Dinheiro',
    cash: 'Dinheiro',
  }

  return order?.payment?.label || map[raw] || order?.paymentMethod || 'Não informado'
}

function getPaymentStatus(order) {
  const status = getPaymentStatusId(order)

  const map = {
    pending: 'Aguardando confirmação',
    proof_sent: 'Comprovante enviado',
    pay_on_delivery: 'A receber na entrega',
    paid: 'Pago',
    confirmed: 'Pago',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
    refunded: 'Estornado',
  }

  return map[status] || 'Manual'
}

function getPaymentMethodId(order) {
  return String(
    order?.payment?.method ||
      order?.paymentMethod ||
      order?.paymentType ||
      ''
  )
    .toLowerCase()
    .trim()
}

function getPaymentStatusId(order) {
  return String(order?.payment?.status || order?.paymentStatus || '')
    .toLowerCase()
    .trim()
}

function isPixManualOrder(order) {
  const method = getPaymentMethodId(order)

  return [
    'pix',
    'pix_manual',
    'manual_pix',
    'pix_manual_store',
  ].includes(method)
}

function isPaymentPaid(order) {
  const status = getPaymentStatusId(order)
  const hasPaidStatus = ['paid', 'confirmed', 'pago'].includes(status)
  const hasConfirmationTime = Boolean(
    order?.payment?.confirmedAt ||
      order?.payment?.paidAt ||
      order?.paidAt
  )
  const hasTrustedConfirmation = Boolean(
    order?.payment?.confirmedBy ||
      order?.payment?.confirmedSource ||
      order?.payment?.webhookEventId ||
      order?.payment?.providerPaymentId ||
      order?.payment?.gatewayTransactionId
  )

  return hasPaidStatus && hasConfirmationTime && hasTrustedConfirmation
}

function isPixPaymentPending(order) {
  if (!isPixManualOrder(order)) return false

  const paymentStatus = getPaymentStatusId(order)

  return !isPaymentPaid(order) && ['pending', 'proof_sent', 'manual', ''].includes(paymentStatus)
}

function shouldBlockPreparationUntilPayment(order) {
  return isPixPaymentPending(order) && normalizeStatus(order?.status) === 'pendente'
}

function getPaymentProofUrl(order) {
  return (
    order?.payment?.proofUrl ||
    order?.payment?.receiptUrl ||
    order?.paymentProofUrl ||
    order?.proofUrl ||
    order?.receiptUrl ||
    ''
  )
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function getItemName(item) {
  return item?.name || item?.productName || item?.title || 'Produto'
}

function getItemQty(item) {
  return Number(item?.quantity || item?.qty || item?.qtd || 1)
}

function getItemUnitPrice(item) {
  return normalizeMoney(
    item?.basePrice ?? item?.price ?? item?.unitPrice ?? item?.finalPrice,
    item?.basePriceCents ?? item?.priceCents ?? item?.unitPriceCents ?? item?.finalPriceCents
  )
}

function getItemOldPrice(item) {
  return normalizeMoney(
    item?.oldPrice ?? item?.compareAtPrice,
    item?.oldPriceCents ?? item?.compareAtPriceCents
  )
}

function getRawItemExtras(item) {
  return [
    ...(Array.isArray(item?.extras) ? item.extras : []),
    ...(Array.isArray(item?.addons) ? item.addons : []),
    ...(Array.isArray(item?.additionals) ? item.additionals : []),
    ...(Array.isArray(item?.selectedExtras) ? item.selectedExtras : []),
  ]
}

function getRawFlatOptions(item) {
  return [
    ...(Array.isArray(item?.selectedOptionsFlat) ? item.selectedOptionsFlat : []),
    ...(Array.isArray(item?.selectedOptions) ? item.selectedOptions : []),
    ...(Array.isArray(item?.options) ? item.options : []),
    ...(Array.isArray(item?.extras)
      ? item.extras.filter((extra) => extra?.type === 'option' || extra?.groupTitle || extra?.groupName)
      : []),
  ]
}

function getOptionQuantity(option) {
  return Math.max(0, Number(option?.quantity ?? option?.qty ?? option?.count ?? 1))
}

function getOptionChargedQuantity(option) {
  if (option?.chargedQuantity !== undefined && option?.chargedQuantity !== null) {
    return Math.max(0, Number(option.chargedQuantity || 0))
  }

  return getOptionQuantity(option)
}

function getOptionName(option) {
  return option?.name || option?.title || option?.label || option?.optionName || 'Opção'
}

function getOptionGroupTitle(option, fallback = '') {
  return (
    option?.groupTitle ||
    option?.groupName ||
    option?.groupLabel ||
    option?.categoryName ||
    fallback ||
    'Opções'
  )
}

function getOptionUnitPrice(option) {
  return normalizeMoney(
    option?.unitPrice ?? option?.price ?? option?.amount ?? option?.value,
    option?.unitPriceCents ?? option?.priceCents ?? option?.amountCents ?? option?.valueCents
  )
}

function getOptionTotal(option) {
  const savedTotal = normalizeMoney(
    option?.total ?? option?.totalPrice ?? option?.subtotal,
    option?.totalCents ?? option?.totalPriceCents ?? option?.subtotalCents
  )

  if (savedTotal > 0) return savedTotal

  return getOptionUnitPrice(option) * getOptionChargedQuantity(option)
}

function normalizeSelectedOption(option, fallbackGroupTitle = '') {
  const quantity = getOptionQuantity(option)
  const unitPrice = getOptionUnitPrice(option)
  const total = getOptionTotal(option)

  return {
    ...option,
    name: getOptionName(option),
    groupTitle: getOptionGroupTitle(option, fallbackGroupTitle),
    quantity,
    unitPrice,
    total,
    type: option?.type || 'option',
  }
}

function dedupeOptions(options) {
  const seen = new Set()

  return options.filter((option) => {
    const key = [
      option?.type || '',
      getOptionGroupTitle(option),
      getOptionName(option),
      getOptionQuantity(option),
      getOptionUnitPrice(option),
      getOptionTotal(option),
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getItemOptionGroups(item) {
  const selectedGroups = [
    ...(Array.isArray(item?.selectedOptionGroups) ? item.selectedOptionGroups : []),
    ...(Array.isArray(item?.optionGroupsSnapshot) ? item.optionGroupsSnapshot : []),
    ...(Array.isArray(item?.selectedOptionsGroups) ? item.selectedOptionsGroups : []),
    ...(Array.isArray(item?.customizationGroupsSnapshot) ? item.customizationGroupsSnapshot : []),
  ]

  const normalizedGroups = selectedGroups
    .map((group) => {
      const groupTitle =
        group?.groupTitle ||
        group?.title ||
        group?.name ||
        group?.label ||
        'Opções'

      const options = [
        ...(Array.isArray(group?.options) ? group.options : []),
        ...(Array.isArray(group?.items) ? group.items : []),
        ...(Array.isArray(group?.selectedOptions) ? group.selectedOptions : []),
      ]
        .map((option) => normalizeSelectedOption(option, groupTitle))
        .filter((option) => getOptionQuantity(option) > 0)

      return {
        groupId: group?.groupId || group?.id || groupTitle,
        groupTitle,
        options: dedupeOptions(options),
      }
    })
    .filter((group) => group.options.length > 0)

  if (normalizedGroups.length > 0) return normalizedGroups

  const grouped = new Map()

  dedupeOptions(getRawFlatOptions(item).map((option) => normalizeSelectedOption(option))).forEach((option) => {
    if (getOptionQuantity(option) <= 0) return

    const groupTitle = getOptionGroupTitle(option)
    const previous = grouped.get(groupTitle) || {
      groupId: option?.groupId || groupTitle,
      groupTitle,
      options: [],
    }

    previous.options.push(option)
    grouped.set(groupTitle, previous)
  })

  return [...grouped.values()].filter((group) => group.options.length > 0)
}

function getItemOptions(item) {
  return getItemOptionGroups(item).flatMap((group) =>
    group.options.map((option) => ({
      ...option,
      groupTitle: group.groupTitle,
    }))
  )
}

function getItemAdditionals(item) {
  return dedupeOptions(
    getRawItemExtras(item)
      .filter((extra) => extra?.type !== 'option' && !extra?.groupTitle && !extra?.groupName)
      .map((extra) => ({
        ...extra,
        name: getOptionName(extra),
        quantity: getOptionQuantity(extra),
        unitPrice: getOptionUnitPrice(extra),
        total: getOptionTotal(extra),
        type: extra?.type || 'extra',
      }))
  )
}

function getItemExtras(item) {
  return dedupeOptions([...getItemAdditionals(item), ...getItemOptions(item)])
}

function getItemExtrasTotal(item) {
  return getItemExtras(item).reduce((acc, extra) => acc + getOptionTotal(extra), 0)
}

function getItemTotal(item) {
  const savedTotal = normalizeMoney(item?.total, item?.totalCents)

  if (savedTotal > 0) return savedTotal

  return (getItemUnitPrice(item) + getItemExtrasTotal(item)) * getItemQty(item)
}

function getPromotionInfo(item) {
  const currentPrice = getItemUnitPrice(item)
  const oldPrice = getItemOldPrice(item)
  const savedPromotion = item?.promotion || {}
  const activeFromSaved = Boolean(savedPromotion.active || item?.isPromotion)

  if (!oldPrice || !currentPrice || oldPrice <= currentPrice) {
    return {
      active: activeFromSaved,
      oldPrice: normalizeMoney(savedPromotion.oldPrice, savedPromotion.oldPriceCents),
      currentPrice,
      percent: Number(savedPromotion.percent || 0),
      savings: normalizeMoney(savedPromotion.savings, savedPromotion.savingsCents),
    }
  }

  const savings = oldPrice - currentPrice
  const percent = Math.round((savings / oldPrice) * 100)

  return {
    active: true,
    oldPrice,
    currentPrice,
    percent,
    savings,
  }
}

function getOrderSubtotal(order) {
  const saved = normalizeMoney(order?.subtotal, order?.subtotalCents)

  if (saved > 0) return saved

  return getOrderItems(order).reduce((acc, item) => acc + getItemTotal(item), 0)
}

function getOrderDeliveryFee(order) {
  return normalizeMoney(order?.deliveryFee, order?.deliveryFeeCents)
}

function getOrderDiscount(order) {
  return normalizeMoney(order?.discount, order?.discountCents)
}

function getOrderPromotionSavings(order) {
  const saved = normalizeMoney(order?.promotionSavings, order?.promotionSavingsCents)

  if (saved > 0) return saved

  return getOrderItems(order).reduce((acc, item) => {
    const promo = getPromotionInfo(item)
    return acc + Math.max(0, promo.savings * getItemQty(item))
  }, 0)
}

function getOrderSubtotalWithoutPromotions(order) {
  const saved = normalizeMoney(
    order?.subtotalWithoutPromotions,
    order?.subtotalWithoutPromotionsCents
  )

  if (saved > 0) return saved

  return getOrderSubtotal(order) + getOrderPromotionSavings(order)
}

function getOrderTotal(order) {
  const saved = normalizeMoney(order?.total, order?.totalCents)

  if (saved > 0) return saved

  const legacy = normalizeMoney(
    order?.totalAmount ?? order?.amount,
    order?.totalAmountCents ?? order?.amountCents
  )

  if (legacy > 0) return legacy

  return Math.max(0, getOrderSubtotal(order) - getOrderDiscount(order)) + getOrderDeliveryFee(order)
}

function getItemOptionsSummary(item) {
  if (item?.optionsSummary) return item.optionsSummary

  const groups = getItemOptionGroups(item)
  const additionals = getItemAdditionals(item)

  const groupText = groups.map((group) => {
    const options = group.options
      .map((option) => {
        const quantity = getOptionQuantity(option)
        const prefix = quantity > 1 ? `${quantity}x ` : ''
        return `${prefix}${getOptionName(option)}`
      })
      .join(', ')

    return `${group.groupTitle}: ${options}`
  })

  const additionalText = additionals.map((extra) => {
    const quantity = getOptionQuantity(extra)
    const prefix = quantity > 1 ? `${quantity}x ` : ''

    return `+ ${prefix}${getOptionName(extra)}`
  })

  return [...groupText, ...additionalText].join(' · ')
}

function getOrderItemsSummary(order) {
  if (order?.itemsSummary) return order.itemsSummary

  const items = getOrderItems(order)

  if (!items.length) return 'Itens não disponíveis'

  const summary = items
    .slice(0, 3)
    .map((item) => {
      const options = getItemOptionsSummary(item)
      return `${getItemQty(item)}x ${getItemName(item)}${options ? ` (${options})` : ''}`
    })
    .join(', ')

  return items.length > 3 ? `${summary}...` : summary
}

function getAddress(order) {
  const rawAddress =
    order?.deliveryAddress ||
    order?.customerAddress ||
    order?.address ||
    order?.endereco

  if (order?.orderType === 'pickup') {
    return {
      full: 'Retirada na loja',
      neighborhood: '',
      complement: '',
      reference: '',
      isPickup: true,
    }
  }

  if (!rawAddress) {
    return {
      full: 'Endereço não informado',
      neighborhood: order?.neighborhood || order?.bairro || '',
      complement: '',
      reference: '',
      isPickup: false,
    }
  }

  if (typeof rawAddress === 'string') {
    return {
      full: rawAddress,
      neighborhood: order?.neighborhood || order?.bairro || '',
      complement: order?.complement || '',
      reference: order?.reference || '',
      isPickup: false,
    }
  }

  const street = rawAddress.street || rawAddress.rua || rawAddress.address || ''
  const number = rawAddress.number || rawAddress.numero || ''
  const neighborhood =
    rawAddress.neighborhood ||
    rawAddress.bairro ||
    order?.neighborhood ||
    order?.bairro ||
    ''
  const city = rawAddress.city || rawAddress.cidade || ''
  const complement =
    rawAddress.complement ||
    rawAddress.complemento ||
    order?.complement ||
    ''
  const reference = rawAddress.reference || order?.reference || ''

  const full = [street, number, neighborhood, city].filter(Boolean).join(', ')

  return {
    full: full || 'Endereço não informado',
    neighborhood,
    complement,
    reference,
    isPickup: false,
  }
}

function getChangeForLabel(order) {
  const value = order?.changeFor || order?.payment?.changeFor

  if (!value) return ''

  if (String(value).toLowerCase().includes('sem')) return 'Sem troco'

  const numeric = normalizeMoney(value)

  if (numeric > 0) return `Troco para ${formatMoney(numeric)}`

  return String(value)
}

function getCancellationReason(order) {
  return (
    order?.cancellationReason ||
    order?.cancelReason ||
    order?.canceledReason ||
    order?.cancellation?.reason ||
    order?.cancel?.reason ||
    ''
  )
}

function normalizePhoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`

  return digits
}

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function getStoreSlug(store) {
  return store?.storeSlug || store?.slug || store?.id || ''
}

function getStoreKeys(store) {
  return uniqueArray([
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
    store?.id,
    store?.storeId,
    store?.storeDocId,
    store?.storeSlug,
    store?.slug,
  ]).slice(0, 10)
}

function getStatusField(status) {
  const map = {
    pendente: 'pendingAt',
    preparando: 'preparingAt',
    em_rota: 'outForDeliveryAt',
    entregue: 'deliveredAt',
    cancelado: 'canceledAt',
  }

  return map[normalizeStatus(status)]
}

function getNextStatus(status) {
  const current = normalizeStatus(status)

  if (current === 'pendente') return 'preparando'
  if (current === 'preparando') return 'em_rota'
  if (current === 'em_rota') return 'entregue'

  return null
}

function getNextStatusLabel(status) {
  const next = getNextStatus(status)

  if (next === 'preparando') return 'Aceitar pedido'
  if (next === 'em_rota') return 'Saiu para entrega'
  if (next === 'entregue') return 'Marcar como entregue'

  return ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getOrderTypeLabel(order) {
  const type = String(order?.orderType || order?.type || '').toLowerCase()

  if (type === 'pickup' || type === 'retirada') return 'RETIRADA'
  if (type === 'dine_in' || type === 'mesa') return order?.tableLabel || order?.tableId ? `MESA ${order.tableLabel || order.tableId}` : 'MESA'

  return 'ENTREGA'
}

function getPaymentLine(order) {
  const changeForLabel =
  getChangeForLabel(order) ||
  order?.changeFor ||
  order?.payment?.changeFor ||
  ''
  const payment = getPaymentMethod(order)

  return changeForLabel ? `${payment} · ${changeForLabel}` : payment
}

function getFirstName(name) {
  const cleanName = String(name || '').trim()

  if (!cleanName) return 'tudo bem'

  return cleanName.split(/\s+/)[0]
}

function getOrderTrackingLink(order, store) {
  if (typeof window === 'undefined') return ''

  const orderId = order?.firestoreId || order?.id

  if (!orderId) return ''

  const legacyTrackingUrl = String(order?.trackingUrl || '')

  if (
    legacyTrackingUrl &&
    !legacyTrackingUrl.includes('/store/') &&
    !legacyTrackingUrl.includes('/tracking/')
  ) {
    return legacyTrackingUrl
  }

  const slug =
    order?.storeSlug ||
    order?.store?.slug ||
    order?.store?.storeSlug ||
    store?.storeSlug ||
    store?.slug ||
    ''

  if (slug) {
    return `${window.location.origin}/${slug}/pedido/${orderId}`
  }

  return `${window.location.origin}/tracking/${orderId}`
}

function buildWhatsAppMessage(order, store) {
  const status = normalizeStatus(order?.status)
  const customerName = getFirstName(getCustomerName(order))
  const storeName = store?.name || order?.storeName || 'nossa loja'
  const orderCode = getOrderDisplayNumber(order)

  const type = String(order?.orderType || order?.type || '').toLowerCase()

  const isPickup = type === 'pickup' || type === 'retirada'
  const isDineIn = type === 'dine_in' || type === 'mesa'
  const isDelivery = !isPickup && !isDineIn

  const orderTypeLabel = getOrderTypeLabel(order)
  const paymentLine = getPaymentLine(order)
  const trackingLink = getOrderTrackingLink(order, store)
  const itemsSummary = getOrderItemsSummary(order)
  const total = formatMoney(getOrderTotal(order))

  const contextLine = [
    `Pedido: *${orderCode}*`,
    `Tipo: *${orderTypeLabel}*`,
    paymentLine ? `Pagamento: *${paymentLine}*` : '',
    `Total: *${total}*`,
  ]
    .filter(Boolean)
    .join('\n')

  if (status === 'preparando') {
    const deliveryText = isPickup
      ? 'Assim que estiver pronto para retirada, avisamos por aqui.'
      : isDineIn
        ? 'Seu pedido já foi encaminhado para preparo.'
        : 'Seu pedido já entrou na nossa fila de preparo. Avisamos novamente quando sair para entrega.'

    return [
      `Olá, *${customerName}*! Aqui é da *${storeName}*.`,
      '',
      `✅ *Pedido confirmado*`,
      '',
      `Confirmamos o seu pedido *${orderCode}* e já estamos cuidando dele com atenção.`,
      '',
      deliveryText,
      '',
      contextLine,
      '',
      `Itens: ${itemsSummary}`,
      trackingLink ? `\nVocê pode acompanhar por aqui:\n${trackingLink}` : '',
      '',
      'Qualquer dúvida, é só responder esta mensagem.',
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const compactMessages = {
    em_rota: {
      title: isDelivery ? 'Pedido saiu para entrega' : 'Pedido pronto',
      body: isDelivery
        ? `Seu pedido *${orderCode}* saiu para entrega. Fique de olho no telefone e no endereço informado.`
        : `Seu pedido *${orderCode}* já está pronto. Pode vir retirar quando quiser.`,
    },
    entregue: {
      title: isPickup ? 'Pedido finalizado' : 'Pedido entregue',
      body: `Pedido *${orderCode}* finalizado. Obrigado pela preferência!`,
    },
cancelado: {
  title: 'Pedido cancelado',
  body: getCancellationReason(order)
    ? `O pedido *${orderCode}* precisou ser cancelado.\n\nMotivo: *${getCancellationReason(order)}*`
    : `O pedido *${orderCode}* precisou ser cancelado. Responda esta mensagem para conversarmos melhor.`,
},
  }

  const selectedMessage = compactMessages[status] || {
    title: 'Atualização do pedido',
    body: `Seu pedido *${orderCode}* foi atualizado.`,
  }

  return [
    `Olá, *${customerName}*!`,
    '',
    `*${selectedMessage.title}*`,
    selectedMessage.body,
    trackingLink && status !== 'entregue'
      ? `\nAcompanhe por aqui:\n${trackingLink}`
      : '',
    '',
    `— ${storeName}`,
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildCustomerThanksMessage(order, store) {
  const customerName = getFirstName(getCustomerName(order))
  const storeName = store?.name || order?.storeName || 'nossa loja'
  const orderCode = getOrderDisplayNumber(order)

  return [
    `Olá, *${customerName}*!`,
    '',
    `Passando só para agradecer pelo pedido *${orderCode}*.`,
    '',
    'Ficamos felizes em te atender e esperamos que tenha chegado tudo certinho. 😊',
    '',
    `— ${storeName}`,
  ].join('\n')
}

function printComanda(order, store) {
  if (!order) return

  const orderNumber = getOrderDisplayNumber(order)
  const customerName = getCustomerName(order)
  const phone = getCustomerPhone(order) || 'Não informado'
  const address = getAddress(order)
  const items = getOrderItems(order)
  const subtotal = getOrderSubtotal(order)
  const discount = getOrderDiscount(order)
  const deliveryFee = getOrderDeliveryFee(order)
  const total = getOrderTotal(order)
  const payment = getPaymentLine(order)
  const observation =
    order.orderObservation ||
    order.customerObservation ||
    order.observation ||
    order.notes ||
    ''
  const date = formatDate(order)
  const storeName = store?.name || 'PratoBy'
  const typeLabel = getOrderTypeLabel(order)

  const itemRows = items
    .map((item, index) => {
      const itemName = getItemName(item)
      const qty = getItemQty(item)
      const itemTotal = getItemTotal(item)
      const optionGroups = getItemDisplayOptionGroups(item)
      const additionals = getItemAdditionals(item)
      const itemObs = item.observation || item.itemObservation || item.notes || ''

      const optionsHtml = optionGroups
        .map((group) => {
          const options = group.options
            .map((option) => {
              const optionQty = Number(option.quantity || 1)
              const optionPrice = Number(option.totalCents || 0) / 100

              return `
                <div class="option-line">
                  <span>${escapeHtml(optionQty > 1 ? `${optionQty}x ${option.name}` : option.name)}</span>
                  ${optionPrice > 0 ? `<span>${escapeHtml(formatMoney(optionPrice))}</span>` : ''}
                </div>
              `
            })
            .join('')

          return `
            <div class="option-group">
              <div class="option-title">${escapeHtml(group.name || group.groupName || 'Opções')}</div>
              ${options}
            </div>
          `
        })
        .join('')

      const additionalsHtml = additionals
        .map((extra) => {
          const extraQty = getOptionQuantity(extra)
          const extraTotal = getOptionTotal(extra)

          return `
            <div class="option-line">
              <span>+ ${escapeHtml(extraQty > 1 ? `${extraQty}x ${getOptionName(extra)}` : getOptionName(extra))}</span>
              ${extraTotal > 0 ? `<span>${escapeHtml(formatMoney(extraTotal))}</span>` : ''}
            </div>
          `
        })
        .join('')

      return `
        <section class="item">
          <div class="item-head">
            <span>${escapeHtml(qty)}x ${escapeHtml(itemName)}</span>
            <span>${escapeHtml(formatMoney(itemTotal))}</span>
          </div>
          ${optionsHtml}
          ${additionalsHtml ? `<div class="option-group"><div class="option-title">Adicionais</div>${additionalsHtml}</div>` : ''}
          ${itemObs ? `<div class="item-obs">OBS ITEM: ${escapeHtml(itemObs)}</div>` : ''}
          ${index < items.length - 1 ? '<div class="thin-separator"></div>' : ''}
        </section>
      `
    })
    .join('')

  const addressHtml = address.isPickup
    ? '<div class="address-box"><strong>RETIRADA NA LOJA</strong></div>'
    : `
      <div class="address-box">
        <strong>ENDERECO</strong>
        <div>${escapeHtml(address.full)}</div>
        ${address.complement ? `<div>Comp: ${escapeHtml(address.complement)}</div>` : ''}
        ${address.reference ? `<div>Ref: ${escapeHtml(address.reference)}</div>` : ''}
      </div>
    `

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Comanda ${escapeHtml(orderNumber)}</title>
        <style>
          * {
            box-sizing: border-box;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
          }

          body {
            width: 80mm;
            font-family: "Courier New", Courier, monospace;
            font-size: 11.5px;
            line-height: 1.28;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .receipt {
            width: 72mm;
            margin: 0 auto;
            padding: 5mm 2mm 4mm;
          }

          .center {
            text-align: center;
          }

          .store-name {
            font-size: 17px;
            font-weight: 900;
            line-height: 1.05;
            text-transform: uppercase;
            word-break: break-word;
          }

          .muted {
            font-size: 10px;
          }

          .separator {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }

          .thin-separator {
            border-top: 1px dotted #000;
            margin: 7px 0;
          }

          .order-number {
            border: 2px solid #000;
            font-size: 24px;
            font-weight: 900;
            line-height: 1;
            margin: 8px 0;
            padding: 6px 4px 5px;
            text-align: center;
          }

          .pill {
            border: 1px solid #000;
            display: inline-block;
            font-size: 11px;
            font-weight: 900;
            padding: 3px 6px;
            text-transform: uppercase;
          }

          .row {
            align-items: flex-start;
            display: flex;
            justify-content: space-between;
            gap: 8px;
          }

          .row > span:first-child {
            min-width: 0;
          }

          .line {
            margin: 2px 0;
          }

          .label {
            font-weight: 900;
            text-transform: uppercase;
          }

          .address-box {
            border: 1px solid #000;
            margin-top: 6px;
            padding: 5px;
          }

          .item {
            margin: 7px 0;
          }

          .item-head {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .item-head span:first-child {
            flex: 1;
            min-width: 0;
          }

          .option-group {
            margin-top: 4px;
            padding-left: 8px;
          }

          .option-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .option-line {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            font-size: 11px;
          }

          .option-line span:first-child::before {
            content: "- ";
          }

          .item-obs,
          .order-obs {
            border: 1px solid #000;
            font-weight: 900;
            margin-top: 5px;
            padding: 5px;
            text-transform: uppercase;
          }

          .totals {
            font-size: 12px;
          }

          .grand-total {
            border-top: 2px solid #000;
            font-size: 17px;
            font-weight: 900;
            margin-top: 5px;
            padding-top: 5px;
          }

          .footer {
            font-size: 10px;
            margin-top: 10px;
            text-align: center;
          }

          @media screen {
            body {
              background: #f3f4f6;
              padding: 24px 0;
              width: 100%;
            }

            .receipt {
              background: #fff;
              box-shadow: 0 20px 50px rgba(0,0,0,.18);
            }
          }

          @media print {
            body {
              padding: 0;
              width: 80mm;
            }

            .receipt {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header class="center">
            <div class="store-name">${escapeHtml(storeName)}</div>
            <div class="muted">${escapeHtml(date)}</div>
            <div class="separator"></div>
            <div class="pill">${escapeHtml(typeLabel)}</div>
            <div class="order-number">PEDIDO ${escapeHtml(orderNumber)}</div>
          </header>

          <section>
            <div class="line"><span class="label">Cliente:</span> ${escapeHtml(customerName)}</div>
            <div class="line"><span class="label">Telefone:</span> ${escapeHtml(phone)}</div>
            ${addressHtml}
          </section>

          <div class="separator"></div>

          <section>
            <div class="label center">Itens</div>
            ${itemRows || '<div class="center muted">Nenhum item informado</div>'}
          </section>

          <div class="separator"></div>

          <section class="totals">
            <div class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal))}</span></div>
            ${discount > 0 ? `<div class="row"><span>Desconto</span><span>-${escapeHtml(formatMoney(discount))}</span></div>` : ''}
            ${deliveryFee > 0 ? `<div class="row"><span>Entrega</span><span>${escapeHtml(formatMoney(deliveryFee))}</span></div>` : ''}
            <div class="row grand-total"><span>TOTAL</span><span>${escapeHtml(formatMoney(total))}</span></div>
          </section>

          <div class="separator"></div>

          <section>
            <div class="line"><span class="label">Pagamento:</span> ${escapeHtml(payment)}</div>
            ${observation ? `<div class="order-obs">OBS PEDIDO:<br>${escapeHtml(observation)}</div>` : ''}
          </section>

          <div class="separator"></div>

          <footer class="footer">
            PratoBy<br />
            ${escapeHtml(order?.firestoreId || order?.id || '')}
          </footer>
        </main>

        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 250)
          }
        </script>
      </body>
    </html>
  `

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', `Comanda ${orderNumber}`)
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentWindow?.document

  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  window.setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }, 12000)
}

function StatusBadge({ status }) {
  const currentStatus = normalizeStatus(status)
  const meta = STATUS_META[currentStatus] || STATUS_META.pendente
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${meta.badgeClass}`}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(onClose, 3200)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const Icon = isSuccess ? FiCheckCircle : FiAlertTriangle

  return (
    <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/50">
      <div className="flex gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            isSuccess ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'
          }`}
        >
          <Icon size={17} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#111827]">
            {isSuccess ? 'Tudo certo' : 'Atenção'}
          </p>

          <p className="mt-0.5 text-sm text-[#6b7280]">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-gray-400 transition hover:text-gray-700"
          aria-label="Fechar aviso"
        >
          <FiX />
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, description, tone = 'green' }) {
  const tones = {
    green: 'bg-orange-50 text-[#f97316]',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black text-[#111827]">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-[#6b7280]">
              {description}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            tones[tone] || tones.green
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <Icon size={24} />
      </div>

      <h3 className="mt-4 text-base font-black text-[#111827]">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
          {description}
        </p>
      )}
    </div>
  )
}

function PricingValidationBadge({ order }) {
  const pricing = getPricingValidation(order)

  const className = [
    'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1',
    pricing.tone === 'success' && 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    pricing.tone === 'warning' && 'bg-amber-50 text-amber-700 ring-amber-100',
    pricing.tone === 'danger' && 'bg-red-50 text-red-700 ring-red-100',
    pricing.tone === 'neutral' && 'bg-gray-50 text-gray-600 ring-gray-100',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={className}>
      {pricing.label}
    </span>
  )
}

function PricingValidationAlert({ order }) {
  const pricing = getPricingValidation(order)

  if (pricing.status === 'valid') return null

  const className = [
    'mt-3 rounded-2xl border p-3 text-sm font-bold leading-6 md:col-span-2',
    pricing.tone === 'warning' && 'border-amber-100 bg-amber-50 text-amber-800',
    pricing.tone === 'danger' && 'border-red-100 bg-red-50 text-red-700',
    pricing.tone === 'neutral' && 'border-gray-100 bg-gray-50 text-gray-600',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {pricing.message}
    </div>
  )
}

function OrderCard({ order, onOpen, onQuickStatus, updatingStatus }) {
  const status = normalizeStatus(order.status)
  const meta = STATUS_META[status] || STATUS_META.pendente
  const nextStatus = getNextStatus(status)
  const address = getAddress(order)
  const late = isLatePending(order)
  const promotionSavings = getOrderPromotionSavings(order)
  const discount = getOrderDiscount(order)
  const cancellationReason = getCancellationReason(order)

  const isFinalStatus = status === 'entregue' || status === 'cancelado'
  const isUpdatingThisOrder = updatingStatus === order.id

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${
        late && !isFinalStatus
          ? 'border-red-300 bg-red-50/80 shadow-red-100/80 ring-2 ring-red-200'
          : 'border-gray-100 bg-white hover:shadow-gray-200/60'
      } ${isFinalStatus ? 'opacity-70 grayscale-[0.35]' : ''}`}
    >
      {late && !isFinalStatus && (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-red-600 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="shrink-0 animate-pulse" size={18} />

            <span className="text-sm font-black">
              Pedido pendente há {getPendingMinutes(order)} min
            </span>
          </div>

          <span className="text-xs font-bold text-white/85">
            Aceite ou cancele para não deixar o cliente esperando.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[92px_minmax(0,1fr)_140px_120px_145px_160px] lg:items-center">
        <div>
          <p className="mb-1 text-xs font-bold text-[#6b7280] lg:hidden">
            Pedido
          </p>

          <span className="inline-flex rounded-xl bg-gray-100 px-2.5 py-1 font-mono text-[13px] font-black text-gray-700">
            {getOrderDisplayNumber(order)}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-[#f97316] lg:hidden">
              {getCustomerName(order).substring(0, 2).toUpperCase()}
            </div>

            <div className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />

            <p className="min-w-0 truncate text-sm font-black text-[#111827]">
              {getCustomerName(order)}
            </p>

            <StatusBadge status={order.status} />
            <PricingValidationBadge order={order} />

            {late && !isFinalStatus && (
              <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-red-700">
                Urgente
              </span>
            )}
          </div>

          <p className="mt-2 truncate text-sm text-[#6b7280]">
            {getOrderItemsSummary(order)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
            <span className="inline-flex items-center gap-1">
              <FiPhone size={13} />
              {getCustomerPhone(order) || 'Sem telefone'}
            </span>

            <span className="inline-flex items-center gap-1">
              <FiMapPin size={13} />
              {address.isPickup
                ? 'Retirada'
                : address.neighborhood || 'Bairro não informado'}
            </span>
          </div>

          {status === 'cancelado' && cancellationReason && (
            <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
              <span className="font-black">Motivo:</span> {cancellationReason}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-[#6b7280] lg:hidden">
            Status
          </p>

          <p className="text-sm font-bold text-[#111827]">
            {meta.description}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-[#6b7280] lg:hidden">
            Total
          </p>

          <p className="text-base font-black text-[#111827]">
            {formatMoney(getOrderTotal(order))}
          </p>

          <p className="text-xs text-[#6b7280]">
            {getPaymentMethod(order)}
          </p>

          {(promotionSavings > 0 || discount > 0) && (
            <p className="mt-1 text-[11px] font-black text-[#f97316]">
              Economia {formatMoney(promotionSavings + discount)}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-[#6b7280] lg:hidden">
            Horário
          </p>

          <p className="text-sm font-bold text-[#111827]">
            {formatDate(order)}
          </p>

          <p className="text-xs text-[#6b7280]">
            {timeAgo(order)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          {nextStatus && (
            <button
              type="button"
              onClick={() => onQuickStatus(order, nextStatus)}
              disabled={Boolean(updatingStatus)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiZap size={15} />
              {isUpdatingThisOrder
                ? 'Atualizando...'
                : updatingStatus
                  ? 'Aguarde...'
                  : getNextStatusLabel(status)}
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpen(order)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
          >
            Abrir
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function OrderItemsList({ items }) {
  if (!items.length) {
    return (
      <p className="mt-3 text-sm leading-6 text-[#6b7280]">
        Itens não disponíveis.
      </p>
    )
  }

  return (
    <div className="mt-4 divide-y divide-gray-100">
      {items.map((item, index) => {
        const optionGroups = getItemDisplayOptionGroups(item)
        const additionals = getItemAdditionals(item)
        const promo = getPromotionInfo(item)

        return (
          <div
            key={`${item.cartItemId || item.id || getItemName(item)}-${index}`}
            className="flex gap-3 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-black text-[#f97316]">
              {getItemQty(item)}x
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#111827]">
                {getItemName(item)}
              </p>

              {promo.active && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600">
                    Promoção
                  </span>

                  {promo.oldPrice > promo.currentPrice && (
                    <>
                      <span className="text-xs font-bold text-gray-400 line-through">
                        {formatMoney(promo.oldPrice)}
                      </span>

                      <span className="text-xs font-black text-[#f97316]">
                        {formatMoney(promo.currentPrice)}
                      </span>

                      {promo.percent > 0 && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          -{promo.percent}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {optionGroups.length > 0 && (
    <div className="mt-3 rounded-2xl bg-gray-50 p-3">
      {optionGroups.map((group) => (
        <div key={group.id} className="mb-3 last:mb-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
            {group.name}
          </p>

          <div className="mt-2 space-y-1">
            {group.options.map((option) => (
              <div
                key={`${group.id}-${option.id}`}
                className="flex items-center justify-between gap-3 text-sm text-gray-600"
              >
                <span>
                  {option.quantity > 1 ? `${option.quantity}x ` : ''}
                  {option.name}
                </span>

                {option.totalCents > 0 && (
                  <span className="font-bold text-gray-900">
                    + {formatMoney(option.totalCents / 100)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )}

              {additionals.length > 0 && (
                <div className="mt-2 space-y-1">
                  {additionals.map((extra, extraIndex) => {
                    const quantity = getOptionQuantity(extra)
                    const totalExtraPrice = getOptionTotal(extra)

                    return (
                      <p
                        key={`${getOptionName(extra)}-${extraIndex}`}
                        className="text-xs leading-5 text-[#6b7280]"
                      >
                        <strong>Adicional:</strong>{' '}
                        {quantity > 1 ? `${quantity}x ` : ''}
                        {getOptionName(extra)}
                        {totalExtraPrice > 0 ? ` · + ${formatMoney(totalExtraPrice)}` : ''}
                      </p>
                    )
                  })}
                </div>
              )}

              {(item?.observation || item?.itemObservation || item?.notes) && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                  Obs: {item.observation || item.itemObservation || item.notes}
                </p>
              )}
            </div>

            <p className="text-sm font-black text-[#111827]">
              {formatMoney(getItemTotal(item))}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function FinancialSummary({ order }) {
  const subtotalWithoutPromotions = getOrderSubtotalWithoutPromotions(order)
  const promotionSavings = getOrderPromotionSavings(order)
  const subtotal = getOrderSubtotal(order)
  const deliveryFee = getOrderDeliveryFee(order)
  const discount = getOrderDiscount(order)
  const total = getOrderTotal(order)

  return (
    <div className="mt-4 space-y-3 text-sm">
      {promotionSavings > 0 ? (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280]">Itens sem promoção</span>
            <span className="font-bold text-[#111827]">
              {formatMoney(subtotalWithoutPromotions)}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280]">Economia em promoções</span>
            <span className="font-bold text-red-600">
              -{formatMoney(promotionSavings)}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280]">Subtotal com promoções</span>
            <span className="font-bold text-[#111827]">
              {formatMoney(subtotal)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280]">Subtotal</span>
          <span className="font-bold text-[#111827]">
            {formatMoney(subtotal)}
          </span>
        </div>
      )}

      {order?.orderType === 'delivery' && (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280]">Entrega</span>
          <span className="font-bold text-[#111827]">
            {formatMoney(deliveryFee)}
          </span>
        </div>
      )}

      {discount > 0 && (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280]">
            Cupom {order?.couponCode ? `(${order.couponCode})` : ''}
          </span>

          <span className="font-bold text-red-600">
            -{formatMoney(discount)}
          </span>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <div className="flex justify-between gap-3">
          <span className="font-black text-[#111827]">Total</span>
          <span className="font-black text-[#f97316]">
            {formatMoney(total)}
          </span>
        </div>

        {(promotionSavings > 0 || discount > 0) && (
          <p className="mt-1 text-right text-xs font-bold text-[#f97316]">
            Economia total de {formatMoney(promotionSavings + discount)}
          </p>
        )}
      </div>
    </div>
  )
}

function OrderModal({
  order,
  store,
  onClose,
  onUpdateStatus,
  onConfirmPixPayment,
  onSendCustomerThanks,
  onCopyOrder,
  onOpenWhatsApp,
  onOpenMaps,
  updatingStatus,
}) {
  const status = normalizeStatus(order.status)
  const meta = STATUS_META[status] || STATUS_META.pendente
  const address = getAddress(order)
  const items = getOrderItems(order)
  const nextStatus = getNextStatus(status)
  const changeForLabel = getChangeForLabel(order)

  const pixPending = shouldBlockPreparationUntilPayment(order)
  const pixPaid = isPixManualOrder(order) && isPaymentPaid(order)
  const paymentProofUrl = getPaymentProofUrl(order)

  const currentIndex = STATUS_FLOW.indexOf(status)
  const isFinalStatus = status === 'entregue' || status === 'cancelado'
  const showCustomerThanksAction = shouldShowCustomerThanksAction(order)
  const cancellationReason = getCancellationReason(order)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/70 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#f9fafb] shadow-2xl shadow-black/30 sm:rounded-[2rem] xl:h-[90vh]">
        <header className="shrink-0 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black tracking-tight text-[#111827] sm:text-2xl">
                  Pedido {getOrderDisplayNumber(order)}
                </h2>

                <StatusBadge status={order.status} />
                <PricingValidationBadge order={order} />

                {status === 'cancelado' && cancellationReason && (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-700 ring-1 ring-red-200">
    <FiAlertTriangle size={12} />
    Motivo registrado
  </span>
)}

                {pixPending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                    <FiCreditCard size={12} />
                    Pix pendente
                  </span>
                )}

                {showCustomerThanksAction && (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-200">
    <FiMessageCircle size={12} />
    Cliente confirmou
  </span>
)}
              </div>

              <p className="mt-1 truncate text-xs font-bold text-[#6b7280]">
                {formatDate(order)} · {store?.name || 'Loja'} · {items.length} item{items.length === 1 ? '' : 's'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-[#111827]"
              aria-label="Fechar pedido"
            >
              <FiX size={19} />
            </button>
          </div>
        </header>

        <section className="shrink-0 border-b border-gray-100 bg-white px-4 py-3 sm:px-5">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-2xl bg-orange-50 px-3 py-2 text-sm font-black text-[#f97316]">
                Total: {formatMoney(getOrderTotal(order))}
              </span>

              <span className="rounded-2xl bg-gray-50 px-3 py-2 text-sm font-black text-[#111827]">
                {getPaymentMethod(order)}
              </span>

              <span
                className={`rounded-2xl px-3 py-2 text-sm font-black ${
                  pixPaid
                    ? 'bg-green-50 text-green-700'
                    : pixPending
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-gray-50 text-[#6b7280]'
                }`}
              >
                {getPaymentStatus(order)}
              </span>
            </div>

            <PricingValidationAlert order={order} />

            {showCustomerThanksAction && (
  <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-green-800">
          Cliente confirmou o recebimento
        </p>
        <p className="mt-1 text-xs font-bold leading-5 text-green-700">
          Envie uma mensagem curta de agradecimento pelo WhatsApp.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSendCustomerThanks(order)}
        disabled={Boolean(updatingStatus)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiMessageCircle size={15} />
        Agradecer cliente
      </button>
    </div>
  </div>
)}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              {pixPending ? (
                <button
                  type="button"
                  onClick={() => onConfirmPixPayment(order)}
                  disabled={Boolean(updatingStatus)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3aa824] px-4 py-3 text-sm font-black text-white shadow-md transition hover:bg-[#2f8f1d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FiCheckCircle size={17} />
                  {updatingStatus === order.id ? 'Confirmando...' : 'Confirmar Pix'}
                </button>
              ) : nextStatus ? (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order, nextStatus)}
                  disabled={Boolean(updatingStatus)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-black text-white shadow-md shadow-orange-600/20 transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FiZap size={17} />
                  {updatingStatus === order.id
                    ? 'Atualizando...'
                    : updatingStatus
                      ? 'Aguarde...'
                      : getNextStatusLabel(status)}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => printComanda(order, store)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white transition hover:bg-black"
              >
                <FiPrinter size={17} />
                Comanda
              </button>

              <button
                type="button"
                onClick={() => onCopyOrder(order)}
                className="hidden items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-gray-50 sm:inline-flex"
              >
                <FiCopy size={17} />
                Copiar
              </button>
            </div>
          </div>
        </section>

        <main className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[0.95fr_1.1fr_300px]">
            <div className="min-h-0 space-y-4 overflow-hidden">
              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
                      <FiUser className="text-[#f97316]" />
                      Cliente
                    </p>

                    <p className="mt-3 truncate text-lg font-black text-[#111827]">
                      {getCustomerName(order)}
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-[#6b7280]">
                      {getCustomerPhone(order) || 'Telefone não informado'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenWhatsApp(order)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-[#25D366] transition hover:bg-green-100"
                    title="Chamar no WhatsApp"
                  >
                    <FiMessageCircle size={19} />
                  </button>
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
                  {address.isPickup ? (
                    <>
                      <FiShoppingBag size={14} className="text-[#f97316]" />
                      Retirada
                    </>
                  ) : (
                    <>
                      <FiTruck size={14} className="text-[#f97316]" />
                      Entrega
                    </>
                  )}
                </p>

                {!address.isPickup && (
                  <button
                    type="button"
                    onClick={() => onOpenMaps(order)}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] transition hover:bg-orange-100"
                  >
                    <FiNavigation size={14} />
                    Mapa
                  </button>
                )}
              </div>

                <p className="mt-2 text-sm font-black leading-6 text-[#111827]">
                  {address.full}
                </p>

                {(address.neighborhood || address.complement || address.reference) && (
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#6b7280]">
                    {[
                      address.neighborhood,
                      address.complement,
                      address.reference ? `Ref: ${address.reference}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </section>

              {(order?.orderObservation || order?.customerObservation || order?.observation) && (
                <section className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-black text-amber-950">
                    <FiAlertTriangle className="text-amber-600" />
                    Observação
                  </p>

                  <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-amber-800">
                    {order.orderObservation || order.customerObservation || order.observation}
                  </p>
                </section>
              )}

              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
        <FiCreditCard className="text-[#f97316]" />
        Meio de pagamento
      </p>

      <p className="mt-3 text-lg font-black text-[#111827]">
        {getPaymentMethod(order)}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#6b7280]">
        {getPaymentStatus(order)}
      </p>

      {changeForLabel && (
        <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-[#9a3412]">
            Troco
          </p>

          <p className="mt-1 text-sm font-black text-[#111827]">
            {changeForLabel}
          </p>
        </div>
      )}
    </div>

    <span
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
        pixPaid
          ? 'bg-green-50 text-green-700'
          : pixPending
            ? 'bg-amber-50 text-amber-700'
            : status === 'cancelado'
              ? 'bg-red-50 text-red-700'
              : 'bg-gray-50 text-[#6b7280]'
      }`}
    >
      {status === 'cancelado'
        ? 'Cancelado'
        : isPixManualOrder(order)
          ? pixPaid
            ? 'Pix pago'
            : 'Pix pendente'
          : getPaymentMethod(order)}
    </span>
  </div>

  {status === 'cancelado' && (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-700">
        <FiAlertTriangle />
        Motivo do cancelamento
      </p>

      <p className="mt-2 text-sm font-bold leading-6 text-red-800">
        {cancellationReason || 'Motivo não informado.'}
      </p>
    </div>
  )}
</section>

              {isPixManualOrder(order) && (
                <section
                  className={`rounded-[1.4rem] border p-4 shadow-sm ${
                    pixPaid
                      ? 'border-green-100 bg-green-50'
                      : 'border-orange-100 bg-orange-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-black ${pixPaid ? 'text-green-800' : 'text-[#9a3412]'}`}>
                      Pix manual
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        pixPaid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {pixPaid ? 'Pago' : 'Aguardando'}
                    </span>
                  </div>

                  {paymentProofUrl ? (
                    <a
                      href={paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#111827] shadow-sm transition hover:text-[#f97316]"
                    >
                      <FiExternalLink />
                      Ver comprovante
                    </a>
                  ) : (
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#9a3412]">
                      Confirme o comprovante no contato do cliente.
                    </p>
                  )}
                </section>
              )}
            </div>

            <section className="flex min-h-0 flex-col rounded-[1.4rem] border border-gray-100 bg-white shadow-sm">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 p-4">
                <p className="flex items-center gap-2 text-base font-black text-[#111827]">
                  <FiShoppingBag className="text-[#f97316]" />
                  Itens
                </p>

                <span className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-[#6b7280]">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <OrderItemsList items={items} />
              </div>
            </section>

            <aside className="min-h-0 space-y-4 overflow-y-auto">
              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${meta.dotClass}`} />

                  <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Status atual
                  </p>
                </div>

                <p className="mt-3 text-2xl font-black tracking-tight text-[#111827]">
                  {meta.label}
                </p>

                <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                  {pixPending
                    ? 'Aguardando confirmação do Pix.'
                    : meta.description}
                </p>
              </section>

              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-[#111827]">
                  Resumo financeiro
                </p>

                <div className="mt-2">
                  <FinancialSummary order={order} />
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-sm font-black text-[#111827]">
        Forçar alteração
      </p>

      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
        Use somente para corrigir o fluxo do pedido.
      </p>
    </div>
  </div>

  <div className="mt-3 grid grid-cols-2 gap-2">
    {STATUS_FLOW.map((statusOption) => {
      const optionMeta = STATUS_META[statusOption]
      const Icon = optionMeta.icon
      const active = status === statusOption
      const optionIndex = STATUS_FLOW.indexOf(statusOption)
      const isPreviousStatus = optionIndex < currentIndex

      return (
        <button
          key={statusOption}
          type="button"
          onClick={() => onUpdateStatus(order, statusOption)}
          disabled={
            Boolean(updatingStatus) ||
            (isFinalStatus && !active) ||
            isPreviousStatus ||
            (statusOption === 'preparando' && pixPending)
          }
          className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
            active
              ? optionMeta.buttonClass
              : 'border-gray-100 bg-white text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
          }`}
        >
          <Icon size={15} />
          {optionMeta.label}
        </button>
      )
    })}
  </div>
</section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const { user, userData, role, loading: authLoading } = useAuth()

  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState('')
  const [storeActionLoading, setStoreActionLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const selectedStore = useMemo(() => {
    if (!stores.length) return null

    return (
      stores.find((store) => getStoreKeys(store).includes(selectedStoreId)) ||
      stores[0] ||
      null
    )
  }, [selectedStoreId, stores])

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find((order) => order.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  const loading = loadingStores || loadingOrders
  const canReadOrders = canLoadOperationalOrders({ role, selectedStore, userData })

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId)
    safeSetLocalStorage(SELECTED_STORE_KEY, storeId)
  }, [])

  const handleToggleStoreOpen = useCallback(async () => {
    if (!selectedStore || storeActionLoading) return

    const storeDocId = selectedStore.id || selectedStore.docId || selectedStore.storeId

    if (!storeDocId) {
      showToast('error', 'Loja sem ID válido para atualizar.')
      return
    }

    const nextStatus = !selectedStore.isOpen

    try {
      setStoreActionLoading(true)
      await updateDoc(doc(db, 'stores', storeDocId), {
        isOpen: nextStatus,
        updatedAt: Timestamp.now(),
      })
      showToast('success', nextStatus ? 'Loja aberta. Agora você já pode receber pedidos.' : 'Loja fechada. Novos pedidos ficarão pausados.')
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error)
      showToast('error', 'Erro ao atualizar o status da loja.')
    } finally {
      setStoreActionLoading(false)
    }
  }, [selectedStore, showToast, storeActionLoading])

  const handleUpdateStatus = useCallback(
  async (order, status) => {
    if (!order?.id || updatingStatus) return

    const nextStatus = normalizeStatus(status)
    const currentStatus = normalizeStatus(order.status)

    const isMeaningfulStatusChange =
  nextStatus !== currentStatus && nextStatus !== 'cancelado'

if (isMeaningfulStatusChange && shouldBlockOrderAcceptance(order)) {
  showToast(
    'error',
    'Este pedido tem valor suspeito. Confira o total antes de aceitar ou avançar.'
  )
  return
}

if (isMeaningfulStatusChange && shouldWarnOrderAcceptance(order)) {
  const confirmed = window.confirm(
    'O PratoBy marcou este pedido para revisão de valor. Deseja avançar mesmo assim?'
  )

  if (!confirmed) return
}

    if (nextStatus === 'preparando' && shouldBlockPreparationUntilPayment(order)) {
      showToast('error', 'Confirme o pagamento Pix antes de iniciar o preparo.')
      return
    }

    const currentIndex = STATUS_FLOW.indexOf(currentStatus)
    const nextIndex = STATUS_FLOW.indexOf(nextStatus)

    if (nextIndex < currentIndex && nextStatus !== 'cancelado') {
      showToast('error', 'Não é possível retroceder o pedido para um status anterior.')
      return
    }

    let cancellationPatch = {}

    if (nextStatus === 'cancelado') {
      const confirmed = window.confirm(
        'Tem certeza que deseja cancelar este pedido? O motivo será exibido para o cliente.'
      )

      if (!confirmed) return

      const reason = window.prompt(
        'Informe o motivo do cancelamento. Ex: Produto indisponível, endereço fora da área, loja fechando, pagamento não confirmado...'
      )

      const normalizedReason = String(reason || '').trim()

      if (normalizedReason.length < 5) {
        showToast('error', 'Informe um motivo de cancelamento com pelo menos 5 caracteres.')
        return
      }

      cancellationPatch = {
        cancellationReason: normalizedReason,
        cancelReason: normalizedReason,
        canceledReason: normalizedReason,
        canceledBy: user?.uid || null,
        canceledByStore: true,
        cancellation: {
          reason: normalizedReason,
          canceledBy: user?.uid || null,
          canceledByStore: true,
          canceledAt: Timestamp.now(),
        },
      }
    }

    const now = Timestamp.now()
    const statusField = getStatusField(nextStatus)

    const paymentPatch =
      nextStatus === 'entregue'
        ? {
            'payment.status': 'paid',
            'payment.confirmedAt': now,
            'payment.paidAt': now,
            'payment.confirmedBy': user?.uid || null,
            paymentStatus: 'paid',
            paidAt: now,
          }
        : {}

    let notificationPatch = {}

    if (['preparando', 'em_rota', 'entregue', 'cancelado'].includes(nextStatus)) {
      const phone = normalizePhoneForWhatsApp(getCustomerPhone(order))

      if (!phone) {
        showToast('error', 'Cliente sem WhatsApp válido para receber aviso.')
      } else {
        const shouldNotify = window.confirm(
          nextStatus === 'preparando'
            ? 'Deseja enviar a confirmação completa do pedido para o cliente?'
            : nextStatus === 'cancelado'
              ? 'Deseja avisar o cliente no WhatsApp com o motivo do cancelamento?'
              : 'Deseja enviar uma atualização rápida no WhatsApp?'
        )

        if (shouldNotify) {
          const orderWithNewStatus = {
            ...order,
            status: nextStatus,
            ...cancellationPatch,
          }

          const message = buildWhatsAppMessage(orderWithNewStatus, selectedStore)
          const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

          const openedWindow = window.open(
            whatsappUrl,
            '_blank',
            'noopener,noreferrer'
          )

          if (!openedWindow) {
            showToast(
              'error',
              'O navegador bloqueou o WhatsApp. Permita pop-ups para o PratoBy.'
            )
          }

          const notifiedAt = Timestamp.now()

          notificationPatch = {
            customerLastNotifiedAt: notifiedAt,
            customerLastNotifiedStatus: nextStatus,
            ...(nextStatus === 'preparando'
              ? {
                  customerConfirmationMessageSentAt: notifiedAt,
                  customerConfirmationMessageSentBy: user?.uid || null,
                }
              : {}),
          }
        }
      }
    }

    try {
      setUpdatingStatus(order.id)

      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updatedAt: now,
      
        statusUpdatedBy: user?.uid || null,
        statusUpdatedAt: now,
        statusUpdatedFrom: currentStatus,
        statusUpdatedTo: nextStatus,
      
        ...(statusField ? { [statusField]: now } : {}),
        ...paymentPatch,
        ...cancellationPatch,
        ...notificationPatch,
      })

      const statusLabel = STATUS_META[nextStatus]?.label || 'Atualizado'

      showToast('success', `Pedido atualizado para "${statusLabel}".`)

      if (nextStatus === 'preparando') {
        setTimeout(() => {
          printComanda(
            {
              ...order,
              status: nextStatus,
              ...cancellationPatch,
            },
            selectedStore
          )
        }, 500)
      }
    } catch (error) {
      console.error(error)
      showToast('error', 'Erro ao atualizar o status do pedido.')
    } finally {
      setUpdatingStatus('')
    }
  },
  [selectedStore, showToast, updatingStatus, user?.uid]
)

  const handleConfirmPixPayment = useCallback(
  async (order) => {
    if (!order?.id || updatingStatus) return

    if (!isPixManualOrder(order)) {
      showToast('error', 'Este pedido não é Pix manual.')
      return
    }
    
    if (isPaymentPaid(order)) {
      showToast('success', 'Este pagamento já está confirmado.')
      return
    }
    
    if (shouldBlockOrderAcceptance(order)) {
      showToast(
        'error',
        'Este pedido tem valor suspeito. Confira o total antes de aceitar.'
      )
      return
    }
    
    if (shouldWarnOrderAcceptance(order)) {
      const confirmedReview = window.confirm(
        'O PratoBy marcou este pedido para revisão de valor. Deseja confirmar o Pix e enviar para preparo mesmo assim?'
      )
    
      if (!confirmedReview) return
    }

    const confirmed = window.confirm(
      'Confirmar pagamento Pix e enviar o pedido para preparo?'
    )

    if (!confirmed) return

    const now = Timestamp.now()
    const currentStatus = normalizeStatus(order.status)
    const shouldStartPreparing = currentStatus === 'pendente'

    try {
      setUpdatingStatus(order.id)

      const nextOrder = {
        ...order,
        status: shouldStartPreparing ? 'preparando' : order.status,
        payment: {
          ...(order.payment || {}),
          method: getPaymentMethodId(order) || 'pix_manual',
          status: 'paid',
          paidAt: now,
          confirmedAt: now,
          confirmedBy: user?.uid || null,
          requiresConfirmation: false,
        },
        paymentStatus: 'paid',
        paymentRequiresConfirmation: false,
        paidAt: now,
      }

      await updateDoc(doc(db, 'orders', order.id), {
        updatedAt: now,
      
        statusUpdatedBy: user?.uid || null,
        statusUpdatedAt: now,
        statusUpdatedFrom: currentStatus,
        statusUpdatedTo: shouldStartPreparing ? 'preparando' : currentStatus,
      
        'payment.method': getPaymentMethodId(order) || 'pix_manual',
        'payment.status': 'paid',
        'payment.paidAt': now,
        'payment.confirmedAt': now,
        'payment.confirmedBy': user?.uid || null,
        'payment.requiresConfirmation': false,
      
        paymentStatus: 'paid',
        paymentRequiresConfirmation: false,
        paidAt: now,
      
        ...(shouldStartPreparing
          ? {
              status: 'preparando',
              preparingAt: now,
            }
          : {}),
      })

      showToast(
        'success',
        shouldStartPreparing
          ? 'Pagamento confirmado e pedido enviado para preparo.'
          : 'Pagamento Pix confirmado.'
      )

      if (shouldStartPreparing) {
        setTimeout(() => {
          printComanda(nextOrder, selectedStore)
        }, 500)
      }

      const phone = normalizePhoneForWhatsApp(getCustomerPhone(order))

      if (phone && shouldStartPreparing) {
        const shouldNotify = window.confirm(
          'Deseja enviar a confirmação completa do pedido para o cliente?'
        )

        if (shouldNotify) {
          const message = buildWhatsAppMessage(nextOrder, selectedStore)

          window.open(
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
            '_blank',
            'noopener,noreferrer'
          )

          const notifiedAt = Timestamp.now()

          await updateDoc(doc(db, 'orders', order.id), {
            customerLastNotifiedAt: notifiedAt,
            customerLastNotifiedStatus: 'preparando',
            customerConfirmationMessageSentAt: notifiedAt,
            customerConfirmationMessageSentBy: user?.uid || null,
            updatedAt: notifiedAt,
          })
        }
      }
    } catch (error) {
      console.error(error)
      showToast('error', 'Erro ao confirmar pagamento Pix.')
    } finally {
      setUpdatingStatus('')
    }
  },
  [selectedStore, showToast, updatingStatus, user?.uid]
)

  const handleSendCustomerThanks = useCallback(
  async (order) => {
    if (!order?.id || updatingStatus) return

    const phone = normalizePhoneForWhatsApp(getCustomerPhone(order))

    if (!phone) {
      showToast('error', 'Cliente sem WhatsApp válido.')
      return
    }

    try {
      setUpdatingStatus(order.id)

      const message = buildCustomerThanksMessage(order, selectedStore)

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        '_blank',
        'noopener,noreferrer'
      )

      const now = Timestamp.now()

      await updateDoc(doc(db, 'orders', order.id), {
        storeThankedCustomerAt: now,
        storeThankedCustomerBy: user?.uid || null,
        updatedAt: now,
      })

      showToast('success', 'Mensagem de agradecimento aberta no WhatsApp.')
    } catch (error) {
      console.error(error)
      showToast('error', 'Não foi possível registrar o agradecimento.')
    } finally {
      setUpdatingStatus('')
    }
  },
  [selectedStore, showToast, updatingStatus, user?.uid]
)

  const handleOpenWhatsApp = useCallback(
    (order) => {
      const phone = normalizePhoneForWhatsApp(getCustomerPhone(order))

      if (!phone) {
        showToast('error', 'Este pedido não possui telefone válido.')
        return
      }

      const message = encodeURIComponent(buildWhatsAppMessage(order, selectedStore))

      window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
    },
    [selectedStore, showToast]
  )

  const handleOpenMaps = useCallback(
    (order) => {
      const address = getAddress(order)

      if (address.isPickup) {
        showToast('error', 'Este pedido é para retirada.')
        return
      }

      if (!address.full || address.full === 'Endereço não informado') {
        showToast('error', 'Endereço não informado neste pedido.')
        return
      }

      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.full)}`,
        '_blank',
        'noopener,noreferrer'
      )
    },
    [showToast]
  )

  const handleCopyOrder = useCallback(
    async (order) => {
      const address = getAddress(order)

      const itemsText = getOrderItems(order)
        .map((item) => {
          const options = getItemOptionsSummary(item)
          const observation = item.observation ? ` | Obs: ${item.observation}` : ''

          return `${getItemQty(item)}x ${getItemName(item)}${options ? ` (${options})` : ''}${observation}`
        })
        .join('\n')

      const text = [
        `Pedido ${getOrderDisplayNumber(order)}`,
        `Cliente: ${getCustomerName(order)}`,
        `Telefone: ${getCustomerPhone(order) || 'Não informado'}`,
        `Status: ${STATUS_META[normalizeStatus(order.status)]?.label || 'Pendente'}`,
        `Pagamento: ${getPaymentMethod(order)}`,
        `Total: ${formatMoney(getOrderTotal(order))}`,
        `Endereço: ${address.full}`,
        address.complement ? `Complemento: ${address.complement}` : '',
        address.reference ? `Referência: ${address.reference}` : '',
        '',
        'Itens:',
        itemsText || getOrderItemsSummary(order),
      ]
        .filter(Boolean)
        .join('\n')

      try {
        await navigator.clipboard.writeText(text)
        showToast('success', 'Resumo do pedido copiado.')
      } catch {
        showToast('error', 'Não foi possível copiar o resumo.')
      }
    },
    [showToast]
  )

  useEffect(() => {
    const uid = user?.uid

    if (!uid) {
      setStores([])
      setLoadingStores(false)
      return undefined
    }

    setLoadingStores(true)

    const storesMap = new Map()
    const unsubscribers = []
    let receivedAnySnapshot = false
    let errorShown = false

    function normalizeStoreDoc(storeDoc) {
      const data = storeDoc.data() || {}

      return {
        ...data,
        id: storeDoc.id,
        storeId: data.storeId || storeDoc.id,
        storeDocId: data.storeDocId || storeDoc.id,
        storeSlug: data.storeSlug || data.slug || storeDoc.id,
        slug: data.slug || data.storeSlug || storeDoc.id,
      }
    }

    function publishStores() {
      const storesData = Array.from(storesMap.values()).sort((a, b) => {
        const aName = String(a.name || a.storeName || a.storeSlug || a.id || '')
        const bName = String(b.name || b.storeName || b.storeSlug || b.id || '')

        return aName.localeCompare(bName, 'pt-BR')
      })

      setStores(storesData)
      setLoadingStores(false)
    }

    function handleStoresSnapshot(snapshot) {
      receivedAnySnapshot = true

      snapshot.docs.forEach((storeDoc) => {
        storesMap.set(storeDoc.id, normalizeStoreDoc(storeDoc))
      })

      publishStores()
    }

    function handleStoresError(error) {
      console.error('Erro ao carregar lojas:', error)
      setLoadingStores(false)

      if (!errorShown) {
        errorShown = true
        showToast('error', 'Erro ao carregar lojas. Confira permissões ou índices do Firestore.')
      }

      if (!receivedAnySnapshot) {
        setStores([])
      }
    }

    function subscribeStores(storesQuery) {
      const unsubscribe = onSnapshot(storesQuery, handleStoresSnapshot, handleStoresError)
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
  }, [showToast, user?.uid])

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId('')
      return
    }

    setSelectedStoreId((current) => {
      if (stores.some((store) => getStoreKeys(store).includes(current))) return current

      const savedStoreId = safeGetLocalStorage(SELECTED_STORE_KEY)

      if (stores.some((store) => getStoreKeys(store).includes(savedStoreId))) {
        return savedStoreId
      }

      return getStoreKeys(stores[0])[0] || stores[0].id
    })
  }, [stores])

  useEffect(() => {
    if (authLoading) {
      setOrders([])
      setLoadingOrders(true)
      return undefined
    }

    if (!selectedStore) {
      setOrders([])
      setLoadingOrders(false)
      return
    }

    if (!canReadOrders) {
      setOrders([])
      setLoadingOrders(false)
      return undefined
    }

    const storeKeys = getStoreKeys(selectedStore)

    if (!storeKeys.length) {
      setOrders([])
      setLoadingOrders(false)
      return
    }

    setLoadingOrders(true)

    const ordersMap = new Map()
    const unsubscribers = []
    let receivedAnySnapshot = false
    let errorShown = false

    const updateOrders = () => {
      const nextOrders = Array.from(ordersMap.values()).sort((a, b) => {
        const dateA = getOrderDate(a)?.getTime() || 0
        const dateB = getOrderDate(b)?.getTime() || 0

        return dateB - dateA
      })

      setOrders(nextOrders)
      setLoadingOrders(false)
    }

    const handleSnapshot = (snapshot) => {
      receivedAnySnapshot = true

      snapshot.docs.forEach((orderDoc) => {
        ordersMap.set(orderDoc.id, {
          ...orderDoc.data(),
          id: orderDoc.id,
          firestoreId: orderDoc.id,
        })
      })

      updateOrders()
    }

    const handleError = (error) => {
      console.error('Erro ao carregar pedidos:', error)
      setLoadingOrders(false)

      if (!errorShown) {
        errorShown = true
        showToast(
          'error',
          'Algumas buscas de pedidos falharam. Confira as permissões/índices do Firestore.'
        )
      }

      if (!receivedAnySnapshot) {
        setOrders([])
      }
    }

    const cutoffDate = Timestamp.fromDate(new Date(Date.now() - 31 * 86400000))

    // Simplifica a busca para usar apenas o docId principal.
    // Garante que a regra de segurança passe tranquilamente sem analisar slugs.
    const docId = selectedStore.id || selectedStore.docId || selectedStore.storeId

    const storeKeySet = new Set([docId].filter(Boolean))

    if (!storeKeySet.size) {
      setOrders([])
      setLoadingOrders(false)
      return
    }

    function subscribeOrders(ordersQuery) {
      const unsubscribe = onSnapshot(ordersQuery, handleSnapshot, handleError)
      unsubscribers.push(unsubscribe)
    }

    storeKeySet.forEach((key) => {
      subscribeOrders(
        query(
          collection(db, 'orders'),
          where('storeId', '==', key),
          where('createdAt', '>=', cutoffDate),
          orderBy('createdAt', 'desc')
        )
      )
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [authLoading, canReadOrders, selectedStore, showToast])

  const statusCounts = useMemo(() => {
    const counts = {
      todos: orders.length,
      pendente: 0,
      preparando: 0,
      em_rota: 0,
      entregue: 0,
      cancelado: 0,
    }

    orders.forEach((order) => {
      const status = normalizeStatus(order.status)

      if (counts[status] !== undefined) {
        counts[status] += 1
      }
    })

    return counts
  }, [orders])

  const summary = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const todayOrders = orders.filter((order) => {
      const date = getOrderDate(order)
      return date && date >= startOfToday
    })

    const validTodayOrders = todayOrders.filter(
      (order) => normalizeStatus(order.status) !== 'cancelado'
    )

    const activeOrders = orders.filter((order) =>
      ACTIVE_STATUSES.includes(normalizeStatus(order.status))
    )

    const latePendingOrders = orders.filter(isLatePending)

    const revenueToday = validTodayOrders.reduce(
      (acc, order) => acc + getOrderTotal(order),
      0
    )

    const economyToday = validTodayOrders.reduce(
      (acc, order) => acc + getOrderPromotionSavings(order) + getOrderDiscount(order),
      0
    )

    return {
      todayCount: todayOrders.length,
      revenueToday,
      economyToday,
      activeCount: activeOrders.length,
      latePendingCount: latePendingOrders.length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()

    return orders.filter((order) => {
      const status = normalizeStatus(order.status)

      if (statusFilter !== 'todos' && status !== statusFilter) {
        return false
      }

      if (!term) return true

      const address = getAddress(order)

      const searchableText = [
        order.id,
        getCustomerName(order),
        getCustomerPhone(order),
        getOrderItemsSummary(order),
        getPaymentMethod(order),
        address.full,
        address.neighborhood,
        address.complement,
        address.reference,
        ...getOrderItems(order).map(getItemName),
        ...getOrderItems(order).map(getItemOptionsSummary),
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(term)
    })
  }, [orders, search, statusFilter])

  return (
    <main className="min-h-full">
      <DashboardPageHeader
        title="Gerenciamento de pedidos"
        description="Operação e acompanhamento em tempo real."
        icon={FiShoppingBag}
        badge={
          selectedStore
            ? {
                label: selectedStore.isOpen ? 'Loja aberta' : 'Loja fechada',
                color: selectedStore.isOpen ? 'green' : 'red',
                dot: true,
              }
            : undefined
        }
        actions={
          <>
            {stores.length > 1 && (
              <select
                value={selectedStoreId}
                onChange={(event) => handleSelectStore(event.target.value)}
                className="h-11 cursor-pointer rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
              >
                {stores.map((store) => (
                  <option key={store.id} value={getStoreKeys(store)[0] || store.id}>
                    {store.name || getStoreSlug(store)}
                  </option>
                ))}
              </select>
            )}
            {selectedStore && (
              <button
                type="button"
                disabled={storeActionLoading}
                onClick={handleToggleStoreOpen}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-[13px] font-black shadow-sm ring-1 ring-inset transition active:scale-95 disabled:opacity-70 ${
                  selectedStore?.isOpen
                    ? 'bg-red-50 text-red-700 ring-red-200 shadow-red-100/50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/40 dark:hover:bg-red-900/40'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-100/50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/40 dark:hover:bg-emerald-900/40'
                }`}
              >
                {storeActionLoading ? (
                  <>
                    <FiLoader size={16} className="animate-spin" />
                    Atualizando...
                  </>
                ) : selectedStore?.isOpen ? (
                  <>
                    <FiPower size={16} />
                    Fechar loja
                  </>
                ) : (
                  <>
                    <FiPower size={16} />
                    Abrir loja
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => showToast('success', 'Os pedidos já estão sincronizados em tempo real.')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c]"
            >
              <FiRefreshCw />
              Tempo real
            </button>
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingStores ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-[1.5rem] bg-white"
              />
            ))}
          </div>
        ) : !selectedStore ? (
          <EmptyState
            icon={FiHome}
            title="Nenhuma loja encontrada"
            description="Seu usuário ainda não possui uma loja vinculada. Peça ao administrador para criar ou vincular uma loja ao seu acesso."
          />
        ) : !canReadOrders ? (
          <EmptyState
            icon={FiCreditCard}
            title="Configure a cobrança para acessar pedidos"
            description="Conclua a configuração de faturamento para liberar a operação da loja."
          />
        ) : (
          <>
            <div className="mb-6 rounded-[1.8rem] bg-[#111827] p-5 text-white shadow-xl shadow-black/20 ring-1 ring-white/5">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-orange-50">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                        selectedStore?.isOpen ? 'bg-[#00FF00] shadow-[#00FF00]/40' : 'bg-red-500 shadow-red-500/40'
                      }`}
                    />
                    {selectedStore?.isOpen ? 'Loja aberta' : 'Loja fechada'}
                  </div>

                  <h2 className="mt-3 text-2xl font-black tracking-tight">
                    {selectedStore.name || 'Sua loja'}
                  </h2>

                  <p className="mt-1 text-sm font-medium text-gray-400">
                    /{getStoreSlug(selectedStore)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[640px]">
                  <div className="rounded-[1.2rem] border border-blue-900/30 bg-blue-950/20 p-4 transition hover:bg-blue-950/30">
                    <p className="text-[11px] font-black uppercase tracking-wide text-blue-400">Hoje</p>
                    <p className="mt-1.5 text-2xl font-black text-white">{summary.todayCount}</p>
                  </div>

                  <div className="rounded-[1.2rem] border border-emerald-900/30 bg-emerald-950/20 p-4 transition hover:bg-emerald-950/30">
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-400">Faturamento</p>
                    <p className="mt-1.5 text-xl font-black text-white">{formatMoney(summary.revenueToday)}</p>
                  </div>

                  <div className="rounded-[1.2rem] border border-amber-900/30 bg-amber-950/20 p-4 transition hover:bg-amber-950/30">
                    <p className="text-[11px] font-black uppercase tracking-wide text-amber-400">Ativos</p>
                    <p className="mt-1.5 text-2xl font-black text-white">{summary.activeCount}</p>
                  </div>

                  <div className="rounded-[1.2rem] border border-red-900/30 bg-red-950/20 p-4 transition hover:bg-red-950/30">
                    <p className="text-[11px] font-black uppercase tracking-wide text-red-400">Atenção</p>
                    <p className="mt-1.5 text-2xl font-black text-white">{summary.latePendingCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {summary.latePendingCount > 0 && (
  <div className="mb-6 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-red-700 shadow-lg shadow-red-100/70">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
          <FiAlertTriangle className="animate-pulse" size={22} />
        </div>

        <div>
          <p className="text-sm font-black">
            {summary.latePendingCount} pedido
            {summary.latePendingCount > 1 ? 's' : ''} pendente
            {summary.latePendingCount > 1 ? 's' : ''} há mais de 3 minutos
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-red-600">
            Priorize esses pedidos para não deixar o cliente esperando sem confirmação.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStatusFilter('pendente')}
        className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700"
      >
        Ver pendentes
      </button>
    </div>
  </div>
)}

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={FiInbox}
                label="Pedidos hoje"
                value={loading ? '...' : summary.todayCount}
                description="Recebidos desde 00:00"
                tone="blue"
              />

              <StatCard
                icon={FiDollarSign}
                label="Faturamento hoje"
                value={loading ? '...' : formatMoney(summary.revenueToday)}
                description="Sem pedidos cancelados"
                tone="green"
              />

              <StatCard
                icon={FiZap}
                label="Pedidos ativos"
                value={loading ? '...' : summary.activeCount}
                description="Pendentes, preparo ou rota"
                tone="amber"
              />

              <StatCard
                icon={FiDollarSign}
                label="Economia cliente"
                value={loading ? '...' : formatMoney(summary.economyToday)}
                description="Promoções + cupons hoje"
                tone="purple"
              />

              <StatCard
                icon={FiAlertTriangle}
                label="Precisam atenção"
                value={loading ? '...' : summary.latePendingCount}
                description="Pendentes acima de 3min"
                tone={summary.latePendingCount > 0 ? 'red' : 'green'}
              />
            </div>

            <div className="mb-5 rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />

                  <input
                    type="text"
                    placeholder="Buscar por cliente, telefone, endereço, produto, opção ou código..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] pl-12 pr-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                  <span className="hidden items-center gap-2 text-sm font-black text-[#6b7280] xl:flex">
                    <FiFilter />
                    Filtros
                  </span>

                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                        statusFilter === tab.key
                          ? 'bg-[#f97316] text-white shadow-sm'
                          : 'bg-gray-50 text-[#6b7280] hover:bg-orange-50 hover:text-[#f97316]'
                      }`}
                    >
                      {tab.label}

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          statusFilter === tab.key
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-[#6b7280]'
                        }`}
                      >
                        {statusCounts[tab.key] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden rounded-[1.5rem] border border-gray-100 bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#6b7280] shadow-sm lg:grid lg:grid-cols-[100px_1fr_160px_150px_180px_auto] lg:gap-4">
              <div>ID</div>
              <div>Cliente e itens</div>
              <div>Status</div>
              <div>Total</div>
              <div>Horário</div>
              <div className="text-right">Ações</div>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                [1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-[1.5rem] bg-white"
                  />
                ))
              ) : filteredOrders.length === 0 ? (
                <EmptyState
                  icon={FiShoppingBag}
                  title="Nenhum pedido encontrado"
                  description={
                    search || statusFilter !== 'todos'
                      ? 'Tente limpar a busca ou alterar o filtro de status.'
                      : 'Quando novos pedidos entrarem, eles aparecerão aqui em tempo real.'
                  }
                />
              ) : (
                filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={(nextOrder) => setSelectedOrderId(nextOrder.id)}
                    onQuickStatus={handleUpdateStatus}
                    updatingStatus={updatingStatus}
                  />
                ))
              )}
            </div>
          </>
        )}
        
      </section>

      {selectedOrder && (
<OrderModal
  order={selectedOrder}
  store={selectedStore}
  onClose={() => setSelectedOrderId('')}
  onUpdateStatus={handleUpdateStatus}
  onConfirmPixPayment={handleConfirmPixPayment}
  onSendCustomerThanks={handleSendCustomerThanks}
  onCopyOrder={handleCopyOrder}
  onOpenWhatsApp={handleOpenWhatsApp}
  onOpenMaps={handleOpenMaps}
  updatingStatus={updatingStatus}
/>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
        <DashboardFooter store={selectedStore} />
    </main>
  )
}

