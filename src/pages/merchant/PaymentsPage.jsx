import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiInfo,
  FiLoader,
  FiLock,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiSliders,
  FiXCircle,
  FiZap,
} from 'react-icons/fi'

import DashboardFooter from '../../components/layouts/DashboardFooter'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import FloatingToast from '../../components/ui/FloatingToast'
import { useAuth } from '../../contexts/AuthContext'
import { db, functions } from '../../services/firebase'
import {
  formatBrazilianPhone,
  normalizeBrazilianPhoneForWhatsApp,
  validateBrazilianMobilePhone,
} from '../../utils/phone'
import {
  cleanBrazilianDocument,
  formatCnpj,
  formatCpf,
  isValidCnpj,
  isValidCpf,
} from '../../utils/brazilianDocuments'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const DEFAULT_THEME = '#f97316'
const PIX_KEY_TYPES = ['phone', 'email', 'cpf', 'cnpj', 'random']
const PIX_KEY_TYPE_LABELS = {
  phone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  random: 'Chave aleatória',
}

const PREORDER_POLICIES = [
  {
    value: 'manual',
    title: 'Não exigir pagamento antecipado',
    description: 'O cliente escolhe qualquer método habilitado no checkout.',
  },
  {
    value: 'pix_manual',
    title: 'Exigir Pix com comprovante',
    description: 'Pedidos agendados usam Pix com comprovante e aguardam conferência da loja.',
  },
  {
    value: 'mercadopago_online',
    title: 'Exigir Mercado Pago online',
    description: 'Encomendas ficam aguardando a aprovação no Mercado Pago.',
  },
  {
    value: 'manual_or_mercadopago',
    title: 'Permitir Pix com comprovante ou pagamento online',
    description: 'O cliente escolhe Pix com comprovante ou checkout online.',
  },
]

const DEFAULT_FORM = {
  paymentPix: false,
  paymentCash: true,
  paymentCredit: true,
  paymentDebit: true,
  pixEnabled: false,
  pixKey: '',
  pixKeyType: 'phone',
  pixMerchantName: '',
  pixMerchantCity: '',
  mercadoPagoEnabled: false,
  mercadoPagoAllowPix: true,
  mercadoPagoAllowCreditCard: true,
  mercadoPagoMaxInstallments: 1,
  mercadoPagoRequireForScheduled: false,
  preorderPolicyMode: 'manual',
}

const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

function uniqueArray(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ]
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
    // localStorage can be unavailable in restricted browser contexts.
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

function normalizeStore(snapshot) {
  return { id: snapshot.id, ...(snapshot.data() || {}) }
}

function sanitizeTextField(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim())
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getMercadoPagoConfig(store) {
  return store?.payments?.mercadoPago || store?.payments?.mercadopago || {}
}

function getMercadoPagoStatus(store) {
  const mercadoPago = getMercadoPagoConfig(store)
  return normalizeText(mercadoPago.status || (mercadoPago.enabled === true ? 'active' : 'not_connected'))
}

function getMercadoPagoStatusLabel(status) {
  const labels = {
    active: 'Conectado',
    enabled: 'Conectado',
    pending: 'Pendente',
    error: 'Com erro',
    revoked: 'Revogado',
    not_connected: 'Não conectado',
    notconnected: 'Não conectado',
    inactive: 'Não conectado',
  }
  return labels[status] || 'Não conectado'
}

function isMercadoPagoConfigurable(store) {
  return ['active', 'enabled'].includes(getMercadoPagoStatus(store))
}

function isMercadoPagoOnlineEnabled(store) {
  const mercadoPago = getMercadoPagoConfig(store)
  return mercadoPago.enabled === true && isMercadoPagoConfigurable(store)
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

function getPixMerchantNameFallback(form, store) {
  return sanitizeTextField(form.pixMerchantName || store?.name || store?.storeName, 80)
}

function getPixMerchantCityFallback(form, store) {
  return sanitizeTextField(
    form.pixMerchantCity ||
      store?.address?.city ||
      store?.city,
    60
  )
}

function getPixCompleteness(form, store) {
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

function normalizePreorderModeValue(value) {
  const mode = normalizeText(value)

  if (['none', 'no_prepayment', 'not_required'].includes(mode)) return 'manual'
  if (['manual_pix', 'pix', 'pix_required', 'pix_required_for_scheduled'].includes(mode)) return 'pix_manual'
  if (['asaas', 'asaas_required'].includes(mode)) return 'asaas_online'
  if (['online', 'online_required'].includes(mode)) return 'mercadopago_online'
  if (['pix_or_asaas', 'manual_pix_or_asaas', 'pix_manual_or_asaas'].includes(mode)) return 'manual_or_asaas'
  if (['mercadopago', 'mercado_pago', 'mercadopago_required', 'mercado_pago_required'].includes(mode)) return 'mercadopago_online'
  if (['pix_or_mercadopago', 'manual_pix_or_mercadopago', 'pix_manual_or_mercadopago'].includes(mode)) return 'manual_or_mercadopago'

  return PREORDER_POLICIES.some((item) => item.value === mode) ? mode : ''
}

function getPreorderMode(store) {
  const policy = store?.payments?.preorderPolicy

  const fromPayments = normalizePreorderModeValue(
    policy && typeof policy === 'object' && !Array.isArray(policy)
      ? policy.mode || policy.requiredMethod || policy.value
      : policy
  )

  if (fromPayments === 'asaas_online') {
    return isMercadoPagoOnlineEnabled(store) ? 'mercadopago_online' : 'manual'
  }

  if (fromPayments === 'manual_or_asaas') {
    return isMercadoPagoOnlineEnabled(store) ? 'manual_or_mercadopago' : 'manual'
  }

  if (fromPayments) return fromPayments

  const fromScheduling = normalizePreorderModeValue(
    store?.scheduling?.preorderPaymentPolicy ||
    store?.scheduling?.prepaymentPolicy ||
    store?.scheduling?.paymentPolicy
  )

  if (fromScheduling === 'asaas_online') {
    return isMercadoPagoOnlineEnabled(store) ? 'mercadopago_online' : 'manual'
  }

  if (fromScheduling === 'manual_or_asaas') {
    return isMercadoPagoOnlineEnabled(store) ? 'manual_or_mercadopago' : 'manual'
  }

  return fromScheduling || 'manual'
}

function getLegacyAsaasPreorderMode(store) {
  const policy = store?.payments?.preorderPolicy
  const fromPayments = normalizePreorderModeValue(
    policy && typeof policy === 'object' && !Array.isArray(policy)
      ? policy.mode || policy.requiredMethod || policy.value
      : policy
  )

  if (['asaas_online', 'manual_or_asaas'].includes(fromPayments)) return fromPayments

  const fromScheduling = normalizePreorderModeValue(
    store?.scheduling?.preorderPaymentPolicy ||
    store?.scheduling?.prepaymentPolicy ||
    store?.scheduling?.paymentPolicy
  )

  return ['asaas_online', 'manual_or_asaas'].includes(fromScheduling) ? fromScheduling : ''
}

function mapStoreToForm(store) {
  const pix = store?.pix || {}
  const settingsPix = store?.paymentSettings?.pix || {}
  const pixKey = pix?.key || settingsPix?.key || store?.pixKey || ''
  const pixKeyType = pix?.keyType || settingsPix?.keyType || store?.pixKeyType || 'phone'
  const hasPixConfig = Boolean(pixKey)
  const paymentMethods = store?.paymentMethods || {}
  const mercadoPago = getMercadoPagoConfig(store)
  const cardEnabled = paymentMethods.card !== false

  return {
    ...DEFAULT_FORM,
    paymentPix: paymentMethods.pix === true || (paymentMethods.pix !== false && hasPixConfig),
    paymentCash: paymentMethods.cash !== false,
    paymentCredit: paymentMethods.credit ?? cardEnabled,
    paymentDebit: paymentMethods.debit ?? cardEnabled,
    pixEnabled: pix.enabled === true || hasPixConfig,
    pixKey,
    pixKeyType: PIX_KEY_TYPES.includes(pixKeyType) ? pixKeyType : 'phone',
    pixMerchantName: pix.merchantName || settingsPix.merchantName || store?.name || '',
    pixMerchantCity: pix.merchantCity || settingsPix.merchantCity || store?.address?.city || store?.city || '',
    mercadoPagoEnabled: isMercadoPagoOnlineEnabled(store),
    mercadoPagoAllowPix: mercadoPago.allowPix !== false,
    mercadoPagoAllowCreditCard: mercadoPago.allowCreditCard !== false,
    mercadoPagoMaxInstallments: Number.isInteger(Number(mercadoPago.maxInstallmentCount))
      ? Math.min(Math.max(Number(mercadoPago.maxInstallmentCount), 1), 12)
      : 1,
    mercadoPagoRequireForScheduled: mercadoPago.requireForScheduled === true,
    preorderPolicyMode: getPreorderMode(store),
  }
}

function cleanFirestoreValue(value) {
  if (value === undefined || typeof value === 'function') return undefined
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanFirestoreValue(item))
      .filter((item) => item !== undefined)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const cleanValue = cleanFirestoreValue(item)
      if (cleanValue !== undefined) acc[key] = cleanValue
      return acc
    }, {})
  }
  return value
}

function normalizeSchedulingForPaymentPolicy(store, preorderPolicyMode) {
  const current = store?.scheduling && typeof store.scheduling === 'object' && !Array.isArray(store.scheduling)
    ? store.scheduling
    : {}
  const prepaymentPolicy = ['pix_manual', 'manual_or_mercadopago'].includes(preorderPolicyMode)
    ? 'pix_required_for_scheduled'
    : 'none'

  return {
    ...current,
    prepaymentPolicy,
  }
}

function Card({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section className={`group rounded-[1.85rem] border border-gray-100/90 bg-white/95 p-5 shadow-sm shadow-slate-950/[0.03] ring-1 ring-transparent transition duration-200 hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-lg hover:shadow-orange-500/5 dark:border-white/10 dark:bg-[#151922]/95 dark:shadow-black/20 dark:hover:border-orange-400/20 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] ring-1 ring-orange-100 transition group-hover:scale-105 dark:bg-orange-500/10 dark:ring-orange-400/10">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black tracking-tight text-[#111827] dark:text-zinc-50">
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

function Label({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-gray-500 dark:text-zinc-500">
      {children}
    </label>
  )
}

function Input({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <input
        {...props}
        className={`h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-semibold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-orange-500/20 ${props.className || ''}`}
      />
    </div>
  )
}

function Select({ label, children, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <select
        {...props}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-orange-500/20"
      >
        {children}
      </select>
    </div>
  )
}

function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      disabled={disabled}
      className={`flex h-full w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? 'border-orange-200 bg-orange-50/80 shadow-sm shadow-orange-500/5 dark:border-orange-400/20 dark:bg-orange-500/10'
          : 'border-gray-100 bg-[#f9fafb] hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-[#111827] dark:text-zinc-100">{label}</p>
        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6b7280] dark:text-zinc-400">{description}</p>
        )}
      </div>
      <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? 'bg-[#f97316]' : 'bg-gray-300 dark:bg-zinc-700'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

function StatusTile({ label, value, tone = 'gray' }) {
  const toneClass = tone === 'green'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
    : tone === 'orange'
      ? 'border-orange-100 bg-orange-50 text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200'
      : 'border-gray-100 bg-white text-[#111827] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.08em] opacity-70">{label}</p>
      <p className="mt-2 truncate text-sm font-black">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f9fafb] p-6 text-center dark:bg-zinc-950">
      <div className="max-w-md rounded-[1.8rem] border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-[#151922]">
        <FiAlertCircle className="mx-auto text-[#f97316]" size={32} />
        <h1 className="mt-4 text-xl font-black text-[#111827] dark:text-zinc-50">Loja não encontrada</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
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

export default function PaymentsPage() {
  const { user, storeId: authStoreId, storeIds: authStoreIds = [] } = useAuth()
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectingMercadoPago, setConnectingMercadoPago] = useState(false)
  const [disconnectingMercadoPago, setDisconnectingMercadoPago] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const toastTimeoutRef = useRef(null)

  const knownStoreIds = useMemo(() => {
    return uniqueArray([
      authStoreId,
      ...(Array.isArray(authStoreIds) ? authStoreIds : []),
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
      user?.storeId,
    ])
  }, [authStoreId, authStoreIds, user?.storeId, user?.storeIds])

  const knownStoreIdsKey = useMemo(() => knownStoreIds.join('|'), [knownStoreIds])
  const selectedStore = useMemo(() => {
    return stores.find((store) => store.id === selectedStoreId) || stores[0] || null
  }, [selectedStoreId, stores])

  const publicSlug = getStoreSlug(selectedStore)
  const mercadoPagoStatus = getMercadoPagoStatus(selectedStore)
  const mercadoPagoStatusLabel = getMercadoPagoStatusLabel(mercadoPagoStatus)
  const mercadoPagoConfigurable = isMercadoPagoConfigurable(selectedStore)
  const mercadoPagoOnlineActive = form.mercadoPagoEnabled && mercadoPagoConfigurable
  const legacyAsaasPreorderMode = getLegacyAsaasPreorderMode(selectedStore)
  const pixCompleteness = useMemo(() => getPixCompleteness(form, selectedStore), [form, selectedStore])
  const themeVars = useMemo(() => ({ '--store-theme': selectedStore?.themeColor || DEFAULT_THEME }), [selectedStore?.themeColor])

  const showToast = useCallback((type, message) => {
    setToast({ type, message })

    if (typeof window !== 'undefined') {
      window.clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = window.setTimeout(() => {
        setToast(null)
      }, 4500)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
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
        .sort((a, b) => String(a.name || a.storeName || a.id || '').localeCompare(String(b.name || b.storeName || b.id || ''), 'pt-BR'))

      setStores(nextStores)
      setLoadingStores(false)
    }

    knownStoreIds.forEach((storeDocId) => {
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
    })

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
      if (stores.some((store) => store.id === savedStoreId)) return savedStoreId

      return stores[0].id
    })
  }, [stores])

  useEffect(() => {
    if (selectedStore) setForm(mapStoreToForm(selectedStore))
  }, [selectedStore])

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const updatePreorderPolicyMode = useCallback((mode) => {
    const nextMode = PREORDER_POLICIES.some((item) => item.value === mode) ? mode : 'manual'
    const requiresManualPix = ['pix_manual', 'manual_or_mercadopago'].includes(nextMode)
    const requiresMercadoPago = nextMode === 'mercadopago_online'

    setForm((prev) => ({
      ...prev,
      preorderPolicyMode: nextMode,
      mercadoPagoRequireForScheduled: requiresMercadoPago ? true : prev.mercadoPagoRequireForScheduled,
      paymentPix: requiresManualPix ? true : prev.paymentPix,
      pixEnabled: requiresManualPix ? true : prev.pixEnabled,
      pixMerchantName: requiresManualPix && !prev.pixMerchantName ? selectedStore?.name || '' : prev.pixMerchantName,
      pixMerchantCity: requiresManualPix && !prev.pixMerchantCity
        ? selectedStore?.address?.city || selectedStore?.city || ''
        : prev.pixMerchantCity,
    }))
  }, [selectedStore])

  const updateMercadoPagoRequireForScheduled = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      mercadoPagoRequireForScheduled: value,
      preorderPolicyMode: value && prev.preorderPolicyMode === 'manual'
        ? 'mercadopago_online'
        : !value && prev.preorderPolicyMode === 'mercadopago_online'
          ? 'manual'
          : prev.preorderPolicyMode,
    }))
  }, [])

  const updatePixEnabled = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      pixEnabled: value,
      paymentPix: value ? true : false,
      pixMerchantName: value && !prev.pixMerchantName ? selectedStore?.name || '' : prev.pixMerchantName,
      pixMerchantCity: value && !prev.pixMerchantCity ? selectedStore?.address?.city || selectedStore?.city || '' : prev.pixMerchantCity,
    }))
  }, [selectedStore])

  const updatePixKeyType = useCallback((value) => {
    const nextType = PIX_KEY_TYPES.includes(value) ? value : 'phone'
    setForm((prev) => ({
      ...prev,
      pixKeyType: nextType,
      pixKey: normalizePixKeyForInput(prev.pixKey, nextType),
    }))
  }, [])

  const handleConnectMercadoPago = useCallback(async ({ reconnect = false } = {}) => {
    if (!selectedStore || connectingMercadoPago) return

    if (reconnect && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Trocar a conta Mercado Pago substitui a conexão atual. Faça isso apenas se não houver pedidos online em andamento.'
      )
      if (!confirmed) return
    }

    try {
      setConnectingMercadoPago(true)
      const getConnectUrl = httpsCallable(functions, 'getMercadoPagoConnectUrl')
      const result = await getConnectUrl({ storeId: selectedStore.id })
      const url = result?.data?.url
      if (!url) throw new Error('URL de conexão Mercado Pago indisponível.')
      window.location.assign(url)
    } catch (error) {
      console.error(error)
      showToast('error', error?.message || 'Não foi possivel iniciar a conexão com Mercado Pago.')
    } finally {
      setConnectingMercadoPago(false)
    }
  }, [connectingMercadoPago, selectedStore, showToast])

  const handleDisconnectMercadoPago = useCallback(async () => {
    if (!selectedStore || disconnectingMercadoPago) return

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Desconectar o Mercado Pago remove o pagamento online do cardápio. Pedidos online ativos precisam ser finalizados ou cancelados antes.'
      )
      if (!confirmed) return
    }

    try {
      setDisconnectingMercadoPago(true)
      const disconnect = httpsCallable(functions, 'disconnectMercadoPago')
      await disconnect({ storeId: selectedStore.id })
      setForm((prev) => ({
        ...prev,
        mercadoPagoEnabled: false,
        mercadoPagoAllowPix: false,
        mercadoPagoAllowCreditCard: false,
        mercadoPagoRequireForScheduled: false,
        preorderPolicyMode: ['mercadopago_online', 'manual_or_mercadopago'].includes(prev.preorderPolicyMode)
          ? 'manual'
          : prev.preorderPolicyMode,
      }))
      showToast('success', 'Mercado Pago desconectado desta loja.')
    } catch (error) {
      console.error(error)
      showToast('error', error?.message || 'Não foi possível desconectar o Mercado Pago.')
    } finally {
      setDisconnectingMercadoPago(false)
    }
  }, [disconnectingMercadoPago, selectedStore, showToast])

  const handleSave = useCallback(async () => {
    if (!selectedStore || saving) return

    if (!userCanManageStore(user, selectedStore)) {
      showToast('error', 'Você não tem permissão para alterar esta loja.')
      return
    }

    const cardEnabled = Boolean(form.paymentCredit || form.paymentDebit)
    const requiresManualPix = ['pix_manual', 'manual_or_mercadopago'].includes(form.preorderPolicyMode)
    const pixWillBeEnabled = Boolean(form.paymentPix || requiresManualPix)

    if (!pixWillBeEnabled && !cardEnabled && !form.paymentCash) {
      showToast('error', 'Selecione pelo menos uma forma de pagamento.')
      return
    }

    let normalizedPixKey = sanitizeTextField(form.pixKey, 120)
    const pixKeyType = PIX_KEY_TYPES.includes(form.pixKeyType) ? form.pixKeyType : 'phone'
    const pixMerchantName = getPixMerchantNameFallback(form, selectedStore)
    const pixMerchantCity = getPixMerchantCityFallback(form, selectedStore)

    if (pixWillBeEnabled) {
      if (!form.pixEnabled || !pixCompleteness.complete) {
        showToast('error', 'Para aceitar Pix, configure chave, nome e cidade do Pix com comprovante.')
        return
      }

      const pixKeyValidation = normalizePixKeyForSave(form.pixKey, pixKeyType)
      if (!pixKeyValidation.ok) {
        showToast('error', pixKeyValidation.message)
        return
      }

      normalizedPixKey = pixKeyValidation.value
    }

    if (form.mercadoPagoEnabled && !mercadoPagoConfigurable) {
      showToast('error', 'Conecte o Mercado Pago antes de ativar pagamento online de pedidos.')
      return
    }

    if (form.mercadoPagoEnabled && !form.mercadoPagoAllowPix && !form.mercadoPagoAllowCreditCard) {
      showToast('error', 'Selecione Pix online ou crédito online no Mercado Pago.')
      return
    }

    if (['mercadopago_online', 'manual_or_mercadopago'].includes(form.preorderPolicyMode) && !mercadoPagoOnlineActive) {
      showToast('error', 'Conecte e ative o Mercado Pago antes de usar essa regra para encomendas.')
      return
    }

    setSaving(true)

    try {
      const payload = cleanFirestoreValue({
        paymentMethods: {
          pix: pixWillBeEnabled,
          cash: Boolean(form.paymentCash),
          card: cardEnabled,
          credit: Boolean(form.paymentCredit),
          debit: Boolean(form.paymentDebit),
        },
        pix: {
          enabled: pixWillBeEnabled,
          key: normalizedPixKey,
          keyType: pixKeyType,
          merchantName: pixMerchantName,
          merchantCity: pixMerchantCity,
        },
        payments: {
          mercadoPago: {
            enabled: Boolean(form.mercadoPagoEnabled),
            allowPix: Boolean(form.mercadoPagoAllowPix),
            allowCreditCard: Boolean(form.mercadoPagoAllowCreditCard),
            maxInstallmentCount: Math.min(Math.max(Number(form.mercadoPagoMaxInstallments) || 1, 1), 12),
            requireForScheduled: Boolean(form.mercadoPagoRequireForScheduled),
            minOrderCents: 0,
          },
          preorderPolicy: {
            mode: form.preorderPolicyMode,
            requiredMethod: form.preorderPolicyMode,
          },
        },
        scheduling: normalizeSchedulingForPaymentPolicy(selectedStore, form.preorderPolicyMode),
      })

      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId: selectedStore.id,
        updates: payload,
      })

      setForm((prev) => ({
        ...prev,
        paymentPix: pixWillBeEnabled,
        pixEnabled: pixWillBeEnabled,
        preorderPolicyMode: form.preorderPolicyMode,
      }))

      safeSetLocalStorage(SELECTED_STORE_KEY, selectedStore.id)
      showToast('success', 'Pagamentos salvos.')
    } catch (error) {
      console.error(error)
      showToast('error', error?.message || 'Erro ao salvar pagamentos.')
    } finally {
      setSaving(false)
    }
  }, [
    form,
    mercadoPagoConfigurable,
    mercadoPagoOnlineActive,
    pixCompleteness.complete,
    saving,
    selectedStore,
    showToast,
    user,
  ])

  if (loadingStores) {
    return (
      <main className="bg-[#f9fafb] text-[#111827] dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-[1.7rem] bg-white shadow-sm dark:bg-zinc-900" />
          ))}
        </div>
      </main>
    )
  }

  if (!selectedStore) return <EmptyState />

  return (
    <main style={themeVars} className="bg-[#f9fafb] text-[#111827] dark:bg-zinc-950 dark:text-zinc-50">
      <FloatingToast toast={toast} onClose={() => setToast(null)} />

      <DashboardPageHeader
        title="Pagamentos"
        description="Configure como sua loja recebe pedidos no balcão, delivery, retirada e encomendas."
        eyebrow={selectedStore?.name || 'Loja'}
        icon={FiCreditCard}
        badge={publicSlug ? `/${publicSlug}` : ''}
        actions={(
          <Link
            to="/dashboard/settings"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <FiArrowLeft size={16} />
            Configurações
          </Link>
        )}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 pb-32 sm:px-6 sm:pb-36 lg:px-8">
        {stores.length > 1 && (
          <div className="mb-5 rounded-[1.4rem] border border-gray-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-[#151922]">
            <Select
              label="Loja"
              value={selectedStoreId}
              onChange={(event) => {
                setSelectedStoreId(event.target.value)
                safeSetLocalStorage(SELECTED_STORE_KEY, event.target.value)
              }}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name || store.storeName || store.id}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="mb-5 overflow-hidden rounded-[1.7rem] border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-amber-50 p-4 shadow-sm dark:border-orange-400/20 dark:from-orange-500/10 dark:via-[#151922] dark:to-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-sm shadow-orange-500/20">
                <FiShield size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-[#111827] dark:text-zinc-50">Pagamentos da loja</p>
                <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                  Configure os métodos aceitos no checkout. Pagamentos online ficam aguardando aprovação automática antes da produção.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-black text-orange-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-orange-200">
              <FiLock size={13} /> Sem cartão salvo no PratoBy
            </span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusTile
            label="Pix com comprovante"
            value={form.paymentPix ? 'Ativo' : 'Inativo'}
            tone={form.paymentPix ? 'green' : 'gray'}
          />
          <StatusTile
            label="Mercado Pago"
            value={mercadoPagoOnlineActive ? 'Ativo' : mercadoPagoStatusLabel}
            tone={mercadoPagoOnlineActive ? 'green' : 'orange'}
          />
          <StatusTile
            label="Cartão presencial"
            value={form.paymentCredit || form.paymentDebit ? 'Ativo' : 'Inativo'}
            tone={form.paymentCredit || form.paymentDebit ? 'green' : 'gray'}
          />
          <StatusTile
            label="Encomendas"
            value={PREORDER_POLICIES.find((item) => item.value === form.preorderPolicyMode)?.title || 'Manual'}
            tone={form.preorderPolicyMode === 'manual' ? 'gray' : 'orange'}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="space-y-6">
            <Card
              icon={FiDollarSign}
              title="Formas simples"
              description="Esses métodos são confirmados manualmente pela loja."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Toggle
                  checked={form.paymentCash}
                  onChange={(value) => updateField('paymentCash', value)}
                  label="Dinheiro"
                  description="Permitir pagamento em dinheiro no recebimento."
                />
                <Toggle
                  checked={form.paymentPix}
                  onChange={(value) => {
                    updateField('paymentPix', value)
                    if (value) updatePixEnabled(true)
                  }}
                  label="Pix com comprovante"
                  description="A loja confere o Pix antes de preparar o pedido."
                />
                <Toggle
                  checked={form.paymentCredit}
                  onChange={(value) => updateField('paymentCredit', value)}
                  label="Crédito na maquininha"
                  description="Pagamento presencial por crédito."
                />
                <Toggle
                  checked={form.paymentDebit}
                  onChange={(value) => updateField('paymentDebit', value)}
                  label="Débito na maquininha"
                  description="Pagamento presencial por débito."
                />
              </div>
            </Card>

            <Card
              icon={FiZap}
              title="Pix com comprovante"
              description="Pix com comprovante é simples e não tem confirmação automática."
            >
              <Toggle
                checked={form.pixEnabled}
                onChange={updatePixEnabled}
                label="Configurar Pix com comprovante"
                description="Obrigatório para aceitar Pix com comprovante no checkout."
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
                    value={formatPixKeyForInput(form.pixKey, form.pixKeyType)}
                    onChange={(event) => updateField('pixKey', normalizePixKeyForInput(event.target.value, form.pixKeyType))}
                    placeholder="Chave Pix da loja"
                    className={!pixCompleteness.hasKey && form.paymentPix ? 'rounded-2xl shadow-lg shadow-red-500/50' : ''}
                  />

                  <Input
                    label="Nome no Pix"
                    value={form.pixMerchantName}
                    onChange={(event) => updateField('pixMerchantName', event.target.value)}
                    placeholder="Titular da conta"
                    className={!pixCompleteness.hasMerchantName && form.paymentPix ? 'rounded-2xl ring-2 ring-red-500' : ''}
                  />

                  <Input
                    label="Cidade no Pix"
                    value={form.pixMerchantCity}
                    onChange={(event) => updateField('pixMerchantCity', event.target.value)}
                    placeholder="Ex: Aracaju"
                    className={!pixCompleteness.hasMerchantCity && form.paymentPix ? 'rounded-2xl ring-2 ring-red-500' : ''}
                  />
                </div>
              )}
            </Card>

            <Card
              icon={FiSliders}
              title="Pagamento antecipado para encomendas"
              description="Defina se pedidos agendados precisam pagar antes da produção."
            >
              {legacyAsaasPreorderMode && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold leading-5 text-orange-700">
                  <FiInfo className="mt-0.5 shrink-0" />
                  <span>
                    {mercadoPagoOnlineActive
                      ? 'Esta loja tinha regra Asaas Orders antiga. Ela será salva como Mercado Pago para pedidos online.'
                      : 'Esta loja tinha regra Asaas Orders antiga. Conecte o Mercado Pago para voltar a exigir pagamento online em encomendas.'}
                  </span>
                </div>
              )}

              <div className="grid gap-3">
                {PREORDER_POLICIES.map((policy) => {
                  const needsMercadoPago = ['mercadopago_online', 'manual_or_mercadopago'].includes(policy.value)
                  const disabled = needsMercadoPago && !mercadoPagoOnlineActive
                  const disabledDescription = 'Conecte e ative o Mercado Pago antes de usar esta opção.'

                  return (
                    <button
                      key={policy.value}
                      type="button"
                      onClick={() => {
                        if (!disabled) updatePreorderPolicyMode(policy.value)
                      }}
                      disabled={disabled}
                      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        form.preorderPolicyMode === policy.value
                          ? 'border-orange-200 bg-orange-50 text-[#111827]'
                          : 'border-gray-100 bg-[#f9fafb] hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{policy.title}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                            {disabled ? disabledDescription : policy.description}
                          </p>
                        </div>
                        {form.preorderPolicyMode === policy.value && <FiCheckCircle className="text-[#f97316]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              icon={FiCreditCard}
              title="Mercado Pago"
              description="O dinheiro dos pedidos online cai direto na conta Mercado Pago conectada do lojista."
              className="border-orange-100/80 bg-gradient-to-br from-white via-white to-orange-50/60 dark:from-[#151922] dark:via-[#151922] dark:to-orange-500/5"
            >
              <div className={`overflow-hidden rounded-[1.6rem] border ${mercadoPagoOnlineActive ? 'border-emerald-100 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-orange-100 bg-orange-50 text-orange-900 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-100'}`}>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] opacity-70">Status da conexão</p>
                    <p className="mt-1 text-base font-black">{mercadoPagoOnlineActive ? 'Ativo para pedidos online' : mercadoPagoStatusLabel}</p>
                    <p className="mt-1 text-xs font-semibold opacity-75">
                      {mercadoPagoOnlineActive
                        ? 'Checkout Pro disponível no cardápio público.'
                        : 'Conecte a conta para liberar cartão e Pix online.'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-white/10">
                    {mercadoPagoOnlineActive ? <FiCheckCircle size={22} /> : <FiLock size={22} />}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {!mercadoPagoConfigurable && (
                  <button
                    type="button"
                    onClick={() => handleConnectMercadoPago()}
                    disabled={connectingMercadoPago}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {connectingMercadoPago ? <FiLoader className="animate-spin" /> : <FiShield />}
                    Conectar Mercado Pago
                  </button>
                )}

                {mercadoPagoConfigurable && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleConnectMercadoPago({ reconnect: true })}
                      disabled={connectingMercadoPago || disconnectingMercadoPago}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-black text-orange-700 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-orange-500/30 dark:bg-zinc-950 dark:text-orange-200 dark:hover:bg-orange-500/10"
                    >
                      {connectingMercadoPago ? <FiLoader className="animate-spin" /> : <FiRefreshCw />}
                      Trocar conta
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectMercadoPago}
                      disabled={connectingMercadoPago || disconnectingMercadoPago}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-500/30 dark:bg-zinc-950 dark:text-red-200 dark:hover:bg-red-500/10"
                    >
                      {disconnectingMercadoPago ? <FiLoader className="animate-spin" /> : <FiXCircle />}
                      Desconectar
                    </button>
                  </div>
                )}

                <Toggle
                  checked={form.mercadoPagoEnabled}
                  onChange={(value) => updateField('mercadoPagoEnabled', value)}
                  disabled={!mercadoPagoConfigurable}
                  label="Ativar Mercado Pago nos pedidos"
                  description={mercadoPagoConfigurable
                    ? 'Disponibiliza Checkout Pro no cardápio público.'
                    : 'Conecte Mercado Pago para ativar pagamentos online de pedidos.'}
                />
                <Toggle
                  checked={form.mercadoPagoAllowPix}
                  onChange={(value) => updateField('mercadoPagoAllowPix', value)}
                  disabled={!mercadoPagoConfigurable || !form.mercadoPagoEnabled}
                  label="Permitir Pix online"
                  description="O cliente paga Pix pelo Mercado Pago."
                />
                <Toggle
                  checked={form.mercadoPagoAllowCreditCard}
                  onChange={(value) => updateField('mercadoPagoAllowCreditCard', value)}
                  disabled={!mercadoPagoConfigurable || !form.mercadoPagoEnabled}
                  label="Permitir crédito online"
                  description="O cliente informa o cartão apenas no Mercado Pago."
                />
                <Toggle
                  checked={form.mercadoPagoRequireForScheduled}
                  onChange={updateMercadoPagoRequireForScheduled}
                  disabled={!mercadoPagoConfigurable || !form.mercadoPagoEnabled}
                  label="Exigir em pedidos agendados"
                  description="Encomendas ficam aguardando aprovação do pagamento antes da produção."
                />
                <div className="grid gap-4">
                  <Select
                    label="Parcelamento máximo"
                    value={form.mercadoPagoMaxInstallments}
                    disabled={!mercadoPagoConfigurable || !form.mercadoPagoEnabled || !form.mercadoPagoAllowCreditCard}
                    onChange={(event) => updateField('mercadoPagoMaxInstallments', Number(event.target.value))}
                  >
                    {INSTALLMENT_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}x
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 text-xs font-semibold leading-5 text-[#6b7280] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <div className="flex gap-3">
                  <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" />
                  <div className="space-y-1">
                    <p>As assinaturas do PratoBy continuam sendo cobradas separadamente.</p>
                    <p>O PratoBy não armazena dados de cartão nesta tela.</p>
                    <p>{getMercadoPagoConfig(selectedStore).environment === 'sandbox' ? 'Ambiente de teste ativo para esta loja.' : 'Ambiente de produção ativo para esta loja.'}</p>
                    <p>Credenciais e dados sensíveis só podem ser alterados por fluxo seguro do backend/admin.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              icon={FiInfo}
              title="Informações e segurança"
              description="Pagamentos online usam ambiente seguro externo ao PratoBy."
            >
              <div className="space-y-3 text-sm font-semibold leading-6 text-[#6b7280] dark:text-zinc-400">
                <p>O PratoBy não cobra comissão por pedido. Taxas de processamento podem ser cobradas no pagamento online.</p>
                <p>Pix com comprovante não confirma automaticamente. A loja precisa conferir antes de preparar.</p>
                <p>A assinatura do PratoBy continua sendo cobrada separadamente pelo Asaas na área de faturamento.</p>
              </div>
            </Card>
          </div>
        </div>
                  
        <div className="mt-8 rounded-[1.5rem] border border-gray-100 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-zinc-100">
                Tudo pronto?
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[#6b7280] dark:text-zinc-400">
                Salvar atualiza métodos aceitos, Pix com comprovante e preferências públicas de pagamento.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-6 text-sm font-black text-white shadow-sm shadow-orange-500/20 transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-zinc-800"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? 'Salvando...' : 'Salvar pagamentos'}
            </button>
          </div>
        </div>
      </div>

      <DashboardFooter store={selectedStore} />
    </main>
  )
}
