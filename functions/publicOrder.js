const crypto = require('crypto')
const { normalizeBrazilianPhone } = require('./shared/phone')
const { buildOrderSchedulingDecision } = require('./shared/orderScheduling')
const {
  buildAsaasLinkCreationFailurePatch,
  buildAsaasPendingPaymentSnapshot,
  createOrderPaymentLink,
  isAsaasOnlineActive,
  isAsaasOnlinePaymentRequest,
  orderRequiresAsaasOnline,
} = require('./shared/asaasOrders')
const {
  buildMercadoPagoPendingPaymentSnapshot,
  buildMercadoPagoPreferenceFailurePatch,
  createMercadoPagoPreference,
  isMercadoPagoOnlineActive,
  isMercadoPagoOnlinePaymentRequest,
  orderRequiresMercadoPagoOnline,
} = require('./shared/mercadoPagoOrders')
const { hasPlanFeature } = require('./shared/planAccess')

class PublicOrderError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const DEFAULT_SCHEDULED_SLOT_CAPACITY = 20
const MAX_SCHEDULED_SLOT_CAPACITY = 500

function fail(code, message) {
  throw new PublicOrderError(code, message)
}

function isLegacyAsaasOrdersEnabled() {
  return process.env.ENABLE_LEGACY_ASAAS_ORDERS === 'true'
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function toCents(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed)
}

function moneyToCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100)

  let cleaned = String(value || '').trim().replace(/[^\d,.-]/g, '')
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}

function centsToMoney(cents) {
  return Math.round(Number(cents || 0)) / 100
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function firstFilled(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
}

function uniqueArray(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeForMatch(value) {
  return normalizeText(value)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function sanitizeText(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength)
}

function sanitizeAddressNumber(value) {
  return onlyDigits(value).slice(0, 6)
}

function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function getDeliveryNeighborhoodAliases(name, value) {
  const aliases = [name]

  if (value && typeof value === 'object') {
    aliases.push(value.name, value.neighborhood)
    if (Array.isArray(value.aliases)) aliases.push(...value.aliases)
  }

  return uniqueArray(aliases)
}

function matchesNeighborhoodAlias(item, neighborhood) {
  const normalizedNeighborhood = normalizeForMatch(neighborhood)
  if (!normalizedNeighborhood) return false

  return (item.aliases || []).some((alias) => normalizeForMatch(alias) === normalizedNeighborhood)
}

function getPriceCents(data) {
  if (!data) return 0
  if (hasValue(data.priceCents)) return toCents(data.priceCents)
  if (hasValue(data.priceInCents)) return toCents(data.priceInCents)
  if (hasValue(data.price)) return moneyToCents(data.price)
  if (hasValue(data.valueCents)) return toCents(data.valueCents)
  if (hasValue(data.value)) return moneyToCents(data.value)
  return 0
}

function firstPriceCents(source, centsFields, moneyFields) {
  for (const field of centsFields) {
    if (hasValue(source?.[field])) return toCents(source[field])
  }

  for (const field of moneyFields) {
    if (hasValue(source?.[field])) return moneyToCents(source[field])
  }

  return null
}

function getProductBasePriceCents(product) {
  const promotionPrice = product?.promotion?.active
    ? firstPriceCents(product.promotion, ['currentPriceCents'], ['currentPrice'])
    : null

  if (promotionPrice !== null) return promotionPrice

  return firstPriceCents(
    product,
    ['promotionalPriceCents', 'salePriceCents', 'currentPriceCents', 'priceCents', 'priceInCents'],
    ['promotionalPrice', 'salePrice', 'currentPrice', 'price']
  ) ?? 0
}

function getProductOldPriceCents(product) {
  const promotionOldPrice = product?.promotion?.active
    ? firstPriceCents(product.promotion, ['oldPriceCents'], ['oldPrice'])
    : null

  if (promotionOldPrice !== null) return promotionOldPrice

  return firstPriceCents(
    product,
    ['oldPriceCents', 'compareAtPriceCents', 'originalPriceCents'],
    ['oldPrice', 'compareAtPrice', 'originalPrice']
  )
}

function getQuantity(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1)
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.min(Math.floor(quantity), 99))
}

function getProductId(item) {
  return String(
    item?.productId ||
      item?.originalProductId ||
      item?.id ||
      item?.product?.id ||
      item?.itemId ||
      ''
  ).trim()
}

function getStoreDocId(store) {
  return String(store?.id || store?.docId || store?.storeId || '').trim()
}

function getStoreSlug(store) {
  return String(store?.storeSlug || store?.slug || '').trim()
}

function getStoreKeys(store) {
  const storeId = getStoreDocId(store)
  const storeSlug = getStoreSlug(store)

  return uniqueArray([
    storeId,
    storeSlug,
    store?.storeId,
    store?.docId,
    store?.id,
    store?.slug,
    store?.storeSlug,
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
  ])
}

function isPublicStoreActive(store) {
  return Boolean(store)
    && store.isActive !== false
    && store.isBlocked !== true
    && store.isDeleted !== true
    && !store.deletedAt
    && store.isPublic !== false
    && store.public !== false
    && store.isVisible !== false
    && store.hidden !== true
    && store.isOpen !== false
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis())
  if (value.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getBillingGraceEndsAt(store) {
  return toDate(store?.billingGraceEndsAt || store?.pastDueGraceEndsAt || store?.paymentGraceEndsAt)
}

function getStoreSubscriptionStatus(store) {
  const status = String(store?.subscriptionStatus || store?.subscription?.status || '').trim()
  return status === 'pending_checkout' || status === 'billing_pending' ? 'checkout_pending' : status
}

function isFutureDate(value) {
  const date = toDate(value)
  return Boolean(date && date.getTime() > Date.now())
}

function assertStoreBillingAllowsPublicOrder(store, logger) {
  const storeId = getStoreDocId(store)
  const subscriptionStatus = getStoreSubscriptionStatus(store)

  if (store?.isBillingBlocked === true) {
    logger.warn('createPublicOrder blocked by explicit billing block', { storeId, subscriptionStatus })
    fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
  }

  if (subscriptionStatus === 'blocked' || subscriptionStatus === 'canceled') {
    logger.warn('createPublicOrder blocked by subscription status', { storeId, subscriptionStatus })
    fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
  }

  if (subscriptionStatus === 'trialing') {
    if (isFutureDate(store?.trialEndsAt || store?.subscription?.trialEndsAt)) return

    logger.warn('createPublicOrder blocked by expired trial', {
      storeId,
      subscriptionStatus,
      hasAsaasSubscription: Boolean(store?.asaasSubscriptionId || store?.subscription?.providerSubscriptionId),
    })
    fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
  }

  if (subscriptionStatus === 'active') return

  if (subscriptionStatus === 'checkout_pending' || subscriptionStatus === 'billing_pending_payment_method') {
    logger.warn('createPublicOrder blocked by checkout pending billing', { storeId, subscriptionStatus })
    fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
  }

  if (subscriptionStatus === 'past_due') {
    const graceEndsAt = getBillingGraceEndsAt(store)

    if (!graceEndsAt) {
      logger.warn('createPublicOrder blocked by past_due without grace period', {
        storeId,
        subscriptionStatus,
      })
      fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
    }

    if (graceEndsAt.getTime() <= Date.now()) {
      logger.warn('createPublicOrder blocked by expired past_due grace period', {
        storeId,
        subscriptionStatus,
        graceEndsAt: graceEndsAt.toISOString(),
      })
      fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
    }

    logger.warn('createPublicOrder allowed with past_due grace period', {
      storeId,
      subscriptionStatus,
      graceEndsAt: graceEndsAt.toISOString(),
    })
    return
  }

  if (!subscriptionStatus) {
    logger.warn('createPublicOrder allowed for legacy store without subscriptionStatus', { storeId })
    return
  }

  logger.warn('createPublicOrder blocked by unknown subscription status', {
    storeId,
    subscriptionStatus,
  })

  fail('failed-precondition', 'Esta loja esta temporariamente indisponivel para receber pedidos.')
}

async function findStoreForPublicOrder(db, input) {
  const candidates = uniqueArray([input.storeId, input.storeSlug, input.storeDocId])

  for (const key of candidates) {
    const snap = await db.collection('stores').doc(key).get()
    if (snap.exists) return { id: snap.id, ...snap.data() }
  }

  for (const key of candidates) {
    const byStoreId = await db.collection('stores').where('storeId', '==', key).limit(1).get()
    if (!byStoreId.empty) {
      const doc = byStoreId.docs[0]
      return { id: doc.id, ...doc.data() }
    }

    const byStoreSlug = await db.collection('stores').where('storeSlug', '==', key).limit(1).get()
    if (!byStoreSlug.empty) {
      const doc = byStoreSlug.docs[0]
      return { id: doc.id, ...doc.data() }
    }

    const bySlug = await db.collection('stores').where('slug', '==', key).limit(1).get()
    if (!bySlug.empty) {
      const doc = bySlug.docs[0]
      return { id: doc.id, ...doc.data() }
    }
  }

  return null
}

async function incrementPublicOrderAttemptLimit({ db, admin, storeDocId, phoneHash, ipHash }) {
  const nowMs = Date.now()
  const windowMs = 10 * 60 * 1000
  const phoneLimit = 10
  const ipLimit = 20

  await db.runTransaction(async (transaction) => {
    const phoneAttemptRef = db.collection('rateLimits').doc(`createPublicOrder_attempt_${storeDocId}_${phoneHash}`)
    const phoneAttemptSnap = await transaction.get(phoneAttemptRef)
    const ipAttemptRef = ipHash
      ? db.collection('rateLimits').doc(`createPublicOrder_attempt_ip_${storeDocId}_${ipHash}`)
      : null
    const ipAttemptSnap = ipAttemptRef ? await transaction.get(ipAttemptRef) : null

    const phoneData = phoneAttemptSnap.exists ? phoneAttemptSnap.data() : null
    let phoneCount = 1
    let phoneWindowStart = admin.firestore.Timestamp.fromMillis(nowMs)

    if (phoneData) {
      const windowStartMs = phoneData.windowStart?.toMillis?.() || 0
      if (nowMs - windowStartMs < windowMs) {
        if ((phoneData.count || 0) >= phoneLimit) {
          fail('resource-exhausted', 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
        }
        phoneCount = (phoneData.count || 0) + 1
        phoneWindowStart = phoneData.windowStart
      }
    }

    transaction.set(phoneAttemptRef, {
      count: phoneCount,
      limit: phoneLimit,
      windowSeconds: Math.floor(windowMs / 1000),
      windowStart: phoneWindowStart,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    if (!ipAttemptRef) return

    const ipData = ipAttemptSnap.exists ? ipAttemptSnap.data() : null
    let ipCount = 1
    let ipWindowStart = admin.firestore.Timestamp.fromMillis(nowMs)

    if (ipData) {
      const ipWindowStartMs = ipData.windowStart?.toMillis?.() || 0
      if (nowMs - ipWindowStartMs < windowMs) {
        if ((ipData.count || 0) >= ipLimit) {
          fail('resource-exhausted', 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
        }
        ipCount = (ipData.count || 0) + 1
        ipWindowStart = ipData.windowStart
      }
    }

    transaction.set(ipAttemptRef, {
      count: ipCount,
      limit: ipLimit,
      windowSeconds: Math.floor(windowMs / 1000),
      windowStart: ipWindowStart,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  })
}

function productBelongsToStore(product, storeKeys) {
  const productStoreKeys = uniqueArray([
    product?.storeId,
    product?.storeSlug,
    product?.storeDocId,
    product?.store?.id,
    ...(Array.isArray(product?.storeKeys) ? product.storeKeys : []),
  ])

  return productStoreKeys.some((key) => storeKeys.includes(key))
}

function productIsOrderable(product) {
  if (!product) return false
  if (product.isDeleted === true || product.deletedAt) return false
  if (product.isVisible === false || product.hidden === true) return false
  if (product.isActive === false || product.active === false) return false
  if (product.paused === true) return false
  if (product.isAvailable === false || product.available === false) return false

  const stock = product.stock
  if (stock !== undefined && stock !== null && stock !== '' && Number(stock) <= 0) return false

  return true
}

function productAcceptsCoupons(product) {
  if (product?.acceptsCoupons !== undefined) return product.acceptsCoupons !== false
  if (product?.acceptsCoupon !== undefined) return product.acceptsCoupon !== false
  if (product?.couponEligible !== undefined) return product.couponEligible !== false
  return true
}

async function getProduct(db, productId, storeKeys) {
  const directSnap = await db.collection('products').doc(productId).get()

  if (directSnap.exists) {
    const product = { id: directSnap.id, ...directSnap.data() }
    if (productBelongsToStore(product, storeKeys)) return product
  }

  for (const storeKey of storeKeys.slice(0, 10)) {
    const byStoreSnap = await db
      .collection('products')
      .where('storeId', '==', storeKey)
      .where('id', '==', productId)
      .limit(1)
      .get()

    if (!byStoreSnap.empty) {
      const doc = byStoreSnap.docs[0]
      return { id: doc.id, ...doc.data() }
    }
  }

  return null
}

function getOptionKey(option, fallback = '') {
  return String(option?.id || option?.optionId || option?.extraId || option?.name || fallback || '').trim()
}

function getGroupKey(group, fallback = '') {
  return String(group?.id || group?.groupId || group?.name || group?.title || fallback || '').trim()
}

function getProductOptionGroups(product) {
  const rawGroups = Array.isArray(product?.optionGroups) ? product.optionGroups
    : Array.isArray(product?.optionsGroups) ? product.optionsGroups
    : Array.isArray(product?.customizationGroups) ? product.customizationGroups
    : []

  return rawGroups
    .map((group, index) => {
      const rawType = String(group?.type || '').toLowerCase()
      const allowQuantity = group?.allowQuantity === true || group?.quantityEnabled === true || rawType === 'quantity' || rawType === 'qty'
      const type = ['single', 'multiple', 'quantity'].includes(rawType) ? rawType : allowQuantity ? 'quantity' : 'multiple'
      const required = Boolean(group?.required || group?.isRequired || Number(group?.min || group?.minSelections || 0) > 0)
      const min = Math.max(0, Math.floor(Number(group?.min ?? group?.minSelections ?? (required ? 1 : 0)) || 0))
      const max = type === 'single'
        ? 1
        : Math.max(0, Math.floor(Number(group?.max ?? group?.maxSelections ?? 0) || 0))

      const options = (Array.isArray(group?.options) ? group.options : [])
        .map((option, optionIndex) => {
          const name = sanitizeText(option?.name || option?.title, 120)
          const id = getOptionKey(option, `option-${optionIndex}`)
          return {
            id,
            optionId: id,
            name,
            lookupName: normalizeForMatch(name),
            description: sanitizeText(option?.description || option?.details, 300),
            unitPriceCents: getPriceCents(option),
            available: option?.available !== false && option?.isAvailable !== false,
          }
        })
        .filter((option) => option.name)

      const groupId = getGroupKey(group, `group-${index}`)
      const title = sanitizeText(group?.title || group?.name || `Opcao ${index + 1}`, 120)

      return {
        id: groupId,
        groupId,
        title,
        name: sanitizeText(group?.name || title, 120),
        required,
        min,
        max,
        type,
        allowQuantity: type === 'quantity' || allowQuantity,
        pricingMode: group?.pricingMode || group?.priceMode || 'additive',
        includedQuantity: Math.max(0, Math.floor(Number(group?.includedQuantity ?? (min > 0 ? min : 1)) || 0)),
        options,
      }
    })
    .filter((group) => group.options.length > 0)
}

function getProductExtras(product) {
  const rawExtras = []
  if (Array.isArray(product?.extras)) rawExtras.push(...product.extras)
  if (Array.isArray(product?.addons)) rawExtras.push(...product.addons)
  if (Array.isArray(product?.additionals)) rawExtras.push(...product.additionals)

  return rawExtras
    .map((extra, index) => {
      const name = sanitizeText(extra?.name || extra?.title, 120)
      const id = getOptionKey(extra, `extra-${index}`)
      return {
        id,
        optionId: id,
        name,
        lookupName: normalizeForMatch(name),
        description: sanitizeText(extra?.description || extra?.details, 300),
        unitPriceCents: getPriceCents(extra),
        available: extra?.available !== false && extra?.isAvailable !== false,
      }
    })
    .filter((extra) => extra.name)
}

function getSelectedQuantity(option) {
  const quantity = Number(option?.quantity ?? option?.qty ?? option?.selectedQuantity ?? 1)
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.min(Math.floor(quantity), 99))
}

function getSelectedGroups(item) {
  const groups = Array.isArray(item?.selectedOptionGroups) ? item.selectedOptionGroups
    : Array.isArray(item?.optionGroupsSnapshot) ? item.optionGroupsSnapshot
    : []

  const map = new Map()

  groups.forEach((group) => {
    const groupKeys = uniqueArray([group?.groupId, group?.id, group?.title, group?.name])
    const options = Array.isArray(group?.options) ? group.options : []
    groupKeys.forEach((key) => map.set(normalizeForMatch(key), options))
  })

  const flatOptions = []
  if (Array.isArray(item?.selectedOptions)) flatOptions.push(...item.selectedOptions)
  if (Array.isArray(item?.selectedOptionsFlat)) flatOptions.push(...item.selectedOptionsFlat)

  flatOptions.forEach((option) => {
    const groupKey = normalizeForMatch(option?.groupId || option?.groupTitle || option?.groupName || option?.title)
    if (!groupKey) return
    const current = map.get(groupKey) || []
    current.push(option)
    map.set(groupKey, current)
  })

  return map
}

function findSelectedOptionMatch(productOption, selectedOptions) {
  return selectedOptions.find((selected) => {
    const selectedId = getOptionKey(selected)
    if (selectedId && selectedId === productOption.id) return true
    return normalizeForMatch(selected?.name || selected?.title) === productOption.lookupName
  })
}

function buildOptionCalculations(item, product) {
  const productGroups = getProductOptionGroups(product)
  const selectedGroups = getSelectedGroups(item)
  const groupSnapshots = []
  const flatOptions = []
  let totalCents = 0

  productGroups.forEach((group) => {
    const selectedOptions =
      selectedGroups.get(normalizeForMatch(group.id)) ||
      selectedGroups.get(normalizeForMatch(group.title)) ||
      []

    const selectedMatches = []

    group.options.forEach((productOption) => {
      const selected = findSelectedOptionMatch(productOption, selectedOptions)
      if (!selected) return

      if (!productOption.available) fail('failed-precondition', `Opcao indisponivel: ${productOption.name}`)

      selectedMatches.push({
        ...productOption,
        quantity: getSelectedQuantity(selected),
      })
    })

    const selectedQuantity = selectedMatches.reduce((acc, option) => acc + option.quantity, 0)

    if (group.min > 0 && selectedQuantity < group.min) {
      fail('failed-precondition', `Escolha obrigatoria ausente: ${group.title}`)
    }

    if (group.max > 0 && selectedQuantity > group.max) {
      fail('failed-precondition', `Limite de opcoes excedido: ${group.title}`)
    }

    if (!selectedMatches.length) return

    const includedMode = ['included', 'included_first', 'first_included', 'firstIncluded'].includes(group.pricingMode)
    let includedRemaining = includedMode ? Number(group.includedQuantity || group.min || 1) : 0

    const options = selectedMatches.map((option) => {
      const includedQuantity = includedMode ? Math.min(option.quantity, Math.max(0, includedRemaining)) : 0
      includedRemaining = Math.max(0, includedRemaining - includedQuantity)
      const chargedQuantity = Math.max(0, option.quantity - includedQuantity)
      const optionTotalCents = option.unitPriceCents * chargedQuantity
      totalCents += optionTotalCents

      return {
        id: option.id,
        optionId: option.id,
        name: option.name,
        description: option.description || '',
        groupId: group.id,
        groupTitle: group.title,
        quantity: option.quantity,
        includedQuantity,
        chargedQuantity,
        unitPrice: centsToMoney(option.unitPriceCents),
        unitPriceCents: option.unitPriceCents,
        total: centsToMoney(optionTotalCents),
        totalCents: optionTotalCents,
        price: centsToMoney(optionTotalCents),
        priceCents: optionTotalCents,
        type: 'option',
      }
    })

    flatOptions.push(...options)
    groupSnapshots.push({
      groupId: group.id,
      id: group.id,
      groupTitle: group.title,
      title: group.title,
      name: group.name,
      required: group.required,
      min: group.min,
      max: group.max,
      type: group.type,
      allowQuantity: group.allowQuantity,
      pricingMode: group.pricingMode,
      options,
    })
  })

  return { totalCents, groupSnapshots, flatOptions }
}

function getSelectedAddons(item) {
  const values = []
  if (Array.isArray(item?.addons)) values.push(...item.addons)
  if (Array.isArray(item?.extras)) {
    values.push(...item.extras.filter((extra) => extra?.type !== 'option' && !extra?.groupId && !extra?.groupTitle))
  }
  if (Array.isArray(item?.additionals)) values.push(...item.additionals)
  return values
}

function buildAddonCalculations(item, product) {
  const productExtras = getProductExtras(product)
  const selectedAddons = getSelectedAddons(item)
  const addonSnapshots = []
  let totalCents = 0

  selectedAddons.forEach((selected) => {
    const selectedId = getOptionKey(selected)
    const selectedName = normalizeForMatch(selected?.name || selected?.title)
    const match = productExtras.find((extra) => {
      if (selectedId && selectedId === extra.id) return true
      return selectedName && selectedName === extra.lookupName
    })

    if (!match) fail('failed-precondition', `Adicional invalido: ${sanitizeText(selected?.name || selectedId, 80)}`)
    if (!match.available) fail('failed-precondition', `Adicional indisponivel: ${match.name}`)

    const quantity = getSelectedQuantity(selected)
    const addonTotalCents = match.unitPriceCents * quantity
    totalCents += addonTotalCents

    addonSnapshots.push({
      id: match.id,
      optionId: match.id,
      name: match.name,
      description: match.description || '',
      quantity,
      unitPrice: centsToMoney(match.unitPriceCents),
      unitPriceCents: match.unitPriceCents,
      price: centsToMoney(addonTotalCents),
      priceCents: addonTotalCents,
      total: centsToMoney(addonTotalCents),
      totalCents: addonTotalCents,
      type: 'extra',
    })
  })

  return { totalCents, addonSnapshots }
}

function buildOptionsSummary(optionGroups, addons) {
  const optionText = optionGroups.flatMap((group) =>
    group.options.map((option) => `${option.quantity > 1 ? `${option.quantity}x ` : ''}${option.name}`)
  )
  const addonText = addons.map((addon) => `+ ${addon.quantity > 1 ? `${addon.quantity}x ` : ''}${addon.name}`)
  return [...optionText, ...addonText].join(', ')
}

function sanitizeOrderInputItems(rawItems) {
  if (!Array.isArray(rawItems)) return []

  return rawItems.slice(0, 80).map((item) => ({
    productId: getProductId(item),
    quantity: getQuantity(item),
    observation: sanitizeText(item?.observation || item?.itemObservation, 500),
    selectedOptionGroups: Array.isArray(item?.selectedOptionGroups) ? item.selectedOptionGroups : [],
    optionGroupsSnapshot: Array.isArray(item?.optionGroupsSnapshot) ? item.optionGroupsSnapshot : [],
    selectedOptions: Array.isArray(item?.selectedOptions) ? item.selectedOptions : [],
    selectedOptionsFlat: Array.isArray(item?.selectedOptionsFlat) ? item.selectedOptionsFlat : [],
    addons: Array.isArray(item?.addons) ? item.addons : [],
    extras: Array.isArray(item?.extras) ? item.extras : [],
    additionals: Array.isArray(item?.additionals) ? item.additionals : [],
  })).filter((item) => item.productId)
}

async function buildServerOrderItems(db, rawItems, storeKeys) {
  const inputItems = sanitizeOrderInputItems(rawItems)
  if (!inputItems.length) fail('invalid-argument', 'Pedido sem itens validos.')

  let subtotalCents = 0
  const items = []
  const schedulingProducts = []

  for (const item of inputItems) {
    const product = await getProduct(db, item.productId, storeKeys)

    if (!product || !productBelongsToStore(product, storeKeys)) {
      fail('failed-precondition', 'Produto nao pertence a loja.')
    }

    if (!productIsOrderable(product)) {
      fail('failed-precondition', `Produto indisponivel: ${product.name || item.productId}`)
    }

    const basePriceCents = getProductBasePriceCents(product)
    if (basePriceCents < 0) fail('failed-precondition', `Preco invalido: ${product.name || item.productId}`)

    const options = buildOptionCalculations(item, product)
    const addons = buildAddonCalculations(item, product)
    const optionsTotalCents = options.totalCents + addons.totalCents
    const unitPriceCents = basePriceCents + optionsTotalCents
    const totalCents = unitPriceCents * item.quantity
    subtotalCents += totalCents

    const optionGroupsSnapshot = options.groupSnapshots
    const selectedOptionsFlat = options.flatOptions
    const extras = [...addons.addonSnapshots, ...selectedOptionsFlat]
    const optionsSummary = buildOptionsSummary(optionGroupsSnapshot, addons.addonSnapshots)
    const oldPriceCents = getProductOldPriceCents(product)
    const acceptsCoupons = productAcceptsCoupons(product)

    schedulingProducts.push({
      productId: product.id,
      name: sanitizeText(product.name || 'Produto', 160),
      scheduling: product.scheduling,
    })

    items.push({
      id: product.id,
      productId: product.id,
      originalProductId: product.id,
      cartItemId: `${product.id}-${items.length}`,
      name: sanitizeText(product.name || 'Produto', 160),
      description: sanitizeText(product.description, 500),
      quantity: item.quantity,
      price: centsToMoney(basePriceCents),
      priceCents: basePriceCents,
      basePrice: centsToMoney(basePriceCents),
      basePriceCents,
      unitPrice: centsToMoney(unitPriceCents),
      unitPriceCents,
      oldPrice: oldPriceCents !== null ? centsToMoney(oldPriceCents) : null,
      oldPriceCents,
      imageUrl: product.imageUrl || product.image || product.photoUrl || null,
      observation: item.observation,
      itemObservation: item.observation,
      extras,
      selectedOptions: selectedOptionsFlat,
      selectedOptionsFlat,
      selectedOptionGroups: optionGroupsSnapshot,
      optionGroupsSnapshot,
      optionsSummary,
      acceptsCoupons,
      couponEligible: acceptsCoupons,
      isPromotion: Boolean(product.isPromotion),
      total: centsToMoney(totalCents),
      totalCents,
    })
  }

  return { items, subtotalCents, schedulingProducts }
}

function buildFirestoreSchedulingFields(admin, decision) {
  const toTimestamp = (value) => value ? admin.firestore.Timestamp.fromDate(value) : null

  return {
    orderTiming: decision.orderTiming,
    scheduledFor: toTimestamp(decision.scheduledFor),
    scheduledWindowStart: toTimestamp(decision.scheduledWindowStart),
    scheduledWindowEnd: toTimestamp(decision.scheduledWindowEnd),
    scheduledDateKey: decision.scheduledDateKey,
    scheduledTimeLabel: decision.scheduledTimeLabel,
    scheduledSlotKey: decision.scheduledSlotKey,
    schedulingSnapshot: decision.schedulingSnapshot,
    paymentPolicy: decision.paymentPolicy,
    paymentPolicyReason: decision.paymentPolicyReason,
  }
}

function getScheduledSlotCapacity(store) {
  const candidates = [
    store?.scheduling?.maxOrdersPerSlot,
    store?.scheduling?.slotCapacity,
    store?.maxScheduledOrdersPerSlot,
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)
    if (!Number.isFinite(value) || value <= 0) continue
    return Math.max(1, Math.min(MAX_SCHEDULED_SLOT_CAPACITY, Math.floor(value)))
  }

  return DEFAULT_SCHEDULED_SLOT_CAPACITY
}

async function reserveScheduledSlotInTransaction({
  db,
  admin,
  transaction,
  store,
  storeId,
  orderRef,
  schedulingDecision,
}) {
  if (schedulingDecision?.orderTiming !== 'scheduled' || !schedulingDecision.scheduledSlotKey) return null

  const slotRef = db.collection('scheduledOrderSlots').doc(schedulingDecision.scheduledSlotKey)
  const slotSnapshot = await transaction.get(slotRef)
  const slotData = slotSnapshot.exists ? slotSnapshot.data() || {} : {}
  const activeOrderCount = Number(slotData.activeOrderCount || 0)
  const capacity = getScheduledSlotCapacity(store)

  if (activeOrderCount >= capacity) {
    fail('failed-precondition', 'Este horario acabou de lotar. Escolha outro horario.')
  }

  transaction.set(slotRef, {
    storeId,
    slotKey: schedulingDecision.scheduledSlotKey,
    scheduledDateKey: schedulingDecision.scheduledDateKey,
    scheduledTimeLabel: schedulingDecision.scheduledTimeLabel,
    deliveryType: String(schedulingDecision.scheduledSlotKey || '').split('_').pop() || '',
    capacity,
    activeOrderCount: admin.firestore.FieldValue.increment(1),
    orderIds: admin.firestore.FieldValue.arrayUnion(orderRef.id),
    scheduledFor: schedulingDecision.scheduledFor
      ? admin.firestore.Timestamp.fromDate(schedulingDecision.scheduledFor)
      : null,
    scheduledWindowEnd: schedulingDecision.scheduledWindowEnd
      ? admin.firestore.Timestamp.fromDate(schedulingDecision.scheduledWindowEnd)
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(slotSnapshot.exists ? {} : {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
  }, { merge: true })

  return slotRef
}

async function releaseScheduledSlotInTransaction({
  db,
  admin,
  transaction,
  orderRef,
  orderData,
  reason,
}) {
  const scheduledSlotKey = String(orderData?.scheduledSlotKey || '').trim()
  if (!scheduledSlotKey || orderData?.scheduledSlotReleasedAt) return {}

  const slotRef = db.collection('scheduledOrderSlots').doc(scheduledSlotKey)
  const slotSnapshot = await transaction.get(slotRef)

  if (slotSnapshot.exists) {
    const currentCount = Number(slotSnapshot.data()?.activeOrderCount || 0)
    transaction.set(slotRef, {
      activeOrderCount: Math.max(0, currentCount - 1),
      orderIds: admin.firestore.FieldValue.arrayRemove(orderRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  return {
    scheduledSlotReleasedAt: admin.firestore.FieldValue.serverTimestamp(),
    scheduledSlotReleaseReason: String(reason || 'payment_failed').slice(0, 80),
  }
}

function couponDateToMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value.seconds) return Number(value.seconds) * 1000
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function getCouponMoneyCents(coupon, centsField, moneyField) {
  if (hasValue(coupon?.[centsField])) return toCents(coupon[centsField])
  if (hasValue(coupon?.[moneyField])) return moneyToCents(coupon[moneyField])
  return 0
}

function couponAppliesToOrderItem(coupon, item) {
  if (!item.acceptsCoupons) return false

  const appliesTo = coupon.appliesTo || 'all'
  const productIds = Array.isArray(coupon.productIds) ? coupon.productIds.map((id) => String(id)) : []

  if (coupon.targetId && coupon.targetId !== 'all') {
    return item.productId === coupon.targetId || item.id === coupon.targetId
  }

  if (appliesTo === 'includeProducts') return productIds.includes(item.productId) || productIds.includes(item.id)
  if (appliesTo === 'excludeProducts') return !productIds.includes(item.productId) && !productIds.includes(item.id)
  return true
}

async function findCouponInTransaction(db, transaction, store, couponCode) {
  const code = String(couponCode || '').trim().toUpperCase()
  if (!code) return null

  for (const storeKey of getStoreKeys(store).slice(0, 10)) {
    const snap = await transaction.get(
      db.collection('coupons')
        .where('storeId', '==', storeKey)
        .where('code', '==', code)
        .limit(1)
    )

    if (!snap.empty) {
      const doc = snap.docs[0]
      return { ref: doc.ref, id: doc.id, data: doc.data() || {} }
    }
  }

  return null
}

function calculateCouponDiscount({ coupon, items, subtotalCents }) {
  const now = Date.now()
  const startsAt = couponDateToMillis(coupon.startsAt)
  const expiresAt = couponDateToMillis(coupon.expiresAt)

  if (coupon.isDeleted === true || coupon.deletedAt || coupon.active === false) {
    fail('failed-precondition', 'Cupom inativo ou excluido.')
  }

  if (startsAt && now < startsAt) fail('failed-precondition', 'Cupom ainda nao esta vigente.')
  if (expiresAt && now > expiresAt) fail('failed-precondition', 'Cupom expirado.')

  const eligibleSubtotalCents = items
    .filter((item) => couponAppliesToOrderItem(coupon, item))
    .reduce((acc, item) => acc + toCents(item.totalCents), 0)

  if (eligibleSubtotalCents <= 0) {
    fail('failed-precondition', 'Cupom nao se aplica aos itens do carrinho.')
  }

  const minOrderCents = getCouponMoneyCents(coupon, 'minOrderCents', 'minOrder')
  if (minOrderCents > 0 && eligibleSubtotalCents < minOrderCents) {
    fail('failed-precondition', 'Subtotal elegivel abaixo do pedido minimo do cupom.')
  }

  let discountCents = 0
  const type = coupon.type === 'fixed' ? 'fixed' : 'percent'

  if (type === 'percent') {
    const percent = Math.max(0, Number(coupon.value || 0))
    discountCents = Math.round(eligibleSubtotalCents * (percent / 100))
    const maxDiscountCents = getCouponMoneyCents(coupon, 'maxDiscountCents', 'maxDiscount')
    if (maxDiscountCents > 0) discountCents = Math.min(discountCents, maxDiscountCents)
  } else {
    discountCents = getCouponMoneyCents(coupon, 'valueCents', 'value')
  }

  discountCents = Math.min(Math.max(0, discountCents), eligibleSubtotalCents, subtotalCents)
  if (discountCents <= 0) fail('failed-precondition', 'Cupom sem desconto aplicavel.')

  return { type, eligibleSubtotalCents, discountCents }
}

function getDeliveryFeeCents({ store, deliveryType, neighborhood }) {
  const normalizedType = normalizePublicOrderDeliveryType(deliveryType)
  const isDelivery = normalizedType === 'delivery'
  const isPickup = normalizedType === 'pickup'

  if (!isDelivery && !isPickup) {
    fail('invalid-argument', 'Tipo de pedido invalido. Escolha entrega ou retirada.')
  }

  const settings = store?.settings || {}
  if (isPickup) {
    if (store?.acceptPickup === false || settings.acceptPickup === false) {
      fail('failed-precondition', 'Retirada indisponivel para esta loja.')
    }
    return { deliveryType: 'pickup', neighborhood: '', deliveryFeeCents: 0 }
  }

  if (store?.acceptDelivery === false || settings.acceptDelivery === false) {
    fail('failed-precondition', 'Entrega indisponivel para esta loja.')
  }

  const cleanNeighborhood = sanitizeText(neighborhood, 120)
  const deliveryFees = store?.deliveryFees && typeof store.deliveryFees === 'object' ? store.deliveryFees : {}
  const activeNeighborhoods = Object.entries(deliveryFees)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([name, value]) => ({
      name,
      aliases: getDeliveryNeighborhoodAliases(name, value),
      feeCents: hasValue(value?.feeCents)
        ? toCents(value.feeCents)
        : hasValue(value?.fee)
          ? moneyToCents(value.fee)
          : moneyToCents(value),
    }))

  if (activeNeighborhoods.length > 0) {
    const match = activeNeighborhoods.find((item) => matchesNeighborhoodAlias(item, cleanNeighborhood))
    if (!match) {
      const availableNeighborhoods = activeNeighborhoods.map((item) => item.name).join(', ')
      fail('failed-precondition', `A loja entrega apenas em: ${availableNeighborhoods}.`)
    }
    return {
      deliveryType: 'delivery',
      neighborhood: match.name,
      neighborhoodAliases: match.aliases,
      deliveryFeeCents: Math.max(0, match.feeCents),
    }
  }

  if (!cleanNeighborhood) fail('invalid-argument', 'Bairro obrigatorio para entrega.')

  return {
    deliveryType: 'delivery',
    neighborhood: cleanNeighborhood,
    neighborhoodAliases: [cleanNeighborhood],
    deliveryFeeCents: getPriceCents({ price: store?.deliveryFee, priceCents: store?.deliveryFeeCents }),
  }
}

function normalizePublicOrderDeliveryType(value) {
  const normalized = normalizeText(value).replace(/[\s-]+/g, '_')
  if (!normalized) return 'pickup'
  if (['delivery', 'entrega'].includes(normalized)) return 'delivery'
  if ([
    'pickup',
    'retirada',
    'retirar',
    'takeaway',
    'takeout',
    'balcao',
    'retirada_loja',
    'retirada_na_loja',
  ].includes(normalized)) return 'pickup'
  return null
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

  if (keyType === 'cpf' || keyType === 'cnpj') return onlyDigits(cleanKey)
  if (keyType === 'email') return cleanKey.toLowerCase()
  return cleanKey
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
  return `${id}${String(stringValue.length).padStart(2, '0')}${stringValue}`
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

function getPixConfig(store) {
  const pix = store?.pix || {}
  const settingsPix = store?.paymentSettings?.pix || {}
  const key = firstFilled(pix.key, settingsPix.key, store?.pixKey)
  const keyType = firstFilled(pix.keyType, settingsPix.keyType, store?.pixKeyType, 'random')
  const hasPixObject = Boolean(store?.pix && Object.keys(store.pix).length > 0)
  const hasSettingsPixObject = Boolean(store?.paymentSettings?.pix && Object.keys(store.paymentSettings.pix).length > 0)
  const legacyEnabled = !hasPixObject && !hasSettingsPixObject && Boolean(store?.pixKey)

  return {
    enabled: pix.enabled === true || settingsPix.enabled === true || legacyEnabled,
    key: normalizePixKey(key, keyType),
    rawKey: String(key || '').trim(),
    keyType,
    merchantName: sanitizePixText(
      firstFilled(pix.merchantName, pix.receiverName, settingsPix.merchantName, settingsPix.receiverName, store?.name, 'PratoBy'),
      25
    ),
    merchantCity: sanitizePixText(
      firstFilled(pix.merchantCity, pix.receiverCity, settingsPix.merchantCity, settingsPix.receiverCity, store?.city, store?.address?.city, 'ARACAJU'),
      15
    ),
  }
}

function generatePixCopyPaste({ pixConfig, amountCents, txid, description }) {
  if (!pixConfig?.key) return ''

  const merchantAccountInfo = [
    emv('00', 'BR.GOV.BCB.PIX'),
    emv('01', pixConfig.key),
    description ? emv('02', sanitizePixText(description, 30)) : '',
  ].join('')

  const payloadWithoutCrc = [
    emv('00', '01'),
    emv('26', merchantAccountInfo),
    emv('52', '0000'),
    emv('53', '986'),
    emv('54', centsToMoney(amountCents).toFixed(2)),
    emv('58', 'BR'),
    emv('59', pixConfig.merchantName || 'PratoBy'),
    emv('60', pixConfig.merchantCity || 'ARACAJU'),
    emv('62', emv('05', sanitizePixText(txid, 25) || 'PratoBy')),
    '6304',
  ].join('')

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`
}

function buildPixPaymentSnapshot({ store, totalCents, storeSlug, trackingToken }) {
  const pixConfig = getPixConfig(store)
  if (!pixConfig.enabled || !pixConfig.key) return null

  const txid = sanitizePixText(`P${String(trackingToken || Date.now()).slice(-20)}`, 25)
  const pixCopyPaste = generatePixCopyPaste({
    pixConfig,
    amountCents: totalCents,
    txid,
    description: `PEDIDO ${storeSlug || 'PratoBy'}`,
  })

  if (!pixCopyPaste) return null

  return {
    method: 'pix_manual',
    label: 'Pix com comprovante',
    status: 'pending',
    amount: centsToMoney(totalCents),
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
    paidAt: null,
  }
}

function getPaymentMethodSnapshot({ store, paymentMethod, totalCents, changeFor, trackingToken, storeSlug }) {
  const method = String(paymentMethod || '').trim().toLowerCase()
  const paymentMethods = store?.paymentMethods || {}

  if (['pix', 'pix_manual', 'manual_pix', 'pix_manual_store'].includes(method)) {
    if (paymentMethods.pix === false) fail('failed-precondition', 'Pix indisponível para esta loja.')
    const pixSnapshot = buildPixPaymentSnapshot({ store, totalCents, trackingToken, storeSlug })
    if (!pixSnapshot) fail('failed-precondition', 'Pix da loja não está configurado.')

    return {
      paymentMethod: 'Pix',
      paymentType: 'pix_manual',
      paymentStatus: 'pending',
      paymentRequiresConfirmation: true,
      payment: pixSnapshot,
      pixCopyPaste: pixSnapshot.pixCopyPaste,
      pixKey: pixSnapshot.pixKey,
      pixTxid: pixSnapshot.pixTxid,
    }
  }

  if (['card', 'cartao', 'cartao_entrega', 'card_on_delivery'].includes(method)) {
    if (paymentMethods.card === false) fail('failed-precondition', 'Cartão indisponível para esta loja.')
    return {
      paymentMethod: 'Cartão',
      paymentType: 'card_on_delivery',
      paymentStatus: 'pay_on_delivery',
      paymentRequiresConfirmation: false,
      payment: {
        method: 'card_on_delivery',
        label: 'Cartão na entrega',
        status: 'pay_on_delivery',
        amount: centsToMoney(totalCents),
        amountCents: totalCents,
        changeFor: null,
        confirmedAt: null,
        confirmedBy: null,
        paidAt: null,
      },
    }
  }

  if (['cash', 'dinheiro'].includes(method)) {
    if (paymentMethods.cash === false) fail('failed-precondition', 'Dinheiro indisponível para esta loja.')
    const changeForCents = hasValue(changeFor) && changeFor !== 'sem_troco' ? moneyToCents(changeFor) : null
    if (changeForCents !== null && changeForCents < totalCents) {
      fail('invalid-argument', 'Valor de troco menor que o total.')
    }

    return {
      paymentMethod: 'Dinheiro',
      paymentType: 'cash',
      paymentStatus: 'pay_on_delivery',
      paymentRequiresConfirmation: false,
      changeFor: changeForCents === null ? 'Sem troco' : centsToMoney(changeForCents),
      payment: {
        method: 'cash',
        label: 'Dinheiro na entrega',
        status: 'pay_on_delivery',
        amount: centsToMoney(totalCents),
        amountCents: totalCents,
        changeFor: changeForCents === null ? null : centsToMoney(changeForCents),
        confirmedAt: null,
        confirmedBy: null,
        paidAt: null,
      },
    }
  }

  fail('invalid-argument', 'Forma de pagamento inválida.')
}

function getPublicOrderPaymentSnapshot({
  input,
  store,
  paymentMethod,
  totalCents,
  changeFor,
  trackingToken,
  storeSlug,
  schedulingDecision,
}) {
  const requiresMercadoPagoOnline = orderRequiresMercadoPagoOnline({ store, schedulingDecision })
  const requestedMercadoPagoOnline = isMercadoPagoOnlinePaymentRequest({
    ...input,
    paymentMethod,
  })
  const requiresAsaasOnline = orderRequiresAsaasOnline({ store, schedulingDecision })
  const requestedAsaasOnline = isAsaasOnlinePaymentRequest({
    ...input,
    paymentMethod,
  })

  if (requestedAsaasOnline && !isLegacyAsaasOrdersEnabled()) {
    fail('failed-precondition', 'Pagamento online por Asaas não está mais disponível para novos pedidos.')
  }

  if (requiresMercadoPagoOnline || requestedMercadoPagoOnline) {
    if (!isMercadoPagoOnlineActive(store)) {
      fail('failed-precondition', 'Pagamento online Mercado Pago indisponivel para esta loja.')
    }

    return buildMercadoPagoPendingPaymentSnapshot({
      totalCents,
      storeId: getStoreDocId(store),
      storeSlug,
      orderId: trackingToken,
    })
  }

  if ((requiresAsaasOnline || requestedAsaasOnline) && isLegacyAsaasOrdersEnabled()) {
    if (typeof input.asaasOrdersApiKeyConfigured === 'boolean' && !input.asaasOrdersApiKeyConfigured) {
      fail('failed-precondition', 'Pagamento online nao configurado.')
    }

    if (!isAsaasOnlineActive(store)) {
      fail('failed-precondition', 'Pagamento online indisponivel para esta loja.')
    }

    return buildAsaasPendingPaymentSnapshot({
      totalCents,
      storeId: getStoreDocId(store),
      storeSlug,
      orderId: trackingToken,
    })
  }

  return getPaymentMethodSnapshot({
    store,
    paymentMethod,
    totalCents,
    changeFor,
    trackingToken,
    storeSlug,
  })
}

function buildDeliveryAddress(input, deliveryType, neighborhood) {
  if (deliveryType !== 'delivery') return null

  return {
    cep: formatCep(input.cep || input.address?.cep),
    neighborhood,
    street: sanitizeText(input.street || input.address?.street, 160),
    number: sanitizeAddressNumber(input.number || input.address?.number),
    complement: sanitizeText(input.complement || input.address?.complement, 120),
    reference: sanitizeText(input.reference || input.address?.reference, 160),
    city: sanitizeText(input.city || input.address?.city, 120),
    state: sanitizeText(input.state || input.address?.state, 2),
    cepNeighborhood: sanitizeText(input.cepNeighborhood || input.address?.cepNeighborhood, 120),
    cepStreet: sanitizeText(input.cepStreet || input.address?.cepStreet, 160),
    cepCity: sanitizeText(input.cepCity || input.address?.cepCity, 120),
    cepState: sanitizeText(input.cepState || input.address?.cepState, 2),
    cepValidated: Boolean(input.cepValidated || input.address?.cepValidated),
  }
}

function assertDeliveryAddressMatchesCepNeighborhood(delivery, deliveryAddress) {
  if (delivery?.deliveryType !== 'delivery' || !deliveryAddress) return

  const cep = onlyDigits(deliveryAddress.cep)
  const cepNeighborhood = sanitizeText(deliveryAddress.cepNeighborhood, 120)

  // TODO(server-side ViaCEP): validate CEP directly in Cloud Functions before creating the order.
  // Until then, reject mismatches when the client provides the ViaCEP neighborhood and always
  // recalculate the delivery fee from the store delivery table.
  if (deliveryAddress.cepValidated && cep && !cepNeighborhood) {
    fail('invalid-argument', 'Não foi possível confirmar o bairro do CEP. Busque o CEP novamente ou selecione o bairro manualmente.')
  }

  if (!cepNeighborhood) return

  const aliases = uniqueArray([
    delivery.neighborhood,
    ...(Array.isArray(delivery.neighborhoodAliases) ? delivery.neighborhoodAliases : []),
  ])
  const cepMatchesSelectedNeighborhood = aliases.some((alias) => {
    return normalizeForMatch(alias) === normalizeForMatch(cepNeighborhood)
  })

  if (!cepMatchesSelectedNeighborhood) {
    fail('failed-precondition', `O bairro do CEP (${cepNeighborhood}) nao corresponde ao bairro selecionado para entrega.`)
  }
}

function createPublicOrderHandler({
  db,
  admin,
  HttpsError,
  logger,
  maxOrderCents = 100000000,
  sendNewOrderPushToStore = null,
  createAsaasOrderPaymentLink = null,
  mercadoPagoAccessTokenTestSecret = null,
  mercadoPagoAccessTokenProdSecret = null,
}) {
  return async (request) => {
    try {
      const input = request.data || {}
      const store = await findStoreForPublicOrder(db, input)

      if (!isPublicStoreActive(store)) fail('failed-precondition', 'Loja indisponivel para pedidos.')
      assertStoreBillingAllowsPublicOrder(store, logger)

      const storeDocId = getStoreDocId(store)
      const storeSlug = getStoreSlug(store) || storeDocId
      const storeKeys = getStoreKeys(store)

      if (!storeDocId || !storeSlug) fail('failed-precondition', 'Loja sem identificador publico valido.')

      const customerName = sanitizeText(input.customerName || input.customer?.name, 100)
      const customerPhone = normalizeBrazilianPhone(input.customerPhone || input.customer?.phone)

      if (customerName.length < 2) fail('invalid-argument', 'Nome do cliente obrigatorio.')
      if (!customerPhone) fail('invalid-argument', 'WhatsApp do cliente invalido.')

      const phoneE164 = customerPhone.phoneE164
      const phoneHash = crypto.createHash('sha256').update(phoneE164).digest('hex')
      const ip = request.ip || request.rawRequest?.ip || ''
      const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : ''

      await incrementPublicOrderAttemptLimit({ db, admin, storeDocId, phoneHash, ipHash })

      // A) Cheap initial rate limit check (outside transaction, before product reads)
      const initialLimitRef = db.collection('rateLimits').doc(`createPublicOrder_${storeDocId}_${phoneHash}`)
      const initialLimitSnap = await initialLimitRef.get()
      if (initialLimitSnap.exists) {
        const rateLimitData = initialLimitSnap.data()
        const nowMs = Date.now()
        const windowStartMs = rateLimitData?.windowStart?.toMillis?.() || 0
        if (nowMs - windowStartMs < 10 * 60 * 1000) {
          if (rateLimitData?.count >= 5) {
            fail('resource-exhausted', 'Limite de pedidos excedido para este telefone. Por favor, aguarde alguns minutos.')
          }
        }
      }

      if (ipHash) {
        const initialIpRef = db.collection('rateLimits').doc(`createPublicOrder_ip_${storeDocId}_${ipHash}`)
        const initialIpSnap = await initialIpRef.get()
        if (initialIpSnap.exists) {
          const ipLimitData = initialIpSnap.data()
          const nowMs = Date.now()
          const ipWindowStartMs = ipLimitData?.windowStart?.toMillis?.() || 0
          if (nowMs - ipWindowStartMs < 10 * 60 * 1000) {
            if (ipLimitData?.count >= 10) {
              fail('resource-exhausted', 'Limite de pedidos excedido para esta rede. Por favor, aguarde alguns minutos.')
            }
          }
        }
      }

      const { items, subtotalCents, schedulingProducts } = await buildServerOrderItems(db, input.items, storeKeys)

      if (subtotalCents <= 0 || subtotalCents > maxOrderCents) {
        fail('failed-precondition', 'Subtotal do pedido invalido.')
      }

      const delivery = getDeliveryFeeCents({
        store,
        deliveryType: input.deliveryType || input.orderType,
        neighborhood: input.neighborhood || input.bairro || input.address?.neighborhood,
      })
      const deliveryAddress = buildDeliveryAddress(input, delivery.deliveryType, delivery.neighborhood)
      assertDeliveryAddressMatchesCepNeighborhood(delivery, deliveryAddress)
      const trackingToken = crypto.randomBytes(16).toString('hex')
      const orderRef = db.collection('orders').doc(trackingToken)
      const couponCode = sanitizeText(input.couponCode || input.coupon?.code, 80).toUpperCase()

      const result = await db.runTransaction(async (transaction) => {
        const liveStoreSnapshot = await transaction.get(db.collection('stores').doc(storeDocId))
        if (!liveStoreSnapshot.exists) fail('failed-precondition', 'Loja indisponivel para pedidos.')

        const liveStore = {
          ...store,
          ...(liveStoreSnapshot.data() || {}),
          id: liveStoreSnapshot.id,
          docId: liveStoreSnapshot.id,
        }

        if (!isPublicStoreActive(liveStore)) fail('failed-precondition', 'Loja indisponivel para pedidos.')
        assertStoreBillingAllowsPublicOrder(liveStore, logger)

        const schedulingDecision = buildOrderSchedulingDecision({
          store: liveStore,
          storeId: storeDocId,
          products: schedulingProducts,
          input,
          deliveryType: delivery.deliveryType,
          paymentMethod: input.paymentMethod,
          now: new Date(),
          fail,
        })
        if (schedulingDecision?.orderTiming === 'scheduled' && !hasPlanFeature(liveStore, 'scheduling')) {
          fail('failed-precondition', 'Agendamento exige plano Profissional ou Premium.')
        }
        const schedulingFields = buildFirestoreSchedulingFields(admin, schedulingDecision)

        // 1. Check phone rate limit
        const rateLimitRef = db.collection('rateLimits').doc(`createPublicOrder_${storeDocId}_${phoneHash}`)
        const rateLimitSnap = await transaction.get(rateLimitRef)
        const nowMs = Date.now()

        let rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : null
        let newCount = 1
        let newWindowStart = admin.firestore.Timestamp.fromMillis(nowMs)

        if (rateLimitData) {
          const windowStartMs = rateLimitData.windowStart?.toMillis?.() || 0
          if (nowMs - windowStartMs < 10 * 60 * 1000) { // 10 minutes window
            if (rateLimitData.count >= 5) {
              fail('resource-exhausted', 'Limite de pedidos excedido para este telefone. Por favor, aguarde alguns minutos.')
            }
            newCount = rateLimitData.count + 1
            newWindowStart = rateLimitData.windowStart
          }
        }

        // 2. Check IP rate limit (if available)
        let ipLimitRef = null
        let newIpCount = 1
        let newIpWindowStart = admin.firestore.Timestamp.fromMillis(nowMs)
        let hasIpLimit = false

        if (ipHash) {
          ipLimitRef = db.collection('rateLimits').doc(`createPublicOrder_ip_${storeDocId}_${ipHash}`)
          const ipLimitSnap = await transaction.get(ipLimitRef)
          let ipLimitData = ipLimitSnap.exists ? ipLimitSnap.data() : null

          if (ipLimitData) {
            const ipWindowStartMs = ipLimitData.windowStart?.toMillis?.() || 0
            if (nowMs - ipWindowStartMs < 10 * 60 * 1000) {
              if (ipLimitData.count >= 10) { // Slightly higher limit for IP (10 requests/10min)
                fail('resource-exhausted', 'Limite de pedidos excedido para esta rede. Por favor, aguarde alguns minutos.')
              }
              newIpCount = ipLimitData.count + 1
              newIpWindowStart = ipLimitData.windowStart
            }
          }
          hasIpLimit = true
        }

        let couponResult = null

        if (couponCode) {
          if (!hasPlanFeature(liveStore, 'coupons')) {
            fail('failed-precondition', 'Cupons exigem plano Profissional ou Premium.')
          }

          const couponDoc = await findCouponInTransaction(db, transaction, store, couponCode)
          if (!couponDoc) fail('failed-precondition', 'Cupom invalido ou nao encontrado.')

          const coupon = couponDoc.data
          const usageLimit = Number(coupon.usageLimit || 0)
          const usedCount = Number(coupon.usedCount || 0)

          if (usageLimit > 0 && usedCount >= usageLimit) {
            fail('failed-precondition', 'Limite de uso do cupom atingido.')
          }

          const discount = calculateCouponDiscount({ coupon, items, subtotalCents })
          couponResult = {
            ref: couponDoc.ref,
            id: couponDoc.id,
            code: String(coupon.code || couponCode).toUpperCase(),
            type: discount.type,
            value: coupon.value ?? null,
            valueCents: coupon.valueCents ?? null,
            discountCents: discount.discountCents,
            eligibleSubtotalCents: discount.eligibleSubtotalCents,
            usageLimit: usageLimit || null,
            usedCountBefore: usedCount,
          }
        }

        const discountCents = couponResult?.discountCents || 0
        const totalCents = Math.max(0, subtotalCents - discountCents + delivery.deliveryFeeCents)

        if (totalCents <= 0 || totalCents > maxOrderCents) {
          fail('failed-precondition', 'Total do pedido invalido.')
        }

        const paymentSnapshot = getPublicOrderPaymentSnapshot({
          input: {
            ...input,
            asaasOrdersApiKeyConfigured: typeof createAsaasOrderPaymentLink === 'function'
              ? Boolean(createAsaasOrderPaymentLink())
              : false,
          },
          store: liveStore,
          paymentMethod: input.paymentMethod,
          totalCents,
          changeFor: input.changeFor,
          trackingToken,
          storeSlug,
          schedulingDecision,
        })

        const legacyAddress = delivery.deliveryType === 'delivery'
          ? [
              deliveryAddress?.street && deliveryAddress?.number ? `${deliveryAddress.street}, ${deliveryAddress.number}` : '',
              deliveryAddress?.complement || '',
              delivery.neighborhood || '',
              deliveryAddress?.cep ? `CEP ${deliveryAddress.cep}` : '',
            ].filter(Boolean).join(' - ')
          : 'Retirada na loja'

        const orderPayload = {
          trackingToken,
          trackingTokenVersion: 2,
          trackingUrlPath: `/${storeSlug}/pedido/${trackingToken}`,
          storeId: storeDocId,
          storeSlug,
          storeDocId,
          storeKeys,
          storeName: store.name || '',
          store: {
            id: storeDocId,
            docId: storeDocId,
            slug: storeSlug,
            name: store.name || '',
          },
          customerName,
          customerPhone: customerPhone.phoneE164,
          customer: {
            name: customerName,
            phone: customerPhone.phoneE164,
          },
          orderType: delivery.deliveryType,
          deliveryType: delivery.deliveryType,
          neighborhood: delivery.neighborhood,
          address: legacyAddress,
          deliveryAddress,
          delivery: {
            type: delivery.deliveryType,
            neighborhood: delivery.neighborhood,
            fee: centsToMoney(delivery.deliveryFeeCents),
            feeCents: delivery.deliveryFeeCents,
            address: deliveryAddress,
          },
          items,
          itemsSummary: items
            .map((item) => `${item.quantity}x ${item.name}${item.optionsSummary ? ` (${item.optionsSummary})` : ''}`)
            .join(', '),
          subtotal: centsToMoney(subtotalCents),
          subtotalCents,
          eligibleSubtotalCents: couponResult?.eligibleSubtotalCents || 0,
          subtotalWithoutPromotions: centsToMoney(subtotalCents),
          subtotalWithoutPromotionsCents: subtotalCents,
          promotionSavings: 0,
          promotionSavingsCents: 0,
          discount: centsToMoney(discountCents),
          discountCents,
          deliveryFee: centsToMoney(delivery.deliveryFeeCents),
          deliveryFeeCents: delivery.deliveryFeeCents,
          total: centsToMoney(totalCents),
          totalCents,
          ...paymentSnapshot,
          ...schedulingFields,
          couponId: couponResult?.id || null,
          couponCode: couponResult?.code || null,
          coupon: couponResult
            ? {
                id: couponResult.id,
                code: couponResult.code,
                type: couponResult.type,
                value: couponResult.value,
                valueCents: couponResult.valueCents,
                discount: centsToMoney(couponResult.discountCents),
                discountCents: couponResult.discountCents,
                eligibleSubtotalCents: couponResult.eligibleSubtotalCents,
              }
            : null,
          couponValidation: couponResult
            ? {
                status: 'reserved',
                couponId: couponResult.id,
                usageLimit: couponResult.usageLimit,
                usedCountBefore: couponResult.usedCountBefore,
                checkedAt: admin.firestore.FieldValue.serverTimestamp(),
                checkedBy: 'createPublicOrder',
              }
            : null,
          customerObservation: null,
          orderObservation: null,
          status: 'pendente',
          statusKey: 'pending',
          pendingAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'storefront',
          platform: 'PratoBy',
          pricingValidation: {
            status: 'valid',
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedBy: 'createPublicOrder',
            serverSubtotalCents: subtotalCents,
            serverDiscountCents: discountCents,
            serverDeliveryFeeCents: delivery.deliveryFeeCents,
            serverTotalCents: totalCents,
            errors: [],
            warnings: [],
          },
          requiresManualPriceReview: false,
          requiresManualCouponReview: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }

        transaction.set(rateLimitRef, {
          count: newCount,
          windowStart: newWindowStart,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true })

        if (hasIpLimit && ipLimitRef) {
          transaction.set(ipLimitRef, {
            count: newIpCount,
            windowStart: newIpWindowStart,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true })
        }

        await reserveScheduledSlotInTransaction({
          db,
          admin,
          transaction,
          store: liveStore,
          storeId: storeDocId,
          orderRef,
          schedulingDecision,
        })

        transaction.set(orderRef, orderPayload)

        if (couponResult?.ref) {
          transaction.update(couponResult.ref, {
            usedCount: admin.firestore.FieldValue.increment(1),
            lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }

        return {
          orderId: orderRef.id,
          trackingToken,
          trackingUrl: `/${storeSlug}/pedido/${trackingToken}`,
          payment: {
            mode: paymentSnapshot.paymentMode || 'manual',
            provider: paymentSnapshot.paymentProvider || null,
            status: paymentSnapshot.paymentStatus || null,
          },
          orderTiming: schedulingDecision.orderTiming,
          totals: {
            subtotalCents,
            discountCents,
            deliveryFeeCents: delivery.deliveryFeeCents,
            totalCents,
            eligibleSubtotalCents: couponResult?.eligibleSubtotalCents || 0,
          },
        }
      })

      let onlinePaymentLink = null
      let onlinePaymentLinkError = null
      let onlinePaymentProvider = result.payment?.provider || null

      if (result.payment?.mode === 'online' && result.payment.provider === 'asaas') {
        const orderRefForPayment = db.collection('orders').doc(result.orderId)
        try {
          const [orderSnapshot, storeSnapshot] = await Promise.all([
            orderRefForPayment.get(),
            db.collection('stores').doc(storeDocId).get(),
          ])

          onlinePaymentLink = await createOrderPaymentLink({
            db,
            admin,
            logger,
            apiKey: typeof createAsaasOrderPaymentLink === 'function'
              ? createAsaasOrderPaymentLink()
              : '',
            orderRef: orderRefForPayment,
            orderData: {
              id: orderSnapshot.id,
              ...(orderSnapshot.data() || {}),
            },
            storeData: storeSnapshot.data() || {},
          })
        } catch (paymentError) {
          logger.error('Public order created but Asaas payment link failed.', {
            orderId: result.orderId,
            storeId: storeDocId,
            error: paymentError?.message || String(paymentError),
          })
          onlinePaymentLinkError = paymentError
          await db.runTransaction(async (transaction) => {
            const orderSnapshot = await transaction.get(orderRefForPayment)
            const orderData = orderSnapshot.exists ? orderSnapshot.data() || {} : {}
            const releasePatch = await releaseScheduledSlotInTransaction({
              db,
              admin,
              transaction,
              orderRef: orderRefForPayment,
              orderData,
              reason: 'asaas_link_creation_failed',
            })

            transaction.set(orderRefForPayment, {
              ...buildAsaasLinkCreationFailurePatch({ admin, error: paymentError }),
              ...releasePatch,
            }, { merge: true })
          })
        }
      }

      if (result.payment?.mode === 'online' && result.payment.provider === 'mercadopago') {
        const orderRefForPayment = db.collection('orders').doc(result.orderId)
        try {
          const [orderSnapshot, storeSnapshot] = await Promise.all([
            orderRefForPayment.get(),
            db.collection('stores').doc(storeDocId).get(),
          ])

          onlinePaymentLink = await createMercadoPagoPreference({
            db,
            admin,
            logger,
            accessTokenTestSecret: mercadoPagoAccessTokenTestSecret,
            accessTokenProdSecret: mercadoPagoAccessTokenProdSecret,
            orderRef: orderRefForPayment,
            orderData: {
              id: orderSnapshot.id,
              ...(orderSnapshot.data() || {}),
            },
            storeData: storeSnapshot.data() || {},
          })
        } catch (paymentError) {
          logger.error('Public order created but Mercado Pago preference failed.', {
            orderId: result.orderId,
            storeId: storeDocId,
            error: paymentError?.message || String(paymentError),
          })
          onlinePaymentProvider = 'mercadopago'
          onlinePaymentLinkError = paymentError
          await db.runTransaction(async (transaction) => {
            const orderSnapshot = await transaction.get(orderRefForPayment)
            const orderData = orderSnapshot.exists ? orderSnapshot.data() || {} : {}
            const releasePatch = await releaseScheduledSlotInTransaction({
              db,
              admin,
              transaction,
              orderRef: orderRefForPayment,
              orderData,
              reason: 'mercadopago_preference_creation_failed',
            })

            transaction.set(orderRefForPayment, {
              ...buildMercadoPagoPreferenceFailurePatch({ admin, error: paymentError }),
              ...releasePatch,
            }, { merge: true })
          })
        }
      }

      logger.info('Public order created server-side', {
        orderId: result.orderId,
        storeId: storeDocId,
        storeSlug,
        totalCents: result.totals.totalCents,
        hasCoupon: Boolean(couponCode),
        paymentMode: result.payment?.mode || 'manual',
      })

      const shouldNotifyNewOrder =
        result.orderTiming !== 'scheduled' &&
        (
          result.payment?.mode !== 'online' ||
          result.payment?.status === 'paid'
        )

      if (shouldNotifyNewOrder && typeof sendNewOrderPushToStore === 'function') {
        try {
          await sendNewOrderPushToStore({
            storeId: storeDocId,
            orderId: result.orderId,
          })
        } catch (pushError) {
          logger.warn('Public order created but new order push failed.', {
            orderId: result.orderId,
            storeId: storeDocId,
            error: pushError?.message || String(pushError),
          })
        }
      }

      return {
        ...result,
        ...(onlinePaymentLink
          ? {
              provider: onlinePaymentLink.provider || onlinePaymentProvider,
              paymentUrl: onlinePaymentLink.paymentUrl,
              invoiceUrl: onlinePaymentLink.invoiceUrl,
              preferenceId: onlinePaymentLink.preferenceId,
              initPoint: onlinePaymentLink.initPoint,
              sandboxInitPoint: onlinePaymentLink.sandboxInitPoint,
              providerPaymentLinkId: onlinePaymentLink.providerPaymentLinkId,
            }
          : {}),
        ...(onlinePaymentLinkError
          ? {
              paymentStatus: 'failed_link_creation',
              paymentError: 'failed_link_creation',
              paymentMessage: onlinePaymentProvider === 'mercadopago'
                ? 'Pedido recebido, mas nao foi possivel gerar o checkout Mercado Pago agora. Tente pagar pela tela de acompanhamento.'
                : 'Pedido recebido, mas nao foi possivel gerar o link de pagamento agora. Tente pagar pela tela de acompanhamento.',
            }
          : {}),
      }
    } catch (error) {
      if (error instanceof PublicOrderError) {
        throw new HttpsError(error.code, error.message)
      }
      throw error
    }
  }
}

module.exports = {
  createPublicOrderHandler,
  normalizePublicOrderDeliveryType,
  buildServerOrderItems,
  PublicOrderError,
}
