// src/pages/merchant/menu/utils/menuPayloads.js
// Constantes e funções de normalização/sanitização de payload para salvar no Firestore.

import { parseCurrency, moneyToInput, createLocalId } from './menuFormatters'

export const EMPTY_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  oldPrice: '',
  categoryId: '',
  imageUrl: '',
  imagePublicId: '',
  preparationTime: '',
  isActive: true,
  isAvailable: true,
  isVisible: true,
  isFeatured: false,
  isPromotion: false,
  acceptsCoupons: true,
  order: 0,
  optionGroups: [],
  extras: [],
}

export const STATUS_FILTERS = [
  { id: 'all',         label: 'Todos' },
  { id: 'active',      label: 'Ativos' },
  { id: 'unavailable', label: 'Indisponíveis' },
  { id: 'hidden',      label: 'Ocultos' },
  { id: 'featured',    label: 'Destaques' },
  { id: 'promo',       label: 'Promoção' },
  { id: 'no-image',    label: 'Sem imagem' },
]

export function createEmptyOption() {
  return { id: createLocalId('option'), name: '', description: '', price: '', available: true }
}

export function createEmptyOptionGroup() {
  return {
    id: createLocalId('group'),
    title: '', description: '', type: 'single',
    required: true, min: '1', max: '1',
    pricingMode: 'additive', includedQuantity: '1',
    options: [createEmptyOption()],
  }
}

export function normalizeProductOptionGroupsForForm(product) {
  const rawGroups = Array.isArray(product?.optionGroups) ? product.optionGroups
    : Array.isArray(product?.optionsGroups) ? product.optionsGroups
    : Array.isArray(product?.customizationGroups) ? product.customizationGroups
    : []

  return rawGroups.map((group, gi) => {
    const type = ['single', 'multiple', 'quantity'].includes(group?.type) ? group.type
      : group?.allowQuantity ? 'quantity'
      : Number(group?.max || group?.maxSelections || 1) === 1 ? 'single' : 'multiple'
    const required = Boolean(group?.required || group?.isRequired || Number(group?.min || 0) > 0)
    const min = Number(group?.min ?? group?.minSelections ?? (required ? 1 : 0))
    const max = type === 'single' ? 1 : Number(group?.max ?? group?.maxSelections ?? 0)

    return {
      id: group?.id || group?.groupId || createLocalId(`group-${gi}`),
      title: group?.title || group?.name || '',
      description: group?.description || group?.subtitle || '',
      type, required,
      min: String(Number.isFinite(min) ? min : required ? 1 : 0),
      max: String(Number.isFinite(max) ? max : type === 'single' ? 1 : 0),
      pricingMode: group?.pricingMode || 'additive',
      includedQuantity: String(group?.includedQuantity ?? (min || 1)),
      options: Array.isArray(group?.options) ? group.options.map((opt, oi) => ({
        id: opt?.id || opt?.optionId || createLocalId(`opt-${oi}`),
        name: opt?.name || opt?.title || '',
        description: opt?.description || '',
        price: moneyToInput(opt?.price, opt?.priceCents),
        available: opt?.available !== false && opt?.isAvailable !== false,
      })) : [],
    }
  })
}

export function sanitizeOptionGroupsForSave(optionGroups = []) {
  return optionGroups
    .map((group) => {
      const type = ['single', 'multiple', 'quantity'].includes(group.type) ? group.type : 'single'
      const required = Boolean(group.required)
      const min = Math.max(required ? 1 : 0, Number(group.min || 0))
      const max = type === 'single' ? 1 : Math.max(min, Number(group.max || 0))
      const options = (Array.isArray(group.options) ? group.options : [])
        .filter((o) => o.name.trim())
        .map((o) => {
          const price = parseCurrency(o.price)
          const optionId = o.id || createLocalId('option')
          return {
            id: optionId, optionId,
            name: o.name.trim(), description: (o.description || '').trim(),
            price, priceCents: Math.round(price * 100),
            available: o.available !== false, isAvailable: o.available !== false,
          }
        })
      const groupId = group.id || createLocalId('group')
      return {
        id: groupId, groupId,
        title: (group.title || '').trim(), name: (group.title || '').trim(),
        description: (group.description || '').trim(),
        type, required, isRequired: required,
        min, minSelections: min, max, maxSelections: max,
        allowQuantity: type === 'quantity',
        pricingMode: group.pricingMode || 'additive',
        includedQuantity: Math.max(0, Number(group.includedQuantity || min || 1)),
        options,
      }
    })
    .filter((g) => g.title && g.options.length > 0)
}

export function cleanObject(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result
}
