const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getEffectivePlan,
  getStorePlanLimit,
  hasActiveTrial,
  hasPlanFeature,
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
