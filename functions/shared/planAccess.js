'use strict'

const PLAN_IDS = {
  ESSENTIAL: 'essential',
  PROFESSIONAL: 'professional',
  PREMIUM: 'premium',
}

const PLAN_ORDER = {
  [PLAN_IDS.ESSENTIAL]: 1,
  [PLAN_IDS.PROFESSIONAL]: 2,
  [PLAN_IDS.PREMIUM]: 3,
}

const PLAN_LIMITS = {
  [PLAN_IDS.ESSENTIAL]: {
    products: 50,
    categories: 10,
    users: 1,
    coupons: 0,
    productImagesPerItem: 1,
    tables: 0,
  },
  [PLAN_IDS.PROFESSIONAL]: {
    products: 200,
    categories: 30,
    users: 3,
    coupons: 20,
    productImagesPerItem: 3,
    tables: 0,
  },
  [PLAN_IDS.PREMIUM]: {
    products: 1000,
    categories: 100,
    users: 10,
    coupons: 1000,
    productImagesPerItem: 5,
    tables: 200,
  },
}

const FEATURE_MIN_PLANS = {
  basicOrders: PLAN_IDS.ESSENTIAL,
  counterOrders: PLAN_IDS.ESSENTIAL,
  menuQrCode: PLAN_IDS.ESSENTIAL,
  manualPix: PLAN_IDS.ESSENTIAL,
  onlinePayments: PLAN_IDS.ESSENTIAL,
  criticalNotifications: PLAN_IDS.ESSENTIAL,
  orderTracking: PLAN_IDS.ESSENTIAL,
  printKitchenTicket: PLAN_IDS.ESSENTIAL,
  reviews: PLAN_IDS.ESSENTIAL,
  customerRatings: PLAN_IDS.ESSENTIAL,
  basicReports: PLAN_IDS.ESSENTIAL,

  pickupDisplay: PLAN_IDS.PROFESSIONAL,
  dineInOrdering: PLAN_IDS.PROFESSIONAL,
  scheduling: PLAN_IDS.PROFESSIONAL,
  coupons: PLAN_IDS.PROFESSIONAL,
  deliveryZonesAdvanced: PLAN_IDS.PROFESSIONAL,
  multiUser: PLAN_IDS.PROFESSIONAL,

  tableQrCode: PLAN_IDS.PREMIUM,
  advancedReports: PLAN_IDS.PREMIUM,
  customBranding: PLAN_IDS.PREMIUM,
  removePratoByBranding: PLAN_IDS.PREMIUM,
  automationRules: PLAN_IDS.PREMIUM,
  prioritySupport: PLAN_IDS.PREMIUM,
}

const BLOCKED_STATUSES = new Set([
  'blocked',
  'canceled',
  'cancelled',
  'checkout_pending',
  'pending_checkout',
  'billing_pending',
  'billing_pending_payment_method',
  'past_due',
  'deleted',
  'trial_ended',
])

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

function normalizePlanId(value, fallback = PLAN_IDS.ESSENTIAL) {
  const plan = String(value || '').trim().toLowerCase()
  return PLAN_ORDER[plan] ? plan : fallback
}

function getSubscriptionStatus(data = {}) {
  const status = String(data.subscriptionStatus || data.subscription?.status || '').trim().toLowerCase()
  return status === 'pending_checkout' || status === 'billing_pending'
    ? 'checkout_pending'
    : status
}

/**
 * Lê o trialStatus de múltiplos campos possíveis.
 * Não confundir com subscriptionStatus — esse é exclusivo da assinatura.
 */
function getTrialStatus(data = {}) {
  return String(
    data.trialStatus ||
    data.trial?.status ||
    data.billing?.trialStatus ||
    ''
  ).trim().toLowerCase()
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis())
  if (value.seconds) return new Date(Number(value.seconds) * 1000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getTrialEndsAt(data = {}) {
  return (
    data.trialEndsAt ||
    data.trialEndAt ||
    data.trial?.endsAt ||
    data.trial?.trialEndsAt ||
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

function buildBillingAccessResult({
  state,
  canPublishStore,
  canReceiveOrders,
  canAccessDashboard = true,
  messageKey,
  reason = null,
  data = {},
}) {
  return {
    state,
    canPublishStore,
    canReceiveOrders,
    canAccessDashboard,
    messageKey,
    reason,
    planId: data.effectivePlan || data.billingPlan || data.selectedPlan || data.plan || data.planId || null,
    trialEndsAt: getTrialEndsAt(data),
    billingGraceEndsAt: getBillingGraceEndsAt(data),
    subscriptionStatus: getSubscriptionStatus(data) || null,
  }
}

function deriveBillingAccessState(data = {}, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now || Date.now())
  const nowMs = Number.isFinite(now) ? now : Date.now()
  const subscriptionStatus = getSubscriptionStatus(data)
  const trialStatus = getTrialStatus(data)
  const trialEndsAt = toDate(getTrialEndsAt(data))
  const trialStillActive = Boolean(trialEndsAt && trialEndsAt.getTime() > nowMs)

  if (data.isBillingBlocked === true || data.isBlocked === true || data.isDeleted === true || data.deletedAt) {
    return buildBillingAccessResult({
      state: 'blocked',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.blocked',
      reason: data.blockedReason || data.billingBlockedReason || 'blocked',
      data,
    })
  }

  if (subscriptionStatus === 'blocked') {
    return buildBillingAccessResult({
      state: 'blocked',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.blocked',
      reason: 'blocked',
      data,
    })
  }

  if (hasManualGrant(data)) {
    return buildBillingAccessResult({
      state: 'manual_grant',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.manual_grant',
      reason: 'manual_grant',
      data,
    })
  }

  if (hasFreePlan(data)) {
    return buildBillingAccessResult({
      state: 'free_plan',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.free_plan',
      reason: 'free_plan',
      data,
    })
  }

  if (ACTIVE_STATUSES.has(subscriptionStatus)) {
    return buildBillingAccessResult({
      state: 'subscription_active',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.subscription_active',
      data,
    })
  }

  if (subscriptionStatus === 'trialing' || TRIAL_ACTIVE_STATUSES.has(trialStatus) || trialStillActive) {
    if (trialStillActive || (!trialEndsAt && subscriptionStatus === 'trialing')) {
      return buildBillingAccessResult({
        state: 'trial_active',
        canPublishStore: true,
        canReceiveOrders: true,
        messageKey: 'billing.trial_active',
        data,
      })
    }

    return buildBillingAccessResult({
      state: 'trial_expired',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.trial_expired',
      reason: 'trial_expired',
      data,
    })
  }

  if (PENDING_STATUSES.has(subscriptionStatus)) {
    return buildBillingAccessResult({
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
      return buildBillingAccessResult({
        state: 'subscription_grace_period',
        canPublishStore: true,
        canReceiveOrders: true,
        messageKey: 'billing.subscription_grace_period',
        reason: 'past_due_grace_period',
        data,
      })
    }

    return buildBillingAccessResult({
      state: 'subscription_overdue',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.subscription_overdue',
      reason: graceEndsAt ? 'past_due_grace_expired' : 'subscription_overdue',
      data,
    })
  }

  if (CANCELLED_STATUSES.has(subscriptionStatus)) {
    return buildBillingAccessResult({
      state: 'subscription_cancelled',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.subscription_cancelled',
      reason: 'subscription_cancelled',
      data,
    })
  }

  if (hasExpiredTrialSignal(data, nowMs)) {
    return buildBillingAccessResult({
      state: 'trial_expired',
      canPublishStore: false,
      canReceiveOrders: false,
      messageKey: 'billing.trial_expired',
      reason: 'trial_expired',
      data,
    })
  }

  if (!subscriptionStatus && options.allowLegacyAccess === true) {
    return buildBillingAccessResult({
      state: 'manual_grant',
      canPublishStore: true,
      canReceiveOrders: true,
      messageKey: 'billing.legacy_access',
      reason: 'legacy_missing_subscription_status',
      data,
    })
  }

  return buildBillingAccessResult({
    state: 'trial_available',
    canPublishStore: false,
    canReceiveOrders: false,
    messageKey: 'billing.trial_available',
    reason: 'trial_available',
    data,
  })
}

/**
 * Retorna true se a loja estiver em trial ativo por qualquer sinal conhecido:
 * - subscriptionStatus === 'trialing' (Asaas/stripe padrão)
 * - trialStatus ∈ { 'trialing', 'trial', 'active' }
 * - trialEndsAt no futuro (Timestamp Firestore, Date ou string ISO)
 *
 * Nunca lança exceção — em caso de parse inválido retorna false.
 */
function hasActiveTrial(data = {}) {
  // Billing/blocked states always win over stale trial fields.
  if (isPlanAccessBlocked(data)) return false

  const subscriptionStatus = getSubscriptionStatus(data)
  if (subscriptionStatus === 'trialing') return true

  const trialStatus = getTrialStatus(data)
  if (['trialing', 'trial', 'active'].includes(trialStatus)) return true

  const trialEndsAt =
    data.trialEndsAt ||
    data.trialEndAt ||
    data.trial?.endsAt ||
    data.billing?.trialEndsAt

  try {
    const endDate =
      typeof trialEndsAt?.toDate === 'function'
        ? trialEndsAt.toDate()
        : trialEndsAt
          ? new Date(trialEndsAt)
          : null

    if (endDate && Number.isFinite(endDate.getTime()) && endDate.getTime() > Date.now()) {
      return true
    }
  } catch (_) {
    // parse inválido → não é trial
  }

  return false
}

function isPlanAccessBlocked(data = {}) {
  if (!data) return true
  if (data.isBillingBlocked === true || data.isBlocked === true || data.isDeleted === true || data.deletedAt) return true
  const status = getSubscriptionStatus(data)
  return status ? BLOCKED_STATUSES.has(status) : false
}

function getEffectivePlan(data = {}) {
  if (isPlanAccessBlocked(data)) return null

  if (hasActiveTrial(data)) {
    return normalizePlanId(
      data.trialEntitlementsPlan || data.trial?.entitlementsPlan,
      PLAN_IDS.PREMIUM
    )
  }

  return normalizePlanId(
    data.effectivePlan ||
      data.billingPlan ||
      data.selectedPlan ||
      data.plan ||
      data.planId,
    PLAN_IDS.ESSENTIAL
  )
}

function planMeets(planId, requiredPlanId) {
  const plan = normalizePlanId(planId, '')
  const required = normalizePlanId(requiredPlanId, '')
  if (!plan || !required) return false
  return PLAN_ORDER[plan] >= PLAN_ORDER[required]
}

function getRequiredPlanForFeature(featureKey) {
  return FEATURE_MIN_PLANS[featureKey] || null
}

function hasPlanFeature(dataOrPlanId, featureKey) {
  const planId = typeof dataOrPlanId === 'string' ? normalizePlanId(dataOrPlanId) : getEffectivePlan(dataOrPlanId)
  const required = getRequiredPlanForFeature(featureKey)
  if (!required) return false
  return planMeets(planId, required)
}

function getStorePlanLimit(dataOrPlanId, limitKey) {
  const planId = typeof dataOrPlanId === 'string' ? normalizePlanId(dataOrPlanId) : getEffectivePlan(dataOrPlanId)
  if (!planId) return 0
  return PLAN_LIMITS[planId]?.[limitKey] ?? 0
}

function assertPlanFeature(dataOrPlanId, featureKey, message) {
  if (hasPlanFeature(dataOrPlanId, featureKey)) return
  const error = new Error(message || 'Recurso nao disponivel no plano atual.')
  error.code = 'failed-precondition'
  error.requiredPlan = getRequiredPlanForFeature(featureKey)
  error.featureKey = featureKey
  throw error
}

module.exports = {
  PLAN_IDS,
  PLAN_LIMITS,
  FEATURE_MIN_PLANS,
  getEffectivePlan,
  getRequiredPlanForFeature,
  getStorePlanLimit,
  hasPlanFeature,
  hasActiveTrial,
  isPlanAccessBlocked,
  assertPlanFeature,
  normalizePlanId,
  deriveBillingAccessState,
}
