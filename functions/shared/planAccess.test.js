const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getEffectivePlan,
  getStorePlanLimit,
  hasActiveTrial,
  hasPlanFeature,
  deriveBillingAccessState,
} = require('./planAccess')

test('Essential ativo sem trial nao libera scheduling', () => {
  const store = { subscriptionStatus: 'active', plan: 'essential' }

  assert.equal(getEffectivePlan(store), 'essential')
  assert.equal(hasPlanFeature(store, 'scheduling'), false)
})

test('Professional ativo libera scheduling', () => {
  const store = { subscriptionStatus: 'active', plan: 'professional' }

  assert.equal(getEffectivePlan(store), 'professional')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
})

test('Premium ativo libera scheduling e QR por mesa', () => {
  const store = { subscriptionStatus: 'active', plan: 'premium' }

  assert.equal(getEffectivePlan(store), 'premium')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
  assert.equal(hasPlanFeature(store, 'tableQrCode'), true)
  assert.equal(getStorePlanLimit(store, 'tables'), 200)
})

test('Professional nao libera QR por mesa', () => {
  const store = { subscriptionStatus: 'active', plan: 'professional' }

  assert.equal(hasPlanFeature(store, 'tableQrCode'), false)
  assert.equal(getStorePlanLimit(store, 'tables'), 0)
})

test('QR de cardapio simples fica liberado para todos os planos', () => {
  assert.equal(hasPlanFeature({ subscriptionStatus: 'active', plan: 'essential' }, 'menuQrCode'), true)
  assert.equal(hasPlanFeature({ subscriptionStatus: 'active', plan: 'professional' }, 'menuQrCode'), true)
  assert.equal(hasPlanFeature({ subscriptionStatus: 'active', plan: 'premium' }, 'menuQrCode'), true)
})

test('subscriptionStatus trialing libera como Premium', () => {
  const store = { subscriptionStatus: 'trialing', billingPlan: 'essential' }

  assert.equal(hasActiveTrial(store), true)
  assert.equal(getEffectivePlan(store), 'premium')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
  assert.equal(hasPlanFeature(store, 'tableQrCode'), true)
})

test('trialStatus active libera como Premium', () => {
  const store = { subscriptionStatus: 'active', trialStatus: 'active', billingPlan: 'essential' }

  assert.equal(hasActiveTrial(store), true)
  assert.equal(getEffectivePlan(store), 'premium')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
})

test('trial.status active libera como Premium', () => {
  const store = { subscriptionStatus: 'active', trial: { status: 'active' }, selectedPlan: 'essential' }

  assert.equal(hasActiveTrial(store), true)
  assert.equal(getEffectivePlan(store), 'premium')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
})

test('trialEndsAt no futuro libera como Premium', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const store = { subscriptionStatus: 'active', trialEndsAt: future, selectedPlan: 'essential' }

  assert.equal(hasActiveTrial(store), true)
  assert.equal(getEffectivePlan(store), 'premium')
  assert.equal(hasPlanFeature(store, 'scheduling'), true)
})

test('blocked nao libera mesmo com trial ativo', () => {
  const store = { subscriptionStatus: 'blocked', trialStatus: 'active', selectedPlan: 'premium' }

  assert.equal(hasActiveTrial(store), false)
  assert.equal(getEffectivePlan(store), null)
  assert.equal(hasPlanFeature(store, 'scheduling'), false)
})

test('past_due nao libera mesmo com trial ativo', () => {
  const store = { subscriptionStatus: 'past_due', trial: { status: 'active' }, selectedPlan: 'premium' }

  assert.equal(hasActiveTrial(store), false)
  assert.equal(getEffectivePlan(store), null)
  assert.equal(hasPlanFeature(store, 'scheduling'), false)
})

test('isBillingBlocked nao libera mesmo com trialing', () => {
  const store = { subscriptionStatus: 'trialing', isBillingBlocked: true, selectedPlan: 'premium' }

  assert.equal(hasActiveTrial(store), false)
  assert.equal(getEffectivePlan(store), null)
  assert.equal(hasPlanFeature(store, 'scheduling'), false)
})

test('deriveBillingAccessState diferencia trial disponivel de trial expirado', () => {
  const now = new Date('2026-06-26T12:00:00.000Z')

  assert.equal(deriveBillingAccessState({}, { now }).state, 'trial_available')

  const expired = deriveBillingAccessState({
    trialUsed: true,
    trialEndsAt: '2026-06-20T12:00:00.000Z',
  }, { now })

  assert.equal(expired.state, 'trial_expired')
  assert.equal(expired.canReceiveOrders, false)
})

test('deriveBillingAccessState trata trialing vencido como trial_expired', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-06-20T12:00:00.000Z',
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(state.state, 'trial_expired')
  assert.equal(state.canPublishStore, false)
})

test('deriveBillingAccessState libera trial ativo', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-06-30T12:00:00.000Z',
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(state.state, 'trial_active')
  assert.equal(state.canReceiveOrders, true)
})

test('deriveBillingAccessState mapeia estados de assinatura', () => {
  assert.equal(deriveBillingAccessState({ subscriptionStatus: 'checkout_pending' }).state, 'subscription_pending')
  assert.equal(deriveBillingAccessState({ subscriptionStatus: 'active' }).state, 'subscription_active')
  assert.equal(deriveBillingAccessState({ subscriptionStatus: 'past_due' }).state, 'subscription_overdue')
  assert.equal(deriveBillingAccessState({ subscriptionStatus: 'blocked' }).state, 'blocked')
  assert.equal(deriveBillingAccessState({ subscriptionStatus: 'canceled' }).state, 'subscription_cancelled')
})

test('deriveBillingAccessState preserva grace period vigente para past_due', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'past_due',
    billingGraceEndsAt: '2026-06-30T12:00:00.000Z',
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(state.state, 'subscription_grace_period')
  assert.equal(state.canPublishStore, true)
  assert.equal(state.canReceiveOrders, true)
  assert.equal(state.reason, 'past_due_grace_period')
})

test('deriveBillingAccessState bloqueia past_due com grace vencido', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'past_due',
    billingGraceEndsAt: '2026-06-20T12:00:00.000Z',
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(state.state, 'subscription_overdue')
  assert.equal(state.canReceiveOrders, false)
  assert.equal(state.reason, 'past_due_grace_expired')
})

test('deriveBillingAccessState assinatura ativa vence trial expirado', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'active',
    trialUsed: true,
    trialEndsAt: '2026-06-20T12:00:00.000Z',
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(state.state, 'subscription_active')
  assert.equal(state.canReceiveOrders, true)
})

test('deriveBillingAccessState bloqueio administrativo vence assinatura ativa', () => {
  const state = deriveBillingAccessState({
    subscriptionStatus: 'active',
    isBillingBlocked: true,
  })

  assert.equal(state.state, 'blocked')
  assert.equal(state.canReceiveOrders, false)
})

test('deriveBillingAccessState suporta grant manual e legado explicito', () => {
  assert.equal(deriveBillingAccessState({ manualGrant: true }).state, 'manual_grant')
  assert.equal(deriveBillingAccessState({}).state, 'trial_available')
  assert.equal(deriveBillingAccessState({}, { allowLegacyAccess: true }).state, 'manual_grant')
})
