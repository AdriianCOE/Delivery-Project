const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildAsaasOrderExternalReference,
  buildAsaasPendingPaymentSnapshot,
  mapAsaasOrderPaymentStatus,
  parseAsaasOrderExternalReference,
  sanitizePublicStorePayments,
} = require('./asaasOrders')

test('sanitizePublicStorePayments hides Asaas Orders and exposes safe Mercado Pago fields', () => {
  const result = sanitizePublicStorePayments({
    paymentMethods: { pix: true, card: false, cash: true },
    payments: {
      asaas: {
        enabled: true,
        status: 'active',
        maxInstallmentCount: 6,
        allowPix: true,
        allowCreditCard: false,
        allowBoleto: true,
        apiKey: 'secret',
        webhookSecret: 'secret',
      },
      mercadoPago: {
        enabled: true,
        status: 'active',
        accessToken: 'secret',
        refreshToken: 'secret',
      },
      preorderPolicy: {
        mode: 'asaas_online',
      },
    },
  })

  assert.deepEqual(result, {
    manual: { pix: true, card: false, cash: true },
    asaas: {
      enabled: false,
      status: 'active',
      legacy: true,
      billingType: 'UNDEFINED',
      allowPix: true,
      allowCreditCard: false,
      allowBoleto: true,
      maxInstallmentCount: 6,
    },
    mercadoPago: {
      enabled: true,
      status: 'active',
      allowPix: true,
      allowCreditCard: true,
      maxInstallmentCount: 1,
      requireForScheduled: false,
      minOrderCents: 0,
    },
    mercadopago: {
      enabled: true,
      status: 'active',
      allowPix: true,
      allowCreditCard: true,
      maxInstallmentCount: 1,
      requireForScheduled: false,
      minOrderCents: 0,
    },
    preorderPolicy: {
      mode: 'mercadopago_online',
      requiredMethod: 'mercadopago_online',
      legacyMode: 'asaas_online',
    },
  })
  assert.equal(result.asaas.apiKey, undefined)
  assert.equal(result.asaas.webhookSecret, undefined)
  assert.equal(result.mercadoPago.accessToken, undefined)
  assert.equal(result.mercadoPago.refreshToken, undefined)
  assert.equal(result.mercadoPago.provider, undefined)
  assert.equal(result.mercadoPago.environment, undefined)
  assert.equal(result.mercadoPago.sandboxMode, undefined)
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
  assert.equal(result.asaas.legacy, true)
  assert.equal(result.asaas.maxInstallmentCount, null)
  assert.equal(result.mercadoPago.enabled, false)
  assert.equal(result.mercadopago.enabled, false)
})

test('mapAsaasOrderPaymentStatus keeps partial refund distinct', () => {
  assert.equal(mapAsaasOrderPaymentStatus('PAYMENT_PARTIALLY_REFUNDED'), 'partially_refunded')
  assert.equal(mapAsaasOrderPaymentStatus('PAYMENT_REFUNDED'), 'refunded')
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
