const test = require('node:test')
const assert = require('node:assert/strict')
const {
  sanitizePublicProductScheduling,
  sanitizePublicStoreScheduling,
  sanitizeStoreScheduling,
} = require('./publicScheduling')

test('keeps stores without scheduling compatible with safe disabled defaults', () => {
  assert.deepEqual(sanitizePublicStoreScheduling({
    acceptDelivery: true,
    acceptPickup: false,
  }), {
    enabled: false,
    minLeadMinutes: 0,
    maxDaysAhead: 30,
    slotIntervalMinutes: 30,
    fulfillmentTypes: {
      delivery: true,
      pickup: false,
    },
    weeklyWindows: {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    },
    blockedDates: [],
    prepaymentPolicy: 'none',
  })
})

test('publishes only safe normalized store scheduling fields', () => {
  const result = sanitizePublicStoreScheduling({
    acceptDelivery: true,
    acceptPickup: true,
    scheduling: {
      enabled: true,
      minLeadMinutes: -20,
      maxDaysAhead: 900,
      slotIntervalMinutes: 2,
      maxOrdersPerSlot: 12,
      internalNote: 'secret',
      fulfillmentTypes: { delivery: false },
      weeklyWindows: {
        monday: [
          { start: '08:00', end: '18:00', capacity: 10 },
          { start: '19:00', end: '18:00' },
          { start: 'invalid', end: '20:00' },
        ],
        internalDay: [{ start: '00:00', end: '24:00' }],
      },
      blockedDates: ['2026-12-25', '2026-02-30', 'secret'],
      prepaymentPolicy: 'pix_required_for_scheduled',
      pixKey: 'sensitive',
    },
  })

  assert.equal(result.enabled, true)
  assert.equal(result.minLeadMinutes, 0)
  assert.equal(result.maxDaysAhead, 365)
  assert.equal(result.slotIntervalMinutes, 30)
  assert.deepEqual(result.fulfillmentTypes, { delivery: false, pickup: true })
  assert.deepEqual(result.weeklyWindows.monday, [{ start: '08:00', end: '18:00' }])
  assert.deepEqual(result.blockedDates, ['2026-12-25'])
  assert.equal(result.prepaymentPolicy, 'pix_required_for_scheduled')
  assert.equal(Object.hasOwn(result, 'maxOrdersPerSlot'), false)
  assert.equal(Object.hasOwn(result, 'internalNote'), false)
  assert.equal(Object.hasOwn(result, 'pixKey'), false)
})

test('normalizes store settings writes without retaining unknown fields', () => {
  const result = sanitizeStoreScheduling({
    enabled: true,
    minLeadMinutes: '120',
    weeklyWindows: {
      friday: [{ from: '09:00', to: '17:00', private: true }],
    },
    maxOrdersPerSlot: 4,
  })

  assert.equal(result.minLeadMinutes, 120)
  assert.deepEqual(result.weeklyWindows.friday, [{ start: '09:00', end: '17:00' }])
  assert.equal(Object.hasOwn(result, 'maxOrdersPerSlot'), false)
})

test('omits product scheduling when the product has no scheduling object', () => {
  assert.equal(sanitizePublicProductScheduling(undefined), undefined)
  assert.equal(sanitizePublicProductScheduling(null), undefined)
})

test('publishes only safe normalized product scheduling fields', () => {
  const result = sanitizePublicProductScheduling({
    mode: 'scheduled_only',
    minLeadMinutes: 2880,
    maxDaysAhead: 'invalid',
    slotIntervalMinutes: 10,
    fulfillmentTypes: { delivery: false },
    weeklyWindows: {
      friday: [{ start: '08:00', end: '20:00', capacity: 20 }],
    },
    blockedDates: ['2026-12-25', 'invalid'],
    prepaymentPolicy: 'pix_required',
    costPrice: 99,
    supplier: 'internal',
  })

  assert.deepEqual(result, {
    mode: 'scheduled_only',
    minLeadMinutes: 2880,
    maxDaysAhead: null,
    slotIntervalMinutes: 10,
    fulfillmentTypes: {
      delivery: false,
      pickup: true,
    },
    weeklyWindows: {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [{ start: '08:00', end: '20:00' }],
      saturday: [],
    },
    blockedDates: ['2026-12-25'],
    prepaymentPolicy: 'pix_required',
  })
})

test('normalizes invalid product scheduling values without throwing', () => {
  assert.deepEqual(sanitizePublicProductScheduling({
    mode: 'internal_mode',
    minLeadMinutes: 'invalid',
    maxDaysAhead: -5,
    slotIntervalMinutes: 9999,
    fulfillmentTypes: 'invalid',
    weeklyWindows: {
      monday: [{ start: '25:00', end: '26:00' }],
    },
    blockedDates: ['2026-13-01'],
    prepaymentPolicy: 'internal_policy',
    maxOrdersPerSlot: 10,
  }), {
    mode: 'store_default',
    minLeadMinutes: null,
    maxDaysAhead: 0,
    slotIntervalMinutes: null,
    fulfillmentTypes: null,
    weeklyWindows: {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    },
    blockedDates: [],
    prepaymentPolicy: 'store_default',
  })
})
