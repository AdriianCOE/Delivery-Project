const {
    onDocumentCreated,
    onDocumentWritten,
    onDocumentUpdated,
  } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onValueWritten } = require('firebase-functions/v2/database')
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const crypto = require('crypto')
const { createPublicOrderHandler } = require('./publicOrder')
const { createAsaasFunctions } = require('./asaas')
const { createMerchantOrderFunctions } = require('./merchantOrder')
const {
  createAsaasOrderFunctions,
  sanitizePublicStorePayments,
} = require('./shared/asaasOrders')
const {
  createMercadoPagoOrderFunctions,
} = require('./shared/mercadoPagoOrders')
const {
  disableCustomerOrderPushToken,
  registerCustomerOrderPushToken,
  sendCustomerOrderStatusPushToOrder,
  sendMerchantTestPushToStore,
  sendNewOrderPushToStore,
} = require('./fcmNotifications')
const {
  normalizeBrazilianPhone,
  validateBrazilianMobilePhone,
} = require('./shared/phone')
const {
  sanitizePublicProductScheduling,
  sanitizePublicStoreScheduling,
  sanitizeStoreScheduling,
} = require('./shared/publicScheduling')
const {
  createStoreTableHandler,
  updateStoreTableHandler,
  archiveStoreTableHandler,
} = require('./storeTables')
const {
  getEffectivePlan,
  getStorePlanLimit,
  hasPlanFeature,
} = require('./shared/planAccess')

const {
  BREVO_API_KEY,
  BREVO_TEMPLATES,
  sendBrevoTransactionalEmail,
  firstNameFrom,
  formatDatePtBr,
  safeEmail,
  getPublicAppBaseUrl,
  getSupportWhatsappUrl,
} = require('./brevo')

const { setGlobalOptions } = require('firebase-functions/v2')

setGlobalOptions({
  region: 'southamerica-east1',
  minInstances: 0,
  maxInstances: 3,
  cpu: 'gcf_gen1'
})

admin.initializeApp()

const db = admin.firestore()
const asaasFunctions = createAsaasFunctions({ db, admin, logger })
const REGION = 'southamerica-east1'
const CLOUDINARY_CLOUD_NAME = defineSecret('CLOUDINARY_CLOUD_NAME')
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY')
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET')
const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY')
const ASAAS_ORDERS_API_KEY = defineSecret('ASAAS_ORDERS_API_KEY')
const ASAAS_ORDERS_WEBHOOK_SECRET = defineSecret('ASAAS_ORDERS_WEBHOOK_SECRET')
const MERCADOPAGO_ACCESS_TOKEN_TEST = defineSecret('MERCADOPAGO_ACCESS_TOKEN_TEST')
const MERCADOPAGO_ACCESS_TOKEN_PROD = defineSecret('MERCADOPAGO_ACCESS_TOKEN_PROD')
const MERCADOPAGO_CLIENT_ID = defineSecret('MERCADOPAGO_CLIENT_ID')
const MERCADOPAGO_CLIENT_SECRET = defineSecret('MERCADOPAGO_CLIENT_SECRET')
const MERCADOPAGO_WEBHOOK_SECRET = defineSecret('MERCADOPAGO_WEBHOOK_SECRET')
const ENFORCE_APP_CHECK = String(process.env.ENFORCE_APP_CHECK || '').toLowerCase() === 'true'
const LEGAL_CONFIG_COLLECTION = 'config'
const LEGAL_CONFIG_DOC = 'legal'
const TRIAL_ENTITLEMENTS_PLAN = 'premium'
const BILLING_PENDING_PAYMENT_METHOD_STATUS = 'billing_pending_payment_method'
const merchantOrderFunctions = createMerchantOrderFunctions({
  db,
  admin,
  HttpsError,
  logger,
  region: REGION,
  sendCustomerOrderStatusPushToOrder: ({ orderId, status, orderData }) => sendCustomerOrderStatusPushToOrder({
    db,
    admin,
    logger,
    orderId,
    status,
    orderData,
  }),
})
const asaasOrderFunctions = createAsaasOrderFunctions({
  db,
  admin,
  HttpsError,
  logger,
  region: REGION,
  apiKeySecret: ASAAS_ORDERS_API_KEY,
  webhookSecret: ASAAS_ORDERS_WEBHOOK_SECRET,
  sendNewOrderPushToStore: ({ storeId, orderId }) => sendNewOrderPushToStore({
    db,
    admin,
    logger,
    storeId,
    orderId,
  }),
})
const mercadoPagoOrderFunctions = createMercadoPagoOrderFunctions({
  db,
  admin,
  HttpsError,
  logger,
  region: REGION,
  accessTokenTestSecret: MERCADOPAGO_ACCESS_TOKEN_TEST,
  accessTokenProdSecret: MERCADOPAGO_ACCESS_TOKEN_PROD,
  clientIdSecret: MERCADOPAGO_CLIENT_ID,
  clientSecretSecret: MERCADOPAGO_CLIENT_SECRET,
  webhookSecret: MERCADOPAGO_WEBHOOK_SECRET,
  sendNewOrderPushToStore: ({ storeId, orderId }) => sendNewOrderPushToStore({
    db,
    admin,
    logger,
    storeId,
    orderId,
  }),
})

if (!ENFORCE_APP_CHECK && process.env.FUNCTIONS_EMULATOR !== 'true') {
  logger.warn('[appCheck] Public callables are running without App Check enforcement. Use monitor mode first, then set ENFORCE_APP_CHECK=true after validating public store, coupon and order flows.')
}

function normalizeLegalVersion(value) {
  const version = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(version) ? version : ''
}

async function getLatestLegalVersions() {
  const snapshot = await db.collection(LEGAL_CONFIG_COLLECTION).doc(LEGAL_CONFIG_DOC).get()
  const data = snapshot.exists ? snapshot.data() || {} : {}
  const termsVersion = normalizeLegalVersion(data.termsVersion)
  const privacyVersion = normalizeLegalVersion(data.privacyVersion)

  if (!termsVersion || !privacyVersion) {
    logger.error('[legal] config/legal is missing valid termsVersion/privacyVersion.')
    throw new HttpsError(
      'failed-precondition',
      'Versao vigente dos termos nao configurada.'
    )
  }

  return { termsVersion, privacyVersion }
}

function sanitizePublicTrackingOrderId(value) {
  const orderId = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(orderId)) {
    throw new HttpsError('invalid-argument', 'Pedido invalido.')
  }
  return orderId
}

function normalizePublicOrderStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()
  return {
    pronto: 'pronto',
    ready: 'pronto',
    em_rota: 'em_rota',
    entregando: 'em_rota',
    out_for_delivery: 'em_rota',
    entregue: 'entregue',
    delivered: 'entregue',
    cancelado: 'cancelado',
    canceled: 'cancelado',
  }[value] || value || 'pendente'
}

function uniquePublicOrderKeys(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getPublicOrderStoreKeys(orderData) {
  return uniquePublicOrderKeys([
    orderData?.storeId,
    orderData?.storeSlug,
    orderData?.storeDocId,
    ...(Array.isArray(orderData?.storeKeys) ? orderData.storeKeys : []),
  ])
}

function getPublicOrderCustomerName(orderData) {
  return String(
    orderData?.customer?.name ||
      orderData?.customerName ||
      orderData?.clientName ||
      ''
  ).trim()
}

function getPublicOrderCustomerPhone(orderData) {
  return String(
    orderData?.customer?.phone ||
      orderData?.customerPhone ||
      orderData?.phone ||
      ''
  ).trim()
}

function assertPublicTrackingAccess(orderId, trackingToken, orderData) {
  const expectedToken = String(orderData?.trackingToken || '').trim()
  const providedToken = String(trackingToken || '').trim()

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    throw new HttpsError('permission-denied', 'Link de acompanhamento invalido.')
  }
}

function isManualPixPublicOrder(orderData) {
  const method = String(
    orderData?.payment?.method ||
      orderData?.paymentMethod ||
      orderData?.paymentType ||
      ''
  ).toLowerCase().trim()

  return ['pix', 'pix_manual', 'manual_pix', 'pix_manual_store'].includes(method)
}

function sanitizeReviewRating(value, fieldName) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpsError('invalid-argument', `${fieldName} invalida.`)
  }
  return rating
}

function sanitizeReviewTags(tags) {
  if (!Array.isArray(tags)) return []

  return uniquePublicOrderKeys(tags)
    .map((tag) => tag.slice(0, 60))
    .slice(0, 8)
}

async function writePublicOrderAudit(action, orderId, orderData, changedFields) {
  await db.collection('auditLogs').add({
    action,
    entity: 'order',
    entityId: orderId,
    storeId: orderData.storeId || orderData.storeDocId || '',
    storeSlug: orderData.storeSlug || '',
    actorUid: null,
    changedFields,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'tracking_callable',
  })
}

exports.startAsaasSubscription = asaasFunctions.startAsaasSubscription
exports.getSubscriptionManagementData = asaasFunctions.getSubscriptionManagementData
exports.changeSubscriptionPlan = asaasFunctions.changeSubscriptionPlan
exports.cancelSubscription = asaasFunctions.cancelSubscription
exports.reactivateTrialContinuation = asaasFunctions.reactivateTrialContinuation
exports.requestSubscriptionDueDateChange = asaasFunctions.requestSubscriptionDueDateChange
exports.syncAsaasSubscriptionStatus = asaasFunctions.syncAsaasSubscriptionStatus
exports.createPaymentMethodUpdateCheckout = asaasFunctions.createPaymentMethodUpdateCheckout
exports.asaasWebhook = asaasFunctions.asaasWebhook
exports.adminUpdateSubscriptionRequestStatus = asaasFunctions.adminUpdateSubscriptionRequestStatus
exports.updateMerchantOrder = merchantOrderFunctions.updateMerchantOrder
exports.createMerchantCounterOrder = merchantOrderFunctions.createMerchantCounterOrder
exports.createAsaasOrderPayment = asaasOrderFunctions.createAsaasOrderPayment
exports.asaasOrderWebhook = asaasOrderFunctions.asaasOrderWebhook
exports.getMercadoPagoConnectUrl = mercadoPagoOrderFunctions.getMercadoPagoConnectUrl
exports.mercadoPagoOAuthCallback = mercadoPagoOrderFunctions.mercadoPagoOAuthCallback
exports.disconnectMercadoPago = mercadoPagoOrderFunctions.disconnectMercadoPago
exports.createMercadoPagoOrderPayment = mercadoPagoOrderFunctions.createMercadoPagoOrderPayment
exports.mercadoPagoOrderWebhook = mercadoPagoOrderFunctions.mercadoPagoOrderWebhook

exports.createPublicOrder = onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 10,
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [ASAAS_ORDERS_API_KEY, MERCADOPAGO_ACCESS_TOKEN_TEST, MERCADOPAGO_ACCESS_TOKEN_PROD],
  },
  createPublicOrderHandler({
    db,
    admin,
    HttpsError,
    logger,
    maxOrderCents: 100000000,
    sendNewOrderPushToStore: ({ storeId, orderId }) => sendNewOrderPushToStore({
      db,
      admin,
      logger,
      storeId,
      orderId,
    }),
    createAsaasOrderPaymentLink: () => {
      try {
        return ASAAS_ORDERS_API_KEY.value() || process.env.ASAAS_ORDERS_API_KEY || ''
      } catch {
        return process.env.ASAAS_ORDERS_API_KEY || ''
      }
    },
    mercadoPagoAccessTokenTestSecret: MERCADOPAGO_ACCESS_TOKEN_TEST,
    mercadoPagoAccessTokenProdSecret: MERCADOPAGO_ACCESS_TOKEN_PROD,
  })
)

const BILLING_BLOCKED_PUBLIC_STATUSES = new Set([
  'blocked',
  'canceled',
  'checkout_pending',
  'pending_checkout',
  'billing_pending',
  'billing_pending_payment_method',
])
const BILLING_PUBLICLY_READABLE_STATUSES = new Set(['trialing', 'active', 'past_due'])
const PUBLIC_CALLABLE_CORS_ORIGINS = [
  'https://pratoby.com',
  'https://www.pratoby.com',
  'https://borapedir-f529a.web.app',
  'https://borapedir-f529a.firebaseapp.com',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
]
const PUBLIC_CALLABLE_OPTIONS = {
  region: REGION,
  cors: PUBLIC_CALLABLE_CORS_ORIGINS,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 10,
  enforceAppCheck: ENFORCE_APP_CHECK,
}
const PUBLIC_STORE_PROFILE_CALLABLE_OPTIONS = {
  ...PUBLIC_CALLABLE_OPTIONS,
  invoker: 'public',
}
const PUBLIC_READ_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const PUBLIC_READ_RATE_LIMITS = {
  getPublicStoreProfile: 120,
  getPublicCatalog: 120,
  validatePublicCoupon: 30,
  confirmCustomerDelivery: 20,
  markCustomerPixProofSent: 20,
  requestCustomerOrderCancellation: 20,
  submitPublicOrderReview: 20,
  registerCustomerOrderPushToken: 20,
  disableCustomerOrderPushToken: 20,
}

exports.registerCustomerOrderPushToken = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('registerCustomerOrderPushToken', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken

  return registerCustomerOrderPushToken({
    db,
    admin,
    HttpsError,
    logger,
    orderId,
    trackingToken,
    token: request.data?.token,
    platform: request.data?.platform,
    userAgent: request.data?.userAgent,
  })
})

exports.disableCustomerOrderPushToken = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('disableCustomerOrderPushToken', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken

  return disableCustomerOrderPushToken({
    db,
    admin,
    HttpsError,
    logger,
    orderId,
    trackingToken,
    token: request.data?.token,
    tokenHash: request.data?.tokenHash,
  })
})

exports.sendMerchantTestPush = onCall(
  {
    region: REGION,
    timeoutSeconds: 15,
    memory: '256MiB',
    maxInstances: 10,
  },
  async (request) => {
    const uid = assertNonAnonymousDashboardUser(request)
    const storeId = String(request.data?.storeId || '').trim()

    if (!storeId) {
      throw new HttpsError('invalid-argument', 'Loja obrigatoria.')
    }

    const [userSnapshot, storeSnapshot] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('stores').doc(storeId).get(),
    ])

    if (!userSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Usuario nao encontrado.')
    }

    if (!storeSnapshot.exists) {
      throw new HttpsError('not-found', 'Loja nao encontrada.')
    }

    assertStoreOwnerOrAdmin(storeSnapshot.data() || {}, uid, userSnapshot.data() || {})

    return sendMerchantTestPushToStore({
      db,
      admin,
      logger,
      storeId,
    })
  }
)

exports.confirmCustomerDelivery = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('confirmCustomerDelivery', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken
  const orderRef = db.collection('orders').doc(orderId)

  const result = await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef)
    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', 'Pedido nao encontrado.')
    }

    const orderData = orderSnapshot.data() || {}
    assertPublicTrackingAccess(orderId, trackingToken, orderData)

    const currentStatus = normalizePublicOrderStatus(orderData.status)
    if (!['pronto', 'em_rota'].includes(currentStatus)) {
      throw new HttpsError('failed-precondition', 'Pedido ainda nao pode ser confirmado como entregue.')
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const patch = {
      status: 'entregue',
      deliveredAt: now,
      customerConfirmedDeliveryAt: now,
      updatedAt: now,
    }

    transaction.update(orderRef, patch)

    return { orderData, changedFields: Object.keys(patch) }
  })

  await writePublicOrderAudit('customer_confirm_delivery', orderId, result.orderData, result.changedFields)

  return { ok: true, orderId, status: 'entregue' }
})

exports.markCustomerPixProofSent = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('markCustomerPixProofSent', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken
  const orderRef = db.collection('orders').doc(orderId)

  const result = await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef)
    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', 'Pedido nao encontrado.')
    }

    const orderData = orderSnapshot.data() || {}
    assertPublicTrackingAccess(orderId, trackingToken, orderData)

    if (['entregue', 'cancelado'].includes(normalizePublicOrderStatus(orderData.status))) {
      throw new HttpsError('failed-precondition', 'Pedido finalizado nao pode receber comprovante.')
    }

    if (!isManualPixPublicOrder(orderData)) {
      throw new HttpsError('failed-precondition', 'Este pedido não usa Pix com comprovante.')
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const patch = {
      'payment.proofSentAt': now,
      'payment.proofSource': 'whatsapp',
      'payment.proofWhatsappOpened': true,
      paymentProofRequestedAt: now,
      updatedAt: now,
    }

    transaction.update(orderRef, patch)

    return { orderData, changedFields: Object.keys(patch) }
  })

  await writePublicOrderAudit('customer_pix_proof_sent', orderId, result.orderData, result.changedFields)

  return { ok: true, orderId }
})

exports.requestCustomerOrderCancellation = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('requestCustomerOrderCancellation', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken
  const orderRef = db.collection('orders').doc(orderId)

  const result = await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef)
    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', 'Pedido nao encontrado.')
    }

    const orderData = orderSnapshot.data() || {}
    assertPublicTrackingAccess(orderId, trackingToken, orderData)

    if (['entregue', 'cancelado'].includes(normalizePublicOrderStatus(orderData.status))) {
      throw new HttpsError('failed-precondition', 'Pedido finalizado nao pode receber solicitacao de cancelamento.')
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const patch = {
      customerCancelRequested: true,
      customerCancelRequestedAt: now,
      cancelRequestSource: 'tracking',
      updatedAt: now,
    }

    transaction.update(orderRef, patch)

    return { orderData, changedFields: Object.keys(patch) }
  })

  await writePublicOrderAudit('customer_cancel_requested', orderId, result.orderData, result.changedFields)

  return { ok: true, orderId }
})

exports.submitPublicOrderReview = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
  await assertPublicCallableRateLimit('submitPublicOrderReview', request)

  const orderId = sanitizePublicTrackingOrderId(request.data?.orderId)
  const trackingToken = request.data?.trackingToken
  const reviewInput = request.data?.review || {}
  const orderRef = db.collection('orders').doc(orderId)
  const reviewRef = db.collection('reviews').doc(orderId)

  const rating = sanitizeReviewRating(reviewInput.rating, 'Nota geral')
  const foodRating = sanitizeReviewRating(reviewInput.foodRating, 'Nota da comida')
  const deliveryRating = sanitizeReviewRating(reviewInput.deliveryRating, 'Nota da entrega')
  const serviceRating = sanitizeReviewRating(reviewInput.serviceRating, 'Nota do atendimento')
  const tags = sanitizeReviewTags(reviewInput.tags)
  const comment = String(reviewInput.comment || '').trim().slice(0, 1000)

  const result = await db.runTransaction(async (transaction) => {
    const [orderSnapshot, reviewSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(reviewRef),
    ])

    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', 'Pedido nao encontrado.')
    }

    if (reviewSnapshot.exists) {
      throw new HttpsError('already-exists', 'Esse pedido ja foi avaliado.')
    }

    const orderData = orderSnapshot.data() || {}
    assertPublicTrackingAccess(orderId, trackingToken, orderData)

    if (normalizePublicOrderStatus(orderData.status) !== 'entregue') {
      throw new HttpsError('failed-precondition', 'A avaliacao so fica disponivel apos a entrega.')
    }

    if (orderData.review?.submitted || orderData.reviewId) {
      throw new HttpsError('already-exists', 'Esse pedido ja foi avaliado.')
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const finalStoreId = orderData.storeId || orderData.storeDocId || orderData.storeSlug || ''
    const finalStoreSlug = orderData.storeSlug || orderData.storePublicId || orderData.storeId || ''
    const reviewPayload = {
      storeId: finalStoreId,
      storeSlug: finalStoreSlug,
      storeDocId: orderData.storeDocId || orderData.storeId || null,
      storeKeys: getPublicOrderStoreKeys(orderData),
      orderId,
      trackingToken: orderData.trackingToken || null,
      customerName: getPublicOrderCustomerName(orderData),
      customerPhone: getPublicOrderCustomerPhone(orderData),
      rating,
      foodRating,
      deliveryRating,
      serviceRating,
      wouldOrderAgain: Boolean(reviewInput.wouldOrderAgain),
      tags,
      comment,
      isPublic: false,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    }
    const orderPatch = {
      reviewId: orderId,
      review: {
        submitted: true,
        rating,
        submittedAt: now,
      },
      updatedAt: now,
    }

    transaction.set(reviewRef, reviewPayload)
    transaction.update(orderRef, orderPatch)

    return { orderData, changedFields: ['reviewId', 'review', 'updatedAt'] }
  })

  await writePublicOrderAudit('customer_review_submitted', orderId, result.orderData, result.changedFields)

  return { ok: true, orderId, reviewId: orderId }
})

const PUBLIC_STORE_FIELDS = [
  'name', 'storeName', 'description', 'publicDescription', 'segment', 'category',
  'logoUrl', 'logo', 'bannerPosition', 'bannerUrl', 'bannerMobileUrl', 'shareImageUrl', 'seoImageUrl', 'ogImageUrl', 'faviconUrl', 'coverUrl', 'mobileBannerUrl',
  'seoTitle', 'seoDescription', 'seoIndexingEnabled', 'allowSearchIndexing', 'isIndexable', 'searchIndexingEnabled',
  'themeColor', 'primaryColor', 'brandColor', 'whatsapp', 'phone', 'contactPhone',
  'instagram', 'social', 'isOpen', 'isActive', 'activeDays', 'hoursOpen', 'hoursClose',
  'isPublic', 'isVisible',
  'openingHours', 'businessHours', 'hours', 'settings', 'deliveryTime', 'estimatedDeliveryTime',
  'minOrder', 'minOrderCents', 'minimumOrder', 'minimumOrderCents', 'deliveryFee',
  'deliveryFeeCents', 'deliveryFees', 'acceptDelivery', 'acceptPickup', 'acceptDineIn',
  'paymentMethods', 'pix', 'pixKey', 'pixKeyType', 'address', 'cep', 'street', 'number',
  'neighborhood', 'city', 'state', 'rating', 'promoBanner', 'promotionBanner',
  'marketingBanner', 'adBanner', 'promoBanners', 'banners', 'publicScheduling',
]

const PUBLIC_CATEGORY_FIELDS = [
  'name', 'description', 'order', 'sortOrder', 'position', 'slug', 'icon', 'imageUrl',
  'isActive', 'active', 'isVisible', 'visible', 'isDeleted', 'deletedAt',
]

const PUBLIC_PRODUCT_FIELDS = [
  'name', 'description', 'price', 'priceCents', 'priceInCents', 'oldPrice', 'oldPriceCents',
  'imageUrl', 'image', 'photoUrl', 'coverUrl', 'thumbnailUrl', 'images', 'imageUrls', 'gallery', 'categoryId', 'category',
  'categoryName', 'order', 'sortOrder', 'position', 'isActive', 'active', 'isVisible',
  'visible', 'isDeleted', 'deletedAt', 'isAvailable', 'available', 'status',
  'showInStorefront', 'acceptsCoupons', 'acceptsCoupon', 'couponEligible', 'showCouponBadge', 'isFeatured',
  'isPopular', 'isPromotion', 'isPromotional',
  'promotion', 'extras', 'addons', 'optionGroups', 'additionalOptions', 'variations',
  'unit', 'tags', 'availableDays', 'availability', 'stock', 'preparationTime', 'serving',
  'visualBadges', 'scheduling',
]

const STORE_SETTINGS_ALLOWED_FIELDS = new Set([
  'name', 'storeName', 'description', 'segment', 'category',
  'logoUrl', 'bannerUrl', 'bannerMobileUrl', 'shareImageUrl', 'seoImageUrl', 'ogImageUrl', 'faviconUrl', 'themeColor', 'whatsapp', 'whatsapp1',
  'phone', 'instagram', 'social', 'isOpen', 'isActive', 'activeDays',
  'newOrderSoundEnabled', 'printAfterConfirm', 'autoCloseEnabled', 'autoCloseGraceMinutes',
  'hoursOpen', 'hoursClose', 'openingHours', 'settings', 'deliveryTime',
  'minOrder', 'minOrderCents', 'acceptDelivery', 'acceptPickup',
  'acceptDineIn', 'paymentMethods', 'pix', 'address', 'cep', 'street',
  'number', 'neighborhood', 'complement', 'city', 'state', 'scheduling',
  'payments',
])

const STORE_SETTINGS_FORBIDDEN_FIELDS = new Set([
  'ownerId', 'ownerUid', 'owner', 'ownerEmail', 'ownerName',
  'role', 'allowedUserIds', 'merchantUids',
  'subscriptionStatus', 'subscription', 'billingProvider', 'billingCycle',
  'plan', 'trialStartedAt', 'trialEndsAt', 'currentPeriodEnd',
  'isBillingBlocked', 'asaasCustomerId', 'asaasSubscriptionId',
  'asaasPaymentId', 'asaasCheckoutUrl', 'billingMethodConfigured',
  'lastPaymentId', 'lastPaymentStatus',
  'accountId', 'walletId', 'asaasAccountId', 'asaasWalletId',
  'apiKey', 'apiToken', 'accessToken', 'webhookSecret', 'clientSecret',
  'secretKey', 'privateKey',
  'createdAt', 'createdBy', 'deletedAt', 'isDeleted',
])

const STORE_ACTIVE_ORDER_STATUSES = [
  'pendente', 'pending', 'novo', 'new', 'received', 'recebido', 'aguardando',
  'aguardando_confirmacao', 'awaiting_confirmation',
  'confirmado', 'confirmed', 'aceito', 'accepted',
  'preparando', 'preparing', 'em_preparo', 'preparo', 'in_preparation', 'in_progress',
  'pronto', 'pronta', 'ready', 'ready_for_pickup', 'aguardando_retirada',
  'em_rota', 'out_for_delivery', 'entregando', 'saiu_para_entrega', 'saiu_entrega', 'em_entrega',
]

const STORE_OPERATION_MODES = new Set(['manual', 'opening_hours'])

const STORE_OPERATIONAL_SETTINGS_ALLOWED_FIELDS = new Set([
  'availabilityMode',
  'operatingMode',
  'timeZone',
  'temporaryPauseUntil',
  'temporaryPauseReason',
  'allowScheduledOrdersWhenClosed',
])

function uniqueTruthy(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function slugifyPublicStoreName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function normalizePublicStoreLookupParam(value) {
  return slugifyPublicStoreName(String(value || '').trim().replace(/^\/+|\/+$/g, ''))
}

function getCanonicalStoreId(storeId, data = {}) {
  return String(data.storeDocId || data.docId || data.storeId || storeId || '').trim()
}

function getPublicStoreSlug(storeId, data = {}) {
  return String(
    data.storeSlug ||
      data.slug ||
      slugifyPublicStoreName(data.storeName || data.name) ||
      storeId ||
      ''
  ).trim()
}

function buildPublicStoreKeys(storeId, data = {}, storeSlug = '') {
  return uniqueTruthy([
    storeId,
    data.storeId,
    data.storeDocId,
    data.docId,
    storeSlug,
    data.storeSlug,
    data.slug,
    ...(Array.isArray(data.storeKeys) ? data.storeKeys : []),
  ]).slice(0, 30)
}

function buildPublicStoreProfile(storeId, data = {}, source = 'publicStores') {
  const canonicalStoreId = getCanonicalStoreId(storeId, data)
  const storeSlug = getPublicStoreSlug(canonicalStoreId || storeId, data)
  const publicData = sanitizePublicStore(data)

  return {
    ...publicData,
    id: canonicalStoreId || storeId,
    docId: canonicalStoreId || storeId,
    storeId: canonicalStoreId || storeId,
    storeDocId: canonicalStoreId || storeId,
    storeSlug,
    slug: data.slug || storeSlug,
    storeKeys: buildPublicStoreKeys(canonicalStoreId || storeId, data, storeSlug),
    publicDataSource: source,
    isOpen: data.isOpen !== false,
    isActive: data.isActive !== false,
    isBlocked: data.isBlocked === true,
    isBillingBlocked: data.isBillingBlocked === true,
    isDeleted: data.isDeleted === true,
  }
}

function timestampToMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value.seconds) return Number(value.seconds) * 1000
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function getCallableIp(request) {
  return String(
    request.ip ||
      request.rawRequest?.ip ||
      request.rawRequest?.headers?.['x-forwarded-for'] ||
      request.rawRequest?.headers?.['fastly-client-ip'] ||
      'unknown'
  ).split(',')[0].trim() || 'unknown'
}


function buildPublicRateLimitId(operation, request) {
  const ip = getCallableIp(request)
  const hash = crypto
    .createHash('sha256')
    .update(`${operation}:${ip}`)
    .digest('hex')
  return `publicCallable_${operation}_${hash}`
}

async function assertPublicCallableRateLimit(operation, request) {
  const limit = PUBLIC_READ_RATE_LIMITS[operation] || 60
  const now = admin.firestore.Timestamp.now()
  const nowMs = now.toMillis()
  const rateLimitRef = db.collection('rateLimits').doc(buildPublicRateLimitId(operation, request))

  await db.runTransaction(async (transaction) => {
    const rateLimitDoc = await transaction.get(rateLimitRef)
    const data = rateLimitDoc.exists ? rateLimitDoc.data() || {} : {}
    const windowStartMs = data.windowStart?.toMillis ? data.windowStart.toMillis() : 0
    const shouldReset = !windowStartMs || nowMs - windowStartMs >= PUBLIC_READ_RATE_LIMIT_WINDOW_MS
    const count = shouldReset ? 0 : Number(data.count || 0)

    if (count >= limit) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
    }

    transaction.set(rateLimitRef, {
      provider: 'pratoby',
      type: 'public_callable',
      operation,
      count: count + 1,
      limit,
      windowStart: shouldReset ? now : data.windowStart || now,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + PUBLIC_READ_RATE_LIMIT_WINDOW_MS),
      updatedAt: now,
    }, { merge: true })
  })
}

function cleanCallableFirestoreValue(value, depth = 0) {
  if (value === undefined || typeof value === 'function') return undefined
  if (value === null) return null
  if (typeof value === 'string') return value.trim().slice(0, 5000)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value)
  if (typeof value.toDate === 'function' || typeof value.toMillis === 'function') return value

  if (Array.isArray(value)) {
    return value
      .slice(0, 200)
      .map((item) => cleanCallableFirestoreValue(item, depth + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    if (depth > 8) return undefined
    return Object.entries(value).reduce((acc, [key, entry]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return acc
      const cleanValue = cleanCallableFirestoreValue(entry, depth + 1)
      if (cleanValue !== undefined) acc[key] = cleanValue
      return acc
    }, {})
  }

  return undefined
}

function pickPublicFields(data, fields) {
  return fields.reduce((acc, field) => {
    const cleanValue = cleanCallableFirestoreValue(data?.[field])
    if (cleanValue !== undefined) acc[field] = cleanValue
    return acc
  }, {})
}

function normalizeStorePayload(storeId, data, source = 'publicStores') {
  return buildPublicStoreProfile(storeId, data, source)
}

function isStorePubliclyReadable(data) {
  if (!data) return false
  if (data.isDeleted === true || data.deletedAt) return false
  if (data.isActive === false || data.isBlocked === true || data.isBillingBlocked === true) return false
  const subscriptionStatus = String(data.subscriptionStatus || data.subscription?.status || '').trim()
  if (!subscriptionStatus) return true
  if (BILLING_BLOCKED_PUBLIC_STATUSES.has(subscriptionStatus)) return false
  return BILLING_PUBLICLY_READABLE_STATUSES.has(subscriptionStatus)
}

function isPublicStoreVisible(data) {
  return isStorePubliclyReadable(data)
}

function sanitizePublicStore(data) {
  if (!data) return {}

  const profile = pickPublicFields(data, PUBLIC_STORE_FIELDS)

  delete profile.pix
  delete profile.pixKey
  delete profile.pixKeyType
  delete profile.settings

  if (data.address && typeof data.address === 'object') {
    profile.address = {
      street: String(data.address.street || '').trim().slice(0, 120),
      number: String(data.address.number || '').trim().slice(0, 20),
      neighborhood: String(data.address.neighborhood || '').trim().slice(0, 80),
      city: String(data.address.city || '').trim().slice(0, 80),
      state: String(data.address.state || '').toUpperCase().trim().slice(0, 2),
      cep: String(data.address.cep || '').trim().slice(0, 10),
    }
  } else {
    profile.address = {
      street: String(data.street || '').trim().slice(0, 120),
      number: String(data.number || '').trim().slice(0, 20),
      neighborhood: String(data.neighborhood || '').trim().slice(0, 80),
      city: String(data.city || '').trim().slice(0, 80),
      state: String(data.state || '').toUpperCase().trim().slice(0, 2),
      cep: String(data.cep || '').trim().slice(0, 10),
    }
  }

  profile.whatsapp = String(data.whatsapp || data.phone || data.contactPhone || '').trim().slice(0, 30)
  profile.phone = String(data.phone || data.contactPhone || '').trim().slice(0, 30)

  const settings = data.settings || {}
  profile.settings = {
    themeColor: String(settings.themeColor || data.themeColor || '').trim().slice(0, 30),
    primaryColor: String(settings.primaryColor || data.primaryColor || '').trim().slice(0, 30),
    openingHours: settings.openingHours || data.openingHours || null,
    businessHours: settings.businessHours || data.businessHours || null,
    availabilityMode: String(settings.availabilityMode || data.availabilityMode || 'manual').trim().slice(0, 30),
    operatingMode: String(settings.operatingMode || settings.availabilityMode || data.operatingMode || '').trim().slice(0, 30),
    timeZone: String(settings.timeZone || data.timeZone || 'America/Sao_Paulo').trim().slice(0, 80),
    temporaryPauseUntil: settings.temporaryPauseUntil || data.temporaryPauseUntil || null,
    temporaryPauseReason: String(settings.temporaryPauseReason || data.temporaryPauseReason || '').trim().slice(0, 120),
    allowScheduledOrdersWhenClosed: settings.allowScheduledOrdersWhenClosed === true || data.allowScheduledOrdersWhenClosed === true,
    acceptDelivery: settings.acceptDelivery !== false && data.acceptDelivery !== false,
    acceptPickup: settings.acceptPickup !== false && data.acceptPickup !== false,
    acceptDineIn: settings.acceptDineIn !== false && data.acceptDineIn !== false,
    deliveryTime: String(settings.deliveryTime || data.deliveryTime || '').trim().slice(0, 50),
  }

  const pix = data.pix || {}
  const settingsPix = data.paymentSettings?.pix || {}
  const hasPixKey = Boolean(pix.key || settingsPix.key || data.pixKey)
  profile.pix = {
    enabled: pix.enabled === true || settingsPix.enabled === true || hasPixKey
  }
  profile.payments = sanitizePublicStorePayments(data)
  profile.publicScheduling = hasPlanFeature(data, 'scheduling')
    ? sanitizePublicStoreScheduling(data)
    : null

  return profile
}

function publicProductIsVisible(data) {
  return isPublicItemVisible(data)
}

const PUBLIC_VISUAL_BADGE_LABELS = {
  artesanal: 'Artesanal',
  caseiro: 'Caseiro',
  feito_na_hora: 'Feito na hora',
  especial_da_casa: 'Especial da casa',
  cremoso: 'Cremoso',
  saboroso: 'Saboroso',
  para_compartilhar: 'Para compartilhar',
  acompanhamento: 'Acompanhamento',
  novidade: 'Novidade',
  edicao_limitada: 'Edição limitada',
  premium: 'Premium',
}

function normalizePublicVisualBadgeId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sanitizePublicProductServing(value, data = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const legacy = data.serves ?? data.portion
  const countNumber = Number(raw.count ?? (Number.isFinite(Number(legacy)) ? legacy : null))
  const count = Number.isFinite(countNumber) && countNumber > 0
    ? Math.min(999, Math.floor(countNumber))
    : null
  const label = String(raw.label || (!count && legacy ? legacy : '') || '').trim().slice(0, 40)
  const userExplicitlyDisabled = raw.enabled === false
  const enabled = !userExplicitlyDisabled && (raw.enabled === true || Boolean(label || count))

  return {
    enabled,
    label: enabled ? label : '',
    count: enabled ? count : null,
  }
}

function normalizePublicProductCouponFlag(data = {}) {
  if (data.acceptsCoupons !== undefined) return data.acceptsCoupons !== false
  if (data.acceptsCoupon !== undefined) return data.acceptsCoupon !== false
  if (data.couponEligible !== undefined) return data.couponEligible !== false
  return true
}

function sanitizePublicProductVisualBadges(value) {
  const raw = Array.isArray(value) ? value : []
  return [...new Set(raw.map((badge) => normalizePublicVisualBadgeId(badge?.id || badge)))]
    .filter((id) => PUBLIC_VISUAL_BADGE_LABELS[id])
    .slice(0, 5)
    .map((id) => ({
      id,
      label: PUBLIC_VISUAL_BADGE_LABELS[id],
    }))
}

function sanitizePublicText(value, maxLength = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function sanitizePublicInteger(value, fallback = 0, min = 0, max = 100000000) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function parsePublicMoneyToCents(value) {
  if (value === undefined || value === null || value === '') return 0

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100)
  }

  let cleaned = String(value || '').trim().replace(/[^\d,.-]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return 0

  return Math.round(parsed * 100)
}

function sanitizePublicPriceFields(value = {}) {
  const rawCents = value.priceCents ?? value.unitPriceCents ?? value.priceInCents

  const fallbackCents = parsePublicMoneyToCents(
    value.price ?? value.unitPrice ?? value.value ?? 0
  )

  const priceCents = sanitizePublicInteger(
    rawCents !== undefined && rawCents !== null && rawCents !== ''
      ? rawCents
      : fallbackCents,
    0,
    0,
    MAX_ORDER_CENTS
  )

  return {
    price: priceCents / 100,
    priceCents,
    unitPrice: priceCents / 100,
    unitPriceCents: priceCents,
  }
}

function sanitizePublicOption(option, index) {
  const name = sanitizePublicText(option?.name || option?.title, 120)
  if (!name) return null

  const id = sanitizePublicText(
    option?.id || option?.optionId || option?.extraId || option?.addonId || option?.name || `option-${index}`,
    80
  )
  const price = sanitizePublicPriceFields(option)

  return {
    id,
    optionId: id,
    name,
    title: name,
    description: sanitizePublicText(option?.description || option?.details || option?.subtitle, 240),
    ...price,
    available: option?.available !== false && option?.isAvailable !== false,
    isAvailable: option?.available !== false && option?.isAvailable !== false,
  }
}

function sanitizePublicOptionGroups(value) {
  const rawGroups = Array.isArray(value) ? value : []

  return rawGroups
    .slice(0, 30)
    .map((group, groupIndex) => {
      const title = sanitizePublicText(group?.title || group?.name, 120)
      if (!title) return null

      const rawType = String(group?.type || '').toLowerCase()
      const allowQuantity = group?.allowQuantity === true || group?.quantityEnabled === true || rawType === 'quantity' || rawType === 'qty'
      const type = ['single', 'multiple', 'quantity'].includes(rawType)
        ? rawType
        : allowQuantity
          ? 'quantity'
          : 'multiple'
      const required = Boolean(group?.required || group?.isRequired)
      const min = sanitizePublicInteger(group?.min ?? group?.minSelections ?? (required ? 1 : 0), required ? 1 : 0, 0, 99)
      const max = type === 'single'
        ? 1
        : sanitizePublicInteger(group?.max ?? group?.maxSelections ?? 0, 0, 0, 99)
      const groupId = sanitizePublicText(group?.id || group?.groupId || `group-${groupIndex}`, 80)
      const options = (Array.isArray(group?.options) ? group.options : [])
        .slice(0, 80)
        .map(sanitizePublicOption)
        .filter(Boolean)

      if (!options.length) return null

      return {
        id: groupId,
        groupId,
        title,
        name: title,
        description: sanitizePublicText(group?.description || group?.subtitle, 240),
        type,
        required,
        isRequired: required,
        min,
        minSelections: min,
        max,
        maxSelections: max,
        allowQuantity: type === 'quantity' || allowQuantity,
        pricingMode: ['additive', 'included', 'included_first', 'first_included', 'firstIncluded'].includes(group?.pricingMode)
          ? group.pricingMode
          : 'additive',
        includedQuantity: sanitizePublicInteger(group?.includedQuantity ?? (min || 1), min || 1, 0, 99),
        options,
      }
    })
    .filter(Boolean)
}

function sanitizePublicExtras(value) {
  const raw = Array.isArray(value) ? value : []

  return raw
    .slice(0, 80)
    .map((extra, index) => sanitizePublicOption(extra, index))
    .filter(Boolean)
}

function sanitizePublicProduct(data, storeData = {}) {
  const product = pickPublicFields(data, PUBLIC_PRODUCT_FIELDS)
  const scheduling = hasPlanFeature(storeData, 'scheduling')
    ? sanitizePublicProductScheduling(data?.scheduling)
    : null

  if (scheduling) product.scheduling = scheduling
  else delete product.scheduling

  const imageLimit = getStorePlanLimit(storeData, 'productImagesPerItem')
  if (Array.isArray(product.images)) product.images = product.images.slice(0, imageLimit)
  if (Array.isArray(product.imageUrls)) product.imageUrls = product.imageUrls.slice(0, imageLimit)
  if (Array.isArray(product.gallery)) product.gallery = product.gallery.slice(0, imageLimit)
  product.serving = sanitizePublicProductServing(data?.serving, data)
  product.visualBadges = sanitizePublicProductVisualBadges(data?.visualBadges)
  product.acceptsCoupons = normalizePublicProductCouponFlag(data)
  product.showCouponBadge = product.acceptsCoupons && data?.showCouponBadge !== false
  delete product.acceptsCoupon
  delete product.couponEligible
  product.optionGroups = sanitizePublicOptionGroups(data?.optionGroups)
  product.extras = sanitizePublicExtras(data?.extras)
  product.addons = sanitizePublicExtras(data?.addons)
  product.additionalOptions = sanitizePublicExtras(data?.additionalOptions)
  product.variations = sanitizePublicExtras(data?.variations)

  return product
}

function publicCategoryIsVisible(data) {
  return isPublicItemVisible(data)
}

function sanitizePublicCategory(data) {
  return pickPublicFields(data, PUBLIC_CATEGORY_FIELDS)
}

async function storeRecordFromSnapshot(snapshot, collectionName) {
  const data = snapshot.data() || {}

  if (collectionName === 'publicStores') {
    const canonicalStoreId = getCanonicalStoreId(snapshot.id, data)
    if (canonicalStoreId && canonicalStoreId !== snapshot.id) {
      const canonicalSnapshot = await db.collection('publicStores').doc(canonicalStoreId).get()
      if (canonicalSnapshot.exists) {
        return {
          id: canonicalSnapshot.id,
          collectionName,
          data: {
            ...(canonicalSnapshot.data() || {}),
            id: canonicalSnapshot.id,
            docId: canonicalSnapshot.id,
            storeId: canonicalSnapshot.id,
            storeDocId: canonicalSnapshot.id,
          },
        }
      }
    }

    return {
      id: snapshot.id,
      collectionName,
      data: {
        ...data,
        id: snapshot.id,
        docId: snapshot.id,
        storeId: snapshot.id,
        storeDocId: snapshot.id,
      },
    }
  }

  return {
    id: snapshot.id,
    collectionName,
    data,
  }
}

async function queryStoreRecord(collectionName, field, operator, value) {
  const cleanValue = String(value || '').trim()
  if (!cleanValue) return null

  const snapshot = await db.collection(collectionName)
    .where(field, operator, cleanValue)
    .limit(1)
    .get()

  if (snapshot.empty) return null

  return storeRecordFromSnapshot(snapshot.docs[0], collectionName)
}

async function findPublicStoreByParam(param) {
  const originalParam = String(param || '').trim().replace(/^\/+|\/+$/g, '')
  if (!originalParam) return null

  const normalizedParam = normalizePublicStoreLookupParam(originalParam)

  const directSnapshot = await db.collection('publicStores').doc(originalParam).get()
  if (directSnapshot.exists) {
    return storeRecordFromSnapshot(directSnapshot, 'publicStores')
  }

  for (const [field, value] of [
    ['slug', normalizedParam],
    ['storeSlug', normalizedParam],
  ]) {
    const record = await queryStoreRecord('publicStores', field, '==', value)
    if (record) return record
  }

  for (const key of uniqueTruthy([originalParam, normalizedParam])) {
    const record = await queryStoreRecord('publicStores', 'storeKeys', 'array-contains', key)
    if (record) return record
  }

  return null
}

async function findLegacyStoreByParam(param) {
  const originalParam = String(param || '').trim().replace(/^\/+|\/+$/g, '')
  if (!originalParam) return null

  const normalizedParam = normalizePublicStoreLookupParam(originalParam)

  const directSnapshot = await db.collection('stores').doc(originalParam).get()
  if (directSnapshot.exists) {
    return storeRecordFromSnapshot(directSnapshot, 'stores')
  }

  for (const [field, value] of [
    ['slug', normalizedParam],
    ['storeSlug', normalizedParam],
  ]) {
    const record = await queryStoreRecord('stores', field, '==', value)
    if (record) return record
  }

  for (const key of uniqueTruthy([originalParam, normalizedParam])) {
    const record = await queryStoreRecord('stores', 'storeKeys', 'array-contains', key)
    if (record) return record
  }

  return null
}

async function findStoreForCallable(input = {}) {
  const params = uniqueTruthy([
    input.storeId,
    input.storeDocId,
    input.storePublicId,
    input.storeSlug,
    input.slug,
    input.publicId,
    input.param,
    input.key,
  ]).slice(0, 8)

  for (const param of params) {
    const record = await findPublicStoreByParam(param)
    if (record) return record
  }

  for (const param of params) {
    logger.warn('[publicCallable] Falling back to slug query for store lookup.', {
      param,
    })
    const record = await findLegacyStoreByParam(param)
    if (record) return record
  }

  return null
}

function getStoreLookupKeys(storeRecord) {
  if (!storeRecord) return []
  const data = storeRecord.data || {}
  return uniqueTruthy([
    storeRecord.id,
    data.storeId,
    data.storeDocId,
    data.storeSlug,
    data.slug,
    ...(Array.isArray(data.storeKeys) ? data.storeKeys : []),
  ]).slice(0, 12)
}

function sortPublicItems(a, b) {
  const orderA = Number(a.order ?? a.sortOrder ?? a.position ?? 9999)
  const orderB = Number(b.order ?? b.sortOrder ?? b.position ?? 9999)
  if (orderA !== orderB) return orderA - orderB
  return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
}

function isPublicItemVisible(item) {
  return item?.isDeleted !== true &&
    !item?.deletedAt &&
    item?.hidden !== true &&
    item?.isActive !== false &&
    item?.active !== false &&
    item?.isVisible !== false &&
    item?.visible !== false &&
    item?.showInStorefront !== false
}

async function loadPublicSubcollection(storeRecord, subcollection, sanitizePublic) {
  const results = new Map()
  const lookupKeys = getStoreLookupKeys(storeRecord)

  for (const key of lookupKeys.slice(0, 4)) {
    const publicSnapshot = await db.collection('publicStores').doc(key).collection(subcollection).get()
    publicSnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() || {}
      results.set(docSnapshot.id, {
        ...sanitizePublic(data),
        id: docSnapshot.id,
      })
    })
  }

  if (results.size === 0) {
    for (const key of lookupKeys) {
      const snapshot = await db.collection(subcollection)
        .where('storeId', '==', key)
        .limit(500)
        .get()
      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() || {}
        results.set(docSnapshot.id, {
          ...sanitizePublic(data),
          id: docSnapshot.id,
          storeId: data.storeId || key,
        })
      })
    }
  }

  return Array.from(results.values())
    .filter(isPublicItemVisible)
    .sort(sortPublicItems)
}

function assertStoreOwnerOrAdmin(storeData, uid, userData) {
  const role = String(userData?.role || '').toLowerCase()
  if (['admin', 'developer', 'dev'].includes(role)) return

  const allowedUserIds = Array.isArray(storeData.allowedUserIds) ? storeData.allowedUserIds : []
  const merchantUids = Array.isArray(storeData.merchantUids) ? storeData.merchantUids : []
  const isOwner =
    storeData.ownerUid === uid ||
    storeData.ownerId === uid ||
    allowedUserIds.includes(uid) ||
    merchantUids.includes(uid)

  if (!isOwner) {
    throw new HttpsError('permission-denied', 'Permissão negada para esta loja.')
  }
}

function assertNonAnonymousDashboardUser(request) {
  const uid = request.auth?.uid
  const provider = request.auth?.token?.firebase?.sign_in_provider || ''

  if (!uid || provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Acesso negado.')
  }

  return uid
}

function getSecretValue(secret, envName = '') {
  try {
    return String(secret.value() || '').trim()
  } catch (_error) {
    return String((envName ? process.env[envName] : '') || '').trim()
  }
}

function getCloudinaryConfig() {
  return {
    cloudName: getSecretValue(CLOUDINARY_CLOUD_NAME, 'CLOUDINARY_CLOUD_NAME'),
    apiKey: getSecretValue(CLOUDINARY_API_KEY, 'CLOUDINARY_API_KEY'),
    apiSecret: getSecretValue(CLOUDINARY_API_SECRET, 'CLOUDINARY_API_SECRET'),
  }
}

function sanitizeCloudinaryFolder(value) {
  const folder = String(value || 'PratoBy').trim().replace(/^\/+|\/+$/g, '')

  if (
    !folder ||
    folder.length > 120 ||
    folder.includes('..') ||
    !/^PratoBy(?:\/[A-Za-z0-9_-]+){0,4}$/.test(folder)
  ) {
    throw new HttpsError('invalid-argument', 'Pasta de upload invalida.')
  }

  return folder
}

function signCloudinaryParams(params, apiSecret) {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto
    .createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex')
}

function hasForbiddenSettingsKeyDeep(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return false
  return Object.entries(value).some(([key, entry]) => (
    STORE_SETTINGS_FORBIDDEN_FIELDS.has(key) ||
    hasForbiddenSettingsKeyDeep(entry, depth + 1)
  ))
}

const ONLINE_PAYMENT_ACTIVE_STATUSES = new Set(['active', 'enabled', 'ativo'])
const PREORDER_PAYMENT_POLICY_MODES = new Set([
  'manual',
  'pix_manual',
  'mercadopago_online',
  'manual_or_mercadopago',
])

function normalizeSettingsText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function sanitizeSettingsInteger(value, fallback, min, max) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function sanitizeStorePaymentsSettingsPatch(value, currentPayments = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Configuracao de pagamentos invalida.')
  }

  if (hasForbiddenSettingsKeyDeep(value)) {
    throw new HttpsError('permission-denied', 'Configuracao de pagamentos contem dados restritos.')
  }

  const current = currentPayments && typeof currentPayments === 'object' && !Array.isArray(currentPayments)
    ? currentPayments
    : {}
  const currentAsaas = current.asaas && typeof current.asaas === 'object' && !Array.isArray(current.asaas)
    ? current.asaas
    : {}
  const currentMercadoPago = current.mercadoPago && typeof current.mercadoPago === 'object' && !Array.isArray(current.mercadoPago)
    ? current.mercadoPago
    : {}
  const inputMercadoPago = value.mercadoPago && typeof value.mercadoPago === 'object' && !Array.isArray(value.mercadoPago)
    ? value.mercadoPago
    : null
  const inputPolicy = value.preorderPolicy && typeof value.preorderPolicy === 'object' && !Array.isArray(value.preorderPolicy)
    ? value.preorderPolicy
    : null

  const nextAsaas = {
    ...currentAsaas,
  }

  const mercadoPagoStatus = normalizeSettingsText(
    currentMercadoPago.status || (currentMercadoPago.enabled === true ? 'active' : 'not_connected')
  )
  const canEnableMercadoPago = ONLINE_PAYMENT_ACTIVE_STATUSES.has(mercadoPagoStatus)
  const nextMercadoPago = {
    ...currentMercadoPago,
    provider: 'mercadopago',
  }

  if (inputMercadoPago) {
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'enabled')) {
      nextMercadoPago.enabled = inputMercadoPago.enabled === true && canEnableMercadoPago
    }
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'allowPix')) {
      nextMercadoPago.allowPix = inputMercadoPago.allowPix !== false
    }
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'allowCreditCard')) {
      nextMercadoPago.allowCreditCard = inputMercadoPago.allowCreditCard !== false
    }
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'maxInstallmentCount')) {
      nextMercadoPago.maxInstallmentCount = sanitizeSettingsInteger(
        inputMercadoPago.maxInstallmentCount,
        currentMercadoPago.maxInstallmentCount || 1,
        1,
        12
      )
    }
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'requireForScheduled')) {
      nextMercadoPago.requireForScheduled = inputMercadoPago.requireForScheduled === true
    }
    if (Object.prototype.hasOwnProperty.call(inputMercadoPago, 'minOrderCents')) {
      nextMercadoPago.minOrderCents = sanitizeSettingsInteger(
        inputMercadoPago.minOrderCents,
        currentMercadoPago.minOrderCents || 0,
        0,
        100000000
      )
    }
  }

  const nextPolicy = {
    ...(current.preorderPolicy && typeof current.preorderPolicy === 'object' && !Array.isArray(current.preorderPolicy)
      ? current.preorderPolicy
      : {}),
  }

  if (inputPolicy || typeof value.preorderPolicy === 'string') {
    const mode = normalizeSettingsText(inputPolicy?.mode || value.preorderPolicy || 'manual')
    if (mode === 'online' || mode === 'online_required') {
      nextPolicy.mode = 'mercadopago_online'
      delete nextPolicy.legacyMode
    } else if (mode === 'asaas_online') {
      nextPolicy.mode = nextMercadoPago.enabled === true ? 'mercadopago_online' : 'manual'
      nextPolicy.legacyMode = 'asaas_online'
    } else if (mode === 'manual_or_asaas') {
      nextPolicy.mode = nextMercadoPago.enabled === true ? 'manual_or_mercadopago' : 'manual'
      nextPolicy.legacyMode = 'manual_or_asaas'
    } else {
      nextPolicy.mode = PREORDER_PAYMENT_POLICY_MODES.has(mode) ? mode : 'manual'
      delete nextPolicy.legacyMode
    }
    nextPolicy.requiredMethod = nextPolicy.mode

    const mercadoPagoRequiredByPolicy = nextPolicy.mode === 'mercadopago_online' || nextPolicy.mode === 'manual_or_mercadopago'
    if (mercadoPagoRequiredByPolicy && nextMercadoPago.enabled !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Conecte e ative o Mercado Pago antes de exigir ou oferecer pagamento online em encomendas.'
      )
    }
  }

  return cleanCallableFirestoreValue({
    ...current,
    asaas: nextAsaas,
    mercadoPago: nextMercadoPago,
    preorderPolicy: nextPolicy,
  })
}

function normalizeStoreOperationMode(value) {
  const rawMode = String(value || '').trim().toLowerCase()
  if (['opening_hours', 'business_hours', 'automatic', 'auto', 'scheduled'].includes(rawMode)) {
    return 'opening_hours'
  }
  return STORE_OPERATION_MODES.has(rawMode) ? rawMode : 'manual'
}

function sanitizeStoreTimeZone(value) {
  const timeZone = String(value || 'America/Sao_Paulo').trim().slice(0, 80) || 'America/Sao_Paulo'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch (_) {
    throw new HttpsError('invalid-argument', 'Fuso horario invalido.')
  }
}

function sanitizeTemporaryPauseUntil(value) {
  if (!value) return null
  const date = typeof value.toDate === 'function'
    ? value.toDate()
    : typeof value.toMillis === 'function'
      ? new Date(value.toMillis())
      : value.seconds
        ? new Date(Number(value.seconds) * 1000)
        : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new HttpsError('invalid-argument', 'Pausa temporaria invalida.')
  }

  return date.toISOString()
}

function sanitizeStoreOperationalSettings(value, currentSettings = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Configuracao operacional invalida.')
  }

  const nextSettings = {}
  for (const field of STORE_OPERATIONAL_SETTINGS_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(currentSettings || {}, field)) {
      const cleanValue = cleanCallableFirestoreValue(currentSettings[field])
      if (cleanValue !== undefined) nextSettings[field] = cleanValue
    }
  }

  for (const field of Object.keys(value)) {
    if (!STORE_OPERATIONAL_SETTINGS_ALLOWED_FIELDS.has(field)) {
      throw new HttpsError('permission-denied', `Campo "settings.${field}" nao pode ser alterado por esta funcao.`)
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'availabilityMode') ||
      Object.prototype.hasOwnProperty.call(value, 'operatingMode')) {
    const mode = normalizeStoreOperationMode(value.availabilityMode || value.operatingMode)
    nextSettings.availabilityMode = mode
    nextSettings.operatingMode = mode
  }

  if (Object.prototype.hasOwnProperty.call(value, 'timeZone')) {
    nextSettings.timeZone = sanitizeStoreTimeZone(value.timeZone)
  } else if (!nextSettings.timeZone) {
    nextSettings.timeZone = 'America/Sao_Paulo'
  }

  if (Object.prototype.hasOwnProperty.call(value, 'temporaryPauseUntil')) {
    nextSettings.temporaryPauseUntil = sanitizeTemporaryPauseUntil(value.temporaryPauseUntil)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'temporaryPauseReason')) {
    nextSettings.temporaryPauseReason = sanitizePublicText(value.temporaryPauseReason, 120)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'allowScheduledOrdersWhenClosed')) {
    nextSettings.allowScheduledOrdersWhenClosed = value.allowScheduledOrdersWhenClosed === true
  }

  return cleanCallableFirestoreValue(nextSettings)
}

function patchClearsTemporaryPause(patch) {
  return Object.prototype.hasOwnProperty.call(patch || {}, 'settings') &&
    Object.prototype.hasOwnProperty.call(patch.settings || {}, 'temporaryPauseUntil') &&
    patch.settings.temporaryPauseUntil === null
}

function sanitizeStoreSettingsPayload(payload, currentStoreData = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpsError('invalid-argument', 'Payload de configurações inválido.')
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (STORE_SETTINGS_FORBIDDEN_FIELDS.has(key)) {
      throw new HttpsError('permission-denied', `Campo "${key}" não pode ser alterado por esta função.`)
    }
    if (!STORE_SETTINGS_ALLOWED_FIELDS.has(key)) return acc
    if (hasForbiddenSettingsKeyDeep(value)) {
      throw new HttpsError('permission-denied', `Campo "${key}" contém dados restritos.`)
    }

    if (key === 'scheduling') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new HttpsError('invalid-argument', 'Configuracao de agendamento invalida.')
      }
      acc.scheduling = sanitizeStoreScheduling(value)
      return acc
    }

    if (key === 'payments') {
      acc.payments = sanitizeStorePaymentsSettingsPatch(value, currentStoreData.payments)
      return acc
    }

    if (key === 'settings') {
      acc.settings = sanitizeStoreOperationalSettings(value, currentStoreData.settings)
      return acc
    }

    const cleanValue = cleanCallableFirestoreValue(value)
    if (cleanValue !== undefined) acc[key] = cleanValue
    return acc
  }, {})
}

function assertPixPaymentSettingsPatch(patch) {
  const touchesPaymentMethods = Object.prototype.hasOwnProperty.call(patch, 'paymentMethods')
  const touchesPix = Object.prototype.hasOwnProperty.call(patch, 'pix')
  if (!touchesPaymentMethods && !touchesPix) return

  const paymentPixEnabled = patch.paymentMethods?.pix === true
  const pixEnabled = patch.pix?.enabled === true

  if (paymentPixEnabled && !pixEnabled) {
    throw new HttpsError('failed-precondition', 'Para aceitar Pix, configure o Pix com comprovante da loja.')
  }

  if (!paymentPixEnabled && !pixEnabled) return

  const pix = patch.pix || {}
  const hasPixKey = Boolean(String(pix.key || '').trim())
  const hasPixMerchantName = Boolean(String(pix.merchantName || '').trim())
  const hasPixMerchantCity = Boolean(String(pix.merchantCity || '').trim())

  if (!hasPixKey || !hasPixMerchantName || !hasPixMerchantCity) {
    throw new HttpsError('failed-precondition', 'Preencha chave, nome e cidade para ativar Pix.')
  }
}

function settingsValueChanged(beforeValue, afterValue) {
  return JSON.stringify(cleanCallableFirestoreValue(beforeValue) ?? null) !==
    JSON.stringify(cleanCallableFirestoreValue(afterValue) ?? null)
}

async function assertStoreHasNoActiveOrders(storeId, storeData) {
  const storeKeys = buildPublicStoreKeys(storeId, storeData).slice(0, 10)

  for (const key of storeKeys) {
    const activeOrderSnapshot = await db.collection('orders')
      .where('storeId', '==', key)
      .where('status', 'in', STORE_ACTIVE_ORDER_STATUSES)
      .limit(1)
      .get()

    if (!activeOrderSnapshot.empty) {
      const activeOrder = activeOrderSnapshot.docs[0]
      throw new HttpsError(
        'failed-precondition',
        'Finalize ou cancele os pedidos ativos antes de fechar a loja.',
        {
          reason: 'active-orders',
          orderId: activeOrder.id,
          status: activeOrder.data()?.status || 'pendente',
        }
      )
    }
  }
}

async function findPublicCoupon(storeRecord, couponCode) {
  const code = String(couponCode || '').trim().toUpperCase().slice(0, 80)
  if (!code) return null

  for (const storeKey of getStoreLookupKeys(storeRecord)) {
    const snapshot = await db.collection('coupons')
      .where('storeId', '==', storeKey)
      .where('code', '==', code)
      .limit(1)
      .get()
    if (!snapshot.empty) {
      const docSnapshot = snapshot.docs[0]
      return { id: docSnapshot.id, data: docSnapshot.data() || {} }
    }
  }

  return null
}

function couponMoneyCents(coupon, centsField, moneyField) {
  if (coupon?.[centsField] !== undefined && coupon?.[centsField] !== null) {
    return toCents(coupon[centsField])
  }
  if (coupon?.[moneyField] !== undefined && coupon?.[moneyField] !== null) {
    return moneyToCents(coupon[moneyField])
  }
  return 0
}

function publicCouponAppliesToItem(coupon, item) {
  if (item?.acceptsCoupons === false || item?.acceptsCoupon === false || item?.couponEligible === false) {
    return false
  }

  const productId = String(item?.productId || item?.id || '').trim()
  const productIds = Array.isArray(coupon.productIds) ? coupon.productIds.map((id) => String(id)) : []
  const appliesTo = coupon.appliesTo || 'all'

  if (coupon.targetId && coupon.targetId !== 'all') return productId === String(coupon.targetId)
  if (appliesTo === 'includeProducts') return productIds.includes(productId)
  if (appliesTo === 'excludeProducts') return !productIds.includes(productId)
  return true
}

function validateCouponForPublicResponse(coupon, items, subtotalCents) {
  const now = Date.now()
  const startsAt = timestampToMillis(coupon.startsAt)
  const expiresAt = timestampToMillis(coupon.expiresAt)

  if (coupon.isDeleted === true || coupon.deletedAt || coupon.active === false) {
    return { valid: false, reason: 'inactive', message: 'Cupom inativo ou indisponível.' }
  }
  if (startsAt && now < startsAt) return { valid: false, reason: 'not_started', message: 'Cupom ainda não está vigente.' }
  if (expiresAt && now > expiresAt) return { valid: false, reason: 'expired', message: 'Cupom expirado.' }

  const usageLimit = Number(coupon.usageLimit || 0)
  const usedCount = Number(coupon.usedCount || 0)
  if (usageLimit > 0 && usedCount >= usageLimit) {
    return { valid: false, reason: 'limit_reached', message: 'Cupom esgotado.' }
  }

  const eligibleSubtotalCents = items
    .filter((item) => publicCouponAppliesToItem(coupon, item))
    .reduce((acc, item) => acc + toCents(item.totalCents), 0)

  if (eligibleSubtotalCents <= 0) {
    return { valid: false, reason: 'ineligible_items', message: 'Cupom não se aplica aos itens do carrinho.' }
  }

  const minOrderCents = couponMoneyCents(coupon, 'minOrderCents', 'minOrder')
  if (minOrderCents > 0 && eligibleSubtotalCents < minOrderCents) {
    return {
      valid: false,
      reason: 'min_order_not_met',
      message: 'Subtotal elegível abaixo do pedido mínimo do cupom.',
      minOrderCents,
      eligibleSubtotalCents,
      missingCents: minOrderCents - eligibleSubtotalCents,
    }
  }

  const type = coupon.type === 'fixed' ? 'fixed' : 'percent'
  let discountCents

  if (type === 'percent') {
    const percent = Math.max(0, Number(coupon.value || 0))
    discountCents = Math.round(eligibleSubtotalCents * (percent / 100))
    const maxDiscountCents = couponMoneyCents(coupon, 'maxDiscountCents', 'maxDiscount')
    if (maxDiscountCents > 0) discountCents = Math.min(discountCents, maxDiscountCents)
  } else {
    discountCents = couponMoneyCents(coupon, 'valueCents', 'value')
  }

  discountCents = Math.min(Math.max(0, discountCents), eligibleSubtotalCents, subtotalCents)
  if (discountCents <= 0) return { valid: false, reason: 'no_discount_applicable', message: 'Cupom sem desconto aplicável.' }

  return {
    valid: true,
    type,
    discountCents,
    eligibleSubtotalCents,
    minOrderCents,
  }
}

exports.getPublicStoreProfile = onCall(
  PUBLIC_STORE_PROFILE_CALLABLE_OPTIONS,
  async (request) => {
    const data = request.data || {}
    await assertPublicCallableRateLimit('getPublicStoreProfile', request)

    const storeRecord = await findStoreForCallable(data)
    if (!storeRecord || !isStorePubliclyReadable(storeRecord.data)) {
      throw new HttpsError('not-found', 'Loja não encontrada.')
    }

    return {
      ok: true,
      store: normalizeStorePayload(
        storeRecord.id,
        storeRecord.data,
        storeRecord.collectionName
      ),
    }
  }
)
exports.getPublicCatalog = onCall(
  { ...PUBLIC_CALLABLE_OPTIONS, memory: '512MiB' },
  async (request) => {
    const data = request.data || {}
    await assertPublicCallableRateLimit('getPublicCatalog', request)

    const storeRecord = await findStoreForCallable(data)
    if (!storeRecord || !isStorePubliclyReadable(storeRecord.data)) {
      throw new HttpsError('not-found', 'Loja não encontrada.')
    }

    const [categories, products] = await Promise.all([
      loadPublicSubcollection(storeRecord, 'categories', sanitizePublicCategory),
      loadPublicSubcollection(storeRecord, 'products', (product) => sanitizePublicProduct(product, storeRecord.data)),
    ])

    return {
      ok: true,
      store: normalizeStorePayload(storeRecord.id, storeRecord.data, storeRecord.collectionName),
      categories,
      products,
    }
  }
)

exports.validatePublicCoupon = onCall(
  { ...PUBLIC_CALLABLE_OPTIONS, maxInstances: 20 },
  async (request) => {
    const data = request.data || {}
    await assertPublicCallableRateLimit('validatePublicCoupon', request)

    const storeRecord = await findStoreForCallable(data)
    if (!storeRecord || !isStorePubliclyReadable(storeRecord.data)) {
      return { valid: false, message: 'Loja indisponível.' }
    }

    if (!hasPlanFeature(storeRecord.data, 'coupons')) {
      return { valid: false, reason: 'plan_restricted', message: 'Cupom indisponivel no plano atual da loja.' }
    }

    const couponDoc = await findPublicCoupon(storeRecord, data.couponCode)
    if (!couponDoc) return { valid: false, message: 'Cupom inválido ou não encontrado.' }

    const coupon = couponDoc.data
    const subtotalCents = Math.max(0, toCents(data.subtotalCents))
    const items = Array.isArray(data.items)
      ? data.items.slice(0, 200).map((item) => ({
        id: String(item?.id || '').trim(),
        productId: String(item?.productId || item?.id || '').trim(),
        categoryId: String(item?.categoryId || '').trim(),
        totalCents: Math.max(0, toCents(item?.totalCents)),
        acceptsCoupons: item?.acceptsCoupons,
        acceptsCoupon: item?.acceptsCoupon,
        couponEligible: item?.couponEligible,
      }))
      : []

    if (subtotalCents <= 0 || items.length === 0) {
      return { valid: false, message: 'Carrinho inválido para cupom.' }
    }

    const validation = validateCouponForPublicResponse(coupon, items, subtotalCents)
    if (!validation.valid) return validation

    const publicCoupon = pickPublicFields(coupon, [
      'code', 'type', 'value', 'valueCents', 'maxDiscount', 'maxDiscountCents',
      'minOrder', 'minOrderCents', 'appliesTo', 'targetId', 'productIds'
    ])

    return {
      valid: true,
      message: 'Cupom aplicado.',
      coupon: {
        ...publicCoupon,
        code: String(coupon.code || data.couponCode || '').trim().toUpperCase(),
        discountCents: validation.discountCents,
        eligibleSubtotalCents: validation.eligibleSubtotalCents,
      },
      discountCents: validation.discountCents,
      eligibleSubtotalCents: validation.eligibleSubtotalCents,
    }
  }
)

exports.createCloudinaryUploadSignature = onCall(
  {
    region: REGION,
    timeoutSeconds: 15,
    memory: '256MiB',
    maxInstances: 10,
    secrets: [
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
    ],
  },
  async (request) => {
    const uid = assertNonAnonymousDashboardUser(request)
    const userSnapshot = await db.collection('users').doc(uid).get()

    if (!userSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Usuario nao encontrado.')
    }

    const userData = userSnapshot.data() || {}
    const role = String(userData.role || '').toLowerCase()

    if (!['merchant', 'lojista', 'admin', 'developer', 'dev'].includes(role)) {
      throw new HttpsError('permission-denied', 'Permissao negada para upload.')
    }

    const data = request.data || {}
    const storeId = String(data.storeId || '').trim()

    if (storeId) {
      const storeSnapshot = await db.collection('stores').doc(storeId).get()

      if (!storeSnapshot.exists) {
        throw new HttpsError('not-found', 'Loja nao encontrada.')
      }

      assertStoreOwnerOrAdmin(storeSnapshot.data() || {}, uid, userData)
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()

    if (!cloudName || !apiKey || !apiSecret) {
      logger.error('[cloudinary] Missing signed upload configuration.', {
        hasCloudName: Boolean(cloudName),
        hasApiKey: Boolean(apiKey),
        hasApiSecret: Boolean(apiSecret),
      })

      throw new HttpsError('failed-precondition', 'Upload seguro nao configurado.')
    }

    const folder = sanitizeCloudinaryFolder(data.folder)
    const timestamp = Math.floor(Date.now() / 1000)
    const paramsToSign = {
      folder,
      timestamp,
    }

    return {
      ok: true,
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature: signCloudinaryParams(paramsToSign, apiSecret),
    }
  }
)

exports.deleteCloudinaryAsset = onCall(
  {
    region: REGION,
    timeoutSeconds: 15,
    memory: '256MiB',
    maxInstances: 10,
  },
  async (request) => {
    const uid = assertNonAnonymousDashboardUser(request)
    const data = request.data || {}
    const storeId = String(data.storeId || '').trim()
    const mediaId = String(data.mediaId || '').trim()

    if (!storeId || !mediaId) {
      throw new HttpsError('invalid-argument', 'Loja e imagem sao obrigatorias.')
    }

    const userSnapshot = await db.collection('users').doc(uid).get()
    if (!userSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Usuario nao encontrado.')
    }

    const storeSnapshot = await db.collection('stores').doc(storeId).get()
    if (!storeSnapshot.exists) {
      throw new HttpsError('not-found', 'Loja nao encontrada.')
    }

    assertStoreOwnerOrAdmin(storeSnapshot.data() || {}, uid, userSnapshot.data() || {})

    const mediaRef = db.collection('stores').doc(storeId).collection('media').doc(mediaId)
    const mediaSnapshot = await mediaRef.get()

    if (!mediaSnapshot.exists) {
      throw new HttpsError('not-found', 'Imagem nao encontrada.')
    }

    const mediaData = mediaSnapshot.data() || {}

    if (mediaData.deletedAt) {
      return { ok: true, alreadyDeleted: true }
    }

    await mediaRef.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    await createAuditLog({
      action: 'store_media_deleted',
      entity: 'store_media',
      entityId: mediaId,
      storeId,
      storeSlug: storeSnapshot.data()?.storeSlug || storeSnapshot.data()?.slug || '',
      actorUid: uid,
      changedFields: ['deletedAt', 'deletedBy'],
      metadata: {
        type: mediaData.type || 'general',
        hasPublicId: Boolean(mediaData.publicId),
      },
    })

    return { ok: true, softDeleted: true }
  }
)

exports.updateStoreSettings = onCall(
  { region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 10 },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

    const data = request.data || {}
    const storeId = String(data.storeId || '').trim()
    if (!storeId) throw new HttpsError('invalid-argument', 'Loja obrigatória.')

    const userSnapshot = await db.collection('users').doc(uid).get()
    if (!userSnapshot.exists) throw new HttpsError('permission-denied', 'Usuário não encontrado.')

    const storeRef = db.collection('stores').doc(storeId)
    const storeSnapshot = await storeRef.get()
    if (!storeSnapshot.exists) throw new HttpsError('not-found', 'Loja não encontrada.')

    const storeData = storeSnapshot.data() || {}
    assertStoreOwnerOrAdmin(storeData, uid, userSnapshot.data() || {})

    if (data.payload !== undefined && data.updates !== undefined) {
      throw new HttpsError('invalid-argument', 'Envie apenas payload ou updates.')
    }

    const settingsPayload = data.payload !== undefined ? data.payload : data.updates
    const patch = sanitizeStoreSettingsPayload(settingsPayload || {}, storeData)
    assertPixPaymentSettingsPatch(patch)
    if (!hasPlanFeature(storeData, 'scheduling')) {
      const schedulingChanged = Object.prototype.hasOwnProperty.call(patch, 'scheduling') &&
        settingsValueChanged(storeData.scheduling || {}, patch.scheduling || {})
      const paymentsChanged = Object.prototype.hasOwnProperty.call(patch, 'payments') &&
        settingsValueChanged(storeData.payments || {}, patch.payments || {})
      const closedHoursSchedulingChanged = Object.prototype.hasOwnProperty.call(patch, 'settings') &&
        settingsValueChanged(
          storeData.settings?.allowScheduledOrdersWhenClosed === true,
          patch.settings?.allowScheduledOrdersWhenClosed === true
        )
      const closedHoursSchedulingEnabled =
        closedHoursSchedulingChanged && patch.settings?.allowScheduledOrdersWhenClosed === true
      const schedulingEnabled = patch.scheduling?.enabled === true
      const preorderMode = String(patch.payments?.preorderPolicy?.mode || '').trim()
      const requiresScheduledPayment = patch.payments?.mercadoPago?.requireForScheduled === true
      if (
        (schedulingChanged && schedulingEnabled) ||
        closedHoursSchedulingEnabled ||
        (paymentsChanged && requiresScheduledPayment) ||
        (paymentsChanged && preorderMode && preorderMode !== 'manual')
      ) {
        throw new HttpsError('failed-precondition', 'Agendamento exige plano Profissional ou Premium.')
      }
    }
    if (Object.keys(patch).length === 0) {
      return { ok: true, updatedFields: [] }
    }

    if (patch.isOpen === false && storeData.isOpen !== false) {
      await assertStoreHasNoActiveOrders(storeId, storeData)
    }

    if (patchClearsTemporaryPause(patch)) {
      patch.temporaryPauseUntil = admin.firestore.FieldValue.delete()
      patch.temporaryPauseReason = admin.firestore.FieldValue.delete()
    }

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    patch.updatedBy = uid
    patch.lastUpdatedBy = uid

    await storeRef.update(patch)

    await createAuditLog({
      action: 'store_settings_updated',
      entity: 'store',
      entityId: storeId,
      storeId,
      storeSlug: storeData.storeSlug || storeData.slug || '',
      actorUid: uid,
      changedFields: Object.keys(patch).filter((field) => field !== 'updatedAt'),
    })

    return {
      ok: true,
      updatedFields: Object.keys(patch).filter((field) => field !== 'updatedAt'),
      planDebug: {
        effectivePlan: getEffectivePlan(storeData),
        schedulingAllowed: hasPlanFeature(storeData, 'scheduling'),
        subscriptionStatus: storeData.subscriptionStatus || null,
        trialStatus: storeData.trialStatus || storeData.trial?.status || null,
        trialEntitlementsPlan: storeData.trialEntitlementsPlan || storeData.trial?.entitlementsPlan || null,
      },
    }
  }
)

function getChangedFields(beforeData, afterData, fields) {
    return fields.filter((field) => {
      const beforeValue = field
        .split('.')
        .reduce((acc, key) => acc?.[key], beforeData)

      const afterValue = field
        .split('.')
        .reduce((acc, key) => acc?.[key], afterData)

      return JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null)
    })
  }

  function pickActorUid(beforeData, afterData) {
    return (
      afterData.statusUpdatedBy ||
      afterData.canceledBy ||
      afterData.cancelledBy ||
      afterData.payment?.confirmedBy ||
      afterData.storeThankedCustomerBy ||
      afterData.updatedBy ||
      afterData.lastUpdatedBy ||
      null
    )
  }

  async function createAuditLog(data) {
    await db.collection('auditLogs').add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'cloud_function',
    })
  }

const MAX_ORDER_CENTS = 100000000

function toCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value)
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return 0

  return Math.round(parsed)
}

function moneyToCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100)
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return 0

  return Math.round(parsed * 100)
}

function getPriceCents(data) {
  if (!data) return 0

  if (data.priceCents !== undefined && data.priceCents !== null) {
    return toCents(data.priceCents)
  }

  if (data.priceInCents !== undefined && data.priceInCents !== null) {
    return toCents(data.priceInCents)
  }

  if (data.price !== undefined && data.price !== null) {
    return moneyToCents(data.price)
  }

  return 0
}

function getQuantity(item) {
  const quantity = Number(item?.quantity || item?.qty || 1)

  if (!Number.isFinite(quantity)) return 1

  return Math.max(1, Math.min(Math.floor(quantity), 99))
}

function getProductId(item) {
  return String(
    item?.productId ||
      item?.id ||
      item?.product?.id ||
      item?.itemId ||
      ''
  ).trim()
}

function getClientSubtotalCents(order) {
  if (order?.subtotalCents !== undefined) return toCents(order.subtotalCents)

  if (order?.subtotal !== undefined) return moneyToCents(order.subtotal)

  return 0
}

function getClientDiscountCents(order) {
  if (order?.discountCents !== undefined) return toCents(order.discountCents)

  if (order?.discount !== undefined) return moneyToCents(order.discount)

  if (order?.coupon?.discountCents !== undefined) {
    return toCents(order.coupon.discountCents)
  }

  if (order?.coupon?.discount !== undefined) {
    return moneyToCents(order.coupon.discount)
  }

  return 0
}

function getClientDeliveryFeeCents(order) {
  if (order?.deliveryFeeCents !== undefined) {
    return toCents(order.deliveryFeeCents)
  }

  if (order?.deliveryFee !== undefined) {
    return moneyToCents(order.deliveryFee)
  }

  return 0
}

function getClientTotalCents(order) {
  if (order?.totalCents !== undefined) return toCents(order.totalCents)

  if (order?.total !== undefined) return moneyToCents(order.total)

  return 0
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function isSameStore(order, product) {
  const orderStoreKeys = [
    order.storeId,
    order.storeSlug,
    order.storeDocId,
    ...(Array.isArray(order.storeKeys) ? order.storeKeys : []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  const productStoreKeys = [
    product.storeId,
    product.storeSlug,
    product.storeDocId,
    product.store?.id,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return productStoreKeys.some((key) => orderStoreKeys.includes(key))
}

function collectProductChoices(product) {
  const choices = []

  function visit(value) {
    if (!value) return

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (typeof value !== 'object') return

    const hasPrice =
      value.priceCents !== undefined ||
      value.valueCents !== undefined ||
      value.price !== undefined ||
      value.value !== undefined

    const label = value.name || value.label || value.title || value.id

    if (label && hasPrice) {
      choices.push({
        id: String(value.id || value.optionId || '').trim(),
        name: normalizeText(value.name || value.label || value.title || ''),
        priceCents:
          value.priceCents !== undefined
            ? toCents(value.priceCents)
            : value.valueCents !== undefined
              ? toCents(value.valueCents)
              : value.price !== undefined
                ? moneyToCents(value.price)
                : moneyToCents(value.value),
      })
    }

    visit(value.items)
    visit(value.options)
    visit(value.choices)
    visit(value.values)
    visit(value.addons)
    visit(value.extras)
    visit(value.additionals)
  }

  visit(product.extras)
  visit(product.additionals)
  visit(product.addons)
  visit(product.options)
  visit(product.optionGroups)
  visit(product.groups)
  visit(product.customizations)

  return choices
}

function collectSelectedChoices(item) {
  const selected = []

  function visit(value) {
    if (!value) return

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (typeof value !== 'object') return

    const label = value.name || value.label || value.title || value.id

    if (label) {
      selected.push({
        id: String(value.id || value.optionId || value.choiceId || '').trim(),
        name: normalizeText(value.name || value.label || value.title || ''),
        quantity: getQuantity(value),
      })
    }

    visit(value.items)
    visit(value.options)
    visit(value.choices)
    visit(value.values)
    visit(value.selected)
  }

  visit(item.extras)
  visit(item.selectedExtras)
  visit(item.additionals)
  visit(item.selectedAdditionals)
  visit(item.addons)
  visit(item.selectedAddons)
  visit(item.options)
  visit(item.selectedOptions)
  visit(item.customizations)

  return selected
}

function calculateSelectedChoicesCents(item, product) {
  const choices = collectProductChoices(product)
  const selected = collectSelectedChoices(item)

  if (!selected.length) {
    return {
      totalCents: 0,
      warnings: [],
    }
  }

  const warnings = []
  let totalCents = 0

  selected.forEach((selectedChoice) => {
    const match = choices.find((choice) => {
      if (selectedChoice.id && choice.id && selectedChoice.id === choice.id) {
        return true
      }

      if (selectedChoice.name && choice.name && selectedChoice.name === choice.name) {
        return true
      }

      return false
    })

    if (!match) {
      warnings.push(`Adicional/opção não encontrado no produto: ${selectedChoice.name || selectedChoice.id}`)
      return
    }

    totalCents += match.priceCents * selectedChoice.quantity
  })

  return {
    totalCents,
    warnings,
  }
}

async function getProduct(productId, order) {
  const directRef = db.collection('products').doc(productId)
  const directSnap = await directRef.get()

  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ...directSnap.data(),
    }
  }

  const storeId = String(order.storeId || order.storeSlug || '').trim()

  if (!storeId) return null

  const byStoreSnap = await db
    .collection('products')
    .where('storeId', '==', storeId)
    .where('id', '==', productId)
    .limit(1)
    .get()

  if (!byStoreSnap.empty) {
    const doc = byStoreSnap.docs[0]

    return {
      id: doc.id,
      ...doc.data(),
    }
  }

  return null
}

// Legacy guard for orders not created by createPublicOrder. Secure storefront
// orders already carry pricingValidation.status='valid' from the backend.
exports.validateOrderPricing = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const orderId = event.params.orderId
    const snapshot = event.data

    if (!snapshot) return

    const order = snapshot.data() || {}
    const items = Array.isArray(order.items) ? order.items : []

    const validationRef = db.collection('orders').doc(orderId)

    if (
      order?.source === 'storefront' &&
      order?.pricingValidation?.checkedBy === 'createPublicOrder' &&
      order?.pricingValidation?.status === 'valid'
    ) {
      return
    }

    if (!items.length) {
      await validationRef.update({
        pricingValidation: {
          status: 'invalid',
          reason: 'Pedido sem itens.',
          checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          checkedBy: 'validateOrderPricing',
        },
        requiresManualPriceReview: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return
    }

    const warnings = []
    const errors = []
    let serverSubtotalCents = 0

    for (const item of items) {
      const productId = getProductId(item)
      const quantity = getQuantity(item)

      if (!productId) {
        errors.push('Item sem productId/id.')
        continue
      }

      const product = await getProduct(productId, order)

      if (!product) {
        errors.push(`Produto não encontrado: ${productId}`)
        continue
      }

      if (!isSameStore(order, product)) {
        errors.push(`Produto de outra loja ou storeId incompatível: ${productId}`)
        continue
      }

      if (
        product.isDeleted === true ||
        product.isActive === false ||
        product.isVisible === false ||
        product.deletedAt
      ) {
        errors.push(`Produto indisponível: ${product.name || productId}`)
        continue
      }

      const basePriceCents = getPriceCents(product)
      const selected = calculateSelectedChoicesCents(item, product)

      warnings.push(...selected.warnings)

      serverSubtotalCents += (basePriceCents + selected.totalCents) * quantity
    }

    const clientSubtotalCents = getClientSubtotalCents(order)
    const clientDiscountCents = getClientDiscountCents(order)
    const clientDeliveryFeeCents = getClientDeliveryFeeCents(order)
    const clientTotalCents = getClientTotalCents(order)

    const serverMinimumTotalCents = Math.max(
      0,
      serverSubtotalCents + clientDeliveryFeeCents - clientDiscountCents
    )

    const clientTotalIsSuspicious =
      clientTotalCents <= 0 ||
      clientTotalCents > MAX_ORDER_CENTS ||
      clientSubtotalCents < serverSubtotalCents ||
      clientTotalCents < serverMinimumTotalCents

    const hasProblems = errors.length > 0 || clientTotalIsSuspicious

    const status = hasProblems ? 'invalid' : warnings.length ? 'review' : 'valid'

    await validationRef.update({
      serverSubtotalCents,
      serverMinimumTotalCents,
      clientSubtotalCents,
      clientDiscountCents,
      clientDeliveryFeeCents,
      clientTotalCents,

      pricingValidation: {
        status,
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        checkedBy: 'validateOrderPricing',
        errors,
        warnings,
      },

      requiresManualPriceReview: hasProblems || warnings.length > 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('Order pricing validated', {
      orderId,
      status,
      serverSubtotalCents,
      serverMinimumTotalCents,
      clientTotalCents,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    })
  }
)
exports.auditOrderChanges = onDocumentUpdated(
  {
    document: 'orders/{orderId}',
    region: 'southamerica-east1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (event) => {
    const beforeData = event.data?.before?.data() || {}
    const afterData = event.data?.after?.data() || {}
    const orderId = event.params.orderId

    const changedFields = getChangedFields(beforeData, afterData, [
      'status',
      'payment.status',
      'paymentStatus',
      'payment.confirmedAt',
      'payment.confirmedBy',
      'payment.paidAt',
      'cancellationReason',
      'cancelReason',
      'canceledBy',
      'readyAt',
      'deliveredAt',
      'customerLastNotifiedStatus',
    ])

    if (!changedFields.length) return

    let action = 'order_updated'

    if (beforeData.status !== afterData.status) {
      action = `order_status_changed_to_${afterData.status}`
    }

    if (
      beforeData.status !== 'cancelado' &&
      afterData.status === 'cancelado'
    ) {
      action = 'order_canceled'
    }

    if (
      beforeData.payment?.status !== afterData.payment?.status &&
      afterData.payment?.status === 'paid'
    ) {
      action = 'pix_payment_confirmed'
    }

    if (
      beforeData.paymentStatus !== afterData.paymentStatus &&
      afterData.paymentStatus === 'paid'
    ) {
      action = 'payment_confirmed'
    }

    await createAuditLog({
      action,
      entity: 'order',
      entityId: orderId,
      storeId: afterData.storeId || afterData.storeSlug || beforeData.storeId || '',
      storeSlug: afterData.storeSlug || beforeData.storeSlug || '',
      actorUid: pickActorUid(beforeData, afterData),
      changedFields,
      before: {
        status: beforeData.status || null,
        paymentStatus: beforeData.paymentStatus || null,
        payment: {
          status: beforeData.payment?.status || null,
          confirmedBy: beforeData.payment?.confirmedBy || null,
        },
        cancellationReason:
          beforeData.cancellationReason ||
          beforeData.cancelReason ||
          null,
      },
      after: {
        status: afterData.status || null,
        paymentStatus: afterData.paymentStatus || null,
        payment: {
          status: afterData.payment?.status || null,
          confirmedBy: afterData.payment?.confirmedBy || null,
        },
        cancellationReason:
          afterData.cancellationReason ||
          afterData.cancelReason ||
          null,
      },
    })
  }
)

  exports.auditProductPriceChanges = onDocumentUpdated(
    {
      document: 'products/{productId}',
      region: 'southamerica-east1',
      timeoutSeconds: 30,
      memory: '256MiB',
    },
    async (event) => {
      const beforeData = event.data?.before?.data() || {}
      const afterData = event.data?.after?.data() || {}
      const productId = event.params.productId

      const changedFields = getChangedFields(beforeData, afterData, [
        'price',
        'priceCents',
        'oldPrice',
        'oldPriceCents',
        'isActive',
        'isVisible',
        'deletedAt',
      ])

      if (!changedFields.length) return

      await createAuditLog({
        action: changedFields.includes('price') || changedFields.includes('priceCents')
          ? 'product_price_changed'
          : 'product_updated',
        entity: 'product',
        entityId: productId,
        storeId: afterData.storeId || beforeData.storeId || '',
        storeSlug: afterData.storeSlug || beforeData.storeSlug || '',
        actorUid: afterData.updatedBy || afterData.lastUpdatedBy || null,
        changedFields,
        before: {
          name: beforeData.name || null,
          price: beforeData.price ?? null,
          priceCents: beforeData.priceCents ?? null,
          oldPrice: beforeData.oldPrice ?? null,
          oldPriceCents: beforeData.oldPriceCents ?? null,
          isActive: beforeData.isActive ?? null,
          isVisible: beforeData.isVisible ?? null,
        },
        after: {
          name: afterData.name || null,
          price: afterData.price ?? null,
          priceCents: afterData.priceCents ?? null,
          oldPrice: afterData.oldPrice ?? null,
          oldPriceCents: afterData.oldPriceCents ?? null,
          isActive: afterData.isActive ?? null,
          isVisible: afterData.isVisible ?? null,
        },
      })
    }
  )

function hashPhoneE164(phoneE164) {
  return crypto.createHash('sha256').update(String(phoneE164 || '')).digest('hex')
}

const PHONE_CALLABLE_OPTIONS = { region: 'southamerica-east1', cors: true }
const PHONE_PRECHECK_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const PHONE_PRECHECK_RATE_LIMIT_MAX = 5

async function assertFirebasePhonePrecheckRateLimit(uid, phoneHash) {
  const now = admin.firestore.Timestamp.now()
  const nowMs = now.toMillis()
  const rateLimitRef = db.collection('rateLimits').doc(`precheckFirebasePhoneClaim_${uid}_${phoneHash}`)

  await db.runTransaction(async (transaction) => {
    const rateLimitDoc = await transaction.get(rateLimitRef)
    const data = rateLimitDoc.exists ? rateLimitDoc.data() || {} : {}
    const windowStartMs = data.windowStart?.toMillis ? data.windowStart.toMillis() : 0
    const shouldReset = !windowStartMs || nowMs - windowStartMs >= PHONE_PRECHECK_RATE_LIMIT_WINDOW_MS
    const count = shouldReset ? 0 : Number(data.count || 0)

    if (count >= PHONE_PRECHECK_RATE_LIMIT_MAX) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
    }

    transaction.set(rateLimitRef, {
      provider: 'firebase_phone_auth',
      type: 'phone_precheck',
      uid,
      phoneHash,
      count: count + 1,
      limit: PHONE_PRECHECK_RATE_LIMIT_MAX,
      windowStart: shouldReset ? now : data.windowStart || now,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + PHONE_PRECHECK_RATE_LIMIT_WINDOW_MS),
      updatedAt: now,
    }, { merge: true })
  })
}

function getNextPhoneVerifiedOnboardingStatus(userData) {
  const currentOnboarding = userData?.onboardingStatus || ''
  const subscriptionStatus = userData?.subscriptionStatus || ''
  const preserveStatuses = new Set(['completed', 'billing_pending', 'trialing', 'active'])

  if (preserveStatuses.has(currentOnboarding) || preserveStatuses.has(subscriptionStatus)) {
    return currentOnboarding || 'completed'
  }

  return 'phone_verified'
}

// Firebase callable only. The frontend must use httpsCallable so Firebase handles auth and CORS.
exports.precheckFirebasePhoneClaim = onCall(PHONE_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const validatedPhone = validateBrazilianMobilePhone(request.data?.phoneE164 || '')
  if (!validatedPhone.ok) {
    throw new HttpsError('invalid-argument', 'Informe um celular valido para receber o codigo por SMS.')
  }

  const { phoneE164 } = validatedPhone
  const phoneHash = hashPhoneE164(phoneE164)
  const claimRef = db.collection('phoneClaims').doc(phoneHash)
  const legacyClaimRef = db.collection('phoneClaims').doc(phoneE164)

  const [claimDoc, legacyClaimDoc] = await Promise.all([
    claimRef.get(),
    legacyClaimRef.get(),
  ])

  const claimUid = claimDoc.exists
    ? (claimDoc.data().uid || claimDoc.data().ownerUid || '')
    : ''
  const legacyClaimUid = legacyClaimDoc.exists
    ? (legacyClaimDoc.data().uid || legacyClaimDoc.data().ownerUid || '')
    : ''

  if ((claimUid && claimUid !== uid) || (legacyClaimUid && legacyClaimUid !== uid)) {
    throw new HttpsError('already-exists', 'Este telefone já está vinculado a outra conta.')
  }

  await assertFirebasePhonePrecheckRateLimit(uid, phoneHash)

  return { ok: true, phoneE164 }
})

exports.confirmFirebasePhoneVerified = onCall(PHONE_CALLABLE_OPTIONS, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const userRecord = await admin.auth().getUser(uid)
  const normalized = normalizeBrazilianPhone(userRecord.phoneNumber || '')
  if (!normalized) {
    throw new HttpsError('failed-precondition', 'Telefone verificado nao encontrado na conta Firebase.')
  }

  const { phoneDigits, phoneE164 } = normalized
  const phoneHash = hashPhoneE164(phoneE164)
  const userRef = db.collection('users').doc(uid)
  const claimRef = db.collection('phoneClaims').doc(phoneHash)
  const legacyClaimRef = db.collection('phoneClaims').doc(phoneE164)

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef)
    const claimDoc = await transaction.get(claimRef)
    const legacyClaimDoc = await transaction.get(legacyClaimRef)

    if (!userDoc.exists) {
      throw new HttpsError('failed-precondition', 'Perfil nao encontrado.')
    }

    const userData = userDoc.data() || {}
    if (userData.role !== 'merchant') {
      throw new HttpsError('permission-denied', 'Permissao negada.')
    }

    const existingClaimUid = claimDoc.exists
      ? (claimDoc.data().uid || claimDoc.data().ownerUid || '')
      : ''
    if (existingClaimUid && existingClaimUid !== uid) {
      throw new HttpsError('already-exists', 'Este telefone ja esta vinculado a outra conta.')
    }

    const existingLegacyClaimUid = legacyClaimDoc.exists
      ? (legacyClaimDoc.data().uid || legacyClaimDoc.data().ownerUid || '')
      : ''
    if (existingLegacyClaimUid && existingLegacyClaimUid !== uid) {
      throw new HttpsError('already-exists', 'Este telefone ja esta vinculado a outra conta.')
    }

    const now = admin.firestore.Timestamp.now()
    const nextOnboarding = getNextPhoneVerifiedOnboardingStatus(userData)

    transaction.set(claimRef, {
      uid,
      ownerUid: uid,
      phoneHash,
      provider: 'firebase_phone_auth',
      createdAt: claimDoc.exists ? claimDoc.data().createdAt || now : now,
      updatedAt: now,
    }, { merge: true })

    transaction.update(userRef, {
      phone: phoneDigits,
      phoneE164,
      phoneVerified: true,
      phoneVerifiedSource: 'firebase_phone_auth',
      phoneVerifiedAt: now,
      onboardingStatus: nextOnboarding,
      updatedAt: now,
    })

    return {
      ok: true,
      verified: true,
      phoneE164,
      onboardingStatus: nextOnboarding,
    }
  })
})

// Deprecated since the Firebase Phone Auth verification rollout (2026-06).
// These callable names are legacy compatibility stubs only: do not use them in
// new flows. New phone verification must use Firebase Phone Auth on the client
// and confirmFirebasePhoneVerification on the backend.
exports.requestPhoneVerification = onCall({ region: 'southamerica-east1' }, async () => {
  throw new HttpsError(
    'failed-precondition',
    'Fluxo legado de verificacao desativado. Use a verificacao por Firebase Phone Auth.'
  )
})

exports.confirmPhoneVerification = onCall({ region: 'southamerica-east1' }, async () => {
  throw new HttpsError(
    'failed-precondition',
    'Fluxo legado de verificacao desativado. Use a verificacao por Firebase Phone Auth.'
  )
})

// Legacy name kept for frontend compatibility. This function now only prepares
// a billing-pending store; the real trial is activated by startAsaasSubscription.
exports.startFreeTrial = onCall({ region: 'southamerica-east1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const userRef = db.collection('users').doc(uid)

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef)
    if (!userDoc.exists) throw new HttpsError('failed-precondition', 'Usuário não encontrado.')

    const userData = userDoc.data()
    const now = admin.firestore.Timestamp.now()

    if (userData.role !== 'merchant') throw new HttpsError('permission-denied', 'Permissão negada.')

    // 1. Se phoneVerified !== true:
    if (userData.phoneVerified !== true) {
      logger.warn(`[startFreeTrial] Bloqueado: Telefone não confirmado para o usuário ${uid}.`)
      throw new HttpsError('failed-precondition', 'Verifique seu telefone antes de ativar o teste grátis.')
    }

    // 4. Se o usuário já tem storeId/storeIds:
    const existingStoreId = userData.storeId || (Array.isArray(userData.storeIds) && userData.storeIds[0])

    // Fazer todas as leituras primeiro
    let storeDoc = null
    if (existingStoreId) {
      storeDoc = await transaction.get(db.collection('stores').doc(existingStoreId))
    }

    if (existingStoreId) {
      logger.info(`[startFreeTrial] Usuário ${uid} já possui loja ${existingStoreId}. Retornando loja existente.`)

      if (!storeDoc || !storeDoc.exists) {
        logger.error(`[startFreeTrial] Loja vinculada não foi encontrada para o usuário ${uid} (storeId: ${existingStoreId}).`)
        throw new HttpsError('failed-precondition', 'Loja vinculada não foi encontrada. Entre em contato com o suporte.')
      }

      const storeData = storeDoc.data() || {}
      const finalSlug = storeData.slug || storeData.storeSlug || 'loja'
      const existingStoreIds = Array.isArray(userData.storeIds) ? userData.storeIds : []
      const existingStoreKeys = Array.isArray(userData.storeKeys) ? userData.storeKeys : []
      const userUpdates = { updatedAt: now }

      if (userData.storeId !== existingStoreId) {
        userUpdates.storeId = existingStoreId
      }

      const nextStoreIds = Array.from(new Set([...existingStoreIds, existingStoreId].filter(Boolean)))
      if (nextStoreIds.length !== existingStoreIds.length) {
        userUpdates.storeIds = nextStoreIds
      }

      const nextStoreKeys = Array.from(new Set([...existingStoreKeys, existingStoreId, finalSlug].filter(Boolean)))
      if (nextStoreKeys.length !== existingStoreKeys.length) {
        userUpdates.storeKeys = nextStoreKeys
      }

      transaction.update(userRef, userUpdates)

      return {
        ok: true,
        storeId: existingStoreId,
        storeSlug: finalSlug,
        nextPath: '/dashboard/billing'
      }
    }

    // 2. Se phoneVerified === true, aceitar onboardingStatus:
    const allowedStatus = [
      'pending',
      'phone_pending',
      'phone_verified',
      'profile_completed',
      'store_pending',
      'billing_pending',
      'pending_checkout',
      'checkout_pending',
      'onboarding_pending',
      'onboarding_completed',
      'completed'
    ]

    const onboardingStatus = userData.onboardingStatus || ''
    if (!allowedStatus.includes(onboardingStatus)) {
      logger.error(`[startFreeTrial] Status de onboarding inválido para o usuário ${uid}: ${onboardingStatus}`)
      throw new HttpsError('failed-precondition', 'Status de onboarding inválido.')
    }

    // 3. Se onboardingStatus estiver em pending ou phone_pending, mas phoneVerified === true:
    if (onboardingStatus === 'pending' || onboardingStatus === 'phone_pending') {
      logger.warn(`[startFreeTrial] Status inconsistente detectado para o usuário ${uid}: onboardingStatus="${onboardingStatus}", mas phoneVerified=true. Permitindo criação da loja.`)
    }

    const storeName = userData.signup?.storeName || 'Minha Loja'
    const baseSlug = normalizeText(storeName).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'loja'

    let finalSlug = null
    let candidateSlug = baseSlug

    for (let i = 0; i < 5; i++) {
      const claimRef = db.collection('storeSlugClaims').doc(candidateSlug)
      const claimDoc = await transaction.get(claimRef)
      if (!claimDoc.exists) {
        finalSlug = candidateSlug
        break
      }
      const shortId = crypto.randomBytes(3).toString('hex')
      candidateSlug = `${baseSlug}-${shortId}`
    }

    if (!finalSlug) {
      throw new HttpsError('resource-exhausted', 'Não foi possível gerar uma URL única para a loja. Tente novamente.')
    }

    const storeRef = db.collection('stores').doc()
    const storeId = storeRef.id
    const plan = userData.plan || 'essential'
    const billingCycle = userData.billingCycle || 'monthly'

    const newStoreData = {
      name: storeName,
      storeName: storeName,
      storeId: storeId,
      storeDocId: storeId,
      slug: finalSlug,
      storeSlug: finalSlug,
      storeKeys: [storeId, finalSlug],
      ownerId: uid,
      ownerUid: uid,
      ownerEmail: userData.email || '',
      city: userData.signup?.city || '',
      category: userData.signup?.segment || '',
      segment: userData.signup?.segment || '',
      isActive: true,
      isOpen: false,
      isBlocked: false,
      isDeleted: false,
      subscriptionStatus: 'checkout_pending',
      onboardingStatus: 'billing_pending',
      plan,
      billingCycle,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      source: 'self_signup_billing_pending'
    }

    const newUserData = {
      storeId: storeId,
      storeIds: [storeId],
      storeKeys: [storeId, finalSlug],
      subscriptionStatus: 'checkout_pending',
      onboardingStatus: 'billing_pending',
      plan,
      billingCycle,
      updatedAt: now
    }

    const claimRef = db.collection('storeSlugClaims').doc(finalSlug)
    transaction.set(claimRef, {
      storeId: storeId,
      ownerUid: uid,
      claimedAt: now,
      source: 'start_free_trial'
    })

    transaction.set(storeRef, newStoreData)
    transaction.update(userRef, newUserData)

    logger.info(`[startFreeTrial] Loja ${storeId} criada como pendente de billing para o lojista ${uid} (onboardingStatus: received=${onboardingStatus}, phoneVerified=${userData.phoneVerified}).`)

    return {
      ok: true,
      storeId: storeId,
      storeSlug: finalSlug,
      nextPath: '/dashboard/billing'
    }
  })
})

exports.adminCreateStore = onCall({ region: 'southamerica-east1' }, async (request) => {
  const callerUid = request.auth?.uid
  if (!callerUid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const callerDoc = await db.collection('users').doc(callerUid).get()
  if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Usuário não encontrado.')
  const callerData = callerDoc.data()
  if (!['admin', 'developer', 'dev'].includes(callerData.role)) {
    throw new HttpsError('permission-denied', 'Permissão negada.')
  }

  const vData = request.data || {}
  const email = String(vData.email || '').trim().toLowerCase()
  const password = vData.password
  const name = String(vData.name || '').trim()
  const ownerName = String(vData.ownerName || '').trim()
  const whatsappRaw = String(vData.whatsapp || '').trim()
  const plan = vData.planId || vData.plan
  const billingCycle = vData.billingCycle || 'monthly'
  const subscriptionStatus = vData.subscriptionStatus || 'trialing'
  const customSlug = String(vData.customSlug || '').trim()

  const normalizedPhone = normalizeBrazilianPhone(whatsappRaw)
  if (!normalizedPhone) throw new HttpsError('invalid-argument', 'WhatsApp inválido.')
  const { phoneE164, phoneDigits } = normalizedPhone

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.')
  if (!password || password.length < 8) throw new HttpsError('invalid-argument', 'A senha precisa ter pelo menos 8 caracteres.')
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpsError('invalid-argument', 'A senha precisa misturar letras e números.')
  }
  if (!name) throw new HttpsError('invalid-argument', 'Nome da loja obrigatório.')
  if (!ownerName) throw new HttpsError('invalid-argument', 'Nome do proprietário obrigatório.')

  if (!['essential', 'professional', 'premium'].includes(plan)) {
    throw new HttpsError('invalid-argument', 'Plano inválido. Use essential, professional ou premium.')
  }
  if (!['monthly', 'annual'].includes(billingCycle)) {
    throw new HttpsError('invalid-argument', 'Ciclo de pagamento inválido.')
  }
  if (!['trialing', 'active', 'blocked'].includes(subscriptionStatus)) {
    throw new HttpsError('invalid-argument', 'Status de assinatura inválido. Use apenas trialing, active ou blocked.')
  }

  const normalizedPlan = plan
  const normalizedSubscriptionStatus = subscriptionStatus

  try {
    await admin.auth().getUserByEmail(email)
    throw new HttpsError('already-exists', 'Já existe uma conta com este e-mail.')
  } catch (err) {
    if (err.code !== 'auth/user-not-found' && err.code !== 'already-exists') {
      throw new HttpsError('internal', 'Erro ao verificar e-mail.')
    }
    if (err.code === 'already-exists') throw err
  }

  const merchantUid = db.collection('users').doc().id

  await admin.auth().createUser({
    uid: merchantUid,
    email: email,
    password: password,
    displayName: ownerName,
  })

  try {
    const storeRef = db.collection('stores').doc()
    const storeId = storeRef.id

    const storeName = name
    const slugBaseInput = customSlug || storeName
    const baseSlug = normalizeText(slugBaseInput).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'loja'

    const result = await db.runTransaction(async (transaction) => {
      let finalSlug = null
      let candidateSlug = baseSlug

      for (let i = 0; i < 5; i++) {
        const claimRef = db.collection('storeSlugClaims').doc(candidateSlug)
        const claimDoc = await transaction.get(claimRef)
        if (!claimDoc.exists) {
          finalSlug = candidateSlug
          break
        }
        const suffix = crypto.randomBytes(3).toString('hex')
        candidateSlug = `${baseSlug}-${suffix}`
      }

      if (!finalSlug) {
        throw new HttpsError('resource-exhausted', 'Não foi possível gerar slug. Tente novamente.')
      }

      const now = admin.firestore.Timestamp.now()
      const fourteenDaysLater = admin.firestore.Timestamp.fromMillis(now.toMillis() + 14 * 24 * 60 * 60 * 1000)

      const storePayload = {
        name: storeName,
        storeName: storeName,
        slug: finalSlug,
        storeSlug: finalSlug,
        ownerId: merchantUid,
        ownerUid: merchantUid,
        ownerEmail: email,
        ownerName: ownerName,
        city: vData.city || '',
        category: vData.category || 'Restaurante',
        segment: vData.category || 'Restaurante',
        whatsapp: phoneE164,
        whatsapp1: phoneE164,
        isActive: vData.isActive !== false,
        isOpen: vData.isOpen !== false,
        isBlocked: false,
        isDeleted: false,
        subscriptionStatus: normalizedSubscriptionStatus,
        onboardingStatus: 'completed',
        plan: normalizedPlan,
        billingCycle: billingCycle,
        createdAt: now,
        updatedAt: now,
        createdBy: callerUid,
        createdByRole: callerData.role,
        source: 'admin_create_store'
      }

      if (normalizedSubscriptionStatus === 'trialing') {
        storePayload.trialStartedAt = now
        storePayload.trialEndsAt = fourteenDaysLater
      }

      const userPayload = {
        uid: merchantUid,
        role: 'merchant',
        displayName: ownerName,
        name: ownerName,
        email: email,
        phone: phoneDigits,
        phoneE164: phoneE164,
        phoneVerified: true,
        phoneVerifiedSource: 'admin_manual',
        phoneVerifiedAt: now,
        storeId: storeId,
        storeIds: [storeId],
        storeKeys: [storeId, finalSlug],
        plan: normalizedPlan,
        billingCycle: billingCycle,
        subscriptionStatus: normalizedSubscriptionStatus,
        onboardingStatus: 'completed',
        createdAt: now,
        updatedAt: now,
        createdBy: callerUid,
        createdByRole: callerData.role,
        source: 'admin_create_store'
      }

      const claimRef = db.collection('storeSlugClaims').doc(finalSlug)
      transaction.set(claimRef, {
        storeId: storeId,
        ownerUid: merchantUid,
        claimedAt: now,
        source: 'admin_create_store'
      })

      transaction.set(storeRef, storePayload)
      transaction.set(db.collection('users').doc(merchantUid), userPayload)

      return {
        storeId,
        storeSlug: finalSlug
      }
    })

    return {
      ok: true,
      uid: merchantUid,
      storeId: result.storeId,
      storeSlug: result.storeSlug,
      publicUrl: `/${result.storeSlug}`,
      temporaryPasswordWasSet: true
    }
  } catch (error) {
    try {
      await admin.auth().deleteUser(merchantUid)
      logger.info(`Orphan Auth user deleted: ${merchantUid}`)
    } catch (cleanupError) {
      logger.error(`Failed to cleanup Auth user ${merchantUid}:`, cleanupError)
    }

    if (error instanceof HttpsError) {
      throw error
    }

    logger.error('Error in adminCreateStore:', error)
    throw new HttpsError('internal', 'Erro interno ao criar loja e usuário.')
  }
})

// Callable: acceptLatestTerms
exports.acceptLatestTerms = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado.')
    }

    const allowedKeys = []
    const dataKeys = Object.keys(request.data || {})
    if (dataKeys.some((key) => !allowedKeys.includes(key))) {
      throw new HttpsError('invalid-argument', 'Payload inválido.')
    }

    const userRef = db.collection('users').doc(request.auth.uid)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'Perfil do usuário não encontrado.')
    }

    const legalVersions = await getLatestLegalVersions()

    await userRef.update({
      termsAccepted: true,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsVersion: legalVersions.termsVersion,
      privacyVersion: legalVersions.privacyVersion,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      ok: true,
      termsVersion: legalVersions.termsVersion,
      privacyVersion: legalVersions.privacyVersion,
    }
  }
)

exports.updateBillingNotificationPreferences = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado.')
    }

    const data = request.data || {}
    const allowedKeys = ['trialReminderEmailOptIn']
    const dataKeys = Object.keys(data)
    if (
      dataKeys.some((key) => !allowedKeys.includes(key)) ||
      typeof data.trialReminderEmailOptIn !== 'boolean'
    ) {
      throw new HttpsError('invalid-argument', 'Preferência inválida.')
    }

    const userRef = db.collection('users').doc(request.auth.uid)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'Perfil do usuário não encontrado.')
    }

    await userRef.update({
      trialReminderEmailOptIn: data.trialReminderEmailOptIn,
      trialReminderEmailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      ok: true,
      trialReminderEmailOptIn: data.trialReminderEmailOptIn,
    }
  }
)

exports.updateMyProfile = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado.')
    }

    const uid = request.auth.uid

    const FORBIDDEN = [
      'role', 'storeId', 'storeIds', 'storeKeys', 'phoneVerified',
      'subscriptionStatus', 'onboardingStatus', 'plan', 'billingCycle',
      'trialStartedAt', 'trialEndsAt', 'createdAt', 'createdBy',
      'termsAccepted', 'termsAcceptedAt', 'termsVersion', 'privacyVersion',
      'marketingOptIn', 'marketingOptInAt', 'marketingOptInSource',
      'trialReminderEmailOptIn', 'trialReminderEmailUpdatedAt',
    ]

    for (const field of FORBIDDEN) {
      if (request.data?.[field] !== undefined) {
        throw new HttpsError(
          'permission-denied',
          `Campo "${field}" não pode ser alterado por esta função.`
        )
      }
    }

    const { displayName, photoURL, avatarUrl } = request.data ?? {}

    if (displayName !== undefined) {
      const name = String(displayName ?? '').trim()
      if (name.length < 2 || name.length > 80) {
        throw new HttpsError('invalid-argument', 'Nome deve ter entre 2 e 80 caracteres.')
      }
    }

    function isCloudinaryUrl(url) {
      if (!url) return true
      try {
        return new URL(url).hostname === 'res.cloudinary.com'
      } catch {
        return false
      }
    }

    if (photoURL && !isCloudinaryUrl(photoURL)) {
      throw new HttpsError('invalid-argument', 'URL de foto inválida. Use o Cloudinary.')
    }
    if (avatarUrl && !isCloudinaryUrl(avatarUrl)) {
      throw new HttpsError('invalid-argument', 'URL de avatar inválida. Use o Cloudinary.')
    }

    const patch = {}

    if (displayName !== undefined) {
      const name = String(displayName).trim()
      patch.displayName = name
      patch.name = name
    }
    if (photoURL !== undefined) patch.photoURL = photoURL || null
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl || null

    if (Object.keys(patch).length === 0) {
      return { ok: true, message: 'Nada para atualizar.' }
    }

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    await db.collection('users').doc(uid).update(patch)

    return { ok: true, updated: Object.keys(patch) }
  }
)

// ---------------------------------------------------------------------------
// Audit: registra alterações de status da loja (isOpen, isActive, etc.)
// Permite rastrear quando o lojista abriu/fechou a loja em disputas.
// ---------------------------------------------------------------------------
exports.auditStoreChanges = onDocumentUpdated(
  {
    document: 'stores/{storeId}',
    region: 'southamerica-east1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (event) => {
    const beforeData = event.data?.before?.data() || {}
    const afterData = event.data?.after?.data() || {}
    const storeId = event.params.storeId

    const AUDITED_FIELDS = [
      'isOpen',
      'isActive',
      'isPaused',
      'pausedAt',
      'openedAt',
      'closedAt',
      'subscriptionStatus',
      'isBillingBlocked',
    ]

    const changedFields = AUDITED_FIELDS.filter((field) => {
      return JSON.stringify(beforeData[field] ?? null) !== JSON.stringify(afterData[field] ?? null)
    })

    if (!changedFields.length) return

    let action = 'store_updated'
    if ('isOpen' in beforeData && beforeData.isOpen !== afterData.isOpen) {
      action = afterData.isOpen ? 'store_opened' : 'store_closed'
    } else if ('isActive' in beforeData && beforeData.isActive !== afterData.isActive) {
      action = afterData.isActive ? 'store_activated' : 'store_deactivated'
    }

    await createAuditLog({
      action,
      entity: 'store',
      entityId: storeId,
      storeId,
      storeSlug: afterData.storeSlug || afterData.slug || beforeData.storeSlug || '',
      actorUid: afterData.updatedBy || afterData.lastUpdatedBy || null,
      changedFields,
      before: Object.fromEntries(changedFields.map((f) => [f, beforeData[f] ?? null])),
      after: Object.fromEntries(changedFields.map((f) => [f, afterData[f] ?? null])),
    })
  }
)

// ---------------------------------------------------------------------------
// Scheduler: limpa usuários anônimos do Firebase Auth com mais de 30 dias.
// Evita acumulação ilimitada de contas fantasmas de visitantes da storefront.
// Roda diariamente as 03:00 no horario de Brasilia (06:00 UTC).
// ---------------------------------------------------------------------------
exports.cleanupAnonymousUsers = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'UTC',
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const cleanupEnabled = String(process.env.CLEANUP_ANONYMOUS_USERS_ENABLED || '').toLowerCase() === 'true'
    const dryRun = String(process.env.CLEANUP_ANONYMOUS_USERS_DRY_RUN || 'true').toLowerCase() !== 'false'
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)

    let nextPageToken = undefined
    let totalDeleted = 0
    let totalEligible = 0
    let totalScanned = 0

    try {
      do {
        const listResult = await admin.auth().listUsers(1000, nextPageToken)
        nextPageToken = listResult.pageToken

        const toDelete = listResult.users
          .filter((u) => {
            // Anonymous users have no providerData entries
            if (!u.providerData || u.providerData.length > 0) return false
            const lastSignIn = u.metadata?.lastSignInTime
              ? new Date(u.metadata.lastSignInTime)
              : null
            const created = u.metadata?.creationTime
              ? new Date(u.metadata.creationTime)
              : null
            const referenceDate = lastSignIn || created
            return referenceDate && referenceDate < cutoff
          })
          .map((u) => u.uid)

        totalScanned += listResult.users.length
        totalEligible += toDelete.length

        if (toDelete.length > 0 && cleanupEnabled && !dryRun) {
          // deleteUsers accepts up to 1000 UIDs per call
          for (let i = 0; i < toDelete.length; i += 1000) {
            const chunk = toDelete.slice(i, i + 1000)
            await admin.auth().deleteUsers(chunk)
            totalDeleted += chunk.length
          }
        }
      } while (nextPageToken)

      logger.info('[cleanupAnonymousUsers] completed', {
        cleanupEnabled,
        dryRun,
        totalScanned,
        totalEligible,
        totalDeleted,
      })
    } catch (error) {
      logger.error('[cleanupAnonymousUsers] Erro durante limpeza:', error)
      throw error
    }
  }
)

async function deleteDocsInChunks(docs, chunkSize = 450) {
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch()
    docs.slice(i, i + chunkSize).forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
  }
}

async function commitPublicCatalogActions(actions, summary) {
  for (let i = 0; i < actions.length; i += 450) {
    const batch = db.batch()
    actions.slice(i, i + 450).forEach((action) => {
      if (action.type === 'set') batch.set(action.ref, action.data, { merge: false })
      if (action.type === 'delete') batch.delete(action.ref)
    })
    await batch.commit()
    summary.batchesCommitted += 1
  }
}

async function deletePublicStoreTree(storeId, summary) {
  const publicRef = db.collection('publicStores').doc(storeId)
  const [productsSnap, categoriesSnap] = await Promise.all([
    publicRef.collection('products').get(),
    publicRef.collection('categories').get(),
  ])

  await commitPublicCatalogActions([
    ...productsSnap.docs.map((docSnapshot) => ({ type: 'delete', ref: docSnapshot.ref })),
    ...categoriesSnap.docs.map((docSnapshot) => ({ type: 'delete', ref: docSnapshot.ref })),
    { type: 'delete', ref: publicRef },
  ], summary)

  summary.publicStoresRemoved += 1
  summary.productsRemoved += productsSnap.size
  summary.categoriesRemoved += categoriesSnap.size
}

async function loadSourceDocsByStoreKeys(collectionName, keys) {
  const docs = new Map()
  const safeKeys = uniqueTruthy(keys).slice(0, 30)

  for (let i = 0; i < safeKeys.length; i += 10) {
    const chunk = safeKeys.slice(i, i + 10)
    const sourceQuery = chunk.length === 1
      ? db.collection(collectionName).where('storeId', '==', chunk[0])
      : db.collection(collectionName).where('storeId', 'in', chunk)
    const snapshot = await sourceQuery.get()
    snapshot.docs.forEach((docSnapshot) => docs.set(docSnapshot.id, docSnapshot))
  }

  return Array.from(docs.values())
}

async function reconcilePublicSubcollection({
  storeId,
  collectionName,
  sourceDocs,
  isPublic,
  sanitizePublic,
  idField,
  summaryPrefix,
  summary,
}) {
  const publicRef = db.collection('publicStores').doc(storeId).collection(collectionName)
  const publicSnapshot = await publicRef.get()
  const sourceIds = new Set(sourceDocs.map((docSnapshot) => docSnapshot.id))
  const actions = []

  sourceDocs.forEach((docSnapshot) => {
    const data = docSnapshot.data() || {}
    const targetRef = publicRef.doc(docSnapshot.id)

    if (isPublic(data)) {
      actions.push({
        type: 'set',
        ref: targetRef,
        data: {
          ...sanitizePublic(data),
          id: docSnapshot.id,
          [idField]: docSnapshot.id,
          storeId,
        },
      })
      summary[`${summaryPrefix}Written`] += 1
    } else {
      actions.push({ type: 'delete', ref: targetRef })
      summary[`${summaryPrefix}Removed`] += 1
    }
  })

  publicSnapshot.docs.forEach((publicDoc) => {
    if (!sourceIds.has(publicDoc.id)) {
      actions.push({ type: 'delete', ref: publicDoc.ref })
      summary[`${summaryPrefix}Removed`] += 1
    }
  })

  await commitPublicCatalogActions(actions, summary)
}

async function reconcilePublicCatalogStore(storeDoc, summary) {
  const storeId = storeDoc.id
  const storeData = storeDoc.data() || {}
  summary.storesProcessed += 1

  if (!isPublicStoreVisible(storeData)) {
    await deletePublicStoreTree(storeId, summary)
    return
  }

  const storeRecord = { id: storeId, data: storeData }
  const storeKeys = getStoreLookupKeys(storeRecord)
  const [productDocs, categoryDocs] = await Promise.all([
    loadSourceDocsByStoreKeys('products', storeKeys),
    loadSourceDocsByStoreKeys('categories', storeKeys),
  ])

  await commitPublicCatalogActions([
    {
      type: 'set',
      ref: db.collection('publicStores').doc(storeId),
      data: {
        ...buildPublicStoreProfile(storeId, storeData, 'publicStores'),
        publicUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
  ], summary)
  summary.publicStoresWritten += 1

  await Promise.all([
    reconcilePublicSubcollection({
      storeId,
      collectionName: 'products',
      sourceDocs: productDocs,
      isPublic: publicProductIsVisible,
      sanitizePublic: (product) => sanitizePublicProduct(product, storeData),
      idField: 'productId',
      summaryPrefix: 'products',
      summary,
    }),
    reconcilePublicSubcollection({
      storeId,
      collectionName: 'categories',
      sourceDocs: categoryDocs,
      isPublic: publicCategoryIsVisible,
      sanitizePublic: sanitizePublicCategory,
      idField: 'categoryId',
      summaryPrefix: 'categories',
      summary,
    }),
  ])
}

const PUBLIC_CATALOG_PLAN_FIELDS = [
  'subscriptionStatus',
  'subscription',
  'isBillingBlocked',
  'isBlocked',
  'isDeleted',
  'deletedAt',
  'effectivePlan',
  'billingPlan',
  'selectedPlan',
  'plan',
  'planId',
  'trialStatus',
  'trial',
  'trialEndsAt',
  'trialEndAt',
  'trialEntitlementsPlan',
]

function publicCatalogEntitlementsChanged(beforeData, afterData) {
  if (!beforeData) return true
  if (isPublicStoreVisible(beforeData) !== isPublicStoreVisible(afterData)) return true
  return PUBLIC_CATALOG_PLAN_FIELDS.some((field) => {
    return JSON.stringify(beforeData[field] ?? null) !== JSON.stringify(afterData[field] ?? null)
  })
}

const PUBLIC_APP_ORIGIN = 'https://pratoby.com'
const DEFAULT_OG_IMAGE = `${PUBLIC_APP_ORIGIN}/og/pratoby-cover.png`
const DEFAULT_OG_IMAGE_ALT = 'PratoBy - cardápio digital e delivery sem comissão'
const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
const NOINDEX_ROBOTS = 'noindex, follow'
const NOINDEX_NOFOLLOW_ROBOTS = 'noindex, nofollow'
const SEO_INDEX_CACHE_MS = 60 * 1000
const HOME_SEO_DESCRIPTION =
  'Crie uma loja online para restaurante, lanchonete ou confeitaria. Receba pedidos pelo seu próprio link, organize entregas e venda sem comissão por pedido.'
const INSTITUTIONAL_SEO_ROUTES = {
  '/': {
    title: 'PratoBy | Cardápio digital e delivery sem comissão',
    description: HOME_SEO_DESCRIPTION,
  },
  '/planos': {
    title: 'Planos PratoBy | Delivery próprio sem comissão',
    description:
      'Compare os planos do PratoBy para vender online com cardápio digital, pedidos em tempo real, pagamentos e recursos para crescer sem comissão por venda.',
  },
  '/sobre': {
    title: 'Sobre o PratoBy | Cardápio digital para vender direto',
    description:
      'Conheça o PratoBy, uma plataforma de cardápio digital e delivery próprio para lojistas venderem pelo próprio link, com pedidos organizados e sem comissão.',
  },
  '/contato': {
    title: 'Contato | PratoBy',
    description:
      'Fale com o PratoBy para criar seu cardápio digital, tirar dúvidas sobre planos ou começar sua loja online com venda direta e sem comissão.',
  },
  '/exemplos': {
    title: 'Exemplos de lojas PratoBy | Cardápio digital na prática',
    description:
      'Veja exemplos oficiais de lojas no PratoBy para restaurantes, lanchonetes e confeitarias venderem pelo próprio link sem comissão por pedido.',
  },
  '/privacidade': {
    title: 'Política de Privacidade | PratoBy',
    description:
      'Entenda como o PratoBy coleta, usa e protege dados de lojistas e clientes em sua plataforma de cardápio digital e pedidos online.',
  },
  '/termos': {
    title: 'Termos de Uso | PratoBy',
    description:
      'Consulte as regras de uso do PratoBy para lojistas, pedidos online, assinaturas, lojas públicas e serviços digitais.',
  },
  '/cardapio-digital': {
    title: 'Cardápio digital para vender online | PratoBy',
    description:
      'Crie um cardápio digital com link próprio, produtos, categorias, carrinho e pedidos online para vender direto sem comissão por pedido.',
  },
  '/delivery-sem-comissao': {
    title: 'Delivery sem comissão para restaurantes | PratoBy',
    description:
      'Receba pedidos online pelo próprio link, organize entregas e venda sem pagar comissão por pedido com o PratoBy.',
  },
  '/sistema-para-confeitaria': {
    title: 'Sistema para confeitaria com encomendas online | PratoBy',
    description:
      'Monte uma loja online para confeitaria, receba pedidos e encomendas pelo próprio link e organize tudo em um painel simples.',
  },
  '/sistema-para-lanchonete': {
    title: 'Sistema para lanchonete vender online | PratoBy',
    description:
      'Crie uma loja online para lanchonete, receba pedidos pelo próprio link e organize entrega, retirada e pagamentos sem comissão por pedido.',
  },
  '/sistema-para-pizzaria': {
    title: 'Sistema para pizzaria com pedidos online | PratoBy',
    description:
      'Venda pizzas pelo próprio link, organize sabores, adicionais, entrega e retirada em uma loja online sem comissão por pedido.',
  },
  '/cardapio-digital-para-restaurante': {
    title: 'Cardápio digital para restaurante | PratoBy',
    description:
      'Monte um cardápio digital para restaurante, receba pedidos online e venda direto pelo seu próprio link sem comissão por venda.',
  },
  '/Cardapio-Digital': {
    title: 'Loja online para restaurante sem comissão | PratoBy',
    description:
      'Crie uma loja online para restaurante com cardápio, carrinho, pedidos e painel de gestão para vender direto sem comissão.',
  },
}
let cachedSeoIndexHtml = ''
let cachedSeoIndexLoadedAt = 0

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ALLOWED_PUBLIC_IMAGE_HOSTS = new Set([
  'pratoby.com',
  'www.pratoby.com',
  'res.cloudinary.com',
])

function absolutePublicUrl(value) {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) return ''

  if (rawUrl.startsWith('/')) {
    return `${PUBLIC_APP_ORIGIN}${rawUrl}`
  }

  try {
    const parsed = new URL(rawUrl)

    if (!ALLOWED_PUBLIC_IMAGE_HOSTS.has(parsed.hostname)) return ''
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    if (parsed.protocol !== 'https:') return ''

    return parsed.toString()
  } catch (_error) {
    return ''
  }
}

const STORE_FAVICON_TRANSFORM =
  'f_png,q_auto/e_trim/c_fill,w_164,h_164,g_auto,r_42/c_pad,w_192,h_192,b_transparent'

function transformCloudinaryPublicUrl(value, transformation) {
  const url = absolutePublicUrl(value)

  if (!url) return ''
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url
  }

  const marker = '/image/upload/'
  const markerIndex = url.indexOf(marker)

  if (markerIndex === -1) return url

  const prefix = url.slice(0, markerIndex + marker.length)
  const afterUpload = url.slice(markerIndex + marker.length)
  const versionMatch = afterUpload.match(/(^|\/)v\d+\//)

  if (versionMatch) {
    const versionIndex = versionMatch.index + (versionMatch[0].startsWith('/') ? 1 : 0)
    const suffix = afterUpload.slice(versionIndex)

    return `${prefix}${transformation}/${suffix}`
  }

  return `${prefix}${transformation}/${afterUpload.replace(/^\/+/, '')}`
}

function buildSeoFaviconUrl(value) {
  const url = absolutePublicUrl(value)

  if (!url) return `${PUBLIC_APP_ORIGIN}/icons/android-chrome-192x192.png?v=5`

  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url
  }

  return transformCloudinaryPublicUrl(url, STORE_FAVICON_TRANSFORM)
}

function normalizePreviewImageUrl(url) {
  const imageUrl = String(url || '').trim()
  if (!imageUrl) return ''

  if (!imageUrl.includes('res.cloudinary.com') || !imageUrl.includes('/image/upload/')) {
    return imageUrl
  }

  if (/\/image\/upload\/[^/]*(?:c_fill,w_1200,h_630|w_1200,h_630,c_fill)/.test(imageUrl)) {
    return imageUrl
  }

  return imageUrl.replace(
    '/image/upload/',
    '/image/upload/f_jpg,q_auto:good,c_fill,w_1200,h_630,g_auto/'
  )
}

function getPreviewImageType(url) {
  const cleanUrl = String(url || '').split('?')[0].toLowerCase()
  if (cleanUrl.includes('res.cloudinary.com') && cleanUrl.includes('/f_jpg,')) return 'image/jpeg'
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanUrl.endsWith('.webp')) return 'image/webp'
  if (cleanUrl.endsWith('.png')) return 'image/png'
  return 'image/jpeg'
}

function replaceOrInsertHeadTag(html, matcher, tag) {
  const flags = matcher.flags.includes('g') ? matcher.flags : `${matcher.flags}g`
  const globalMatcher = new RegExp(matcher.source, flags)
  let replaced = false
  const nextHtml = html.replace(globalMatcher, () => {
    if (replaced) return ''
    replaced = true
    return tag
  })

  if (replaced) return nextHtml
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`)
}

function normalizeInstitutionalSeoPath(value) {
  const rawPath = String(value || '/').split('?')[0].split('#')[0].trim() || '/'
  const withSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const cleanPath = withSlash.replace(/\/{2,}/g, '/')

  if (cleanPath === '/index.html') return '/'
  if (cleanPath.length > 1) return cleanPath.replace(/\/+$/, '')
  return '/'
}

function getInstitutionalSeoMeta(path) {
  const cleanPath = normalizeInstitutionalSeoPath(path)
  const route = INSTITUTIONAL_SEO_ROUTES[cleanPath]

  if (!route) return null

  const canonical = cleanPath === '/'
    ? `${PUBLIC_APP_ORIGIN}/`
    : `${PUBLIC_APP_ORIGIN}${cleanPath}`

  return {
    ...route,
    path: cleanPath,
    canonical,
    image: DEFAULT_OG_IMAGE,
    imageType: getPreviewImageType(DEFAULT_OG_IMAGE),
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    robots: INDEX_ROBOTS,
  }
}

function buildInstitutionalWebPageJsonLd(meta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${meta.canonical}#webpage`,
    url: meta.canonical,
    name: meta.title,
    description: meta.description,
    isPartOf: {
      '@id': `${PUBLIC_APP_ORIGIN}/#website`,
    },
    publisher: {
      '@id': `${PUBLIC_APP_ORIGIN}/#organization`,
    },
    inLanguage: 'pt-BR',
  }
}

function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

function buildInstitutionalJsonLd(meta) {
  const graph = [buildInstitutionalWebPageJsonLd(meta)]

  if (meta.path !== '/') {
    graph.push(buildBreadcrumbJsonLd([
      { name: 'Início', url: `${PUBLIC_APP_ORIGIN}/` },
      { name: meta.title.replace(/\s\|\sPratoBy.*/, ''), url: meta.canonical },
    ]))
  }

  return graph
}

function buildJsonLdScript(jsonLd) {
  const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
  return `<script type="application/ld+json" data-pratoby-institutional-seo="true">${safeJson}</script>`
}

function injectInstitutionalSeo(html, meta) {
  let nextHtml = html.replace(
    /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])(?=[^>]*\bdata-pratoby-institutional-seo=["']true["'])[\s\S]*?<\/script>/gi,
    ''
  )

  const safeTitle = escapeHtml(meta.title)
  const safeDescription = escapeHtml(meta.description)
  const safeCanonical = escapeHtml(meta.canonical)
  const safeImage = escapeHtml(meta.image || DEFAULT_OG_IMAGE)
  const safeImageType = escapeHtml(meta.imageType || getPreviewImageType(meta.image || DEFAULT_OG_IMAGE))
  const safeImageAlt = escapeHtml(meta.imageAlt || DEFAULT_OG_IMAGE_ALT)
  const safeRobots = escapeHtml(meta.robots || INDEX_ROBOTS)

  const tags = [
    [/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`],
    [/<meta\b(?=[^>]*\bname=["']description["'])[\s\S]*?>/i, `<meta name="description" content="${safeDescription}">`],
    [/<meta\b(?=[^>]*\bname=["']robots["'])[\s\S]*?>/i, `<meta name="robots" content="${safeRobots}">`],
    [/<meta\b(?=[^>]*\bname=["']googlebot["'])[\s\S]*?>/i, `<meta name="googlebot" content="${safeRobots}">`],
    [/<link\b(?=[^>]*\brel=["']canonical["'])[\s\S]*?>/i, `<link rel="canonical" href="${safeCanonical}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:locale["'])[\s\S]*?>/i, '<meta property="og:locale" content="pt_BR">'],
    [/<meta\b(?=[^>]*\bproperty=["']og:type["'])[\s\S]*?>/i, '<meta property="og:type" content="website">'],
    [/<meta\b(?=[^>]*\bproperty=["']og:site_name["'])[\s\S]*?>/i, '<meta property="og:site_name" content="PratoBy">'],
    [/<meta\b(?=[^>]*\bproperty=["']og:url["'])[\s\S]*?>/i, `<meta property="og:url" content="${safeCanonical}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:title["'])[\s\S]*?>/i, `<meta property="og:title" content="${safeTitle}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:description["'])[\s\S]*?>/i, `<meta property="og:description" content="${safeDescription}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:image["'])[\s\S]*?>/i, `<meta property="og:image" content="${safeImage}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:url["'])[\s\S]*?>/i, `<meta property="og:image:url" content="${safeImage}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:secure_url["'])[\s\S]*?>/i, `<meta property="og:image:secure_url" content="${safeImage}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:type["'])[\s\S]*?>/i, `<meta property="og:image:type" content="${safeImageType}">`],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:width["'])[\s\S]*?>/i, '<meta property="og:image:width" content="1200">'],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:height["'])[\s\S]*?>/i, '<meta property="og:image:height" content="630">'],
    [/<meta\b(?=[^>]*\bproperty=["']og:image:alt["'])[\s\S]*?>/i, `<meta property="og:image:alt" content="${safeImageAlt}">`],
    [/<meta\b(?=[^>]*\bname=["']twitter:card["'])[\s\S]*?>/i, '<meta name="twitter:card" content="summary_large_image">'],
    [/<meta\b(?=[^>]*\bname=["']twitter:title["'])[\s\S]*?>/i, `<meta name="twitter:title" content="${safeTitle}">`],
    [/<meta\b(?=[^>]*\bname=["']twitter:description["'])[\s\S]*?>/i, `<meta name="twitter:description" content="${safeDescription}">`],
    [/<meta\b(?=[^>]*\bname=["']twitter:image["'])[\s\S]*?>/i, `<meta name="twitter:image" content="${safeImage}">`],
    [/<meta\b(?=[^>]*\bname=["']twitter:image:alt["'])[\s\S]*?>/i, `<meta name="twitter:image:alt" content="${safeImageAlt}">`],
    [/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])(?=[^>]*\bdata-pratoby-institutional-seo=["']true["'])[\s\S]*?<\/script>/i, buildJsonLdScript(buildInstitutionalJsonLd(meta))],
  ]

  for (const [matcher, tag] of tags) {
    nextHtml = replaceOrInsertHeadTag(nextHtml, matcher, tag)
  }

  return nextHtml
}
function injectStorefrontSeo(html, meta) {
  let nextHtml = html

  const safeTitle = escapeHtml(meta.title)
  const safeDescription = escapeHtml(meta.description)
  const safeImage = escapeHtml(meta.image)
  const safeImageType = escapeHtml(meta.imageType || getPreviewImageType(meta.image))
  const safeImageAlt = escapeHtml(meta.imageAlt || meta.title || 'PratoBy')
  const safeCanonical = escapeHtml(meta.canonical)
  const safeRobots = escapeHtml(meta.robots || INDEX_ROBOTS)
  const faviconUrl = meta.favicon || `${PUBLIC_APP_ORIGIN}/favicon.ico`
  const safeFavicon = escapeHtml(faviconUrl)
  const safeFaviconType = faviconUrl.toLowerCase().endsWith('.ico') ? 'image/x-icon' : 'image/png'

  const tags = [
    [
      /<title\b[^>]*>[\s\S]*?<\/title>/i,
      `<title>${safeTitle}</title>`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,
      `<meta name="description" content="${safeDescription}">`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/i,
      `<meta name="robots" content="${safeRobots}">`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']googlebot["'])[^>]*>/i,
      `<meta name="googlebot" content="${safeRobots}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:title["'])[^>]*>/i,
      `<meta property="og:title" content="${safeTitle}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:description["'])[^>]*>/i,
      `<meta property="og:description" content="${safeDescription}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image["'])[\s\S]*?>/i,
      `<meta property="og:image" content="${safeImage}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:url["'])[\s\S]*?>/i,
      `<meta property="og:image:url" content="${safeImage}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:secure_url["'])[\s\S]*?>/i,
      `<meta property="og:image:secure_url" content="${safeImage}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:type["'])[\s\S]*?>/i,
      `<meta property="og:image:type" content="${safeImageType}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:width["'])[\s\S]*?>/i,
      '<meta property="og:image:width" content="1200">',
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:height["'])[\s\S]*?>/i,
      '<meta property="og:image:height" content="630">',
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:image:alt["'])[\s\S]*?>/i,
      `<meta property="og:image:alt" content="${safeImageAlt}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/i,
      `<meta property="og:url" content="${safeCanonical}">`,
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:type["'])[^>]*>/i,
      '<meta property="og:type" content="website">',
    ],
    [
      /<meta\b(?=[^>]*\bproperty=["']og:site_name["'])[^>]*>/i,
      '<meta property="og:site_name" content="PratoBy">',
    ],
    [
      /<meta\b(?=[^>]*\bname=["']twitter:card["'])[^>]*>/i,
      '<meta name="twitter:card" content="summary_large_image">',
    ],
    [
      /<meta\b(?=[^>]*\bname=["']twitter:title["'])[^>]*>/i,
      `<meta name="twitter:title" content="${safeTitle}">`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']twitter:description["'])[^>]*>/i,
      `<meta name="twitter:description" content="${safeDescription}">`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']twitter:image["'])[\s\S]*?>/i,
      `<meta name="twitter:image" content="${safeImage}">`,
    ],
    [
      /<meta\b(?=[^>]*\bname=["']twitter:image:alt["'])[\s\S]*?>/i,
      `<meta name="twitter:image:alt" content="${safeImageAlt}">`,
    ],
    [
      /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
      `<link rel="canonical" href="${safeCanonical}">`,
    ],
    [
      /<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/i,
      `<link rel="icon" href="${safeFavicon}" type="${safeFaviconType}" sizes="192x192">`,
    ],
    [
      /<link\b(?=[^>]*\brel=["']shortcut icon["'])[^>]*>/i,
      `<link rel="shortcut icon" href="${safeFavicon}" type="${safeFaviconType}">`,
    ],
    [
      /<link\b(?=[^>]*\brel=["']apple-touch-icon["'])[^>]*>/i,
      `<link rel="apple-touch-icon" href="${safeFavicon}" sizes="180x180">`,
    ],
    [
      /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])(?=[^>]*\bdata-pratoby-institutional-seo=["']true["'])[\s\S]*?<\/script>/i,
      meta.jsonLd ? buildJsonLdScript(meta.jsonLd) : '',
    ],
  ]

  for (const [matcher, tag] of tags) {
    nextHtml = replaceOrInsertHeadTag(nextHtml, matcher, tag)
  }

  return nextHtml
}

function truncateSeoText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text
    .slice(0, maxLength - 3)
    .replace(/\s+\S*$/, '')
    .trim()}...`
}

const OFFICIAL_INDEXABLE_STORE_SLUGS = new Set([
  'capivaras-lanches',
  'doce-capivara-confeitaria',
])

function isStoreUnavailableForSeo(store) {
  return (
    !store ||
    store.isActive === false ||
    store.isBlocked === true ||
    store.isBillingBlocked === true ||
    store.isDeleted === true ||
    Boolean(store.deletedAt)
  )
}

function shouldIndexPublicStore(store) {
  if (isStoreUnavailableForSeo(store)) return false

  const slug = String(store?.slug || store?.storeSlug || '').trim().toLowerCase()
  const explicitIndexingValue =
    store?.seoIndexingEnabled ??
    store?.allowSearchIndexing ??
    store?.isIndexable ??
    store?.searchIndexingEnabled

  if (explicitIndexingValue === true) return true
  if (explicitIndexingValue === false) return false

  return OFFICIAL_INDEXABLE_STORE_SLUGS.has(slug)
}

function buildStorefrontDescription(store, storeName) {
  const explicitDescription = String(
    store?.seoDescription ||
      store?.publicDescription ||
      ''
  ).trim()

  if (explicitDescription) return truncateSeoText(explicitDescription)

  const segment = String(store?.segment || store?.category || '').trim()

  if (segment) {
    return truncateSeoText(`Veja o cardápio online de ${segment} da ${storeName} e faça seu pedido pelo PratoBy.`)
  }

  return truncateSeoText(`Veja o cardápio da ${storeName}, escolha seus produtos e faça seu pedido online para entrega ou retirada.`)
}

function buildStorefrontJsonLd(store, meta) {
  const address = store?.address && typeof store.address === 'object' ? store.address : {}
  const city = String(store?.city || address.city || address.cidade || '').trim()
  const state = String(store?.state || address.state || address.uf || '').trim()
  const neighborhood = String(store?.neighborhood || address.neighborhood || address.bairro || '').trim()
  const segment = String(store?.segment || store?.category || '').trim()

  const postalAddress = {
    '@type': 'PostalAddress',
    addressLocality: city || undefined,
    addressRegion: state || undefined,
    addressCountry: 'BR',
  }

  Object.keys(postalAddress).forEach((key) => {
    if (!postalAddress[key]) delete postalAddress[key]
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: meta.storeName,
    description: meta.description,
    url: meta.canonical,
    menu: meta.canonical,
    hasMenu: meta.canonical,
    image: meta.image,
    servesCuisine: segment || undefined,
    address: Object.keys(postalAddress).length > 1 ? postalAddress : undefined,
    areaServed: city || neighborhood || undefined,
  }

  Object.keys(jsonLd).forEach((key) => {
    if (jsonLd[key] === undefined || jsonLd[key] === '') delete jsonLd[key]
  })

  return jsonLd
}
function buildStorefrontSeoMeta(store, requestedSlug = '') {
  const storeName = String(store?.name || store?.storeName || 'PratoBy').trim()
  const safeRequestedSlug = normalizePublicStoreLookupParam(requestedSlug)
  const slug =
    normalizePublicStoreLookupParam(getPublicStoreSlug('', store)) ||
    slugifyPublicStoreName(storeName) ||
    safeRequestedSlug ||
    'loja'
  const canonical = `${PUBLIC_APP_ORIGIN}/${slug}`
  const description = buildStorefrontDescription(store, storeName)

  const rawImage = absolutePublicUrl(
    store?.shareImageUrl ||
      store?.seoImageUrl ||
      store?.ogImageUrl ||
      store?.bannerUrl ||
      store?.coverUrl ||
      store?.bannerMobileUrl ||
      store?.mobileBannerUrl ||
      store?.logoUrl ||
      store?.logo
  ) || DEFAULT_OG_IMAGE
  const image = normalizePreviewImageUrl(rawImage) || DEFAULT_OG_IMAGE
  const title = `${storeName} | Cardápio digital - PratoBy`
  const indexable = shouldIndexPublicStore(store)

  const favicon = buildSeoFaviconUrl(
    store?.faviconUrl ||
      store?.logoIconUrl ||
      store?.logoUrl ||
      store?.logo
  )

  const meta = {
    title,
    storeName,
    description,
    image,
    imageType: getPreviewImageType(image),
    imageAlt: `${storeName} | Cardápio digital - PratoBy`,
    canonical,
    favicon,
    robots: indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS,
  }

  return {
    ...meta,
    jsonLd: indexable ? buildStorefrontJsonLd(store, meta) : null,
  }
}
async function loadStaticIndexHtml() {
  const now = Date.now()
  if (cachedSeoIndexHtml && now - cachedSeoIndexLoadedAt < SEO_INDEX_CACHE_MS) {
    return cachedSeoIndexHtml
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${PUBLIC_APP_ORIGIN}/index.html`, {
      headers: { accept: 'text/html' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`index.html fetch failed with ${response.status}`)
    const html = await response.text()
    cachedSeoIndexHtml = html
    cachedSeoIndexLoadedAt = now
    return html
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildMinimalSeoHtml(meta = {}) {
  const previewImage = normalizePreviewImageUrl(absolutePublicUrl(meta.image) || DEFAULT_OG_IMAGE) || DEFAULT_OG_IMAGE
  const safeMeta = {
    title: meta.title || 'PratoBy | Cardápio digital e delivery sem comissão',
    description: meta.description || HOME_SEO_DESCRIPTION,
    image: previewImage,
    imageType: getPreviewImageType(previewImage),
    imageAlt: meta.imageAlt || meta.title || 'PratoBy',
    canonical: absolutePublicUrl(meta.canonical) || `${PUBLIC_APP_ORIGIN}/`,
    robots: meta.robots || INDEX_ROBOTS,
  }
  const jsonLd = meta.jsonLd ? buildJsonLdScript(meta.jsonLd) : ''

  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(safeMeta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(safeMeta.description)}">`,
    `<meta name="robots" content="${escapeHtml(safeMeta.robots)}">`,
    `<meta name="googlebot" content="${escapeHtml(safeMeta.robots)}">`,
    '<meta name="theme-color" content="#f97316">',
    '<meta name="application-name" content="PratoBy">',
    `<link rel="canonical" href="${escapeHtml(safeMeta.canonical)}">`,
    '<link rel="icon" href="https://pratoby.com/icons/android-chrome-192x192.png?v=5" type="image/png" sizes="192x192">',
    '<link rel="shortcut icon" href="https://pratoby.com/icons/android-chrome-192x192.png?v=5" type="image/png">',
    '<link rel="apple-touch-icon" href="https://pratoby.com/icons/apple-touch-icon.png?v=5" sizes="180x180">',
    '<meta property="og:locale" content="pt_BR">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="PratoBy">',
    `<meta property="og:title" content="${escapeHtml(safeMeta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(safeMeta.description)}">`,
    `<meta property="og:image" content="${escapeHtml(safeMeta.image)}">`,
    `<meta property="og:image:url" content="${escapeHtml(safeMeta.image)}">`,
    `<meta property="og:image:secure_url" content="${escapeHtml(safeMeta.image)}">`,
    `<meta property="og:image:type" content="${escapeHtml(safeMeta.imageType)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escapeHtml(safeMeta.imageAlt)}">`,
    `<meta property="og:url" content="${escapeHtml(safeMeta.canonical)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:site" content="@pratobybr">',
    '<meta name="twitter:creator" content="@pratobybr">',
    `<meta name="twitter:title" content="${escapeHtml(safeMeta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(safeMeta.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(safeMeta.image)}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(safeMeta.imageAlt)}">`,
    jsonLd,
    '</head>',
    '<body>',
    '<main>PratoBy</main>',
    '</body>',
    '</html>',
  ].join('')
}

exports.storefrontSeoPreview = onRequest(
  {
    region: REGION,
    timeoutSeconds: 15,
    memory: '256MiB',
    minInstances: 0,
    maxInstances: 5,
    invoker: 'public',
  },
  async (request, response) => {
    const requestPath = normalizeInstitutionalSeoPath(request.path || request.url || '/')
    const institutionalMeta = getInstitutionalSeoMeta(requestPath)
    const slug = institutionalMeta
      ? ''
      : normalizePublicStoreLookupParam(request.path || request.url || '')
    response.set('Content-Type', 'text/html; charset=utf-8')
    response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

    let html
    try {
      html = await loadStaticIndexHtml()
    } catch (error) {
      logger.error('[storefrontSeoPreview] index html unavailable', {
        path: requestPath,
        slug,
        message: error?.message || String(error),
      })
      if (institutionalMeta) {
        response.status(200).send(buildMinimalSeoHtml({
          ...institutionalMeta,
          jsonLd: buildInstitutionalWebPageJsonLd(institutionalMeta),
        }))
        return
      }
      response.status(200).send(buildMinimalSeoHtml({
        canonical: slug ? `${PUBLIC_APP_ORIGIN}/${slug}` : PUBLIC_APP_ORIGIN,
      }))
      return
    }

    try {
      if (institutionalMeta) {
        response.status(200).send(injectInstitutionalSeo(html, institutionalMeta))
        return
      }

      if (!slug) {
        response.status(200).send(html)
        return
      }

      const storeRecord = await findPublicStoreByParam(slug)
      if (!storeRecord || !isStorePubliclyReadable(storeRecord.data)) {
        response.status(200).send(injectInstitutionalSeo(html, {
          title: 'Loja indisponível | PratoBy',
          description: 'Este cardápio não está disponível para indexação no PratoBy.',
          canonical: `${PUBLIC_APP_ORIGIN}/${slug}`,
          image: DEFAULT_OG_IMAGE,
          imageType: getPreviewImageType(DEFAULT_OG_IMAGE),
          imageAlt: DEFAULT_OG_IMAGE_ALT,
          robots: NOINDEX_NOFOLLOW_ROBOTS,
          path: `/${slug}`,
        }))
        return
      }

      const publicStore = buildPublicStoreProfile(storeRecord.id, storeRecord.data, storeRecord.collectionName)
      response.status(200).send(injectStorefrontSeo(html, buildStorefrontSeoMeta(publicStore, slug)))
    } catch (error) {
      logger.warn('[storefrontSeoPreview] seo injection failed, returning static index', {
        path: requestPath,
        slug,
        message: error?.message || String(error),
      })
      if (institutionalMeta) {
        response.status(200).send(html || buildMinimalSeoHtml({
          ...institutionalMeta,
          jsonLd: buildInstitutionalWebPageJsonLd(institutionalMeta),
        }))
        return
      }
      response.status(200).send(html || buildMinimalSeoHtml({
        canonical: slug ? `${PUBLIC_APP_ORIGIN}/${slug}` : PUBLIC_APP_ORIGIN,
      }))
    }
  }
)

exports.reconcilePublicCatalog = onSchedule(
  {
    schedule: 'every sunday 04:00',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
    minInstances: 0,
    maxInstances: 1,
  },
  async () => {
    const summary = {
      storesProcessed: 0,
      publicStoresWritten: 0,
      publicStoresRemoved: 0,
      productsWritten: 0,
      productsRemoved: 0,
      categoriesWritten: 0,
      categoriesRemoved: 0,
      batchesCommitted: 0,
      errors: [],
    }

    let lastDoc = null
    while (true) {
      let storesQuery = db.collection('stores')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(50)

      if (lastDoc) storesQuery = storesQuery.startAfter(lastDoc)

      const snapshot = await storesQuery.get()
      if (snapshot.empty) break

      for (const storeDoc of snapshot.docs) {
        try {
          await reconcilePublicCatalogStore(storeDoc, summary)
        } catch (error) {
          summary.errors.push({
            storeId: storeDoc.id,
            message: error?.message || String(error),
          })
          logger.error('[reconcilePublicCatalog] store failed', { storeId: storeDoc.id, error })
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1]
      if (snapshot.size < 50) break
    }

    logger.info('[reconcilePublicCatalog] summary', summary)
  }
)

exports.materializePublicStoreProfile = onDocumentWritten(
  { document: 'stores/{storeId}', region: REGION, maxInstances: 3 },
  async (event) => {
    const beforeData = event.data.before.data() || null
    const afterData = event.data.after.data()
    const storeId = event.params.storeId

    if (!afterData || !isPublicStoreVisible(afterData)) {
      const publicRef = db.collection('publicStores').doc(storeId)
      const [productsSnap, categoriesSnap] = await Promise.all([
        publicRef.collection('products').get(),
        publicRef.collection('categories').get()
      ])

      const allDocs = [...productsSnap.docs, ...categoriesSnap.docs]
      await deleteDocsInChunks(allDocs)
      await publicRef.delete()
    } else {
      await db.collection('publicStores').doc(storeId).set({
        ...buildPublicStoreProfile(storeId, afterData, 'publicStores'),
        publicUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false })

      if (publicCatalogEntitlementsChanged(beforeData, afterData)) {
        const summary = {
          storesProcessed: 0,
          publicStoresWritten: 0,
          publicStoresRemoved: 0,
          productsWritten: 0,
          productsRemoved: 0,
          categoriesWritten: 0,
          categoriesRemoved: 0,
          batchesCommitted: 0,
        }
        await reconcilePublicCatalogStore(event.data.after, summary)
        logger.info('[materializePublicStoreProfile] reconciled public catalog after entitlement change', { storeId, summary })
      }
    }
  }
)

exports.materializePublicProduct = onDocumentWritten(
  { document: 'products/{productId}', region: REGION, maxInstances: 3 },
  async (event) => {
    const beforeData = event.data.before.data()
    const afterData = event.data.after.data()
    const productId = event.params.productId

    const oldStoreId = beforeData?.storeId
    const newStoreId = afterData?.storeId

    if (oldStoreId && oldStoreId !== newStoreId) {
      await db.collection('publicStores')
        .doc(oldStoreId)
        .collection('products')
        .doc(productId)
        .delete()
    }

    if (!afterData || !newStoreId || !publicProductIsVisible(afterData)) {
      if (newStoreId) {
        await db.collection('publicStores')
          .doc(newStoreId)
          .collection('products')
          .doc(productId)
          .delete()
      }
    } else {
      const storeSnapshot = await db.collection('stores').doc(newStoreId).get()
      const storeData = storeSnapshot.exists ? storeSnapshot.data() || {} : {}
      if (!storeSnapshot.exists || !isPublicStoreVisible(storeData)) {
        await db.collection('publicStores')
          .doc(newStoreId)
          .collection('products')
          .doc(productId)
          .delete()
        return
      }

      await db.collection('publicStores')
        .doc(newStoreId)
        .collection('products')
        .doc(productId)
        .set({
          ...sanitizePublicProduct(afterData, storeData),
          id: productId,
          productId,
          storeId: newStoreId
        }, { merge: false })
    }
  }
)

exports.materializePublicCategory = onDocumentWritten(
  { document: 'categories/{categoryId}', region: REGION, maxInstances: 3 },
  async (event) => {
    const beforeData = event.data.before.data()
    const afterData = event.data.after.data()
    const categoryId = event.params.categoryId

    const oldStoreId = beforeData?.storeId
    const newStoreId = afterData?.storeId

    if (oldStoreId && oldStoreId !== newStoreId) {
      await db.collection('publicStores')
        .doc(oldStoreId)
        .collection('categories')
        .doc(categoryId)
        .delete()
    }

    if (!afterData || !newStoreId || !publicCategoryIsVisible(afterData)) {
      if (newStoreId) {
        await db.collection('publicStores')
          .doc(newStoreId)
          .collection('categories')
          .doc(categoryId)
          .delete()
      }
    } else {
      await db.collection('publicStores')
        .doc(newStoreId)
        .collection('categories')
        .doc(categoryId)
        .set({
          ...sanitizePublicCategory(afterData),
          id: categoryId,
          categoryId,
          storeId: newStoreId
        }, { merge: false })
    }
  }
)

exports.aggregateStorePresence = onValueWritten(
  {
    ref: 'presence/{storeId}',
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (event) => {
    const storeId = String(event.params.storeId || '').trim()
    if (!storeId) return

    const presenceSnapshot = await admin.database().ref(`presence/${storeId}`).get()
    const presence = presenceSnapshot.val() || {}
    const activeCount = Object.values(presence).filter((session) => {
      return session && typeof session === 'object' && session.online === true
    }).length
    const calculatedAt = Date.now()

    await admin.database().ref(`presenceCounts/${storeId}`).transaction((current) => {
      const currentUpdatedAt = Number(current?.updatedAt || 0)
      if (currentUpdatedAt > calculatedAt) return

      return {
        activeCount,
        updatedAt: calculatedAt,
      }
    })
  }
)

function safeDocId(value) {
  return String(value || '').replace(/\//g, '_')
}

function isMerchantUserData(userData = {}) {
  const role = String(userData.role || userData.accountType || userData.type || '').trim().toLowerCase()
  const roles = Array.isArray(userData.roles)
    ? userData.roles.map((item) => String(item || '').trim().toLowerCase())
    : []

  return ['merchant', 'lojista'].includes(role) || roles.includes('merchant') || roles.includes('lojista')
}

function isAnonymousUserData(userData = {}) {
  const provider = String(userData.provider || userData.authProvider || userData.signup?.authProvider || '').trim().toLowerCase()
  const providers = Array.isArray(userData.providers)
    ? userData.providers.map((item) => String(item || '').trim().toLowerCase())
    : []

  return userData.isAnonymous === true || provider === 'anonymous' || providers.includes('anonymous')
}

async function resolveWelcomeStoreName(dbInstance, userData = {}) {
  const directName = String(userData.signup?.storeName || userData.storeName || '').trim()
  if (directName) return directName

  const storeIds = uniqueTruthy([
    userData.storeId,
    ...(Array.isArray(userData.storeIds) ? userData.storeIds : []),
  ])

  if (storeIds.length > 0) {
    try {
      const storeDoc = await dbInstance.collection('stores').doc(storeIds[0]).get()
      const storeData = storeDoc.exists ? storeDoc.data() || {} : {}
      const storeName = String(storeData.storeName || storeData.name || '').trim()
      if (storeName) return storeName
    } catch (error) {
      logger.warn('[welcomeEmail] Could not resolve linked store name.', {
        storeId: storeIds[0],
        error: error?.message || String(error),
      })
    }
  }

  return 'sua loja'
}

async function sendWelcomeEmailForUserDoc({ db: dbInstance, admin: adminInstance, logger: log, uid, userData }) {
  try {
    const email = safeEmail(userData?.email)
    const isMerchant = isMerchantUserData(userData)
    const isAnonymous = isAnonymousUserData(userData)
    const logId = `welcome_${safeDocId(uid)}`
    const logRef = dbInstance.collection('notificationLogs').doc(logId)

    if (!uid || !email || !isMerchant || isAnonymous) {
      if (uid && email && !isMerchant) {
        await logRef.set({
          type: 'welcome',
          provider: 'brevo',
          templateId: BREVO_TEMPLATES.welcome.id,
          tag: BREVO_TEMPLATES.welcome.tag,
          uid,
          email,
          status: 'skipped',
          reason: isAnonymous ? 'anonymous' : 'not_merchant',
          updatedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
      return { sent: false, reason: !email ? 'missing_email' : isAnonymous ? 'anonymous' : 'not_merchant' }
    }

    const reservation = await dbInstance.runTransaction(async (transaction) => {
      const logDoc = await transaction.get(logRef)
      const logData = logDoc.exists ? logDoc.data() || {} : {}

      if (logData.status === 'sent') return { proceed: false, reason: 'already_sent' }

      if (logData.status === 'sending') {
        const updatedMs = timestampToMillis(logData.updatedAt) || Date.now()
        if (Date.now() - updatedMs < 15 * 60 * 1000) {
          return { proceed: false, reason: 'sending_recent' }
        }
      }

      const now = adminInstance.firestore.FieldValue.serverTimestamp()
      transaction.set(logRef, {
        type: 'welcome',
        provider: 'brevo',
        templateId: BREVO_TEMPLATES.welcome.id,
        tag: BREVO_TEMPLATES.welcome.tag,
        uid,
        email,
        status: 'sending',
        reason: null,
        attemptCount: Number(logData.attemptCount || 0) + 1,
        createdAt: logData.createdAt || now,
        updatedAt: now,
      }, { merge: true })

      return { proceed: true }
    })

    if (!reservation.proceed) return { sent: false, reason: reservation.reason }

    const appBaseUrl = getPublicAppBaseUrl()
    const storeName = await resolveWelcomeStoreName(dbInstance, userData)
    const params = {
      firstName: firstNameFrom(userData.displayName || storeName || email),
      storeName,
      onboardingUrl: `${appBaseUrl}/dashboard/billing`,
      supportWhatsappUrl: getSupportWhatsappUrl(),
    }

    const brevoResponse = await sendBrevoTransactionalEmail({
      to: email,
      name: userData.displayName || undefined,
      templateId: BREVO_TEMPLATES.welcome.id,
      params,
      tags: [BREVO_TEMPLATES.welcome.tag],
      idempotencyKey: logId,
    })

    await logRef.set({
      status: 'sent',
      reason: null,
      sentAt: adminInstance.firestore.FieldValue.serverTimestamp(),
      brevoMessageId: brevoResponse?.messageId || null,
      updatedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    return { sent: true }
  } catch (error) {
    const logId = `welcome_${safeDocId(uid)}`
    log.error('[welcomeEmail] Failed to send welcome email.', { uid, error: error?.message || String(error) })
    await dbInstance.collection('notificationLogs').doc(logId).set({
      status: 'failed',
      error: error?.message || String(error),
      updatedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return { sent: false, reason: 'failed' }
  }
}

exports.sendWelcomeEmailOnUserCreate = onDocumentCreated(
  {
    document: 'users/{uid}',
    region: 'southamerica-east1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [BREVO_API_KEY],
  },
  async (event) => {
    await sendWelcomeEmailForUserDoc({
      db,
      admin,
      logger,
      uid: event.params.uid,
      userData: event.data.data() || {},
    })
  }
)

// Keep the create trigger during rollout; the write trigger covers users whose role/email arrive after creation.
exports.sendWelcomeEmailOnUserWrite = onDocumentWritten(
  {
    document: 'users/{uid}',
    region: 'southamerica-east1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [BREVO_API_KEY],
  },
  async (event) => {
    if (!event.data.after.exists) return

    await sendWelcomeEmailForUserDoc({
      db,
      admin,
      logger,
      uid: event.params.uid,
      userData: event.data.after.data() || {},
    })
  }
)

exports.sendTrialEndingAlerts = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [BREVO_API_KEY],
  },
  async () => {
    const templateId = BREVO_TEMPLATES.trialEnding.id
    if (!templateId) {
      logger.warn('Skipping sendTrialEndingAlerts because BREVO_TRIAL_ENDING_TEMPLATE_ID is not configured.')
      return
    }

    const storesSnapshot = await db.collection('stores')
      .where('subscriptionStatus', '==', 'trialing')
      .get()

    if (storesSnapshot.empty) return

    const now = new Date()
    const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

    const appBaseUrl = getPublicAppBaseUrl()
    const supportWhatsappUrl = getSupportWhatsappUrl()

    for (const doc of storesSnapshot.docs) {
      const storeData = doc.data()
      if (!storeData.trialEndsAt) continue

      const trialEndsAtDate = typeof storeData.trialEndsAt.toDate === 'function' ? storeData.trialEndsAt.toDate() : new Date(storeData.trialEndsAt)
      if (Number.isNaN(trialEndsAtDate.getTime())) continue

      const spTrialEndsAt = new Date(trialEndsAtDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

      // Fix date differences properly without time parts
      const normalizeDateToStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const spNowStart = normalizeDateToStartOfDay(spNow)
      const spTrialEndsStart = normalizeDateToStartOfDay(spTrialEndsAt)

      const diffMs = spTrialEndsStart.getTime() - spNowStart.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays !== 3 && diffDays !== 1) continue

      const storeId = doc.id
      const uid = storeData.ownerUid || storeData.ownerId
      if (!uid) continue

      const userDoc = await db.collection('users').doc(uid).get()
      if (!userDoc.exists) continue

      const userData = userDoc.data()
      const email = userData.email
      if (!email) {
        logger.info(`Skipping trial ending email for store ${storeId}: missing email.`)
        continue
      }

      const logId = `trial_ending_${safeDocId(storeId)}_${diffDays}`
      const logRef = db.collection('notificationLogs').doc(logId)

      const result = await db.runTransaction(async (transaction) => {
        const logDoc = await transaction.get(logRef)
        if (logDoc.exists && ['sent', 'sending'].includes(logDoc.data().status)) {
          return { proceed: false }
        }

        const nowTs = admin.firestore.FieldValue.serverTimestamp()
        transaction.set(logRef, {
          type: 'trial_ending',
          provider: 'brevo',
          templateId,
          tag: BREVO_TEMPLATES.trialEnding.tag,
          uid,
          storeId,
          email,
          status: 'sending',
          createdAt: logDoc.exists ? logDoc.data().createdAt : nowTs,
          updatedAt: nowTs,
        }, { merge: true })

        return { proceed: true }
      })

      if (!result.proceed) continue

      try {
        const endingAlertPlan = getKnownTrialPlan(storeData.billingPlan || storeData.selectedPlan || storeData.plan)
        const params = {
          firstName: firstNameFrom(userData.displayName || userData.signup?.storeName || email),
          storeName: storeData.storeName || userData.signup?.storeName || 'sua loja',
          daysLeftText: diffDays === 1 ? '1 dia' : `${diffDays} dias`,
          trialEndsAt: formatDatePtBr(trialEndsAtDate),
          planName: endingAlertPlan === 'premium' ? 'Premium' : endingAlertPlan === 'professional' ? 'Profissional' : 'Essencial',
          billingUrl: `${appBaseUrl}/dashboard/billing`,
          supportWhatsappUrl,
        }

        const brevoResponse = await sendBrevoTransactionalEmail({
          to: email,
          name: userData.displayName || undefined,
          templateId,
          params,
          tags: [BREVO_TEMPLATES.trialEnding.tag],
          idempotencyKey: logId,
        })

        await logRef.set({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          brevoMessageId: brevoResponse?.messageId || null,
        }, { merge: true })
      } catch (error) {
        logger.error('Failed to send trial ending email', { storeId, diffDays, error: error.message })
        await logRef.set({
          status: 'failed',
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
    }
  }
)

function toTrialTransitionDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis())
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getKnownTrialPlan(value, fallback = 'essential') {
  const plan = String(value || '').trim().toLowerCase()
  if (plan === 'premium') return 'premium'
  if (plan === 'professional' || plan === 'profissional' || plan === 'plus') return 'professional'
  return fallback
}

function getKnownTrialBillingCycle(value, fallback = 'monthly') {
  const cycle = String(value || '').trim().toLowerCase()
  return ['monthly', 'annual'].includes(cycle) ? cycle : fallback
}

function getAsaasSchedulerSecretValue(secret, envName) {
  try {
    return secret.value() || process.env[envName] || ''
  } catch {
    return process.env[envName] || ''
  }
}

function getAsaasBillingBaseUrlForScheduler() {
  const configuredBaseUrl = process.env.ASAAS_BASE_URL
  const allowSandboxFallback =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    process.env.ALLOW_ASAAS_SANDBOX_FALLBACK === 'true'

  if (!configuredBaseUrl && !allowSandboxFallback) {
    throw new Error('ASAAS_BASE_URL precisa ser configurada explicitamente para processar trials.')
  }

  return String(configuredBaseUrl || 'https://api-sandbox.asaas.com/v3').replace(/\/+$/, '')
}

async function getAsaasSubscriptionForTrialTransition(providerSubscriptionId) {
  const apiKey = getAsaasSchedulerSecretValue(ASAAS_API_KEY, 'ASAAS_API_KEY')
  if (!apiKey) throw new Error('ASAAS_API_KEY nao configurada.')

  const response = await fetch(
    `${getAsaasBillingBaseUrlForScheduler()}/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'PratoBy/1.0 FirebaseFunctions',
        access_token: apiKey,
      },
    }
  )

  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    const message = body?.errors?.[0]?.description || body?.message || `Asaas retornou HTTP ${response.status}.`
    throw new Error(message)
  }

  return body || {}
}

function normalizeAsaasProviderStatus(value) {
  return String(value || '').trim().toUpperCase()
}

function getTrialTransitionStatusFromProvider({ cancelAtTrialEnd, providerSubscriptionId, providerStatus }) {
  if (cancelAtTrialEnd) return 'canceled'
  if (!providerSubscriptionId) return BILLING_PENDING_PAYMENT_METHOD_STATUS

  const normalizedStatus = normalizeAsaasProviderStatus(providerStatus)
  if (normalizedStatus === 'ACTIVE') return 'active'
  if (['INACTIVE', 'CANCELLED', 'CANCELED', 'DELETED', 'EXPIRED'].includes(normalizedStatus)) return 'canceled'
  return BILLING_PENDING_PAYMENT_METHOD_STATUS
}

function buildTrialTransitionPlanState(storeData, nextStatus) {
  const billingPlan = getKnownTrialPlan(storeData.billingPlan || storeData.selectedPlan || storeData.plan)
  const billingCycle = getKnownTrialBillingCycle(storeData.billingCycle)
  const trialEndsAt = storeData.trialEndsAt || null
  const isActive = nextStatus === 'active'

  return {
    plan: billingPlan,
    selectedPlan: billingPlan,
    billingPlan,
    trialEntitlementsPlan: TRIAL_ENTITLEMENTS_PLAN,
    effectivePlan: isActive ? billingPlan : null,
    billingCycle,
    firstChargeAt: storeData.firstChargeAt || trialEndsAt,
    nextChargeAt: isActive ? (storeData.nextChargeAt || storeData.currentPeriodEnd || trialEndsAt) : null,
    currentPeriodEnd: isActive ? (storeData.currentPeriodEnd || trialEndsAt) : null,
  }
}

exports.processTrialTransitions = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [ASAAS_API_KEY],
  },
  async () => {
    const now = admin.firestore.Timestamp.now()
    const snapshot = await db.collection('stores')
      .where('subscriptionStatus', '==', 'trialing')
      .where('trialEndsAt', '<=', now)
      .orderBy('trialEndsAt')
      .limit(200)
      .get()

    if (snapshot.empty) return

    for (const storeDoc of snapshot.docs) {
      try {
        const snapshotStoreData = storeDoc.data() || {}
        const providerSubscriptionId = String(
          snapshotStoreData.asaasSubscriptionId ||
            snapshotStoreData.providerSubscriptionId ||
            ''
        ).trim()
        const snapshotCancelAtTrialEnd = Boolean(
          snapshotStoreData.cancelAtTrialEnd ||
            snapshotStoreData.cancelScheduledAtPeriodEnd
        )
        let providerSubscription = null
        let providerStatus = null
        let providerCurrentPeriodEnd = null

        if (!snapshotCancelAtTrialEnd && providerSubscriptionId) {
          providerSubscription = await getAsaasSubscriptionForTrialTransition(providerSubscriptionId)
          providerStatus = providerSubscription?.status || null
          const providerDueDate = toTrialTransitionDate(providerSubscription?.nextDueDate)
          providerCurrentPeriodEnd = providerDueDate
            ? admin.firestore.Timestamp.fromDate(providerDueDate)
            : null
        }

        await db.runTransaction(async (transaction) => {
          const freshStoreDoc = await transaction.get(storeDoc.ref)
          if (!freshStoreDoc.exists) return

          const storeData = freshStoreDoc.data() || {}
          if (storeData.subscriptionStatus !== 'trialing') return

          const trialEndsAtDate = toTrialTransitionDate(storeData.trialEndsAt)
          if (!trialEndsAtDate || trialEndsAtDate.getTime() > Date.now()) return

          const uid = storeData.ownerUid || storeData.ownerId || storeData.createdBy || null
          const userRef = uid ? db.collection('users').doc(uid) : null
          const currentProviderSubscriptionId = String(
            storeData.asaasSubscriptionId ||
              storeData.providerSubscriptionId ||
              ''
          ).trim()
          const localSubscriptionId = storeData.subscriptionId || (
            currentProviderSubscriptionId ? `asaas_${currentProviderSubscriptionId.replace(/\//g, '_')}` : null
          )
          const subscriptionRef = localSubscriptionId ? db.collection('subscriptions').doc(localSubscriptionId) : null

          const cancelAtTrialEnd = Boolean(storeData.cancelAtTrialEnd || storeData.cancelScheduledAtPeriodEnd)
          const nextStatus = getTrialTransitionStatusFromProvider({
            cancelAtTrialEnd,
            providerSubscriptionId: currentProviderSubscriptionId,
            providerStatus: currentProviderSubscriptionId === providerSubscriptionId ? providerStatus : null,
          })
          const isBlocked = nextStatus !== 'active'
          const storeDataForPlanState = providerCurrentPeriodEnd && nextStatus === 'active'
            ? {
                ...storeData,
                currentPeriodEnd: providerCurrentPeriodEnd,
                nextChargeAt: providerCurrentPeriodEnd,
              }
            : storeData
          const planState = buildTrialTransitionPlanState(storeDataForPlanState, nextStatus)
          const transitionPayload = {
            ...planState,
            subscriptionStatus: nextStatus,
            billingMethodConfigured: nextStatus === 'active',
            asaasSubscriptionStatus: providerStatus || storeData.asaasSubscriptionStatus || null,
            isBillingBlocked: isBlocked,
            isActive: !isBlocked,
            cancelAtTrialEnd,
            cancelScheduledAtPeriodEnd: cancelAtTrialEnd,
            subscriptionCancellationStatus: cancelAtTrialEnd ? 'trial_ended_canceled' : null,
            trialTransitionProcessedAt: now,
            updatedAt: now,
          }

          transaction.set(storeDoc.ref, transitionPayload, { merge: true })

          if (userRef) {
            transaction.set(userRef, transitionPayload, { merge: true })
          }

          if (subscriptionRef) {
            transaction.set(
              subscriptionRef,
              {
                ...planState,
                status: nextStatus,
                providerStatus: providerStatus || null,
                lastAsaasSyncAt: now,
                cancelAtTrialEnd,
                cancelScheduledAtPeriodEnd: cancelAtTrialEnd,
                cancellationStatus: cancelAtTrialEnd ? 'trial_ended_canceled' : null,
                trialTransitionProcessedAt: now,
                updatedAt: now,
              },
              { merge: true }
            )
          }

          transaction.set(db.collection('auditLogs').doc(), {
            action: 'trial_transition_processed',
            entity: 'store',
            entityId: storeDoc.id,
            uid,
            storeId: storeDoc.id,
            source: 'processTrialTransitions',
            before: {
              subscriptionStatus: 'trialing',
              cancelAtTrialEnd,
            },
            after: {
              subscriptionStatus: nextStatus,
              isBillingBlocked: isBlocked,
              effectivePlan: planState.effectivePlan,
              providerStatus,
            },
            createdAt: now,
          })
        })
      } catch (error) {
        logger.error('Failed to process trial transition', {
          storeId: storeDoc.id,
          error: error.message || String(error),
        })
      }
    }
  }
)

exports.sendWeeklyPerformanceReports = onSchedule(
  {
    schedule: 'every monday 08:00',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [BREVO_API_KEY],
  },
  async () => {
    const templateId = BREVO_TEMPLATES.weeklyReport.id
    if (!templateId) {
      logger.warn('Skipping sendWeeklyPerformanceReports because BREVO_WEEKLY_REPORT_TEMPLATE_ID is not configured.')
      return
    }

    const COMMISSION_REFERENCE_PERCENT = 12

    const storesSnapshot = await db.collection('stores')
      .where('subscriptionStatus', 'in', ['trialing', 'active'])
      .get()

    if (storesSnapshot.empty) return

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const yyyy_mm_dd = now.toISOString().split('T')[0]

    const appBaseUrl = getPublicAppBaseUrl()
    const supportWhatsappUrl = getSupportWhatsappUrl()

    for (const doc of storesSnapshot.docs) {
      const storeData = doc.data()
      if (storeData.isDeleted || storeData.isBlocked || storeData.isBillingBlocked) continue

      const storeId = doc.id
      const uid = storeData.ownerUid || storeData.ownerId
      if (!uid) continue

      const userDoc = await db.collection('users').doc(uid).get()
      if (!userDoc.exists) continue

      const userData = userDoc.data()
      const email = userData.email
      if (!email) continue

      const logId = `weekly_report_${safeDocId(storeId)}_${yyyy_mm_dd}`
      const logRef = db.collection('notificationLogs').doc(logId)

      const result = await db.runTransaction(async (transaction) => {
        const logDoc = await transaction.get(logRef)
        if (logDoc.exists && ['sent', 'sending'].includes(logDoc.data().status)) {
          return { proceed: false }
        }

        const nowTs = admin.firestore.FieldValue.serverTimestamp()
        transaction.set(logRef, {
          type: 'weekly_report',
          provider: 'brevo',
          templateId,
          tag: BREVO_TEMPLATES.weeklyReport.tag,
          uid,
          storeId,
          email,
          status: 'sending',
          createdAt: logDoc.exists ? logDoc.data().createdAt : nowTs,
          updatedAt: nowTs,
        }, { merge: true })

        return { proceed: true }
      })

      if (!result.proceed) continue

      try {
        const ordersSnapshot = await db.collection('orders')
          .where('storeId', '==', storeId)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneWeekAgo))
          .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(now))
          .orderBy('createdAt', 'desc')
          .limit(1000)
          .get()

        let totalOrders = 0
        let grossRevenueCents = 0
        let itemsMap = {}
        let phonesSet = new Set()

        ordersSnapshot.docs.forEach(orderDoc => {
          const order = orderDoc.data()
          if (['canceled', 'cancelado'].includes(String(order.status).toLowerCase())) return

          totalOrders++
          grossRevenueCents += Number(order.totalCents || 0)

          if (order.customerPhone) phonesSet.add(order.customerPhone)

          if (Array.isArray(order.items)) {
            order.items.forEach(item => {
              const name = item.name || 'Produto'
              const qty = Number(item.quantity || 1)
              itemsMap[name] = (itemsMap[name] || 0) + qty
            })
          }
        })

        const averageTicketCents = totalOrders > 0 ? Math.round(grossRevenueCents / totalOrders) : 0
        // Estimativa de economia em comparação com marketplaces (12%)
        const commissionSavedCents = Math.round(grossRevenueCents * (COMMISSION_REFERENCE_PERCENT / 100))

        let topProduct = 'Nenhum'
        let maxQty = 0
        for (const [name, qty] of Object.entries(itemsMap)) {
          if (qty > maxQty) {
            maxQty = qty
            topProduct = name
          }
        }

        const formatCurrency = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

        const params = {
          firstName: firstNameFrom(userData.displayName || userData.signup?.storeName || email),
          storeName: storeData.storeName || userData.signup?.storeName || 'sua loja',
          weekStart: formatDatePtBr(oneWeekAgo),
          weekEnd: formatDatePtBr(now),
          totalOrders,
          grossRevenue: formatCurrency(grossRevenueCents),
          averageTicket: formatCurrency(averageTicketCents),
          commissionSaved: formatCurrency(commissionSavedCents),
          topProduct,
          newCustomers: phonesSet.size,
          dashboardUrl: `${appBaseUrl}/dashboard`,
          supportWhatsappUrl,
        }

        const brevoResponse = await sendBrevoTransactionalEmail({
          to: email,
          name: userData.displayName || undefined,
          templateId,
          params,
          tags: [BREVO_TEMPLATES.weeklyReport.tag],
          idempotencyKey: logId,
        })

        await logRef.set({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          brevoMessageId: brevoResponse?.messageId || null,
        }, { merge: true })
      } catch (error) {
        logger.error('Failed to send weekly report email', { storeId, error: error.message })
        await logRef.set({
          status: 'failed',
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
    }
  }
)

// ─── Store Tables (QR Code por mesa) ─────────────────────────────────────────

const STORE_TABLE_CALLABLE_OPTIONS = {
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
}

exports.createStoreTable = onCall(
  STORE_TABLE_CALLABLE_OPTIONS,
  (request) => createStoreTableHandler({ db, HttpsError, logger }, request)
)

exports.updateStoreTable = onCall(
  STORE_TABLE_CALLABLE_OPTIONS,
  (request) => updateStoreTableHandler({ db, HttpsError, logger }, request)
)

exports.archiveStoreTable = onCall(
  STORE_TABLE_CALLABLE_OPTIONS,
  (request) => archiveStoreTableHandler({ db, HttpsError, logger }, request)
)



