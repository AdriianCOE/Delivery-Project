'use strict'

const SOLD_OUT_BEHAVIORS = new Set(['show_sold_out', 'hide'])

class InventoryError extends Error {
  constructor(code, message, productId = '') {
    super(message)
    this.name = 'InventoryError'
    this.code = code
    this.productId = productId
  }
}

function isStockObject(stock) {
  return stock !== null && typeof stock === 'object' && !Array.isArray(stock)
}

function isNumericStock(stock) {
  if (typeof stock === 'number') return Number.isFinite(stock)
  if (typeof stock !== 'string' || stock.trim() === '') return false
  return Number.isFinite(Number(stock))
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback
}

function normalizeStock(stock) {
  if (stock === undefined || stock === null || stock === '') {
    return {
      tracked: false,
      format: 'none',
      enabled: false,
      quantity: null,
      lowStockThreshold: 5,
      soldOutBehavior: 'show_sold_out',
      allowBackorder: false,
    }
  }

  if (isNumericStock(stock)) {
    return {
      tracked: true,
      format: 'legacy',
      enabled: true,
      quantity: normalizeNonNegativeInteger(stock),
      lowStockThreshold: 5,
      soldOutBehavior: 'show_sold_out',
      allowBackorder: false,
    }
  }

  if (isStockObject(stock)) {
    const enabled = stock.enabled === true
    return {
      tracked: enabled,
      format: 'object',
      enabled,
      quantity: enabled ? normalizeNonNegativeInteger(stock.quantity) : null,
      lowStockThreshold: normalizeNonNegativeInteger(stock.lowStockThreshold, 5),
      soldOutBehavior: SOLD_OUT_BEHAVIORS.has(stock.soldOutBehavior)
        ? stock.soldOutBehavior
        : 'show_sold_out',
      allowBackorder: enabled && stock.allowBackorder === true,
    }
  }

  return {
    tracked: false,
    format: 'none',
    enabled: false,
    quantity: null,
    lowStockThreshold: 5,
    soldOutBehavior: 'show_sold_out',
    allowBackorder: false,
  }
}

function isLegacyStock(stock) {
  return isNumericStock(stock)
}

function isStockControlled(stock) {
  return normalizeStock(stock).tracked
}

function getStockQuantity(stock) {
  return normalizeStock(stock).quantity
}

function isStockOrderable(stock) {
  return validateStockQuantity(stock, 1) === null
}

function validateStockQuantity(stock, requestedQuantity, productName) {
  const normalized = normalizeStock(stock)
  if (!normalized.tracked || normalized.allowBackorder) return null

  const requested = Math.max(1, Math.floor(Number(requestedQuantity) || 1))
  if (normalized.quantity >= requested) return null

  const name = productName ? `"${productName}"` : 'Produto'
  if (normalized.quantity <= 0) return `${name} está esgotado.`
  return `${name}: estoque insuficiente.`
}

function computePublicStock(stock) {
  const normalized = normalizeStock(stock)
  if (!normalized.tracked) {
    return {
      enabled: false,
      status: 'not_tracked',
      soldOutBehavior: 'show_sold_out',
    }
  }

  let status = 'in_stock'
  if (!normalized.allowBackorder && normalized.quantity <= 0) {
    status = 'sold_out'
  } else if (!normalized.allowBackorder && normalized.quantity <= normalized.lowStockThreshold) {
    status = 'low_stock'
  }

  return {
    enabled: true,
    status,
    soldOutBehavior: normalized.soldOutBehavior,
  }
}

function shouldHideWhenSoldOut(stock) {
  const normalized = normalizeStock(stock)
  return (
    normalized.tracked &&
    normalized.quantity <= 0 &&
    normalized.soldOutBehavior === 'hide' &&
    !normalized.allowBackorder
  )
}

function aggregateStockItems(items) {
  const byProductId = new Map()

  for (const item of Array.isArray(items) ? items : []) {
    const productId = String(item?.productId || '').trim()
    if (!productId) continue

    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1))
    const current = byProductId.get(productId)
    if (current) {
      current.quantity += quantity
      continue
    }

    byProductId.set(productId, {
      productId,
      productName: String(item?.productName || '').slice(0, 120),
      quantity,
      storeId: String(item?.storeId || '').trim(),
      stockFormat: ['legacy', 'object'].includes(item?.stockFormat)
        ? item.stockFormat
        : null,
    })
  }

  return [...byProductId.values()]
}

function buildInventoryMovement({
  productId,
  productName,
  orderId,
  type,
  delta,
  quantityBefore,
  quantityAfter,
  reason,
  createdBy,
  now,
}) {
  return {
    productId: String(productId || ''),
    productName: String(productName || '').slice(0, 120),
    orderId: orderId ? String(orderId) : null,
    type,
    delta: Math.trunc(Number(delta) || 0),
    quantityBefore: Math.trunc(Number(quantityBefore) || 0),
    quantityAfter: Math.trunc(Number(quantityAfter) || 0),
    reason: reason ? String(reason).slice(0, 200) : null,
    createdBy: String(createdBy || 'system'),
    createdAt: now,
  }
}

async function readTransactionDocuments(transaction, refs) {
  if (!refs.length) return []
  if (typeof transaction.getAll === 'function') return transaction.getAll(...refs)
  return Promise.all(refs.map((ref) => transaction.get(ref)))
}

function productBelongsToExpectedStore(productData, expectedStoreId, expectedStoreKeys = []) {
  const expectedKeys = new Set(
    [expectedStoreId, ...(Array.isArray(expectedStoreKeys) ? expectedStoreKeys : [])]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )
  if (!expectedKeys.size) return false

  const directKeys = [
    productData?.storeId,
    productData?.storeDocId,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (!directKeys.length) return false
  return directKeys.every((key) => expectedKeys.has(key))
}

async function decrementStockInTransaction({
  db,
  admin: _admin,
  transaction,
  items,
  orderId,
  storeId,
  storeKeys,
  createdBy,
  now,
}) {
  const aggregatedItems = aggregateStockItems(items)
  const productRefs = aggregatedItems.map((item) => db.collection('products').doc(item.productId))
  const productSnapshots = await readTransactionDocuments(transaction, productRefs)
  const movementIds = []
  const decrementedItems = []

  for (let index = 0; index < aggregatedItems.length; index += 1) {
    const item = aggregatedItems[index]
    const productRef = productRefs[index]
    const productSnapshot = productSnapshots[index]

    if (!productSnapshot?.exists) {
      throw new InventoryError(
        'stock_unavailable',
        `Produto indisponível: ${item.productName || item.productId}.`,
        item.productId
      )
    }

    const productData = productSnapshot.data() || {}
    if (!productBelongsToExpectedStore(productData, storeId, storeKeys)) {
      throw new InventoryError(
        'stock_unavailable',
        `Produto indisponível: ${item.productName || productData.name || item.productId}.`,
        item.productId
      )
    }

    const normalized = normalizeStock(productData.stock)
    if (!normalized.tracked) continue

    if (!normalized.allowBackorder && normalized.quantity < item.quantity) {
      throw new InventoryError(
        normalized.quantity <= 0 ? 'stock_unavailable' : 'stock_insufficient',
        normalized.quantity <= 0
          ? `Produto esgotado: ${item.productName || productData.name || item.productId}.`
          : `Estoque insuficiente: ${item.productName || productData.name || item.productId}.`,
        item.productId
      )
    }

    const quantityBefore = normalized.quantity
    const quantityAfter = normalized.allowBackorder
      ? quantityBefore - item.quantity
      : Math.max(0, quantityBefore - item.quantity)

    if (normalized.format === 'legacy') {
      transaction.update(productRef, {
        stock: quantityAfter,
        updatedAt: now,
      })
    } else {
      transaction.update(productRef, {
        'stock.quantity': quantityAfter,
        'stock.updatedAt': now,
        'stock.updatedBy': createdBy || 'system',
        updatedAt: now,
      })
    }

    const movementStoreId = String(storeId || item.storeId || productData.storeId || '').trim()
    if (!movementStoreId) {
      throw new Error(`[inventory] Loja ausente para o produto ${item.productId}.`)
    }

    const movementRef = db
      .collection('stores')
      .doc(movementStoreId)
      .collection('inventoryMovements')
      .doc()

    transaction.set(movementRef, buildInventoryMovement({
      productId: item.productId,
      productName: item.productName || productData.name || '',
      orderId,
      type: 'sale_decrement',
      delta: -item.quantity,
      quantityBefore,
      quantityAfter,
      reason: `Pedido ${orderId}`,
      createdBy,
      now,
    }))

    movementIds.push(movementRef.id)
    decrementedItems.push({
      productId: item.productId,
      productName: item.productName || productData.name || '',
      quantity: item.quantity,
      storeId: movementStoreId,
      stockFormat: normalized.format,
    })
  }

  return {
    decremented: decrementedItems.length > 0,
    movementIds,
    items: decrementedItems,
  }
}

async function restoreStockInTransaction({
  db,
  admin: _admin,
  transaction,
  orderRef,
  orderData,
  restoredBy,
  reason,
  now,
}) {
  const inventory = orderData?.inventory || {}
  if (inventory.decremented !== true || inventory.restored === true) return null

  const storedItems = Array.isArray(inventory.items) ? inventory.items : orderData?.items
  const items = aggregateStockItems(storedItems)
  if (!items.length) {
    throw new Error(`[inventory] Pedido ${orderRef.id} marcado como decrementado sem itens de estoque.`)
  }

  const productRefs = items.map((item) => db.collection('products').doc(item.productId))
  const productSnapshots = await readTransactionDocuments(transaction, productRefs)
  const movementIds = []
  const skippedItems = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const productRef = productRefs[index]
    const productSnapshot = productSnapshots[index]

    if (!productSnapshot?.exists) {
      skippedItems.push({
        productId: item.productId,
        productName: item.productName || '',
        quantity: item.quantity,
        reason: 'product_missing',
      })
      continue
    }

    const productData = productSnapshot.data() || {}
    const normalized = normalizeStock(productData.stock)
    const stockFormat = item.stockFormat || normalized.format
    if (stockFormat === 'none') {
      skippedItems.push({
        productId: item.productId,
        productName: item.productName || productData.name || '',
        quantity: item.quantity,
        reason: 'stock_format_missing',
      })
      continue
    }

    const quantityBefore = normalized.quantity ?? 0
    const quantityAfter = quantityBefore + item.quantity

    if (stockFormat === 'legacy') {
      transaction.update(productRef, {
        stock: quantityAfter,
        updatedAt: now,
      })
    } else {
      transaction.update(productRef, {
        'stock.quantity': quantityAfter,
        'stock.updatedAt': now,
        'stock.updatedBy': restoredBy || 'system',
        updatedAt: now,
      })
    }

    const movementStoreId = String(item.storeId || orderData?.storeId || productData.storeId || '').trim()
    if (!movementStoreId) {
      throw new Error(`[inventory] Loja ausente para restaurar o produto ${item.productId}.`)
    }

    const movementRef = db
      .collection('stores')
      .doc(movementStoreId)
      .collection('inventoryMovements')
      .doc()

    transaction.set(movementRef, buildInventoryMovement({
      productId: item.productId,
      productName: item.productName || productData.name || '',
      orderId: orderRef.id,
      type: 'order_cancel_restore',
      delta: item.quantity,
      quantityBefore,
      quantityAfter,
      reason: reason || `Cancelamento do pedido ${orderRef.id}`,
      createdBy: restoredBy,
      now,
    }))
    movementIds.push(movementRef.id)
  }

  const patch = {
    'inventory.restored': true,
    'inventory.restoredAt': now,
    'inventory.restoredBy': restoredBy || 'system',
    'inventory.restoreMovements': movementIds,
  }
  if (skippedItems.length > 0) patch['inventory.restoreSkippedItems'] = skippedItems

  return patch
}

function normalizeStockForForm(rawStock) {
  const normalized = normalizeStock(rawStock)
  return {
    enabled: normalized.tracked,
    quantity: normalized.quantity === null ? '0' : String(normalized.quantity),
    lowStockThreshold: String(normalized.lowStockThreshold),
    soldOutBehavior: normalized.soldOutBehavior,
    allowBackorder: normalized.allowBackorder,
  }
}

function sanitizeStockForSave(formStock, updatedBy) {
  const enabled = formStock?.enabled === true
  return {
    enabled,
    quantity: enabled ? normalizeNonNegativeInteger(formStock?.quantity) : 0,
    lowStockThreshold: normalizeNonNegativeInteger(formStock?.lowStockThreshold, 5),
    soldOutBehavior: SOLD_OUT_BEHAVIORS.has(formStock?.soldOutBehavior)
      ? formStock.soldOutBehavior
      : 'show_sold_out',
    allowBackorder: false,
    updatedBy: String(updatedBy || '').slice(0, 128),
  }
}

module.exports = {
  InventoryError,
  aggregateStockItems,
  buildInventoryMovement,
  computePublicStock,
  decrementStockInTransaction,
  getStockQuantity,
  isLegacyStock,
  isStockControlled,
  isStockObject,
  isStockOrderable,
  normalizeStock,
  normalizeStockForForm,
  restoreStockInTransaction,
  sanitizeStockForSave,
  shouldHideWhenSoldOut,
  validateStockQuantity,
}
