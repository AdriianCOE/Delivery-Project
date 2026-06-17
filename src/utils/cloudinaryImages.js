const CLOUDINARY_UPLOAD_MARKER = '/upload/'

export const CLOUDINARY_IMAGE_VARIANTS = {
  productCardSmall: 'f_auto,q_auto:eco,c_fill,g_auto,w_112,h_112',
  productCardMobile: 'f_auto,q_auto:eco,c_fill,g_auto,w_160,h_160',
  productCard: 'f_auto,q_auto:eco,c_fill,g_auto,w_196,h_196',
  productCardLarge: 'f_auto,q_auto:eco,c_fill,g_auto,w_256,h_256',
  productDetail: 'f_auto,q_auto,c_fit,w_900,h_900',
  storeLogoTiny: 'f_auto,q_auto,c_fit,w_64,h_64',
  storeLogoSmall: 'f_auto,q_auto,c_fit,w_80,h_80',
  storeLogo: 'f_auto,q_auto,c_fit,w_160,h_160',
  storeLogoLarge: 'f_auto,q_auto,c_fit,w_240,h_240',
  storeBannerSmall: 'f_auto,q_auto:eco,c_fill,g_auto,w_800,h_320',
  storeBannerMedium: 'f_auto,q_auto:eco,c_fill,g_auto,w_1200,h_480',
  storeBanner: 'f_auto,q_auto:eco,c_fill,g_auto,w_1200,h_480',
  storeBannerLarge: 'f_auto,q_auto:eco,c_fill,g_auto,w_1400,h_560',
  storeBannerMobileSmall: 'f_auto,q_auto:eco,c_fill,g_auto,w_400,h_200',
  storeBannerMobile: 'f_auto,q_auto:eco,c_fill,g_auto,w_640,h_320',
  storeBannerMobileLarge: 'f_auto,q_auto:eco,c_fill,g_auto,w_800,h_400',
  ogImage: 'f_auto,q_auto,c_fill,g_auto,w_1200,h_630',
}

export const CLOUDINARY_IMAGE_VARIANT_WIDTHS = {
  productCardSmall: 112,
  productCardMobile: 160,
  productCard: 196,
  productCardLarge: 256,
  productDetail: 900,
  storeLogoTiny: 64,
  storeLogoSmall: 80,
  storeLogo: 160,
  storeLogoLarge: 240,
  storeBannerSmall: 800,
  storeBannerMedium: 1200,
  storeBanner: 1200,
  storeBannerLarge: 1400,
  storeBannerMobileSmall: 400,
  storeBannerMobile: 640,
  storeBannerMobileLarge: 800,
  ogImage: 1200,
}

export function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com')
}

export function getCloudinaryImageUrl(url, variant = 'productCard', options = {}) {
  if (!url || typeof url !== 'string') return ''
  if (!isCloudinaryUrl(url)) return url
  if (!url.includes(CLOUDINARY_UPLOAD_MARKER)) return url

  const transform =
    CLOUDINARY_IMAGE_VARIANTS[variant] || CLOUDINARY_IMAGE_VARIANTS.productCard

  const uploadIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER)
  const afterUpload = url.slice(uploadIndex + CLOUDINARY_UPLOAD_MARKER.length)
  const firstSegment = afterUpload.split('/')[0] || ''
  const restOfPath = afterUpload.slice(firstSegment.length).replace(/^\/+/, '')

  const hasWidth = /(^|,)w_\d+($|,)/.test(firstSegment)
  const hasHeight = /(^|,)h_\d+($|,)/.test(firstSegment)
  const hasAnyTransformToken =
    firstSegment.includes('f_') ||
    firstSegment.includes('q_') ||
    firstSegment.includes('c_') ||
    firstSegment.includes('g_') ||
    hasWidth ||
    hasHeight

  if (hasWidth && hasHeight && !options.replaceExistingTransform) return url

  if (hasAnyTransformToken) {
    const beforeTransform = url.slice(0, uploadIndex + CLOUDINARY_UPLOAD_MARKER.length)
    return `${beforeTransform}${transform}/${restOfPath}`
  }

  return url.replace(
    CLOUDINARY_UPLOAD_MARKER,
    `${CLOUDINARY_UPLOAD_MARKER}${transform}/`
  )
}

export function getCloudinaryImageSrcSet(url, variants = [], options = {}) {
  if (!url || typeof url !== 'string' || !isCloudinaryUrl(url)) return ''

  return variants
    .map((variant) => {
      const width = CLOUDINARY_IMAGE_VARIANT_WIDTHS[variant]
      const imageUrl = getCloudinaryImageUrl(url, variant, options)

      return width && imageUrl ? `${imageUrl} ${width}w` : ''
    })
    .filter(Boolean)
    .join(', ')
}
