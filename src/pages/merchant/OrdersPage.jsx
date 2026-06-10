import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getItemDisplayOptionGroups } from '../../utils/orderItems'
import {
  buildOrderClipboardSummary,
  buildOrderWhatsAppUrl,
  hasValidOrderWhatsAppPhone,
} from '../../utils/orderSummary'
import { normalizeBrazilianPhoneForWhatsApp, formatBrazilianPhone } from '../../utils/phone'
import {
  getPricingValidation,
  shouldBlockOrderAcceptance,
  shouldWarnOrderAcceptance,
} from '../../utils/orderValidation'
import { getCallableErrorMessage } from '../../utils/callableError'
import { getOrderSlaState } from '../../utils/orderSla'
import {
  formatScheduledBadge,
  formatScheduledDate,
  formatScheduledOperationalLabel,
  getScheduledDate,
  getScheduledOperationalState,
  getScheduledTimeDistance,
  isOrderOperationalNow,
  isScheduledOrder,
  minutesToHumanLabel,
} from '../../utils/orderScheduling'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import {
  FiAlertTriangle,
  FiCalendar,
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
  FiPlusCircle,
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

import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import AnimatedSegmentedControl from '../../components/ui/AnimatedSegmentedControl'
import FloatingToast from '../../components/ui/FloatingToast'
import CounterOrderModal from './components/CounterOrderModal'

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
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
    dotClass: 'bg-amber-500',
    buttonClass: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  },
  confirmado: {
    label: 'Confirmado',
    description: 'Pedido aceito e aguardando preparo',
    icon: FiCheckCircle,
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25',
    dotClass: 'bg-blue-500',
    buttonClass: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  },
  preparando: {
    label: 'Preparando',
    description: 'Pedido em produção',
    icon: FiPackage,
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/25',
    dotClass: 'bg-purple-500',
    buttonClass: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300',
  },
  pronto: {
    label: 'Pronto',
    description: 'Aguardando retirada ou proxima etapa',
    icon: FiCheckCircle,
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
    dotClass: 'bg-emerald-500',
    buttonClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  em_rota: {
    label: 'Em rota',
    description: 'Saiu para entrega',
    icon: FiTruck,
    badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
    dotClass: 'bg-sky-500',
    buttonClass: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  },
  entregue: {
    label: 'Entregue',
    description: 'Pedido finalizado',
    icon: FiCheckCircle,
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
    dotClass: 'bg-[#f97316]',
    buttonClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  cancelado: {
    label: 'Cancelado',
    description: 'Pedido cancelado',
    icon: FiXCircle,
    badgeClass: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25',
    dotClass: 'bg-red-500',
    buttonClass: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  },
}

const MAIN_STATUS_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'ativos', label: 'Ativos' },
  { key: 'atrasados', label: 'Atrasados' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'preparando', label: 'Em preparo' },
  { key: 'pronto', label: 'Prontos' },
]

const MORE_STATUS_TABS = [
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'em_rota', label: 'Em rota' },
  { key: 'entregue', label: 'Entregues' },
  { key: 'cancelado', label: 'Cancelados' },
]

const TIMING_FILTERS = [
  { key: 'now', label: 'Agora' },
  { key: 'scheduled', label: 'Agendados' },
  { key: 'all', label: 'Todos' },
]

const STATUS_TABS = [...MAIN_STATUS_TABS, ...MORE_STATUS_TABS]
const MORE_STATUS_FILTER_KEYS = new Set(MORE_STATUS_TABS.map((tab) => tab.key))

const FILTER_BUTTON_MOTION = {
  whileHover: { y: -1, scale: 1.015 },
  whileTap: { scale: 0.96 },
  transition: { type: 'spring', stiffness: 420, damping: 28 },
}

const FINAL_STATUSES = ['entregue', 'cancelado', 'concluido', 'finalizado']

const FILTER_DROPDOWN_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 32,
      mass: 0.75,
      staggerChildren: 0.035,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    filter: 'blur(6px)',
    transition: { duration: 0.12 },
  },
}

const FILTER_DROPDOWN_ITEM_VARIANTS = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
  },
}

const ORDERS_LIST_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.035,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: 'blur(4px)',
    transition: { duration: 0.14 },
  },
}

const ORDER_ITEM_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 34,
      mass: 0.75,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.985,
    transition: { duration: 0.12 },
  },
}

const STATUS_FLOW = ['pendente', 'confirmado', 'preparando', 'pronto', 'em_rota', 'entregue', 'cancelado']
const ACTIVE_STATUSES = ['pendente', 'confirmado', 'preparando', 'pronto', 'em_rota']
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ALL_ORDERS = 250
const DATE_FILTER_OPTIONS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'all', label: 'Todos' },
]

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

    aceito: 'confirmado',
    accepted: 'confirmado',
    confirmed: 'confirmado',
    confirmado: 'confirmado',
    em_preparo: 'preparando',
    preparo: 'preparando',
    preparando: 'preparando',

    pronto: 'pronto',
    pronta: 'pronto',
    ready: 'pronto',
    ready_for_pickup: 'pronto',
    aguardando_retirada: 'pronto',

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

function startOfLocalDay(date = new Date()) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function getDateFilterRange(filter) {
  const today = startOfLocalDay()

  if (filter === 'ontem') {
    const start = new Date(today.getTime() - DAY_MS)
    return { start, end: today, limitCount: null }
  }

  if (filter === '7d') {
    return { start: new Date(today.getTime() - 6 * DAY_MS), end: null, limitCount: null }
  }

  if (filter === '30d') {
    return { start: new Date(today.getTime() - 29 * DAY_MS), end: null, limitCount: null }
  }

  if (filter === 'all') {
    return { start: null, end: null, limitCount: MAX_ALL_ORDERS }
  }

  return { start: today, end: new Date(today.getTime() + DAY_MS), limitCount: null }
}

function isOrderInDateFilter(order, filter) {
  const date = getOrderDate(order)
  if (!date) return filter === 'all'

  const { start, end } = getDateFilterRange(filter)

  if (start && date < start) return false
  if (end && date >= end) return false

  return true
}

function isOrderInTimingFilter(order, filter, now) {
  if (filter === 'all') return true

  const scheduled = isScheduledOrder(order)
  if (filter === 'scheduled') {
    return scheduled
  }
  if (!scheduled) return true

  return isOrderOperationalNow(order, { now })
}

function formatDate(order) {
  const date = getOrderDate(order)

  if (!date) return '-'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDistanceToNow(date) {
  if (!date) return ''

  const value = date instanceof Date ? date.getTime() : new Date(date).getTime()
  if (Number.isNaN(value)) return ''

  const seconds = Math.round((value - Date.now()) / 1000)
  const absSeconds = Math.abs(seconds)

  const units = [
    { limit: 60, value: 1, unit: 'second' },
    { limit: 3600, value: 60, unit: 'minute' },
    { limit: 86400, value: 3600, unit: 'hour' },
    { limit: 2592000, value: 86400, unit: 'day' },
    { limit: 31536000, value: 2592000, unit: 'month' },
    { limit: Infinity, value: 31536000, unit: 'year' },
  ]

  const { value: unitValue, unit } = units.find((item) => absSeconds < item.limit)
  const amount = Math.round(seconds / unitValue)

  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(amount, unit)
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

  if (!date) return '-'

  const diff = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diff < 30) return 'agora'
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`

  return `${Math.floor(diff / 86400)}d atrás`
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

function formatDisplayPhone(phone) {
  return formatBrazilianPhone(phone)
}

function getPaymentMethod(order) {
  const raw = String(
    order?.payment?.method || order?.paymentMethod || order?.paymentType || ''
  ).toLowerCase()

  const map = {
    pix: 'Pix',
    pix_manual: 'Pix manual',
    asaas_online: 'Asaas online',
    card: 'Cartão',
    cartao: 'Cartão',
    'cartão': 'Cartão',
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
    partially_refunded: 'Parcialmente estornado',
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

function isAsaasOnlineOrder(order) {
  const method = getPaymentMethodId(order)
  const provider = String(order?.payment?.provider || order?.paymentProvider || '')
    .toLowerCase()
    .trim()
  const mode = String(order?.payment?.mode || order?.paymentMode || '')
    .toLowerCase()
    .trim()

  return method === 'asaas_online' || (provider === 'asaas' && mode === 'online')
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

function isAsaasPaymentPending(order) {
  if (!isAsaasOnlineOrder(order)) return false

  const paymentStatus = getPaymentStatusId(order)

  return !isPaymentPaid(order) && ['pending', 'awaiting_payment', 'failed_link_creation', ''].includes(paymentStatus)
}

function getAsaasPaymentUrl(order) {
  return order?.payment?.paymentUrl || order?.payment?.invoiceUrl || order?.paymentUrl || order?.invoiceUrl || ''
}

function shouldBlockPreparationUntilPayment(order) {
  return (isPixPaymentPending(order) || isAsaasPaymentPending(order)) &&
    ['pendente', 'confirmado'].includes(normalizeStatus(order?.status))
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
    confirmado: 'confirmedAt',
    preparando: 'preparingAt',
    pronto: 'readyAt',
    em_rota: 'outForDeliveryAt',
    entregue: 'deliveredAt',
    cancelado: 'canceledAt',
  }

  return map[normalizeStatus(status)]
}

function isDeliveryOrder(order) {
  const type = String(
    order?.orderType ||
    order?.deliveryType ||
    order?.fulfillmentType ||
    order?.type ||
    ''
  ).toLowerCase()

  return !['pickup', 'retirada', 'takeout', 'balcao', 'local', 'dine_in', 'mesa'].includes(type)
}

function getNextStatus(status, order = null) {
  const current = normalizeStatus(status)

  if (current === 'pendente') return 'confirmado'
  if (current === 'confirmado') return 'preparando'
  if (current === 'preparando') return 'pronto'
  if (current === 'pronto') return isDeliveryOrder(order) ? 'em_rota' : 'entregue'
  if (current === 'em_rota') return 'entregue'

  return null
}

function getNextStatusLabel(status, order = null) {
  const next = getNextStatus(status, order)
  const scheduledState = isScheduledOrder(order)
    ? getScheduledOperationalState(order, { now: Date.now() })
    : 'asap'

  if (next === 'confirmado') return isScheduledOrder(order) ? 'Confirmar agendamento' : 'Aceitar pedido'
  if (next === 'preparando' && scheduledState === 'scheduled_future') return 'Ver agendamento'
  if (next === 'preparando') return 'Iniciar preparo'
  if (next === 'pronto') return 'Marcar pronto'
  if (next === 'em_rota') return 'Saiu para entrega'
  if (next === 'entregue') return isDeliveryOrder(order) ? 'Marcar entregue' : 'Finalizar pedido'

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

  const trackingToken = String(order?.trackingToken || '').trim()
  if (!trackingToken) return ''

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
  const scheduled = isScheduledOrder(order)
  const scheduledLabel = scheduled ? formatScheduledDate(order) : ''
  const scheduledWhen = scheduledLabel
    ? scheduledLabel.replace(/^Agendado para\s*/i, '')
    : 'o horário combinado'

  const contextLine = [
    `Pedido: *${orderCode}*`,
    `Tipo: *${orderTypeLabel}*`,
    paymentLine ? `Pagamento: *${paymentLine}*` : '',
    `Total: *${total}*`,
  ]
    .filter(Boolean)
    .join('\n')

  if (scheduled && status === 'confirmado') {
    return [
      `Olá, ${customerName}. Seu pedido ${orderCode} está agendado para ${scheduledWhen}.`,
      'Qualquer mudança, avisaremos por aqui.',
      trackingLink ? `\nAcompanhe por aqui:\n${trackingLink}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (scheduled && status === 'preparando') {
    return [
      `Olá, ${customerName}. Estamos preparando seu pedido agendado ${orderCode}.`,
      trackingLink ? `\nAcompanhe por aqui:\n${trackingLink}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (scheduled && status === 'pronto' && isPickup) {
    return [
      `Olá, ${customerName}. Seu pedido agendado ${orderCode} está pronto para retirada.`,
      trackingLink ? `\nAcompanhe por aqui:\n${trackingLink}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (scheduled && status === 'em_rota') {
    return [
      `Olá, ${customerName}. Seu pedido agendado ${orderCode} saiu para entrega.`,
      trackingLink ? `\nAcompanhe por aqui:\n${trackingLink}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (scheduled && status === 'confirmado') {
    return [
      `Olá, *${customerName}*! Aqui é da *${storeName}*.`,
      '',
      `Seu pedido *${orderCode}* está agendado.`,
      scheduledLabel,
      '',
      contextLine,
      trackingLink ? `\nAcompanhe por aqui:\n${trackingLink}` : '',
      '',
      `- ${storeName}`,
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  if (status === 'preparando') {
    const preparationIntro = scheduled
      ? `Estamos preparando seu pedido agendado *${orderCode}*.`
      : `Confirmamos o seu pedido *${orderCode}* e já estamos cuidando dele com atenção.`
    const deliveryText = isPickup
      ? 'Assim que estiver pronto para retirada, avisamos por aqui.'
      : isDineIn
        ? 'Seu pedido já foi encaminhado para preparo.'
        : 'Seu pedido já entrou na nossa fila de preparo. Avisamos novamente quando sair para entrega.'

    return [
      `Olá, *${customerName}*! Aqui é da *${storeName}*.`,
      '',
      `*Pedido confirmado*`,
      '',
      preparationIntro,
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
    `- ${storeName}`,
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
      `Olá, *${customerName}*! 😊`,
      '',
      `Passando para agradecer pela confiança e pelo pedido *${orderCode}*.`,
      '',
      'Ficamos muito felizes em atender você! Esperamos que tenha gostado e que tudo tenha chegado certinho.',
      '',
      'Com carinho,',
      `*${storeName}*`,
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
  const scheduled = isScheduledOrder(order)
  const scheduledLabel = scheduled ? formatScheduledDate(order).replace(/^Agendado para\s*/i, '') : ''
  const scheduledOperationalState = scheduled ? getScheduledOperationalState(order, { now: Date.now() }) : 'asap'
  const normalizedStatus = normalizeStatus(order.status)
  const scheduledState = scheduled
    ? normalizedStatus === 'cancelado' || scheduledOperationalState === 'canceled'
      ? 'Pedido cancelado no historico'
      : normalizedStatus === 'entregue' || scheduledOperationalState === 'completed'
        ? 'Pedido finalizado no historico'
        : normalizedStatus === 'preparando' || scheduledOperationalState === 'scheduled_due_soon'
          ? ''
          : normalizedStatus === 'pronto'
            ? ''
            : scheduledOperationalState === 'scheduled_late'
              ? ''
              : scheduledOperationalState === 'scheduled_future'
                ? ''
                : ''
    : ''
  const requiresScheduledPix = order.paymentPolicy === 'pix_required' ||
    order.schedulingSnapshot?.prepaymentPolicy === 'pix_required'

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

  const scheduledHtml = scheduled
    ? `
      <section class="schedule-box">
        <div class="schedule-title">PEDIDO AGENDADO</div>
        <div class="schedule-time">${escapeHtml(scheduledLabel || order.scheduledTimeLabel || 'Horario nao informado')}</div>
        ${scheduledState ? `<div class="schedule-state">${escapeHtml(scheduledState)}</div>` : ''}
        ${requiresScheduledPix ? '<div class="schedule-pix">PIX ANTECIPADO</div>' : ''}
      </section>
    `
    : ''

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
            padding: 4mm 2mm 4mm;
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
            font-size: 26px;
            font-weight: 900;
            line-height: 1;
            margin: 8px 0;
            padding: 7px 4px 6px;
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

          .schedule-box {
            border: 2px solid #000;
            margin: 7px 0;
            padding: 6px;
            text-align: center;
          }

          .schedule-title {
            font-size: 12px;
            font-weight: 900;
            letter-spacing: .04em;
          }

          .schedule-time {
            font-size: 15px;
            font-weight: 900;
            margin-top: 3px;
            text-transform: uppercase;
          }

          .schedule-state,
          .schedule-pix {
            font-size: 10px;
            font-weight: 900;
            margin-top: 3px;
            text-transform: uppercase;
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
            ${scheduledHtml}
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
  return toast?.legacy
    ? <LegacyToast toast={toast} onClose={onClose} />
    : <FloatingToast toast={toast} onClose={onClose} />
}

function LegacyToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(onClose, 3200)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const Icon = isSuccess ? FiCheckCircle : FiAlertTriangle

  return createPortal(
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
      <div className="flex gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            isSuccess ? 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          <Icon size={17} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#111827] dark:text-zinc-100">
            {isSuccess ? 'Tudo certo' : 'Atenção'}
          </p>

          <p className="mt-0.5 text-sm text-[#6b7280] dark:text-zinc-400">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-gray-400 transition hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
          aria-label="Fechar aviso"
        >
          <FiX />
        </button>
      </div>
    </div>,
    document.body
  )
}

function StatCard({ icon: Icon, label, value, description, tone = 'green' }) {
  const tones = {
    green: 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300',
  }

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black text-[#111827] dark:text-zinc-100">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-[#6b7280] dark:text-zinc-500">
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
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-gray-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500">
        <Icon size={24} />
      </div>

      <h3 className="mt-4 text-base font-black text-[#111827] dark:text-zinc-100">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
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
    pricing.tone === 'success' && 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    pricing.tone === 'warning' && 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    pricing.tone === 'danger' && 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
    pricing.tone === 'neutral' && 'bg-gray-50 text-gray-600 ring-gray-100 dark:bg-white/[0.06] dark:text-zinc-400 dark:ring-zinc-700',
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
    pricing.tone === 'warning' && 'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
    pricing.tone === 'danger' && 'border-red-100 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200',
    pricing.tone === 'neutral' && 'border-gray-100 bg-gray-50 text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {pricing.message}
    </div>
  )
}

function OrderContactTimeline({ order, now = new Date() }) {
  const status = normalizeStatus(order.status)
  const statusIndex = STATUS_FLOW.indexOf(status)
  const nextStatus = getNextStatus(status, order)
  const currentMeta = STATUS_META[status] || STATUS_META.pendente
  const whatsappSent = Boolean(
    order?.customerLastNotifiedAt ||
      order?.customerConfirmationMessageSentAt ||
      order?.storeThankedCustomerAt ||
      order?.customerLastNotifiedStatus
  )
  const scheduled = isScheduledOrder(order)
  const scheduledState = scheduled ? getScheduledOperationalState(order, { now }) : 'asap'
  const scheduledLabel = scheduled ? formatScheduledOperationalLabel(order, { now }) : ''
  const scheduledDistance = scheduled ? getScheduledTimeDistance(order, now) : null
  const operationText =
    scheduledState === 'scheduled_future'
      ? `Agendamento confirmado${scheduledDistance?.label ? ` · ${scheduledDistance.label}` : ''}`
      : scheduledState === 'scheduled_due_soon'
        ? 'Preparar em breve'
        : scheduledState === 'scheduled_late'
          ? 'Horário passou'
          : scheduledLabel || currentMeta.label
  const steps = [
    { key: 'pendente', label: 'Pendente', done: statusIndex >= STATUS_FLOW.indexOf('pendente'), current: status === 'pendente' },
    { key: 'confirmado', label: 'Confirmado', done: statusIndex >= STATUS_FLOW.indexOf('confirmado'), current: status === 'confirmado' },
    { key: 'preparando', label: 'Preparo', done: statusIndex >= STATUS_FLOW.indexOf('preparando'), current: status === 'preparando' },
    { key: 'pronto', label: 'Pronto', done: statusIndex >= STATUS_FLOW.indexOf('pronto'), current: status === 'pronto' },
    { key: 'em_rota', label: 'Em rota', done: statusIndex >= STATUS_FLOW.indexOf('em_rota'), current: status === 'em_rota' },
    {
      key: status === 'cancelado' ? 'cancelado' : 'entregue',
      label: status === 'cancelado' ? 'Cancelado' : 'Entregue',
      done: ['entregue', 'cancelado'].includes(status),
      current: ['entregue', 'cancelado'].includes(status),
    },
  ]

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">Status</p>
          <p className="mt-0.5 truncate text-xs font-black text-gray-900 dark:text-zinc-100">{currentMeta.label}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">Cliente</p>
          <p className={`mt-0.5 truncate text-xs font-black ${
            whatsappSent
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            {whatsappSent ? 'Avisado' : 'WhatsApp pendente'}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">Etapa</p>
          <p className="mt-0.5 truncate text-xs font-black text-gray-900 dark:text-zinc-100">{operationText}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-zinc-500">Próximo passo</p>
          <p className="mt-0.5 truncate text-xs font-black text-gray-900 dark:text-zinc-100">
            {nextStatus ? getNextStatusLabel(status, order) : 'Sem ação'}
          </p>
        </div>
      </div>

      <div className="pratoby-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={`flex min-w-[92px] items-center gap-2 rounded-xl border px-2.5 py-2 ${
              step.current
                ? 'border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10'
                : step.done
                  ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10'
                  : 'border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-white/[0.04]'
            }`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ring-1 ${
                step.done
                  ? status === 'cancelado' && step.key === 'cancelado'
                    ? 'bg-red-500 text-white ring-red-500'
                    : 'bg-emerald-500 text-white ring-emerald-500'
                  : step.current
                    ? 'bg-orange-500 text-white ring-orange-500'
                    : 'bg-gray-100 text-gray-400 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700'
              }`}>
              {step.done ? <FiCheckCircle size={11} /> : index + 1}
            </span>
            <p className={`truncate text-[10px] font-black ${
              step.current
                ? 'text-orange-600 dark:text-orange-300'
                : step.done
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-400 dark:text-zinc-500'
            }`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}


function OrderCard({ order, now, onOpen, onQuickStatus, onOpenWhatsApp, onCopyOrder, updatingStatus, isNew, isLatestNew }) {
  const status = normalizeStatus(order.status)
  const meta = STATUS_META[status] || STATUS_META.pendente
  const nextStatus = getNextStatus(status, order)
  const address = getAddress(order)
  const sla = getOrderSlaState(order, now)
  const isOverdue = sla.overdue
  const promotionSavings = getOrderPromotionSavings(order)
  const discount = getOrderDiscount(order)
  const cancellationReason = getCancellationReason(order)
  const customerName = getCustomerName(order)
  const phone = getCustomerPhone(order)
  const canOpenWhatsApp = hasValidOrderWhatsAppPhone(order)
  const savings = promotionSavings + discount

  const isFinalStatus = status === 'entregue' || status === 'cancelado'
  const isUpdatingThisOrder = updatingStatus === order.id
  const customerInitials = customerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CL'

  const customerPhone = phone ? formatBrazilianPhone(phone) : ''
  const neighborhood = address?.neighborhood || ''
  const itemSummary =
    order.itemsSummary ||
    order.items
      ?.slice(0, 2)
      ?.map((item) => `${item.quantity || item.qty || 1}x ${item.name}`)
      ?.join(', ') ||
    'Sem itens'

  const itemCount = Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0)
    : 0

  const isFinished = isFinalStatus
  const isCancelled = status === 'cancelado'
  const isLatest = Boolean(isLatestNew)
  const hasWhatsApp = Boolean(canOpenWhatsApp)

  const orderCode =
    order.shortCode ||
    order.displayId ||
    order.orderNumber ||
    order.code ||
    order.id?.slice(-4)?.toUpperCase() ||
    '----'

const paymentMethod =
  order.payment?.methodLabel ||
  order.payment?.method ||
  order.paymentMethod ||
  'Pagamento'

const normalizedPaymentMethod = String(paymentMethod || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_')

const paymentMethodLabelMap = {
  pix_manual: 'Pix manual',
  pix: 'Pix',
  asaas_online: 'Asaas online',
  cash: 'Dinheiro',
  money: 'Dinheiro',
  dinheiro: 'Dinheiro',
  cash_on_delivery: 'Dinheiro na entrega',
  dinheiro_na_entrega: 'Dinheiro na entrega',
  card_on_delivery: 'Cartao na entrega',
  cartao_na_entrega: 'Cartao na entrega',
  credit_card: 'Cartao de credito',
  debit_card: 'Cartao de debito',
  credito: 'Cartao de credito',
  debito: 'Cartao de debito',
  cartao_de_credito: 'Cartao de credito',
  cartao_de_debito: 'Cartao de debito',
}

const paymentMethodLabel =
  paymentMethodLabelMap[normalizedPaymentMethod] ||
  (normalizedPaymentMethod.includes('pix')
    ? 'Pix'
    : normalizedPaymentMethod.includes('asaas')
      ? 'Asaas online'
    : normalizedPaymentMethod.includes('cash') ||
        normalizedPaymentMethod.includes('money') ||
        normalizedPaymentMethod.includes('dinheiro')
      ? 'Dinheiro'
      : normalizedPaymentMethod.includes('card') ||
          normalizedPaymentMethod.includes('cartao') ||
          normalizedPaymentMethod.includes('credit') ||
          normalizedPaymentMethod.includes('debit')
        ? 'Cartao'
        : paymentMethod)

const PaymentMethodIcon =
  normalizedPaymentMethod.includes('pix')
    ? FiZap
    : normalizedPaymentMethod.includes('asaas')
      ? FiCreditCard
    : normalizedPaymentMethod.includes('cash') ||
        normalizedPaymentMethod.includes('money') ||
        normalizedPaymentMethod.includes('dinheiro')
      ? FiDollarSign
      : normalizedPaymentMethod.includes('card') ||
          normalizedPaymentMethod.includes('cartao') ||
          normalizedPaymentMethod.includes('credit') ||
          normalizedPaymentMethod.includes('debit')
        ? FiCreditCard
        : FiDollarSign

  const paymentStatusLabel =
    order.paymentStatusLabel ||
    order.payment?.statusLabel ||
    (order.paymentStatus === 'paid' || order.payment?.status === 'paid'
      ? 'Valor validado'
      : 'Pagamento pendente')

  const isPaymentValidated =
  paymentStatusLabel === 'Valor validado' ||
  order.paymentStatus === 'paid' ||
  order.payment?.status === 'paid'

  const isPayOnDelivery =
  normalizedPaymentMethod.includes('delivery') ||
  normalizedPaymentMethod.includes('entrega') ||
  normalizedPaymentMethod.includes('cash') ||
  normalizedPaymentMethod.includes('money') ||
  normalizedPaymentMethod.includes('dinheiro') ||
  normalizedPaymentMethod.includes('card') ||
  normalizedPaymentMethod.includes('cartao')

  const paymentNeedsAttention = !isPaymentValidated && !isPayOnDelivery

  const totalLabel = formatMoney(getOrderTotal(order))

  const savingsValue = Number(order.savingsAmount || order.savings || savings || 0)

  const savingsLabel = savingsValue > 0 ? formatMoney(savingsValue) : null
  const scheduled = isScheduledOrder(order)
  const scheduledState = scheduled ? getScheduledOperationalState(order, { now }) : 'asap'
  const scheduledDateLabel = scheduled ? formatScheduledDate(order) : ''
  const scheduledDistance = scheduled ? getScheduledTimeDistance(order, now) : null
  const scheduledBadge = scheduled ? formatScheduledBadge(order, now) : null
  const scheduledOperationalLabel = scheduled ? formatScheduledOperationalLabel(order, { now }) : ''
  const hasCustomScheduledProducts = Array.isArray(order.schedulingSnapshot?.requiredByProducts) &&
    order.schedulingSnapshot.requiredByProducts.length > 0
  const requiresScheduledPix = order.paymentPolicy === 'pix_required' ||
    order.schedulingSnapshot?.prepaymentPolicy === 'pix_required'
  const scheduledHistoricalLabel = scheduled && isFinalStatus
    ? isCancelled
      ? 'Cancelado no histórico'
      : 'Finalizado no histórico'
    : ''
  const scheduledDistanceLabel = scheduled && !isFinalStatus ? scheduledDistance?.label : ''

  const createdDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now())
  const dateLabel = createdDate.toLocaleDateString('pt-BR')
  const timeLabel = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const relativeTimeLabel = formatDistanceToNow(createdDate)

  const rawOrderType = String(
  order.orderType ||
  order.deliveryType ||
  order.fulfillmentType ||
  order.type ||
  ''
).toLowerCase()

const isCounter = order.channel === 'counter' || order.orderType === 'counter' || order.isCounterOrder === true

const orderTypeLabel =
  isCounter
    ? 'Balcão'
    : order.fulfillmentTypeLabel ||
      order.deliveryTypeLabel ||
      (['delivery', 'entrega'].includes(rawOrderType)
        ? 'Entrega'
        : ['pickup', 'retirada', 'takeout', 'balcao', 'balcão'].includes(rawOrderType)
          ? 'Retirada'
          : ['local', 'dine_in', 'mesa'].includes(rawOrderType)
            ? 'No local'
            : isDeliveryOrder(order)
              ? 'Entrega'
              : 'Retirada')

const OrderTypeIcon = orderTypeLabel === 'Entrega'
  ? FiTruck
  : orderTypeLabel === 'No local'
    ? FiHome
    : FiShoppingBag

const statusMetaMap = {
  pendente: {
    label: 'Pendente',
    tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    summary: 'Aguardando confirmação',
  },
  confirmado: {
    label: 'Confirmado',
    tone: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    dot: 'bg-sky-400',
    summary: 'Pedido confirmado',
  },
  preparando: {
    label: 'Preparando',
    tone: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    dot: 'bg-violet-400',
    summary: 'Em preparo pela cozinha',
  },
  pronto: {
    label: 'Pronto',
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    summary: orderTypeLabel === 'Entrega' ? 'Pronto para despacho' : 'Pronto para retirada',
  },
  em_rota: {
    label: 'Em rota',
    tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
    summary: 'Saiu para entrega',
  },
  entregue: {
    label: 'Concluído',
    tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    summary: 'Pedido finalizado',
  },
  cancelado: {
    label: 'Cancelado',
    tone: 'border-red-500/20 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    summary: 'Pedido cancelado',
  },
  canceled: {
    label: 'Cancelado',
    tone: 'border-red-500/20 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    summary: 'Pedido cancelado',
  },
}

const statusMeta = statusMetaMap[status] || {
  label: order.status || 'Status',
  tone: 'border-gray-100 bg-white text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300',
  dot: 'bg-zinc-400',
  summary: 'Status do pedido',
}

const scheduledNotice =
  scheduledState === 'scheduled_future'
    ? ''
    : scheduledState === 'scheduled_due_soon'
      ? 'Está na hora de se preparar para este pedido.'
      : scheduledState === 'scheduled_late'
        ? 'O horário agendado já passou.'
        : ''

const scheduledNoticeTone =
  scheduledState === 'scheduled_late'
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : scheduledState === 'scheduled_due_soon'
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      : 'border-orange-100 bg-orange-50 text-[#9a3412] dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200'

  return (
  <motion.article
    layout
    whileHover={{ y: -2 }}
    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    className={`group relative overflow-hidden rounded-[1.6rem] border transition-all duration-200 ${
      isOverdue
        ? 'border-red-400 bg-red-50/40 ring-2 ring-red-500/40 shadow-lg shadow-red-200/50 dark:border-red-500/60 dark:bg-red-500/[0.08] dark:ring-red-500/30 dark:shadow-red-950/30'
        : isFinished
        ? 'border-gray-100 bg-white/75 opacity-80 hover:opacity-95 dark:border-white/6 dark:bg-[#0d0d11]/85'
        : 'border-gray-100 bg-white dark:border-white/10 dark:bg-[#101015]'
    } ${
      isLatest && !isOverdue
        ? 'ring-1 ring-orange-400/60 shadow-[0_0_0_1px_rgba(249,115,22,0.12),0_18px_40px_-24px_rgba(249,115,22,0.5)] dark:ring-orange-500/50'
        : 'shadow-sm shadow-gray-200/50 dark:shadow-black/20'
    }`}
  >
    <div
      className={`absolute inset-y-0 left-0 w-1 ${
        isOverdue
          ? 'bg-gradient-to-b from-red-500 to-red-700'
          : isCancelled
          ? 'bg-gradient-to-b from-red-500 to-red-600'
          : isFinished
            ? 'bg-gradient-to-b from-orange-400 to-orange-500'
            : 'bg-gradient-to-b from-[#fb923c] via-[#f97316] to-[#ea580c]'
      }`}
    />

    <div className="grid gap-4 px-5 py-4 xl:grid-cols-[84px_minmax(0,2.2fr)_1.1fr_0.95fr_0.95fr_auto] xl:items-center">
      {/* Coluna 1: ID */}
      <div className="flex flex-col justify-center">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
          Pedido
        </span>
        <span className="mt-1 text-[1rem] font-black text-[#111827] dark:text-zinc-100">
          #{orderCode}
        </span>
      </div>

      {/* Coluna 2: cliente + itens + infos */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta.dot} shadow-[0_0_0_4px_rgba(255,255,255,0.04)]`} />
            <h3 className="truncate text-[15px] font-extrabold text-[#111827] dark:text-zinc-100">
              {customerName}
            </h3>
          </div>

          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${statusMeta.tone}`}
          >
            {statusMeta.label}
          </span>

          {scheduled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-[#f97316] dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
              <FiCalendar size={11} />
              {scheduledBadge || 'Agendado'}
            </span>
          )}

          {isOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-600 bg-red-600 px-2.5 py-1 text-[11px] font-black text-white shadow-sm shadow-red-500/20">
              <FiAlertTriangle size={11} className="animate-pulse" />
              Atrasado {sla.overdueMinutes}min
            </span>
          )}

          {isLatest && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-[#f97316] shadow-sm shadow-orange-500/10 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
              <FiZap size={11} />
              Último pedido
            </span>
          )}

          {isCounter && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
              <FiShoppingBag size={11} />
              Balcão
            </span>
          )}

          <span className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-white text-gray-700 px-2.5 py-1 text-[11px] font-black dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-300">
            <OrderTypeIcon size={11} />
            {orderTypeLabel}
          </span>
        </div>

        {paymentNeedsAttention && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:text-amber-300">
            <FiAlertTriangle size={11} />
            {paymentStatusLabel || 'Pagamento pendente'}
          </span>
        )}

        {scheduled && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[12px] font-black text-[#9a3412] dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200">
              <FiCalendar size={12} />
              {scheduledDateLabel}
            </span>
            {!isFinalStatus && scheduledDistance && scheduledDistance.minutes <= 60 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-black text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <FiClock size={12} />
                {scheduledDistance.label}
              </span>
            )}
            {requiresScheduledPix && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-black ${
                isPaymentValidated
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
              }`}>
                <FiCreditCard size={12} />
                {isPaymentValidated ? 'Pix confirmado' : 'Aguardando confirmação do Pix'}
              </span>
            )}
          </div>
        )}

        {scheduled && scheduledNotice && (
          <p className={`mt-2 rounded-2xl border px-3 py-2 text-xs font-bold ${scheduledNoticeTone}`}>
            {scheduledNotice}
          </p>
        )}

        <p className="mt-2 truncate text-[14px] font-semibold text-gray-700 dark:text-zinc-300">
          {itemSummary}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-gray-500 dark:text-zinc-500">
          {itemCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <FiShoppingBag size={12} />
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
          )}

          {customerPhone && (
            <span className="inline-flex items-center gap-1.5">
              <FiPhone size={12} />
              {customerPhone}
            </span>
          )}

          {neighborhood && (
            <span className="inline-flex items-center gap-1.5">
              <FiMapPin size={12} />
              {neighborhood}
            </span>
          )}
        </div>
      </div>

      {/* Coluna 3: status/resumo */}
      <div className="min-w-0">
        <div className={`rounded-2xl border px-4 py-3 ${
          isOverdue
            ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
            : 'border-gray-100 bg-white dark:border-white/6 dark:bg-white/[0.03]'
        }`}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
            Situação
          </p>
          <p className="mt-1 text-[14px] font-extrabold text-[#111827] dark:text-zinc-100">
            {statusMeta.summary}
          </p>
          <p className={`mt-1 text-[12px] font-bold ${
            isOverdue ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-zinc-500'
          }`}>
            {sla.active
              ? isOverdue
                ? `${sla.elapsedMinutes}min nesta etapa · limite ${sla.thresholdMinutes}min`
                : `${sla.elapsedMinutes}min nesta etapa · alerta em ${sla.remainingMinutes}min`
              : isFinished
                ? 'Concluido no historico'
                : 'Acompanhe a proxima etapa'}
          </p>
        </div>
      </div>

      {/* Coluna 4: total */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
          Total
        </p>
        <p className="mt-1 text-[1.55rem] font-black leading-none text-[#111827] dark:text-zinc-100">
          {totalLabel}
        </p>
        <div className="mt-2 space-y-1">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 dark:text-zinc-300">
            <PaymentMethodIcon size={13} />
            {paymentMethodLabel}
          </p>
          {savingsLabel && (
            <p className="text-[12px] font-black text-orange-400">
              Economia {savingsLabel}
            </p>
          )}
        </div>
      </div>

      {/* Coluna 5: data/hora */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
          {scheduled ? 'Agendado' : 'Horário'}
        </p>
        <p className="mt-1 text-[14px] font-extrabold text-[#111827] dark:text-zinc-100">
          {scheduled && scheduledDateLabel ? scheduledDateLabel.replace('Agendado para ', '') : `${dateLabel}, ${timeLabel}`}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500 dark:text-zinc-500">
          <FiClock size={12} />
          {scheduled ? (scheduledHistoricalLabel || scheduledDistanceLabel || scheduledOperationalLabel || 'Agendado') : (relativeTimeLabel || 'Agora há pouco')}
        </p>
      </div>

      {/* Coluna 6: ações */}
      <div className="grid gap-2 sm:flex sm:items-center xl:justify-end">
        <button
          type="button"
          onClick={() => onOpen(order)}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 px-4 text-[13px] font-black text-[#111827] transition hover:bg-gray-100 dark:border-white/8 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.09] sm:flex-none"
        >
          Abrir
        </button>

        {hasWhatsApp && (
          <button
            type="button"
            onClick={() => onOpenWhatsApp(order)}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/15 sm:w-11"
            aria-label="Abrir WhatsApp"
            title="Abrir WhatsApp"
          >
            <FiMessageCircle size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => onCopyOrder(order)}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-gray-100 bg-white px-3 text-[13px] font-black text-gray-500 transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-orange-500/10 sm:w-11"
          aria-label="Copiar resumo do pedido"
          title="Copiar resumo do pedido"
        >
          <FiCopy size={15} />
        </button>
      </div>
    </div>
  </motion.article>
)
}

function OrderItemsList({ items }) {
  if (!items.length) {
    return (
      <p className="mt-3 text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
        Itens não disponíveis.
      </p>
    )
  }

  return (
    <div className="mt-4 divide-y divide-gray-100 dark:divide-zinc-800">
      {items.map((item, index) => {
        const optionGroups = getItemDisplayOptionGroups(item)
        const additionals = getItemAdditionals(item)
        const promo = getPromotionInfo(item)

        return (
          <div
            key={`${item.cartItemId || item.id || getItemName(item)}-${index}`}
            className="flex gap-3 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-black text-[#f97316] dark:bg-orange-500/10">
              {getItemQty(item)}x
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#111827] dark:text-zinc-100">
                {getItemName(item)}
              </p>

              {promo.active && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    Promoção
                  </span>

                  {promo.oldPrice > promo.currentPrice && (
                    <>
                      <span className="text-xs font-bold text-gray-400 line-through dark:text-zinc-500">
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
                <div className="mt-3 rounded-2xl bg-gray-50 p-3 dark:bg-zinc-950/60">
                  {optionGroups.map((group) => (
                    <div key={group.id} className="mb-3 last:mb-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                        {group.name}
                      </p>

                      <div className="mt-2 space-y-1">
                        {group.options.map((option) => (
                          <div
                            key={`${group.id}-${option.id}`}
                            className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-zinc-300"
                          >
                            <span>
                              {option.quantity > 1 ? `${option.quantity}x ` : ''}
                              {option.name}
                            </span>

                            {option.totalCents > 0 && (
                              <span className="font-bold text-gray-900 dark:text-zinc-100">
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
                        className="text-xs leading-5 text-[#6b7280] dark:text-zinc-400"
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
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  Obs: {item.observation || item.itemObservation || item.notes}
                </p>
              )}
            </div>

            <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
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
    <div className="space-y-3 text-sm">
      {promotionSavings > 0 ? (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280] dark:text-zinc-400">Itens sem promoção</span>
            <span className="font-bold text-[#111827] dark:text-zinc-100">
              {formatMoney(subtotalWithoutPromotions)}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280] dark:text-zinc-400">Economia em promoções</span>
            <span className="font-bold text-red-600 dark:text-red-300">
              -{formatMoney(promotionSavings)}
            </span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#6b7280] dark:text-zinc-400">Subtotal com promoções</span>
            <span className="font-bold text-[#111827] dark:text-zinc-100">
              {formatMoney(subtotal)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280] dark:text-zinc-400">Subtotal</span>
          <span className="font-bold text-[#111827] dark:text-zinc-100">
            {formatMoney(subtotal)}
          </span>
        </div>
      )}

      {order?.orderType === 'delivery' && (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280] dark:text-zinc-400">Entrega</span>
          <span className="font-bold text-[#111827] dark:text-zinc-100">
            {formatMoney(deliveryFee)}
          </span>
        </div>
      )}

      {discount > 0 && (
        <div className="flex justify-between gap-3">
          <span className="text-[#6b7280] dark:text-zinc-400">
            Cupom {order?.couponCode ? `(${order.couponCode})` : ''}
          </span>

          <span className="font-bold text-red-600 dark:text-red-300">
            -{formatMoney(discount)}
          </span>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 dark:border-white/10">
        <div className="flex justify-between gap-3">
          <span className="font-black text-[#111827] dark:text-zinc-100">Total</span>
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
  now,
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
  const sla = getOrderSlaState(order, now)
  const meta = STATUS_META[status] || STATUS_META.pendente
  const address = getAddress(order)
  const items = getOrderItems(order)
  const nextStatus = getNextStatus(status, order)
  const changeForLabel = getChangeForLabel(order)

  const paymentBlocked = shouldBlockPreparationUntilPayment(order)
  const pixPending = isPixPaymentPending(order)
  const pixPaid = isPixManualOrder(order) && isPaymentPaid(order)
  const asaasOnline = isAsaasOnlineOrder(order)
  const asaasPending = isAsaasPaymentPending(order)
  const asaasPaymentUrl = getAsaasPaymentUrl(order)
  const paymentProofUrl = getPaymentProofUrl(order)

  const currentIndex = STATUS_FLOW.indexOf(status)
  const isFinalStatus = status === 'entregue' || status === 'cancelado'
  const showCustomerThanksAction = shouldShowCustomerThanksAction(order)
  const cancellationReason = getCancellationReason(order)
  const canOpenWhatsApp = hasValidOrderWhatsAppPhone(order)
  const scheduled = isScheduledOrder(order)
  const scheduledState = scheduled ? getScheduledOperationalState(order, { now }) : 'asap'
  const scheduledDateLabel = scheduled ? formatScheduledDate(order) : ''
  const scheduledOperationalLabel = scheduled ? formatScheduledOperationalLabel(order, { now }) : ''
  const scheduledDistance = scheduled ? getScheduledTimeDistance(order, now) : null
  const scheduledProducts = Array.isArray(order.schedulingSnapshot?.requiredByProducts)
    ? order.schedulingSnapshot.requiredByProducts
    : []
  const hasCustomScheduledProducts = scheduledProducts.length > 0
  const requiresScheduledPix = order.paymentPolicy === 'pix_required' ||
    order.schedulingSnapshot?.prepaymentPolicy === 'pix_required'
  const scheduledHistoricalLabel = scheduled && isFinalStatus
    ? status === 'cancelado'
      ? 'Cancelado no histórico'
      : 'Finalizado no histórico'
    : ''
  const scheduledDistanceLabel = scheduled && !isFinalStatus ? scheduledDistance?.label : ''
  const canRunPrimaryStatusAction = Boolean(nextStatus) &&
    !(scheduledState === 'scheduled_future' && nextStatus === 'preparando')
  const isWaitingScheduledFuture = scheduledState === 'scheduled_future' && nextStatus === 'preparando'

  const scheduledTypeLabel = address.isPickup ? 'Retirada agendada' : 'Entrega agendada'
  const scheduledTitle = hasCustomScheduledProducts ? 'Encomenda agendada' : 'Pedido agendado'
  const scheduledMessage =
    scheduledHistoricalLabel
      ? 'Este pedido já saiu da operação ativa. Mantemos o horário agendado apenas para histórico.'
      : scheduledState === 'scheduled_future'
        ? 'Este pedido está reservado para uma data futura.'
        : scheduledState === 'scheduled_due_soon'
          ? 'Está na hora de se preparar para este pedido.'
          : scheduledState === 'scheduled_late'
            ? 'O horário agendado já passou.'
            : 'Acompanhe o agendamento deste pedido.'
  const scheduledPanelClass =
    scheduledState === 'scheduled_late'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
      : scheduledState === 'scheduled_due_soon'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
        : 'border-orange-100 bg-orange-50 text-orange-900 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100'

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 640
  })
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

    const variants = isMobile ? {
    initial: { y: '100%', opacity: 1 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 1 },
    transition: { type: 'spring', damping: 30, stiffness: 320 }
  } : {
    initial: { opacity: 0, scale: 0.96, y: 18 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 14 },
    transition: { type: 'spring', stiffness: 360, damping: 34, mass: 0.85 }
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4 sm:backdrop-blur-md"
    >
      <motion.div
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={variants.transition}
        className="flex h-[96dvh] max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:border-white/10 dark:bg-[#0f0f11] dark:shadow-black/60 dark:ring-white/[0.03] sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:rounded-3xl"
      >
        <header className="animate-fade-in shrink-0 border-b border-gray-100 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#111114]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-zinc-50">
                  Pedido {getOrderDisplayNumber(order)}
                </h2>
                <StatusBadge status={order.status} />
                {sla.overdue && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-red-700">
                    <FiAlertTriangle size={12} className="animate-pulse" />
                    Etapa atrasada
                  </span>
                )}
                {scheduled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900">
                    <FiCalendar size={12} />
                    {scheduledOperationalLabel || 'Agendado'}
                  </span>
                )}
                <PricingValidationBadge order={order} />
                {status === 'cancelado' && cancellationReason && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-900">
                    <FiAlertTriangle size={12} />
                    Motivo registrado
                  </span>
                )}
                {pixPending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    <FiCreditCard size={12} />
                    Pix pendente
                  </span>
                )}
                {asaasPending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    <FiCreditCard size={12} />
                    Asaas pendente
                  </span>
                )}
                {showCustomerThanksAction && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-200 dark:bg-green-950/50 dark:text-green-400 dark:ring-green-900">
                    <FiMessageCircle size={12} />
                    Cliente confirmou
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-500">
                {formatDate(order)} · {store?.name || 'Loja'} · {items.length} item{items.length === 1 ? '' : 's'}
              </p>
            </div>
            <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15">
              <FiX size={18} />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-white/10 dark:bg-[#151518]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: financial pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-2xl bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                Total: {formatMoney(getOrderTotal(order))}
              </span>
              <span className="rounded-2xl bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                {getPaymentMethod(order)}
              </span>
              <span className={`rounded-2xl px-3 py-1.5 text-sm font-bold ${ (pixPaid || (asaasOnline && isPaymentPaid(order))) ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' : (pixPending || asaasPending) ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400' }`}>
                {getPaymentStatus(order)}
              </span>
            </div>
            {/* Right: action buttons */}
              <div className="flex items-center gap-3">
                {canOpenWhatsApp && (
                  <button
                    onClick={() => onOpenWhatsApp(order)}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiMessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                    WhatsApp
                  </button>
                )}

                {pixPending ? (
                  <button
                    onClick={() => onConfirmPixPayment(order)}
                    disabled={Boolean(updatingStatus)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-100 transition-all hover:bg-teal-700 active:scale-[0.98] dark:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCheckCircle size={18} className={updatingStatus === order.id ? "animate-spin" : ""} />
                    {updatingStatus === order.id ? 'Confirmando...' : 'Confirmar Pix'}
                  </button>
                ) : asaasPending && asaasPaymentUrl ? (
                  <a
                    href={asaasPaymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-700 active:scale-[0.98]"
                  >
                    <FiCreditCard size={18} />
                    Abrir pagamento
                  </a>
                ) : isWaitingScheduledFuture ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200">
                    <FiClock size={18} />
                    <span>Agendamento confirmado</span>
                  </div>
                ) : nextStatus ? (
                  <button
                    onClick={() => canRunPrimaryStatusAction ? onUpdateStatus(order, nextStatus) : null}
                    disabled={Boolean(updatingStatus) || !canRunPrimaryStatusAction}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] dark:shadow-none disabled:opacity-60 animate-pulse-slow"
                  >
                    <FiZap size={18}/>
                    {updatingStatus === order.id ? 'Atualizando...' : updatingStatus ? 'Aguarde...' : getNextStatusLabel(status, order)}
                  </button>
                ) : null}

                <button
                  onClick={() => printComanda(order, store)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-900 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-900 hover:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:hover:text-white"
                >
                  <FiPrinter size={18}/> Comanda
                </button>
              </div>
          </div>
          {sla.overdue && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <FiAlertTriangle size={17} className="mt-0.5 shrink-0 animate-pulse" />
              <div>
                <p className="text-sm font-black">Este pedido ultrapassou o tempo esperado da etapa.</p>
                <p className="mt-0.5 text-xs font-bold">
                  {sla.elapsedMinutes}min nesta etapa · limite {sla.thresholdMinutes}min
                </p>
              </div>
            </div>
          )}
          <OrderContactTimeline order={order} now={now} />
          {showCustomerThanksAction && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <div>
                <p className="text-sm font-black text-green-800 dark:text-green-300">Cliente confirmou o recebimento</p>
                <p className="mt-0.5 text-xs font-semibold text-green-700 dark:text-green-400">Envie uma mensagem de agradecimento pelo WhatsApp.</p>
              </div>
              <button onClick={() => onSendCustomerThanks(order)} disabled={Boolean(updatingStatus)}
                className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-700">
                <FiMessageCircle size={14}/> Agradecer
              </button>
            </div>
          )}
        </div>

        <main className="pratoby-scrollbar flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-[#0b0b0d] sm:p-5">
          <div className="grid min-h-0 gap-4 xl:grid-cols-[320px_1fr_280px]">
            {/* Left Column: Customer & Delivery & Payment */}
            <div className="min-h-0 space-y-4">
              {/* Customer card */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      <FiUser className="text-orange-500" /> Cliente
                    </p>
                    <p className="mt-3 truncate text-base font-black text-gray-900 dark:text-zinc-100">
                      {getCustomerName(order)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-500 dark:text-zinc-400">
                      {formatDisplayPhone(getCustomerPhone(order)) || 'Telefone não informado'}
                    </p>
                  </div>
                  {canOpenWhatsApp && (
                    <button
                      onClick={() => onOpenWhatsApp(order)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600 transition hover:bg-green-100 dark:bg-green-950/50 dark:text-green-400 dark:hover:bg-green-900"
                      title="Chamar cliente no WhatsApp"
                      aria-label="Chamar cliente no WhatsApp"
                    >
                      <FiMessageCircle size={17} />
                    </button>
                  )}
                </div>
              </section>

              {/* Delivery card */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                    {address.isPickup ? (
                      <>
                        <FiShoppingBag size={14} className="text-orange-500" /> Retirada
                      </>
                    ) : (
                      <>
                        <FiTruck size={14} className="text-orange-500" /> Entrega
                      </>
                    )}
                  </p>

                  {!address.isPickup && (
                    <button
                      onClick={() => onOpenMaps(order)}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-500 transition hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900"
                    >
                      <FiNavigation size={12} /> Mapa
                    </button>
                  )}
                </div>

                <p className="mt-3 text-sm font-bold leading-6 text-gray-800 dark:text-zinc-200">
                  {address.full}
                </p>

                {(address.neighborhood || address.complement || address.reference) && (
                  <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
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

              {/* Order timing card */}
                <section className={`rounded-[1.35rem] border p-4 shadow-sm ring-1 ring-black/[0.02] ${
                  scheduled
                    ? scheduledPanelClass
                    : 'border-gray-100 bg-white dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                        scheduled
                          ? 'text-current opacity-80'
                          : 'text-gray-400 dark:text-zinc-500'
                      }`}>
                        <FiCalendar className={scheduled ? '' : 'text-orange-500'} />
                        Tipo do pedido
                      </p>

                      <p className={`mt-3 text-base font-black ${
                        scheduled
                          ? 'text-current'
                          : 'text-gray-900 dark:text-zinc-100'
                      }`}>
                        {scheduled ? scheduledTitle : 'Pedido imediato'}
                      </p>

                      <p className={`mt-1 text-sm font-bold leading-5 ${
                        scheduled
                          ? 'text-current opacity-90'
                          : 'text-gray-500 dark:text-zinc-400'
                      }`}>
                        {scheduled
                          ? scheduledDateLabel || order.scheduledTimeLabel || 'Horário agendado não informado'
                          : 'Entrou na operação assim que foi criado.'}
                      </p>
                    </div>

                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${
                      scheduled
                        ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                    }`}>
                      {scheduled ? 'Depois' : 'Agora'}
                    </span>
                  </div>

                  {scheduled ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-[11px] font-black ring-1 ring-black/5 dark:bg-black/10 dark:ring-white/10">
                          <FiClock size={12} />
                          {scheduledHistoricalLabel || scheduledOperationalLabel || 'Agendado'}
                        </span>

                        {scheduledDistanceLabel && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-[11px] font-black ring-1 ring-black/5 dark:bg-black/10 dark:ring-white/10">
                            <FiClock size={12} />
                            {scheduledDistanceLabel}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-[11px] font-black ring-1 ring-black/5 dark:bg-black/10 dark:ring-white/10">
                          {address.isPickup ? <FiShoppingBag size={12} /> : <FiTruck size={12} />}
                          {scheduledTypeLabel}
                        </span>

                        {requiresScheduledPix && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${
                            pixPaid
                              ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200'
                              : 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-200'
                          }`}>
                            <FiCreditCard size={12} />
                            {pixPaid ? 'Pix confirmado' : 'Pix antecipado'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold leading-5 text-current opacity-80">
                        {scheduledMessage}
                      </p>

                      {requiresScheduledPix && !pixPaid && (
                        <p className="rounded-xl bg-white/55 px-3 py-2 text-xs font-semibold leading-5 ring-1 ring-black/5 dark:bg-black/10 dark:ring-white/10">
                          Confira o comprovante antes de iniciar o preparo.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold leading-5 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400">
                      Para alterar um pedido imediato para agendado, o ideal é cancelar e refazer o pedido com data e horário escolhidos.
                    </p>
                  )}
                </section>

              {/* Observation card */}
              {(order?.orderObservation || order?.customerObservation || order?.observation) && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    <FiAlertTriangle className="text-amber-600" /> Observação
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-amber-800 dark:text-amber-300">
                    {order.orderObservation || order.customerObservation || order.observation}
                  </p>
                </section>
              )}



              {/* Payment details card */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                      <FiCreditCard className="text-orange-500" /> Meio de pagamento
                    </p>
                    <p className="mt-3 text-base font-black text-gray-900 dark:text-zinc-100">
                      {getPaymentMethod(order)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-zinc-400">
                      {getPaymentStatus(order)}
                    </p>
                    {changeForLabel && (
                      <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 dark:border-orange-950 dark:bg-orange-950/20">
                        <p className="text-xs font-black uppercase tracking-wide text-orange-700 dark:text-orange-400">
                          Troco
                        </p>
                        <p className="mt-0.5 text-sm font-black text-gray-800 dark:text-zinc-200">
                          {changeForLabel}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${ pixPaid || (asaasOnline && isPaymentPaid(order)) ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' : paymentBlocked ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : status === 'cancelado' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-gray-50 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400' }`}>
                    {status === 'cancelado' ? 'Cancelado' : isPixManualOrder(order) ? (pixPaid ? 'Pix pago' : 'Pix pendente') : asaasOnline ? (isPaymentPaid(order) ? 'Asaas pago' : 'Asaas pendente') : getPaymentMethod(order)}
                  </span>
                </div>
                {status === 'cancelado' && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-400">
                      <FiAlertTriangle /> Motivo do cancelamento
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-red-800 dark:text-red-300">
                      {cancellationReason || 'Motivo não informado.'}
                    </p>
                  </div>
                )}
              </section>

              {/* Pix Manual card */}
              {isPixManualOrder(order) && (
                <section className={`rounded-2xl border p-4 shadow-sm ${ pixPaid ? 'border-green-100 bg-green-50 dark:border-green-900 dark:bg-green-950/20' : 'border-orange-100 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20' }`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-xs font-black uppercase tracking-wider ${pixPaid ? 'text-green-800 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                      Pix manual
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${ pixPaid ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' }`}>
                      {pixPaid ? 'Pago' : 'Aguardando'}
                    </span>
                  </div>
                  {paymentProofUrl ? (
                    <a
                      href={paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-gray-800 shadow-sm transition hover:text-orange-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-orange-400"
                    >
                      <FiExternalLink /> Ver comprovante
                    </a>
                  ) : (
                    <p className="mt-2 text-xs font-semibold leading-5 text-orange-700 dark:text-orange-400">
                      Confirme o comprovante no contato do cliente.
                    </p>
                  )}
                </section>
              )}
            </div>

            {/* Middle Column: Items List */}
            <section className="flex min-h-[360px] flex-col rounded-[1.35rem] border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03] xl:min-h-0">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
                <p className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-zinc-100">
                  <FiShoppingBag className="text-orange-500" /> Itens do Pedido
                </p>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <OrderItemsList items={items} />
              </div>
            </section>

            {/* Right Column: Status & Resumo Financeiro & Forçar Alteração */}
            <aside className="min-h-0 space-y-4">
              {/* Status card */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                  <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                    Status atual
                  </p>
                </div>
                <p className="mt-3 text-xl font-black tracking-tight text-gray-900 dark:text-zinc-100">
                  {meta.label}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                  {paymentBlocked ? 'Aguardando confirmacao do pagamento.' : meta.description}
                </p>
              </section>

              {/* Resumo Financeiro */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Resumo financeiro
                </p>
                <FinancialSummary order={order} />
              </section>

              {/* Forçar alteração */}
              <section className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] dark:border-white/10 dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                    Forçar alteração
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-4 text-gray-400 dark:text-zinc-500">
                    Use somente para corrigir o fluxo do pedido.
                  </p>
                </div>
                {scheduled && scheduledState === 'scheduled_future' && (
                  <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold leading-5 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-200">
                    Este pedido ainda está fora da janela de preparo. O preparo será liberado no horário operacional.
                  </div>
                )}
                {scheduled && scheduledState === 'scheduled_late' && (
                  <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
                    O horário agendado passou. Inicie o preparo ou ajuste o status com atenção.
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {STATUS_FLOW.map((statusOption) => {
                    const optionMeta = STATUS_META[statusOption]
                    const Icon = optionMeta.icon
                    const active = status === statusOption
                    const optionIndex = STATUS_FLOW.indexOf(statusOption)
                    const isPreviousStatus = optionIndex < currentIndex
                    const blockedScheduledPrepare = scheduledState === 'scheduled_future' && statusOption === 'preparando'
                    const naturalScheduledPrepare = scheduledState === 'scheduled_due_soon' && statusOption === 'preparando'
                    const lateScheduledPrepare = scheduledState === 'scheduled_late' && statusOption === 'preparando'

                    return (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => onUpdateStatus(order, statusOption)}
                        disabled={
                          Boolean(updatingStatus) ||
                          (isFinalStatus && !active) ||
                          isPreviousStatus ||
                          blockedScheduledPrepare ||
                          (statusOption === 'preparando' && paymentBlocked)
                        }
                        title={blockedScheduledPrepare ? 'Aguarde a janela de preparo' : undefined}
                        className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? optionMeta.buttonClass
                            : blockedScheduledPrepare
                              ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200'
                              : lateScheduledPrepare
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
                                : naturalScheduledPrepare
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                                  : 'border-gray-100 bg-white text-[#6b7280] hover:bg-gray-50 hover:text-[#111827] dark:border-zinc-800 dark:bg-white/[0.06] dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{optionMeta.label}</span>
                        {blockedScheduledPrepare && (
                          <span className="text-[9px] font-black uppercase tracking-wide">Aguarde</span>
                        )}
                        {naturalScheduledPrepare && (
                          <span className="text-[9px] font-black uppercase tracking-wide">Fluxo normal</span>
                        )}
                        {lateScheduledPrepare && (
                          <span className="text-[9px] font-black uppercase tracking-wide">Atrasado</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            </aside>
          </div>
        </main>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default function OrdersPage() {
  const {
    user,
    userData,
    role,
    loading: authLoading,
    storeId: authStoreId,
    storeIds: authStoreIds = [],
  } = useAuth()

  const knownStoreIds = useMemo(() => {
    return uniqueArray([
      authStoreId,
      ...(Array.isArray(authStoreIds) ? authStoreIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ]).slice(0, 10)
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])

  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [timingFilter, setTimingFilter] = useState('now')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState('hoje')
  const [search, setSearch] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState('')
  const [storeActionLoading, setStoreActionLoading] = useState(false)
  const [slaNow, setSlaNow] = useState(() => Date.now())
  const [toast, setToast] = useState(null)
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())
  const [latestNewOrderId, setLatestNewOrderId] = useState('')
  const [counterOrderOpen, setCounterOrderOpen] = useState(false)
  const seenOrderIdsRef = useRef(new Set())
  const firstOrdersSnapshotRef = useRef(true)
  const newOrderTimersRef = useRef({})
  const moreFiltersRef = useRef(null)

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

  useEffect(() => {
    const interval = window.setInterval(() => setSlaNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!moreFiltersOpen) return undefined

    const handlePointerDown = (event) => {
      if (!moreFiltersRef.current?.contains(event.target)) {
        setMoreFiltersOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [moreFiltersOpen])

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
      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId: storeDocId,
        payload: {
          isOpen: nextStatus,
        },
      })
      showToast('success', nextStatus ? 'Loja aberta. Agora você já pode receber pedidos.' : 'Loja fechada. Novos pedidos ficarão pausados.')
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error)
      if (error?.details?.reason === 'active-orders') {
        setDateFilter('all')
        setStatusFilter('ativos')
      }
      showToast('error', getCallableErrorMessage(error, 'Erro ao atualizar o status da loja.'))
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
      showToast('error', 'Confirme o pagamento antes de iniciar o preparo.')
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

    let shouldNotifyCustomer = false
    let whatsappUrl = ''

    if (['preparando', 'em_rota', 'entregue', 'cancelado'].includes(nextStatus)) {
      const phone = normalizeBrazilianPhoneForWhatsApp(getCustomerPhone(order))

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
          shouldNotifyCustomer = true
          const orderWithNewStatus = {
            ...order,
            status: nextStatus,
            ...cancellationPatch,
          }

          const message = buildWhatsAppMessage(orderWithNewStatus, selectedStore)
          whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        }
      }
    }

    const pendingWhatsAppWindow = shouldNotifyCustomer && whatsappUrl
      ? window.open('about:blank', '_blank')
      : null

    if (pendingWhatsAppWindow) {
      pendingWhatsAppWindow.opener = null
    }

    try {
      setUpdatingStatus(order.id)

      const updateMerchantOrder = httpsCallable(functions, 'updateMerchantOrder')
      await updateMerchantOrder({
        orderId: order.id,
        action: 'updateStatus',
        status: nextStatus,
        cancellationReason: cancellationPatch.cancellationReason || undefined,
      })

      const statusLabel = STATUS_META[nextStatus]?.label || 'Atualizado'

      showToast('success', `Pedido atualizado para "${statusLabel}".`)

      if (shouldNotifyCustomer && whatsappUrl) {
        if (pendingWhatsAppWindow) {
          pendingWhatsAppWindow.location.href = whatsappUrl
        }

        const openedWindow = pendingWhatsAppWindow || window.open(whatsappUrl, '_blank', 'noopener,noreferrer')

        if (!openedWindow) {
          showToast(
            'error',
            'O navegador bloqueou o WhatsApp. Permita pop-ups para o PratoBy.'
          )
        } else {
          try {
            await updateMerchantOrder({
              orderId: order.id,
              action: 'markCustomerNotified',
              status: nextStatus,
            })
          } catch (notificationError) {
            console.warn('Pedido atualizado, mas o aviso ao cliente não foi marcado:', notificationError)
          }
        }
      }

      const shouldAutoPrintComanda =
        nextStatus === 'preparando' &&
        selectedStore?.settings?.printAfterConfirm !== false &&
        selectedStore?.printAfterConfirm !== false

      if (shouldAutoPrintComanda) {
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
      if (pendingWhatsAppWindow && !pendingWhatsAppWindow.closed) {
        pendingWhatsAppWindow.close()
      }
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
        'O PratoBy marcou este pedido para revisão de valor. Deseja confirmar o Pix e aceitar o pedido mesmo assim?'
      )

      if (!confirmedReview) return
    }

    const confirmed = window.confirm(
      'Confirmar pagamento Pix e aceitar o pedido?'
    )

    if (!confirmed) return

    const now = Timestamp.now()
    const currentStatus = normalizeStatus(order.status)
    const shouldConfirmOrder = currentStatus === 'pendente'

    try {
      setUpdatingStatus(order.id)

      const updateMerchantOrder = httpsCallable(functions, 'updateMerchantOrder')
      const nextOrder = {
        ...order,
        status: shouldConfirmOrder ? 'confirmado' : order.status,
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

      await updateMerchantOrder({
        orderId: order.id,
        action: 'confirmPixPayment',
      })

      showToast(
        'success',
        shouldConfirmOrder
          ? 'Pagamento confirmado e pedido aceito.'
          : 'Pagamento Pix confirmado.'
      )

      const phone = normalizeBrazilianPhoneForWhatsApp(getCustomerPhone(order))

      if (phone && shouldConfirmOrder) {
        const shouldNotify = window.confirm(
          'Deseja enviar a confirmação do pedido para o cliente?'
        )

        if (shouldNotify) {
          const message = buildWhatsAppMessage(nextOrder, selectedStore)

          window.open(
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
            '_blank',
            'noopener,noreferrer'
          )

          try {
            await updateMerchantOrder({
              orderId: order.id,
              action: 'markCustomerNotified',
              status: 'confirmado',
            })
          } catch (notificationError) {
            console.warn('Pix confirmado, mas o aviso ao cliente não foi marcado:', notificationError)
          }
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

    const phone = normalizeBrazilianPhoneForWhatsApp(getCustomerPhone(order))

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

      const updateMerchantOrder = httpsCallable(functions, 'updateMerchantOrder')
      await updateMerchantOrder({
        orderId: order.id,
        action: 'markCustomerThanked',
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
      const url = buildOrderWhatsAppUrl(order, {
        store: selectedStore,
        totalLabel: formatMoney(getOrderTotal(order)),
      })

      if (!url) {
        showToast('error', 'Este pedido não possui telefone válido.')
        return
      }

      window.open(url, '_blank', 'noopener,noreferrer')
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
      const text = buildOrderClipboardSummary(order, {
        addressLabel: [
          address.full,
          address.complement ? `Complemento: ${address.complement}` : '',
          address.reference ? `Referência: ${address.reference}` : '',
        ].filter(Boolean).join(' | '),
        deliveryTypeLabel: getOrderTypeLabel(order),
        notes: order?.notes || order?.observation || order?.customerNote || '',
        paymentLabel: getPaymentMethod(order),
        totalLabel: formatMoney(getOrderTotal(order)),
      })
    },
  )

  useEffect(() => {
    const uid = user?.uid

    if (!uid || !knownStoreIds.length) {
      setStores([])
      setLoadingStores(false)
      return undefined
    }

    setLoadingStores(true)

    const storesMap = new Map()
    const unsubscribers = []

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
          console.error('Erro ao carregar loja por ID:', error)
          publishStores()
        }
      )

      unsubscribers.push(unsubscribe)
    }

    knownStoreIds.forEach(subscribeToStoreDoc)

    if (!unsubscribers.length) {
      setStores([])
      setLoadingStores(false)
      return undefined
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [knownStoreIds, knownStoreIdsKey, user?.uid])

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
    firstOrdersSnapshotRef.current = true
    seenOrderIdsRef.current = new Set()
    setNewOrderIds(new Set())
    setLatestNewOrderId('')

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
      const docs = snapshot.docs.map((orderDoc) => ({
        ...orderDoc.data(),
        id: orderDoc.id,
        firestoreId: orderDoc.id,
      }))
      const incoming = firstOrdersSnapshotRef.current
        ? []
        : docs.filter((order) => !seenOrderIdsRef.current.has(order.id))

      docs.forEach((order) => {
        ordersMap.set(order.id, order)
      })
      firstOrdersSnapshotRef.current = false
      seenOrderIdsRef.current = new Set(docs.map((order) => order.id))

      if (incoming.length) {
        const newestIncoming = [...incoming].sort((a, b) => {
          const dateA = getOrderDate(a)?.getTime() || 0
          const dateB = getOrderDate(b)?.getTime() || 0
          return dateB - dateA
        })[0]

        setLatestNewOrderId(newestIncoming.id)
        setNewOrderIds((current) => new Set([...current, ...incoming.map((order) => order.id)]))

        incoming.forEach((order) => {
          clearTimeout(newOrderTimersRef.current[order.id])
          newOrderTimersRef.current[order.id] = window.setTimeout(() => {
            setNewOrderIds((current) => {
              const next = new Set(current)
              next.delete(order.id)
              return next
            })
          }, 9000)
        })
      }

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

    const dateRange = getDateFilterRange(dateFilter)

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
      const constraints = [
        collection(db, 'orders'),
        where('storeId', '==', key),
      ]

      if (dateRange.start) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(dateRange.start)))
      }

      if (dateRange.end) {
        constraints.push(where('createdAt', '<', Timestamp.fromDate(dateRange.end)))
      }

      constraints.push(orderBy('createdAt', 'desc'))

      if (dateRange.limitCount) {
        constraints.push(limit(dateRange.limitCount))
      }

      subscribeOrders(
        query(...constraints)
      )
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      Object.values(newOrderTimersRef.current).forEach((timer) => clearTimeout(timer))
      newOrderTimersRef.current = {}
    }
  }, [authLoading, canReadOrders, dateFilter, selectedStore, showToast])

  const statusCounts = useMemo(() => {
    const counts = {
      todos: orders.length,
      ativos: 0,
      atrasados: 0,
      pendente: 0,
      confirmado: 0,
      preparando: 0,
      pronto: 0,
      em_rota: 0,
      entregue: 0,
      cancelado: 0,
    }

    orders.forEach((order) => {
      const status = normalizeStatus(order.status)

      if (ACTIVE_STATUSES.includes(status)) {
        counts.ativos += 1
      }

      if (getOrderSlaState(order, slaNow).overdue) {
        counts.atrasados += 1
      }

      if (counts[status] !== undefined) {
        counts[status] += 1
      }
    })

    return counts
  }, [orders, slaNow])

  const moreFiltersActive = MORE_STATUS_FILTER_KEYS.has(statusFilter)
  const moreFiltersCount = MORE_STATUS_TABS.reduce(
    (total, tab) => total + (statusCounts[tab.key] || 0),
    0
  )

  const timingCounts = useMemo(() => {
    return orders.reduce((counts, order) => {
      counts.all += 1
      if (isScheduledOrder(order)) {
        if (isOrderInTimingFilter(order, 'scheduled', slaNow)) counts.scheduled += 1
        if (isOrderInTimingFilter(order, 'now', slaNow)) counts.now += 1
      } else {
        counts.now += 1
      }
      return counts
    }, { now: 0, scheduled: 0, all: 0 })
  }, [orders, slaNow])

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

    const overdueOrders = orders.filter((order) => getOrderSlaState(order, slaNow).overdue)

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
      overdueCount: overdueOrders.length,
    }
  }, [orders, slaNow])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()

    const result = orders.filter((order) => {
      const status = normalizeStatus(order.status)

      if (statusFilter === 'ativos') {
        if (!ACTIVE_STATUSES.includes(status)) return false
      } else if (statusFilter === 'atrasados') {
        if (!getOrderSlaState(order, slaNow).overdue) return false
      } else if (statusFilter !== 'todos' && status !== statusFilter) {
        return false
      }

      if (!isOrderInTimingFilter(order, timingFilter, slaNow)) {
        return false
      }

      if (!isOrderInDateFilter(order, dateFilter)) {
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

    if (timingFilter === 'scheduled') {
      return result.sort((a, b) => {
        const statusA = normalizeStatus(a.status)
        const statusB = normalizeStatus(b.status)

        const finalA = FINAL_STATUSES.includes(statusA)
        const finalB = FINAL_STATUSES.includes(statusB)

        if (finalA !== finalB) return finalA ? 1 : -1

        const stateA = getScheduledOperationalState(a, { now: slaNow })
        const stateB = getScheduledOperationalState(b, { now: slaNow })

        const priority = {
          scheduled_late: 0,
          scheduled_due_soon: 1,
          scheduled_future: 2,
          asap: 3,
          completed: 4,
          canceled: 5,
        }

        const priorityA = priority[stateA] ?? 9
        const priorityB = priority[stateB] ?? 9

        if (priorityA !== priorityB) return priorityA - priorityB

        const dateA =
          getScheduledDate(a)?.getTime() ??
          getOrderDate(a)?.getTime() ??
          Number.MAX_SAFE_INTEGER

        const dateB =
          getScheduledDate(b)?.getTime() ??
          getOrderDate(b)?.getTime() ??
          Number.MAX_SAFE_INTEGER

        return dateA - dateB
      })
    }

    return result
  }, [dateFilter, orders, search, slaNow, statusFilter, timingFilter])

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
                className="h-11 cursor-pointer rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-orange-500/10"
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
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm ring-1 ring-inset transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedStore?.isOpen
                    ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/30 dark:hover:bg-red-900/40'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/30 dark:hover:bg-emerald-900/40'
                }`}
              >
                {storeActionLoading ? (
                  <>
                    <FiLoader size={16} className="animate-spin" />
                    <span>Atualizando...</span>
                  </>
                ) : selectedStore?.isOpen ? (
                  <>
                    <FiPower size={16} />
                    <span>Fechar loja</span>
                  </>
                ) : (
                  <>
                    <FiPower size={16} />
                    <span>Abrir loja</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => showToast('success', 'Os pedidos já estão sincronizados em tempo real.')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold text-orange-700 shadow-sm transition-all hover:bg-orange-100 active:scale-95 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20"
            >
              {/* Indicador luminoso pulsante de "Live/Online" */}
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              <FiRefreshCw size={15} className="animate-pulse text-orange-600 dark:text-orange-400" />
              <span>Tempo real</span>
            </button>

            {selectedStore && canReadOrders && (
              <button
                type="button"
                id="counter-order-btn"
                onClick={() => setCounterOrderOpen(true)}
                className="group relative inline-flex h-11 items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg hover:shadow-indigo-600/30 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:from-indigo-500 dark:to-violet-500 dark:shadow-none dark:focus-visible:ring-offset-zinc-900"
              >
                {/* Camada invisível que ilumina o botão no hover (efeito premium) */}
                <span className="absolute inset-0 w-full h-full bg-white/0 transition-colors duration-200 group-hover:bg-white/10" />

                {/* O ícone agora dá um giro de 90° e cresce levemente no hover */}
                <FiPlusCircle
                  size={18}
                  className="relative transition-transform duration-300 ease-out group-hover:rotate-90 group-hover:scale-110 text-indigo-100"
                />

                <span className="relative flex items-center gap-2">
                  <span>Novo pedido</span>
                  {/* Tag interna identificando o canal - dá cara de sistema de caixa/PDV profissional */}
                </span>
              </button>
            )}
          </>
        }
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingStores ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-[1.5rem] bg-white dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : !selectedStore ? (
          <EmptyState
            icon={FiHome}
            title="Nenhuma loja vinculada"
            description="Nenhuma loja vinculada à sua conta. Conclua o onboarding ou fale com o suporte."
          />
        ) : !canReadOrders ? (
          <EmptyState
            icon={FiCreditCard}
            title="Configure a cobrança para acessar pedidos"
            description="Conclua a configuração de faturamento para liberar a operação da loja."
          />
        ) : (
          <>


            {summary.overdueCount > 0 && (
  <div className="mb-6 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-red-700 shadow-lg shadow-red-100/70 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200 dark:shadow-red-950/20">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
          <FiAlertTriangle className="animate-pulse" size={22} />
        </div>

        <div>
          <p className="text-sm font-black">
            {summary.overdueCount} pedido
            {summary.overdueCount > 1 ? 's' : ''} acima do tempo esperado
          </p>

          <p className="mt-1 text-xs font-bold leading-5 text-red-600 dark:text-red-300">
            Priorize as etapas atrasadas para manter a operação e o cliente atualizados.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStatusFilter('atrasados')}
        className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700"
      >
        Ver atrasados
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
                value={loading ? '...' : summary.overdueCount}
                description="Acima do limite por etapa"
                tone={summary.overdueCount > 0 ? 'red' : 'green'}
              />
            </div>

            <div className="mb-5 flex flex-col gap-4">
              <div className="rounded-[1.5rem] border border-orange-100 bg-white p-2 shadow-sm dark:border-orange-500/20 dark:bg-zinc-900">
                <div className="grid gap-2 sm:grid-cols-3">
                  {TIMING_FILTERS.map((filter) => {
                    const selected = timingFilter === filter.key
                    const count = timingCounts[filter.key] || 0
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setTimingFilter(filter.key)}
                        className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                          selected
                            ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/20'
                            : 'bg-orange-50/70 text-[#9a3412] hover:bg-orange-100 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {filter.key === 'scheduled' ? <FiCalendar size={15} /> : <FiClock size={15} />}
                          {filter.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                          selected ? 'bg-white/25 text-white' : 'bg-white text-[#f97316] dark:bg-white/[0.08]'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 1: Status Filters */}
              <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <div className="pratoby-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                    {MAIN_STATUS_TABS.map((tab) => {
                    const meta = tab.key === 'ativos'
                      ? { icon: FiZap, dotClass: 'bg-orange-500' }
                      : tab.key === 'atrasados'
                        ? { icon: FiAlertTriangle, dotClass: 'bg-red-500' }
                        : STATUS_META[tab.key]
                    const Icon = meta?.icon
                    const isSelected = statusFilter === tab.key
                    const hasItems = (statusCounts[tab.key] || 0) > 0

                    const iconColorClass = meta?.dotClass ? meta.dotClass.replace('bg-', 'text-') : 'text-gray-400 dark:text-zinc-500'

                    return (
                      <motion.button
                      layout
                      {...FILTER_BUTTON_MOTION}
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        className={`group inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
                          isSelected
                            ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/20 ring-1 ring-orange-500/50'
                            : 'bg-white text-gray-600 ring-1 ring-gray-100 hover:bg-gray-50 hover:text-gray-900 dark:bg-[#18181b] dark:text-zinc-400 dark:ring-white/5 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                        }`}
                      >
                        {Icon && (
                          <Icon
                            size={15}
                            className={`transition-transform duration-300 ${isSelected ? 'text-white/90 scale-110' : iconColorClass} ${isSelected ? '' : 'group-hover:scale-125'}`}
                          />
                        )}

                        {tab.label}

                        {hasItems && (
                          <span
                            className={`flex h-5 items-center justify-center rounded-full px-2 text-xs font-bold tracking-wide transition-colors ${
                              isSelected
                                ? 'bg-white/25 text-white'
                                : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-400'
                            }`}
                          >
                            {statusCounts[tab.key]}
                          </span>
                        )}
                      </motion.button>
                    )
                    })}
                  </div>

                  <div ref={moreFiltersRef} className="relative shrink-0">
                    <motion.button
                      layout
                      {...FILTER_BUTTON_MOTION}
                      type="button"
                      onClick={() => setMoreFiltersOpen((open) => !open)}
                      className={`group inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
                        moreFiltersActive
                          ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/20 ring-1 ring-orange-500/50'
                          : 'bg-white text-gray-600 ring-1 ring-gray-100 hover:bg-gray-50 hover:text-gray-900 dark:bg-[#18181b] dark:text-zinc-400 dark:ring-white/5 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                      }`}
                      aria-expanded={moreFiltersOpen}
                      aria-haspopup="menu"
                    >
                      <FiFilter
                        size={15}
                        className={`transition-transform duration-300 ${moreFiltersActive ? 'text-white/90 scale-110' : 'text-gray-400 group-hover:scale-125 dark:text-zinc-500'}`}
                      />
                      Mais filtros
                      {moreFiltersCount > 0 && (
                        <span
                          className={`flex h-5 items-center justify-center rounded-full px-2 text-xs font-bold tracking-wide transition-colors ${
                            moreFiltersActive
                              ? 'bg-white/25 text-white'
                              : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-400'
                          }`}
                        >
                          {moreFiltersCount}
                        </span>
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {moreFiltersOpen && (
                        <motion.div
                          variants={FILTER_DROPDOWN_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          style={{ transformOrigin: 'top right' }}
                          className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-gray-200/70 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
                          role="menu"
                        >
                          {MORE_STATUS_TABS.map((tab) => {
                            const meta = STATUS_META[tab.key]
                            const Icon = meta?.icon
                            const isSelected = statusFilter === tab.key
                            const count = statusCounts[tab.key] || 0

                            return (
                              <motion.button
                                variants={FILTER_DROPDOWN_ITEM_VARIANTS}
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                  setStatusFilter(tab.key)
                                  setMoreFiltersOpen(false)
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition ${
                                  isSelected
                                    ? 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                                }`}
                                role="menuitem"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  {Icon && <Icon size={14} className={meta?.dotClass ? meta.dotClass.replace('bg-', 'text-') : 'text-gray-400'} />}
                                  <span className="truncate">{tab.label}</span>
                                </span>
                                {count > 0 && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-black text-gray-500 dark:bg-white/5 dark:text-zinc-400">
                                    {count}
                                  </span>
                                )}
                              </motion.button>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Row 2: Search Bar & Date Filters */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className={`relative transition-all duration-500 ease-out ${isSearchFocused ? 'w-full lg:flex-[1.5]' : 'w-full lg:flex-1'}`}>
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280] dark:text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, telefone, endereço, pedido..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className="h-14 w-full rounded-[1.5rem] border border-gray-100 bg-white pl-12 pr-4 text-sm font-medium text-[#111827] shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-orange-500 dark:focus:ring-orange-500/10"
                  />
                </div>

                <div className="pratoby-scrollbar max-w-full overflow-x-auto">
                  <AnimatedSegmentedControl
                    options={DATE_FILTER_OPTIONS.map((filter) => ({
                      label: filter.label,
                      value: filter.key,
                    }))}
                    value={dateFilter}
                    onChange={setDateFilter}
                    size="lg"
                    variant="neutral"
                    fullWidthMobile
                    ariaLabel="Filtrar pedidos por data"
                  />
                </div>
              </div>
            </div>

            <div className="hidden rounded-[1.5rem] border border-gray-100 bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#6b7280] shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 lg:grid lg:grid-cols-[100px_1fr_160px_150px_180px_auto] lg:gap-4">
              <div>ID</div>
              <div>Cliente e itens</div>
              <div>Status</div>
              <div>Total</div>
              <div>Horário</div>
              <div className="text-right">Ações</div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${timingFilter}-${statusFilter}-${dateFilter}-${loading ? 'loading' : 'ready'}`}
                variants={ORDERS_LIST_VARIANTS}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-4 space-y-3 rounded-[2rem] border border-gray-100/80 bg-gray-50/50 p-2 dark:border-zinc-800 dark:bg-white/[0.02] sm:p-3"
              >
                {loading ? (
                  [1, 2, 3, 4, 5].map((item) => (
                    <motion.div
                      key={item}
                      variants={ORDER_ITEM_VARIANTS}
                      className="h-28 animate-pulse rounded-[1.5rem] bg-white dark:bg-zinc-900"
                    />
                  ))
                ) : filteredOrders.length === 0 ? (
                  <motion.div variants={ORDER_ITEM_VARIANTS}>
                    <EmptyState
                      icon={FiShoppingBag}
                      title="Nenhum pedido encontrado"
                      description={
                        search || statusFilter !== 'todos' || timingFilter !== 'all'
                          ? 'Tente limpar a busca ou alterar o filtro de status.'
                          : 'Quando novos pedidos entrarem, eles aparecerão aqui em tempo real.'
                      }
                    />
                  </motion.div>
                ) : (
                  filteredOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      layout
                      variants={ORDER_ITEM_VARIANTS}
                    >
                      <OrderCard
                        order={order}
                        now={slaNow}
                        onOpen={(nextOrder) => setSelectedOrderId(nextOrder.id)}
                        onQuickStatus={handleUpdateStatus}
                        onOpenWhatsApp={handleOpenWhatsApp}
                        onCopyOrder={handleCopyOrder}
                        updatingStatus={updatingStatus}
                        isNew={newOrderIds.has(order.id)}
                        isLatestNew={latestNewOrderId === order.id}
                      />
                    </motion.div>
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

      </section>

      <AnimatePresence>
        {selectedOrder && (
          <OrderModal
            order={selectedOrder}
            now={slaNow}
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
      </AnimatePresence>


      {counterOrderOpen && selectedStore && (
        <CounterOrderModal
          storeId={
            selectedStore.storeDocId ||
            selectedStore.storeId ||
            selectedStore.id ||
            selectedStoreId
          }
          onClose={() => setCounterOrderOpen(false)}
          onSuccess={(data) => {
            setCounterOrderOpen(false)
            showToast(
              'success',
              `Pedido de balcão criado! Total: ${Number(data?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            )
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
        <DashboardFooter store={selectedStore} />

    </main>
  )
}
