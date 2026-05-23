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
  const map = {
    checkout_pending: 'Checkout pendente',
    trialing: 'Teste gratis ativo',
    active: 'Assinatura ativa',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelada',
    blocked: 'Bloqueada',
  }
  return map[status] || status || 'Pendente'
}

export function getBillingStatusTone(status) {
  const map = {
    checkout_pending: 'orange',
    trialing: 'orange',
    active: 'green',
    past_due: 'red',
    canceled: 'red',
    blocked: 'red',
  }
  return map[status] || 'orange'
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
  return map[plan] || plan || 'Essencial'
}
