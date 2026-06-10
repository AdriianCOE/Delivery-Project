import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPublicAsaasConfig,
  getPublicMercadoPagoConfig,
  getPublicPreorderPaymentPolicy,
  isPublicAsaasOnlineAllowed,
  isPublicMercadoPagoOnlineAllowed,
} from './publicPaymentMethods.js'

function storeWithMercadoPago(overrides = {}) {
  return {
    payments: {
      mercadoPago: {
        enabled: true,
        status: 'active',
        allowPix: true,
        allowCreditCard: true,
        ...overrides,
      },
    },
  }
}

test('Mercado Pago online fica disponível quando a configuração pública está ativa', () => {
  const store = storeWithMercadoPago()

  assert.equal(isPublicMercadoPagoOnlineAllowed(store), true)
  assert.deepEqual(getPublicMercadoPagoConfig(store), {
    enabled: true,
    status: 'active',
    allowPix: true,
    allowCreditCard: true,
    maxInstallmentCount: 1,
    requireForScheduled: false,
    minOrderCents: 0,
  })
})

test('Asaas Orders público é tratado como legado desativado', () => {
  const store = {
    payments: {
      asaas: {
        enabled: true,
        status: 'active',
        allowPix: true,
      },
    },
  }

  assert.equal(isPublicAsaasOnlineAllowed(store), false)
  assert.equal(getPublicAsaasConfig(store).enabled, false)
  assert.equal(getPublicAsaasConfig(store).legacy, true)
})

test('manual_or_mercadopago é uma política pública válida', () => {
  const store = storeWithMercadoPago()
  store.payments.preorderPolicy = { mode: 'manual_or_mercadopago' }

  assert.deepEqual(getPublicPreorderPaymentPolicy(store), {
    mode: 'manual_or_mercadopago',
  })
})

test('manual_or_asaas legado migra visualmente para Mercado Pago quando ativo', () => {
  const store = storeWithMercadoPago()
  store.payments.preorderPolicy = { mode: 'manual_or_asaas' }

  assert.deepEqual(getPublicPreorderPaymentPolicy(store), {
    mode: 'manual_or_mercadopago',
    legacyMode: 'manual_or_asaas',
  })
})

test('asaas_online legado cai para manual quando Mercado Pago não está ativo', () => {
  const store = {
    payments: {
      mercadoPago: { enabled: false, status: 'not_connected' },
      preorderPolicy: { mode: 'asaas_online' },
    },
  }

  assert.deepEqual(getPublicPreorderPaymentPolicy(store), {
    mode: 'manual',
    legacyMode: 'asaas_online',
  })
})
