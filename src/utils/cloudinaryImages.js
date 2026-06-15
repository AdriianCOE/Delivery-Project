const CLOUDINARY_UPLOAD_MARKER = '/upload/'

export const CLOUDINARY_IMAGE_VARIANTS = {
  productCardSmall: 'f_auto,q_auto,c_fit,w_128,h_128',
  productCard: 'f_auto,q_auto,c_fit,w_196,h_196',
  productCardLarge: 'f_auto,q_auto,c_fit,w_320,h_320',
  productDetail: 'f_auto,q_auto,c_fit,w_900,h_900',
  storeLogoTiny: 'f_auto,q_auto,c_fit,w_64,h_64',
  storeLogoSmall: 'f_auto,q_auto,c_fit,w_96,h_96',
  storeLogo: 'f_auto,q_auto,c_fit,w_160,h_160',
  storeLogoLarge: 'f_auto,q_auto,c_fit,w_240,h_240',
  storeBannerSmall: 'f_auto,q_auto:good,c_fill,g_auto,w_640,h_213',
  storeBannerMedium: 'f_auto,q_auto:good,c_fill,g_auto,w_960,h_320',
  storeBanner: 'f_auto,q_auto:best,c_fill,g_auto,w_1440,h_480',
  storeBannerLarge: 'f_auto,q_auto:best,c_fill,g_auto,w_1600,h_533',
  storeBannerMobileSmall: 'f_auto,q_auto:good,c_fill,g_auto,w_480,h_320',
  storeBannerMobile: 'f_auto,q_auto:best,c_fill,g_auto,w_800,h_533',
  storeBannerMobileLarge: 'f_auto,q_auto:best,c_fill,g_auto,w_1080,h_720',
  ogImage: 'f_auto,q_auto,c_fill,g_auto,w_1200,h_630',
}

export const CLOUDINARY_IMAGE_VARIANT_WIDTHS = {
  productCardSmall: 128,
  productCard: 196,
  productCardLarge: 320,
  productDetail: 900,
  storeLogoTiny: 64,
  storeLogoSmall: 96,
  storeLogo: 160,
  storeLogoLarge: 240,
  storeBannerSmall: 640,
  storeBannerMedium: 960,
  storeBanner: 1440,
  storeBannerLarge: 1600,
  storeBannerMobileSmall: 480,
  storeBannerMobile: 800,
  storeBannerMobileLarge: 1080,
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

  const alreadyHasTransform =
    firstSegment.includes('f_auto') ||
    firstSegment.includes('q_auto') ||
    /(^|,)w_\d+($|,)/.test(firstSegment) ||
    /(^|,)h_\d+($|,)/.test(firstSegment) ||
    firstSegment.includes('c_fill') ||
    firstSegment.includes('c_fit') ||
    firstSegment.includes('c_limit')

  if (alreadyHasTransform) {
    if (!options.replaceExistingTransform) return url

    const beforeTransform = url.slice(0, uploadIndex + CLOUDINARY_UPLOAD_MARKER.length)
    const afterTransform = afterUpload.slice(firstSegment.length).replace(/^\/+/, '')

    return `${beforeTransform}${transform}/${afterTransform}`
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
