'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildMerchantStatusPatch } = require('./merchantOrder')

class TestHttpsError extends Error {}

test('pedido online pendente nao pode ser entregue como atalho para pagamento', () => {
  assert.throws(
    () => buildMerchantStatusPatch({
      HttpsError: TestHttpsError,
      orderData: {
        status: 'em_rota',
        paymentMethod: 'mercadopago_online',
        paymentStatus: 'pending',
        payment: { provider: 'mercadopago', mode: 'online', status: 'pending' },
      },
      nextStatus: 'entregue',
      uid: 'merchant-1',
      now: { serverTimestamp: true },
    }),
    /failed-precondition/
  )
})

test('entregar pedido pago nao reescreve campos financeiros', () => {
  const now = { serverTimestamp: true }
  const patch = buildMerchantStatusPatch({
    HttpsError: TestHttpsError,
    orderData: {
      status: 'em_rota',
      paymentMethod: 'mercadopago_online',
      paymentStatus: 'paid',
      payment: { provider: 'mercadopago', mode: 'online', status: 'paid' },
    },
    nextStatus: 'entregue',
    uid: 'merchant-1',
    now,
  })

  assert.equal(patch.status, 'entregue')
  assert.equal(patch.deliveredAt, now)
  assert.equal(Object.hasOwn(patch, 'paymentStatus'), false)
  assert.equal(Object.hasOwn(patch, 'payment.status'), false)
  assert.equal(Object.hasOwn(patch, 'paidAt'), false)
})
