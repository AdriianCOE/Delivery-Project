const { onCall, onRequest } = require('firebase-functions/v2/https')
const crypto = require('crypto')
const {
  normalizeMercadoPagoPublicConfig,
} = require('./mercadoPagoOrders')

const PROVIDER = 'asaas'
const ONLINE_MODE = 'online'
const BLOCKED_REASON = 'awaiting_online_payment'
const DEFAULT_ASAAS_ORDERS_BASE_URL = 'https://api-sandbox.asaas.com/v3'
const LEGACY_ASAAS_ACTIVE_STATUSES = new Set(['active', 'enabled', 'ativo'])

const SUPPORTED_WEBHOOK_EVENTS = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
])
const TERMINAL_PAYMENT_STATUSES = new Set([
  'paid',
  'confirmed',
  'refunded',
  'partially_refunded',
  'chargeback_requested',
  'canceled',
  'cancelled',
  'failed',
  'expired',
])
const SLOT_RELEASE_PAYMENT_STATUSES = new Set(['failed', 'canceled', 'expired'])

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

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined)
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

function buildAsaasOrderExternalReference({ storeId, orderId }) {
  return `pratoby:order:${safeDocId(storeId)}:${safeDocId(orderId)}`
}

function parseAsaasOrderExternalReference(value) {
  const parts = String(value || '').split(':')
  if (parts.length === 4 && parts[0] === 'pratoby' && parts[1] === 'order') {
    return {
      storeId: parts[2],
      orderId: parts[3],
    }
  }
  return { storeId: '', orderId: '' }
}

function normalizeManualPayments(store = {}) {
  const methods = store.paymentMethods || {}
  return stripUndefinedDeep({
    pix: methods.pix !== false,
    card: methods.card !== false,
    cash: methods.cash !== false,
  })
}

function normalizeAsaasPublicConfig(store = {}) {
  const raw = store.payments?.asaas || {}
  const status = normalizeText(raw.status || (raw.enabled === true ? 'active' : 'inactive'))
  const maxInstallmentCount = toPositiveInteger(raw.maxInstallmentCount, null, 1, 12)

  return stripUndefinedDeep({
    enabled: false,
    status: status || 'legacy_disabled',
    legacy: true,
    billingType: 'UNDEFINED',
    allowPix: raw.allowPix !== false,
    allowCreditCard: raw.allowCreditCard !== false,
    allowBoleto: raw.allowBoleto === true,
    maxInstallmentCount,
  })
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

  const safeMode = [
    'manual',
    'pix_manual',
    'mercadopago_online',
    'manual_or_mercadopago',
  ].includes(mode) ? mode : 'manual'

  return stripUndefinedDeep({
    mode: safeMode,
    requiredMethod: safeMode !== 'manual' ? safeMode : undefined,
  })
}

function sanitizePublicStorePayments(store = {}) {
  const mercadoPago = normalizeMercadoPagoPublicConfig(store)

  return stripUndefinedDeep({
    manual: normalizeManualPayments(store),
    asaas: normalizeAsaasPublicConfig(store),
    mercadoPago,
    mercadopago: mercadoPago,
    preorderPolicy: normalizePreorderPolicy(store),
  })
}

function isAsaasOnlineActive(store = {}) {
  const raw = store.payments?.asaas || {}
  const status = normalizeText(raw.status || (raw.enabled === true ? 'active' : 'inactive'))
  return raw.enabled === true && LEGACY_ASAAS_ACTIVE_STATUSES.has(status)
}

function orderRequiresAsaasOnline({ store, schedulingDecision }) {
  if (schedulingDecision?.orderTiming !== 'scheduled') return false
  return normalizePreorderPolicy(store).mode === 'asaas_online'
}

function isAsaasOnlinePaymentRequest(input = {}) {
  const method = normalizeText(input.paymentMethod || input.paymentType)
  const mode = normalizeText(input.paymentMode)
  const provider = normalizeText(input.paymentProvider)
  return method === 'asaas_online' || (mode === ONLINE_MODE && provider === PROVIDER)
}

function buildAsaasPendingPaymentSnapshot({ totalCents, storeId, storeSlug, orderId }) {
  return {
    paymentMethod: 'Asaas Online',
    paymentType: 'asaas_online',
    paymentMode: ONLINE_MODE,
    paymentProvider: PROVIDER,
    paymentStatus: 'pending',
    paymentRequiresConfirmation: false,
    operationalBlockedReason: BLOCKED_REASON,
    payment: {
      mode: ONLINE_MODE,
      provider: PROVIDER,
      method: 'asaas_online',
      label: 'Pagamento online',
      status: 'pending',
      amount: centsToMoney(totalCents),
      amountCents: totalCents,
      grossAmountCents: totalCents,
      netAmountCents: null,
      feeCents: null,
      currency: 'BRL',
      externalReference: buildAsaasOrderExternalReference({ storeId, orderId }),
      providerPaymentId: null,
      providerPaymentLinkId: null,
      invoiceUrl: null,
      paymentUrl: null,
      createdAt: null,
      paidAt: null,
      failedAt: null,
      refundedAt: null,
      storeSlug,
    },
  }
}

function buildAsaasLinkCreationFailurePatch({ admin, error }) {
  const now = admin.firestore.FieldValue.serverTimestamp()
  return stripUndefinedDeep({
    paymentStatus: 'failed_link_creation',
    operationalBlockedReason: BLOCKED_REASON,
    updatedAt: now,
    payment: {
      status: 'failed_link_creation',
      linkCreationFailedAt: now,
      linkCreationError: sanitizeString(error?.message || 'Falha ao gerar link Asaas.', 300),
      retryable: true,
    },
  })
}

function getAsaasOrdersBaseUrl() {
  const configured = process.env.ASAAS_ORDERS_BASE_URL
  // Configure ASAAS_ORDERS_BASE_URL para sandbox ou producao antes do deploy.
  const allowSandboxFallback =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    process.env.ALLOW_ASAAS_ORDERS_SANDBOX_FALLBACK === 'true'

  if (!configured && !allowSandboxFallback) {
    const error = new Error('ASAAS_ORDERS_BASE_URL precisa ser configurada explicitamente.')
    error.code = 'failed-precondition'
    throw error
  }

  return String(configured || DEFAULT_ASAAS_ORDERS_BASE_URL).replace(/\/+$/, '')
}

async function callAsaasOrdersApi({ apiKey, path, method = 'POST', body }) {
  if (!apiKey) {
    const error = new Error('ASAAS_ORDERS_API_KEY nao configurada.')
    error.code = 'failed-precondition'
    throw error
  }

  const response = await fetch(`${getAsaasOrdersBaseUrl()}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'PratoBy/1.0',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    const error = new Error(payload?.errors?.[0]?.description || payload?.message || 'Falha ao criar pagamento Asaas.')
    error.code = response.status >= 500 ? 'unavailable' : 'failed-precondition'
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function buildOrderPaymentLinkPayload({ orderData, storeData }) {
  // createOrderPaymentLink reuses paymentUrl/invoiceUrl already saved on the
  // order, so retries do not create another payment link for the same order.
  // TODO(asaas-orders-production): Asaas paymentLinks may still create a new
  // charge when the payer fills the link; move to /payments before broad rollout.
  const totalCents = Math.max(0, toCents(orderData.totalCents || orderData.payment?.amountCents))
  const maxInstallmentCount = normalizeAsaasPublicConfig(storeData).maxInstallmentCount
  const dueDateLimitDays = toPositiveInteger(storeData.payments?.asaas?.dueDateLimitDays, 2, 1, 30)
  const externalReference = buildAsaasOrderExternalReference({
    storeId: orderData.storeId || orderData.storeDocId,
    orderId: orderData.trackingToken || orderData.id,
  })
  const description = sanitizeString(
    `Pedido ${orderData.displayNumber || orderData.orderNumber || orderData.trackingToken || ''} - ${orderData.storeName || 'PratoBy'}`,
    500
  )
  const callbackUrl = orderData.trackingUrlPath
    ? `${String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://pratoby.com').replace(/\/+$/, '')}${orderData.trackingUrlPath}`
    : undefined

  return stripUndefinedDeep({
    name: sanitizeString(`Pedido ${orderData.storeName || 'PratoBy'}`, 100),
    description,
    value: centsToMoney(totalCents),
    billingType: 'UNDEFINED',
    chargeType: maxInstallmentCount && maxInstallmentCount > 1 ? 'INSTALLMENT' : 'DETACHED',
    maxInstallmentCount: maxInstallmentCount && maxInstallmentCount > 1 ? maxInstallmentCount : undefined,
    dueDateLimitDays,
    externalReference,
    notificationEnabled: false,
    callback: callbackUrl
      ? {
          successUrl: callbackUrl,
          autoRedirect: false,
        }
      : undefined,
  })
}

function getAsaasPaymentUrl(payload = {}) {
  return payload.url || payload.paymentUrl || payload.invoiceUrl || payload.bankSlipUrl || ''
}

async function deactivateOrderPaymentLink({ apiKey, paymentLinkId }) {
  if (!paymentLinkId) return { skipped: true }
  return callAsaasOrdersApi({
    apiKey,
    path: `/paymentLinks/${encodeURIComponent(paymentLinkId)}`,
    method: 'PUT',
    body: { active: false },
  })
}

async function createOrderPaymentLink({ admin, logger, apiKey, orderRef, orderData, storeData }) {
  if (!orderRef || !orderData) {
    const error = new Error('Pedido invalido para pagamento online.')
    error.code = 'invalid-argument'
    throw error
  }

  if (orderData.payment?.provider !== PROVIDER || orderData.payment?.mode !== ONLINE_MODE) {
    const error = new Error('Pedido nao usa pagamento online Asaas.')
    error.code = 'failed-precondition'
    throw error
  }

  if (!isAsaasOnlineActive(storeData)) {
    const error = new Error('Pagamento online Asaas indisponivel para esta loja.')
    error.code = 'failed-precondition'
    throw error
  }

  if (TERMINAL_PAYMENT_STATUSES.has(String(orderData.payment?.status || orderData.paymentStatus || '').toLowerCase())) {
    const error = new Error('Pagamento online ja finalizado para este pedido.')
    error.code = 'failed-precondition'
    throw error
  }

  if (orderData.payment?.paymentUrl || orderData.payment?.invoiceUrl) {
    return {
      paymentUrl: orderData.payment.paymentUrl || orderData.payment.invoiceUrl,
      invoiceUrl: orderData.payment.invoiceUrl || orderData.payment.paymentUrl,
      providerPaymentLinkId: orderData.payment.providerPaymentLinkId || null,
      reused: true,
    }
  }

  // TODO(scheduled-slots-ttl): add a safe cleanup path for pending scheduled
  // slots if the customer never pays and no Asaas webhook is received.
  const response = await callAsaasOrdersApi({
    apiKey,
    path: '/paymentLinks',
    body: buildOrderPaymentLinkPayload({ orderData, storeData }),
  })
  const paymentUrl = getAsaasPaymentUrl(response)

  if (!paymentUrl) {
    const error = new Error('Asaas nao retornou URL de pagamento.')
    error.code = 'failed-precondition'
    throw error
  }

  const now = admin.firestore.FieldValue.serverTimestamp()
  const patch = stripUndefinedDeep({
    payment: {
      ...(orderData.payment || {}),
      providerPaymentLinkId: response.id || response.paymentLink || null,
      paymentLinkId: response.id || response.paymentLink || null,
      paymentUrl,
      invoiceUrl: response.invoiceUrl || paymentUrl,
      externalReference: response.externalReference || orderData.payment.externalReference,
      createdAt: now,
      linkCreationFailedAt: null,
      linkCreationError: null,
      retryable: false,
      status: 'pending',
    },
    paymentUrl,
    paymentStatus: 'pending',
    updatedAt: now,
  })

  await orderRef.set(patch, { merge: true })

  logger?.info?.('[asaasOrders] payment link created', {
    orderId: orderRef.id,
    paymentLinkId: response.id || response.paymentLink || null,
  })

  return {
    paymentUrl,
    invoiceUrl: response.invoiceUrl || paymentUrl,
    providerPaymentLinkId: response.id || response.paymentLink || null,
    reused: false,
  }
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
  if (!expectedBuffer.length || receivedBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

function parseWebhookBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  try {
    return JSON.parse(String(request.rawBody || '{}'))
  } catch {
    return {}
  }
}

function mapAsaasOrderPaymentStatus(event) {
  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') return 'paid'
  if (event === 'PAYMENT_OVERDUE') return 'expired'
  if (event === 'PAYMENT_DELETED') return 'canceled'
  if (event === 'PAYMENT_REFUNDED') return 'refunded'
  if (event === 'PAYMENT_PARTIALLY_REFUNDED') return 'partially_refunded'
  if (event === 'PAYMENT_CHARGEBACK_REQUESTED') return 'chargeback_requested'
  if (event === 'PAYMENT_REFUND_DENIED' || event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') return 'failed'
  return 'pending'
}

function buildWebhookPaymentPatch({ admin, event, payment, orderData }) {
  const now = admin.firestore.FieldValue.serverTimestamp()
  const nextStatus = mapAsaasOrderPaymentStatus(event)
  const paid = nextStatus === 'paid'
  const currentStatus = normalizeText(orderData?.status)
  const canReleaseOrder = paid && !['cancelado', 'canceled', 'cancelled', 'entregue', 'delivered'].includes(currentStatus)

  return stripUndefinedDeep({
    paymentStatus: nextStatus,
    paymentRequiresConfirmation: false,
    operationalBlockedReason: paid ? null : undefined,
    updatedAt: now,
    ...(canReleaseOrder ? {
      status: 'confirmado',
      confirmedAt: now,
      paymentConfirmedAt: now,
      paidAt: now,
    } : {}),
    payment: {
      status: nextStatus,
      provider: PROVIDER,
      mode: ONLINE_MODE,
      method: 'asaas_online',
      providerPaymentId: payment?.id || null,
      providerPaymentLinkId: payment?.paymentLink || null,
      billingType: payment?.billingType || null,
      invoiceUrl: payment?.invoiceUrl || undefined,
      paymentUrl: payment?.invoiceUrl || undefined,
      netAmountCents: hasValue(payment?.netValue) ? Math.round(Number(payment.netValue) * 100) : undefined,
      grossAmountCents: hasValue(payment?.value) ? Math.round(Number(payment.value) * 100) : undefined,
      paidAt: paid ? now : undefined,
      confirmedAt: paid ? now : undefined,
      failedAt: nextStatus === 'failed' ? now : undefined,
      refundedAt: nextStatus === 'refunded' ? now : undefined,
      partiallyRefundedAt: nextStatus === 'partially_refunded' ? now : undefined,
      updatedAt: now,
      webhookEvent: event,
    },
  })
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
    scheduledSlotReleaseReason: `asaas_${paymentStatus}`,
  }
}

function getWebhookOrderReference(payment = {}) {
  const fromExternal = parseAsaasOrderExternalReference(payment.externalReference)
  if (fromExternal.orderId) return fromExternal
  return { storeId: '', orderId: '' }
}

function createAsaasOrderFunctions({
  db,
  admin,
  HttpsError,
  logger,
  region = 'southamerica-east1',
  apiKeySecret,
  webhookSecret,
  sendNewOrderPushToStore = null,
}) {
  const createAsaasOrderPayment = onCall(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [apiKeySecret],
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
        const link = await createOrderPaymentLink({
          db,
          admin,
          logger,
          apiKey: getSecretValue(apiKeySecret, 'ASAAS_ORDERS_API_KEY'),
          orderRef,
          orderData,
          storeData: storeSnapshot.data() || {},
        })
        return { ok: true, orderId, ...link }
      } catch (error) {
        throw new HttpsError(error.code || 'internal', error.message || 'Falha ao gerar pagamento.')
      }
    }
  )

  const asaasOrderWebhook = onRequest(
    {
      region,
      timeoutSeconds: 60,
      memory: '256MiB',
      maxInstances: 10,
      secrets: [webhookSecret, apiKeySecret],
    },
    async (request, response) => {
      if (request.method !== 'POST') {
        response.status(405).json({ ok: false, error: 'method_not_allowed' })
        return
      }

      const expectedToken = getSecretValue(webhookSecret, 'ASAAS_ORDERS_WEBHOOK_SECRET')
      const receivedToken = request.get('asaas-access-token') || request.get('x-asaas-webhook-token') || ''
      if (!timingSafeStringEqual(receivedToken, expectedToken)) {
        logger?.warn?.('[asaasOrders] webhook rejected: invalid token')
        response.status(401).json({ ok: false, error: 'invalid_token' })
        return
      }

      const body = parseWebhookBody(request)
      const eventId = String(body.id || '').trim()
      const event = String(body.event || '').trim().toUpperCase()
      const payment = body.payment || {}

      if (!eventId || !event || !payment.id) {
        response.status(400).json({ ok: false, error: 'invalid_payload' })
        return
      }

      let reference = getWebhookOrderReference(payment)

      if (!reference.orderId && payment.paymentLink) {
        const linkSnapshot = await db.collection('orders')
          .where('payment.providerPaymentLinkId', '==', payment.paymentLink)
          .limit(1)
          .get()
        if (!linkSnapshot.empty) {
          const orderDoc = linkSnapshot.docs[0]
          const orderData = orderDoc.data() || {}
          reference = {
            orderId: orderDoc.id,
            storeId: orderData.storeDocId || orderData.storeId || '',
          }
        }
      }

      const eventDocId = safeDocId(eventId)
      const eventRef = reference.orderId
        ? db.collection('orders').doc(reference.orderId).collection('paymentEvents').doc(eventDocId)
        : db.collection('providerEvents').doc(`asaas_order_${eventDocId}`)

      try {
        const result = await db.runTransaction(async (transaction) => {
          const eventSnapshot = await transaction.get(eventRef)
          const now = admin.firestore.Timestamp.now()

          if (eventSnapshot.exists && ['processed', 'ignored'].includes(eventSnapshot.data()?.status)) {
            return { duplicate: true }
          }

          const baseEvent = stripUndefinedDeep({
            provider: PROVIDER,
            scope: 'order_payment',
            eventId,
            event,
            paymentId: payment.id,
            paymentLinkId: payment.paymentLink || null,
            externalReference: payment.externalReference || null,
            receivedAt: eventSnapshot.exists ? eventSnapshot.data()?.receivedAt || now : now,
            raw: body,
          })

          if (!SUPPORTED_WEBHOOK_EVENTS.has(event)) {
            transaction.set(eventRef, { ...baseEvent, status: 'ignored', ignoreReason: 'unsupported_event', processedAt: now }, { merge: true })
            return { ignored: true, reason: 'unsupported_event' }
          }

          if (!reference.orderId) {
            transaction.set(eventRef, { ...baseEvent, status: 'ignored', ignoreReason: 'missing_order_reference', processedAt: now }, { merge: true })
            return { ignored: true, reason: 'missing_order_reference' }
          }

          const orderRef = db.collection('orders').doc(reference.orderId)
          const orderSnapshot = await transaction.get(orderRef)
          if (!orderSnapshot.exists) {
            transaction.set(eventRef, { ...baseEvent, status: 'ignored', ignoreReason: 'order_not_found', processedAt: now }, { merge: true })
            return { ignored: true, reason: 'order_not_found' }
          }

          const orderData = orderSnapshot.data() || {}
          if (orderData.payment?.provider !== PROVIDER || orderData.payment?.mode !== ONLINE_MODE) {
            transaction.set(eventRef, { ...baseEvent, status: 'ignored', ignoreReason: 'order_not_asaas_online', processedAt: now }, { merge: true })
            return { ignored: true, reason: 'order_not_asaas_online' }
          }

          const paymentStatus = mapAsaasOrderPaymentStatus(event)
          const releasePatch = await releaseScheduledSlotForOrderPaymentInTransaction({
            db,
            admin,
            transaction,
            orderRef,
            orderData,
            paymentStatus,
          })

          transaction.set(eventRef, { ...baseEvent, status: 'processed', processedAt: now }, { merge: true })
          transaction.set(orderRef, {
            ...buildWebhookPaymentPatch({ admin, event, payment, orderData }),
            ...releasePatch,
          }, { merge: true })

          return {
            processed: true,
            orderId: reference.orderId,
            storeId: orderData.storeDocId || orderData.storeId || reference.storeId || '',
            paymentStatus,
          }
        })

        if (result.processed && result.paymentStatus === 'paid' && typeof sendNewOrderPushToStore === 'function') {
          try {
            await sendNewOrderPushToStore({
              storeId: result.storeId || '',
              orderId: result.orderId,
            })
          } catch (pushError) {
            logger?.warn?.('[asaasOrders] paid order push failed', {
              orderId: result.orderId,
              storeId: result.storeId || '',
              error: pushError?.message || String(pushError),
            })
          }
        }

        if (result.processed && result.paymentStatus === 'paid' && payment.paymentLink) {
          try {
            await deactivateOrderPaymentLink({
              apiKey: getSecretValue(apiKeySecret, 'ASAAS_ORDERS_API_KEY'),
              paymentLinkId: payment.paymentLink,
            })
          } catch (deactivateError) {
            logger?.error?.('[asaasOrders] failed to deactivate paid payment link', {
              eventId,
              paymentLinkId: payment.paymentLink,
              error: deactivateError?.message || String(deactivateError),
            })
          }
        }

        response.status(200).json({ ok: true, ...result })
      } catch (error) {
        logger?.error?.('[asaasOrders] webhook failed', {
          eventId,
          event,
          error: error?.message || String(error),
        })
        response.status(500).json({ ok: false, error: 'webhook_processing_failed' })
      }
    }
  )

  return { createAsaasOrderPayment, asaasOrderWebhook }
}

module.exports = {
  BLOCKED_REASON,
  ONLINE_MODE,
  PROVIDER,
  buildAsaasOrderExternalReference,
  buildAsaasLinkCreationFailurePatch,
  buildAsaasPendingPaymentSnapshot,
  createAsaasOrderFunctions,
  createOrderPaymentLink,
  isAsaasOnlineActive,
  isAsaasOnlinePaymentRequest,
  mapAsaasOrderPaymentStatus,
  orderRequiresAsaasOnline,
  parseAsaasOrderExternalReference,
  sanitizePublicStorePayments,
}
