const STORAGE_PREFIX = 'pratoby:notifications-read'
const STORAGE_VERSION = 1

function getStorageKey(uid, storeId) {
  if (!uid || !storeId) return null
  return `${STORAGE_PREFIX}:${uid}:${storeId}`
}

function normalizeStoragePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      version: STORAGE_VERSION,
      read: payload.reduce((acc, id) => {
        if (id) {
          acc[String(id)] = {
            area: 'general',
            readAt: Date.now(),
          }
        }
        return acc
      }, {}),
      preferences: {},
    }
  }

  if (!payload || typeof payload !== 'object') {
    return {
      version: STORAGE_VERSION,
      read: {},
      preferences: {},
    }
  }

  const read = payload.read && typeof payload.read === 'object' ? payload.read : {}
  const preferences =
    payload.preferences && typeof payload.preferences === 'object'
      ? payload.preferences
      : {}

  return {
    version: STORAGE_VERSION,
    read,
    preferences,
  }
}

export function loadNotificationReadState(uid, storeId) {
  const key = getStorageKey(uid, storeId)
  if (!key || typeof localStorage === 'undefined') {
    return normalizeStoragePayload(null)
  }

  try {
    const saved = localStorage.getItem(key)
    return normalizeStoragePayload(saved ? JSON.parse(saved) : null)
  } catch (error) {
    console.error('[Notifications] Error loading read state from localStorage:', error)
    return normalizeStoragePayload(null)
  }
}

export function saveNotificationReadState(uid, storeId, state) {
  const key = getStorageKey(uid, storeId)
  if (!key || typeof localStorage === 'undefined') return normalizeStoragePayload(state)

  const safeState = normalizeStoragePayload(state)

  try {
    localStorage.setItem(key, JSON.stringify(safeState))
  } catch (error) {
    console.error('[Notifications] Error saving read state to localStorage:', error)
  }

  return safeState
}

export function createReadEntry(area) {
  return {
    area: area || 'general',
    readAt: Date.now(),
  }
}

export function getNotificationReadIds(state) {
  return Object.keys(normalizeStoragePayload(state).read)
}

export function getNotificationPreferences(state) {
  return normalizeStoragePayload(state).preferences
}

export function saveNotificationPreference(uid, storeId, key, value) {
  const currentState = loadNotificationReadState(uid, storeId)
  return saveNotificationReadState(uid, storeId, {
    ...currentState,
    preferences: {
      ...currentState.preferences,
      [key]: value,
    },
  })
}
