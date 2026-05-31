import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import { Link } from 'react-router-dom'
import { normalizeBrazilianPhoneForWhatsApp, formatBrazilianPhone, validateBrazilianMobilePhone } from '../../utils/phone'
import { cleanBrazilianDocument, formatCnpj, formatCpf, isValidCnpj, isValidCpf } from '../../utils/brazilianDocuments'
import { scrollToFirstError } from '../../utils/scroll'
import {
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCopy,
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
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'

import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadImageToCloudinary } from '../../services/cloudinary'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const BRAND_GREEN = '#f97316'
const DEFAULT_THEME = '#f97316'

const DAYS_OF_WEEK = [
  { id: 'sun', short: 'Dom', label: 'Domingo' },
  { id: 'mon', short: 'Seg', label: 'Segunda' },
  { id: 'tue', short: 'Ter', label: 'Terça' },
  { id: 'wed', short: 'Qua', label: 'Quarta' },
  { id: 'thu', short: 'Qui', label: 'Quinta' },
  { id: 'fri', short: 'Sex', label: 'Sexta' },
  { id: 'sat', short: 'Sáb', label: 'Sábado' },
]

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

const PIX_KEY_TYPES = ['phone', 'email', 'cpf', 'cnpj', 'random']
const PIX_KEY_TYPE_LABELS = {
  phone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  random: 'Chave aleatória',
}

const DEFAULT_FORM = {
  name: '',
  slug: '',
  description: '',
  segment: 'Restaurante',
  logoUrl: '',
  bannerUrl: '',
  themeColor: DEFAULT_THEME,
  whatsapp: '',
  instagram: '',
  isOpen: true,
  isActive: true,
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
  paymentPix: false,
  paymentCard: true,
  paymentCash: true,
  pixEnabled: false,
  pixKey: '',
  pixKeyType: 'phone',
  pixMerchantName: '',
  pixMerchantCity: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: 'SE',
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function getTodayKey() {
  return DAYS_OF_WEEK[new Date().getDay()]?.id || 'sun'
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

function sanitizeTextField(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim())
}

function getPixMerchantNameFallback(form, store) {
  return sanitizeTextField(form.pixMerchantName || form.name || store?.name || store?.storeName, 80)
}

function getPixMerchantCityFallback(form, store) {
  return sanitizeTextField(
    form.pixMerchantCity ||
      form.city ||
      store?.address?.city ||
      store?.city,
    60
  )
}

function getPixConfigCompleteness(form, store) {
  const keyType = PIX_KEY_TYPES.includes(form.pixKeyType) ? form.pixKeyType : 'phone'
  const key = sanitizeTextField(form.pixKey, 120)
  const merchantName = getPixMerchantNameFallback(form, store)
  const merchantCity = getPixMerchantCityFallback(form, store)

  return {
    keyType,
    hasKey: Boolean(key),
    hasMerchantName: Boolean(merchantName),
    hasMerchantCity: Boolean(merchantCity),
    complete: Boolean(key && merchantName && merchantCity),
  }
}

function formatPixKeyForInput(value, keyType) {
  if (keyType === 'phone') return formatBrazilianPhone(value)
  if (keyType === 'cpf') return formatCpf(value)
  if (keyType === 'cnpj') return formatCnpj(value)
  return value
}

function normalizePixKeyForInput(value, keyType) {
  if (keyType === 'phone') {
    const normalized = normalizeBrazilianPhoneForWhatsApp(value)
    return normalized ? `+55${normalized.replace(/^55/, '')}` : value
  }

  if (keyType === 'cpf') return cleanBrazilianDocument(value).slice(0, 11)
  if (keyType === 'cnpj') return cleanBrazilianDocument(value).slice(0, 14)
  if (keyType === 'email') return String(value || '').trim().toLowerCase().slice(0, 120)
  return String(value || '').trim().slice(0, 120)
}

function normalizePixKeyForSave(value, keyType) {
  const key = sanitizeTextField(value, 120)

  if (keyType === 'phone') {
    const validatedPixPhone = validateBrazilianMobilePhone(key)
    if (!validatedPixPhone.ok) {
      return { ok: false, message: 'A chave Pix de telefone precisa ser um celular brasileiro válido.' }
    }
    return { ok: true, value: validatedPixPhone.phoneE164 }
  }

  if (keyType === 'cpf') {
    if (!isValidCpf(key)) return { ok: false, message: 'A chave Pix CPF é inválida.' }
    return { ok: true, value: cleanBrazilianDocument(key) }
  }

  if (keyType === 'cnpj') {
    if (!isValidCnpj(key)) return { ok: false, message: 'A chave Pix CNPJ é inválida.' }
    return { ok: true, value: cleanBrazilianDocument(key) }
  }

  if (keyType === 'email') {
    if (!isValidEmail(key)) return { ok: false, message: 'A chave Pix de e-mail é inválida.' }
    return { ok: true, value: key.toLowerCase() }
  }

  if (key.length < 8) {
    return { ok: false, message: 'Informe uma chave Pix aleatória válida.' }
  }

  return { ok: true, value: key }
}

function normalizeThemeColor(value) {
  const color = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_THEME
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim())
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
  const pix = store?.pix || {}
  const settingsPix = store?.paymentSettings?.pix || {}
  const pixKey = pix?.key || settingsPix?.key || store?.pixKey || ''
  const pixKeyType = pix?.keyType || settingsPix?.keyType || store?.pixKeyType || 'phone'
  const hasPixConfig = Boolean(pixKey)
  const paymentPix =
    store?.paymentMethods?.pix === true ||
    (store?.paymentMethods?.pix !== false && hasPixConfig)

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
    paymentPix,
    paymentCard: store?.paymentMethods?.card ?? true,
    paymentCash: store?.paymentMethods?.cash ?? true,
    pixEnabled: pix?.enabled === true || hasPixConfig,
    pixKey,
    pixKeyType: PIX_KEY_TYPES.includes(pixKeyType) ? pixKeyType : 'phone',
    pixMerchantName: pix?.merchantName || settingsPix?.merchantName || store?.name || '',
    pixMerchantCity: pix?.merchantCity || settingsPix?.merchantCity || address.city || '',
    ...address,
  }
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'

  return (
    <div className="fixed left-1/2 top-5 z-[200] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isSuccess
              ? 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10'
              : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {isSuccess ? <FiCheckCircle /> : <FiAlertCircle />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
            {isSuccess ? 'Tudo certo' : 'Atenção'}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#6b7280] dark:text-zinc-400">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-[#111827] dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <FiX />
        </button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-base font-black text-[#111827]">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm leading-6 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  )
}

function Label({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
      {children}
    </label>
  )
}

function Input({ label, icon: Icon, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        )}

        <input
          {...props}
          className={`h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 ${
            Icon ? 'pl-11' : ''
          } ${props.className || ''}`}
        />
      </div>
    </div>
  )
}

function Select({ label, children, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <select
        {...props}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      >
        {children}
      </select>
    </div>
  )
}

function Textarea({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <textarea
        {...props}
        className="min-h-[110px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      />
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 text-left transition hover:bg-white"
    >
      <div>
        <p className="text-sm font-black text-[#111827]">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            {description}
          </p>
        )}
      </div>

      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-[#f97316]' : 'bg-gray-300'
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
  onUpload,
  onChangeUrl,
  onRemove,
}) {
  const previewClass =
    aspect === 'banner'
      ? 'h-40 w-full rounded-[1.5rem]'
      : 'h-32 w-32 rounded-[1.5rem]'

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#111827]">
            {label}
          </p>

          {description && (
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
          >
            Remover
          </button>
        )}
      </div>

      <div className={aspect === 'banner' ? 'space-y-3' : 'flex flex-col gap-4 sm:flex-row sm:items-center'}>
        <div className={`${previewClass} flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-200 bg-white text-gray-400`}>
          {value ? (
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <FiImage size={24} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]">
            {uploading ? <FiLoader className="animate-spin" /> : <FiUpload />}
            {uploading ? 'Enviando imagem...' : value ? 'Trocar imagem' : 'Enviar imagem'}
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

          <Input
            placeholder="Ou cole uma URL de imagem"
            value={value || ''}
            onChange={(event) => onChangeUrl(event.target.value)}
          />
        </div>
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

export default function Settings() {
  const {
    user,
    storeId: authStoreId,
    storeIds: authStoreIds = [],
  } = useAuth()

  const knownStoreIds = useMemo(() => {
    return uniqueArray([
      authStoreId,
      ...(Array.isArray(authStoreIds) ? authStoreIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ].map((id) => String(id || '').trim())).slice(0, 10)
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState('')
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const selectedStore = useMemo(() => {
    return stores.find((store) => store.id === selectedStoreId) || stores[0] || null
  }, [selectedStoreId, stores])

  const publicSlug = slugify(form.slug || form.name)
  const publicUrl = getStorePublicUrl(publicSlug)

  const themeVars = useMemo(() => ({
    '--store-theme': form.themeColor || BRAND_GREEN,
  }), [form.themeColor])

  const pixCompleteness = useMemo(() => {
    return getPixConfigCompleteness(form, selectedStore)
  }, [form, selectedStore])

  const pixRequiredAndIncomplete = form.paymentPix && !pixCompleteness.complete

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const updatePaymentPix = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      paymentPix: value,
      pixEnabled: value ? true : false,
      pixMerchantName: value && !prev.pixMerchantName ? prev.name : prev.pixMerchantName,
      pixMerchantCity: value && !prev.pixMerchantCity ? prev.city : prev.pixMerchantCity,
    }))
  }, [])

  const updatePixEnabled = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      pixEnabled: value,
      paymentPix: value ? true : false,
      pixMerchantName: value && !prev.pixMerchantName ? prev.name : prev.pixMerchantName,
      pixMerchantCity: value && !prev.pixMerchantCity ? prev.city : prev.pixMerchantCity,
    }))
  }, [])

  const updatePixKeyType = useCallback((value) => {
    const nextType = PIX_KEY_TYPES.includes(value) ? value : 'phone'

    setForm((prev) => ({
      ...prev,
      pixKeyType: nextType,
      pixKey: normalizePixKeyForInput(prev.pixKey, nextType),
    }))
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
        const uploaded = await uploadImageToCloudinary(file, folder)
        const imageUrl = uploaded?.secure_url || uploaded?.url || uploaded

        if (!imageUrl) {
          throw new Error('Cloudinary não retornou a URL da imagem.')
        }

        updateField(fieldName, imageUrl)
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

    setSaving(true)

    try {
      const themeColor = normalizeThemeColor(form.themeColor)
      const segment = SEGMENTS.includes(form.segment) ? form.segment : 'Restaurante'
      const deliveryTime = sanitizeTextField(form.deliveryTime, 40) || DEFAULT_FORM.deliveryTime
      const instagram = sanitizeSocial(form.instagram).slice(0, 80)
      const whatsapp = normalizeBrazilianPhoneForWhatsApp(form.whatsapp)
      const logoUrl = sanitizeImageUrl(form.logoUrl)
      const bannerUrl = sanitizeImageUrl(form.bannerUrl)
      let normalizedPixKey = sanitizeTextField(form.pixKey, 120)
      const pixKeyType = PIX_KEY_TYPES.includes(form.pixKeyType) ? form.pixKeyType : 'phone'
      const pixMerchantName = getPixMerchantNameFallback(form, selectedStore)
      const pixMerchantCity = getPixMerchantCityFallback(form, selectedStore)

      if (logoUrl === null || bannerUrl === null) {
        throw new Error('Use imagens HTTPS do Cloudinary ou caminhos internos do PratoBy.')
      }

      if (!form.paymentPix && !form.paymentCard && !form.paymentCash) {
        showToast('error', 'Selecione pelo menos uma forma de pagamento.')
        scrollToFirstError()
        return
      }

      if (form.paymentPix) {
        if (!form.pixEnabled || !pixCompleteness.complete) {
          showToast('error', 'Para aceitar Pix, configure a chave, o nome e a cidade do Pix manual.')
          scrollToFirstError()
          return
        }

        const pixKeyValidation = normalizePixKeyForSave(form.pixKey, pixKeyType)
        if (!pixKeyValidation.ok) {
          showToast('error', pixKeyValidation.message)
          scrollToFirstError()
          return
        }

        normalizedPixKey = pixKeyValidation.value
      }

      if (form.whatsapp && whatsapp.replace(/\D/g, '').length < 12) {
        throw new Error('Informe um WhatsApp brasileiro válido com DDD.')
      }

      const minOrderCents = currencyToCents(form.minOrder)
      const minOrder = minOrderCents / 100
      const openingHours = normalizeOpeningHoursForSave(form.openingHours)
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
        ...(selectedStore.settings || {}),
        themeColor,
        acceptDelivery: Boolean(form.acceptDelivery),
        acceptPickup: Boolean(form.acceptPickup),
        acceptDineIn: Boolean(form.acceptDineIn),
        deliveryTime,
        newOrderSoundEnabled: Boolean(form.newOrderSoundEnabled),
        printAfterConfirm: Boolean(form.printAfterConfirm),
        autoCloseEnabled: Boolean(form.autoCloseEnabled),
        autoCloseGraceMinutes,
        openingHours,
        whatsapp,
        instagram,
      }

      const payload = {
        name: cleanName,
        storeName: cleanName,
        description: sanitizeTextField(form.description, 500),
        segment,
        category: segment,

        logoUrl,
        bannerUrl,
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

        activeDays,
        hoursOpen,
        hoursClose,
        openingHours,
        settings,

        deliveryTime,
        minOrder,
        minOrderCents,

        acceptDelivery: Boolean(form.acceptDelivery),
        acceptPickup: Boolean(form.acceptPickup),
        acceptDineIn: Boolean(form.acceptDineIn),

        paymentMethods: {
          pix: Boolean(form.paymentPix),
          card: Boolean(form.paymentCard),
          cash: Boolean(form.paymentCash),
        },
        pix: {
          enabled: Boolean(form.paymentPix),
          key: normalizedPixKey,
          keyType: pixKeyType,
          merchantName: pixMerchantName || cleanName,
          merchantCity: pixMerchantCity || sanitizeTextField(form.city, 60),
        },

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
        'logoUrl', 'bannerUrl', 'themeColor', 'whatsapp', 'whatsapp1',
        'phone', 'instagram', 'social', 'isActive', 'activeDays',
        'hoursOpen', 'hoursClose', 'openingHours', 'settings', 'deliveryTime',
        'minOrder', 'minOrderCents', 'acceptDelivery', 'acceptPickup',
        'acceptDineIn', 'paymentMethods', 'pix', 'address', 'cep', 'street',
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
  }, [form, pixCompleteness, saving, selectedStore, showToast, user])

  if (loadingStores) {
    return (
      <main className="bg-[#f9fafb] text-[#111827]">
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </header>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
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
      <Toast toast={toast} onClose={() => setToast(null)} />

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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <aside className="space-y-5 lg:order-2">
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

        <div className="space-y-6 lg:order-1">

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
          <Section
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
            icon={FiImage}
            title="Logo e banner"
            description="Imagens usadas no cabeçalho do cardápio público."
          >
            <div className="grid gap-4">
              <ImageUploadField
                label="Banner da loja"
                description="Imagem horizontal para o topo do cardápio."
                aspect="banner"
                value={form.bannerUrl}
                uploading={uploadingImage === 'bannerUrl'}
                onUpload={(file) => handleUploadStoreImage(file, 'bannerUrl')}
                onChangeUrl={(value) => updateField('bannerUrl', value)}
                onRemove={() => updateField('bannerUrl', '')}
              />

              <ImageUploadField
                label="Logo da loja"
                description="Imagem quadrada usada no perfil e nos cards."
                value={form.logoUrl}
                uploading={uploadingImage === 'logoUrl'}
                onUpload={(file) => handleUploadStoreImage(file, 'logoUrl')}
                onChangeUrl={(value) => updateField('logoUrl', value)}
                onRemove={() => updateField('logoUrl', '')}
              />
            </div>
          </Section>

          <Section
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
  icon={FiClock}
  title="Horário de funcionamento"
  description="Defina dias e horários diferentes para cada dia da semana."
>
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
</Section>

          <Section
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
            icon={FiMonitor}
            title="Operação"
            description="Configurações gerais de atendimento. Itens, cupons e taxas por bairro ficam no editor do cardápio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
                <p className="text-sm font-black text-[#111827] dark:text-zinc-100">Abrir ou fechar a loja</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
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

            <div className="mt-5 grid gap-4 md:grid-cols-3">
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
            icon={FiShield}
            title="Pagamentos"
            description="Formas de pagamento aceitas e dados para Pix manual."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Toggle
                checked={form.paymentPix}
                onChange={updatePaymentPix}
                label="Pix"
                description="Aceitar Pix exige chave manual configurada."
              />

              <Toggle
                checked={form.paymentCard}
                onChange={(value) => updateField('paymentCard', value)}
                label="Cartão"
                description="Cartão na entrega ou balcão."
              />

              <Toggle
                checked={form.paymentCash}
                onChange={(value) => updateField('paymentCash', value)}
                label="Dinheiro"
                description="Permitir pagamento em dinheiro."
              />
            </div>

            {pixRequiredAndIncomplete && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800 scroll-mt-24">
                Para ativar Pix no cardápio público, preencha a chave, o nome do recebedor e a cidade abaixo.
              </div>
            )}

            <div className="mt-5 rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4">
              <Toggle
                checked={form.pixEnabled}
                onChange={updatePixEnabled}
                label="Configurar Pix manual"
                description="Obrigatório para aceitar Pix. Mostra QR Code/copia e cola no pedido."
              />

              {form.pixEnabled && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Select
                    label="Tipo de chave Pix"
                    value={form.pixKeyType}
                    onChange={(event) => updatePixKeyType(event.target.value)}
                  >
                    {PIX_KEY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {PIX_KEY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Chave Pix"
                    aria-invalid={!pixCompleteness.hasKey && form.paymentPix}
                    className={!pixCompleteness.hasKey && form.paymentPix ? 'rounded-2xl ring-2 ring-red-500 scroll-mt-24' : 'scroll-mt-24'}
                    value={formatPixKeyForInput(form.pixKey, form.pixKeyType)}
                    onChange={(event) => updateField('pixKey', normalizePixKeyForInput(event.target.value, form.pixKeyType))}
                    placeholder="Chave Pix da loja"
                  />

                  <Input
                    label="Nome no Pix"
                    aria-invalid={!pixCompleteness.hasMerchantName && form.paymentPix}
                    className={!pixCompleteness.hasMerchantName && form.paymentPix ? 'rounded-2xl ring-2 ring-red-500 scroll-mt-24' : 'scroll-mt-24'}
                    value={form.pixMerchantName}
                    onChange={(event) => updateField('pixMerchantName', event.target.value)}
                    placeholder="Titular da conta"
                  />

                  <Input
                    label="Cidade no Pix"
                    aria-invalid={!pixCompleteness.hasMerchantCity && form.paymentPix}
                    className={!pixCompleteness.hasMerchantCity && form.paymentPix ? 'rounded-2xl ring-2 ring-red-500 scroll-mt-24' : 'scroll-mt-24'}
                    value={form.pixMerchantCity}
                    onChange={(event) => updateField('pixMerchantCity', event.target.value)}
                    placeholder="Ex: Aracaju"
                  />
                </div>
              )}
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


