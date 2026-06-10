import test from 'node:test'
import assert from 'node:assert/strict'
import { getCartSchedulingState } from './publicScheduling.js'

const NOW = new Date('2026-06-01T12:00:00-03:00')

function weeklyWindows(days) {
  return {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    ...days,
  }
}

function storeScheduling(overrides = {}) {
  return {
    publicScheduling: {
      enabled: true,
      minLeadMinutes: 0,
      maxDaysAhead: 3,
      slotIntervalMinutes: 30,
      fulfillmentTypes: { delivery: true, pickup: true },
      weeklyWindows: weeklyWindows({
        monday: [{ start: '14:00', end: '16:00' }],
        tuesday: [{ start: '14:00', end: '16:00' }],
      }),
      blockedDates: [],
      prepaymentPolicy: 'none',
      ...overrides,
    },
  }
}

function state({ store = storeScheduling(), items = [{}], orderTiming = 'asap' } = {}) {
  return getCartSchedulingState({
    store,
    items,
    fulfillmentType: 'delivery',
    orderTiming,
    now: NOW,
  })
}

test('normaliza carrinho comum como asap com agendamento opcional', () => {
  const result = state()

  assert.equal(result.requiresScheduling, false)
  assert.equal(result.canOrderNow, true)
  assert.equal(result.canSchedule, true)
  assert.equal(result.blockingMessage, '')
})

test('scheduled_only exige agendamento e bloqueia pedir agora', () => {
  const result = state({
    items: [{ id: 'cake', scheduling: { mode: 'scheduled_only' } }],
    orderTiming: 'scheduled',
  })

  assert.equal(result.requiresScheduling, true)
  assert.equal(result.canOrderNow, false)
  assert.equal(result.canSchedule, true)
})

test('asap_only bloqueia escolha de horario agendado', () => {
  const result = state({
    items: [{ id: 'fries', scheduling: { mode: 'asap_only' } }],
    orderTiming: 'scheduled',
  })

  assert.equal(result.canOrderNow, true)
  assert.equal(result.canSchedule, false)
  assert.match(result.blockingMessage, /regras diferentes/i)
})

test('lead time remove slots antes da antecedencia minima', () => {
  const result = state({
    store: storeScheduling({
      minLeadMinutes: 180,
      slotIntervalMinutes: 60,
      weeklyWindows: weeklyWindows({
        monday: [{ start: '13:00', end: '17:00' }],
      }),
    }),
    orderTiming: 'scheduled',
  })

  assert.equal(result.availableDates[0].dateKey, '2026-06-01')
  assert.deepEqual(result.availableDates[0].slots.map((slot) => slot.time), ['15:00', '16:00'])
})

test('datas bloqueadas removem o dia da agenda', () => {
  const result = state({
    store: storeScheduling({
      blockedDates: ['2026-06-01'],
    }),
    orderTiming: 'scheduled',
  })

  assert.equal(result.availableDates[0].dateKey, '2026-06-02')
})

test('janelas por dia limitam os dias disponiveis', () => {
  const result = state({
    store: storeScheduling({
      weeklyWindows: weeklyWindows({
        tuesday: [{ start: '10:00', end: '11:00' }],
      }),
    }),
    orderTiming: 'scheduled',
  })

  assert.deepEqual(result.availableDates.map((date) => date.dateKey), ['2026-06-02'])
})

test('intervalo de slots respeita 10 minutos', () => {
  const result = state({
    store: storeScheduling({
      slotIntervalMinutes: 10,
      weeklyWindows: weeklyWindows({
        monday: [{ start: '14:30', end: '15:00' }],
      }),
    }),
    orderTiming: 'scheduled',
  })

  assert.deepEqual(result.availableDates[0].slots.map((slot) => slot.time), ['14:30', '14:40', '14:50'])
})
