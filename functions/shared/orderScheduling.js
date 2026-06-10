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
const PIX_MANUAL_METHODS = new Set([
  'pix',
  'pix_manual',
  'manual_pix',
  'pix_manual_store',
])
const ALLOWED_SLOT_INTERVALS = new Set([10, 15, 30, 60])
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

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

function failWith(fail, code, message) {
  if (typeof fail === 'function') fail(code, message)
  const error = new Error(message)
  error.code = code
  throw error
}

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

function normalizeWindow(window) {
  if (!isObject(window)) return null
  const start = String(window.start || window.from || '').trim()
  const end = String(window.end || window.to || '').trim()
  const startMinute = parseTimeToMinutes(start)
  const endMinute = parseTimeToMinutes(end, true)

  if (startMinute === null || endMinute === null || endMinute <= startMinute) return null
  return { start, end, startMinute, endMinute }
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

function normalizeBlockedDates(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((date) => String(date || '').trim())
    .filter(isValidDateKey)
    .slice(0, 400))]
}

function normalizeStoreScheduling(store) {
  const raw = isObject(store?.scheduling) ? store.scheduling : {}
  const storeAcceptsDelivery = store?.acceptDelivery !== false && store?.settings?.acceptDelivery !== false
  const storeAcceptsPickup = store?.acceptPickup !== false && store?.settings?.acceptPickup !== false
  const rawFulfillment = isObject(raw.fulfillmentTypes) ? raw.fulfillmentTypes : {}

  return {
    enabled: raw.enabled === true,
    minLeadMinutes: toBoundedInteger(raw.minLeadMinutes, 0, 0, 525600),
    maxDaysAhead: toBoundedInteger(raw.maxDaysAhead, 30, 0, 365),
    slotIntervalMinutes: normalizeSlotInterval(raw.slotIntervalMinutes, 30),
    fulfillmentTypes: {
      delivery: storeAcceptsDelivery && rawFulfillment.delivery !== false,
      pickup: storeAcceptsPickup && rawFulfillment.pickup !== false,
    },
    weeklyWindows: normalizeWeeklyWindows(raw.weeklyWindows),
    blockedDates: normalizeBlockedDates(raw.blockedDates),
    prepaymentPolicy: STORE_PREPAYMENT_POLICIES.has(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'none',
  }
}

function normalizeProductScheduling(product) {
  const raw = isObject(product?.scheduling) ? product.scheduling : {}
  const rawFulfillment = isObject(raw.fulfillmentTypes) ? raw.fulfillmentTypes : null

  return {
    productId: String(product?.productId || product?.id || '').trim(),
    name: String(product?.name || 'Produto').trim().slice(0, 160),
    mode: PRODUCT_MODES.has(raw.mode) ? raw.mode : 'store_default',
    minLeadMinutes: toNullableBoundedInteger(raw.minLeadMinutes, 0, 525600),
    maxDaysAhead: toNullableBoundedInteger(raw.maxDaysAhead, 0, 365),
    slotIntervalMinutes: normalizeProductSlotInterval(raw.slotIntervalMinutes),
    fulfillmentTypes: rawFulfillment
      ? {
          delivery: rawFulfillment.delivery !== false,
          pickup: rawFulfillment.pickup !== false,
        }
      : null,
    weeklyWindows: normalizeWeeklyWindows(raw.weeklyWindows, true),
    blockedDates: normalizeBlockedDates(raw.blockedDates),
    prepaymentPolicy: PRODUCT_PREPAYMENT_POLICIES.has(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'store_default',
  }
}

function uniqueProducts(products) {
  const byId = new Map()
  for (const product of Array.isArray(products) ? products : []) {
    const normalized = normalizeProductScheduling(product)
    const key = normalized.productId || `product-${byId.size}`
    if (!byId.has(key)) byId.set(key, normalized)
  }
  return [...byId.values()]
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

function timestampLikeToDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  if (isObject(value) && Number.isFinite(Number(value.seconds))) {
    const millis = (Number(value.seconds) * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000)
    const date = new Date(millis)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' && value.trim()) {
    const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value.trim())
    if (localMatch) return localDateTimeToDate(localMatch[1], localMatch[2])
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function getScheduledInput(input, fail) {
  let dateKey = String(input?.scheduledDate || '').trim()
  let timeLabel = String(input?.scheduledTime || '').trim()

  if (!dateKey || !timeLabel) {
    const scheduledFor = timestampLikeToDate(input?.scheduledFor)
    if (scheduledFor) {
      const parts = getBrazilParts(scheduledFor)
      dateKey = formatDateKey(parts)
      timeLabel = formatTimeLabel(parts)
    }
  }

  if (!dateKey || !timeLabel) {
    failWith(fail, 'invalid-argument', 'Escolha uma data e horário para sua encomenda.')
  }

  const scheduledFor = localDateTimeToDate(dateKey, timeLabel)
  if (!scheduledFor) {
    failWith(fail, 'invalid-argument', 'Horário indisponível. Escolha outro horário.')
  }

  return {
    dateKey,
    timeLabel,
    scheduledFor,
    minuteOfDay: parseTimeToMinutes(timeLabel),
  }
}

function normalizeOrderTiming(value, fail) {
  const timing = String(value || '').trim().toLowerCase()
  if (!timing) return 'asap'
  if (timing === 'asap' || timing === 'scheduled') return timing
  failWith(fail, 'invalid-argument', 'Tipo de agendamento inválido.')
}

function isPixManualPaymentMethod(value) {
  return PIX_MANUAL_METHODS.has(String(value || '').trim().toLowerCase())
}

function isMercadoPagoOnlinePaymentMethod(value) {
  const method = String(value || '').trim().toLowerCase()
  return method === 'mercadopago_online'
}

function isMercadoPagoOnlineActive(store) {
  const config = store?.payments?.mercadoPago || store?.payments?.mercadopago || {}
  const status = String(config.status || (config.enabled === true ? 'active' : 'not_connected'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return config.enabled === true && ['active', 'enabled', 'ativo'].includes(status)
}

function normalizePreorderPaymentMode(store) {
  const policy = store?.payments?.preorderPolicy
  const raw = policy && typeof policy === 'object' && !Array.isArray(policy)
    ? policy.mode || policy.requiredMethod
    : policy
  const mode = String(raw || 'manual')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (mode === 'asaas_online') return isMercadoPagoOnlineActive(store) ? 'mercadopago_online' : 'manual'
  if (mode === 'manual_or_asaas') return isMercadoPagoOnlineActive(store) ? 'manual_or_mercadopago' : 'manual'

  return ['manual', 'pix_manual', 'mercadopago_online', 'manual_or_mercadopago'].includes(mode) ? mode : 'manual'
}

function hasProductSchedulingContribution(product) {
  return product.mode !== 'store_default'
    || product.minLeadMinutes !== null
    || product.maxDaysAhead !== null
    || product.slotIntervalMinutes !== null
    || product.fulfillmentTypes !== null
    || product.weeklyWindows !== null
    || product.blockedDates.length > 0
    || product.prepaymentPolicy !== 'store_default'
}

function resolvePaymentPolicy({ storeScheduling, products, orderTiming, paymentMethod, preorderPaymentMode, fail }) {
  const explicitProductPix = products.some((product) => product.prepaymentPolicy === 'pix_required')
  const customProductPix = storeScheduling.prepaymentPolicy === 'pix_required_for_custom_products'
    && products.some((product) => product.mode === 'scheduled_only')
  const storeScheduledPix = orderTiming === 'scheduled'
    && storeScheduling.prepaymentPolicy === 'pix_required_for_scheduled'
  const scheduledOnlineOnly = orderTiming === 'scheduled' && preorderPaymentMode === 'mercadopago_online'
  const scheduledManualOrOnline = orderTiming === 'scheduled' && preorderPaymentMode === 'manual_or_mercadopago'
  const scheduledPix = orderTiming === 'scheduled' && preorderPaymentMode === 'pix_manual'
  const requiresPixPayment = explicitProductPix || customProductPix || storeScheduledPix || scheduledPix
  const paymentPolicy = scheduledOnlineOnly
    ? 'mercadopago_online_required'
    : scheduledManualOrOnline
      ? 'prepaid_required'
      : requiresPixPayment
        ? 'pix_required'
        : 'none'
  const paymentPolicyReason = scheduledOnlineOnly || scheduledManualOrOnline || scheduledPix
    ? 'store_preorder_policy'
    : explicitProductPix || customProductPix
      ? 'product_required'
      : storeScheduledPix
        ? 'store_scheduled'
        : null

  if (scheduledOnlineOnly && !isMercadoPagoOnlinePaymentMethod(paymentMethod)) {
    failWith(fail, 'failed-precondition', 'Este pedido exige pagamento online antecipado.')
  }

  if (scheduledManualOrOnline && !isPixManualPaymentMethod(paymentMethod) && !isMercadoPagoOnlinePaymentMethod(paymentMethod)) {
    failWith(fail, 'failed-precondition', 'Este pedido exige Pix manual ou pagamento online antecipado.')
  }

  if (requiresPixPayment && !scheduledManualOrOnline && !isPixManualPaymentMethod(paymentMethod)) {
    failWith(fail, 'failed-precondition', 'Este pedido exige pagamento antecipado via Pix.')
  }

  return { paymentPolicy, paymentPolicyReason }
}

function getDateOrdinal(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function getDayKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return DAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
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

function getEffectiveSlotInterval(storeScheduling, products, fail) {
  const productIntervals = [...new Set(products
    .map((product) => product.slotIntervalMinutes)
    .filter((value) => value !== null))]

  if (productIntervals.length === 0) return storeScheduling.slotIntervalMinutes

  return productIntervals.reduce((commonInterval, productInterval) => {
    const nextInterval = (commonInterval / greatestCommonDivisor(commonInterval, productInterval)) * productInterval
    if (nextInterval > 1440) {
      failWith(
        fail,
        'failed-precondition',
        'Este carrinho contém itens com regras diferentes. Finalize em pedidos separados.'
      )
    }
    return nextInterval
  })
}

function assertScheduledRules({
  storeScheduling,
  products,
  deliveryType,
  scheduledInput,
  now,
  fail,
}) {
  if (!storeScheduling.enabled) {
    failWith(fail, 'failed-precondition', 'A loja não aceita pedidos agendados no momento.')
  }

  if (storeScheduling.fulfillmentTypes[deliveryType] !== true) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }

  const productRejectsFulfillment = products.some((product) => (
    product.fulfillmentTypes && product.fulfillmentTypes[deliveryType] !== true
  ))
  if (productRejectsFulfillment) {
    failWith(fail, 'failed-precondition', 'Este carrinho contém itens com regras diferentes. Finalize em pedidos separados.')
  }

  const productLeadMinutes = products
    .map((product) => product.minLeadMinutes)
    .filter((value) => value !== null)
  const minLeadMinutes = Math.max(storeScheduling.minLeadMinutes, ...productLeadMinutes, 0)
  const productMaxDays = products
    .map((product) => product.maxDaysAhead)
    .filter((value) => value !== null)
  const maxDaysAhead = Math.min(storeScheduling.maxDaysAhead, ...productMaxDays)
  const slotIntervalMinutes = getEffectiveSlotInterval(storeScheduling, products, fail)
  const nowDate = now instanceof Date ? now : new Date(now || Date.now())
  const nowParts = getBrazilParts(nowDate)
  const nowDateKey = formatDateKey(nowParts)
  const leadMillis = scheduledInput.scheduledFor.getTime() - nowDate.getTime()

  if (leadMillis <= 0) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }

  if (leadMillis < minLeadMinutes * MINUTE_MS) {
    const productDriver = products.find((product) => (
      product.minLeadMinutes !== null
      && product.minLeadMinutes === minLeadMinutes
      && product.minLeadMinutes > storeScheduling.minLeadMinutes
    ))

    if (productDriver) {
      if (minLeadMinutes >= 1440) {
        failWith(
          fail,
          'failed-precondition',
          `Este produto precisa de pelo menos ${Math.ceil(minLeadMinutes / 1440)} dias de antecedência.`
        )
      }
      failWith(
        fail,
        'failed-precondition',
        `Este produto precisa de pelo menos ${minLeadMinutes} minutos de antecedência.`
      )
    }

    failWith(
      fail,
      'failed-precondition',
      `A loja aceita agendamentos com pelo menos ${minLeadMinutes} minutos de antecedência.`
    )
  }

  const daysAhead = Math.round((getDateOrdinal(scheduledInput.dateKey) - getDateOrdinal(nowDateKey)) / DAY_MS)
  if (daysAhead < 0 || daysAhead > maxDaysAhead) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }

  if (storeScheduling.blockedDates.includes(scheduledInput.dateKey)) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }
  if (products.some((product) => product.blockedDates.includes(scheduledInput.dateKey))) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }

  if (!acceptsWindowAndInterval(
    storeScheduling.weeklyWindows,
    scheduledInput.dateKey,
    scheduledInput.minuteOfDay,
    slotIntervalMinutes,
    slotIntervalMinutes
  )) {
    failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
  }

  for (const product of products) {
    if (!product.weeklyWindows && product.slotIntervalMinutes === null) continue
    const productWindows = product.weeklyWindows || storeScheduling.weeklyWindows
    const productInterval = product.slotIntervalMinutes || slotIntervalMinutes
    if (!acceptsWindowAndInterval(
      productWindows,
      scheduledInput.dateKey,
      scheduledInput.minuteOfDay,
      slotIntervalMinutes,
      productInterval
    )) {
      failWith(fail, 'failed-precondition', 'Horário indisponível. Escolha outro horário.')
    }
  }

  return { minLeadMinutes, maxDaysAhead, slotIntervalMinutes }
}

function buildOrderSchedulingDecision({
  store,
  storeId,
  products,
  input,
  deliveryType,
  paymentMethod,
  now = new Date(),
  fail,
}) {
  const normalizedProducts = uniqueProducts(products)
  const storeScheduling = normalizeStoreScheduling(store)
  const preorderPaymentMode = normalizePreorderPaymentMode(store)
  const hasAsapOnly = normalizedProducts.some((product) => product.mode === 'asap_only')
  const hasScheduledOnly = normalizedProducts.some((product) => product.mode === 'scheduled_only')

  if (hasAsapOnly && hasScheduledOnly) {
    failWith(
      fail,
      'failed-precondition',
      'Este carrinho contém itens com regras diferentes. Finalize em pedidos separados.'
    )
  }

  const requestedTiming = normalizeOrderTiming(input?.orderTiming, fail)
  const orderTiming = hasScheduledOnly ? 'scheduled' : requestedTiming

  if (orderTiming === 'scheduled' && hasAsapOnly) {
    failWith(
      fail,
      'failed-precondition',
      'Este carrinho contém itens com regras diferentes. Finalize em pedidos separados.'
    )
  }

  if (orderTiming === 'asap') {
    const paymentPolicy = resolvePaymentPolicy({
      storeScheduling,
      products: normalizedProducts,
      orderTiming,
      paymentMethod,
      preorderPaymentMode,
      fail,
    })

    return {
      orderTiming: 'asap',
      scheduledFor: null,
      scheduledWindowStart: null,
      scheduledWindowEnd: null,
      scheduledDateKey: null,
      scheduledTimeLabel: null,
      scheduledSlotKey: null,
      schedulingSnapshot: null,
      ...paymentPolicy,
    }
  }

  const scheduledInput = getScheduledInput(input, fail)
  const effectiveRules = assertScheduledRules({
    storeScheduling,
    products: normalizedProducts,
    deliveryType,
    scheduledInput,
    now,
    fail,
  })
  const paymentPolicy = resolvePaymentPolicy({
    storeScheduling,
    products: normalizedProducts,
    orderTiming,
    paymentMethod,
    preorderPaymentMode,
    fail,
  })
  const contributingProducts = normalizedProducts.filter(hasProductSchedulingContribution)
  const requiredProducts = normalizedProducts.filter((product) => product.mode === 'scheduled_only')
  const source = requiredProducts.length > 0
    ? (contributingProducts.length === requiredProducts.length ? 'product_required' : 'mixed')
    : contributingProducts.length > 0
      ? 'mixed'
      : 'store'
  const scheduledWindowEnd = new Date(
    scheduledInput.scheduledFor.getTime() + (effectiveRules.slotIntervalMinutes * MINUTE_MS)
  )
  const safeStoreId = String(storeId || '').trim().replace(/[^A-Za-z0-9_-]/g, '-')

  return {
    orderTiming: 'scheduled',
    scheduledFor: scheduledInput.scheduledFor,
    scheduledWindowStart: scheduledInput.scheduledFor,
    scheduledWindowEnd,
    scheduledDateKey: scheduledInput.dateKey,
    scheduledTimeLabel: scheduledInput.timeLabel,
    scheduledSlotKey: `${safeStoreId}_${scheduledInput.dateKey}_${scheduledInput.timeLabel.replace(':', '-')}_${deliveryType}`,
    schedulingSnapshot: {
      source,
      minLeadMinutes: effectiveRules.minLeadMinutes,
      maxDaysAhead: effectiveRules.maxDaysAhead,
      slotIntervalMinutes: effectiveRules.slotIntervalMinutes,
      requiredByProducts: contributingProducts.map((product) => ({
        productId: product.productId,
        name: product.name,
        minLeadMinutes: product.minLeadMinutes,
        prepaymentPolicy: product.prepaymentPolicy,
      })),
    },
    ...paymentPolicy,
  }
}

module.exports = {
  BRAZIL_TIME_ZONE,
  buildOrderSchedulingDecision,
  isPixManualPaymentMethod,
}
