const test = require('node:test')
const assert = require('node:assert/strict')
const { buildOrderSchedulingDecision } = require('./orderScheduling')
const { normalizePublicOrderDeliveryType } = require('../publicOrder')

const NOW = new Date('2026-06-04T12:00:00.000Z')

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function store(overrides = {}) {
  const { scheduling: schedulingOverrides = {}, ...storeOverrides } = overrides

  return {
    acceptDelivery: true,
    acceptPickup: true,
    paymentMethods: { pix: true, card: true, cash: true },
    scheduling: {
      enabled: true,
      minLeadMinutes: 60,
      maxDaysAhead: 14,
      slotIntervalMinutes: 30,
      fulfillmentTypes: { delivery: true, pickup: true },
      weeklyWindows: {
        monday: [{ start: '08:00', end: '18:00' }],
        tuesday: [{ start: '08:00', end: '18:00' }],
        wednesday: [{ start: '08:00', end: '18:00' }],
        thursday: [{ start: '08:00', end: '18:00' }],
        friday: [{ start: '08:00', end: '18:00' }],
        saturday: [],
        sunday: [],
      },
      blockedDates: [],
      prepaymentPolicy: 'none',
      ...schedulingOverrides,
    },
    ...storeOverrides,
  }
}

function product(id, scheduling = undefined) {
  return { productId: id, name: `Produto ${id}`, scheduling }
}

function decide({
  storeData = store(),
  products = [product('regular')],
  input = {},
  deliveryType = 'pickup',
  paymentMethod = 'cash',
} = {}) {
  return buildOrderSchedulingDecision({
    store: storeData,
    storeId: 'store-1',
    products,
    input,
    deliveryType,
    paymentMethod,
    now: NOW,
    fail,
  })
}

test('keeps legacy orders immediate when orderTiming is missing', () => {
  const result = decide({
    storeData: {
      acceptDelivery: true,
      acceptPickup: true,
      paymentMethods: { pix: true, card: true, cash: true },
    },
  })

  assert.equal(result.orderTiming, 'asap')
  assert.equal(result.scheduledFor, null)
  assert.equal(result.scheduledSlotKey, null)
  assert.equal(result.paymentPolicy, 'none')
})

test('rejects scheduled orders when legacy store scheduling is disabled', () => {
  assert.throws(
    () => decide({
      storeData: {
        acceptDelivery: true,
        acceptPickup: true,
        paymentMethods: { pix: true, card: true, cash: true },
      },
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
    }),
    /não aceita pedidos agendados/
  )
})

test('creates a valid Brazil-time scheduled decision', () => {
  const result = decide({
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
  })

  assert.equal(result.orderTiming, 'scheduled')
  assert.equal(result.scheduledFor.toISOString(), '2026-06-05T17:00:00.000Z')
  assert.equal(result.scheduledWindowEnd.toISOString(), '2026-06-05T17:30:00.000Z')
  assert.equal(result.scheduledSlotKey, 'store-1_2026-06-05_14-00_pickup')
  assert.equal(result.schedulingSnapshot.source, 'store')
})

test('accepts scheduledFor and normalizes it to Brazil time', () => {
  const result = decide({
    input: {
      orderTiming: 'scheduled',
      scheduledFor: '2026-06-05T17:00:00.000Z',
    },
  })

  assert.equal(result.scheduledDateKey, '2026-06-05')
  assert.equal(result.scheduledTimeLabel, '14:00')
})

test('scheduled_only forces scheduling and requires date and time', () => {
  assert.throws(
    () => decide({
      products: [product('custom', { mode: 'scheduled_only' })],
    }),
    /Escolha uma data e horário para sua encomenda/
  )
})

test('rejects asap_only mixed with scheduled_only', () => {
  assert.throws(
    () => decide({
      products: [
        product('asap', { mode: 'asap_only' }),
        product('custom', { mode: 'scheduled_only' }),
      ],
    }),
    /Finalize em pedidos separados/
  )
})

test('uses the highest product lead time', () => {
  assert.throws(
    () => decide({
      products: [product('custom', { mode: 'scheduled_only', minLeadMinutes: 2880 })],
      input: {
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
    }),
    /pelo menos 2 dias de antecedência/
  )
})

test('rejects dates outside weekly windows or on blocked dates', () => {
  assert.throws(
    () => decide({
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-06',
        scheduledTime: '14:00',
      },
    }),
    /Horário indisponível/
  )

  assert.throws(
    () => decide({
      storeData: store({ scheduling: { blockedDates: ['2026-06-05'] } }),
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
    }),
    /Horário indisponível/
  )
})

test('rejects past times and applies product slot intervals over store windows', () => {
  assert.throws(
    () => decide({
      storeData: store({ scheduling: { minLeadMinutes: 0 } }),
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-04',
        scheduledTime: '08:00',
      },
    }),
    /Horário indisponível/
  )

  const cakeOrder = decide({
    products: [product('cake', { slotIntervalMinutes: 10 })],
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:50',
    },
  })

  assert.equal(cakeOrder.scheduledTimeLabel, '14:50')
  assert.equal(cakeOrder.schedulingSnapshot.slotIntervalMinutes, 10)
  assert.equal(cakeOrder.scheduledWindowEnd.toISOString(), '2026-06-05T18:00:00.000Z')
})

test('uses a safe common interval for products with different explicit intervals', () => {
  const result = decide({
    products: [
      product('ten-minutes', { slotIntervalMinutes: 10 }),
      product('fifteen-minutes', { slotIntervalMinutes: 15 }),
    ],
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:30',
    },
  })

  assert.equal(result.schedulingSnapshot.slotIntervalMinutes, 30)
  assert.equal(result.scheduledWindowEnd.toISOString(), '2026-06-05T18:00:00.000Z')
})

test('ignores product intervals outside the supported UI options', () => {
  const result = decide({
    products: [
      product('fifty-three-minutes', { slotIntervalMinutes: 53 }),
      product('fifty-nine-minutes', { slotIntervalMinutes: 59 }),
    ],
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
  })

  assert.equal(result.schedulingSnapshot.slotIntervalMinutes, 30)
})

test('ignores store intervals outside the supported UI options', () => {
  const result = decide({
    storeData: store({ scheduling: { slotIntervalMinutes: 5 } }),
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
  })

  assert.equal(result.schedulingSnapshot.slotIntervalMinutes, 30)
})

test('applies the smallest max day limit and product fulfillment restrictions', () => {
  assert.throws(
    () => decide({
      products: [product('custom', { maxDaysAhead: 1 })],
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-08',
        scheduledTime: '14:00',
      },
    }),
    /Horário indisponível/
  )

  assert.throws(
    () => decide({
      products: [product('custom', {
        fulfillmentTypes: { delivery: false, pickup: true },
      })],
      deliveryType: 'delivery',
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
    }),
    /Finalize em pedidos separados/
  )
})

test('allows missing product fulfillment fields and blocks only explicit false', () => {
  const partialFulfillment = decide({
    products: [product('delivery-blocked', {
      fulfillmentTypes: { delivery: false },
    })],
    deliveryType: 'pickup',
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
  })

  assert.equal(partialFulfillment.orderTiming, 'scheduled')
})

test('normalizes compatible pickup aliases', () => {
  for (const alias of [
    'pickup',
    'retirada',
    'retirar',
    'takeaway',
    'takeout',
    'balcao',
    'balcão',
    'retirada na loja',
    'retirada-loja',
    'retirada_na_loja',
  ]) {
    assert.equal(normalizePublicOrderDeliveryType(alias), 'pickup')
  }

  assert.equal(normalizePublicOrderDeliveryType('delivery'), 'delivery')
  assert.equal(normalizePublicOrderDeliveryType('desconhecido'), null)
})

test('requires Pix when store or product policy requires it', () => {
  assert.throws(
    () => decide({
      storeData: store({ scheduling: { prepaymentPolicy: 'pix_required_for_scheduled' } }),
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
      paymentMethod: 'card',
    }),
    /exige pagamento antecipado via Pix/
  )

  const productPix = decide({
    products: [product('custom', { prepaymentPolicy: 'pix_required' })],
    paymentMethod: 'pix_manual',
  })
  assert.equal(productPix.orderTiming, 'asap')
  assert.equal(productPix.paymentPolicy, 'pix_required')
  assert.equal(productPix.paymentPolicyReason, 'product_required')
})

test('requires Mercado Pago for online scheduled preorder policy', () => {
  const storeData = store({
    payments: {
      mercadoPago: { enabled: true, status: 'active' },
      preorderPolicy: { mode: 'mercadopago_online' },
    },
  })

  assert.throws(
    () => decide({
      storeData,
      input: {
        orderTiming: 'scheduled',
        scheduledDate: '2026-06-05',
        scheduledTime: '14:00',
      },
      paymentMethod: 'pix_manual',
    }),
    /exige pagamento online antecipado/
  )

  const result = decide({
    storeData,
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
    paymentMethod: 'mercadopago_online',
  })

  assert.equal(result.paymentPolicy, 'mercadopago_online_required')
  assert.equal(result.paymentPolicyReason, 'store_preorder_policy')
})

test('maps legacy manual_or_asaas preorder policy to Mercado Pago when connected', () => {
  const result = decide({
    storeData: store({
      payments: {
        mercadoPago: { enabled: true, status: 'active' },
        preorderPolicy: { mode: 'manual_or_asaas' },
      },
    }),
    input: {
      orderTiming: 'scheduled',
      scheduledDate: '2026-06-05',
      scheduledTime: '14:00',
    },
    paymentMethod: 'mercadopago_online',
  })

  assert.equal(result.paymentPolicy, 'prepaid_required')
  assert.equal(result.paymentPolicyReason, 'store_preorder_policy')
})
