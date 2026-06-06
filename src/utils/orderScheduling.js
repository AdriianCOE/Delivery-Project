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
  return null
}

export function isScheduledOrder(order) {
  return String(order?.orderTiming || '').toLowerCase() === 'scheduled'
}

export function getScheduledDate(order) {
  return timestampToDate(
    order?.scheduledFor ||
    order?.scheduledWindowStart ||
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
  const nowDate = now instanceof Date ? now : new Date(now)

  const diffMinutes = Math.round((date.getTime() - nowDate.getTime()) / 60000)
  if (diffMinutes < -5) return { state: 'late', label: `Passou há ${Math.abs(diffMinutes)} min`, minutes: diffMinutes }
  if (diffMinutes <= 0) return { state: 'now', label: 'Horário chegou', minutes: diffMinutes }
  if (diffMinutes < 60) return { state: 'soon', label: `Começa em ${diffMinutes} min`, minutes: diffMinutes }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return { state: 'later', label: `Começa em ${diffHours} h`, minutes: diffMinutes }

  const diffDays = Math.round(diffHours / 24)
  return { state: 'later', label: `Começa em ${diffDays} dia${diffDays === 1 ? '' : 's'}`, minutes: diffMinutes }
}

export function formatScheduledBadge(order, now = new Date()) {
  if (!isScheduledOrder(order)) return null
  const distance = getScheduledTimeDistance(order, now)
  if (!distance) return 'Agendado'
  if (distance.state === 'soon' || distance.state === 'now') return 'Preparar em breve'
  if (distance.state === 'late') return 'Horário passou'
  return 'Agendado'
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
