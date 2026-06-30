'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  countsTowardPlan,
  deriveProductCategoryName,
  increasesPlanUsage,
  sanitizeDeliveryFees,
  sanitizeMenuPayload,
} = require('./menuManagement')

test('limite conta apenas itens ativos e publicaveis', () => {
  assert.equal(countsTowardPlan({}), true)
  assert.equal(countsTowardPlan({ isActive: false }), false)
  assert.equal(countsTowardPlan({ isVisible: false }), false)
  assert.equal(countsTowardPlan({ hidden: true }), false)
  assert.equal(countsTowardPlan({ isDeleted: true }), false)
  assert.equal(countsTowardPlan({ deletedAt: new Date() }), false)
  assert.equal(countsTowardPlan({ isAvailable: false }), true)
})

test('produto usa centavos como fonte do preco e aceita cupom por padrao', () => {
  const result = sanitizeMenuPayload('product', {
    name: 'Produto',
    price: 99.99,
    priceCents: 1234,
    oldPrice: 88.88,
    oldPriceCents: 1500,
  })

  assert.equal(result.priceCents, 1234)
  assert.equal(result.price, 12.34)
  assert.equal(result.oldPriceCents, 1500)
  assert.equal(result.oldPrice, 15)
  assert.equal(result.acceptsCoupons, true)

  const partial = sanitizeMenuPayload('product', {
    price: 99.99,
    oldPrice: 88.88,
  }, { partial: true })
  assert.equal(Object.hasOwn(partial, 'price'), false)
  assert.equal(Object.hasOwn(partial, 'oldPrice'), false)
})

test('produto rejeita categoria de outra loja', () => {
  assert.equal(
    deriveProductCategoryName({
      exists: true,
      data: () => ({ name: ' Lanches ', storeId: 'loja-atual' }),
    }, 'loja-atual'),
    'Lanches'
  )

  const categorySnapshot = {
    exists: true,
    data: () => ({ name: 'Lanches', storeId: 'outra-loja' }),
  }

  assert.throws(
    () => deriveProductCategoryName(categorySnapshot, 'loja-atual'),
    (error) => error.code === 'permission-denied'
  )
  assert.throws(
    () => deriveProductCategoryName({ exists: false }, 'loja-atual'),
    (error) => error.code === 'not-found'
  )
  assert.throws(
    () => deriveProductCategoryName({
      exists: true,
      data: () => ({ name: 'Lanches', storeId: 'loja-atual', isDeleted: true }),
    }, 'loja-atual'),
    (error) => error.code === 'failed-precondition'
  )
})

test('taxas de entrega rejeitam chave perigosa', () => {
  assert.deepEqual(sanitizeDeliveryFees({ Centro: '12.345' }), { Centro: 12.35 })

  const fees = JSON.parse('{" __proto__ ": 10}')
  assert.throws(
    () => sanitizeDeliveryFees(fees),
    (error) => error.code === 'invalid-argument'
  )
})

test('criacao e reativacao aumentam uso do plano', () => {
  assert.equal(increasesPlanUsage({}, { isActive: true }, false), true)
  assert.equal(
    increasesPlanUsage({ isActive: false }, { isActive: true }, true),
    true
  )
  assert.equal(
    increasesPlanUsage({ isActive: true }, { isActive: true, name: 'Editado' }, true),
    false
  )
})
