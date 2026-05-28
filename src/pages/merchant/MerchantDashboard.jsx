import { useCallback, useEffect, useMemo, useState } from 'react'
import { captureAppError } from '../../services/sentry'
import { getPricingValidation } from '../../utils/orderValidation'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import { db } from '../../services/firebase'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import AnimatedSegmentedControl from '../../components/ui/AnimatedSegmentedControl'
import { useAuth } from '../../contexts/AuthContext'
import { usePresence } from '../../hooks/usePresence'
import DashboardFooter from '../../components/layouts/DashboardFooter'

import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiCopy,
  FiDollarSign,
  FiPower,
  FiLoader,
  FiExternalLink,
  FiHome,
  FiLayout,
  FiPackage,
  FiPercent,
  FiRefreshCw,
  FiShield,
  FiShoppingBag,
  FiTrendingUp,
  FiTruck,
  FiUsers,
  FiX,
  FiXCircle,
  FiPlay,
} from 'react-icons/fi'

function PricingValidationBadge({ order }) {
  const pricing = getPricingValidation(order)

  const className = [
    'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
    pricing.tone === 'success' && 'bg-emerald-50 text-emerald-700',
    pricing.tone === 'warning' && 'bg-amber-50 text-amber-700',
    pricing.tone === 'danger' && 'bg-red-50 text-red-700',
    pricing.tone === 'neutral' && 'bg-gray-50 text-gray-600',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={className}>
      {pricing.label}
    </span>
  )
}

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const BILLING_PENDING_STATUSES = new Set(['checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'])
const OPERATIONAL_STATUSES = new Set(['trialing', 'active'])
const PUBLIC_STORE_BASE_URL =
  import.meta.env.VITE_PUBLIC_STORE_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')

const DASHBOARD_DAYS = [
  { id: 'sun', short: 'Dom', label: 'Domingo' },
  { id: 'mon', short: 'Seg', label: 'Segunda' },
  { id: 'tue', short: 'Ter', label: 'Terça' },
  { id: 'wed', short: 'Qua', label: 'Quarta' },
  { id: 'thu', short: 'Qui', label: 'Quinta' },
  { id: 'fri', short: 'Sex', label: 'Sexta' },
  { id: 'sat', short: 'Sáb', label: 'Sábado' },
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

function getTodayOpeningHoursLabel(store) {
  const today = DASHBOARD_DAYS[new Date().getDay()]
  const openingHours =
    store?.openingHours ||
    store?.settings?.openingHours ||
    store?.businessHours ||
    store?.hours ||
    {}

  const todayHours =
    openingHours?.[today.id] ||
    openingHours?.[today.short] ||
    null

  if (todayHours) {
    if (todayHours.enabled === false) return 'Fechado hoje'

    const open = todayHours.open || todayHours.openAt
    const close = todayHours.close || todayHours.closeAt

    if (open && close) return `Hoje: ${open} às ${close}`
    if (open) return `Abre hoje às ${open}`
    if (close) return `Fecha hoje às ${close}`
  }

  if (Array.isArray(store?.activeDays) && store.activeDays.length) {
    const isActiveToday = store.activeDays.includes(today.short)

    if (!isActiveToday) return 'Fechado hoje'
  }

  if (store?.hoursOpen && store?.hoursClose) {
    return `Hoje: ${store.hoursOpen} às ${store.hoursClose}`
  }

  return 'Horário não informado'
}

const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 0 },
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
]

const ACTIVE_STATUSES = ['pendente', 'preparando', 'em_rota']
const FINISHED_STATUSES = ['entregue']
const CANCELED_STATUSES = ['cancelado']

const STATUS_META = {
  pendente: {
    label: 'Pendente',
    icon: FiClock,
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  preparando: {
    label: 'Preparando',
    icon: FiPackage,
    className: 'bg-purple-50 text-purple-700 ring-purple-200',
  },
  entregando: {
    label: 'Saiu para entrega',
    icon: FiTruck,
    className: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  em_rota: {
    label: 'Em rota',
    icon: FiTruck,
    className: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  entregue: {
    label: 'Entregue',
    icon: FiCheckCircle,
    className: 'bg-orange-50 text-orange-700 ring-green-200',
  },
  cancelado: {
    label: 'Cancelado',
    icon: FiXCircle,
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeStatus(status) {
  const currentStatus = String(status || 'pendente').toLowerCase().trim()
  const statusMap = {
    novo: 'pendente', new: 'pendente', recebido: 'pendente', aguardando: 'pendente', pendente: 'pendente',
    aceito: 'preparando', confirmado: 'preparando', em_preparo: 'preparando', preparo: 'preparando', preparando: 'preparando',
    entregando: 'em_rota', saiu_para_entrega: 'em_rota', saiu_entrega: 'em_rota', em_entrega: 'em_rota', out_for_delivery: 'em_rota', em_rota: 'em_rota',
    finalizado: 'entregue', delivered: 'entregue', entregue: 'entregue',
    canceled: 'cancelado', cancelled: 'cancelado', cancelado: 'cancelado',
  }
  return statusMap[currentStatus] || currentStatus || 'pendente'
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }
  const numericValue = Number(value || 0)
  if (numericValue > 999) return numericValue / 100
  return numericValue
}

function formatCurrency(value) {
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

function getOrderDisplayNumber(order) {
  const rawNumber = order?.displayNumber || order?.orderNumber || order?.dailyNumber || order?.orderCode || order?.number || ''
  const value = String(rawNumber || '').trim()
  if (value) {
    if (value.startsWith('#') || value.toUpperCase().startsWith('BP-')) return value
    if (/^\d+$/.test(value)) return `#${value.padStart(3, '0')}`
    return value
  }
  const fallbackId = String(order?.id || '').slice(-4).toUpperCase()
  return fallbackId ? `#${fallbackId}` : '#----'
}

function getOrderTotal(order) {
  const savedTotal = normalizeMoney(order?.total, order?.totalCents)
  if (savedTotal > 0) return savedTotal
  return normalizeMoney(order?.totalAmount ?? order?.amount, order?.totalAmountCents ?? order?.amountCents)
}

function getOrderSubtotal(order) {
  const savedSubtotal = normalizeMoney(order?.subtotal, order?.subtotalCents)
  if (savedSubtotal > 0) return savedSubtotal
  return getOrderItems(order).reduce((acc, item) => acc + getItemTotal(item), 0)
}

function getOrderPromotionSavings(order) {
  return normalizeMoney(order?.promotionSavings, order?.promotionSavingsCents)
}

function getOrderDiscount(order) {
  return normalizeMoney(order?.discount, order?.discountCents)
}

function getCustomerName(order) {
  return order?.customerName || order?.customer?.name || order?.clientName || 'Cliente'
}

function getCustomerPhone(order) {
  return order?.customerPhone || order?.customer?.phone || order?.phone || ''
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
  return option?.groupTitle || option?.groupName || option?.groupLabel || option?.categoryName || fallback || 'Opções'
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
      const groupTitle = group?.groupTitle || group?.title || group?.name || group?.label || 'Opções'
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
    group.options.map((option) => ({ ...option, groupTitle: group.groupTitle }))
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
  return items
    .slice(0, 3)
    .map((item) => {
      const options = getItemOptionsSummary(item)
      return `${getItemQty(item)}x ${getItemName(item)}${options ? ` (${options})` : ''}`
    })
    .join(', ')
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

function isUrgentPending(order, minutes = 3) {
  if (normalizeStatus(order?.status) !== 'pendente') return false

  const date = getOrderDate(order)

  if (!date) return false

  return Date.now() - date.getTime() > minutes * 60 * 1000
}

function getOrderHour(order) {
  const date = getOrderDate(order)

  if (!date) return null

  return date.getHours()
}

function formatHourLabel(hour) {
  if (hour === null || hour === undefined || hour < 0) return 'Sem dados'

  return `${String(hour).padStart(2, '0')}:00`
}

function getPercentChange(current, previous) {
  const currentValue = Number(current || 0)
  const previousValue = Number(previous || 0)

  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0
  }

  return Math.round(((currentValue - previousValue) / previousValue) * 100)
}

function formatDelta(value) {
  const numberValue = Number(value || 0)

  if (numberValue === 0) return '0%'

  return `${numberValue > 0 ? '+' : ''}${numberValue}%`
}

function safeGetLocalStorage(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetLocalStorage(key, value) {
  try { localStorage.setItem(key, value) } catch { /* Ignore */ }
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

function getStoreDocId(store) {
  return store?.storeDocId || store?.id || store?.storeId || store?.slug || store?.storeSlug || ''
}

function isStoreOpen(store) {
  return store?.isOpen !== false && store?.isActive !== false && store?.isBlocked !== true && store?.isDeleted !== true
}

function getStorePublicUrl(store) {
  const slug = getStoreSlug(store)
  const base = String(PUBLIC_STORE_BASE_URL || '').replace(/\/$/, '')
  return slug ? `${base}/${slug}` : base
}

function getStoreLogoUrl(store) {
  return (
    store?.logoURL ||
    store?.logoUrl ||
    store?.logo ||
    store?.logoImage ||
    store?.imageUrl ||
    store?.avatarURL ||
    store?.avatarUrl ||
    store?.branding?.logoURL ||
    store?.branding?.logoUrl ||
    store?.settings?.logoURL ||
    store?.settings?.logoUrl ||
    store?.settings?.logoUrl ||
    ''
  )
}

function toDate(value) {
  if (!value) return null
  if (value?.toDate) return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDaysLeft(value) {
  const date = toDate(value)
  if (!date) return null
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000))
}

function StoreLogo({
  store,
  className = 'h-10 w-10',
  rounded = 'rounded-2xl',
  fallbackClassName = '',
}) {
  const [imageError, setImageError] = useState(false)

  const logoUrl = getStoreLogoUrl(store)
  const storeName = store?.name || store?.storeName || store?.storeSlug || store?.slug || 'Loja'

  const initials = storeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()

  if (logoUrl && !imageError) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${storeName}`}
        className={`${className} ${rounded} shrink-0 object-cover ring-1 ring-gray-100`}
        loading="lazy"
        onError={() => setImageError(true)}
      />
    )
  }

  return (
    <div
      className={`${className} ${rounded} ${fallbackClassName} flex shrink-0 items-center justify-center bg-orange-50 text-sm font-black text-[#f97316] ring-1 ring-orange-100`}
      title={storeName}
    >
      {initials || <FiHome size={18} />}
    </div>
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
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isSuccess ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'}`}>
          <Icon size={17} />
        </div>
        <div>
          <p className="text-sm font-bold text-[#111827]">{isSuccess ? 'Tudo certo' : 'Atenção'}</p>
          <p className="mt-0.5 text-sm text-[#6b7280]">{toast.message}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-2 text-gray-400 transition hover:text-gray-700">
          <FiX />
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone = 'orange' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-[#f97316]',
  }

  const SafeIcon = Icon || FiActivity

  return (
    <article className="group flex min-w-[220px] shrink-0 snap-start items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
          tones[tone] || tones.orange
        }`}
      >
        <SafeIcon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#6b7280]">
          {label}
        </p>
        <p className="truncate text-xl font-black tracking-tight text-[#111827]">
          {value}
        </p>
        <p className="truncate text-[11px] font-bold text-[#9ca3af]">
          {sub}
        </p>
      </div>
    </article>
  )
}

function StatusPill({ status }) {
  const normalizedStatus = normalizeStatus(status)
  const meta = STATUS_META[normalizedStatus] || STATUS_META.pendente
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${meta.className}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function OrderRow({ order }) {
  const urgent = isUrgentPending(order, 3)
  const customerName = getCustomerName(order)
  const initials = customerName.substring(0, 2).toUpperCase()
  const promoSavings = getOrderPromotionSavings(order)
  const discount = getOrderDiscount(order)

  return (
    <Link
      to="/dashboard/orders"
      className={`group grid grid-cols-[auto_1fr] gap-3 border-b border-gray-100 p-4 transition last:border-b-0 sm:grid-cols-[auto_1fr_auto] ${
  urgent ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-gray-50'
}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-[#f97316]">
        {initials}
      </div>
      <div className="min-w-0">
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <p className="truncate text-sm font-black text-[#111827]">{customerName}</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-black text-gray-600">
            {getOrderDisplayNumber(order)}
          </span>

          <StatusPill status={order.status} />
          <PricingValidationBadge order={order} />

          {urgent && (
  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
    <FiAlertTriangle size={11} />
    {getPendingMinutes(order)}min parado
  </span>
)}
        </div>
        <p className="mt-1 truncate text-xs text-[#6b7280]">{getOrderItemsSummary(order)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-gray-400">{timeAgo(order)}</p>
          {(promoSavings > 0 || discount > 0) && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-[#f97316]">
              economia {formatCurrency(promoSavings + discount)}
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:block sm:text-right">
        <p className="text-sm font-black text-[#111827]">{formatCurrency(getOrderTotal(order))}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#f97316] opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
          Ver pedido <FiChevronRight size={14} />
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.7rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <Icon size={24} />
      </div>
      <h3 className="mt-4 text-base font-black text-[#111827]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-[#6b7280]">{description}</p>}
      {action}
    </div>
  )
}

function ProductRanking({ products }) {
  return (
    <div className="min-w-0 rounded-[1.7rem] border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div>
          <p className="text-sm font-black text-[#111827]">Produtos mais pedidos</p>
          <p className="mt-1 text-xs text-[#6b7280]">Baseado no período selecionado</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiTrendingUp />
        </div>
      </div>
      {products.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {products.slice(0, 5).map((product, index) => (
            <div key={product.name} className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-sm font-black text-[#111827]">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#111827]">{product.name}</p>
                <p className="text-xs text-[#6b7280]">{product.qty} unidade{product.qty > 1 ? 's' : ''} vendida{product.qty > 1 ? 's' : ''}</p>
              </div>
              <p className="text-sm font-black text-[#f97316]">{formatCurrency(product.revenue)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6">
          <EmptyState icon={FiPackage} title="Sem dados ainda" description="Quando os pedidos começarem a entrar, seus produtos mais vendidos aparecerão aqui." />
        </div>
      )}
    </div>
  )
}

function PeakHoursCard({ peakHours, maxPeakHour, bestHourLabel }) {
  const hasData = peakHours.some((count) => count > 0)

  return (
    <div className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#111827]">Horários de pico</p>
          <p className="mt-1 text-xs text-[#6b7280]">
            Melhor horário: {bestHourLabel}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiBarChart2 />
        </div>
      </div>

      {hasData ? (
        <div>
          <div className="flex h-28 items-end gap-1.5">
            {peakHours.map((count, hour) => {
              const height = count > 0 ? Math.max((count / maxPeakHour) * 100, 12) : 4
              const active = count === maxPeakHour && count > 0

              return (
                <div key={hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-full transition ${
                      active ? 'bg-[#f97316]' : 'bg-orange-100'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${formatHourLabel(hour)} · ${count} pedido${count === 1 ? '' : 's'}`}
                  />

                  {hour % 6 === 0 && (
                    <span className="text-[9px] font-black text-[#9ca3af]">
                      {hour}h
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <p className="mt-4 rounded-2xl bg-[#f9fafb] px-4 py-3 text-xs font-bold leading-5 text-[#6b7280]">
            Use esse horário para reforçar equipe, estoque e tempo de preparo.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={FiClock}
          title="Sem horários ainda"
          description="Quando houver pedidos no período, os horários de maior movimento aparecerão aqui."
        />
      )}
    </div>
  )
}

export default function MerchantDashboard() {
  const {
    user,
    userData,
    role,
    loading: authLoading,
    storeId: authStoreId,
    storeIds: authStoreIds = [],
  } = useAuth()

  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [periodIdx, setPeriodIdx] = useState(1)
  const [toast, setToast] = useState(null)
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [hasCatalog, setHasCatalog] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [storeActionLoading, setStoreActionLoading] = useState(false)

  const period = PERIOD_OPTIONS[periodIdx]

  const knownStoreIds = useMemo(() => {
    return uniqueArray([
      authStoreId,
      ...(Array.isArray(authStoreIds) ? authStoreIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ]).slice(0, 10)
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])

  const selectedStore = useMemo(() => {
    if (!stores.length) return null

    return (
      stores.find((store) => getStoreKeys(store).includes(selectedStoreId)) ||
      stores[0] ||
      null
    )
  }, [stores, selectedStoreId])

  const todayOpeningHoursLabel = useMemo(
  () => getTodayOpeningHoursLabel(selectedStore),
  [selectedStore]
)

const storeSlug = getStoreSlug(selectedStore)

const storePublicUrl = selectedStore
  ? getStorePublicUrl(selectedStore)
  : ''

const merchantName =
  user?.displayName?.split(' ')?.[0] ||
  user?.email?.split('@')?.[0] ||
  'Lojista'

const loading = loadingStores || loadingOrders
const canReadOrders = canLoadOperationalOrders({ role, selectedStore, userData })

const activeUsers = usePresence(selectedStore?.id || selectedStore?.storeId, true)
const menuPeopleCount = Number(activeUsers || 0)

const menuPeopleLabel =
  menuPeopleCount === 1 ? 'pessoa no cardápio' : 'pessoas no cardápio'

const hasPeopleOnMenu = menuPeopleCount > 0

const showToast = useCallback(
  (type, message) => setToast({ type, message }),
  []
)
  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId)
    safeSetLocalStorage(SELECTED_STORE_KEY, storeId)
  }, [])

  const handleCopyStoreLink = useCallback(async () => {
    if (!storePublicUrl) return
    try {
      await navigator.clipboard.writeText(storePublicUrl)
      showToast('success', 'Link da loja copiado para a área de transferência.')
    } catch {
      showToast('error', 'Não foi possível copiar o link da loja.')
    }
  }, [showToast, storePublicUrl])

  const handleToggleStoreOpen = useCallback(async () => {
    if (!selectedStore || storeActionLoading) return

    const storeDocId = getStoreDocId(selectedStore)

    if (!storeDocId) {
      showToast('error', 'Loja sem ID válido para atualizar.')
      return
    }

    const nextStatus = !isStoreOpen(selectedStore)

    try {
      setStoreActionLoading(true)
      await updateDoc(doc(db, 'stores', storeDocId), {
        isOpen: nextStatus,
        updatedAt: serverTimestamp(),
      })
      showToast('success', nextStatus ? 'Loja aberta. Agora você já pode receber pedidos.' : 'Loja fechada. Novos pedidos ficarão pausados.')
    } catch (error) {
      console.error('Erro ao atualizar status da loja:', error)
      showToast('error', 'Erro ao atualizar o status da loja.')
    } finally {
      setStoreActionLoading(false)
    }
  }, [selectedStore, showToast, storeActionLoading])

  useEffect(() => {
    const uid = user?.uid

    if (!uid || !knownStoreIds.length) {
      setLoadingStores(false)
      setStores([])
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
      const nextStores = Array.from(storesMap.values()).sort((a, b) => {
        const aName = String(a.name || a.storeName || a.storeSlug || a.id || '')
        const bName = String(b.name || b.storeName || b.storeSlug || b.id || '')
        return aName.localeCompare(bName, 'pt-BR')
      })

      setStores(nextStores)
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
      if (stores.some((store) => getStoreKeys(store).includes(savedStoreId))) return savedStoreId
      return getStoreDocId(stores[0])
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
      setLoadingOrders(true)
      return undefined
    }

    if (!canReadOrders) {
      setOrders([])
      setLoadingOrders(false)
      return undefined
    }

    setLoadingOrders(true)

    const storeKeys = getStoreKeys(selectedStore)
    const since = Timestamp.fromDate(new Date(Date.now() - 31 * 86400000))

    if (!storeKeys.length) {
      setOrders([])
      setLoadingOrders(false)
      return undefined
    }

    const unsubscribers = []
    const ordersMap = new Map()
    let queryErrors = 0

    function publishOrders() {
      const mergedOrders = Array.from(ordersMap.values()).sort((a, b) => {
        const dateA = getOrderDate(a)?.getTime() || 0
        const dateB = getOrderDate(b)?.getTime() || 0
        return dateB - dateA
      })

      setOrders(mergedOrders)
      setLoadingOrders(false)
    }

    function updateOrdersFromSnapshot(snapshot) {
      snapshot.docs.forEach((orderDoc) => {
        ordersMap.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() })
      })

      publishOrders()
    }

    function handleOrdersError(error) {
      console.error('Erro ao carregar pedidos:', error)

      captureAppError(error, {
        area: 'MerchantDashboard',
        action: 'load_orders',
        storeId: selectedStore?.id || selectedStore?.slug,
      })

      showToast('error', 'Erro ao carregar pedidos. Confira regras ou índices do Firestore.')
      setLoadingOrders(false)
    }

    function subscribeOrders(ordersQuery) {
      const unsubscribe = onSnapshot(ordersQuery, updateOrdersFromSnapshot, handleOrdersError)
      unsubscribers.push(unsubscribe)
    }

const orderStoreId =
  getStoreDocId?.(selectedStore) ||
  selectedStore?.id ||
  selectedStore?.docId ||
  selectedStore?.slug ||
  getStoreSlug(selectedStore)

if (!orderStoreId) {
  setOrders([])
  setLoadingOrders(false)
  return undefined
}

subscribeOrders(query(
  collection(db, 'orders'),
  where('storeId', '==', orderStoreId),
  where('createdAt', '>=', since),
  orderBy('createdAt', 'desc')
))

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [authLoading, canReadOrders, selectedStore, showToast])

  useEffect(() => {
    if (!selectedStore) {
      setHasCatalog(false)
      setProducts([])
      setCategories([])
      setLoadingCatalog(true)
      return undefined
    }

    setLoadingCatalog(true)

    const orderStoreId =
      getStoreDocId?.(selectedStore) ||
      selectedStore?.id ||
      selectedStore?.docId ||
      selectedStore?.slug ||
      getStoreSlug(selectedStore)

    if (!orderStoreId) {
      setHasCatalog(false)
      setProducts([])
      setCategories([])
      setLoadingCatalog(false)
      return undefined
    }

    const qProducts = query(collection(db, 'products'), where('storeId', '==', orderStoreId))
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setProducts(items)
      setHasCatalog(!snapshot.empty)
      setLoadingCatalog(false)
    }, (error) => {
      console.error('Erro ao carregar produtos:', error)
      setHasCatalog(true) // assume has catalog on error to avoid blocking
      setLoadingCatalog(false)
    })

    const qCategories = query(collection(db, 'categories'), where('storeId', '==', orderStoreId))
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setCategories(items)
    }, (error) => {
      console.error('Erro ao carregar categorias:', error)
    })

    return () => {
      unsubProducts()
      unsubCategories()
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

    const validOrders = periodOrders.filter((order) => !CANCELED_STATUSES.includes(normalizeStatus(order.status)))
    const deliveredOrders = validOrders.filter((order) => FINISHED_STATUSES.includes(normalizeStatus(order.status)))
    const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(normalizeStatus(order.status)))

  const urgentOrders = activeOrders.filter((order) => isUrgentPending(order, 3))
const priceReviewOrders = activeOrders.filter((order) => {
  const status = order?.pricingValidation?.status

  return status === 'review' || status === 'invalid' || order?.requiresManualPriceReview === true
})

const oldestPendingMinutes = urgentOrders.reduce((max, order) => {
  return Math.max(max, getPendingMinutes(order))
}, 0)

    const revenue = validOrders.reduce((acc, order) => acc + getOrderTotal(order), 0)
    const subtotal = validOrders.reduce((acc, order) => acc + getOrderSubtotal(order), 0)
    const promotionSavings = validOrders.reduce((acc, order) => acc + getOrderPromotionSavings(order), 0)
    const couponDiscounts = validOrders.reduce((acc, order) => acc + getOrderDiscount(order), 0)
    const averageTicket = validOrders.length > 0 ? revenue / validOrders.length : 0
    const uniqueCustomers = new Set(validOrders.map(getCustomerPhone).filter(Boolean)).size
    const completionRate = validOrders.length > 0 ? Math.round((deliveredOrders.length / validOrders.length) * 100) : 0

    const periodLengthMs =
  period.days === 0 ? 24 * 60 * 60 * 1000 : period.days * 24 * 60 * 60 * 1000

const previousStart = cutoff - periodLengthMs

const previousPeriodOrders = orders.filter((order) => {
  const date = getOrderDate(order)
  const time = date?.getTime?.()

  return time ? time >= previousStart && time < cutoff : false
})

const validPreviousOrders = previousPeriodOrders.filter((order) => {
  return !CANCELED_STATUSES.includes(normalizeStatus(order.status))
})

const previousRevenue = validPreviousOrders.reduce(
  (acc, order) => acc + getOrderTotal(order),
  0
)

const revenueDelta = getPercentChange(revenue, previousRevenue)
const ordersDelta = getPercentChange(validOrders.length, validPreviousOrders.length)

const peakHours = Array.from({ length: 24 }, () => 0)

validOrders.forEach((order) => {
  const hour = getOrderHour(order)

  if (hour !== null) {
    peakHours[hour] += 1
  }
})

const maxPeakHour = Math.max(...peakHours, 1)
const bestHour = peakHours.findIndex((count) => count === maxPeakHour && count > 0)
const bestHourLabel = bestHour >= 0 ? formatHourLabel(bestHour) : 'Sem dados'

    const productMap = new Map()
    validOrders.forEach((order) => {
      getOrderItems(order).forEach((item) => {
        const name = getItemName(item)
        const qty = getItemQty(item)
        const revenue = getItemTotal(item)
        const previous = productMap.get(name) || { name, qty: 0, revenue: 0 }
        productMap.set(name, { ...previous, qty: previous.qty + qty, revenue: previous.revenue + revenue })
      })
    })

    const topProducts = [...productMap.values()].sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty
      return b.revenue - a.revenue
    })

    const neighborhoodMap = new Map()
    validOrders.forEach((order) => {
      const neighborhood =
        order?.deliveryAddress?.neighborhood ||
        order?.deliveryAddress?.bairro ||
        order?.address?.neighborhood ||
        order?.address?.bairro ||
        order?.customer?.neighborhood ||
        order?.customer?.bairro ||
        ''
      const name = String(neighborhood).trim()
      if (name) {
        neighborhoodMap.set(name, (neighborhoodMap.get(name) || 0) + 1)
      }
    })

    const topNeighborhoods = [...neighborhoodMap.entries()].sort((a, b) => b[1] - a[1])
    const topNeighborhood = topNeighborhoods[0]?.[0] || null

    return {
      periodOrders,
      validOrders,
      activeOrders,
      urgentOrders,
      topProducts,
      revenue,
      subtotal,
      promotionSavings,
      couponDiscounts,
      averageTicket,
      uniqueCustomers,
      completionRate,
      oldestPendingMinutes,
      previousRevenue,
      revenueDelta,
      ordersDelta,
      peakHours,
      maxPeakHour,
      priceReviewOrders,
      bestHourLabel,
      topProductName: topProducts[0]?.name || null,
      topNeighborhood: topNeighborhood,
      peakHourLabel: bestHour >= 0 ? bestHourLabel : null,
      pendingCount: orders.filter((o) => normalizeStatus(o.status) === 'pendente').length,
      preparingCount: orders.filter((o) => normalizeStatus(o.status) === 'preparando').length,
      routeCount: orders.filter((o) => normalizeStatus(o.status) === 'entregando').length,
      canceledCount: periodOrders.filter((o) => normalizeStatus(o.status) === 'cancelado').length,
    }
  }, [orders, period.days])

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])

  const recommendedAction = useMemo(() => {
    const totalProducts = Array.isArray(products) ? products.length : 0
    const totalCategories = Array.isArray(categories) ? categories.length : 0
    const deliveryFeesCount = Object.keys(selectedStore?.deliveryFees || {}).length

    if (totalCategories === 0) {
      return {
        title: 'Crie sua primeira categoria',
        description: 'Organize melhor seu cardápio para começar com estrutura.',
        cta: 'Ir para cardápio',
        href: '/dashboard/menu',
        tone: 'orange',
      }
    }

    if (totalProducts === 0) {
      return {
        title: 'Cadastre seu primeiro produto',
        description: 'Adicione itens ao cardápio para começar a vender.',
        cta: 'Adicionar produto',
        href: '/dashboard/menu',
        tone: 'orange',
      }
    }

    if (deliveryFeesCount === 0) {
      return {
        title: 'Configure a entrega por bairro',
        description: 'Defina as taxas de entrega para melhorar a conversão.',
        cta: 'Configurar entrega',
        href: '/dashboard/menu?tab=entrega',
        tone: 'blue',
      }
    }

    if (!isStoreOpen(selectedStore)) {
      return {
        title: 'Abra sua loja',
        description: 'Sua loja está pronta para receber pedidos.',
        cta: 'Abrir agora',
        action: 'open-store',
        tone: 'green',
      }
    }

    if ((dashboardData?.pendingCount || 0) > 0) {
      return {
        title: 'Você tem pedidos aguardando',
        description: 'Responda rápido para manter uma boa experiência.',
        cta: 'Ver pedidos',
        href: '/dashboard/orders',
        tone: 'red',
      }
    }

    return {
      title: 'Sua operação está saudável',
      description: 'Agora vale acompanhar desempenho e aumentar as vendas.',
      cta: 'Ver estatísticas',
      href: '/dashboard/stats',
      tone: 'emerald',
    }
  }, [products, categories, selectedStore, dashboardData])

  const onboardingChecklist = useMemo(() => {
    const totalProducts = Array.isArray(products) ? products.length : 0
    const totalCategories = Array.isArray(categories) ? categories.length : 0
    const hasLogo = Boolean(selectedStore?.logoUrl || selectedStore?.imageUrl)
    const hasDeliveryFees = Object.keys(selectedStore?.deliveryFees || {}).length > 0
    const isOpenNow = isStoreOpen(selectedStore)

    const steps = [
      { label: 'Adicionar logo da loja', done: hasLogo },
      { label: 'Criar categoria', done: totalCategories > 0 },
      { label: 'Cadastrar produto', done: totalProducts > 0 },
      { label: 'Configurar entrega', done: hasDeliveryFees },
      { label: 'Abrir loja', done: isOpenNow },
    ]

    const completed = steps.filter((step) => step.done).length
    const percent = Math.round((completed / steps.length) * 100)

    return { steps, completed, total: steps.length, percent }
  }, [products, categories, selectedStore])

  const rawTrialEndsAt = selectedStore?.trialEndsAt || userData?.trialEndsAt
  const trialEndsAt = toDate(rawTrialEndsAt)
  const trialDaysRemaining = getDaysLeft(rawTrialEndsAt)
  const isTrialActive = selectedStore?.subscriptionStatus === 'trialing' || userData?.subscriptionStatus === 'trialing'

  return (
    <div className="min-w-0 pb-24 lg:pb-0">
      {loadingStores ? (
        <div className="bg-[#111827] border-b border-white/5 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex animate-pulse items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="h-6 w-48 rounded bg-white/10" />
              <div className="h-3 w-32 rounded bg-white/10" />
            </div>
          </div>
        </div>
      ) : selectedStore ? (
        <section className="relative overflow-hidden border-b border-orange-100/70 bg-white/85 shadow-sm shadow-orange-100/40 dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none">
          <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[#f97316]/10 blur-3xl dark:bg-[#f97316]/5" />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/5" />

          <div className="relative px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-zinc-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#f97316] shadow-sm ring-1 ring-orange-100 dark:ring-zinc-800">
                    <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                    Tempo real
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                      isStoreOpen(selectedStore)
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/50'
                        : 'bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900/50'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full bg-current ${isStoreOpen(selectedStore) ? 'animate-pulse' : ''}`} />
                    {isStoreOpen(selectedStore) ? 'Loja aberta' : 'Loja fechada'}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                      hasPeopleOnMenu
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900/50'
                        : 'bg-gray-50 text-gray-500 ring-1 ring-gray-100 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700/50'
                    }`}
                  >
                    <FiUsers size={12} />
                    {hasPeopleOnMenu
                      ? `${menuPeopleCount} ${menuPeopleLabel}`
                      : 'Sem visitantes agora'}
                  </span>

                </div>

                <div className="mt-4 flex items-center gap-3 sm:gap-4">
                  <StoreLogo
                    store={selectedStore}
                    className="h-14 w-14 shrink-0 shadow-lg shadow-orange-100 dark:shadow-none sm:h-16 sm:w-16"
                    rounded="rounded-[1.35rem]"
                    fallbackClassName="bg-orange-50 text-[#f97316] ring-orange-100"
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#6b7280] dark:text-zinc-400">
                      Olá, {merchantName}
                    </p>

                    <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-[#111827] dark:text-zinc-100 sm:text-3xl">
                      {selectedStore.name || 'Sua loja'}
                    </h1>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                      {storeSlug && (
                        <span className="rounded-full bg-white dark:bg-zinc-900 px-2.5 py-1 text-[#f97316] ring-1 ring-orange-100 dark:ring-zinc-800">
                          /{storeSlug}
                        </span>
                      )}

                      {todayOpeningHoursLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-zinc-900 px-2.5 py-1 ring-1 ring-gray-100 dark:ring-zinc-800 text-[#111827] dark:text-zinc-300">
                          <FiClock size={12} />
                          {todayOpeningHoursLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#6b7280] dark:text-zinc-400">
                  Acompanhe pedidos, faturamento, clientes online e os principais pontos da operação em tempo real.
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:w-[360px] xl:items-end xl:justify-between">
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                  <button
                    type="button"
                    onClick={handleToggleStoreOpen}
                    disabled={storeActionLoading}
                    className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[13px] font-black shadow-sm ring-1 ring-inset transition active:scale-95 disabled:opacity-70 sm:w-auto ${
                      isStoreOpen(selectedStore)
                        ? 'bg-red-50 text-red-700 ring-red-200 shadow-red-100/50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:ring-red-900/40 dark:hover:bg-red-900/40'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-100/50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/40 dark:hover:bg-emerald-900/40'
                    }`}
                  >
                    {storeActionLoading ? (
                      <>
                        <FiLoader size={16} className="animate-spin" />
                        Atualizando...
                      </>
                    ) : isStoreOpen(selectedStore) ? (
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



                  <button
                    type="button"
                    onClick={handleCopyStoreLink}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm font-black text-[#6b7280] dark:text-zinc-400 shadow-sm transition hover:border-orange-200 hover:text-[#f97316] sm:h-12 sm:w-12 sm:px-0"
                    title="Copiar link da loja"
                  >
                    <FiCopy size={16} />
                    <span className="sm:hidden">Copiar link</span>
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 xl:w-full">
                  <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Pendentes</p>
                    <p className="mt-1 text-2xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.pendingCount}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Preparo</p>
                    <p className="mt-1 text-2xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.preparingCount}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Em rota</p>
                    <p className="mt-1 text-2xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.routeCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {(dashboardData.urgentOrders.length > 0 || dashboardData.priceReviewOrders.length > 0 || dashboardData.activeOrders.length > 0) && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-orange-100 dark:border-orange-950/40 bg-white/80 dark:bg-zinc-900/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Pedidos ativos</p>
                  <p className="mt-1 text-xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.activeOrders.length}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280] dark:text-zinc-400">Em andamento agora</p>
                </div>

                <div className="rounded-2xl border border-amber-100 dark:border-amber-950/40 bg-white/80 dark:bg-zinc-900/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Atenção</p>
                  <p className="mt-1 text-xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.urgentOrders.length}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280] dark:text-zinc-400">
                    {dashboardData.oldestPendingMinutes > 0
                      ? `Pedido aguardando há ${dashboardData.oldestPendingMinutes} min`
                      : 'Nenhum pedido atrasado'}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-100 dark:border-red-950/40 bg-white/80 dark:bg-zinc-900/80 p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">Revisão</p>
                  <p className="mt-1 text-xl font-black text-[#111827] dark:text-zinc-100">{dashboardData.priceReviewOrders.length}</p>
                  <p className="mt-1 text-xs font-semibold text-[#6b7280] dark:text-zinc-400">Pedidos com alerta de preço</p>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="px-4 py-4 pb-8 sm:px-6 lg:px-8">
        {loadingStores ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-[1.7rem] bg-white" />
            ))}
          </div>
        ) : !selectedStore ? (
          <EmptyState
            icon={FiHome}
            title="Nenhuma loja vinculada"
            description="Nenhuma loja vinculada à sua conta. Conclua o onboarding ou fale com o suporte."
          />
        ) : !loadingCatalog && !loadingOrders && !hasCatalog && orders.length === 0 ? (
          <div className="mx-auto max-w-4xl pt-8">
            <div className="overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-2xl shadow-orange-100/50">
              <div className="bg-gradient-to-br from-orange-50 to-white px-8 py-10 sm:px-12 sm:py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-200">
                  <FiPackage size={28} />
                </div>
                <h2 className="mt-6 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  Bem-vindo à sua nova loja!
                </h2>
                <p className="mt-4 max-w-xl text-lg leading-8 text-[#6b7280]">
                  Sua loja foi criada com sucesso e os {isTrialActive && trialDaysRemaining !== null ? `${trialDaysRemaining} dias de teste grátis` : 'dias de teste'} já estão ativos. Agora só falta configurar seu cardápio para começar a vender.
                </p>
              </div>

              <div className="grid gap-px bg-gray-100 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
                    <FiLayout size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[#111827]">Configure sua loja</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    Acesse as configurações para adicionar sua logo, banner e horários de funcionamento.
                  </p>
                  <Link to="/dashboard/settings" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#f97316] hover:text-[#ea580c]">
                    Ir para configurações <FiChevronRight />
                  </Link>
                </div>

                <div className="bg-white p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
                    <FiLayout size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[#111827]">Adicione sua primeira categoria</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    Crie categorias como "Pizzas", "Bebidas" ou "Promoções" para organizar seu cardápio.
                  </p>
                  <Link to="/dashboard/menu" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#f97316] hover:text-[#ea580c]">
                    Ir para cardápio <FiChevronRight />
                  </Link>
                </div>

                <div className="bg-white p-8 sm:col-span-2 lg:col-span-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
                    <FiPackage size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[#111827]">Cadastre seu primeiro produto</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    Adicione fotos atraentes, preços e descrições para deixar os clientes com água na boca.
                  </p>
                  <Link to="/dashboard/menu" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#f97316] hover:text-[#ea580c]">
                    Cadastrar produto <FiChevronRight />
                  </Link>
                </div>
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-8 py-6 sm:px-12">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-black text-[#111827]">Abra a loja quando estiver pronta</h4>
                    <p className="mt-1 text-sm text-[#6b7280]">Sua loja nasce fechada para você arrumar a casa primeiro.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleStoreOpen}
                    disabled={storeActionLoading}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#111827] px-6 text-sm font-black text-white shadow-sm transition hover:bg-black active:scale-95 disabled:opacity-50"
                  >
                    {storeActionLoading ? <FiLoader className="animate-spin" /> : 'Abrir loja agora'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* PRÓXIMA AÇÃO RECOMENDADA */}
            <div className="mb-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm dark:border-orange-900/40 dark:bg-zinc-900 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f97316]">
                    Próxima ação recomendada
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#111827] dark:text-zinc-100">
                    {recommendedAction.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                    {recommendedAction.description}
                  </p>
                </div>

                {recommendedAction.action === 'open-store' ? (
                  <button
                    type="button"
                    disabled={storeActionLoading}
                    onClick={handleToggleStoreOpen}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-[13px] font-black text-white shadow-md shadow-emerald-500/20 ring-1 ring-inset ring-white/10 transition hover:-translate-y-0.5 hover:bg-emerald-400 active:scale-95 disabled:opacity-70 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    {storeActionLoading ? (
                      <FiLoader size={16} className="animate-spin" />
                    ) : (
                      <FiPlay size={16} className="fill-current" />
                    )}
                    {storeActionLoading ? 'Atualizando...' : recommendedAction.cta}
                  </button>
                ) : (
                  <a
                    href={recommendedAction.href}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-[13px] font-black text-white shadow-md shadow-orange-500/20 ring-1 ring-inset ring-white/10 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95 dark:bg-[#ea580c] dark:hover:bg-[#f97316]"
                  >
                    {recommendedAction.cta}
                    <FiChevronRight size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* ATENÇÃO AGORA */}
            <div className="mb-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm dark:border-amber-900/40 dark:bg-zinc-900">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af] dark:text-zinc-500">
                  Atenção agora
                </p>
                <p className="mt-2 text-2xl font-black text-[#111827] dark:text-zinc-100">
                  {dashboardData?.urgentOrders?.length || 0}
                </p>
                <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                  {dashboardData?.oldestPendingMinutes > 0
                    ? `Pedido aguardando há ${dashboardData.oldestPendingMinutes} min`
                    : 'Nenhum pedido crítico no momento'}
                </p>
              </div>

              <div className="rounded-3xl border border-red-100 bg-white p-4 shadow-sm dark:border-red-900/40 dark:bg-zinc-900">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af] dark:text-zinc-500">
                  Revisão
                </p>
                <p className="mt-2 text-2xl font-black text-[#111827] dark:text-zinc-100">
                  {dashboardData?.priceReviewOrders?.length || 0}
                </p>
                <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                  Pedidos com alerta de preço
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-900">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af] dark:text-zinc-500">
                  Operação
                </p>
                <p className="mt-2 text-2xl font-black text-[#111827] dark:text-zinc-100">
                  {(dashboardData?.activeOrders?.length || 0) > 0 ? dashboardData.activeOrders.length : 0}
                </p>
                <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                  Pedidos em andamento agora
                </p>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <AnimatedSegmentedControl
              options={PERIOD_OPTIONS.map((opt, i) => ({ label: opt.label, value: i }))}
              value={periodIdx}
              onChange={(newIdx) => setPeriodIdx(newIdx)}
              size="md"
              variant="primary"
            />
              <button
                type="button"
                onClick={() => showToast('success', 'Os dados já estão sincronizados em tempo real.')}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#6b7280] shadow-sm transition hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              >
                <FiRefreshCw />
                Tempo real ativo
              </button>
            </div>

   <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
<StatCard
  icon={FiDollarSign}
  label="Faturamento"
  value={loading ? '...' : formatCurrency(dashboardData.revenue)}
  sub={`${formatDelta(dashboardData.revenueDelta)} vs período anterior`}
  tone={dashboardData.revenueDelta >= 0 ? 'green' : 'red'}
/>

<StatCard
  icon={FiShoppingBag}
  label="Pedidos"
  value={loading ? '...' : dashboardData.validOrders.length}
  sub={`${formatDelta(dashboardData.ordersDelta)} vs período anterior`}
  tone={dashboardData.ordersDelta >= 0 ? 'blue' : 'red'}
/>

<StatCard
  icon={FiTrendingUp}
  label="Ticket médio"
  value={loading ? '...' : formatCurrency(dashboardData.averageTicket)}
  sub={`pico às ${dashboardData.bestHourLabel}`}
  tone="amber"
/>
  <StatCard icon={FiUsers} label="Clientes" value={loading ? '...' : dashboardData.uniqueCustomers} sub="clientes únicos" tone="purple" />
  <StatCard icon={FiActivity} label="Conclusão" value={loading ? '...' : `${dashboardData.completionRate}%`} sub="pedidos entregues" tone="green" />
  <StatCard icon={FiPercent} label="Economia" value={loading ? '...' : formatCurrency(dashboardData.promotionSavings + dashboardData.couponDiscounts)} sub="promoções + cupons" tone="red" />
            </div>

            {/* INSIGHTS RÁPIDOS */}
            <div className="mt-6 rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af] dark:text-zinc-500">
                    Insights rápidos
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#111827] dark:text-zinc-100">
                    Resumo do dia
                  </h3>
                </div>

                <Link
                  to="/dashboard/stats"
                  className="text-sm font-black text-[#f97316] hover:text-[#ea580c]"
                >
                  Ver estatísticas
                </Link>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-950 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">
                    Mais vendido
                  </p>
                  <p className="mt-2 text-base font-black text-[#111827] dark:text-zinc-100">
                    {dashboardData?.topProductName || 'Ainda sem dados'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                    Produto destaque do período
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-950 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">
                    Bairro destaque
                  </p>
                  <p className="mt-2 text-base font-black text-[#111827] dark:text-zinc-100">
                    {dashboardData?.topNeighborhood || 'Sem dados'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                    Onde você mais vendeu
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-950 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[#9ca3af] dark:text-zinc-500">
                    Horário de pico
                  </p>
                  <p className="mt-2 text-base font-black text-[#111827] dark:text-zinc-100">
                    {dashboardData?.peakHourLabel || 'Sem dados'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                    Faixa com mais pedidos
                  </p>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <div className="min-w-0 rounded-[1.7rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-zinc-100">Pedidos recentes</p>
                    <p className="mt-1 text-xs text-[#6b7280] dark:text-zinc-400">Últimos pedidos recebidos pela loja</p>
                  </div>
                  <Link to="/dashboard/orders" className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2 text-sm font-black text-white transition hover:bg-[#ea580c]">
                    Ver todos <FiArrowUpRight />
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3 p-5">
                    {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-gray-50 dark:bg-zinc-950" />)}
                  </div>
                ) : recentOrders.length > 0 ? (
                  <div>
                    {recentOrders.map((order) => <OrderRow key={order.id} order={order} />)}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState icon={FiShoppingBag} title="Nenhum pedido ainda" description="Quando o primeiro pedido entrar, ele aparecerá aqui em tempo real." />
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-6">
<ProductRanking products={dashboardData.topProducts} />

<PeakHoursCard
  peakHours={dashboardData.peakHours}
  maxPeakHour={dashboardData.maxPeakHour}
  bestHourLabel={dashboardData.bestHourLabel}
/>

                <div className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-black text-[#111827] dark:text-zinc-100">Ações rápidas</p>
                  <div className="mt-4 grid gap-3">
                    <Link to="/dashboard/orders" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-orange-950/20">
                      <span className="flex items-center gap-3"><FiShoppingBag /> Gerenciar pedidos</span>
                      <FiChevronRight />
                    </Link>
                    <Link to="/dashboard/stats" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-orange-950/20">
                      <span className="flex items-center gap-3"><FiBarChart2 /> Ver estatísticas</span>
                      <FiChevronRight />
                    </Link>
                    <a href={storePublicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-orange-950/20">
                      <span className="flex items-center gap-3"><FiLayout /> Abrir cardápio público</span>
                      <FiExternalLink />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* CHECKLIST DA LOJA PRONTA */}
            <div className="mt-6 rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9ca3af] dark:text-zinc-500">
                    Loja pronta
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#111827] dark:text-zinc-100">
                    {onboardingChecklist.completed} de {onboardingChecklist.total} etapas concluídas
                  </h3>
                  <p className="mt-1 text-sm font-medium text-[#6b7280] dark:text-zinc-400">
                    Complete os passos para deixar sua operação redonda.
                  </p>
                </div>

                <div className="w-full max-w-[180px]">
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-[#f97316] transition-all"
                      style={{ width: `${onboardingChecklist.percent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-black text-[#111827] dark:text-zinc-100">
                    {onboardingChecklist.percent}% concluído
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {onboardingChecklist.steps.map((step) => (
                  <div
                    key={step.label}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-950 px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-[#111827] dark:text-zinc-200">{step.label}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${
                        step.done
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}
                    >
                      {step.done ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* MINI FOOTER */}
            <div className="mt-8 rounded-3xl border border-gray-100 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
                    PratoBy · Painel do lojista
                  </p>
                  <p className="text-xs font-semibold text-[#9ca3af] dark:text-zinc-500">
                    Acompanhe sua operação, evolua seu cardápio e venda mais.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/dashboard/menu"
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#111827] hover:border-orange-200 hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    Cardápio
                  </Link>
                  <Link
                    to="/dashboard/orders"
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#111827] hover:border-orange-200 hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    Pedidos
                  </Link>
                  <Link
                    to="/dashboard/stats"
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#111827] hover:border-orange-200 hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    Estatísticas
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
        <DashboardFooter store={selectedStore} />
    </div>
  )
}

