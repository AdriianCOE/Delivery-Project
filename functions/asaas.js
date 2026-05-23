const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const crypto = require('crypto')

const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY')
const ASAAS_WEBHOOK_AUTH_TOKEN = defineSecret('ASAAS_WEBHOOK_AUTH_TOKEN')

const REGION = 'southamerica-east1'
const TRIAL_DAYS = 14
const START_ASAAS_LOCK_TTL_MS = 5 * 60 * 1000
const BILLING_PROVIDER = 'asaas'
const DEFAULT_ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3'

const CHECKOUT_STATUSES = new Set(['checkout_pending', 'pending_checkout'])
const START_ASAAS_ALLOWED_STATUSES = new Set([
  'checkout_pending',
  'pending_checkout',
  'trialing',
  'active',
  'past_due',
  'blocked',
  'canceled',
])
const INTERNAL_STATUSES = new Set([
  'checkout_pending',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'blocked',
])
const ASAAS_BILLING_TYPES = new Set(['UNDEFINED', 'BOLETO', 'PIX'])

const PLAN_CATALOG = {
  essential: {
    id: 'essential',
    name: 'Essencial',
    monthlyCents: 5900,
    annualCents: 59000,
  },
  professional: {
    id: 'professional',
    name: 'Profissional',
    monthlyCents: 8900,
    annualCents: 89000,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    monthlyCents: 15900,
    annualCents: 159000,
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
  return String(process.env.ASAAS_BASE_URL || DEFAULT_ASAAS_BASE_URL).replace(/\/+$/, '')
}

function safeDocId(value) {
  return String(value || '').replace(/\//g, '_')
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

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '')
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

  const payload = {
    name,
    cpfCnpj,
    email: String(billingData.email || userData.email || '').trim().toLowerCase() || undefined,
    mobilePhone: normalizePhoneDigits(billingData.phone || userData.phoneE164 || userData.phone),
    externalReference: `pratoby:user:${uid}`,
    notificationDisabled: billingData.notificationDisabled === true,
    groupName: 'PratoBy',
  }

  for (const field of ['postalCode', 'address', 'addressNumber', 'complement', 'province']) {
    if (billingData[field]) payload[field] = String(billingData[field]).trim()
  }

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
    message: 'Esta loja ja possui uma assinatura Asaas vinculada.',
    subscriptionId: existingReference.localSubscriptionId || null,
    asaasCustomerId: existingReference.asaasCustomerId || null,
    asaasSubscriptionId: existingReference.providerSubscriptionId || null,
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

    validateUserCanStart(userData, storeState.storeData)

    const now = admin.firestore.Timestamp.now()
    assertLockCanBeAcquired(lockDoc, now)

    const plan = normalizePlan(requestedPlan || userData.plan || 'professional')
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
    `Assinatura criada no Asaas, mas falhou ao salvar estado local (${localSubscriptionId}): ${error.message || String(error)}`,
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
      let asaasSubscription = null

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

        asaasSubscription = await createAsaasSubscription({
          customerId: asaasCustomerId,
          uid,
          storeId,
          plan,
          billingCycle,
          billingType: data.billingType,
          nextDueDate,
        })
        if (!asaasSubscription?.id) {
          throw new Error('Asaas nao retornou id da assinatura.')
        }
      } catch (error) {
        await releaseStartAsaasSubscriptionLock({
          db,
          lockRef: lockState.lockRef,
          operationId,
          logger,
        })

        logger.error('Asaas external provisioning failed', {
          uid,
          storeId,
          operationId,
          error: error.message || String(error),
        })

        throw toExternalProvisioningError(error)
      }

      const asaasSubscriptionId = asaasSubscription.id
      const localSubscriptionId = buildLocalSubscriptionId(asaasSubscriptionId)
      const subscriptionRef = db.collection('subscriptions').doc(localSubscriptionId)

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
          const existingSubscriptionDoc = await transaction.get(subscriptionRef)
          if (existingReference.exists || existingSubscriptionDoc.exists) {
            throw new HttpsError('already-exists', 'Esta loja ja possui uma assinatura Asaas vinculada.')
          }

          validateUserCanStart(freshUserData, storeData)

          let storeSlug = storeData?.storeSlug || storeData?.slug || null
          const now = admin.firestore.Timestamp.now()
          const existingTrialStartedAt = storeData?.trialStartedAt || freshUserData.trialStartedAt || null
          const trialStartedAt = existingTrialStartedAt || now
          const trialEndsAt = admin.firestore.Timestamp.fromDate(trialEndsDate)

          if (!lockState.hasExistingStore) {
            storeSlug = await claimStoreSlug(
              transaction,
              db,
              uid,
              storeId,
              freshUserData.signup?.storeName || 'Minha Loja',
              now
            )
            storeData = buildStorePayload({
              uid,
              userData: freshUserData,
              storeId,
              storeSlug,
              plan,
              billingCycle,
              trialStartedAt,
              trialEndsAt,
              asaasCustomerId,
              asaasSubscriptionId,
              localSubscriptionId,
            })
            transaction.set(storeRef, storeData)
          }

          const amountCents = getPlanAmountCents(plan, billingCycle)
          const subscriptionData = {
            id: localSubscriptionId,
            uid,
            storeId,
            provider: BILLING_PROVIDER,
            providerCustomerId: asaasCustomerId,
            providerSubscriptionId: asaasSubscriptionId,
            status: 'trialing',
            providerStatus: asaasSubscription.status || null,
            plan,
            billingCycle,
            amountCents,
            billingType: asaasSubscription.billingType || data.billingType || 'UNDEFINED',
            trialStartedAt,
            trialEndsAt,
            currentPeriodEnd: trialEndsAt,
            lastPaymentId: null,
            lastPaymentStatus: null,
            createdAt: now,
            updatedAt: now,
          }

          transaction.set(subscriptionRef, subscriptionData)

          const mirroredPayload = buildMirroredBillingPayload({
            plan,
            billingCycle,
            status: 'trialing',
            trialStartedAt,
            trialEndsAt,
            currentPeriodEnd: trialEndsAt,
            asaasCustomerId,
            asaasSubscriptionId,
            localSubscriptionId,
            now,
          })

          const existingStoreIds = Array.isArray(freshUserData.storeIds) ? freshUserData.storeIds : []
          const existingStoreKeys = Array.isArray(freshUserData.storeKeys) ? freshUserData.storeKeys : []

          transaction.update(userRef, {
            ...mirroredPayload,
            storeId,
            storeIds: Array.from(new Set([...existingStoreIds, storeId].filter(Boolean))),
            storeKeys: Array.from(new Set([...existingStoreKeys, storeId, storeSlug].filter(Boolean))),
            onboardingStatus: 'completed',
          })

          transaction.set(
            storeRef,
            {
              ...mirroredPayload,
              isBillingBlocked: false,
              updatedAt: now,
            },
            { merge: true }
          )

          setAuditLog(transaction, db, now, {
            action: 'asaas_subscription_created',
            entity: 'subscription',
            entityId: localSubscriptionId,
            actorUid: uid,
            uid,
            storeId,
            provider: BILLING_PROVIDER,
            asaasCustomerId,
            asaasSubscriptionId,
            plan,
            billingCycle,
            trialEndsAt,
          })

          transaction.delete(lockState.lockRef)

          return {
            storeId,
            storeSlug,
            subscriptionId: localSubscriptionId,
            trialEndsAtMillis: trialEndsAt.toMillis(),
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
          localSubscriptionId,
          asaasCustomerId,
          asaasSubscription,
          plan,
          billingCycle,
          trialEndsDate,
          error,
        })

        throw toFinalPersistenceError(error, localSubscriptionId)
      }

      logger.info('Asaas subscription started', {
        uid,
        storeId: result.storeId,
        subscriptionId: result.subscriptionId,
        asaasSubscriptionId,
        createdCustomer: Boolean(createdCustomer),
      })

      return {
        ok: true,
        status: 'trialing',
        storeId: result.storeId,
        storeSlug: result.storeSlug,
        subscriptionId: result.subscriptionId,
        asaasCustomerId,
        asaasSubscriptionId,
        trialEndsAt: result.trialEndsAtMillis,
      }
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

      if (!expectedToken || receivedToken !== expectedToken) {
        logger.warn('Asaas webhook rejected: invalid token')
        response.status(401).json({ ok: false, error: 'invalid_token' })
        return
      }

      const body = parseWebhookBody(request)
      const eventId = body.id
      const event = body.event
      const payment = body.payment

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
    asaasWebhook,
  }
}

module.exports = {
  createAsaasFunctions,
}
