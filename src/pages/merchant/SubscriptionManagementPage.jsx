import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
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
} from '../../utils/billingStatus'
import { PLAN_OPTIONS } from '../../utils/planCatalog'
import {
  FiShield,
  FiLock,
  FiClock,
  FiCheck,
  FiAlertTriangle,
  FiCalendar,
  FiArrowRight,
  FiCreditCard,
  FiInfo,
  FiLoader,
  FiSettings,
  FiTrash2,
  FiX,
  FiRefreshCw,
  FiMessageSquare,
  FiTrendingUp,
} from 'react-icons/fi'
import { motion } from 'motion/react'

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

const pageMotion = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
}

const sectionMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
}

const actionCardMotion = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
}

const BILLING_PLAN_PRESENTATION = {
  essential: {
    name: 'Essencial',
    tagline: 'Para começar simples.',
    description: 'O básico para colocar sua loja online, receber pedidos e vender pelo próprio link.',
  },
  professional: {
    name: 'Professional',
    tagline: 'Para vender mais.',
    description: 'Cupons, WhatsApp e relatórios para aumentar pedidos e acompanhar melhor a operação.',
  },
  premium: {
    name: 'Premium',
    tagline: 'Para operações maiores.',
    description: 'Mais estrutura para marcas fortes, filiais, domínio próprio e atendimento VIP.',
  },
}

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
  }
}

const SUPPORT_WHATSAPP = '5579999786984'
const DEFAULT_SUBSCRIPTION_ACTIONS = {
  canChangePlan: false,
  canCancel: false,
  canRequestDueDateChange: false,
  canUpdatePaymentMethod: false,
  canSyncStatus: false,
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function getInitialStoreId({ storeId, storeIds, userData, user }) {
  const knownStoreIds = uniqueValues([
    storeId,
    ...(Array.isArray(storeIds) ? storeIds : []),
    userData?.storeId,
    ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
    user?.storeId,
    ...(Array.isArray(user?.storeIds) ? user.storeIds : []),
  ])

  const selectedStoreId = localStorage.getItem('@PratoBy:selectedStoreId')
  if (selectedStoreId && knownStoreIds.includes(selectedStoreId)) return selectedStoreId
  return knownStoreIds[0] || ''
}

function buildStoreFromManagementData(managementData, fallbackStore, selectedStoreId) {
  const planId = managementData?.plan?.id || fallbackStore?.plan || 'essential'
  const billingCycle = managementData?.billingCycle || managementData?.plan?.billingCycle || fallbackStore?.billingCycle || 'monthly'
  const storeDocId = managementData?.storeId || fallbackStore?.id || selectedStoreId

  return {
    ...fallbackStore,
    id: storeDocId,
    storeId: storeDocId,
    storeDocId,
    name: fallbackStore?.name || fallbackStore?.storeName || userStoreName(fallbackStore) || 'Minha Loja',
    storeName: fallbackStore?.storeName || fallbackStore?.name || userStoreName(fallbackStore) || 'Minha Loja',
    subscriptionStatus: managementData?.subscriptionStatus || fallbackStore?.subscriptionStatus || 'checkout_pending',
    plan: planId,
    billingCycle,
    trialEndsAt: managementData?.trialEndsAt || fallbackStore?.trialEndsAt || null,
    currentPeriodEnd: managementData?.currentPeriodEnd || managementData?.nextChargeAt || fallbackStore?.currentPeriodEnd || null,
    billingMethodConfigured: managementData?.paymentMethod?.configured ?? Boolean(fallbackStore?.billingMethodConfigured),
    asaasSubscriptionId: managementData?.hasAsaasSubscription ? 'configured' : fallbackStore?.asaasSubscriptionId || '',
  }
}

function userStoreName(store) {
  return store?.signup?.storeName || ''
}

function getPlanDisplayName(planId) {
  return getBillingPlanPresentation(planId).name
}

function getPlanCyclePrice(option, cycle) {
  if (cycle === 'annual') return option.priceAnnual
  return option.priceMonthly
}

function getUnavailableActionMessage(actionKey) {
  const messages = {
    canChangePlan: 'Alteração de plano indisponível para o status atual da assinatura.',
    canCancel: 'Cancelamento indisponível para o status atual da assinatura.',
    canRequestDueDateChange: 'Alteração de vencimento indisponível para o status atual da assinatura.',
    canUpdatePaymentMethod: 'Atualização de pagamento indisponível para o status atual da assinatura.',
    canSyncStatus: 'Sincronização indisponível porque não há assinatura Asaas vinculada.',
  }
  return messages[actionKey] || 'Ação indisponível para o status atual da assinatura.'
}

export default function SubscriptionManagementPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { user, userData, storeId, storeIds = [] } = auth
  const [store, setStore] = useState(null)
  const [managementData, setManagementData] = useState(null)
  const [managementError, setManagementError] = useState(null)
  const [loadingStore, setLoadingStore] = useState(true)
  const [storeRefreshNonce, setStoreRefreshNonce] = useState(0)
  const selectedStoreId = useMemo(
    () => getInitialStoreId({ storeId, storeIds, userData, user }),
    [storeId, storeIds, userData, user]
  )

  // Loading States for Actions
  const [submittingSync, setSubmittingSync] = useState(false)
  const [submittingPlanChange, setSubmittingPlanChange] = useState(false)
  const [submittingCancel, setSubmittingCancel] = useState(false)
  const [submittingDueDate, setSubmittingDueDate] = useState(false)
  const [submittingPaymentMethod, setSubmittingPaymentMethod] = useState(false)

  // Modals States
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDueDateModal, setShowDueDateModal] = useState(false)
  const [showSupportFallbackModal, setShowSupportFallbackModal] = useState(false)

  // Fallback Context for WhatsApp support
  const [fallbackMessage, setFallbackMessage] = useState('')
  const [fallbackActionTitle, setFallbackActionTitle] = useState('')

  // Plan Selection States (Modal)
  const [selectedPlanCycle, setSelectedPlanCycle] = useState('monthly')
  const [pendingPlanId, setPendingPlanId] = useState('')

  // Due Date States (Modal)
  const [selectedDueDate, setSelectedDueDate] = useState(5)

  // Cancellation States (Modal)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConfirmationText, setCancelConfirmationText] = useState('')

  // Toast
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [toast])

  // Backend-first subscription data loading. Firestore is only a single-doc fallback.
  useEffect(() => {
    let active = true

    if (!selectedStoreId) {
      Promise.resolve().then(() => {
        if (!active) return
        setLoadingStore(false)
        setStore(null)
        setManagementData(null)
      })

      return () => {
        active = false
      }
    }

    async function loadSubscriptionManagementData() {
      setLoadingStore(true)
      setManagementError(null)

      try {
        const getManagementData = httpsCallable(functions, 'getSubscriptionManagementData')
        const result = await getManagementData({ storeId: selectedStoreId })
        if (!active) return

        const nextManagementData = result?.data || {}
        setManagementData(nextManagementData)
        setStore(buildStoreFromManagementData(nextManagementData, {
          ownerEmail: user?.email || userData?.email || '',
          name: userData?.signup?.storeName || userData?.storeName || 'Minha Loja',
          storeName: userData?.signup?.storeName || userData?.storeName || 'Minha Loja',
        }, selectedStoreId))
      } catch (error) {
        console.warn('[SubscriptionManagement] getSubscriptionManagementData failed. Loading single store fallback.', error)
        if (!active) return
        setManagementData(null)
        setManagementError(error)

        try {
          const storeSnapshot = await getDoc(doc(db, 'stores', selectedStoreId))
          if (!active) return

          if (storeSnapshot.exists()) {
            const storeData = storeSnapshot.data() || {}
            setStore({
              ...storeData,
              id: storeSnapshot.id,
              storeId: storeData.storeId || storeSnapshot.id,
              storeDocId: storeData.storeDocId || storeSnapshot.id,
              storeSlug: storeData.storeSlug || storeData.slug || storeSnapshot.id,
              slug: storeData.slug || storeData.storeSlug || storeSnapshot.id,
            })
          } else {
            setStore(null)
          }
        } catch (fallbackError) {
          console.error('[SubscriptionManagement] single store fallback failed:', fallbackError)
          if (active) setStore(null)
        }
      } finally {
        if (active) setLoadingStore(false)
      }
    }

    loadSubscriptionManagementData()

    return () => {
      active = false
    }
  }, [selectedStoreId, storeRefreshNonce, user?.email, userData])

  // Normalization Helpers
  const subscriptionActions = managementData?.actions || DEFAULT_SUBSCRIPTION_ACTIONS
  const subscriptionStatus = managementData?.subscriptionStatus || store?.subscriptionStatus || userData?.subscriptionStatus || 'checkout_pending'
  const currentPlan = managementData?.plan?.id || store?.plan || userData?.plan || 'essential'
  const billingCycle = managementData?.billingCycle || managementData?.plan?.billingCycle || store?.billingCycle || userData?.billingCycle || 'monthly'
  const trialEndsAt = managementData?.trialEndsAt || store?.trialEndsAt || userData?.trialEndsAt
  const currentPeriodEnd = managementData?.currentPeriodEnd || store?.currentPeriodEnd || userData?.currentPeriodEnd
  const nextChargeAt = managementData?.nextChargeAt || currentPeriodEnd || trialEndsAt
  const billingMethodConfigured = Boolean(
    managementData?.paymentMethod?.configured ?? store?.billingMethodConfigured ?? userData?.billingMethodConfigured
  )

  const trialDaysLeft = useMemo(() => getTrialDaysRemaining(trialEndsAt), [trialEndsAt])
  const isTrial = subscriptionStatus === 'trialing'
  const isActive = subscriptionStatus === 'active'
  const isPastDue = subscriptionStatus === 'past_due'
  const isPending = subscriptionStatus === 'checkout_pending'
  const currentPlanPresentation = getBillingPlanPresentation(currentPlan)
  const currentPlanOption = PLAN_OPTIONS.find((planOption) => planOption.id === currentPlan)
  const currentPlanDisplayAmount = Number.isFinite(Number(managementData?.plan?.amountCents))
    ? Number(managementData.plan.amountCents) / 100
    : getPlanCyclePrice(currentPlanOption || PLAN_OPTIONS[0], billingCycle)

  // Header Status Badge Object
  const headerBadge = useMemo(() => {
    if (isPending) return { label: 'Cobrança Pendente', color: 'orange', dot: true, pulse: true }
    if (isTrial) return { label: 'Teste Grátis', color: 'blue', dot: true }
    if (isActive) return { label: 'Assinatura Ativa', color: 'green', dot: true }
    if (isPastDue) return { label: 'Atrasada', color: 'red', dot: true, pulse: true }
    return { label: 'Bloqueada/Cancelada', color: 'red', dot: true }
  }, [isActive, isPastDue, isPending, isTrial])

  // Support WhatsApp Helper
  function triggerSupportFallback(actionTitle, actionDesc) {
    const storeName = store?.name || store?.storeName || 'Minha Loja'
    const fullText = `Olá Suporte PratoBy! Gostaria de solicitar suporte para a seguinte ação na minha assinatura da loja "${storeName}":\n\nAção: *${actionTitle}*\nDetalhes: ${actionDesc}\n\nEmail da conta: ${store?.ownerEmail || user?.email || 'Sem e-mail'}`
    setFallbackActionTitle(actionTitle)
    setFallbackMessage(fullText)
    setShowSupportFallbackModal(true)
  }

  // 1. Action: Sync Status
  async function handleSyncStatus() {
    if (submittingSync) return
    if (!subscriptionActions.canSyncStatus) {
      setToast({ type: 'info', message: getUnavailableActionMessage('canSyncStatus') })
      return
    }

    setSubmittingSync(true)
    try {
      const syncStatusFn = httpsCallable(functions, 'syncAsaasSubscriptionStatus')
      const result = await syncStatusFn({ storeId: store?.id || selectedStoreId })
      
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      setStoreRefreshNonce((v) => v + 1)
      
      setToast({
        type: 'success',
        message: result?.data?.message || 'Status da assinatura sincronizado com o Asaas!',
      })
    } catch (error) {
      console.warn('[SubscriptionManagement] syncAsaasSubscriptionStatus failed or missing. Fallback to offline check.', error)
      try {
        if (auth.refreshUserData) {
          await auth.refreshUserData()
        }
        setStoreRefreshNonce((v) => v + 1)
        setToast({
          type: 'info',
          message: 'Status atualizado com os dados locais salvos. Boas vendas!',
        })
      } catch (_err) {
        triggerSupportFallback(
          'Sincronizar Status da Assinatura',
          'Desejo que o financeiro verifique e sincronize manualmente a confirmação de pagamento Asaas no meu painel.'
        )
      }
    } finally {
      setSubmittingSync(false)
    }
  }

  // 2. Action: Change Plan
  async function handleConfirmPlanChange() {
    if (submittingPlanChange || !pendingPlanId) return
    if (!subscriptionActions.canChangePlan) {
      setToast({ type: 'info', message: getUnavailableActionMessage('canChangePlan') })
      return
    }

    setSubmittingPlanChange(true)
    try {
      const changePlanFn = httpsCallable(functions, 'changeSubscriptionPlan')
      const result = await changePlanFn({
        storeId: store?.id || selectedStoreId,
        targetPlan: pendingPlanId,
        billingCycle: selectedPlanCycle,
      })

      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      setStoreRefreshNonce((v) => v + 1)
      setShowPlanModal(false)
      setToast({
        type: 'success',
        message: result?.data?.message || 'Solicitação de alteração de plano enviada com sucesso!',
      })
    } catch (error) {
      console.warn('[SubscriptionManagement] changeSubscriptionPlan failed or not deployed.', error)
      const selectedOption = PLAN_OPTIONS.find((p) => p.id === pendingPlanId)
      const planName = selectedOption?.name || pendingPlanId
      const cycleName = selectedPlanCycle === 'annual' ? 'Anual' : 'Mensal'
      
      setShowPlanModal(false)
      triggerSupportFallback(
        'Alteração de Plano',
        `Gostaria de mudar meu plano do atual para o plano *${planName}* (${cycleName}).`
      )
    } finally {
      setSubmittingPlanChange(false)
    }
  }

  // 3. Action: Change Due Date
  async function handleConfirmDueDateChange() {
    if (submittingDueDate) return
    if (!subscriptionActions.canRequestDueDateChange) {
      setToast({ type: 'info', message: getUnavailableActionMessage('canRequestDueDateChange') })
      return
    }

    setSubmittingDueDate(true)
    try {
      const changeDueDateFn = httpsCallable(functions, 'requestSubscriptionDueDateChange')
      const result = await changeDueDateFn({
        storeId: store?.id || selectedStoreId,
        desiredDueDay: selectedDueDate,
      })

      setShowDueDateModal(false)
      setToast({
        type: 'success',
        message: result?.data?.message || 'Solicitação de alteração de vencimento enviada com sucesso!',
      })
    } catch (error) {
      console.warn('[SubscriptionManagement] requestSubscriptionDueDateChange failed or not deployed.', error)
      setShowDueDateModal(false)
      triggerSupportFallback(
        'Alteração do Dia de Vencimento',
        `Gostaria de solicitar a alteração do vencimento da minha fatura mensal para todo dia *${selectedDueDate}* de cada mês.`
      )
    } finally {
      setSubmittingDueDate(false)
    }
  }

  // 4. Action: Cancel Subscription
  async function handleConfirmCancel() {
    if (submittingCancel) return
    if (!subscriptionActions.canCancel) {
      setToast({ type: 'info', message: getUnavailableActionMessage('canCancel') })
      return
    }

    if (cancelConfirmationText.trim().toLowerCase() !== 'cancelar minha assinatura') {
      setToast({
        type: 'error',
        message: 'Digite a frase de confirmação exatamente para prosseguir.',
      })
      return
    }

    setSubmittingCancel(true)
    try {
      const cancelFn = httpsCallable(functions, 'cancelSubscription')
      const result = await cancelFn({
        storeId: store?.id || selectedStoreId,
        reason: cancelReason,
        cancelMode: 'end_of_cycle',
        confirmationText: cancelConfirmationText.trim().toLowerCase(),
      })

      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      setStoreRefreshNonce((v) => v + 1)
      setShowCancelModal(false)
      const resultStatus = result?.data?.status
      const cancellationStatus = result?.data?.cancellationStatus
      const message =
        resultStatus === 'requested'
          ? 'Cancelamento solicitado com sucesso. Nossa equipe confirmará o processamento.'
          : resultStatus === 'canceled'
          ? 'Assinatura cancelada com sucesso.'
          : resultStatus === 'cancel_scheduled' || cancellationStatus === 'cancel_scheduled'
          ? 'Cancelamento agendado para o fim do ciclo atual.'
          : 'Cancelamento solicitado com sucesso. Nossa equipe confirmará o processamento.'
      setToast({
        type: 'success',
        message,
      })
    } catch (error) {
      console.warn('[SubscriptionManagement] cancelSubscription failed or not deployed.', error)
      setShowCancelModal(false)
      triggerSupportFallback(
        'Cancelamento de Assinatura',
        `Desejo solicitar o cancelamento da assinatura do PratoBy. Motivo do cancelamento: "${cancelReason || 'Não informado'}".`
      )
    } finally {
      setSubmittingCancel(false)
    }
  }

  // 5. Action: Update Payment Method (Redirect/Checkout Asaas)
  async function handleUpdatePaymentMethod() {
    if (submittingPaymentMethod) return
    if (!subscriptionActions.canUpdatePaymentMethod) {
      setToast({ type: 'info', message: getUnavailableActionMessage('canUpdatePaymentMethod') })
      return
    }

    setSubmittingPaymentMethod(true)
    try {
      const updatePaymentFn = httpsCallable(functions, 'createPaymentMethodUpdateCheckout')
      const result = await updatePaymentFn({ storeId: store?.id || selectedStoreId })
      
      const checkoutUrl = result?.data?.checkoutUrl || result?.data?.paymentUrl
      if (checkoutUrl) {
        if (!openCheckoutUrl(checkoutUrl)) {
          throw new Error('URL de checkout inválida.')
        }
        setToast({
          type: 'success',
          message: 'Checkout seguro Asaas aberto em uma nova aba!',
        })
      } else if (result?.data?.status === 'manual_request_required') {
        setToast({
          type: 'success',
          message: result?.data?.message || 'Solicitação enviada. Nossa equipe enviará o caminho seguro para atualizar o pagamento.',
        })
      } else if (result?.data?.status === 'requires_billing_data') {
        setToast({
          type: 'info',
          message: result?.data?.message || 'Redirecionando para configurar cobrança.',
        })
        setTimeout(() => {
          navigate('/dashboard/billing')
        }, 800)
      } else {
        throw new Error('Nenhuma URL retornada.')
      }
    } catch (error) {
      console.warn('[SubscriptionManagement] createPaymentMethodUpdateCheckout failed or not deployed.', error)
      
      // Se falhar a Function dedicada, redireciona para a BillingPage comum para que o lojista use a rota integrada
      setToast({
        type: 'info',
        message: 'Redirecionando para a página de faturamento para atualizar o pagamento.',
      })
      setTimeout(() => {
        navigate('/dashboard/billing')
      }, 1000)
    } finally {
      setSubmittingPaymentMethod(false)
    }
  }

  if (loadingStore) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <FiLoader className="h-10 w-10 animate-spin text-[#f97316]" />
        <p className="mt-4 text-sm font-bold text-gray-500">Carregando painel de gerenciamento...</p>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
            <FiAlertTriangle size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black text-[#111827] dark:text-white">Nenhuma loja ativa</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
            Selecione ou crie uma loja ativa para gerenciar as configurações da assinatura.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 transition-colors duration-300">
      <DashboardPageHeader
        title="Gerenciar assinatura"
        description="Altere plano, atualize pagamento ou solicite ajustes da sua mensalidade."
        icon={FiSettings}
        badge={headerBadge}
        actions={
          <motion.div
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 15 }}
          >
            <Link
              to="/dashboard/billing"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316] border border-orange-200/50 hover:bg-orange-100/50 px-4 text-xs font-black transition-all duration-300 active:scale-95 shadow-sm"
            >
              <FiArrowRight className="rotate-180" size={13} />
              <span>Voltar para faturamento</span>
            </Link>
          </motion.div>
        }
      />

      <motion.div
        variants={pageMotion}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
      >
        {managementError && (
          <motion.section
            variants={sectionMotion}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
          >
            Dados financeiros carregados em modo local. Algumas ações podem ficar indisponíveis até a função de gerenciamento responder.
          </motion.section>
        )}
        
        {/* Dynamic HUD Control Center */}
        <motion.section
          variants={sectionMotion}
          className="bg-gradient-to-br from-white via-[#fffdfb] to-orange-50/15 dark:from-zinc-900 dark:to-zinc-950 text-gray-900 dark:text-white rounded-[2rem] p-6 lg:p-8 shadow-sm dark:shadow-xl border border-orange-100 dark:border-zinc-800 relative overflow-hidden"
        >
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] items-stretch">
            {/* Left Column: Plan & Details */}
            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 px-3 py-1 text-[11px] font-bold text-[#f97316] dark:text-orange-400 uppercase tracking-wider">
                    <FiShield size={12} className="text-[#f97316]" />
                    Status da Assinatura
                  </span>
                  <SubscriptionStatusBadge status={subscriptionStatus} />
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ring-1 ring-inset ${
                    billingMethodConfigured
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                      : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
                  }`}>
                    <FiLock size={11} className={billingMethodConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                    {billingMethodConfigured ? 'Forma de Pagamento Ativa' : 'Faturamento Não Configurado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Plano Atual</span>
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
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Acesso Ativo</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 font-semibold mt-1">Sua mensalidade está regularizada e ativa no Asaas.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/40 dark:bg-red-950/25 border border-red-100/40 dark:border-red-900/30 rounded-2xl p-4 lg:p-5 flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                    <FiAlertTriangle size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Ação Requerida</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 font-semibold mt-1">A assinatura requer a configuração de faturamento para continuar ativa.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: CTA Panel */}
            <div className="bg-[#fffcf9] dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800 rounded-3xl p-5 lg:p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FiLock className="text-[#f97316]" size={14} />
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Mensalidade Programada</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-zinc-500">Valor do Plano</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                      {formatCurrency(currentPlanDisplayAmount)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-400 font-semibold">
                      /{billingCycle === 'annual' ? 'ano' : 'mês'}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-orange-50/20 dark:bg-zinc-950/50 border border-orange-100/50 dark:border-zinc-800">
                    <p className="text-[11px] text-gray-600 dark:text-zinc-300 font-semibold leading-relaxed">
                      {billingMethodConfigured
                        ? `Próxima referência de cobrança: ${formatBillingDate(nextChargeAt)}.`
                        : 'Aguardando o cadastro dos dados de faturamento para iniciar o ciclo seguro.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons inside HUD */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSyncStatus}
                  disabled={submittingSync || !subscriptionActions.canSyncStatus}
                  title={!subscriptionActions.canSyncStatus ? getUnavailableActionMessage('canSyncStatus') : undefined}
                  className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white shadow-md text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingSync ? (
                    <FiLoader className="animate-spin" size={14} />
                  ) : (
                    <FiRefreshCw size={14} />
                  )}
                  <span>Sincronizar status</span>
                </button>

                <Link
                  to="/dashboard/billing"
                  className="w-full inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/50 dark:bg-zinc-950/20 text-xs font-black text-gray-500 dark:text-zinc-400 transition hover:bg-gray-100 dark:hover:bg-zinc-900"
                >
                  <FiArrowRight size={12} />
                  Página de Cobrança (Faturas)
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Core Actions Grid */}
        <motion.section variants={sectionMotion} className="space-y-4">
          <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Ações da Assinatura</h3>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Card: Alterar Plano */}
            <motion.div
              variants={actionCardMotion}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
                  <FiTrendingUp size={18} />
                </span>
                <h4 className="mt-4 text-sm font-black text-gray-900 dark:text-white">Alterar Plano</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  Solicite a troca de plano com validação segura do financeiro.
                </p>
                {!subscriptionActions.canChangePlan && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                    {getUnavailableActionMessage('canChangePlan')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingPlanId(currentPlan)
                  setSelectedPlanCycle(billingCycle)
                  setShowPlanModal(true)
                }}
                disabled={!subscriptionActions.canChangePlan}
                className="mt-5 w-full inline-flex h-10 items-center justify-center rounded-xl bg-orange-50 hover:bg-orange-100/70 text-[#f97316] text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-950/20"
              >
                Escolher outro plano
              </button>
            </motion.div>

            {/* Card: Atualizar Forma de Pagamento */}
            <motion.div
              variants={actionCardMotion}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
                  <FiCreditCard size={18} />
                </span>
                <h4 className="mt-4 text-sm font-black text-gray-900 dark:text-white">Forma de Pagamento</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  Atualize a forma de pagamento por checkout seguro ou solicitação assistida.
                </p>
                {!subscriptionActions.canUpdatePaymentMethod && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                    {getUnavailableActionMessage('canUpdatePaymentMethod')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleUpdatePaymentMethod}
                disabled={submittingPaymentMethod || !subscriptionActions.canUpdatePaymentMethod}
                className="mt-5 w-full inline-flex h-10 items-center justify-center rounded-xl bg-orange-50 hover:bg-orange-100/70 text-[#f97316] text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-950/20"
              >
                {submittingPaymentMethod ? <FiLoader className="animate-spin" /> : 'Atualizar dados'}
              </button>
            </motion.div>

            {/* Card: Alterar Vencimento */}
            <motion.div
              variants={actionCardMotion}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
                  <FiCalendar size={18} />
                </span>
                <h4 className="mt-4 text-sm font-black text-gray-900 dark:text-white">Data de Vencimento</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  Solicite a alteração do dia de faturamento das suas próximas mensalidades.
                </p>
                {!subscriptionActions.canRequestDueDateChange && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                    {getUnavailableActionMessage('canRequestDueDateChange')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDueDateModal(true)}
                disabled={!subscriptionActions.canRequestDueDateChange}
                className="mt-5 w-full inline-flex h-10 items-center justify-center rounded-xl bg-orange-50 hover:bg-orange-100/70 text-[#f97316] text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-950/20"
              >
                Mudar vencimento
              </button>
            </motion.div>

            {/* Card: Cancelar Assinatura */}
            <motion.div
              variants={actionCardMotion}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600">
                  <FiTrash2 size={18} />
                </span>
                <h4 className="mt-4 text-sm font-black text-gray-900 dark:text-white">Cancelar Assinatura</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  Solicite o cancelamento ao fim do ciclo, sem apagar dados da loja.
                </p>
                {!subscriptionActions.canCancel && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                    {getUnavailableActionMessage('canCancel')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelReason('')
                  setCancelConfirmationText('')
                  setShowCancelModal(true)
                }}
                disabled={!subscriptionActions.canCancel}
                className="mt-5 w-full inline-flex h-10 items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-950/20"
              >
                Encerrar contrato
              </button>
            </motion.div>

          </div>
        </motion.section>

        {/* WhatsApp Support Callout */}
        <motion.section
          variants={sectionMotion}
          className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[2rem] p-6 lg:p-8 shadow-sm flex flex-col gap-6 md:flex-row md:items-center md:justify-between transition"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316]">
              <FiMessageSquare size={22} />
            </span>
            <div>
              <h4 className="text-base font-black text-gray-900 dark:text-white">Precisa de ajuda com sua assinatura?</h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 font-semibold leading-relaxed max-w-xl">
                Se tiver qualquer dúvida sobre valores, faturas ou quiser negociar um plano personalizado para redes/franquias, fale com nossa equipe especializada no WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => triggerSupportFallback('Atendimento Comercial / Dúvida Comercial', 'Desejo conversar diretamente com um atendente sobre questões de faturamento.')}
            className="shrink-0 inline-flex h-12 w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-black shadow-md shadow-orange-500/10 px-6 transition active:scale-95"
          >
            <FiMessageSquare size={14} />
            <span>Falar com suporte</span>
          </button>
        </motion.section>

      </motion.div>

      {/* MODAL 1: Alterar Plano */}
      {showPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            
            {/* Header */}
            <div className="shrink-0 border-b border-gray-100 bg-[#fffcf9] px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-[#111827] dark:text-white flex items-center gap-2">
                  <FiTrendingUp className="text-[#f97316]" />
                  Alterar Plano da Loja
                </h3>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400 leading-normal">
                  Escolha seu novo pacote PratoBy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Form / Grid */}
            <div className="overflow-y-auto p-6 space-y-6">
              
              {/* Selector Cycle */}
              <div className="flex justify-between items-center bg-orange-50/20 border border-orange-100/50 p-3 rounded-2xl dark:bg-zinc-950/60 dark:border-zinc-800">
                <span className="text-xs font-black text-gray-600 dark:text-zinc-300">Ciclo de faturamento recorrente</span>
                <AnimatedSegmentedControl
                  options={[
                    { label: 'Mensal', value: 'monthly' },
                    { label: 'Anual (2 meses grátis)', value: 'annual' }
                  ]}
                  value={selectedPlanCycle}
                  onChange={(val) => setSelectedPlanCycle(val)}
                  size="sm"
                  variant="primary"
                />
              </div>

              {/* Grid Options */}
              <div className="grid gap-3 sm:grid-cols-3">
                {PLAN_OPTIONS.map((opt) => {
                  const isCurrentChoice = pendingPlanId === opt.id
                  const cyclePrice = getPlanCyclePrice(opt, selectedPlanCycle)
                  
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPendingPlanId(opt.id)}
                      className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                        isCurrentChoice
                          ? 'border-[#f97316] bg-orange-50/10 ring-2 ring-[#f97316]/10 dark:bg-orange-950/15'
                          : 'border-gray-100 hover:border-orange-200 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black text-gray-900 dark:text-white">{getPlanDisplayName(opt.id)}</span>
                          {opt.id === currentPlan && (
                            <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">Atual</span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400 font-semibold leading-relaxed leading-normal">{opt.subtitle}</p>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1 mt-3">
                          <span className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(cyclePrice)}</span>
                          <span className="text-[10px] text-gray-400 font-semibold">/{selectedPlanCycle === 'annual' ? 'ano' : 'mês'}</span>
                        </div>
                        {selectedPlanCycle === 'annual' && (
                          <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Equivale a {formatCurrency(opt.equivalentMonthly)}/mês
                          </p>
                        )}
                        <div className="mt-3 space-y-1 rounded-xl bg-gray-50 p-2 dark:bg-zinc-950/60">
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                            Mensal: {formatCurrency(opt.priceMonthly)}/mês
                          </p>
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                            Anual: {formatCurrency(opt.priceAnnual)}/ano
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 dark:border-orange-500/20 dark:bg-orange-500/10 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">Precisa comparar antes de solicitar?</p>
                  <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                    Veja a lista completa de recursos dos planos Essencial, Professional e Premium.
                  </p>
                </div>
                <Link
                  to="/planos#comparacao"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#f97316] ring-1 ring-orange-100 transition hover:bg-orange-50 dark:bg-zinc-950/80 dark:ring-orange-500/20 dark:hover:bg-zinc-900 sm:mt-0 sm:w-auto"
                >
                  Lista de comparação completa
                  <FiArrowRight size={13} />
                </Link>
              </div>

              {/* Informational Alerts */}
              <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4 text-xs font-semibold text-gray-500 leading-relaxed dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 space-y-2">
                <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <FiCheck className="shrink-0" />
                  A troca de plano será solicitada com o valor oficial calculado pelo PratoBy.
                </p>
                <p className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <FiInfo className="shrink-0" />
                  Nossa equipe confirmará o melhor momento de aplicação para evitar cobranças confusas.
                </p>
              </div>

            </div>

            {/* Actions */}
            <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-xs font-black text-gray-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                disabled={submittingPlanChange}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] px-5 text-xs font-black text-white shadow-md transition disabled:opacity-60"
              >
                {submittingPlanChange ? <FiLoader className="animate-spin" /> : <FiCheck />}
                Solicitar alteração de plano
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Alterar Vencimento */}
      {showDueDateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            
            <div className="shrink-0 border-b border-gray-100 bg-[#fffcf9] px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-[#111827] dark:text-white flex items-center gap-2">
                  <FiCalendar className="text-[#f97316]" />
                  Dia do Vencimento
                </h3>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">
                  Escolha a melhor data para faturamento das faturas recorrentes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDueDateModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold leading-relaxed">
                Sua solicitação será registrada para análise segura. Faturas já geradas podem exigir confirmação manual do suporte.
              </p>

              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  Dia desejado do vencimento (Dia 1 a 28)
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={selectedDueDate}
                  onChange={(e) => {
                    const val = Math.min(28, Math.max(1, parseInt(e.target.value) || 1))
                    setSelectedDueDate(val)
                  }}
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#111827] dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-700 outline-none focus:border-[#f97316] dark:focus:border-[#f97316] transition"
                />
              </div>

              <div className="rounded-xl bg-orange-50/20 border border-orange-100/50 p-3 text-[11px] font-semibold text-gray-600 dark:bg-zinc-950/60 dark:border-zinc-800 dark:text-zinc-400 leading-relaxed">
                <FiInfo className="inline mr-1 text-[#f97316]" />
                Dependendo do faturamento ativo, faturas já geradas para o ciclo atual de cobrança podem não ser alteradas automaticamente.
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDueDateModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-xs font-black text-gray-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-gray-100 transition"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmDueDateChange}
                disabled={submittingDueDate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] px-5 text-xs font-black text-white shadow-md transition disabled:opacity-60"
              >
                {submittingDueDate ? <FiLoader className="animate-spin" /> : <FiCheck />}
                Solicitar alteração de vencimento
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: Cancelamento de Assinatura */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            
            <div className="shrink-0 border-b border-red-50 bg-red-50/10 px-6 py-5 dark:border-red-950/20 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                  <FiAlertTriangle />
                  Cancelar Assinatura PratoBy
                </h3>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">
                  Lamentamos ver você partir. Leia atentamente as condições abaixo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              <div className="rounded-xl bg-red-50/40 border border-red-100/50 p-4 text-xs font-bold text-red-700 dark:bg-red-950/20 dark:text-red-400 space-y-2 leading-relaxed">
                <p className="flex items-start gap-2">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  Sua loja online e cardápio digital serão completamente suspensos ao término do período de faturamento ativo.
                </p>
                <p className="flex items-start gap-2">
                  <FiCheck className="mt-0.5 shrink-0" />
                  Dados preservados: Suas categorias, produtos e configurações não serão deletados imediatamente para permitir reativação no futuro.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  Qual o principal motivo do cancelamento? <span className="font-semibold normal-case">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Seu feedback é muito importante para melhorarmos nossa plataforma..."
                  className="w-full rounded-xl border border-gray-200 p-3 text-xs font-semibold text-[#111827] dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-700 outline-none focus:border-red-400 dark:focus:border-red-400 transition resize-none"
                />
              </div>

              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-3">
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  Para confirmar, digite: <strong className="text-red-600 dark:text-red-400 lowercase italic">cancelar minha assinatura</strong>
                </label>
                <input
                  type="text"
                  value={cancelConfirmationText}
                  onChange={(e) => setCancelConfirmationText(e.target.value)}
                  placeholder="cancelar minha assinatura"
                  className="h-11 w-full rounded-xl border border-red-100 px-3 text-sm font-semibold text-red-600 dark:bg-zinc-950 dark:text-red-400 dark:border-red-950/40 outline-none focus:border-red-500 dark:focus:border-red-500 transition"
                />
              </div>

            </div>

            <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-xs font-black text-gray-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-gray-100 transition"
              >
                Desistir do Cancelamento
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={submittingCancel || cancelConfirmationText.trim().toLowerCase() !== 'cancelar minha assinatura'}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 text-xs font-black text-white shadow-md transition disabled:opacity-50"
              >
                {submittingCancel ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                Solicitar cancelamento
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: WhatsApp Support Fallback */}
      {showSupportFallbackModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            
            <div className="shrink-0 border-b border-gray-100 bg-[#fffcf9] px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-[#111827] dark:text-white flex items-center gap-2">
                  <FiMessageSquare className="text-[#f97316]" />
                  Ação via Suporte PratoBy
                </h3>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">
                  Sua solicitação de faturamento está pronta para ser enviada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportFallbackModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/20 text-[#f97316] mx-auto">
                <FiMessageSquare size={24} />
              </div>
              
              <div className="text-center space-y-2">
                <h4 className="text-sm font-black text-gray-900 dark:text-white">Esta solicitação será concluída pelo WhatsApp</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  A ação <strong className="text-gray-900 dark:text-white">"{fallbackActionTitle}"</strong> requer confirmação manual do nosso time financeiro. Clique abaixo para enviar uma mensagem predefinida segura para nosso suporte.
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-zinc-950/50 border border-gray-100 dark:border-zinc-800 rounded-xl max-h-[140px] overflow-y-auto">
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase block mb-1">Visualização da Mensagem</p>
                <p className="text-[11px] text-gray-600 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap font-mono italic">
                  {fallbackMessage}
                </p>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSupportFallbackModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-5 text-xs font-black text-gray-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-gray-100 transition"
              >
                Fechar
              </button>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(fallbackMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSupportFallbackModal(false)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] px-5 text-xs font-black text-white shadow-md transition active:scale-95"
              >
                <FiMessageSquare size={14} />
                Chamar Suporte no WhatsApp
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[150] max-w-sm rounded-lg border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
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

    </main>
  )
}
