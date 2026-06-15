const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]
const PRODUCT_MODES = new Set([
  'store_default',
  'asap_only',
  'scheduled_only',
  'asap_and_scheduled',
])
const STORE_PREPAYMENT_POLICIES = new Set([
  'none',
  'pix_required_for_scheduled',
  'pix_required_for_custom_products',
])
const PRODUCT_PREPAYMENT_POLICIES = new Set([
  'store_default',
  'none',
  'pix_required',
])
const ALLOWED_SLOT_INTERVALS = new Set([10, 15, 30, 60])

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toBoundedInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function toNullableBoundedInteger(value, min, max) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function normalizeSlotInterval(value, fallback = null) {
  const parsed = Number(value)
  return ALLOWED_SLOT_INTERVALS.has(parsed) ? parsed : fallback
}

function normalizeProductSlotInterval(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return [10, 15, 30, 60].includes(parsed) ? parsed : null
}

function parseTimeToMinutes(value, allowEndOfDay = false) {
  const text = String(value || '').trim()
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (allowEndOfDay && hour === 24 && minute === 0) return 24 * 60
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return (hour * 60) + minute
}

function normalizeWindow(value) {
  if (!isObject(value)) return null
  const start = String(value.start || value.from || '').trim()
  const end = String(value.end || value.to || '').trim()
  const startMinute = parseTimeToMinutes(start)
  const endMinute = parseTimeToMinutes(end, true)

  if (startMinute === null || endMinute === null || endMinute <= startMinute) return null
  return { start, end }
}

function emptyWeeklyWindows() {
  return DAY_KEYS.reduce((acc, day) => {
    acc[day] = []
    return acc
  }, {})
}

function normalizeWeeklyWindows(value, allowNull = false) {
  if (!isObject(value)) return allowNull ? null : emptyWeeklyWindows()

  return DAY_KEYS.reduce((acc, day) => {
    const windows = Array.isArray(value[day]) ? value[day].slice(0, 24) : []
    acc[day] = windows.map(normalizeWindow).filter(Boolean)
    return acc
  }, {})
}

function isValidDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function normalizeBlockedDates(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((date) => String(date || '').trim())
    .filter(isValidDateKey)
    .slice(0, 400))]
}

function sanitizeStoreScheduling(value, {
  acceptDelivery = true,
  acceptPickup = true,
} = {}) {
  const raw = isObject(value) ? value : {}
  const rawFulfillment = isObject(raw.fulfillmentTypes) ? raw.fulfillmentTypes : {}

  return {
    enabled: raw.enabled === true,
    minLeadMinutes: toBoundedInteger(raw.minLeadMinutes, 0, 0, 525600),
    maxDaysAhead: toBoundedInteger(raw.maxDaysAhead, 30, 0, 365),
    slotIntervalMinutes: normalizeSlotInterval(raw.slotIntervalMinutes, 30),
    fulfillmentTypes: {
      delivery: acceptDelivery !== false && rawFulfillment.delivery !== false,
      pickup: acceptPickup !== false && rawFulfillment.pickup !== false,
    },
    weeklyWindows: normalizeWeeklyWindows(raw.weeklyWindows),
    blockedDates: normalizeBlockedDates(raw.blockedDates),
    prepaymentPolicy: STORE_PREPAYMENT_POLICIES.has(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'none',
  }
}

function sanitizePublicStoreScheduling(store = {}) {
  const raw = isObject(store?.scheduling)
    ? store.scheduling
    : isObject(store?.publicScheduling)
      ? store.publicScheduling
      : isObject(store?.settings?.scheduling)
        ? store.settings.scheduling
        : {}

  return sanitizeStoreScheduling(raw, {
    acceptDelivery: store?.acceptDelivery !== false && store?.settings?.acceptDelivery !== false,
    acceptPickup: store?.acceptPickup !== false && store?.settings?.acceptPickup !== false,
  })
}

function sanitizePublicProductScheduling(value) {
  if (!isObject(value)) return undefined
  const rawFulfillment = isObject(value.fulfillmentTypes) ? value.fulfillmentTypes : null

  return {
    mode: PRODUCT_MODES.has(value.mode) ? value.mode : 'store_default',
    minLeadMinutes: toNullableBoundedInteger(value.minLeadMinutes, 0, 525600),
    maxDaysAhead: toNullableBoundedInteger(value.maxDaysAhead, 0, 365),
    slotIntervalMinutes: normalizeProductSlotInterval(value.slotIntervalMinutes),
    fulfillmentTypes: rawFulfillment
      ? {
          delivery: rawFulfillment.delivery !== false,
          pickup: rawFulfillment.pickup !== false,
        }
      : null,
    weeklyWindows: normalizeWeeklyWindows(value.weeklyWindows, true),
    blockedDates: normalizeBlockedDates(value.blockedDates),
    prepaymentPolicy: PRODUCT_PREPAYMENT_POLICIES.has(value.prepaymentPolicy)
      ? value.prepaymentPolicy
      : 'store_default',
  }
}

module.exports = {
  sanitizePublicProductScheduling,
  sanitizePublicStoreScheduling,
  sanitizeStoreScheduling,
}
