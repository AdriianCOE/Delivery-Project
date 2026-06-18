const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildMercadoPagoExternalReference,
  buildMercadoPagoPendingPaymentSnapshot,
  buildMercadoPagoPreferencePayload,
  isMercadoPagoOnlinePaymentRequest,
  mapMercadoPagoPaymentStatus,
  normalizeMercadoPagoPublicConfig,
  normalizePreorderPolicy,
  orderRequiresMercadoPagoOnline,
  parseMercadoPagoExternalReference,
} = require('./mercadoPagoOrders')

test('normalizeMercadoPagoPublicConfig exposes only safe public fields', () => {
  const result = normalizeMercadoPagoPublicConfig({
    payments: {
      mercadoPago: {
        enabled: true,
        status: 'active',
        environment: 'sandbox',
        allowPix: true,
        allowCreditCard: false,
        maxInstallmentCount: 18,
        requireForScheduled: true,
        minOrderCents: 2500,
        accessToken: 'secret',
        refreshToken: 'secret',
        clientSecret: 'secret',
      },
    },
  })

  assert.deepEqual(result, {
    provider: 'mercadopago',
    enabled: true,
    status: 'active',
    environment: 'sandbox',
    allowPix: true,
    allowCreditCard: false,
    maxInstallmentCount: 1,
    requireForScheduled: true,
    minOrderCents: 2500,
    sandboxMode: true,
  })
  assert.equal(result.accessToken, undefined)
  assert.equal(result.refreshToken, undefined)
  assert.equal(result.clientSecret, undefined)
})

test('Mercado Pago preorder policy can require online payment for scheduled orders', () => {
  const store = {
    payments: {
      preorderPolicy: { mode: 'mercadopago_online' },
    },
  }

  assert.deepEqual(normalizePreorderPolicy(store), {
    mode: 'mercadopago_online',
    requiredMethod: 'mercadopago_online',
  })
  assert.equal(orderRequiresMercadoPagoOnline({
    store,
    schedulingDecision: { orderTiming: 'scheduled' },
  }), true)
  assert.equal(orderRequiresMercadoPagoOnline({
    store,
    schedulingDecision: { orderTiming: 'asap' },
  }), false)
})

test('legacy Asaas preorder policy maps to Mercado Pago when connected', () => {
  const store = {
    payments: {
      mercadoPago: {
        enabled: true,
        status: 'active',
      },
      preorderPolicy: { mode: 'manual_or_asaas' },
    },
  }

  assert.deepEqual(normalizePreorderPolicy(store), {
    mode: 'manual_or_mercadopago',
    requiredMethod: 'manual_or_mercadopago',
    legacyMode: 'manual_or_asaas',
  })
})

test('legacy Asaas preorder policy falls back to manual when Mercado Pago is inactive', () => {
  const store = {
    payments: {
      mercadoPago: {
        enabled: false,
        status: 'not_connected',
      },
      preorderPolicy: { mode: 'asaas_online' },
    },
  }

  assert.deepEqual(normalizePreorderPolicy(store), {
    mode: 'manual',
    legacyMode: 'asaas_online',
  })
})

test('Mercado Pago payment request accepts method and provider forms', () => {
  assert.equal(isMercadoPagoOnlinePaymentRequest({ paymentMethod: 'mercadopago_online' }), true)
  assert.equal(isMercadoPagoOnlinePaymentRequest({ paymentMode: 'online', paymentProvider: 'mercadopago' }), true)
  assert.equal(isMercadoPagoOnlinePaymentRequest({ paymentMethod: 'asaas_online' }), false)
})

test('Mercado Pago externalReference round-trips store and order ids', () => {
  const externalReference = buildMercadoPagoExternalReference({
    storeId: 'store/unsafe',
    orderId: 'order#unsafe',
  })

  assert.equal(externalReference, 'pratoby:order:store_unsafe:order_unsafe')
  assert.deepEqual(parseMercadoPagoExternalReference(externalReference), {
    storeId: 'store_unsafe',
    orderId: 'order_unsafe',
  })
})

test('buildMercadoPagoPendingPaymentSnapshot stores pending online state', () => {
  const snapshot = buildMercadoPagoPendingPaymentSnapshot({
    totalCents: 12345,
    storeId: 'store1',
    storeSlug: 'minha-loja',
    orderId: 'order1',
  })

  assert.equal(snapshot.paymentMode, 'online')
  assert.equal(snapshot.paymentProvider, 'mercadopago')
  assert.equal(snapshot.paymentStatus, 'pending_payment')
  assert.equal(snapshot.operationalBlockedReason, 'awaiting_online_payment')
  assert.equal(snapshot.payment.amount, 123.45)
  assert.equal(snapshot.payment.externalReference, 'pratoby:order:store1:order1')
})

test('buildMercadoPagoPreferencePayload sends cents as BRL money', () => {
  const previousWebhookUrl = process.env.MERCADOPAGO_ORDER_WEBHOOK_URL
  const previousPublicUrl = process.env.PUBLIC_APP_URL
  process.env.MERCADOPAGO_ORDER_WEBHOOK_URL = 'https://example.com/mp/webhook'
  process.env.PUBLIC_APP_URL = 'https://example.com'

  try {
    const payload = buildMercadoPagoPreferencePayload({
      orderData: {
        id: 'order1',
        trackingToken: 'track1',
        storeId: 'store1',
        storeDocId: 'store1',
        storeSlug: 'minha-loja',
        trackingUrlPath: '/minha-loja/pedido/track1',
        totalCents: 12345,
        payment: {
          amountCents: 12345,
        },
      },
      storeData: {
        name: 'Minha loja',
        payments: {
          mercadoPago: {
            enabled: true,
            status: 'active',
          },
        },
      },
    })

    assert.equal(payload.items[0].unit_price, 123.45)
    assert.equal(payload.back_urls.success, 'https://example.com/minha-loja/pedido/track1')
  } finally {
    if (previousWebhookUrl === undefined) {
      delete process.env.MERCADOPAGO_ORDER_WEBHOOK_URL
    } else {
      process.env.MERCADOPAGO_ORDER_WEBHOOK_URL = previousWebhookUrl
    }

    if (previousPublicUrl === undefined) {
      delete process.env.PUBLIC_APP_URL
    } else {
      process.env.PUBLIC_APP_URL = previousPublicUrl
    }
  }
})

test('mapMercadoPagoPaymentStatus keeps paid pending and failure states explicit', () => {
  assert.equal(mapMercadoPagoPaymentStatus({ status: 'approved' }), 'paid')
  assert.equal(mapMercadoPagoPaymentStatus({ status: 'in_process' }), 'pending_payment')
  assert.equal(mapMercadoPagoPaymentStatus({ status: 'rejected' }), 'failed')
  assert.equal(mapMercadoPagoPaymentStatus({ status: 'cancelled' }), 'canceled')
  assert.equal(mapMercadoPagoPaymentStatus({ status: 'refunded' }), 'refunded')
})
