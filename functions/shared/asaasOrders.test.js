const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildAsaasOrderExternalReference,
  buildAsaasPendingPaymentSnapshot,
  createOrderPaymentLink,
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
        clientId: 'private-client',
        clientSecret: 'private-secret',
        collectorId: 'private-collector',
        rawProviderPayload: { unsafe: true },
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
  assert.equal(result.mercadoPago.clientId, undefined)
  assert.equal(result.mercadoPago.clientSecret, undefined)
  assert.equal(result.mercadoPago.collectorId, undefined)
  assert.equal(result.mercadoPago.rawProviderPayload, undefined)
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

test('createOrderPaymentLink reuses an active saved Asaas link', async () => {
  const originalFetch = global.fetch
  global.fetch = async () => {
    throw new Error('fetch should not be called for reusable links')
  }

  try {
    const result = await createOrderPaymentLink({
      apiKey: 'test-key',
      orderRef: {
        id: 'order_1',
        set: async () => assert.fail('order should not be updated for reusable links'),
      },
      orderData: {
        id: 'order_1',
        storeId: 'store_1',
        totalCents: 2500,
        paymentStatus: 'pending',
        payment: {
          provider: 'asaas',
          mode: 'online',
          status: 'pending',
          paymentUrl: 'https://pay.example/old',
          invoiceUrl: 'https://pay.example/invoice',
          paymentLinkId: 'link_1',
        },
      },
      storeData: {
        payments: { asaas: { enabled: true, status: 'active' } },
      },
    })

    assert.deepEqual(result, {
      paymentUrl: 'https://pay.example/old',
      invoiceUrl: 'https://pay.example/invoice',
      providerPaymentLinkId: 'link_1',
      reused: true,
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('createOrderPaymentLink creates a new link when the saved link is expired', async () => {
  const originalFetch = global.fetch
  const originalBaseUrl = process.env.ASAAS_ORDERS_BASE_URL
  const originalEmulator = process.env.FUNCTIONS_EMULATOR
  let savedPatch = null

  process.env.ASAAS_ORDERS_BASE_URL = 'https://asaas.test/v3'
  process.env.FUNCTIONS_EMULATOR = 'true'
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://asaas.test/v3/paymentLinks')
    assert.equal(options.method, 'POST')
    return {
      ok: true,
      text: async () => JSON.stringify({
        id: 'link_2',
        url: 'https://pay.example/new',
        invoiceUrl: 'https://pay.example/new-invoice',
      }),
    }
  }

  try {
    const result = await createOrderPaymentLink({
      admin: {
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      },
      apiKey: 'test-key',
      orderRef: {
        id: 'order_1',
        set: async (patch) => {
          savedPatch = patch
        },
      },
      orderData: {
        id: 'order_1',
        storeId: 'store_1',
        trackingToken: 'track_1',
        totalCents: 2500,
        paymentStatus: 'pending',
        payment: {
          provider: 'asaas',
          mode: 'online',
          status: 'pending',
          paymentUrl: 'https://pay.example/old',
          dueDate: '2000-01-01',
        },
      },
      storeData: {
        payments: { asaas: { enabled: true, status: 'active' } },
      },
    })

    assert.deepEqual(result, {
      paymentUrl: 'https://pay.example/new',
      invoiceUrl: 'https://pay.example/new-invoice',
      providerPaymentLinkId: 'link_2',
      reused: false,
    })
    assert.equal(savedPatch.payment.providerPaymentLinkId, 'link_2')
    assert.equal(savedPatch.payment.paymentUrl, 'https://pay.example/new')
  } finally {
    global.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.ASAAS_ORDERS_BASE_URL
    } else {
      process.env.ASAAS_ORDERS_BASE_URL = originalBaseUrl
    }
    if (originalEmulator === undefined) {
      delete process.env.FUNCTIONS_EMULATOR
    } else {
      process.env.FUNCTIONS_EMULATOR = originalEmulator
    }
  }
})
