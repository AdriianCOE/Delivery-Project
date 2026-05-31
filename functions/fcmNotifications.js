function isInvalidFcmTokenError(error) {
  const code = String(error?.code || error?.errorInfo?.code || '').toLowerCase()
  return [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
  ].includes(code)
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

module.exports = {
  sendNewOrderPushToStore,
}
