import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import { Link } from 'react-router-dom'
import { formatBrazilianPhone, normalizeBrazilianPhoneForWhatsApp } from '../../utils/phone'
import { scrollToFirstError } from '../../utils/scroll'
import {
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import {
  FiArrowLeft,
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiGlobe,
  FiImage,
  FiInstagram,
  FiLink,
  FiLoader,
  FiMapPin,
  FiMessageCircle,
  FiMonitor,
  FiPhone,
  FiSave,
  FiSettings,
  FiShield,
  FiShoppingBag,
  FiUpload,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { FaPix, FaCreditCard } from "react-icons/fa6";
import { SiMercadopago } from "react-icons/si";
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'

import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadImageToCloudinary } from '../../services/cloudinary'
import { registerStoreMediaAsset } from '../../services/storeMediaLibrary'
import LockedFeatureCard from '../../components/billing/LockedFeatureCard'
import { hasPlanFeature } from '../../utils/planCatalog'
import { getCloudinaryImageUrl } from '../../utils/cloudinaryImages'
import { getStoreOperationalStatus } from '../../utils/storeOperationalStatus'
import MediaLibraryPicker from '../../components/media/MediaLibraryPicker'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const BRAND_GREEN = '#f97316'
const DEFAULT_THEME = '#f97316'
// TODO SEO: adicionar switch "Permitir que minha loja apareça no Google"
// salvando seoIndexingEnabled=false por padrão para lojas reais e bloqueando
// ativação quando a loja estiver bloqueada, deletada ou billingBlocked.

import FloatingToast from '../../components/ui/FloatingToast'

const DAYS_OF_WEEK = [
  { id: 'sun', short: 'Dom', label: 'Domingo' },
  { id: 'mon', short: 'Seg', label: 'Segunda' },
  { id: 'tue', short: 'Ter', label: 'Terça' },
  { id: 'wed', short: 'Qua', label: 'Quarta' },
  { id: 'thu', short: 'Qui', label: 'Quinta' },
  { id: 'fri', short: 'Sex', label: 'Sexta' },
  { id: 'sat', short: 'Sáb', label: 'Sábado' },
]

const SCHEDULING_DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

const DEFAULT_SCHEDULING_WEEKLY_WINDOWS = {
  monday: [{ start: '08:00', end: '18:00' }],
  tuesday: [{ start: '08:00', end: '18:00' }],
  wednesday: [{ start: '08:00', end: '18:00' }],
  thursday: [{ start: '08:00', end: '18:00' }],
  friday: [{ start: '08:00', end: '18:00' }],
  saturday: [],
  sunday: [],
}

const MAX_SCHEDULE_DAYS_AHEAD = 365

const DEFAULT_STORE_SCHEDULING = {
  enabled: false,
  minLeadMinutes: 60,
  maxDaysAhead: 14,
  slotIntervalMinutes: 30,
  fulfillmentTypes: {
    delivery: true,
    pickup: true,
  },
  weeklyWindows: DEFAULT_SCHEDULING_WEEKLY_WINDOWS,
  blockedDates: [],
  prepaymentPolicy: 'none',
}

const OPENING_TO_SCHEDULING_DAY = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
}

const SEGMENTS = [
  'Restaurante',
  'Pizzaria',
  'Hamburgueria',
  'Lanchonete',
  'Açaíteria',
  'Cafeteria',
  'Doceria',
  'Marmitaria',
  'Bar',
  'Outro',
]

const DEFAULT_FORM = {
  name: '',
  slug: '',
  description: '',
  segment: 'Restaurante',
  logoUrl: '',
  bannerUrl: '',
  bannerMobileUrl: '',
  shareImageUrl: '',
  themeColor: DEFAULT_THEME,
  whatsapp: '',
  instagram: '',
  isOpen: true,
  isActive: true,
  availabilityMode: 'manual',
  temporaryPauseUntil: '',
  temporaryPauseReason: '',
  allowScheduledOrdersWhenClosed: false,
  openingHours: {
  sun: { enabled: false, open: '18:00', close: '22:00' },
  mon: { enabled: false, open: '18:00', close: '22:00' },
  tue: { enabled: true, open: '18:00', close: '23:30' },
  wed: { enabled: true, open: '18:00', close: '23:30' },
  thu: { enabled: true, open: '18:00', close: '23:30' },
  fri: { enabled: true, open: '18:00', close: '00:00' },
  sat: { enabled: true, open: '18:00', close: '00:00' },
  },
  hoursOpen: '18:00',
  hoursClose: '23:30',
  deliveryTime: '40-50 min',
  minOrder: '0,00',
  acceptDelivery: true,
  acceptPickup: true,
  acceptDineIn: false,
  newOrderSoundEnabled: true,
  printAfterConfirm: true,
  autoCloseEnabled: false,
  autoCloseGraceMinutes: '30',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: 'SE',
  scheduling: DEFAULT_STORE_SCHEDULING,
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function getTodayKey() {
  return DAYS_OF_WEEK[new Date().getDay()]?.id || 'sun'
}

function getFutureIso(minutes) {
  const amount = Number.parseInt(minutes, 10)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return new Date(Date.now() + amount * 60 * 1000).toISOString()
}

function formatDateTimePtBr(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}



function sanitizeSocial(value) {
  return String(value || '').replace('@', '').trim()
}

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  if (numericValue > 999) return numericValue / 100

  return numericValue
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
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

function getStoreKeys(store, nextSlug = '') {
  return uniqueArray([
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
    store?.id,
    store?.storeId,
    store?.storeDocId,
    store?.storeSlug,
    store?.slug,
    nextSlug,
  ])
}

function getUserStoreKeys(user) {
  return uniqueArray([
    user?.storeId,
    user?.storeSlug,
    ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ...(Array.isArray(user?.storeKeys) ? user.storeKeys : []),
  ])
}

function userCanManageStore(user, store) {
  if (!user?.uid || !store) return false

  const role = String(user.role || '').trim().toLowerCase()
  if (['admin', 'developer', 'dev'].includes(role)) return true

  const storeKeys = getStoreKeys(store)
  const userStoreKeys = getUserStoreKeys(user)

  return (
    store.ownerId === user.uid ||
    store.ownerUid === user.uid ||
    (Array.isArray(store.allowedUserIds) && store.allowedUserIds.includes(user.uid)) ||
    (Array.isArray(store.merchantUids) && store.merchantUids.includes(user.uid)) ||
    storeKeys.some((key) => userStoreKeys.includes(key))
  )
}

function getStoreImageMediaType(fieldName) {
  if (fieldName === 'logoUrl') return 'logo'
  if (fieldName === 'bannerUrl' || fieldName === 'bannerMobileUrl') return 'banner'
  return 'general'
}

function getStoreImageVariant(fieldName) {
  if (fieldName === 'logoUrl') return 'storeLogoLarge'
  if (fieldName === 'bannerUrl') return 'storeBanner'
  if (fieldName === 'bannerMobileUrl') return 'storeBannerMobile'
  if (fieldName === 'shareImageUrl') return 'ogImage'
  return 'storeBannerMobile'
}

function sanitizeTextField(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeThemeColor(value) {
  const color = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_THEME
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim())
}

function cloneDefaultScheduling() {
  return {
    ...DEFAULT_STORE_SCHEDULING,
    fulfillmentTypes: { ...DEFAULT_STORE_SCHEDULING.fulfillmentTypes },
    weeklyWindows: Object.fromEntries(
      Object.entries(DEFAULT_STORE_SCHEDULING.weeklyWindows).map(([day, windows]) => [
        day,
        windows.map((window) => ({ ...window })),
      ])
    ),
    blockedDates: [],
  }
}

function toBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function normalizeSchedulingWindow(window, fallback = { start: '08:00', end: '18:00' }) {
  const start = isValidTime(window?.start) ? window.start : fallback.start
  const end = isValidTime(window?.end) ? window.end : fallback.end
  return start < end ? { start, end } : fallback
}

function normalizeStoreScheduling(value) {
  const defaults = cloneDefaultScheduling()
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const fulfillment = raw.fulfillmentTypes && typeof raw.fulfillmentTypes === 'object'
    ? raw.fulfillmentTypes
    : {}
  const windows = raw.weeklyWindows && typeof raw.weeklyWindows === 'object'
    ? raw.weeklyWindows
    : defaults.weeklyWindows

  return {
    enabled: raw.enabled === true,
    minLeadMinutes: toBoundedInteger(raw.minLeadMinutes, defaults.minLeadMinutes, 0, 525600),
    maxDaysAhead: toBoundedInteger(raw.maxDaysAhead, defaults.maxDaysAhead, 0, MAX_SCHEDULE_DAYS_AHEAD),
    slotIntervalMinutes: [10, 15, 30, 60].includes(Number(raw.slotIntervalMinutes))
      ? Number(raw.slotIntervalMinutes)
      : defaults.slotIntervalMinutes,
    fulfillmentTypes: {
      delivery: fulfillment.delivery !== false,
      pickup: fulfillment.pickup !== false,
    },
    weeklyWindows: SCHEDULING_DAYS.reduce((acc, day) => {
      const dayWindows = Array.isArray(windows?.[day.key]) ? windows[day.key] : []
      acc[day.key] = dayWindows.length
        ? [normalizeSchedulingWindow(dayWindows[0])]
        : []
      return acc
    }, {}),
    blockedDates: Array.isArray(raw.blockedDates)
      ? [...new Set(raw.blockedDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))))]
      : [],
    prepaymentPolicy: [
      'none',
      'pix_required_for_scheduled',
      'pix_required_for_custom_products',
    ].includes(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'none',
  }
}

function hasAnySchedulingWindow(scheduling) {
  return SCHEDULING_DAYS.some((day) => {
    return Array.isArray(scheduling?.weeklyWindows?.[day.key])
      && scheduling.weeklyWindows[day.key].length > 0
  })
}

function getSchedulingValidationError(scheduling) {
  if (!scheduling?.enabled) return null

  if (
    scheduling.fulfillmentTypes?.delivery !== true
    && scheduling.fulfillmentTypes?.pickup !== true
  ) {
    return 'Selecione pelo menos entrega ou retirada para pedidos agendados.'
  }

  if (Number(scheduling.maxDaysAhead) < 1) {
    return 'O limite de dias no futuro precisa ser maior que zero.'
  }

  if (Number(scheduling.minLeadMinutes) > Number(scheduling.maxDaysAhead) * 1440) {
    return 'A antecedência mínima não pode ser maior que o limite de dias no futuro.'
  }

  if (!hasAnySchedulingWindow(scheduling)) {
    return 'Configure pelo menos um dia disponível para agendamento.'
  }

  for (const day of SCHEDULING_DAYS) {
    const windows = scheduling.weeklyWindows?.[day.key] || []

    for (const window of windows) {
      if (!isValidTime(window?.start) || !isValidTime(window?.end) || window.start >= window.end) {
        return `Revise os horários de ${day.label}: o início precisa ser antes do fim.`
      }
    }
  }

  return null
}

function hasStoreAddress(form) {
  return Boolean(
    String(form?.street || '').trim()
    && String(form?.number || '').trim()
    && String(form?.neighborhood || '').trim()
    && String(form?.city || '').trim()
    && String(form?.state || '').trim()
  )
}

function hasAnyOpeningHours(openingHours) {
  return DAYS_OF_WEEK.some((day) => {
    const hours = openingHours?.[day.id]
    return hours?.enabled && isValidTime(hours.open) && isValidTime(hours.close)
  })
}

function getPaymentSource(store) {
  return {
    methods: store?.paymentMethods || store?.settings?.paymentMethods || {},
    payments: store?.payments || {},
    pix: store?.pix || store?.settings?.pix || store?.paymentSettings?.pix || {},
  }
}

function isPaymentMethodActive(store, method) {
  const { methods, payments } = getPaymentSource(store)
  const methodValue = methods?.[method]

  if (methodValue === true) return true
  if (methodValue === false) return false

  if (method === 'pix') {
    const pix = getPaymentSource(store).pix
    return pix?.enabled === true || Boolean(store?.pixKey || pix?.key || pix?.pixKey)
  }

  if (method === 'card') {
    return methods?.card !== false && methods?.credit !== false
  }
  if (method === 'cash') return methods?.cash !== false && methods?.money !== false

  return payments?.[method]?.enabled === true
}

function hasAnyPaymentMethod(store) {
  const mercadoPago = store?.payments?.mercadoPago || store?.payments?.mercadopago || {}
  return (
    isPaymentMethodActive(store, 'pix')
    || isPaymentMethodActive(store, 'card')
    || isPaymentMethodActive(store, 'cash')
    || mercadoPago.enabled === true
  )
}

function hasPixManualProblem(store) {
  const { methods, pix } = getPaymentSource(store)
  const pixEnabled = methods?.pix === true || pix?.enabled === true
  const pixKey = store?.pixKey || pix?.key || pix?.pixKey || store?.settings?.pixKey

  return pixEnabled && !String(pixKey || '').trim()
}

function getReadinessChecks({ form, selectedStore, schedulingAllowed }) {
  const scheduling = normalizeStoreScheduling(form?.scheduling)
  const schedulingEnabled = scheduling.enabled === true
  const schedulingPlanReady = schedulingEnabled && schedulingAllowed
  const schedulingValidationError = getSchedulingValidationError(scheduling)
  const schedulingUsable = schedulingPlanReady && !schedulingValidationError
  const hasOrderingMethod = Boolean(form?.acceptDelivery || form?.acceptPickup || schedulingUsable)
  const storeActive = form?.isActive !== false
  const manuallyClosed = form?.availabilityMode !== 'opening_hours' && form?.isOpen === false
  const checks = []

  if (!storeActive || manuallyClosed) {
    checks.push({
      status: 'critical',
      label: 'Bloqueante',
      title: !storeActive ? 'Loja inativa' : 'Loja fechada manualmente',
      description: !storeActive
        ? 'A vitrine pode existir, mas a loja nao esta pronta para vender enquanto estiver inativa.'
        : 'Pedidos imediatos ficam bloqueados ate voce abrir a loja ou usar horario automatico.',
      actionLabel: 'Ajustar funcionamento',
      href: '#settings-operation',
      blocksSave: false,
    })
  }

  if (storeActive && !hasOrderingMethod) {
    checks.push({
      status: 'critical',
      label: 'Bloqueante',
      title: 'Nenhum meio de pedido ativo',
      description: 'Ative delivery, retirada ou um agendamento valido antes de deixar a loja aberta.',
      saveMessage: 'Ative delivery, retirada ou um agendamento valido antes de salvar a loja aberta.',
      actionLabel: 'Configurar entrega',
      href: '#settings-operation',
      blocksSave: true,
    })
  } else if (!hasOrderingMethod) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Sem meio de pedido',
      description: 'A loja esta fechada, mas ainda nao tem delivery, retirada ou agendamento pronto para uso.',
      actionLabel: 'Configurar entrega',
      href: '#settings-operation',
    })
  } else {
    checks.push({
      status: 'ok',
      label: 'Tudo certo',
      title: 'Meios de pedido',
      description: [
        form?.acceptDelivery ? 'Delivery' : '',
        form?.acceptPickup ? 'Retirada' : '',
        schedulingUsable ? 'Agendamento' : '',
      ].filter(Boolean).join(', '),
    })
  }

  if (schedulingEnabled && !schedulingAllowed) {
    checks.push({
      status: 'critical',
      label: 'Bloqueante',
      title: 'Agendamento sem plano',
      description: 'O agendamento esta ativado, mas o plano atual nao libera esse recurso.',
      saveMessage: 'Seu plano atual nao inclui agendamento. Desative o agendamento ou altere o plano antes de salvar.',
      actionLabel: 'Revisar agendamento',
      href: '#settings-scheduling',
      blocksSave: true,
    })
  } else if (schedulingValidationError) {
    checks.push({
      status: 'critical',
      label: 'Bloqueante',
      title: 'Agendamento incompleto',
      description: schedulingValidationError,
      saveMessage: schedulingValidationError,
      actionLabel: 'Corrigir agendamento',
      href: '#settings-scheduling',
      blocksSave: true,
    })
  } else if (schedulingEnabled) {
    checks.push({
      status: 'ok',
      label: 'Tudo certo',
      title: 'Agendamento',
      description: `Disponivel por ate ${scheduling.maxDaysAhead} dias no futuro.`,
    })
  }

  if (form?.acceptDelivery && (!String(form?.deliveryTime || '').trim() || !hasStoreAddress(form))) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Delivery incompleto',
      description: 'Revise tempo medio e endereco da loja para evitar duvidas no pedido.',
      actionLabel: 'Completar endereco',
      href: '#settings-address',
    })
  }

  if (form?.acceptPickup && !hasStoreAddress(form)) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Retirada sem endereco',
      description: 'Informe o endereco da loja para o cliente saber onde retirar.',
      actionLabel: 'Completar endereco',
      href: '#settings-address',
    })
  }

  if (!hasAnyPaymentMethod(selectedStore)) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Pagamento nao configurado',
      description: 'Revise as formas de pagamento em Pagamentos antes de receber pedidos.',
      actionLabel: 'Ir para pagamentos',
      to: '/dashboard/pagamentos',
    })
  } else if (hasPixManualProblem(selectedStore)) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Pix manual sem chave',
      description: 'O Pix manual parece ativo, mas nao encontrei chave Pix publica configurada.',
      actionLabel: 'Ir para pagamentos',
      to: '/dashboard/pagamentos',
    })
  } else {
    checks.push({
      status: 'ok',
      label: 'Tudo certo',
      title: 'Pagamentos',
      description: 'Ha pelo menos uma forma de pagamento disponivel.',
    })
  }

  if (!String(form?.whatsapp || '').trim()) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'WhatsApp ausente',
      description: 'Sem WhatsApp, o cliente pode ter dificuldade para falar com a loja.',
      actionLabel: 'Adicionar WhatsApp',
      href: '#settings-contact',
    })
  }

  if (!hasAnyOpeningHours(form?.openingHours)) {
    checks.push({
      status: 'warning',
      label: 'Atenção',
      title: 'Horario nao informado',
      description: 'Configure ao menos um dia de funcionamento para orientar o cliente.',
      actionLabel: 'Configurar horarios',
      href: '#settings-operation',
    })
  }

  if (!String(form?.description || '').trim()) {
    checks.push({
      status: 'recommended',
      label: 'Recomendado',
      title: 'Descricao da loja',
      description: 'Uma descricao curta ajuda o cliente a entender sua especialidade.',
      actionLabel: 'Melhorar identidade',
      href: '#settings-identity',
    })
  }

  if (!String(form?.logoUrl || '').trim()) {
    checks.push({
      status: 'recommended',
      label: 'Recomendado',
      title: 'Logo da loja',
      description: 'Logo melhora reconhecimento, mas nao impede a loja de vender.',
      actionLabel: 'Enviar logo',
      href: '#settings-identity',
    })
  }

  if (!String(form?.bannerUrl || '').trim()) {
    checks.push({
      status: 'recommended',
      label: 'Recomendado',
      title: 'Banner principal',
      description: 'Banner deixa a vitrine mais profissional, mas e opcional para operar.',
      actionLabel: 'Enviar banner',
      href: '#settings-identity',
    })
  }

  return {
    checks,
    criticalCount: checks.filter((check) => check.status === 'critical').length,
    warningCount: checks.filter((check) => check.status === 'warning').length,
    recommendedCount: checks.filter((check) => check.status === 'recommended').length,
  }
}

function formatBlockedDate(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-')
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}

function openingHoursToSchedulingWindows(openingHours) {
  const defaults = getDefaultOpeningHours()
  const source = openingHours || defaults

  return Object.entries(OPENING_TO_SCHEDULING_DAY).reduce((acc, [openingDay, schedulingDay]) => {
    const dayHours = source?.[openingDay] || defaults[openingDay]
    acc[schedulingDay] = dayHours?.enabled
      ? [{ start: dayHours.open || '08:00', end: dayHours.close || '18:00' }]
      : []
    return acc
  }, {})
}

function splitMinutesForInput(minutes) {
  const value = Number(minutes)
  if (Number.isFinite(value) && value > 0 && value % 1440 === 0) {
    return { value: String(value / 1440), unit: 'days' }
  }
  if (Number.isFinite(value) && value > 0 && value % 60 === 0) {
    return { value: String(value / 60), unit: 'hours' }
  }
  return { value: String(Number.isFinite(value) ? value : 60), unit: 'minutes' }
}

function leadTimeToMinutes(value, unit) {
  const amount = Math.max(0, Number.parseInt(value, 10) || 0)
  if (unit === 'days') return amount * 1440
  if (unit === 'hours') return amount * 60
  return amount
}

function normalizeOpeningHoursForSave(openingHours) {
  const defaults = getDefaultOpeningHours()

  return DAYS_OF_WEEK.reduce((acc, day) => {
    const current = openingHours?.[day.id] || defaults[day.id]
    const fallback = defaults[day.id]

    acc[day.id] = {
      enabled: Boolean(current.enabled),
      open: isValidTime(current.open) ? current.open : fallback.open,
      close: isValidTime(current.close) ? current.close : fallback.close,
    }

    return acc
  }, {})
}

function currencyToCents(value) {
  return Math.max(0, Math.round(parseCurrency(value) * 100))
}

function sanitizeImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//')) return url

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com') {
      return parsed.toString()
    }
  } catch {
    return null
  }

  return null
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function cleanFirestoreValue(value) {
  if (value === undefined || value === null) return undefined
  if (Array.isArray(value)) {
    return value
      .map(cleanFirestoreValue)
      .filter((item) => item !== undefined)
  }
  if (!isPlainObject(value)) return value

  return Object.entries(value).reduce((acc, [key, childValue]) => {
    const cleaned = cleanFirestoreValue(childValue)
    if (cleaned !== undefined) acc[key] = cleaned
    return acc
  }, {})
}

function getStorePublicUrl(storeOrSlug) {
  const slug =
    typeof storeOrSlug === 'string'
      ? storeOrSlug
      : getStoreSlug(storeOrSlug)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return `${origin}/${slug}`
}

function getAddressFromStore(store) {
  const address = store?.address || {}

  if (typeof address === 'string') {
    return {
      cep: store?.cep || '',
      street: address,
      number: store?.number || '',
      neighborhood: store?.neighborhood || '',
      complement: store?.complement || '',
      city: store?.city || '',
      state: store?.state || 'SE',
    }
  }

  return {
    cep: address.cep || store?.cep || '',
    street: address.street || address.rua || store?.street || '',
    number: address.number || address.numero || store?.number || '',
    neighborhood:
      address.neighborhood ||
      address.bairro ||
      store?.neighborhood ||
      '',
    complement:
      address.complement ||
      address.complemento ||
      store?.complement ||
      '',
    city: address.city || address.cidade || store?.city || '',
    state: address.state || address.uf || store?.state || 'SE',
  }
}

function normalizeStore(storeDoc) {
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

function getDefaultOpeningHours() {
  return {
    sun: { enabled: false, open: '18:00', close: '22:00' },
    mon: { enabled: false, open: '18:00', close: '22:00' },
    tue: { enabled: true, open: '18:00', close: '23:30' },
    wed: { enabled: true, open: '18:00', close: '23:30' },
    thu: { enabled: true, open: '18:00', close: '23:30' },
    fri: { enabled: true, open: '18:00', close: '00:00' },
    sat: { enabled: true, open: '18:00', close: '00:00' },
  }
}

function normalizeOpeningHours(store) {
  const saved =
    store?.openingHours ||
    store?.settings?.openingHours ||
    {}

  const fallbackOpen = store?.hoursOpen || '18:00'
  const fallbackClose = store?.hoursClose || '23:30'
  const activeDays = Array.isArray(store?.activeDays) ? store.activeDays : []

  return DAYS_OF_WEEK.reduce((acc, day) => {
    const current = saved?.[day.id] || saved?.[day.short] || {}

    acc[day.id] = {
      enabled:
        current.enabled ??
        activeDays.includes(day.short) ??
        false,
      open: current.open || fallbackOpen,
      close: current.close || fallbackClose,
    }

    return acc
  }, {})
}

function mapStoreToForm(store) {
  const address = getAddressFromStore(store)
  const settings = store?.settings || {}

  return {
    ...DEFAULT_FORM,
    name: store?.name || '',
    slug: getStoreSlug(store),
    description: store?.description || '',
    segment: store?.segment || store?.category || 'Restaurante',
    logoUrl: store?.logoUrl || store?.logoURL || store?.logo || store?.avatarUrl || '',
    bannerUrl:
      store?.bannerUrl ||
      store?.bannerURL ||
      store?.coverUrl ||
      store?.coverURL ||
      store?.bannerImageUrl ||
      '',
    bannerMobileUrl:
      store?.bannerMobileUrl ||
      store?.mobileBannerUrl ||
      settings?.bannerMobileUrl ||
      settings?.mobileBannerUrl ||
      '',
    shareImageUrl:
      store?.shareImageUrl ||
      store?.seoImageUrl ||
      store?.ogImageUrl ||
      settings?.shareImageUrl ||
      '',
    themeColor:
      store?.themeColor ||
      store?.primaryColor ||
      store?.accentColor ||
      store?.colors?.primary ||
      settings?.themeColor ||
      DEFAULT_THEME,
    whatsapp:
      store?.whatsapp ||
      store?.whatsapp1 ||
      store?.phone ||
      store?.settings?.whatsapp ||
      '',
    instagram:
      store?.instagram ||
      store?.social?.instagram ||
      store?.settings?.instagram ||
      '',
    isOpen: store?.isOpen ?? true,
    isActive: store?.isActive ?? true,
    availabilityMode:
      ['opening_hours', 'manual'].includes(settings?.availabilityMode)
        ? settings.availabilityMode
        : settings?.autoOpenCloseEnabled === true
          ? 'opening_hours'
          : 'manual',
    temporaryPauseUntil: settings?.temporaryPauseUntil || store?.temporaryPauseUntil || '',
    temporaryPauseReason: settings?.temporaryPauseReason || store?.temporaryPauseReason || '',
    allowScheduledOrdersWhenClosed:
      settings?.allowScheduledOrdersWhenClosed === true ||
      store?.allowScheduledOrdersWhenClosed === true,
    openingHours: normalizeOpeningHours(store),
    deliveryTime: store?.deliveryTime || settings?.deliveryTime || DEFAULT_FORM.deliveryTime,
    minOrder: moneyToInput(store?.minOrder, store?.minOrderCents),
    acceptDelivery: settings?.acceptDelivery ?? store?.acceptDelivery ?? true,
    acceptPickup: settings?.acceptPickup ?? store?.acceptPickup ?? true,
    acceptDineIn: settings?.acceptDineIn ?? store?.acceptDineIn ?? false,
    newOrderSoundEnabled:
      settings?.newOrderSoundEnabled ??
      store?.newOrderSoundEnabled ??
      true,
    printAfterConfirm:
      settings?.printAfterConfirm ??
      store?.printAfterConfirm ??
      true,
    autoCloseEnabled:
      settings?.autoCloseEnabled ??
      store?.autoCloseEnabled ??
      false,
    autoCloseGraceMinutes: String(
      settings?.autoCloseGraceMinutes ??
      store?.autoCloseGraceMinutes ??
      30
    ),
    scheduling: normalizeStoreScheduling(
      store?.scheduling ||
      store?.settings?.scheduling ||
      store?.publicScheduling
    ),
    ...address,
  }
}



function Section({ id, icon: Icon, title, description, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#151922]"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-500/10">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-base font-black text-[#111827] dark:text-zinc-50">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  )
}

function toFieldId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getFieldId(props, label) {
  return props.id || props.name || (label ? `settings-${toFieldId(label)}` : undefined)
}

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-gray-500 dark:text-zinc-500 leading-snug">
      {children}
    </label>
  )
}

function Input({ label, icon: Icon, className = '', ...props }) {
  const fieldId = getFieldId(props, label)

  return (
    <div className={className}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}

      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        )}

        <input
          {...props}
          id={fieldId}
          name={props.name || fieldId}
          className={`h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-orange-500/20 ${
            Icon ? 'pl-11' : ''
          } ${props.className || ''}`}
        />
      </div>
    </div>
  )
}

function Select({ label, children, className = '', ...props }) {
  const fieldId = getFieldId(props, label)

  return (
    <div className={className}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}

      <select
        {...props}
        id={fieldId}
        name={props.name || fieldId}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-orange-500/20"
      >
        {children}
      </select>
    </div>
  )
}

function Textarea({ label, className = '', ...props }) {
  const fieldId = getFieldId(props, label)

  return (
    <div className={className}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}

      <textarea
        {...props}
        id={fieldId}
        name={props.name || fieldId}
        className="min-h-[110px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-orange-500/20"
      />
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex h-full w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 text-left transition hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80 cursor-pointer"
    >
      <div>
        <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6b7280] dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>

      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  )
}

function ImageUploadField({
  label,
  description,
  value,
  uploading,
  aspect = 'square',
  storeId,
  mediaType = 'general',
  onUpload,
  onSelectFromLibrary,
  onRemove,
}) {
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const normalizedLabel = String(label || '').toLowerCase()
  const isWidePreview = aspect === 'banner' || aspect === 'share'

  const previewClass =
    aspect === 'share'
      ? 'aspect-[1200/630] w-full rounded-[1.5rem]'
      : aspect === 'banner'
        ? normalizedLabel.includes('mobile')
          ? 'aspect-[3/2] w-full rounded-[1.5rem]'
          : 'aspect-[3/1] w-full rounded-[1.5rem]'
        : 'aspect-square w-32 rounded-[1.5rem]'

  const fieldLayoutClass = isWidePreview
    ? 'space-y-3'
    : 'flex flex-col gap-4 sm:flex-row sm:items-center'

  const actionsLayoutClass = isWidePreview
    ? 'grid gap-3 sm:grid-cols-2'
    : 'min-w-0 flex-1 space-y-3'

  const helperTextClass = isWidePreview
    ? 'text-xs leading-5 text-[#6b7280] dark:text-zinc-400 sm:col-span-2'
    : 'text-xs leading-5 text-[#6b7280] dark:text-zinc-400'

  const recommendation = useMemo(() => {
    if (aspect === 'share') {
      return 'Recomendado: 1200 x 630 px. Mantenha textos e elementos importantes no centro.'
    }

    if (aspect === 'banner' && normalizedLabel.includes('mobile')) {
      return 'Recomendado: 1080 x 720 px. Proporção ideal: 3:2.'
    }

    if (aspect === 'banner') {
      return 'Recomendado: 1600 x 533 px ou 1440 x 480 px. Proporção ideal: 3:1.'
    }

    return 'Recomendado: 800 x 800 px ou 1200 x 1200 px. Use imagem quadrada, de preferência PNG/WebP, com boa margem e fundo transparente.'
  }, [aspect, normalizedLabel])

  const previewRatioLabel =
    aspect === 'share'
      ? 'Prévia 1200:630'
      : aspect === 'banner'
        ? normalizedLabel.includes('mobile')
          ? 'Prévia 3:2 mobile'
          : 'Prévia 3:1 desktop'
        : 'Prévia 1:1'

  const libraryOptimizedVariant =
    aspect === 'share'
      ? 'ogImage'
      : aspect === 'banner'
        ? normalizedLabel.includes('mobile')
          ? 'storeBannerMobile'
          : 'storeBanner'
        : 'storeLogoLarge'

  const handleDroppedFile = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(false)

    if (uploading) return

    const file = event.dataTransfer?.files?.[0]

    if (!file) return

    const isImage = file.type?.startsWith('image/')

    if (!isImage) {
      window.alert('Envie apenas imagens nos formatos PNG, JPG, JPEG ou WEBP.')
      return
    }

    onUpload(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!uploading) {
      setIsDraggingFile(true)
    }
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(false)
  }

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
            {label}
          </p>

          {description && (
            <p className="mt-1 text-xs leading-5 text-[#6b7280] dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 dark:bg-red-950/35 dark:text-red-300 dark:hover:bg-red-950/60"
            title="Remove a imagem deste campo, mas mantém ela na biblioteca."
          >
            Remover
          </button>
        )}
      </div>

      <div className={fieldLayoutClass}>
        <MediaLibraryPicker
          storeId={storeId}
          type={mediaType}
          onSelect={(item) => {
            const selectedUrl = getCloudinaryImageUrl(
              item.originalUrl || item.url,
              libraryOptimizedVariant,
              { replaceExistingTransform: true }
            )

            onSelectFromLibrary?.(selectedUrl, item)
          }}
        >
          {({ openLibrary, disabled }) => (
            <>
              <div className={`${previewClass} relative shrink-0`}>
                <button
                  type="button"
                  onClick={openLibrary}
                  disabled={disabled || uploading}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDroppedFile}
                  className={`group absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed bg-white text-gray-400 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-500 ${
                    isDraggingFile
                      ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100 dark:border-orange-500 dark:bg-zinc-900 dark:ring-orange-500/20'
                      : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-700 dark:hover:border-orange-500/50 dark:hover:bg-zinc-900'
                  }`}
                  title="Clique para escolher da biblioteca ou arraste uma imagem aqui"
                >
                  {value ? (
                    <img
                      src={value}
                      alt={label}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02] group-hover:opacity-80"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                      <FiImage size={24} />
                      <span className="text-xs font-black text-gray-400 dark:text-zinc-500">
                        Clique ou arraste uma imagem
                      </span>
                    </div>
                  )}

                  {uploading && (
                    <div className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                      <div className="flex items-center gap-2 rounded-2xl bg-black/50 px-4 py-2 text-xs font-black">
                        <FiLoader className="animate-spin" />
                        Enviando...
                      </div>
                    </div>
                  )}

                  {!uploading && isDraggingFile && (
                    <div className="absolute inset-0 grid place-items-center bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200">
                      <div className="rounded-2xl bg-white/90 px-4 py-2 text-xs font-black shadow-lg dark:bg-zinc-950/90">
                        Solte a imagem para enviar
                      </div>
                    </div>
                  )}

                  {!uploading && value && !isDraggingFile && (
                    <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-black/55 px-3 py-2 text-center text-[11px] font-black text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      Clique para escolher ou arraste uma imagem
                    </span>
                  )}

                  <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                    {previewRatioLabel}
                  </span>
                </button>

                {value && (
                  <a
                    href={value}
                    download
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Baixar ${label}`}
                    title="Baixar imagem"
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[#111827] shadow-sm ring-1 ring-black/10 backdrop-blur transition hover:bg-white hover:text-[#f97316] dark:bg-zinc-950/80 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-900"
                  >
                    <FiDownload size={14} />
                  </a>
                )}
              </div>

              <div className={actionsLayoutClass}>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]">
                  {uploading ? (
                    <FiLoader className="animate-spin" />
                  ) : (
                    <FiUpload />
                  )}

                  {uploading
                    ? 'Enviando imagem...'
                    : value
                      ? 'Trocar imagem'
                      : 'Enviar imagem'}

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''

                      if (file) onUpload(file)
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={openLibrary}
                  disabled={disabled || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <FiImage />
                  Escolher da biblioteca
                </button>

                <p className={helperTextClass}>
                  {recommendation}
                </p>

                <p className={helperTextClass}>
                  Você pode clicar no preview, escolher da biblioteca, enviar
                  pelo botão ou arrastar uma imagem diretamente aqui.
                </p>

                {value && (
                  <p className={helperTextClass}>
                  Remover limpa apenas este campo. A imagem
                  continua na biblioteca.
                </p>
                )}
              </div>
            </>
          )}
        </MediaLibraryPicker>
      </div>
    </div>
  )
}

function StoreSelector({ stores, selectedStoreId, onSelect }) {
  if (stores.length <= 1) return null

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
      <Label>Loja selecionada</Label>
      <select
        value={selectedStoreId}
        onChange={(event) => onSelect(event.target.value)}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-black text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name || store.storeSlug || store.id}
          </option>
        ))}
      </select>
    </div>
  )
}

function EmptyState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="max-w-md rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiShoppingBag size={24} />
        </div>

        <h1 className="mt-5 text-2xl font-black text-[#111827]">
          Nenhuma loja vinculada
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#6b7280]">
          Nenhuma loja vinculada à sua conta. Conclua o onboarding ou fale com o suporte.
        </p>

        <Link
          to="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
        >
          Finalizar cadastro
        </Link>
      </div>
    </main>
  )
}

const SETTINGS_NAV_ITEMS = [
  { id: 'settings-identity', label: 'Identidade', icon: FiGlobe },
  { id: 'settings-images', label: 'Logo e banner', icon: FiImage },
  { id: 'settings-contact', label: 'Contato', icon: FiPhone },
  { id: 'settings-hours', label: 'Horários', icon: FiClock },
  { id: 'settings-scheduling', label: 'Agendamento', icon: FiCalendar },
  { id: 'settings-address', label: 'Endereço', icon: FiMapPin },
  { id: 'settings-operation', label: 'Operação', icon: FiMonitor },
  { id: 'settings-notifications', label: 'Alertas', icon: FiZap },
  { id: 'settings-payments', label: 'Pagamentos', icon: FiShield },
]

export default function Settings() {
  const {
    user,
    storeId: authStoreId,
    storeIds: authStoreIds = [],
  } = useAuth()

  // 📍 COLE O BLOCO EXATAMENTE AQUI DENTRO:
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const observers = []

    SETTINGS_NAV_ITEMS.forEach((item) => {
      const element = document.getElementById(item.id)
      if (!element) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(item.id)
          }
        },
        { rootMargin: '-20% 0px -60% 0px' }
      )

      observer.observe(element)
      observers.push({ observer, element })
    })

    return () => {
      observers.forEach(({ observer, element }) => observer.unobserve(element))
    }
  }, [])

  // Seus outros estados originais continuam normalmente abaixo...
const [stores, setStores] = useState([])
const [selectedStoreId, setSelectedStoreId] = useState('')
const [loadingStores, setLoadingStores] = useState(true)
const [saving, setSaving] = useState(false)
const [uploadingImage, setUploadingImage] = useState('')
const [toast, setToast] = useState(null)
const [form, setForm] = useState(DEFAULT_FORM)
const [blockedDateInput, setBlockedDateInput] = useState('')

const knownStoreIds = useMemo(() => {
  return uniqueArray([
    authStoreId,
    ...(Array.isArray(authStoreIds) ? authStoreIds : []),
    user?.storeId,
    ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
  ].map((value) => String(value || '').trim()))
}, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

const knownStoreIdsKey = useMemo(() => {
  return knownStoreIds.join('|')
}, [knownStoreIds])

  const selectedStore = useMemo(() => {
    return stores.find((store) => store.id === selectedStoreId) || stores[0] || null
  }, [selectedStoreId, stores])

  const publicSlug = slugify(form.slug || form.name)
  const publicUrl = getStorePublicUrl(publicSlug)
  const settingsOperationalPreview = useMemo(() => {
    return getStoreOperationalStatus({
      ...(selectedStore || {}),
      isOpen: form.isOpen,
      isActive: form.isActive,
      openingHours: form.openingHours,
      settings: {
        ...(selectedStore?.settings || {}),
        availabilityMode: form.availabilityMode,
        openingHours: form.openingHours,
        temporaryPauseUntil: form.temporaryPauseUntil || null,
        temporaryPauseReason: form.temporaryPauseReason || '',
      },
    })
  }, [
    form.availabilityMode,
    form.isActive,
    form.isOpen,
    form.openingHours,
    form.temporaryPauseReason,
    form.temporaryPauseUntil,
    selectedStore,
  ])

  const themeVars = useMemo(() => ({
    '--store-theme': form.themeColor || BRAND_GREEN,
  }), [form.themeColor])

  const mercadoPagoOrderPayments = selectedStore?.payments?.mercadoPago || selectedStore?.payments?.mercadopago || {}
  const mercadoPagoOrderPaymentsActive =
    mercadoPagoOrderPayments.enabled === true &&
    String(mercadoPagoOrderPayments.status || '').toLowerCase() === 'active'
  const brandingAllowed = hasPlanFeature(selectedStore || {}, 'customBranding')
  const schedulingAllowed = hasPlanFeature(selectedStore || {}, 'scheduling')
  const readiness = useMemo(
    () => getReadinessChecks({ form, selectedStore, schedulingAllowed }),
    [form, schedulingAllowed, selectedStore]
  )
  const schedulingLeadInput = useMemo(
    () => splitMinutesForInput(form.scheduling?.minLeadMinutes),
    [form.scheduling?.minLeadMinutes]
  )
  const schedulingMaxDaysAheadExceeded =
    Number(form.scheduling?.maxDaysAhead || 0) > MAX_SCHEDULE_DAYS_AHEAD

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const updateScheduling = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      scheduling: {
        ...normalizeStoreScheduling(prev.scheduling),
        [field]: value,
      },
    }))
  }, [])

  const updateSchedulingFulfillment = useCallback((field, value) => {
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)
      return {
        ...prev,
        scheduling: {
          ...scheduling,
          fulfillmentTypes: {
            ...scheduling.fulfillmentTypes,
            [field]: value,
          },
        },
      }
    })
  }, [])

  const updateSchedulingWindow = useCallback((dayKey, field, value) => {
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)
      const current = scheduling.weeklyWindows?.[dayKey]?.[0] || { start: '08:00', end: '18:00' }
      return {
        ...prev,
        scheduling: {
          ...scheduling,
          weeklyWindows: {
            ...scheduling.weeklyWindows,
            [dayKey]: [{ ...current, [field]: value }],
          },
        },
      }
    })
  }, [])

  const toggleSchedulingDay = useCallback((dayKey, enabled) => {
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)
      return {
        ...prev,
        scheduling: {
          ...scheduling,
          weeklyWindows: {
            ...scheduling.weeklyWindows,
            [dayKey]: enabled ? [{ start: '08:00', end: '18:00' }] : [],
          },
        },
      }
    })
  }, [])

  const copyOpeningHoursToScheduling = useCallback(() => {
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)

      return {
        ...prev,
        scheduling: {
          ...scheduling,
          weeklyWindows: openingHoursToSchedulingWindows(prev.openingHours),
        },
      }
    })

    showToast('success', 'Horários de funcionamento copiados para o agendamento.')
  }, [showToast])

  const addBlockedDate = useCallback(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockedDateInput)) return
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)
      return {
        ...prev,
        scheduling: {
          ...scheduling,
          blockedDates: [...new Set([...(scheduling.blockedDates || []), blockedDateInput])].sort(),
        },
      }
    })
    setBlockedDateInput('')
  }, [blockedDateInput])

  const removeBlockedDate = useCallback((date) => {
    setForm((prev) => {
      const scheduling = normalizeStoreScheduling(prev.scheduling)
      return {
        ...prev,
        scheduling: {
          ...scheduling,
          blockedDates: scheduling.blockedDates.filter((blockedDate) => blockedDate !== date),
        },
      }
    })
  }, [])

  const updateOpeningHour = useCallback((dayId, field, value) => {
  setForm((prev) => {
    const defaultHours = getDefaultOpeningHours()
    const currentDayHours = prev.openingHours?.[dayId] || defaultHours[dayId]

    return {
      ...prev,
      openingHours: {
        ...(prev.openingHours || defaultHours),
        [dayId]: {
          ...currentDayHours,
          [field]: value,
        },
      },
    }
  })
}, [])

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId)
    safeSetLocalStorage(SELECTED_STORE_KEY, storeId)
  }, [])

  useEffect(() => {
    if (!user?.uid || !knownStoreIds.length) {
      setStores([])
      setLoadingStores(false)
      return undefined
    }

    setLoadingStores(true)

    const storesMap = new Map()
    const unsubscribers = []

    function publishStores() {
      const nextStores = Array.from(storesMap.values())
        .filter((store) => userCanManageStore(user, store))
        .sort((a, b) => {
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
            storesMap.set(snapshot.id, normalizeStore(snapshot))
          } else {
            storesMap.delete(storeDocId)
          }

          publishStores()
        },
        (error) => {
          console.error(error)
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
  }, [knownStoreIds, knownStoreIdsKey, user])

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId('')
      return
    }

    setSelectedStoreId((current) => {
      if (stores.some((store) => store.id === current)) return current

      const savedStoreId = safeGetLocalStorage(SELECTED_STORE_KEY)

      if (stores.some((store) => store.id === savedStoreId)) {
        return savedStoreId
      }

      return stores[0].id
    })
  }, [stores])

  useEffect(() => {
    if (!selectedStore) return

    setForm(mapStoreToForm(selectedStore))
  }, [selectedStore])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      showToast('success', 'Link da loja copiado.')
    } catch {
      showToast('error', 'Não foi possível copiar o link.')
    }
  }, [publicUrl, showToast])

  const handleUploadStoreImage = useCallback(
    async (file, fieldName) => {
      if (!file || !selectedStore) return

      if (!userCanManageStore(user, selectedStore)) {
        showToast('error', 'Você não tem permissão para alterar esta loja.')
        return
      }

      if (!file.type?.startsWith('image/')) {
        showToast('error', 'Envie uma imagem válida.')
        return
      }

      const maxSizeInMb = 6

      if (file.size > maxSizeInMb * 1024 * 1024) {
        showToast('error', `Imagem muito pesada. Use até ${maxSizeInMb}MB.`)
        return
      }

      setUploadingImage(fieldName)

      try {
        const folder = `PratoBy/${getStoreSlug(selectedStore) || selectedStore.id}/branding/${fieldName}`
        const uploaded = await uploadImageToCloudinary(file, folder, {
          storeId: selectedStore.id,
        })
        const imageUrl = uploaded?.secure_url || uploaded?.url || uploaded

        if (!imageUrl) {
          throw new Error('Cloudinary não retornou a URL da imagem.')
        }

        updateField(
          fieldName,
          getCloudinaryImageUrl(imageUrl, getStoreImageVariant(fieldName), {
            replaceExistingTransform: true,
          })
        )
        try {
          await registerStoreMediaAsset({
            storeId: selectedStore.id,
            uploadResult: uploaded,
            type: getStoreImageMediaType(fieldName),
            uploadedBy: user?.uid,
          })
        } catch (mediaError) {
          console.warn(
            'Imagem enviada, mas não foi possível registrar na biblioteca:',
            mediaError
          )
        }
        showToast('success', 'Imagem enviada. Salve para aplicar na loja.')
      } catch (error) {
        console.error(error)
        showToast('error', error?.message || 'Erro ao enviar imagem.')
      } finally {
        setUploadingImage('')
      }
    },
    [selectedStore, showToast, updateField, user]
  )

  const handleSave = useCallback(async () => {
    if (!selectedStore || saving) return
    

    const cleanName = sanitizeTextField(form.name, 100)
    if (!cleanName) {
      showToast('error', 'Digite o nome da loja.')
      return
    }

    if (!userCanManageStore(user, selectedStore)) {
      showToast('error', 'Você não tem permissão para alterar esta loja.')
      return
    }

    const blockingReadinessIssue = getReadinessChecks({
      form,
      selectedStore,
      schedulingAllowed,
    }).checks.find((check) => check.blocksSave === true || Boolean(check.saveMessage))

    if (blockingReadinessIssue) {
      showToast('error', blockingReadinessIssue.saveMessage || blockingReadinessIssue.description)
      scrollToFirstError()
      return
    }

    setSaving(true)

    try {
      const themeColor = normalizeThemeColor(form.themeColor)
      const segment = SEGMENTS.includes(form.segment) ? form.segment : 'Restaurante'
      const deliveryTime = sanitizeTextField(form.deliveryTime, 40) || DEFAULT_FORM.deliveryTime
      const instagram = sanitizeSocial(form.instagram).slice(0, 80)
      const whatsapp = normalizeBrazilianPhoneForWhatsApp(form.whatsapp)
      const logoUrl = sanitizeImageUrl(form.logoUrl)
      const bannerUrl = sanitizeImageUrl(form.bannerUrl)
      const bannerMobileUrl = sanitizeImageUrl(form.bannerMobileUrl)
      const shareImageUrl = sanitizeImageUrl(form.shareImageUrl)
      if (form.whatsapp && whatsapp.replace(/\D/g, '').length < 12) {
        throw new Error('Informe um WhatsApp brasileiro válido com DDD.')
      }

      const minOrderCents = currencyToCents(form.minOrder)
      const minOrder = minOrderCents / 100
      const openingHours = normalizeOpeningHoursForSave(form.openingHours)
      const scheduling = normalizeStoreScheduling(form.scheduling)
      const schedulingValidationError = getSchedulingValidationError(scheduling)

      if (schedulingValidationError) {
        showToast('error', schedulingValidationError)
        scrollToFirstError()
        return
      }

      const autoCloseGraceMinutes = Math.min(
        240,
        Math.max(0, Number.parseInt(form.autoCloseGraceMinutes, 10) || 30)
      )

      const activeDays = DAYS_OF_WEEK
        .filter((day) => openingHours?.[day.id]?.enabled)
        .map((day) => day.short)

      const firstOpenDay = DAYS_OF_WEEK.find(
        (day) => openingHours?.[day.id]?.enabled
      )

      const hoursOpen = firstOpenDay
        ? openingHours[firstOpenDay.id].open
        : '18:00'

      const hoursClose = firstOpenDay
        ? openingHours[firstOpenDay.id].close
        : '23:30'

      const settings = {
        availabilityMode: form.availabilityMode === 'opening_hours' ? 'opening_hours' : 'manual',
        operatingMode: form.availabilityMode === 'opening_hours' ? 'opening_hours' : 'manual',
        timeZone: 'America/Sao_Paulo',
        temporaryPauseUntil: form.temporaryPauseUntil || null,
        temporaryPauseReason: sanitizeTextField(form.temporaryPauseReason, 120),
        allowScheduledOrdersWhenClosed: Boolean(form.allowScheduledOrdersWhenClosed),
      }

      const payload = {
        name: cleanName,
        storeName: cleanName,
        description: sanitizeTextField(form.description, 500),
        segment,
        category: segment,

        logoUrl,
        bannerUrl,
        bannerMobileUrl,
        ...(brandingAllowed ? { shareImageUrl } : {}),
        themeColor,

        whatsapp,
        whatsapp1: whatsapp,
        phone: whatsapp,
        instagram,
        social: {
          ...(selectedStore.social || {}),
          instagram,
        },

        isActive: Boolean(form.isActive),
        newOrderSoundEnabled: Boolean(form.newOrderSoundEnabled),
        printAfterConfirm: Boolean(form.printAfterConfirm),
        autoCloseEnabled: Boolean(form.autoCloseEnabled),
        autoCloseGraceMinutes,

        activeDays,
        hoursOpen,
        hoursClose,
        openingHours,
        scheduling,
        settings,

        deliveryTime,
        minOrder,
        minOrderCents,

        acceptDelivery: Boolean(form.acceptDelivery),
        acceptPickup: Boolean(form.acceptPickup),
        acceptDineIn: Boolean(form.acceptDineIn),


        address: {
          cep: sanitizeTextField(form.cep, 12),
          street: sanitizeTextField(form.street, 120),
          number: sanitizeTextField(form.number, 20),
          neighborhood: sanitizeTextField(form.neighborhood, 80),
          complement: sanitizeTextField(form.complement, 120),
          city: sanitizeTextField(form.city, 80),
          state: sanitizeTextField(form.state, 2).toUpperCase() || 'SE',
        },

        cep: sanitizeTextField(form.cep, 12),
        street: sanitizeTextField(form.street, 120),
        number: sanitizeTextField(form.number, 20),
        neighborhood: sanitizeTextField(form.neighborhood, 80),
        complement: sanitizeTextField(form.complement, 120),
        city: sanitizeTextField(form.city, 80),
        state: sanitizeTextField(form.state, 2).toUpperCase() || 'SE',
      }

      const ALLOWED_KEYS = [
        'name', 'storeName', 'description', 'segment', 'category',
        'logoUrl', 'bannerUrl', 'bannerMobileUrl', 'shareImageUrl', 'themeColor', 'whatsapp', 'whatsapp1',
        'phone', 'instagram', 'social', 'isActive', 'activeDays',
        'newOrderSoundEnabled', 'printAfterConfirm', 'autoCloseEnabled', 'autoCloseGraceMinutes',
        'hoursOpen', 'hoursClose', 'openingHours', 'scheduling', 'settings', 'deliveryTime',
        'minOrder', 'minOrderCents', 'acceptDelivery', 'acceptPickup',
        'acceptDineIn', 'address', 'cep', 'street',
        'number', 'neighborhood', 'complement', 'city', 'state'
      ]

      const finalPayload = Object.keys(payload).reduce((acc, key) => {
        if (ALLOWED_KEYS.includes(key)) {
          const value = cleanFirestoreValue(payload[key])
          if (value !== undefined) acc[key] = value
        }
        return acc
      }, {})

      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId: selectedStore.id,
        updates: finalPayload,
      })

      safeSetLocalStorage(SELECTED_STORE_KEY, selectedStore.id)
      showToast('success', 'Configurações da loja salvas.')
    } catch (error) {
      console.error(error)
      showToast('error', error?.message || 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }, [brandingAllowed, form, saving, schedulingAllowed, selectedStore, showToast, user])

  if (loadingStores) {
    return (
      <main className="bg-[#f9fafb] text-[#111827]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </header>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[74px_minmax(0,1fr)_360px] lg:px-8">
          <div className="h-[300px] animate-pulse rounded-[1.8rem] border border-gray-100 bg-white shadow-sm lg:order-2" />
          <div className="space-y-6 lg:order-1">
            <div className="h-64 animate-pulse rounded-[1.8rem] border border-gray-100 bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-[1.8rem] border border-gray-100 bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-[1.8rem] border border-gray-100 bg-white shadow-sm" />
          </div>
        </div>
      </main>
    )
  }

  if (!selectedStore) {
    return <EmptyState />
  }

  return (
    <main style={themeVars}
      className="bg-[#f9fafb] text-[#111827]"
    >
      <FloatingToast toast={toast} onClose={() => setToast(null)} />

      <DashboardPageHeader
        title="Configurações"
        description="Identidade, link, contato, horários e operação da loja."
        icon={FiSettings}
        actions={
          <>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              <FiExternalLink />
              Ver loja
            </a>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[64px_minmax(0,1fr)_360px] xl:grid-cols-[64px_minmax(0,1fr)_380px] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:order-1 lg:h-fit">
  <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white/80 p-2 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 lg:w-14 lg:flex-col lg:overflow-visible">
    {SETTINGS_NAV_ITEMS.map((item) => {
      const Icon = item.icon
      const isActive = activeSection === item.id

      return (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-label={item.label}
          className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
            isActive
              ? 'bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
              : 'text-zinc-400 hover:bg-orange-50/50 hover:text-orange-500 dark:text-zinc-500 dark:hover:bg-orange-500/5 dark:hover:text-orange-400'
          }`}
        >
          {/* Pequena barra indicadora na lateral esquerda (ativa apenas no Desktop) */}
          <span
            className={`absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r-full bg-orange-500 transition-all duration-200 hidden lg:block ${
              isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50 group-hover:opacity-50'
            }`}
          />

          {/* Ícone com animação */}
          <Icon
            size={18}
            className={`transition-transform duration-200 ${isActive ? 'scale-100' : 'group-hover:scale-110'}`}
          />

          {/* Tooltip flutuante Premium */}
          <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 invisible opacity-0 -translate-y-1/2 translate-x-1 scale-95 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md transition-all duration-200 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 dark:bg-zinc-800 lg:block">
            {item.label}
          </span>

          <span className="sr-only">{item.label}</span>
        </a>
      )
    })}
  </nav>
</aside>
        <aside className="space-y-5 lg:order-3">
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            onSelect={handleSelectStore}
          />

          <section className="overflow-hidden rounded-[1.8rem] border border-gray-100 bg-white shadow-sm">
            <div className="relative h-40 bg-[#111827]">
              {form.bannerUrl ? (
                <img
                  src={form.bannerUrl}
                  alt={form.name}
                  className="h-full w-full object-cover opacity-80"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#111827] to-[#f97316]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiShoppingBag className="text-[#f97316]" size={26} />
                  )}
                </div>

                <div className="min-w-0 pb-1 text-white">
                  <p className="truncate text-xl font-black">
                    {form.name || 'Nome da loja'}
                  </p>
                  <p className="truncate text-xs font-bold opacity-80">
                    /{publicSlug || 'nome-da-loja'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f9fafb] p-4">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Status
                  </p>
                  <p className={`mt-1 text-sm font-black ${selectedStore?.isOpen !== false ? 'text-[#f97316]' : 'text-red-600'}`}>
                    {selectedStore?.isOpen !== false ? 'Aberta' : 'Fechada'}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f9fafb] p-4">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Horário
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827]">
                    {form.hoursOpen} às {form.hoursClose}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
              >
                <FiCopy />
                Copiar link público
              </button>
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-6 lg:order-2">

          <div className="flex flex-col gap-4 rounded-[1.8rem] border border-orange-100 bg-orange-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-[#111827]">Quer editar produtos e categorias? Acesse Gerenciar cardápio.</h3>
              <p className="mt-1 text-sm text-[#6b7280]">
                A gestão de itens do cardápio mudou para uma área dedicada.
              </p>
            </div>
            <Link
              to="/dashboard/menu"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
            >
              Gerenciar cardápio
            </Link>
          </div>
          <section
            id="settings-readiness"
            className={`rounded-[1.8rem] border p-5 shadow-sm transition-colors ${
              readiness.criticalCount > 0
                ? 'border-red-200 bg-red-50/90 dark:border-red-500/25 dark:bg-red-950/25'
                : readiness.warningCount > 0
                  ? 'border-amber-200 bg-amber-50/90 dark:border-amber-500/25 dark:bg-amber-950/25'
                  : 'border-emerald-200 bg-emerald-50/90 dark:border-emerald-500/25 dark:bg-emerald-950/25'
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {readiness.criticalCount > 0 ? (
                    <FiAlertCircle className="shrink-0 text-red-600 dark:text-red-300" size={20} />
                  ) : readiness.warningCount > 0 ? (
                    <FiAlertCircle className="shrink-0 text-amber-600 dark:text-amber-300" size={20} />
                  ) : (
                    <FiCheckCircle className="shrink-0 text-emerald-600 dark:text-emerald-300" size={20} />
                  )}

                  <h2 className="text-lg font-black text-[#111827] dark:text-white">
                    Prontidão da loja
                  </h2>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280] dark:text-gray-300">
                  {readiness.criticalCount > 0
                    ? 'Bloqueantes mostram o que impede vender agora. Avisos e recomendacoes ajudam a reduzir atrito sem travar a operacao.'
                    : readiness.warningCount > 0
                      ? 'A loja pode salvar, mas estes pontos podem gerar duvida ou atrito no pedido publico.'
                      : 'As configuracoes principais para receber pedidos estao coerentes.'}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-red-600 shadow-sm ring-1 ring-red-100 dark:bg-white/10 dark:text-red-200 dark:ring-red-400/20">
                  {readiness.criticalCount} bloqueante
                </span>

                <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-amber-600 shadow-sm ring-1 ring-amber-100 dark:bg-white/10 dark:text-amber-200 dark:ring-amber-400/20">
                  {readiness.warningCount} aviso
                </span>

                <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-sky-600 shadow-sm ring-1 ring-sky-100 dark:bg-white/10 dark:text-sky-200 dark:ring-sky-400/20">
                  {readiness.recommendedCount} recomendado
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {readiness.checks.map((check) => {
                const Icon = check.status === 'ok' ? FiCheckCircle : FiAlertCircle

                const toneClass =
                  check.status === 'critical'
                    ? 'border-red-100 bg-white text-red-600 dark:border-red-500/25 dark:bg-red-950/35 dark:text-red-300'
                    : check.status === 'warning'
                      ? 'border-amber-100 bg-white text-amber-600 dark:border-amber-500/25 dark:bg-amber-950/35 dark:text-amber-300'
                      : check.status === 'recommended'
                        ? 'border-sky-100 bg-white text-sky-600 dark:border-sky-500/25 dark:bg-sky-950/35 dark:text-sky-300'
                        : 'border-emerald-100 bg-white text-emerald-600 dark:border-emerald-500/25 dark:bg-emerald-950/35 dark:text-emerald-300'

                const actionClass = 'mt-3 inline-flex h-8 items-center justify-center rounded-xl bg-white px-3 text-[11px] font-black text-[#111827] shadow-sm ring-1 ring-gray-100 transition hover:text-[#f97316] dark:bg-white/10 dark:text-zinc-100 dark:ring-white/10'

                return (
                  <div
                    key={`${check.status}-${check.title}`}
                    className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-colors ${toneClass}`}
                  >
                    <Icon className="mt-0.5 shrink-0" size={18} />

                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wide opacity-70">
                        {check.label || 'Status'}
                      </span>

                      <p className="text-sm font-black text-[#111827] dark:text-white">
                        {check.title}
                      </p>

                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280] dark:text-gray-300">
                        {check.description}
                      </p>

                      {check.to && check.actionLabel ? (
                        <Link to={check.to} className={actionClass}>
                          {check.actionLabel}
                        </Link>
                      ) : check.href && check.actionLabel ? (
                        <a href={check.href} className={actionClass}>
                          {check.actionLabel}
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <Section
            id="settings-identity"
            icon={FiGlobe}
            title="Identidade da loja"
            description="Essas informações aparecem no cardápio público e no compartilhamento da loja."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nome da loja"
                icon={FiShoppingBag}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Ex: La Bella Pizza"
              />

              <Select
                label="Segmento"
                value={form.segment}
                onChange={(event) => updateField('segment', event.target.value)}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </Select>

              <div>
                <label className="mb-2 block text-sm font-black text-[#111827]">Link da loja</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                    <FiLink size={18} />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={publicSlug || 'nome-da-loja'}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-sm font-bold text-gray-500 shadow-sm outline-none cursor-not-allowed"
                  />
                </div>
                <p className="mt-2 text-xs text-[#6b7280]">
                  Para alterar o link público da loja, fale com o suporte.
                </p>
              </div>

              <Input
                label="Cor principal"
                type="color"
                value={form.themeColor}
                onChange={(event) => updateField('themeColor', event.target.value)}
                className="[&>div>input]:h-12 [&>div>input]:p-1"
              />

              <Textarea
                label="Descrição curta"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Pizzas artesanais com massa de longa fermentação..."
                className="md:col-span-2"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                Link público
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-all text-sm font-bold text-[#111827]">
                  {publicUrl}
                </p>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#111827] shadow-sm"
                >
                  <FiCopy />
                  Copiar
                </button>
              </div>
            </div>
          </Section>

          <Section
            id="settings-images"
            icon={FiImage}
            title="Logo e banner"
            description="Imagens usadas no cabeçalho do cardápio público."
          >
            <div className="grid gap-4">
              <ImageUploadField
                label="Logo da loja"
                description="Recomendado: 800 x 800 px ou 1200 x 1200 px. Use imagem quadrada, de preferência PNG/WebP, com boa margem e fundo transparente."
                value={form.logoUrl}
                uploading={uploadingImage === 'logoUrl'}
                storeId={selectedStore.id}
                mediaType="logo"
                onUpload={(file) => handleUploadStoreImage(file, 'logoUrl')}
                onSelectFromLibrary={(url) => updateField('logoUrl', url)}
                onRemove={() => updateField('logoUrl', '')}
              />

              <ImageUploadField
                label="Banner principal"
                description="Usado em telas maiores, como computador e tablet. Recomendado: 1600 x 533 px ou 1440 x 480 px. Proporção ideal: 3:1."
                aspect="banner"
                value={form.bannerUrl}
                uploading={uploadingImage === 'bannerUrl'}
                storeId={selectedStore.id}
                mediaType="banner"
                onUpload={(file) => handleUploadStoreImage(file, 'bannerUrl')}
                onSelectFromLibrary={(url) => updateField('bannerUrl', url)}
                onRemove={() => updateField('bannerUrl', '')}
              />

              <ImageUploadField
                label="Banner mobile"
                description="Versão otimizada para celular. Se não enviar, usaremos o banner principal. Recomendado: 1080 x 720 px. Proporção ideal: 3:2."
                aspect="banner"
                value={form.bannerMobileUrl}
                uploading={uploadingImage === 'bannerMobileUrl'}
                storeId={selectedStore.id}
                mediaType="banner"
                onUpload={(file) => handleUploadStoreImage(file, 'bannerMobileUrl')}
                onSelectFromLibrary={(url) => updateField('bannerMobileUrl', url)}
                onRemove={() => updateField('bannerMobileUrl', '')}
              />

              {brandingAllowed ? (
                <ImageUploadField
                  label="Imagem de compartilhamento"
                  description="Usada quando o link da loja é compartilhado no WhatsApp, Instagram, Google e redes sociais. Recomendado: 1200 x 630 px. Mantenha textos e elementos importantes no centro."
                  aspect="share"
                  value={form.shareImageUrl}
                  uploading={uploadingImage === 'shareImageUrl'}
                  storeId={selectedStore.id}
                  mediaType="banner"
                  onUpload={(file) => handleUploadStoreImage(file, 'shareImageUrl')}
                  onSelectFromLibrary={(url) => updateField('shareImageUrl', url)}
                  onRemove={() => updateField('shareImageUrl', '')}
                />
              ) : (
                <LockedFeatureCard
                  featureKey="customBranding"
                  featureName="Imagem de compartilhamento"
                  description="Logo e banners podem ser usados em qualquer plano. A imagem personalizada para WhatsApp, Google e redes sociais fica no Premium."
                />
              )}
            </div>
          </Section>

          <Section
            id="settings-contact"
            icon={FiPhone}
            title="Contato e redes sociais"
            description="Número principal da loja e perfil social exibido para o cliente."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="WhatsApp da loja"
                icon={FiMessageCircle}
                value={formatBrazilianPhone(form.whatsapp)}
                onChange={(event) => updateField('whatsapp', normalizeBrazilianPhoneForWhatsApp(event.target.value) || event.target.value)}
                placeholder="(00) 00000-0000"
              />

              <Input
                label="Instagram"
                icon={FiInstagram}
                value={form.instagram}
                onChange={(event) => updateField('instagram', sanitizeSocial(event.target.value))}
                placeholder="la_bella_pizza"
              />
            </div>
          </Section>

          <Section
  id="settings-hours"
  icon={FiClock}
  title="Horário de funcionamento"
  description="Defina dias e horários diferentes para cada dia da semana."
>
  <div className="space-y-5">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#111827] dark:text-zinc-50">
              Abertura e fechamento
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
              No modo automático, o PratoBy calcula se a loja aceita pedidos usando os horários abaixo, sem precisar de cron ou ação manual.
            </p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${
              settingsOperationalPreview.isOpen
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${settingsOperationalPreview.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {settingsOperationalPreview.isOpen ? 'Aberta agora' : 'Fechada agora'}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            {
              value: 'manual',
              title: 'Manual',
              description: 'Usa o botão abrir/fechar do dashboard.',
            },
            {
              value: 'opening_hours',
              title: 'Automático',
              description: 'Abre e fecha pelos horários cadastrados.',
            },
          ].map((mode) => {
            const active = form.availabilityMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => updateField('availabilityMode', mode.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-[#f97316] bg-white shadow-sm ring-4 ring-orange-100 dark:bg-zinc-950 dark:ring-orange-500/15'
                    : 'border-orange-100 bg-white/70 hover:bg-white dark:border-orange-500/20 dark:bg-zinc-950/30'
                }`}
              >
                <span className="text-sm font-black text-[#111827] dark:text-zinc-50">
                  {mode.title}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                  {mode.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm font-black text-[#111827] dark:text-zinc-50">
          Pausa temporária
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
          Fecha pedidos por um período e reabre automaticamente.
        </p>

        <div className="mt-4 grid gap-3">
          <select
            value=""
            onChange={(event) => {
              const nextUntil = getFutureIso(event.target.value)
              if (!nextUntil) return
              updateField('temporaryPauseUntil', nextUntil)
              updateField('temporaryPauseReason', 'Pausa operacional')
            }}
            className="h-11 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Pausar agora...</option>
            <option value="15">Por 15 minutos</option>
            <option value="30">Por 30 minutos</option>
            <option value="60">Por 1 hora</option>
            <option value="120">Por 2 horas</option>
          </select>

          {form.temporaryPauseUntil ? (
            <div className="rounded-2xl bg-white p-3 text-xs font-bold text-[#6b7280] dark:bg-zinc-950 dark:text-zinc-300">
              Pausada até {formatDateTimePtBr(form.temporaryPauseUntil)}
              <button
                type="button"
                onClick={() => {
                  updateField('temporaryPauseUntil', '')
                  updateField('temporaryPauseReason', '')
                }}
                className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-[#111827] px-3 text-xs font-black text-white transition hover:bg-black dark:bg-zinc-100 dark:text-zinc-950"
              >
                Encerrar pausa
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>

    <Toggle
      checked={Boolean(form.allowScheduledOrdersWhenClosed)}
      onChange={(value) => {
        if (value && !schedulingAllowed) {
          showToast('error', 'Agendamento fora do horário exige plano Profissional ou Premium.')
          return
        }
        updateField('allowScheduledOrdersWhenClosed', value)
      }}
      label="Aceitar pedidos agendados quando a loja estiver fechada"
      description="Mantém pedidos imediatos bloqueados fora do horário, mas permite encomendas ou agendamentos para uma janela válida."
    />

    <div className="space-y-3">
    {DAYS_OF_WEEK.map((day) => {
      const dayHours = form.openingHours?.[day.id] || {
        enabled: false,
        open: '18:00',
        close: '23:30',
      }

      return (
        <div
          key={day.id}
          className="grid gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 sm:grid-cols-[1fr_130px_130px]"
        >
          <button
            type="button"
            onClick={() =>
              updateOpeningHour(day.id, 'enabled', !dayHours.enabled)
            }
            className="flex items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-[#111827]">
                  {day.label}
                </p>

                {getTodayKey() === day.id && (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                    Hoje
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#6b7280]">
                {dayHours.enabled
                  ? `${dayHours.open} às ${dayHours.close}`
                  : 'Fechado'}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                dayHours.enabled
                  ? 'bg-orange-50 text-[#f97316]'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {dayHours.enabled ? 'Aberto' : 'Fechado'}
            </span>
          </button>

          <input
            type="time"
            disabled={!dayHours.enabled}
            value={dayHours.open}
            onChange={(event) =>
              updateOpeningHour(day.id, 'open', event.target.value)
            }
            className="h-11 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-bold disabled:opacity-40"
          />

          <input
            type="time"
            disabled={!dayHours.enabled}
            value={dayHours.close}
            onChange={(event) =>
              updateOpeningHour(day.id, 'close', event.target.value)
            }
            className="h-11 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-bold disabled:opacity-40"
          />
        </div>
      )
    })}
    </div>
  </div>
</Section>

          <Section
            id="settings-scheduling"
            icon={FiCalendar}
            title="Agendamento de pedidos"
            description="Permita que seus clientes escolham uma data e horário para pedidos, encomendas, retiradas programadas e produtos sob encomenda."
          >
            <div className="space-y-5">
              {!schedulingAllowed && (
                <LockedFeatureCard
                  featureKey="scheduling"
                  featureName="Agendamento e encomendas"
                  description="As regras de agendamento ficam salvas, mas só entram em vigor no trial Premium, Profissional ou Premium."
                />
              )}

              <Toggle
                checked={Boolean(form.scheduling?.enabled)}
                onChange={(value) => {
                  if (!schedulingAllowed && value === true) {
                    showToast('error', 'Agendamento exige plano Profissional ou Premium.')
                    return
                  }
                  updateScheduling('enabled', value)
                }}
                label="Aceitar pedidos agendados"
                description="Quando ativo, o checkout público poderá oferecer datas e horários conforme estas regras."
              />

              {!form.scheduling?.enabled ? (
                <div className="rounded-[1.5rem] border border-dashed border-orange-200 bg-orange-50/70 p-5 dark:border-orange-500/25 dark:bg-orange-500/10">
                  <p className="text-sm font-black text-[#111827] dark:text-zinc-50">
                    Agendamento desativado
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
                    Ative para permitir encomendas, retiradas programadas e pedidos com data marcada. As regras abaixo ficam guardadas e só passam a valer quando o agendamento estiver ligado.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_220px]">
                    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <Input
                        label="Antecedência mínima"
                        type="number"
                        min="0"
                        value={schedulingLeadInput.value}
                        onChange={(event) => updateScheduling(
                          'minLeadMinutes',
                          leadTimeToMinutes(event.target.value, schedulingLeadInput.unit)
                        )}
                      />
                      <Select
                        label="Unidade"
                        value={schedulingLeadInput.unit}
                        onChange={(event) => updateScheduling(
                          'minLeadMinutes',
                          leadTimeToMinutes(schedulingLeadInput.value, event.target.value)
                        )}
                      >
                        <option value="minutes">Minutos</option>
                        <option value="hours">Horas</option>
                        <option value="days">Dias</option>
                      </Select>
                    </div>

                    <Input
                      label="Aceitar até quantos dias no futuro?"
                      type="number"
                      min="1"
                      max={MAX_SCHEDULE_DAYS_AHEAD}
                      value={form.scheduling?.maxDaysAhead ?? 14}
                      onChange={(event) => updateScheduling('maxDaysAhead', Number(event.target.value))}
                    />
                    <div className="-mt-2 text-xs font-semibold text-gray-500 dark:text-zinc-400">
                      Máximo de {MAX_SCHEDULE_DAYS_AHEAD} dias à frente permitido.
                      {schedulingMaxDaysAheadExceeded && (
                        <span className="mt-1 block font-black text-amber-700 dark:text-amber-300">
                          Valor limitado a {MAX_SCHEDULE_DAYS_AHEAD} dias.
                        </span>
                      )}
                    </div>

                    <Select
                      label="Intervalo dos horários"
                      value={form.scheduling?.slotIntervalMinutes ?? 30}
                      onChange={(event) => updateScheduling('slotIntervalMinutes', Number(event.target.value))}
                    >
                      <option value={10}>10 minutos</option>
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={60}>60 minutos</option>
                    </Select>
                  </div>

                  <div className="grid items-stretch gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <Label>Tipos aceitos</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ['delivery', 'Entrega'],
                          ['pickup', 'Retirada'],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:bg-orange-50 dark:bg-zinc-950/50 dark:text-zinc-100 dark:hover:bg-orange-500/10"
                          >
                            <input
                              type="checkbox"
                              checked={form.scheduling?.fulfillmentTypes?.[key] !== false}
                              onChange={(event) => updateSchedulingFulfillment(key, event.target.checked)}
                              className="h-4 w-4 shrink-0 accent-[#f97316]"
                            />
                            <span className="leading-none">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 dark:border-orange-500/25 dark:bg-orange-500/10">
                      <Label>Pagamento antecipado</Label>
                      <p className="text-sm font-black text-[#111827] dark:text-zinc-50">
                        Regras de encomenda ficam em Pagamentos
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                        Configure Pix manual, Mercado Pago online e exigencia de pagamento antecipado em uma area propria.
                      </p>
                      <Link
                        to="/dashboard/pagamentos"
                        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c]"
                      >
                        <FiExternalLink size={14} />
                        Ir para Pagamentos
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Label>Horários disponíveis por dia da semana</Label>
                        <p className="text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                          Um dia sem janela fica indisponível para agendamento.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={copyOpeningHoursToScheduling}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 text-xs font-black text-[#f97316] shadow-sm transition hover:border-orange-200 hover:bg-orange-50 dark:border-orange-500/20 dark:bg-zinc-950/50 dark:hover:bg-orange-500/10"
                      >
                        <FiCopy size={14} />
                        Copiar funcionamento
                      </button>
                    </div>

                    <div className="space-y-3">
                      {SCHEDULING_DAYS.map((day) => {
                        const dayWindows = form.scheduling?.weeklyWindows?.[day.key] || []
                        const enabled = dayWindows.length > 0
                        const window = dayWindows[0] || { start: '08:00', end: '18:00' }
                        const invalidWindow = enabled && (!isValidTime(window.start) || !isValidTime(window.end) || window.start >= window.end)

                        return (
                          <div
                            key={day.key}
                            className={`grid items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-zinc-950/40 sm:grid-cols-[minmax(0,1fr)_118px_118px] ${
                              invalidWindow
                                ? 'border-red-200 dark:border-red-500/30'
                                : 'border-gray-100 dark:border-zinc-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSchedulingDay(day.key, !enabled)}
                              className="flex items-center justify-between gap-3 text-left"
                            >
                              <div>
                                <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
                                  {day.label}
                                </p>
                                <p className={`mt-1 text-xs ${invalidWindow ? 'font-bold text-red-500' : 'text-[#6b7280] dark:text-zinc-400'}`}>
                                  {invalidWindow
                                    ? 'Revise este horário'
                                    : enabled
                                      ? `${window.start} às ${window.end}`
                                      : 'Indisponível'}
                                </p>
                              </div>

                              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                                enabled
                                  ? 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300'
                                  : 'bg-gray-200 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}>
                                {enabled ? 'Disponível' : 'Indisponível'}
                              </span>
                            </button>

                            <input
                              type="time"
                              disabled={!enabled}
                              value={window.start}
                              onChange={(event) => updateSchedulingWindow(day.key, 'start', event.target.value)}
                              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 text-xs font-black text-[#f97316] transition hover:border-orange-500/35 hover:bg-orange-500/15 dark:text-orange-300"
                            />

                            <input
                              type="time"
                              disabled={!enabled}
                              value={window.end}
                              onChange={(event) => updateSchedulingWindow(day.key, 'end', event.target.value)}
                              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 text-xs font-black text-[#f97316] transition hover:border-orange-500/35 hover:bg-orange-500/15 dark:text-orange-300"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <Label>Datas bloqueadas</Label>
                    <p className="mb-3 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                      Use para feriados, folgas ou dias em que não aceitará encomendas.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="date"
                        value={blockedDateInput}
                        onChange={(event) => setBlockedDateInput(event.target.value)}
                        className="h-12 flex-1 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-100 dark:focus:ring-orange-500/20"
                      />
                      <button
                        type="button"
                        onClick={addBlockedDate}
                        className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white transition hover:bg-[#ea580c]"
                      >
                        Adicionar data
                      </button>
                    </div>

                    {form.scheduling?.blockedDates?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {form.scheduling.blockedDates.map((date) => (
                          <span
                            key={date}
                            className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3 py-1.5 text-xs font-black text-[#111827] dark:border-orange-500/20 dark:bg-zinc-950/50 dark:text-zinc-100"
                          >
                            {formatBlockedDate(date)}
                            <button
                              type="button"
                              onClick={() => removeBlockedDate(date)}
                              className="text-gray-400 transition hover:text-red-500"
                              aria-label={`Remover ${formatBlockedDate(date)}`}
                            >
                              <FiX size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Section>

          <Section
            id="settings-address"
            icon={FiMapPin}
            title="Endereço"
            description="Endereço textual da loja. Entrega por bairro continua sendo configurada no editor do cardápio."
          >
            <div className="grid gap-4 md:grid-cols-6">
              <Input
                label="CEP"
                value={form.cep}
                onChange={(event) => updateField('cep', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Rua"
                value={form.street}
                onChange={(event) => updateField('street', event.target.value)}
                className="md:col-span-4"
              />

              <Input
                label="Número"
                value={form.number}
                onChange={(event) => updateField('number', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Bairro"
                value={form.neighborhood}
                onChange={(event) => updateField('neighborhood', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Complemento"
                value={form.complement}
                onChange={(event) => updateField('complement', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Cidade"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                className="md:col-span-3"
              />

              <Input
                label="Estado"
                value={form.state}
                onChange={(event) => updateField('state', event.target.value.toUpperCase())}
                className="md:col-span-3"
              />
            </div>
          </Section>

          <Section
            id="settings-operation"
            icon={FiMonitor}
            title="Operação"
            description="Configurações gerais de atendimento. Itens, cupons e taxas por bairro ficam no editor do cardápio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex h-full flex-col justify-center rounded-2xl border border-orange-100 bg-orange-50/70 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
                <p className="text-sm font-black text-[#111827] dark:text-zinc-100">Abrir ou fechar a loja</p>
                <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                  Use o controle rápido no dashboard ou na página de pedidos para alterar o atendimento agora.
                </p>
              </div>

              <Toggle
                checked={form.isActive}
                onChange={(value) => updateField('isActive', value)}
                label="Loja ativa"
                description="Use para desativar temporariamente o cardápio público."
              />

              <Toggle
                checked={form.acceptDelivery}
                onChange={(value) => updateField('acceptDelivery', value)}
                label="Aceitar delivery"
                description="Permite pedidos para entrega."
              />

              <Toggle
                checked={form.acceptPickup}
                onChange={(value) => updateField('acceptPickup', value)}
                label="Aceitar retirada"
                description="Permite pedidos para retirar no balcão."
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3 items-end">
              <Input
                label="Tempo médio"
                icon={FiClock}
                value={form.deliveryTime}
                onChange={(event) => updateField('deliveryTime', event.target.value)}
                placeholder="40-50 min"
              />

              <Input
                label="Pedido mínimo"
                value={form.minOrder}
                onChange={(event) => updateField('minOrder', event.target.value)}
                placeholder="0,00"
              />

              <Input
                label="Tolerância auto fechamento"
                type="number"
                min="0"
                value={form.autoCloseGraceMinutes}
                onChange={(event) => updateField('autoCloseGraceMinutes', event.target.value)}
                placeholder="30"
              />
            </div>
          </Section>

          <Section
            id="settings-notifications"
            icon={FiZap}
            title="Notificações e comanda"
            description="Configurações usadas no painel de pedidos."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                checked={form.newOrderSoundEnabled}
                onChange={(value) => updateField('newOrderSoundEnabled', value)}
                label="Sino de novo pedido"
                description="Toca alerta quando chegar pedido novo."
              />

              <Toggle
                checked={form.printAfterConfirm}
                onChange={(value) => updateField('printAfterConfirm', value)}
                label="Imprimir ao confirmar"
                description="Abre a comanda depois que o pedido for aceito."
              />
            </div>
          </Section>
          <Section
            id="settings-payments"
            icon={FiShield}
            title="Pagamentos"
            description="Formas de pagamento, Pix manual, Mercado Pago online e regras de encomenda agora ficam em uma area propria."
          >
            <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/70 p-5 dark:border-orange-500/25 dark:bg-orange-500/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#111827] dark:text-zinc-50">
                    Pagamentos agora ficam em uma area propria.
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
                    Configure metodos aceitos, chave Pix, Mercado Pago online e pagamento antecipado para encomendas sem misturar com as configuracoes gerais da loja.
                  </p>
                </div>

                <Link
                  to="/dashboard/pagamentos"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c]"
                >
                  <FiExternalLink size={16} />
                  Ir para Pagamentos
                </Link>
              </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* Card Pix */}
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-black text-[#111827] shadow-sm dark:bg-zinc-950/50 dark:text-zinc-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#32B1A4]/10 text-[#32B1A4]">
                  <FaPix size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pix manual</p>
                  <p className="mt-0.5">{selectedStore?.paymentMethods?.pix === true ? 'Ativo' : 'Inativo'}</p>
                </div>
              </div>

              {/* Card Cartão */}
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-black text-[#111827] shadow-sm dark:bg-zinc-950/50 dark:text-zinc-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <FaCreditCard size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cartão presencial</p>
                  <p className="mt-0.5">{selectedStore?.paymentMethods?.card === false ? 'Inativo' : 'Ativo'}</p>
                </div>
              </div>

              {/* Card Mercado Pago */}
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-black text-[#111827] shadow-sm dark:bg-zinc-950/50 dark:text-zinc-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00B1EA]/10 text-[#00B1EA]">
                  <SiMercadopago size={24} />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mercado Pago</p>
                  <p className="mt-0.5">{mercadoPagoOrderPaymentsActive ? 'Ativo' : 'Inativo'}</p>
                </div>
                </div>
              </div>
            </div>
          </Section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              <FiArrowLeft />
              Voltar
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </div>
      <DashboardFooter store={selectedStore}/>
    </main>
  )
}


