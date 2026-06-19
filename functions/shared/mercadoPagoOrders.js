const { onCall, onRequest } = require('firebase-functions/v2/https')
const crypto = require('crypto')
const {
  MercadoPagoConfig,
  Preference,
} = require('mercadopago')

const PROVIDER = 'mercadopago'
const ONLINE_MODE = 'online'
const BLOCKED_REASON = 'awaiting_online_payment'
const OAUTH_STATE_COLLECTION = 'mercadoPagoOAuthStates'
const PRIVATE_PROVIDER_COLLECTION = 'storePaymentProviders'
const PRIVATE_PROVIDER_DOC = 'mercadopago'
const ACTIVE_STATUSES = new Set(['active', 'enabled', 'ativo'])
const VALID_ENVIRONMENTS = new Set(['sandbox', 'production'])
const PREORDER_POLICY_MODES = new Set([
  'manual',
  'pix_manual',
  'mercadopago_online',
  'manual_or_mercadopago',
])
const PAID_STATUSES = new Set(['approved', 'accredited', 'paid'])
const PENDING_STATUSES = new Set(['pending', 'in_process', 'authorized'])
const FAILED_STATUSES = new Set([
  'rejected',
  'cancelled',
  'canceled',
  'expired',
  'refunded',
  'charged_back',
])
const SLOT_RELEASE_PAYMENT_STATUSES = new Set([
  'failed',
  'canceled',
  'cancelled',
  'expired',
  'refunded',
  'charged_back',
])
const ACTIVE_ORDER_STATUSES = [
  'pendente', 'pending', 'pending_payment', 'novo', 'new', 'received', 'recebido', 'aguardando',
  'aguardando_confirmacao', 'awaiting_confirmation',
  'confirmado', 'confirmed', 'aceito', 'accepted',
  'preparando', 'preparing', 'em_preparo', 'preparo', 'in_preparation', 'in_progress',
  'pronto', 'pronta', 'ready', 'ready_for_pickup', 'aguardando_retirada',
  'em_rota', 'out_for_delivery', 'entregando', 'saiu_para_entrega', 'saiu_entrega', 'em_entrega',
]

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function getSecretValue(secret, envName) {
  try {
    return secret?.value?.() || process.env[envName] || ''
  } catch {
    return process.env[envName] || ''
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function sanitizeString(value, maxLength = 240) {
  if (!hasValue(value)) return ''
  return String(value)
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

function safeDocId(value) {
  return String(value || '').replace(/[/#?[\]]/g, '_').slice(0, 180) || 'unknown'
}

function uniqueTruthy(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ]
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)).filter((item) => item !== undefined)
  }

  if (value && typeof value === 'object' && typeof value.toDate !== 'function') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const nextValue = stripUndefinedDeep(item)
      if (nextValue !== undefined) acc[key] = nextValue
      return acc
    }, {})
  }

  return value === undefined ? undefined : value
}

function toPositiveInteger(value, fallback = null, min = 1, max = 120) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function toCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  const cleaned = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function centsToMoney(cents) {
  return Number((Math.max(0, toCents(cents)) / 100).toFixed(2))
}

function buildMercadoPagoExternalReference({ storeId, orderId }) {
  return `pratoby:order:${safeDocId(storeId)}:${safeDocId(orderId)}`
}

function parseMercadoPagoExternalReference(value) {
  const parts = String(value || '').split(':')
  if (parts.length === 4 && parts[0] === 'pratoby' && parts[1] === 'order') {
    return {
      storeId: parts[2],
      orderId: parts[3],
    }
  }
  return { storeId: '', orderId: '' }
}

function normalizeMercadoPagoPublicConfig(store = {}) {
  const raw = store.payments?.mercadoPago || store.payments?.mercadopago || {}
  const status = normalizeText(raw.status || (raw.enabled === true ? 'active' : 'not_connected'))
  const environment = VALID_ENVIRONMENTS.has(normalizeText(raw.environment))
    ? normalizeText(raw.environment)
    : 'sandbox'
  const maxInstallmentCount = toPositiveInteger(raw.maxInstallmentCount, 1, 1, 12)
  const minOrderCents = Math.max(0, toCents(raw.minOrderCents || 0))
  const enabled = raw.enabled === true && ACTIVE_STATUSES.has(status)

  return stripUndefinedDeep({
    provider: PROVIDER,
    enabled,
    status: enabled ? 'active' : (status || 'not_connected'),
    environment,
    allowPix: raw.allowPix !== false,
    allowCreditCard: raw.allowCreditCard !== false,
    maxInstallmentCount,
    requireForScheduled: raw.requireForScheduled === true,
    minOrderCents,
    sandboxMode: environment === 'sandbox',
  })
}

function isMercadoPagoSimulatorPayload(request, body = {}) {
  const paymentId = getWebhookPaymentId(request, body)

  return (
    body?.live_mode === false &&
    body?.type === 'payment' &&
    body?.action === 'payment.updated' &&
    String(paymentId) === '123456' &&
    String(body?.id || '') === '123456' &&
    !request.query?.orderId &&
    !request.query?.storeId
  )
}

function normalizePreorderPolicy(store = {}) {
  const raw = store.payments?.preorderPolicy
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : { mode: raw }
  const mode = normalizeText(source.mode || source.requiredMethod || 'manual')
  const mercadoPagoEnabled = normalizeMercadoPagoPublicConfig(store).enabled === true

  if (mode === 'asaas_online') {
    const safeMode = mercadoPagoEnabled ? 'mercadopago_online' : 'manual'
    return stripUndefinedDeep({
      mode: safeMode,
      requiredMethod: safeMode !== 'manual' ? safeMode : undefined,
      legacyMode: 'asaas_online',
    })
  }

  if (mode === 'manual_or_asaas') {
    const safeMode = mercadoPagoEnabled ? 'manual_or_mercadopago' : 'manual'
    return stripUndefinedDeep({
      mode: safeMode,
      requiredMethod: safeMode !== 'manual' ? safeMode : undefined,
      legacyMode: 'manual_or_asaas',
    })
  }

  const safeMode = PREORDER_POLICY_MODES.has(mode) ? mode : 'manual'

  return stripUndefinedDeep({
    mode: safeMode,
    requiredMethod: safeMode !== 'manual' ? safeMode : undefined,
  })
}

function isMercadoPagoOnlineActive(store = {}) {
  const config = normalizeMercadoPagoPublicConfig(store)
  return config.enabled === true && config.status === 'active'
}

function orderRequiresMercadoPagoOnline({ store, schedulingDecision }) {
  if (schedulingDecision?.orderTiming !== 'scheduled') return false
  const policy = normalizePreorderPolicy(store)
  return (
    policy.mode === 'mercadopago_online' ||
    normalizeMercadoPagoPublicConfig(store).requireForScheduled === true
  )
}

function isMercadoPagoOnlinePaymentRequest(input = {}) {
  const method = normalizeText(input.paymentMethod || input.paymentType)
  const mode = normalizeText(input.paymentMode)
  const provider = normalizeText(input.paymentProvider)
  return method === 'mercadopago_online' || (mode === ONLINE_MODE && provider === PROVIDER)
}

function isMercadoPagoOnlineOrderData(orderData = {}) {
  const payment = orderData.payment || {}
  return (
    normalizeText(payment.provider || orderData.paymentProvider) === PROVIDER &&
    normalizeText(payment.mode || orderData.paymentMode) === ONLINE_MODE
  ) || normalizeText(orderData.paymentMethod || orderData.paymentType) === 'mercadopago_online'
}

async function findActiveMercadoPagoOrder({ db, storeId, storeData = {} }) {
  const docKeys = uniqueTruthy([
    storeId,
    storeData.storeDocId,
    storeData.id,
    storeData.docId,
  ])
  const slugKeys = uniqueTruthy([
    storeData.slug,
    storeData.storeSlug,
  ])
  const compatibilityKeys = uniqueTruthy([
    storeData.storeId,
  ]).filter((key) => !docKeys.includes(key) && !slugKeys.includes(key))
  const queryTargets = uniqueTruthy([
    ...docKeys.map((key) => ['storeId', key]),
    ...slugKeys.map((key) => ['storeId', key]),
    ...docKeys.map((key) => ['storeDocId', key]),
    ...slugKeys.map((key) => ['storeDocId', key]),
    ...compatibilityKeys.map((key) => ['storeId', key]),
    ...compatibilityKeys.map((key) => ['storeDocId', key]),
  ].map(([field, key]) => `${field}:${key}`))
    .slice(0, 12)
    .map((target) => {
      const separator = target.indexOf(':')
      return [target.slice(0, separator), target.slice(separator + 1)]
    })

  for (const [field, key] of queryTargets) {
    const snapshot = await db.collection('orders')
      .where(field, '==', key)
      .where('status', 'in', ACTIVE_ORDER_STATUSES)
      .limit(10)
      .get()

    const blockingOrder = snapshot.docs.find((doc) => isMercadoPagoOnlineOrderData(doc.data() || {}))
    if (blockingOrder) {
      const data = blockingOrder.data() || {}
      return {
        id: blockingOrder.id,
        status: data.status || 'pendente',
        paymentStatus: data.paymentStatus || data.payment?.status || 'pending_payment',
      }
    }
  }

  return null
}

function buildMercadoPagoPendingPaymentSnapshot({ totalCents, storeId, storeSlug, orderId }) {
  const externalReference = buildMercadoPagoExternalReference({ storeId, orderId })
  return {
    paymentMethod: 'Pagamento online',
    paymentType: 'mercadopago_online',
    paymentMode: ONLINE_MODE,
    paymentProvider: PROVIDER,
    paymentStatus: 'pending_payment',
    paymentRequiresConfirmation: false,
    operationalBlockedReason: BLOCKED_REASON,
    mercadoPago: {
      preferenceId: null,
      paymentUrl: null,
      externalReference,
    },
    payment: {
      mode: ONLINE_MODE,
      provider: PROVIDER,
      method: 'mercadopago_online',
      label: 'Pagamento online',
      status: 'pending_payment',
      amount: centsToMoney(totalCents),
      amountCents: totalCents,
      grossAmountCents: totalCents,
      netAmountCents: null,
      feeCents: null,
      currency: 'BRL',
      externalReference,
      providerPaymentId: null,
      providerPreferenceId: null,
      preferenceId: null,
      paymentUrl: null,
      initPoint: null,
      sandboxInitPoint: null,
      createdAt: null,
      paidAt: null,
      failedAt: null,
      refundedAt: null,
      storeSlug,
    },
  }
}

function buildMercadoPagoPreferenceFailurePatch({ admin, error }) {
  const now = admin.firestore.FieldValue.serverTimestamp()
  return stripUndefinedDeep({
    paymentStatus: 'failed_link_creation',
    operationalBlockedReason: BLOCKED_REASON,
    updatedAt: now,
    payment: {
      status: 'failed_link_creation',
      linkCreationFailedAt: now,
      linkCreationError: sanitizeString(error?.message || 'Falha ao gerar checkout Mercado Pago.', 300),
      retryable: true,
    },
  })
}

function getProviderRef(db, storeId) {
  return db.collection(PRIVATE_PROVIDER_COLLECTION).doc(storeId).collection('providers').doc(PRIVATE_PROVIDER_DOC)
}

function getPublicAppBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://pratoby.com').replace(/\/+$/, '')
}

function buildTrackingUrl(orderData = {}) {
  if (orderData.trackingUrlPath) return `${getPublicAppBaseUrl()}${orderData.trackingUrlPath}`
  const slug = orderData.storeSlug || orderData.store?.slug || orderData.storeId || ''
  const token = String(orderData.trackingToken || '').trim()
  if (!token) return `${getPublicAppBaseUrl()}/${slug}`
  return `${getPublicAppBaseUrl()}/${slug}/pedido/${token}`
}

function buildWebhookUrl({ storeId, orderId }) {
  const base = String(process.env.MERCADOPAGO_ORDER_WEBHOOK_URL || '').trim()

  if (!base) {
    const error = new Error('MERCADOPAGO_ORDER_WEBHOOK_URL precisa estar configurada para pagamentos Mercado Pago.')
    error.code = 'failed-precondition'
    throw error
  }

  let url
  try {
    url = new URL(base)
  } catch {
    const error = new Error('MERCADOPAGO_ORDER_WEBHOOK_URL invalida para pagamentos Mercado Pago.')
    error.code = 'failed-precondition'
    throw error
  }
  url.searchParams.set('storeId', storeId)
  url.searchParams.set('orderId', orderId)
  url.searchParams.set('source_news', 'webhooks')

  return url.toString()
}

function buildPreferencePayload({ orderData, storeData }) {
  const totalCents = Math.max(0, toCents(orderData.totalCents || orderData.payment?.amountCents))
  if (totalCents <= 0) {
    const error = new Error('Valor do pedido invalido para Mercado Pago.')
    error.code = 'failed-precondition'
    throw error
  }

  const paymentAmountCents = toCents(orderData.payment?.amountCents)
  if (paymentAmountCents > 0 && paymentAmountCents !== totalCents) {
    const error = new Error('Valor do pagamento diverge do total do pedido.')
    error.code = 'failed-precondition'
    throw error
  }

  const config = normalizeMercadoPagoPublicConfig(storeData)
  const storeId = orderData.storeId || orderData.storeDocId
  const orderId = orderData.trackingToken || orderData.id
  const externalReference = buildMercadoPagoExternalReference({ storeId, orderId })
  const trackingUrl = buildTrackingUrl(orderData)
  const excludedPaymentTypes = []

  if (config.allowPix === false) excludedPaymentTypes.push({ id: 'bank_transfer' })
  if (config.allowCreditCard === false) excludedPaymentTypes.push({ id: 'credit_card' })

  return stripUndefinedDeep({
    items: [
      {
        id: safeDocId(orderId),
        title: sanitizeString(`Pedido ${orderData.displayNumber || orderData.orderNumber || orderId}`, 100),
        description: sanitizeString(orderData.storeName || storeData.name || 'PratoBy', 240),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: centsToMoney(totalCents),
      },
    ],
    external_reference: externalReference,
    metadata: {
      provider: PROVIDER,
      storeId,
      orderId,
      trackingToken: orderData.trackingToken || orderId,
    },
    notification_url: buildWebhookUrl({ storeId, orderId }) || undefined,
    back_urls: {
      success: trackingUrl,
      pending: trackingUrl,
      failure: trackingUrl,
    },
    auto_return: 'approved',
    payer: {
      name: sanitizeString(orderData.customerName || orderData.customer?.name, 80) || undefined,
      phone: orderData.customerPhone ? { number: String(orderData.customerPhone) } : undefined,
    },
    payment_methods: {
      excluded_payment_types: excludedPaymentTypes.length ? excludedPaymentTypes : undefined,
      installments: config.allowCreditCard === false ? 1 : config.maxInstallmentCount,
    },
    statement_descriptor: 'PRATOBY',
  })
}

function createMercadoPagoClient(accessToken) {
  return new MercadoPagoConfig({ accessToken })
}

async function fetchOAuthToken({ code, redirectUri, clientId, clientSecret }) {
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error_description || 'Falha ao conectar Mercado Pago.')
    error.code = 'failed-precondition'
    error.payload = payload
    throw error
  }
  return payload
}

async function resolveAccessToken({ db, storeId, storeData, accessTokenTestSecret, accessTokenProdSecret }) {
  const providerSnapshot = await getProviderRef(db, storeId).get()
  const providerData = providerSnapshot.exists ? providerSnapshot.data() || {} : {}
  const publicConfig = normalizeMercadoPagoPublicConfig(storeData)
  const environment = VALID_ENVIRONMENTS.has(normalizeText(providerData.environment))
    ? normalizeText(providerData.environment)
    : publicConfig.environment

  if (providerData.status === 'active' && providerData.accessToken) {
    return { accessToken: providerData.accessToken, environment, source: 'oauth' }
  }

  const allowSandboxFallback =
    environment === 'sandbox' &&
    (
      process.env.FUNCTIONS_EMULATOR === 'true' ||
      process.env.ALLOW_MERCADOPAGO_ORDERS_SANDBOX_FALLBACK === 'true'
    )
  const sandboxToken = getSecretValue(accessTokenTestSecret, 'MERCADOPAGO_ACCESS_TOKEN_TEST')
  if (allowSandboxFallback && sandboxToken) {
    return { accessToken: sandboxToken, environment: 'sandbox', source: 'sandbox_secret' }
  }

  const prodToken = getSecretValue(accessTokenProdSecret, 'MERCADOPAGO_ACCESS_TOKEN_PROD')
  if (environment === 'production' && prodToken && providerData.status === 'active') {
    return { accessToken: prodToken, environment: 'production', source: 'production_secret' }
  }

  const error = new Error('Mercado Pago nao conectado para esta loja.')
  error.code = 'failed-precondition'
  throw error
}

async function resolvePaymentLookupToken({
  db,
  storeId,
  storeData,
  accessTokenTestSecret,
  accessTokenProdSecret,
  preferProduction = true,
  logger,
}) {
  const safeStoreId = String(storeId || '').trim()
  if (safeStoreId && storeData) {
    try {
      return await resolveAccessToken({
        db,
        storeId: safeStoreId,
        storeData,
        accessTokenTestSecret,
        accessTokenProdSecret,
      })
    } catch (error) {
      logger?.warn?.('[mercadoPagoOrders] store token lookup failed, trying global token', {
        storeId: safeStoreId,
        reason: error?.code || error?.message || String(error),
      })
    }
  }

  const prodToken = getSecretValue(accessTokenProdSecret, 'MERCADOPAGO_ACCESS_TOKEN_PROD')
  if (preferProduction && prodToken) {
    return { accessToken: prodToken, environment: 'production', source: 'production_secret' }
  }

  const testToken = getSecretValue(accessTokenTestSecret, 'MERCADOPAGO_ACCESS_TOKEN_TEST')
  if (testToken) {
    return { accessToken: testToken, environment: 'sandbox', source: 'sandbox_secret' }
  }

  if (prodToken) {
    return { accessToken: prodToken, environment: 'production', source: 'production_secret' }
  }

  const error = new Error('Token Mercado Pago indisponivel para reconciliacao.')
  error.code = 'failed-precondition'
  throw error
}

async function assertMercadoPagoOrderCheckoutConfigured({
  db,
  storeId,
  storeData,
  accessTokenTestSecret,
  accessTokenProdSecret,
}) {
  const safeStoreId = String(storeId || storeData?.id || storeData?.docId || '').trim()
  if (!safeStoreId) {
    const error = new Error('Loja invalida para Mercado Pago.')
    error.code = 'failed-precondition'
    throw error
  }

  buildWebhookUrl({ storeId: safeStoreId, orderId: 'preflight' })
  await resolveAccessToken({
    db,
    storeId: safeStoreId,
    storeData,
    accessTokenTestSecret,
    accessTokenProdSecret,
  })

  return true
}

async function createMercadoPagoPreference({
  db,
  admin,
  logger,
  orderRef,
  orderData,
  storeData,
  accessTokenTestSecret,
  accessTokenProdSecret,
}) {
  if (!orderRef || !orderData) {
    const error = new Error('Pedido invalido para Mercado Pago.')
    error.code = 'invalid-argument'
    throw error
  }

  if (orderData.payment?.provider !== PROVIDER || orderData.payment?.mode !== ONLINE_MODE) {
    const error = new Error('Pedido nao usa pagamento online Mercado Pago.')
    error.code = 'failed-precondition'
    throw error
  }

  if (orderData.payment?.preferenceId && orderData.payment?.paymentUrl) {
    return {
      provider: PROVIDER,
      preferenceId: orderData.payment.preferenceId,
      paymentUrl: orderData.payment.paymentUrl,
      initPoint: orderData.payment.initPoint || orderData.payment.paymentUrl,
      sandboxInitPoint: orderData.payment.sandboxInitPoint || null,
      reused: true,
    }
  }

  const storeId = String(orderData.storeDocId || orderData.storeId || '').trim()
  const token = await resolveAccessToken({
    db,
    storeId,
    storeData,
    accessTokenTestSecret,
    accessTokenProdSecret,
  })

  const preferenceClient = new Preference(createMercadoPagoClient(token.accessToken))
  const response = await preferenceClient.create({
    body: buildPreferencePayload({ orderData, storeData }),
  })

  const paymentUrl = response.init_point || response.sandbox_init_point || ''
  if (!response.id || !paymentUrl) {
    const error = new Error('Mercado Pago nao retornou URL de pagamento.')
    error.code = 'failed-precondition'
    throw error
  }

  const now = admin.firestore.FieldValue.serverTimestamp()
  const externalReference = response.external_reference || buildMercadoPagoExternalReference({
    storeId,
    orderId: orderData.trackingToken || orderData.id,
  })
  const patch = stripUndefinedDeep({
    mercadoPago: {
      ...(orderData.mercadoPago || {}),
      preferenceId: response.id,
      paymentUrl,
      initPoint: response.init_point || null,
      sandboxInitPoint: response.sandbox_init_point || null,
      externalReference,
      environment: token.environment,
      tokenSource: token.source,
      updatedAt: now,
    },
    payment: {
      ...(orderData.payment || {}),
      providerPreferenceId: response.id,
      preferenceId: response.id,
      paymentUrl,
      initPoint: response.init_point || null,
      sandboxInitPoint: response.sandbox_init_point || null,
      externalReference,
      status: 'pending_payment',
      retryable: false,
      linkCreationFailedAt: null,
      linkCreationError: null,
      updatedAt: now,
    },
    paymentUrl,
    paymentStatus: 'pending_payment',
    updatedAt: now,
  })

  await orderRef.set(patch, { merge: true })
  logger?.info?.('[mercadoPagoOrders] preference created', {
    orderId: orderRef.id,
    preferenceId: response.id,
    environment: token.environment,
  })

  return {
    provider: PROVIDER,
    preferenceId: response.id,
    paymentUrl,
    initPoint: response.init_point || paymentUrl,
    sandboxInitPoint: response.sandbox_init_point || null,
    reused: false,
  }
}

function mapMercadoPagoPaymentStatus(payment = {}) {
  const status = normalizeText(payment.status)
  const detail = normalizeText(payment.status_detail)
  if (PAID_STATUSES.has(status) || detail === 'accredited') return 'paid'
  if (PENDING_STATUSES.has(status)) return 'pending_payment'
  if (status === 'cancelled' || status === 'canceled') return 'canceled'
  if (status === 'refunded') return 'refunded'
  if (status === 'charged_back') return 'charged_back'
  if (status === 'expired') return 'expired'
  if (FAILED_STATUSES.has(status)) return 'failed'
  return 'pending_payment'
}

async function releaseScheduledSlotForOrderPaymentInTransaction({
  db,
  admin,
  transaction,
  orderRef,
  orderData,
  paymentStatus,
}) {
  if (!SLOT_RELEASE_PAYMENT_STATUSES.has(paymentStatus)) return {}

  const scheduledSlotKey = String(orderData?.scheduledSlotKey || '').trim()
  if (!scheduledSlotKey || orderData?.scheduledSlotReleasedAt) return {}

  const slotRef = db.collection('scheduledOrderSlots').doc(scheduledSlotKey)
  const slotSnapshot = await transaction.get(slotRef)
  if (slotSnapshot.exists) {
    const currentCount = Number(slotSnapshot.data()?.activeOrderCount || 0)
    transaction.set(slotRef, {
      activeOrderCount: Math.max(0, currentCount - 1),
      orderIds: admin.firestore.FieldValue.arrayRemove(orderRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  return {
    scheduledSlotReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
    scheduledSlotReleaseReason: `mercadopago_${paymentStatus}`,
  }
}

function buildWebhookPaymentPatch({ admin, payment, orderData }) {
  const now = admin.firestore.FieldValue.serverTimestamp()
  const nextStatus = mapMercadoPagoPaymentStatus(payment)
  const paid = nextStatus === 'paid'
  const paidAmountCents = toCents(Number(payment.transaction_amount || 0) * 100)
  const expectedAmountCents = toCents(orderData.totalCents || orderData.payment?.amountCents)
  const amountMatches = !expectedAmountCents || paidAmountCents === expectedAmountCents
  const providerStatus = normalizeText(payment.status || nextStatus)
  const providerPaymentId = String(payment.id || '')

  if (paid && !amountMatches) {
    return stripUndefinedDeep({
      paymentStatus: 'amount_mismatch',
      operationalBlockedReason: BLOCKED_REASON,
      updatedAt: now,
      payment: {
        status: 'amount_mismatch',
        provider: PROVIDER,
        mode: ONLINE_MODE,
        providerPaymentId,
        lastProviderStatus: providerStatus,
        grossAmountCents: paidAmountCents,
        amountMismatchAt: now,
        lastCheckedAt: now,
        updatedAt: now,
      },
      mercadoPago: {
        ...(orderData.mercadoPago || {}),
        paymentId: providerPaymentId,
        status: 'amount_mismatch',
        lastProviderStatus: providerStatus,
        updatedAt: now,
      },
    })
  }

  return stripUndefinedDeep({
    paymentStatus: nextStatus,
    paymentRequiresConfirmation: false,
    operationalBlockedReason: paid ? null : undefined,
    updatedAt: now,
    paidAt: paid ? now : undefined,
    paymentConfirmedAt: paid ? now : undefined,
    mercadoPago: {
      ...(orderData.mercadoPago || {}),
      paymentId: providerPaymentId,
      status: providerStatus,
      paymentStatus: nextStatus,
      lastProviderStatus: providerStatus,
      paymentMethodId: payment.payment_method_id || null,
      paymentTypeId: payment.payment_type_id || null,
      installments: payment.installments || null,
      lastCheckedAt: now,
      updatedAt: now,
    },
    payment: {
      ...(orderData.payment || {}),
      status: paid ? 'approved' : nextStatus,
      provider: PROVIDER,
      mode: ONLINE_MODE,
      method: 'mercadopago_online',
      providerPaymentId,
      lastProviderStatus: providerStatus,
      paymentMethodId: payment.payment_method_id || null,
      paymentTypeId: payment.payment_type_id || null,
      installments: payment.installments || null,
      netAmountCents: hasValue(payment.transaction_details?.net_received_amount)
        ? Math.round(Number(payment.transaction_details.net_received_amount) * 100)
        : undefined,
      grossAmountCents: paidAmountCents || undefined,
      paidAt: paid ? now : undefined,
      confirmedAt: paid ? now : undefined,
      lastCheckedAt: now,
      failedAt: nextStatus === 'failed' ? now : undefined,
      refundedAt: nextStatus === 'refunded' ? now : undefined,
      chargedBackAt: nextStatus === 'charged_back' ? now : undefined,
      updatedAt: now,
    },
  })
}

async function applyMercadoPagoPaymentToOrder({
  db,
  admin,
  orderMatch,
  payment,
  body = {},
  query = {},
}) {
  const orderRef = orderMatch?.ref
  if (!orderRef || !payment?.id) return { ignored: true, reason: 'missing_order_or_payment' }

  const paymentId = String(payment.id || '')
  const eventId = safeDocId(`${paymentId}_${payment.status || body.action || 'payment'}`)
  const eventRef = orderRef.collection('paymentEvents').doc(`mercadopago_${eventId}`)

  return db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef)
    const now = admin.firestore.Timestamp.now()
    if (eventSnapshot.exists && ['processed', 'ignored'].includes(eventSnapshot.data()?.status)) {
      return {
        duplicate: true,
        orderId: orderRef.id,
        paymentStatus: eventSnapshot.data()?.paymentStatus || null,
      }
    }

    const latestOrderSnapshot = await transaction.get(orderRef)
    if (!latestOrderSnapshot.exists) return { ignored: true, reason: 'order_not_found' }
    const latestOrderData = latestOrderSnapshot.data() || {}
    if (latestOrderData.payment?.provider !== PROVIDER || latestOrderData.payment?.mode !== ONLINE_MODE) {
      transaction.set(eventRef, {
        provider: PROVIDER,
        status: 'ignored',
        ignoreReason: 'order_not_mercadopago_online',
        paymentId,
        receivedAt: now,
        processedAt: now,
      }, { merge: true })
      return { ignored: true, reason: 'order_not_mercadopago_online', orderId: orderRef.id }
    }

    const paymentStatus = mapMercadoPagoPaymentStatus(payment)
    const patch = buildWebhookPaymentPatch({ admin, payment, orderData: latestOrderData })
    const releasePatch = await releaseScheduledSlotForOrderPaymentInTransaction({
      db,
      admin,
      transaction,
      orderRef,
      orderData: latestOrderData,
      paymentStatus,
    })

    transaction.set(eventRef, stripUndefinedDeep({
      provider: PROVIDER,
      scope: 'order_payment',
      status: 'processed',
      eventId,
      paymentId,
      paymentStatus,
      providerStatus: payment.status || null,
      externalReference: payment.external_reference || null,
      preferenceId: payment.preference_id || payment.order?.id || null,
      receivedAt: eventSnapshot.exists ? eventSnapshot.data()?.receivedAt || now : now,
      processedAt: now,
      raw: {
        action: body.action || null,
        type: body.type || null,
        data: body.data || null,
        queryStoreId: query.storeId || null,
        queryOrderId: query.orderId || null,
      },
    }), { merge: true })
    transaction.set(orderRef, { ...patch, ...releasePatch }, { merge: true })

    return {
      processed: true,
      orderId: orderRef.id,
      storeId: String(latestOrderData.storeDocId || latestOrderData.storeId || ''),
      paymentStatus: patch.paymentStatus || paymentStatus,
      providerStatus: payment.status || null,
    }
  })
}

function getWebhookPaymentId(request, body) {
  return String(
    request.query?.['data.id'] ||
      request.query?.id ||
      body?.data?.id ||
      body?.id ||
      body?.resource ||
      ''
  ).replace(/^.*\/payments\//, '').trim()
}

function parseMercadoPagoSignatureHeader(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=')
      const normalizedKey = String(key || '').trim()
      const normalizedValue = rest.join('=').trim()
      if (normalizedKey && normalizedValue) acc[normalizedKey] = normalizedValue
      return acc
    }, {})
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex')
  const rightBuffer = Buffer.from(String(right || ''), 'hex')
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function validateMercadoPagoWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = 300,
}) {
  const signature = parseMercadoPagoSignatureHeader(xSignature)
  const ts = String(signature.ts || '').trim()
  const v1 = String(signature.v1 || '').trim()
  const requestId = String(xRequestId || '').trim()
  const paymentId = String(dataId || '').trim()
  const secretValue = String(secret || '').trim()

  if (!secretValue) return { ok: false, reason: 'missing_secret' }
  if (!ts || !v1) return { ok: false, reason: 'missing_signature_parts' }
  if (!requestId) return { ok: false, reason: 'missing_request_id' }
  if (!paymentId) return { ok: false, reason: 'missing_data_id' }

  const timestampMs = Number(ts) * 1000
  if (!Number.isFinite(timestampMs)) return { ok: false, reason: 'invalid_timestamp' }
  if (toleranceSeconds > 0 && Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) {
    return { ok: false, reason: 'signature_expired' }
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`
  const expected = crypto
    .createHmac('sha256', secretValue)
    .update(manifest)
    .digest('hex')

  return timingSafeEqualHex(expected, v1)
    ? { ok: true, reason: 'valid' }
    : { ok: false, reason: 'signature_mismatch' }
}

async function fetchMercadoPagoPayment({ paymentId, accessToken }) {
  const id = String(paymentId || '').trim()
  const token = String(accessToken || '').trim()
  if (!id) {
    const error = new Error('Payment id Mercado Pago obrigatorio.')
    error.code = 'invalid-argument'
    throw error
  }
  if (!token) {
    const error = new Error('Token Mercado Pago indisponivel.')
    error.code = 'failed-precondition'
    throw error
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'Falha ao consultar pagamento Mercado Pago.')
    error.code = response.status === 404 ? 'not-found' : 'failed-precondition'
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload || {}
}

async function findOrderSnapshotByDocId(db, orderId) {
  const id = String(orderId || '').trim()
  if (!id) return null
  const snapshot = await db.collection('orders').doc(id).get()
  return snapshot.exists ? { ref: snapshot.ref, snapshot, data: snapshot.data() || {}, source: 'doc_id' } : null
}

async function findFirstOrderByField(db, field, value) {
  const cleanValue = String(value || '').trim()
  if (!cleanValue) return null
  const snapshot = await db.collection('orders').where(field, '==', cleanValue).limit(1).get()
  if (snapshot.empty) return null
  const docSnapshot = snapshot.docs[0]
  return {
    ref: docSnapshot.ref,
    snapshot: docSnapshot,
    data: docSnapshot.data() || {},
    source: field,
  }
}

async function findMercadoPagoOrderSnapshot({
  db,
  payment = {},
  body = {},
  query = {},
  hints = {},
}) {
  const externalReferences = uniqueTruthy([
    payment.external_reference,
    payment.externalReference,
    hints.externalReference,
    query.external_reference,
    body.external_reference,
    body.externalReference,
  ])
  const parsedReferences = externalReferences.map(parseMercadoPagoExternalReference)
  const trackingTokens = uniqueTruthy([
    hints.trackingToken,
    query.trackingToken,
    body.trackingToken,
    payment.metadata?.trackingToken,
    ...parsedReferences.map((reference) => reference.orderId),
  ])
  const orderIds = uniqueTruthy([
    hints.orderId,
    query.orderId,
    body.orderId,
    payment.metadata?.orderId,
    ...trackingTokens,
  ])

  for (const orderId of orderIds) {
    const match = await findOrderSnapshotByDocId(db, orderId)
    if (match) return match
  }

  for (const externalReference of externalReferences) {
    const match =
      await findFirstOrderByField(db, 'payment.externalReference', externalReference) ||
      await findFirstOrderByField(db, 'mercadoPago.externalReference', externalReference)
    if (match) return match
  }

  for (const trackingToken of trackingTokens) {
    const match = await findFirstOrderByField(db, 'trackingToken', trackingToken)
    if (match) return match
  }

  const preferenceIds = uniqueTruthy([
    hints.preferenceId,
    query.preference_id,
    query.preferenceId,
    body.preference_id,
    body.preferenceId,
    payment.preference_id,
    payment.preferenceId,
    payment.metadata?.preferenceId,
    payment.order?.id,
  ])
  for (const preferenceId of preferenceIds) {
    const match =
      await findFirstOrderByField(db, 'mercadoPago.preferenceId', preferenceId) ||
      await findFirstOrderByField(db, 'payment.providerPreferenceId', preferenceId) ||
      await findFirstOrderByField(db, 'payment.preferenceId', preferenceId)
    if (match) return match
  }

  const paymentIds = uniqueTruthy([
    hints.paymentId,
    query.payment_id,
    query.collection_id,
    body.payment_id,
    body.collection_id,
    payment.id,
  ])
  for (const paymentId of paymentIds) {
    const match =
      await findFirstOrderByField(db, 'payment.providerPaymentId', paymentId) ||
      await findFirstOrderByField(db, 'mercadoPago.paymentId', paymentId)
    if (match) return match
  }

  return null
}

function createMercadoPagoOrderFunctions({
  db,
  admin,
  HttpsError,
  logger,
  region = 'southamerica-east1',
  accessTokenTestSecret,
  accessTokenProdSecret,
  clientIdSecret,
  clientSecretSecret,
  webhookSecret,
  sendNewOrderPushToStore = null,
}) {
  const getMercadoPagoConnectUrl = onCall(
    {
      region,
      timeoutSeconds: 30,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [clientIdSecret],
    },
    async (request) => {
      const uid = request.auth?.uid
      if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

      const storeId = String(request.data?.storeId || '').trim()
      if (!storeId) throw new HttpsError('invalid-argument', 'Loja obrigatoria.')

      const [userSnapshot, storeSnapshot] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('stores').doc(storeId).get(),
      ])
      if (!userSnapshot.exists || !storeSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Loja indisponivel.')
      }

      const userData = userSnapshot.data() || {}
      const storeData = storeSnapshot.data() || {}
      const role = normalizeText(userData.role)
      const userStoreIds = Array.isArray(userData.storeIds) ? userData.storeIds.map(String) : []
      const canManage =
        ['admin', 'developer', 'dev'].includes(role) ||
        storeData.ownerId === uid ||
        storeData.ownerUid === uid ||
        userData.storeId === storeId ||
        userStoreIds.includes(storeId) ||
        (Array.isArray(storeData.allowedUserIds) && storeData.allowedUserIds.includes(uid)) ||
        (Array.isArray(storeData.merchantUids) && storeData.merchantUids.includes(uid))

      if (!canManage) throw new HttpsError('permission-denied', 'Permissao negada.')

      const currentConfig = normalizeMercadoPagoPublicConfig(storeData)
      if (currentConfig.status === 'active' || currentConfig.enabled === true) {
        const activeOrder = await findActiveMercadoPagoOrder({ db, storeId, storeData })
        if (activeOrder) {
          throw new HttpsError(
            'failed-precondition',
            'Finalize ou cancele os pedidos online ativos antes de trocar a conta Mercado Pago.',
            { reason: 'active-mercadopago-orders', ...activeOrder }
          )
        }
      }

      const clientId = getSecretValue(clientIdSecret, 'MERCADOPAGO_CLIENT_ID')
      if (!clientId) throw new HttpsError('failed-precondition', 'MERCADOPAGO_CLIENT_ID nao configurado.')

      const redirectUri = String(process.env.MERCADOPAGO_OAUTH_REDIRECT_URI || '').trim()
      if (!redirectUri) throw new HttpsError('failed-precondition', 'MERCADOPAGO_OAUTH_REDIRECT_URI nao configurado.')

      const nonce = crypto.randomBytes(24).toString('hex')
      const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000)
      await db.collection(OAUTH_STATE_COLLECTION).doc(nonce).set({
        storeId,
        uid,
        nonce,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      })

      const url = new URL('https://auth.mercadopago.com.br/authorization')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('platform_id', 'mp')
      url.searchParams.set('state', nonce)
      url.searchParams.set('redirect_uri', redirectUri)

      return { ok: true, url: url.toString(), expiresAt: expiresAt.toMillis() }
    }
  )

  const mercadoPagoOAuthCallback = onRequest(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [clientIdSecret, clientSecretSecret],
    },
    async (request, response) => {
      const code = String(request.query.code || '').trim()
      const state = String(request.query.state || '').trim()
      const redirectBase = `${getPublicAppBaseUrl()}/dashboard/pagamentos`

      try {
        if (!code || !state) throw new Error('Callback Mercado Pago invalido.')
        const stateRef = db.collection(OAUTH_STATE_COLLECTION).doc(state)
        const stateSnapshot = await stateRef.get()
        if (!stateSnapshot.exists) throw new Error('State Mercado Pago invalido.')
        const stateData = stateSnapshot.data() || {}
        if (stateData.status === 'used') throw new Error('State Mercado Pago ja utilizado.')
        if (stateData.expiresAt?.toMillis?.() < Date.now()) throw new Error('State Mercado Pago expirado.')

        const clientId = getSecretValue(clientIdSecret, 'MERCADOPAGO_CLIENT_ID')
        const clientSecret = getSecretValue(clientSecretSecret, 'MERCADOPAGO_CLIENT_SECRET')
        const redirectUri = String(process.env.MERCADOPAGO_OAUTH_REDIRECT_URI || '').trim()
        if (!clientId || !clientSecret || !redirectUri) throw new Error('OAuth Mercado Pago nao configurado.')

        const tokenPayload = await fetchOAuthToken({ code, redirectUri, clientId, clientSecret })
        const now = admin.firestore.FieldValue.serverTimestamp()
        // TODO(mercadopago-secrets): migrate per-store OAuth tokens from this
        // deny-all private collection to Secret Manager/KMS before broad rollout.
        await getProviderRef(db, stateData.storeId).set(stripUndefinedDeep({
          provider: PROVIDER,
          status: 'active',
          environment: tokenPayload.live_mode === true ? 'production' : 'sandbox',
          sellerUserId: tokenPayload.user_id ? String(tokenPayload.user_id) : null,
          publicKey: tokenPayload.public_key || null,
          accessToken: tokenPayload.access_token,
          refreshToken: tokenPayload.refresh_token || null,
          accessTokenSecretName: 'private_firestore_phase1',
          refreshTokenSecretName: tokenPayload.refresh_token ? 'private_firestore_phase1' : null,
          expiresAt: tokenPayload.expires_in
            ? admin.firestore.Timestamp.fromMillis(Date.now() + Number(tokenPayload.expires_in) * 1000)
            : null,
          scopes: tokenPayload.scope ? String(tokenPayload.scope).split(' ') : [],
          createdBy: stateData.uid,
          updatedAt: now,
          connectedAt: now,
          lastError: null,
        }), { merge: true })

        await db.collection('stores').doc(stateData.storeId).set({
          payments: {
            mercadoPago: {
              provider: PROVIDER,
              enabled: true,
              status: 'active',
              environment: tokenPayload.live_mode === true ? 'production' : 'sandbox',
              allowPix: true,
              allowCreditCard: true,
              maxInstallmentCount: 1,
              requireForScheduled: false,
              updatedAt: now,
            },
          },
          orderPaymentProvider: PROVIDER,
          billingProvider: 'asaas',
          updatedAt: now,
        }, { merge: true })

        await stateRef.set({ status: 'used', usedAt: now }, { merge: true })
        response.redirect(`${redirectBase}?mercadopago=connected`)
      } catch (error) {
        logger?.warn?.('[mercadoPagoOrders] OAuth callback failed', {
          error: error?.message || String(error),
        })
        response.redirect(`${redirectBase}?mercadopago=error`)
      }
    }
  )

  const disconnectMercadoPago = onCall(
    {
      region,
      timeoutSeconds: 30,
      memory: '256MiB',
      maxInstances: 10,
    },
    async (request) => {
      const uid = request.auth?.uid
      if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

      const storeId = String(request.data?.storeId || '').trim()
      if (!storeId) throw new HttpsError('invalid-argument', 'Loja obrigatoria.')

      const [userSnapshot, storeSnapshot] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('stores').doc(storeId).get(),
      ])
      if (!userSnapshot.exists || !storeSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Loja indisponivel.')
      }

      const userData = userSnapshot.data() || {}
      const storeData = storeSnapshot.data() || {}
      const role = normalizeText(userData.role)
      const userStoreIds = Array.isArray(userData.storeIds) ? userData.storeIds.map(String) : []
      const canManage =
        ['admin', 'developer', 'dev'].includes(role) ||
        storeData.ownerId === uid ||
        storeData.ownerUid === uid ||
        userData.storeId === storeId ||
        userStoreIds.includes(storeId) ||
        (Array.isArray(storeData.allowedUserIds) && storeData.allowedUserIds.includes(uid)) ||
        (Array.isArray(storeData.merchantUids) && storeData.merchantUids.includes(uid))

      if (!canManage) throw new HttpsError('permission-denied', 'Permissao negada.')

      const activeOrder = await findActiveMercadoPagoOrder({ db, storeId, storeData })
      if (activeOrder) {
        throw new HttpsError(
          'failed-precondition',
          'Finalize ou cancele os pedidos online ativos antes de desconectar o Mercado Pago.',
          { reason: 'active-mercadopago-orders', ...activeOrder }
        )
      }

      const now = admin.firestore.FieldValue.serverTimestamp()
      const deleteField = admin.firestore.FieldValue.delete()
      const batch = db.batch()
      const providerRef = getProviderRef(db, storeId)
      const providerSnapshot = await providerRef.get()

      const providerPatch = {
        provider: PROVIDER,
        status: 'disconnected',
        lastError: null,
        disconnectedBy: uid,
        disconnectedAt: now,
        updatedAt: now,
      }

      if (providerSnapshot.exists) {
        batch.update(providerRef, {
          ...providerPatch,
          accessToken: deleteField,
          refreshToken: deleteField,
          accessTokenSecretName: deleteField,
          refreshTokenSecretName: deleteField,
        })
      } else {
        batch.set(providerRef, providerPatch, { merge: true })
      }

      batch.update(db.collection('stores').doc(storeId), {
        'payments.mercadoPago.provider': PROVIDER,
        'payments.mercadoPago.enabled': false,
        'payments.mercadoPago.status': 'not_connected',
        'payments.mercadoPago.allowPix': false,
        'payments.mercadoPago.allowCreditCard': false,
        'payments.mercadoPago.requireForScheduled': false,
        'payments.mercadoPago.environment': deleteField,
        'payments.mercadoPago.sellerUserId': deleteField,
        'payments.mercadoPago.publicKey': deleteField,
        'payments.mercadoPago.disconnectedAt': now,
        'payments.mercadoPago.updatedAt': now,
        orderPaymentProvider: deleteField,
        updatedAt: now,
      })

      await batch.commit()
      return { ok: true, storeId, status: 'not_connected' }
    }
  )

  const createMercadoPagoOrderPayment = onCall(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [accessTokenTestSecret, accessTokenProdSecret],
    },
    async (request) => {
      const data = request.data || {}
      const orderId = String(data.orderId || data.trackingToken || '').trim()
      const trackingToken = String(data.trackingToken || '').trim()

      if (!/^[A-Za-z0-9_-]{8,180}$/.test(orderId) || !/^[A-Za-z0-9_-]{8,180}$/.test(trackingToken)) {
        throw new HttpsError('invalid-argument', 'Pedido invalido.')
      }

      const orderRef = db.collection('orders').doc(orderId)
      const orderSnapshot = await orderRef.get()
      if (!orderSnapshot.exists) throw new HttpsError('not-found', 'Pedido nao encontrado.')

      const orderData = { id: orderSnapshot.id, ...(orderSnapshot.data() || {}) }
      if (String(orderData.trackingToken || '') !== trackingToken) {
        throw new HttpsError('permission-denied', 'Token de acompanhamento invalido.')
      }

      const storeId = String(orderData.storeDocId || orderData.storeId || '').trim()
      const storeSnapshot = await db.collection('stores').doc(storeId).get()
      if (!storeSnapshot.exists) throw new HttpsError('failed-precondition', 'Loja indisponivel.')

      try {
        const preference = await createMercadoPagoPreference({
          db,
          admin,
          logger,
          accessTokenTestSecret,
          accessTokenProdSecret,
          orderRef,
          orderData,
          storeData: storeSnapshot.data() || {},
        })
        return { ok: true, orderId, ...preference }
      } catch (error) {
        throw new HttpsError(error.code || 'internal', error.message || 'Falha ao gerar pagamento Mercado Pago.')
      }
    }
  )

  const reconcileMercadoPagoOrderPayment = onCall(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [accessTokenTestSecret, accessTokenProdSecret],
    },
    async (request) => {
      const data = request.data || {}
      const trackingToken = String(data.trackingToken || '').trim()
      const storeId = String(data.storeId || '').trim()
      const storeSlug = String(data.storeSlug || '').trim()
      const paymentId = String(data.paymentId || data.payment_id || data.collection_id || '').trim()
      const preferenceId = String(data.preferenceId || data.preference_id || '').trim()
      const externalReference = String(data.externalReference || data.external_reference || '').trim()

      if (!trackingToken || !/^[A-Za-z0-9_-]{8,180}$/.test(trackingToken)) {
        throw new HttpsError('invalid-argument', 'Token de acompanhamento invalido.')
      }

      const orderMatch = await findMercadoPagoOrderSnapshot({
        db,
        payment: {
          id: paymentId,
          external_reference: externalReference,
          preference_id: preferenceId,
        },
        query: {
          storeId,
          storeSlug,
        },
        hints: {
          trackingToken,
          paymentId,
          preferenceId,
          externalReference,
        },
      })

      if (!orderMatch) throw new HttpsError('not-found', 'Pedido nao encontrado.')

      const orderData = orderMatch.data || {}
      if (String(orderData.trackingToken || '') !== trackingToken) {
        throw new HttpsError('permission-denied', 'Token de acompanhamento invalido.')
      }

      const orderStoreKeys = uniqueTruthy([
        orderData.storeId,
        orderData.storeDocId,
        orderData.storeSlug,
        orderData.store?.id,
        orderData.store?.docId,
        orderData.store?.slug,
      ])
      const requestedStoreKeys = uniqueTruthy([storeId, storeSlug])
      if (requestedStoreKeys.length > 0 && !requestedStoreKeys.some((key) => orderStoreKeys.includes(key))) {
        throw new HttpsError('permission-denied', 'Pedido nao pertence a esta loja.')
      }

      const finalPaymentId = paymentId || orderData.payment?.providerPaymentId || orderData.mercadoPago?.paymentId || ''
      if (!finalPaymentId) {
        return {
          ok: true,
          reconciled: false,
          orderId: orderMatch.ref.id,
          paymentStatus: orderData.paymentStatus || orderData.payment?.status || 'pending_payment',
          reason: 'missing_payment_id',
        }
      }

      const finalStoreId = String(orderData.storeDocId || orderData.storeId || storeId || '').trim()
      const storeSnapshot = finalStoreId ? await db.collection('stores').doc(finalStoreId).get() : null
      const storeData = storeSnapshot?.exists ? storeSnapshot.data() || {} : null
      const token = await resolvePaymentLookupToken({
        db,
        storeId: finalStoreId,
        storeData,
        accessTokenTestSecret,
        accessTokenProdSecret,
        preferProduction: true,
        logger,
      })
      const payment = await fetchMercadoPagoPayment({
        paymentId: finalPaymentId,
        accessToken: token.accessToken,
      })
      const result = await applyMercadoPagoPaymentToOrder({
        db,
        admin,
        orderMatch,
        payment,
        body: { action: 'manual_reconcile', type: 'payment' },
        query: { storeId: finalStoreId, orderId: orderMatch.ref.id },
      })

      return {
        ok: true,
        reconciled: Boolean(result.processed || result.duplicate),
        tokenSource: token.source,
        providerStatus: payment.status || null,
        ...result,
      }
    }
  )

  const mercadoPagoOrderWebhook = onRequest(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [accessTokenTestSecret, accessTokenProdSecret, webhookSecret],
    },
    async (request, response) => {
      if (request.method !== 'POST') {
        response.status(405).json({ ok: false, error: 'method_not_allowed' })
        return
      }

      const body = request.body && typeof request.body === 'object' ? request.body : {}
      const query = request.query || {}
      const paymentId = getWebhookPaymentId(request, body)
      const orderIdFromQuery = String(query.orderId || '').trim()
      const storeIdFromQuery = String(query.storeId || '').trim()
      const xSignature = request.get('x-signature')
      const xRequestId = request.get('x-request-id')

      logger?.info?.('[mercadoPagoOrders] webhook received', {
        action: body.action || null,
        type: body.type || null,
        paymentId: paymentId || null,
        hasSignature: Boolean(xSignature),
        hasRequestId: Boolean(xRequestId),
        liveMode: body.live_mode ?? null,
      })

      const webhookSecretValue = getSecretValue(webhookSecret, 'MERCADOPAGO_WEBHOOK_SECRET')
      const allowUnsignedWebhook =
        process.env.FUNCTIONS_EMULATOR === 'true' &&
        process.env.ALLOW_MERCADOPAGO_UNSIGNED_WEBHOOKS === 'true'

      if (!webhookSecretValue && !allowUnsignedWebhook) {
        logger?.error?.('[mercadoPagoOrders] webhook rejected', {
          reason: 'webhook_secret_not_configured',
          paymentId: paymentId || null,
        })
        response.status(401).json({ ok: false, error: 'webhook_not_configured' })
        return
      }

      if (webhookSecretValue) {
        const signatureResult = validateMercadoPagoWebhookSignature({
          xSignature,
          xRequestId,
          dataId: paymentId,
          secret: webhookSecretValue,
          toleranceSeconds: 300,
        })
        logger?.info?.('[mercadoPagoOrders] webhook signature validation completed', {
          paymentId: paymentId || null,
          valid: signatureResult.ok,
          reason: signatureResult.reason,
        })
        if (!signatureResult.ok) {
          logger?.warn?.('[mercadoPagoOrders] webhook rejected', {
            reason: signatureResult.reason,
            paymentId: paymentId || null,
            hasSignature: Boolean(xSignature),
            hasRequestId: Boolean(xRequestId),
          })
          response.status(401).json({ ok: false, error: 'invalid_signature', reason: signatureResult.reason })
          return
        }
      } else if (isMercadoPagoSimulatorPayload(request, body)) {
        logger?.info?.('[mercadoPagoOrders] webhook simulator ping accepted', {
          paymentId,
          action: body.action || null,
          type: body.type || null,
        })

        response.status(200).json({
          ok: true,
          simulator: true,
          ignored: true,
          reason: 'mercadopago_simulator_payload',
        })
        return
      }

      if (!paymentId) {
        response.status(400).json({ ok: false, error: 'missing_payment_id' })
        return
      }

      try {
        let storeDataForToken = null
        if (storeIdFromQuery) {
          const storeSnapshot = await db.collection('stores').doc(storeIdFromQuery).get()
          storeDataForToken = storeSnapshot.exists ? storeSnapshot.data() || {} : null
        }

        let token = await resolvePaymentLookupToken({
          db,
          storeId: storeIdFromQuery,
          storeData: storeDataForToken,
          accessTokenTestSecret,
          accessTokenProdSecret,
          preferProduction: body.live_mode !== false,
          logger,
        })
        let payment
        try {
          payment = await fetchMercadoPagoPayment({ paymentId, accessToken: token.accessToken })
        } catch (fetchError) {
          if ((fetchError.status === 401 || fetchError.status === 403) && token.source === 'oauth') {
            token = await resolvePaymentLookupToken({
              db,
              storeId: '',
              storeData: null,
              accessTokenTestSecret,
              accessTokenProdSecret,
              preferProduction: body.live_mode !== false,
              logger,
            })
            payment = await fetchMercadoPagoPayment({ paymentId, accessToken: token.accessToken })
          } else {
            throw fetchError
          }
        }

        logger?.info?.('[mercadoPagoOrders] payment fetched', {
          paymentId,
          status: payment.status || null,
          tokenSource: token.source,
          liveMode: payment.live_mode ?? null,
        })

        const orderMatch = await findMercadoPagoOrderSnapshot({
          db,
          payment,
          body,
          query,
          hints: {
            orderId: orderIdFromQuery,
            paymentId,
          },
        })
        if (!orderMatch) {
          response.status(202).json({ ok: true, ignored: true, reason: 'order_not_found' })
          return
        }

        const result = await applyMercadoPagoPaymentToOrder({
          db,
          admin,
          orderMatch,
          payment,
          body,
          query,
        })

        if (result.processed && result.paymentStatus === 'paid' && typeof sendNewOrderPushToStore === 'function') {
          try {
            await sendNewOrderPushToStore({ storeId: result.storeId || '', orderId: result.orderId })
          } catch (pushError) {
            logger?.warn?.('[mercadoPagoOrders] paid order push failed', {
              orderId: result.orderId,
              storeId: result.storeId || '',
              error: pushError?.message || String(pushError),
            })
          }
        }

        response.status(200).json({ ok: true, ...result })
      } catch (error) {
        logger?.error?.('[mercadoPagoOrders] webhook failed', {
          paymentId,
          orderId: orderIdFromQuery,
          error: error?.message || String(error),
        })
        response.status(500).json({ ok: false, error: 'webhook_processing_failed' })
      }
    }
  )

  return {
    getMercadoPagoConnectUrl,
    mercadoPagoOAuthCallback,
    disconnectMercadoPago,
    createMercadoPagoOrderPayment,
    reconcileMercadoPagoOrderPayment,
    mercadoPagoOrderWebhook,
  }
}

module.exports = {
  BLOCKED_REASON,
  ONLINE_MODE,
  PROVIDER,
  buildWebhookPaymentPatch,
  assertMercadoPagoOrderCheckoutConfigured,
  buildMercadoPagoExternalReference,
  buildMercadoPagoPreferencePayload: buildPreferencePayload,
  buildMercadoPagoPendingPaymentSnapshot,
  buildMercadoPagoPreferenceFailurePatch,
  createMercadoPagoOrderFunctions,
  createMercadoPagoPreference,
  getWebhookPaymentId,
  findMercadoPagoOrderSnapshot,
  isMercadoPagoOnlineActive,
  isMercadoPagoOnlinePaymentRequest,
  mapMercadoPagoPaymentStatus,
  normalizeMercadoPagoPublicConfig,
  normalizePreorderPolicy,
  orderRequiresMercadoPagoOnline,
  parseMercadoPagoExternalReference,
  parseMercadoPagoSignatureHeader,
  validateMercadoPagoWebhookSignature,
}
