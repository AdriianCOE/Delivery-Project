import { formatBillingDate, toDate } from './billingStatus'

const PENDING_STATUSES = new Set([
  'checkout_pending',
  'pending_checkout',
  'billing_pending',
  'billing_pending_payment_method',
])
const OVERDUE_STATUSES = new Set(['past_due', 'overdue'])
const CANCELLED_STATUSES = new Set(['canceled', 'cancelled', 'deleted'])
const ACTIVE_STATUSES = new Set(['active', 'paid'])
const TRIAL_ACTIVE_STATUSES = new Set(['trialing', 'trial', 'active'])
const TRIAL_EXPIRED_STATUSES = new Set(['expired', 'ended', 'trial_ended'])

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  return status === 'pending_checkout' || status === 'billing_pending'
    ? 'checkout_pending'
    : status
}

function getSubscriptionStatus(data = {}) {
  return normalizeStatus(data.subscriptionStatus || data.subscription?.status)
}

function getTrialStatus(data = {}) {
  return normalizeStatus(data.trialStatus || data.trial?.status || data.billing?.trialStatus)
}

function getTrialEndsAt(data = {}) {
  return (
    data.trialEndsAt ||
    data.trialEndAt ||
    data.trial?.endsAt ||
    data.trial?.trialEndsAt ||
    data.subscription?.trialEndsAt ||
    data.billing?.trialEndsAt ||
    null
  )
}

function getBillingGraceEndsAt(data = {}) {
  return (
    data.billingGraceEndsAt ||
    data.pastDueGraceEndsAt ||
    data.paymentGraceEndsAt ||
    data.billing?.graceEndsAt ||
    data.billing?.billingGraceEndsAt ||
    null
  )
}

function hasManualGrant(data = {}) {
  return Boolean(
    data.manualGrant === true ||
      data.manualBillingGrant === true ||
      data.billingAccessOverride === true ||
      data.billing?.manualGrant === true ||
      data.accessGrant?.billing === true
  )
}

function hasFreePlan(data = {}) {
  const plan = String(
    data.effectivePlan ||
      data.billingPlan ||
      data.selectedPlan ||
      data.plan ||
      data.planId ||
      ''
  ).trim().toLowerCase()

  return plan === 'free' || plan === 'gratuito'
}

function hasExpiredTrialSignal(data = {}, nowMs = Date.now()) {
  const subscriptionStatus = getSubscriptionStatus(data)
  const trialStatus = getTrialStatus(data)
  const trialEndsAt = toDate(getTrialEndsAt(data))

  if (subscriptionStatus === 'trial_ended' || TRIAL_EXPIRED_STATUSES.has(trialStatus)) return true
  if (trialEndsAt && trialEndsAt.getTime() <= nowMs) return true
  return data.trialUsed === true || data.trial?.used === true || data.billing?.trialUsed === true
}

function buildResult({ state, canPublishStore, canReceiveOrders, messageKey, reason = null, data = {} }) {
  return {
    state,
    canPublishStore,
    canReceiveOrders,
    canAccessDashboard: true,
    messageKey,
    reason,
    planId: data.effectivePlan || data.billingPlan || data.selectedPlan || data.plan || data.planId || null,
    trialEndsAt: getTrialEndsAt(data),
    billingGraceEndsAt: getBillingGraceEndsAt(data),
    subscriptionStatus: getSubscriptionStatus(data) || null,
  }
}

export function mergeBillingAccessData(store = {}, userData = {}) {
  return {
    ...(userData || {}),
    ...(store || {}),
    subscriptionStatus: store?.subscriptionStatus || store?.subscription?.status || userData?.subscriptionStatus || userData?.subscription?.status || '',
    trialStatus: store?.trialStatus || store?.trial?.status || userData?.trialStatus || userData?.trial?.status || '',
    trialEndsAt: store?.trialEndsAt || store?.trialEndAt || store?.trial?.endsAt || userData?.trialEndsAt || userData?.trialEndAt || userData?.trial?.endsAt || null,
    trialUsed: store?.trialUsed ?? store?.trial?.used ?? userData?.trialUsed ?? userData?.trial?.used ?? false,
    plan: store?.plan || userData?.plan || null,
    planId: store?.planId || userData?.planId || null,
    billingPlan: store?.billingPlan || userData?.billingPlan || null,
    selectedPlan: store?.selectedPlan || userData?.selectedPlan || null,
    effectivePlan: store?.effectivePlan || userData?.effectivePlan || null,
    isBillingBlocked: store?.isBillingBlocked === true || userData?.isBillingBlocked === true,
    isBlocked: store?.isBlocked === true || userData?.isBlocked === true,
    isDeleted: store?.isDeleted === true || userData?.isDeleted === true,
    deletedAt: store?.deletedAt || userData?.deletedAt || null,
    blockedReason: store?.blockedReason || userData?.blockedReason || null,
    billingBlockedReason: store?.billingBlockedReason || userData?.billingBlockedReason || null,
    billingGraceEndsAt: store?.billingGraceEndsAt || userData?.billingGraceEndsAt || null,
    pastDueGraceEndsAt: store?.pastDueGraceEndsAt || userData?.pastDueGraceEndsAt || null,
    paymentGraceEndsAt: store?.paymentGraceEndsAt || userData?.paymentGraceEndsAt || null,
  }
}

export function deriveBillingAccessState(data = {}, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now || Date.now())
  const nowMs = Number.isFinite(now) ? now : Date.now()
  const subscriptionStatus = getSubscriptionStatus(data)
  const trialStatus = getTrialStatus(data)
  const trialEndsAt = toDate(getTrialEndsAt(data))
  const trialStillActive = Boolean(trialEndsAt && trialEndsAt.getTime() > nowMs)

  if (data.isBillingBlocked === true || data.isBlocked === true || data.isDeleted === true || data.deletedAt) {
    return buildResult({
      state: 'blocked',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.blocked',
      reason: data.blockedReason || data.billingBlockedReason || 'blocked',
      data,
    })
  }

  if (subscriptionStatus === 'blocked') {
    return buildResult({
      state: 'blocked',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.blocked',
      reason: 'blocked',
      data,
    })
  }

  if (hasManualGrant(data)) {
    return buildResult({
      state: 'manual_grant',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.manual_grant',
      reason: 'manual_grant',
      data,
    })
  }

  if (hasFreePlan(data)) {
    return buildResult({
      state: 'free_plan',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.free_plan',
      reason: 'free_plan',
      data,
    })
  }

  if (ACTIVE_STATUSES.has(subscriptionStatus)) {
    return buildResult({
      state: 'subscription_active',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.subscription_active',
      data,
    })
  }

  if (subscriptionStatus === 'trialing' || TRIAL_ACTIVE_STATUSES.has(trialStatus) || trialStillActive) {
    if (trialStillActive || (!trialEndsAt && subscriptionStatus === 'trialing')) {
      return buildResult({
        state: 'trial_active',
        canPublishStore: true,
        canReceiveOrders: true,
        messageKey: 'billing.trial_active',
        data,
      })
    }

    return buildResult({
      state: 'trial_expired',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.trial_expired',
      reason: 'trial_expired',
      data,
    })
  }

  if (PENDING_STATUSES.has(subscriptionStatus)) {
    return buildResult({
      state: 'subscription_pending',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.subscription_pending',
      reason: 'subscription_pending',
      data,
    })
  }

  if (OVERDUE_STATUSES.has(subscriptionStatus)) {
    const graceEndsAt = toDate(getBillingGraceEndsAt(data))

    if (graceEndsAt && graceEndsAt.getTime() > nowMs) {
      return buildResult({
        state: 'subscription_grace_period',
        canPublishStore: true,
        canReceiveOrders: true,
        messageKey: 'billing.subscription_grace_period',
        reason: 'past_due_grace_period',
        data,
      })
    }

    return buildResult({
      state: 'subscription_overdue',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.subscription_overdue',
      reason: graceEndsAt ? 'past_due_grace_expired' : 'subscription_overdue',
      data,
    })
  }

  if (CANCELLED_STATUSES.has(subscriptionStatus)) {
    return buildResult({
      state: 'subscription_cancelled',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.subscription_cancelled',
      reason: 'subscription_cancelled',
      data,
    })
  }

  if (hasExpiredTrialSignal(data, nowMs)) {
    return buildResult({
      state: 'trial_expired',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.trial_expired',
      reason: 'trial_expired',
      data,
    })
  }

  if (!subscriptionStatus && options.allowLegacyAccess === true) {
    return buildResult({
      state: 'manual_grant',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.legacy_access',
      reason: 'legacy_missing_subscription_status',
      data,
    })
  }

  return buildResult({
    state: 'trial_available',
    canPublishStore: false,
    canReceiveOrders: false,
    messageKey: 'billing.trial_available',
    reason: 'trial_available',
    data,
  })
}

export function getBillingAccessCopy(accessState = {}) {
  const trialDate = accessState.trialEndsAt ? formatBillingDate(accessState.trialEndsAt) : null
  const graceDate = accessState.billingGraceEndsAt ? formatBillingDate(accessState.billingGraceEndsAt) : null

  const copy = {
    trial_available: {
      title: 'Ative o teste grátis para publicar sua loja',
      message: 'Ative seu teste grátis para publicar sua loja e começar a receber pedidos.',
      cta: 'Ativar teste grátis',
      tone: 'orange',
    },
    trial_active: {
      title: 'Teste grátis ativo',
      message: trialDate ? `Seu teste grátis está ativo até ${trialDate}.` : 'Seu teste grátis está ativo.',
      cta: 'Ver planos',
      tone: 'blue',
    },
    trial_expired: {
      title: 'Seu teste grátis terminou',
      message: 'Seu teste grátis terminou. Escolha um plano para manter sua loja publicada e continuar recebendo pedidos.',
      cta: 'Escolher plano',
      tone: 'red',
    },
    subscription_pending: {
      title: 'Assinatura em confirmação',
      message: 'Estamos aguardando a confirmação da sua assinatura.',
      cta: 'Ver status da assinatura',
      tone: 'orange',
    },
    subscription_active: {
      title: 'Seu plano está ativo',
      message: 'Seu plano está ativo.',
      cta: 'Gerenciar plano',
      tone: 'green',
    },
    subscription_grace_period: {
      title: 'Pagamento pendente',
      message: graceDate
        ? `Regularize o pagamento até ${graceDate} para evitar a pausa dos pedidos.`
        : 'Regularize o pagamento para evitar a pausa dos pedidos.',
      cta: 'Regularizar pagamento',
      tone: 'orange',
    },
    subscription_overdue: {
      title: 'Sua assinatura está pendente',
      message: 'Sua assinatura está pendente. Regularize o pagamento para continuar recebendo pedidos.',
      cta: 'Regularizar pagamento',
      tone: 'red',
    },
    subscription_cancelled: {
      title: 'Sua assinatura foi cancelada',
      message: 'Sua assinatura foi cancelada. Escolha um plano para reativar sua loja.',
      cta: 'Reativar plano',
      tone: 'red',
    },
    blocked: {
      title: 'Loja bloqueada',
      message: 'Sua loja está bloqueada no momento. Entre em contato com o suporte se precisar de ajuda.',
      cta: 'Ver assinatura',
      tone: 'red',
    },
    free_plan: {
      title: 'Plano gratuito ativo',
      message: 'Seu plano gratuito está ativo.',
      cta: 'Gerenciar plano',
      tone: 'green',
    },
    manual_grant: {
      title: 'Acesso liberado',
      message: accessState.reason === 'legacy_missing_subscription_status'
        ? 'Esta loja legada segue liberada enquanto a migração de billing não for concluída.'
        : 'Seu acesso foi liberado manualmente pela equipe PratoBy.',
      cta: 'Gerenciar plano',
      tone: 'green',
    },
  }

  return copy[accessState.state] || copy.trial_available
}
