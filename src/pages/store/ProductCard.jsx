import { memo, useCallback, useMemo, useState } from 'react'
import {
  FiAward,
  FiCheckCircle,
  FiCoffee,
  FiClock,
  FiEdit2,
  FiGift,
  FiHeart,
  FiHome,
  FiImage,
  FiInfo,
  FiPackage,
  FiPlus,
  FiShoppingCart,
  FiSmile,
  FiTag,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi'

import { useCart } from '../../contexts/CartContext'
import { getCloudinaryImageSrcSet, getCloudinaryImageUrl } from '../../utils/cloudinaryImages'
import {
  shouldShowProductInStorefront,
  canAddProductToCart,
  isProductUnavailable,
  hasOutOfStock,
} from '../../utils/productStatus'
import { getProductSchedulingBadges } from '../../utils/publicScheduling'

const FAVORITES_KEY = '@PratoBy:favorites'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function productShowsCouponBadge(product) {
  const couponEnabled =
    product?.acceptsCoupons !== false &&
    product?.acceptsCoupon !== false &&
    product?.couponEligible !== false

  return couponEnabled && product?.showCouponBadge !== false
}

function centsToMoney(value) {
  if (value === null || value === undefined || value === '') return null
  return Number(value) / 100
}

function moneyToCents(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null && centsValue !== '') {
    return Math.round(Number(centsValue || 0))
  }

  if (value === undefined || value === null || value === '') return 0

  if (typeof value === 'string') {
    let cleaned = value.replace(/[^\d.,-]/g, '')

    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }

    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
  }

  const numericValue = Number(value || 0)

  if (!Number.isFinite(numericValue)) return 0
  if (Math.abs(numericValue) > 999) return Math.round(numericValue)

  return Math.round(numericValue * 100)
}

function getRawOptionGroups(product) {
  if (Array.isArray(product?.optionGroups)) return product.optionGroups
  if (Array.isArray(product?.optionsGroups)) return product.optionsGroups
  if (Array.isArray(product?.customizationGroups)) return product.customizationGroups
  if (Array.isArray(product?.choiceGroups)) return product.choiceGroups

  return []
}

function getGroupOptions(group) {
  if (Array.isArray(group?.options)) return group.options
  if (Array.isArray(group?.items)) return group.items
  if (Array.isArray(group?.choices)) return group.choices

  return []
}

function isIncludedPricingMode(group) {
  const mode = String(group?.pricingMode || group?.priceMode || '').toLowerCase()

  return ['included', 'included_first', 'first_included', 'firstincluded'].includes(mode)
}

function getGroupMin(group) {
  const required = group?.required || group?.isRequired
  const rawMin = group?.min ?? group?.minSelections ?? group?.minSelected
  const numericMin = Number(rawMin)

  if (Number.isFinite(numericMin) && numericMin > 0) return Math.floor(numericMin)

  return required ? 1 : 0
}

function getOptionPriceCents(option) {
  return moneyToCents(option?.price ?? option?.unitPrice, option?.priceCents ?? option?.unitPriceCents)
}

function getMinimumRequiredOptionsCents(product) {
  return getRawOptionGroups(product).reduce((total, group) => {
    const min = getGroupMin(group)

    if (min <= 0 || isIncludedPricingMode(group)) return total

    const availablePrices = getGroupOptions(group)
      .filter((option) => option?.available !== false && option?.isAvailable !== false)
      .map((option) => getOptionPriceCents(option))
      .filter((price) => price > 0)
      .sort((a, b) => a - b)

    if (availablePrices.length === 0) return total

    let groupTotal = 0

    for (let index = 0; index < min; index += 1) {
      groupTotal += availablePrices[index] ?? availablePrices[availablePrices.length - 1]
    }

    return total + groupTotal
  }, 0)
}

function getFirstValidValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '')
}

function getProductId(product) {
  return (
    product?.id ||
    product?.productId ||
    product?.originalProductId ||
    product?.slug ||
    product?.name ||
    ''
  )
}

function getProductImageSource(product) {
  return getFirstValidValue(
    product?.thumbnailUrl,
    product?.imageUrl,
    product?.image,
    product?.photoUrl,
    product?.coverUrl,
    product?.pictureUrl
  )
}

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function hasList(value) {
  return Array.isArray(value) && value.length > 0
}

function hasProductOptions(product) {
  return Boolean(
    hasList(product?.optionGroups) ||
      hasList(product?.optionsGroups) ||
      hasList(product?.customizationGroups) ||
      hasList(product?.choiceGroups) ||
      hasList(product?.options) ||
      hasList(product?.extras) ||
      hasList(product?.addons) ||
      hasList(product?.variations) ||
      hasList(product?.sizes)
  )
}

function getProductDisplayPrice(product, basePrice) {
  const basePriceCents = moneyToCents(basePrice)
  const requiredOptionsCents = getMinimumRequiredOptionsCents(product)
  const displayCents = basePriceCents + requiredOptionsCents

  return {
    value: centsToMoney(displayCents) || 0,
    from: requiredOptionsCents > 0,
  }
}

// isProductAvailable — determina se o produto DEVE SER MOSTRADO no cardário.
// usa shouldShowProductInStorefront: não filtra isAvailable.
// Para controle do CTA, use canAddProductToCart.
function isProductAvailableToShow(product, disabled) {
  if (disabled) return false
  return shouldShowProductInStorefront(product)
}

function getProductPrice(product) {
  const centsPrice = getFirstValidValue(
    product?.promotion?.active ? product?.promotion?.currentPriceCents : null,
    product?.promotionalPriceCents,
    product?.salePriceCents,
    product?.currentPriceCents,
    product?.priceCents
  )

  if (centsPrice !== null && centsPrice !== undefined) {
    return centsToMoney(centsPrice)
  }

  return Number(
    getFirstValidValue(
      product?.promotion?.active ? product?.promotion?.currentPrice : null,
      product?.promotionalPrice,
      product?.salePrice,
      product?.currentPrice,
      product?.price,
      0
    )
  )
}

function getProductOldPrice(product) {
  const centsOldPrice = getFirstValidValue(
    product?.promotion?.active ? product?.promotion?.oldPriceCents : null,
    product?.oldPriceCents,
    product?.compareAtPriceCents,
    product?.originalPriceCents
  )

  if (centsOldPrice !== null && centsOldPrice !== undefined) {
    return centsToMoney(centsOldPrice)
  }

  return Number(
    getFirstValidValue(
      product?.promotion?.active ? product?.promotion?.oldPrice : null,
      product?.oldPrice,
      product?.compareAtPrice,
      product?.originalPrice,
      0
    )
  )
}

function getDiscountPercent(price, oldPrice) {
  if (!oldPrice || !price || oldPrice <= price) return 0
  return Math.round(((oldPrice - price) / oldPrice) * 100)
}

function getPreparationTime(product) {
  return getFirstValidValue(
    product?.preparationTime,
    product?.prepTime,
    product?.timeToPrepare,
    product?.estimatedTime
  )
}

const VISUAL_BADGE_LABELS = {
  artesanal: 'Artesanal',
  caseiro: 'Caseiro',
  feito_na_hora: 'Feito na hora',
  especial_da_casa: 'Especial da casa',
  cremoso: 'Cremoso',
  saboroso: 'Saboroso',
  para_compartilhar: 'Para compartilhar',
  acompanhamento: 'Acompanhamento',
  novidade: 'Novidade',
  edicao_limitada: 'Edição limitada',
  premium: 'Premium',
}

const VISUAL_BADGE_ICONS = {
  artesanal: FiCoffee,
  caseiro: FiHome,
  feito_na_hora: FiZap,
  especial_da_casa: FiAward,
  cremoso: FiSmile,
  saboroso: FiSmile,
  para_compartilhar: FiUsers,
  acompanhamento: FiPackage,
  novidade: FiGift,
  edicao_limitada: FiClock,
  premium: FiAward,
}

function normalizeServingLabel(product) {
  const serving = product?.serving

  if (serving && typeof serving === 'object' && !Array.isArray(serving)) {
    if (serving.enabled === false) return ''
    const label = String(serving.label || '').trim()
    const count = Number(serving.count)
    if (label) return label.slice(0, 40)
    if (Number.isFinite(count) && count > 0) {
      const rounded = Math.floor(count)
      return `Serve ${rounded} ${rounded === 1 ? 'pessoa' : 'pessoas'}`
    }
    return ''
  }

  const legacy = getFirstValidValue(product?.serves, product?.portion)
  if (legacy === undefined || legacy === null || legacy === '') return ''

  const numeric = Number(legacy)
  if (Number.isFinite(numeric) && numeric > 0) {
    const rounded = Math.floor(numeric)
    return `Serve ${rounded} ${rounded === 1 ? 'pessoa' : 'pessoas'}`
  }

  return String(legacy).trim().slice(0, 40)
}

function normalizeVisualBadges(product, limit = 2) {
  const raw = Array.isArray(product?.visualBadges) ? product.visualBadges : []

  return raw
    .map((badge) => {
      const id = String(badge?.id || badge || '').trim()
      const label = String(badge?.label || VISUAL_BADGE_LABELS[id] || '').trim()
      return label ? { id: id || label, label: label.slice(0, 28), Icon: VISUAL_BADGE_ICONS[id] || FiTag } : null
    })
    .filter(Boolean)
    .slice(0, limit)
}

function makeCardBadge({ id, label, icon: Icon = null, className = '', style = undefined }) {
  return { id, label, Icon, className, style }
}

function ProductCard({
  product,
  store,
  disabled = false,
  compact = false,
  isOwner = false,
  onQuickEdit,
  onClick,
}) {
  const { addToCart } = useCart()

  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const productId = getProductId(product)

  const [isFavorite, setIsFavorite] = useState(() => {
    if (!productId) return false
    return getFavorites().includes(productId)
  })

  const themeColor = store?.themeColor || store?.primaryColor || '#f97316'
  // shouldShow: produto deve aparecer no cardário?
  const shouldShow = isProductAvailableToShow(product, disabled)
  // canAdd: pode adicionar ao carrinho? (considera isAvailable e stock)
  const canAdd = shouldShow && canAddProductToCart(product)
  // flags de UX
  const unavailable = shouldShow && isProductUnavailable(product)
  const outOfStock = shouldShow && hasOutOfStock(product)
  const hasOptions = hasProductOptions(product)

  const price = getProductPrice(product)
  const displayPrice = getProductDisplayPrice(product, price)
  const oldPrice = getProductOldPrice(product)
  const discountPercent = getDiscountPercent(price, oldPrice)
  const hasDiscount = discountPercent > 0
  const hasPromotionBadge = Boolean(product?.isPromotion || product?.isPromotional || product?.promotion)
  const schedulingBadges = useMemo(() => getProductSchedulingBadges(product, store), [product, store])
  const acceptsCoupons = productShowsCouponBadge(product)

  const productName = product?.name || 'Produto'
  const productDescription =
    product?.description || product?.shortDescription || 'Produto disponível no cardápio.'

  const preparationTime = getPreparationTime(product)
  const servingLabel = normalizeServingLabel(product)
  const visualBadges = useMemo(() => normalizeVisualBadges(product, 2), [product])
  const rawImageUrl = getProductImageSource(product)
  const imageTransformOptions = { replaceExistingTransform: true }
  const imageUrl = getCloudinaryImageUrl(
    rawImageUrl,
    compact ? 'productCardSmall' : 'productCard',
    imageTransformOptions
  )
  const imageUrlSm = getCloudinaryImageUrl(rawImageUrl, 'productCardMobile', imageTransformOptions)
  const imageSrcSet = getCloudinaryImageSrcSet(
    rawImageUrl,
    ['productCardMobile', 'productCard'],
    imageTransformOptions
  )

  const lowStock =
    product?.stock !== undefined &&
    Number(product.stock) > 0 &&
    Number(product.stock) <= 5

  const topBadges = (() => {
    const badges = []

    if (disabled) {
      badges.push(makeCardBadge({
        id: 'paused',
        label: 'Pedidos pausados',
        icon: FiInfo,
        className: 'bg-gray-100 text-gray-600 ring-gray-200',
      }))
    } else if (outOfStock) {
      badges.push(makeCardBadge({
        id: 'out-of-stock',
        label: 'Esgotado',
        icon: FiInfo,
        className: 'bg-gray-100 text-gray-600 ring-gray-200',
      }))
    } else if (unavailable) {
      badges.push(makeCardBadge({
        id: 'unavailable',
        label: 'Indisponível',
        icon: FiInfo,
        className: 'bg-orange-50 text-orange-700 ring-orange-200',
      }))
    }

    if (hasDiscount && canAdd) {
      badges.push(makeCardBadge({
        id: 'discount',
        label: `-${discountPercent}%`,
        icon: FiTag,
        className: 'bg-red-50 text-red-600 ring-red-100',
      }))
    } else if (hasPromotionBadge && canAdd) {
      badges.push(makeCardBadge({
        id: 'promotion',
        label: 'Promoção',
        icon: FiTag,
        className: 'bg-red-50 text-red-600 ring-red-100',
      }))
    }

    schedulingBadges.forEach((badge) => {
      badges.push(makeCardBadge({
        id: `schedule-${badge.id}`,
        label: badge.label,
        icon: badge.tone === 'orange' ? FiTag : FiClock,
        className: badge.tone === 'amber'
          ? 'bg-amber-50 text-amber-700 ring-amber-100'
          : badge.tone === 'green'
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
            : badge.tone === 'orange'
              ? 'bg-orange-50 text-orange-700 ring-orange-100'
              : 'bg-gray-50 text-gray-600 ring-gray-100',
      }))
    })

    if (product?.isFeatured && canAdd) {
      badges.push(makeCardBadge({
        id: 'featured',
        label: 'Destaque',
        icon: FiAward,
        className: 'ring-1',
        style: {
          color: themeColor,
          backgroundColor: `${themeColor}12`,
          borderColor: `${themeColor}20`,
        },
      }))
    }

    if (product?.isPopular && canAdd) {
      badges.push(makeCardBadge({
        id: 'popular',
        label: 'Mais pedido',
        icon: FiTrendingUp,
        className: 'bg-amber-50 text-amber-700 ring-amber-100',
      }))
    }

    visualBadges.forEach((badge) => {
      badges.push(makeCardBadge({
        id: `visual-${badge.id}`,
        label: badge.label,
        icon: badge.Icon,
        className: 'bg-orange-50 text-orange-700 ring-orange-100',
      }))
    })

    if (acceptsCoupons && canAdd) {
      badges.push(makeCardBadge({
        id: 'coupon',
        label: 'Aceita cupom',
        icon: FiTag,
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      }))
    }

    if (lowStock && canAdd) {
      badges.push(makeCardBadge({
        id: 'low-stock',
        label: 'Últimas unidades',
        className: 'bg-orange-50 text-orange-600 ring-orange-100',
      }))
    }

    return badges.slice(0, 2)
    })()

    const infoChips = (() => {
    const chips = []

    // No card compacto, "Com opções" é a informação mais importante.
    if (hasOptions) {
      chips.push(makeCardBadge({
        id: 'options',
        label: 'Com opções',
        className: 'bg-gray-50 text-gray-600 ring-gray-100',
      }))
    }

    if (servingLabel) {
      chips.push(makeCardBadge({
        id: 'serving',
        label: servingLabel,
        className: 'bg-gray-50 text-gray-600 ring-gray-100',
      }))
    }

    if (preparationTime) {
      chips.push(makeCardBadge({
        id: 'prep-time',
        label: preparationTime,
        icon: FiClock,
        className: 'bg-gray-50 text-gray-600 ring-gray-100',
      }))
    }

    // Máximo 2 para não invadir preço/botão.
    return chips.slice(0, 2)
  })()
  const cardStatusLabel = useMemo(() => {
    if (disabled) return 'Pedidos pausados'
    if (outOfStock) return 'Esgotado'
    if (unavailable) return 'Indisponível'
    if (justAdded) return 'Adicionado'
    if (hasOptions) return 'Personalizar'
    return 'Adicionar'
  }, [unavailable, outOfStock, disabled, hasOptions, justAdded])
  const compactBlockedCta = !canAdd && !isOwner

  const handleOpen = useCallback(() => {
    // Produto indisponível: não abre modal de compra, apenas informa.
    // Produto oculto/inativo/deletado: não deve estar aqui (filtrado antes).
    if (disabled && !isOwner) return
    if (!shouldShow && !isOwner) return
    if ((unavailable || outOfStock) && !isOwner) return  // sem modal de compra se bloqueado
    onClick?.(product)
  }, [disabled, shouldShow, unavailable, outOfStock, isOwner, onClick, product])

  const handleQuickEdit = useCallback(
    (event) => {
      event.stopPropagation()
      onQuickEdit?.(product)
    },
    [onQuickEdit, product]
  )

  const handleAdd = useCallback(
    (event) => {
      event.stopPropagation()

      if (!canAdd) return

      if (hasOptions && onClick) {
        onClick(product)
        return
      }

      addToCart(product)
      setJustAdded(true)

      window.setTimeout(() => {
        setJustAdded(false)
      }, 1200)
    },
    [addToCart, canAdd, hasOptions, onClick, product]
  )

  const handleFavorite = useCallback(
    (event) => {
      event.stopPropagation()

      if (!productId) return

      const favorites = getFavorites()
      const nextFavorites = favorites.includes(productId)
        ? favorites.filter((id) => id !== productId)
        : [...favorites, productId]

      saveFavorites(nextFavorites)
      setIsFavorite(nextFavorites.includes(productId))
    },
    [productId]
  )

  return (
    <article
      onClick={handleOpen}
      className={`
        group relative overflow-hidden rounded-[1.8rem] border bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_58%,#fff7ed_100%)] p-3.5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.02] sm:p-4
        transition-all duration-300 flex flex-col
        h-full min-h-[246px] sm:min-h-[268px] lg:h-[288px]
        ${
          canAdd
            ? 'cursor-pointer border-white/90 hover:-translate-y-1 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-100/40 active:scale-[0.995]'
            : (unavailable || outOfStock)
              ? 'cursor-default border-gray-100 opacity-75'
              : 'cursor-not-allowed border-gray-100 opacity-60 grayscale'
        }
        ${justAdded ? 'border-emerald-200 shadow-emerald-100 ring-2 ring-emerald-100' : ''}
      `}
      style={{ '--theme-color': themeColor }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-orange-50/70 via-white/45 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

      {/* 👈 2. h-full no wrapper interno para preencher o espaço do article */}
      <div className="relative flex h-full gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col py-1">
          
          {/* BLOCO DO TOPO (Tags, Título e Descrição) */}
          <div className="min-h-[148px] sm:min-h-[166px]">
            <div className="flex min-h-[2rem] max-h-[4.75rem] flex-wrap items-center gap-1.5 overflow-hidden">
              {topBadges.map((badge) => {
                const Icon = badge.Icon

                return (
                  <span
                    key={badge.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${badge.className}`}
                    style={badge.style}
                  >
                    {Icon && <Icon size={12} />}
                    {badge.label}
                  </span>
                )
              })}
            </div>

            <h3 className="mt-2 line-clamp-2 text-[1.02rem] font-black leading-tight text-[#111827] sm:text-lg">
              {productName}
            </h3>

            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[#6b7280]">
              {productDescription}
            </p>

            <div className="mt-3 flex min-h-[1.65rem] max-w-full flex-wrap items-start gap-2 overflow-hidden">
              {infoChips.map((chip) => {
                const Icon = chip.Icon

                return (
                  <span
                    key={chip.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${chip.className}`}
                  >
                    {Icon && <Icon size={12} />}
                    {chip.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 👈 3. BLOCO INFERIOR (Preço e Botão). O mt-auto joga eles para o fim do card */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-4 sm:gap-4">
            <div className="min-w-[88px] pr-1 sm:min-w-[102px]">
              {hasDiscount && (
                <p className="text-xs font-bold text-gray-400 line-through">
                  {formatMoney(oldPrice)}
                </p>
              )}

              {displayPrice.from && (
                <p className="whitespace-nowrap text-[10px] font-black uppercase leading-none tracking-normal text-[#f97316] sm:text-[11px]">
                  A partir de
                </p>
              )}

              <p className="mt-1 whitespace-nowrap text-[1.35rem] font-black leading-none tracking-tight text-[#111827] sm:text-2xl">
                {formatMoney(displayPrice.value)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isOwner && onQuickEdit && (
                <button
                  type="button"
                  onClick={handleQuickEdit}
                  className="flex h-11 min-w-[116px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 sm:h-12 sm:min-w-[132px] sm:px-5"
                >
                  <FiEdit2 size={14} />
                  Editar
                </button>
              )}

              {!isOwner && (
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className={`flex items-center justify-center gap-2 font-black transition active:scale-95 disabled:cursor-not-allowed ${
                    canAdd
                      ? 'h-11 min-w-[112px] rounded-[1rem] px-4 text-sm text-white shadow-lg hover:-translate-y-0.5 sm:h-12 sm:min-w-[132px] sm:rounded-[1.15rem] sm:px-5'
                      : 'h-9 min-w-0 rounded-xl bg-gray-100 px-3 text-[11px] text-gray-600 shadow-none sm:h-10 sm:px-3'
                  }`}
                  style={{
                    backgroundColor: canAdd ? (justAdded ? '#059669' : themeColor) : undefined,
                    boxShadow: canAdd ? `0 16px 32px ${themeColor}2b` : undefined,
                  }}
                  aria-label={`${cardStatusLabel} ${productName}`}
                >
                  {!compactBlockedCta && (
                    justAdded ? <FiCheckCircle size={15} /> : hasOptions ? <FiShoppingCart size={15} /> : <FiPlus size={15} />
                  )}
                  <span className="whitespace-nowrap">{cardStatusLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONTAINER DA IMAGEM */}
        <div
          className={`
            relative shrink-0 overflow-hidden rounded-[1.45rem] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]
            ${compact ? 'h-28 w-28' : 'h-32 w-32 sm:h-40 sm:w-40'}
          `}
        >
          {imageUrl && !imgLoaded && !imgError && (
            <div className="absolute inset-0 animate-pulse bg-gray-200" />
          )}

          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet || (imageUrlSm ? `${imageUrlSm} 160w, ${imageUrl} 196w` : undefined)}
              sizes="(max-width: 640px) 128px, 196px"
              alt={`Foto de ${productName}`}
              loading="lazy"
              decoding="async"
              width={196}
              height={196}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`
                h-full w-full bg-white object-contain object-center p-2 transition duration-500
                ${imgLoaded ? 'scale-100 opacity-100 group-hover:scale-[1.03]' : 'scale-95 opacity-0'}
              `}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-300">
              <FiImage size={28} />
              <span className="mt-1 text-[10px] font-black uppercase tracking-widest">
                Sem foto
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleFavorite}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-gray-500 shadow-lg shadow-black/5 backdrop-blur-md transition hover:scale-105 active:scale-95"
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <FiHeart
              size={16}
              className={isFavorite ? 'fill-red-500 text-red-500' : ''}
            />
          </button>

          {hasDiscount && canAdd && (
            <div className="absolute bottom-2 left-2 rounded-xl bg-red-500 px-2 py-1 text-[11px] font-black text-white shadow-lg">
              -{discountPercent}%
            </div>
          )}

          {justAdded && (
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-2 py-1.5 text-[11px] font-black text-white shadow-lg">
              <FiCheckCircle size={12} />
              No carrinho
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(ProductCard)
