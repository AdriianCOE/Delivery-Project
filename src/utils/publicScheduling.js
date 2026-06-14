const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'
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
const SCHEDULING_CONFLICT_MESSAGE = 'Este carrinho possui itens com regras diferentes de agendamento. Separe os itens em pedidos diferentes.'

function normalizeSlotInterval(value, fallback = null) {
  const parsed = Number(value)
  return ALLOWED_SLOT_INTERVALS.has(parsed) ? parsed : fallback
}

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS
const EMPTY_STORE_WINDOWS = DAY_KEYS.reduce((acc, day) => {
  acc[day] = []
  return acc
}, {})

const brazilDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

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

function parseTimeToMinutes(value, allowEndOfDay = false) {
  const text = String(value || '').trim()
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (allowEndOfDay && hour === 24 && minute === 0) return 1440
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
  return { start, end, startMinute, endMinute }
}

function normalizeWeeklyWindows(value, fallback = null) {
  if (!isObject(value)) return fallback

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

function getBrazilParts(date) {
  const parts = brazilDateTimeFormatter.formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function formatDateKey(parts) {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

function formatTimeLabel(parts) {
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function getDateOrdinal(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(getDateOrdinal(dateKey) + (days * DAY_MS))
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function getDayKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return DAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

function localDateTimeToDate(dateKey, timeLabel) {
  if (!isValidDateKey(dateKey) || parseTimeToMinutes(timeLabel) === null) return null

  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = timeLabel.split(':').map(Number)
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  let candidate = desiredAsUtc

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getBrazilParts(new Date(candidate))
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    )
    const adjustment = desiredAsUtc - representedAsUtc
    candidate += adjustment
    if (adjustment === 0) break
  }

  const result = new Date(candidate)
  const resultParts = getBrazilParts(result)
  if (formatDateKey(resultParts) !== dateKey || formatTimeLabel(resultParts) !== timeLabel) return null
  return result
}

function normalizeStoreScheduling(store = {}) {
  const raw = isObject(store.publicScheduling)
    ? store.publicScheduling
    : isObject(store.scheduling)
      ? store.scheduling
      : {}
  const rawFulfillment = isObject(raw.fulfillmentTypes) ? raw.fulfillmentTypes : {}

  return {
    enabled: raw.enabled === true,
    minLeadMinutes: toBoundedInteger(raw.minLeadMinutes, 0, 0, 525600),
    maxDaysAhead: toBoundedInteger(raw.maxDaysAhead, 30, 0, 365),
    slotIntervalMinutes: normalizeSlotInterval(raw.slotIntervalMinutes, 30),
    fulfillmentTypes: {
      delivery: rawFulfillment.delivery !== false,
      pickup: rawFulfillment.pickup !== false,
    },
    weeklyWindows: normalizeWeeklyWindows(raw.weeklyWindows, EMPTY_STORE_WINDOWS),
    blockedDates: normalizeBlockedDates(raw.blockedDates),
    prepaymentPolicy: STORE_PREPAYMENT_POLICIES.has(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'none',
  }
}

function normalizeProductScheduling(item = {}) {
  const safeItem = isObject(item) ? item : {}
  const raw = isObject(safeItem.scheduling) ? safeItem.scheduling : {}
  const rawFulfillment = isObject(raw.fulfillmentTypes) ? raw.fulfillmentTypes : null

  return {
    productId: String(safeItem.productId || safeItem.originalProductId || safeItem.id || '').trim(),
    name: String(safeItem.name || 'Produto').trim().slice(0, 160),
    mode: PRODUCT_MODES.has(raw.mode) ? raw.mode : 'store_default',
    minLeadMinutes: toNullableBoundedInteger(raw.minLeadMinutes, 0, 525600),
    maxDaysAhead: toNullableBoundedInteger(raw.maxDaysAhead, 0, 365),
    slotIntervalMinutes: normalizeSlotInterval(raw.slotIntervalMinutes, null),
    fulfillmentTypes: rawFulfillment
      ? {
          delivery: rawFulfillment.delivery !== false,
          pickup: rawFulfillment.pickup !== false,
        }
      : null,
    weeklyWindows: normalizeWeeklyWindows(raw.weeklyWindows, null),
    blockedDates: normalizeBlockedDates(raw.blockedDates),
    prepaymentPolicy: PRODUCT_PREPAYMENT_POLICIES.has(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'store_default',
  }
}

function uniqueProducts(items) {
  const byId = new Map()

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeProductScheduling(item)
    const key = normalized.productId || `product-${byId.size}`
    if (!byId.has(key)) byId.set(key, normalized)
  }

  return [...byId.values()]
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left)
  let b = Math.abs(right)

  while (b > 0) {
    const remainder = a % b
    a = b
    b = remainder
  }

  return a || 1
}

function getEffectiveSlotInterval(storeScheduling, products) {
  const productIntervals = [...new Set(products
    .map((product) => product.slotIntervalMinutes)
    .filter((value) => value !== null))]

  if (productIntervals.length === 0) return storeScheduling.slotIntervalMinutes

  const interval = productIntervals.reduce((commonInterval, productInterval) => (
    (commonInterval / greatestCommonDivisor(commonInterval, productInterval)) * productInterval
  ))

  return interval > 1440 ? null : interval
}

function formatScheduleLead(minutes) {
  const value = Number(minutes || 0)
  if (value <= 0) return ''
  if (value >= 1440 && value % 1440 === 0) {
    const days = value / 1440
    return `${days} dia${days === 1 ? '' : 's'}`
  }
  if (value >= 60 && value % 60 === 0) {
    const hours = value / 60
    return `${hours} hora${hours === 1 ? '' : 's'}`
  }
  return `${value} minuto${value === 1 ? '' : 's'}`
}

function labelDate(dateKey, todayKey) {
  const daysAhead = Math.round((getDateOrdinal(dateKey) - getDateOrdinal(todayKey)) / DAY_MS)
  if (daysAhead === 0) return 'Hoje'
  if (daysAhead === 1) return 'Amanhã'

  const date = localDateTimeToDate(dateKey, '12:00')
  if (!date) return dateKey

  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date).replace('.', '')
  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date)

  return `${weekday}, ${dayMonth}`
}

function windowAcceptsSlot(window, minuteOfDay, durationMinutes, intervalMinutes) {
  if (minuteOfDay < window.startMinute) return false
  if ((minuteOfDay + durationMinutes) > window.endMinute) return false
  return ((minuteOfDay - window.startMinute) % intervalMinutes) === 0
}

function acceptsWindowAndInterval(weeklyWindows, dateKey, minuteOfDay, durationMinutes, intervalMinutes) {
  const dayKey = getDayKey(dateKey)
  return (weeklyWindows?.[dayKey] || []).some((window) => (
    windowAcceptsSlot(window, minuteOfDay, durationMinutes, intervalMinutes)
  ))
}

function formatMinuteOfDay(minute) {
  const hour = Math.floor(minute / 60)
  const minutePart = minute % 60
  return `${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`
}

function buildAvailableDates({ storeScheduling, products, fulfillmentType, now }) {
  if (!storeScheduling.enabled) return []
  if (storeScheduling.fulfillmentTypes[fulfillmentType] !== true) return []
  if (products.some((product) => product.fulfillmentTypes && product.fulfillmentTypes[fulfillmentType] !== true)) return []

  const productLeadMinutes = products.map((product) => product.minLeadMinutes).filter((value) => value !== null)
  const productMaxDays = products.map((product) => product.maxDaysAhead).filter((value) => value !== null)
  const minLeadMinutes = Math.max(storeScheduling.minLeadMinutes, ...productLeadMinutes, 0)
  const maxDaysAhead = Math.min(storeScheduling.maxDaysAhead, ...productMaxDays)
  const slotIntervalMinutes = getEffectiveSlotInterval(storeScheduling, products)
  if (!slotIntervalMinutes) return []

  const nowDate = now instanceof Date ? now : new Date(now || Date.now())
  const nowParts = getBrazilParts(nowDate)
  const todayKey = formatDateKey(nowParts)
  const earliestTime = nowDate.getTime() + (minLeadMinutes * MINUTE_MS)
  const storeBlockedDates = new Set(storeScheduling.blockedDates)

  return Array.from({ length: maxDaysAhead + 1 }, (_, dayOffset) => {
    const dateKey = addDaysToDateKey(todayKey, dayOffset)
    if (storeBlockedDates.has(dateKey)) return null
    if (products.some((product) => product.blockedDates.includes(dateKey))) return null

    const dayKey = getDayKey(dateKey)
    const windows = storeScheduling.weeklyWindows?.[dayKey] || []
    const slots = []

    for (const window of windows) {
      for (let minute = window.startMinute; minute < window.endMinute; minute += slotIntervalMinutes) {
        const time = formatMinuteOfDay(minute)
        const slotDate = localDateTimeToDate(dateKey, time)
        if (!slotDate || slotDate.getTime() < earliestTime) continue

        if (!acceptsWindowAndInterval(
          storeScheduling.weeklyWindows,
          dateKey,
          minute,
          slotIntervalMinutes,
          slotIntervalMinutes
        )) continue

        const productRejectsSlot = products.some((product) => {
          if (!product.weeklyWindows && product.slotIntervalMinutes === null) return false
          const productWindows = product.weeklyWindows || storeScheduling.weeklyWindows
          const productInterval = product.slotIntervalMinutes || slotIntervalMinutes
          return !acceptsWindowAndInterval(
            productWindows,
            dateKey,
            minute,
            slotIntervalMinutes,
            productInterval
          )
        })

        if (!productRejectsSlot) {
          slots.push({ time, label: time })
        }
      }
    }

    if (slots.length === 0) return null

    return {
      date: dateKey,
      dateKey,
      label: labelDate(dateKey, todayKey),
      slots,
    }
  }).filter(Boolean)
}

export function getProductSchedulingBadges(product, store = null) {
  if (!isObject(product)) return []

  const scheduling = normalizeProductScheduling(product)
  const storeScheduling = normalizeStoreScheduling(store || {})
  const schedulingEnabled = storeScheduling.enabled === true
  const badges = []

  if (scheduling.mode === 'scheduled_only') {
    badges.push({ id: 'scheduled-only', label: 'Sob encomenda', tone: 'amber' })

    if (scheduling.minLeadMinutes !== null && scheduling.minLeadMinutes > 0) {
      badges.push({
        id: 'lead-time',
        label: `Agende com ${formatScheduleLead(scheduling.minLeadMinutes)} de antecedência`,
        tone: 'gray',
      })
    }
  } else if (scheduling.mode === 'asap_and_scheduled' && schedulingEnabled) {
    badges.push({ id: 'can-schedule', label: 'Pode agendar', tone: 'green' })
  }

  if (scheduling.prepaymentPolicy === 'pix_required') {
    badges.push({ id: 'pix-required', label: 'Pix antecipado', tone: 'orange' })
  }

  return badges
}

export function getCartSchedulingState({ store, items, fulfillmentType, orderTiming, now = new Date() }) {
  const storeScheduling = normalizeStoreScheduling(store)
  const products = uniqueProducts(items)
  const hasAsapOnly = products.some((product) => product.mode === 'asap_only')
  const hasScheduledOnly = products.some((product) => product.mode === 'scheduled_only')
  const hasPixProduct = products.some((product) => product.prepaymentPolicy === 'pix_required')
  const hasCustomProductPix = storeScheduling.prepaymentPolicy === 'pix_required_for_custom_products'
    && hasScheduledOnly
  const hasStoreScheduledPix = orderTiming === 'scheduled'
    && storeScheduling.prepaymentPolicy === 'pix_required_for_scheduled'
  const pixRequired = hasPixProduct || hasCustomProductPix || hasStoreScheduledPix
  const deliveryAllowed = storeScheduling.fulfillmentTypes.delivery === true
    && !products.some((product) => product.fulfillmentTypes && product.fulfillmentTypes.delivery !== true)
  const pickupAllowed = storeScheduling.fulfillmentTypes.pickup === true
    && !products.some((product) => product.fulfillmentTypes && product.fulfillmentTypes.pickup !== true)
  const fulfillmentAllowed = fulfillmentType === 'pickup' ? pickupAllowed : deliveryAllowed
  const hasConflictingModes = hasAsapOnly && hasScheduledOnly
  const availableDates = buildAvailableDates({
    storeScheduling,
    products,
    fulfillmentType,
    now,
  })

  let blockingMessage = ''
  if (hasConflictingModes) {
    blockingMessage = SCHEDULING_CONFLICT_MESSAGE
  } else if (hasScheduledOnly && !storeScheduling.enabled) {
    blockingMessage = 'Este produto precisa de agendamento, mas a loja ainda não ativou pedidos agendados.'
  } else if (orderTiming === 'scheduled' && hasAsapOnly) {
    blockingMessage = SCHEDULING_CONFLICT_MESSAGE
  } else if (orderTiming === 'scheduled' && !storeScheduling.enabled) {
    blockingMessage = 'A loja ainda não ativou pedidos agendados.'
  } else if (orderTiming === 'scheduled' && !fulfillmentAllowed) {
    blockingMessage = fulfillmentType === 'delivery'
      ? 'Este carrinho não permite entrega agendada. Escolha retirada ou separe os itens.'
      : 'Este carrinho não permite retirada agendada. Escolha entrega ou separe os itens.'
  } else if (orderTiming === 'scheduled' && availableDates.length === 0) {
    blockingMessage = 'Não há horários disponíveis para este carrinho.'
  }

  return {
    storeScheduling,
    products,
    requiresScheduling: hasScheduledOnly,
    canOrderNow: !hasScheduledOnly && !hasConflictingModes,
    canSchedule: storeScheduling.enabled && !hasAsapOnly && !hasConflictingModes,
    hasConflictingModes,
    deliveryAllowed,
    pickupAllowed,
    fulfillmentAllowed,
    pixRequired,
    paymentPolicy: pixRequired ? 'pix_required' : 'none',
    availableDates,
    blockingMessage,
  }
}

export function formatScheduledOrderDate(order) {
  let dateKey = String(order?.scheduledDateKey || order?.scheduledDate || '').trim()
  let timeLabel = String(order?.scheduledTimeLabel || order?.scheduledTime || '').trim()

  if ((!dateKey || !timeLabel) && order?.scheduledFor) {
    const scheduledDate =
      typeof order.scheduledFor?.toDate === 'function'
        ? order.scheduledFor.toDate()
        : new Date(order.scheduledFor)

    if (!Number.isNaN(scheduledDate.getTime())) {
      const parts = getBrazilParts(scheduledDate)
      dateKey = formatDateKey(parts)
      timeLabel = formatTimeLabel(parts)
    }
  }

  if (!dateKey || !timeLabel) return ''

  const date = localDateTimeToDate(dateKey, timeLabel)
  if (!date) return `${dateKey} às ${timeLabel}`

  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date)

  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date)

  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date)

  return `${weekday}, ${dayMonth} às ${time}`
}

export function isScheduledOrder(order) {
  return order?.orderTiming === 'scheduled'
    || Boolean(order?.scheduledFor || order?.scheduledDateKey || order?.scheduledDate)
}
