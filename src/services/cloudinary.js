import { httpsCallable } from 'firebase/functions'

import { functions } from './firebase'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const ALLOW_UNSIGNED_FALLBACK =
  String(import.meta.env.VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK || '').toLowerCase() === 'true'
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
const CAN_USE_UNSIGNED_FALLBACK = ALLOW_UNSIGNED_FALLBACK && !import.meta.env.PROD

if (ALLOW_UNSIGNED_FALLBACK && import.meta.env.DEV) {
  console.warn('[Cloudinary] Fallback unsigned ativo apenas para desenvolvimento local.')
}

if (ALLOW_UNSIGNED_FALLBACK && import.meta.env.PROD) {
  console.warn('[Cloudinary] VITE_CLOUDINARY_ALLOW_UNSIGNED_FALLBACK ignorado em producao.')
}

function assertUploadableImage(file) {
  if (!file) {
    throw new Error('Nenhuma imagem selecionada.')
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Arquivo inválido. Envie uma imagem.')
  }

  if (Number(file.size || 0) > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('Imagem muito grande. Envie uma imagem de ate 10 MB.')
  }
}

function getSignedUploadError(error) {
  if (import.meta.env.DEV) {
    console.warn('[Cloudinary] Upload assinado falhou.', error)
  }

  return new Error(
    'Nao foi possivel preparar o envio seguro da imagem. Tente novamente ou avise o suporte.'
  )
}

async function getSignedUploadConfig(folder, options = {}) {
  const createSignature = httpsCallable(functions, 'createCloudinaryUploadSignature')
  const result = await createSignature({ folder, storeId: options.storeId || '' })
  const data = result?.data || {}

  if (!data.cloudName || !data.apiKey || !data.signature || !data.timestamp || !data.folder) {
    throw new Error('Assinatura de upload inválida.')
  }

  return data
}

async function uploadSignedImage(file, folder, options = {}) {
  const signedConfig = await getSignedUploadConfig(folder, options)
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

export async function uploadImageToCloudinary(file, folder = 'PratoBy', options = {}) {
  assertUploadableImage(file)

  try {
    return await uploadSignedImage(file, folder, options)
  } catch (error) {
    if (!CAN_USE_UNSIGNED_FALLBACK) throw getSignedUploadError(error)

    if (import.meta.env.DEV) {
      console.warn('[Cloudinary] Upload assinado falhou; usando fallback unsigned.', error)
    }
  }

  return uploadUnsignedImage(file, folder)
}

export function getCloudinaryOptimizedUrl(url, widthOrOptions = 800) {
  if (!url || typeof url !== 'string') return ''

  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url
  }

  const options =
    typeof widthOrOptions === 'object' && widthOrOptions !== null
      ? widthOrOptions
      : { width: widthOrOptions }

  const width = Number(options.width || 800)
  const height = Number(options.height || 0)
  const crop = options.crop || (height ? 'fill' : 'limit')
  const transforms = ['f_auto', 'q_auto', `c_${crop}`, `w_${width}`]

  if (height) {
    transforms.push(`h_${height}`)
  }

  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}
