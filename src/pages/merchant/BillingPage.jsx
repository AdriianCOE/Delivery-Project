import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import AnimatedSegmentedControl from '../../components/ui/AnimatedSegmentedControl'
import SubscriptionStatusBadge from '../../components/billing/SubscriptionStatusBadge'
import {
  formatBillingDate,
  formatPlanName,
  getTrialDaysRemaining,
  normalizeBillingCycle,
  toDate,
} from '../../utils/billingStatus'
import { PLAN_OPTIONS } from '../../utils/planCatalog'
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCreditCard,
  FiInfo,
  FiLoader,
  FiLock,
  FiCode,
  FiSettings,
  FiShield,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'motion/react'

function formatPhoneBR(value) {
  const clean = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (!clean) return ''
  if (clean.length <= 2) return `(${clean}`
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function openCheckoutUrl(url) {
  const checkoutUrl = String(url || '').trim()
  if (!/^https:\/\//i.test(checkoutUrl)) return false

  const opened = window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.assign(checkoutUrl)
  }

  return true
}

function getBillingInputClass(hasError = false) {
  return [
    'h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50',
    'dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-900/70',
    hasError
      ? 'border-red-300 bg-red-50/30 focus:border-red-400 dark:border-red-500/60 dark:bg-red-950/20'
      : 'border-gray-200 focus:border-[#f97316] dark:border-zinc-700 dark:focus:border-[#f97316]',
  ].join(' ')
}

function normalizeStatus(status) {
  return ['pending_checkout', 'billing_pending', 'billing_pending_payment_method'].includes(status)
    ? 'checkout_pending'
    : status || 'checkout_pending'
}

function normalizeCycleId(cycle) {
  if (cycle === 'annual' || cycle === 'yearly' || cycle === 'year' || cycle === 'anual') return 'annual'
  return 'monthly'
}

function getPrimaryAction({ status, hasAsaasSubscription }) {
  if (status === 'checkout_pending') {
    return {
      label: 'Configurar cobrança e ativar teste grátis',
      support: 'Você não será cobrado agora. A primeira cobrança acontece após os 14 dias grátis.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'trialing' && !hasAsaasSubscription) {
    return {
      label: 'Configurar cobrança',
      support: 'Você não será cobrado agora. A primeira cobrança acontece após os 14 dias grátis.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'past_due') {
    return {
      label: 'Regularizar pagamento',
      support: hasAsaasSubscription
        ? 'Abra o gerenciamento da assinatura para regularizar a pendência.'
        : 'Configure a cobrança para regularizar a assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  if (status === 'blocked' || status === 'canceled') {
    return {
      label: 'Regularizar pagamento',
      support: hasAsaasSubscription
        ? 'Abra o gerenciamento da assinatura para regularizar a situação.'
        : 'Informe os dados de faturamento para reativar sua assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  return {
    label: 'Gerenciar assinatura',
    support: 'Cobrança configurada. Gerencie plano, pagamento e vencimento em uma tela segura.',
    needsBillingData: false,
    tone: 'orange',
  }
}

const BILLING_PLAN_PRESENTATION = {
  essential: {
    name: 'Essencial',
    tagline: 'Para começar simples.',
    description: 'O básico para colocar sua loja online, receber pedidos e vender pelo próprio link.',
    bestFor: 'Lojas que estão começando ou querem validar o delivery digital sem complexidade.',
    cta: 'Começar com Essencial',
    badge: '',
    highlights: ['Cardápio digital ilimitado', 'Pedidos em tempo real', 'Link próprio da loja'],
  },
  professional: {
    name: 'Professional',
    tagline: 'Para vender mais.',
    description: 'Cupons, WhatsApp e relatórios para aumentar pedidos e acompanhar melhor a operação.',
    bestFor: 'Lojas que já vendem online e querem campanhas, mais controle e rotina mais ágil.',
    cta: 'Escolher Professional',
    badge: 'Mais escolhido',
    highlights: ['Cupons e ofertas', 'WhatsApp integrado', 'Relatórios avançados'],
  },
  premium: {
    name: 'Premium',
    tagline: 'Para operações maiores.',
    description: 'Mais estrutura para marcas fortes, filiais, domínio próprio e atendimento VIP.',
    bestFor: 'Operações com mais de uma loja ou que precisam de marca própria e suporte próximo.',
    cta: 'Escolher Premium',
    badge: 'Mais completo',
    highlights: ['Até 3 filiais', 'Domínio personalizado', 'Suporte VIP'],
  },
}

const PLAN_COMPARISON_SECTIONS = [
  {
    category: 'Operação',
    rows: [
      { feature: 'Cardápio e pedidos', essential: 'Incluído', professional: 'Incluído', premium: 'Incluído' },
      { feature: 'Entrega por região', essential: 'Simples', professional: 'Avançada', premium: 'Avançada' },
      { feature: 'Pedidos pelo WhatsApp', essential: 'Manual', professional: 'Integrado', premium: 'Integrado' },
    ],
  },
  {
    category: 'Vendas',
    rows: [
      { feature: 'Cupons e ofertas', essential: 'Não incluído', professional: 'Ilimitados', premium: 'Ilimitados' },
      { feature: 'Avisos por WhatsApp', essential: 'Não incluído', professional: 'Status automático', premium: 'Status automático' },
      { feature: 'Relatórios', essential: 'Básicos', professional: 'Avançados', premium: 'Avançados' },
    ],
  },
  {
    category: 'Marca e suporte',
    rows: [
      { feature: 'Domínio próprio', essential: 'Não incluído', professional: 'Não incluído', premium: 'Incluído' },
      { feature: 'Marca própria', essential: 'Não incluído', professional: 'Não incluído', premium: 'Incluído' },
      { feature: 'Atendimento', essential: 'E-mail', professional: 'Prioritário', premium: 'VIP' },
    ],
  },
]

function normalizePlanId(planId) {
  if (!planId) return 'essential'
  const normalized = String(planId).toLowerCase().trim()
  if (normalized === 'essential' || normalized === 'essencial') return 'essential'
  if (normalized === 'professional' || normalized === 'profissional' || normalized === 'plus') return 'professional'
  if (normalized === 'premium') return 'premium'
  return normalized
}

function getBillingPlanPresentation(planId) {
  const normalizedId = normalizePlanId(planId)
  return BILLING_PLAN_PRESENTATION[normalizedId] || {
    name: formatPlanName(planId),
    tagline: 'Plano da sua loja.',
    description: 'Plano selecionado para sua assinatura.',
    bestFor: 'Lojas que usam o PratoBy no plano atual.',
    cta: 'Selecionar plano',
    badge: '',
    highlights: [],
  }
}

function getComparisonValueTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('não')) {
    return 'bg-gray-50 text-gray-500 ring-gray-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:ring-zinc-700'
  }
  if (normalized.includes('avanç') || normalized.includes('integrado') || normalized.includes('priorit') || normalized.includes('vip')) {
    return 'bg-orange-50 text-[#f97316] ring-orange-100 dark:bg-orange-950/20 dark:ring-orange-900/40'
  }
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-900/40'
}

function SummaryItem({ label, value, helper }) {
  return (
    <div className="min-w-0 border-t border-gray-100 pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0 dark:border-zinc-800">
      <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-base font-black text-[#111827] dark:text-white">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">{helper}</p>}
    </div>
  )
}

function TimelineStep({ done, active, title, description, meta }) {
  return (
    <div className="relative flex gap-3 md:block">
      <div className="flex flex-col items-center md:flex-row">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900 ${
            done
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : active
              ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
          }`}
        >
          {done ? <FiCheck size={15} /> : active ? <FiClock size={15} /> : <FiCalendar size={15} />}
        </span>
        <span className="mt-2 h-full w-px bg-gray-100 dark:bg-zinc-800 md:ml-3 md:mt-0 md:h-px md:flex-1" />
      </div>
      <div className="min-w-0 pb-5 md:mt-3 md:pb-0">
        <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">{description}</p>
        {meta && <p className="mt-2 text-xs font-black text-[#f97316]">{meta}</p>}
      </div>
    </div>
  )
}

function BillingFooter() {
  return (
    <footer className="mt-10 rounded-[1.5rem] border border-gray-100 bg-white/90 p-4 shadow-sm ring-1 ring-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 dark:ring-zinc-800 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt="PratoBy"
            className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-lg shadow-orange-600/15"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#111827] dark:text-white">
              PratoBy · Cardápio digital e delivery
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
              Em caso de dúvida, fale com nosso suporte antes da primeira cobrança.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316] ring-1 ring-orange-100 dark:bg-orange-950/20 dark:ring-orange-900/30">
            <FiShield size={14} />
            Pagamento seguro via Asaas
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <Link to="/contato" className="rounded-full px-2.5 py-1.5 text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
              Suporte
            </Link>
            <Link to="/termos" className="rounded-full px-2.5 py-1.5 text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
              Termos
            </Link>
            <Link to="/privacidade" className="rounded-full px-2.5 py-1.5 text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
              Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function BillingPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, userData, storeId, storeIds = [] } = auth
  const [store, setStore] = useState(null)
  const [loadingStore, setLoadingStore] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isCheckingBillingStatus, setIsCheckingBillingStatus] = useState(false)
  const [toast, setToast] = useState(null)
  const [showTechnical, setShowTechnical] = useState(false)
  const [selectedPlanCycle, setSelectedPlanCycle] = useState('monthly')
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState('')
  const [lastCheckoutExpiresAt, setLastCheckoutExpiresAt] = useState('')
  const [storeRefreshNonce, setStoreRefreshNonce] = useState(0)
  const [savingTrialReminder, setSavingTrialReminder] = useState(false)

  const [showBillingModal, setShowBillingModal] = useState(false)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [pendingCycle, setPendingCycle] = useState(null)
  const [billingName, setBillingName] = useState('')
  const [billingCpfCnpj, setBillingCpfCnpj] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
  const [billingPostalCode, setBillingPostalCode] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingAddressNumber, setBillingAddressNumber] = useState('')
  const [billingProvince, setBillingProvince] = useState('')
  const [billingComplement, setBillingComplement] = useState('')
  const [billingErrors, setBillingErrors] = useState({})

  useEffect(() => {
    const uid = user?.uid
    if (!uid && !storeId && (!storeIds || !storeIds.length)) {
      setLoadingStore(false)
      setStore(null)
      return undefined
    }

    setLoadingStore(true)
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

      if (nextStores.length > 0) {
        const activeStoreId = localStorage.getItem('@PratoBy:selectedStoreId')
        const active = nextStores.find((s) => s.id === activeStoreId) || nextStores[0]
        setStore(active)
      } else {
        setStore(null)
      }
      setLoadingStore(false)
    }

    function subscribeToQuery(storesQuery) {
      const unsubscribe = onSnapshot(
        storesQuery,
        (snapshot) => {
          snapshot.docs.forEach((storeDoc) => {
            storesMap.set(storeDoc.id, normalizeStoreDoc(storeDoc))
          })
          publishStores()
        },
        (error) => {
          console.error('[BillingPage] error loading stores query:', error)
          setLoadingStore(false)
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
          console.error('[BillingPage] error loading store doc:', error)
          setLoadingStore(false)
        }
      )
      unsubscribers.push(unsubscribe)
    }

    const knownStoreIds = Array.from(new Set([
      storeId,
      ...(Array.isArray(storeIds) ? storeIds : []),
      userData?.storeId,
      ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ].filter(Boolean)))

    if (knownStoreIds.length > 0) {
      knownStoreIds.forEach(subscribeToStoreDoc)
    } else {
      setLoadingStore(false)
      setStore(null)
    }

    if (unsubscribers.length === 0) {
      setStore(null)
      setLoadingStore(false)
      return undefined
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [user, storeId, storeIds, userData, storeRefreshNonce])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Format CEP with mask: 00000-000
  function formatCep(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 5) return digits
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }

  useEffect(() => {
    if (!store) return
    const addr = typeof store.address === 'object' ? store.address : {}
    const street = typeof store.address === 'string' ? store.address : (addr?.street || addr?.rua || store.street || store.logradouro || '')
    const number = addr?.number || addr?.numero || store.addressNumber || store.number || store.numero || ''
    const neighborhood = addr?.neighborhood || addr?.bairro || store.province || store.neighborhood || store.bairro || ''
    const complement = addr?.complement || addr?.complemento || store.complement || store.complemento || ''
    const cep = addr?.cep || store.postalCode || store.cep || store.zipCode || ''

    setBillingName(store.name || store.storeName || user?.displayName || userData?.name || '')
    setBillingEmail(store.ownerEmail || user?.email || userData?.email || '')
    setBillingPhone(formatPhoneBR(store.whatsapp || store.whatsapp1 || store.phone || userData?.phone || user?.phoneNumber || ''))
    setBillingCpfCnpj(store.cnpj || store.cpf || '')
    setBillingPostalCode(formatCep(cep))
    setBillingAddress(street)
    setBillingAddressNumber(number)
    setBillingProvince(neighborhood)
    setBillingComplement(complement)
  }, [store, user, userData])

  const subscriptionStatus = normalizeStatus(store?.subscriptionStatus || userData?.subscriptionStatus)
  const plan = store?.plan || userData?.plan || 'essential'
  const billingCycle = normalizeCycleId(store?.billingCycle || userData?.billingCycle || 'monthly')
  const trialEndsAt = store?.trialEndsAt || userData?.trialEndsAt
  const currentPeriodEnd = store?.currentPeriodEnd || userData?.currentPeriodEnd
  const lastPaymentStatus = store?.lastPaymentStatus || userData?.lastPaymentStatus || ''
  const billingProvider = store?.billingProvider || userData?.billingProvider || ''
  const asaasCustomerId = store?.asaasCustomerId || userData?.asaasCustomerId || ''
  const asaasSubscriptionId = store?.asaasSubscriptionId || userData?.asaasSubscriptionId || ''
  const asaasCheckoutUrl = store?.asaasCheckoutUrl || userData?.asaasCheckoutUrl || ''
  const asaasCheckoutExpiresAt =
    store?.asaasCheckoutExpiresAt ||
    userData?.asaasCheckoutExpiresAt ||
    ''

  const checkoutExpiresAt = lastCheckoutExpiresAt || asaasCheckoutExpiresAt
  const checkoutExpiresAtDate = checkoutExpiresAt ? toDate(checkoutExpiresAt) : null
  const billingMethodConfigured = Boolean(store?.billingMethodConfigured || userData?.billingMethodConfigured)
  const hasAsaasSubscription = Boolean(asaasSubscriptionId)
  const hasAsaasBillingSetup = hasAsaasSubscription || billingMethodConfigured
  const checkoutUrlToOpen = lastCheckoutUrl || asaasCheckoutUrl

  const checkoutIsExpired =
    Boolean(checkoutExpiresAtDate) && checkoutExpiresAtDate.getTime() <= Date.now()

  const canReopenCheckout =
    Boolean(checkoutUrlToOpen) && !hasAsaasBillingSetup && !checkoutIsExpired
  const showCheckoutSuccessBanner =
    searchParams.get('asaasCheckout') === 'success' && !hasAsaasBillingSetup
  const trialReminderEmailOptIn = Boolean(userData?.trialReminderEmailOptIn)
  const currentPlanOption = PLAN_OPTIONS.find((planOption) => planOption.id === plan) || PLAN_OPTIONS[0]
  const currentPlanDisplayAmount = billingCycle === 'annual'
    ? currentPlanOption.priceAnnual
    : currentPlanOption.priceMonthly

  useEffect(() => {
    setSelectedPlanCycle(billingCycle)
  }, [billingCycle])

  const trialDaysLeft = useMemo(() => getTrialDaysRemaining(trialEndsAt), [trialEndsAt])
  const trialEndsDate = useMemo(() => toDate(trialEndsAt), [trialEndsAt])
  const currentPeriodEndDate = useMemo(() => toDate(currentPeriodEnd), [currentPeriodEnd])

  const isTrial = subscriptionStatus === 'trialing'
  const isPastDue = subscriptionStatus === 'past_due'
  const isBlocked = subscriptionStatus === 'blocked'
  const isCanceled = subscriptionStatus === 'canceled'
  const isActive = subscriptionStatus === 'active'
  const isPending = subscriptionStatus === 'checkout_pending'
  const showBillingRequiredBanner = searchParams.get('reason') === 'billing_required' && isPending
  const trialIsFuture = Boolean(trialEndsDate && trialEndsDate.getTime() > Date.now())

  const nextBillingInfo = useMemo(() => {
    if (!hasAsaasBillingSetup) {
      return {
        label: 'Cobrança',
        value: 'Pendente de configuração',
        helper: 'Cadastre a forma de pagamento para ativar seu teste grátis.',
      }
    }

    if (isTrial && trialIsFuture) {
      return {
        label: 'Primeira cobrança prevista',
        value: formatBillingDate(trialEndsAt),
        helper: 'A cobrança começa somente após o período de teste.',
      }
    }

    if (isActive && currentPeriodEndDate) {
      return {
        label: 'Próxima cobrança',
        value: formatBillingDate(currentPeriodEnd),
        helper: 'Sem taxas por pedido no plano atual.',
      }
    }

    if (isPastDue) {
      return {
        label: 'Pagamento pendente desde',
        value: formatBillingDate(currentPeriodEnd || trialEndsAt),
        helper: 'Regularize para manter a loja ativa.',
      }
    }

    return {
      label: 'Próxima cobrança',
      value: formatBillingDate(currentPeriodEnd || trialEndsAt),
      helper: 'Dados atualizados pela integração de cobrança.',
    }
  }, [
    currentPeriodEnd,
    currentPeriodEndDate,
    hasAsaasBillingSetup,
    isActive,
    isPastDue,
    isTrial,
    trialEndsAt,
    trialIsFuture,
  ])

  const primaryAction = useMemo(
    () => getPrimaryAction({ status: subscriptionStatus, hasAsaasSubscription: hasAsaasBillingSetup }),
    [subscriptionStatus, hasAsaasBillingSetup]
  )
  const currentPlanPresentation = getBillingPlanPresentation(plan)

  const headerBadge = useMemo(() => {
    if (isPending) return { label: 'Configure sua cobrança', color: 'orange', dot: true, pulse: true }
    if (isTrial) {
      return {
        label: hasAsaasBillingSetup ? 'Teste grátis ativo' : 'Teste grátis',
        color: 'blue',
        dot: true,
        pulse: !hasAsaasBillingSetup
      }
    }
    if (isActive) return { label: 'Assinatura ativa', color: 'green', dot: true }
    if (isPastDue) return { label: 'Pagamento pendente', color: 'red', dot: true, pulse: true }
    if (isBlocked || isCanceled) return { label: 'Assinatura bloqueada/cancelada', color: 'red', dot: true }
    return { label: 'Checkout pendente', color: 'gray', dot: true }
  }, [isActive, isBlocked, isCanceled, isPastDue, isPending, isTrial, hasAsaasBillingSetup])

  const timelineSteps = useMemo(() => {
    const trialDescription = trialEndsAt
      ? `Ativo até ${formatBillingDate(trialEndsAt)}`
      : '14 dias grátis após ativação'
    const chargeDate = trialEndsAt || currentPeriodEnd

    return [
      {
        title: 'Conta criada',
        description: 'Cadastro do lojista concluído',
        meta: store?.createdAt ? formatBillingDate(store.createdAt) : 'Concluído',
        done: true,
      },
      {
        title: 'Teste grátis',
        description: isPending ? 'Aguardando ativação' : trialDescription,
        meta: isTrial ? 'Etapa atual' : null,
        done: !isPending && !isTrial,
        active: isTrial || isPending,
      },
      {
        title: 'Primeira cobrança',
        description: hasAsaasBillingSetup ? 'Forma de pagamento cadastrada no Asaas' : 'Forma de pagamento pendente',
        meta: chargeDate ? `Prevista para ${formatBillingDate(chargeDate)}` : 'Configure a cobrança',
        done: hasAsaasBillingSetup && isActive,
        active: !hasAsaasBillingSetup || isPastDue,
      },
    ]
  }, [currentPeriodEnd, hasAsaasBillingSetup, isActive, isPastDue, isPending, isTrial, store?.createdAt, trialEndsAt])

  function openBillingModal(targetPlan, targetCycle) {
    if (!store?.id) {
      setToast({ type: 'error', message: 'Nenhuma loja selecionada para faturamento.' })
      return
    }

    setPendingPlan(targetPlan)
    setPendingCycle(normalizeCycleId(targetCycle))

    const addr = typeof store.address === 'object' ? store.address : {}
    const street = typeof store.address === 'string' ? store.address : (addr?.street || addr?.rua || store.street || store.logradouro || '')
    const number = addr?.number || addr?.numero || store.addressNumber || store.number || store.numero || ''
    const neighborhood = addr?.neighborhood || addr?.bairro || store.province || store.neighborhood || store.bairro || ''
    const complement = addr?.complement || addr?.complemento || store.complement || store.complemento || ''
    const cep = addr?.cep || store.postalCode || store.cep || store.zipCode || ''

    if (!billingName) setBillingName(store.name || store.storeName || user?.displayName || userData?.name || '')
    if (!billingEmail) setBillingEmail(store.ownerEmail || user?.email || userData?.email || '')
    if (!billingPhone) setBillingPhone(formatPhoneBR(store.whatsapp || store.whatsapp1 || store.phone || userData?.phone || user?.phoneNumber || ''))
    if (!billingCpfCnpj) setBillingCpfCnpj(store.cnpj || store.cpf || '')
    if (!billingPostalCode) setBillingPostalCode(formatCep(cep))
    if (!billingAddress) setBillingAddress(street)
    if (!billingAddressNumber) setBillingAddressNumber(number)
    if (!billingProvince) setBillingProvince(neighborhood)
    if (!billingComplement) setBillingComplement(complement)

    setBillingErrors({})
    setShowBillingModal(true)
  }

  function handlePrimaryAction() {
    if (primaryAction.needsBillingData) {
      openBillingModal(plan, billingCycle)
      return
    }

    navigate('/dashboard/subscription-management')
  }

  async function handleRefreshBillingStatus() {
    if (isCheckingBillingStatus) return

    setIsCheckingBillingStatus(true)
    setLoadingStore(true)
    try {
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      setStoreRefreshNonce((value) => value + 1)
      setToast({
        type: 'info',
        message: 'Verificando status da assinatura. Se o Asaas confirmar o pagamento, esta página será atualizada.',
      })
    } catch (error) {
      console.error('[BillingPage] error refreshing billing status:', error)
      setToast({
        type: 'error',
        message: 'Não foi possível verificar o status agora. Tente novamente em alguns segundos.',
      })
    } finally {
      setIsCheckingBillingStatus(false)
    }
  }

  async function handleTrialReminderEmailChange(event) {
    const nextValue = event.target.checked
    if (savingTrialReminder) return

    setSavingTrialReminder(true)
    try {
      const updatePreferences = httpsCallable(functions, 'updateBillingNotificationPreferences')
      await updatePreferences({ trialReminderEmailOptIn: nextValue })
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      setToast({
        type: 'success',
        message: nextValue
          ? 'Lembretes do teste grátis ativados.'
          : 'Lembretes do teste grátis desativados.',
      })
    } catch (error) {
      console.error('[BillingPage] error updating trial reminder preference:', error)
      setToast({
        type: 'error',
        message: error.message || 'Não foi possível salvar a preferência de lembretes agora.',
      })
    } finally {
      setSavingTrialReminder(false)
    }
  }

  function validateBillingForm() {
    const errors = {}
    if (!billingName.trim()) errors.name = 'Nome ou Razão Social é obrigatório'

    const cleanCpfCnpj = billingCpfCnpj.replace(/\D/g, '')
    if (!billingCpfCnpj.trim()) {
      errors.cpfCnpj = 'CPF ou CNPJ é obrigatório'
    } else if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      errors.cpfCnpj = 'CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos'
    }

    if (!billingEmail.trim()) {
      errors.email = 'E-mail é obrigatório'
    } else if (!/\S+@\S+\.\S+/.test(billingEmail)) {
      errors.email = 'E-mail inválido'
    }

    if (!billingPhone.trim()) errors.phone = 'WhatsApp ou celular é obrigatório'

    const cleanPostalCode = billingPostalCode.replace(/\D/g, '')
    if (!cleanPostalCode) {
      errors.postalCode = 'CEP é obrigatório'
    } else if (cleanPostalCode.length !== 8) {
      errors.postalCode = 'CEP deve ter 8 dígitos (ex: 49000-000)'
    }

    if (!billingAddress.trim()) errors.address = 'Endereço é obrigatório'
    if (!billingAddressNumber.trim()) errors.addressNumber = 'Número é obrigatório'
    if (!billingProvince.trim()) errors.province = 'Bairro é obrigatório'

    setBillingErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleConfirmSubscription(e) {
    if (e) e.preventDefault()
    if (submitting || !validateBillingForm()) return

    setSubmitting(true)
    try {
      const startSubscriptionFn = httpsCallable(functions, 'startAsaasSubscription')
      const response = await startSubscriptionFn({
        storeId: store.id,
        plan: pendingPlan,
        billingCycle: pendingCycle,
        billingData: {
          name: billingName.trim(),
          cpfCnpj: billingCpfCnpj.replace(/\D/g, ''),
          email: billingEmail.trim().toLowerCase(),
          phone: billingPhone.trim(),
          postalCode: billingPostalCode.replace(/\D/g, ''),
          address: billingAddress.trim(),
          addressNumber: billingAddressNumber.trim(),
          province: billingProvince.trim(),
          complement: billingComplement.trim() || undefined,
        },
      })

      const checkoutUrl =
        response?.data?.checkoutUrl ||
        response?.data?.paymentUrl ||
        response?.data?.invoiceUrl ||
        response?.data?.bankSlipUrl ||
        ''

      if (checkoutUrl) {
        const checkoutExpiresAt =
          response?.data?.checkoutExpiresAt ||
          response?.data?.asaasCheckoutExpiresAt ||
          response?.data?.expiresAt ||
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        setLastCheckoutUrl(checkoutUrl)
        setLastCheckoutExpiresAt(checkoutExpiresAt)

        try {
          localStorage.setItem(
            `pratoby:billingCheckout:${store.id}`,
            JSON.stringify({
              url: checkoutUrl,
              expiresAt: checkoutExpiresAt,
            })
          )
        } catch {
          // localStorage pode falhar em modo privado; não bloqueia o fluxo
        }

        if (openCheckoutUrl(checkoutUrl)) {
          setToast({
            type: 'info',
            message: 'Redirecionando para o Asaas. Depois de cadastrar a forma de pagamento, volte para esta página.',
          })
        } else {
          setToast({
            type: 'error',
            message: 'O checkout retornado não parece seguro. Tente gerar um novo link.',
          })
        }
      } else {
        setToast({
          type: 'success',
          message: response?.data?.status === 'trialing'
            ? 'Forma de pagamento confirmada. Seu teste grátis foi ativado.'
            : 'Solicitação enviada ao Asaas. Aguarde a atualização do status.',
        })
      }

      setShowBillingModal(false)
      setPendingPlan(null)
      setPendingCycle(null)
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
    } catch (error) {
      console.error('[BillingPage] error starting subscription:', error)
      setToast({
        type: 'error',
        message: error.message || 'Não foi possível configurar a cobrança Asaas.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!store?.id || hasAsaasBillingSetup) return

    try {
      const raw = localStorage.getItem(`pratoby:billingCheckout:${store.id}`)
      if (!raw) return

      const saved = JSON.parse(raw)
      const expiresAtDate = saved?.expiresAt ? new Date(saved.expiresAt) : null

      if (expiresAtDate && expiresAtDate.getTime() <= Date.now()) {
        localStorage.removeItem(`pratoby:billingCheckout:${store.id}`)
        return
      }

      if (saved?.url) {
        setLastCheckoutUrl(saved.url)
        setLastCheckoutExpiresAt(saved.expiresAt || '')
      }
    } catch {
      // ignora cache inválido
    }
  }, [store?.id, hasAsaasBillingSetup])

  if (loadingStore) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <FiLoader className="h-10 w-10 animate-spin text-[#f97316]" />
        <p className="mt-4 text-sm font-bold text-[#6b7280]">Carregando dados da assinatura...</p>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
            <FiAlertTriangle size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#111827] dark:text-white">Nenhuma loja ativa</h3>
          <p className="mt-2 text-sm text-[#6b7280] dark:text-zinc-400">
            Não encontramos nenhuma loja ativa associada ao seu painel. Se acabou de criar a sua loja, tente recarregar ou contate o suporte.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 transition-colors duration-300">
      <DashboardPageHeader
        title="Faturamento & Assinatura"
        description="Acompanhe o período de testes, plano ativo e cadastre sua forma de pagamento recorrente e segura."
        icon={FiCreditCard}
        badge={headerBadge}
        actions={
          <motion.div
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 15 }}
          >
            <Link
            to="/dashboard/subscription-management"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316] border border-orange-200/50 hover:bg-orange-100/50 px-4 text-xs font-black transition-all duration-300 active:scale-95 shadow-sm"
          >
            <FiSettings size={13} />
            <span>Gerenciar assinatura</span>
          </Link>
          </motion.div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* Nenhuma Loja Vinculada */}
        {!store && !loadingStore && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-200 bg-red-50/90 dark:border-red-950/40 dark:bg-red-950/20 p-5 shadow-sm ring-1 ring-red-100/70"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 text-red-600 shadow-sm">
                  <FiAlertTriangle size={20} />
                </span>
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-white">Nenhuma loja vinculada à sua conta</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-700 dark:text-zinc-300">
                    Conclua o onboarding para criar a sua loja ou fale com o suporte se acredita que isso é um erro.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Banner de aviso crítico */}
        {showBillingRequiredBanner && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-orange-200 bg-orange-50/90 dark:border-orange-950/40 dark:bg-orange-950/20 p-5 shadow-sm ring-1 ring-orange-100/70"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 text-[#f97316] shadow-sm">
                  <FiShield size={20} />
                </span>
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-white">Finalize a configuração da cobrança</h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-700 dark:text-zinc-300">
                    Para manter o seu teste grátis e garantir que sua loja continue ativa após os 14 dias, cadastre sua forma de pagamento.
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-[#f97316]">
                    Nenhuma cobrança é realizada hoje. A primeira fatura só ocorre ao término dos 14 dias grátis.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openBillingModal(plan, billingCycle)}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f97316] px-5 text-xs font-black text-white shadow-lg shadow-orange-600/10 transition hover:bg-[#ea580c] sm:w-auto"
              >
                <FiCreditCard size={14} />
                Cadastrar forma de pagamento
              </button>
            </div>
          </motion.section>
        )}

        {/* Banner de Sincronização */}
        {showCheckoutSuccessBanner && (
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-950/40 dark:bg-emerald-950/20 p-5 text-sm font-semibold text-emerald-800 dark:text-emerald-400 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <FiCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
              <div>
                <p className="font-black text-gray-900 dark:text-white">Forma de pagamento confirmada!</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  Seu teste grátis será atualizado automaticamente após a confirmação. Se necessário, use o botão de verificar status no painel abaixo.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/dashboard"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    Ir para o dashboard
                  </Link>
                  <Link
                    to="/dashboard#primeiros-passos"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-xs font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                  >
                    Ver primeiros passos
                  </Link>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* UNIFIED HUD CONTROL CENTER */}
        <section className="bg-gradient-to-br from-white via-[#fffdfb] to-orange-50/15 dark:from-zinc-900 dark:to-zinc-950 text-gray-900 dark:text-white rounded-[2rem] p-6 lg:p-8 shadow-sm dark:shadow-xl border border-orange-100 dark:border-zinc-800 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] items-stretch">
            {/* Left Side: Status Info & Progress */}
            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 px-3 py-1 text-[11px] font-bold text-[#f97316] dark:text-orange-400 uppercase tracking-wider">
                    <FiShield size={12} className="text-orange-500" />
                    Status da Assinatura
                  </span>
                  <SubscriptionStatusBadge status={subscriptionStatus} />
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ring-1 ring-inset ${
                    hasAsaasBillingSetup
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                      : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
                  }`}>
                    <FiLock size={11} className={hasAsaasBillingSetup ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                    {hasAsaasBillingSetup ? 'Forma de Pagamento Ativa' : 'Faturamento Não Configurado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Plano da sua loja</span>
                  <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-1">
                    Plano {currentPlanPresentation.name}
                  </h2>
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-zinc-300 font-medium max-w-lg leading-relaxed">
                    {currentPlanPresentation.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold mt-2">
                    Ciclo {normalizeBillingCycle(billingCycle)} · Sem comissão por pedidos.
                  </p>
                </div>
              </div>

              {/* Progress HUD de Trial */}
              {isTrial && trialEndsAt ? (
                <div className="bg-orange-50/25 dark:bg-zinc-900/60 border border-orange-100/40 dark:border-zinc-800/80 rounded-2xl p-4 lg:p-5 space-y-3">
                  <div className="flex justify-between items-center text-xs lg:text-sm">
                    <span className="text-gray-700 dark:text-zinc-300 font-bold flex items-center gap-2">
                      <FiClock className="text-orange-500" size={15} />
                      Teste grátis de 14 dias ativo
                    </span>
                    <span className="font-black text-[#f97316] dark:text-orange-400">
                      {trialDaysLeft !== null ? `${trialDaysLeft} dias restantes` : 'Ativo'}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-orange-100/30 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, (trialDaysLeft / 14) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold">
                    <span>Dia 1 (Início)</span>
                    <span>Término em {formatBillingDate(trialEndsAt)}</span>
                  </div>
                </div>
              ) : isActive ? (
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100/40 dark:border-emerald-900/30 rounded-2xl p-4 lg:p-5 flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FiCheck size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Acesso Totalmente Ativo</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 font-semibold mt-1">Sua loja está com a cobrança regularizada. Boas vendas!</p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/40 dark:bg-red-950/25 border border-red-100/40 dark:border-red-900/30 rounded-2xl p-4 lg:p-5 flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                    <FiAlertTriangle size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Configuração Pendente</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 font-semibold mt-1">Para liberar o painel da sua loja, ative os 14 dias grátis informando os dados de cobrança.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: CTA Panel */}
            <div className="bg-[#fffcf9] dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800 rounded-3xl p-5 lg:p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FiLock className="text-orange-500" size={14} />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Pagamento seguro</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500">Valor programado do plano</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                      {formatCurrency(currentPlanDisplayAmount)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-400 font-semibold">
                      /{billingCycle === 'annual' ? 'ano' : 'mês'}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-orange-50/20 dark:bg-zinc-950/50 border border-orange-100/50 dark:border-zinc-800">
                    <p className="text-xs text-gray-600 dark:text-zinc-300 font-semibold leading-normal">
                      {hasAsaasBillingSetup
                        ? `Cobrança automática ativa. Próximo faturamento agendado em: ${formatBillingDate(currentPeriodEnd || trialEndsAt)}.`
                        : isTrial && trialEndsAt
                        ? `Cobrança programada: R$ 0,00 cobrados hoje. O primeiro faturamento real acontecerá apenas em ${formatBillingDate(trialEndsAt)}.`
                        : 'Sua assinatura requer o cadastro dos dados de faturamento. Nenhum valor será debitado hoje.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePrimaryAction}
                  className={`w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl text-xs font-black transition-all duration-300 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                    primaryAction.tone === 'red'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/10'
                      : primaryAction.tone === 'neutral'
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white border border-gray-200 dark:border-zinc-700 shadow-sm'
                      : 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-lg shadow-orange-600/10'
                  }`}
                >
                  {submitting ? (
                    <FiLoader className={`animate-spin ${primaryAction.tone === 'neutral' ? 'text-gray-800 dark:text-white' : 'text-white'}`} size={14} />
                  ) : primaryAction.needsBillingData ? (
                    <>
                      <FiCreditCard size={14} />
                      <span>{primaryAction.label}</span>
                    </>
                  ) : (
                    <>
                      <FiSettings size={14} />
                      <span>{primaryAction.label}</span>
                    </>
                  )}
                </button>

                {canReopenCheckout && (
                  <button
                    type="button"
                    onClick={() => openCheckoutUrl(checkoutUrlToOpen)}
                    className="w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-orange-200/60 bg-orange-50/70 text-[11px] font-black text-[#f97316] transition hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/15"
                  >
                    <FiArrowRight size={12} />
                    Reabrir checkout seguro
                  </button>
                )}

                {checkoutUrlToOpen && !hasAsaasBillingSetup && checkoutIsExpired && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    <p className="font-black">Checkout expirado</p>
                    <p className="mt-1">
                      O link anterior venceu. Gere um novo checkout seguro para continuar.
                    </p>
                    <button
                      type="button"
                      onClick={() => openBillingModal(plan, billingCycle)}
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-3 text-[11px] font-black text-white transition hover:bg-[#ea580c]"
                    >
                      <FiCreditCard size={12} />
                      Gerar novo checkout
                    </button>
                  </div>
                )}

                {!hasAsaasBillingSetup && (
                  <button
                    type="button"
                    onClick={handleRefreshBillingStatus}
                    disabled={isCheckingBillingStatus}
                    className="w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/20 text-[11px] font-black text-gray-500 dark:text-zinc-400 transition hover:bg-gray-100 dark:hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {isCheckingBillingStatus ? <FiLoader className="animate-spin" size={12} /> : <FiClock size={12} />}
                    {isCheckingBillingStatus ? 'Verificando...' : 'Verificar status da assinatura'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* METRICS ROW */}
        <section className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 lg:p-5 rounded-2xl shadow-sm transition-colors">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">Plano</p>
            <p className="mt-1.5 text-sm lg:text-base font-black text-gray-900 dark:text-white">{currentPlanPresentation.name}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{hasAsaasBillingSetup ? 'Configurado' : 'Pendente'}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 lg:p-5 rounded-2xl shadow-sm transition-colors">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">Ciclo</p>
            <p className="mt-1.5 text-sm lg:text-base font-black text-gray-900 dark:text-white">{normalizeBillingCycle(billingCycle)}</p>
            <p className="mt-1 text-xs text-[#f97316] font-bold">Taxa zero por vendas</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 lg:p-5 rounded-2xl shadow-sm transition-colors">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">Fim do Teste</p>
            <p className="mt-1.5 text-sm lg:text-base font-black text-gray-900 dark:text-white">{formatBillingDate(trialEndsAt)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{isTrial ? `${trialDaysLeft} dias restantes` : 'Período grátis finalizado'}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 lg:p-5 rounded-2xl shadow-sm transition-colors">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{nextBillingInfo.label}</p>
            <p className="mt-1.5 text-sm lg:text-base font-black text-gray-900 dark:text-white">{nextBillingInfo.value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 truncate">{nextBillingInfo.helper}</p>
          </div>
        </section>

        {/* TRUST CARDS */}
        <section className="grid gap-3 md:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm transition-colors sm:p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
              <FiShield size={16} />
            </span>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-gray-900 dark:text-white">Pagamento Seguro Asaas</h4>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-600 dark:text-zinc-400">
                Sua assinatura é processada de forma segura diretamente na infraestrutura criptografada oficial do Asaas.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm transition-colors sm:p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
              <FiLock size={16} />
            </span>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-gray-900 dark:text-white">Cartão Não Armazenado</h4>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-600 dark:text-zinc-400">
                Seus dados de cartão ficam totalmente no ambiente Asaas. O PratoBy não armazena dados confidenciais de faturamento.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm transition-colors sm:p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
              <FiCalendar size={16} />
            </span>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-gray-900 dark:text-white">14 Dias Grátis Garantidos</h4>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-600 dark:text-zinc-400">
                O período de teste é livre. Cadastre seus dados e aproveite a plataforma. Nenhuma cobrança é gerada hoje.
              </p>
            </div>
          </div>
        </section>

        {/* HISTORICO & TIMELINE COMPACTO */}
        <section className="hidden bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 p-5 shadow-sm transition-colors md:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
              <FiZap />
            </span>
            <div>
              <h2 className="text-sm font-black text-gray-950 dark:text-white">Linha do tempo da assinatura</h2>
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Acompanhe seu fluxo de faturamento até a primeira cobrança real.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {timelineSteps.map((step) => (
              <TimelineStep key={step.title} {...step} />
            ))}
          </div>
        </section>
        {/* INICIA SECAO DE PLANOS */}



      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Planos do PratoBy</h2>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">
              Escolha o plano perfeito para o momento do seu negócio. Mude quando quiser.
            </p>
          </div>

          <div className="flex shrink-0">
            <AnimatedSegmentedControl
              options={[
                { label: 'Mensal', value: 'monthly' },
                { label: 'Anual', value: 'annual' }
              ]}
              value={selectedPlanCycle}
              onChange={(newCycle) => setSelectedPlanCycle(newCycle)}
              size="sm"
              variant="primary"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_OPTIONS.map((option) => {
            const presentation = getBillingPlanPresentation(option.id)
            const isCurrent = plan === option.id
            const price = selectedPlanCycle === 'annual' ? option.equivalentMonthly : option.priceMonthly
            const suffix = '/mês'
            const buttonLabel = isCurrent ? 'Plano atual' : presentation.cta

            return (
              <article
                key={option.id}
                className={`relative flex min-w-0 flex-col rounded-[1.5rem] border bg-white dark:bg-zinc-900 p-5 pt-12 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6 sm:pt-12 ${
                  option.id === 'professional'
                    ? 'border-[#f97316] ring-4 ring-[#f97316]/5 dark:ring-[#f97316]/10 shadow-orange-100/30'
                    : 'border-gray-100 dark:border-zinc-800 hover:border-orange-200 dark:hover:border-orange-900/40'
                }`}
              >
                {isCurrent && (
                  <div className="absolute left-5 top-5 rounded-full bg-orange-50 dark:bg-orange-950/20 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100 dark:ring-orange-900/30">
                    Atual
                  </div>
                )}
                {presentation.badge && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#111827] text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-md">
                    {presentation.badge}
                  </div>
                )}

                <div className="mt-3">
                  <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                    {presentation.name}
                  </h3>
                  <p className="mt-1.5 text-xs font-semibold text-gray-500 dark:text-zinc-400 leading-normal">
                    {presentation.bestFor}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="flex items-end gap-1">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={price}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="text-4xl font-black tracking-tight text-gray-900 dark:text-white inline-block"
                      >
                        {formatCurrency(price)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="pb-1 text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                      {suffix}
                    </span>
                  </div>
                  <AnimatePresence>
                    {selectedPlanCycle === 'annual' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1.5"
                      >
                        <span className="inline-flex rounded-full bg-green-50 dark:bg-green-950/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700 dark:text-green-400 ring-1 ring-green-100/50">
                          Economia de 2 meses grátis
                        </span>
                        <p className="mt-1 text-[10px] font-semibold text-[#6b7280] dark:text-zinc-500">
                          {formatCurrency(option.priceAnnual)} cobrados ao ano
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <ul className="mt-6 flex-1 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-5">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-xs font-bold leading-relaxed text-gray-700 dark:text-zinc-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
                        <FiCheck size={11} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={submitting || (isCurrent && hasAsaasBillingSetup)}
                  onClick={() => openBillingModal(option.id, selectedPlanCycle)}
                  className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isCurrent
                      ? 'border border-orange-200 bg-orange-50 dark:bg-orange-950/20 text-[#f97316] dark:border-orange-900/40'
                    : option.id === 'professional'
                      ? 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-md'
                      : 'border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 hover:border-[#f97316] dark:hover:border-[#f97316]'
                  }`}
                >
                  {submitting ? <FiLoader className="animate-spin" size={12} /> : <FiArrowRight size={12} />}
                  {buttonLabel}
                </button>
              </article>
            )
          })}
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 dark:border-orange-500/20 dark:bg-orange-500/10 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-black text-gray-900 dark:text-white">Quer ver todos os recursos lado a lado?</p>
            <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-zinc-400">
              Abra a lista de comparação completa para decidir entre Essencial, Professional e Premium.
            </p>
          </div>
          <Link
            to="/planos#comparacao"
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-4 text-xs font-black text-white shadow-md shadow-orange-600/10 transition hover:bg-[#ea580c] active:scale-95 sm:mt-0 sm:w-auto"
          >
            Lista de comparação completa
            <FiArrowRight size={13} />
          </Link>
        </div>


        {/* HUMAN FAQ */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 p-6 lg:p-8 shadow-sm transition-colors mt-8">
          <div className="max-w-xl mb-6">
            <h3 className="text-lg font-black text-gray-950 dark:text-white">Dúvidas Frequentes</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 font-semibold">Respostas diretas e transparentes sobre nosso faturamento.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 text-xs font-semibold leading-relaxed">
            <div className="space-y-1.5">
              <h4 className="font-black text-gray-900 dark:text-white">Vou ser cobrado ao configurar faturamento hoje?</h4>
              <p className="text-gray-500 dark:text-zinc-400">
                <strong>Não.</strong> A configuração garante a integridade da conta, mas a cobrança real do seu plano só ocorrerá ao fim dos 14 dias de testes grátis.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-black text-gray-900 dark:text-white">Qual plano escolher: Professional ou Premium?</h4>
              <p className="text-gray-500 dark:text-zinc-400">
                O plano <strong>Professional</strong> atende a maioria das lojas que querem vender mais com cupons, WhatsApp e relatórios. Escolha o <strong>Premium</strong> se sua operação tem filiais, marca própria ou precisa de suporte VIP.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-black text-gray-900 dark:text-white">Como funciona o cancelamento?</h4>
              <p className="text-gray-500 dark:text-zinc-400">
                Você é livre para cancelar a qualquer momento diretamente pelo suporte, sem taxas de rescisão ou fidelidade.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-black text-gray-900 dark:text-white">Quais formas de pagamento são aceitas?</h4>
              <p className="text-gray-500 dark:text-zinc-400">
                O pagamento é processado pelo Asaas em ambiente seguro. O PratoBy não armazena cartão.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-gray-100 dark:border-zinc-800 pt-5">
        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          className="inline-flex items-center gap-2 text-xs font-black text-gray-400 transition hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <FiCode />
          <span>Detalhes técnicos da integração</span>
          {showTechnical ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showTechnical && (
          <div className="mt-4 grid gap-2 rounded-xl border border-gray-100 bg-[#fafafa] p-4 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <SummaryItem label="asaasCustomerId" value={asaasCustomerId || '-'} />
            <SummaryItem label="asaasSubscriptionId" value={asaasSubscriptionId || '-'} />
            <SummaryItem label="asaasCheckoutUrl" value={asaasCheckoutUrl ? 'Disponível' : '-'} />
            <SummaryItem label="billingProvider" value={billingProvider || '-'} />
            <SummaryItem label="lastPaymentStatus" value={lastPaymentStatus || '-'} />
            <SummaryItem label="currentPeriodEnd" value={formatBillingDate(currentPeriodEnd)} />
            <SummaryItem label="trialEndsAt" value={formatBillingDate(trialEndsAt)} />
          </div>
        )}
      </section>

      {/* Rodapé Premium de Faturamento */}
      <BillingFooter />

      {showBillingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            {/* Header */}
            <div className="shrink-0 border-b border-gray-100 bg-[#fffaf5] px-5 pb-4 pt-5 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => !submitting && setShowBillingModal(false)}
                disabled={submitting}
                className="absolute right-4 top-4 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Fechar"
              >
                <FiX size={18} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-[#f97316]">
                  <FiShield size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-[#111827] dark:text-white">Checkout seguro Asaas</h3>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                    Você não será cobrado agora. O checkout seguro do Asaas será aberto ao final.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmSubscription} className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <section className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-[#f97316]">Responsável</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        Nome / Razão social
                      </label>
                      <input
                        type="text"
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                        disabled={submitting}
                        placeholder="Nome completo ou Razão Social"
                        className={getBillingInputClass(billingErrors.name)}
                      />
                      {billingErrors.name && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.name}</p>}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        CPF ou CNPJ
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={billingCpfCnpj}
                        onChange={(e) => setBillingCpfCnpj(e.target.value)}
                        disabled={submitting}
                        placeholder="Apenas números"
                        className={getBillingInputClass(billingErrors.cpfCnpj)}
                      />
                      {billingErrors.cpfCnpj && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.cpfCnpj}</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-[#f97316]">Contato</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        E-mail de cobrança
                      </label>
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        disabled={submitting}
                        placeholder="financeiro@sualoja.com"
                        className={getBillingInputClass(billingErrors.email)}
                      />
                      {billingErrors.email && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.email}</p>}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        WhatsApp / Celular
                      </label>
                      <input
                        type="text"
                        inputMode="tel"
                        value={billingPhone}
                        onChange={(e) => setBillingPhone(formatPhoneBR(e.target.value))}
                        disabled={submitting}
                        placeholder="(00) 00000-0000"
                        className={getBillingInputClass(billingErrors.phone)}
                      />
                      {billingErrors.phone && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.phone}</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-[#f97316]">Endereço de cobrança</p>
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[0.9fr_2fr_0.8fr]">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          CEP
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={billingPostalCode}
                          onChange={(e) => setBillingPostalCode(formatCep(e.target.value))}
                          disabled={submitting}
                          placeholder="00000-000"
                          maxLength={9}
                          className={getBillingInputClass(billingErrors.postalCode)}
                        />
                        {billingErrors.postalCode && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.postalCode}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          Endereço
                        </label>
                        <input
                          type="text"
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          disabled={submitting}
                          placeholder="Rua, Av., Travessa..."
                          className={getBillingInputClass(billingErrors.address)}
                        />
                        {billingErrors.address && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.address}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          Número
                        </label>
                        <input
                          type="text"
                          value={billingAddressNumber}
                          onChange={(e) => setBillingAddressNumber(e.target.value)}
                          disabled={submitting}
                          placeholder="Ex: 100"
                          className={getBillingInputClass(billingErrors.addressNumber)}
                        />
                        {billingErrors.addressNumber && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.addressNumber}</p>}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          Bairro
                        </label>
                        <input
                          type="text"
                          value={billingProvince}
                          onChange={(e) => setBillingProvince(e.target.value)}
                          disabled={submitting}
                          placeholder="Nome do bairro"
                          className={getBillingInputClass(billingErrors.province)}
                        />
                        {billingErrors.province && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{billingErrors.province}</p>}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                          Complemento <span className="font-semibold normal-case text-gray-300 dark:text-zinc-600">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={billingComplement}
                          onChange={(e) => setBillingComplement(e.target.value)}
                          disabled={submitting}
                          placeholder="Apto, Bloco, Sala..."
                          className={getBillingInputClass(false)}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {submitting && (
                <div className="mx-5 mb-4 rounded-xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold leading-relaxed text-[#9a3412] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                  Estamos preparando o checkout seguro do Asaas. Mantenha esta janela aberta até o redirecionamento.
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 pb-5 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setShowBillingModal(false)}
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? <FiLoader className="animate-spin" /> : <FiCreditCard />}
                  {submitting ? 'Processando...' : 'Ir para checkout seguro do Asaas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
          <div className="flex gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : toast.type === 'info'
                  ? 'bg-orange-50 text-[#f97316] dark:bg-orange-950/30'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
              }`}
            >
              {toast.type === 'success' ? <FiCheck /> : toast.type === 'info' ? <FiInfo /> : <FiAlertTriangle />}
            </div>
            <div>
              <p className="text-sm font-black text-[#111827] dark:text-white">
                {toast.type === 'success' ? 'Sucesso' : toast.type === 'info' ? 'Status' : 'Atenção'}
              </p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  )
}
