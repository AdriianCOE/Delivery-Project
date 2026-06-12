import { getAuth } from 'firebase/auth'
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'

import app, { db } from './firebase'

const MEDIA_TYPES = new Set(['logo', 'banner', 'product', 'general'])

function normalizeMediaType(type) {
  return MEDIA_TYPES.has(type) ? type : 'general'
}

function getUploadUrl(uploadResult) {
  if (typeof uploadResult === 'string') return uploadResult
  return uploadResult?.secure_url || uploadResult?.url || ''
}

export async function registerStoreMediaAsset({
  storeId,
  uploadResult,
  type = 'general',
  uploadedBy,
}) {
  const url = getUploadUrl(uploadResult)
  if (!storeId || !url) return null

  const auth = getAuth(app)
  const uid = uploadedBy || auth.currentUser?.uid || null

  const payload = {
    storeId,
    url,
    publicId: uploadResult?.public_id || uploadResult?.publicId || '',
    type: normalizeMediaType(type),
    filename:
      uploadResult?.original_filename ||
      uploadResult?.filename ||
      uploadResult?.public_id ||
      '',
    width: Number(uploadResult?.width || 0) || null,
    height: Number(uploadResult?.height || 0) || null,
    bytes: Number(uploadResult?.bytes || 0) || null,
    format: uploadResult?.format || '',
    createdAt: serverTimestamp(),
    uploadedBy: uid,
    deletedAt: null,
    deletedBy: null,
  }

  const docRef = await addDoc(collection(db, 'stores', storeId, 'media'), payload)
  return { id: docRef.id, ...payload }
}
