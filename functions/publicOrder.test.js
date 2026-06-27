'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const { buildServerOrderItems, PublicOrderError } = require('./publicOrder')

function createProductDb(productId, productData) {
  const products = new Map([[productId, productData]])
  const queryBuilder = (filters = []) => ({
    where(field, op, value) {
      assert.equal(op, '==')
      return queryBuilder([...filters, { field, value }])
    },
    limit() {
      return this
    },
    async get() {
      const docs = []
      for (const [id, data] of products.entries()) {
        if (filters.every((filter) => data?.[filter.field] === filter.value)) {
          docs.push({
            id,
            data: () => data,
          })
        }
      }
      return {
        empty: docs.length === 0,
        docs,
      }
    },
  })

  return {
    collection(collectionName) {
      assert.equal(collectionName, 'products')
      return {
        doc(requestedId) {
          assert.equal(requestedId, productId)
          return {
            async get() {
              const data = products.get(requestedId)
              return {
                exists: Boolean(data),
                id: productId,
                data: () => data,
              }
            },
          }
        },
        where: queryBuilder().where,
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

test('buildServerOrderItems rejeita produto aceito apenas por storeKeys forjado', async () => {
  const db = createProductDb('product-1', {
    name: 'Produto de outra loja',
    storeId: 'attacker-store',
    storeKeys: ['store-1'],
    priceCents: 1000,
    isActive: true,
    isAvailable: true,
    isVisible: true,
  })

  await assert.rejects(
    buildServerOrderItems(
      db,
      [{ productId: 'product-1', quantity: 1 }],
      ['store-1']
    ),
    (error) => error instanceof PublicOrderError && error.code === 'failed-precondition'
  )
})

test('buildServerOrderItems usa leitura transacional quando fornecida', async () => {
  const db = createProductDb('product-1', {
    name: 'Produto transacional',
    storeId: 'store-1',
    priceCents: 1000,
    isActive: true,
    isAvailable: true,
    isVisible: true,
  })
  let transactionReads = 0
  const transaction = {
    async get(refOrQuery) {
      transactionReads += 1
      if (typeof refOrQuery.get === 'function') return refOrQuery.get()
      throw new Error('Unexpected transaction read')
    },
  }

  const result = await buildServerOrderItems(
    db,
    [{ productId: 'product-1', quantity: 1 }],
    ['store-1'],
    { transaction }
  )

  assert.equal(transactionReads, 1)
  assert.equal(result.subtotalCents, 1000)
})
