const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadImageToCloudinary(file, folder = 'PratoBy') {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Configure VITE_CLOUDINARY_CLOUD_NAME no .env')
  }

  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Configure VITE_CLOUDINARY_UPLOAD_PRESET no .env')
  }

  if (!file) {
    throw new Error('Nenhuma imagem selecionada.')
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Arquivo inválido. Envie uma imagem.')
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

export function getCloudinaryOptimizedUrl(url, width = 800) {
  if (!url || typeof url !== 'string') return ''

  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url
  }

  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`)
}

