'use strict'

/**
 * storeTables.js
 * Handlers for store table (QR Code) callables.
 * Tables are written ONLY via these handlers — never directly by the client.
 *
 * Subcollection: stores/{storeId}/tables/{tableId}
 * Schema:
 *   label      string    e.g. "Mesa 4" or "Balcão"
 *   number     string    e.g. "4"
 *   token      string    e.g. "t_3f8ac1b2" — generated here, immutable after create
 *   isActive   boolean   true = active; false = archived
 *   isArchived boolean   true when archived via archiveStoreTable
 *   storeId    string    parent storeId (denormalized for safety)
 *   createdBy  string    uid of creator
 *   createdAt  timestamp
 *   updatedAt  timestamp
 */

const crypto = require('crypto')
const { hasPlanFeature } = require('./shared/planAccess')

const LABEL_MAX_LEN = 60
const NUMBER_MAX_LEN = 20

/**
 * Sanitize a string field: trim, enforce maxLength, reject empty if required.
 */
function sanitizeStr(value, field, { maxLen = 60, required = false } = {}) {
  const str = String(value || '').trim().slice(0, maxLen)
  if (required && !str) {
    throw Object.assign(new Error(`${field} é obrigatório.`), { code: 'invalid-argument' })
  }
  return str
}

/**
 * Assert the caller is authenticated (non-anonymous).
 */
function assertAuthenticated(request, HttpsError) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Autenticacao necessaria.')
  }
  // Reject anonymous sign-in
  const provider = request.auth.token?.firebase?.sign_in_provider || ''
  if (provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Autenticacao anonima nao permitida.')
  }
}

/**
 * Assert the caller can manage the given storeId by checking the stores doc.
 * Mirrors the permission check used in other callables in index.js.
 */
async function assertCanManageStore(db, HttpsError, uid, storeId) {
  const storeRef = db.collection('stores').doc(storeId)
  const storeSnap = await storeRef.get()

  if (!storeSnap.exists) {
    throw new HttpsError('not-found', 'Loja nao encontrada.')
  }

  const storeData = storeSnap.data() || {}

  const allowed =
    storeData.ownerId === uid ||
    storeData.ownerUid === uid ||
    (Array.isArray(storeData.allowedUserIds) && storeData.allowedUserIds.includes(uid)) ||
    (Array.isArray(storeData.merchantUids) && storeData.merchantUids.includes(uid))

  if (!allowed) {
    throw new HttpsError('permission-denied', 'Acesso nao autorizado a esta loja.')
  }

  return storeData
}

function assertTableQrAllowed(HttpsError, storeData) {
  if (hasPlanFeature(storeData, 'tableQrCode')) return
  throw new HttpsError('failed-precondition', 'QR Code de mesa exige plano Premium.')
}

/**
 * Generate a unique table token: "t_" + 12 hex chars (6 bytes).
 * Backend-generated; never trusted from client input.
 */
function generateTableToken() {
  return 't_' + crypto.randomBytes(6).toString('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// createStoreTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new table entry under stores/{storeId}/tables.
 *
 * Input:
 *   { storeId: string, label: string, number?: string }
 *
 * Returns:
 *   { ok: true, tableId: string, token: string }
 */
async function createStoreTableHandler({ db, HttpsError, logger }, request) {
  assertAuthenticated(request, HttpsError)

  const uid = request.auth.uid
  const storeId = sanitizeStr(request.data?.storeId, 'storeId', { required: true, maxLen: 120 })
  const label = sanitizeStr(request.data?.label, 'label', { required: true, maxLen: LABEL_MAX_LEN })
  const number = sanitizeStr(request.data?.number, 'number', { required: false, maxLen: NUMBER_MAX_LEN })

  const storeData = await assertCanManageStore(db, HttpsError, uid, storeId)
  assertTableQrAllowed(HttpsError, storeData)

  const token = generateTableToken()
  const now = require('firebase-admin').firestore.FieldValue.serverTimestamp()

  const tablesRef = db.collection('stores').doc(storeId).collection('tables')

  // Optionally reject duplicate label within same store (non-blocking — UX handles it)
  const tableRef = tablesRef.doc()
  await tableRef.set({
    storeId,
    label,
    number,
    token,
    isActive: true,
    isArchived: false,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })

  logger.info('[storeTables] createStoreTable', { storeId, tableId: tableRef.id, uid })

  return { ok: true, tableId: tableRef.id, token }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStoreTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates label and/or number of an existing table. Token is immutable.
 *
 * Input:
 *   { storeId: string, tableId: string, label?: string, number?: string, isActive?: boolean }
 *
 * Returns:
 *   { ok: true, tableId: string }
 */
async function updateStoreTableHandler({ db, HttpsError, logger }, request) {
  assertAuthenticated(request, HttpsError)

  const uid = request.auth.uid
  const storeId = sanitizeStr(request.data?.storeId, 'storeId', { required: true, maxLen: 120 })
  const tableId = sanitizeStr(request.data?.tableId, 'tableId', { required: true, maxLen: 120 })

  const storeData = await assertCanManageStore(db, HttpsError, uid, storeId)

  const tableRef = db.collection('stores').doc(storeId).collection('tables').doc(tableId)
  const tableSnap = await tableRef.get()

  if (!tableSnap.exists) {
    throw new HttpsError('not-found', 'Mesa nao encontrada.')
  }

  if (request.data?.isActive !== false) {
    assertTableQrAllowed(HttpsError, storeData)
  }

  const patch = {
    updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
  }

  if (request.data?.label !== undefined) {
    patch.label = sanitizeStr(request.data.label, 'label', { required: true, maxLen: LABEL_MAX_LEN })
  }

  if (request.data?.number !== undefined) {
    patch.number = sanitizeStr(request.data.number, 'number', { required: false, maxLen: NUMBER_MAX_LEN })
  }

  if (typeof request.data?.isActive === 'boolean') {
    patch.isActive = request.data.isActive
  }

  await tableRef.update(patch)

  logger.info('[storeTables] updateStoreTable', { storeId, tableId, uid, patch: Object.keys(patch) })

  return { ok: true, tableId }
}

// ─────────────────────────────────────────────────────────────────────────────
// archiveStoreTable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft-deletes a table: sets isArchived=true, isActive=false.
 * The document is preserved; the QR token becomes unreachable in future flow.
 *
 * Input:
 *   { storeId: string, tableId: string }
 *
 * Returns:
 *   { ok: true, tableId: string }
 */
async function archiveStoreTableHandler({ db, HttpsError, logger }, request) {
  assertAuthenticated(request, HttpsError)

  const uid = request.auth.uid
  const storeId = sanitizeStr(request.data?.storeId, 'storeId', { required: true, maxLen: 120 })
  const tableId = sanitizeStr(request.data?.tableId, 'tableId', { required: true, maxLen: 120 })

  await assertCanManageStore(db, HttpsError, uid, storeId)

  const tableRef = db.collection('stores').doc(storeId).collection('tables').doc(tableId)
  const tableSnap = await tableRef.get()

  if (!tableSnap.exists) {
    throw new HttpsError('not-found', 'Mesa nao encontrada.')
  }

  const now = require('firebase-admin').firestore.FieldValue.serverTimestamp()
  await tableRef.update({
    isActive: false,
    isArchived: true,
    archivedBy: uid,
    archivedAt: now,
    updatedAt: now,
  })

  logger.info('[storeTables] archiveStoreTable', { storeId, tableId, uid })

  return { ok: true, tableId }
}

module.exports = {
  createStoreTableHandler,
  updateStoreTableHandler,
  archiveStoreTableHandler,
}
