export const NOTIFICATION_AREAS = ['orders', 'reviews', 'billing', 'settings', 'general']
export const DASHBOARD_NOTIFICATION_EVENT = 'pratoby:dashboard-notification'
export const DASHBOARD_NOTIFICATION_READ_EVENT = 'pratoby:dashboard-notification-read'

const AREA_SET = new Set(NOTIFICATION_AREAS)
const SEVERITY_SET = new Set(['info', 'warning', 'danger', 'success'])

function normalizeArea(area) {
  return AREA_SET.has(area) ? area : 'general'
}

function normalizeSeverity(severity) {
  return SEVERITY_SET.has(severity) ? severity : 'info'
}

function normalizeCreatedAt(createdAt) {
  if (!createdAt) return Date.now()
  if (typeof createdAt === 'number') return createdAt
  if (createdAt instanceof Date) return createdAt.getTime()
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis()
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().getTime()

  const parsed = new Date(createdAt).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function normalizeDashboardNotification(notification) {
  const area = normalizeArea(notification?.area)
  const sourceType = notification?.sourceType || area
  const sourceId = notification?.sourceId || notification?.id || sourceType

  return {
    id: String(notification?.id || `${sourceType}:${sourceId}`),
    area,
    channel: notification?.channel || 'local_dashboard',
    title: notification?.title || 'Notificação do painel',
    message: notification?.message || notification?.description || '',
    severity: normalizeSeverity(notification?.severity || notification?.type),
    href: notification?.href || notification?.link || '/dashboard',
    createdAt: normalizeCreatedAt(notification?.createdAt || notification?.timestamp),
    sourceType,
    sourceId: String(sourceId),
    read: Boolean(notification?.read),
  }
}

export function dispatchDashboardNotification(notification, meta = {}) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(DASHBOARD_NOTIFICATION_EVENT, {
    detail: {
      notification: normalizeDashboardNotification(notification),
      ...meta,
    },
  }))
}

export function formatNotificationTime(createdAt) {
  const timestamp = normalizeCreatedAt(createdAt)
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function getDashboardAreaForPath(pathname) {
  if (!pathname) return null
  if (pathname === '/dashboard/orders' || pathname.startsWith('/dashboard/orders/')) return 'orders'
  if (pathname === '/dashboard/reviews' || pathname.startsWith('/dashboard/reviews/')) return 'reviews'
  if (
    pathname === '/dashboard/billing' ||
    pathname.startsWith('/dashboard/billing/') ||
    pathname === '/dashboard/subscription-management' ||
    pathname.startsWith('/dashboard/subscription-management/')
  ) {
    return 'billing'
  }
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) return 'settings'
  return null
}
