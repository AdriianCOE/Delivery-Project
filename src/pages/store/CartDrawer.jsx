import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { motion } from 'motion/react'

import {
  FiAlertCircle,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiHome,
  FiImage,
  FiLoader,
  FiMapPin,
  FiMinus,
  FiPlus,
  FiShield,
  FiShoppingBag,
  FiTag,
  FiTrash2,
  FiTruck,
  FiUser,
  FiX,
} from 'react-icons/fi'

import { useCart } from '../../contexts/CartContext'
import { scrollToFirstError } from '../../utils/scroll'
import { functions } from '../../services/firebase'

const CUSTOMER_KEY = '@PratoBy:customer'
const LEGACY_CUSTOMER_KEY = '@DeliveryApp:customer'

const EMPTY_CUSTOMER = {
  name: '',
  phone: '',
  cep: '',
  neighborhood: '',
  street: '',
  number: '',
  complement: '',
  reference: '',
  city: '',
  state: '',
  cepNeighborhood: '',
  cepStreet: '',
  cepCity: '',
  cepState: '',
  cepValidated: false,
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function firstValue(...values) {
  return values.find(hasValue)
}

function toSafeNumber(value) {
  if (!hasValue(value)) return 0

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  let cleaned = String(value).trim().replace(/[^\d,.-]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMoney(value, centsValue) {
  if (hasValue(centsValue)) {
    return toSafeNumber(centsValue) / 100
  }

  const numericValue = toSafeNumber(value)

  // Compatibilidade com versões antigas que salvaram preço em centavos no campo `price`.
  if (numericValue > 300 && Number.isInteger(numericValue)) {
    return numericValue / 100
  }

  return numericValue
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePhoneBR(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`

  return digits
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8)

  if (digits.length <= 5) return digits

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatPhoneInput(value) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function sanitizeAddressNumber(value) {
  return onlyDigits(value).slice(0, 6)
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findDeliveryNeighborhoodMatch(neighborhood, deliveryNeighborhoods = []) {
  const normalizedNeighborhood = normalizeForMatch(neighborhood)

  if (!normalizedNeighborhood) return null

  return (
    deliveryNeighborhoods.find((item) => {
      return normalizeForMatch(item.neighborhood) === normalizedNeighborhood
    }) || null
  )
}

function isSameAddressText(a, b) {
  const normalizedA = normalizeForMatch(a)
  const normalizedB = normalizeForMatch(b)

  if (!normalizedA || !normalizedB) return true

  return normalizedA === normalizedB
}

function removeAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function sanitizePixText(value, maxLength = 25) {
  return removeAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, '')
    .trim()
    .slice(0, maxLength)
}

function emv(id, value) {
  const stringValue = String(value ?? '')
  const length = String(stringValue.length).padStart(2, '0')

  return `${id}${length}${stringValue}`
}

function crc16(payload) {
  let crc = 0xffff

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalizePixKey(key, keyType) {
  const cleanKey = String(key || '').trim()

  if (!cleanKey) return ''

  if (keyType === 'phone') {
    const digits = onlyDigits(cleanKey)

    if (!digits) return ''
    if (digits.startsWith('55')) return `+${digits}`

    return `+55${digits}`
  }

  if (keyType === 'cpf' || keyType === 'cnpj') {
    return onlyDigits(cleanKey)
  }

  if (keyType === 'email') {
    return cleanKey.toLowerCase()
  }

  return cleanKey
}

function getPixConfig(store) {
  const pix = store?.pix || {}
  const settingsPix = store?.paymentSettings?.pix || {}

  const key = firstValue(
    pix.key,
    settingsPix.key,
    store?.pixKey
  )

  const keyType = firstValue(
    pix.keyType,
    settingsPix.keyType,
    store?.pixKeyType,
    'random'
  )

  const merchantName = firstValue(
    pix.merchantName,
    pix.receiverName,
    settingsPix.merchantName,
    settingsPix.receiverName,
    store?.name,
    'PratoBy'
  )

  const merchantCity = firstValue(
    pix.merchantCity,
    pix.receiverCity,
    settingsPix.merchantCity,
    settingsPix.receiverCity,
    store?.city,
    store?.address?.city,
    'ARACAJU'
  )

  const hasPixObject = Boolean(store?.pix && Object.keys(store.pix).length > 0)
  const hasSettingsPixObject = Boolean(
    store?.paymentSettings?.pix && Object.keys(store.paymentSettings.pix).length > 0
  )
  const legacyEnabled = !hasPixObject && !hasSettingsPixObject && Boolean(store?.pixKey)

  return {
    enabled: pix.enabled === true || settingsPix.enabled === true || legacyEnabled,
    key: normalizePixKey(key, keyType),
    rawKey: String(key || '').trim(),
    keyType,
    merchantName: sanitizePixText(merchantName, 25),
    merchantCity: sanitizePixText(merchantCity, 15),
  }
}

function generatePixCopyPaste({
  pixConfig,
  amount,
  txid = 'PratoBy',
  description = 'PEDIDO PratoBy',
}) {
  if (!pixConfig?.key) return ''

  const merchantAccountInfo = [
    emv('00', 'BR.GOV.BCB.PIX'),
    emv('01', pixConfig.key),
    description ? emv('02', sanitizePixText(description, 30)) : '',
  ].join('')

  const additionalData = emv('05', sanitizePixText(txid, 25) || 'PratoBy')

  const amountValue = Number(amount || 0).toFixed(2)

  const payloadWithoutCrc = [
    emv('00', '01'),
    emv('26', merchantAccountInfo),
    emv('52', '0000'),
    emv('53', '986'),
    emv('54', amountValue),
    emv('58', 'BR'),
    emv('59', pixConfig.merchantName || 'PratoBy'),
    emv('60', pixConfig.merchantCity || 'ARACAJU'),
    emv('62', additionalData),
    '6304',
  ].join('')

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`
}

function buildPixPaymentSnapshot({ store, total, totalCents, storeSlug }) {
  const pixConfig = getPixConfig(store)

  if (!pixConfig.enabled || !pixConfig.key) return null

  const txid = `P${Date.now().toString(36).toUpperCase()}`.slice(0, 25)

  const pixCopyPaste = generatePixCopyPaste({
    pixConfig,
    amount: total,
    txid,
    description: `PEDIDO ${storeSlug || 'PratoBy'}`,
  })

  if (!pixCopyPaste) return null

  return {
    method: 'pix_manual',
    label: 'Pix',
    status: 'pending',
    amount: total,
    amountCents: totalCents,

    pixKey: pixConfig.rawKey || pixConfig.key,
    pixKeyNormalized: pixConfig.key,
    pixKeyType: pixConfig.keyType,
    pixMerchantName: pixConfig.merchantName,
    pixMerchantCity: pixConfig.merchantCity,
    pixTxid: txid,
    pixCopyPaste,

    proofUrl: null,
    proofSentAt: null,
    confirmedAt: null,
    confirmedBy: null,
  }
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function loadCustomer() {
  try {
    const current = localStorage.getItem(CUSTOMER_KEY)
    const legacy = localStorage.getItem(LEGACY_CUSTOMER_KEY)

    return {
      ...EMPTY_CUSTOMER,
      ...safeJsonParse(legacy, {}),
      ...safeJsonParse(current, {}),
    }
  } catch {
    return EMPTY_CUSTOMER
  }
}

function saveCustomer(customer) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer))
    localStorage.setItem(LEGACY_CUSTOMER_KEY, JSON.stringify(customer))
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function getStoreSlug(store, fallbackSlug) {
  return store?.storeSlug || store?.slug || store?.id || fallbackSlug
}

function getStoreDocId(store, fallbackSlug) {
  return store?.id || store?.storeId || store?.storeSlug || store?.slug || fallbackSlug
}

function getStoreMinOrder(store) {
  return normalizeMoney(
    store?.minOrder ?? store?.minimumOrder,
    store?.minOrderCents ?? store?.minimumOrderCents
  )
}

function getDefaultDeliveryFee(store) {
  return normalizeMoney(store?.deliveryFee, store?.deliveryFeeCents)
}

function getItemKey(item) {
  return item?.cartItemId || item?.key || item?.id
}

function getItemQuantity(item) {
  return Number(item?.quantity || item?.qty || 1)
}

function hasExplicitBasePrice(item) {
  return hasValue(firstValue(
    item?.basePrice,
    item?.price,
    item?.currentPrice,
    item?.salePrice,
    item?.promotionalPrice,
    item?.basePriceCents,
    item?.priceCents,
    item?.currentPriceCents,
    item?.salePriceCents,
    item?.promotionalPriceCents
  ))
}

function getItemUnitPrice(item) {
  return normalizeMoney(
    firstValue(
      item?.basePrice,
      item?.price,
      item?.currentPrice,
      item?.salePrice,
      item?.promotionalPrice,
      item?.unitPrice,
      item?.finalUnitPrice
    ),
    firstValue(
      item?.basePriceCents,
      item?.priceCents,
      item?.currentPriceCents,
      item?.salePriceCents,
      item?.promotionalPriceCents,
      item?.unitPriceCents,
      item?.finalUnitPriceCents
    )
  )
}

function getItemOldPrice(item) {
  return normalizeMoney(
    firstValue(item?.oldPrice, item?.compareAtPrice, item?.originalPrice),
    firstValue(item?.oldPriceCents, item?.compareAtPriceCents, item?.originalPriceCents)
  )
}

function getOptionGroupsFromItem(item) {
  const groups = []

  if (Array.isArray(item?.selectedOptionGroups)) groups.push(...item.selectedOptionGroups)
  if (Array.isArray(item?.optionGroupsSnapshot)) groups.push(...item.optionGroupsSnapshot)
  if (Array.isArray(item?.customizationGroupsSnapshot)) groups.push(...item.customizationGroupsSnapshot)

  const seen = new Set()

  return groups.filter((group) => {
    const key = String(group?.groupId || group?.id || group?.title || group?.name || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getOptionQuantity(option) {
  return Number(option?.quantity || option?.qty || option?.selectedQuantity || 1)
}

function getExtraUnitPrice(extra) {
  return normalizeMoney(
    firstValue(
      extra?.unitPrice,
      extra?.basePrice,
      extra?.price,
      extra?.additionalPrice,
      extra?.extraPrice,
      extra?.priceDelta,
      extra?.value
    ),
    firstValue(
      extra?.unitPriceCents,
      extra?.basePriceCents,
      extra?.priceCents,
      extra?.additionalPriceCents,
      extra?.extraPriceCents,
      extra?.priceDeltaCents,
      extra?.valueCents
    )
  )
}

function getExtraTotal(extra) {
  if (extra?.totalCents !== undefined && extra?.totalCents !== null) {
    return normalizeMoney(null, extra.totalCents)
  }

  if (extra?.total !== undefined && extra?.total !== null) {
    return normalizeMoney(extra.total, null)
  }

  const quantity = Number(
    extra?.chargedQuantity ??
      extra?.billableQuantity ??
      extra?.quantity ??
      extra?.qty ??
      1
  )

  return getExtraUnitPrice(extra) * Math.max(0, quantity)
}

function normalizeExtraForCart(extra, fallback = {}) {
  const quantity = Number(extra?.quantity || extra?.qty || extra?.selectedQuantity || 1)
  const chargedQuantity = Number(extra?.chargedQuantity ?? quantity)
  const includedQuantity = Number(extra?.includedQuantity || 0)
  const unitPrice = getExtraUnitPrice(extra)
  const total = getExtraTotal(extra)

  return {
    ...extra,
    ...fallback,
    id: extra?.id || extra?.optionId || extra?.extraId || extra?.name || fallback.id || null,
    optionId: extra?.optionId || extra?.id || fallback.optionId || null,
    name: extra?.name || extra?.title || fallback.name || 'Opção',
    description: extra?.description || extra?.details || '',
    quantity,
    chargedQuantity,
    includedQuantity,
    unitPrice,
    unitPriceCents: Math.round(unitPrice * 100),
    price: total,
    priceCents: Math.round(total * 100),
    total,
    totalCents: Math.round(total * 100),
    type: extra?.type || fallback.type || 'extra',
  }
}

function getRawExtras(item) {
  const values = []

  if (Array.isArray(item?.extras)) values.push(...item.extras)
  if (Array.isArray(item?.addons)) values.push(...item.addons)
  if (Array.isArray(item?.additionals)) values.push(...item.additionals)
  if (Array.isArray(item?.selectedAddons)) values.push(...item.selectedAddons)
  if (Array.isArray(item?.selectedAdditionals)) values.push(...item.selectedAdditionals)
  if (Array.isArray(item?.selectedOptionsFlat)) values.push(...item.selectedOptionsFlat)
  if (Array.isArray(item?.selectedOptions)) values.push(...item.selectedOptions)

  getOptionGroupsFromItem(item).forEach((group) => {
    const groupId = group?.groupId || group?.id
    const groupTitle = group?.groupTitle || group?.title || group?.name || 'Opção'

    if (!Array.isArray(group?.options)) return

    group.options.forEach((option) => {
      values.push({
        ...option,
        groupId: option?.groupId || groupId,
        groupTitle: option?.groupTitle || groupTitle,
        type: 'option',
      })
    })
  })

  return values
}

function getItemExtras(item) {
  const extras = getRawExtras(item)
  const seen = new Set()

  return extras
    .filter(Boolean)
    .map((extra) => normalizeExtraForCart(extra))
    .filter((extra) => {
      const key = [
        extra?.type || '',
        extra?.groupId || '',
        extra?.groupTitle || '',
        extra?.id || extra?.optionId || '',
        extra?.name || '',
        extra?.quantity || 1,
        extra?.totalCents ?? extra?.priceCents ?? 0,
      ].join('|')

      if (seen.has(key)) return false

      seen.add(key)
      return true
    })
}

function getOptionItems(item) {
  return getItemExtras(item).filter(
    (extra) => extra.type === 'option' || extra.groupTitle || extra.groupId
  )
}

function getAdditionalItems(item) {
  return getItemExtras(item).filter(
    (extra) => extra.type !== 'option' && !extra.groupTitle && !extra.groupId
  )
}

function getItemExtrasTotal(item) {
  return getItemExtras(item).reduce((acc, extra) => {
    return acc + getExtraTotal(extra)
  }, 0)
}

function getItemStandaloneUnitPrice(item) {
  return normalizeMoney(
    firstValue(item?.unitPrice, item?.finalUnitPrice, item?.configuredUnitPrice),
    firstValue(item?.unitPriceCents, item?.finalUnitPriceCents, item?.configuredUnitPriceCents)
  )
}

function getItemConfiguredUnitPrice(item) {
  const basePrice = getItemUnitPrice(item)
  const extrasTotal = getItemExtrasTotal(item)

  if (hasExplicitBasePrice(item)) {
    return basePrice + extrasTotal
  }

  const standaloneUnitPrice = getItemStandaloneUnitPrice(item)

  if (standaloneUnitPrice > 0) return standaloneUnitPrice

  return basePrice + extrasTotal
}

function getItemTotal(item) {
  const quantity = getItemQuantity(item)
  const computedTotal = getItemConfiguredUnitPrice(item) * quantity

  if (computedTotal > 0) return computedTotal

  return normalizeMoney(item?.total, item?.totalCents)
}

function getItemOriginalUnitPrice(item) {
  const currentPrice = getItemUnitPrice(item)
  const oldPrice = getItemOldPrice(item)

  if (oldPrice > currentPrice) return oldPrice

  return currentPrice
}

function getItemOriginalTotal(item) {
  const quantity = getItemQuantity(item)
  const originalUnitPrice = getItemOriginalUnitPrice(item)
  const extrasTotal = hasExplicitBasePrice(item) ? getItemExtrasTotal(item) : 0

  return (originalUnitPrice + extrasTotal) * quantity
}

function getPromotionInfo(item) {
  const currentPrice = getItemUnitPrice(item)
  const oldPrice = getItemOldPrice(item)

  if (!oldPrice || !currentPrice || oldPrice <= currentPrice) {
    return {
      active: Boolean(item?.isPromotion || item?.promotion || item?.onSale),
      oldPrice: 0,
      currentPrice,
      percent: 0,
      savings: 0,
    }
  }

  const savings = oldPrice - currentPrice
  const percent = Math.round((savings / oldPrice) * 100)

  return {
    active: true,
    oldPrice,
    currentPrice,
    percent,
    savings,
  }
}


function getItemImage(item) {
  return (
    item?.imageUrl ||
    item?.image ||
    item?.photoUrl ||
    item?.thumbnailUrl ||
    item?.productImage ||
    item?.coverImage ||
    ''
  )
}

function getItemDescription(item) {
  return (
    item?.description ||
    item?.productDescription ||
    item?.shortDescription ||
    item?.details ||
    ''
  )
}

function getItemOptionsSummary(item) {
  if (item?.optionsSummary && typeof item.optionsSummary === 'string') {
    return item.optionsSummary
  }

  const options = getOptionItems(item)
  const additionals = getAdditionalItems(item)
  const groupedOptions = groupOptionsByTitle(options)

  const optionText = Object.entries(groupedOptions).map(([groupTitle, groupOptions]) => {
    const optionsText = groupOptions
      .map((option) => {
        const quantity = getOptionQuantity(option)
        const prefix = quantity > 1 ? `${quantity}x ` : ''
        return `${prefix}${option.name}`
      })
      .join(', ')

    return `${groupTitle}: ${optionsText}`
  })

  const additionalText = additionals.map((extra) => {
    const quantity = getOptionQuantity(extra)
    const prefix = quantity > 1 ? `${quantity}x ` : ''

    return `+ ${prefix}${extra.name}`
  })

  return [...optionText, ...additionalText].join(' · ')
}

function groupOptionsByTitle(options) {
  return options.reduce((acc, option) => {
    const title = option.groupTitle || option.groupName || option.title || 'Opção'

    if (!acc[title]) acc[title] = []

    acc[title].push(option)

    return acc
  }, {})
}

function buildSelectedOptionGroupsSnapshot(item) {
  const existingGroups = getOptionGroupsFromItem(item)

  if (existingGroups.length > 0) {
    return existingGroups.map((group) => {
      const groupId = group?.groupId || group?.id || group?.title || group?.name
      const groupTitle = group?.groupTitle || group?.title || group?.name || 'Opção'
      const options = Array.isArray(group?.options)
        ? group.options.map((option) => normalizeExtraForCart(option, {
            groupId,
            groupTitle,
            type: 'option',
          }))
        : []

      return {
        ...group,
        groupId,
        id: groupId,
        groupTitle,
        title: groupTitle,
        name: group?.name || groupTitle,
        options,
      }
    })
  }

  return Object.entries(groupOptionsByTitle(getOptionItems(item))).map(([groupTitle, options]) => ({
    groupId: groupTitle,
    id: groupTitle,
    groupTitle,
    title: groupTitle,
    name: groupTitle,
    options: options.map((option) => normalizeExtraForCart(option, {
      groupTitle,
      type: 'option',
    })),
  }))
}

function sanitizeSelectedOptionForOrder(option) {
  return {
    id: option?.id || option?.optionId || option?.name || '',
    optionId: option?.optionId || option?.id || '',
    name: option?.name || option?.title || '',
    groupId: option?.groupId || '',
    groupTitle: option?.groupTitle || option?.groupName || '',
    quantity: Number(option?.quantity || option?.qty || 1),
  }
}

function buildPublicOrderItems(cartItems) {
  return cartItems.map((item) => {
    const selectedOptionGroups = buildSelectedOptionGroupsSnapshot(item).map((group) => ({
      groupId: group.groupId || group.id || group.title || '',
      id: group.id || group.groupId || group.title || '',
      title: group.title || group.groupTitle || group.name || '',
      name: group.name || group.title || group.groupTitle || '',
      options: Array.isArray(group.options)
        ? group.options.map((option) => sanitizeSelectedOptionForOrder({
            ...option,
            groupId: option.groupId || group.groupId || group.id,
            groupTitle: option.groupTitle || group.title || group.groupTitle,
          }))
        : [],
    }))

    const selectedOptions = getOptionItems(item).map(sanitizeSelectedOptionForOrder)
    const addons = getAdditionalItems(item).map(sanitizeSelectedOptionForOrder)

    return {
      productId: item.originalProductId || item.productId || item.id,
      quantity: getItemQuantity(item),
      observation: item.observation || '',
      itemObservation: item.observation || '',
      selectedOptions,
      selectedOptionGroups,
      selectedOptionsFlat: selectedOptions,
      optionGroupsSnapshot: selectedOptionGroups,
      addons,
    }
  })
}

function getCouponMinOrder(coupon) {
  return normalizeMoney(
    coupon.minOrder ?? coupon.minimumOrder,
    coupon.minOrderCents ?? coupon.minimumOrderCents
  )
}

function getCouponFixedValue(coupon) {
  return normalizeMoney(coupon.value, coupon.valueCents)
}

function getCouponMaxDiscount(coupon) {
  return normalizeMoney(coupon.maxDiscount, coupon.maxDiscountCents)
}

function productAcceptsCoupon(item) {
  if (!item) return false
  if (item.acceptsCoupons !== undefined) return Boolean(item.acceptsCoupons)
  if (item.acceptsCoupon !== undefined) return Boolean(item.acceptsCoupon)
  if (item.couponEligible !== undefined) return Boolean(item.couponEligible)
  return true
}

function couponAppliesToItem(coupon, item) {
  if (!coupon || !item) return false
  if (!productAcceptsCoupon(item)) return false

  // Suporte a cupom legado com targetId específico
  if (coupon.targetId && coupon.targetId !== 'all') {
    return item.id === coupon.targetId
  }

  const appliesTo = coupon.appliesTo || 'all'
  const productIds = Array.isArray(coupon.productIds) ? coupon.productIds : []

  if (appliesTo === 'includeProducts') {
    return productIds.includes(item.id)
  }
  if (appliesTo === 'excludeProducts') {
    return !productIds.includes(item.id)
  }

  // appliesTo === 'all'
  return true
}

function buildCouponItemsPayload(cartItems) {
  return cartItems.map((item) => ({
    id: String(item.id || item.cartItemId || '').trim(),
    productId: String(item.productId || item.id || '').trim(),
    categoryId: String(item.categoryId || item.productCategoryId || item.product?.categoryId || '').trim(),
    totalCents: Math.round(getItemTotal(item) * 100),
    acceptsCoupons: item.acceptsCoupons !== false && item.acceptsCoupon !== false,
  }))
}

function getCouponValidationMessage(data = {}) {
  if (data.reason === 'min_order_not_met') {
    return `Esse cupom exige pedido mínimo de ${formatMoney(data.minOrderCents / 100)}. Faltam ${formatMoney(data.missingCents / 100)} em produtos elegíveis para usá-lo.`
  }

  if (data.reason === 'ineligible_items') {
    return 'Esse cupom vale apenas para produtos selecionados. Adicione um item elegível para usá-lo.'
  }

  return data.message || 'Cupom inválido ou não encontrado.'
}

function isBlockingCepError(message) {
  const normalizedMessage = normalizeForMatch(message)

  return (
    normalizedMessage.includes('digite 8 numeros') ||
    normalizedMessage.includes('informe um cep valido') ||
    normalizedMessage.includes('loja entrega apenas em') ||
    normalizedMessage.includes('bairro fora da area')
  )
}

function SectionCard({ title, icon: Icon, children, description }) {
  return (
    <section className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={18} />
        </div>

        <div>
          <h3 className="text-sm font-black text-[#111827]">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  )
}

function InputField({ label, className = '', error, ...props }) {
  return (
    <div className={`scroll-mt-24 ${className}`}>
      {label && (
        <label className={`mb-1.5 block text-xs font-black uppercase tracking-wide ${error ? 'text-red-500' : 'text-[#6b7280]'}`}>
          {label}
        </label>
      )}

      <input
        {...props}
        aria-invalid={!!error}
        className={`h-12 w-full rounded-2xl border bg-[#F9FAFB] px-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:bg-white focus:ring-4 ${
          error
            ? 'border-red-500 ring-2 ring-red-500/50 focus:border-red-500 focus:ring-red-100'
            : 'border-gray-100 focus:border-[#f97316] focus:ring-orange-100'
        }`}
      />
      {error && <span className="mt-1.5 block text-xs font-semibold text-red-500">{error}</span>}
    </div>
  )
}

function PromoPriceLine({ item, compact = false }) {
  const promo = getPromotionInfo(item)

  if (!promo.active) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600">
        Promoção
      </span>

      {promo.oldPrice > promo.currentPrice && (
        <>
          <span className="text-[11px] font-bold text-gray-400 line-through">
            {formatMoney(promo.oldPrice)}
          </span>

          <span className="text-[11px] font-black text-[#f97316]">
            {formatMoney(promo.currentPrice)}
          </span>

          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            -{promo.percent}%
          </span>
        </>
      )}
    </div>
  )
}

function CartItemDetailsModal({
  item,
  onClose,
  onQuantityChange,
  onRemove,
  onUpdateObservation,
}) {
  const [draftObservation, setDraftObservation] = useState('')

  useEffect(() => {
    setDraftObservation(item?.observation || '')
  }, [item?.cartItemId, item?.id, item?.observation])

  if (!item) return null

  const observationChanged =
    draftObservation.trim() !== String(item.observation || '').trim()

  const quantity = getItemQuantity(item)
  const basePrice = getItemUnitPrice(item)
  const extrasTotal = getItemExtrasTotal(item)
  const options = getOptionItems(item)
  const additionals = getAdditionalItems(item)
  const groupedOptions = groupOptionsByTitle(options)
  const imageUrl = getItemImage(item)
  const description = getItemDescription(item)
  const promo = getPromotionInfo(item)

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar detalhes do item"
      />

      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl md:rounded-[2rem]">
        <div className="relative h-52 shrink-0 bg-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#F9FAFB] text-gray-300">
              <FiImage size={48} />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-[#111827] shadow-lg backdrop-blur transition hover:bg-white"
            aria-label="Fechar"
          >
            <FiX size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-2xl font-black tracking-tight text-[#111827]">
                  {item.name}
                </h3>

                {description && (
                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    {description}
                  </p>
                )}
              </div>

              <span className="shrink-0 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316]">
                {quantity}x
              </span>
            </div>

            {promo.active ? (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-red-600">
                      Produto em promoção
                    </p>

                    {promo.oldPrice > promo.currentPrice && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-400 line-through">
                          {formatMoney(promo.oldPrice)}
                        </span>

                        <span className="text-base font-black text-[#111827]">
                          {formatMoney(promo.currentPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {promo.percent > 0 && (
                    <span className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white">
                      -{promo.percent}%
                    </span>
                  )}
                </div>

                {promo.savings > 0 && (
                  <p className="mt-3 text-xs font-bold text-red-700">
                    Economia de {formatMoney(promo.savings)} por unidade.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-2xl font-black text-[#111827]">
                {formatMoney(basePrice)}
              </p>
            )}
          </div>

          {Object.keys(groupedOptions).length > 0 && (
            <div className="mt-6 space-y-4">
              {Object.entries(groupedOptions).map(([groupTitle, groupOptions]) => (
                <section
                  key={groupTitle}
                  className="rounded-[1.5rem] border border-gray-100 bg-[#F9FAFB] p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-[#111827]">
                        {groupTitle}
                      </h4>

                      <p className="mt-1 text-xs font-medium text-[#6b7280]">
                        Escolha feita no item
                      </p>
                    </div>

                    <span className="rounded-full bg-[#f97316] px-2.5 py-1 text-[10px] font-black uppercase text-white">
                      Escolhido
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupOptions.map((option, index) => {
                      const optionQuantity = getOptionQuantity(option)
                      const optionTotal = getExtraTotal(option)
                      const optionPrefix = optionQuantity > 1 ? `${optionQuantity}x ` : ''

                      return (
                        <div
                          key={`${groupTitle}-${option.name}-${index}`}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-[#111827]">
                              {optionPrefix}{option.name}
                            </p>

                            {option.description && (
                              <p className="mt-0.5 text-xs text-[#6b7280]">
                                {option.description}
                              </p>
                            )}

                            {option.includedQuantity > 0 && (
                              <p className="mt-0.5 text-[11px] font-bold text-orange-700">
                                {option.includedQuantity} incluso no preço
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {optionTotal > 0 && (
                              <span className="text-xs font-black text-[#f97316]">
                                + {formatMoney(optionTotal)}
                              </span>
                            )}

                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316] text-white">
                              <FiCheck size={14} />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {additionals.length > 0 && (
            <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-[#F9FAFB] p-4">
              <h4 className="text-sm font-black text-[#111827]">
                Adicionais
              </h4>

              <p className="mt-1 text-xs font-medium text-[#6b7280]">
                Itens extras escolhidos.
              </p>

              <div className="mt-3 space-y-2">
                {additionals.map((extra, index) => {
                  const extraQuantity = getOptionQuantity(extra)
                  const extraTotal = getExtraTotal(extra)
                  const extraPrefix = extraQuantity > 1 ? `${extraQuantity}x ` : ''

                  return (
                    <div
                      key={`${extra.name}-${index}`}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3"
                    >
                      <p className="text-sm font-black text-[#111827]">
                        {extraPrefix}{extra.name}
                      </p>

                      <div className="flex items-center gap-3">
                        {extraTotal > 0 && (
                          <span className="text-xs font-black text-[#f97316]">
                            + {formatMoney(extraTotal)}
                          </span>
                        )}

                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316] text-white">
                          <FiCheck size={14} />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4">
            <label className="text-xs font-black uppercase tracking-wide text-amber-700">
              Observação do item
            </label>

            <textarea
              rows={3}
              value={draftObservation}
              onChange={(event) => setDraftObservation(event.target.value)}
              placeholder="Ex: sem cebola, bem passado, molho separado..."
              className="mt-3 w-full resize-none rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
            />

            <button
              type="button"
              onClick={() => onUpdateObservation?.(item, draftObservation)}
              disabled={!observationChanged}
              className="mt-3 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Salvar observação
            </button>
          </section>

          {!options.length && !additionals.length && (
            <div className="mt-6 rounded-[1.5rem] border border-gray-100 bg-[#F9FAFB] p-5 text-center">
              <p className="text-sm font-bold text-[#6b7280]">
                Esse item não possui opções, adicionais ou observações.
              </p>
            </div>
          )}

          <div className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#6b7280]">
              Resumo do item
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-[#6b7280]">
                <span>Preço base</span>
                <span>{formatMoney(basePrice)}</span>
              </div>

              {extrasTotal > 0 && (
                <div className="flex justify-between text-sm text-[#6b7280]">
                  <span>Opções/adicionais</span>
                  <span>{formatMoney(extrasTotal)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm text-[#6b7280]">
                <span>Quantidade</span>
                <span>{quantity}x</span>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between text-lg font-black text-[#111827]">
                  <span>Total</span>
                  <span>{formatMoney(getItemTotal(item))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-[#F9FAFB] p-1">
              <button
                type="button"
                onClick={() => onQuantityChange(item, quantity - 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#111827] transition hover:bg-white hover:text-red-600"
              >
                {quantity === 1 ? <FiTrash2 /> : <FiMinus />}
              </button>

              <span className="w-9 text-center text-sm font-black text-[#111827]">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => onQuantityChange(item, quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#111827] transition hover:bg-white hover:text-[#f97316]"
              >
                <FiPlus />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRemove(item)}
              className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-600 transition hover:bg-red-100"
            >
              Remover item
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ea580c] active:scale-[0.98]"
          >
            <FiCheck />
            Conferido · {formatMoney(getItemTotal(item))}
          </button>
        </footer>
      </div>
    </div>
  )
}


export default function CartDrawer({ isOpen, onClose, store }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [loadingCep, setLoadingCep] = useState(false)
  const [cepError, setCepError] = useState('')
  const [cepLookupStatus, setCepLookupStatus] = useState('idle')

  const handleSearchCep = async (cep) => {
  const digits = onlyDigits(cep)

  setCepError('')
  setCepLookupStatus('idle')

  setCustomer((prev) => ({
    ...prev,
    cepValidated: false,
    cepNeighborhood: '',
    cepStreet: '',
    cepCity: '',
    cepState: '',
  }))

  if (!digits) return null

  if (digits.length !== 8) {
    setCepError('CEP inválido. Digite 8 números.')
    setCepLookupStatus('invalid')
    return null
  }

  setLoadingCep(true)

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)

    if (!response.ok) {
      setCepError('Não conseguimos buscar o CEP agora. Preencha o endereço manualmente.')
      setCepLookupStatus('manual')
      return null
    }

    const data = await response.json()

    if (data?.erro) {
      setCepError('CEP não encontrado. Confira o número ou preencha manualmente.')
      setCepLookupStatus('manual')
      return null
    }

    const cepNeighborhood = data.bairro || ''
    const cepStreet = data.logradouro || ''
    const cepCity = data.localidade || ''
    const cepState = data.uf || ''

    const matchedNeighborhood = findDeliveryNeighborhoodMatch(
      cepNeighborhood,
      deliveryNeighborhoods
    )

    if (deliveryNeighborhoods.length > 0 && !matchedNeighborhood) {
      setCustomer((prev) => ({
        ...prev,
        cep: formatCep(digits),
        street: cepStreet || prev.street,
        neighborhood: '',
        city: cepCity,
        state: cepState,
        cepNeighborhood,
        cepStreet,
        cepCity,
        cepState,
        cepValidated: false,
      }))

      setCepError(
        deliveryAreaMessage || 'Bairro fora da área de entrega.'
      )
      setCepLookupStatus('unsupported')

      return null
    }

    setCustomer((prev) => ({
      ...prev,
      cep: formatCep(digits),
      street: cepStreet || prev.street,
      neighborhood: matchedNeighborhood?.neighborhood || cepNeighborhood || prev.neighborhood,
      city: cepCity || prev.city || '',
      state: cepState || prev.state || '',
      cepNeighborhood,
      cepStreet,
      cepCity,
      cepState,
      cepValidated: true,
    }))
    setCepLookupStatus('validated')

    return {
      cep: formatCep(digits),
      street: cepStreet,
      neighborhood: matchedNeighborhood?.neighborhood || cepNeighborhood,
      city: cepCity,
      state: cepState,
    }
  } catch (error) {
    console.error('Erro ao buscar CEP', error)
    setCepError('Não conseguimos buscar o CEP agora. Preencha o endereço manualmente.')
    setCepLookupStatus('manual')
    return null
  } finally {
    setLoadingCep(false)
  }
}

  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    updateCartItem,
    clearCart,
  } = useCart()

  const [step, setStep] = useState('cart')
  const [orderType, setOrderType] = useState('delivery')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [changeFor, setChangeFor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)

  const [selectedCartItem, setSelectedCartItem] = useState(null)

  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const [customer, setCustomer] = useState(loadCustomer)

  const themeColor = store?.themeColor || '#f97316'
  const storeSlug = getStoreSlug(store, slug)
  const storeDocId = getStoreDocId(store, slug)
  const finalStoreId = store?.storeId || storeDocId

  const storeIsOpen =
    store?.isDeleted || store?.isBlocked || store?.isActive === false
      ? false
      : store?.isOpen !== false

  const deliveryFees = store?.deliveryFees || {}

  const deliveryNeighborhoods = useMemo(() => {
    return Object.entries(deliveryFees)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([neighborhood, value]) => ({
        neighborhood,
        fee: normalizeMoney(value),
      }))
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood))
  }, [deliveryFees])
  const deliveryNeighborhoodList = useMemo(() => {
    return deliveryNeighborhoods.map((item) => item.neighborhood).join(', ')
  }, [deliveryNeighborhoods])
  const deliveryAreaMessage = deliveryNeighborhoodList
    ? `A loja entrega apenas em: ${deliveryNeighborhoodList}.`
    : ''
  const blockingCepError = isBlockingCepError(cepError)

  const paymentOptions = useMemo(() => {
    const paymentMethods = store?.paymentMethods || {}
    const publicPaymentMethods = store?.publicPaymentMethods || {}
    const acceptedPaymentMethods = Array.isArray(store?.acceptedPaymentMethods) ? store.acceptedPaymentMethods : []
    const acceptedPaymentMethodKeys = acceptedPaymentMethods.map((m) => String(m).toLowerCase())

    const pixEnabled =
      paymentMethods.pix !== false &&
      (store?.pix?.enabled === true ||
        paymentMethods?.pix === true ||
        paymentMethods?.pix?.enabled === true ||
        publicPaymentMethods?.pix === true ||
        publicPaymentMethods?.pix?.enabled === true ||
        acceptedPaymentMethodKeys.includes('pix'))

    const cardEnabled = paymentMethods.card !== false
    const cashEnabled = paymentMethods.cash !== false

    return [
      pixEnabled && {
        value: 'pix_manual',
        legacyLabel: 'Pix',
        label: 'Pix',
        icon: '⚡',
        description: 'Copie o Pix na próxima tela e aguarde confirmação da loja',
        paymentStatus: 'pending',
      },
      cardEnabled && {
        value: 'card_on_delivery',
        legacyLabel: 'Cartão',
        label: 'Maquininha',
        icon: '💳',
        description: 'Débito ou crédito na entrega',
        paymentStatus: 'pay_on_delivery',
      },
      cashEnabled && {
        value: 'cash',
        legacyLabel: 'Dinheiro',
        label: 'Dinheiro',
        icon: '💵',
        description: 'Informe se precisa de troco',
        paymentStatus: 'pay_on_delivery',
      },
    ].filter(Boolean)
  }, [store])

  useEffect(() => {
    if (!paymentOptions.length) {
      if (paymentMethod) setPaymentMethod('')
      return
    }

    const currentMethodIsAvailable = paymentOptions.some(
      (option) => option.value === paymentMethod
    )

    if (!currentMethodIsAvailable) {
      setPaymentMethod(paymentOptions[0].value)
      setChangeFor('')
    }
  }, [paymentMethod, paymentOptions])

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + getItemTotal(item), 0)
  }, [cartItems])

  const subtotalWithoutPromotions = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + getItemOriginalTotal(item), 0)
  }, [cartItems])

  const promotionSavings = useMemo(() => {
    return Math.max(0, subtotalWithoutPromotions - subtotal)
  }, [subtotal, subtotalWithoutPromotions])

  const hasPromotionSavings = promotionSavings > 0

  const eligibleCouponSubtotal = useMemo(() => {
    if (!appliedCoupon) return 0
    if (appliedCoupon.eligibleSubtotalCents !== undefined) {
      return appliedCoupon.eligibleSubtotalCents / 100
    }
    return subtotal
  }, [appliedCoupon, subtotal])

  const discount = useMemo(() => {
    if (!appliedCoupon) return 0
    return (appliedCoupon.discountCents || 0) / 100
  }, [appliedCoupon])

  const defaultDeliveryFee = getDefaultDeliveryFee(store)

  const selectedNeighborhoodFee = useMemo(() => {
    if (!customer.neighborhood) return null

    const found = findDeliveryNeighborhoodMatch(customer.neighborhood, deliveryNeighborhoods)

    if (found) return found.fee

    return deliveryNeighborhoods.length > 0 ? null : defaultDeliveryFee
  }, [customer.neighborhood, defaultDeliveryFee, deliveryNeighborhoods])

  const deliveryFee =
    orderType === 'delivery'
      ? Number(selectedNeighborhoodFee ?? 0)
      : 0

  const total = Math.max(0, subtotal - discount) + deliveryFee

  const minOrder = getStoreMinOrder(store)
  const belowMinimum = minOrder > 0 && subtotal < minOrder
  const missingForMin = Math.max(0, minOrder - subtotal)
  const minimumProgress = minOrder > 0 ? Math.min(100, (subtotal / minOrder) * 100) : 100

  const itemCount = cartItems.reduce(
    (acc, item) => acc + getItemQuantity(item),
    0
  )

  const selectedPayment = paymentOptions.find(
    (option) => option.value === paymentMethod
  )

  const canUseDelivery =
    orderType !== 'delivery' ||
    deliveryNeighborhoods.length === 0 ||
    selectedNeighborhoodFee !== null

  const handleQuantity = useCallback(
    (item, nextQuantity) => {
      const itemKey = getItemKey(item)

      if (nextQuantity <= 0) {
        removeFromCart(itemKey)

        if (selectedCartItem && getItemKey(selectedCartItem) === itemKey) {
          setSelectedCartItem(null)
        }

        return
      }

      updateQuantity(itemKey, nextQuantity)

      if (selectedCartItem && getItemKey(selectedCartItem) === itemKey) {
        setSelectedCartItem((current) => ({
          ...current,
          quantity: nextQuantity,
        }))
      }
    },
    [removeFromCart, selectedCartItem, updateQuantity]
  )

  const handleUpdateItemObservation = useCallback(
    (item, nextObservation) => {
      const itemKey = getItemKey(item)
      const observation = nextObservation.trim()

      updateCartItem(itemKey, {
        observation,
        itemObservation: observation,
      })

      setSelectedCartItem((current) => {
        if (!current || getItemKey(current) !== itemKey) return current

        return {
          ...current,
          observation,
          itemObservation: observation,
        }
      })
    },
    [updateCartItem]
  )

  const handleRemoveCartItem = useCallback(
    (item) => {
      const itemKey = getItemKey(item)

      removeFromCart(itemKey)
      setSelectedCartItem(null)
    },
    [removeFromCart]
  )

  const handleApplyCoupon = useCallback(async () => {
    const code = couponCode.trim().toUpperCase()

    if (!code || couponLoading) return

    setCouponError('')
    setCouponLoading(true)

    try {
      const validatePublicCoupon = httpsCallable(functions, 'validatePublicCoupon')

      const subtotalCents = Math.round(subtotal * 100)
      const itemsPayload = buildCouponItemsPayload(cartItems)

      const result = await validatePublicCoupon({
        storeId: finalStoreId,
        storeSlug,
        storeDocId,
        couponCode: code,
        subtotalCents,
        items: itemsPayload,
      })
      const data = result?.data || {}

      if (!data.valid) {
        setAppliedCoupon(null)
        setCouponError(getCouponValidationMessage(data))
        return
      }

      setAppliedCoupon({
        id: data.coupon?.code || code,
        ...(data.coupon || {}),
        code: data.coupon?.code || code,
        discountCents: data.discountCents,
        eligibleSubtotalCents: data.eligibleSubtotalCents,
      })
      setCouponCode('')
      setCouponError('')
    } catch (error) {
      console.error(error)
      setCouponError(error?.message || 'Erro ao validar cupom. Tente novamente.')
    } finally {
      setCouponLoading(false)
    }
  }, [cartItems, couponCode, couponLoading, finalStoreId, storeDocId, storeSlug, subtotal])

  useEffect(() => {
    const code = appliedCoupon?.code

    if (!code) return undefined

    let isCurrent = true
    const timeoutId = window.setTimeout(async () => {
      if (cartItems.length === 0 || subtotal <= 0) {
        setAppliedCoupon(null)
        setCouponError('O cupom foi removido porque o carrinho não possui produtos elegíveis.')
        return
      }

      try {
        const validatePublicCoupon = httpsCallable(functions, 'validatePublicCoupon')
        const result = await validatePublicCoupon({
          storeId: finalStoreId,
          storeSlug,
          storeDocId,
          couponCode: code,
          subtotalCents: Math.round(subtotal * 100),
          items: buildCouponItemsPayload(cartItems),
        })
        const data = result?.data || {}

        if (!isCurrent) return

        if (!data.valid) {
          setAppliedCoupon(null)
          setCouponError(getCouponValidationMessage(data))
          return
        }

        setAppliedCoupon((current) => {
          if (!current || current.code !== code) return current

          return {
            ...current,
            ...(data.coupon || {}),
            code,
            discountCents: data.discountCents,
            eligibleSubtotalCents: data.eligibleSubtotalCents,
          }
        })
      } catch (error) {
        if (!isCurrent) return

        console.error(error)
        setAppliedCoupon(null)
        setCouponError('Não foi possível revalidar o cupom. Aplique novamente para continuar.')
      }
    }, 250)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [appliedCoupon?.code, cartItems, finalStoreId, storeDocId, storeSlug, subtotal])

  const getFieldError = (field) => {
    if (!checkoutError) return false
    const err = typeof checkoutError === 'string' ? checkoutError.toLowerCase() : ''

    if (field === 'name' && err.includes('nome')) return checkoutError
    if (field === 'phone' && (err.includes('whatsapp') || err.includes('ddd') || err.includes('celular') || err.includes('telefone'))) return checkoutError
    if (field === 'cep' && err.includes('cep')) return checkoutError
    if (field === 'street' && (err.includes('rua') || err.includes('cep'))) return checkoutError
    if (field === 'number' && (err.includes('número') || err.includes('dígitos') || err.includes('numero'))) return checkoutError
    if (field === 'neighborhood' && (err.includes('bairro') || err.includes('entrega'))) return checkoutError

    return null
  }

  const validateCheckout = useCallback(() => {
    if (!storeIsOpen) return 'A loja está fechada no momento.'
    if (cartItems.length === 0) return 'Seu carrinho está vazio.'
    if (belowMinimum) return `Faltam ${formatMoney(missingForMin)} para o pedido mínimo.`
    if (!customer.name.trim()) return 'Informe seu nome.'
    // --- VALIDAÇÃO INTELIGENTE DE WHATSAPP ---
    const phoneDigits = customer.phone.replace(/\D/g, '')
    // Remove o "55" do começo caso o cliente tenha digitado
    const localDigits = phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits

    if (!localDigits) return 'Informe seu WhatsApp.'

    if (localDigits.length < 10 || localDigits.length > 11) {
      return 'O WhatsApp deve ter o DDD e o número (Ex: (79) 99999-9999).'
    }

    if (localDigits.length === 11 && localDigits[2] !== '9') {
      return 'O número de celular deve começar com o dígito 9.'
    }
    // -----------------------------------------

if (orderType === 'delivery') {
  const cepDigits = onlyDigits(customer.cep)
  const addressNumber = sanitizeAddressNumber(customer.number)
  const hasDeliveryNeighborhoodRules = deliveryNeighborhoods.length > 0

  if (loadingCep) {
    return 'Aguarde a busca do CEP terminar.'
  }

  if (customer.cep.trim() && cepDigits.length !== 8) {
    return 'Informe um CEP válido com 8 números.'
  }

  if (blockingCepError) {
    return cepError
  }

  if (hasDeliveryNeighborhoodRules && !cepDigits) {
    return 'Informe o CEP para confirmar se a loja entrega no seu bairro.'
  }

  // Final absolute blocks regardless of CEP resolution
  if (!customer.street.trim()) return 'Informe a rua.'
  if (!addressNumber) return 'Informe um número válido.'
  if (!customer.neighborhood.trim()) return 'Selecione ou informe o bairro.'
  if (addressNumber !== customer.number.trim()) return 'O número deve conter apenas dígitos.'

  if (
    hasDeliveryNeighborhoodRules &&
    customer.cepNeighborhood &&
    normalizeForMatch(customer.cepNeighborhood) !== normalizeForMatch(customer.neighborhood)
  ) {
    return `O CEP informado pertence ao bairro ${customer.cepNeighborhood}, mas o bairro selecionado foi ${customer.neighborhood}.`
  }

  if (
    customer.cepStreet &&
    !isSameAddressText(customer.cepStreet, customer.street)
  ) {
    return `A rua informada não parece bater com o CEP. Rua do CEP: ${customer.cepStreet}.`
  }

  if (!canUseDelivery) return 'Este bairro não está disponível para entrega.'
}

    if (!paymentMethod) return 'Escolha a forma de pagamento.'

    if (paymentMethod === 'pix_manual') {
      // O frontend confia nas flags públicas para exibir a opção Pix.
      // O backend (createPublicOrder) fará a validação final da chave e gerará a cobrança/brcode de forma segura.
    }

    if (paymentMethod === 'cash') {
      if (!changeFor) return 'Informe se precisa de troco.'

      const changeValue = parseCurrency(changeFor)

      if (changeFor !== 'sem_troco' && changeValue > 0 && changeValue < total) {
        return 'O valor do troco precisa ser maior que o total do pedido.'
      }
    }

    return ''
  }, [
  belowMinimum,
  blockingCepError,
  canUseDelivery,
  cartItems.length,
  cepError,
  changeFor,
  customer.cep,
  customer.cepNeighborhood,
  customer.cepStreet,
  customer.cepValidated,
  customer.name,
  customer.neighborhood,
  customer.number,
  customer.phone,
  customer.street,
  deliveryNeighborhoods.length,
  loadingCep,
  missingForMin,
  orderType,
  paymentMethod,
  store,
  storeIsOpen,
  total,
  ])

  const handleCheckout = useCallback(async () => {
    if (isSubmitting) return

    setCheckoutError(null)
    const error = validateCheckout()

    if (error) {
      setCheckoutError(error)
      scrollToFirstError()
      return
    }

    setIsSubmitting(true)

    try {
      const normalizedCustomer = {
        ...customer,
        phone: normalizePhoneBR(customer.phone),
      }

      saveCustomer(normalizedCustomer)

      const address =
        orderType === 'delivery'
          ? {
              cep: formatCep(customer.cep),
              neighborhood: customer.neighborhood.trim(),
              street: customer.street.trim(),
              number: sanitizeAddressNumber(customer.number),
              complement: customer.complement.trim(),
              reference: customer.reference.trim(),
              city: customer.city?.trim?.() || '',
              state: customer.state?.trim?.() || '',

              cepNeighborhood: customer.cepNeighborhood || '',
              cepStreet: customer.cepStreet || '',
              cepCity: customer.cepCity || customer.city || '',
              cepState: customer.cepState || customer.state || '',
              cepValidated: Boolean(customer.cepValidated),
            }
          : null

      const items = buildPublicOrderItems(cartItems)

      const createPublicOrder = httpsCallable(functions, 'createPublicOrder')
      const result = await createPublicOrder({
        storeId: finalStoreId,
        storeSlug,
        storeDocId,
        customerName: normalizedCustomer.name.trim(),
        customerPhone: normalizedCustomer.phone,
        deliveryType: orderType,
        orderType,
        neighborhood: customer.neighborhood.trim(),
        ...(address || {}),
        address,
        paymentMethod,
        changeFor,
        couponCode: appliedCoupon?.code || null,
        items,
      })

      const createdOrder = result?.data || {}
      const trackingToken = createdOrder.trackingToken || createdOrder.orderId

      if (!trackingToken) {
        throw new Error('Pedido criado sem token de acompanhamento.')
      }

      const savedTokens = JSON.parse(
        localStorage.getItem('@PratoBy:trackingTokens') || '[]'
      )

      const nextTokens = Array.from(
        new Set([
          trackingToken,
          ...savedTokens,
        ])
      ).slice(0, 30)

      localStorage.setItem('@PratoBy:trackingTokens', JSON.stringify(nextTokens))

      clearCart()
      onClose?.()
      navigate(createdOrder.trackingUrl || `/${storeSlug}/pedido/${trackingToken}`)
    } catch (error) {
      console.error(error)
      const message = error?.message || 'Erro ao enviar pedido. Tente novamente.'
      setCheckoutError(message)
      scrollToFirstError()
      alert(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    appliedCoupon,
    cartItems,
    changeFor,
    clearCart,
    customer,
    finalStoreId,
    isSubmitting,
    navigate,
    onClose,
    orderType,
    paymentMethod,
    storeDocId,
    storeSlug,
    validateCheckout,
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <motion.button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar carrinho"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="relative flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-[#F9FAFB] shadow-2xl"
      >
        <header className="sticky top-0 z-20 shrink-0 border-b border-gray-100 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {step === 'checkout' && (
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100"
                  aria-label="Voltar ao carrinho"
                >
                  <FiChevronRight className="rotate-180" />
                </button>
              )}

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                <FiShoppingBag size={21} />
              </div>

              <div>
                <h2 className="text-lg font-black text-[#111827]">
                  {step === 'cart' ? 'Seu carrinho' : 'Finalizar pedido'}
                </h2>

                <p className="text-xs font-medium text-[#6b7280]">
                  {store?.name || 'PratoBy'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
              aria-label="Fechar"
            >
              <FiX size={20} />
            </button>
          </div>
        </header>

        {!storeIsOpen && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <FiAlertCircle className="mt-0.5 shrink-0 text-red-600" />

              <p className="text-sm font-bold leading-6 text-red-700">
                A loja está fechada. Você pode revisar o carrinho, mas a finalização está bloqueada.
              </p>
            </div>
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-white text-gray-300 shadow-sm">
              <FiShoppingBag size={34} />
            </div>

            <h3 className="mt-5 text-lg font-black text-[#111827]">
              Carrinho vazio
            </h3>

            <p className="mt-2 max-w-xs text-sm leading-6 text-[#6b7280]">
              Adicione itens do cardápio para continuar seu pedido.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-2xl bg-[#f97316] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
            >
              Explorar cardápio
            </button>
          </div>
        ) : (
          <>
            {minOrder > 0 && (
              <div
                className={`border-b px-4 py-3 ${
                  belowMinimum
                    ? 'border-amber-100 bg-amber-50'
                    : 'border-orange-100 bg-orange-50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p
                    className={`text-xs font-black ${
                      belowMinimum ? 'text-amber-700' : 'text-[#f97316]'
                    }`}
                  >
                    {belowMinimum
                      ? `Faltam ${formatMoney(missingForMin)} para o pedido mínimo`
                      : 'Pedido mínimo atingido'}
                  </p>

                  <p className="text-xs font-bold text-[#6b7280]">
                    {formatMoney(minOrder)}
                  </p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full transition-all ${
                      belowMinimum ? 'bg-amber-400' : 'bg-[#f97316]'
                    }`}
                    style={{
                      width: `${minimumProgress}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#F9FAFB] p-4">
              {step === 'cart' && (
                <>
                  <SectionCard
                    title="Itens do pedido"
                    icon={FiShoppingBag}
                    description="Toque em um item para ver opções, adicionais e observações."
                  >
                    {cartItems.map((item) => {
                      const quantity = getItemQuantity(item)
                      const itemKey = getItemKey(item)
                      const extrasSummary = getItemOptionsSummary(item)

                      return (
                        <div
                          key={itemKey}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedCartItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') setSelectedCartItem(item)
                          }}
                          className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-3 transition hover:border-orange-100 hover:bg-[#F9FAFB]"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-gray-300">
                              {getItemImage(item) ? (
                                <img
                                  src={getItemImage(item)}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FiShoppingBag size={22} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-black text-[#111827]">
                                {item.name}
                              </p>

                              <PromoPriceLine item={item} compact />

                              <p className="mt-1 text-xs font-bold text-[#6b7280]">
                                {formatMoney(getItemConfiguredUnitPrice(item))} / un.
                              </p>

                              {extrasSummary && (
                                <p className="mt-1 line-clamp-1 text-xs text-[#6b7280]">
                                  {extrasSummary}
                                </p>
                              )}

                              {item.observation && (
                                <p className="mt-1 line-clamp-1 text-xs font-bold text-amber-700">
                                  Obs: {item.observation}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-[#111827]">
                                {formatMoney(getItemTotal(item))}
                              </p>

                              <p className="mt-1 text-[10px] font-bold text-[#6b7280]">
                                Ver detalhes
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-[#F9FAFB] p-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleQuantity(item, quantity - 1)
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition hover:bg-white hover:text-red-600"
                              >
                                {quantity === 1 ? <FiTrash2 size={14} /> : <FiMinus size={14} />}
                              </button>

                              <span className="w-8 text-center text-sm font-black text-[#111827]">
                                {quantity}
                              </span>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleQuantity(item, quantity + 1)
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition hover:bg-white hover:text-[#f97316]"
                              >
                                <FiPlus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                removeFromCart(itemKey)
                              }}
                              className="text-xs font-black text-red-500 transition hover:text-red-700"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm('Deseja esvaziar o carrinho?')
                        if (!confirmed) return
                        clearCart()
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-100"
                    >
                      <FiTrash2 />
                      Esvaziar carrinho
                    </button>
                  </SectionCard>
            </>
              )}

              {step === 'checkout' && (
                <>
                  <SectionCard title="Seus dados" icon={FiUser}>
                    <InputField
                      label="Nome"
                      error={getFieldError('name')}
                      placeholder="Como podemos te chamar?"
                      value={customer.name}
                      onChange={(event) =>
                        setCustomer((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />

                    <InputField
                      label="WhatsApp"
                      error={getFieldError('phone')}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="(79) 99999-9999"
                      value={customer.phone}
                      onChange={(event) =>
                        setCustomer((prev) => ({
                          ...prev,
                          phone: formatPhoneInput(event.target.value),
                        }))
                      }
                    />
                  </SectionCard>

                  <section className="rounded-[1.5rem] border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F9FAFB] p-1">
                      <button
                        type="button"
                        onClick={() => setOrderType('delivery')}
                        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                          orderType === 'delivery'
                            ? 'bg-white text-[#f97316] shadow-sm'
                            : 'text-[#6b7280]'
                        }`}
                      >
                        <FiTruck />
                        Entrega
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderType('pickup')}
                        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                          orderType === 'pickup'
                            ? 'bg-white text-[#f97316] shadow-sm'
                            : 'text-[#6b7280]'
                        }`}
                      >
                        <FiHome />
                        Retirada
                      </button>
                    </div>
                  </section>

                  {orderType === 'delivery' && (
                    <SectionCard title="Endereço de entrega" icon={FiMapPin}>
                    <div>
  <div className="grid grid-cols-[1fr_auto] gap-2">
    <InputField
      label="CEP"
      error={getFieldError('cep')}
      type="tel"
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="49000-000"
      value={customer.cep}
      onChange={(event) => {
        const nextCep = formatCep(event.target.value)

        setCustomer((prev) => ({
          ...prev,
          cep: nextCep,
        }))

        setCepError('')
        setCepLookupStatus('idle')

        if (onlyDigits(nextCep).length === 8) {
          handleSearchCep(nextCep)
        }
      }}
      onBlur={(event) => handleSearchCep(event.target.value)}
    />

    <button
      type="button"
      onClick={() => handleSearchCep(customer.cep)}
      disabled={loadingCep || onlyDigits(customer.cep).length !== 8}
      className="mt-6 flex h-12 min-w-[92px] items-center justify-center rounded-2xl bg-[#111827] px-4 text-xs font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loadingCep ? <FiLoader className="animate-spin" /> : 'Buscar'}
    </button>
  </div>

  {cepError && (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600">
      <FiAlertCircle size={13} />
      {cepError}
    </p>
  )}

  {!cepError && customer.city && customer.state && (
    <p className="mt-1.5 text-xs font-bold text-[#6b7280]">
      {customer.city} - {customer.state}
    </p>
  )}

  {deliveryNeighborhoodList && (
    <p className="mt-2 text-xs font-bold leading-5 text-[#6b7280]">
      Entregamos apenas nos bairros: {deliveryNeighborhoodList}.
    </p>
  )}
</div>
                      {deliveryNeighborhoods.length > 0 ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                            Bairro
                          </label>

                          <select
                            value={customer.neighborhood}
                            aria-invalid={!!getFieldError('neighborhood')}
                            onChange={(event) => {
  const nextNeighborhood = event.target.value

  setCustomer((prev) => ({
    ...prev,
    neighborhood: nextNeighborhood,
  }))

  if (cepLookupStatus === 'unsupported') {
    setCepError(deliveryAreaMessage || 'Bairro fora da área de entrega.')
  } else if (
    customer.cepValidated &&
    customer.cepNeighborhood &&
    normalizeForMatch(customer.cepNeighborhood) !== normalizeForMatch(nextNeighborhood)
  ) {
    setCepError(
      `O bairro do CEP é ${customer.cepNeighborhood}. Para evitar erro na entrega, use o bairro retornado pelo CEP.`
    )
  } else {
    setCepError('')
  }
}}
                            className="h-12 w-full rounded-2xl border border-gray-100 bg-[#F9FAFB] px-4 text-sm font-medium text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                          >
                            <option value="">Selecione o bairro</option>
                            {deliveryNeighborhoods.map((item) => (
                              <option
                                key={item.neighborhood}
                                value={item.neighborhood}
                              >
                                {item.neighborhood} — {item.fee > 0 ? formatMoney(item.fee) : 'Grátis'}
                              </option>
                            ))}
                          </select>
                          {getFieldError('neighborhood') && (
                            <span className="mt-1.5 block text-xs font-semibold text-red-500">
                              {getFieldError('neighborhood')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <InputField
                          label="Bairro"
                          error={getFieldError('neighborhood')}
                          placeholder="Digite seu bairro"
                          value={customer.neighborhood}
                          onChange={(event) =>
                          setCustomer((prev) => ({
                            ...prev,
                            neighborhood: event.target.value,
                            cepValidated: prev.cep ? prev.cepValidated : false,
                          }))
                        }
                        />
                      )}

                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <InputField
                          label="Rua"
                          error={getFieldError('street')}
                          placeholder="Nome da rua"
                          value={customer.street}
                          onChange={(event) =>
                            setCustomer((prev) => ({
                              ...prev,
                              street: event.target.value,
                            }))
                          }
                        />

                        <InputField
  label="Número"
  error={getFieldError('number')}
  type="tel"
  inputMode="numeric"
  placeholder="123"
  value={customer.number}
  onChange={(event) =>
    setCustomer((prev) => ({
      ...prev,
      number: sanitizeAddressNumber(event.target.value),
    }))
  }
/>
                      </div>

                      <InputField
                        label="Complemento"
                        placeholder="Apto, bloco, casa..."
                        value={customer.complement}
                        onChange={(event) =>
                          setCustomer((prev) => ({
                            ...prev,
                            complement: event.target.value,
                          }))
                        }
                      />

                      <InputField
                        label="Ponto de referência"
                        placeholder="Ex: Próximo ao mercado"
                        value={customer.reference}
                        onChange={(event) =>
                          setCustomer((prev) => ({
                            ...prev,
                            reference: event.target.value,
                          }))
                        }
                      />

                      {customer.neighborhood && (
  <div
    className={`rounded-2xl border px-4 py-3 ${
      canUseDelivery
        ? 'border-orange-100 bg-orange-50'
        : 'border-red-100 bg-red-50'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span
        className={`text-xs font-black ${
          canUseDelivery ? 'text-[#f97316]' : 'text-red-600'
        }`}
      >
        {canUseDelivery ? 'Taxa de entrega' : 'Entrega indisponível'}
      </span>

      <span className="text-sm font-black text-[#111827]">
        {canUseDelivery ? formatMoney(deliveryFee) : 'Bairro fora da área'}
      </span>
    </div>

    {customer.cepNeighborhood && (
      <p className="mt-1 text-[11px] font-bold text-[#6b7280]">
        Bairro identificado: {customer.cepNeighborhood}
      </p>
    )}
  </div>
)}
                    </SectionCard>
                  )}

                  <SectionCard title="Pagamento" icon={FiCreditCard}>
                    {paymentOptions.length === 0 ? (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        Nenhuma forma de pagamento foi configurada pela loja.
                      </div>
                    ) : (
                      paymentOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(option.value)
                            setChangeFor('')
                          }}
                          className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                            paymentMethod === option.value
                              ? 'border-green-200 bg-orange-50'
                              : 'border-gray-100 bg-[#F9FAFB] hover:bg-white'
                          }`}
                        >
                          <span className="text-2xl">{option.icon}</span>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-[#111827]">
                              {option.label}
                            </p>

                            <p className="mt-0.5 text-xs text-[#6b7280]">
                              {option.description}
                            </p>
                          </div>

                          {paymentMethod === option.value && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f97316] text-white">
                              <FiCheck size={14} />
                            </div>
                          )}
                        </button>
                      ))
                    )}

                    {paymentMethod === 'cash' && (
                      <div className="space-y-3 rounded-2xl border border-gray-100 bg-[#F9FAFB] p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                          Troco para quanto?
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {['sem_troco', '50', '100', '200'].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setChangeFor(value)}
                              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                changeFor === value
                                  ? 'bg-[#f97316] text-white'
                                  : 'bg-white text-[#6b7280]'
                              }`}
                            >
                              {value === 'sem_troco'
                                ? 'Sem troco'
                                : formatMoney(Number(value))}
                            </button>
                          ))}
                        </div>

                        <InputField
                          placeholder="Ou digite outro valor"
                          value={['sem_troco', '50', '100', '200'].includes(changeFor) ? '' : changeFor}
                          onChange={(event) => setChangeFor(event.target.value)}
                        />
                      </div>
                    )}

                    {paymentMethod === 'pix_manual' && (
                      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                        <div className="flex gap-3">
                          <FiShield className="mt-0.5 shrink-0 text-[#f97316]" />

                          <div>
                            <p className="text-sm font-black text-[#111827]">
                              Pagamento via Pix
                            </p>

                            <p className="mt-1 text-xs font-bold leading-5 text-[#9a3412]">
                              Depois de enviar o pedido, você verá o Pix copia e cola na tela de acompanhamento.
                              A loja só iniciará o preparo após confirmar o pagamento.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard title="Cupom de desconto" icon={FiTag}>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                        <div>
                          <p className="text-sm font-black text-[#f97316]">
                            {appliedCoupon.code}
                          </p>

                          <p className="mt-0.5 text-xs font-bold text-orange-700">
                            Desconto de {formatMoney(discount)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCoupon(null)
                            setCouponError('')
                          }}
                          className="text-xs font-black text-red-600"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Código do cupom"
                            value={couponCode}
                            onChange={(event) => {
                              setCouponCode(event.target.value.toUpperCase())
                              setCouponError('')
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleApplyCoupon()
                            }}
                            className="h-12 min-w-0 flex-1 rounded-2xl border border-gray-100 bg-[#F9FAFB] px-4 text-sm font-black uppercase tracking-widest text-[#111827] outline-none transition placeholder:normal-case placeholder:font-medium placeholder:tracking-normal placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                          />

                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponCode.trim()}
                            className="flex h-12 items-center justify-center rounded-2xl bg-[#111827] px-4 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {couponLoading ? <FiLoader className="animate-spin" /> : 'Aplicar'}
                          </button>
                        </div>

                        {couponError && (
                          <p className="flex items-center gap-2 text-xs font-bold text-red-600">
                            <FiAlertCircle />
                            {couponError}
                          </p>
                        )}
                      </>
                    )}
                  </SectionCard>

                  <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
  <div className="mb-4 flex items-center justify-between gap-3">
    <p className="text-xs font-black uppercase tracking-wide text-[#6B7280]">
      Resumo do pedido
    </p>

    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-[#F97316]">
      {itemCount} item{itemCount !== 1 ? 's' : ''}
    </span>
  </div>

  <div className="space-y-3">
    {cartItems.map((item) => {
      const itemKey = getItemKey(item)
      const quantity = getItemQuantity(item)
      const unitPrice = getItemConfiguredUnitPrice(item)
      const itemTotal = getItemTotal(item)
      const optionsSummary = getItemOptionsSummary(item)
      const promo = getPromotionInfo(item)

      return (
        <div
          key={itemKey}
          className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-black text-[#111827]">
                {quantity}x {item.name}
              </p>

              {optionsSummary && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6B7280]">
                  {optionsSummary}
                </p>
              )}

              {item.observation && (
                <p className="mt-1 line-clamp-1 text-xs font-bold text-amber-700">
                  Obs: {item.observation}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {promo.oldPrice > promo.currentPrice && (
                  <span className="text-[11px] font-bold text-gray-400 line-through">
                    {formatMoney(promo.oldPrice + getItemExtrasTotal(item))}
                  </span>
                )}

                <span className="text-xs font-bold text-[#6B7280]">
                  {formatMoney(unitPrice)} / un.
                </span>

                {promo.active && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-600">
                    Promoção
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-[#111827]">
                {formatMoney(itemTotal)}
              </p>
            </div>
          </div>
        </div>
      )
    })}
  </div>

  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
    {hasPromotionSavings ? (
      <>
        <div className="flex justify-between text-sm text-[#6B7280]">
          <span>Itens sem promoção</span>
          <span>{formatMoney(subtotalWithoutPromotions)}</span>
        </div>

        <div className="flex justify-between text-sm font-bold text-[#F97316]">
          <span>Economia em promoções</span>
          <span>-{formatMoney(promotionSavings)}</span>
        </div>

        <div className="flex justify-between text-sm text-[#6B7280]">
          <span>Subtotal com promoções</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
      </>
    ) : (
      <div className="flex justify-between text-sm text-[#6B7280]">
        <span>Subtotal dos itens</span>
        <span>{formatMoney(subtotal)}</span>
      </div>
    )}

    {discount > 0 && (
      <div className="flex justify-between text-sm font-bold text-[#F97316]">
        <span>
          Cupom {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}
        </span>
        <span>-{formatMoney(discount)}</span>
      </div>
    )}

    {orderType === 'delivery' && (
      <div className="flex justify-between text-sm text-[#6B7280]">
        <span>Entrega</span>
        <span>
          {customer.neighborhood
            ? formatMoney(deliveryFee)
            : 'Selecione o bairro'}
        </span>
      </div>
    )}

    <div className="border-t border-gray-100 pt-3">
      <div className="flex justify-between text-lg font-black text-[#111827]">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>

      {(hasPromotionSavings || discount > 0) && (
        <p className="mt-1 text-right text-xs font-bold text-[#F97316]">
          Você economizou {formatMoney(promotionSavings + discount)}
        </p>
      )}
    </div>
  </div>
</div>

<div className="pb-2">
  {checkoutError && (
    <div
      data-error="true"
      className="mb-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700"
    >
      <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
      <span>{checkoutError}</span>
    </div>
  )}

  <button
    type="button"
    onClick={handleCheckout}
    disabled={
      isSubmitting ||
      !storeIsOpen ||
      loadingCep ||
      (orderType === 'delivery' && blockingCepError)
    }
    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-base font-black text-white transition hover:bg-[#ea580c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
  >
    {isSubmitting ? (
      <>
        <FiLoader className="animate-spin" />
        Enviando pedido...
      </>
    ) : loadingCep ? (
      <>
        <FiLoader className="animate-spin" />
        Validando CEP...
      </>
    ) : (
      <>
        <FiCheck />
        Enviar pedido · {formatMoney(total)}
      </>
    )}
  </button>

  {orderType === 'delivery' && cepError && (
    <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-black text-red-600">
      <FiAlertCircle size={14} />
      {cepError}
    </p>
  )}

  {orderType === 'delivery' &&
    deliveryNeighborhoods.length > 0 &&
    !cepError &&
    !customer.cepValidated &&
    !customer.neighborhood && (
      <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-bold text-[#6b7280]">
        <FiMapPin size={14} />
        Informe e busque o CEP para confirmar a entrega.
      </p>
    )}

  {!cepError && (
    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-[#6b7280]">
      <FiClock />
      O pedido será enviado para a loja em tempo real.
    </div>
  )}
</div>
                </>
              )}
            </div>

            {step === 'cart' && (
              <footer className="shrink-0 border-t border-gray-100 bg-white p-4 shadow-2xl">
                {belowMinimum && (
                  <div className="mb-3 flex gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <FiAlertCircle className="mt-0.5 shrink-0 text-amber-600" />

                    <p className="text-xs font-bold leading-5 text-amber-700">
                      Adicione mais {formatMoney(missingForMin)} para atingir o pedido mínimo.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  disabled={belowMinimum || !storeIsOpen}
                  className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-base font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: belowMinimum || !storeIsOpen ? '#9ca3af' : themeColor,
                  }}
                >
                  <span className="rounded-xl bg-white/20 px-2 py-1 text-sm">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>

                  <span>Continuar</span>

                  <span>{formatMoney(subtotal)}</span>
                </button>
              </footer>
            )}
          </>
        )}

        <CartItemDetailsModal
          item={selectedCartItem}
          onClose={() => setSelectedCartItem(null)}
          onQuantityChange={handleQuantity}
          onRemove={handleRemoveCartItem}
          onUpdateObservation={handleUpdateItemObservation}
        />
      </motion.aside>
    </div>
  )
}

