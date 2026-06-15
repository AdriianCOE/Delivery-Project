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
    tables: 50,
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
  tableQrCode: PLAN_IDS.PROFESSIONAL,
  dineInOrdering: PLAN_IDS.PROFESSIONAL,
  scheduling: PLAN_IDS.PROFESSIONAL,
  coupons: PLAN_IDS.PROFESSIONAL,
  deliveryZonesAdvanced: PLAN_IDS.PROFESSIONAL,
  multiUser: PLAN_IDS.PROFESSIONAL,

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
])

function normalizePlanId(value, fallback = PLAN_IDS.ESSENTIAL) {
  const plan = String(value || '').trim().toLowerCase()
  return PLAN_ORDER[plan] ? plan : fallback
}

function getSubscriptionStatus(data = {}) {
  return String(data.subscriptionStatus || data.subscription?.status || '').trim().toLowerCase()
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

/**
 * Retorna true se a loja estiver em trial ativo por qualquer sinal conhecido:
 * - subscriptionStatus === 'trialing' (Asaas/stripe padrão)
 * - trialStatus ∈ { 'trialing', 'trial', 'active' }
 * - trialEndsAt no futuro (Timestamp Firestore, Date ou string ISO)
 *
 * Nunca lança exceção — em caso de parse inválido retorna false.
 */
function hasActiveTrial(data = {}) {
  const subscriptionStatus = getSubscriptionStatus(data)
  if (subscriptionStatus === 'trialing') return true

  // Rejeitar estados bloqueados antes de checar trialStatus
  if (isPlanAccessBlocked(data)) return false

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
}
