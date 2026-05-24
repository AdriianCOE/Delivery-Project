import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import SubscriptionStatusBadge from '../../components/billing/SubscriptionStatusBadge'
import {
  formatBillingDate,
  formatPlanName,
  getTrialDaysRemaining,
  normalizeBillingCycle,
  toDate,
} from '../../utils/billingStatus'
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCode,
  FiCreditCard,
  FiInfo,
  FiLoader,
  FiSettings,
  FiShield,
  FiX,
  FiZap,
  FiStar,
  FiAward,
} from 'react-icons/fi'

const PLAN_OPTIONS = [
  {
    id: 'essential',
    name: 'Essencial',
    description: 'Para começar a vender online',
    priceMonthly: 59,
    priceAnnual: 590,
    icon: FiZap,
    features: [
      '14 dias grátis inclusos',
      'Cardápio digital ilimitado',
      'Pedidos em tempo real',
      'Link próprio da loja',
      'Sem taxas por pedido',
      'Painel de controle',
      'Horários automáticos',
    ],
  },
  {
    id: 'professional',
    name: 'Profissional',
    description: 'Mais escolhido pelos lojistas',
    priceMonthly: 89,
    priceAnnual: 890,
    popular: true,
    icon: FiStar,
    features: [
      '14 dias grátis inclusos',
      'Tudo do Essencial',
      'Cupons de desconto',
      'Taxa por bairro',
      'Campos personalizados',
      'Relatórios avançados',
      'WhatsApp integrado',
      'Suporte prioritário',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Para quem quer vender mais',
    priceMonthly: 159,
    priceAnnual: 1590,
    icon: FiAward,
    features: [
      '14 dias grátis inclusos',
      'Tudo do Profissional',
      'Multi-loja até 3 unidades',
      'API de integração',
      'Domínio personalizado',
      'Marca branca',
      'Gerente de conta dedicado',
    ],
  },
]

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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

function getStatusCopy(status) {
  const map = {
    checkout_pending: 'Cadastre a forma de pagamento para ativar o teste grátis',
    pending_checkout: 'Cadastre a forma de pagamento para ativar o teste grátis',
    billing_pending: 'Cadastre a forma de pagamento para ativar o teste grátis',
    billing_pending_payment_method: 'Cadastre a forma de pagamento para ativar o teste grátis',
    trialing: 'Teste grátis ativo',
    active: 'Assinatura ativa',
    past_due: 'Pagamento pendente',
    blocked: 'Assinatura bloqueada/cancelada',
    canceled: 'Assinatura bloqueada/cancelada',
  }
  return map[status] || 'Checkout pendente'
}

function getHeroTone(status, hasAsaasSubscription) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50/60'
  if (status === 'past_due' || status === 'blocked' || status === 'canceled') return 'border-red-200 bg-red-50/70'
  if (status === 'trialing' && !hasAsaasSubscription) return 'border-orange-200 bg-orange-50/80'
  return 'border-orange-100 bg-white'
}

function getPrimaryAction({ status, hasAsaasSubscription }) {
  if (status === 'checkout_pending') {
    return {
      label: 'Cadastrar forma de pagamento',
      support: 'Você não será cobrado agora. A primeira cobrança acontece somente após os 14 dias grátis.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'trialing' && !hasAsaasSubscription) {
    return {
      label: 'Cadastrar forma de pagamento',
      support: 'Você não será cobrado agora. A primeira cobrança será apenas no fim do teste.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'past_due') {
    return {
      label: 'Regularizar pagamento',
      support: hasAsaasSubscription
        ? 'Confira os dados da assinatura Asaas para regularizar a pendência.'
        : 'Configure a cobrança para regularizar a assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  if (status === 'blocked' || status === 'canceled') {
    return {
      label: 'Reativar assinatura',
      support: hasAsaasSubscription
        ? 'Confira a assinatura Asaas e regularize a situação para reativar a loja.'
        : 'Informe os dados de faturamento para reativar sua assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  return {
    label: 'Ver detalhes da assinatura',
    support: 'Cobrança Asaas configurada para este plano.',
    needsBillingData: false,
    tone: 'neutral',
  }
}

function SummaryItem({ label, value, helper }) {
  return (
    <div className="min-w-0 border-t border-gray-100 pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
      <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-[#111827]">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{helper}</p>}
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
              ? 'bg-emerald-500 text-white'
              : active
              ? 'bg-[#f97316] text-white'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
          }`}
        >
          {done ? <FiCheck size={15} /> : active ? <FiClock size={15} /> : <FiCalendar size={15} />}
        </span>
        <span className="mt-2 h-full w-px bg-gray-100 dark:bg-zinc-800 md:ml-3 md:mt-0 md:h-px md:flex-1" />
      </div>
      <div className="min-w-0 pb-5 md:mt-3 md:pb-0">
        <p className="text-sm font-black text-[#111827]">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{description}</p>
        {meta && <p className="mt-2 text-xs font-black text-[#f97316]">{meta}</p>}
      </div>
    </div>
  )
}

function InfoList({ title, items, tone = 'orange' }) {
  const toneClass = tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-[#f97316]'

  return (
    <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          {tone === 'red' ? <FiAlertTriangle /> : <FiInfo />}
        </span>
        <h2 className="text-base font-black text-[#111827]">{title}</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-semibold leading-relaxed text-[#4b5563]">
            <FiCheck className="mt-1 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function BillingPage() {
  const auth = useAuth()
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
  const [storeRefreshNonce, setStoreRefreshNonce] = useState(0)

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

    if (uid) {
      subscribeToQuery(query(collection(db, 'stores'), where('ownerId', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('ownerUid', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('owner.uid', '==', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('allowedUserIds', 'array-contains', uid)))
      subscribeToQuery(query(collection(db, 'stores'), where('merchantUids', 'array-contains', uid)))
    }

    const knownStoreIds = Array.from(new Set([
      storeId,
      ...(Array.isArray(storeIds) ? storeIds : []),
      userData?.storeId,
      ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
      user?.storeId,
      ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
    ].filter(Boolean)))

    knownStoreIds.forEach(subscribeToStoreDoc)

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
    setBillingPhone(store.whatsapp || store.whatsapp1 || store.phone || userData?.phone || user?.phoneNumber || '')
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
  const billingMethodConfigured = Boolean(store?.billingMethodConfigured || userData?.billingMethodConfigured)
  const hasAsaasSubscription = Boolean(asaasSubscriptionId)
  const hasAsaasBillingSetup = hasAsaasSubscription || billingMethodConfigured
  const checkoutUrlToOpen = lastCheckoutUrl || asaasCheckoutUrl
  const showCheckoutSuccessBanner =
    searchParams.get('asaasCheckout') === 'success' && !hasAsaasBillingSetup

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
  const isTrialNoAsaas = isTrial && !hasAsaasBillingSetup
  const trialIsFuture = Boolean(trialEndsDate && trialEndsDate.getTime() > Date.now())

  const nextBillingInfo = useMemo(() => {
    if (!hasAsaasBillingSetup) {
      return {
        label: 'Cobrança Asaas',
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
      helper: 'Dados atualizados pelo webhook do Asaas.',
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

  const whatNowItems = useMemo(() => {
    if (isTrialNoAsaas) {
      return [
        'Seu teste grátis está ativo.',
        'Você ainda precisa configurar a cobrança Asaas.',
        'A primeira cobrança só acontece após o fim do teste.',
        'Se não configurar, a loja poderá ser bloqueada ao final do período.',
      ]
    }

    if (isActive) {
      return [
        'Sua assinatura está ativa.',
        'Você continuará sem taxas por pedido.',
        `A próxima cobrança acontecerá em ${formatBillingDate(currentPeriodEnd)}.`,
      ]
    }

    if (isPastDue || isBlocked || isCanceled) {
      return [
        'Regularize para manter a loja ativa.',
        'Seu painel continuará acessível para resolver a pendência.',
        'Novas liberações dependem da confirmação pelo Asaas.',
      ]
    }

    return [
      'Configure a cobrança para ativar seu teste.',
      'Você pode cancelar a qualquer momento.',
      'A primeira cobrança acontece somente após o período de teste.',
    ]
  }, [currentPeriodEnd, isActive, isBlocked, isCanceled, isPastDue, isTrialNoAsaas])

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
        meta: chargeDate ? `Prevista para ${formatBillingDate(chargeDate)}` : 'Configure a cobrança Asaas',
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
    if (!billingPhone) setBillingPhone(store.whatsapp || store.whatsapp1 || store.phone || userData?.phone || user?.phoneNumber || '')
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

    setShowTechnical(true)
    setToast({
      type: 'info',
      message: 'Detalhes da assinatura exibidos na seção técnica abaixo.',
    })
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
        setLastCheckoutUrl(checkoutUrl)
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
        setToast({
          type: 'info',
          message: 'Redirecionando para o Asaas. Depois de cadastrar a forma de pagamento, volte para esta página.',
        })
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
        message: error.message || 'Nao foi possivel configurar a cobranca Asaas.',
      })
    } finally {
      setSubmitting(false)
    }
  }

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
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
            <FiAlertTriangle size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#111827]">Nenhuma loja ativa</h3>
          <p className="mt-2 text-sm text-[#6b7280]">
            Nao encontramos nenhuma loja cadastrada sob sua titularidade para gerenciar assinatura.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">
      <DashboardPageHeader
        title="Faturamento"
        description="Acompanhe teste grátis, plano atual, cobrança Asaas e próximas datas da sua loja."
      />

      {showCheckoutSuccessBanner && (
        <section className="mt-6 rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm font-bold leading-relaxed text-[#9a3412] shadow-sm">
          <div className="flex items-start gap-3">
            <FiClock className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black text-[#111827]">Estamos confirmando sua forma de pagamento.</p>
              <p className="mt-1 text-xs font-semibold text-[#9a3412]">
                Isso pode levar alguns segundos. A liberação do teste grátis acontece somente após confirmação do webhook do Asaas.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className={`mt-6 overflow-hidden rounded-lg border p-5 shadow-sm sm:p-6 ${getHeroTone(subscriptionStatus, hasAsaasBillingSetup)}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionStatusBadge status={subscriptionStatus} />
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${
                  hasAsaasBillingSetup
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                    : 'bg-orange-50 text-[#f97316] ring-orange-600/10'
                }`}
              >
                {hasAsaasBillingSetup ? 'Forma de pagamento cadastrada' : 'Forma de pagamento pendente'}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-[#111827] sm:text-3xl">
              {getStatusCopy(subscriptionStatus)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#4b5563]">
              {hasAsaasBillingSetup
                ? 'Sua forma de pagamento está conectada ao Asaas. As liberações financeiras continuam dependendo dos webhooks de cobrança e pagamento.'
                : isPending
                ? 'Você não será cobrado agora. A primeira cobrança acontece somente após os 14 dias grátis. Você pode cancelar a qualquer momento sem cobrança.'
                : isTrialNoAsaas
                ? 'Forma de pagamento Asaas pendente'
                : 'Cadastre a forma de pagamento no Asaas para manter sua loja ativa após o teste. Você não será cobrado agora durante o período grátis.'}
            </p>

            {isTrial && trialEndsAt && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-black text-[#111827] ring-1 ring-orange-100">
                <FiCalendar className="shrink-0 text-[#f97316]" />
                <span className="truncate">
                  {trialDaysLeft !== null ? `Termina em ${trialDaysLeft} dias` : 'Teste grátis ativo'} · Fim do teste grátis: {formatBillingDate(trialEndsAt)}
                </span>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 lg:w-72">
            <button
              type="button"
              disabled={submitting}
              onClick={handlePrimaryAction}
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                primaryAction.tone === 'red'
                  ? 'bg-red-600 hover:bg-red-700'
                  : primaryAction.tone === 'neutral'
                  ? 'bg-[#111827] hover:bg-black'
                  : 'bg-[#f97316] hover:bg-[#ea580c]'
              }`}
            >
              {submitting ? <FiLoader className="animate-spin" /> : primaryAction.needsBillingData ? <FiCreditCard /> : <FiSettings />}
              {primaryAction.label}
            </button>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{primaryAction.support}</p>
            {checkoutUrlToOpen && !hasAsaasBillingSetup && (
              <button
                type="button"
                onClick={() => window.open(checkoutUrlToOpen, '_blank', 'noopener,noreferrer')}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-4 text-xs font-black text-[#f97316] transition hover:bg-orange-50"
              >
                <FiArrowRight />
                Abrir página de pagamento novamente
              </button>
            )}
            {!hasAsaasBillingSetup && (
              <button
                type="button"
                onClick={handleRefreshBillingStatus}
                disabled={isCheckingBillingStatus}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-xs font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingBillingStatus ? <FiLoader className="animate-spin" /> : <FiClock />}
                {isCheckingBillingStatus ? 'Verificando...' : 'Verificar status da assinatura'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Plano" value={formatPlanName(plan)} helper={hasAsaasBillingSetup ? 'Plano atual' : 'Plano selecionado'} />
          <SummaryItem label="Ciclo" value={normalizeBillingCycle(billingCycle)} helper="Sem taxas por pedido" />
          <SummaryItem label="Fim do teste grátis" value={formatBillingDate(trialEndsAt)} helper={isTrial ? 'Período de 14 dias grátis' : 'Data de referência'} />
          <SummaryItem label={nextBillingInfo.label} value={nextBillingInfo.value} helper={nextBillingInfo.helper} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
              <FiZap />
            </span>
            <div>
              <h2 className="text-base font-black text-[#111827]">Linha do tempo</h2>
              <p className="text-xs font-semibold text-[#6b7280]">Da criação da conta até a primeira cobrança.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-0 md:grid-cols-3 md:gap-4">
            {timelineSteps.map((step) => (
              <TimelineStep key={step.title} {...step} />
            ))}
          </div>
        </section>

        <InfoList
          title="O que acontece agora?"
          items={whatNowItems}
          tone={isPastDue || isBlocked || isCanceled ? 'red' : 'orange'}
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#111827]">Planos do PratoBy</h2>
            <p className="mt-1 text-sm font-semibold text-[#6b7280]">
              O plano atual não altera o status financeiro. A liberação continua vindo do backend e dos webhooks Asaas.
            </p>
          </div>

          <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedPlanCycle('monthly')}
              className={`rounded-md px-4 py-2 text-xs font-black transition ${
                selectedPlanCycle === 'monthly' ? 'bg-[#f97316] text-white' : 'text-[#6b7280] hover:bg-gray-50'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlanCycle('annual')}
              className={`rounded-md px-4 py-2 text-xs font-black transition ${
                selectedPlanCycle === 'annual' ? 'bg-[#f97316] text-white' : 'text-[#6b7280] hover:bg-gray-50'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PLAN_OPTIONS.map((option) => {
            const isCurrent = plan === option.id
            const price = selectedPlanCycle === 'annual' ? option.priceAnnual : option.priceMonthly
            const suffix = selectedPlanCycle === 'annual' ? '/ano' : '/mês'
            const currentBadge = isTrialNoAsaas
              ? 'Plano selecionado'
              : hasAsaasBillingSetup || isActive
              ? 'Plano atual'
              : 'Selecionado'
            const buttonLabel = isCurrent
              ? isTrialNoAsaas
                ? 'Atual no teste'
                : hasAsaasBillingSetup || isActive
                ? 'Plano atual'
                : 'Selecionado'
              : 'Selecionar plano'

            return (
              <article
                key={option.id}
                className={`relative flex min-w-0 flex-col rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-7 ${
                  option.popular
                    ? 'border-orange-300 shadow-orange-100/70 ring-4 ring-orange-50'
                    : 'border-gray-100 hover:border-orange-100 hover:shadow-orange-100/50'
                }`}
              >
                {option.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-md">
                    Recomendado
                  </div>
                )}
                {isCurrent && !option.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                    {currentBadge}
                  </div>
                )}
                {isCurrent && option.popular && (
                  <div className="absolute right-5 top-12 rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100 shadow-sm">
                    {currentBadge}
                  </div>
                )}

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${
                    option.popular
                      ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/25'
                      : 'bg-orange-50 text-[#f97316]'
                  }`}
                >
                  <option.icon size={22} />
                </div>

                <div className="mt-5">
                  <h3 className="text-xl font-black tracking-tight text-[#111827]">
                    {option.name}
                  </h3>
                  <p className="mt-2 min-h-[38px] text-xs font-semibold leading-relaxed text-[#6b7280]">
                    {option.description}
                  </p>
                </div>

                <div className="mt-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-black tracking-tight text-[#111827]">
                      {formatCurrency(price)}
                    </span>
                    <span className="pb-1 text-xs font-bold text-[#6b7280]">
                      {suffix}
                    </span>
                  </div>
                  {selectedPlanCycle === 'annual' && (
                    <div className="mt-1">
                      <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-100/50">
                        2 meses grátis
                      </span>
                    </div>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3 border-t border-gray-100 pt-5">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-xs font-bold leading-relaxed text-[#374151]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316]">
                        <FiCheck size={12} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={submitting || (isCurrent && hasAsaasBillingSetup)}
                  onClick={() => openBillingModal(option.id, selectedPlanCycle)}
                  className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] px-5 text-xs font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                    isCurrent
                      ? 'border border-orange-200 bg-orange-50 text-[#f97316]'
                      : option.popular
                      ? 'border-2 border-orange-500/20 bg-white text-[#f97316] hover:bg-orange-50/50 hover:border-[#f97316] hover:text-[#ea580c] shadow-sm'
                      : 'border-2 border-orange-500/20 bg-white text-[#f97316] hover:bg-orange-50/50 hover:border-[#f97316] hover:text-[#ea580c] shadow-sm'
                  }`}
                >
                  {submitting ? <FiLoader className="animate-spin" /> : <FiArrowRight />}
                  {buttonLabel}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-8 border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          className="inline-flex items-center gap-2 text-xs font-black text-gray-400 transition hover:text-gray-600"
        >
          <FiCode />
          <span>Detalhes técnicos da integração</span>
          {showTechnical ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showTechnical && (
          <div className="mt-4 grid gap-2 rounded-lg border border-gray-100 bg-[#fafafa] p-4 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
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

      {showBillingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl">
            {/* Header */}
            <div className="shrink-0 border-b border-gray-100 dark:border-zinc-800 bg-[#fffaf5] dark:bg-zinc-950 px-5 pb-4 pt-5">
              <button
                type="button"
                onClick={() => !submitting && setShowBillingModal(false)}
                disabled={submitting}
                className="absolute right-4 top-4 rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Fechar"
              >
                <FiX size={18} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-[#f97316]">
                  <FiShield size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-[#111827]">Dados de faturamento</h3>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b7280]">
                    Essas informações são usadas pelo Asaas para criar sua assinatura com segurança. Você não será cobrado agora.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmSubscription} className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-0 divide-y divide-gray-50 px-5 py-4">

                {/* Name */}
                <div className="pb-4">
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Nome / Razão social
                  </label>
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    disabled={submitting}
                    placeholder="Nome completo ou Razão Social"
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.name ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                    }`}
                  />
                  {billingErrors.name && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.name}</p>}
                </div>

                {/* CPF/CNPJ */}
                <div className="py-4">
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={billingCpfCnpj}
                    onChange={(e) => setBillingCpfCnpj(e.target.value)}
                    disabled={submitting}
                    placeholder="Apenas números"
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.cpfCnpj ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                    }`}
                  />
                  {billingErrors.cpfCnpj && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.cpfCnpj}</p>}
                </div>

                {/* Email */}
                <div className="py-4">
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    E-mail de cobrança
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="financeiro@sualoja.com"
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.email ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                    }`}
                  />
                  {billingErrors.email && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.email}</p>}
                </div>

                {/* Phone */}
                <div className="py-4">
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    WhatsApp / Celular
                  </label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    disabled={submitting}
                    placeholder="(00) 00000-0000"
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.phone ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                    }`}
                  />
                  {billingErrors.phone && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.phone}</p>}
                </div>

                {/* Address section header */}
                <div className="pt-4">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-[#f97316]">
                    Endereço de cobrança
                  </p>

                  {/* CEP */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
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
                      className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                        billingErrors.postalCode ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                      }`}
                    />
                    {billingErrors.postalCode && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.postalCode}</p>}
                  </div>

                  {/* Street + Number */}
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                        Endereço
                      </label>
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        disabled={submitting}
                        placeholder="Rua, Av., Travessa..."
                        className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                          billingErrors.address ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                        }`}
                      />
                      {billingErrors.address && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.address}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                        Número
                      </label>
                      <input
                        type="text"
                        value={billingAddressNumber}
                        onChange={(e) => setBillingAddressNumber(e.target.value)}
                        disabled={submitting}
                        placeholder="Ex: 100"
                        className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                          billingErrors.addressNumber ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                        }`}
                      />
                      {billingErrors.addressNumber && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.addressNumber}</p>}
                    </div>
                  </div>

                  {/* Neighborhood */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={billingProvince}
                      onChange={(e) => setBillingProvince(e.target.value)}
                      disabled={submitting}
                      placeholder="Nome do bairro"
                      className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                        billingErrors.province ? 'border-red-300 bg-red-50/30 focus:border-red-400' : 'border-gray-200 focus:border-[#f97316]'
                      }`}
                    />
                    {billingErrors.province && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.province}</p>}
                  </div>

                  {/* Complement (optional) */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                      Complemento <span className="font-semibold normal-case text-gray-300">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={billingComplement}
                      onChange={(e) => setBillingComplement(e.target.value)}
                      disabled={submitting}
                      placeholder="Apto, Bloco, Sala..."
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#f97316] disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {submitting && (
                <div className="mx-5 mb-4 rounded-xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold leading-relaxed text-[#9a3412]">
                  Estamos preparando o checkout seguro do Asaas. Mantenha esta janela aberta até o redirecionamento.
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setShowBillingModal(false)}
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? <FiLoader className="animate-spin" /> : <FiCreditCard />}
                  {submitting ? 'Processando...' : 'Ir para o checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/40">
          <div className="flex gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : toast.type === 'info'
                  ? 'bg-orange-50 text-[#f97316]'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {toast.type === 'success' ? <FiCheck /> : toast.type === 'info' ? <FiInfo /> : <FiAlertTriangle />}
            </div>
            <div>
              <p className="text-sm font-black text-[#111827]">
                {toast.type === 'success' ? 'Sucesso' : toast.type === 'info' ? 'Status' : 'Atenção'}
              </p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b7280]">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
