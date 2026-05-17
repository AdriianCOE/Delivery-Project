import { useCallback, useEffect, useMemo, useState } from 'react'
import { captureAppError } from '../../services/sentry'
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
} from 'react-icons/fi'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
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
    ''
  )
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-black text-[#111827]">{customerName}</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-black text-gray-600">
            {getOrderDisplayNumber(order)}
          </span>
          <StatusPill status={order.status} />
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
  const { user, storeId: authStoreId, storeIds: authStoreIds = [] } = useAuth()

  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [periodIdx, setPeriodIdx] = useState(1)
  const [toast, setToast] = useState(null)
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)
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

const activeUsers = usePresence(selectedStore?.id)

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

    if (!uid && !knownStoreIds.length) {
      setLoadingStores(false)
      setStores([])
      return undefined
    }

    setLoadingStores(true)

    const storesMap = new Map()
    const unsubscribers = []
    let errorCount = 0

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

    function subscribeToQuery(storesQuery) {
      const unsubscribe = onSnapshot(
        storesQuery,
        (snapshot) => {
          snapshot.docs.forEach((storeDoc) => {
            const store = normalizeStoreDoc(storeDoc)
            storesMap.set(storeDoc.id, store)
          })

          publishStores()
        },
        (error) => {
          errorCount += 1
          console.error('Erro ao carregar lojas:', error)

          if (storesMap.size === 0 && errorCount <= 1) {
            showToast('error', 'Erro ao carregar suas lojas. Confira regras, permissões ou índices do Firestore.')
          }

          setLoadingStores(false)
        }
      )

      unsubscribers.push(unsubscribe)
    }

    function subscribeToStoreDoc(storeDocId) {
      if (!storeDocId) return

      const unsubscribe = onSnapshot(
        doc(db, 'stores', storeDocId),
        (snapshot) => {
          if (snapshot.exists()) {
            storesMap.set(snapshot.id, normalizeStoreDoc(snapshot))
          }

          publishStores()
        },
        (error) => {
          console.error('Erro ao carregar loja por ID:', error)
          setLoadingStores(false)
        }
      )

      unsubscribers.push(unsubscribe)
    }

    if (uid) {
      subscribeToQuery(query(collection(db, 'stores'), where('ownerId', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('ownerUid', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('owner.uid', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('allowedUserIds', 'array-contains', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('merchantUids', 'array-contains', uid)))
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
  }, [knownStoreIds, knownStoreIdsKey, showToast, user?.uid])


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
    if (!selectedStore) {
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
  }, [selectedStore, showToast])

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
bestHourLabel,
      pendingCount: orders.filter((o) => normalizeStatus(o.status) === 'pendente').length,
      preparingCount: orders.filter((o) => normalizeStatus(o.status) === 'preparando').length,
      routeCount: orders.filter((o) => normalizeStatus(o.status) === 'em_rota').length,
      canceledCount: periodOrders.filter((o) => normalizeStatus(o.status) === 'cancelado').length,
    }
  }, [orders, period.days])

  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])

  return (
    <div className="min-w-0 pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 mb-6 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* LADO ESQUERDO */}
          <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
        {selectedStore?.logoUrl ? (
          <img src={selectedStore.logoUrl} className="h-full w-full rounded-2xl object-cover" alt="" />
        ) : (
          <FiActivity size={24} />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#111827]">
          Central de operação
        </h1>
        <p className="text-sm font-bold text-[#6b7280]">
          {selectedStore?.name || 'Sua loja'} · Gestão em tempo real
        </p>
      </div>
    </div>

          {/* LADO DIREITO: Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2">
            {stores.length > 1 && (
              <select
                value={selectedStoreId}
                onChange={(event) => handleSelectStore(event.target.value)}
                className="h-11 cursor-pointer rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
              >
                {stores.map((store) => (
                  <option key={store.id} value={getStoreDocId(store)}>
                    {store.name || store.storeSlug || store.id}
                  </option>
                ))}
              </select>
            )}

            {selectedStore && (
  <>
    <div className="hidden h-11 items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm sm:flex">
      <FiClock
        className={isStoreOpen(selectedStore) ? 'text-[#3aa824]' : 'text-red-500'}
        size={16}
      />

      <span>{todayOpeningHoursLabel}</span>
    </div>

    <div
      className={`inline-flex h-11 items-center gap-3 rounded-2xl border px-4 text-sm font-black shadow-sm transition ${
        hasPeopleOnMenu
          ? 'border-orange-100 bg-orange-50 text-[#111827]'
          : 'border-gray-100 bg-white text-[#111827]'
      }`}
      title={`${menuPeopleCount} ${menuPeopleLabel}`}
    >
      <div
        className={`relative flex h-8 w-8 items-center justify-center rounded-xl ${
          hasPeopleOnMenu
            ? 'bg-white text-[#f97316]'
            : 'bg-gray-50 text-[#6b7280]'
        }`}
      >
        <FiUsers size={16} />

        {hasPeopleOnMenu && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#f97316]" />
          </span>
        )}
      </div>

      <div className="leading-none">
        <p className="text-sm font-black text-[#111827]">
          {menuPeopleCount}
        </p>

        <p className="mt-0.5 hidden text-[10px] font-black uppercase tracking-wide text-[#6b7280] sm:block">
          {menuPeopleLabel}
        </p>
      </div>
    </div>
        <a
          href={storePublicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
        >
          <FiExternalLink />
          <span className="hidden sm:inline">Ver loja</span>
        </a>

    <button
  type="button"
  onClick={handleToggleStoreOpen}
  disabled={storeActionLoading}
  className={`
    relative flex h-11 min-w-[140px] items-center justify-center gap-2.5 rounded-[1.15rem] px-5 text-sm font-black text-white shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95 disabled:pointer-events-none disabled:opacity-70
    ${
      isStoreOpen(selectedStore)
        ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600 hover:shadow-red-500/40'
        : 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600 hover:shadow-emerald-500/40'
    }
  `}
>
  {storeActionLoading ? (
    <>
      <FiLoader size={16} className="animate-spin" />
      <span>Atualizando...</span>
    </>
  ) : isStoreOpen(selectedStore) ? (
    <>
      <FiPower size={16} className="opacity-90" />
      <span>Fechar loja</span>
    </>
  ) : (
    <>
      <FiPower size={16} className="opacity-90" />
      <span>Abrir loja</span>
    </>
  )}
</button>
    <button
      type="button"
      onClick={handleCopyStoreLink}
      className="hidden h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] lg:inline-flex"
      title="Copiar link da loja"
    >
      <FiCopy />
    </button>
  </>
)}
          <div className="hidden items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 ring-1 ring-emerald-100/50 sm:flex lg:px-4 lg:py-2">
        <div className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 lg:text-xs">
          Painel Ativo
        </span>
      </div>
      </div>
        </div>
      </header>
      
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {loadingStores ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-[1.7rem] bg-white" />
            ))}
          </div>
        ) : !selectedStore ? (
          <EmptyState
            icon={FiHome}
            title="Nenhuma loja encontrada"
            description="Seu usuário ainda não possui uma loja vinculada. Peça ao administrador para criar ou vincular uma loja ao seu acesso."
          />
        ) : (
          <>
            <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_auto]">
              <div className="rounded-[1.7rem] bg-[#111827] p-6 text-white shadow-xl shadow-gray-300/40">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-orange-100">
                      <FiShield className="text-[#f97316]" />
                      PratoBy em tempo real
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <StoreLogo
                        store={selectedStore}
                        className="h-16 w-16"
                        rounded="rounded-[1.3rem]"
                        fallbackClassName="bg-white/10 text-white ring-white/10"
                      />

                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
                          {selectedStore.name || 'Sua loja'}
                        </h2>

                        {storeSlug && (
                          <p className="mt-1 truncate text-xs font-bold text-gray-400">
                            /{storeSlug}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
                      Acompanhe pedidos, faturamento, produtos vendidos, promoções e pontos de atenção da operação.
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:min-w-0 xl:min-w-[420px]">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs font-bold text-gray-300">Pendentes</p>
                      <p className="mt-2 text-2xl font-black">{dashboardData.pendingCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs font-bold text-gray-300">Em preparo</p>
                      <p className="mt-2 text-2xl font-black">{dashboardData.preparingCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs font-bold text-gray-300">Em rota</p>
                      <p className="mt-2 text-2xl font-black">{dashboardData.routeCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm xl:w-80">
                <p className="text-sm font-black text-[#111827]">Status operacional</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#6b7280]">Loja</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${isStoreOpen(selectedStore) ? 'bg-green-50 text-[#3aa824]' : 'bg-red-50 text-red-600'}`}>
                      {isStoreOpen(selectedStore) ? 'Aberta' : 'Fechada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#6b7280]">Pedidos ativos</span>
                    <span className="text-sm font-black text-[#111827]">{dashboardData.activeOrders.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#6b7280]">Atenção</span>
<span
  className={`rounded-full px-3 py-1 text-xs font-black ${
    dashboardData.urgentOrders.length > 0
      ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
      : 'bg-green-50 text-[#3aa824]'
  }`}
>
  {dashboardData.urgentOrders.length > 0
    ? `${dashboardData.urgentOrders.length} urgente(s)`
    : 'Tudo certo'}
</span>
                  </div>
                </div>
              </div>
            </div>

{(dashboardData.urgentOrders.length > 0 || !isStoreOpen(selectedStore)) && (
  <div
    className={`mb-6 rounded-[1.5rem] border p-4 shadow-lg ${
      dashboardData.urgentOrders.length > 0
        ? 'border-red-200 bg-red-50 text-red-700 shadow-red-100/70'
        : 'border-amber-200 bg-amber-50 text-amber-800 shadow-amber-100/50'
    }`}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${
            dashboardData.urgentOrders.length > 0 ? 'bg-red-600' : 'bg-amber-500'
          }`}
        >
          <FiAlertTriangle
            className={dashboardData.urgentOrders.length > 0 ? 'animate-pulse' : ''}
            size={22}
          />
        </div>

        <div>
          <p className="text-sm font-black">
            {dashboardData.urgentOrders.length > 0
              ? `${dashboardData.urgentOrders.length} pedido(s) pendente(s) há mais de 3 minutos`
              : 'Loja fechada no momento'}
          </p>

          <p className="mt-1 text-xs font-bold leading-5">
            {dashboardData.urgentOrders.length > 0
              ? `Pedido mais antigo parado há ${dashboardData.oldestPendingMinutes} min. Aceite ou cancele para não deixar o cliente esperando.`
              : 'Abra a loja para voltar a receber pedidos no cardápio público.'}
          </p>
        </div>
      </div>

      {dashboardData.urgentOrders.length > 0 && (
        <Link
          to="/dashboard/orders"
          className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700"
        >
          Ver pedidos
        </Link>
      )}
    </div>
  </div>
)}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-2xl border border-gray-100 bg-white p-1 shadow-sm">
                {PERIOD_OPTIONS.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setPeriodIdx(index)}
                    className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                      periodIdx === index
                        ? 'bg-[#f97316] text-white shadow-sm'
                        : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => showToast('success', 'Os dados já estão sincronizados em tempo real.')}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#6b7280] shadow-sm transition hover:text-[#f97316]"
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

            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <div className="min-w-0 rounded-[1.7rem] border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 p-5">
                  <div>
                    <p className="text-sm font-black text-[#111827]">Pedidos recentes</p>
                    <p className="mt-1 text-xs text-[#6b7280]">Últimos pedidos recebidos pela loja</p>
                  </div>
                  <Link to="/dashboard/orders" className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2 text-sm font-black text-white transition hover:bg-[#ea580c]">
                    Ver todos <FiArrowUpRight />
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3 p-5">
                    {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-gray-50" />)}
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

                <div className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-black text-[#111827]">Ações rápidas</p>
                  <div className="mt-4 grid gap-3">
                    <Link to="/dashboard/orders" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]">
                      <span className="flex items-center gap-3"><FiShoppingBag /> Gerenciar pedidos</span>
                      <FiChevronRight />
                    </Link>
                    <Link to="/dashboard/stats" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]">
                      <span className="flex items-center gap-3"><FiBarChart2 /> Ver estatísticas</span>
                      <FiChevronRight />
                    </Link>
                    <a href={storePublicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-sm font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]">
                      <span className="flex items-center gap-3"><FiLayout /> Abrir cardápio público</span>
                      <FiExternalLink />
                    </a>
                  </div>
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

