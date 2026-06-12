const CLOUDINARY_UPLOAD_MARKER = '/upload/'

export const CLOUDINARY_IMAGE_VARIANTS = {
  productCard: 'f_auto,q_auto,c_fill,g_auto,w_196,h_196',
  productDetail: 'f_auto,q_auto,c_fit,w_900,h_900',
  storeLogo: 'f_auto,q_auto,c_fit,w_160,h_160',
  storeLogoSmall: 'f_auto,q_auto,c_fit,w_80,h_80',
  storeBanner: 'f_auto,q_auto,c_fill,g_auto,w_1200,h_480',
  storeBannerMobile: 'f_auto,q_auto,c_fill,g_auto,w_800,h_320',
  ogImage: 'f_auto,q_auto,c_fill,g_auto,w_1200,h_630',
}

export function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com')
}

export function getCloudinaryImageUrl(url, variant = 'productCard') {
  if (!url || typeof url !== 'string') return ''
  if (!isCloudinaryUrl(url)) return url
  if (!url.includes(CLOUDINARY_UPLOAD_MARKER)) return url

  const transform =
    CLOUDINARY_IMAGE_VARIANTS[variant] || CLOUDINARY_IMAGE_VARIANTS.productCard

  const uploadIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER)
  const afterUpload = url.slice(uploadIndex + CLOUDINARY_UPLOAD_MARKER.length)
  const firstSegment = afterUpload.split('/')[0] || ''

  const alreadyHasTransform =
    firstSegment.includes('f_auto') ||
    firstSegment.includes('q_auto') ||
    /(^|,)w_\d+($|,)/.test(firstSegment) ||
    /(^|,)h_\d+($|,)/.test(firstSegment) ||
    firstSegment.includes('c_fill') ||
    firstSegment.includes('c_fit') ||
    firstSegment.includes('c_limit')

  if (alreadyHasTransform) return url

  return url.replace(
    CLOUDINARY_UPLOAD_MARKER,
    `${CLOUDINARY_UPLOAD_MARKER}${transform}/`
  )
}