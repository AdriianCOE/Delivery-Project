import { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://pratoby.com'
const SITE_NAME = 'PratoBy'

const DEFAULT_TITLE = 'PratoBy | Cardápio digital e delivery sem comissão'
const DEFAULT_DESCRIPTION =
  'Crie uma loja online para restaurante, lanchonete ou confeitaria. Receba pedidos pelo seu próprio link, organize entregas e venda sem comissão por pedido.'

const DEFAULT_IMAGE = `${SITE_URL}/og/pratoby-cover.png`
const DEFAULT_FAVICON = `${SITE_URL}/icons/android-chrome-192x192.png?v=5`
const DEFAULT_APPLE_TOUCH_ICON = `${SITE_URL}/icons/apple-touch-icon.png?v=5`

const TWITTER_HANDLE = '@pratobybr'
const DEFAULT_THEME_COLOR = '#F97316'

const SOCIAL_IMAGE_WIDTH = 1200
const SOCIAL_IMAGE_HEIGHT = 630

const STORE_FAVICON_TRANSFORM =
  'f_png,q_auto/e_trim/c_fill,w_164,h_164,g_auto,r_42/c_pad,w_192,h_192,b_transparent'

const STORE_APPLE_ICON_TRANSFORM =
  'f_png,q_auto/e_trim/c_fill,w_156,h_156,g_auto,r_40/c_pad,w_180,h_180,b_transparent'

const SOCIAL_IMAGE_TRANSFORM =
  `f_auto,q_auto,w_${SOCIAL_IMAGE_WIDTH},h_${SOCIAL_IMAGE_HEIGHT},c_fill,g_auto`

const VALID_OG_TYPES = new Set([
  'website',
  'article',
  'profile',
  'business.business',
  'product',
  'restaurant',
])

function cleanText(value, fallback, maxLength = 180) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

  const safe = text || fallback

  if (safe.length <= maxLength) return safe

  return `${safe.slice(0, maxLength - 1).trim()}…`
}

function normalizePath(path) {
  const rawPath = typeof path === 'string' && path.trim()
    ? path.trim()
    : typeof window !== 'undefined'
      ? window.location.pathname
      : '/'

  try {
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      const parsed = new URL(rawPath)
      return normalizePath(parsed.pathname)
    }
  } catch {
    // ignora e normaliza como path comum
  }

  const withoutQuery = rawPath.split('?')[0].split('#')[0]
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const cleanPath = withSlash.replace(/\/{2,}/g, '/')

  if (cleanPath === '/index.html') return '/'
  if (cleanPath.length > 1) return cleanPath.replace(/\/+$/, '')

  return cleanPath
}

function buildAbsoluteUrl(url, fallback = SITE_URL) {
  const rawUrl = String(url || '').trim()
  const fallbackUrl = String(fallback || SITE_URL).trim() || SITE_URL

  if (!rawUrl) return fallbackUrl

  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`
  }

  if (rawUrl.startsWith('/')) {
    return `${SITE_URL}${rawUrl}`
  }

  try {
    const parsed = new URL(rawUrl)

    if (parsed.protocol === 'http:' && parsed.hostname.endsWith('pratoby.com')) {
      parsed.protocol = 'https:'
      return parsed.toString()
    }

    if (parsed.protocol === 'https:') {
      return parsed.toString()
    }

    return fallbackUrl
  } catch {
    return `${SITE_URL}/${rawUrl.replace(/^\/+/, '')}`
  }
}

function isCloudinaryImageUrl(url) {
  return (
    typeof url === 'string' &&
    url.includes('res.cloudinary.com') &&
    url.includes('/image/upload/')
  )
}

function transformCloudinaryUrl(url, transformation) {
  const absoluteUrl = buildAbsoluteUrl(url, '')

  if (!isCloudinaryImageUrl(absoluteUrl)) {
    return absoluteUrl
  }

  const marker = '/image/upload/'
  const markerIndex = absoluteUrl.indexOf(marker)

  if (markerIndex === -1) return absoluteUrl

  const prefix = absoluteUrl.slice(0, markerIndex + marker.length)
  const afterUpload = absoluteUrl.slice(markerIndex + marker.length)

  // Remove qualquer transformação anterior e preserva a URL a partir do /v123...
  const versionMatch = afterUpload.match(/(^|\/)v\d+\//)

  if (versionMatch) {
    const versionIndex =
      versionMatch.index + (versionMatch[0].startsWith('/') ? 1 : 0)

    const suffix = afterUpload.slice(versionIndex)

    return `${prefix}${transformation}/${suffix}`
  }

  return `${prefix}${transformation}/${afterUpload.replace(/^\/+/, '')}`
}

function buildSocialImageUrl(url) {
  const absoluteUrl = buildAbsoluteUrl(url, DEFAULT_IMAGE)

  if (!isCloudinaryImageUrl(absoluteUrl)) {
    return absoluteUrl
  }

  return transformCloudinaryUrl(absoluteUrl, SOCIAL_IMAGE_TRANSFORM)
}

function buildCloudinaryFavicon(url) {
  const absoluteUrl = buildAbsoluteUrl(url, DEFAULT_FAVICON)

  if (!isCloudinaryImageUrl(absoluteUrl)) {
    return absoluteUrl
  }

  return transformCloudinaryUrl(absoluteUrl, STORE_FAVICON_TRANSFORM)
}

function buildAppleTouchIcon(url) {
  const absoluteUrl = buildAbsoluteUrl(url, DEFAULT_FAVICON)

  if (!isCloudinaryImageUrl(absoluteUrl)) {
    return absoluteUrl
  }

  return transformCloudinaryUrl(absoluteUrl, STORE_APPLE_ICON_TRANSFORM)
}

function getImageType(url) {
  const cleanUrl = String(url || '').split('?')[0].toLowerCase()

  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanUrl.endsWith('.webp')) return 'image/webp'
  if (cleanUrl.endsWith('.ico')) return 'image/x-icon'
  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml'

  return 'image/png'
}

function serializeJsonLd(jsonLd) {
  if (!jsonLd) return ''

  try {
    return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
  } catch {
    return ''
  }
}

function normalizeOgType(type) {
  const safeType = String(type || '').trim()

  if (VALID_OG_TYPES.has(safeType)) return safeType

  return 'website'
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  imageAlt,
  favicon = DEFAULT_FAVICON,
  type = 'website',
  noIndex = false,
  noFollow = false,
  robots,
  structuredData,
  jsonLd = null,
  themeColor = DEFAULT_THEME_COLOR,
}) {
  const canonicalPath = useMemo(() => normalizePath(path), [path])

  const canonicalUrl = useMemo(
    () => `${SITE_URL}${canonicalPath}`,
    [canonicalPath]
  )

  const finalTitle = useMemo(
    () => cleanText(title, DEFAULT_TITLE, 70),
    [title]
  )

  const finalDescription = useMemo(
    () => cleanText(description, DEFAULT_DESCRIPTION, 180),
    [description]
  )

  const absoluteImage = useMemo(
    () => buildSocialImageUrl(image),
    [image]
  )

  const faviconUrl = useMemo(
    () => buildCloudinaryFavicon(favicon),
    [favicon]
  )

  const appleTouchIconUrl = useMemo(
    () => favicon === DEFAULT_FAVICON ? DEFAULT_APPLE_TOUCH_ICON : buildAppleTouchIcon(favicon),
    [favicon]
  )

  const finalJsonLd = jsonLd || structuredData

  const serializedJsonLd = useMemo(
    () => serializeJsonLd(finalJsonLd),
    [finalJsonLd]
  )

  const robotsContent = robots
    ? cleanText(robots, '', 180)
    : noIndex
      ? `noindex, ${noFollow ? 'nofollow' : 'follow'}`
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

  const finalImageAlt = cleanText(
    imageAlt || `${finalTitle} - ${SITE_NAME}`,
    `${SITE_NAME} - Cardápio digital`,
    120
  )

  const finalType = normalizeOgType(type)
  const imageType = getImageType(absoluteImage)
  const faviconType = getImageType(faviconUrl)
  const finalThemeColor = cleanText(themeColor, DEFAULT_THEME_COLOR, 20)

  return (
    <Helmet prioritizeSeoTags>
      <html lang="pt-BR" />

      <title>{finalTitle}</title>

      <meta name="description" content={finalDescription} />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      <meta name="theme-color" content={finalThemeColor} />
      <meta name="application-name" content={SITE_NAME} />

      <link rel="canonical" href={canonicalUrl} />

      <link rel="icon" href={faviconUrl} type={faviconType} sizes="192x192" />
      <link rel="shortcut icon" href={faviconUrl} type={faviconType} />
      <link rel="apple-touch-icon" href={appleTouchIconUrl} sizes="180x180" />

      <meta property="og:locale" content="pt_BR" />
      <meta property="og:type" content={finalType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:url" content={absoluteImage} />
      <meta property="og:image:secure_url" content={absoluteImage} />
      <meta property="og:image:type" content={imageType} />
      <meta property="og:image:width" content={String(SOCIAL_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(SOCIAL_IMAGE_HEIGHT)} />
      <meta property="og:image:alt" content={finalImageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:image:alt" content={finalImageAlt} />

      {serializedJsonLd && (
        <script
          type="application/ld+json"
          data-pratoby-jsonld="true"
        >
          {serializedJsonLd}
        </script>
      )}
    </Helmet>
  )
}
