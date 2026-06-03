import { httpsCallable } from 'firebase/functions'

import { functions } from './firebase'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const ALLOW_UNSIGNED_FALLBACK =
  String(import.meta.env.VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK || '').toLowerCase() === 'true'

function assertUploadableImage(file) {
  if (!file) {
    throw new Error('Nenhuma imagem selecionada.')
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Arquivo inválido. Envie uma imagem.')
  }
}

async function getSignedUploadConfig(folder) {
  const createSignature = httpsCallable(functions, 'createCloudinaryUploadSignature')
  const result = await createSignature({ folder })
  const data = result?.data || {}

  if (!data.cloudName || !data.apiKey || !data.signature || !data.timestamp || !data.folder) {
    throw new Error('Assinatura de upload inválida.')
  }

  return data
}

async function uploadSignedImage(file, folder) {
  const signedConfig = await getSignedUploadConfig(folder)
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', signedConfig.apiKey)
  formData.append('timestamp', String(signedConfig.timestamp))
  formData.append('signature', signedConfig.signature)
  formData.append('folder', signedConfig.folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signedConfig.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.error?.message || 'Não foi possível enviar a imagem para o Cloudinary.'
    )
  }

  return data
}

async function uploadUnsignedImage(file, folder) {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Configure VITE_CLOUDINARY_CLOUD_NAME no .env')
  }

  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Configure VITE_CLOUDINARY_UPLOAD_PRESET no .env')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.error?.message || 'Não foi possível enviar a imagem para o Cloudinary.'
    )
  }

  return data
}

export async function uploadImageToCloudinary(file, folder = 'PratoBy') {
  assertUploadableImage(file)

  try {
    return await uploadSignedImage(file, folder)
  } catch (error) {
    if (!ALLOW_UNSIGNED_FALLBACK) throw error

    if (import.meta.env.DEV) {
      console.warn('[Cloudinary] Upload assinado falhou; usando fallback unsigned.', error)
    }
  }

  return uploadUnsignedImage(file, folder)
}

export function getCloudinaryOptimizedUrl(url, width = 800) {
  if (!url || typeof url !== 'string') return ''

  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url
  }

  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`)
}
