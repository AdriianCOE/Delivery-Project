'use strict'

const assert = require('node:assert/strict')
const {
  decrementStockInTransaction,
  restoreStockInTransaction,
} = require('C:/Users/tommy/Delivery-Project/functions/shared/inventory.js')

function harness(productData) {
  let movement = 0
  const updates = []
  const sets = []
  const db = {
    collection(name) {
      return {
        doc(id) {
          const ref = { id, path: `${name}/${id}` }
          if (name === 'stores') {
            ref.collection = (child) => ({
              doc() {
                movement += 1
                return { id: `m${movement}`, path: `${ref.path}/${child}/m${movement}` }
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
      return refs.map(() => ({ exists: true, data: () => productData }))
    },
    update(ref, patch) {
      updates.push({ ref, patch })
      if (Object.hasOwn(patch, 'stock')) productData.stock = patch.stock
      if (Object.hasOwn(patch, 'stock.quantity')) productData.stock.quantity = patch['stock.quantity']
    },
    set(ref, data) {
      sets.push({ ref, data })
    },
  }
  return { db, transaction, updates, sets, productData }
}

async function main() {
  const tenant = harness({
    storeId: 'attacker-store',
    storeKeys: ['victim-store'],
    stock: { enabled: true, quantity: 5 },
  })
  const tenantResult = await decrementStockInTransaction({
    db: tenant.db,
    admin: {},
    transaction: tenant.transaction,
    items: [{
      productId: 'p1',
      productName: 'Cross tenant',
      quantity: 1,
      storeId: 'attacker-store',
    }],
    orderId: 'victim-order',
    storeId: 'victim-store',
    createdBy: 'system',
    now: 'now',
  })
  assert.equal(tenantResult.decremented, true)

  const backorder = harness({
    storeId: 'store-1',
    stock: { enabled: true, quantity: 0, allowBackorder: true },
  })
  await decrementStockInTransaction({
    db: backorder.db,
    admin: {},
    transaction: backorder.transaction,
    items: [{ productId: 'p1', productName: 'Backorder', quantity: 2, storeId: 'store-1' }],
    orderId: 'o1',
    storeId: 'store-1',
    createdBy: 'system',
    now: 'now',
  })
  await decrementStockInTransaction({
    db: backorder.db,
    admin: {},
    transaction: backorder.transaction,
    items: [{ productId: 'p1', productName: 'Backorder', quantity: 3, storeId: 'store-1' }],
    orderId: 'o2',
    storeId: 'store-1',
    createdBy: 'system',
    now: 'now',
  })
  assert.equal(backorder.productData.stock.quantity, -3)
  await restoreStockInTransaction({
    db: backorder.db,
    admin: {},
    transaction: backorder.transaction,
    orderRef: { id: 'o1' },
    orderData: {
      storeId: 'store-1',
      inventory: {
        decremented: true,
        restored: false,
        items: [{
          productId: 'p1',
          productName: 'Backorder',
          quantity: 2,
          storeId: 'store-1',
          stockFormat: 'object',
        }],
      },
    },
    restoredBy: 'merchant',
    reason: 'cancel',
    now: 'now',
  })
  assert.equal(backorder.productData.stock.quantity, 2)

  const format = harness({
    storeId: 'store-1',
    stock: {
      enabled: true,
      quantity: 10,
      lowStockThreshold: 5,
      soldOutBehavior: 'hide',
    },
  })
  await restoreStockInTransaction({
    db: format.db,
    admin: {},
    transaction: format.transaction,
    orderRef: { id: 'legacy-order' },
    orderData: {
      storeId: 'store-1',
      inventory: {
        decremented: true,
        restored: false,
        items: [{
          productId: 'p1',
          productName: 'Migrated',
          quantity: 2,
          storeId: 'store-1',
          stockFormat: 'legacy',
        }],
      },
    },
    restoredBy: 'merchant',
    reason: 'cancel',
    now: 'now',
  })
  assert.equal(format.productData.stock, 12)

  console.log(JSON.stringify({
    tenantAliasAccepted: tenantResult.decremented,
    backorderAfterTwoSales: -3,
    backorderAfterCancelFirstOrder: backorder.productData.stock.quantity,
    migratedObjectOverwrittenWithLegacyNumber: format.productData.stock,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
