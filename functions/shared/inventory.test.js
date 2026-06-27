'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {
  aggregateStockItems,
  computePublicStock,
  decrementStockInTransaction,
  InventoryError,
  isStockOrderable,
  normalizeStockForForm,
  restoreStockInTransaction,
  sanitizeStockForSave,
  shouldHideWhenSoldOut,
  validateStockQuantity,
} = require('./inventory')

function createInventoryHarness(products) {
  let movementSequence = 0
  const updates = []
  const sets = []

  const db = {
    collection(collectionName) {
      return {
        doc(documentId) {
          const ref = {
            id: documentId,
            path: `${collectionName}/${documentId}`,
          }

          if (collectionName === 'stores') {
            ref.collection = (subcollectionName) => ({
              doc() {
                movementSequence += 1
                return {
                  id: `movement-${movementSequence}`,
                  path: `${ref.path}/${subcollectionName}/movement-${movementSequence}`,
                }
              },
            })
          }

          return ref
        },
      }
    },
  }

  const transaction = {
    async getAll(...refs) {
      return refs.map((ref) => {
        const data = products[ref.id]
        return {
          exists: Boolean(data),
          data: () => data,
        }
      })
    },
    update(ref, patch) {
      updates.push({ ref, patch })
    },
    set(ref, data) {
      sets.push({ ref, data })
    },
  }

  return { db, transaction, updates, sets }
}

describe('compatibilidade e status de estoque', () => {
  test('stock ausente não é controlado e permite pedido', () => {
    assert.equal(isStockOrderable(undefined), true)
    assert.deepEqual(computePublicStock(undefined), {
      enabled: false,
      status: 'not_tracked',
      soldOutBehavior: 'show_sold_out',
    })
  })

  test('stock legado numérico positivo é controlado e permite pedido', () => {
    assert.equal(isStockOrderable(10), true)
    assert.equal(computePublicStock(10).enabled, true)
  })

  test('stock legado zero bloqueia e fica esgotado', () => {
    assert.equal(isStockOrderable(0), false)
    assert.equal(computePublicStock(0).status, 'sold_out')
  })

  test('stock legado string numérica é controlado', () => {
    assert.equal(isStockOrderable('7'), true)
    assert.deepEqual(normalizeStockForForm('7'), {
      enabled: true,
      quantity: '7',
      lowStockThreshold: '5',
      soldOutBehavior: 'show_sold_out',
      allowBackorder: false,
    })
  })

  test('stock objeto desabilitado não é controlado e permite pedido', () => {
    const stock = { enabled: false, quantity: 0 }
    assert.equal(isStockOrderable(stock), true)
    assert.equal(computePublicStock(stock).status, 'not_tracked')
  })

  test('stock objeto zerado bloqueia e fica esgotado', () => {
    const stock = { enabled: true, quantity: 0 }
    assert.equal(isStockOrderable(stock), false)
    assert.equal(computePublicStock(stock).status, 'sold_out')
  })

  test('quantidade solicitada maior que a disponível é insuficiente', () => {
    assert.match(
      validateStockQuantity({ enabled: true, quantity: 2 }, 3, 'Pizza'),
      /insuficiente/
    )
  })

  test('estoque baixo não expõe quantity', () => {
    const publicStock = computePublicStock({
      enabled: true,
      quantity: 2,
      lowStockThreshold: 5,
    })
    assert.equal(publicStock.status, 'low_stock')
    assert.equal(Object.hasOwn(publicStock, 'quantity'), false)
  })

  test('soldOutBehavior hide oculta apenas produto esgotado sem backorder', () => {
    assert.equal(shouldHideWhenSoldOut({
      enabled: true,
      quantity: 0,
      soldOutBehavior: 'hide',
    }), true)
    assert.equal(shouldHideWhenSoldOut({
      enabled: true,
      quantity: 0,
      soldOutBehavior: 'hide',
      allowBackorder: true,
    }), false)
  })

  test('allowBackorder permite venda sem anunciar esgotado', () => {
    const stock = { enabled: true, quantity: 0, allowBackorder: true }
    assert.equal(isStockOrderable(stock), true)
    assert.equal(computePublicStock(stock).status, 'in_stock')
  })
})

describe('normalização do formulário', () => {
  test('stock legado numérico abre como estoque controlado', () => {
    assert.deepEqual(normalizeStockForForm(7), {
      enabled: true,
      quantity: '7',
      lowStockThreshold: '5',
      soldOutBehavior: 'show_sold_out',
      allowBackorder: false,
    })
  })

  test('save limita inteiros, comportamento e backorder', () => {
    assert.deepEqual(sanitizeStockForSave({
      enabled: true,
      quantity: '-4.8',
      lowStockThreshold: '2.9',
      soldOutBehavior: 'inválido',
      allowBackorder: true,
    }, 'uid-1'), {
      enabled: true,
      quantity: 0,
      lowStockThreshold: 2,
      soldOutBehavior: 'show_sold_out',
      allowBackorder: false,
      updatedBy: 'uid-1',
    })
  })
})

describe('agregação e restauração', () => {
  test('agrega itens repetidos pelo productId', () => {
    assert.deepEqual(aggregateStockItems([
      { productId: 'p1', productName: 'Pizza', quantity: 2, storeId: 's1' },
      { productId: 'p1', productName: 'Pizza', quantity: 3, storeId: 's1' },
    ]), [{
      productId: 'p1',
      productName: 'Pizza',
      quantity: 5,
      storeId: 's1',
      stockFormat: null,
    }])
  })

  test('double restore não cria atualização nem movimento', async () => {
    let reads = 0
    const result = await restoreStockInTransaction({
      db: {},
      admin: {},
      transaction: {
        get() {
          reads += 1
        },
      },
      orderRef: { id: 'o1' },
      orderData: {
        inventory: {
          decremented: true,
          restored: true,
        },
      },
      restoredBy: 'uid',
      reason: 'cancelamento',
      now: {},
    })

    assert.equal(result, null)
    assert.equal(reads, 0)
  })
})

describe('baixa transacional', () => {
  test('baixa produto que passou sem estoque no pré-read e está controlado na transaction', async () => {
    const harness = createInventoryHarness({
      p1: {
        name: 'Pizza',
        storeId: 'store-1',
        stock: { enabled: true, quantity: 4 },
      },
    })

    const result = await decrementStockInTransaction({
      db: harness.db,
      admin: {},
      transaction: harness.transaction,
      items: [{ productId: 'p1', productName: 'Pizza', quantity: 2, storeId: 'store-1' }],
      orderId: 'order-1',
      storeId: 'store-1',
      createdBy: 'system',
      now: 'now',
    })

    assert.equal(result.decremented, true)
    assert.equal(harness.updates[0].patch['stock.quantity'], 2)
    assert.equal(harness.sets.length, 1)
  })

  test('aborta quando o produto não pertence mais à loja', async () => {
    const harness = createInventoryHarness({
      p1: {
        name: 'Pizza',
        storeId: 'store-2',
        stock: { enabled: true, quantity: 4 },
      },
    })

    await assert.rejects(
      decrementStockInTransaction({
        db: harness.db,
        admin: {},
        transaction: harness.transaction,
        items: [{ productId: 'p1', productName: 'Pizza', quantity: 1, storeId: 'store-1' }],
        orderId: 'order-1',
        storeId: 'store-1',
        createdBy: 'system',
        now: 'now',
      }),
      (error) => error instanceof InventoryError && error.code === 'stock_unavailable'
    )
    assert.equal(harness.updates.length, 0)
    assert.equal(harness.sets.length, 0)
  })

  test('ignora produto atualmente sem controle sem quebrar o pedido', async () => {
    const harness = createInventoryHarness({
      p1: {
        name: 'Pizza',
        storeId: 'store-1',
        stock: { enabled: false, quantity: 4 },
      },
    })

    const result = await decrementStockInTransaction({
      db: harness.db,
      admin: {},
      transaction: harness.transaction,
      items: [{ productId: 'p1', productName: 'Pizza', quantity: 1, storeId: 'store-1' }],
      orderId: 'order-1',
      storeId: 'store-1',
      createdBy: 'system',
      now: 'now',
    })

    assert.equal(result.decremented, false)
    assert.deepEqual(result.items, [])
    assert.equal(harness.updates.length, 0)
    assert.equal(harness.sets.length, 0)
  })

  test('agrega itens repetidos antes da baixa', async () => {
    const harness = createInventoryHarness({
      p1: {
        name: 'Pizza',
        storeId: 'store-1',
        stock: { enabled: true, quantity: 10 },
      },
    })

    const result = await decrementStockInTransaction({
      db: harness.db,
      admin: {},
      transaction: harness.transaction,
      items: [
        { productId: 'p1', productName: 'Pizza', quantity: 2, storeId: 'store-1' },
        { productId: 'p1', productName: 'Pizza', quantity: 3, storeId: 'store-1' },
      ],
      orderId: 'order-1',
      storeId: 'store-1',
      createdBy: 'system',
      now: 'now',
    })

    assert.equal(result.items[0].quantity, 5)
    assert.equal(harness.updates.length, 1)
    assert.equal(harness.updates[0].patch['stock.quantity'], 5)
    assert.equal(harness.sets.length, 1)
  })
})
