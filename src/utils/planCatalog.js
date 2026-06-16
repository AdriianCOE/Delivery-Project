import { FiAward, FiStar, FiZap } from 'react-icons/fi'

export const PLAN_IDS = {
  ESSENTIAL: 'essential',
  PROFESSIONAL: 'professional',
  PREMIUM: 'premium',
}

export const PLAN_ORDER = {
  [PLAN_IDS.ESSENTIAL]: 1,
  [PLAN_IDS.PROFESSIONAL]: 2,
  [PLAN_IDS.PREMIUM]: 3,
}

export const BLOCKED_PLAN_STATUSES = [
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
]

// Limites de quantidade ficam centralizados aqui. O enforcement real para
// produtos/categorias/cupons ainda exige callable/counter transacional; por
// enquanto, parte desses limites é aplicada na UI e em validações pontuais.
export const PLAN_LIMITS = {
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

export const PLAN_FEATURES = {
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

export const UPGRADE_PROMPT_COPY = {
  title: 'Recurso disponível em outro plano',
  description: 'Este recurso não está incluído no seu plano atual. Faça upgrade para liberar e continuar usando no PratoBy.',
  primaryAction: 'Fazer upgrade',
  secondaryAction: 'Ver planos',
}

export const FEATURE_LABELS = {
  scheduling: 'Agendamento e encomendas',
  coupons: 'Cupons de desconto',
  advancedReports: 'Relatórios avançados',
  customBranding: 'Personalização avançada',
  removePratoByBranding: 'Remover marca PratoBy',
  multiUser: 'Usuários extras',
  deliveryZonesAdvanced: 'Entrega avançada',
  onlinePayments: 'Pagamento online',
  tableQrCode: 'QR por mesa',
}

export const PLAN_OPTIONS = [
  {
    id: 'essential',
    name: 'Essencial',
    subtitle: 'Para começar a vender online',
    description: 'Cardápio público, pedidos básicos, Pix manual e pagamento online para validar a operação.',
    priceMonthly: 59.99,
    priceAnnual: 599.90,
    equivalentMonthly: 49.99,
    commission: 'Sem comissão do PratoBy por pedido',
    icon: FiZap,
    highlight: false,
    popular: false,
    cta: 'Começar agora',
    features: [
      '14 dias grátis com recursos Premium',
      'Cardápio público',
      'Pedidos em tempo real',
      'Link e QR da loja',
      'Pix manual e pagamento online',
      'Tracking do pedido',
      'Impressão de comanda',
      'Relatórios básicos',
      'Até 50 produtos',
      'Sem comissão do PratoBy por pedido',
    ],
  },
  {
    id: 'professional',
    name: 'Profissional',
    subtitle: 'Mais escolhido pelos lojistas',
    description: 'Mais recursos para vender por encomenda, criar campanhas e operar com uma equipe pequena.',
    priceMonthly: 89.99,
    priceAnnual: 899.90,
    equivalentMonthly: 74.99,
    commission: 'Sem comissão do PratoBy por pedido',
    icon: FiStar,
    highlight: true,
    popular: true,
    badge: 'Mais popular',
    cta: 'Começar agora',
    features: [
      '14 dias grátis com recursos Premium',
      'Tudo do Essencial',
      'Agendamento e encomendas',
      'Cupons de desconto',
      'Taxa por bairro avançada',
      'Até 200 produtos',
      'Até 3 usuários',
      'Até 20 cupons ativos',
      'Pagamento online incluído',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Para operações que precisam de mais controle',
    description: 'Limites altos, personalização avançada quando disponível e suporte prioritário.',
    priceMonthly: 159.99,
    priceAnnual: 1599.90,
    equivalentMonthly: 133.33,
    commission: 'Sem comissão do PratoBy por pedido',
    icon: FiAward,
    highlight: false,
    popular: false,
    cta: 'Começar agora',
    features: [
      '14 dias grátis com recursos Premium',
      'Tudo do Profissional',
      'Até 1000 produtos',
      'Até 10 usuários',
      'Personalização avançada',
      'Ocultar marca PratoBy',
      'Suporte prioritário',
    ],
  },
]

export function normalizePlanId(planId, fallback = PLAN_IDS.ESSENTIAL) {
  const normalized = String(planId || '').trim().toLowerCase()
  return PLAN_ORDER[normalized] ? normalized : fallback
}

export function getPlanConfig(planId) {
  const normalized = normalizePlanId(planId)
  return PLAN_OPTIONS.find((plan) => plan.id === normalized) || PLAN_OPTIONS[0]
}

export function getRequiredPlanForFeature(featureKey) {
  return PLAN_FEATURES[featureKey] || null
}

export function getFeatureLabel(featureKey) {
  return FEATURE_LABELS[featureKey] || featureKey || 'Recurso'
}

export function hasFeature(planId, featureKey) {
  const requiredPlan = getRequiredPlanForFeature(featureKey)
  if (!requiredPlan) return false
  return PLAN_ORDER[normalizePlanId(planId)] >= PLAN_ORDER[requiredPlan]
}

export function getPlanLimit(planId, limitKey) {
  return PLAN_LIMITS[normalizePlanId(planId)]?.[limitKey] ?? 0
}

/**
 * Lê o trialStatus de múltiplos campos possíveis.
 */
function getTrialStatus(storeData = {}) {
  return String(
    storeData.trialStatus ||
    storeData.trial?.status ||
    storeData.billing?.trialStatus ||
    ''
  ).trim().toLowerCase()
}

function getSubscriptionStatus(storeData = {}) {
  return String(storeData.subscriptionStatus || storeData.subscription?.status || '').trim().toLowerCase()
}

/**
 * Retorna true se a loja estiver em trial ativo por qualquer sinal conhecido:
 * - subscriptionStatus === 'trialing'
 * - trialStatus ∈ { 'trialing', 'trial', 'active' }
 * - trialEndsAt no futuro
 *
 * Nunca lança exceção.
 */
export function hasActiveTrial(storeData = {}) {
  const subscriptionStatus = getSubscriptionStatus(storeData)

  // Não liberar trial em estados bloqueados
  if (
    storeData.isBillingBlocked === true ||
    storeData.isBlocked === true ||
    storeData.isDeleted === true ||
    Boolean(storeData.deletedAt) ||
    BLOCKED_PLAN_STATUSES.includes(subscriptionStatus)
  ) return false

  if (subscriptionStatus === 'trialing') return true

  const trialStatus = getTrialStatus(storeData)
  if (['trialing', 'trial', 'active'].includes(trialStatus)) return true

  const trialEndsAt =
    storeData.trialEndsAt ||
    storeData.trialEndAt ||
    storeData.trial?.endsAt ||
    storeData.billing?.trialEndsAt

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
    // parse inválido — não é trial
  }

  return false
}

export function getEffectivePlan(storeData = {}) {
  const status = getSubscriptionStatus(storeData)

  if (
    storeData.isBillingBlocked === true ||
    storeData.isBlocked === true ||
    storeData.isDeleted === true ||
    Boolean(storeData.deletedAt) ||
    BLOCKED_PLAN_STATUSES.includes(status)
  ) {
    return null
  }

  if (hasActiveTrial(storeData)) {
    return normalizePlanId(
      storeData.trialEntitlementsPlan || storeData.trial?.entitlementsPlan,
      PLAN_IDS.PREMIUM
    )
  }

  return normalizePlanId(
    storeData.effectivePlan ||
      storeData.billingPlan ||
      storeData.selectedPlan ||
      storeData.plan ||
      storeData.planId
  )
}

export function hasPlanFeature(storeData = {}, featureKey) {
  const planId = getEffectivePlan(storeData)
  return planId ? hasFeature(planId, featureKey) : false
}

export function getStorePlanLimit(storeData = {}, limitKey) {
  const planId = getEffectivePlan(storeData)
  return planId ? getPlanLimit(planId, limitKey) : 0
}
