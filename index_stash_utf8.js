const {
    onDocumentCreated,
    onDocumentWritten,
    onDocumentUpdated,
  } = require('firebase-functions/v2/firestore')
const { onValueWritten } = require('firebase-functions/v2/database')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')
const crypto = require('crypto')

setGlobalOptions({
  region: 'southamerica-east1',
  minInstances: 0,
  maxInstances: 3,
  cpu: 'gcf_gen1'
})
const { createPublicOrderHandler } = require('./publicOrder')
const { createAsaasFunctions } = require('./asaas')

admin.initializeApp()

const db = admin.firestore()
const asaasFunctions = createAsaasFunctions({ db, admin, logger })
const TERMS_VERSION = '2026-05-24'
const PRIVACY_VERSION = '2026-05-24'

exports.startAsaasSubscription = asaasFunctions.startAsaasSubscription
exports.getSubscriptionManagementData = asaasFunctions.getSubscriptionManagementData
exports.changeSubscriptionPlan = asaasFunctions.changeSubscriptionPlan
exports.cancelSubscription = asaasFunctions.cancelSubscription
exports.requestSubscriptionDueDateChange = asaasFunctions.requestSubscriptionDueDateChange
exports.syncAsaasSubscriptionStatus = asaasFunctions.syncAsaasSubscriptionStatus
exports.createPaymentMethodUpdateCheckout = asaasFunctions.createPaymentMethodUpdateCheckout
exports.asaasWebhook = asaasFunctions.asaasWebhook

exports.createPublicOrder = onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  createPublicOrderHandler({
    db,
    admin,
    HttpsError,
    logger,
    maxOrderCents: 100000000,
  })
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
      warnings.push(`Adicional/op├º├úo n├úo encontrado no produto: ${selectedChoice.name || selectedChoice.id}`)
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
        errors.push(`Produto n├úo encontrado: ${productId}`)
        continue
      }

      if (!isSameStore(order, product)) {
        errors.push(`Produto de outra loja ou storeId incompat├¡vel: ${productId}`)
        continue
      }

      if (
        product.isDeleted === true ||
        product.isActive === false ||
        product.isVisible === false ||
        product.deletedAt
      ) {
        errors.push(`Produto indispon├¡vel: ${product.name || productId}`)
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

function normalizeBrazilianPhone(phone) {
  let digits = String(phone).replace(/\D/g, '')
  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits
    }
  }
  if (digits.length !== 12 && digits.length !== 13) {
    return null
  }
  return { phoneDigits: digits, phoneE164: '+' + digits }
}

function validateBrazilianMobilePhone(phone) {
  const rawDigits = String(phone || '').replace(/\D/g, '')
  let nationalDigits = ''

  if (rawDigits.length === 13 && rawDigits.startsWith('55')) {
    nationalDigits = rawDigits.slice(2)
  } else if (rawDigits.length === 11) {
    nationalDigits = rawDigits
  } else {
    return { ok: false }
  }

  const ddd = nationalDigits.slice(0, 2)
  const localNumber = nationalDigits.slice(2)
  const localTail = localNumber.slice(1)

  if (ddd.startsWith('0') || localNumber.length !== 9 || localNumber[0] !== '9') {
    return { ok: false }
  }

  const repeatedRun = /(\d)\1{4,}/
  const obviousLocalNumbers = new Set([
    '999999999',
    '999111111',
    '900000000',
    '911111111',
  ])

  if (
    /^(\d)\1+$/.test(nationalDigits) ||
    /(\d)\1{3}$/.test(localNumber) ||
    repeatedRun.test(localNumber) ||
    obviousLocalNumbers.has(localNumber) ||
    ['12345678', '87654321', '11111111', '00000000'].some((pattern) => localTail.includes(pattern))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    phoneDigits: `55${nationalDigits}`,
    phoneE164: `+55${nationalDigits}`,
  }
}

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

function getIsMockOtpAllowed() {
  return process.env.FUNCTIONS_EMULATOR === 'true'
}

function getIsRealOtpProviderEnabled() {
  return process.env.OTP_PROVIDER_ENABLED === 'true'
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashOtpCode(uid, phoneE164, code) {
  const secret = process.env.OTP_SECRET
  if (!secret && !getIsMockOtpAllowed()) {
    throw new HttpsError('failed-precondition', 'Servi├ºo de configura├º├úo pendente.')
  }
  const useSecret = secret || 'mock-secret-for-dev-only'
  return crypto.createHmac('sha256', useSecret).update(`${uid}:${phoneE164}:${code}`).digest('hex')
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
    throw new HttpsError('already-exists', 'Este telefone j├í est├í vinculado a outra conta.')
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

// Legacy verification flow. Firebase Phone Auth is the active onboarding verification path.
const _requestPhoneVerificationLegacyHandler = onCall({ region: 'southamerica-east1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const { phone } = request.data
  if (!phone) throw new HttpsError('invalid-argument', 'Telefone obrigat├│rio.')

  const normalized = normalizeBrazilianPhone(phone)
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'Formato de telefone inv├ílido. Use DDD + N├║mero.')
  }
  const { phoneDigits, phoneE164 } = normalized

  const userRef = db.collection('users').doc(uid)
  const userDoc = await userRef.get()
  
  if (!userDoc.exists) {
    throw new HttpsError('failed-precondition', 'Perfil n├úo encontrado.')
  }
  
  const userData = userDoc.data()
  if (userData.role !== 'merchant') {
    throw new HttpsError('permission-denied', 'Permiss├úo negada.')
  }
  if (userData.phoneVerified === true) {
    return { ok: true, alreadyVerified: true }
  }

  const claimRef = db.collection('phoneClaims').doc(phoneE164)
  const hashedClaimRef = db.collection('phoneClaims').doc(hashPhoneE164(phoneE164))
  const claimDoc = await claimRef.get()
  const hashedClaimDoc = await hashedClaimRef.get()
  const claimUid = claimDoc.exists ? (claimDoc.data().ownerUid || claimDoc.data().uid || '') : ''
  const hashedClaimUid = hashedClaimDoc.exists
    ? (hashedClaimDoc.data().ownerUid || hashedClaimDoc.data().uid || '')
    : ''
  if ((claimUid && claimUid !== uid) || (hashedClaimUid && hashedClaimUid !== uid)) {
    throw new HttpsError('already-exists', 'Este WhatsApp j├í est├í vinculado a outra conta.')
  }

  const verificationsRef = db.collection('phoneVerifications').doc(uid)
  const verificationsDoc = await verificationsRef.get()
  
  const now = admin.firestore.Timestamp.now()
  let hourlyCount = 0
  let hourlyWindowStart = now
  let resendAvailableAt = now

  if (verificationsDoc.exists) {
    const vData = verificationsDoc.data()
    const diffHours = (now.toMillis() - vData.hourlyWindowStart.toMillis()) / (1000 * 60 * 60)
    
    if (diffHours < 1) {
      hourlyCount = vData.hourlyCount || 0
      hourlyWindowStart = vData.hourlyWindowStart
    }
    
    if (hourlyCount >= 5) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde alguns minutos.')
    }
    
    if (vData.resendAvailableAt && now.toMillis() < vData.resendAvailableAt.toMillis()) {
      throw new HttpsError('resource-exhausted', 'Aguarde o tempo de reenvio.')
    }
  }

  const isMockAllowed = getIsMockOtpAllowed()
  const isRealEnabled = getIsRealOtpProviderEnabled()

  if (!isMockAllowed && !isRealEnabled) {
    throw new HttpsError(
      'failed-precondition',
      'A confirma├º├úo autom├ítica de WhatsApp ainda est├í em implanta├º├úo. Fale com o suporte para ativar sua loja.'
    )
  }

  if (isRealEnabled) {
    if (!process.env.OTP_SECRET) {
      logger.error('Falta OTP_SECRET em produ├º├úo com OTP_PROVIDER_ENABLED=true.')
      throw new HttpsError('failed-precondition', 'Servi├ºo de configura├º├úo pendente.')
    }
    // TODO: Em produ├º├úo integrar envio real (ex: Twilio, WhatsApp Cloud API) aqui.
  }

  const code = generateOtpCode()
  const codeHash = hashOtpCode(uid, phoneE164, code)

  const expiresAtMillis = now.toMillis() + 10 * 60 * 1000 // 10 minutos
  const resendAtMillis = now.toMillis() + 60 * 1000 // 60 segundos

  await verificationsRef.set({
    uid,
    phoneE164,
    phoneDigits,
    codeHash,
    expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMillis),
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    resendAvailableAt: admin.firestore.Timestamp.fromMillis(resendAtMillis),
    hourlyWindowStart,
    hourlyCount: hourlyCount + 1,
    status: 'pending'
  })

  const updateData = {
    phone: phoneDigits,
    phoneE164,
    phoneVerified: false,
    updatedAt: now
  }
  if (!userData.onboardingStatus) {
    updateData.onboardingStatus = 'phone_pending'
  }
  await userRef.update(updateData)

  const response = {
    ok: true,
    sent: true,
    expiresInSeconds: 600,
    resendInSeconds: 60
  }

  if (isMockAllowed) {
    logger.info(`[MOCK OTP] code=${code} para uid=${uid} phone=${phoneE164}`)
    response.debugCode = code
  }

  return response
})

// Legacy verification flow. Firebase Phone Auth is the active onboarding verification path.
const _confirmPhoneVerificationLegacyHandler = onCall({ region: 'southamerica-east1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado.')

  const { code } = request.data
  if (!code || typeof code !== 'string') {
    throw new HttpsError('invalid-argument', 'C├│digo inv├ílido.')
  }

  const cleanCode = code.replace(/\D/g, '')
  if (cleanCode.length !== 6) {
    throw new HttpsError('invalid-argument', 'C├│digo deve ter 6 d├¡gitos.')
  }

  const userRef = db.collection('users').doc(uid)
  const verificationsRef = db.collection('phoneVerifications').doc(uid)

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef)
    if (!userDoc.exists) {
      throw new HttpsError('failed-precondition', 'Perfil n├úo encontrado.')
    }
    
    const userData = userDoc.data()
    if (userData.role !== 'merchant') {
      throw new HttpsError('permission-denied', 'Permiss├úo negada.')
    }
    
    const vDoc = await transaction.get(verificationsRef)
    if (!vDoc.exists) {
      throw new HttpsError('failed-precondition', 'Nenhuma verifica├º├úo pendente.')
    }

    const vData = vDoc.data()
    if (vData.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Nenhuma verifica├º├úo pendente.')
    }

    const now = admin.firestore.Timestamp.now()
    if (vData.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError('deadline-exceeded', 'C├│digo expirado. Envie um novo c├│digo.')
    }

    if (vData.attempts >= 5) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Solicite um novo c├│digo mais tarde.')
    }

    const expectedHash = vData.codeHash
    const providedHash = hashOtpCode(uid, vData.phoneE164, cleanCode)

    let isMatch = false
    try {
      const expectedBuffer = Buffer.from(expectedHash, 'hex')
      const providedBuffer = Buffer.from(providedHash, 'hex')
      if (expectedBuffer.length === providedBuffer.length) {
        isMatch = crypto.timingSafeEqual(expectedBuffer, providedBuffer)
      }
    } catch (err) {
      isMatch = false
    }

    if (!isMatch) {
      transaction.update(verificationsRef, {
        attempts: admin.firestore.FieldValue.increment(1),
        updatedAt: now
      })
      throw new HttpsError('invalid-argument', 'C├│digo incorreto.')
    }

    const claimRef = db.collection('phoneClaims').doc(vData.phoneE164)
    const hashedClaimRef = db.collection('phoneClaims').doc(hashPhoneE164(vData.phoneE164))
    const claimDoc = await transaction.get(claimRef)
    const hashedClaimDoc = await transaction.get(hashedClaimRef)

    const claimUid = claimDoc.exists ? (claimDoc.data().ownerUid || claimDoc.data().uid || '') : ''
    const hashedClaimUid = hashedClaimDoc.exists
      ? (hashedClaimDoc.data().ownerUid || hashedClaimDoc.data().uid || '')
      : ''

    if ((claimUid && claimUid !== uid) || (hashedClaimUid && hashedClaimUid !== uid)) {
      throw new HttpsError('already-exists', 'Este WhatsApp j├í est├í vinculado a outra conta.')
    }

    transaction.set(claimRef, {
      ownerUid: uid,
      claimedAt: now
    }, { merge: true })
    transaction.set(hashedClaimRef, {
      uid,
      ownerUid: uid,
      phoneHash: hashPhoneE164(vData.phoneE164),
      provider: 'legacy_otp',
      createdAt: hashedClaimDoc.exists ? hashedClaimDoc.data().createdAt || now : now,
      updatedAt: now,
    }, { merge: true })

    const currentOnboarding = userData.onboardingStatus || ''
    const nextOnboarding = currentOnboarding === 'completed' ? 'completed' : 'phone_verified'

    transaction.update(userRef, {
      phoneVerified: true,
      phone: vData.phoneDigits,
      phoneE164: vData.phoneE164,
      onboardingStatus: nextOnboarding,
      updatedAt: now
    })

    transaction.update(verificationsRef, {
      status: 'verified',
      verifiedAt: now,
      updatedAt: now
    })

    return {
      ok: true,
      verified: true,
      onboardingStatus: nextOnboarding
    }
  })
})

// Deprecated callable names kept to avoid surprise deletions on deploy.
// Firebase Phone Auth is the active verification path.
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
    if (!userDoc.exists) throw new HttpsError('failed-precondition', 'Usu├írio n├úo encontrado.')

    const userData = userDoc.data()
    const now = admin.firestore.Timestamp.now()

    if (userData.role !== 'merchant') throw new HttpsError('permission-denied', 'Permiss├úo negada.')

    // 1. Se phoneVerified !== true:
    if (userData.phoneVerified !== true) {
      logger.warn(`[startFreeTrial] Bloqueado: Telefone n├úo confirmado para o usu├írio ${uid}.`)
      throw new HttpsError('failed-precondition', 'Verifique seu telefone antes de ativar o teste gr├ítis.')
    }

    // 4. Se o usu├írio j├í tem storeId/storeIds:
    const existingStoreId = userData.storeId || (Array.isArray(userData.storeIds) && userData.storeIds[0])

    // Fazer todas as leituras primeiro
    let storeDoc = null
    if (existingStoreId) {
      storeDoc = await transaction.get(db.collection('stores').doc(existingStoreId))
    }

    if (existingStoreId) {
      logger.info(`[startFreeTrial] Usu├írio ${uid} j├í possui loja ${existingStoreId}. Retornando loja existente.`)

      if (!storeDoc || !storeDoc.exists) {
        logger.error(`[startFreeTrial] Loja vinculada n├úo foi encontrada para o usu├írio ${uid} (storeId: ${existingStoreId}).`)
        throw new HttpsError('failed-precondition', 'Loja vinculada n├úo foi encontrada. Entre em contato com o suporte.')
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
      logger.error(`[startFreeTrial] Status de onboarding inv├ílido para o usu├írio ${uid}: ${onboardingStatus}`)
      throw new HttpsError('failed-precondition', 'Status de onboarding inv├ílido.')
    }

    // 3. Se onboardingStatus estiver em pending ou phone_pending, mas phoneVerified === true:
    if (onboardingStatus === 'pending' || onboardingStatus === 'phone_pending') {
      logger.warn(`[startFreeTrial] Status inconsistente detectado para o usu├írio ${uid}: onboardingStatus="${onboardingStatus}", mas phoneVerified=true. Permitindo cria├º├úo da loja.`)
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
      throw new HttpsError('resource-exhausted', 'N├úo foi poss├¡vel gerar uma URL ├║nica para a loja. Tente novamente.')
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
  if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Usu├írio n├úo encontrado.')
  const callerData = callerDoc.data()
  if (!['admin', 'developer', 'dev'].includes(callerData.role)) {
    throw new HttpsError('permission-denied', 'Permiss├úo negada.')
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
  if (!normalizedPhone) throw new HttpsError('invalid-argument', 'WhatsApp inv├ílido.')
  const { phoneE164, phoneDigits } = normalizedPhone

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inv├ílido.')
  if (!password || password.length < 8) throw new HttpsError('invalid-argument', 'A senha precisa ter pelo menos 8 caracteres.')
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpsError('invalid-argument', 'A senha precisa misturar letras e n├║meros.')
  }
  if (!name) throw new HttpsError('invalid-argument', 'Nome da loja obrigat├│rio.')
  if (!ownerName) throw new HttpsError('invalid-argument', 'Nome do propriet├írio obrigat├│rio.')

  if (!['essential', 'professional', 'premium'].includes(plan)) {
    throw new HttpsError('invalid-argument', 'Plano inv├ílido. Use essential, professional ou premium.')
  }
  if (!['monthly', 'annual'].includes(billingCycle)) {
    throw new HttpsError('invalid-argument', 'Ciclo de pagamento inv├ílido.')
  }
  if (!['trialing', 'active', 'blocked'].includes(subscriptionStatus)) {
    throw new HttpsError('invalid-argument', 'Status de assinatura inv├ílido. Use apenas trialing, active ou blocked.')
  }

  const normalizedPlan = plan
  const normalizedSubscriptionStatus = subscriptionStatus

  try {
    await admin.auth().getUserByEmail(email)
    throw new HttpsError('already-exists', 'J├í existe uma conta com este e-mail.')
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
        throw new HttpsError('resource-exhausted', 'N├úo foi poss├¡vel gerar slug. Tente novamente.')
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
    throw new HttpsError('internal', 'Erro interno ao criar loja e usu├írio.')
  }
})

// ÔöÇÔöÇÔöÇ Callable: updateMyProfile ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
exports.acceptLatestTerms = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usu├írio n├úo autenticado.')
    }

    const allowedKeys = []
    const dataKeys = Object.keys(request.data || {})
    if (dataKeys.some((key) => !allowedKeys.includes(key))) {
      throw new HttpsError('invalid-argument', 'Payload inv├ílido.')
    }

    const userRef = db.collection('users').doc(request.auth.uid)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'Perfil do usu├írio n├úo encontrado.')
    }

    await userRef.update({
      termsAccepted: true,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      ok: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    }
  }
)

exports.updateBillingNotificationPreferences = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Usu├írio n├úo autenticado.')
    }

    const data = request.data || {}
    const allowedKeys = ['trialReminderEmailOptIn']
    const dataKeys = Object.keys(data)
    if (
      dataKeys.some((key) => !allowedKeys.includes(key)) ||
      typeof data.trialReminderEmailOptIn !== 'boolean'
    ) {
      throw new HttpsError('invalid-argument', 'Prefer├¬ncia inv├ílida.')
    }

    const userRef = db.collection('users').doc(request.auth.uid)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'Perfil do usu├írio n├úo encontrado.')
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
      throw new HttpsError('unauthenticated', 'Usu├írio n├úo autenticado.')
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
          `Campo "${field}" n├úo pode ser alterado por esta fun├º├úo.`
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
      throw new HttpsError('invalid-argument', 'URL de foto inv├ílida. Use o Cloudinary.')
    }
    if (avatarUrl && !isCloudinaryUrl(avatarUrl)) {
      throw new HttpsError('invalid-argument', 'URL de avatar inv├ílida. Use o Cloudinary.')
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
// Audit: registra altera├º├Áes de status da loja (isOpen, isActive, etc.)
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
// Scheduler: limpa usu├írios an├┤nimos do Firebase Auth com mais de 30 dias.
// Evita acumula├º├úo ilimitada de contas fantasmas de visitantes da storefront.
// Roda diariamente ├ás 03:00 (hor├írio de Bras├¡lia = 06:00 UTC).
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
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)

    let nextPageToken = undefined
    let totalDeleted = 0
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

        if (toDelete.length > 0) {
          // deleteUsers accepts up to 1000 UIDs per call
          for (let i = 0; i < toDelete.length; i += 1000) {
            const chunk = toDelete.slice(i, i + 1000)
            await admin.auth().deleteUsers(chunk)
            totalDeleted += chunk.length
          }
        }
      } while (nextPageToken)

      logger.info('[cleanupAnonymousUsers] Conclu├¡do.', { totalScanned, totalDeleted })
    } catch (error) {
      logger.error('[cleanupAnonymousUsers] Erro durante limpeza:', error)
      throw error
    }
  }
)
