export const NOTIFICATION_PREFERENCES_EVENT = 'pratoby:notification-preferences'

export const NOTIFICATION_EVENT_TYPES = {
  newOrder: {
    label: 'Novos pedidos',
    area: 'orders',
    channels: ['internal', 'badge', 'toast', 'sound', 'browser', 'fcm', 'title'],
    critical: true,
  },
  reviews: {
    label: 'Avaliacoes',
    area: 'reviews',
    channels: ['internal', 'badge', 'browser'],
    critical: false,
  },
  billing: {
    label: 'Assinatura e cobranca',
    area: 'billing',
    channels: ['internal', 'badge', 'toast', 'browser'],
    critical: true,
  },
  settings: {
    label: 'Configuracoes da loja',
    area: 'settings',
    channels: ['internal', 'badge', 'toast'],
    critical: false,
  },
  reports: {
    label: 'Promocoes e relatorios',
    area: 'general',
    channels: ['internal'],
    critical: false,
    future: true,
  },
}

export const NOTIFICATION_CHANNEL_MATRIX = [
  {
    event: 'newOrder',
    internal: true,
    badge: 'orders',
    toast: true,
    sound: true,
    browser: true,
    fcm: true,
    title: true,
    email: false,
  },
  {
    event: 'reviews',
    internal: true,
    badge: 'reviews',
    toast: false,
    sound: false,
    browser: 'configurable',
    fcm: 'future',
    title: false,
    email: false,
  },
  {
    event: 'billing',
    internal: true,
    badge: 'billing',
    toast: 'urgent-only',
    sound: false,
    browser: 'configurable',
    fcm: 'future',
    title: false,
    email: 'existing-transactional-only',
  },
  {
    event: 'settings',
    internal: 'optional',
    badge: 'settings',
    toast: 'user-action-only',
    sound: false,
    browser: false,
    fcm: false,
    title: false,
    email: false,
  },
  {
    event: 'reports',
    internal: 'future',
    badge: 'general',
    toast: false,
    sound: false,
    browser: false,
    fcm: false,
    title: false,
    email: false,
  },
]

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  channels: {
    internal: true,
    sound: true,
    toast: true,
    browser: false,
    fcm: false,
    title: true,
  },
  events: {
    newOrder: true,
    reviews: true,
    billing: true,
    settings: true,
    reports: false,
  },
  updatedAt: null,
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeNotificationPreferences(preferences) {
  const source = preferences && typeof preferences === 'object' ? preferences : {}
  const sourceChannels = source.channels && typeof source.channels === 'object' ? source.channels : {}
  const sourceEvents = source.events && typeof source.events === 'object' ? source.events : {}

  return {
    channels: Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.channels).reduce((acc, key) => {
      acc[key] = normalizeBoolean(sourceChannels[key], DEFAULT_NOTIFICATION_PREFERENCES.channels[key])
      return acc
    }, {}),
    events: Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.events).reduce((acc, key) => {
      acc[key] = normalizeBoolean(sourceEvents[key], DEFAULT_NOTIFICATION_PREFERENCES.events[key])
      return acc
    }, {}),
    updatedAt: source.updatedAt || null,
  }
}

export function getNotificationEventType(notification) {
  const sourceType = String(notification?.sourceType || notification?.eventType || notification?.area || '').trim()

  if (sourceType === 'order' || notification?.area === 'orders') return 'newOrder'
  if (sourceType === 'review' || notification?.area === 'reviews') return 'reviews'
  if (sourceType === 'billing' || notification?.area === 'billing') return 'billing'
  if (sourceType === 'store' || notification?.area === 'settings') return 'settings'
  if (sourceType === 'report') return 'reports'

  return 'settings'
}

export function isCriticalNotification(notification) {
  const eventType = getNotificationEventType(notification)
  if (eventType === 'newOrder') return true
  if (eventType === 'billing' && ['danger', 'critical'].includes(notification?.severity)) return true
  return notification?.critical === true
}

export function shouldShowInternalNotification(notification, preferences) {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  if (normalizedPreferences.channels.internal !== true) return false

  const eventType = getNotificationEventType(notification)
  if (normalizedPreferences.events[eventType] === false && !isCriticalNotification(notification)) {
    return false
  }

  return true
}

export function notificationPreferenceEnabled(preferences, group, key) {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  return normalizedPreferences[group]?.[key] === true
}

export function updateNotificationPreference(preferences, group, key, value) {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)

  return {
    ...normalizedPreferences,
    [group]: {
      ...normalizedPreferences[group],
      [key]: Boolean(value),
    },
    updatedAt: Date.now(),
  }
}

export function dispatchNotificationPreferencesUpdated(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail }))
}
