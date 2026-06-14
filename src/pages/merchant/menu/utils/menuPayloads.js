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
  isPopular: false,
  acceptsCoupons: true,
  showCouponBadge: true,
  serving: {
    enabled: false,
    label: '',
    count: '',
  },
  visualBadges: [],
  order: 0,
  optionGroups: [],
  extras: [],
  scheduling: {
    mode: 'store_default',
    minLeadMinutes: null,
    maxDaysAhead: null,
    slotIntervalMinutes: null,
    fulfillmentTypes: null,
    weeklyWindows: null,
    blockedDates: [],
    prepaymentPolicy: 'store_default',
  },
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

export const VISUAL_BADGE_OPTIONS = [
  { id: 'artesanal', label: 'Artesanal' },
  { id: 'caseiro', label: 'Caseiro' },
  { id: 'feito_na_hora', label: 'Feito na hora' },
  { id: 'especial_da_casa', label: 'Especial da casa' },
  { id: 'cremoso', label: 'Cremoso' },
  { id: 'saboroso', label: 'Saboroso' },
  { id: 'para_compartilhar', label: 'Para compartilhar' },
  { id: 'acompanhamento', label: 'Acompanhamento' },
  { id: 'novidade', label: 'Novidade' },
  { id: 'edicao_limitada', label: 'Edição limitada' },
  { id: 'premium', label: 'Premium' },
]

const VISUAL_BADGE_LABELS = new Map(VISUAL_BADGE_OPTIONS.map((badge) => [badge.id, badge.label]))

function normalizeBadgeId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeProductServingForForm(product) {
  const raw = product?.serving

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const count = Number(raw.count)
    return {
      enabled: raw.enabled === true || Boolean(raw.label) || (Number.isFinite(count) && count > 0),
      label: String(raw.label || '').trim().slice(0, 40),
      count: Number.isFinite(count) && count > 0 ? String(Math.floor(count)) : '',
    }
  }

  const legacy = product?.serves ?? product?.portion
  if (legacy === undefined || legacy === null || legacy === '') {
    return { enabled: false, label: '', count: '' }
  }

  const numeric = Number(legacy)
  if (Number.isFinite(numeric) && numeric > 0) {
    return { enabled: true, label: '', count: String(Math.floor(numeric)) }
  }

  return {
    enabled: true,
    label: String(legacy).trim().slice(0, 40),
    count: '',
  }
}

export function sanitizeProductServingForSave(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  const countNumber = Number(raw.count)
  const count = Number.isFinite(countNumber) && countNumber > 0
    ? Math.min(999, Math.floor(countNumber))
    : null

  const label = String(raw.label || '').trim().slice(0, 40)
  const enabled = raw.enabled === true || Boolean(label || count)

  if (!enabled || (!label && !count)) {
    return {
      enabled: false,
      label: '',
      count: null,
    }
  }

  return {
    enabled: true,
    label,
    count,
  }
}

export function normalizeVisualBadgesForForm(product) {
    const raw = Array.isArray(product?.visualBadges) ? product.visualBadges : []

  return [
    ...new Set(
      raw
        .map((badge) => normalizeBadgeId(badge?.id || badge?.value || badge))
        .filter((id) => VISUAL_BADGE_LABELS.has(id))
    ),
  ].slice(0, 5)
}

export function sanitizeVisualBadgesForSave(value) {
  const raw = Array.isArray(value) ? value : []

  return [
    ...new Set(
      raw
        .map((badge) => normalizeBadgeId(badge?.id || badge?.value || badge))
        .filter((id) => VISUAL_BADGE_LABELS.has(id))
    ),
  ]
    .slice(0, 5)
    .map((id) => ({
      id,
      label: VISUAL_BADGE_LABELS.get(id),
    }))
}

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

function toNullableInteger(value, min, max) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function normalizeSlotInterval(value) {
  const parsed = Number(value)
  return [10, 15, 30, 60].includes(parsed) ? parsed : null
}

export function getDefaultProductScheduling() {
  return {
    mode: 'store_default',
    minLeadMinutes: null,
    maxDaysAhead: null,
    slotIntervalMinutes: null,
    fulfillmentTypes: null,
    weeklyWindows: null,
    blockedDates: [],
    prepaymentPolicy: 'store_default',
  }
}

export function normalizeProductSchedulingForForm(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const fulfillment = raw.fulfillmentTypes && typeof raw.fulfillmentTypes === 'object'
    ? raw.fulfillmentTypes
    : null

  return {
    ...getDefaultProductScheduling(),
    mode: ['store_default', 'asap_only', 'scheduled_only', 'asap_and_scheduled'].includes(raw.mode)
      ? raw.mode
      : 'store_default',
    minLeadMinutes: toNullableInteger(raw.minLeadMinutes, 0, 525600),
    maxDaysAhead: toNullableInteger(raw.maxDaysAhead, 0, 365),
    slotIntervalMinutes: normalizeSlotInterval(raw.slotIntervalMinutes),
    fulfillmentTypes: fulfillment
      ? {
          delivery: fulfillment.delivery !== false,
          pickup: fulfillment.pickup !== false,
        }
      : null,
    weeklyWindows: null,
    blockedDates: [],
    prepaymentPolicy: ['store_default', 'none', 'pix_required'].includes(raw.prepaymentPolicy)
      ? raw.prepaymentPolicy
      : 'store_default',
  }
}

export function sanitizeProductSchedulingForSave(value) {
  const normalized = normalizeProductSchedulingForForm(value)

  return {
    mode: normalized.mode,
    minLeadMinutes: normalized.minLeadMinutes,
    maxDaysAhead: normalized.maxDaysAhead,
    slotIntervalMinutes: normalized.slotIntervalMinutes,
    fulfillmentTypes: normalized.fulfillmentTypes
      ? {
          delivery: normalized.fulfillmentTypes.delivery !== false,
          pickup: normalized.fulfillmentTypes.pickup !== false,
        }
      : null,
    weeklyWindows: null,
    blockedDates: [],
    prepaymentPolicy: normalized.prepaymentPolicy,
  }
}

export function cleanObject(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result
}
