import { formatBillingDate } from './billingStatus'
import { getFeatureLabel, getPlanConfig, getRequiredPlanForFeature } from './planCatalog'

function formatCurrencyBR(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getPlanName(planId) {
  return getPlanConfig(planId).name
}

function getPlanPrice(planId) {
  return getPlanConfig(planId).priceMonthly
}

export function getTrialPremiumActiveMessage({ trialEndsAt, selectedPlan, amount } = {}) {
  const planName = getPlanName(selectedPlan)
  const price = amount ?? getPlanPrice(selectedPlan)

  return {
    title: 'Trial Premium ativo',
    text: `Seu trial Premium está ativo até ${formatBillingDate(trialEndsAt)}. Após o trial, sua loja continuará no plano ${planName} por ${formatCurrencyBR(price)}/mês.`,
  }
}

export function getTrialEndingSoonMessage({ daysRemaining, selectedPlan } = {}) {
  const days = Number.isFinite(Number(daysRemaining)) ? Number(daysRemaining) : 0

  return {
    title: `Seu trial termina em ${days} dia${days === 1 ? '' : 's'}`,
    text: `Você ainda está usando os recursos Premium gratuitamente. Após o trial, sua loja continuará no plano ${getPlanName(selectedPlan)}. Alguns recursos Premium podem ficar indisponíveis se não fizerem parte do seu plano.`,
  }
}

export function getFutureBillingCanceledMessage({ trialEndsAt } = {}) {
  return {
    title: 'Cobrança futura cancelada',
    text: `Seu acesso Premium gratuito continua até ${formatBillingDate(trialEndsAt)}. Depois disso, sua loja ficará pausada para novos pedidos. Seus dados ficarão salvos caso queira voltar.`,
  }
}

export function getTrialEndedActiveMessage({ selectedPlan } = {}) {
  return {
    title: 'Seu trial terminou',
    text: `Sua loja agora está ativa no plano ${getPlanName(selectedPlan)}. Os recursos disponíveis foram ajustados conforme o seu plano atual.`,
  }
}

export function getTrialEndedInactiveMessage() {
  return {
    title: 'Sua loja está pausada',
    text: 'Seu trial terminou e não há uma assinatura ativa. Para voltar a receber pedidos, reative sua assinatura.',
  }
}

export function getInsufficientPlanMessage({ featureKey, featureName, requiredPlan } = {}) {
  const requiredPlanId = requiredPlan || getRequiredPlanForFeature(featureKey)
  const resourceName = featureName || getFeatureLabel(featureKey)

  return {
    title: `Recurso disponível no plano ${getPlanName(requiredPlanId)}`,
    text: `O recurso ${resourceName} não está incluído no seu plano atual. Faça upgrade para liberar esse recurso.`,
  }
}

export function getTrialUsedFeatureMessage({ featureKey, featureName, requiredPlan } = {}) {
  const requiredPlanId = requiredPlan || getRequiredPlanForFeature(featureKey)
  const resourceName = featureName || getFeatureLabel(featureKey)

  return {
    title: 'Recurso usado durante o trial Premium',
    text: `Você configurou ${resourceName} enquanto estava testando o Premium. Essa configuração continua salva, mas para continuar usando é necessário estar no plano ${getPlanName(requiredPlanId)} ou superior.`,
  }
}

export function getPlanLimitReachedMessage({ limit, item } = {}) {
  return {
    title: 'Limite do plano atingido',
    text: `Seu plano atual permite até ${limit} ${item}. Para adicionar mais, faça upgrade para um plano com limites maiores.`,
  }
}
