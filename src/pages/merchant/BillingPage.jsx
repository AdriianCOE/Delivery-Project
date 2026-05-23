import React, { useEffect, useMemo, useState } from 'react'
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
  return status === 'pending_checkout' ? 'checkout_pending' : status || 'checkout_pending'
}

function normalizeCycleId(cycle) {
  if (cycle === 'annual' || cycle === 'yearly' || cycle === 'year' || cycle === 'anual') return 'annual'
  return 'monthly'
}

function getStatusCopy(status) {
  const map = {
    checkout_pending: 'Checkout pendente',
    trialing: 'Teste gratis ativo',
    active: 'Assinatura ativa',
    past_due: 'Pagamento pendente',
    blocked: 'Assinatura bloqueada',
    canceled: 'Assinatura cancelada',
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
      label: 'Ativar 14 dias gratis',
      support: 'A cobranca comeca somente apos o periodo de teste.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'trialing' && !hasAsaasSubscription) {
    return {
      label: 'Configurar cobranca Asaas',
      support: 'Voce nao sera cobrado agora. A primeira cobranca sera apenas no fim do teste.',
      needsBillingData: true,
      tone: 'orange',
    }
  }

  if (status === 'past_due') {
    return {
      label: 'Regularizar pagamento',
      support: hasAsaasSubscription
        ? 'Confira os dados da assinatura Asaas para regularizar a pendencia.'
        : 'Configure a cobranca para regularizar a assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  if (status === 'blocked' || status === 'canceled') {
    return {
      label: 'Reativar assinatura',
      support: hasAsaasSubscription
        ? 'Confira a assinatura Asaas e regularize a situacao para reativar a loja.'
        : 'Informe os dados de faturamento para reativar sua assinatura.',
      needsBillingData: !hasAsaasSubscription,
      tone: 'red',
    }
  }

  return {
    label: 'Ver detalhes da assinatura',
    support: 'Cobranca Asaas configurada para este plano.',
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
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
            done
              ? 'bg-emerald-500 text-white'
              : active
              ? 'bg-[#f97316] text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {done ? <FiCheck size={15} /> : active ? <FiClock size={15} /> : <FiCalendar size={15} />}
        </span>
        <span className="mt-2 h-full w-px bg-gray-100 md:ml-3 md:mt-0 md:h-px md:flex-1" />
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
  const { user, userData, storeId, storeIds = [] } = useAuth()
  const [store, setStore] = useState(null)
  const [loadingStore, setLoadingStore] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showTechnical, setShowTechnical] = useState(false)
  const [selectedPlanCycle, setSelectedPlanCycle] = useState('monthly')

  const [showBillingModal, setShowBillingModal] = useState(false)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [pendingCycle, setPendingCycle] = useState(null)
  const [billingName, setBillingName] = useState('')
  const [billingCpfCnpj, setBillingCpfCnpj] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
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
  }, [user, storeId, storeIds, userData])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!store) return
    setBillingName(store.name || store.storeName || user?.displayName || userData?.name || '')
    setBillingEmail(store.ownerEmail || user?.email || userData?.email || '')
    setBillingPhone(store.whatsapp || store.whatsapp1 || store.phone || user?.phoneNumber || '')
    setBillingCpfCnpj(store.cnpj || store.cpf || '')
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
  const hasAsaasSubscription = Boolean(asaasSubscriptionId)

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
  const isTrialNoAsaas = isTrial && !hasAsaasSubscription
  const trialIsFuture = Boolean(trialEndsDate && trialEndsDate.getTime() > Date.now())

  const nextBillingInfo = useMemo(() => {
    if (!hasAsaasSubscription) {
      return {
        label: 'Cobranca Asaas',
        value: 'Pendente de configuracao',
        helper: 'Configure a cobranca para manter sua loja ativa apos o teste.',
      }
    }

    if (isTrial && trialIsFuture) {
      return {
        label: 'Primeira cobranca prevista',
        value: formatBillingDate(trialEndsAt),
        helper: 'A cobranca comeca somente apos o periodo de teste.',
      }
    }

    if (isActive && currentPeriodEndDate) {
      return {
        label: 'Proxima cobranca',
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
      label: 'Proxima cobranca',
      value: formatBillingDate(currentPeriodEnd || trialEndsAt),
      helper: 'Dados atualizados pelo webhook do Asaas.',
    }
  }, [
    currentPeriodEnd,
    currentPeriodEndDate,
    hasAsaasSubscription,
    isActive,
    isPastDue,
    isTrial,
    trialEndsAt,
    trialIsFuture,
  ])

  const primaryAction = useMemo(
    () => getPrimaryAction({ status: subscriptionStatus, hasAsaasSubscription }),
    [subscriptionStatus, hasAsaasSubscription]
  )

  const whatNowItems = useMemo(() => {
    if (isTrialNoAsaas) {
      return [
        'Seu teste gratis esta ativo.',
        'Voce ainda precisa configurar a cobranca Asaas.',
        'A primeira cobranca so acontece apos o fim do teste.',
        'Se nao configurar, a loja podera ser bloqueada ao final do periodo.',
      ]
    }

    if (isActive) {
      return [
        'Sua assinatura esta ativa.',
        'Voce continuara sem taxas por pedido.',
        `A proxima cobranca acontecera em ${formatBillingDate(currentPeriodEnd)}.`,
      ]
    }

    if (isPastDue || isBlocked || isCanceled) {
      return [
        'Regularize para manter a loja ativa.',
        'Seu painel continuara acessivel para resolver a pendencia.',
        'Novas liberacoes dependem da confirmacao pelo Asaas.',
      ]
    }

    return [
      'Escolha um plano e ative os 14 dias gratis.',
      'Voce nao sera cobrado agora durante o teste.',
      'A cobranca comeca somente apos o periodo de teste.',
    ]
  }, [currentPeriodEnd, isActive, isBlocked, isCanceled, isPastDue, isTrialNoAsaas])

  const timelineSteps = useMemo(() => {
    const trialDescription = trialEndsAt
      ? `Ativo ate ${formatBillingDate(trialEndsAt)}`
      : '14 dias gratis apos ativacao'
    const chargeDate = trialEndsAt || currentPeriodEnd

    return [
      {
        title: 'Conta criada',
        description: 'Cadastro do lojista concluido',
        meta: store?.createdAt ? formatBillingDate(store.createdAt) : 'Concluido',
        done: true,
      },
      {
        title: 'Teste gratis',
        description: isPending ? 'Aguardando ativacao' : trialDescription,
        meta: isTrial ? 'Etapa atual' : null,
        done: !isPending && !isTrial,
        active: isTrial || isPending,
      },
      {
        title: 'Primeira cobranca',
        description: hasAsaasSubscription ? 'Cobranca Asaas configurada' : 'Cobranca Asaas pendente',
        meta: chargeDate ? `Prevista para ${formatBillingDate(chargeDate)}` : 'Configure a cobranca Asaas',
        done: hasAsaasSubscription && isActive,
        active: !hasAsaasSubscription || isPastDue,
      },
    ]
  }, [currentPeriodEnd, hasAsaasSubscription, isActive, isPastDue, isPending, isTrial, store?.createdAt, trialEndsAt])

  function openBillingModal(targetPlan, targetCycle) {
    if (!store?.id) {
      setToast({ type: 'error', message: 'Nenhuma loja selecionada para faturamento.' })
      return
    }

    setPendingPlan(targetPlan)
    setPendingCycle(normalizeCycleId(targetCycle))

    if (!billingName) setBillingName(store.name || store.storeName || user?.displayName || userData?.name || '')
    if (!billingEmail) setBillingEmail(store.ownerEmail || user?.email || userData?.email || '')
    if (!billingPhone) setBillingPhone(store.whatsapp || store.whatsapp1 || store.phone || user?.phoneNumber || '')
    if (!billingCpfCnpj) setBillingCpfCnpj(store.cnpj || store.cpf || '')

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
      message: 'Detalhes da assinatura exibidos na secao tecnica abaixo.',
    })
  }

  function validateBillingForm() {
    const errors = {}
    if (!billingName.trim()) errors.name = 'Nome ou Razao Social e obrigatorio'

    const cleanCpfCnpj = billingCpfCnpj.replace(/\D/g, '')
    if (!billingCpfCnpj.trim()) {
      errors.cpfCnpj = 'CPF ou CNPJ e obrigatorio'
    } else if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      errors.cpfCnpj = 'CPF deve ter 11 digitos e CNPJ deve ter 14 digitos'
    }

    if (!billingEmail.trim()) {
      errors.email = 'E-mail e obrigatorio'
    } else if (!/\S+@\S+\.\S+/.test(billingEmail)) {
      errors.email = 'E-mail invalido'
    }

    if (!billingPhone.trim()) errors.phone = 'WhatsApp ou celular e obrigatorio'

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
        },
      })

      if (response?.data?.invoiceUrl) {
        window.open(response.data.invoiceUrl, '_blank')
      }

      setToast({
        type: 'success',
        message: 'Cobranca Asaas configurada. O status sera atualizado pelos webhooks de pagamento.',
      })
      setShowBillingModal(false)
      setPendingPlan(null)
      setPendingCycle(null)
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
        description="Acompanhe teste gratis, plano atual, cobranca Asaas e proximas datas da sua loja."
      />

      <section className={`mt-6 overflow-hidden rounded-lg border p-5 shadow-sm sm:p-6 ${getHeroTone(subscriptionStatus, hasAsaasSubscription)}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionStatusBadge status={subscriptionStatus} />
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${
                  hasAsaasSubscription
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                    : 'bg-orange-50 text-[#f97316] ring-orange-600/10'
                }`}
              >
                {hasAsaasSubscription ? 'Cobranca Asaas configurada' : 'Cobranca Asaas pendente'}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-[#111827] sm:text-3xl">
              {getStatusCopy(subscriptionStatus)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#4b5563]">
              {hasAsaasSubscription
                ? 'Sua assinatura esta conectada ao Asaas. As liberacoes financeiras continuam dependendo dos webhooks de cobranca e pagamento.'
                : 'Configure a cobranca Asaas para manter sua loja ativa apos o teste. Voce nao sera cobrado agora durante o periodo gratis.'}
            </p>

            {isTrial && trialEndsAt && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-black text-[#111827] ring-1 ring-orange-100">
                <FiCalendar className="shrink-0 text-[#f97316]" />
                <span className="truncate">
                  {trialDaysLeft !== null ? `Termina em ${trialDaysLeft} dias` : 'Teste gratis ativo'} · Fim do teste gratis: {formatBillingDate(trialEndsAt)}
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
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Plano" value={formatPlanName(plan)} helper={hasAsaasSubscription ? 'Plano atual' : 'Plano selecionado'} />
          <SummaryItem label="Ciclo" value={normalizeBillingCycle(billingCycle)} helper="Sem taxas por pedido" />
          <SummaryItem label="Fim do teste gratis" value={formatBillingDate(trialEndsAt)} helper={isTrial ? 'Periodo de 14 dias gratis' : 'Data de referencia'} />
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
              <p className="text-xs font-semibold text-[#6b7280]">Da criacao da conta ate a primeira cobranca.</p>
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
              O plano atual nao altera o status financeiro. A liberacao continua vindo do backend e dos webhooks Asaas.
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
            const suffix = selectedPlanCycle === 'annual' ? '/ano' : '/mes'
            const currentBadge = isTrialNoAsaas
              ? 'Plano selecionado'
              : hasAsaasSubscription || isActive
              ? 'Plano atual'
              : 'Selecionado'
            const buttonLabel = isCurrent
              ? isTrialNoAsaas
                ? 'Atual no teste'
                : hasAsaasSubscription || isActive
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
                  disabled={submitting || (isCurrent && hasAsaasSubscription)}
                  onClick={() => openBillingModal(option.id, selectedPlanCycle)}
                  className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] px-5 text-xs font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                    isCurrent
                      ? 'border border-orange-200 bg-orange-50 text-[#f97316]'
                      : option.popular
                      ? 'bg-[#f97316] text-white shadow-xl shadow-orange-600/25 hover:bg-[#ea580c]'
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
          <span>Detalhes tecnicos da integracao</span>
          {showTechnical ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showTechnical && (
          <div className="mt-4 grid gap-2 rounded-lg border border-gray-100 bg-[#fafafa] p-4 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryItem label="asaasCustomerId" value={asaasCustomerId || '-'} />
            <SummaryItem label="asaasSubscriptionId" value={asaasSubscriptionId || '-'} />
            <SummaryItem label="billingProvider" value={billingProvider || '-'} />
            <SummaryItem label="lastPaymentStatus" value={lastPaymentStatus || '-'} />
            <SummaryItem label="currentPeriodEnd" value={formatBillingDate(currentPeriodEnd)} />
            <SummaryItem label="trialEndsAt" value={formatBillingDate(trialEndsAt)} />
          </div>
        )}
      </section>

      {showBillingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-2xl">
            <div className="border-b border-gray-100 p-5">
              <button
                type="button"
                onClick={() => !submitting && setShowBillingModal(false)}
                disabled={submitting}
                className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Fechar"
              >
                <FiX size={18} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
                  <FiShield />
                </span>
                <div>
                  <h3 className="text-lg font-black text-[#111827]">Dados para ativar a cobranca</h3>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6b7280]">
                    Essas informacoes serao usadas para criar sua assinatura no Asaas. Voce nao sera cobrado agora durante o teste gratis.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmSubscription} className="overflow-y-auto p-5">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Nome / Razao social
                  </label>
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    disabled={submitting}
                    placeholder="Nome completo ou Razao Social"
                    className={`h-11 w-full rounded-lg border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.name ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus:border-orange-300'
                    }`}
                  />
                  {billingErrors.name && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={billingCpfCnpj}
                    onChange={(e) => setBillingCpfCnpj(e.target.value)}
                    disabled={submitting}
                    placeholder="Apenas numeros"
                    className={`h-11 w-full rounded-lg border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.cpfCnpj ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus:border-orange-300'
                    }`}
                  />
                  {billingErrors.cpfCnpj && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.cpfCnpj}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    E-mail de cobranca
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="financeiro@sualoja.com"
                    className={`h-11 w-full rounded-lg border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.email ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus:border-orange-300'
                    }`}
                  />
                  {billingErrors.email && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.email}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400">
                    WhatsApp / Celular
                  </label>
                  <input
                    type="text"
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    disabled={submitting}
                    placeholder="(00) 00000-0000"
                    className={`h-11 w-full rounded-lg border px-3 text-sm font-semibold text-[#111827] outline-none transition disabled:bg-gray-50 ${
                      billingErrors.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus:border-orange-300'
                    }`}
                  />
                  {billingErrors.phone && <p className="mt-1 text-xs font-bold text-red-600">{billingErrors.phone}</p>}
                </div>
              </div>

              {submitting && (
                <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3 text-xs font-bold leading-relaxed text-[#9a3412]">
                  Estamos criando sua assinatura no Asaas. Mantenha esta janela aberta ate a conclusao.
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setShowBillingModal(false)}
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-5 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? <FiLoader className="animate-spin" /> : <FiCreditCard />}
                  {submitting ? 'Processando...' : 'Ativar cobranca Asaas'}
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
                {toast.type === 'success' ? 'Sucesso' : toast.type === 'info' ? 'Status' : 'Atencao'}
              </p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b7280]">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
