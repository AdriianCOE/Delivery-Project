export const ORDER_STATUS_SLA_MINUTES = Object.freeze({
  pendente: 3,
  confirmado: 10,
  preparando: 40,
  pronto: 20,
  em_rota: 60,
})

export const ACTIVE_ORDER_STATUSES = Object.freeze(Object.keys(ORDER_STATUS_SLA_MINUTES))

const STATUS_TIMESTAMP_FIELDS = Object.freeze({
  pendente: ['pendingAt'],
  confirmado: ['confirmedAt', 'acceptedAt'],
  preparando: ['preparingAt', 'preparationStartedAt'],
  pronto: ['readyAt'],
  em_rota: ['outForDeliveryAt', 'deliveryStartedAt'],
})

export function normalizeOrderStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()

  return {
    novo: 'pendente',
    new: 'pendente',
    received: 'pendente',
    recebido: 'pendente',
    aguardando: 'pendente',
    aguardando_confirmacao: 'pendente',
    awaiting_confirmation: 'pendente',
    pending: 'pendente',
    pendente: 'pendente',

    aceito: 'confirmado',
    accepted: 'confirmado',
    confirmed: 'confirmado',
    confirmado: 'confirmado',

    em_preparo: 'preparando',
    in_preparation: 'preparando',
    in_progress: 'preparando',
    preparing: 'preparando',
    preparo: 'preparando',
    preparando: 'preparando',

    pronto: 'pronto',
    pronta: 'pronto',
    ready: 'pronto',
    ready_for_pickup: 'pronto',
    aguardando_retirada: 'pronto',

    entregando: 'em_rota',
    saiu_para_entrega: 'em_rota',
    saiu_entrega: 'em_rota',
    em_entrega: 'em_rota',
    out_for_delivery: 'em_rota',
    em_rota: 'em_rota',

    finalizado: 'entregue',
    delivered: 'entregue',
    entregue: 'entregue',

    canceled: 'cancelado',
    cancelled: 'cancelado',
    cancelado: 'cancelado',
  }[value] || value || 'pendente'
}

export function timestampToMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value.seconds !== undefined) return Number(value.seconds) * 1000

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export function isOrderActiveStatus(status) {
  return ACTIVE_ORDER_STATUSES.includes(normalizeOrderStatus(status))
}

export function getOrderStatusStartedAtMillis(order, normalizedStatus = normalizeOrderStatus(order?.status)) {
  const statusFields = STATUS_TIMESTAMP_FIELDS[normalizedStatus] || []
  const candidates = [
    ...statusFields.map((field) => order?.[field]),
    order?.statusUpdatedAt,
    order?.createdAt,
  ]

  for (const candidate of candidates) {
    const value = timestampToMillis(candidate)
    if (value !== null) return value
  }

  return null
}

export function getOrderSlaState(order, now = Date.now()) {
  const status = normalizeOrderStatus(order?.status)
  const thresholdMinutes = ORDER_STATUS_SLA_MINUTES[status] || null
  const startedAtMillis = getOrderStatusStartedAtMillis(order, status)
  const nowMillis = timestampToMillis(now) ?? Date.now()

  if (!thresholdMinutes || startedAtMillis === null) {
    return {
      status,
      active: Boolean(thresholdMinutes),
      overdue: false,
      thresholdMinutes,
      elapsedMinutes: 0,
      remainingMinutes: thresholdMinutes,
      overdueMinutes: 0,
      startedAtMillis,
    }
  }

  const elapsedMinutes = Math.max(0, Math.floor((nowMillis - startedAtMillis) / 60000))
  const overdue = elapsedMinutes >= thresholdMinutes

  return {
    status,
    active: true,
    overdue,
    thresholdMinutes,
    elapsedMinutes,
    remainingMinutes: Math.max(0, thresholdMinutes - elapsedMinutes),
    overdueMinutes: overdue ? Math.max(1, elapsedMinutes - thresholdMinutes) : 0,
    startedAtMillis,
  }
}
