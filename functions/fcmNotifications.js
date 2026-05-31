const crypto = require('crypto')

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

function getCustomerStatusPushContent(status, orderId) {
  const orderNumber = `#${getOrderShortCode(orderId)}`
  const normalizedStatus = normalizeOrderStatus(status)

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
      body: `Pedido ${orderNumber} pronto para retirada.`,
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

function getTrackingUrlPath(orderData, orderId) {
  const savedPath = String(orderData?.trackingUrlPath || '').trim()
  if (savedPath.startsWith('/')) return savedPath

  const storeSlug = String(orderData?.storeSlug || orderData?.storeId || '').trim()
  if (storeSlug) return `/${storeSlug}/pedido/${orderId}`

  return `/pedido/${orderId}`
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

async function registerCustomerOrderPushToken({ db, admin, HttpsError, orderId, trackingToken, token, platform, userAgent }) {
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

  return { ok: true, orderId, tokenHash }
}

async function disableCustomerOrderPushToken({ db, admin, HttpsError, orderId, trackingToken, token, tokenHash }) {
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
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenSnapshot = await db
    .collection('stores')
    .doc(normalizedStoreId)
    .collection('notificationTokens')
    .where('enabled', '==', true)
    .limit(100)
    .get()

  if (tokenSnapshot.empty) {
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenDocs = tokenSnapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() || {} }))
    .filter((entry) => typeof entry.data.token === 'string' && entry.data.token.trim())

  if (tokenDocs.length === 0) {
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map((entry) => entry.data.token),
    data: {
      type: 'new_order',
      orderId: normalizedOrderId,
      storeId: normalizedStoreId,
      url: '/dashboard/orders',
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
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidated,
  })

  return {
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
    if (!orderSnapshot.exists) return { sent: 0, failed: 0, invalidated: 0 }
    currentOrderData = orderSnapshot.data() || {}
  }

  const tokenSnapshot = await orderRef
    .collection('customerNotificationTokens')
    .where('enabled', '==', true)
    .limit(100)
    .get()

  if (tokenSnapshot.empty) {
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const tokenDocs = tokenSnapshot.docs
    .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() || {} }))
    .filter((entry) => typeof entry.data.token === 'string' && entry.data.token.trim())

  if (tokenDocs.length === 0) {
    return { sent: 0, failed: 0, invalidated: 0 }
  }

  const content = getCustomerStatusPushContent(normalizedStatus, normalizedOrderId)
  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenDocs.map((entry) => entry.data.token),
    data: {
      type: 'order_status_update',
      orderId: normalizedOrderId,
      status: normalizedStatus,
      title: content.title,
      body: content.body,
      url: getTrackingUrlPath(currentOrderData, normalizedOrderId),
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
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidated,
  })

  return {
    sent: response.successCount,
    failed: response.failureCount,
    invalidated,
  }
}

module.exports = {
  disableCustomerOrderPushToken,
  registerCustomerOrderPushToken,
  sendCustomerOrderStatusPushToOrder,
  sendNewOrderPushToStore,
}
