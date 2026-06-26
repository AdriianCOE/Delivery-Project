const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const WEEKDAY_TO_KEY = {
  sun: 'sun',
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
}

const dateFormatterCache = new Map()

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function getDateFormatter(timeZone = BRAZIL_TIME_ZONE) {
  if (dateFormatterCache.has(timeZone)) return dateFormatterCache.get(timeZone)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  dateFormatterCache.set(timeZone, formatter)
  return formatter
}

function getLocalParts(now = new Date(), timeZone = BRAZIL_TIME_ZONE) {
  const parts = getDateFormatter(timeZone).formatToParts(now)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekday = String(byType.weekday || 'sun').slice(0, 3).toLowerCase()
  const dayKey = WEEKDAY_TO_KEY[weekday] || 'sun'
  const hours = Number(byType.hour)
  const minutes = Number(byType.minute)

  return {
    dayKey,
    dayIndex: DAY_KEYS.indexOf(dayKey),
    minutesOfDay: (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0),
  }
}

function parseTimeToMinutes(value) {
  const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function normalizeAvailabilityMode(store = {}) {
  const settings = store.settings || {}
  const rawMode = String(
    settings.availabilityMode ||
      settings.operatingMode ||
      store.availabilityMode ||
      store.operatingMode ||
      ''
  ).trim().toLowerCase()

  if (['opening_hours', 'business_hours', 'automatic', 'auto', 'scheduled'].includes(rawMode)) {
    return 'opening_hours'
  }

  return 'manual'
}

function normalizeOpeningHours(store = {}) {
  const source =
    store.openingHours ||
    store.settings?.openingHours ||
    store.businessHours ||
    store.settings?.businessHours ||
    {}

  return DAY_KEYS.reduce((acc, dayKey) => {
    const raw = source?.[dayKey] || {}
    acc[dayKey] = {
      enabled: raw.enabled ?? raw.isOpen ?? raw.active ?? false,
      open: String(raw.open || raw.openAt || raw.from || '').trim(),
      close: String(raw.close || raw.closeAt || raw.to || '').trim(),
    }
    return acc
  }, {})
}

function getPauseUntil(store = {}) {
  const settings = store.settings || {}

  if (hasOwn(settings, 'temporaryPauseUntil')) return settings.temporaryPauseUntil
  if (hasOwn(settings, 'pausedUntil')) return settings.pausedUntil
  if (hasOwn(store, 'temporaryPauseUntil')) return store.temporaryPauseUntil
  if (hasOwn(store, 'pausedUntil')) return store.pausedUntil

  return null
}

function getPauseReason(store = {}) {
  const settings = store.settings || {}

  if (hasOwn(settings, 'temporaryPauseReason')) return String(settings.temporaryPauseReason || '').trim()
  if (hasOwn(settings, 'pausedReason')) return String(settings.pausedReason || '').trim()
  if (hasOwn(settings, 'pauseReason')) return String(settings.pauseReason || '').trim()
  if (hasOwn(store, 'temporaryPauseReason')) return String(store.temporaryPauseReason || '').trim()
  if (hasOwn(store, 'pausedReason')) return String(store.pausedReason || '').trim()
  if (hasOwn(store, 'pauseReason')) return String(store.pauseReason || '').trim()

  return ''
}

function parseDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis())
  if (value.seconds) return new Date(Number(value.seconds) * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getTemporaryPauseState(store = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const pauseUntil = parseDate(getPauseUntil(store))

  if (!pauseUntil) {
    return {
      active: false,
      expired: false,
      until: null,
      untilIso: '',
      reason: '',
    }
  }

  const expired = pauseUntil.getTime() <= now.getTime()

  return {
    active: !expired,
    expired,
    until: pauseUntil,
    untilIso: pauseUntil.toISOString(),
    reason: getPauseReason(store),
  }
}

function isWithinWindow(openMinutes, closeMinutes, currentMinutes) {
  if (openMinutes === null || closeMinutes === null) return false
  if (openMinutes === closeMinutes) return true
  if (closeMinutes > openMinutes) return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

function getAutomaticHoursStatus(store, now, timeZone) {
  const openingHours = normalizeOpeningHours(store)
  const local = getLocalParts(now, timeZone)
  const today = openingHours[local.dayKey]
  const previousDayKey = DAY_KEYS[(local.dayIndex + 6) % 7]
  const previous = openingHours[previousDayKey]

  const todayOpen = parseTimeToMinutes(today?.open)
  const todayClose = parseTimeToMinutes(today?.close)
  const previousOpen = parseTimeToMinutes(previous?.open)
  const previousClose = parseTimeToMinutes(previous?.close)

  if (previous?.enabled && previousOpen !== null && previousClose !== null && previousClose <= previousOpen) {
    if (local.minutesOfDay < previousClose) {
      return {
        isOpen: true,
        reason: 'overnight-hours',
        label: 'Aberta pelo horário de funcionamento',
      }
    }
  }

  if (today?.enabled && isWithinWindow(todayOpen, todayClose, local.minutesOfDay)) {
    return {
      isOpen: true,
      reason: 'business-hours',
      label: 'Aberta pelo horário de funcionamento',
    }
  }

  const hasAnyConfiguredDay = Object.values(openingHours).some((day) => day.enabled)
  return {
    isOpen: false,
    reason: hasAnyConfiguredDay ? 'outside-business-hours' : 'no-business-hours',
    label: hasAnyConfiguredDay ? 'Loja fechada agora. Você ainda pode ver o cardápio.' : 'Fechada: nenhum horário ativo',
  }
}

function getStoreOperationalStatus(store = {}, options = {}) {
  if (!store) {
    return { isOpen: false, mode: 'manual', reason: 'missing-store', label: 'Loja indisponível' }
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const settings = store.settings || {}
  const timeZone = String(settings.timeZone || store.timeZone || BRAZIL_TIME_ZONE).trim() || BRAZIL_TIME_ZONE

  if (
    store.isActive === false ||
    store.isBlocked === true ||
    store.isBillingBlocked === true ||
    store.isDeleted === true ||
    store.deletedAt
  ) {
    return { isOpen: false, mode: normalizeAvailabilityMode(store), reason: 'store-blocked', label: 'Loja indisponível' }
  }

  const temporaryPause = getTemporaryPauseState(store, { now })
  if (temporaryPause.active) {
    return {
      isOpen: false,
      mode: normalizeAvailabilityMode(store),
      reason: 'temporary-pause',
      label: 'Pausada temporariamente',
      temporaryPauseUntil: temporaryPause.untilIso,
      temporaryPauseReason: temporaryPause.reason,
    }
  }

  const mode = normalizeAvailabilityMode(store)
  if (mode === 'opening_hours') {
    return {
      ...getAutomaticHoursStatus(store, now, timeZone),
      mode,
      timeZone,
    }
  }

  return {
    isOpen: store.isOpen !== false,
    mode,
    reason: store.isOpen === false ? 'manual-closed' : 'manual-open',
    label: store.isOpen === false ? 'Fechada manualmente' : 'Aberta manualmente',
    timeZone,
  }
}

function storeAllowsScheduledOrdersWhenClosed(store = {}) {
  return (
    store.settings?.allowScheduledOrdersWhenClosed === true ||
    store.allowScheduledOrdersWhenClosed === true
  )
}

module.exports = {
  BRAZIL_TIME_ZONE,
  getTemporaryPauseState,
  getStoreOperationalStatus,
  storeAllowsScheduledOrdersWhenClosed,
}
