'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const { buildServerOrderItems } = require('./publicOrder')

function createProductDb(productId, productData) {
  return {
    collection(collectionName) {
      assert.equal(collectionName, 'products')
      return {
        doc(requestedId) {
          assert.equal(requestedId, productId)
          return {
            async get() {
              return {
                exists: true,
                id: productId,
                data: () => productData,
              }
            },
          }
        },
      }
    },
  }
}

test('buildServerOrderItems envia produto sem estoque no pré-read como candidato transacional', async () => {
  const db = createProductDb('product-1', {
    name: 'Produto sem controle',
    storeId: 'store-1',
    priceCents: 1000,
    isActive: true,
    isAvailable: true,
    isVisible: true,
  })

  const result = await buildServerOrderItems(
    db,
    [{ productId: 'product-1', quantity: 2 }],
    ['store-1']
  )

  assert.deepEqual(result.stockItems, [{
    productId: 'product-1',
    productName: 'Produto sem controle',
    quantity: 2,
    storeId: 'store-1',
    stockFormat: null,
  }])
})
