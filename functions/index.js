const {
    onDocumentCreated,
    onDocumentUpdated,
  } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
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