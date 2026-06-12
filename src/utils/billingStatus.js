export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getTrialDaysRemaining(trialEndsAt) {
  const date = toDate(trialEndsAt)
  if (!date) return null
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000))
}

export function formatBillingDate(value) {
  const date = toDate(value)
  if (!date) return '-'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatBillingStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  const map = {
    checkout_pending: 'Cobrança Asaas pendente',
    pending_checkout: 'Cobrança Asaas pendente',
    billing_pending: 'Cobrança Asaas pendente',
    billing_pending_payment_method: 'Forma de pagamento pendente',
    trialing: 'Teste grátis ativo',
    trial_ended: 'Teste encerrado',
    active: 'Assinatura ativa',
    past_due: 'Pagamento pendente',
    canceled: 'Assinatura bloqueada/cancelada',
    cancelled: 'Assinatura bloqueada/cancelada',
    blocked: 'Assinatura bloqueada/cancelada',
  }
  return map[normalized] || 'Pendente'
}

export function getBillingStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  const map = {
    checkout_pending: 'orange',
    pending_checkout: 'orange',
    billing_pending: 'orange',
    billing_pending_payment_method: 'orange',
    trialing: 'orange',
    trial_ended: 'red',
    active: 'green',
    past_due: 'red',
    canceled: 'red',
    cancelled: 'red',
    blocked: 'red',
  }
  return map[normalized] || 'orange'
}

export function normalizeBillingCycle(cycle) {
  if (cycle === 'annual' || cycle === 'yearly' || cycle === 'year' || cycle === 'anual') return 'Anual'
  return 'Mensal'
}

export function formatPlanName(plan) {
  const map = {
    essential: 'Essencial',
    professional: 'Profissional',
    premium: 'Premium',
    enterprise: 'Enterprise',
  }
  const normalized = String(plan || '').trim().toLowerCase()
  return map[normalized] || plan || 'Essencial'
}
