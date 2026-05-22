// src/pages/merchant/menu/utils/couponPayloads.js
// Constantes e funções de normalização/sanitização de payload de cupons para salvar no Firestore.

import { parseCurrency } from './menuFormatters'
import { buildStoreScopedPayload } from '../../../../utils/storeIdentity'

export const EMPTY_COUPON_FORM = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  minOrder: '',
  maxDiscount: '',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  active: true,
  appliesTo: 'all',
  productIds: [],
}

export const COUPON_STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
]

export function toTimestampOrNull(dateString) {
  if (!dateString) return null
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Converte Firestore Timestamp ou Date para string compatível com <input type="datetime-local" /> (YYYY-MM-DDTHH:MM).
 */
export function dateToInputString(value) {
  if (!value) return ''
  let d = null
  if (typeof value.toDate === 'function') {
    d = value.toDate()
  } else if (value.seconds) {
    d = new Date(value.seconds * 1000)
  } else {
    d = new Date(value)
  }
  if (!d || Number.isNaN(d.getTime())) return ''
  
  const pad = (num) => String(num).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

/**
 * Sanitiza o formulário para persistir no banco, garantindo tipos corretos, centavos e escopo de loja seguro.
 */
export function sanitizeCouponForSave(form, store, isEdit = false) {
  const isPercent = form.type === 'percent'
  
  const value = isPercent ? Number(form.value) : parseCurrency(form.value)
  const valueCents = isPercent ? null : Math.round(value * 100)
  
  const minOrder = form.minOrder ? parseCurrency(form.minOrder) : null
  const minOrderCents = minOrder ? Math.round(minOrder * 100) : null
  
  const maxDiscount = (isPercent && form.maxDiscount) ? parseCurrency(form.maxDiscount) : null
  const maxDiscountCents = maxDiscount ? Math.round(maxDiscount * 100) : null
  
  const usageLimit = form.usageLimit ? Number(form.usageLimit) : null
  
  const scope = buildStoreScopedPayload(store)
  
  const payload = {
    ...scope,
    code: String(form.code || '').trim().toUpperCase(),
    description: String(form.description || '').trim(),
    type: form.type === 'fixed' ? 'fixed' : 'percent',
    value: value || 0,
    valueCents,
    minOrder,
    minOrderCents,
    maxDiscount,
    maxDiscountCents,
    usageLimit,
    startsAt: toTimestampOrNull(form.startsAt),
    expiresAt: toTimestampOrNull(form.expiresAt),
    active: Boolean(form.active),
    appliesTo: form.appliesTo || 'all',
    productIds: Array.isArray(form.productIds) ? form.productIds : [],
    isDeleted: false,
  }

  // Só adiciona usedCount na criação
  if (!isEdit) {
    payload.usedCount = 0
  }

  return payload
}
