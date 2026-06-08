function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function firstValue(...values) {
  return values.find(hasValue)
}

function toObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function removeAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeMethodKey(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function sanitizePixText(value, maxLength = 25) {
  return removeAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, '')
    .trim()
    .slice(0, maxLength)
}

function normalizePixKey(key, keyType) {
  const cleanKey = String(key || '').trim()

  if (!cleanKey) return ''

  if (keyType === 'phone') {
    const digits = onlyDigits(cleanKey)

    if (!digits) return ''
    if (digits.startsWith('55')) return `+${digits}`

    return `+55${digits}`
  }

  if (keyType === 'cpf' || keyType === 'cnpj') {
    return onlyDigits(cleanKey)
  }

  if (keyType === 'email') {
    return cleanKey.toLowerCase()
  }

  return cleanKey
}

const METHOD_ALIASES = {
  pix: ['pix', 'pix_manual'],
  card: ['card', 'cards', 'cartao', 'cartoes', 'credit_card', 'debit_card', 'credit', 'debit', 'card_on_delivery'],
  cash: ['cash', 'dinheiro', 'money'],
}

function getAliases(method) {
  return (METHOD_ALIASES[method] || [method]).map(normalizeMethodKey)
}

function getAcceptedPaymentMethodKeys(store) {
  const methods = Array.isArray(store?.acceptedPaymentMethods)
    ? store.acceptedPaymentMethods
    : []

  return methods.map(normalizeMethodKey).filter(Boolean)
}

function getMethodFlag(source, aliases) {
  const map = toObject(source)

  for (const [key, value] of Object.entries(map)) {
    if (aliases.includes(normalizeMethodKey(key))) {
      return value
    }
  }

  return undefined
}

function isDisabledFlag(value) {
  return value === false || value?.enabled === false
}

export function isPublicPaymentMethodAllowed(store, method) {
  const aliases = getAliases(method)
  const acceptedKeys = getAcceptedPaymentMethodKeys(store)

  if (acceptedKeys.length > 0 && !aliases.some((alias) => acceptedKeys.includes(alias))) {
    return false
  }

  const publicPaymentMethods = toObject(store?.publicPaymentMethods)
  const publicFlag = getMethodFlag(publicPaymentMethods, aliases)

  if (isDisabledFlag(publicFlag)) return false

  if (
    Object.keys(publicPaymentMethods).length > 0 &&
    publicFlag === undefined &&
    acceptedKeys.length === 0
  ) {
    return false
  }

  const paymentFlag = getMethodFlag(store?.paymentMethods, aliases)

  if (isDisabledFlag(paymentFlag)) return false

  return true
}

export function getPublicPixConfig(store) {
  const pix = toObject(store?.pix)
  const settingsPix = toObject(store?.paymentSettings?.pix)
  const legacySettingsPix = toObject(store?.settings?.pix)

  const key = firstValue(
    pix.key,
    settingsPix.key,
    legacySettingsPix.key,
    store?.pixKey,
    store?.settings?.pixKey
  )

  const keyType = firstValue(
    pix.keyType,
    settingsPix.keyType,
    legacySettingsPix.keyType,
    store?.pixKeyType,
    'random'
  )

  const merchantName = firstValue(
    pix.merchantName,
    pix.receiverName,
    settingsPix.merchantName,
    settingsPix.receiverName,
    legacySettingsPix.merchantName,
    legacySettingsPix.receiverName,
    store?.name,
    'PratoBy'
  )

  const merchantCity = firstValue(
    pix.merchantCity,
    pix.receiverCity,
    settingsPix.merchantCity,
    settingsPix.receiverCity,
    legacySettingsPix.merchantCity,
    legacySettingsPix.receiverCity,
    store?.city,
    store?.address?.city,
    'ARACAJU'
  )

  const hasPixObject = Object.keys(pix).length > 0
  const hasSettingsPixObject = Object.keys(settingsPix).length > 0
  const hasLegacySettingsPixObject = Object.keys(legacySettingsPix).length > 0
  const legacyEnabled = !hasPixObject && !hasSettingsPixObject && !hasLegacySettingsPixObject && Boolean(store?.pixKey)
  const keyNormalized = normalizePixKey(key, keyType)

  return {
    enabled: pix.enabled === true || settingsPix.enabled === true || legacySettingsPix.enabled === true || legacyEnabled,
    key: keyNormalized,
    rawKey: String(key || '').trim(),
    keyType,
    merchantName: sanitizePixText(merchantName, 25),
    merchantCity: sanitizePixText(merchantCity, 15),
  }
}

export function getPublicAsaasConfig(store) {
  const asaas = toObject(store?.payments?.asaas)
  const status = normalizeMethodKey(asaas.status || (asaas.enabled === true ? 'active' : 'inactive'))
  const maxInstallmentCount = Number(asaas.maxInstallmentCount)

  return {
    enabled: asaas.enabled === true && status === 'active',
    status: status || 'inactive',
    maxInstallmentCount: Number.isInteger(maxInstallmentCount) && maxInstallmentCount > 1
      ? Math.min(maxInstallmentCount, 12)
      : null,
  }
}

export function getPublicPreorderPaymentPolicy(store) {
  const policy = toObject(store?.payments?.preorderPolicy)
  const mode = normalizeMethodKey(policy.mode || policy.requiredMethod || 'manual')

  return {
    mode: ['manual', 'pix_manual', 'asaas_online', 'manual_or_asaas'].includes(mode)
      ? mode
      : 'manual',
  }
}

export function isPublicAsaasOnlineAllowed(store) {
  return getPublicAsaasConfig(store).enabled === true
}
