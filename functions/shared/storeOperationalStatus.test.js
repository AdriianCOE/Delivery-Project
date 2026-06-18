const test = require('node:test')
const assert = require('node:assert/strict')
const { getStoreOperationalStatus, storeAllowsScheduledOrdersWhenClosed } = require('./storeOperationalStatus')

function store(overrides = {}) {
  const { settings: settingsOverrides = {}, ...storeOverrides } = overrides

  return {
    isOpen: true,
    isActive: true,
    openingHours: {
      sun: { enabled: false, open: '18:00', close: '22:00' },
      mon: { enabled: true, open: '10:00', close: '22:00' },
      tue: { enabled: true, open: '10:00', close: '22:00' },
      wed: { enabled: true, open: '10:00', close: '22:00' },
      thu: { enabled: true, open: '10:00', close: '22:00' },
      fri: { enabled: true, open: '18:00', close: '00:30' },
      sat: { enabled: true, open: '18:00', close: '23:30' },
    },
    ...storeOverrides,
    settings: {
      availabilityMode: 'manual',
      timeZone: 'America/Sao_Paulo',
      ...settingsOverrides,
    },
  }
}

test('manual mode follows isOpen', () => {
  assert.equal(getStoreOperationalStatus(store({ isOpen: true })).isOpen, true)
  const closed = getStoreOperationalStatus(store({ isOpen: false }))
  assert.equal(closed.isOpen, false)
  assert.equal(closed.reason, 'manual-closed')
})

test('automatic mode opens within configured Brazil business hours', () => {
  const result = getStoreOperationalStatus(
    store({ settings: { availabilityMode: 'opening_hours' } }),
    { now: new Date('2026-06-17T15:00:00.000Z') }
  )

  assert.equal(result.isOpen, true)
  assert.equal(result.reason, 'business-hours')
})

test('automatic mode closes outside configured hours', () => {
  const result = getStoreOperationalStatus(
    store({ settings: { availabilityMode: 'opening_hours' } }),
    { now: new Date('2026-06-17T02:00:00.000Z') }
  )

  assert.equal(result.isOpen, false)
  assert.equal(result.reason, 'outside-business-hours')
})

test('automatic mode supports overnight windows from previous day', () => {
  const result = getStoreOperationalStatus(
    store({ settings: { availabilityMode: 'opening_hours' } }),
    { now: new Date('2026-06-20T03:10:00.000Z') }
  )

  assert.equal(result.isOpen, true)
  assert.equal(result.reason, 'overnight-hours')
})

test('temporary pause wins over automatic open hours', () => {
  const result = getStoreOperationalStatus(
    store({
      settings: {
        availabilityMode: 'opening_hours',
        temporaryPauseUntil: '2026-06-17T16:00:00.000Z',
      },
    }),
    { now: new Date('2026-06-17T15:00:00.000Z') }
  )

  assert.equal(result.isOpen, false)
  assert.equal(result.reason, 'temporary-pause')
})

test('scheduled orders closed-hours option is explicit', () => {
  assert.equal(storeAllowsScheduledOrdersWhenClosed(store()), false)
  assert.equal(
    storeAllowsScheduledOrdersWhenClosed(store({ settings: { allowScheduledOrdersWhenClosed: true } })),
    true
  )
})
