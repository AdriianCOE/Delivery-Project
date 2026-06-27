#!/usr/bin/env node

const admin = require('firebase-admin')
const {
  sanitizePublicProductScheduling,
  sanitizePublicStoreScheduling,
} = require('../shared/publicScheduling')
const {
  sanitizePublicStorePayments,
} = require('../shared/asaasOrders')
const {
  computePublicStock,
  shouldHideWhenSoldOut,
} = require('../shared/inventory')

admin.initializeApp({
  projectId:
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    'borapedir-f529a',
})

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue
const BILLING_BLOCKED_PUBLIC_STATUSES = new Set(['blocked', 'canceled'])

const args = new Set(process.argv.slice(2))
const writeEnabled = args.has('--write')
const dryRun = !writeEnabled

if (writeEnabled && args.has('--dry-run')) {
  throw new Error('Use either --dry-run or --write, not both.')
}
const storeIdArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--storeId='))
const onlyStoreId = storeIdArg ? storeIdArg.split('=').slice(1).join('=').trim() : ''

function uniqueArray(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined)
  }

  if (value && typeof value === 'object' && typeof value.toDate !== 'function') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const nextValue = stripUndefinedDeep(item)
      if (nextValue !== undefined) acc[key] = nextValue
      return acc
    }, {})
  }

  return value === undefined ? undefined : value
}

function pickFields(source, fields) {
  return fields.reduce((acc, field) => {
    if (source?.[field] !== undefined) acc[field] = source[field]
    return acc
  }, {})
}

function sanitizeString(value, maxLength = 240) {
  if (value === undefined || value === null) return ''
  return String(value)
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

function slugifyStoreName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function getPublicStoreSlug(data = {}, storeId = '') {
  return sanitizeString(
    data.storeSlug ||
      data.slug ||
      slugifyStoreName(data.storeName || data.name) ||
      storeId,
    120
  )
}

function getPublicStoreKeys(storeId, data = {}, storeSlug = '') {
  return uniqueArray([
    storeId,
    data.storeId,
    data.storeDocId,
    data.docId,
    storeSlug,
    data.storeSlug,
    data.slug,
    ...(Array.isArray(data.storeKeys) ? data.storeKeys : []),
  ]).slice(0, 30)
}

function isStorePubliclyAvailable(data = {}) {
  const subscriptionStatus = String(data.subscriptionStatus || data.subscription?.status || '').trim()

  return data.isActive !== false &&
    data.isBlocked !== true &&
    data.isBillingBlocked !== true &&
    data.isDeleted !== true &&
    !data.deletedAt &&
    !BILLING_BLOCKED_PUBLIC_STATUSES.has(subscriptionStatus)
}

function sanitizePublicAddress(data = {}) {
  const address = data.address && typeof data.address === 'object' ? data.address : data
  return stripUndefinedDeep({
    street: sanitizeString(address.street, 120),
    number: sanitizeString(address.number, 20),
    neighborhood: sanitizeString(address.neighborhood, 80),
    city: sanitizeString(address.city, 80),
    state: sanitizeString(address.state, 2).toUpperCase(),
  })
}

function sanitizePublicStoreSettings(settings = {}) {
  if (!settings || typeof settings !== 'object') return undefined
  return stripUndefinedDeep(pickFields(settings, [
    'themeColor',
    'primaryColor',
    'openingHours',
    'businessHours',
    'acceptDelivery',
    'acceptPickup',
    'acceptDineIn',
    'deliveryTime',
    'instagram',
    'whatsapp',
  ]))
}

function buildPublicStoreProfile(data = {}, storeId) {
  const storeSlug = getPublicStoreSlug(data, storeId)
  const storeKeys = getPublicStoreKeys(storeId, data, storeSlug)

  const profile = {
    ...pickFields(data, [
      'name',
      'storeName',
      'logoUrl',
      'bannerUrl',
      'bannerMobileUrl',
      'shareImageUrl',
      'seoImageUrl',
      'ogImageUrl',
      'faviconUrl',
      'coverUrl',
      'description',
      'theme',
      'themeColor',
      'primaryColor',
      'secondaryColor',
      'city',
      'state',
      'neighborhood',
      'deliveryTime',
      'minOrder',
      'minOrderCents',
      'deliveryFees',
      'deliveryAreas',
      'deliveryNeighborhoods',
      'neighborhoods',
      'openingHours',
      'businessHours',
      'hoursOpen',
      'hoursClose',
      'activeDays',
      'acceptDelivery',
      'acceptPickup',
      'acceptDineIn',
      'isOpen',
      'isActive',
      'isPublic',
      'isVisible',
      'isBlocked',
      'isBillingBlocked',
      'isDeleted',
      'ratingSummary',
      'averageRating',
      'reviewCount',
      'paymentMethods',
      'socialLinks',
      'social',
      'instagram',
      'phone',
      'whatsapp',
      'whatsapp1',
      'updatedAt',
      'createdAt',
    ]),
    id: storeId,
    storeId,
    docId: storeId,
    storeDocId: storeId,
    slug: data.slug || storeSlug,
    storeSlug,
    storeKeys,
    publicDataSource: 'publicStores',
    isOpen: data.isOpen !== false,
    isActive: data.isActive !== false,
    isBlocked: data.isBlocked === true,
    isBillingBlocked: data.isBillingBlocked === true,
    isDeleted: data.isDeleted === true,
    address: sanitizePublicAddress(data),
    settings: sanitizePublicStoreSettings(data.settings),
    payments: sanitizePublicStorePayments(data),
    publicScheduling: sanitizePublicStoreScheduling(data),
  }

  if (data.pix && typeof data.pix === 'object') {
    profile.pix = { enabled: data.pix.enabled === true }
  }

  return stripUndefinedDeep(profile)
}

function isPublicCategoryData(data = {}) {
  return data.isDeleted !== true &&
    !data.deletedAt &&
    data.isActive !== false &&
    data.active !== false &&
    data.isVisible !== false &&
    data.visible !== false
}

function isPublicProductData(data = {}) {
  return data.isDeleted !== true &&
    !data.deletedAt &&
    data.isActive !== false &&
    data.active !== false &&
    data.isVisible !== false &&
    data.visible !== false &&
    data.hidden !== true &&
    !shouldHideWhenSoldOut(data.stock)
}

function buildPublicCategory(data = {}, categoryId, storeId) {
  return stripUndefinedDeep({
    ...pickFields(data, [
      'name',
      'description',
      'order',
      'sortOrder',
      'position',
      'slug',
      'icon',
      'imageUrl',
      'isActive',
      'active',
      'isVisible',
      'visible',
      'updatedAt',
      'createdAt',
    ]),
    id: categoryId,
    categoryId,
    storeId,
    isActive: data.isActive !== false,
    isVisible: data.isVisible !== false,
    isDeleted: false,
    publicUpdatedAt: FieldValue.serverTimestamp(),
  })
}

const PUBLIC_VISUAL_BADGE_LABELS = {
  artesanal: 'Artesanal',
  caseiro: 'Caseiro',
  feito_na_hora: 'Feito na hora',
  especial_da_casa: 'Especial da casa',
  cremoso: 'Cremoso',
  saboroso: 'Saboroso',
  para_compartilhar: 'Para compartilhar',
  acompanhamento: 'Acompanhamento',
  novidade: 'Novidade',
  edicao_limitada: 'Edição limitada',
  premium: 'Premium',
}

function normalizePublicVisualBadgeId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sanitizePublicProductServing(value, data = {}) {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  const legacy = data.serves ?? data.portion
  const countNumber = Number(raw.count ?? (Number.isFinite(Number(legacy)) ? legacy : null))

  const count = Number.isFinite(countNumber) && countNumber > 0
    ? Math.min(999, Math.floor(countNumber))
    : null

  const label = String(raw.label || (!count && legacy ? legacy : '') || '').trim().slice(0, 40)
  const enabled = raw.enabled === true || Boolean(label || count)

  return {
    enabled,
    label: enabled ? label : '',
    count: enabled ? count : null,
  }
}

function sanitizePublicProductVisualBadges(value) {
  const raw = Array.isArray(value) ? value : []

  return [...new Set(raw.map((badge) => normalizePublicVisualBadgeId(badge?.id || badge)))]
    .filter((id) => PUBLIC_VISUAL_BADGE_LABELS[id])
    .slice(0, 5)
    .map((id) => ({
      id,
      label: PUBLIC_VISUAL_BADGE_LABELS[id],
    }))
}

function buildPublicProduct(data = {}, productId, storeId) {
  const product = stripUndefinedDeep({
    ...pickFields(data, [
      'name',
      'description',
      'categoryId',
      'categoryName',
      'price',
      'priceCents',
      'priceInCents',
      'oldPrice',
      'oldPriceCents',
      'imageUrl',
      'image',
      'photoUrl',
      'coverUrl',
      'thumbnailUrl',
      'isAvailable',
      'available',
      'status',
      'showInStorefront',
      'isFeatured',
      'isPopular',
      'isPromotion',
      'isPromotional',
      'promotion',
      'acceptsCoupons',
      'showCouponBadge',
      'acceptsCoupon',
      'couponEligible',
      'order',
      'sortOrder',
      'position',
      'preparationTime',
      'optionGroups',
      'additionalOptions',
      'variations',
      'optionsGroups',
      'customizationGroups',
      'extras',
      'addons',
      'tags',
      'availableDays',
      'availability',
      'updatedAt',
      'createdAt',
    ]),
    id: productId,
    productId,
    storeId,
    isActive: data.isActive !== false,
    isVisible: data.isVisible !== false,
    isDeleted: false,
    publicUpdatedAt: FieldValue.serverTimestamp(),
  })

  const scheduling = sanitizePublicProductScheduling(data.scheduling)
  if (scheduling) product.scheduling = scheduling
  product.publicStock = computePublicStock(data.stock)

  const serving = sanitizePublicProductServing(data.serving, data)
  if (serving.enabled) {
    product.serving = serving
  } else {
    delete product.serving
  }

  const visualBadges = sanitizePublicProductVisualBadges(data.visualBadges)
  if (visualBadges.length > 0) {
    product.visualBadges = visualBadges
  } else {
    delete product.visualBadges
  }

  return product
}

function storeKeysFromSnapshot(storeId, data = {}) {
  return getPublicStoreKeys(storeId, data, getPublicStoreSlug(data, storeId))
}

async function getDocsByStoreKeys(collectionName, keys) {
  const safeKeys = uniqueArray(keys).slice(0, 30)
  const docs = new Map()

  for (let index = 0; index < safeKeys.length; index += 10) {
    const chunk = safeKeys.slice(index, index + 10)
    const ref = chunk.length === 1
      ? db.collection(collectionName).where('storeId', '==', chunk[0])
      : db.collection(collectionName).where('storeId', 'in', chunk)
    const snapshot = await ref.get()
    snapshot.docs.forEach((doc) => docs.set(doc.id, doc))
  }

  return [...docs.values()]
}

async function commitBatch(actions, summary) {
  if (dryRun || actions.length === 0) return

  for (let index = 0; index < actions.length; index += 450) {
    const batch = db.batch()
    actions.slice(index, index + 450).forEach((action) => {
      if (action.type === 'set') batch.set(action.ref, action.data, { merge: false })
      if (action.type === 'delete') batch.delete(action.ref)
    })
    await batch.commit()
    summary.batchesCommitted += 1
  }
}

async function syncPublicSubcollection({ storeId, collectionName, sourceDocs, isPublic, buildPublic, summaryKey, summary }) {
  const publicRef = db.collection('publicStores').doc(storeId).collection(collectionName)
  const publicSnapshot = await publicRef.get()
  const sourceIds = new Set(sourceDocs.map((doc) => doc.id))
  const actions = []

  for (const sourceDoc of sourceDocs) {
    const data = sourceDoc.data() || {}
    const targetRef = publicRef.doc(sourceDoc.id)

    if (isPublic(data)) {
      actions.push({
        type: 'set',
        ref: targetRef,
        data: buildPublic(data, sourceDoc.id, storeId),
      })
      summary[`${summaryKey}Written`] += 1
    } else {
      actions.push({ type: 'delete', ref: targetRef })
      summary[`${summaryKey}Removed`] += 1
    }
  }

  publicSnapshot.docs.forEach((publicDoc) => {
    if (!sourceIds.has(publicDoc.id)) {
      actions.push({ type: 'delete', ref: publicDoc.ref })
      summary[`${summaryKey}Removed`] += 1
    }
  })

  await commitBatch(actions, summary)
}

async function deletePublicStoreTree(storeId, summary) {
  const publicRef = db.collection('publicStores').doc(storeId)
  const [productsSnapshot, categoriesSnapshot] = await Promise.all([
    publicRef.collection('products').get(),
    publicRef.collection('categories').get(),
  ])

  const actions = [
    ...productsSnapshot.docs.map((doc) => ({ type: 'delete', ref: doc.ref })),
    ...categoriesSnapshot.docs.map((doc) => ({ type: 'delete', ref: doc.ref })),
    { type: 'delete', ref: publicRef },
  ]

  summary.publicStoresRemoved += 1
  summary.productsRemoved += productsSnapshot.size
  summary.categoriesRemoved += categoriesSnapshot.size
  await commitBatch(actions, summary)
}

async function backfillStore(storeDoc, summary) {
  const storeId = storeDoc.id
  const store = storeDoc.data() || {}
  summary.storesScanned += 1

  if (!isStorePubliclyAvailable(store)) {
    await deletePublicStoreTree(storeId, summary)
    console.log(`[publicCatalogBackfill] removed non-public store ${storeId}`)
    return
  }

  const keys = storeKeysFromSnapshot(storeId, store)
  const [productDocs, categoryDocs] = await Promise.all([
    getDocsByStoreKeys('products', keys),
    getDocsByStoreKeys('categories', keys),
  ])

  const profile = {
    ...buildPublicStoreProfile(store, storeId),
    publicUpdatedAt: FieldValue.serverTimestamp(),
  }

  await commitBatch([
    {
      type: 'set',
      ref: db.collection('publicStores').doc(storeId),
      data: profile,
    },
  ], summary)

  summary.publicStoresWritten += 1

  await Promise.all([
    syncPublicSubcollection({
      storeId,
      collectionName: 'products',
      sourceDocs: productDocs,
      isPublic: isPublicProductData,
      buildPublic: buildPublicProduct,
      summaryKey: 'products',
      summary,
    }),
    syncPublicSubcollection({
      storeId,
      collectionName: 'categories',
      sourceDocs: categoryDocs,
      isPublic: isPublicCategoryData,
      buildPublic: buildPublicCategory,
      summaryKey: 'categories',
      summary,
    }),
  ])

  console.log(`[publicCatalogBackfill] synced ${storeId}: ${productDocs.length} products, ${categoryDocs.length} categories`)
}

async function main() {
  const summary = {
    dryRun,
    writeEnabled,
    onlyStoreId: onlyStoreId || null,
    storesScanned: 0,
    publicStoresWritten: 0,
    publicStoresRemoved: 0,
    productsWritten: 0,
    productsRemoved: 0,
    categoriesWritten: 0,
    categoriesRemoved: 0,
    batchesCommitted: 0,
  }

  if (dryRun) {
    console.log('[publicCatalogBackfill] dry run enabled by default; pass --write to commit changes.')
  }

  if (onlyStoreId) {
    const storeDoc = await db.collection('stores').doc(onlyStoreId).get()
    if (!storeDoc.exists) {
      throw new Error(`Store not found: ${onlyStoreId}`)
    }
    await backfillStore(storeDoc, summary)
  } else {
    let query = db.collection('stores').orderBy(admin.firestore.FieldPath.documentId()).limit(100)
    let lastDoc = null

    while (true) {
      const snapshot = await (lastDoc ? query.startAfter(lastDoc).get() : query.get())
      if (snapshot.empty) break

      for (const storeDoc of snapshot.docs) {
        await backfillStore(storeDoc, summary)
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1]
      if (snapshot.size < 100) break
    }
  }

  console.log('[publicCatalogBackfill] summary')
  console.log(JSON.stringify(summary, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[publicCatalogBackfill] failed', error)
    process.exit(1)
  })
