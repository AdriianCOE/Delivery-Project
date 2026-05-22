const crypto = require('crypto')

class PublicOrderError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function fail(code, message) {
  throw new PublicOrderError(code, message)
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

function normalizeBrazilianPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '')

  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  }

  if (digits.length !== 12 && digits.length !== 13) return null
  return { phoneDigits: digits, phoneE164: `+${digits}` }
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

  return { items, subtotalCents }
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
  const normalizedType = String(deliveryType || '').trim().toLowerCase()
  const isDelivery = ['delivery', 'entrega'].includes(normalizedType)

  if (!isDelivery) return { deliveryType: 'pickup', neighborhood: '', deliveryFeeCents: 0 }

  const settings = store?.settings || {}
  if (store?.acceptDelivery === false || settings.acceptDelivery === false) {
    fail('failed-precondition', 'Entrega indisponivel para esta loja.')
  }

  const cleanNeighborhood = sanitizeText(neighborhood, 120)
  const deliveryFees = store?.deliveryFees && typeof store.deliveryFees === 'object' ? store.deliveryFees : {}
  const activeNeighborhoods = Object.entries(deliveryFees)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([name, value]) => ({
      name,
      normalized: normalizeForMatch(name),
      feeCents: hasValue(value?.feeCents)
        ? toCents(value.feeCents)
        : hasValue(value?.fee)
          ? moneyToCents(value.fee)
          : moneyToCents(value),
    }))

  if (activeNeighborhoods.length > 0) {
    const match = activeNeighborhoods.find((item) => item.normalized === normalizeForMatch(cleanNeighborhood))
    if (!match) fail('failed-precondition', 'Bairro indisponivel para entrega.')
    return { deliveryType: 'delivery', neighborhood: match.name, deliveryFeeCents: Math.max(0, match.feeCents) }
  }

  if (!cleanNeighborhood) fail('invalid-argument', 'Bairro obrigatorio para entrega.')

  return {
    deliveryType: 'delivery',
    neighborhood: cleanNeighborhood,
    deliveryFeeCents: getPriceCents({ price: store?.deliveryFee, priceCents: store?.deliveryFeeCents }),
  }
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
    label: 'Pix',
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
    if (paymentMethods.pix === false) fail('failed-precondition', 'Pix indisponivel para esta loja.')
    const pixSnapshot = buildPixPaymentSnapshot({ store, totalCents, trackingToken, storeSlug })
    if (!pixSnapshot) fail('failed-precondition', 'Pix da loja nao esta configurado.')

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
    if (paymentMethods.card === false) fail('failed-precondition', 'Cartao indisponivel para esta loja.')
    return {
      paymentMethod: 'Cartao',
      paymentType: 'card_on_delivery',
      paymentStatus: 'pay_on_delivery',
      paymentRequiresConfirmation: false,
      payment: {
        method: 'card_on_delivery',
        label: 'Maquininha',
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
    if (paymentMethods.cash === false) fail('failed-precondition', 'Dinheiro indisponivel para esta loja.')
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
        label: 'Dinheiro',
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

  fail('invalid-argument', 'Forma de pagamento invalida.')
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

function createPublicOrderHandler({ db, admin, HttpsError, logger, maxOrderCents = 100000000 }) {
  return async (request) => {
    try {
      const input = request.data || {}
      const store = await findStoreForPublicOrder(db, input)

      if (!isPublicStoreActive(store)) fail('failed-precondition', 'Loja indisponivel para pedidos.')

      const storeDocId = getStoreDocId(store)
      const storeSlug = getStoreSlug(store) || storeDocId
      const storeKeys = getStoreKeys(store)

      if (!storeDocId || !storeSlug) fail('failed-precondition', 'Loja sem identificador publico valido.')

      const customerName = sanitizeText(input.customerName || input.customer?.name, 100)
      const customerPhone = normalizeBrazilianPhone(input.customerPhone || input.customer?.phone)

      if (customerName.length < 2) fail('invalid-argument', 'Nome do cliente obrigatorio.')
      if (!customerPhone) fail('invalid-argument', 'WhatsApp do cliente invalido.')

      const { items, subtotalCents } = await buildServerOrderItems(db, input.items, storeKeys)

      if (subtotalCents <= 0 || subtotalCents > maxOrderCents) {
        fail('failed-precondition', 'Subtotal do pedido invalido.')
      }

      const delivery = getDeliveryFeeCents({
        store,
        deliveryType: input.deliveryType || input.orderType,
        neighborhood: input.neighborhood || input.bairro || input.address?.neighborhood,
      })
      const deliveryAddress = buildDeliveryAddress(input, delivery.deliveryType, delivery.neighborhood)
      const trackingToken = crypto.randomBytes(16).toString('hex')
      const orderRef = db.collection('orders').doc(trackingToken)
      const couponCode = sanitizeText(input.couponCode || input.coupon?.code, 80).toUpperCase()

      const result = await db.runTransaction(async (transaction) => {
        let couponResult = null

        if (couponCode) {
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

        const paymentSnapshot = getPaymentMethodSnapshot({
          store,
          paymentMethod: input.paymentMethod,
          totalCents,
          changeFor: input.changeFor,
          trackingToken,
          storeSlug,
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
          totals: {
            subtotalCents,
            discountCents,
            deliveryFeeCents: delivery.deliveryFeeCents,
            totalCents,
            eligibleSubtotalCents: couponResult?.eligibleSubtotalCents || 0,
          },
        }
      })

      logger.info('Public order created server-side', {
        orderId: result.orderId,
        storeId: storeDocId,
        storeSlug,
        totalCents: result.totals.totalCents,
        hasCoupon: Boolean(couponCode),
      })

      return result
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
}
