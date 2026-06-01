import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://pratoby.com'
const DEFAULT_IMAGE = `${SITE_URL}/og/pratoby-cover.png`
const DEFAULT_FAVICON = '/favicon.ico'
const HEAD_DEDUPE_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[name="googlebot"]',
  'link[rel="canonical"]',
  'meta[property="og:locale"]',
  'meta[property="og:type"]',
  'meta[property="og:site_name"]',
  'meta[property="og:url"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image:type"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:image:alt"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
]

function dedupeHeadElements() {
  if (typeof document === 'undefined') return

  HEAD_DEDUPE_SELECTORS.forEach((selector) => {
    const nodes = Array.from(document.head.querySelectorAll(selector))

    nodes.slice(0, -1).forEach((node) => node.remove())
  })
}

function buildCloudinaryFavicon(url) {
  if (!url || typeof url !== 'string') return DEFAULT_FAVICON

  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url
  }

  return url.replace(
    '/image/upload/',
    '/image/upload/f_png,w_96,h_96,c_pad,b_white,r_18/'
  )
}

export default function SEO({
  title = 'PratoBy',
  description = 'Venda mais com o PratoBy! Crie um cardápio digital moderno, receba pedidos online pelo seu próprio link e não pague comissão por pedido.',
  path = '/',
  image = DEFAULT_IMAGE,
  imageAlt,
  favicon = DEFAULT_FAVICON,
  type = 'website',
  noIndex = false,
}) {
  const canonicalUrl = `${SITE_URL}${path}`
  const faviconUrl = buildCloudinaryFavicon(favicon)
  const robotsContent = noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large'
  const finalImageAlt = imageAlt || `${title} - PratoBy`

  useEffect(() => {
    const timer = window.setTimeout(dedupeHeadElements, 0)

    return () => window.clearTimeout(timer)
  }, [description, finalImageAlt, image, noIndex, path, title, type])

  return (
    <Helmet>
      <title>{title}</title>

      <meta name="description" content={description} />

      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />

      <link rel="canonical" href={canonicalUrl} />

      {/* Favicon dinâmico */}
      <link rel="icon" href={faviconUrl} sizes="any" />
      <link rel="shortcut icon" href={faviconUrl} />
      <link rel="apple-touch-icon" href={faviconUrl} />

      <meta property="og:locale" content="pt_BR" />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="PratoBy" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta
        property="og:image:alt"
        content={finalImageAlt}
      />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={finalImageAlt} />
    </Helmet>
  )
}
