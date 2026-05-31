const { onCall } = require('firebase-functions/v2/https')

const MERCHANT_ORDER_STATUS_FLOW = ['pendente', 'confirmado', 'preparando', 'pronto', 'em_rota', 'entregue', 'cancelado']
const MERCHANT_ORDER_STATUSES = new Set(MERCHANT_ORDER_STATUS_FLOW)
const MERCHANT_ORDER_FINAL_STATUSES = new Set(['entregue', 'cancelado'])
const MERCHANT_ORDER_NOTIFY_STATUSES = new Set(['preparando', 'em_rota', 'entregue', 'cancelado'])
const MERCHANT_ORDER_RATE_LIMIT_WINDOW_MS = 60 * 1000
const MERCHANT_ORDER_RATE_LIMIT_MAX = 60

function uniqueTruthy(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function isCallableAnonymousAuth(request) {
  const firebaseToken = request.auth?.token?.firebase || {}
  return firebaseToken.sign_in_provider === 'anonymous'
    || request.auth?.token?.sign_in_provider === 'anonymous'
}

function normalizeRoleValue(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'lojista') return 'merchant'
  if (normalized === 'dev') return 'developer'
  return normalized
}

function normalizeMerchantOrderStatus(status) {
  const value = String(status || 'pendente').toLowerCase().trim()



  const map = {
    novo: 'pendente',
    new: 'pendente',
    recebido: 'pendente',
    aguardando: 'pendente',
    pendente: 'pendente',
    aceito: 'confirmado',
    confirmado: 'confirmado',
    em_preparo: 'preparando',
    preparo: 'preparando',
    preparando: 'preparando',
    pronto: 'pronto',
    pronta: 'pronto',
    ready: 'pronto',
    ready_for_pickup: 'pronto',
    aguardando_retirada: 'pronto',
    entregando: 'em_rota',
    saiu_para_entrega: 'em_rota',
    saiu_entrega: 'em_rota',
    em_entrega: 'em_rota',
    out_for_delivery: 'em_rota',
    em_rota: 'em_rota',
    finalizado: 'entregue',
    delivered: 'entregue',
    entregue: 'entregue',
    canceled: 'cancelado',
    cancelled: 'cancelado',
    cancelado: 'cancelado',
  }

  return map[value] || value || 'pendente'
}

function getMerchantOrderStatusField(status) {
  return {
    pendente: 'pendingAt',
    confirmado: 'confirmedAt',
    preparando: 'preparingAt',
    pronto: 'readyAt',
    em_rota: 'outForDeliveryAt',
    entregue: 'deliveredAt',
    cancelado: 'canceledAt',
  }[status] || null
}

function getUserStoreKeysFromProfile(userData) {
  return uniqueTruthy([
    userData?.storeId,
    userData?.storeSlug,
    userData?.slug,
    ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
    ...(Array.isArray(userData?.storeKeys) ? userData.storeKeys : []),
  ])
}

function getOrderStoreKeys(orderData) {
  return uniqueTruthy([
    orderData?.storeId,
    orderData?.storeSlug,
    orderData?.storeDocId,
    ...(Array.isArray(orderData?.storeKeys) ? orderData.storeKeys : []),
  ])
}

function assertStoreOwnerOrAdmin(storeData, uid, userData, HttpsError) {
  const role = normalizeRoleValue(userData?.role)
  if (['admin', 'developer'].includes(role)) return

  const allowedUserIds = Array.isArray(storeData.allowedUserIds) ? storeData.allowedUserIds : []
  const merchantUids = Array.isArray(storeData.merchantUids) ? storeData.merchantUids : []
  const isOwner =
    storeData.ownerUid === uid ||
    storeData.ownerId === uid ||
    allowedUserIds.includes(uid) ||
    merchantUids.includes(uid)

  if (!isOwner) {
    throw new HttpsError('permission-denied', 'Permissao negada para esta loja.')
  }
}

async function assertMerchantCanManageOrder({ db, HttpsError, orderData, uid, userData }) {
  const role = normalizeRoleValue(userData?.role)
  if (['admin', 'developer'].includes(role)) return

  const userStoreKeys = getUserStoreKeysFromProfile(userData)
  const orderStoreKeys = getOrderStoreKeys(orderData)

  if (orderStoreKeys.some((key) => userStoreKeys.includes(key))) {
    return
  }

  const storeId = String(orderData?.storeId || orderData?.storeDocId || '').trim()
  if (storeId) {
    const storeSnapshot = await db.collection('stores').doc(storeId).get()
    if (storeSnapshot.exists) {
      assertStoreOwnerOrAdmin(storeSnapshot.data() || {}, uid, userData, HttpsError)
      return
    }
  }

  throw new HttpsError('permission-denied', 'Permissao negada para este pedido.')
}

function getOrderPaymentMethodId(orderData) {
  return String(
    orderData?.payment?.method ||
      orderData?.paymentMethod ||
      orderData?.paymentType ||
      ''
  ).toLowerCase().trim()
}

function getOrderPaymentStatusId(orderData) {
  return String(orderData?.payment?.status || orderData?.paymentStatus || '')
    .toLowerCase()
    .trim()
}

function isManualPixOrder(orderData) {
  return ['pix', 'pix_manual', 'manual_pix', 'pix_manual_store'].includes(getOrderPaymentMethodId(orderData))
}

function isOrderPaymentPaid(orderData) {
  const status = getOrderPaymentStatusId(orderData)
  return ['paid', 'confirmed', 'pago'].includes(status)
}

function shouldBlockMerchantOrderAction(orderData) {
  return orderData?.pricingValidation?.status === 'invalid'
}

function shouldBlockMerchantPreparationUntilPayment(orderData) {
  const status = normalizeMerchantOrderStatus(orderData?.status)
  const paymentStatus = getOrderPaymentStatusId(orderData)
  return isManualPixOrder(orderData)
    && status === 'pendente'
    && !isOrderPaymentPaid(orderData)
    && ['pending', 'proof_sent', 'manual', ''].includes(paymentStatus)
}

function sanitizeCancellationReason(value) {
  return String(value || '').trim().slice(0, 280)
}

function sanitizeMerchantOrderId(value, HttpsError) {
  const orderId = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(orderId)) {
    throw new HttpsError('invalid-argument', 'Pedido invalido.')
  }
  return orderId
}

function sanitizeRateLimitKey(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'unknown'
}

async function assertMerchantOrderRateLimit({ db, admin, HttpsError, logger, uid, storeId }) {
  const now = admin.firestore.Timestamp.now()
  const nowMs = now.toMillis()
  const safeUid = sanitizeRateLimitKey(uid)
  const safeStoreId = sanitizeRateLimitKey(storeId)
  const rateLimitRef = db.collection('rateLimits').doc(`updateMerchantOrder_${safeUid}_${safeStoreId}`)

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef)
    const data = snapshot.exists ? snapshot.data() || {} : {}
    const windowStartMs = data.windowStart?.toMillis ? data.windowStart.toMillis() : 0
    const shouldReset = !windowStartMs || nowMs - windowStartMs >= MERCHANT_ORDER_RATE_LIMIT_WINDOW_MS
    const count = shouldReset ? 0 : Number(data.count || 0)

    if (count >= MERCHANT_ORDER_RATE_LIMIT_MAX) {
      logger?.warn?.('[updateMerchantOrder] rate limit exceeded', { uid, storeId })
      throw new HttpsError('resource-exhausted', 'Muitas alteracoes em pouco tempo. Aguarde alguns segundos e tente novamente.')
    }

    transaction.set(rateLimitRef, {
      type: 'merchant_order_update',
      uid,
      storeId,
      count: count + 1,
      limit: MERCHANT_ORDER_RATE_LIMIT_MAX,
      windowStart: shouldReset ? now : data.windowStart || now,
      expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + MERCHANT_ORDER_RATE_LIMIT_WINDOW_MS),
      updatedAt: now,
    }, { merge: true })
  })
}

function buildMerchantNotificationPatch({ status, uid, now }) {
  if (!MERCHANT_ORDER_NOTIFY_STATUSES.has(status)) return {}

  return {
    customerLastNotifiedAt: now,
    customerLastNotifiedStatus: status,
    ...(status === 'preparando'
      ? {
          customerConfirmationMessageSentAt: now,
          customerConfirmationMessageSentBy: uid,
        }
      : {}),
  }
}

function buildMerchantStatusPatch({ HttpsError, orderData, nextStatus, uid, reason, now }) {
  const currentStatus = normalizeMerchantOrderStatus(orderData?.status)
  const currentIndex = MERCHANT_ORDER_STATUS_FLOW.indexOf(currentStatus)
  const nextIndex = MERCHANT_ORDER_STATUS_FLOW.indexOf(nextStatus)

  if (!MERCHANT_ORDER_STATUSES.has(nextStatus)) {
    throw new HttpsError('invalid-argument', 'Status invalido.')
  }

  if (MERCHANT_ORDER_FINAL_STATUSES.has(currentStatus) && nextStatus !== currentStatus) {
    throw new HttpsError('failed-precondition', 'Pedido finalizado nao pode ser alterado.')
  }

  if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex && nextStatus !== 'cancelado') {
    throw new HttpsError('failed-precondition', 'Nao e possivel retroceder o pedido.')
  }

  if (nextStatus !== 'cancelado' && nextStatus !== currentStatus && shouldBlockMerchantOrderAction(orderData)) {
    throw new HttpsError('failed-precondition', 'Pedido com valor suspeito precisa de revisao.')
  }

  if (nextStatus === 'preparando' && shouldBlockMerchantPreparationUntilPayment(orderData)) {
    throw new HttpsError('failed-precondition', 'Confirme o Pix antes de iniciar o preparo.')
  }

  const statusField = getMerchantOrderStatusField(nextStatus)
  const patch = {
    status: nextStatus,
    updatedAt: now,
    statusUpdatedBy: uid,
    statusUpdatedAt: now,
    statusUpdatedFrom: currentStatus,
    statusUpdatedTo: nextStatus,
  }

  if (statusField) patch[statusField] = now

  if (nextStatus === 'cancelado') {
    const normalizedReason = sanitizeCancellationReason(reason)
    if (normalizedReason.length < 5) {
      throw new HttpsError('invalid-argument', 'Informe um motivo de cancelamento.')
    }

    patch.cancellationReason = normalizedReason
    patch.cancelReason = normalizedReason
    patch.canceledReason = normalizedReason
    patch.canceledBy = uid
    patch.canceledByStore = true
    patch.cancellation = {
      reason: normalizedReason,
      canceledBy: uid,
      canceledByStore: true,
      canceledAt: now,
    }
  }

  if (nextStatus === 'entregue') {
    patch['payment.status'] = 'paid'
    patch['payment.confirmedAt'] = now
    patch['payment.paidAt'] = now
    patch['payment.confirmedBy'] = uid
    patch.paymentStatus = 'paid'
    patch.paidAt = now
  }

  return patch
}

function buildMerchantPixPatch({ HttpsError, orderData, uid, now }) {
  if (!isManualPixOrder(orderData)) {
    throw new HttpsError('failed-precondition', 'Este pedido nao e Pix manual.')
  }

  if (isOrderPaymentPaid(orderData)) {
    return null
  }

  if (MERCHANT_ORDER_FINAL_STATUSES.has(normalizeMerchantOrderStatus(orderData?.status))) {
    throw new HttpsError('failed-precondition', 'Pedido finalizado nao pode ter Pix alterado.')
  }

  if (shouldBlockMerchantOrderAction(orderData)) {
    throw new HttpsError('failed-precondition', 'Pedido com valor suspeito precisa de revisao.')
  }

  const currentStatus = normalizeMerchantOrderStatus(orderData?.status)
  const shouldStartPreparing = currentStatus === 'pendente'
  const method = getOrderPaymentMethodId(orderData) || 'pix_manual'

  return {
    updatedAt: now,
    statusUpdatedBy: uid,
    statusUpdatedAt: now,
    statusUpdatedFrom: currentStatus,
    statusUpdatedTo: shouldStartPreparing ? 'preparando' : currentStatus,
    'payment.method': method,
    'payment.status': 'paid',
    'payment.paidAt': now,
    'payment.confirmedAt': now,
    'payment.confirmedBy': uid,
    'payment.requiresConfirmation': false,
    paymentStatus: 'paid',
    paymentRequiresConfirmation: false,
    paidAt: now,
    ...(shouldStartPreparing
      ? {
          status: 'preparando',
          preparingAt: now,
        }
      : {}),
  }
}

function assertNonAnonymousCallableUser(request, HttpsError) {
  const uid = request.auth?.uid

  if (!uid || isCallableAnonymousAuth(request)) {
    throw new HttpsError('unauthenticated', 'Acesso negado.')
  }

  return uid
}

function createMerchantOrderFunctions({ db, admin, HttpsError, logger, region = 'southamerica-east1' }) {
  const updateMerchantOrder = onCall(
    { region, timeoutSeconds: 30, memory: '256MiB', maxInstances: 10 },
    async (request) => {
      const uid = assertNonAnonymousCallableUser(request, HttpsError)
      const data = request.data || {}
      const action = String(data.action || 'updateStatus').trim()
      const orderId = sanitizeMerchantOrderId(data.orderId, HttpsError)

      const userSnapshot = await db.collection('users').doc(uid).get()
      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Usuario nao encontrado.')
      }

      const userData = userSnapshot.data() || {}
      const orderRef = db.collection('orders').doc(orderId)
      const orderSnapshot = await orderRef.get()
      if (!orderSnapshot.exists) {
        throw new HttpsError('not-found', 'Pedido nao encontrado.')
      }

      const initialOrderData = orderSnapshot.data() || {}
      await assertMerchantCanManageOrder({ db, HttpsError, orderData: initialOrderData, uid, userData })
      await assertMerchantOrderRateLimit({
        db,
        admin,
        HttpsError,
        logger,
        uid,
        storeId: initialOrderData.storeId || initialOrderData.storeDocId || 'unknown',
      })

      const now = admin.firestore.FieldValue.serverTimestamp()

      const result = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(orderRef)
        if (!currentSnapshot.exists) {
          throw new HttpsError('not-found', 'Pedido nao encontrado.')
        }

        const orderData = currentSnapshot.data() || {}
        let patch
        let nextStatus = normalizeMerchantOrderStatus(orderData?.status)

        if (action === 'updateStatus') {
          nextStatus = normalizeMerchantOrderStatus(data.status)
          patch = buildMerchantStatusPatch({
            HttpsError,
            orderData,
            nextStatus,
            uid,
            reason: data.cancellationReason,
            now,
          })
        } else if (action === 'confirmPixPayment') {
          patch = buildMerchantPixPatch({ HttpsError, orderData, uid, now }) || {
            updatedAt: now,
          }
          nextStatus = patch.status || normalizeMerchantOrderStatus(orderData?.status)
        } else if (action === 'markCustomerNotified') {
          nextStatus = normalizeMerchantOrderStatus(data.status || orderData?.status)
          if (!MERCHANT_ORDER_NOTIFY_STATUSES.has(nextStatus)) {
            throw new HttpsError('invalid-argument', 'Status de aviso invalido.')
          }

          patch = {
            ...buildMerchantNotificationPatch({ status: nextStatus, uid, now }),
            updatedAt: now,
          }
        } else if (action === 'markCustomerThanked') {
          if (normalizeMerchantOrderStatus(orderData?.status) !== 'entregue') {
            throw new HttpsError('failed-precondition', 'Agradecimento disponivel apenas apos entrega.')
          }

          patch = {
            storeThankedCustomerAt: now,
            storeThankedCustomerBy: uid,
            updatedAt: now,
          }
        } else {
          throw new HttpsError('invalid-argument', 'Acao invalida.')
        }

        transaction.update(orderRef, patch)

        return {
          status: nextStatus,
          storeId: orderData.storeId || '',
          storeSlug: orderData.storeSlug || '',
          changedFields: Object.keys(patch),
        }
      })

      await db.collection('auditLogs').add({
        action: `merchant_order_${action}`,
        entity: 'order',
        entityId: orderId,
        storeId: result.storeId,
        storeSlug: result.storeSlug,
        actorUid: uid,
        changedFields: result.changedFields,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'cloud_function',
      })

      return {
        ok: true,
        orderId,
        status: result.status,
      }
    }
  )

  return { updateMerchantOrder }
}

module.exports = {
  createMerchantOrderFunctions,
}
