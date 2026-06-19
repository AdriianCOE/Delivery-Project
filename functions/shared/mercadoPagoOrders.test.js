const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildWebhookPaymentPatch,
  buildMercadoPagoExternalReference,
  buildMercadoPagoPendingPaymentSnapshot,
  buildMercadoPagoPreferencePayload,
  findMercadoPagoOrderSnapshot,
  getWebhookPaymentId,
  isMercadoPagoOnlinePaymentRequest,
  mapMercadoPagoPaymentStatus,
  normalizeMercadoPagoPublicConfig,
  normalizePreorderPolicy,
  orderRequiresMercadoPagoOnline,
  parseMercadoPagoExternalReference,
  validateMercadoPagoWebhookSignature,
} = require('./mercadoPagoOrders')

function signMercadoPagoWebhook({ secret, dataId, requestId, ts }) {
  const crypto = require('crypto')
  return crypto
    .createHmac('sha256', secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
}

function fakeAdmin() {
  return {
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'SERVER_TIMESTAMP',
      },
    },
  }
}

function fakeOrdersDb(orders) {
  const docs = new Map(Object.entries(orders))
  const makeSnapshot = (id, data) => ({
    id,
    exists: Boolean(data),
    ref: { id },
    data: () => data,
  })
  const valueAt = (data, field) => field.split('.').reduce((acc, key) => acc?.[key], data)

  return {
    collection(name) {
      assert.equal(name, 'orders')
      return {
        doc(id) {
          return {
            async get() {
              return makeSnapshot(id, docs.get(id))
            },
          }
        },
        where(field, operator, value) {
          assert.equal(operator, '==')
          return {
            limit() {
              return {
                async get() {
                  const match = [...docs.entries()].find(([, data]) => valueAt(data, field) === value)
                  return {
                    empty: !match,
                    docs: match ? [makeSnapshot(match[0], match[1])] : [],
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

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

test('Mercado Pago webhook signature accepts the Webhooks v2 manifest', () => {
  const secret = 'webhook-secret'
  const dataId = '123456789'
  const requestId = 'req-abc-123'
  const ts = '1781730000'
  const v1 = signMercadoPagoWebhook({ secret, dataId, requestId, ts })

  const result = validateMercadoPagoWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: requestId,
    dataId,
    secret,
    nowMs: Number(ts) * 1000,
  })

  assert.deepEqual(result, { ok: true, reason: 'valid' })
})

test('Mercado Pago webhook signature rejects mismatched payloads', () => {
  const secret = 'webhook-secret'
  const ts = '1781730000'
  const v1 = signMercadoPagoWebhook({
    secret,
    dataId: 'payment-1',
    requestId: 'req-1',
    ts,
  })

  const result = validateMercadoPagoWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: 'req-1',
    dataId: 'payment-2',
    secret,
    nowMs: Number(ts) * 1000,
  })

  assert.deepEqual(result, { ok: false, reason: 'signature_mismatch' })
})

test('getWebhookPaymentId reads payment.created and payment.updated payloads', () => {
  assert.equal(
    getWebhookPaymentId({ query: {} }, { action: 'payment.created', type: 'payment', data: { id: 'pay-1' } }),
    'pay-1'
  )
  assert.equal(
    getWebhookPaymentId(
      { query: {} },
      { action: 'payment.updated', type: 'payment', resource: 'https://api.mercadopago.com/v1/payments/pay-2' }
    ),
    'pay-2'
  )
  assert.equal(
    getWebhookPaymentId({ query: { 'data.id': 'pay-3' } }, { action: 'payment.updated' }),
    'pay-3'
  )
})

test('buildWebhookPaymentPatch marks approved payment as paid without changing operational status', () => {
  const patch = buildWebhookPaymentPatch({
    admin: fakeAdmin(),
    payment: {
      id: 'payment-approved',
      status: 'approved',
      transaction_amount: 89.9,
      payment_method_id: 'pix',
      payment_type_id: 'bank_transfer',
    },
    orderData: {
      status: 'pendente',
      totalCents: 8990,
      payment: {
        provider: 'mercadopago',
        mode: 'online',
        status: 'pending_payment',
      },
      mercadoPago: {
        preferenceId: 'pref-1',
      },
    },
  })

  assert.equal(patch.paymentStatus, 'paid')
  assert.equal(patch.status, undefined)
  assert.equal(patch.operationalBlockedReason, null)
  assert.equal(patch.payment.status, 'approved')
  assert.equal(patch.payment.providerPaymentId, 'payment-approved')
  assert.equal(patch.payment.lastProviderStatus, 'approved')
  assert.equal(patch.payment.paidAt, 'SERVER_TIMESTAMP')
  assert.equal(patch.mercadoPago.paymentStatus, 'paid')
  assert.equal(patch.mercadoPago.status, 'approved')
})

test('buildWebhookPaymentPatch keeps in_process payment pending with provider id', () => {
  const patch = buildWebhookPaymentPatch({
    admin: fakeAdmin(),
    payment: {
      id: 'payment-pending',
      status: 'in_process',
      transaction_amount: 50,
    },
    orderData: {
      totalCents: 5000,
      payment: {
        provider: 'mercadopago',
        mode: 'online',
      },
    },
  })

  assert.equal(patch.paymentStatus, 'pending_payment')
  assert.equal(patch.status, undefined)
  assert.equal(patch.operationalBlockedReason, undefined)
  assert.equal(patch.payment.status, 'pending_payment')
  assert.equal(patch.payment.providerPaymentId, 'payment-pending')
  assert.equal(patch.payment.lastProviderStatus, 'in_process')
  assert.equal(patch.payment.lastCheckedAt, 'SERVER_TIMESTAMP')
})

test('findMercadoPagoOrderSnapshot locates order by external reference tracking token', async () => {
  const db = fakeOrdersDb({
    tracking_12345678: {
      trackingToken: 'tracking_12345678',
      storeId: 'capivaras-lanches',
      payment: {
        provider: 'mercadopago',
        mode: 'online',
        externalReference: 'pratoby:order:capivaras-lanches:tracking_12345678',
      },
    },
  })

  const match = await findMercadoPagoOrderSnapshot({
    db,
    payment: {
      id: 'payment-1',
      external_reference: 'pratoby:order:capivaras-lanches:tracking_12345678',
    },
  })

  assert.equal(match.ref.id, 'tracking_12345678')
  assert.equal(match.source, 'doc_id')
})

test('findMercadoPagoOrderSnapshot falls back to provider payment id', async () => {
  const db = fakeOrdersDb({
    order_12345678: {
      trackingToken: 'track_12345678',
      payment: {
        provider: 'mercadopago',
        mode: 'online',
        providerPaymentId: 'payment-existing',
      },
    },
  })

  const match = await findMercadoPagoOrderSnapshot({
    db,
    payment: { id: 'payment-existing' },
  })

  assert.equal(match.ref.id, 'order_12345678')
  assert.equal(match.source, 'payment.providerPaymentId')
})
