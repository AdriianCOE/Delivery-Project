const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildAsaasOrderExternalReference,
  buildAsaasPendingPaymentSnapshot,
  parseAsaasOrderExternalReference,
  sanitizePublicStorePayments,
} = require('./asaasOrders')

test('sanitizePublicStorePayments exposes only safe Asaas order fields', () => {
  const result = sanitizePublicStorePayments({
    paymentMethods: { pix: true, card: false, cash: true },
    payments: {
      asaas: {
        enabled: true,
        status: 'active',
        maxInstallmentCount: 6,
        apiKey: 'secret',
        webhookSecret: 'secret',
      },
      preorderPolicy: {
        mode: 'asaas_online',
      },
    },
  })

  assert.deepEqual(result, {
    manual: { pix: true, card: false, cash: true },
    asaas: {
      enabled: true,
      status: 'active',
      billingType: 'UNDEFINED',
      maxInstallmentCount: 6,
    },
    preorderPolicy: {
      mode: 'asaas_online',
      requiredMethod: 'asaas_online',
    },
  })
  assert.equal(result.asaas.apiKey, undefined)
  assert.equal(result.asaas.webhookSecret, undefined)
})

test('sanitizePublicStorePayments keeps inactive Asaas disabled', () => {
  const result = sanitizePublicStorePayments({
    payments: {
      asaas: {
        enabled: true,
        status: 'pending',
        maxInstallmentCount: 99,
      },
    },
  })

  assert.equal(result.asaas.enabled, false)
  assert.equal(result.asaas.status, 'pending')
  assert.equal(result.asaas.maxInstallmentCount, null)
})

test('Asaas order externalReference round-trips store and order ids', () => {
  const externalReference = buildAsaasOrderExternalReference({
    storeId: 'store/unsafe',
    orderId: 'order#unsafe',
  })

  assert.equal(externalReference, 'pratoby:order:store_unsafe:order_unsafe')
  assert.deepEqual(parseAsaasOrderExternalReference(externalReference), {
    storeId: 'store_unsafe',
    orderId: 'order_unsafe',
  })
})

test('buildAsaasPendingPaymentSnapshot stores blocked online payment state', () => {
  const snapshot = buildAsaasPendingPaymentSnapshot({
    totalCents: 12345,
    storeId: 'store1',
    storeSlug: 'minha-loja',
    orderId: 'order1',
  })

  assert.equal(snapshot.paymentMode, 'online')
  assert.equal(snapshot.paymentProvider, 'asaas')
  assert.equal(snapshot.paymentStatus, 'pending')
  assert.equal(snapshot.operationalBlockedReason, 'awaiting_online_payment')
  assert.equal(snapshot.payment.amount, 123.45)
  assert.equal(snapshot.payment.externalReference, 'pratoby:order:store1:order1')
})
