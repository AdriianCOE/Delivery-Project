const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const crypto = require('crypto')

const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY')
const ASAAS_WEBHOOK_AUTH_TOKEN = defineSecret('ASAAS_WEBHOOK_AUTH_TOKEN')

const REGION = 'southamerica-east1'
const TRIAL_DAYS = 14
const START_ASAAS_LOCK_TTL_MS = 5 * 60 * 1000
const SUBSCRIPTION_MANAGEMENT_RATE_LIMIT_MS = 30 * 1000
const BILLING_PROVIDER = 'asaas'
const DEFAULT_ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3'
const BILLING_PENDING_PAYMENT_METHOD_STATUS = 'billing_pending_payment_method'
const ASAAS_CHECKOUT_EXPIRATION_MINUTES = 1440
const SUBSCRIPTION_CHANGE_REQUESTS_COLLECTION = 'subscriptionChangeRequests'
const SUBSCRIPTION_CANCELLATION_REQUESTS_COLLECTION = 'subscriptionCancellationRequests'
const SUBSCRIPTION_DUE_DATE_REQUESTS_COLLECTION = 'subscriptionDueDateRequests'

const CHECKOUT_STATUSES = new Set([
  'checkout_pending',
  'pending_checkout',
  'billing_pending',
  BILLING_PENDING_PAYMENT_METHOD_STATUS,
])
const START_ASAAS_ALLOWED_STATUSES = new Set([
  'checkout_pending',
  'pending_checkout',
  'billing_pending',
  BILLING_PENDING_PAYMENT_METHOD_STATUS,
  'trialing',
  'active',
  'past_due',
  'blocked',
  'canceled',
])
const INTERNAL_STATUSES = new Set([
  'checkout_pending',
  BILLING_PENDING_PAYMENT_METHOD_STATUS,
  'trialing',
  'active',
  'past_due',
  'canceled',
  'blocked',
])
const ASAAS_BILLING_TYPES = new Set(['UNDEFINED', 'BOLETO', 'PIX'])
const PRIVILEGED_ROLES = new Set(['admin', 'developer', 'dev', 'superadmin'])
const PLAN_ORDER = {
  essential: 1,
  professional: 2,
  premium: 3,
}
const SUBSCRIPTION_MANAGEMENT_ACTIVE_STATUSES = new Set(['trialing', 'active', 'past_due'])
const SUBSCRIPTION_MANAGEMENT_TERMINAL_STATUSES = new Set(['canceled', 'blocked'])

// Backend source of truth for billing amounts. Frontend plan catalogs are display-only.
const PLAN_CATALOG = {
  essential: {
    id: 'essential',
    name: 'Essencial',
    monthlyCents: 5999,
    annualCents: 59990,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyCents: 8999,
    annualCents: 89990,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    monthlyCents: 15999,
    annualCents: 159990,
  },
}

function getSecretValue(secret, envName) {
  try {
    return secret.value() || process.env[envName] || ''
  } catch (err) {
    return process.env[envName] || ''
  }
}

function getAsaasBaseUrl() {
  const configuredBaseUrl = process.env.ASAAS_BASE_URL
  const allowSandboxFallback =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    process.env.ALLOW_ASAAS_SANDBOX_FALLBACK === 'true'

  if (!configuredBaseUrl && !allowSandboxFallback) {
    throw new HttpsError(
      'failed-precondition',
      'ASAAS_BASE_URL precisa ser configurada explicitamente para evitar uso acidental do sandbox.'
    )
  }

  return String(configuredBaseUrl || DEFAULT_ASAAS_BASE_URL).replace(/\/+$/, '')
}

function getAsaasCheckoutBaseUrl() {
  const configuredBaseUrl = process.env.ASAAS_CHECKOUT_BASE_URL

  if (!configuredBaseUrl) {
    throw new HttpsError(
      'failed-precondition',
      'ASAAS_CHECKOUT_BASE_URL precisa ser configurada quando o Asaas nao retornar URL direta do checkout.'
    )
  }

  return String(configuredBaseUrl).replace(/\/+$/, '')
}

function getPublicAppBaseUrl() {
  return String(
    process.env.PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      'https://pratoby.com'
  ).replace(/\/+$/, '')
}

function safeDocId(value) {
  return String(value || '').replace(/\//g, '_')
}

function stringToTimingBytes(value) {
  const stringValue = String(value || '')
  const bytes = new Uint8Array(stringValue.length)

  for (let index = 0; index < stringValue.length; index += 1) {
    bytes[index] = stringValue.charCodeAt(index)
  }

  return bytes
}

function timingSafeStringEqual(receivedValue, expectedValue) {
  const expectedBuffer = stringToTimingBytes(expectedValue)
  const receivedBuffer = stringToTimingBytes(receivedValue)

  if (!expectedBuffer.length || receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

function buildLocalSubscriptionId(providerSubscriptionId) {
  return `${BILLING_PROVIDER}_${safeDocId(providerSubscriptionId)}`
}

function buildStartAsaasLockId(uid) {
  return `startAsaasSubscription_${safeDocId(uid)}`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildSlug(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'loja'
}

function normalizeCpfCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11 && digits.length !== 14) return null
  return digits
}

function normalizePostalCode(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeBrazilianPhoneForAsaas(value) {
  const digits = normalizePhoneDigits(value)
  if (digits.length === 13 && digits.startsWith('55')) return digits.slice(2)
  return digits
}

function normalizePlan(value) {
  const plan = String(value || '').trim().toLowerCase()
  if (!PLAN_CATALOG[plan]) {
    throw new HttpsError('invalid-argument', 'Plano invalido.')
  }
  return plan
}

function normalizeBillingCycle(value) {
  const cycle = String(value || 'monthly').trim().toLowerCase()
  if (!['monthly', 'annual'].includes(cycle)) {
    throw new HttpsError('invalid-argument', 'Ciclo de cobranca invalido.')
  }
  return cycle
}

function getPlanAmountCents(plan, billingCycle) {
  const config = PLAN_CATALOG[plan]
  return billingCycle === 'annual' ? config.annualCents : config.monthlyCents
}

function getAsaasCycle(billingCycle) {
  return billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY'
}

function addBillingCycle(date, billingCycle) {
  const result = new Date(date.getTime())
  if (billingCycle === 'annual') {
    result.setUTCFullYear(result.getUTCFullYear() + 1)
  } else {
    result.setUTCMonth(result.getUTCMonth() + 1)
  }
  return result
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function formatDateInSaoPaulo(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function parseProviderDate(value) {
  if (!value) return null

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateOnly) {
      return new Date(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T03:00:00.000Z`)
    }

    const brDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (brDate) {
      return new Date(`${brDate[3]}-${brDate[2]}-${brDate[1]}T03:00:00.000Z`)
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDate(value) {
  if (!value) return null
  if (value.toDate) return value.toDate()
  if (value.toMillis) return new Date(value.toMillis())
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pickExistingTrialEndsDate(userData, storeData) {
  return toDate(storeData?.trialEndsAt) || toDate(userData?.trialEndsAt)
}

function resolveTrialEndsDateForAsaas(userData, storeData, nowDate) {
  const existingTrialEndsDate = pickExistingTrialEndsDate(userData, storeData)
  if (existingTrialEndsDate && existingTrialEndsDate.getTime() > nowDate.getTime()) {
    return existingTrialEndsDate
  }

  const status = userData?.subscriptionStatus || storeData?.subscriptionStatus || ''
  if (status === 'trialing' && !existingTrialEndsDate) {
    return addDays(nowDate, TRIAL_DAYS)
  }

  if (!existingTrialEndsDate && CHECKOUT_STATUSES.has(status)) {
    return addDays(nowDate, TRIAL_DAYS)
  }

  return nowDate
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex')
}

function shouldStoreWebhookDebugPayload() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || process.env.ASAAS_WEBHOOK_DEBUG_PAYLOAD === 'true'
}

function getPaymentValue(payment) {
  const value = Number(payment?.value)
  return Number.isFinite(value) ? value : null
}

function buildProviderEventSummary({
  body,
  eventId,
  event,
  payment,
  providerSubscriptionId,
  localSubscriptionId = null,
  receivedAt,
  now,
}) {
  return {
    provider: BILLING_PROVIDER,
    eventId,
    eventType: event,
    paymentId: payment?.id || null,
    providerSubscriptionId: providerSubscriptionId || null,
    localSubscriptionId: localSubscriptionId || null,
    paymentStatus: payment?.status || null,
    billingType: payment?.billingType || null,
    value: getPaymentValue(payment),
    dueDate: payment?.dueDate || null,
    payloadHash: payloadHash(body),
    receivedAt: receivedAt || now,
    updatedAt: now,
    ...(shouldStoreWebhookDebugPayload() ? { payloadDebug: body } : {}),
  }
}

function parseWebhookBody(request) {
  if (request.body && typeof request.body === 'object') return request.body

  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body)
    } catch (err) {
      return {}
    }
  }

  if (request.rawBody) {
    try {
      return JSON.parse(request.rawBody.toString('utf8'))
    } catch (err) {
      return {}
    }
  }

  return {}
}

function getAsaasErrorMessage(body) {
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return body.errors
      .map((err) => err.description || err.message || err.code)
      .filter(Boolean)
      .join(' | ')
  }

  return body?.message || body?.description || null
}

async function asaasRequest(path, options = {}) {
  const apiKey = getSecretValue(ASAAS_API_KEY, 'ASAAS_API_KEY')
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'ASAAS_API_KEY nao configurada.')
  }

  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'PratoBy/1.0 FirebaseFunctions',
      access_token: apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch (err) {
    body = { raw: text }
  }

  if (!response.ok) {
    const message = getAsaasErrorMessage(body) || `Asaas retornou HTTP ${response.status}.`
    const error = new Error(message)
    error.status = response.status
    error.body = body
    throw error
  }

  return body
}

function getCustomerPayload(uid, userData, billingData) {
  const cpfCnpj = normalizeCpfCnpj(billingData.cpfCnpj || billingData.document)
  if (!cpfCnpj) {
    throw new HttpsError('invalid-argument', 'CPF/CNPJ do pagador e obrigatorio para criar cliente Asaas.')
  }

  const name = String(
    billingData.name ||
      billingData.legalName ||
      userData.displayName ||
      userData.name ||
      userData.signup?.storeName ||
      userData.email ||
      ''
  ).trim()

  if (!name) {
    throw new HttpsError('invalid-argument', 'Nome do pagador e obrigatorio.')
  }

  const email = String(billingData.email || userData.email || '').trim().toLowerCase()
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new HttpsError('invalid-argument', 'E-mail de cobranca invalido.')
  }

  const mobilePhone = normalizeBrazilianPhoneForAsaas(billingData.phone || userData.phoneE164 || userData.phone)
  if (!mobilePhone) {
    throw new HttpsError('invalid-argument', 'WhatsApp ou celular do pagador e obrigatorio.')
  }

  // Validate and sanitize address fields required by Asaas
  const postalCode = normalizePostalCode(billingData.postalCode || billingData.cep || '')
  if (!postalCode || postalCode.length !== 8) {
    throw new HttpsError('invalid-argument', 'CEP do pagador deve ter 8 digitos e e obrigatorio para o Asaas.')
  }

  const address = String(billingData.address || billingData.street || '').trim()
  if (!address) {
    throw new HttpsError('invalid-argument', 'Endereco do pagador e obrigatorio para o Asaas.')
  }

  const addressNumber = String(billingData.addressNumber || billingData.number || '').trim()
  if (!addressNumber) {
    throw new HttpsError('invalid-argument', 'Numero do endereco do pagador e obrigatorio para o Asaas.')
  }

  const province = String(billingData.province || billingData.neighborhood || billingData.bairro || '').trim()
  if (!province) {
    throw new HttpsError('invalid-argument', 'Bairro do pagador e obrigatorio para o Asaas.')
  }

  const complement = String(billingData.complement || billingData.complemento || '').trim() || undefined

  const payload = {
    name,
    cpfCnpj,
    email,
    mobilePhone,
    externalReference: `pratoby:user:${uid}`,
    notificationDisabled: billingData.notificationDisabled === true,
    groupName: 'PratoBy',
    postalCode,
    address,
    addressNumber,
    province,
  }

  if (complement) payload.complement = complement

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === '') delete payload[key]
  })

  return payload
}

async function createAsaasCustomer(uid, userData, billingData) {
  const payload = getCustomerPayload(uid, userData, billingData)
  return await asaasRequest('/customers', {
    method: 'POST',
    body: payload,
  })
}

async function createAsaasSubscription({
  customerId,
  uid,
  storeId,
  plan,
  billingCycle,
  billingType,
  nextDueDate,
}) {
  const normalizedBillingType = String(billingType || 'UNDEFINED').trim().toUpperCase()
  if (!ASAAS_BILLING_TYPES.has(normalizedBillingType)) {
    throw new HttpsError('invalid-argument', 'Forma de cobranca Asaas invalida para esta fase.')
  }

  const amountCents = getPlanAmountCents(plan, billingCycle)
  const planName = PLAN_CATALOG[plan].name

  return await asaasRequest('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType: normalizedBillingType,
      nextDueDate,
      value: amountCents / 100,
      cycle: getAsaasCycle(billingCycle),
      description: `PratoBy ${planName} (${billingCycle === 'annual' ? 'anual' : 'mensal'})`,
      externalReference: `pratoby:${uid}:${storeId}`,
    },
  })
}

function getCheckoutCustomerData(uid, userData, billingData) {
  const customerPayload = getCustomerPayload(uid, userData, billingData)
  const customerData = {
    name: customerPayload.name,
    cpfCnpj: customerPayload.cpfCnpj,
    email: customerPayload.email,
    phone: normalizeBrazilianPhoneForAsaas(customerPayload.mobilePhone),
  }

  for (const field of ['postalCode', 'address', 'addressNumber', 'complement', 'province']) {
    if (customerPayload[field]) customerData[field] = customerPayload[field]
  }

  return customerData
}

function buildAsaasCheckoutUrl(asaasCheckout) {
  const directUrl =
    asaasCheckout?.url ||
    asaasCheckout?.checkoutUrl ||
    asaasCheckout?.paymentUrl ||
    asaasCheckout?.invoiceUrl ||
    asaasCheckout?.link ||
    ''

  if (/^https:\/\//i.test(String(directUrl))) return directUrl
  if (!asaasCheckout?.id) return null

  return `${getAsaasCheckoutBaseUrl()}?id=${encodeURIComponent(asaasCheckout.id)}`
}

async function createAsaasCheckout({
  uid,
  storeId,
  userData,
  billingData,
  plan,
  billingCycle,
  nextDueDate,
  operationId,
}) {
  const amountCents = getPlanAmountCents(plan, billingCycle)
  const planName = PLAN_CATALOG[plan].name
  const baseUrl = getPublicAppBaseUrl()

  return await asaasRequest('/checkouts', {
    method: 'POST',
    body: {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: ASAAS_CHECKOUT_EXPIRATION_MINUTES,
      externalReference: `pratoby:checkout:${uid}:${storeId}:${operationId}`,
      callback: {
        successUrl: `${baseUrl}/dashboard/billing?asaasCheckout=success`,
        cancelUrl: `${baseUrl}/dashboard/billing?asaasCheckout=cancel`,
        expiredUrl: `${baseUrl}/dashboard/billing?asaasCheckout=expired`,
      },
      items: [
        {
          name: `PratoBy ${planName}`,
          description: `Assinatura ${billingCycle === 'annual' ? 'anual' : 'mensal'} com 14 dias gratis`,
          quantity: 1,
          value: amountCents / 100,
        },
      ],
      customerData: getCheckoutCustomerData(uid, userData, billingData),
      subscription: {
        cycle: getAsaasCycle(billingCycle),
        nextDueDate,
      },
    },
  })
}

function canUseExistingAsaasSubscription(userData) {
  return Boolean(getAsaasSubscriptionId(userData))
}

function getAsaasSubscriptionId(data) {
  return String(
    data?.asaasSubscriptionId ||
      data?.providerSubscriptionId ||
      data?.subscription?.asaasSubscriptionId ||
      data?.subscription?.providerSubscriptionId ||
      ''
  ).trim()
}

function getAsaasCustomerId(data) {
  return String(
    data?.asaasCustomerId ||
      data?.providerCustomerId ||
      data?.subscription?.asaasCustomerId ||
      data?.subscription?.providerCustomerId ||
      ''
  ).trim()
}

function getAsaasCheckoutId(data) {
  return String(
    data?.asaasCheckoutId ||
      data?.providerCheckoutId ||
      data?.billingCheckout?.asaasCheckoutId ||
      data?.billingCheckout?.providerCheckoutId ||
      ''
  ).trim()
}

function getAsaasCheckoutUrl(data) {
  return String(
    data?.asaasCheckoutUrl ||
      data?.checkoutUrl ||
      data?.billingCheckout?.asaasCheckoutUrl ||
      data?.billingCheckout?.checkoutUrl ||
      ''
  ).trim()
}

function getLocalSubscriptionIdFromData(data) {
  const subscriptionId = String(data?.subscriptionId || data?.subscription?.id || data?.id || '').trim()
  if (subscriptionId) return subscriptionId

  const providerSubscriptionId = getAsaasSubscriptionId(data)
  return providerSubscriptionId ? buildLocalSubscriptionId(providerSubscriptionId) : null
}

function collectCanonicalSubscriptionIds(userData, storeData) {
  return uniqueValues([
    getLocalSubscriptionIdFromData(userData),
    getLocalSubscriptionIdFromData(storeData),
  ])
}

async function findExistingBillingReference({ db, transaction, userData, storeData }) {
  const userProviderSubscriptionId = getAsaasSubscriptionId(userData)
  const storeProviderSubscriptionId = getAsaasSubscriptionId(storeData)
  const subscriptionIds = collectCanonicalSubscriptionIds(userData, storeData)
  const canonicalSubscriptions = []

  for (const subscriptionId of subscriptionIds) {
    const subscriptionDoc = await transaction.get(db.collection('subscriptions').doc(subscriptionId))
    if (subscriptionDoc.exists) {
      canonicalSubscriptions.push({
        id: subscriptionDoc.id,
        ...subscriptionDoc.data(),
      })
    }
  }

  const canonicalSubscription = canonicalSubscriptions[0] || null
  const canonicalProviderSubscriptionId = getAsaasSubscriptionId(canonicalSubscription)
  const providerSubscriptionIds = uniqueValues([
    userProviderSubscriptionId,
    storeProviderSubscriptionId,
    ...canonicalSubscriptions.map((subscription) => getAsaasSubscriptionId(subscription)),
  ])
  const canonicalIds = uniqueValues([
    ...subscriptionIds.filter((subscriptionId) => canonicalSubscriptions.some((subscription) => subscription.id === subscriptionId)),
    ...canonicalSubscriptions.map((subscription) => subscription.id),
  ])
  const providerSubscriptionId =
    canonicalProviderSubscriptionId || storeProviderSubscriptionId || userProviderSubscriptionId || null
  const localSubscriptionId =
    canonicalSubscription?.id ||
    getLocalSubscriptionIdFromData(storeData) ||
    getLocalSubscriptionIdFromData(userData) ||
    (providerSubscriptionId ? buildLocalSubscriptionId(providerSubscriptionId) : null)

  return {
    exists: Boolean(providerSubscriptionId || canonicalSubscription),
    isInconsistent: providerSubscriptionIds.length > 1 || canonicalIds.length > 1,
    userProviderSubscriptionId: userProviderSubscriptionId || null,
    storeProviderSubscriptionId: storeProviderSubscriptionId || null,
    canonicalProviderSubscriptionId: canonicalProviderSubscriptionId || null,
    canonicalSubscription,
    providerSubscriptionId,
    localSubscriptionId,
    asaasCustomerId:
      getAsaasCustomerId(canonicalSubscription) ||
      getAsaasCustomerId(storeData) ||
      getAsaasCustomerId(userData) ||
      null,
    status: canonicalSubscription?.status || storeData?.subscriptionStatus || userData?.subscriptionStatus || null,
  }
}

function findExistingCheckoutReference(userData, storeData) {
  const checkoutId = getAsaasCheckoutId(storeData) || getAsaasCheckoutId(userData)
  if (!checkoutId) {
    return { exists: false }
  }

  return {
    exists: true,
    checkoutId,
    checkoutUrl: getAsaasCheckoutUrl(storeData) || getAsaasCheckoutUrl(userData) || null,
    asaasCustomerId: getAsaasCustomerId(storeData) || getAsaasCustomerId(userData) || null,
    status:
      storeData?.billingCheckoutStatus ||
      userData?.billingCheckoutStatus ||
      storeData?.subscriptionStatus ||
      userData?.subscriptionStatus ||
      BILLING_PENDING_PAYMENT_METHOD_STATUS,
  }
}

async function findReusableCheckoutReference({ db, transaction, userData, storeData, now }) {
  const checkoutId = getAsaasCheckoutId(storeData) || getAsaasCheckoutId(userData)
  if (!checkoutId) return { exists: false }

  const checkoutDoc = await transaction.get(db.collection('billingCheckouts').doc(safeDocId(checkoutId)))
  const checkoutData = checkoutDoc.exists ? checkoutDoc.data() || {} : {}
  const checkoutUrl =
    checkoutData.checkoutUrl ||
    getAsaasCheckoutUrl(storeData) ||
    getAsaasCheckoutUrl(userData) ||
    null
  const checkoutStatus = String(
    checkoutData.billingCheckoutStatus ||
      storeData?.billingCheckoutStatus ||
      userData?.billingCheckoutStatus ||
      ''
  ).trim()
  const expiresAt = checkoutData.expiresAt || storeData?.asaasCheckoutExpiresAt || userData?.asaasCheckoutExpiresAt || null
  const expiresAtDate = toDate(expiresAt)
  const isReusable =
    checkoutStatus === 'pending' &&
    Boolean(checkoutUrl) &&
    Boolean(expiresAtDate && expiresAtDate.getTime() > now.toMillis())

  if (!isReusable) {
    return { exists: false, staleCheckoutId: checkoutId }
  }

  return {
    exists: true,
    checkoutId,
    checkoutUrl,
    expiresAt,
    asaasCustomerId: getAsaasCustomerId(checkoutData) || getAsaasCustomerId(storeData) || getAsaasCustomerId(userData) || null,
    status: BILLING_PENDING_PAYMENT_METHOD_STATUS,
    billingCheckoutStatus: checkoutStatus,
  }
}

function validateUserCanStart(userData, storeData) {
  if (userData.role !== 'merchant') {
    throw new HttpsError('permission-denied', 'Permissao negada.')
  }

  if (canUseExistingAsaasSubscription(userData)) {
    return
  }

  const userStatus = userData.subscriptionStatus || ''
  const onboardingStatus = userData.onboardingStatus || ''
  const storeStatus = storeData?.subscriptionStatus || ''

  const userAllowed =
    START_ASAAS_ALLOWED_STATUSES.has(userStatus) || CHECKOUT_STATUSES.has(onboardingStatus)
  const storeAllowed = !storeData || START_ASAAS_ALLOWED_STATUSES.has(storeStatus)

  if (!userAllowed || !storeAllowed) {
    throw new HttpsError('failed-precondition', 'Assinatura em estado invalido para iniciar checkout.')
  }
}

function normalizeStoreId(value) {
  const storeId = String(value || '').trim()
  if (!storeId) return null
  if (storeId.includes('/')) {
    throw new HttpsError('invalid-argument', 'storeId invalido.')
  }
  return storeId
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function getFallbackStoreIds(userData) {
  return uniqueValues([
    userData.storeId,
    ...(Array.isArray(userData.storeIds) ? userData.storeIds : []),
  ])
}

function storeAllowsUser(storeData, uid) {
  const allowedUserIds = Array.isArray(storeData?.allowedUserIds)
    ? storeData.allowedUserIds.map((value) => String(value || '').trim())
    : []
  const merchantUids = Array.isArray(storeData?.merchantUids)
    ? storeData.merchantUids.map((value) => String(value || '').trim())
    : []

  return (
    storeData?.ownerUid === uid ||
    storeData?.ownerId === uid ||
    allowedUserIds.includes(uid) ||
    merchantUids.includes(uid)
  )
}

function assertStoreOwnership(storeData, uid) {
  if (!storeAllowsUser(storeData, uid)) {
    throw new HttpsError('permission-denied', 'Loja nao pertence ao usuario.')
  }
}

async function resolveStoreForSubscription({ db, transaction, uid, userData, requestedStoreId }) {
  const normalizedRequestedStoreId = normalizeStoreId(requestedStoreId)

  if (normalizedRequestedStoreId) {
    const storeRef = db.collection('stores').doc(normalizedRequestedStoreId)
    const storeDoc = await transaction.get(storeRef)
    if (!storeDoc.exists) {
      throw new HttpsError('failed-precondition', 'Loja informada nao encontrada.')
    }

    const storeData = storeDoc.data()
    assertStoreOwnership(storeData, uid)

    return {
      storeRef,
      storeData,
      storeId: storeRef.id,
      hasExistingStore: true,
    }
  }

  const fallbackStoreIds = getFallbackStoreIds(userData)
  if (!fallbackStoreIds.length) {
    const storeRef = db.collection('stores').doc()
    return {
      storeRef,
      storeData: null,
      storeId: storeRef.id,
      hasExistingStore: false,
    }
  }

  for (const storeId of fallbackStoreIds) {
    const storeRef = db.collection('stores').doc(storeId)
    const storeDoc = await transaction.get(storeRef)

    if (!storeDoc.exists) continue

    const storeData = storeDoc.data()
    assertStoreOwnership(storeData, uid)

    return {
      storeRef,
      storeData,
      storeId: storeRef.id,
      hasExistingStore: true,
    }
  }

  throw new HttpsError('failed-precondition', 'Nenhuma loja vinculada foi encontrada.')
}

function getLockAgeMillis(lockData, now) {
  const lockedAt = lockData.lockedAt
  if (!lockedAt?.toMillis) return Number.POSITIVE_INFINITY
  return now.toMillis() - lockedAt.toMillis()
}

function assertLockCanBeAcquired(lockDoc, now) {
  if (!lockDoc.exists) return

  const lockData = lockDoc.data()
  if (lockData.status === 'recovery_needed') {
    throw new HttpsError(
      'failed-precondition',
      'Existe uma assinatura Asaas pendente de recuperacao. Contate o suporte.'
    )
  }

  if (lockData.status === 'provisioning' && getLockAgeMillis(lockData, now) < START_ASAAS_LOCK_TTL_MS) {
    throw new HttpsError(
      'resource-exhausted',
      'A assinatura ja esta sendo provisionada. Aguarde alguns minutos.'
    )
  }
}

function buildAlreadyStartedResponse(existingReference) {
  return {
    ok: true,
    alreadyStarted: true,
    message: existingReference.checkoutId
      ? 'Esta loja ja possui um checkout Asaas pendente.'
      : 'Esta loja ja possui uma assinatura Asaas vinculada.',
    subscriptionId: existingReference.localSubscriptionId || null,
    asaasCustomerId: existingReference.asaasCustomerId || null,
    asaasSubscriptionId: existingReference.providerSubscriptionId || null,
    asaasCheckoutId: existingReference.checkoutId || null,
    checkoutUrl: existingReference.checkoutUrl || null,
    paymentUrl: existingReference.checkoutUrl || null,
    expiresAt: existingReference.expiresAt || null,
    billingCheckoutStatus: existingReference.billingCheckoutStatus || null,
    status: existingReference.status || null,
  }
}

async function acquireStartAsaasSubscriptionLock({
  db,
  admin,
  uid,
  userRef,
  requestedStoreId,
  requestedPlan,
  requestedBillingCycle,
  operationId,
}) {
  const lockRef = db.collection('billingLocks').doc(buildStartAsaasLockId(uid))

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef)
    const lockDoc = await transaction.get(lockRef)

    if (!userDoc.exists) {
      throw new HttpsError('failed-precondition', 'Usuario nao encontrado.')
    }

    const userData = { uid, ...userDoc.data() }
    const storeState = await resolveStoreForSubscription({
      db,
      transaction,
      uid,
      userData,
      requestedStoreId,
    })
    const existingReference = await findExistingBillingReference({
      db,
      transaction,
      userData,
      storeData: storeState.storeData,
    })

    if (existingReference.isInconsistent) {
      setAuditLog(transaction, db, admin.firestore.Timestamp.now(), {
        action: 'billing_inconsistent_subscription_reference',
        entity: 'subscription',
        entityId: existingReference.localSubscriptionId || null,
        actorUid: uid,
        uid,
        storeId: storeState.storeId,
        provider: BILLING_PROVIDER,
        userAsaasSubscriptionId: existingReference.userProviderSubscriptionId,
        storeAsaasSubscriptionId: existingReference.storeProviderSubscriptionId,
        canonicalAsaasSubscriptionId: existingReference.canonicalProviderSubscriptionId,
      })
    }

    if (existingReference.exists) {
      return {
        alreadyStarted: true,
        existing: buildAlreadyStartedResponse(existingReference),
      }
    }

    const now = admin.firestore.Timestamp.now()
    const existingCheckoutReference = await findReusableCheckoutReference({
      db,
      transaction,
      userData,
      storeData: storeState.storeData,
      now,
    })
    if (existingCheckoutReference.exists) {
      return {
        alreadyStarted: true,
        existing: buildAlreadyStartedResponse(existingCheckoutReference),
      }
    }

    validateUserCanStart(userData, storeState.storeData)

    assertLockCanBeAcquired(lockDoc, now)

    const plan = normalizePlan(requestedPlan || userData.plan || 'essential')
    const billingCycle = normalizeBillingCycle(requestedBillingCycle || userData.billingCycle || 'monthly')

    transaction.set(lockRef, {
      uid,
      provider: BILLING_PROVIDER,
      operation: 'startAsaasSubscription',
      operationId,
      status: 'provisioning',
      plan,
      billingCycle,
      storeId: storeState.storeId,
      requestedStoreId: normalizeStoreId(requestedStoreId),
      hasExistingStore: storeState.hasExistingStore,
      lockedAt: now,
      expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + START_ASAAS_LOCK_TTL_MS),
      updatedAt: now,
    })

    return {
      alreadyStarted: false,
      userData,
      storeRef: storeState.storeRef,
      storeData: storeState.storeData,
      storeId: storeState.storeId,
      hasExistingStore: storeState.hasExistingStore,
      plan,
      billingCycle,
      lockRef,
    }
  })
}

async function releaseStartAsaasSubscriptionLock({ db, lockRef, operationId, logger }) {
  try {
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef)
      if (!lockDoc.exists) return

      const lockData = lockDoc.data()
      if (lockData.operationId !== operationId) return

      transaction.delete(lockRef)
    })
  } catch (error) {
    logger.warn('Failed to release Asaas subscription lock', {
      operationId,
      error: error.message || String(error),
    })
  }
}

async function markStartAsaasSubscriptionRecovery({
  db,
  admin,
  logger,
  lockRef,
  operationId,
  uid,
  storeId,
  localSubscriptionId,
  asaasCustomerId,
  asaasSubscription,
  plan,
  billingCycle,
  trialEndsDate,
  error,
}) {
  const now = admin.firestore.Timestamp.now()
  const errorMessage = error.message || String(error)

  try {
    const batch = db.batch()
    batch.set(
      db.collection('billingRecovery').doc(localSubscriptionId),
      {
        provider: BILLING_PROVIDER,
        status: 'pending',
        reason: 'final_transaction_failed',
        uid,
        storeId,
        localSubscriptionId,
        providerCustomerId: asaasCustomerId,
        providerSubscriptionId: asaasSubscription.id,
        plan,
        billingCycle,
        trialEndsAt: admin.firestore.Timestamp.fromDate(trialEndsDate),
        providerSubscription: asaasSubscription,
        error: errorMessage,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    )
    batch.set(
      lockRef,
      {
        uid,
        provider: BILLING_PROVIDER,
        operation: 'startAsaasSubscription',
        operationId,
        status: 'recovery_needed',
        localSubscriptionId,
        providerSubscriptionId: asaasSubscription.id,
        updatedAt: now,
      },
      { merge: true }
    )
    batch.set(db.collection('auditLogs').doc(), {
      action: 'asaas_subscription_recovery_needed',
      entity: 'subscription',
      entityId: localSubscriptionId,
      uid,
      storeId,
      provider: BILLING_PROVIDER,
      asaasCustomerId,
      asaasSubscriptionId: asaasSubscription.id,
      plan,
      billingCycle,
      error: errorMessage,
      createdAt: now,
      source: 'asaas_integration',
    })
    await batch.commit()
  } catch (recoveryError) {
    logger.error('Failed to write Asaas billing recovery record', {
      operationId,
      localSubscriptionId,
      originalError: errorMessage,
      recoveryError: recoveryError.message || String(recoveryError),
    })
  }
}

function toExternalProvisioningError(error) {
  if (error instanceof HttpsError) return error

  return new HttpsError(
    'internal',
    'Nao foi possivel iniciar a assinatura no Asaas. Tente novamente em alguns instantes.'
  )
}

function toFinalPersistenceError(error, localSubscriptionId) {
  return new HttpsError(
    'internal',
    `Checkout criado no Asaas, mas falhou ao salvar estado local (${localSubscriptionId}): ${error.message || String(error)}`,
    {
      localSubscriptionId,
      originalCode: error.code || null,
    }
  )
}

async function createAuditLog(db, admin, data) {
  await db.collection('auditLogs').add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'asaas_integration',
  })
}

function setAuditLog(transaction, db, now, data) {
  transaction.set(db.collection('auditLogs').doc(), {
    ...data,
    createdAt: now,
    source: 'asaas_integration',
  })
}

function assertCallableMerchantAuth(request) {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const provider = String(request.auth?.token?.firebase?.sign_in_provider || '').toLowerCase()
  if (provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Usuarios anonimos nao podem gerenciar assinatura.')
  }

  return uid
}

function userHasPrivilegedRole(userData) {
  const directRole = String(userData?.role || userData?.userRole || '').toLowerCase().trim()
  if (PRIVILEGED_ROLES.has(directRole)) return true

  const roles = Array.isArray(userData?.roles) ? userData.roles : []
  return roles.some((role) => PRIVILEGED_ROLES.has(String(role || '').toLowerCase().trim()))
}

function getProfileStoreKeys(userData) {
  return uniqueValues([
    userData?.storeId,
    userData?.storeSlug,
    ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
    ...(Array.isArray(userData?.storeKeys) ? userData.storeKeys : []),
  ])
}

function getStoreManagementKeys(storeData, storeId) {
  return uniqueValues([
    storeId,
    storeData?.storeId,
    storeData?.storeDocId,
    storeData?.storeSlug,
    storeData?.slug,
    ...(Array.isArray(storeData?.storeKeys) ? storeData.storeKeys : []),
  ])
}

function storeAllowsUserForManagement(storeData, userData, uid, storeId) {
  const owner = storeData?.owner
  const ownerUid = typeof owner === 'object' && owner !== null ? owner.uid || owner.id : owner
  if (ownerUid === uid || storeData?.createdBy === uid || storeAllowsUser(storeData, uid)) {
    return true
  }

  const profileKeys = getProfileStoreKeys(userData)
  const storeKeys = getStoreManagementKeys(storeData, storeId)
  return storeKeys.some((key) => profileKeys.includes(key))
}

async function resolveManagementContextInTransaction({ db, transaction, uid, requestedStoreId }) {
  const storeId = normalizeStoreId(requestedStoreId)
  if (!storeId) {
    throw new HttpsError('invalid-argument', 'storeId obrigatorio.')
  }

  const userRef = db.collection('users').doc(uid)
  const storeRef = db.collection('stores').doc(storeId)
  const userDoc = await transaction.get(userRef)
  const storeDoc = await transaction.get(storeRef)

  if (!userDoc.exists) {
    throw new HttpsError('failed-precondition', 'Usuario nao encontrado.')
  }

  if (!storeDoc.exists) {
    throw new HttpsError('failed-precondition', 'Loja informada nao encontrada.')
  }

  const userData = { uid, ...userDoc.data() }
  const storeData = { id: storeDoc.id, ...storeDoc.data() }
  const isPrivileged = userHasPrivilegedRole(userData)

  if (!isPrivileged && !storeAllowsUserForManagement(storeData, userData, uid, storeId)) {
    throw new HttpsError('permission-denied', 'Loja nao pertence ao usuario.')
  }

  const existingReference = await findExistingBillingReference({
    db,
    transaction,
    userData,
    storeData,
  })

  return {
    uid,
    userRef,
    userData,
    storeRef,
    storeData,
    storeId,
    isPrivileged,
    existingReference,
  }
}

async function resolveManagementContext({ db, uid, requestedStoreId }) {
  return await db.runTransaction(async (transaction) => {
    return await resolveManagementContextInTransaction({
      db,
      transaction,
      uid,
      requestedStoreId,
    })
  })
}

function getKnownPlan(value, fallback = 'essential') {
  const plan = String(value || '').trim().toLowerCase()
  return PLAN_CATALOG[plan] ? plan : fallback
}

function getKnownBillingCycle(value, fallback = 'monthly') {
  const cycle = String(value || '').trim().toLowerCase()
  return ['monthly', 'annual'].includes(cycle) ? cycle : fallback
}

function getContextPlan(context) {
  return getKnownPlan(
    context.existingReference?.canonicalSubscription?.plan ||
      context.storeData?.plan ||
      context.userData?.plan ||
      'essential'
  )
}

function getContextBillingCycle(context) {
  return getKnownBillingCycle(
    context.existingReference?.canonicalSubscription?.billingCycle ||
      context.storeData?.billingCycle ||
      context.userData?.billingCycle ||
      'monthly'
  )
}

function getContextSubscriptionStatus(context) {
  return String(
    context.existingReference?.canonicalSubscription?.status ||
      context.storeData?.subscriptionStatus ||
      context.userData?.subscriptionStatus ||
      'checkout_pending'
  ).trim()
}

function serializeDate(value) {
  const date = toDate(value)
  return date ? date.toISOString() : null
}

function getPreferredDate(...values) {
  return values.find((value) => Boolean(value)) || null
}

function sanitizeTextField(value, maxLength = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.slice(0, maxLength)
}

function sanitizeAuditPayload(payload) {
  return JSON.parse(JSON.stringify(payload || {}))
}

function buildManagementRequestId({ action, uid, storeId, payload, dateKey }) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ action, uid, storeId, payload, dateKey }))
    .digest('hex')
    .slice(0, 24)
  return `${safeDocId(action)}_${safeDocId(storeId)}_${hash}`
}

async function enforceSubscriptionManagementRateLimit({
  db,
  admin,
  uid,
  storeId,
  action,
  limitMs = SUBSCRIPTION_MANAGEMENT_RATE_LIMIT_MS,
}) {
  const rateLimitRef = db
    .collection('rateLimits')
    .doc(`subscriptionManagement_${safeDocId(uid)}_${safeDocId(storeId)}_${safeDocId(action)}`)

  await db.runTransaction(async (transaction) => {
    const rateLimitDoc = await transaction.get(rateLimitRef)
    const now = admin.firestore.Timestamp.now()
    const updatedAt = rateLimitDoc.exists ? toDate(rateLimitDoc.data()?.updatedAt) : null

    if (updatedAt && now.toMillis() - updatedAt.getTime() < limitMs) {
      throw new HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de tentar novamente.')
    }

    transaction.set(
      rateLimitRef,
      {
        uid,
        storeId,
        action,
        operation: 'subscription_management',
        updatedAt: now,
        expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + limitMs),
      },
      { merge: true }
    )
  })
}

async function createManagementRequestInTransaction({
  db,
  transaction,
  now,
  collectionName,
  action,
  type,
  uid,
  storeId,
  payload,
  auditAction,
}) {
  const safePayload = sanitizeAuditPayload(payload)
  const dateKey = new Date(now.toMillis()).toISOString().slice(0, 10)
  const requestId = buildManagementRequestId({
    action,
    uid,
    storeId,
    payload: safePayload,
    dateKey,
  })
  const requestRef = db.collection(collectionName).doc(requestId)
  const requestDoc = await transaction.get(requestRef)

  if (requestDoc.exists) {
    return {
      requestId,
      alreadyExists: true,
      status: requestDoc.data()?.status || 'pending',
    }
  }

  transaction.set(requestRef, {
    storeId,
    userId: uid,
    actorUid: uid,
    type,
    status: 'pending',
    payload: safePayload,
    source: 'merchant_panel',
    provider: BILLING_PROVIDER,
    createdAt: now,
    updatedAt: now,
  })

  setAuditLog(transaction, db, now, {
    action: auditAction,
    entity: collectionName,
    entityId: requestId,
    actorUid: uid,
    uid,
    storeId,
    provider: BILLING_PROVIDER,
    payload: safePayload,
  })

  return {
    requestId,
    alreadyExists: false,
    status: 'pending',
  }
}

function getSubscriptionManagementActions(context) {
  const status = getContextSubscriptionStatus(context)
  const hasAsaasSubscription = Boolean(context.existingReference?.providerSubscriptionId)
  const activeEnough = SUBSCRIPTION_MANAGEMENT_ACTIVE_STATUSES.has(status)
  const terminal = SUBSCRIPTION_MANAGEMENT_TERMINAL_STATUSES.has(status)

  return {
    canChangePlan: hasAsaasSubscription && !terminal,
    canCancel: hasAsaasSubscription && activeEnough,
    canRequestDueDateChange: hasAsaasSubscription && activeEnough,
    canUpdatePaymentMethod: true,
    canSyncStatus: hasAsaasSubscription,
  }
}

function buildSubscriptionManagementResponse(context) {
  const plan = getContextPlan(context)
  const billingCycle = getContextBillingCycle(context)
  const status = getContextSubscriptionStatus(context)
  const subscriptionData = context.existingReference?.canonicalSubscription || {}
  const trialEndsAt = getPreferredDate(
    subscriptionData.trialEndsAt,
    context.storeData?.trialEndsAt,
    context.userData?.trialEndsAt
  )
  const currentPeriodEnd = getPreferredDate(
    subscriptionData.currentPeriodEnd,
    context.storeData?.currentPeriodEnd,
    context.userData?.currentPeriodEnd
  )
  const nextChargeAt = status === 'trialing' ? trialEndsAt : currentPeriodEnd
  const amountCents = Number.isFinite(Number(subscriptionData.amountCents))
    ? Number(subscriptionData.amountCents)
    : getPlanAmountCents(plan, billingCycle)
  const hasAsaasSubscription = Boolean(context.existingReference?.providerSubscriptionId)
  const billingMethodConfigured = Boolean(
    context.storeData?.billingMethodConfigured ||
      context.userData?.billingMethodConfigured ||
      hasAsaasSubscription
  )

  return {
    storeId: context.storeId,
    plan: {
      id: plan,
      name: PLAN_CATALOG[plan].name,
      billingCycle,
      amountCents,
    },
    billingCycle,
    subscriptionStatus: status,
    trialEndsAt: serializeDate(trialEndsAt),
    currentPeriodEnd: serializeDate(currentPeriodEnd),
    nextChargeAt: serializeDate(nextChargeAt),
    hasAsaasSubscription,
    paymentMethod: {
      provider: BILLING_PROVIDER,
      configured: billingMethodConfigured,
      status: billingMethodConfigured ? 'configured' : 'pending',
      label: billingMethodConfigured ? 'Configurada com seguranca via Asaas' : 'Pendente de configuracao',
    },
    asaas: {
      hasCustomer: Boolean(context.existingReference?.asaasCustomerId),
      hasSubscription: hasAsaasSubscription,
    },
    latestCharges: [],
    latestChargesAvailable: false,
    actions: getSubscriptionManagementActions(context),
  }
}

function getProviderValueCents(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

function mapAsaasSubscriptionStatusToInternal(providerStatus, context) {
  const normalizedStatus = String(providerStatus || '').toUpperCase().trim()
  const currentStatus = getContextSubscriptionStatus(context)
  const trialEndsAt = toDate(
    getPreferredDate(
      context.existingReference?.canonicalSubscription?.trialEndsAt,
      context.storeData?.trialEndsAt,
      context.userData?.trialEndsAt
    )
  )
  const trialStillActive = trialEndsAt && trialEndsAt.getTime() > Date.now()

  if (normalizedStatus === 'ACTIVE') {
    if (currentStatus === 'trialing' && trialStillActive) return 'trialing'
    if (CHECKOUT_STATUSES.has(currentStatus) && trialStillActive) return 'trialing'
    if (SUBSCRIPTION_MANAGEMENT_TERMINAL_STATUSES.has(currentStatus)) return currentStatus
    return 'active'
  }

  if (['OVERDUE', 'PAST_DUE'].includes(normalizedStatus)) return 'past_due'
  if (['INACTIVE', 'CANCELLED', 'CANCELED', 'DELETED', 'EXPIRED'].includes(normalizedStatus)) {
    return 'canceled'
  }

  return currentStatus
}

function buildAsaasSyncUpdate({ providerSubscription, context, now, admin }) {
  const providerStatus = String(providerSubscription?.status || '').trim() || null
  const nextStatus = mapAsaasSubscriptionStatusToInternal(providerStatus, context)
  const nextDueDate = parseProviderDate(providerSubscription?.nextDueDate)
  const currentPeriodEnd = nextDueDate
    ? admin.firestore.Timestamp.fromDate(nextDueDate)
    : getPreferredDate(
        context.existingReference?.canonicalSubscription?.currentPeriodEnd,
        context.storeData?.currentPeriodEnd,
        context.userData?.currentPeriodEnd
      )
  const amountCents = getProviderValueCents(providerSubscription?.value)

  const update = {
    status: nextStatus,
    providerStatus,
    lastAsaasSyncAt: now,
    updatedAt: now,
  }

  if (currentPeriodEnd) update.currentPeriodEnd = currentPeriodEnd
  if (providerSubscription?.billingType) update.billingType = providerSubscription.billingType
  if (amountCents !== null) update.amountCents = amountCents

  return update
}

function normalizeCancelMode(value) {
  const mode = String(value || 'end_of_cycle').trim().toLowerCase()
  if (!['end_of_cycle', 'immediate'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'Modo de cancelamento invalido.')
  }
  return mode
}

function normalizeEffectiveMode(value, currentPlan, targetPlan) {
  const requested = String(value || '').trim().toLowerCase()
  if (requested && !['immediate', 'next_cycle'].includes(requested)) {
    throw new HttpsError('invalid-argument', 'Modo de alteracao de plano invalido.')
  }

  if (PLAN_ORDER[targetPlan] < PLAN_ORDER[currentPlan]) return 'next_cycle'
  return requested || 'immediate'
}

async function claimStoreSlug(transaction, db, uid, storeId, storeName, now) {
  const baseSlug = buildSlug(storeName)
  let finalSlug = null
  let candidateSlug = baseSlug

  for (let i = 0; i < 5; i++) {
    const claimRef = db.collection('storeSlugClaims').doc(candidateSlug)
    const claimDoc = await transaction.get(claimRef)
    if (!claimDoc.exists) {
      finalSlug = candidateSlug
      transaction.set(claimRef, {
        storeId,
        ownerUid: uid,
        claimedAt: now,
        source: 'start_asaas_subscription',
      })
      break
    }

    const suffix = crypto.randomBytes(3).toString('hex')
    candidateSlug = `${baseSlug}-${suffix}`
  }

  if (!finalSlug) {
    throw new HttpsError('resource-exhausted', 'Nao foi possivel gerar uma URL unica para a loja.')
  }

  return finalSlug
}

function buildStorePayload({
  uid,
  userData,
  storeId,
  storeSlug,
  plan,
  billingCycle,
  trialStartedAt,
  trialEndsAt,
  asaasCustomerId,
  asaasSubscriptionId,
  localSubscriptionId,
}) {
  const storeName = userData.signup?.storeName || 'Minha Loja'

  return {
    name: storeName,
    storeName,
    slug: storeSlug,
    storeSlug,
    ownerId: uid,
    ownerUid: uid,
    ownerEmail: userData.email || '',
    city: userData.signup?.city || '',
    category: userData.signup?.segment || '',
    segment: userData.signup?.segment || '',
    isActive: true,
    isOpen: false,
    isBlocked: false,
    isBillingBlocked: false,
    isDeleted: false,
    subscriptionStatus: 'trialing',
    onboardingStatus: 'completed',
    billingProvider: BILLING_PROVIDER,
    plan,
    billingCycle,
    trialStartedAt,
    trialEndsAt,
    currentPeriodEnd: trialEndsAt,
    asaasCustomerId,
    asaasSubscriptionId,
    subscriptionId: localSubscriptionId,
    createdAt: trialStartedAt,
    updatedAt: trialStartedAt,
    createdBy: uid,
    source: 'self_signup_asaas_trial',
  }
}

function buildPendingBillingStorePayload({
  uid,
  userData,
  storeId,
  storeSlug,
  plan,
  billingCycle,
  asaasCustomerId,
  asaasCheckoutId,
  checkoutUrl,
  now,
}) {
  const storeName = userData.signup?.storeName || 'Minha Loja'

  return {
    name: storeName,
    storeName,
    storeId,
    storeDocId: storeId,
    slug: storeSlug,
    storeSlug,
    storeKeys: [storeId, storeSlug],
    ownerId: uid,
    ownerUid: uid,
    ownerEmail: userData.email || '',
    city: userData.signup?.city || '',
    category: userData.signup?.segment || '',
    segment: userData.signup?.segment || '',
    isActive: true,
    isOpen: false,
    isBlocked: false,
    isBillingBlocked: true,
    isDeleted: false,
    subscriptionStatus: BILLING_PENDING_PAYMENT_METHOD_STATUS,
    onboardingStatus: 'billing_pending',
    billingProvider: BILLING_PROVIDER,
    billingMethodConfigured: false,
    billingCheckoutStatus: 'pending',
    plan,
    billingCycle,
    asaasCustomerId: asaasCustomerId || null,
    asaasCheckoutId,
    asaasCheckoutUrl: checkoutUrl,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    source: 'self_signup_asaas_checkout_pending',
  }
}

function buildMirroredBillingPayload({
  plan,
  billingCycle,
  status,
  trialStartedAt,
  trialEndsAt,
  currentPeriodEnd,
  asaasCustomerId,
  asaasSubscriptionId,
  localSubscriptionId,
  lastPaymentId,
  lastPaymentStatus,
  now,
}) {
  return {
    subscriptionStatus: status,
    billingProvider: BILLING_PROVIDER,
    plan,
    billingCycle,
    trialStartedAt,
    trialEndsAt,
    currentPeriodEnd,
    asaasCustomerId,
    asaasSubscriptionId,
    subscriptionId: localSubscriptionId,
    lastPaymentId: lastPaymentId || null,
    lastPaymentStatus: lastPaymentStatus || null,
    updatedAt: now,
  }
}

function isPaidPaymentStatus(status) {
  return ['CONFIRMED', 'RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(
    String(status || '').toUpperCase()
  )
}

function mapPaymentEventToInternalStatus(event, payment, subscriptionData) {
  const currentStatus = subscriptionData.status || 'trialing'
  const currentPaymentIsPaid =
    subscriptionData.lastPaymentId === payment.id &&
    isPaidPaymentStatus(subscriptionData.lastPaymentStatus)

  if (event === 'PAYMENT_CREATED') return currentStatus
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') return 'active'

  if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
    return currentPaymentIsPaid ? currentStatus : 'past_due'
  }

  if (event === 'PAYMENT_DELETED') {
    return currentPaymentIsPaid ? currentStatus : 'past_due'
  }

  if (event === 'PAYMENT_REFUNDED') {
    return 'past_due'
  }

  return currentStatus
}

function getCurrentPeriodEndForEvent(event, payment, subscriptionData, admin) {
  if (event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') {
    return subscriptionData.currentPeriodEnd || subscriptionData.trialEndsAt || null
  }

  const dueDate = parseProviderDate(payment.dueDate) || new Date()
  const periodEnd = addBillingCycle(dueDate, subscriptionData.billingCycle || 'monthly')
  return admin.firestore.Timestamp.fromDate(periodEnd)
}

function buildWebhookPaymentUpdate({ event, payment, subscriptionData, nextStatus, now, admin }) {
  const currentPeriodEnd = getCurrentPeriodEndForEvent(event, payment, subscriptionData, admin)
  const lastPaymentStatus = payment.status || event

  return {
    status: nextStatus,
    lastPaymentId: payment.id,
    lastPaymentStatus,
    lastProviderEventType: event,
    lastProviderEventAt: now,
    currentPeriodEnd,
    updatedAt: now,
  }
}

function buildMirrorFromSubscription(subscriptionData, update, now) {
  return {
    subscriptionStatus: update.status,
    billingProvider: BILLING_PROVIDER,
    billingCycle: subscriptionData.billingCycle,
    plan: subscriptionData.plan,
    trialStartedAt: subscriptionData.trialStartedAt || null,
    trialEndsAt: subscriptionData.trialEndsAt || null,
    currentPeriodEnd: update.currentPeriodEnd || subscriptionData.currentPeriodEnd || null,
    lastPaymentId: update.lastPaymentId || null,
    lastPaymentStatus: update.lastPaymentStatus || null,
    asaasCustomerId: subscriptionData.providerCustomerId || null,
    asaasSubscriptionId: subscriptionData.providerSubscriptionId || null,
    subscriptionId: subscriptionData.id || null,
    updatedAt: now,
  }
}

function getCheckoutPayload(body) {
  return body?.checkout || body?.payment?.checkout || body?.checkoutSession || null
}

function getCheckoutPayloadId(body) {
  const checkout = getCheckoutPayload(body)
  return String(checkout?.id || body?.checkoutId || body?.checkoutSessionId || '').trim()
}

function getCheckoutProviderSubscriptionId(checkout) {
  const subscription = checkout?.subscription
  if (typeof subscription === 'string') return subscription

  return String(
    subscription?.id ||
      subscription?.subscriptionId ||
      checkout?.subscriptionId ||
      checkout?.providerSubscriptionId ||
      ''
  ).trim()
}

function isCheckoutPaidEvent(event) {
  const normalized = String(event || '').toUpperCase()
  return normalized === 'CHECKOUT_PAID'
}

function getCheckoutStatusForEvent(event) {
  const normalized = String(event || '').toUpperCase()
  if (isCheckoutPaidEvent(normalized)) return 'paid'
  if (normalized === 'CHECKOUT_EXPIRED') return 'expired'
  if (normalized === 'CHECKOUT_CANCELED') return 'canceled'
  return 'pending'
}

async function processAsaasCheckoutWebhook({ db, admin, logger, body, eventId, event }) {
  const checkout = getCheckoutPayload(body)
  const checkoutId = getCheckoutPayloadId(body)

  if (!checkoutId) {
    return { ignored: true, reason: 'checkout_without_id' }
  }

  const eventRef = db.collection('providerEvents').doc(safeDocId(eventId || `${event}_${checkoutId}`))
  const checkoutRef = db.collection('billingCheckouts').doc(safeDocId(checkoutId))

  return await db.runTransaction(async (transaction) => {
    const eventDoc = await transaction.get(eventRef)
    const checkoutDoc = await transaction.get(checkoutRef)
    const now = admin.firestore.Timestamp.now()

    if (eventDoc.exists && ['processed', 'ignored'].includes(eventDoc.data().status)) {
      return { duplicate: true, status: eventDoc.data().status }
    }

    const baseEventData = {
      provider: BILLING_PROVIDER,
      eventId: eventId || null,
      eventType: event,
      providerCheckoutId: checkoutId,
      payloadHash: payloadHash(body),
      receivedAt: eventDoc.exists ? eventDoc.data().receivedAt || now : now,
      updatedAt: now,
      ...(shouldStoreWebhookDebugPayload() ? { payloadDebug: body } : {}),
    }

    if (!checkoutDoc.exists) {
      transaction.set(
        eventRef,
        {
          ...baseEventData,
          status: 'ignored',
          ignoreReason: 'checkout_not_found',
          processedAt: now,
        },
        { merge: true }
      )

      setAuditLog(transaction, db, now, {
        action: 'asaas_checkout_webhook_ignored',
        entity: 'provider_event',
        entityId: eventId || checkoutId,
        provider: BILLING_PROVIDER,
        eventType: event,
        asaasCheckoutId: checkoutId,
        reason: 'checkout_not_found',
      })

      return { ignored: true, reason: 'checkout_not_found' }
    }

    const checkoutData = checkoutDoc.data() || {}
    const checkoutStatus = getCheckoutStatusForEvent(event)

    if (!isCheckoutPaidEvent(event)) {
      const pendingMirrorPayload = {
        subscriptionStatus: BILLING_PENDING_PAYMENT_METHOD_STATUS,
        onboardingStatus: 'billing_pending',
        billingProvider: BILLING_PROVIDER,
        billingMethodConfigured: false,
        billingCheckoutStatus: checkoutStatus,
        updatedAt: now,
      }

      transaction.set(
        checkoutRef,
        {
          billingCheckoutStatus: checkoutStatus,
          status: BILLING_PENDING_PAYMENT_METHOD_STATUS,
          lastProviderEventType: event,
          lastProviderEventAt: now,
          updatedAt: now,
        },
        { merge: true }
      )

      if (checkoutData.uid) {
        transaction.set(db.collection('users').doc(checkoutData.uid), pendingMirrorPayload, { merge: true })
      }

      if (checkoutData.storeId) {
        transaction.set(
          db.collection('stores').doc(checkoutData.storeId),
          {
            ...pendingMirrorPayload,
            isBillingBlocked: true,
          },
          { merge: true }
        )
      }

      transaction.set(
        eventRef,
        {
          ...baseEventData,
          status: 'processed',
          processedAt: now,
          resultingCheckoutStatus: checkoutStatus,
        },
        { merge: true }
      )
      return { processed: true, checkoutId, checkoutStatus }
    }

    const providerSubscriptionId = getCheckoutProviderSubscriptionId(checkout)
    const localSubscriptionId = providerSubscriptionId
      ? buildLocalSubscriptionId(providerSubscriptionId)
      : `asaas_checkout_${safeDocId(checkoutId)}`
    const subscriptionRef = db.collection('subscriptions').doc(localSubscriptionId)
    const subscriptionDoc = await transaction.get(subscriptionRef)
    const amountCents = Number(checkoutData.amountCents || 0)
    const trialStartedAt = checkoutData.trialStartedAt || now
    const trialEndsAt =
      checkoutData.scheduledTrialEndsAt ||
      admin.firestore.Timestamp.fromDate(addDays(new Date(), TRIAL_DAYS))

    const subscriptionData = {
      id: localSubscriptionId,
      uid: checkoutData.uid || null,
      storeId: checkoutData.storeId || null,
      provider: BILLING_PROVIDER,
      providerCustomerId: checkoutData.providerCustomerId || null,
      providerSubscriptionId: providerSubscriptionId || null,
      providerCheckoutId: checkoutId,
      status: 'trialing',
      providerStatus: checkout?.status || checkoutStatus,
      plan: checkoutData.plan || 'essential',
      billingCycle: checkoutData.billingCycle || 'monthly',
      amountCents,
      billingType: 'CREDIT_CARD',
      billingMethodConfigured: true,
      trialStartedAt,
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      createdAt: subscriptionDoc.exists ? subscriptionDoc.data().createdAt || now : now,
      updatedAt: now,
    }

    transaction.set(subscriptionRef, subscriptionData, { merge: true })
    transaction.set(
      checkoutRef,
      {
        billingCheckoutStatus: 'paid',
        status: 'trialing',
        providerSubscriptionId: providerSubscriptionId || null,
        localSubscriptionId,
        trialStartedAt,
        trialEndsAt,
        lastProviderEventType: event,
        lastProviderEventAt: now,
        updatedAt: now,
      },
      { merge: true }
    )

    const mirrorPayload = {
      subscriptionStatus: 'trialing',
      onboardingStatus: 'completed',
      billingProvider: BILLING_PROVIDER,
      billingMethodConfigured: true,
      billingCheckoutStatus: 'paid',
      plan: subscriptionData.plan,
      billingCycle: subscriptionData.billingCycle,
      trialStartedAt,
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      asaasCustomerId: subscriptionData.providerCustomerId,
      asaasSubscriptionId: providerSubscriptionId || null,
      asaasCheckoutId: checkoutId,
      subscriptionId: localSubscriptionId,
      updatedAt: now,
    }

    if (subscriptionData.uid) {
      transaction.set(db.collection('users').doc(subscriptionData.uid), mirrorPayload, { merge: true })
    }

    if (subscriptionData.storeId) {
      transaction.set(
        db.collection('stores').doc(subscriptionData.storeId),
        {
          ...mirrorPayload,
          isBillingBlocked: false,
          isActive: true,
        },
        { merge: true }
      )
    }

    transaction.set(
      eventRef,
      {
        ...baseEventData,
        status: 'processed',
        processedAt: now,
        resultingSubscriptionStatus: 'trialing',
        subscriptionId: localSubscriptionId,
      },
      { merge: true }
    )

    setAuditLog(transaction, db, now, {
      action: 'asaas_checkout_paid',
      entity: 'billing_checkout',
      entityId: checkoutId,
      uid: subscriptionData.uid,
      storeId: subscriptionData.storeId,
      provider: BILLING_PROVIDER,
      eventType: event,
      asaasCheckoutId: checkoutId,
      asaasSubscriptionId: providerSubscriptionId || null,
      subscriptionId: localSubscriptionId,
    })

    logger.info('Asaas checkout activated trial', {
      checkoutId,
      storeId: subscriptionData.storeId,
      uid: subscriptionData.uid,
      providerSubscriptionId: providerSubscriptionId || null,
    })

    return {
      processed: true,
      checkoutId,
      subscriptionId: localSubscriptionId,
      nextStatus: 'trialing',
    }
  })
}

function createAsaasFunctions({ db, admin, logger }) {
  const startAsaasSubscription = onCall(
    {
      region: REGION,
      timeoutSeconds: 60,
      memory: '256MiB',
      secrets: [ASAAS_API_KEY],
    },
    async (request) => {
      const uid = request.auth?.uid
      if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

      const data = request.data || {}
      const requestedStoreId = data.storeId || null
      const requestedPlan = data.plan || data.planId || null
      const requestedBillingCycle = data.billingCycle || null
      const billingData = data.billingData || {}
      const operationId = crypto.randomBytes(16).toString('hex')
      const userRef = db.collection('users').doc(uid)

      const lockState = await acquireStartAsaasSubscriptionLock({
        db,
        admin,
        uid,
        userRef,
        requestedStoreId,
        requestedPlan,
        requestedBillingCycle,
        operationId,
      })

      if (lockState.alreadyStarted) {
        return lockState.existing
      }

      const { plan, billingCycle } = lockState
      const storeId = lockState.storeId
      const nowDate = new Date()
      const trialEndsDate = resolveTrialEndsDateForAsaas(lockState.userData, lockState.storeData, nowDate)
      const nextDueDate = formatDateInSaoPaulo(trialEndsDate)

      let asaasCustomerId = getAsaasCustomerId(lockState.userData) || getAsaasCustomerId(lockState.storeData) || null
      let createdCustomer = null
      let asaasCheckout = null

      try {
        if (!asaasCustomerId) {
          createdCustomer = await createAsaasCustomer(uid, lockState.userData, billingData)
          if (!createdCustomer?.id) {
            throw new Error('Asaas nao retornou id do customer.')
          }
          asaasCustomerId = createdCustomer.id

          await userRef.set(
            {
              billingProvider: BILLING_PROVIDER,
              asaasCustomerId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )

          if (lockState.hasExistingStore) {
            await lockState.storeRef.set(
              {
                billingProvider: BILLING_PROVIDER,
                asaasCustomerId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            )
          }

          await createAuditLog(db, admin, {
            action: 'asaas_customer_created',
            entity: 'billing_customer',
            entityId: asaasCustomerId,
            actorUid: uid,
            uid,
            storeId,
            provider: BILLING_PROVIDER,
          })
        }

        asaasCheckout = await createAsaasCheckout({
          uid,
          storeId,
          userData: lockState.userData,
          billingData,
          plan,
          billingCycle,
          operationId,
          nextDueDate,
        })
        if (!asaasCheckout?.id) {
          throw new Error('Asaas nao retornou id do checkout.')
        }
      } catch (error) {
        await releaseStartAsaasSubscriptionLock({
          db,
          lockRef: lockState.lockRef,
          operationId,
          logger,
        })

        logger.error('Asaas checkout provisioning failed', {
          uid,
          storeId,
          operationId,
          error: error.message || String(error),
        })


        throw toExternalProvisioningError(error)
      }

      const asaasCheckoutId = asaasCheckout.id
      let checkoutUrl = null
      try {
        checkoutUrl = buildAsaasCheckoutUrl(asaasCheckout)
      } catch (error) {
        await releaseStartAsaasSubscriptionLock({
          db,
          lockRef: lockState.lockRef,
          operationId,
          logger,
        })
        throw error
      }
      if (!checkoutUrl) {
        await releaseStartAsaasSubscriptionLock({
          db,
          lockRef: lockState.lockRef,
          operationId,
          logger,
        })
        throw new HttpsError('failed-precondition', 'Asaas nao retornou URL valida do checkout.')
      }

      const localCheckoutId = `asaas_checkout_${safeDocId(asaasCheckoutId)}`
      const checkoutRef = db.collection('billingCheckouts').doc(safeDocId(asaasCheckoutId))

      let result = null

      try {
        result = await db.runTransaction(async (transaction) => {
          const freshUserDoc = await transaction.get(userRef)
          const lockDoc = await transaction.get(lockState.lockRef)

          if (!freshUserDoc.exists) {
            throw new HttpsError('failed-precondition', 'Usuario nao encontrado.')
          }

          if (!lockDoc.exists || lockDoc.data().operationId !== operationId) {
            throw new HttpsError('failed-precondition', 'Lock de billing expirou antes de salvar a assinatura.')
          }

          const freshUserData = { uid, ...freshUserDoc.data() }
          let storeRef = lockState.storeRef
          let storeData = null

          if (lockState.hasExistingStore) {
            const storeDoc = await transaction.get(storeRef)
            if (!storeDoc.exists) {
              throw new HttpsError('failed-precondition', 'Loja vinculada nao encontrada.')
            }
            storeData = storeDoc.data()
            assertStoreOwnership(storeData, uid)
          }

          const existingReference = await findExistingBillingReference({
            db,
            transaction,
            userData: freshUserData,
            storeData,
          })
          const existingCheckoutDoc = await transaction.get(checkoutRef)
          if (existingReference.exists || existingCheckoutDoc.exists) {
            throw new HttpsError('already-exists', 'Esta loja ja possui uma assinatura Asaas vinculada.')
          }

          validateUserCanStart(freshUserData, storeData)

          let storeSlug = storeData?.storeSlug || storeData?.slug || null
          const now = admin.firestore.Timestamp.now()
          const scheduledTrialEndsAt = admin.firestore.Timestamp.fromDate(trialEndsDate)

          if (!lockState.hasExistingStore) {
            storeSlug = await claimStoreSlug(
              transaction,
              db,
              uid,
              storeId,
              freshUserData.signup?.storeName || 'Minha Loja',
              now
            )
            storeData = buildPendingBillingStorePayload({
              uid,
              userData: freshUserData,
              storeId,
              storeSlug,
              plan,
              billingCycle,
              asaasCustomerId,
              asaasCheckoutId,
              checkoutUrl,
              now,
            })
            transaction.set(storeRef, storeData)
          }

          const amountCents = getPlanAmountCents(plan, billingCycle)
          const checkoutExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + ASAAS_CHECKOUT_EXPIRATION_MINUTES * 60 * 1000)
          const checkoutData = {
            id: asaasCheckoutId,
            uid,
            storeId,
            provider: BILLING_PROVIDER,
            providerCustomerId: asaasCustomerId,
            providerCheckoutId: asaasCheckoutId,
            checkoutUrl,
            status: BILLING_PENDING_PAYMENT_METHOD_STATUS,
            providerStatus: asaasCheckout.status || null,
            plan,
            billingCycle,
            amountCents,
            billingType: 'CREDIT_CARD',
            chargeType: 'RECURRENT',
            billingCheckoutStatus: 'pending',
            scheduledTrialEndsAt,
            expiresAt: checkoutExpiresAt,
            createdAt: now,
            updatedAt: now,
          }

          transaction.set(checkoutRef, checkoutData)

          const mirroredPayload = {
            subscriptionStatus: BILLING_PENDING_PAYMENT_METHOD_STATUS,
            onboardingStatus: 'billing_pending',
            billingProvider: BILLING_PROVIDER,
            billingMethodConfigured: false,
            billingCheckoutStatus: 'pending',
            plan,
            billingCycle,
            asaasCustomerId,
            asaasCheckoutId,
            asaasCheckoutUrl: checkoutUrl,
            asaasCheckoutExpiresAt: checkoutExpiresAt,
            updatedAt: now,
          }

          const existingStoreIds = Array.isArray(freshUserData.storeIds) ? freshUserData.storeIds : []
          const existingStoreKeys = Array.isArray(freshUserData.storeKeys) ? freshUserData.storeKeys : []

          transaction.update(userRef, {
            ...mirroredPayload,
            storeId,
            storeIds: Array.from(new Set([...existingStoreIds, storeId].filter(Boolean))),
            storeKeys: Array.from(new Set([...existingStoreKeys, storeId, storeSlug].filter(Boolean))),
          })

          transaction.set(
            storeRef,
            {
              ...mirroredPayload,
              isBillingBlocked: true,
              updatedAt: now,
            },
            { merge: true }
          )

          setAuditLog(transaction, db, now, {
            action: 'asaas_checkout_created',
            entity: 'billing_checkout',
            entityId: asaasCheckoutId,
            actorUid: uid,
            uid,
            storeId,
            provider: BILLING_PROVIDER,
            asaasCustomerId,
            asaasCheckoutId,
            plan,
            billingCycle,
            scheduledTrialEndsAt,
          })

          transaction.delete(lockState.lockRef)

          return {
            storeId,
            storeSlug,
            checkoutId: asaasCheckoutId,
            checkoutUrl,
            scheduledTrialEndsAtMillis: scheduledTrialEndsAt.toMillis(),
          }
        })
      } catch (error) {
        await markStartAsaasSubscriptionRecovery({
          db,
          admin,
          logger,
          lockRef: lockState.lockRef,
          operationId,
          uid,
          storeId,
          localSubscriptionId: localCheckoutId,
          asaasCustomerId,
          asaasSubscription: asaasCheckout,
          plan,
          billingCycle,
          trialEndsDate,
          error,
        })

        throw toFinalPersistenceError(error, localCheckoutId)
      }

      logger.info('Asaas checkout created', {
        uid,
        storeId: result.storeId,
        checkoutId: result.checkoutId,
        createdCustomer: Boolean(createdCustomer),
      })

      return {
        ok: true,
        status: BILLING_PENDING_PAYMENT_METHOD_STATUS,
        requiresPaymentMethod: true,
        storeId: result.storeId,
        storeSlug: result.storeSlug,
        checkoutId: result.checkoutId,
        asaasCustomerId,
        asaasCheckoutId: result.checkoutId,
        checkoutUrl: result.checkoutUrl,
        paymentUrl: result.checkoutUrl,
        scheduledTrialEndsAt: result.scheduledTrialEndsAtMillis,
      }
    }
  )

  const getSubscriptionManagementData = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const context = await resolveManagementContext({
        db,
        uid,
        requestedStoreId: request.data?.storeId,
      })

      return {
        ok: true,
        ...buildSubscriptionManagementResponse(context),
      }
    }
  )

  const changeSubscriptionPlan = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const data = request.data || {}
      const requestedStoreId = normalizeStoreId(data.storeId)
      if (!requestedStoreId) throw new HttpsError('invalid-argument', 'storeId obrigatorio.')

      const targetPlan = normalizePlan(data.targetPlan || data.plan || data.planId)
      const requestedBillingCycle = data.billingCycle ? normalizeBillingCycle(data.billingCycle) : null

      await enforceSubscriptionManagementRateLimit({
        db,
        admin,
        uid,
        storeId: requestedStoreId,
        action: 'changeSubscriptionPlan',
      })

      return await db.runTransaction(async (transaction) => {
        const context = await resolveManagementContextInTransaction({
          db,
          transaction,
          uid,
          requestedStoreId,
        })
        const currentPlan = getContextPlan(context)
        const currentBillingCycle = getContextBillingCycle(context)
        const billingCycle = requestedBillingCycle || currentBillingCycle
        const effectiveMode = normalizeEffectiveMode(data.effectiveMode, currentPlan, targetPlan)
        const currentStatus = getContextSubscriptionStatus(context)
        const amountCents = getPlanAmountCents(targetPlan, billingCycle)
        const currentAmountCents = getPlanAmountCents(currentPlan, currentBillingCycle)
        const now = admin.firestore.Timestamp.now()

        if (targetPlan === currentPlan && billingCycle === currentBillingCycle) {
          throw new HttpsError('failed-precondition', 'Este ja e o plano atual.')
        }

        if (SUBSCRIPTION_MANAGEMENT_TERMINAL_STATUSES.has(currentStatus)) {
          throw new HttpsError('failed-precondition', 'Assinatura em estado invalido para alterar plano.')
        }

        if (!context.existingReference?.providerSubscriptionId) {
          setAuditLog(transaction, db, now, {
            action: 'change_plan_requested',
            entity: 'subscription',
            entityId: context.existingReference?.localSubscriptionId || null,
            actorUid: uid,
            uid,
            storeId: context.storeId,
            provider: BILLING_PROVIDER,
            status: 'requires_checkout',
            payload: {
              currentPlan,
              targetPlan,
              billingCycle,
              amountCents,
            },
          })

          return {
            ok: true,
            status: 'requires_checkout',
            checkoutRequired: true,
            message: 'Configure a cobranca da loja antes de solicitar alteracao de plano.',
            action: 'startAsaasSubscription',
          }
        }

        const requestResult = await createManagementRequestInTransaction({
          db,
          transaction,
          now,
          collectionName: SUBSCRIPTION_CHANGE_REQUESTS_COLLECTION,
          action: 'change_plan',
          type: 'plan_change',
          uid,
          storeId: context.storeId,
          payload: {
            currentPlan,
            targetPlan,
            currentBillingCycle,
            billingCycle,
            effectiveMode,
            currentAmountCents,
            amountCents,
            direction:
              PLAN_ORDER[targetPlan] > PLAN_ORDER[currentPlan]
                ? 'upgrade'
                : PLAN_ORDER[targetPlan] < PLAN_ORDER[currentPlan]
                ? 'downgrade'
                : 'cycle_change',
            providerSubscriptionId: context.existingReference.providerSubscriptionId,
          },
          auditAction: 'change_plan_requested',
        })

        return {
          ok: true,
          status: 'requested',
          requestId: requestResult.requestId,
          alreadyExists: requestResult.alreadyExists,
          effectiveMode,
          message: 'Solicitacao enviada. O suporte confirmara a alteracao com seguranca.',
        }
      })
    }
  )

  const cancelSubscription = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const data = request.data || {}
      const requestedStoreId = normalizeStoreId(data.storeId)
      if (!requestedStoreId) throw new HttpsError('invalid-argument', 'storeId obrigatorio.')

      const cancelMode = normalizeCancelMode(data.cancelMode)
      const confirmationText = String(data.confirmationText || '').trim().toLowerCase()
      if (confirmationText !== 'cancelar minha assinatura') {
        throw new HttpsError(
          'invalid-argument',
          'Digite a confirmacao exatamente para solicitar o cancelamento.'
        )
      }

      await enforceSubscriptionManagementRateLimit({
        db,
        admin,
        uid,
        storeId: requestedStoreId,
        action: 'cancelSubscription',
      })

      return await db.runTransaction(async (transaction) => {
        const context = await resolveManagementContextInTransaction({
          db,
          transaction,
          uid,
          requestedStoreId,
        })
        const currentStatus = getContextSubscriptionStatus(context)
        const now = admin.firestore.Timestamp.now()
        const providerSubscriptionId = context.existingReference?.providerSubscriptionId || null

        if (!providerSubscriptionId) {
          throw new HttpsError('failed-precondition', 'Assinatura Asaas nao encontrada para esta loja.')
        }

        if (SUBSCRIPTION_MANAGEMENT_TERMINAL_STATUSES.has(currentStatus)) {
          throw new HttpsError('failed-precondition', 'Assinatura ja esta bloqueada ou cancelada.')
        }

        const requestResult = await createManagementRequestInTransaction({
          db,
          transaction,
          now,
          collectionName: SUBSCRIPTION_CANCELLATION_REQUESTS_COLLECTION,
          action: 'cancel_subscription',
          type: 'cancellation',
          uid,
          storeId: context.storeId,
          payload: {
            cancelMode,
            reason: sanitizeTextField(data.reason, 800),
            currentStatus,
            currentPeriodEnd: serializeDate(
              getPreferredDate(
                context.existingReference?.canonicalSubscription?.currentPeriodEnd,
                context.storeData?.currentPeriodEnd,
                context.userData?.currentPeriodEnd
              )
            ),
            providerSubscriptionId,
          },
          auditAction: 'cancellation_requested',
        })

        const cancellationStatus = cancelMode === 'end_of_cycle' ? 'cancel_scheduled' : 'immediate_requested'
        const mirrorPayload = {
          subscriptionCancellationStatus: cancellationStatus,
          cancelScheduledAtPeriodEnd: cancelMode === 'end_of_cycle',
          subscriptionCancelRequestedAt: now,
          subscriptionCancelRequestedBy: uid,
          updatedAt: now,
        }

        transaction.set(context.storeRef, mirrorPayload, { merge: true })
        transaction.set(context.userRef, mirrorPayload, { merge: true })

        if (context.existingReference?.localSubscriptionId) {
          transaction.set(
            db.collection('subscriptions').doc(context.existingReference.localSubscriptionId),
            {
              cancellationStatus,
              cancelMode,
              cancelRequestedAt: now,
              cancelRequestedBy: uid,
              updatedAt: now,
            },
            { merge: true }
          )
        }

        return {
          ok: true,
          status: 'requested',
          cancellationStatus,
          requestId: requestResult.requestId,
          alreadyExists: requestResult.alreadyExists,
          message: 'Solicitacao de cancelamento enviada. O suporte confirmara o processamento.',
        }
      })
    }
  )

  const requestSubscriptionDueDateChange = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const data = request.data || {}
      const requestedStoreId = normalizeStoreId(data.storeId)
      if (!requestedStoreId) throw new HttpsError('invalid-argument', 'storeId obrigatorio.')

      const desiredDueDay = Number(data.desiredDueDay || data.dueDateDay)
      if (!Number.isInteger(desiredDueDay) || desiredDueDay < 1 || desiredDueDay > 28) {
        throw new HttpsError('invalid-argument', 'Dia de vencimento deve ser um numero de 1 a 28.')
      }

      await enforceSubscriptionManagementRateLimit({
        db,
        admin,
        uid,
        storeId: requestedStoreId,
        action: 'requestSubscriptionDueDateChange',
      })

      return await db.runTransaction(async (transaction) => {
        const context = await resolveManagementContextInTransaction({
          db,
          transaction,
          uid,
          requestedStoreId,
        })
        const now = admin.firestore.Timestamp.now()
        const providerSubscriptionId = context.existingReference?.providerSubscriptionId || null

        if (!providerSubscriptionId) {
          throw new HttpsError('failed-precondition', 'Assinatura Asaas nao encontrada para esta loja.')
        }

        const requestResult = await createManagementRequestInTransaction({
          db,
          transaction,
          now,
          collectionName: SUBSCRIPTION_DUE_DATE_REQUESTS_COLLECTION,
          action: 'due_date_change',
          type: 'due_date_change',
          uid,
          storeId: context.storeId,
          payload: {
            desiredDueDay,
            reason: sanitizeTextField(data.reason, 800),
            providerSubscriptionId,
          },
          auditAction: 'due_date_change_requested',
        })

        return {
          ok: true,
          status: 'requested',
          requestId: requestResult.requestId,
          alreadyExists: requestResult.alreadyExists,
          message: 'Solicitacao enviada. O suporte confirmara a alteracao.',
        }
      })
    }
  )

  const syncAsaasSubscriptionStatus = onCall(
    {
      region: REGION,
      timeoutSeconds: 60,
      memory: '256MiB',
      secrets: [ASAAS_API_KEY],
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const requestedStoreId = normalizeStoreId(request.data?.storeId)
      if (!requestedStoreId) throw new HttpsError('invalid-argument', 'storeId obrigatorio.')

      const initialContext = await resolveManagementContext({
        db,
        uid,
        requestedStoreId,
      })
      const providerSubscriptionId = initialContext.existingReference?.providerSubscriptionId
      if (!providerSubscriptionId) {
        throw new HttpsError('failed-precondition', 'Assinatura Asaas nao encontrada para sincronizar.')
      }

      await enforceSubscriptionManagementRateLimit({
        db,
        admin,
        uid,
        storeId: requestedStoreId,
        action: 'syncAsaasSubscriptionStatus',
        limitMs: 15 * 1000,
      })

      let providerSubscription = null
      try {
        providerSubscription = await asaasRequest(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}`)
      } catch (error) {
        logger.error('Failed to sync Asaas subscription status', {
          uid,
          storeId: requestedStoreId,
          providerSubscriptionId,
          error: error.message || String(error),
        })
        throw new HttpsError(
          'internal',
          'Nao foi possivel consultar a assinatura no Asaas. Tente novamente em instantes.'
        )
      }

      return await db.runTransaction(async (transaction) => {
        const context = await resolveManagementContextInTransaction({
          db,
          transaction,
          uid,
          requestedStoreId,
        })
        const currentProviderSubscriptionId = context.existingReference?.providerSubscriptionId
        if (currentProviderSubscriptionId !== providerSubscriptionId) {
          throw new HttpsError('failed-precondition', 'Assinatura da loja mudou durante a sincronizacao.')
        }

        const now = admin.firestore.Timestamp.now()
        const subscriptionUpdate = buildAsaasSyncUpdate({
          providerSubscription,
          context,
          now,
          admin,
        })
        const localSubscriptionId =
          context.existingReference?.localSubscriptionId || buildLocalSubscriptionId(providerSubscriptionId)
        const currentPeriodEnd = subscriptionUpdate.currentPeriodEnd || getPreferredDate(
          context.existingReference?.canonicalSubscription?.currentPeriodEnd,
          context.storeData?.currentPeriodEnd,
          context.userData?.currentPeriodEnd
        )

        transaction.set(
          db.collection('subscriptions').doc(localSubscriptionId),
          {
            id: localSubscriptionId,
            uid: context.userData?.uid || uid,
            storeId: context.storeId,
            provider: BILLING_PROVIDER,
            providerCustomerId: context.existingReference?.asaasCustomerId || null,
            providerSubscriptionId,
            billingCycle: getContextBillingCycle(context),
            plan: getContextPlan(context),
            ...subscriptionUpdate,
          },
          { merge: true }
        )

        const mirrorPayload = {
          subscriptionStatus: subscriptionUpdate.status,
          billingProvider: BILLING_PROVIDER,
          billingMethodConfigured: true,
          asaasSubscriptionStatus: subscriptionUpdate.providerStatus,
          asaasSubscriptionId: providerSubscriptionId,
          subscriptionId: localSubscriptionId,
          currentPeriodEnd: currentPeriodEnd || null,
          lastAsaasSyncAt: now,
          updatedAt: now,
        }

        transaction.set(context.userRef, mirrorPayload, { merge: true })
        transaction.set(
          context.storeRef,
          {
            ...mirrorPayload,
            isBillingBlocked: ['blocked', 'canceled'].includes(subscriptionUpdate.status),
          },
          { merge: true }
        )

        setAuditLog(transaction, db, now, {
          action: 'billing_status_synced',
          entity: 'subscription',
          entityId: localSubscriptionId,
          actorUid: uid,
          uid,
          storeId: context.storeId,
          provider: BILLING_PROVIDER,
          asaasSubscriptionId: providerSubscriptionId,
          before: { subscriptionStatus: getContextSubscriptionStatus(context) },
          after: {
            subscriptionStatus: subscriptionUpdate.status,
            providerStatus: subscriptionUpdate.providerStatus,
          },
        })

        return {
          ok: true,
          status: subscriptionUpdate.status,
          providerStatus: subscriptionUpdate.providerStatus,
          currentPeriodEnd: serializeDate(currentPeriodEnd),
          message: 'Status sincronizado com o Asaas.',
        }
      })
    }
  )

  const createPaymentMethodUpdateCheckout = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (request) => {
      const uid = assertCallableMerchantAuth(request)
      const data = request.data || {}
      const requestedStoreId = normalizeStoreId(data.storeId)
      if (!requestedStoreId) throw new HttpsError('invalid-argument', 'storeId obrigatorio.')

      if (data.plan || data.planId) normalizePlan(data.plan || data.planId)
      if (data.billingCycle) normalizeBillingCycle(data.billingCycle)

      await enforceSubscriptionManagementRateLimit({
        db,
        admin,
        uid,
        storeId: requestedStoreId,
        action: 'createPaymentMethodUpdateCheckout',
      })

      return await db.runTransaction(async (transaction) => {
        const context = await resolveManagementContextInTransaction({
          db,
          transaction,
          uid,
          requestedStoreId,
        })
        const now = admin.firestore.Timestamp.now()
        const reusableCheckout = await findReusableCheckoutReference({
          db,
          transaction,
          userData: context.userData,
          storeData: context.storeData,
          now,
        })

        if (reusableCheckout.exists && reusableCheckout.checkoutUrl) {
          setAuditLog(transaction, db, now, {
            action: 'payment_method_checkout_created',
            entity: 'billing_checkout',
            entityId: reusableCheckout.checkoutId,
            actorUid: uid,
            uid,
            storeId: context.storeId,
            provider: BILLING_PROVIDER,
            reusedCheckout: true,
          })

          return {
            ok: true,
            status: 'checkout_reused',
            checkoutUrl: reusableCheckout.checkoutUrl,
            paymentUrl: reusableCheckout.checkoutUrl,
            checkoutId: reusableCheckout.checkoutId,
            message: 'Checkout seguro Asaas reutilizado.',
          }
        }

        if (!context.existingReference?.providerSubscriptionId) {
          return {
            ok: true,
            status: 'requires_billing_data',
            checkoutRequired: true,
            message: 'Para configurar a cobranca, use o checkout atual da pagina de faturamento.',
            action: 'startAsaasSubscription',
          }
        }

        const requestResult = await createManagementRequestInTransaction({
          db,
          transaction,
          now,
          collectionName: SUBSCRIPTION_CHANGE_REQUESTS_COLLECTION,
          action: 'payment_method_update',
          type: 'payment_method_update',
          uid,
          storeId: context.storeId,
          payload: {
            providerSubscriptionId: context.existingReference.providerSubscriptionId,
            currentStatus: getContextSubscriptionStatus(context),
            reason: 'payment_method_update_checkout_not_supported_yet',
          },
          auditAction: 'payment_method_update_requested',
        })

        return {
          ok: true,
          status: 'manual_request_required',
          requestId: requestResult.requestId,
          alreadyExists: requestResult.alreadyExists,
          message: 'Solicitacao enviada. O suporte enviara o caminho seguro para atualizar o pagamento.',
        }
      })
    }
  )

  const asaasWebhook = onRequest(
    {
      region: REGION,
      timeoutSeconds: 60,
      memory: '256MiB',
      secrets: [ASAAS_WEBHOOK_AUTH_TOKEN],
    },
    async (request, response) => {
      if (request.method !== 'POST') {
        response.status(405).json({ ok: false, error: 'method_not_allowed' })
        return
      }

      const expectedToken = getSecretValue(ASAAS_WEBHOOK_AUTH_TOKEN, 'ASAAS_WEBHOOK_AUTH_TOKEN')
      const receivedToken = request.get('asaas-access-token') || ''

      if (!timingSafeStringEqual(receivedToken, expectedToken)) {
        logger.warn('Asaas webhook rejected: invalid token')
        response.status(401).json({ ok: false, error: 'invalid_token' })
        return
      }

      const body = parseWebhookBody(request)
      const eventId = body.id
      const event = body.event
      const payment = body.payment

      if (String(event || '').toUpperCase().startsWith('CHECKOUT_')) {
        try {
          const checkoutResult = await processAsaasCheckoutWebhook({
            db,
            admin,
            logger,
            body,
            eventId,
            event,
          })
          response.status(200).json({ ok: true, ...checkoutResult })
        } catch (error) {
          logger.error('Asaas checkout webhook failed', {
            eventId,
            event,
            checkoutId: getCheckoutPayloadId(body),
            error: error.message || String(error),
          })
          response.status(500).json({ ok: false, error: 'checkout_webhook_processing_failed' })
        }
        return
      }

      if (!event || !payment?.id || !eventId) {
        response.status(400).json({ ok: false, error: 'invalid_payload' })
        return
      }

      const providerSubscriptionId = payment.subscription
      if (!providerSubscriptionId) {
        const now = admin.firestore.Timestamp.now()
        const eventSummary = buildProviderEventSummary({
          body,
          eventId,
          event,
          payment,
          providerSubscriptionId: null,
          now,
        })
        await db.collection('providerEvents').doc(safeDocId(eventId)).set(
          {
            ...eventSummary,
            status: 'ignored',
            ignoreReason: 'payment_without_subscription',
            processedAt: now,
          },
          { merge: true }
        )
        response.status(200).json({ ok: true, ignored: true })
        return
      }

      const eventRef = db.collection('providerEvents').doc(safeDocId(eventId))
      const localSubscriptionId = buildLocalSubscriptionId(providerSubscriptionId)
      const subscriptionRef = db.collection('subscriptions').doc(localSubscriptionId)

      try {
        const processResult = await db.runTransaction(async (transaction) => {
          const eventDoc = await transaction.get(eventRef)
          const subscriptionDoc = await transaction.get(subscriptionRef)
          const now = admin.firestore.Timestamp.now()

          if (eventDoc.exists && ['processed', 'ignored'].includes(eventDoc.data().status)) {
            return { duplicate: true, status: eventDoc.data().status }
          }

          const baseEventData = buildProviderEventSummary({
            body,
            eventId,
            event,
            payment,
            providerSubscriptionId,
            localSubscriptionId,
            receivedAt: eventDoc.exists ? eventDoc.data().receivedAt || now : now,
            now,
          })

          if (!subscriptionDoc.exists) {
            transaction.set(
              eventRef,
              {
                ...baseEventData,
                status: 'ignored',
                ignoreReason: 'subscription_not_found',
                processedAt: now,
              },
              { merge: true }
            )

            setAuditLog(transaction, db, now, {
              action: 'asaas_webhook_ignored',
              entity: 'provider_event',
              entityId: eventId,
              provider: BILLING_PROVIDER,
              eventType: event,
              paymentId: payment.id,
              asaasSubscriptionId: providerSubscriptionId,
              reason: 'subscription_not_found',
            })

            return { ignored: true, reason: 'subscription_not_found' }
          }

          const subscriptionData = subscriptionDoc.data()
          const previousStatus = subscriptionData.status || 'trialing'

          if (!INTERNAL_STATUSES.has(previousStatus)) {
            throw new Error(`Status interno invalido: ${previousStatus}`)
          }

          const supportedEvents = new Set([
            'PAYMENT_CREATED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED',
            'PAYMENT_OVERDUE',
            'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
            'PAYMENT_DELETED',
            'PAYMENT_REFUNDED',
          ])

          if (!supportedEvents.has(event)) {
            transaction.set(
              eventRef,
              {
                ...baseEventData,
                status: 'ignored',
                ignoreReason: 'unsupported_event',
                processedAt: now,
              },
              { merge: true }
            )
            return { ignored: true, reason: 'unsupported_event' }
          }

          const nextStatus = mapPaymentEventToInternalStatus(event, payment, subscriptionData)
          const subscriptionUpdate = buildWebhookPaymentUpdate({
            event,
            payment,
            subscriptionData,
            nextStatus,
            now,
            admin,
          })

          transaction.update(subscriptionRef, subscriptionUpdate)

          const mirrorPayload = buildMirrorFromSubscription(
            { ...subscriptionData, id: localSubscriptionId },
            subscriptionUpdate,
            now
          )

          if (subscriptionData.uid) {
            transaction.set(db.collection('users').doc(subscriptionData.uid), mirrorPayload, {
              merge: true,
            })
          }

          if (subscriptionData.storeId) {
            transaction.set(
              db.collection('stores').doc(subscriptionData.storeId),
              {
                ...mirrorPayload,
                isBillingBlocked: ['blocked', 'canceled'].includes(nextStatus),
              },
              { merge: true }
            )
          }

          transaction.set(
            eventRef,
            {
              ...baseEventData,
              status: 'processed',
              processedAt: now,
              resultingSubscriptionStatus: nextStatus,
            },
            { merge: true }
          )

          setAuditLog(transaction, db, now, {
            action: 'asaas_webhook_received',
            entity: 'provider_event',
            entityId: eventId,
            uid: subscriptionData.uid || null,
            storeId: subscriptionData.storeId || null,
            provider: BILLING_PROVIDER,
            eventType: event,
            paymentId: payment.id,
            subscriptionId: localSubscriptionId,
            asaasSubscriptionId: providerSubscriptionId,
          })

          if (previousStatus !== nextStatus) {
            setAuditLog(transaction, db, now, {
              action: 'subscription_status_changed',
              entity: 'subscription',
              entityId: localSubscriptionId,
              uid: subscriptionData.uid || null,
              storeId: subscriptionData.storeId || null,
              provider: BILLING_PROVIDER,
              eventType: event,
              paymentId: payment.id,
              before: { subscriptionStatus: previousStatus },
              after: { subscriptionStatus: nextStatus },
            })
          }

          return {
            processed: true,
            subscriptionId: localSubscriptionId,
            previousStatus,
            nextStatus,
          }
        })

        if (processResult.duplicate) {
          try {
            await createAuditLog(db, admin, {
              action: 'asaas_webhook_duplicate',
              entity: 'provider_event',
              entityId: eventId,
              provider: BILLING_PROVIDER,
              eventType: event,
              paymentId: payment.id,
            })
          } catch (auditError) {
            logger.warn('Failed to write duplicate Asaas webhook audit log', {
              eventId,
              error: auditError.message || String(auditError),
            })
          }
        }

        response.status(200).json({ ok: true, ...processResult })
      } catch (error) {
        const now = admin.firestore.Timestamp.now()
        const failedEventData = buildProviderEventSummary({
          body,
          eventId,
          event,
          payment,
          providerSubscriptionId,
          localSubscriptionId,
          now,
        })
        await eventRef.set(
          {
            ...failedEventData,
            status: 'failed',
            error: error.message || String(error),
            processedAt: now,
          },
          { merge: true }
        )

        await createAuditLog(db, admin, {
          action: 'asaas_webhook_failed',
          entity: 'provider_event',
          entityId: eventId,
          provider: BILLING_PROVIDER,
          eventType: event,
          paymentId: payment.id,
          asaasSubscriptionId: providerSubscriptionId,
          error: error.message || String(error),
        })

        logger.error('Asaas webhook failed', {
          eventId,
          event,
          paymentId: payment.id,
          error: error.message || String(error),
        })

        response.status(500).json({ ok: false, error: 'webhook_processing_failed' })
      }
    }
  )

  return {
    startAsaasSubscription,
    getSubscriptionManagementData,
    changeSubscriptionPlan,
    cancelSubscription,
    requestSubscriptionDueDateChange,
    syncAsaasSubscriptionStatus,
    createPaymentMethodUpdateCheckout,
    asaasWebhook,
  }
}

module.exports = {
  createAsaasFunctions,
}
