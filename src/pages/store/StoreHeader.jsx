import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCloudinaryOptimizedUrl } from '../../services/cloudinary'
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
} from 'react-icons/fi'

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

function getBannerUrl(store) {
  return getCloudinaryOptimizedUrl(
    store?.bannerUrl ||
      store?.bannerURL ||
      store?.coverUrl ||
      store?.coverURL ||
      store?.bannerImageUrl ||
      store?.coverImageUrl ||
      store?.banner ||
      store?.settings?.bannerUrl,
    1400
  )
}

function getLogoUrl(store) {
  return getCloudinaryOptimizedUrl(
    store?.logoUrl ||
      store?.logoURL ||
      store?.logo ||
      store?.avatarUrl ||
      store?.imageUrl ||
      store?.photoUrl ||
      store?.settings?.logoUrl,
    320
  )
}

function normalizePhoneBR(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`

  return digits
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''

  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`
  }

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`
  }

  return value
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

function getOperationalStatus(store, scheduleStatus = {}) {
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
      label: 'Loja fechada',
      description: 'O cardápio está disponível apenas para visualização.',
      isOpen: false,
      tone: 'danger',
    }
  }

  if (scheduleStatus.hasSchedule && !scheduleStatus.isWithinSchedule) {
    return {
      label: 'Fora do horário',
      description: 'A loja está aberta, mas fora do horário de funcionamento.',
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

export default function StoreHeader({ store, onOpenProfile, activeUsers = 0 }) {
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [animateHeart, setAnimateHeart] = useState(false)

  const themeColor = getStoreTheme(store)
  const themeSoft = getRgba(themeColor, 0.1)
  const themeSofter = getRgba(themeColor, 0.06)

  const bannerUrl = useMemo(() => getBannerUrl(store), [store])
  const logoUrl = useMemo(() => getLogoUrl(store), [store])
  const logoInitial = String(store?.name || 'L').trim().charAt(0).toUpperCase()
  const storeSlug = getStoreSlug(store)
  const storeKeys = useMemo(() => getStoreKeys(store), [store])
  const primaryFavoriteKey = storeKeys[0] || store?.id || store?.name

  const whatsapp = getStoreWhatsapp(store)
  const whatsappDigits = normalizePhoneBR(whatsapp)
  const instagram = getInstagram(store)
  const twitter = getTwitter(store)
  const address = useMemo(() => getAddressData(store), [store])
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
    setFavorited(storeKeys.some((key) => mergedFavorites.includes(key)))
  }, [primaryFavoriteKey, storeKeys])

  useEffect(() => {
    if (!showModal || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowModal(false)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal])

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
    <header className="relative w-full overflow-visible bg-[#f6f7f9]">
      <div className="store-banner-shell relative h-[150px] w-full overflow-hidden border-b border-white/70 sm:h-[240px] lg:h-[280px]">
  <div
    className="store-banner-bg absolute inset-0"
    style={{
      background: bannerUrl
        ? `url(${bannerUrl}) center/cover no-repeat`
        : `linear-gradient(135deg, ${themeColor} 0%, #111827 135%)`,
    }}
  />

  <div className="absolute inset-0 bg-black/[0.03]" />
</div>

      <section className="relative z-10 mx-auto -mt-7 max-w-[1120px] px-3 pb-4 sm:-mt-12 sm:px-4 lg:-mt-16">
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
              <div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 sm:w-24 lg:w-28">
  <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[1.25rem] bg-white shadow-md shadow-gray-200/80 ring-1 ring-gray-100 sm:h-24 sm:w-24 sm:rounded-[1.6rem] lg:h-28 lg:w-28">
    {logoUrl ? (
      <img
        src={logoUrl}
        alt={store?.name || 'Logo da loja'}
        className="h-full w-full object-cover"
        loading="eager"
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

  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-600 ring-1 ring-orange-100/80 sm:px-3 sm:py-1.5">
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
  <h1 className="whitespace-normal break-words text-[1.12rem] font-black leading-tight tracking-tight text-[#111827] transition group-hover:text-orange-600 sm:text-4xl lg:text-[2.45rem]">
    {store?.name || 'Loja'}
  </h1>
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

                <p className="mt-2 max-h-10 overflow-hidden text-[13px] font-medium leading-5 text-[#6b7280] sm:mt-3 sm:max-h-none sm:text-[15px] sm:leading-6 lg:max-w-2xl">
                  {store?.description ||
                    'Peça online de forma rápida, acompanhe seu pedido e receba no conforto da sua casa.'}
                </p>

                <div className="mt-3 -ml-20 flex w-[calc(100%+5rem)] gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:ml-0 sm:mt-4 sm:w-auto sm:flex-wrap [&::-webkit-scrollbar]:hidden">
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
                    <InfoPill icon={FiDollarSign} themeColor={themeColor}>
                      Mínimo {formatMoney(minOrder)}
                    </InfoPill>
                  )}
                </div>
              </div>
            </div>

            {!operationalStatus.isOpen && (
              <div
                className="mt-3 rounded-2xl border p-3 text-sm font-bold leading-6 sm:mt-4"
                style={{
                  borderColor:
                    operationalStatus.tone === 'danger' ? '#fecaca' : getRgba(themeColor, 0.18),
                  backgroundColor:
                    operationalStatus.tone === 'danger' ? '#fef2f2' : themeSofter,
                  color: operationalStatus.tone === 'danger' ? '#b91c1c' : themeColor,
                }}
              >
                {operationalStatus.description}
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
          className={`relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl transition-all duration-300 ease-out md:max-h-[90vh] md:rounded-[2rem] ${
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

          <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
            <div className="min-w-0">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 md:hidden" />

              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9ca3af]">
                Informações da loja
              </p>

              <h3 className="mt-1 max-h-16 overflow-hidden text-2xl font-black tracking-tight text-[#111827]">
                {store?.name || 'Loja'}
              </h3>

              <div className="mt-2">
                <StatusBadge status={operationalStatus} themeColor={themeColor} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition hover:bg-black active:scale-95"
              aria-label="Fechar"
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div
              className="rounded-[1.5rem] border p-4"
              style={{ borderColor: getRgba(themeColor, 0.16), backgroundColor: themeSofter }}
            >
              <p className="text-sm font-black" style={{ color: themeColor }}>
                {operationalStatus.description}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-xs font-bold text-[#6b7280]">Horário de hoje</p>
                  <p className="mt-1 text-sm font-black text-[#111827]">
                    {todayHoursLabel}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-xs font-bold text-[#6b7280]">Pedido mínimo</p>
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

              {address.full && (
                <InfoRow
                  icon={FiMapPin}
                  label="Endereço"
                  value={`${address.full}${address.complement ? ` · ${address.complement}` : ''}`}
                  themeColor={themeColor}
                  action={
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        address.full
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm transition active:scale-95"
                      style={{ color: themeColor }}
                    >
                      Mapa
                      <FiExternalLink size={12} />
                    </a>
                  }
                />
              )}

              {whatsappDigits && (
                <InfoRow
                  icon={FiPhone}
                  label="Atendimento"
                  value={formatPhone(whatsappDigits)}
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

            {(instagram || twitter) && (
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
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:bg-orange-50 active:scale-[0.99]"
              >
                <FiCopy />
                Copiar link
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
    </header>
  )
}