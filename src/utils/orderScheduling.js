function timestampToDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value?.toDate === 'function') {
    const date = value.toDate()
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object' && Number.isFinite(value.seconds)) {
    return new Date(value.seconds * 1000)
  }
  if (typeof value === 'object' && Number.isFinite(value._seconds)) {
    return new Date(value._seconds * 1000)
  }
  return null
}

export function isScheduledOrder(order) {
  return String(order?.orderTiming || '').toLowerCase() === 'scheduled'
}

export function getScheduledDate(order) {
  return timestampToDate(
    order?.scheduledFor ||
    order?.scheduledAt ||
    order?.scheduledWindowStart ||
    order?.schedule?.scheduledFor ||
    order?.schedulingSnapshot?.scheduledFor
  )
}

const ALLOWED_SLOT_INTERVALS = new Set([10, 15, 30, 60])

function normalizeSlotInterval(value, fallback = null) {
  const parsed = Number(value)
  return ALLOWED_SLOT_INTERVALS.has(parsed) ? parsed : fallback
}

export function formatScheduledDate(order) {
  const date = getScheduledDate(order)
  if (!date) return 'Horário agendado não informado'

  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)

  return `Agendado para ${weekday}, ${dayMonth} às ${time}`
}

export function getScheduledTimeDistance(order, now = new Date()) {
  const date = getScheduledDate(order)
  if (!date) return null
  const nowDate = getNowDate(now)

  const diffMinutes = Math.round((date.getTime() - nowDate.getTime()) / 60000)
  if (diffMinutes < -5) return { state: 'late', label: `Passou há ${Math.abs(diffMinutes)} min`, minutes: diffMinutes }
  if (diffMinutes <= 0) return { state: 'now', label: 'Horário chegou', minutes: diffMinutes }
  if (diffMinutes < 60) return { state: 'soon', label: `Começa em ${diffMinutes} min`, minutes: diffMinutes }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return { state: 'later', label: `Começa em ${diffHours} h`, minutes: diffMinutes }

  const diffDays = Math.round(diffHours / 24)
  return { state: 'later', label: `Começa em ${diffDays} dia${diffDays === 1 ? '' : 's'}`, minutes: diffMinutes }
}

const FINAL_ORDER_STATUSES = new Set(['entregue', 'delivered', 'finalizado'])
const CANCELED_ORDER_STATUSES = new Set(['cancelado', 'canceled', 'cancelled'])
const OPERATIONAL_STARTED_STATUSES = new Set(['preparando', 'em_preparo', 'preparo', 'in_progress', 'preparing', 'pronto', 'ready'])
const MAX_PREPARATION_LEAD_HINT_MINUTES = 240
const DEFAULT_PREPARATION_LEAD_MINUTES = 60

function normalizeStatus(status) {
  return String(status || '').toLowerCase().trim()
}

function getNowDate(now) {
  if (now instanceof Date) return Number.isNaN(now.getTime()) ? new Date() : now
  const parsed = new Date(now)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function getPreparationLeadMinutes(order, options = {}) {
  const candidates = [
    options.preparationLeadMinutes,
    order?.schedulingSnapshot?.preparationLeadMinutes,
    order?.schedulingSnapshot?.prepLeadMinutes,
    order?.preparationLeadMinutes,
    order?.schedulingSnapshot?.minLeadMinutes,
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)
    if (!Number.isFinite(value) || value <= 0) continue
    if (value > MAX_PREPARATION_LEAD_HINT_MINUTES) continue
    return Math.floor(value)
  }

  return DEFAULT_PREPARATION_LEAD_MINUTES
}

function isSameLocalDay(date, reference) {
  if (!date || !reference) return false
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

export function getScheduledOperationalAt(order, options = {}) {
  if (!isScheduledOrder(order)) return null
  const scheduledFor = getScheduledDate(order)
  if (!scheduledFor) return null

  const leadMinutes = getPreparationLeadMinutes(order, options)
  return new Date(scheduledFor.getTime() - leadMinutes * 60000)
}

export function getScheduledOperationalState(order, options = {}) {
  const status = normalizeStatus(order?.status)
  if (CANCELED_ORDER_STATUSES.has(status)) return 'canceled'
  if (FINAL_ORDER_STATUSES.has(status)) return 'completed'
  if (!isScheduledOrder(order)) return 'asap'

  const scheduledFor = getScheduledDate(order)
  if (!scheduledFor) return 'scheduled_due_soon'

  const now = getNowDate(options.now ?? new Date())
  const operationalAt = getScheduledOperationalAt(order, options) || scheduledFor

  if (OPERATIONAL_STARTED_STATUSES.has(status)) {
    if (status === 'pronto' || status === 'ready') return 'scheduled_due_soon'
    return now.getTime() >= scheduledFor.getTime() ? 'scheduled_late' : 'scheduled_due_soon'
  }

  if (now.getTime() < operationalAt.getTime()) return 'scheduled_future'
  if (now.getTime() < scheduledFor.getTime()) return 'scheduled_due_soon'
  return 'scheduled_late'
}

export function isScheduledFuture(order, options = {}) {
  return getScheduledOperationalState(order, options) === 'scheduled_future'
}

export function isScheduledDueSoon(order, options = {}) {
  return getScheduledOperationalState(order, options) === 'scheduled_due_soon'
}

export function isScheduledLate(order, options = {}) {
  return getScheduledOperationalState(order, options) === 'scheduled_late'
}

export function isOrderOperationalNow(order, options = {}) {
  const state = getScheduledOperationalState(order, options)
  return state === 'asap' || state === 'scheduled_due_soon' || state === 'scheduled_late'
}

export function formatScheduledOperationalLabel(order, options = {}) {
  const state = getScheduledOperationalState(order, options)
  const distance = getScheduledTimeDistance(order, options.now ?? new Date())

  if (state === 'scheduled_future') {
    return distance?.minutes > 0 ? `Preparar em ${distance.label.replace(/^Começa em\s*/i, '')}` : 'Agendado'
  }
  if (state === 'scheduled_due_soon') return 'Preparar em breve'
  if (state === 'scheduled_late') return 'Horário passou'
  if (state === 'completed') return 'Concluído'
  if (state === 'canceled') return 'Cancelado'
  return 'Agora'
}

export function formatScheduledBadge(order, now = new Date()) {
  if (!isScheduledOrder(order)) return null
  const state = getScheduledOperationalState(order, { now })
  if (state === 'scheduled_due_soon') return 'Preparar em breve'
  if (state === 'scheduled_late') return 'Horário passou'
  if (state === 'completed') return 'Concluído'
  if (state === 'canceled') return 'Cancelado'
  return 'Agendado'
}

export function getTodayScheduledSummary(orders, options = {}) {
  const now = getNowDate(options.now ?? new Date())
  const scheduledOrders = Array.isArray(orders)
    ? orders.filter((order) => isScheduledOrder(order))
    : []

  const openScheduledOrders = scheduledOrders.filter((order) => {
    const state = getScheduledOperationalState(order, { ...options, now })
    return state !== 'completed' && state !== 'canceled'
  })

  const todayOrders = openScheduledOrders
    .filter((order) => isSameLocalDay(getScheduledDate(order), now))
    .sort((a, b) => (getScheduledDate(a)?.getTime() || 0) - (getScheduledDate(b)?.getTime() || 0))

  const scheduledFutureCount = openScheduledOrders.filter((order) => isScheduledFuture(order, { ...options, now })).length
  const scheduledDueSoonCount = openScheduledOrders.filter((order) => isScheduledDueSoon(order, { ...options, now })).length
  const scheduledLateCount = openScheduledOrders.filter((order) => isScheduledLate(order, { ...options, now })).length

  return {
    scheduledTodayCount: todayOrders.length,
    scheduledFutureCount,
    scheduledDueSoonCount,
    scheduledLateCount,
    nextScheduledOrder: todayOrders.find((order) => getScheduledDate(order)?.getTime() >= now.getTime()) || todayOrders[0] || null,
    todayOrders,
  }
}

export function minutesToHumanLabel(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value)) return 'Seguir regra'
  if (value >= 1440 && value % 1440 === 0) {
    const days = value / 1440
    return `${days} dia${days === 1 ? '' : 's'}`
  }
  if (value >= 60 && value % 60 === 0) {
    const hours = value / 60
    return `${hours} hora${hours === 1 ? '' : 's'}`
  }
  return `${value} minutos`
}

export function normalizeSchedulingFormValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null
}
