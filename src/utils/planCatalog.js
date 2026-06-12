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

export const UPGRADE_PROMPT_COPY = {
  title: 'Recurso não disponível no seu plano atual',
  description: 'Esse recurso faz parte de um plano superior. Faça upgrade para liberar essa funcionalidade e continuar usando no PratoBy.',
  primaryAction: 'Fazer upgrade',
  secondaryAction: 'Ver planos',
}

export const PLAN_OPTIONS = [
  {
    id: 'essential',
    name: 'Essencial',
    subtitle: 'Para começar a vender online',
    description: 'Para começar a vender online',
    priceMonthly: 59.99,
    priceAnnual: 599.90,
    equivalentMonthly: 49.99,
    commission: '+ 0% de comissão por venda',
    icon: FiZap,
    highlight: false,
    popular: false,
    cta: 'Começar agora',
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
    name: 'Professional',
    subtitle: 'Mais escolhido pelos lojistas',
    description: 'Mais escolhido pelos lojistas',
    priceMonthly: 89.99,
    priceAnnual: 899.90,
    equivalentMonthly: 74.99,
    commission: '+ 0% de comissão por venda',
    icon: FiStar,
    highlight: true,
    popular: true,
    badge: 'Mais popular',
    cta: 'Começar agora',
    features: [
      '14 dias grátis inclusos',
      'Tudo do Essencial',
      'Cupons de desconto',
      'Taxa por bairro',
      'Campos personalizados',
      'Relatórios avançados',
      'Notificações Push',
      'Suporte prioritário',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Para quem quer vender mais',
    description: 'Para quem quer vender mais',
    priceMonthly: 159.99,
    priceAnnual: 1599.90,
    equivalentMonthly: 133.33,
    commission: '+ 0% de comissão por venda',
    icon: FiAward,
    highlight: false,
    popular: false,
    cta: 'Começar agora',
    features: [
      '14 dias grátis inclusos',
      'Tudo do Professional',
      'Multi-loja até 3 unidades',
      'API de integração',
      'Domínio personalizado',
      'Marca branca',
      'Gerente de conta dedicado',
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

export function hasFeature(planId, featureKey) {
  const requiredPlan = getRequiredPlanForFeature(featureKey)
  if (!requiredPlan) return false
  return PLAN_ORDER[normalizePlanId(planId)] >= PLAN_ORDER[requiredPlan]
}

export function getPlanLimit(planId, limitKey) {
  return PLAN_LIMITS[normalizePlanId(planId)]?.[limitKey] ?? 0
}

export function getEffectivePlan(storeData = {}) {
  const status = String(storeData.subscriptionStatus || storeData.subscription?.status || '').trim().toLowerCase()
  if (
    storeData.isBillingBlocked === true ||
    storeData.isBlocked === true ||
    ['blocked', 'canceled', 'cancelled', 'checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'].includes(status)
  ) {
    return null
  }
  if (status === 'trialing') return PLAN_IDS.PREMIUM
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

