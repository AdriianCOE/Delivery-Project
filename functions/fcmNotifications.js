const crypto = require('crypto')

const MERCHANT_DASHBOARD_URL = 'https://pratoby.com/dashboard/orders'
const MERCHANT_DASHBOARD_PATH = '/dashboard/orders'
const WEB_PUSH_ICON = '/icons/android-chrome-192x192.png'
const WEB_PUSH_BADGE = '/icons/android-chrome-192x192.png'

function isInvalidFcmTokenError(error) {
  const code = String(error?.code || error?.errorInfo?.code || '').toLowerCase()
  return [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
  ].includes(code)
}

function normalizeOrderStatus(status) {
  const value = String(status || '').toLowerCase().trim()
  return {
    confirmado: 'confirmado',
    accepted: 'confirmado',
    preparando: 'preparando',
    preparing: 'preparando',
    pronto: 'pronto',
    ready: 'pronto',
    em_rota: 'em_rota',
    out_for_delivery: 'em_rota',
    entregue: 'entregue',
    delivered: 'entregue',
    cancelado: 'cancelado',
    canceled: 'cancelado',
    cancelled: 'cancelado',
  }[value] || value
}

function getOrderShortCode(orderId) {
  return String(orderId || '').trim().slice(-4).toUpperCase() || '----'
}

function getMerchantOrderDashboardPath(orderId) {
  const normalizedOrderId = String(orderId || '').trim()
  const params = new URLSearchParams()

  if (normalizedOrderId) {
    params.set('orderId', normalizedOrderId)
  }

  const query = params.toString()
  return query ? `${MERCHANT_DASHBOARD_PATH}?${query}` : MERCHANT_DASHBOARD_PATH
}

function isDeliveryOrder(orderData) {
  const type = String(
    orderData?.orderType ||
    orderData?.deliveryType ||
    orderData?.fulfillmentType ||
    orderData?.type ||
    ''
  ).toLowerCase().trim()

  return !['pickup', 'retirada', 'takeout', 'balcao', 'local', 'dine_in', 'mesa'].includes(type)
}

function getCustomerStatusPushContent(status, orderId, orderData = null) {
  const orderNumber = `#${getOrderShortCode(orderId)}`
  const normalizedStatus = normalizeOrderStatus(status)
  const deliveryOrder = isDeliveryOrder(orderData)

  const map = {
    confirmado: {
      title: 'Pedido confirmado',
      body: `Pedido ${orderNumber} confirmado pela loja.`,
    },
    preparando: {
      title: 'Pedido em preparo',
      body: `Pedido ${orderNumber} esta sendo preparado.`,
    },
    pronto: {
      title: 'Pedido pronto',
      body: deliveryOrder
        ? `Pedido ${orderNumber} pronto e aguardando saida para entrega.`
        : `Pedido ${orderNumber} pronto para retirada.`,
    },
    em_rota: {
      title: 'Pedido saiu para entrega',
      body: `Pedido ${orderNumber} saiu para entrega.`,
    },
    entregue: {
      title: 'Pedido entregue',
      body: `Pedido ${orderNumber} foi finalizado.`,
    },
    cancelado: {
      title: 'Pedido cancelado',
      body: `Pedido ${orderNumber} foi cancelado pela loja.`,
    },
  }

  return map[normalizedStatus] || {
    title: 'Pedido atualizado',
    body: `Pedido ${orderNumber} foi atualizado.`,
  }
}

function getTrackingUrlPath(orderData) {
  const trackingToken = String(orderData?.trackingToken || '').trim()
  if (!trackingToken) return null

  const savedPath = String(orderData?.trackingUrlPath || '').trim()
  if (savedPath.startsWith('/')) return savedPath

  const storeSlug = String(orderData?.storeSlug || orderData?.storeId || '').trim()
  if (storeSlug) return `/${storeSlug}/pedido/${trackingToken}`

  return `/pedido/${trackingToken}`
}

function getCustomerOrderTokenHash({ orderId, trackingToken, token }) {
  return crypto
    .createHash('sha256')
    .update(`${orderId}:${trackingToken}:${token}`)
    .digest('hex')
}

function assertCustomerTrackingAccess({ HttpsError, orderId, trackingToken, orderData }) {
  const expectedToken = String(orderData?.trackingToken || '').trim()
  const providedToken = String(trackingToken || '').trim()

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    throw new HttpsError('permission-denied', 'Link de acompanhamento invalido.')
  }
}

function sanitizeFcmToken(token, HttpsError) {
  const value = String(token || '').trim()
  if (value.length < 20 || value.length > 4096) {
    throw new HttpsError('invalid-argument', 'Token de notificacao invalido.')
  }
  return value
}

function getPlatform(value) {
  return String(value || 'web').trim().slice(0, 120) || 'web'
}

function getUserAgent(value) {
  return String(value || '').trim().slice(0, 600)
}

async function registerCustomerOrderPushToken({ db, admin, HttpsError, logger, orderId, trackingToken, token, platform, userAgent }) {
  const safeToken = sanitizeFcmToken(token, HttpsError)
  const orderRef = db.collection('orders').doc(orderId)
  const orderSnapshot = await orderRef.get()

  if (!orderSnapshot.exists) {
    throw new HttpsError('not-found', 'Pedido nao encontrado.')
  }

  const orderData = orderSnapshot.data() || {}
  assertCustomerTrackingAccess({ HttpsError, orderId, trackingToken, orderData })

  const tokenHash = getCustomerOrderTokenHash({
    orderId,
    trackingToken: String(trackingToken || '').trim(),
    token: safeToken,
  })

  await orderRef.collection('customerNotificationTokens').doc(tokenHash).set({
    orderId,
    storeId: orderData.storeId || orderData.storeDocId || '',
    token: safeToken,
    enabled: true,
    platform: getPlatform(platform),
    userAgent: getUserAgent(userAgent),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  logger?.info?.('[fcm] Customer order push token registered.', {
    orderId,
    hasTrackingToken: Boolean(String(trackingToken || '').trim()),
    tokenHash,
  })

  return { ok: true, orderId, tokenHash }
}

async function disableCustomerOrderPushToken({ db, admin, HttpsError, logger, orderId, trackingToken, token, tokenHash }) {
  const orderRef = db.collection('orders').doc(orderId)
  const orderSnapshot = await orderRef.get()

  if (!orderSnapshot.exists) {
    throw new HttpsError('not-found', 'Pedido nao encontrado.')
  }

  const orderData = orderSnapshot.data() || {}
  assertCustomerTrackingAccess({ HttpsError, orderId, trackingToken, orderData })

  const resolvedTokenHash = String(tokenHash || '').trim() || (
    token
      ? getCustomerOrderTokenHash({
          orderId,
          trackingToken: String(trackingToken || '').trim(),
          token: sanitizeFcmToken(token, HttpsError),
        })
      : ''
  )

  if (!/^[a-f0-9]{64}$/.test(resolvedTokenHash)) {
    throw new HttpsError('invalid-argument', 'Token de notificacao invalido.')
  }

  await orderRef.collection('customerNotificationTokens').doc(resolvedTokenHash).set({
    enabled: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  logger?.info?.('[fcm] Customer order push token disabled.', {
    orderId,
    hasTrackingToken: Boolean(String(trackingToken || '').trim()),
    tokenHash: resolvedTokenHash,
  })

  return { ok: true, orderId, tokenHash: resolvedTokenHash }
}

async function sendNewOrderPushToStore({ db, admin, logger, storeId, orderId }) {
  const normalizedStoreId = String(storeId || '').trim()
  const normalizedOrderId = String(orderId || '').trim()

  if (!normalizedStoreId || !normalizedOrderId) {
    logger.warn('[fcm] Skipping new order push without storeId/orderId.', {
      hasStoreId: Boolean(normalizedStoreId),
      hasOrderId: Boolean(normalizedOrderId),
    })
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenSnapshot = await db
    .collection('stores')
    .doc(normalizedStoreId)
    .collection('notificationTokens')
    .where('enabled', '==', true)
    .limit(100)
    .get()

  if (tokenSnapshot.empty) {
    logger.info('[fcm] No enabled merchant tokens for new order push.', {
      storeId: normalizedStoreId,
      orderId: normalizedOrderId,
    })
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenDocs = tokenSnapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() || {} }))
    .filter((entry) => typeof entry.data.token === 'string' && entry.data.token.trim())

  if (tokenDocs.length === 0) {
    logger.warn('[fcm] Enabled merchant token docs without token payload.', {
      storeId: normalizedStoreId,
      orderId: normalizedOrderId,
      docCount: tokenSnapshot.size,
    })
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const title = 'Novo pedido recebido'
  const body = 'Toque para abrir o painel de pedidos.'
  const tag = `pratoby-new-order-${normalizedOrderId}`
  const dashboardPath = getMerchantOrderDashboardPath(normalizedOrderId)
  const dashboardUrl = `${MERCHANT_DASHBOARD_URL}${dashboardPath.slice(MERCHANT_DASHBOARD_PATH.length)}`
  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map((entry) => entry.data.token),
    data: {
      type: 'new_order',
      orderId: normalizedOrderId,
      storeId: normalizedStoreId,
      url: dashboardPath,
      title,
      body,
    },
    webpush: {
      notification: {
        title,
        body,
        icon: WEB_PUSH_ICON,
        badge: WEB_PUSH_BADGE,
        tag,
        renotify: true,
        requireInteraction: true,
      },
      fcmOptions: {
        link: dashboardUrl,
      },
    },
  })

  const batch = db.batch()
  let invalidated = 0

  response.responses.forEach((sendResult, index) => {
    const tokenDoc = tokenDocs[index]
    if (!tokenDoc) return

    if (sendResult.success) {
      batch.set(tokenDoc.ref, {
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return
    }

    if (isInvalidFcmTokenError(sendResult.error)) {
      invalidated += 1
      batch.set(tokenDoc.ref, {
        enabled: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        invalidationReason: String(sendResult.error?.code || 'messaging-error').slice(0, 120),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
  })

  await batch.commit()

  logger.info('[fcm] New order push sent.', {
    storeId: normalizedStoreId,
    orderId: normalizedOrderId,
    tokenCount: tokenDocs.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidated,
  })

  return {
    ok: response.successCount > 0,
    tokenCount: tokenDocs.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    sent: response.successCount,
    failed: response.failureCount,
    invalidated,
  }
}

async function sendMerchantTestPushToStore({ db, admin, logger, storeId }) {
  const normalizedStoreId = String(storeId || '').trim()

  if (!normalizedStoreId) {
    logger.warn('[fcm] Skipping merchant test push without storeId.')
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenSnapshot = await db
    .collection('stores')
    .doc(normalizedStoreId)
    .collection('notificationTokens')
    .where('enabled', '==', true)
    .limit(100)
    .get()

  if (tokenSnapshot.empty) {
    logger.info('[fcm] No enabled merchant tokens for test push.', {
      storeId: normalizedStoreId,
    })
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenDocs = tokenSnapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() || {} }))
    .filter((entry) => typeof entry.data.token === 'string' && entry.data.token.trim())

  if (tokenDocs.length === 0) {
    logger.warn('[fcm] Enabled merchant token docs without token payload for test push.', {
      storeId: normalizedStoreId,
      docCount: tokenSnapshot.size,
    })
    return { ok: false, tokenCount: 0, successCount: 0, failureCount: 0, sent: 0, failed: 0, invalidated: 0 }
  }

  const title = 'Push ativado no PratoBy'
  const body = 'Este dispositivo já pode receber avisos de novos pedidos.'
  const tag = `pratoby-merchant-test-${normalizedStoreId}`
  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map((entry) => entry.data.token),
    data: {
      type: 'merchant_test',
      storeId: normalizedStoreId,
      title,
      body,
      url: MERCHANT_DASHBOARD_PATH,
    },
    webpush: {
      notification: {
        title,
        body,
        icon: WEB_PUSH_ICON,
        badge: WEB_PUSH_BADGE,
        tag,
        renotify: true,
        requireInteraction: false,
      },
      fcmOptions: {
        link: MERCHANT_DASHBOARD_URL,
      },
    },
  })

  const batch = db.batch()
  let invalidated = 0

  response.responses.forEach((sendResult, index) => {
    const tokenDoc = tokenDocs[index]
    if (!tokenDoc) return

    if (sendResult.success) {
      batch.set(tokenDoc.ref, {
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastTestSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return
    }

    if (isInvalidFcmTokenError(sendResult.error)) {
      invalidated += 1
      batch.set(tokenDoc.ref, {
        enabled: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        invalidationReason: String(sendResult.error?.code || 'messaging-error').slice(0, 120),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
  })

  await batch.commit()

  logger.info('[fcm] Merchant test push sent.', {
    storeId: normalizedStoreId,
    tokenCount: tokenDocs.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidated,
  })

  return {
    ok: response.successCount > 0,
    tokenCount: tokenDocs.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    sent: response.successCount,
    failed: response.failureCount,
    invalidated,
  }
}

async function sendCustomerOrderStatusPushToOrder({ db, admin, logger, orderId, status, orderData = null }) {
  const normalizedOrderId = String(orderId || '').trim()
  const normalizedStatus = normalizeOrderStatus(status)

  if (!normalizedOrderId || !normalizedStatus) {
    logger.warn('[fcm] Skipping customer status push without orderId/status.', {
      hasOrderId: Boolean(normalizedOrderId),
      hasStatus: Boolean(normalizedStatus),
    })
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const orderRef = db.collection('orders').doc(normalizedOrderId)
  let currentOrderData = orderData

  if (!currentOrderData) {
    const orderSnapshot = await orderRef.get()
    if (!orderSnapshot.exists) {
      logger.warn('[fcm] Customer status push skipped; order not found.', {
        orderId: normalizedOrderId,
        status: normalizedStatus,
      })
      return { sent: 0, failed: 0, invalidated: 0, tokenDocs: 0 }
    }
    currentOrderData = orderSnapshot.data() || {}
  }

  const hasTrackingToken = Boolean(String(currentOrderData?.trackingToken || '').trim())

  const tokenSnapshot = await orderRef
    .collection('customerNotificationTokens')
    .where('enabled', '==', true)
    .limit(100)
    .get()

  if (tokenSnapshot.empty) {
    logger.info('[fcm] No enabled customer tokens for status push.', {
      orderId: normalizedOrderId,
      status: normalizedStatus,
      hasTrackingToken,
      tokenDocs: 0,
    })
    return { sent: 0, failed: 0, invalidated: 0, tokenDocs: 0 }
  }

  const tokenDocs = tokenSnapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() || {} }))
    .filter((entry) => typeof entry.data.token === 'string' && entry.data.token.trim())

  if (tokenDocs.length === 0) {
    logger.warn('[fcm] Enabled customer token docs without token payload.', {
      orderId: normalizedOrderId,
      status: normalizedStatus,
      hasTrackingToken,
      tokenDocs: tokenSnapshot.size,
    })
    return { sent: 0, failed: 0, invalidated: 0, tokenDocs: tokenSnapshot.size }
  }

  const content = getCustomerStatusPushContent(normalizedStatus, normalizedOrderId, currentOrderData)
  const trackingUrlPath = getTrackingUrlPath(currentOrderData)
  const messageData = {
    type: 'order_status_update',
    orderId: normalizedOrderId,
    status: normalizedStatus,
    title: content.title,
    body: content.body,
  }

  if (trackingUrlPath) {
    messageData.url = trackingUrlPath
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map((entry) => entry.data.token),
    data: messageData,
  })

  const batch = db.batch()
  let invalidated = 0

  response.responses.forEach((sendResult, index) => {
    const tokenDoc = tokenDocs[index]
    if (!tokenDoc) return

    if (sendResult.success) {
      batch.set(tokenDoc.ref, {
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSentStatus: normalizedStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return
    }

    if (isInvalidFcmTokenError(sendResult.error)) {
      invalidated += 1
      batch.set(tokenDoc.ref, {
        enabled: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        invalidationReason: String(sendResult.error?.code || 'messaging-error').slice(0, 120),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
  })

  await batch.commit()

  logger.info('[fcm] Customer order status push sent.', {
    orderId: normalizedOrderId,
    status: normalizedStatus,
    hasTrackingToken,
    tokenDocs: tokenSnapshot.size,
    tokensWithPayload: tokenDocs.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidated,
  })

  return {
    sent: response.successCount,
    failed: response.failureCount,
    invalidated,
    tokenDocs: tokenSnapshot.size,
  }
}

module.exports = {
  disableCustomerOrderPushToken,
  registerCustomerOrderPushToken,
  sendCustomerOrderStatusPushToOrder,
  sendMerchantTestPushToStore,
  sendNewOrderPushToStore,
}
