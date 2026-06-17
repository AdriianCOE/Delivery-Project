import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SEO from '../../components/seo/SEO'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { AnimatePresence, motion } from 'motion/react'

import {
  FiAlertCircle,
  FiArrowUp,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiCopy,
  FiGrid,
  FiMapPin,
  FiMessageCircle,
  FiSearch,
  FiSettings,
  FiShare2,
  FiShoppingCart,
  FiArrowLeft,
  FiRefreshCw,
  FiStar,
  FiHeart,
  FiInfo,
  FiUser,
  FiX,
} from 'react-icons/fi'

import { db, functions } from '../../services/firebase'
import { useCart } from '../../contexts/CartContext'

import ProductCard from './ProductCard'
import {
  getStoreDocId,
  getStorePublicSlug,
} from '../../utils/storeIdentity'
import { getCloudinaryImageUrl } from '../../utils/cloudinaryImages'
import { shouldShowProductInStorefront } from '../../utils/productStatus'
import StoreHeader from './StoreHeader'
import StoreFooter from '../../components/layouts/StoreFooter'

const MerchantDrawer = lazy(() => import('./MerchantDrawer'))
const CartDrawer = lazy(() => import('./CartDrawer'))
const CustomerDrawer = lazy(() => import('./CustomerDrawer'))
const ProductOptionsModal = lazy(() => import('./ProductOptionsModal'))

const BRAND_GREEN = '#f97316'
const SITE_URL = 'https://pratoby.com'

const NOINDEX_STORE_SLUGS = new Set([
])

const OFFICIAL_DEMO_STORE_SLUGS = new Set([
  'capivaras-lanches',
  'doce-capivara-confeitaria',
])

function shouldNoIndexStorefront(slugValue, storeData) {
  const candidates = [
    slugValue,
    storeData?.slug,
    storeData?.storeSlug,
    storeData?.publicSlug,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  if (candidates.some((candidate) => NOINDEX_STORE_SLUGS.has(candidate))) {
    return true
  }

  if (isStoreUnavailable(storeData)) return true

  const explicitIndexingValue =
    storeData?.seoIndexingEnabled ??
    storeData?.allowSearchIndexing ??
    storeData?.isIndexable ??
    storeData?.searchIndexingEnabled

  if (explicitIndexingValue === true) return false
  if (explicitIndexingValue === false) return true

  if (candidates.some((candidate) => OFFICIAL_DEMO_STORE_SLUGS.has(candidate))) {
    return false
  }

  return true
}

function titleFromSlug(value) {
  const text = String(value || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[-_]+/g, ' ')
    .trim()

  if (!text) return 'Cardápio digital'

  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// --- FUNÇÕES AUXILIARES DE HORÁRIO ---
const WEEK_DAYS = [
  {
    key: 'sun',
    legacyKey: 'sunday',
    short: 'Dom',
    label: 'Domingo',
    aliases: ['sun', 'sunday', 'domingo', 'dom'],
  },
  {
    key: 'mon',
    legacyKey: 'monday',
    short: 'Seg',
    label: 'Segunda',
    aliases: ['mon', 'monday', 'segunda', 'seg'],
  },
  {
    key: 'tue',
    legacyKey: 'tuesday',
    short: 'Ter',
    label: 'Terça',
    aliases: ['tue', 'tuesday', 'terca', 'terça', 'ter'],
  },
  {
    key: 'wed',
    legacyKey: 'wednesday',
    short: 'Qua',
    label: 'Quarta',
    aliases: ['wed', 'wednesday', 'quarta', 'qua'],
  },
  {
    key: 'thu',
    legacyKey: 'thursday',
    short: 'Qui',
    label: 'Quinta',
    aliases: ['thu', 'thursday', 'quinta', 'qui'],
  },
  {
    key: 'fri',
    legacyKey: 'friday',
    short: 'Sex',
    label: 'Sexta',
    aliases: ['fri', 'friday', 'sexta', 'sex'],
  },
  {
    key: 'sat',
    legacyKey: 'saturday',
    short: 'Sáb',
    label: 'Sábado',
    aliases: ['sat', 'saturday', 'sabado', 'sábado', 'sab'],
  },
]

function getDayKey(day) {
  const normalized = normalizeText(day)

  const found = WEEK_DAYS.find((item) =>
    [
      item.key,
      item.legacyKey,
      item.short,
      item.label,
      ...item.aliases,
    ].some((alias) => normalizeText(alias) === normalized)
  )

  return found?.key || normalized
}

function getTodayKey() {
  return WEEK_DAYS[new Date().getDay()]?.key || 'sun'
}

function normalizeTime(value) {
  if (!value) return ''

  const str = String(value).trim()
  const match = str.match(/^(\d{1,2}):(\d{2})/)

  if (!match) return str

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function getOpeningHoursSource(store) {
  return (
    store?.openingHours ||
    store?.settings?.openingHours ||
    store?.businessHours ||
    store?.hours ||
    null
  )
}

function getCanonicalPublicStoreId(docId, data = {}, fallback = '') {
  return String(data.storeDocId || data.docId || data.storeId || docId || fallback || '').trim()
}

function isPublicStoreProjectionActive(data = {}) {
  return (
    data.isActive === true &&
    data.isBlocked === false &&
    data.isBillingBlocked === false &&
    data.isDeleted === false &&
    !data.deletedAt
  )
}

async function findStoreBySlug(db, functionsInstance, slugParam) {
  const cleanSlug = String(slugParam || '').trim().replace(/^\/+|\/+$/g, '')
  const normalizedSlug = normalizeText(cleanSlug)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!cleanSlug) return null

  if (import.meta.env.DEV) {
    console.log('[StoreFront] slug recebido:', slugParam)
    console.log('[StoreFront] cleanSlug:', cleanSlug)
  }

  const publicConstraints = [
    where('isActive', '==', true),
    where('isBlocked', '==', false),
    where('isBillingBlocked', '==', false),
    where('isDeleted', '==', false)
  ]

  try {
    const directRef = doc(db, 'publicStores', cleanSlug)
    const directSnap = await getDoc(directRef)

    if (import.meta.env.DEV) {
      console.log('[StoreFront] publicStores direct doc exists:', directSnap.exists())
    }

    if (directSnap.exists()) {
      const data = directSnap.data() || {}

      if (isPublicStoreProjectionActive(data)) {
        const canonicalStoreId = getCanonicalPublicStoreId(directSnap.id, data, cleanSlug)
        return {
          ...data,
          ref: directRef,
          id: canonicalStoreId,
          docId: canonicalStoreId,
          storeId: canonicalStoreId,
          storeDocId: canonicalStoreId,
          storeSlug: data.storeSlug || data.slug || cleanSlug,
          slug: data.slug || data.storeSlug || cleanSlug,
          publicDataSource: 'publicStores',
        }
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('[StoreFront] publicStores getDoc ignorado:', error.message)
  }

  try {
    const bySlug = query(collection(db, 'publicStores'), where('slug', '==', normalizedSlug), ...publicConstraints, limit(1))
    const slugSnap = await getDocs(bySlug)
    
    if (import.meta.env.DEV) {
      console.log('[StoreFront] publicStores by slug empty:', slugSnap.empty)
    }

    if (!slugSnap.empty) {
      const storeDoc = slugSnap.docs[0]
      const data = storeDoc.data() || {}
      const canonicalStoreId = getCanonicalPublicStoreId(storeDoc.id, data, cleanSlug)
      return {
        ...data,
        ref: storeDoc.ref,
        id: canonicalStoreId,
        docId: canonicalStoreId,
        storeId: canonicalStoreId,
        storeDocId: canonicalStoreId,
        storeSlug: data.storeSlug || data.slug || cleanSlug,
        slug: data.slug || data.storeSlug || cleanSlug,
        publicDataSource: 'publicStores',
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('[StoreFront] publicStores slug ignorado:', error.message)
  }

  try {
    const byStoreSlug = query(collection(db, 'publicStores'), where('storeSlug', '==', normalizedSlug), ...publicConstraints, limit(1))
    const storeSlugSnap = await getDocs(byStoreSlug)

    if (import.meta.env.DEV) {
      console.log('[StoreFront] publicStores by storeSlug empty:', storeSlugSnap.empty)
    }

    if (!storeSlugSnap.empty) {
      const storeDoc = storeSlugSnap.docs[0]
      const data = storeDoc.data() || {}
      const canonicalStoreId = getCanonicalPublicStoreId(storeDoc.id, data, cleanSlug)
      return {
        ...data,
        ref: storeDoc.ref,
        id: canonicalStoreId,
        docId: canonicalStoreId,
        storeId: canonicalStoreId,
        storeDocId: canonicalStoreId,
        storeSlug: data.storeSlug || data.slug || cleanSlug,
        slug: data.slug || data.storeSlug || cleanSlug,
        publicDataSource: 'publicStores',
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('[StoreFront] publicStores storeSlug ignorado:', error.message)
  }

  for (const lookupKey of uniqueTruthy([cleanSlug, normalizedSlug])) {
    try {
      const byStoreKeys = query(collection(db, 'publicStores'), where('storeKeys', 'array-contains', lookupKey), ...publicConstraints, limit(1))
      const storeKeysSnap = await getDocs(byStoreKeys)

      if (import.meta.env.DEV) {
        console.log('[StoreFront] publicStores by storeKeys empty:', lookupKey, storeKeysSnap.empty)
      }

      if (!storeKeysSnap.empty) {
        const storeDoc = storeKeysSnap.docs[0]
        const data = storeDoc.data() || {}
        const canonicalStoreId = getCanonicalPublicStoreId(storeDoc.id, data, cleanSlug)
        return {
          ...data,
          ref: storeDoc.ref,
          id: canonicalStoreId,
          docId: canonicalStoreId,
          storeId: canonicalStoreId,
          storeDocId: canonicalStoreId,
          storeSlug: data.storeSlug || data.slug || cleanSlug,
          slug: data.slug || data.storeSlug || cleanSlug,
          publicDataSource: 'publicStores',
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.log('[StoreFront] publicStores storeKeys ignorado:', error.message)
    }
  }

  try {
    const getPublicStoreProfile = httpsCallable(functionsInstance, 'getPublicStoreProfile')
    const result = await getPublicStoreProfile({
      storeId: cleanSlug,
      storeDocId: cleanSlug,
      storeSlug: cleanSlug,
      slug: cleanSlug,
    })
    const store = result?.data?.store

    if (store) {
      const canonicalStoreId = getCanonicalPublicStoreId(store.id, store, cleanSlug)
      return {
        ...store,
        id: canonicalStoreId,
        docId: canonicalStoreId,
        storeId: canonicalStoreId,
        storeDocId: canonicalStoreId,
        storeSlug: store.storeSlug || store.slug || cleanSlug,
        slug: store.slug || store.storeSlug || cleanSlug,
        publicDataSource: store.publicDataSource || result?.data?.source || 'callable',
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('[StoreFront] getPublicStoreProfile ignorado:', error.message)
  }

  return null
}

function findDayHours(source, day) {
  if (!source || typeof source !== 'object') return null

  return (
    source[day.key] ||
    source[day.legacyKey] ||
    source[day.short] ||
    source[day.label] ||
    source[day.label.toLowerCase()] ||
    day.aliases.map((alias) => source[alias]).find(Boolean) ||
    null
  )
}

function normalizeHourItem(item, fallbackDay = null) {
  if (!item || typeof item !== 'object') return null

  const enabled = item.enabled ?? item.active ?? item.isOpen ?? true

  const rawDays =
    item.days ||
    item.weekdays ||
    item.activeDays ||
    item.day ||
    item.id ||
    item.key ||
    fallbackDay ||
    []

  const days = Array.isArray(rawDays)
    ? rawDays.map(getDayKey)
    : [getDayKey(rawDays)]

  if (enabled === false) {
    return {
      days,
      open: '',
      close: '',
      enabled: false,
    }
  }

  const open = normalizeTime(
    item.open ||
      item.openAt ||
      item.from ||
      item.start ||
      item.abre ||
      item.hoursOpen
  )

  const close = normalizeTime(
    item.close ||
      item.closeAt ||
      item.to ||
      item.end ||
      item.fecha ||
      item.hoursClose
  )

  return {
    days,
    open,
    close,
    enabled: true,
  }
}

function getBusinessHours(store) {
  const source = getOpeningHoursSource(store)

  if (Array.isArray(source) && source.length > 0) {
    const normalized = source
      .map((item) => normalizeHourItem(item))
      .filter(Boolean)

    if (normalized.length > 0) return normalized
  }

  if (source && typeof source === 'object') {
    if (source.open || source.close || source.openAt || source.closeAt) {
      return [
        normalizeHourItem({
          days: source.days || store?.activeDays || [],
          open: source.open || source.openAt,
          close: source.close || source.closeAt,
          enabled: source.enabled ?? true,
        }),
      ].filter(Boolean)
    }

    const normalized = WEEK_DAYS.map((day) => {
      const raw = findDayHours(source, day)

      if (!raw) return null

      return normalizeHourItem(raw, day.key)
    }).filter(Boolean)

    if (normalized.length > 0) return normalized
  }

  if (Array.isArray(store?.activeDays) && store.activeDays.length > 0) {
    return [
      normalizeHourItem({
        days: store.activeDays,
        open: store?.hoursOpen || store?.openAt || store?.openTime,
        close: store?.hoursClose || store?.closeAt || store?.closeTime,
      }),
    ].filter(Boolean)
  }

  if (store?.hoursOpen || store?.hoursClose || store?.openAt || store?.closeAt) {
    return [
      normalizeHourItem({
        days: [],
        open: store?.hoursOpen || store?.openAt,
        close: store?.hoursClose || store?.closeAt,
      }),
    ].filter(Boolean)
  }

  return []
}

function getTodayHoursLabel(businessHours) {
  if (!businessHours.length) return 'Horário não informado'

  const todayKey = getTodayKey()

  const today = businessHours.find((item) => {
    if (!Array.isArray(item.days) || item.days.length === 0) return false

    return item.days.map(getDayKey).includes(todayKey)
  })

  const fallback = businessHours.find((item) => {
    return !Array.isArray(item.days) || item.days.length === 0
  })

  const finalHours = today || fallback

  if (!finalHours) return 'Fechado hoje'
  if (finalHours.enabled === false) return 'Fechado hoje'
  if (!finalHours.open && !finalHours.close) return 'Horário não informado'

  return `Hoje: ${finalHours.open || '--:--'} às ${finalHours.close || '--:--'}`
}

function parseTodayTime(time, baseDate = new Date()) {
  if (!time) return null

  const match = String(time).match(/^(\d{1,2}):(\d{2})/)

  if (!match) return null

  const date = new Date(baseDate)

  date.setHours(Number(match[1]), Number(match[2]), 0, 0)

  return date
}

function getTodayHoursItem(businessHours) {
  if (!businessHours.length) return null

  const todayKey = getTodayKey()

  const today = businessHours.find((item) => {
    if (!Array.isArray(item.days) || item.days.length === 0) return false

    return item.days.map(getDayKey).includes(todayKey)
  })

  const fallback = businessHours.find((item) => {
    return !Array.isArray(item.days) || item.days.length === 0
  })

  return today || fallback || null
}

function getClosingWarning(businessHours, minutesBeforeClose = 40) {
  const todayHours = getTodayHoursItem(businessHours)

  if (!todayHours || todayHours.enabled === false) {
    return {
      closesSoon: false,
      minutesToClose: null,
      label: '',
    }
  }

  const now = new Date()
  const openDate = parseTodayTime(todayHours.open, now)
  let closeDate = parseTodayTime(todayHours.close, now)

  if (!openDate || !closeDate) {
    return {
      closesSoon: false,
      minutesToClose: null,
      label: '',
    }
  }

  // Compatibilidade com horário que passa da meia-noite.
  // Ex: 18:00 às 01:00.
  if (closeDate <= openDate) {
    closeDate = new Date(closeDate.getTime() + 24 * 60 * 60 * 1000)
  }

  const diffMinutes = Math.ceil((closeDate.getTime() - now.getTime()) / 60000)

  if (diffMinutes <= 0) {
    return {
      closesSoon: false,
      minutesToClose: 0,
      label: 'Fechando agora',
    }
  }

  if (diffMinutes <= minutesBeforeClose) {
    return {
      closesSoon: true,
      minutesToClose: diffMinutes,
      label: `Fecha em ${diffMinutes} min`,
    }
  }

  return {
    closesSoon: false,
    minutesToClose: diffMinutes,
    label: '',
  }
}

function uniqueTruthy(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getUserStoreKeys(user) {
  if (!user) return []

  return uniqueTruthy([
    user.storeId,
    user.storeSlug,
    user.storeDocId,
    ...(Array.isArray(user.storeIds) ? user.storeIds : []),
    ...(Array.isArray(user.storeKeys) ? user.storeKeys : []),
  ])
}

function getStoreOwnerUids(store) {
  if (!store) return []

  return uniqueTruthy([
    store.ownerId,
    store.ownerUid,
    store.owner?.uid,
    ...(Array.isArray(store.allowedUserIds) ? store.allowedUserIds : []),
    ...(Array.isArray(store.merchantUids) ? store.merchantUids : []),
  ])
}

function getStoreAccessKeys(store, fallbackSlug = '') {
  if (!store) return []

  return uniqueTruthy([
    fallbackSlug,
    store.id,
    store.docId,
    store.storeId,
    store.storeSlug,
    store.slug,
    store.finalStoreId,
    ...(Array.isArray(store.storeIds) ? store.storeIds : []),
    ...(Array.isArray(store.storeKeys) ? store.storeKeys : []),
  ])
}

function canEditStorefront(user, store, fallbackSlug = '') {
  if (!user || !store) return false

  const role = String(user.role || '').toLowerCase()

  if (['admin', 'developer', 'dev'].includes(role)) {
    return true
  }

  const ownerUids = getStoreOwnerUids(store)

  if (ownerUids.includes(user.uid)) {
    return true
  }

  const userStoreKeys = getUserStoreKeys(user)
  const storeAccessKeys = getStoreAccessKeys(store, fallbackSlug)

  return userStoreKeys.some((key) => storeAccessKeys.includes(key))
}
// --- FIM DAS FUNÇÕES AUXILIARES ---

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatItemCount(count) {
  const total = Number(count || 0)
  return `${total} ${total === 1 ? 'item' : 'itens'}`
}

function formatAvailableItems(count) {
  const total = Number(count || 0)
  return `${formatItemCount(total)} ${total === 1 ? 'disponível' : 'disponíveis'}`
}

function onlyNumbers(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function firstFilled(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
}

function getStoreSlug(store, fallbackSlug) {
  return firstFilled(
    store?.storeSlug,
    store?.slug,
    fallbackSlug,
    store?.id,
  )
}

function getCanonicalPublicSlug(store) {
  const storeId = firstFilled(store?.id, store?.docId, store?.storeId, store?.storeDocId)
  const publicSlug = firstFilled(store?.slug, store?.storeSlug)
  return publicSlug && publicSlug !== storeId ? publicSlug : ''
}

function normalizeStore(input, fallbackSlug = '') {
  if (!input) return null

  const isSnapshot = typeof input.data === 'function'
  const data = isSnapshot ? input.data() || {} : input
  const docId = getStoreDocId(input) || input?.id || fallbackSlug
  const storeSlug = getStorePublicSlug(input) || input?.slug || fallbackSlug || docId

  const rawLogoUrl = firstFilled(data.logoUrl, data.logo, data.avatarUrl, data.photoUrl)
  const rawFaviconUrl = firstFilled(data.faviconUrl, data.logoIconUrl, rawLogoUrl)
  const rawBannerUrl = firstFilled(data.bannerUrl, data.coverUrl, data.bannerImageUrl, data.coverImageUrl)
  const rawBannerMobileUrl = firstFilled(data.bannerMobileUrl, data.mobileBannerUrl, data.mobileBannerURL)
  const rawShareImageUrl = firstFilled(data.shareImageUrl, data.seoImageUrl, data.ogImageUrl)

  const logoUrl = getCloudinaryImageUrl(rawLogoUrl, 'storeLogo', { replaceExistingTransform: true })
  const bannerUrl = getCloudinaryImageUrl(rawBannerUrl, 'storeBanner', { replaceExistingTransform: true })
  const bannerMobileUrl = getCloudinaryImageUrl(rawBannerMobileUrl, 'storeBannerMobile', { replaceExistingTransform: true })
  const shareImageUrl = getCloudinaryImageUrl(rawShareImageUrl, 'ogImage', { replaceExistingTransform: true })

  return {
    ...data,
    id: docId,
    docId,
    storeId: docId,
    storeSlug,
    slug: data.slug || storeSlug,

    rawLogoUrl,
    rawFaviconUrl,
    rawBannerUrl,
    rawBannerMobileUrl,
    rawShareImageUrl,

    logoUrl,
    logo: logoUrl,
    faviconUrl: rawFaviconUrl,

    bannerUrl,
    bannerMobileUrl,
    mobileBannerUrl: bannerMobileUrl,
    coverUrl: bannerUrl,

    shareImageUrl,
    seoImageUrl: shareImageUrl,
    ogImageUrl: shareImageUrl,

    themeColor: firstFilled(data.themeColor, data.primaryColor, data.brandColor) || BRAND_GREEN,
    whatsapp: firstFilled(data.whatsapp, data.phone, data.contactPhone),
    city: firstFilled(data.city, data.address?.city),
  }
}

function normalizeProduct(productDoc) {
  const isSnapshot = typeof productDoc?.data === 'function'
  const data = isSnapshot ? productDoc.data() || {} : productDoc || {}
  const productId = isSnapshot ? productDoc.id : data.id || data.productId
  const imageUrl = getCloudinaryImageUrl(
    firstFilled(data.imageUrl, data.image, data.photoUrl, data.coverUrl, data.thumbnailUrl),
    'productCard',
  )

  return {
    ...data,
    id: productId,
    imageUrl,
    image: imageUrl,
    photoUrl: imageUrl,
    priceCents: Number(data.priceCents ?? Math.round(Number(data.price || 0) * 100)),
    oldPriceCents:
      data.oldPriceCents == null
        ? data.oldPrice == null
          ? null
          : Math.round(Number(data.oldPrice || 0) * 100)
        : Number(data.oldPriceCents),
  }
}

function isStoreUnavailable(store) {
  if (!store) return false

  return (
    store.isActive === false ||
    store.isBlocked === true ||
    store.isBillingBlocked === true ||
    store.isDeleted === true ||
    Boolean(store.deletedAt)
  )
}

// isProductAvailable — usa regra centralizada do helper productStatus.
// IMPORTANTE: isAvailable === false não é filtrado aqui!
// Produto indisponível ainda aparece no cardápio (mas com CTA bloqueado no ProductCard).
function isProductAvailable(product) {
  return shouldShowProductInStorefront(product)
}

function sortByOrderThenName(a, b) {
  const orderA = Number(a?.order ?? 9999)
  const orderB = Number(b?.order ?? 9999)

  if (orderA !== orderB) return orderA - orderB

  return String(a?.name || '').localeCompare(String(b?.name || ''))
}

function LoadingScreen({ timedOut = false, onRetry = null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-orange-100 border-t-[#f97316]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FiShoppingCart className="text-[#f97316]" />
          </div>
        </div>

        <div>
          <p className="text-lg font-black text-[#111827]">Carregando cardápio...</p>
          <p className="mt-1 text-sm text-[#6b7280]">
            {timedOut
              ? 'A conexão parece instável. Tente carregar novamente.'
              : 'Preparando a melhor experiência para você.'}
          </p>
        </div>

        {timedOut && typeof onRetry === 'function' && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-[#f97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
          >
            <FiRefreshCw size={16} />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}

function buildStoreDescription(store, storeName) {
  const explicitDescription = String(store?.description || '').trim()

  if (explicitDescription) return explicitDescription

  const segment = firstFilled(store?.segment, store?.category, store?.businessType)

  if (segment) {
    return `Cardápio online de ${segment} da ${storeName}. Escolha seus produtos e faça seu pedido online para entrega ou retirada.`
  }

  return `Veja o cardápio da ${storeName}, escolha seus produtos e faça seu pedido online para entrega ou retirada.`
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === null || item === undefined) return false
      if (typeof item === 'string') return item.trim() !== ''
      if (Array.isArray(item)) return item.length > 0
      return true
    })
  )
}

function buildStoreJsonLd(store, {
  storeName,
  storeDescription,
  storeSlug,
  storeImage,
}) {
  if (!store || !storeSlug) return null

  const canonicalUrl = `${SITE_URL}/${storeSlug}`
  const addressData = store.address && typeof store.address === 'object'
    ? store.address
    : {}
  const city = firstFilled(store.city, addressData.city, addressData.cidade)
  const state = firstFilled(store.state, addressData.state, addressData.uf)
  const neighborhood = firstFilled(store.neighborhood, addressData.neighborhood, addressData.bairro)
  const segment = firstFilled(store.segment, store.category, store.businessType)

  const address = compactObject({
    '@type': 'PostalAddress',
    addressLocality: city,
    addressRegion: state,
    addressCountry: 'BR',
  })

  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: storeName,
    description: storeDescription,
    url: canonicalUrl,
    menu: canonicalUrl,
    hasMenu: canonicalUrl,
    image: storeImage,
    servesCuisine: segment,
    address: Object.keys(address).length > 1 ? address : undefined,
    areaServed: city || neighborhood,
  })
}

function StoreNotFound() {
  return (
    <>
      <SEO
        title="Loja não encontrada | PratoBy"
        description="Essa loja não foi encontrada no PratoBy. Confira o link correto com o restaurante ou volte para a página inicial."
        path="/404"
        noIndex
        noFollow
      />

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f9fafb] p-6 selection:bg-orange-100 selection:text-[#f97316]">
      {/* Elementos de fundo da marca PratoBy */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-orange-50/80 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-[fadeIn_0.4s_ease-out] rounded-[2.5rem] border border-gray-100 bg-white/95 p-8 text-center shadow-2xl shadow-gray-200/60 backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-orange-50 text-[#f97316] ring-4 ring-white shadow-inner">
          <FiSearch size={32} />
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-[#111827]">
          Loja não encontrada
        </h1>

        <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
          Essa loja pode ter sido removida, pausada ou o link que você digitou está incorreto.
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-5 text-xs font-bold leading-6 text-[#6b7280]">
          Confira o endereço digitado ou solicite o link correto ao restaurante.
        </div>

        <Link
          to="/"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-sm ring-1 ring-gray-200 transition-all hover:bg-gray-50 hover:text-[#f97316] active:scale-[0.98]"
        >
          <FiArrowLeft size={18} />
          Conhecer o PratoBy
        </Link>
      </div>
    </div>
    </>
  )
}

function StoreUnavailable() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f9fafb] p-6 selection:bg-orange-100 selection:text-[#f97316]">
      {/* Elementos de fundo da marca PratoBy */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 right-10 h-80 w-80 rounded-full bg-orange-100/50 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-gray-200/50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-[fadeIn_0.4s_ease-out] rounded-[2.5rem] border border-gray-100 bg-white/95 p-8 text-center shadow-2xl shadow-gray-200/60 backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gray-50 text-[#111827] ring-4 ring-white shadow-inner">
          <FiClock size={32} />
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-[#111827]">
          Loja indisponível
        </h1>

        <p className="mt-3 text-sm font-medium leading-7 text-[#6b7280]">
          Este cardápio está temporariamente fechado ou indisponível para receber pedidos no momento.
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-orange-100 bg-orange-50/50 p-5 text-xs font-bold leading-6 text-[#9a3412]">
          Tente atualizar a página mais tarde ou fale diretamente com o restaurante pelo WhatsApp.
        </div>

        <Link
          to="/"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-sm ring-1 ring-gray-200 transition-all hover:bg-gray-50 hover:text-[#f97316] active:scale-[0.98]"
        >
          <FiArrowLeft size={18} />
          Conhecer o PratoBy
        </Link>
      </div>
    </div>
  )
}


function getStorePromoBanner(store) {
  const candidates = [
    store?.promoBanner,
    store?.promotionBanner,
    store?.marketingBanner,
    store?.adBanner,
    Array.isArray(store?.promoBanners)
      ? store.promoBanners.find((banner) => banner?.active !== false && banner?.isActive !== false)
      : null,
    Array.isArray(store?.banners)
      ? store.banners.find((banner) => banner?.type === 'promo' && banner?.active !== false)
      : null,
  ].filter(Boolean)

  const raw = candidates[0]

  if (!raw || typeof raw !== 'object') return null

  const title = firstFilled(raw.title, raw.name, raw.headline, raw.label)
  const subtitle = firstFilled(raw.subtitle, raw.description, raw.text, raw.caption)
  const imageUrl = getCloudinaryImageUrl(
    firstFilled(raw.imageUrl, raw.image, raw.bannerUrl, raw.coverUrl, raw.photoUrl),
    'storeBannerMobile',
  )

  if (!title && !subtitle && !imageUrl) return null

  return {
    id: raw.id || raw.title || 'promo-banner',
    title: title || 'Oferta especial da loja',
    subtitle: subtitle || 'Confira os destaques preparados para você pedir agora.',
    imageUrl,
    ctaLabel: firstFilled(raw.ctaLabel, raw.buttonLabel, raw.actionLabel) || 'Ver ofertas',
    href: firstFilled(raw.href, raw.url, raw.link),
    targetCategory: raw.categoryId || raw.targetCategoryId || raw.category || '',
    target: raw.target || '',
  }
}


function getProductPromoImageUrl(product) {
  return getCloudinaryImageUrl(
    firstFilled(
      product?.thumbnailUrl,
      product?.imageUrl,
      product?.image,
      product?.photoUrl,
      product?.coverUrl,
      product?.pictureUrl
    ),
    'productCardLarge'
  )
}

function StoreHero({ store, themeColor }) {
  const bannerUrl = store?.bannerUrl || store?.coverUrl || store?.bannerMobileUrl || store?.mobileBannerUrl

  return (
    <section className="relative overflow-hidden bg-[#f9fafb]">
      <div className="relative mx-auto max-w-[1120px] sm:px-4 sm:pt-5">
        <div className="relative h-[116px] overflow-hidden bg-[#111827] sm:h-[210px] sm:rounded-[2rem] lg:h-[250px]">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={store?.name ? `Banner da ${store.name}` : 'Banner da loja'}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={1200}
              height={480}
              className="h-full w-full"
              style={{
                objectFit: store?.bannerFit === 'contain' || store?.coverFit === 'contain' ? 'contain' : 'cover',
                objectPosition: store?.bannerPosition || 'center center',
                backgroundColor: '#fff7ed',
              }}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(circle at 18% 18%, ${themeColor}70, transparent 34%), linear-gradient(135deg, #111827 0%, #1f2937 52%, ${themeColor} 150%)`,
              }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#f9fafb] to-transparent" />
        </div>
      </div>
    </section>
  )
}

function StoreIdentityCard({
  store,
  themeColor,
  activeUsers,
  todayHoursLabel,
  closingWarning,
  storeInfoItems,
  isFavorite,
  isInfoOpen,
  onToggleFavorite,
  onToggleInfo,
  onShareStore,
}) {
  const logoInitial = String(store?.name || 'L').trim().charAt(0).toUpperCase()

  return (
    <section className="relative z-20 mx-auto -mt-5 max-w-[1120px] px-3 sm:-mt-12 sm:px-4 lg:-mt-12">
      <div className="rounded-[1.65rem] border border-white/80 bg-white/95 p-3.5 shadow-xl shadow-gray-200/70 ring-1 ring-gray-100/80 backdrop-blur-xl sm:rounded-[2rem] sm:p-5 lg:p-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-5 lg:items-center">
          <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[1.15rem] bg-white shadow-sm ring-1 ring-gray-100 sm:h-24 sm:w-24 sm:rounded-[1.5rem] lg:h-28 lg:w-28">
            {store?.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store?.name || 'Logo da loja'}
                loading="eager"
                decoding="async"
                width={112}
                height={112}
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <span className="text-2xl font-black sm:text-4xl" style={{ color: themeColor }}>
                {logoInitial}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-start justify-between gap-3 lg:items-center">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[1.35rem] font-black leading-tight tracking-tight text-[#111827] sm:text-4xl lg:text-[2.35rem]">
                  {store?.name || 'Loja'}
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                      store?.isOpen ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${store?.isOpen ? 'bg-[#f97316]' : 'bg-red-500'}`}
                      style={{ background: store?.isOpen ? themeColor : undefined }}
                    />
                    {store?.isOpen ? 'Aberto' : 'Fechado'}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-600">
                    <FiStar size={12} />
                    {store?.rating || '4.9'}
                    {activeUsers > 0 && (
                    <span className="hidden items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100 sm:inline-flex sm:px-3 sm:py-1.5 sm:text-[11px]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                      </span>
                      {activeUsers} {activeUsers === 1 ? 'pessoa vendo agora' : 'pessoas vendo agora'}
                    </span>
                  )}
                  </span>
                </div>
              </div>

              <div className="ml-1 flex shrink-0 flex-col gap-1.5 lg:flex-row lg:items-center">
                <HeaderIconButton
                  icon={FiHeart}
                  label={isFavorite ? 'Salvo' : 'Salvar'}
                  active={isFavorite}
                  onClick={onToggleFavorite}
                />

                <HeaderIconButton
                  icon={FiInfo}
                  label="Informações"
                  active={isInfoOpen}
                  onClick={onToggleInfo}
                />

                <HeaderIconButton
                  icon={FiShare2}
                  label="Compartilhar"
                  onClick={onShareStore}
                />
              </div>
            </div>

            <p className="mt-2 max-h-10 overflow-hidden text-[13px] font-medium leading-5 text-[#6b7280] sm:mt-3 sm:max-h-none sm:text-[15px] sm:leading-6 lg:max-w-2xl">
              {store?.description ||
                'Peça online de forma rápida, acompanhe seu pedido e receba no conforto da sua casa.'}
            </p>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-4 sm:flex-wrap [&::-webkit-scrollbar]:hidden">
              <span className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-gray-100 bg-[#f9fafb] px-3 py-2 text-[11px] font-black text-[#111827] sm:text-xs">
                <FiClock className="shrink-0" style={{ color: themeColor }} />
                <span>{todayHoursLabel}</span>
              </span>

              {storeInfoItems.map((item) => {
                const Icon = item.icon

                return (
                  <span
                    key={item.label}
                    className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-gray-100 bg-[#f9fafb] px-3 py-2 text-[11px] font-black text-[#111827] sm:text-xs"
                  >
                    <Icon className="shrink-0" style={{ color: themeColor }} />
                    <span>{item.label}</span>
                  </span>
                )
              })}

              {closingWarning.closesSoon && (
                <span className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700 sm:text-xs">
                  <FiClock size={13} />
                  {closingWarning.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {!store?.isOpen && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-red-700">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
              <FiAlertCircle size={18} />
            </div>

            <div>
              <p className="text-sm font-black">Pedidos pausados</p>
              <p className="mt-1 text-sm leading-6">
                A loja está fechada agora, mas você pode visualizar o cardápio e voltar no próximo horário.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function StoreQuickActions({
  searchExpanded,
  searchTerm,
  setSearchTerm,
  onToggleSearch,
  onOpenProfile,
  onCopyLink,
  copied,
  themeColor,
}) {
  return (
    <section className="mx-auto mt-2 max-w-[1120px] px-3 sm:mt-3 sm:px-4">
      <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-1 shadow-md shadow-orange-100/40 ring-1 ring-orange-50/80 backdrop-blur-xl sm:rounded-[1.35rem]">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        <button
          type="button"
          onClick={onToggleSearch}
          className={`flex min-h-[42px] items-center justify-center gap-2 rounded-[0.95rem] px-3 text-sm font-black transition duration-200 active:scale-[0.98] sm:min-h-[46px] sm:rounded-[1.05rem] ${
            searchExpanded || searchTerm
              ? 'text-white shadow-lg shadow-orange-200/50'
              : 'bg-[#f9fafb] text-[#111827] hover:bg-orange-50 hover:text-[#f97316]'
          }`}
          style={{
            backgroundColor: searchExpanded || searchTerm ? themeColor : undefined,
          }}
        >
          <FiSearch />
          Buscar
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-h-[42px] items-center justify-center gap-2 rounded-[0.95rem] bg-[#f9fafb] px-3 text-sm font-black text-[#111827] transition duration-200 hover:bg-orange-50 hover:text-[#f97316] active:scale-[0.98] sm:min-h-[46px] sm:rounded-[1.05rem]"
        >
          <FiUser />
            <span className="sm:hidden">Pedidos</span>
            <span className="hidden sm:inline">Meus Pedidos</span>
        </button>

        <button
          type="button"
          onClick={onCopyLink}
          className="hidden min-h-[46px] items-center justify-center gap-2 rounded-[1.05rem] bg-[#f9fafb] px-3 text-sm font-black text-[#111827] transition duration-200 hover:bg-orange-50 hover:text-[#f97316] active:scale-[0.98] sm:flex"
        >
          {copied ? <FiCheck /> : <FiCopy />}
          {copied ? 'Copiado!' : 'Copiar link'}
        </button>
      </div>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          searchExpanded || searchTerm
            ? 'mt-2 grid-rows-[1fr] opacity-100 sm:mt-3'
            : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative rounded-[1.25rem] border border-orange-100 bg-white shadow-xl shadow-orange-100/50 ring-1 ring-white sm:rounded-[1.45rem]">
            <FiSearch
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]"
              size={19}
            />

            <input
              type="text"
              autoFocus={searchExpanded}
              placeholder="Buscar bolos, doces, kits..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-12 w-full rounded-[1.25rem] bg-white py-3 pl-11 pr-12 text-sm font-semibold text-[#111827] outline-none placeholder:text-gray-400 focus:ring-4 focus:ring-orange-100 sm:h-14 sm:rounded-[1.45rem] sm:pl-12"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-[#111827]"
                aria-label="Limpar busca"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function StorePromoBanner({ banner, themeColor, onClick }) {
  if (!banner) return null

  return (
    <section className="mx-auto mt-2 max-w-[1120px] px-3 sm:mt-4 sm:px-4">
      <button
        type="button"
        onClick={() => onClick?.(banner)}
        className="group relative flex w-full min-w-0 items-center overflow-hidden rounded-[1.35rem] border border-orange-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-100/50 sm:rounded-[1.7rem] lg:min-h-[104px]"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            background: `radial-gradient(circle at 12% 20%, ${themeColor}, transparent 34%), linear-gradient(135deg, ${themeColor}, transparent 72%)`,
          }}
        />

        <div className="relative flex w-full min-w-0 flex-1 items-center gap-3 p-3 sm:gap-5 sm:p-4 lg:p-4">
          {banner.imageUrl ? (
            <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 p-1.5 ring-1 ring-orange-100/70 sm:w-30 lg:w-32">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                loading="lazy"
                decoding="async"
                width={360}
                height={270}
                className="h-full w-full object-contain object-center transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
          ) : (
            <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] sm:h-16 sm:w-16">
              <FiStar size={23} />
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#f97316] sm:px-2.5 sm:py-1 sm:text-[10px]">
              Oferta da loja
            </span>

            <h2 className="mt-1 line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-[#111827] sm:mt-2 sm:text-2xl">
              {banner.title}
            </h2>

            <p className="mt-0.5 line-clamp-2 overflow-hidden text-[11px] font-semibold leading-4 text-[#6b7280] sm:mt-1 sm:text-sm sm:leading-5 lg:max-w-[34rem]">
              {banner.subtitle}
            </p>
          </div>

          <div
            className="hidden h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-black text-white sm:inline-flex"
            style={{ background: themeColor }}
          >
            {banner.ctaLabel}
            <FiChevronRight />
          </div>
        </div>
      </button>
    </section>
  )
}

function EmptyProducts({ searchTerm, onClear }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-orange-100 bg-white/95 px-6 py-12 text-center shadow-sm sm:py-16">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-50/60 text-gray-400 sm:h-16 sm:w-16">
        <FiSearch size={26} />
      </div>

      <h2 className="mt-5 text-xl font-black tracking-tight text-[#111827] sm:text-2xl">
        {searchTerm ? 'Nenhum produto encontrado' : 'Cardápio em montagem'}
      </h2>

      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#6b7280] sm:max-w-md sm:text-base sm:leading-7">
        {searchTerm
          ? 'Tente buscar outro termo ou limpe a pesquisa para ver todo o cardápio.'
          : 'Em breve você verá bolos, doces e kits festa por aqui.'}
      </p>

      {searchTerm && (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
        >
          Limpar busca
        </button>
      )}
    </div>
  )
}

function MenuEndDivider({ store, themeColor, onBackToTop }) {
  const whatsappDigits = onlyNumbers(
    store?.whatsapp || store?.phone || store?.contactPhone
  )

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-6 pt-2 xl:px-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-100 to-orange-200" />

        <span className="shrink-0 rounded-full border border-orange-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#f97316] shadow-sm">
          Fim do cardápio
        </span>

        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-orange-100 to-orange-200" />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border border-gray-100 bg-white/80 px-4 py-3 shadow-sm shadow-gray-100/70 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#6b7280]">
          <span className="font-black text-[#111827]">Você chegou ao final.</span>{' '}
          Informações da loja, endereço e tecnologia ficam logo abaixo.
        </p>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToTop}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-[#f9fafb] px-3.5 text-xs font-black text-[#111827] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] active:scale-95"
          >
            <FiArrowUp />
            Voltar ao topo
          </button>

        </div>
      </div>
    </section>
  )
}

function CopyToast({ message }) {
  if (!message) return null

  return (
    <div className="fixed bottom-28 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-2xl">
      {message}
    </div>
  )
}

function formatBusinessDays(days = []) {
  if (!Array.isArray(days) || days.length === 0) return 'Todos os dias'

  const normalizedDays = days.map(getDayKey).filter(Boolean)

  if (normalizedDays.length >= 7) return 'Todos os dias'

  return normalizedDays
    .map((dayKey) => WEEK_DAYS.find((day) => day.key === dayKey)?.short || dayKey)
    .join(', ')
}

function isBusinessHourToday(item) {
  const todayKey = getTodayKey()

  const rawDays = Array.isArray(item?.days)
    ? item.days
    : item?.day
      ? [item.day]
      : []

  if (rawDays.length === 0) return true

  return rawDays.map(getDayKey).includes(todayKey)
}

function getStoreAddressLabel(store) {
  if (!store) return ''

  if (typeof store.address === 'string') return store.address

  return [
    store?.address?.street || store?.street,
    store?.address?.number || store?.number,
    store?.address?.neighborhood || store?.neighborhood,
    store?.address?.city || store?.city,
  ]
    .filter(Boolean)
    .join(', ')
}

function StoreInfoModal({
  isOpen,
  onClose,
  store,
  todayHoursLabel,
  storeInfoItems,
  businessHours,
  themeColor,
}) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)

      const frame = requestAnimationFrame(() => {
        setIsVisible(true)
      })

      return () => cancelAnimationFrame(frame)
    }

    setIsVisible(false)

const timeout = window.setTimeout(() => {
  setShouldRender(false)
}, 320)

    return () => window.clearTimeout(timeout)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!shouldRender) return null

  const addressLabel = getStoreAddressLabel(store)

  return (
  <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center">
    <button
      type="button"
      className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
      aria-label="Fechar informações da loja"
    />

    <div
      className={`relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl transition-all duration-300 ease-out md:rounded-[2rem] ${
        isVisible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'translate-y-8 scale-[0.98] opacity-0 md:translate-y-4'
      }`}
    >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
          <div className="min-w-0">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 md:hidden" />

            <h3 className="line-clamp-2 text-2xl font-black tracking-tight text-[#111827]">
              {store?.name || 'Loja'}
            </h3>

            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
                store?.isOpen ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  store?.isOpen ? 'bg-[#f97316]' : 'bg-red-500'
                }`}
                style={{ background: store?.isOpen ? themeColor : undefined }}
              />
              {store?.isOpen ? 'Aberto agora' : 'Fechado agora'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition hover:bg-black active:scale-95"
            aria-label="Fechar"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4">
            <p className="text-sm font-black leading-6 text-[#111827]">
              {store?.description ||
                'Peça online de forma rápida, acompanhe seu pedido e receba no conforto da sua casa.'}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-3">
                <p className="text-xs font-bold text-[#6b7280]">Horário de hoje</p>
                <p className="mt-1 text-sm font-black text-[#111827]">
                  {todayHoursLabel}
                </p>
              </div>

              {storeInfoItems.map((item) => {
                const Icon = item.icon

                return (
                  <div key={item.label} className="rounded-2xl bg-white p-3">
                    <p className="flex items-center gap-2 text-xs font-bold text-[#6b7280]">
                      <Icon style={{ color: themeColor }} />
                      Informação
                    </p>
                    <p className="mt-1 text-sm font-black text-[#111827]">
                      {item.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {addressLabel && (
            <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiMapPin />
                Endereço
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#111827]">
                {addressLabel}
              </p>
            </div>
          )}

          {store?.whatsapp && (
            <a
              href={`https://wa.me/${onlyNumbers(store.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition active:scale-[0.98]"
            >
              <FiMessageCircle />
              Falar com a loja no WhatsApp
            </a>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
              <FiClock />
              Horário de funcionamento
            </p>

            <div className="overflow-hidden rounded-[1.5rem] border border-gray-100 bg-[#f9fafb]">
              {businessHours.length > 0 ? (
  businessHours.map((item, index) => {
    const isToday = isBusinessHourToday(item)

    return (
      <div
        key={`${item.open}-${item.close}-${index}`}
        className={`flex items-center justify-between gap-3 border-b border-gray-100 p-4 last:border-b-0 ${
          isToday ? 'bg-orange-50/40' : 'bg-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black text-[#111827]">
            {formatBusinessDays(item.days)}
          </span>

          {isToday && (
            <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-200">
              Hoje
            </span>
          )}
        </div>

        <span className="shrink-0 rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] shadow-sm">
          {item.enabled === false
            ? 'Fechado'
            : `${item.open || '--:--'} - ${item.close || '--:--'}`}
        </span>
      </div>
    )
  })
) : (
                <div className="p-5 text-center text-sm font-medium text-[#6b7280]">
                  Horários ainda não informados pela loja.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderIconButton({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition active:scale-95 lg:h-10 lg:w-auto lg:gap-2 lg:px-3 ${
        active
          ? 'border-orange-100 bg-orange-50 text-[#f97316]'
          : 'border-gray-100 bg-white text-[#6b7280] hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]'
      }`}
    >
      <Icon size={15} fill={active ? 'currentColor' : 'none'} />

      <span className="hidden text-xs font-black lg:inline">
        {label}
      </span>
    </button>
  )
}

export default function StoreFrontPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { cartItems, cartTotal, setStoreKey } = useCart()

  const [isFavorite, setIsFavorite] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [store, setStore] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])

  const [loadingStore, setLoadingStore] = useState(true)
  const [storeLoadTimedOut, setStoreLoadTimedOut] = useState(false)
  const [storeReloadKey, setStoreReloadKey] = useState(0)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [menuReloadKey, setMenuReloadKey] = useState(0)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quickEditProduct, setQuickEditProduct] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const categoryScrollRef = useRef(null)
  const activeCategoryRef = useRef('all')
  const isManualCategoryScrollRef = useRef(false)
  const manualCategoryScrollTimeoutRef = useRef(null)
  const [copyMessage, setCopyMessage] = useState('')

  const themeColor = store?.themeColor || BRAND_GREEN
  const storeSlug = getStoreSlug(store, slug)

  const businessHours = useMemo(() => getBusinessHours(store), [store])
  const todayHoursLabel = useMemo(() => getTodayHoursLabel(businessHours), [businessHours])
  const closingWarning = useMemo(
  () => getClosingWarning(businessHours, 25 ),
  [businessHours]
)

  const storePublicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${storeSlug}`
      : `/${storeSlug}`

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const targets = [document.documentElement, document.body]
    targets.forEach((target) => {
      target.classList.add('pratoby-scrollbar', 'pratoby-page-scrollbar')
    })

    return () => {
      targets.forEach((target) => {
        target.classList.remove('pratoby-scrollbar', 'pratoby-page-scrollbar')
      })
    }
  }, [])

  const isOwner = false
  const canPreviewUnavailableStore = false
  const hasMenuStore = Boolean(store)
  const menuTargetStoreId = getStoreDocId(store)
  const menuTargetStoreSlug = getStoreSlug(store, slug)
  const menuStoreUnavailable = Boolean(store && isStoreUnavailable(store))
  const menuStoreContext = useMemo(() => {
    if (!hasMenuStore) {
      return {
        hasStore: false,
        isUnavailable: false,
        loadKey: '',
        targetStoreId: '',
        targetStoreSlug: '',
      }
    }

    return {
      hasStore: true,
      isUnavailable: menuStoreUnavailable,
      loadKey: [
        menuTargetStoreId,
        menuTargetStoreSlug,
        menuStoreUnavailable ? 'unavailable' : 'available',
        canPreviewUnavailableStore ? 'preview' : 'public',
        menuReloadKey,
      ].join('|'),
      targetStoreId: menuTargetStoreId,
      targetStoreSlug: menuTargetStoreSlug,
    }
  }, [
    canPreviewUnavailableStore,
    hasMenuStore,
    menuStoreUnavailable,
    menuTargetStoreId,
    menuTargetStoreSlug,
    menuReloadKey,
  ])
  const menuLoadKey = menuStoreContext.loadKey

  const shouldBlockStorefront = Boolean(
    store && isStoreUnavailable(store) && !canPreviewUnavailableStore
)

  const totalItemsCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0)
  }, [cartItems])

  const availableProducts = useMemo(() => {
    return products.filter(isProductAvailable).sort(sortByOrderThenName)
  }, [products])

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]))
  }, [categories])

  const searchedProducts = useMemo(() => {
    const term = normalizeText(searchTerm)

    if (!term) return availableProducts

    return availableProducts.filter((product) => {
      const searchable = [
        product.name,
        product.description,
        product.categoryName,
        product.tags?.join?.(' '),
      ].join(' ')

      return normalizeText(searchable).includes(term)
    })
  }, [availableProducts, searchTerm])

  const featuredProducts = useMemo(() => {
    return availableProducts
      .filter((product) => product.isFeatured || product.featured || product.highlight)
      .slice(0, 6)
  }, [availableProducts])

  const configuredPromoBanner = useMemo(() => getStorePromoBanner(store), [store])

  const promoBanner = useMemo(() => {
    if (configuredPromoBanner) return configuredPromoBanner
    if (searchTerm) return null

    const product = featuredProducts[0]

    if (!product) return null

    return {
      id: `featured-${product.id}`,
      title: product.name || 'Mais pedidos da casa',
      subtitle: 'Confira os destaques da loja e peça em poucos toques.',
      imageUrl: getProductPromoImageUrl(product),
      ctaLabel: 'Ver destaques',
      target: 'featured',
    }
  }, [configuredPromoBanner, featuredProducts, searchTerm])

  const productsByCategory = useMemo(() => {
    const grouped = new Map()
    const uncategorized = []

    searchedProducts.forEach((product) => {
      if (!product.categoryId || !categoryById.has(product.categoryId)) {
        uncategorized.push(product)
        return
      }

      const current = grouped.get(product.categoryId) || []
      current.push(product)
      grouped.set(product.categoryId, current)
    })

    return {
      grouped,
      uncategorized,
    }
  }, [categoryById, searchedProducts])

  const categoryCounts = useMemo(() => {
    const counts = {
      all: searchedProducts.length,
    }

    categories.forEach((category) => {
      counts[category.id] = productsByCategory.grouped.get(category.id)?.length || 0
    })

    return counts
  }, [categories, productsByCategory, searchedProducts.length])

  const productSections = useMemo(() => {
    const sections = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        products: productsByCategory.grouped.get(category.id) || [],
      }))
      .filter((section) => section.products.length > 0)

    const uncategorizedProducts = productsByCategory.uncategorized

    if (uncategorizedProducts.length > 0) {
      sections.push({
        id: 'uncategorized',
        name: 'Outros itens',
        description: 'Produtos disponíveis no cardápio.',
        products: uncategorizedProducts,
      })
    }

    return sections
  }, [categories, productsByCategory])

  const shouldShowCategoryNav = categories.length > 0 || availableProducts.length > 0

  const storeInfoItems = useMemo(() => {
    return [
      {
        icon: FiClock,
        label: store?.deliveryTime || store?.estimatedDeliveryTime || '25-40 min',
      },
      {
        icon: FiMapPin,
        label: store?.city || store?.address?.city || 'Aracaju',
      },
    ]
  }, [store])

  const handleCategoryWheel = useCallback((event) => {
    const element = categoryScrollRef.current

    if (!element || element.scrollWidth <= element.clientWidth) return
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    event.preventDefault()
    element.scrollBy({
      left: event.deltaY * 1.1,
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    const element = categoryScrollRef.current
    const activeButton = element?.querySelector('[data-active-category="true"]')

    if (!element || !activeButton) return

    activeButton.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeCategory, categories.length])

  useEffect(() => {
    activeCategoryRef.current = activeCategory
  }, [activeCategory])
  
  useEffect(() => {
    function updateActiveCategoryByScroll() {
      if (isManualCategoryScrollRef.current) return
  
      const offset = isOwner ? 150 : 110
      const menuStart = document.getElementById('menu-start')
  
      if (!menuStart || productSections.length === 0) {
        if (activeCategoryRef.current !== 'all') {
          activeCategoryRef.current = 'all'
          setActiveCategory('all')
        }
  
        return
      }
  
      const menuTop = menuStart.getBoundingClientRect().top + window.scrollY
  
      let nextCategory = 'all'
  
      if (window.scrollY + offset >= menuTop - 24) {
        for (const section of productSections) {
          const sectionElement = document.getElementById(`category-${section.id}`)
  
          if (!sectionElement) continue
  
          const sectionTop = sectionElement.getBoundingClientRect().top
  
          if (sectionTop <= offset + 24) {
            nextCategory = categoryById.has(section.id) ? section.id : 'all'
          } else {
            break
          }
        }
      }
  
      if (nextCategory !== activeCategoryRef.current) {
        activeCategoryRef.current = nextCategory
        setActiveCategory(nextCategory)
      }
    }
  
    let animationFrame = 0
  
    function handleWindowScroll() {
      window.cancelAnimationFrame(animationFrame)
  
      animationFrame = window.requestAnimationFrame(updateActiveCategoryByScroll)
    }
  
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    window.addEventListener('resize', handleWindowScroll)
  
    updateActiveCategoryByScroll()
  
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', handleWindowScroll)
      window.removeEventListener('resize', handleWindowScroll)
    }
  }, [categoryById, isOwner, productSections])
  
  useEffect(() => {
    return () => {
      if (manualCategoryScrollTimeoutRef.current) {
        window.clearTimeout(manualCategoryScrollTimeoutRef.current)
      }
    }
  }, [])

  const handleScrollToCategory = useCallback(
    (categoryId) => {
      setActiveCategory(categoryId)
      activeCategoryRef.current = categoryId
  
      isManualCategoryScrollRef.current = true
  
      if (manualCategoryScrollTimeoutRef.current) {
        window.clearTimeout(manualCategoryScrollTimeoutRef.current)
      }
  
      const targetId = categoryId === 'all' ? 'menu-start' : `category-${categoryId}`
      const element = document.getElementById(targetId)
  
      if (!element) {
        isManualCategoryScrollRef.current = false
        return
      }
  
      const offset = isOwner ? 132 : 92
      const y = element.getBoundingClientRect().top + window.scrollY - offset
  
      window.scrollTo({
        top: Math.max(y, 0),
        behavior: 'smooth',
      })
  
      manualCategoryScrollTimeoutRef.current = window.setTimeout(() => {
        isManualCategoryScrollRef.current = false
        window.dispatchEvent(new Event('scroll'))
      }, 850)
    },
    [isOwner],
  )

  const handlePromoBannerClick = useCallback(
    (banner) => {
      if (banner?.href) {
        window.open(banner.href, '_blank', 'noopener,noreferrer')
        return
      }

      if (banner?.targetCategory) {
        handleScrollToCategory(banner.targetCategory)
        return
      }

      const targetId = banner?.target === 'featured' ? 'category-destaques' : 'menu-start'
      const element = document.getElementById(targetId)

      if (!element) {
        handleScrollToCategory('all')
        return
      }

      const offset = isOwner ? 132 : 92
      const y = element.getBoundingClientRect().top + window.scrollY - offset

      window.scrollTo({
        top: Math.max(y, 0),
        behavior: 'smooth',
      })
    },
    [handleScrollToCategory, isOwner],
  )


const storeName = store?.name || 'Loja'
const storeDescription = buildStoreDescription(store, storeName)

const storeImage =
  store?.rawShareImageUrl ||
  store?.shareImageUrl ||
  store?.seoImageUrl ||
  store?.ogImageUrl ||
  store?.rawBannerUrl ||
  store?.bannerUrl ||
  store?.coverUrl ||
  store?.rawBannerMobileUrl ||
  store?.bannerMobileUrl ||
  store?.mobileBannerUrl ||
  store?.rawLogoUrl ||
  store?.logoUrl ||
  'https://pratoby.com/icons/android-chrome-192x192.png?v=5'

const storeFavicon =
  store?.rawFaviconUrl ||
  store?.faviconUrl ||
  store?.logoIconUrl ||
  store?.rawLogoUrl ||
  store?.logoUrl ||
  store?.logo ||
  storeImage

const noIndexStorefront = shouldNoIndexStorefront(storeSlug, store)
const storeJsonLd = useMemo(
  () => buildStoreJsonLd(store, {
    storeName,
    storeDescription,
    storeSlug,
    storeImage,
  }),
  [store, storeDescription, storeImage, storeName, storeSlug]
)

  const showCopyMessage = useCallback((message) => {
    setCopyMessage(message)
    window.setTimeout(() => setCopyMessage(''), 2400)
  }, [])

  const handleBackToTop = useCallback(() => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}, [])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(storePublicUrl)
      showCopyMessage('Link da loja copiado')
    } catch {
      showCopyMessage('Não foi possível copiar o link')
    }
  }, [showCopyMessage, storePublicUrl])

const handleToggleFavorite = useCallback(() => {
  setIsFavorite((current) => {
    const next = !current

    showCopyMessage(next ? 'Loja salva nos favoritos' : 'Loja removida dos favoritos')

    return next
  })
}, [showCopyMessage])

  const handleShareStore = useCallback(async () => {
    const text = `Peça pelo cardápio digital da ${store?.name || 'loja'} no PratoBy.`

    if (navigator.share) {
      try {
        await navigator.share({
          title: store?.name || 'PratoBy',
          text,
          url: storePublicUrl,
        })
        return
      } catch {
        // O usuário pode cancelar o share nativo. Não precisa mostrar erro.
      }
    }

    const whatsappText = encodeURIComponent(`${text} ${storePublicUrl}`)
    window.open(`https://wa.me/?text=${whatsappText}`, '_blank', 'noopener,noreferrer')
  }, [store?.name, storePublicUrl])

  const handleRetryMenu = useCallback(() => {
    setMenuError('')
    setMenuReloadKey((current) => current + 1)
  }, [])

  const handleOpenProduct = useCallback((product) => {
    setSelectedProduct(product)
  }, [])

  const handleCloseProduct = useCallback(() => {
    setSelectedProduct(null)
  }, [])

  const handleQuickEditProduct = useCallback((product) => {
    setQuickEditProduct(product)
    setIsDrawerOpen(true)
  }, [])

  useEffect(() => {
    if (!slug) {
      queueMicrotask(() => {
        setStore(null)
        setLoadingStore(false)
      })
      return undefined
    }

    setLoadingStore(true)
    setStoreLoadTimedOut(false)

    let unsubscribe = null
    let isMounted = true

    async function resolveStore() {
      try {
        const foundStore = await findStoreBySlug(db, functions, slug)

        if (!isMounted) return

        if (import.meta.env.DEV) {
          console.log('[StoreFront] slugParam:', slug)
          console.log('[StoreFront] store found:', foundStore)
        }

        if (foundStore) {
          const canonicalSlug = getCanonicalPublicSlug(foundStore)
          const currentSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '')
          const accessedByDocId = [foundStore.id, foundStore.docId, foundStore.storeId, foundStore.storeDocId]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .includes(currentSlug)

          if (accessedByDocId && canonicalSlug && canonicalSlug !== currentSlug) {
            navigate(`/${canonicalSlug}`, { replace: true })
            return
          }

          setStore(normalizeStore(foundStore, slug))
        } else {
          setStore(null)
        }
        
        setLoadingStore(false)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[StoreFront] erro ao buscar loja:', error)
        }
        if (isMounted) {
          setStore(null)
          setLoadingStore(false)
        }
      }
    }

    resolveStore()

    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [navigate, slug, storeReloadKey])

  useEffect(() => {
    if (!loadingStore) return undefined

    const timeoutId = window.setTimeout(() => {
      setStoreLoadTimedOut(true)
    }, 12000)

    return () => window.clearTimeout(timeoutId)
  }, [loadingStore, slug, storeReloadKey])

  useEffect(() => {
    if (setStoreKey) {
      setStoreKey({ id: store?.id, slug })
    }
  }, [store?.id, slug, setStoreKey])

  useEffect(() => {
    const publicStoreId = String(store?.id || '').trim()
    if (!publicStoreId) return undefined

    let unsubscribe = null
    const liveUpdateTimer = window.setTimeout(() => {
      unsubscribe = onSnapshot(
        doc(db, 'publicStores', publicStoreId),
        (snapshot) => {
          if (!snapshot.exists()) return

          setStore((current) => {
            if (!current || current.id !== publicStoreId) return current

            return normalizeStore({
              ...current,
              ...snapshot.data(),
              id: current.id,
              docId: current.docId,
              storeId: current.storeId,
              storeDocId: current.storeDocId,
              publicDataSource: 'publicStores',
            }, slug)
          })
        },
        (error) => {
          if (import.meta.env.DEV) {
            console.warn('[StoreFront] publicStores live update ignored:', error)
          }
        }
      )
    }, 15000)

    return () => {
      window.clearTimeout(liveUpdateTimer)
      if (unsubscribe) unsubscribe()
    }
  }, [store?.id, slug])

  useEffect(() => {
  if (!menuStoreContext.hasStore || (menuStoreContext.isUnavailable && !canPreviewUnavailableStore)) {
  queueMicrotask(() => {
    setCategories([])
    setProducts([])
    setMenuError('')
    setLoadingMenu(false)
  })
  return undefined
  }

    const targetStoreId = menuStoreContext.targetStoreId

    if (!targetStoreId) {
      setCategories([])
      setProducts([])
      setLoadingMenu(false)
      return
    }

    const targetStoreSlug = menuStoreContext.targetStoreSlug
    const categoriesQuery = query(collection(db, 'publicStores', targetStoreId, 'categories'))
    const productsQuery = query(collection(db, 'publicStores', targetStoreId, 'products'))

    if (import.meta.env.DEV) {
      console.log('[StoreFront] Carregando cardapio publico:', targetStoreId)
    }

    setMenuError('')
    setLoadingMenu(true)

    let isMounted = true

    const loadCatalogFallback = async (reason) => {
      if (!isMounted) return

      if (import.meta.env.DEV) {
        console.log('[StoreFront] Fallback getPublicCatalog:', reason)
      }

      try {
        const getPublicCatalog = httpsCallable(functions, 'getPublicCatalog')
        const result = await getPublicCatalog({
          storeId: targetStoreId,
          storeSlug: targetStoreSlug,
          slug: targetStoreSlug,
        })
        const data = result?.data || {}

        if (!isMounted) return

        const fallbackCategories = Array.isArray(data.categories)
          ? data.categories
              .filter((category) => category.isVisible !== false)
              .filter((category) => category.isActive !== false)
              .filter((category) => category.isDeleted !== true && !category.deletedAt)
              .sort(sortByOrderThenName)
          : []
        const fallbackProducts = Array.isArray(data.products)
          ? data.products.map(normalizeProduct).filter(isProductAvailable).sort(sortByOrderThenName)
          : []

        setCategories(fallbackCategories)
        setProducts(fallbackProducts)
        setMenuError('')
      } catch (error) {
        if (import.meta.env.DEV) console.error('[StoreFront] Erro no getPublicCatalog:', error)
        if (isMounted) {
          setCategories([])
          setProducts([])
          setMenuError('Não foi possível carregar o cardápio.')
        }
      } finally {
        if (isMounted) setLoadingMenu(false)
      }
    }

    async function loadPublicMenu() {
      setMenuError('')
      setLoadingMenu(true)

      try {
        const [categoriesSnapshot, productsSnapshot] = await Promise.all([
          getDocs(categoriesQuery),
          getDocs(productsQuery),
        ])

        if (!isMounted) return

        const nextCategories = categoriesSnapshot.docs
          .map((categoryDoc) => ({
            id: categoryDoc.id,
            ...categoryDoc.data(),
          }))
          .filter((category) => category.isVisible !== false)
          .filter((category) => category.isActive !== false)
          .filter((category) => category.isDeleted !== true && !category.deletedAt)
          .sort(sortByOrderThenName)

        if (import.meta.env.DEV) {
          console.log(`[StoreFront] Cardápio: ${nextCategories.length} categorias`)
        }

        const nextProducts = productsSnapshot.docs.map(normalizeProduct).filter(isProductAvailable).sort(sortByOrderThenName)
        if (nextCategories.length === 0 && nextProducts.length === 0) {
          await loadCatalogFallback('publicStores vazio')
          return
        }

        if (import.meta.env.DEV) {
          console.log(`[StoreFront] Cardápio: ${nextCategories.length} categorias, ${nextProducts.length} produtos`)
        }

        setCategories(nextCategories)
        setProducts(nextProducts)
        setMenuError('')
        setLoadingMenu(false)
      } catch (error) {
        if (import.meta.env.DEV) console.error('[StoreFront] Erro no publicStores:', error)
        await loadCatalogFallback('erro publicStores')
      }
    }

    loadPublicMenu()

    return () => {
      isMounted = false
    }
    }, [canPreviewUnavailableStore, menuLoadKey, menuStoreContext])

  useEffect(() => {
    if (activeCategory === 'all') return

    const categoryExists = categories.some((category) => category.id === activeCategory)

    if (!categoryExists) {
      queueMicrotask(() => {
    setActiveCategory('all')
    })
  }
  }, [activeCategory, categories])

  const loadingStoreName = titleFromSlug(slug)

if (loadingStore) {
  return (
    <LoadingScreen
      timedOut={storeLoadTimedOut}
      onRetry={() => setStoreReloadKey((value) => value + 1)}
    />
  )
}

if (!store) {
  return <StoreNotFound />
}

if (shouldBlockStorefront) {
  return (
    <>
      <SEO
        title={`${storeName} | Loja indisponível`}
        description="Este cardápio está temporariamente indisponível para pedidos."
        path={`/${storeSlug}`}
        noIndex
        noFollow
      />
      <StoreUnavailable />
    </>
  )
}

return (
  <>
    <SEO
      title={`${storeName} | Cardápio online no PratoBy`}
      description={storeDescription}
      path={`/${storeSlug || store?.slug || store?.storeSlug || slug || ''}`}
      image={storeImage}
      imageAlt={`${storeName} | Cardápio digital - PratoBy`}
      favicon={storeFavicon}
      type="website"
      noIndex={noIndexStorefront}
      noFollow={noIndexStorefront}
      jsonLd={noIndexStorefront ? null : storeJsonLd}
      themeColor={themeColor}
    />

    <div
  className="min-h-screen bg-[#fff8f1] text-[#111827]"
  style={{
    '--theme-color': themeColor,
  }}
>
      {isOwner && (
        <div className="sticky top-0 z-50 border-b border-white/10 bg-[#111827] px-4 py-2 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
  <Link
    to="/dashboard"
    className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/15"
  >
    Voltar ao dashboard
  </Link>

              <span className="hidden items-center gap-2 truncate text-xs font-bold text-gray-300 sm:inline-flex">
                <FiSettings />
                Visualização pública da loja
              </span>
            </div>

  <button
    type="button"
    onClick={() => setIsDrawerOpen(true)}
    className="rounded-xl px-3 py-1.5 text-xs font-black text-white transition"
    style={{ background: themeColor }}
  >
    Editar loja
  </button>
</div>
        </div>
      )}

      {isOwner && (
        <Suspense fallback={null}>
          {isDrawerOpen && (
            <MerchantDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              store={store}
              categories={categories}
              products={products}
              quickEditProduct={quickEditProduct}
              onQuickEditHandled={() => setQuickEditProduct(null)}
            />
          )}
        </Suspense>
      )}

      <Suspense fallback={null}>
        {isCartOpen && (
          <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} store={store} />
        )}

        {isProfileOpen && (
          <CustomerDrawer
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            products={availableProducts}
            store={store}
          />
        )}
      </Suspense>
      <StoreHeader store={store} isOwner={isOwner} />

      <StoreQuickActions
        searchExpanded={searchExpanded}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onToggleSearch={() => setSearchExpanded((current) => !current)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onCopyLink={handleCopyLink}
        copied={copyMessage.toLowerCase().includes('copiado')}
        themeColor={themeColor}
      />

      <StorePromoBanner
        banner={promoBanner}
        themeColor={themeColor}
        onClick={handlePromoBannerClick}
      />

      {menuError && (
        <section className="mx-auto mt-6 max-w-7xl px-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{menuError}</span>
            <button
              type="button"
              onClick={handleRetryMenu}
              disabled={loadingMenu}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-red-700 shadow-sm ring-1 ring-red-100 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={loadingMenu ? 'animate-spin' : ''} />
              Tentar novamente
            </button>
          </div>
        </section>
      )}

      {shouldShowCategoryNav && (
        <section
          className={`sticky z-30 mt-4 px-3 py-2.5 backdrop-blur-xl sm:px-4 ${
            isOwner ? 'top-[44px]' : 'top-0'
          }`}
        >
          <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[1.45rem] border border-white/80 bg-white/95 p-1.5 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100/80 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-9 bg-gradient-to-r from-white via-white/90 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-gradient-to-l from-white via-white/90 to-transparent" />

            <div
              ref={categoryScrollRef}
              onWheel={handleCategoryWheel}
              className="flex w-full min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth pr-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <button
                type="button"
                data-active-category={activeCategory === 'all' ? 'true' : undefined}
                onClick={() => handleScrollToCategory('all')}
                className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-[1.15rem] px-4 py-2.5 text-sm font-black transition duration-200 active:scale-[0.98] sm:px-5 ${
                  activeCategory === 'all'
                    ? 'text-white shadow-lg shadow-orange-600/20'
                    : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
                }`}
                style={{
                  background: activeCategory === 'all' ? themeColor : undefined,
                }}
              >
                <FiGrid />
                Todos
                {categoryCounts.all > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeCategory === 'all' ? 'bg-white/20 text-white' : 'bg-gray-50 text-[#6b7280]'
                    }`}
                  >
                    {categoryCounts.all}
                  </span>
                )}
              </button>

              {categories.map((category) => {
                const active = activeCategory === category.id

                return (
                  <button
                    key={category.id}
                    type="button"
                    data-active-category={active ? 'true' : undefined}
                    onClick={() => handleScrollToCategory(category.id)}
                    className={`inline-flex shrink-0 snap-start items-center gap-2 rounded-[1.15rem] px-4 py-2.5 text-sm font-black transition duration-200 active:scale-[0.98] sm:px-5 ${
                      active
                        ? 'text-white shadow-lg shadow-orange-600/20'
                        : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
                    }`}
                    style={{
                      background: active ? themeColor : undefined,
                    }}
                  >
                    {category.name}
                    {categoryCounts[category.id] > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          active ? 'bg-white/20 text-white' : 'bg-gray-50 text-[#6b7280]'
                        }`}
                      >
                        {categoryCounts[category.id]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <main id="menu-start" className="mx-auto mt-5 max-w-[1440px] px-4 sm:mt-7 xl:px-6">
        {loadingMenu ? (
          <div className="grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-52 animate-pulse rounded-[2rem] bg-white shadow-sm ring-1 ring-gray-100" />
            ))}
          </div>
        ) : (
          <>
            {featuredProducts.length > 0 && activeCategory === 'all' && !searchTerm && (
              <section
                id="category-destaques"
                className="mb-8 lg:mb-10"
              >
                <div className="mb-5 flex items-end justify-between gap-4 rounded-[1.6rem] bg-white/70 px-4 py-3 shadow-sm ring-1 ring-gray-100/80 backdrop-blur-sm">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#f97316]">
                      <FiStar />
                      Destaques
                    </span>

                    <h2 className="mt-3 text-2xl font-black tracking-tight text-[#111827] sm:text-3xl">
                      Mais pedidos da casa
                    </h2>

                    <p className="mt-1 text-sm text-[#6b7280]">
                      Sugestões rápidas para quem quer pedir sem complicação.
                    </p>
                  </div>
                </div>

                <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
                  {featuredProducts.map((product) => (
                    <div key={`featured-${product.id}`} className="relative">
                      <div
                        className={
                          !store.isOpen && !isOwner
                            ? 'pointer-events-none opacity-70'
                            : !store.isOpen
                              ? 'opacity-70'
                              : ''
                        }
                      >
                        <ProductCard
                          product={product}
                          store={store}
                          disabled={!store?.isOpen && !isOwner}
                          isOwner={isOwner}
                          onClick={handleOpenProduct}
                          onQuickEdit={handleQuickEditProduct}
                        />
                      </div>

                      {!store.isOpen && (
                        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-red-50 px-4 py-2 text-center text-xs font-black text-red-600 shadow-sm">
                          Pedidos pausados
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {productSections.length > 0 ? (
              productSections.map((section, sectionIndex) => {
                const visibleSectionsBeforeCategory =
                  (featuredProducts.length > 0 && activeCategory === 'all' && !searchTerm ? 1 : 0) +
                  sectionIndex
                const deferSectionRendering = visibleSectionsBeforeCategory >= 2

                return (
                <section
                  key={section.id}
                  id={`category-${section.id}`}
                  className="scroll-mt-28 mb-8 lg:mb-10"
                  style={deferSectionRendering ? { contentVisibility: 'auto', containIntrinsicSize: '0 520px' } : undefined}
                >
                  <div className="mb-5 flex items-end justify-between gap-4 rounded-[1.5rem] bg-white/70 px-4 py-3 shadow-sm ring-1 ring-gray-100/80 backdrop-blur-sm">
                    <div>
                      <h2 className="text-[1.35rem] font-black tracking-tight text-[#111827] sm:text-3xl">
                        {section.name}
                      </h2>

                      <p className="mt-1 text-sm text-[#6b7280]">
                        {section.description || formatAvailableItems(section.products.length)}
                      </p>
                    </div>

                    <div className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-[#6b7280] shadow-sm sm:flex">
                      {formatItemCount(section.products.length)}
                      <FiChevronRight />
                    </div>
                  </div>

                  <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
                    {section.products.map((product) => (
                      <div key={product.id} className="relative h-full">
                        <div
                          className={`h-full ${
                            !store.isOpen && !isOwner
                              ? 'pointer-events-none opacity-70'
                              : !store.isOpen
                                ? 'opacity-70'
                                : ''
                          }`}
                        >
                          <ProductCard
                            product={product}
                            store={store}
                            disabled={!store?.isOpen && !isOwner}
                            isOwner={isOwner}
                            onQuickEdit={handleQuickEditProduct}
                            onClick={handleOpenProduct}
                          />
                        </div>

                        {!store.isOpen && (
                          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-red-50 px-4 py-2 text-center text-xs font-black text-red-600 shadow-sm">
                            Pedidos pausados
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                )
              })
            ) : (
              <EmptyProducts
                searchTerm={searchTerm}
                onClear={() => {
                  setSearchTerm('')
                  setActiveCategory('all')
                }}
              />
            )}
          </>
        )}
      </main>

<MenuEndDivider
  store={store}
  themeColor={themeColor}
  onBackToTop={handleBackToTop}
/>

<StoreFooter store={store} todayHoursLabel={todayHoursLabel} />

      <AnimatePresence>
        {totalItemsCount > 0 && store?.isOpen && (
        <motion.button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-5 left-4 right-4 z-40 rounded-[1.7rem] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-2xl md:left-[calc(50%-18rem)] md:right-auto md:w-full md:max-w-xl"
          style={{ background: themeColor }}
          initial={{ y: 28, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 28, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
        >
          <div className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/15">
                  <FiShoppingCart size={25} />
                </div>

                <motion.span
                  key={`cart-count-${totalItemsCount}`}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-[#111827] shadow-lg"
                  initial={{ scale: 0.75, y: 4 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                >
                  {totalItemsCount}
                </motion.span>
              </div>

              <div className="text-left">
                <motion.p
                  className="text-lg font-black leading-none"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04, duration: 0.18 }}
                >
                  Ver carrinho
                </motion.p>
                <motion.p
                  className="mt-1 text-sm font-bold text-white/80"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08, duration: 0.18 }}
                >
                  Finalizar pedido
                </motion.p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-white/75">Total</p>
              <motion.p
                key={`cart-total-${cartTotal}`}
                className="text-xl font-black tracking-tight"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                {formatMoney(cartTotal)}
              </motion.p>
            </div>
          </div>
        </motion.button>
        )}
      </AnimatePresence>

      {store?.whatsapp && (
        <a
          href={`https://wa.me/${onlyNumbers(store.whatsapp)}`}
          target="_blank"
          rel="noreferrer"
          className="group fixed bottom-5 right-5 z-30 hidden h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-[#111827] shadow-2xl transition hover:scale-105 md:flex"
          aria-label="Falar com a loja no WhatsApp"
        >
          <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-full bg-[#111827] px-3 py-1.5 text-xs font-black text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
            Precisa de ajuda?
          </span>
          <FiMessageCircle size={25} />
        </a>
      )}

      <Suspense fallback={null}>
        {selectedProduct && (
          <ProductOptionsModal
            isOpen={!!selectedProduct}
            product={selectedProduct}
            store={store}
            onClose={handleCloseProduct}
          />
        )}
      </Suspense>

      <CopyToast message={copyMessage} />
        </div>
  </>
)
}


