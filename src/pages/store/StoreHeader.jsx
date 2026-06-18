import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCloudinaryImageSrcSet, getCloudinaryImageUrl } from '../../utils/cloudinaryImages'
import { formatBrazilianPhone, normalizeBrazilianPhoneForWhatsApp } from '../../utils/phone'
import { getPublicPixConfig, isPublicPaymentMethodAllowed } from '../../utils/publicPaymentMethods'
import {
  FiCheck,
  FiClock,
  FiCopy,
  FiDollarSign,
  FiExternalLink,
  FiHeart,
  FiInfo,
  FiInstagram,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiShare2,
  FiStar,
  FiTwitter,
  FiUser,
  FiX,
  FiCalendar,
  FiShoppingBag,
  FiGrid,
} from 'react-icons/fi'
import { FaPix, FaCreditCard } from "react-icons/fa6";
const FAVORITES_KEY = '@PratoBy:favorites'
const LEGACY_FAVORITES_KEY = '@DeliveryApp:favorites'
const DEFAULT_THEME = '#f97316'

const WEEK_DAYS = [
  {
    id: 'sun',
    key: 'sunday',
    aliases: ['sun', 'sunday', 'domingo', 'dom'],
    label: 'Dom',
    fullLabel: 'Domingo',
  },
  {
    id: 'mon',
    key: 'monday',
    aliases: ['mon', 'monday', 'segunda', 'seg'],
    label: 'Seg',
    fullLabel: 'Segunda',
  },
  {
    id: 'tue',
    key: 'tuesday',
    aliases: ['tue', 'tuesday', 'terca', 'terça', 'ter'],
    label: 'Ter',
    fullLabel: 'Terça',
  },
  {
    id: 'wed',
    key: 'wednesday',
    aliases: ['wed', 'wednesday', 'quarta', 'qua'],
    label: 'Qua',
    fullLabel: 'Quarta',
  },
  {
    id: 'thu',
    key: 'thursday',
    aliases: ['thu', 'thursday', 'quinta', 'qui'],
    label: 'Qui',
    fullLabel: 'Quinta',
  },
  {
    id: 'fri',
    key: 'friday',
    aliases: ['fri', 'friday', 'sexta', 'sex'],
    label: 'Sex',
    fullLabel: 'Sexta',
  },
  {
    id: 'sat',
    key: 'saturday',
    aliases: ['sat', 'saturday', 'sabado', 'sábado', 'sab'],
    label: 'Sáb',
    fullLabel: 'Sábado',
  },
]

function safeJsonParse(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function getFromLocalStorage(key, fallback = []) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback

  try {
    return safeJsonParse(window.localStorage.getItem(key), fallback)
  } catch {
    return fallback
  }
}

function setToLocalStorage(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ambientes privados ou bloqueados podem negar acesso ao localStorage.
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    if (typeof document === 'undefined') return false

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    return copied
  } catch {
    return false
  }
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean).map(String))]
}

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getStoreDescription(store) {
  return String(
    store?.description ||
    store?.shortDescription ||
    store?.about ||
    store?.bio ||
    store?.settings?.description ||
    store?.settings?.shortDescription ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function getStoreHeroDescription(store, description) {
  if (!description) return ''

  if (description.length <= 118) return description

  const context = stripAccents(`${store?.name || ''} ${description}`)
  const isConfectionery =
    context.includes('confeit') ||
    context.includes('doceria') ||
    context.includes('bolo') ||
    context.includes('doce') ||
    context.includes('sobremesa') ||
    context.includes('kit festa')

  if (isConfectionery) {
    return 'Bolos, doces, sobremesas e kits festa feitos com carinho.'
  }

  return `${description.slice(0, 132).replace(/\s+\S*$/, '').trim()}...`
}

function getStoreSlug(store) {
  return store?.storeSlug || store?.slug || store?.storeId || store?.id || ''
}

function getStoreKeys(store) {
  return uniqueArray([
    store?.storeSlug,
    store?.slug,
    store?.storeId,
    store?.id,
    store?.name,
  ])
}

function getStoreTheme(store) {
  return (
    store?.themeColor ||
    store?.brandColor ||
    store?.primaryColor ||
    store?.settings?.themeColor ||
    store?.settings?.brandColor ||
    DEFAULT_THEME
  )
}

function getRgba(color, alpha = 1) {
  const value = String(color || '').trim()

  if (!value.startsWith('#')) return `rgba(249, 115, 22, ${alpha})`

  const hex = value.replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hex

  if (normalized.length !== 6) return `rgba(249, 115, 22, ${alpha})`

  const number = Number.parseInt(normalized, 16)
  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getBannerDesktopSource(store) {
  return (
    store?.bannerUrl ||
      store?.bannerURL ||
      store?.coverUrl ||
      store?.coverURL ||
      store?.bannerImageUrl ||
      store?.coverImageUrl ||
      store?.settings?.bannerUrl ||
      ''
  )
}

function getBannerMobileSource(store) {
  return (
    store?.bannerMobileUrl ||
      store?.mobileBannerUrl ||
      store?.mobileBannerURL ||
      store?.settings?.bannerMobileUrl ||
      store?.settings?.mobileBannerUrl ||
      ''
  )
}

function getLogoSource(store) {
  return (
    store?.logoUrl ||
      store?.logoURL ||
      store?.logo ||
      store?.avatarUrl ||
      store?.imageUrl ||
      store?.photoUrl ||
      store?.settings?.logoUrl ||
      ''
  )
}

function getBannerDesktopUrl(store) {
  return getCloudinaryImageUrl(getBannerDesktopSource(store), 'storeBanner', {
    replaceExistingTransform: true,
  })
}

function getBannerMobileUrl(store) {
  return getCloudinaryImageUrl(getBannerMobileSource(store), 'storeBannerMobile', {
    replaceExistingTransform: true,
  })
}

function getLogoUrl(store) {
  return getCloudinaryImageUrl(getLogoSource(store), 'storeLogo')
}





function getStoreWhatsapp(store) {
  return (
    store?.whatsapp ||
    store?.whatsapp1 ||
    store?.phone ||
    store?.telephone ||
    store?.contactPhone ||
    store?.supportPhone ||
    store?.settings?.whatsapp ||
    store?.settings?.phone ||
    ''
  )
}

function sanitizeSocial(value) {
  const social = String(value || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?(instagram\.com|twitter\.com|x\.com)\//i, '')
    .split(/[/?#]/)[0]

  return social.replace(/^@/, '').trim()
}

const PRATOBY_INSTAGRAM = 'pratobybr'

function getPublicPlanId(store) {
  return String(
    store?.publicPlan ||
      store?.plan ||
      store?.planId ||
      store?.subscription?.planId ||
      store?.billing?.planId ||
      'essential'
  )
    .trim()
    .toLowerCase()
}

function shouldShowPratoBySocial(store) {
  const planId = getPublicPlanId(store)

  const hideBranding =
    store?.removePratoByBranding === true ||
    store?.branding?.removePratoByBranding === true ||
    store?.branding?.hidePratoByBranding === true ||
    store?.publicBranding?.removePratoByBranding === true ||
    store?.publicBranding?.hidePratoByBranding === true

  if (hideBranding) return false

  return planId !== 'premium'
}

function getInstagram(store) {
  return sanitizeSocial(
    store?.instagram ||
      store?.social?.instagram ||
      store?.settings?.instagram ||
      store?.links?.instagram ||
      ''
  )
}

function getTwitter(store) {
  return sanitizeSocial(
    store?.twitter ||
      store?.x ||
      store?.social?.twitter ||
      store?.social?.x ||
      store?.settings?.twitter ||
      store?.settings?.x ||
      store?.links?.twitter ||
      store?.links?.x ||
      ''
  )
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numberValue = Number(value || 0)

  // Compatibilidade com versões antigas que salvavam valor em centavos.
  if (numberValue > 999) return numberValue / 100

  return numberValue
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getMinOrder(store) {
  return normalizeMoney(
    store?.minOrder ?? store?.minimumOrder ?? store?.settings?.minOrder,
    store?.minOrderCents ??
      store?.minimumOrderCents ??
      store?.settings?.minOrderCents
  )
}

function getAddressData(store) {
  const address = store?.address || store?.location || {}

  if (typeof address === 'string') {
    return {
      full: address,
      street: address,
      number: '',
      neighborhood: store?.neighborhood || '',
      complement: '',
      city: store?.city || '',
      state: store?.state || '',
      cep: store?.cep || '',
    }
  }

  const street = address.street || address.rua || address.address || store?.street || ''
  const number = address.number || address.numero || store?.number || ''
  const neighborhood =
    address.neighborhood || address.bairro || store?.neighborhood || ''
  const complement =
    address.complement || address.complemento || store?.complement || ''
  const city = address.city || address.cidade || store?.city || ''
  const state = address.state || address.uf || store?.state || ''
  const cep = address.cep || store?.cep || ''

  const mainLine = [street, number].filter(Boolean).join(', ')
  const secondLine = [neighborhood, city, state].filter(Boolean).join(' - ')

  return {
    full: [mainLine, secondLine].filter(Boolean).join(' · '),
    street,
    number,
    neighborhood,
    complement,
    city,
    state,
    cep,
  }
}

function normalizeTime(value) {
  if (!value) return ''

  const str = String(value).trim().replace('h', ':')
  const match = str.match(/^(\d{1,2}):(\d{2})/)

  if (!match) return str

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function splitDays(days) {
  if (!days) return []
  if (Array.isArray(days)) return days.filter(Boolean)

  return String(days)
    .split(/[,+;/|]/)
    .map((day) => day.trim())
    .filter(Boolean)
}

function parseHourString(value) {
  const str = String(value || '').trim()

  if (!str) return null

  const lowered = stripAccents(str)
  if (lowered.includes('fechado')) {
    return { open: '', close: '', enabled: false }
  }

  const match = str.match(/(\d{1,2}[:h]\d{2})\s*(?:-|a|às|as|até|ate)\s*(\d{1,2}[:h]\d{2})/i)

  if (!match) return { open: normalizeTime(str), close: '', enabled: true }

  return {
    open: normalizeTime(match[1]),
    close: normalizeTime(match[2]),
    enabled: true,
  }
}

function getDayLabel(day) {
  const normalized = stripAccents(day)
  const found = WEEK_DAYS.find((item) => {
    const keys = [item.id, item.key, item.label, item.fullLabel, ...item.aliases]
    return keys.some((alias) => stripAccents(alias) === normalized)
  })

  return found?.label || String(day || '')
}

function getDayKey(day) {
  const normalized = stripAccents(day)
  const found = WEEK_DAYS.find((item) => {
    const keys = [item.id, item.key, item.label, item.fullLabel, ...item.aliases]
    return keys.some((alias) => stripAccents(alias) === normalized)
  })

  return found?.id || normalized
}

function getTodayKey() {
  return WEEK_DAYS[new Date().getDay()]?.id || 'sun'
}

function getYesterdayKey() {
  return WEEK_DAYS[(new Date().getDay() + 6) % 7]?.id || 'sat'
}

function formatDays(days) {
  const normalizedDays = splitDays(days)

  if (normalizedDays.length === 0) return 'Todos os dias'

  const labels = normalizedDays.map(getDayLabel).filter(Boolean)
  return labels.length ? labels.join(', ') : 'Todos os dias'
}

function normalizeHourItem(item, fallbackDay = null) {
  if (!item) return null

  if (typeof item === 'string') {
    const parsed = parseHourString(item)
    if (!parsed) return null

    return {
      days: fallbackDay ? [fallbackDay] : [],
      open: parsed.open,
      close: parsed.close,
      enabled: parsed.enabled,
    }
  }

  if (typeof item !== 'object') return null

  const enabled =
    item.enabled ??
    item.active ??
    item.isOpen ??
    item.opened ??
    (item.closed === true ? false : true)

  if (enabled === false) {
    return {
      days: splitDays(item.days || item.weekdays || item.activeDays || fallbackDay),
      open: '',
      close: '',
      enabled: false,
    }
  }

  const open = normalizeTime(
    item.open || item.openAt || item.from || item.start || item.abre || item.openTime
  )
  const close = normalizeTime(
    item.close || item.closeAt || item.to || item.end || item.fecha || item.closeTime
  )

  return {
    days: splitDays(item.days || item.weekdays || item.activeDays || fallbackDay),
    open,
    close,
    enabled: true,
  }
}

function getBusinessHours(store) {
  const source =
    store?.openingHours ||
    store?.settings?.openingHours ||
    store?.businessHours ||
    store?.settings?.businessHours ||
    store?.hours ||
    null

  if (Array.isArray(source) && source.length > 0) {
    return source.map((item) => normalizeHourItem(item)).filter(Boolean)
  }

  if (source && typeof source === 'object') {
    if (source.open || source.close || source.openAt || source.closeAt) {
      return [
        normalizeHourItem({
          days: source.days || store?.activeDays || [],
          open: source.open || source.openAt,
          close: source.close || source.closeAt,
          enabled: source.enabled ?? true,
        }),
      ].filter(Boolean)
    }

    const normalized = WEEK_DAYS.map((day) => {
      const raw =
        source[day.id] ||
        source[day.key] ||
        source[day.label] ||
        source[day.fullLabel] ||
        source[stripAccents(day.fullLabel)] ||
        source[day.aliases.find((alias) => source[alias])]

      return normalizeHourItem(raw, day.id)
    }).filter(Boolean)

    if (normalized.length > 0) return normalized
  }

  if (Array.isArray(store?.activeDays) && store.activeDays.length > 0) {
    return [
      normalizeHourItem({
        days: store.activeDays,
        open: store?.hoursOpen || store?.openAt || store?.openTime,
        close: store?.hoursClose || store?.closeAt || store?.closeTime,
      }),
    ].filter(Boolean)
  }

  if (store?.hoursOpen || store?.hoursClose || store?.openAt || store?.closeAt) {
    return [
      normalizeHourItem({
        days: [],
        open: store?.hoursOpen || store?.openAt,
        close: store?.hoursClose || store?.closeAt,
      }),
    ].filter(Boolean)
  }

  return []
}

function getTodayHoursLabel(businessHours) {
  if (!businessHours.length) return 'Horário não informado'

  const todayKey = getTodayKey()
  const today = businessHours.find((item) => {
    if (!Array.isArray(item.days) || item.days.length === 0) return true
    return item.days.map(getDayKey).includes(todayKey)
  })

  if (!today || today.enabled === false) return 'Fechado hoje'
  if (!today.open && !today.close) return 'Horário não informado'

  return `Hoje: ${today.open || '--:--'} às ${today.close || '--:--'}`
}

function parseTimeToMinutes(value) {
  const normalized = normalizeTime(value)

  if (!normalized || !normalized.includes(':')) return null

  const [hours, minutes] = normalized.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  return hours * 60 + minutes
}

function getCurrentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function isTimeWithinRange(open, close, currentMinutes = getCurrentMinutes()) {
  const openMinutes = parseTimeToMinutes(open)
  const closeMinutes = parseTimeToMinutes(close)

  if (openMinutes === null || closeMinutes === null) return true
  if (openMinutes === closeMinutes) return true

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

function getScheduleStatus(businessHours) {
  if (!businessHours.length) {
    return {
      hasSchedule: false,
      isWithinSchedule: true,
      todayLabel: 'Horário não informado',
    }
  }

  const todayKey = getTodayKey()
  const yesterdayKey = getYesterdayKey()
  const currentMinutes = getCurrentMinutes()

  const todayItem = businessHours.find((item) => {
    if (!Array.isArray(item.days) || item.days.length === 0) return true
    return item.days.map(getDayKey).includes(todayKey)
  })

  const todayLabel = getTodayHoursLabel(businessHours)

  if (!todayItem || todayItem.enabled === false) {
    return {
      hasSchedule: true,
      isWithinSchedule: false,
      todayLabel,
    }
  }

  if (!todayItem.open && !todayItem.close) {
    return {
      hasSchedule: true,
      isWithinSchedule: true,
      todayLabel,
    }
  }

  const isTodayOpenNow = isTimeWithinRange(
    todayItem.open,
    todayItem.close,
    currentMinutes
  )

  if (isTodayOpenNow) {
    return {
      hasSchedule: true,
      isWithinSchedule: true,
      todayLabel,
    }
  }

  const yesterdayItem = businessHours.find((item) => {
    if (!Array.isArray(item.days) || item.days.length === 0) return false
    return item.days.map(getDayKey).includes(yesterdayKey)
  })

  const yesterdayOpen = parseTimeToMinutes(yesterdayItem?.open)
  const yesterdayClose = parseTimeToMinutes(yesterdayItem?.close)
  const yesterdayCrossesMidnight =
    yesterdayItem?.enabled !== false &&
    yesterdayOpen !== null &&
    yesterdayClose !== null &&
    yesterdayClose <= yesterdayOpen

  return {
    hasSchedule: true,
    isWithinSchedule: Boolean(yesterdayCrossesMidnight && currentMinutes < yesterdayClose),
    todayLabel,
  }
}

function mapSharedOperationalStatus(status) {
  if (!status) return null

  if (status.isOpen) {
    return {
      label: 'Aberto agora',
      description: status.label || 'A loja estÃ¡ recebendo pedidos.',
      isOpen: true,
      tone: 'success',
    }
  }

  if (status.reason === 'temporary-pause') {
    return {
      label: 'Pausada temporariamente',
      description: status.label || 'A loja estÃ¡ pausada no momento.',
      mobileDescription: 'Loja pausada agora. VocÃª ainda pode ver o cardÃ¡pio.',
      isOpen: false,
      tone: 'warning',
    }
  }

  if (status.reason === 'store-blocked') {
    return {
      label: 'Loja indisponÃ­vel',
      description: status.label || 'Esta loja nÃ£o estÃ¡ disponÃ­vel no momento.',
      isOpen: false,
      tone: 'danger',
    }
  }

  return {
    label: 'Fechada agora',
    description: status.label || 'A loja estÃ¡ fechada agora, mas vocÃª pode ver o cardÃ¡pio.',
    mobileDescription: 'Loja fechada agora. VocÃª ainda pode ver o cardÃ¡pio.',
    isOpen: false,
    tone: 'warning',
  }
}

function getOperationalStatus(store, scheduleStatus = {}) {
  const sharedStatus = mapSharedOperationalStatus(store?.operationalStatus)
  if (sharedStatus) return sharedStatus

  const status = stripAccents(store?.status || store?.storeStatus || '')

  if (store?.isDeleted) {
    return {
      label: 'Loja indisponível',
      description: 'Esta loja não está disponível no momento.',
      isOpen: false,
      tone: 'danger',
    }
  }

  if (store?.isBlocked) {
    return {
      label: 'Loja bloqueada',
      description: 'Esta loja está temporariamente bloqueada.',
      isOpen: false,
      tone: 'danger',
    }
  }

  if (store?.isActive === false || status === 'inactive' || status === 'inativa') {
    return {
      label: 'Loja inativa',
      description: 'Esta loja está inativa no sistema.',
      isOpen: false,
      tone: 'neutral',
    }
  }

  if (
    store?.isOpen === false ||
    store?.open === false ||
    status === 'closed' ||
    status === 'fechada'
  ) {
    return {
      label: 'Pedidos pausados',
      description:
        'A loja está fechada agora, mas você pode ver o cardápio e voltar no próximo horário.',
      mobileDescription: 'Loja fechada agora. Você ainda pode ver o cardápio.',
      isOpen: false,
      tone: 'warning',
    }
  }

  if (scheduleStatus.hasSchedule && !scheduleStatus.isWithinSchedule) {
    return {
      label: 'Fora do horário',
      description: 'Pedidos liberados apenas quando loja estiver aberta.',
      isOpen: false,
      tone: 'warning',
    }
  }

  return {
    label: 'Aberto agora',
    description: 'A loja está recebendo pedidos.',
    isOpen: true,
    tone: 'success',
  }
}

function StatusBadge({ status, themeColor }) {
  const styles = {
    success: {
      bg: getRgba(themeColor, 0.1),
      color: themeColor,
      dot: themeColor,
    },
    warning: {
      bg: '#fff7ed',
      color: '#ea580c',
      dot: '#f97316',
    },
    danger: {
      bg: '#fef2f2',
      color: '#dc2626',
      dot: '#ef4444',
    },
    neutral: {
      bg: '#f3f4f6',
      color: '#4b5563',
      dot: '#9ca3af',
    },
  }

  const current = styles[status.tone] || styles.success

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide sm:px-3 sm:py-1.5 sm:text-[11px]"
      style={{ backgroundColor: current.bg, color: current.color }}
    >
      <span
        className="h-2 w-2 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.85)]"
        style={{ backgroundColor: current.dot }}
      />
      {status.label}
    </span>
  )
}

function HeaderActionButton({
  label,
  desktopLabel = '',
  showLabelOnDesktop = false,
  onClick,
  children,
  active = false,
  animate = false,
  themeColor,
}) {
  const text = desktopLabel || label

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group flex h-8 min-w-8 shrink-0 items-center justify-center gap-2 rounded-xl border px-0 text-[#111827] shadow-sm ring-1 ring-white/70 transition duration-200 hover:-translate-y-0.5 active:scale-95 sm:h-11 sm:min-w-11 sm:rounded-2xl lg:h-10 lg:min-w-10 lg:rounded-xl lg:shadow-none ${
        showLabelOnDesktop
          ? 'lg:w-auto lg:min-w-0 lg:px-3.5'
          : 'lg:w-10 lg:px-0'
      } ${
        active
          ? 'border-red-100 bg-red-50 text-red-500'
          : 'border-gray-100 bg-white hover:border-orange-100 hover:bg-orange-50'
      } ${animate ? 'scale-110' : ''}`}
      style={active ? undefined : { '--hover-color': themeColor }}
    >
      <span className="flex shrink-0 items-center justify-center">
        {children}
      </span>

      {showLabelOnDesktop && (
        <span className="hidden whitespace-nowrap text-xs font-black lg:inline">
          {text}
        </span>
      )}
    </button>
  )
}

function InfoPill({ icon: Icon, children, themeColor }) {
  if (!children) return null

  return (
    <span className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-gray-100 bg-[#f9fafb] px-3 py-2 text-[11px] font-black text-[#111827] shadow-sm sm:text-xs">
      {Icon ? <Icon className="shrink-0" style={{ color: themeColor }} /> : null}
      <span>{children}</span>
    </span>
  )
}

function InfoRow({ icon: Icon, label, value, action, themeColor }) {
  if (!value && !action) return null

  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] p-4 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
        style={{ color: themeColor }}
      >
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
          {label}
        </p>

        {value && (
          <p className="mt-1 break-words text-sm font-bold leading-6 text-[#111827]">
            {value}
          </p>
        )}
      </div>

      {action}
    </div>
  )
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getStoreSchedulingConfig(store) {
  const settings = store?.settings || {}
  const candidates = [
    store?.publicScheduling,
    store?.scheduling,
    settings?.scheduling,
    store?.scheduledOrders,
    settings?.scheduledOrders,
  ]

  const scheduling = candidates.find((candidate) => isObject(candidate)) || {}
  const legacyEnabled =
    store?.schedulingEnabled === true ||
    store?.acceptScheduling === true ||
    store?.acceptScheduledOrders === true ||
    settings?.schedulingEnabled === true ||
    settings?.acceptScheduling === true ||
    settings?.acceptScheduledOrders === true

  return {
    ...scheduling,
    enabled: scheduling.enabled === true || legacyEnabled,
  }
}

function getAcceptedServiceTypes(store) {
  const settings = store?.settings || {}
  const publicScheduling = getStoreSchedulingConfig(store)

  const acceptsDelivery =
    store?.acceptDelivery ??
    settings?.acceptDelivery ??
    store?.deliveryEnabled ??
    true

  const acceptsPickup =
    store?.acceptPickup ??
    settings?.acceptPickup ??
    store?.pickupEnabled ??
    false

  const schedulingEnabled = publicScheduling?.enabled === true

  const schedulingFulfillment = publicScheduling?.fulfillmentTypes || {}

  const scheduledDelivery =
    schedulingEnabled &&
    acceptsDelivery !== false &&
    schedulingFulfillment.delivery !== false

  const scheduledPickup =
    schedulingEnabled &&
    acceptsPickup !== false &&
    schedulingFulfillment.pickup !== false

  return [
    acceptsDelivery !== false && {
      id: 'delivery',
      label: 'Entrega',
      icon: FiMapPin,
      description: 'Receba no endereço informado',
    },
    acceptsPickup !== false && {
      id: 'pickup',
      label: 'Retirada',
      icon: FiShoppingBag,
      description: 'Retire seu pedido no balcão',
    },
    schedulingEnabled && {
      id: 'scheduled',
      label: 'Agendamento',
      icon: FiCalendar,
      description:
        scheduledDelivery && scheduledPickup
          ? 'Escolha data e horário para entrega ou retirada'
          : scheduledDelivery
            ? 'Escolha data e horário para entrega'
            : scheduledPickup
              ? 'Escolha data e horário para retirada'
              : 'Escolha data e horário para encomendas',
    },
  ].filter(Boolean)
}

function getAcceptedPaymentMethods(store) {
  const pixConfig = getPublicPixConfig(store)
  const pixEnabled =
    isPublicPaymentMethodAllowed(store, 'pix') &&
    pixConfig.enabled === true

  const cardEnabled = isPublicPaymentMethodAllowed(store, 'card')
  const cashEnabled = isPublicPaymentMethodAllowed(store, 'cash')

  return [
    pixEnabled && {
      id: 'pix',
      label: 'Pix',
      icon: FaPix,
      description: 'Pagamento direto para a loja',
    },
    cardEnabled && {
      id: 'card',
      label: 'Cartão',
      icon: FaCreditCard,
      description: 'Débito ou crédito na entrega',
    },
    cashEnabled && {
      id: 'cash',
      label: 'Dinheiro',
      icon: FiDollarSign,
      description: 'Com opção de troco',
    },
  ].filter(Boolean)
}

export default function StoreHeader({ store, onOpenProfile, activeUsers = 0 }) {
  const storeDescription = useMemo(() => getStoreDescription(store), [store])
  const heroDescription = useMemo(
    () => getStoreHeroDescription(store, storeDescription),
    [store, storeDescription]
  )
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [QrCodeSvg, setQrCodeSvg] = useState(null)
  const [favorited, setFavorited] = useState(false)
  const [animateHeart, setAnimateHeart] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const themeColor = getStoreTheme(store)
  const themeSoft = getRgba(themeColor, 0.1)
  const themeSofter = getRgba(themeColor, 0.06)

  const bannerDesktopUrl = useMemo(() => getBannerDesktopUrl(store), [store])
  const bannerMobileUrl = useMemo(() => getBannerMobileUrl(store), [store])
  const bannerUrl = bannerDesktopUrl || bannerMobileUrl
  const bannerDesktopSrcSet = useMemo(
    () => getCloudinaryImageSrcSet(
      getBannerDesktopSource(store),
      ['storeBannerSmall', 'storeBanner', 'storeBannerLarge'],
      { replaceExistingTransform: true }
    ),
    [store]
  )
  const bannerMobileSrcSet = useMemo(
    () => getCloudinaryImageSrcSet(
      getBannerMobileSource(store),
      ['storeBannerMobileSmall', 'storeBannerMobile', 'storeBannerMobileLarge'],
      { replaceExistingTransform: true }
    ),
    [store]
  )
  const logoUrl = useMemo(() => getLogoUrl(store), [store])
  const logoSrcSet = useMemo(
    () => getCloudinaryImageSrcSet(
      getLogoSource(store),
      ['storeLogoSmall', 'storeLogo', 'storeLogoLarge']
    ),
    [store]
  )
  const logoInitial = String(store?.name || 'L').trim().charAt(0).toUpperCase()
  const storeSlug = getStoreSlug(store)
  const storeKeys = useMemo(() => getStoreKeys(store), [store])
  const primaryFavoriteKey = storeKeys[0] || store?.id || store?.name

  const whatsapp = getStoreWhatsapp(store)
  const whatsappDigits = normalizeBrazilianPhoneForWhatsApp(whatsapp)
  const instagram = getInstagram(store)
  const twitter = getTwitter(store)
  const showPratoBySocial = shouldShowPratoBySocial(store)
  const address = useMemo(() => getAddressData(store), [store])
  const mapSearchUrl = useMemo(() => {
    if (!address.full) return ''

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.full)}`
  }, [address.full])
  const mapEmbedUrl = useMemo(() => {
    if (!address.full) return ''

    return `https://www.google.com/maps?q=${encodeURIComponent(address.full)}&output=embed`
  }, [address.full])
  const acceptedPaymentMethods = useMemo(
    () => getAcceptedPaymentMethods(store),
    [store]
  )
  const acceptedServiceTypes = useMemo(
  () => getAcceptedServiceTypes(store),
  [store]
  )
  const businessHours = useMemo(() => getBusinessHours(store), [store])
  const scheduleStatus = useMemo(() => getScheduleStatus(businessHours), [businessHours])
  const todayHoursLabel = scheduleStatus.todayLabel
  const minOrder = getMinOrder(store)
  const operationalStatus = getOperationalStatus(store, scheduleStatus)
  const ratingLabel =
    store?.rating ||
    store?.averageRating ||
    store?.ratingAverage ||
    store?.reviewsAverage ||
    store?.reviewScore ||
    '4.9'
  const activeUsersCount = Math.max(0, Number(activeUsers || 0))

  const publicUrl = useMemo(() => {
    const path = storeSlug || store?.slug || store?.id || ''

    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path ? `/${path}` : ''}`
    }

    return path ? `/${path}` : '/'
  }, [store?.id, store?.slug, storeSlug])

  const deliveryTime =
    store?.deliveryTime ||
    store?.estimatedDeliveryTime ||
    store?.settings?.estimatedDeliveryTime ||
    store?.deliveryEstimate ||
    '25-40 min'

  useEffect(() => {
    if (!primaryFavoriteKey) return

    const currentFavorites = getFromLocalStorage(FAVORITES_KEY, [])
    const legacyFavorites = getFromLocalStorage(LEGACY_FAVORITES_KEY, [])
    const mergedFavorites = uniqueArray([...currentFavorites, ...legacyFavorites])

    setToLocalStorage(FAVORITES_KEY, mergedFavorites)
    queueMicrotask(() => {
    setFavorited(storeKeys.some((key) => mergedFavorites.includes(key)))
  })
}, [primaryFavoriteKey, storeKeys])
  useEffect(() => {
    if ((!showModal && !showQrModal) || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowModal(false)
        setShowQrModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal, showQrModal])
  useEffect(() => {
    if (!showQrModal || QrCodeSvg) return undefined

    let mounted = true

    import('qrcode.react')
      .then((module) => {
        if (mounted) {
          setQrCodeSvg(() => module.QRCodeSVG)
        }
      })
      .catch((error) => {
        console.warn('[StoreHeader] Não foi possível carregar QR Code.', error)
      })

    return () => {
      mounted = false
    }
  }, [QrCodeSvg, showQrModal])

  const triggerCopiedToast = useCallback(() => {
    setCopied(true)

    if (typeof window !== 'undefined') {
      window.setTimeout(() => setCopied(false), 2200)
    }
  }, [])

  const toggleFavorite = useCallback(() => {
    if (!primaryFavoriteKey) return

    const currentFavorites = getFromLocalStorage(FAVORITES_KEY, [])
    const exists = storeKeys.some((key) => currentFavorites.includes(key))

    const nextFavorites = exists
      ? currentFavorites.filter((item) => !storeKeys.includes(item))
      : uniqueArray([...currentFavorites, primaryFavoriteKey])

    setToLocalStorage(FAVORITES_KEY, nextFavorites)
    setFavorited(!exists)

    if (!exists) {
      setAnimateHeart(true)

      if (typeof window !== 'undefined') {
        window.setTimeout(() => setAnimateHeart(false), 350)
      }
    }
  }, [primaryFavoriteKey, storeKeys])

  const handleCopyLink = useCallback(async () => {
    const copiedLink = await copyTextToClipboard(publicUrl)
    if (copiedLink) triggerCopiedToast()
  }, [publicUrl, triggerCopiedToast])

  const handleShare = useCallback(async () => {
    const shareData = {
      title: store?.name || 'PratoBy',
      text: `Peça online em ${store?.name || 'nossa loja'} pelo PratoBy.`,
      url: publicUrl,
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }

      const copiedLink = await copyTextToClipboard(publicUrl)
      if (copiedLink) triggerCopiedToast()
    } catch {
      // Compartilhamento cancelado pelo usuário ou indisponível.
    }
  }, [publicUrl, store?.name, triggerCopiedToast])

  const handleOpenProfile = useCallback(() => {
    if (onOpenProfile) onOpenProfile()
  }, [onOpenProfile])

  const handleOpenWhatsApp = useCallback(() => {
    if (!whatsappDigits || typeof window === 'undefined') return

    const message = encodeURIComponent(
      `Olá! Vim pelo PratoBy e gostaria de falar com ${store?.name || 'a loja'}.`
    )

    window.open(
      `https://wa.me/${whatsappDigits}?text=${message}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [store?.name, whatsappDigits])

  return (
    <header className="relative w-full overflow-visible bg-[#fff8f1]">
      <div className="store-banner-shell relative aspect-[9/5] w-full overflow-hidden border-b border-white/70 sm:aspect-[3/1] lg:max-h-[500px]">
  {bannerUrl ? (
    <picture>
      {bannerMobileUrl && (
        <source
          media="(max-width: 640px)"
          srcSet={bannerMobileSrcSet || `${bannerMobileUrl} 640w`}
          sizes="100vw"
        />
      )}
      <img
        src={bannerUrl}
        srcSet={bannerDesktopSrcSet || `${bannerUrl} 1440w${bannerMobileUrl ? `, ${bannerMobileUrl} 640w` : ''}`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        className="store-banner-bg absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
        loading="eager"
        decoding="async"
        width={1440}
        height={480}
      />
    </picture>
  ) : (
    <div
      className="store-banner-bg absolute inset-0"
      style={{
        background: `linear-gradient(135deg, ${themeColor} 0%, #111827 135%)`,
      }}
    />
  )}

  <div className="absolute inset-0 bg-gradient-to-b from-black/[0.025] via-white/[0.015] to-[#fff8f1]/80" />
  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#fff8f1] via-[#fff8f1]/55 to-transparent sm:h-24" />
  <div
    className="pointer-events-none absolute inset-0 opacity-40"
    style={{
      background: `radial-gradient(circle at 18% 12%, ${getRgba(themeColor, 0.35)}, transparent 34%)`,
    }}
  />
</div>

      <section className="relative z-10 mx-auto -mt-7 max-w-[1120px] px-3 pb-3 sm:-mt-14 sm:px-4 sm:pb-4 lg:-mt-24">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 shadow-2xl shadow-gray-200/80 ring-1 ring-gray-100/80 backdrop-blur-xl sm:rounded-[2.15rem]">
          <div
            className="h-1.5 w-full"
            style={{
              background: `linear-gradient(90deg, ${themeColor}, ${getRgba(
                themeColor,
                0.25
              )}, transparent)`,
            }}
          />

          <div className="p-3.5 sm:p-5 lg:p-6">
            <div className="flex min-w-0 items-start gap-3 sm:gap-5 lg:items-center">
              <div className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 sm:w-28 lg:w-[120px]">
                <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-[1.25rem] bg-white shadow-md shadow-gray-200/80 ring-1 ring-gray-100 sm:h-28 sm:w-28 sm:rounded-[1.7rem] lg:h-[120px] lg:w-[120px]">
    {logoUrl ? (
      <img
        src={logoUrl}
        srcSet={logoSrcSet || undefined}
        sizes="(max-width: 640px) 76px, 120px"
        alt={store?.name || 'Logo da loja'}
        className="h-full w-full object-cover"
        loading="eager"
        decoding="async"
        width={120}
        height={120}
      />
    ) : (
      <span
        className="flex h-full w-full items-center justify-center text-2xl font-black sm:text-4xl"
        style={{ color: themeColor }}
      >
        {logoInitial}
      </span>
    )}
  </div>

  {activeUsersCount > 1 && (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-500 ring-1 ring-slate-100 sm:hidden">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
      </span>

      {activeUsersCount} vendo
    </span>
  )}
</div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 sm:mb-2">
  <StatusBadge status={operationalStatus} themeColor={themeColor} />

  <span className="hidden items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-600 ring-1 ring-orange-100/80 sm:inline-flex sm:px-3 sm:py-1.5">
    <FiStar size={13} strokeWidth={2.4} />
    {ratingLabel}
  </span>

  {activeUsersCount > 1 && (
    <span className="hidden items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100 sm:inline-flex sm:px-3 sm:py-1.5 sm:text-[11px]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
      </span>

      {activeUsersCount} vendo agora
    </span>
  )}
</div>

                    <button
  type="button"
  onClick={() => setShowModal(true)}
  className="group block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
  aria-label="Abrir informações da loja"
>
  <span className="block min-w-0">
    <h1 className="min-w-0 whitespace-normal break-words text-[1.12rem] font-black leading-tight tracking-tight text-[#111827] transition group-hover:text-orange-600 sm:text-4xl lg:text-[2.45rem]">
      {store?.name || 'Loja'}
    </h1>
  </span>
</button>
                  </div>

<div className="flex shrink-0 items-start justify-end pb-1 lg:ml-5">
  <div className="flex items-center justify-end gap-1 overflow-visible sm:gap-2 lg:gap-1.5 lg:rounded-2xl lg:border lg:border-gray-100 lg:bg-white/70 lg:p-1 lg:shadow-sm lg:ring-1 lg:ring-gray-100/70">
    <HeaderActionButton
      label="Informações da loja"
      desktopLabel="Info"
      showLabelOnDesktop
      onClick={() => setShowModal(true)}
      themeColor={themeColor}
    >
      <FiInfo size={18} />
    </HeaderActionButton>

    <HeaderActionButton
      label={copied ? 'Link copiado' : 'Compartilhar loja'}
      desktopLabel={copied ? 'Copiado' : 'Compartilhar'}
      showLabelOnDesktop
      onClick={handleShare}
      themeColor={themeColor}
    >
      {copied ? <FiCheck size={18} /> : <FiShare2 size={18} />}
    </HeaderActionButton>

    <HeaderActionButton
      label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      onClick={toggleFavorite}
      active={favorited}
      animate={animateHeart}
      themeColor={themeColor}
    >
      <FiHeart
        size={18}
        className={favorited ? 'fill-red-500 text-red-500' : ''}
      />
    </HeaderActionButton>

    {onOpenProfile && (
      <HeaderActionButton
        label="Abrir meus pedidos"
        onClick={handleOpenProfile}
        themeColor={themeColor}
      >
        <FiUser size={18} />
      </HeaderActionButton>
    )}
    </div>
  </div>
</div>

                {heroDescription && (
                  <p className="mt-2 max-h-10 overflow-hidden text-[13px] font-medium leading-5 text-[#6b7280] sm:mt-3 sm:max-h-none sm:text-[15px] sm:leading-6 lg:max-w-2xl">
                    {heroDescription}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-4 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              <InfoPill icon={FiClock} themeColor={themeColor}>
                {todayHoursLabel}
              </InfoPill>

              <InfoPill icon={FiClock} themeColor={themeColor}>
                {deliveryTime}
              </InfoPill>

              {address?.city && (
                <InfoPill icon={FiMapPin} themeColor={themeColor}>
                  {address.city}
                </InfoPill>
              )}

              {minOrder > 0 && (
                <span className="hidden sm:inline-flex">
                  <InfoPill icon={FiDollarSign} themeColor={themeColor}>
                    Mínimo {formatMoney(minOrder)}
                  </InfoPill>
                </span>
              )}
            </div>

            {!operationalStatus.isOpen && (
              <div
                className="mt-3 rounded-2xl border px-3.5 py-3 text-sm font-bold leading-6 sm:mt-4 sm:px-4"
                style={{
                  borderColor:
                    operationalStatus.tone === 'danger'
                      ? '#fecaca'
                      : operationalStatus.tone === 'neutral'
                        ? '#e5e7eb'
                        : '#fed7aa',
                  backgroundColor:
                    operationalStatus.tone === 'danger'
                      ? '#fef2f2'
                      : operationalStatus.tone === 'neutral'
                        ? '#f9fafb'
                        : '#fff7ed',
                  color:
                    operationalStatus.tone === 'danger'
                      ? '#b91c1c'
                      : operationalStatus.tone === 'neutral'
                        ? '#374151'
                        : '#9a3412',
                }}
              >
                <span className="sm:hidden">
                  {operationalStatus.mobileDescription || operationalStatus.description}
                </span>
                <span className="hidden sm:inline">{operationalStatus.description}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {copied && (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[90] -translate-x-1/2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-2xl">
          Link copiado
        </div>
      )}

      <div
        className={`fixed inset-0 z-[80] flex items-end justify-center transition-all duration-300 md:items-center ${
          showModal ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Informações da loja"
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            showModal ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setShowModal(false)}
          aria-label="Fechar informações"
        />

        <div
          className={`relative flex max-h-[88vh] min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl transition-all duration-300 ease-out md:max-h-[90vh] md:rounded-[2rem] ${
            showModal
              ? 'translate-y-0 scale-100 opacity-100'
              : 'translate-y-full opacity-0 md:translate-y-10 md:scale-95'
          }`}
        >
          <div
            className="h-2 w-full"
            style={{
              background: `linear-gradient(90deg, ${themeColor}, ${getRgba(
                themeColor,
                0.35
              )})`,
            }}
          />

          <div
            className="relative shrink-0 overflow-hidden border-b border-gray-100 px-5 pb-6 pt-5"
            style={{
              background: `linear-gradient(135deg, ${themeSofter}, #ffffff 62%, ${getRgba(
                themeColor,
                0.08
              )})`,
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl"
              style={{ backgroundColor: getRgba(themeColor, 0.18) }}
            />

            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 md:hidden" />

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-[#111827] shadow-lg shadow-gray-200/70 ring-1 ring-gray-100 backdrop-blur-xl transition hover:bg-[#111827] hover:text-white active:scale-95"
              aria-label="Fechar"
            >
              <FiX size={19} />
            </button>

  <div className="relative pr-12">
    <div className="flex items-start gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border-4 border-white bg-white text-xl font-black shadow-xl shadow-gray-200/80"
        style={{ color: themeColor }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            srcSet={logoSrcSet || undefined}
            sizes="64px"
            alt={store?.name || 'Logo da loja'}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            width={64}
            height={64}
          />
        ) : (
          logoInitial
        )}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-sm ring-1 ring-gray-100"
            style={{ color: themeColor }}
          >
            <FiInfo size={12} />
            Informações da loja
          </span>

          <StatusBadge status={operationalStatus} themeColor={themeColor} />
        </div>

        <h3 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-[#111827] sm:text-3xl">
          {store?.name || 'Loja'}
        </h3>

      </div>
    </div>

    {storeDescription && (
  <div className="mt-4 max-w-[38rem] rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-gray-100 backdrop-blur-xl">
    <p
      className="text-sm font-semibold leading-6 text-[#4b5563] sm:text-[15px]"
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {storeDescription}
    </p>
  </div>
)}
  </div>
</div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pratoby-scrollbar">
          <div
  className="rounded-[1.5rem] border p-4"
  style={{
    borderColor: getRgba(themeColor, 0.16),
    backgroundColor: themeSofter,
  }}
>
  <p className="text-sm font-black" style={{ color: themeColor }}>
    {operationalStatus.description}
  </p>

  <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#9ca3af]"><FiClock size={13} />
          Horário de hoje
        </p>

      <p className="mt-1 text-sm font-black text-[#111827]">
        {todayHoursLabel}
      </p>
    </div>

    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#9ca3af]">
          <FiDollarSign size={13} />
          Pedido mínimo
        </p>

      <p className="mt-1 text-sm font-black text-[#111827]">
        {minOrder > 0 ? formatMoney(minOrder) : 'Sem valor mínimo'}
      </p>
    </div>
  </div>
</div>

            <div className="grid gap-3">
              <InfoRow
                icon={FiClock}
                label="Tempo médio"
                value={deliveryTime}
                themeColor={themeColor}
              />
{acceptedServiceTypes.length > 0 ? (
  <section className="rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
        style={{ color: themeColor }}
      >
        <FiShoppingBag size={19} />
      </div>

      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
          Atendimento
        </p>

        <p className="text-sm font-black text-[#111827]">
          Como a loja atende seus pedidos
        </p>
      </div>
    </div>

    <div className="grid gap-2 sm:grid-cols-3">
      {acceptedServiceTypes.map((service) => (
        <div
          key={service.id}
          className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]"
              style={{
                backgroundColor: themeSofter,
                color: themeColor,
              }}
            >
              <service.icon size={16} />
            </span>

            <p className="text-sm font-black text-[#111827]">
              {service.label}
            </p>
          </div>

          <p className="mt-1 text-xs font-bold leading-5 text-[#6b7280]">
            {service.description}
          </p>
        </div>
      ))}
    </div>
  </section>
) : (
  <section className="rounded-[1.25rem] border border-amber-100 bg-amber-50 p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
        style={{ color: themeColor }}
      >
        <FiShoppingBag size={19} />
      </div>

      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
          Atendimento indisponivel
        </p>

        <p className="mt-1 text-sm font-black text-[#111827]">
          A loja ainda nao liberou entrega, retirada ou agendamento.
        </p>
      </div>
    </div>
  </section>
)}
{acceptedPaymentMethods.length > 0 && (
  <section className="rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
        style={{ color: themeColor }}
      >
        <FiDollarSign size={19} />
      </div>

      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
          Pagamento
        </p>

        <p className="text-sm font-black text-[#111827]">
          Meios aceitos pela loja
        </p>
      </div>
    </div>

    <div className="grid gap-2 sm:grid-cols-3">
      {acceptedPaymentMethods.map((method) => (
        <div
          key={method.id}
          className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]"
    style={{
      backgroundColor: themeSofter,
      color: themeColor,
    }}
  >
    <method.icon size={16} />
  </span>

  <p className="text-sm font-black text-[#111827]">
    {method.label}
  </p>
</div>

          <p className="mt-1 text-xs font-bold leading-5 text-[#6b7280]">
            {method.description}
          </p>
        </div>
      ))}
    </div>
  </section>
)}

{address.full && (
  <section className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] shadow-sm">
    <div className="flex items-start gap-3 p-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
        style={{ color: themeColor }}
      >
        <FiMapPin size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
          Localização
        </p>

        <p className="mt-1 break-words text-sm font-bold leading-6 text-[#111827]">
          {address.full}
          {address.complement ? ` · ${address.complement}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm transition active:scale-95"
          style={{ color: themeColor }}
        >
          Ver mapa
        </button>

        <a
          href={mapSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm transition active:scale-95"
          style={{ color: themeColor }}
        >
          Abrir
          <FiExternalLink size={12} />
        </a>
      </div>
    </div>

    <div className="border-t border-gray-100 bg-white p-2">
      <div className="overflow-hidden rounded-[1rem] border border-gray-100 bg-gray-100">
        {showMap ? (
          <iframe
            title={`Mapa de ${store?.name || 'loja'}`}
            src={mapEmbedUrl}
            className="h-48 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="flex h-28 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-50 to-white px-4 text-center text-sm font-black text-[#111827] transition hover:bg-orange-50"
          >
            <FiMapPin size={22} style={{ color: themeColor }} />
            Ver mapa da loja
            <span className="text-xs font-semibold text-[#6b7280]">
              O mapa carrega somente após o toque.
            </span>
          </button>
        )}
      </div>
    </div>
  </section>
)}

              {whatsappDigits && (
                <InfoRow
                  icon={FiPhone}
                  label="Atendimento"
                  value={formatBrazilianPhone(whatsappDigits)}
                  themeColor={themeColor}
                  action={
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-white shadow-sm transition active:scale-95"
                      style={{ backgroundColor: themeColor }}
                    >
                      Chamar
                      <FiMessageCircle size={12} />
                    </button>
                  }
                />
              )}
            </div>

            {(instagram || twitter || showPratoBySocial) && (
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Redes sociais
                </p>

                <div className="grid gap-3">
                  {instagram && (
                    <a
                      href={`https://instagram.com/${instagram}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-[1.25rem] border border-pink-100 bg-pink-50 p-4 shadow-sm transition hover:bg-pink-100 active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white shadow-sm">
                        <FiInstagram size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[#111827]">Instagram</p>
                        <p className="truncate text-xs font-bold text-pink-600">
                          @{instagram}
                        </p>
                      </div>

                      <FiExternalLink className="shrink-0 text-pink-500" />
                    </a>
                  )}

                  {twitter && (
                    <a
                      href={`https://twitter.com/${twitter}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-[1.25rem] border border-blue-100 bg-blue-50 p-4 shadow-sm transition hover:bg-blue-100 active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-sm">
                        <FiTwitter size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[#111827]">Twitter / X</p>
                        <p className="truncate text-xs font-bold text-blue-600">
                          @{twitter}
                        </p>
                      </div>

                      <FiExternalLink className="shrink-0 text-blue-500" />
                    </a>
                  )}

                  {showPratoBySocial && (
                    <a
                      href={`https://instagram.com/${PRATOBY_INSTAGRAM}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-[1.25rem] border border-orange-100 bg-orange-50 p-4 shadow-sm transition hover:bg-orange-100 active:scale-[0.99]"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: themeColor }}
                      >
                        <FiInstagram size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[#111827]">
                          Feito com PratoBy
                        </p>
                        <p className="truncate text-xs font-bold text-orange-600">
                          @{PRATOBY_INSTAGRAM}
                        </p>
                      </div>

                      <FiExternalLink className="shrink-0 text-orange-500" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiClock />
                Horário de funcionamento
              </p>

              <div className="overflow-hidden rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] shadow-sm">
                {businessHours.length > 0 ? (
                  businessHours.map((item, index) => {
                    const isToday =
                      !Array.isArray(item.days) ||
                      item.days.length === 0 ||
                      item.days.map(getDayKey).includes(getTodayKey())

                    return (
                      <div
                        key={`${formatDays(item.days)}-${item.open}-${item.close}-${index}`}
                        className={`flex flex-col gap-2 border-b border-gray-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
                          isToday ? 'bg-white' : ''
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-sm font-black text-[#111827]">
                            {formatDays(item.days)}
                          </span>

                          {isToday && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                              style={{ backgroundColor: themeSoft, color: themeColor }}
                            >
                              Hoje
                            </span>
                          )}
                        </div>

                        <span className="w-fit rounded-xl border border-gray-50 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] shadow-sm">
                          {item.enabled === false
                            ? 'Fechado'
                            : `${item.open || '--:--'} - ${item.close || '--:--'}`}
                        </span> 
                      </div>
                    )
                  })
                ) : (
                  <div className="p-5 text-center text-sm font-medium text-[#6b7280]">
                    Horários ainda não informados pela loja.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:bg-orange-50 active:scale-[0.99]"
              >
                <FiGrid />
                Abrir QR Code
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-sm transition active:scale-[0.99]"
                style={{ backgroundColor: themeColor }}
              >
                <FiShare2 />
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[85] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm transition-all duration-300 ${
          showQrModal ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="QR Code do cardápio"
      >
  <button
    type="button"
    className="absolute inset-0 cursor-default"
    aria-label="Fechar QR Code"
    onClick={() => setShowQrModal(false)}
  />

  <div
      className={`relative max-h-[calc(100vh-3rem)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 ${
        showQrModal ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-95 opacity-0'
      }`}
    >
    <div
      className="h-1.5 w-full"
      style={{
        background: `linear-gradient(90deg, ${themeColor}, ${getRgba(themeColor, 0.25)}, transparent)`,
      }}
    />

    <div className="p-5 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
        <FiGrid size={22} />
      </div>

      <h2 className="text-lg font-black text-[#111827]">
        Abrir cardápio no celular
      </h2>

      <p className="mx-auto mt-1 max-w-[260px] text-sm font-semibold leading-6 text-[#6b7280]">
        Escaneie o QR Code para acessar esta loja em outro dispositivo.
      </p>

      <div className="mx-auto mt-5 flex w-fit rounded-[1.5rem] border border-gray-100 bg-white p-3 shadow-sm">
        {QrCodeSvg ? (
          <QrCodeSvg
            value={publicUrl}
            size={188}
            level="M"
            includeMargin={false}
          />
        ) : (
          <div className="flex h-[188px] w-[188px] items-center justify-center rounded-2xl bg-gray-50 text-xs font-bold text-gray-400">
            Carregando QR...
          </div>
        )}
      </div>

      <p className="mt-3 break-all rounded-2xl bg-gray-50 px-3 py-2 text-[11px] font-bold leading-5 text-gray-500">
        {publicUrl}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-black text-[#111827] shadow-sm transition hover:bg-orange-50 active:scale-[0.99]"
        >
          <FiCopy />
          Copiar
        </button>

        <button
          type="button"
          onClick={() => setShowQrModal(false)}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black text-white shadow-sm transition active:scale-[0.99]"
          style={{ backgroundColor: themeColor }}
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</div>
    </header>
  )
}
