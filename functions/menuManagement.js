'use strict'

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { getStorePlanLimit, hasPlanFeature } = require('./shared/planAccess')

const COLLECTIONS = {
  product: 'products',
  category: 'categories',
}

const LIMIT_KEYS = {
  product: 'products',
  category: 'categories',
}

const ALLOWED_FIELDS = {
  product: new Set([
    'name', 'description', 'categoryId',
    'priceCents', 'oldPriceCents',
    'imageUrl', 'imagePublicId', 'images', 'imageUrls', 'gallery',
    'isActive', 'isAvailable', 'isVisible', 'hidden', 'isDeleted',
    'isFeatured', 'isPopular', 'isPromotion',
    'acceptsCoupons', 'showCouponBadge',
    'serving', 'visualBadges', 'order', 'position', 'preparationTime',
    'optionGroups', 'extras', 'scheduling', 'stock',
  ]),
  category: new Set([
    'name', 'description', 'isActive', 'isVisible', 'isDeleted',
    'order', 'position', 'imageUrl', 'icon',
  ]),
}

function isAnonymousAuth(request) {
  const firebaseToken = request.auth?.token?.firebase || {}
  return firebaseToken.sign_in_provider === 'anonymous'
    || request.auth?.token?.sign_in_provider === 'anonymous'
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'lojista') return 'merchant'
  if (role === 'dev') return 'developer'
  return role
}

function uniqueTruthy(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function assertCanManageStore(storeData, userData, uid) {
  const role = normalizeRole(userData?.role)
  if (role === 'admin' || role === 'developer') return

  const ownerUids = uniqueTruthy([
    storeData?.ownerId,
    storeData?.ownerUid,
    storeData?.userId,
    ...(Array.isArray(storeData?.merchantUids) ? storeData.merchantUids : []),
  ])
  if (ownerUids.includes(uid)) return

  const userStoreIds = uniqueTruthy([
    userData?.storeId,
    ...(Array.isArray(userData?.storeIds) ? userData.storeIds : []),
  ])
  const storeIds = uniqueTruthy([
    storeData?.id,
    storeData?.storeId,
    storeData?.storeDocId,
  ])
  if (userStoreIds.some((value) => storeIds.includes(value))) return

  throw new HttpsError('permission-denied', 'Voce nao tem permissao para alterar esta loja.')
}

function cleanValue(value, depth = 0) {
  if (value === undefined || typeof value === 'function') return undefined
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().slice(0, 5000)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (depth > 8) return undefined

  if (Array.isArray(value)) {
    return value
      .slice(0, 200)
      .map((item) => cleanValue(item, depth + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return result
      const cleaned = cleanValue(entry, depth + 1)
      if (cleaned !== undefined) result[key] = cleaned
      return result
    }, {})
  }

  return undefined
}

function sanitizeDeliveryFees(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Taxas de entrega invalidas.')
  }

  const entries = Object.entries(value)
  if (entries.length > 300) {
    throw new HttpsError('invalid-argument', 'Limite de bairros excedido.')
  }

  return entries.reduce((fees, [rawNeighborhood, rawFee]) => {
    const neighborhood = String(rawNeighborhood || '').trim().slice(0, 80)
    if (!neighborhood || ['__proto__', 'prototype', 'constructor'].includes(neighborhood)) {
      throw new HttpsError('invalid-argument', 'Bairro invalido nas taxas de entrega.')
    }
    if (rawFee === null || rawFee === '') {
      fees[neighborhood] = null
      return fees
    }

    const fee = Number(rawFee)
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
      throw new HttpsError('invalid-argument', `Taxa de entrega invalida para "${neighborhood}".`)
    }
    fees[neighborhood] = Math.round(fee * 100) / 100
    return fees
  }, {})
}

function sanitizeMenuPayload(entityType, payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpsError('invalid-argument', 'Dados do item invalidos.')
  }

  const allowed = ALLOWED_FIELDS[entityType]
  const cleanPayload = Object.entries(payload).reduce((result, [key, value]) => {
    if (!allowed.has(key)) return result
    const cleaned = cleanValue(value)
    if (cleaned !== undefined) result[key] = cleaned
    return result
  }, {})

  if (Object.prototype.hasOwnProperty.call(cleanPayload, 'name')) {
    cleanPayload.name = String(cleanPayload.name || '').trim()
  }
  const maxNameLength = entityType === 'product' ? 120 : 60
  if ((!partial && !cleanPayload.name) || cleanPayload.name?.length > maxNameLength) {
    throw new HttpsError('invalid-argument', 'Informe um nome valido para o item.')
  }

  if (entityType === 'product') {
    if (!partial || Object.prototype.hasOwnProperty.call(cleanPayload, 'priceCents')) {
      const priceCents = Number(cleanPayload.priceCents)
      if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000) {
        throw new HttpsError('invalid-argument', 'Preco do produto invalido.')
      }
      cleanPayload.priceCents = priceCents
      cleanPayload.price = priceCents / 100
    }

    if (Object.prototype.hasOwnProperty.call(cleanPayload, 'oldPriceCents')) {
      if (cleanPayload.oldPriceCents === null) {
        cleanPayload.oldPrice = null
      } else {
        const oldPriceCents = Number(cleanPayload.oldPriceCents)
        if (!Number.isInteger(oldPriceCents) || oldPriceCents < 0 || oldPriceCents > 100000000) {
          throw new HttpsError('invalid-argument', 'Preco anterior do produto invalido.')
        }
        cleanPayload.oldPriceCents = oldPriceCents
        cleanPayload.oldPrice = oldPriceCents / 100
      }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(cleanPayload, 'acceptsCoupons')) {
      cleanPayload.acceptsCoupons = cleanPayload.acceptsCoupons !== false
    }
  }

  return cleanPayload
}

function deriveProductCategoryName(categorySnapshot, storeId) {
  if (!categorySnapshot?.exists) {
    throw new HttpsError('not-found', 'Categoria nao encontrada.')
  }

  const categoryData = categorySnapshot.data() || {}
  if (String(categoryData.storeId || '') !== storeId) {
    throw new HttpsError('permission-denied', 'Categoria nao pertence a esta loja.')
  }
  if (categoryData.isDeleted === true || categoryData.deletedAt) {
    throw new HttpsError('failed-precondition', 'Categoria excluida nao pode receber produtos.')
  }

  return String(categoryData.name || '').trim().slice(0, 60)
}

function countsTowardPlan(data = {}) {
  return data.isDeleted !== true
    && !data.deletedAt
    && data.isActive !== false
    && data.isVisible !== false
    && data.hidden !== true
}

function increasesPlanUsage(currentData, nextData, currentExists) {
  return countsTowardPlan(nextData)
    && (!currentExists || !countsTowardPlan(currentData))
}

function productUsesScheduling(data = {}) {
  return data.orderMode === 'scheduled_only'
    || data.availabilityMode === 'scheduled_only'
    || ['scheduled_only', 'asap_and_scheduled'].includes(data.scheduling?.mode)
    || data.scheduling?.orderMode === 'scheduled_only'
    || data.scheduling?.prepaymentPolicy === 'pix_required'
}

function assertProductPlanFields(storeData, productData) {
  if (productUsesScheduling(productData) && !hasPlanFeature(storeData, 'scheduling')) {
    throw new HttpsError('failed-precondition', 'Agendamento exige plano Profissional ou Premium.')
  }

  const imageLimit = getStorePlanLimit(storeData, 'productImagesPerItem')
  for (const field of ['images', 'imageUrls', 'gallery']) {
    if (Array.isArray(productData[field]) && productData[field].length > imageLimit) {
      throw new HttpsError(
        'failed-precondition',
        `Seu plano permite ate ${imageLimit} imagem(ns) por produto.`
      )
    }
  }
}

function createMenuManagementFunctions({ db, admin, logger }) {
  const saveMenuItem = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30, memory: '256MiB', maxInstances: 10 },
    async (request) => {
      const uid = request.auth?.uid
      if (!uid || isAnonymousAuth(request)) {
        throw new HttpsError('unauthenticated', 'Acesso negado.')
      }

      const data = request.data || {}
      const storeId = String(data.storeId || '').trim()
      const entityType = String(data.entityType || '').trim().toLowerCase()
      const entityId = String(data.entityId || '').trim()
      const collectionName = COLLECTIONS[entityType]

      if (!storeId || !collectionName) {
        throw new HttpsError('invalid-argument', 'Loja e tipo do item sao obrigatorios.')
      }

      const [userSnapshot, storeSnapshot] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('stores').doc(storeId).get(),
      ])
      if (!userSnapshot.exists) throw new HttpsError('permission-denied', 'Usuario nao encontrado.')
      if (!storeSnapshot.exists) throw new HttpsError('not-found', 'Loja nao encontrada.')

      const storeData = { id: storeSnapshot.id, ...(storeSnapshot.data() || {}) }
      assertCanManageStore(storeData, userSnapshot.data() || {}, uid)

      const payload = sanitizeMenuPayload(entityType, data.payload, { partial: Boolean(entityId) })
      const collectionRef = db.collection(collectionName)
      const itemRef = entityId ? collectionRef.doc(entityId) : collectionRef.doc()
      const limit = getStorePlanLimit(storeData, LIMIT_KEYS[entityType])
      const now = admin.firestore.FieldValue.serverTimestamp()

      await db.runTransaction(async (transaction) => {
        const currentSnapshot = entityId ? await transaction.get(itemRef) : null
        if (entityId && !currentSnapshot.exists) {
          throw new HttpsError('not-found', 'Item nao encontrado.')
        }

        const currentData = currentSnapshot?.data() || {}
        if (entityId && String(currentData.storeId || '') !== storeId) {
          throw new HttpsError('permission-denied', 'Item nao pertence a esta loja.')
        }

        if (entityType === 'product' && Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
          payload.categoryId = String(payload.categoryId || '').trim()
          payload.categoryName = ''
          if (payload.categoryId) {
            const categorySnapshot = await transaction.get(
              db.collection('categories').doc(payload.categoryId)
            )
            payload.categoryName = deriveProductCategoryName(categorySnapshot, storeId)
          }
        }

        const nextData = {
          ...currentData,
          ...payload,
          storeId,
          storeDocId: storeId,
          storeSlug: String(storeData.storeSlug || storeData.slug || '').trim(),
          storeKeys: uniqueTruthy([storeId, storeData.storeSlug, storeData.slug]),
          updatedAt: now,
          updatedBy: uid,
          ...(entityId ? {} : { createdAt: now, createdBy: uid }),
        }
        const restoresDeletedItem = Boolean(
          entityId
          && (currentData.isDeleted === true || currentData.deletedAt)
          && payload.isDeleted === false
        )
        if (restoresDeletedItem) nextData.deletedAt = null

        if (!String(nextData.name || '').trim()) {
          throw new HttpsError('invalid-argument', 'Informe um nome valido para o item.')
        }
        if (entityType === 'product' && (!Number.isInteger(nextData.priceCents) || nextData.priceCents < 0)) {
          throw new HttpsError('invalid-argument', 'Preco do produto invalido.')
        }
        if (entityType === 'product') assertProductPlanFields(storeData, nextData)

        const increasesUsage = increasesPlanUsage(currentData, nextData, Boolean(currentSnapshot))
        if (increasesUsage) {
          // ponytail: scan limitado pelo teto atual de 1000 itens; usar contador transacional se esse teto crescer.
          const querySnapshot = await transaction.get(collectionRef.where('storeId', '==', storeId))
          const currentCount = querySnapshot.docs.reduce(
            (total, snapshot) => total + (snapshot.id !== entityId && countsTowardPlan(snapshot.data()) ? 1 : 0),
            0
          )
          if (limit <= 0 || currentCount >= limit) {
            throw new HttpsError(
              'failed-precondition',
              `Limite do plano atingido. Seu plano permite ate ${limit} ${entityType === 'product' ? 'produtos' : 'categorias'} publicaveis. Faca upgrade para adicionar mais.`,
              { reason: 'plan_limit_reached', entityType, limit, currentCount }
            )
          }
        }

        transaction.set(
          itemRef,
          restoresDeletedItem
            ? { ...nextData, deletedAt: admin.firestore.FieldValue.delete() }
            : nextData,
          { merge: Boolean(entityId) }
        )
      })

      logger?.info?.('[saveMenuItem] saved', { uid, storeId, entityType, entityId: itemRef.id })
      return { ok: true, id: itemRef.id }
    }
  )

  return { saveMenuItem }
}

module.exports = {
  countsTowardPlan,
  deriveProductCategoryName,
  increasesPlanUsage,
  sanitizeDeliveryFees,
  sanitizeMenuPayload,
  createMenuManagementFunctions,
}
