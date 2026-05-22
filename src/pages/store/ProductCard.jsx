import { memo, useCallback, useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiHeart,
  FiImage,
  FiInfo,
  FiPlus,
  FiShoppingCart,
  FiStar,
  FiTag,
} from 'react-icons/fi'

import { useCart } from '../../contexts/CartContext'
import { getCloudinaryOptimizedUrl } from '../../services/cloudinary'

const FAVORITES_KEY = '@PratoBy:favorites'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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

function getProductImage(product) {
  return getCloudinaryOptimizedUrl(
    getFirstValidValue(
      product?.imageUrl,
      product?.image,
      product?.photoUrl,
      product?.thumbnailUrl,
      product?.coverUrl,
      product?.pictureUrl
    ),
    700
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

function isProductAvailable(product, disabled) {
  if (disabled) return false
  if (!product) return false
  if (product.deletedAt) return false
  if (product.isAvailable === false) return false
  if (product.available === false) return false
  if (product.isVisible === false) return false
  if (product.visible === false) return false
  if (product.isActive === false) return false
  if (product.active === false) return false
  if (product.paused === true) return false
  const hasStockControl = product.stock !== undefined && product.stock !== null && product.stock !== ''
  if (hasStockControl && Number(product.stock) <= 0) return false

  return true
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

function getServes(product) {
  return getFirstValidValue(product?.serves, product?.serving, product?.portion)
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
  const available = isProductAvailable(product, disabled)
  const hasOptions = hasProductOptions(product)

  const price = getProductPrice(product)
  const displayPrice = getProductDisplayPrice(product, price)
  const oldPrice = getProductOldPrice(product)
  const discountPercent = getDiscountPercent(price, oldPrice)
  const hasDiscount = discountPercent > 0

  const productName = product?.name || 'Produto'
  const productDescription =
    product?.description || product?.shortDescription || 'Produto disponível no cardápio.'

  const preparationTime = getPreparationTime(product)
  const serves = getServes(product)
  const imageUrl = getProductImage(product)

  const lowStock =
    product?.stock !== undefined &&
    Number(product.stock) > 0 &&
    Number(product.stock) <= 5

  const cardStatusLabel = useMemo(() => {
    if (disabled) return 'Loja fechada'
    if (!available) return 'Indisponível'
    if (justAdded) return 'Adicionado'
    if (hasOptions) return 'Personalizar'
    return 'Adicionar'
  }, [available, disabled, hasOptions, justAdded])

  const handleOpen = useCallback(() => {
    if (!available && !isOwner) return
    onClick?.(product)
  }, [available, isOwner, onClick, product])

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

      if (!available) return

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
    [addToCart, available, hasOptions, onClick, product]
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
        group relative overflow-hidden rounded-[1.65rem] border bg-white/95 p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-4
        transition-all duration-300 flex flex-col
        h-full min-h-[176px] sm:min-h-[192px] /* 👈 ADICIONE ESSA LINHA AQUI */
        ${
          available
            ? 'cursor-pointer border-gray-100 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-200/70'
            : 'cursor-not-allowed border-gray-100 opacity-60 grayscale'
        }
      `}
      style={{ '--theme-color': themeColor }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gray-50/90 to-transparent" />

      {/* 👈 2. h-full no wrapper interno para preencher o espaço do article */}
      <div className="relative flex h-full gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col py-1">
          
          {/* BLOCO DO TOPO (Tags, Título e Descrição) */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {product?.isPopular && available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100">
                  <FiStar size={12} className="fill-amber-500" />
                  Popular
                </span>
              )}

              {product?.isFeatured && available && (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-black ring-1"
                  style={{
                    color: themeColor,
                    backgroundColor: `${themeColor}12`,
                    borderColor: `${themeColor}20`,
                  }}
                >
                  Destaque
                </span>
              )}

              {hasDiscount && available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black text-red-600 ring-1 ring-red-100">
                  <FiTag size={12} />-{discountPercent}%
                </span>
              )}

              {lowStock && available && (
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-600 ring-1 ring-orange-100">
                  Últimas unidades
                </span>
              )}

              {!available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black text-red-600 ring-1 ring-red-100">
                  <FiInfo size={12} />
                  Indisponível
                </span>
              )}
            </div>

            <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-[#111827]">
              {productName}
            </h3>

            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[#6b7280]">
              {productDescription}
            </p>

            {(preparationTime || serves || hasOptions) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500">
                {preparationTime && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                    <FiClock size={12} />
                    {preparationTime}
                  </span>
                )}

                {serves && (
                  <span className="rounded-full bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                    Serve {serves}
                  </span>
                )}

                {hasOptions && (
                  <span className="rounded-full bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                    Com opções
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 👈 3. BLOCO INFERIOR (Preço e Botão). O mt-auto joga eles para o fim do card */}
          <div className="mt-auto pt-4 flex items-end justify-between gap-4">
            <div className="min-w-0 pr-2">
              {hasDiscount && (
                <p className="text-xs font-bold text-gray-400 line-through">
                  {formatMoney(oldPrice)}
                </p>
              )}

              {displayPrice.from && (
                <p className="text-[11px] font-black uppercase tracking-wide text-[#f97316]">
                  A partir de
                </p>
              )}

              <p className="whitespace-nowrap text-xl font-black tracking-tight text-[#111827] sm:text-2xl">
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
                  disabled={!available}
                  className="flex h-11 min-w-[116px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-white shadow-lg shadow-gray-200 transition hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none sm:h-12 sm:min-w-[132px] sm:px-5"
                  style={{ backgroundColor: available ? themeColor : undefined }}
                  aria-label={`${cardStatusLabel} ${productName}`}
                >
                  {justAdded ? <FiCheckCircle size={15} /> : hasOptions ? <FiShoppingCart size={15} /> : <FiPlus size={15} />}
                  <span>{cardStatusLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CONTAINER DA IMAGEM */}
        <div
          className={`
            relative shrink-0 overflow-hidden rounded-[1.35rem] bg-gray-100 ring-1 ring-black/[0.03]
            ${compact ? 'h-28 w-28' : 'h-32 w-32 sm:h-36 sm:w-36'}
          `}
        >
          {imageUrl && !imgLoaded && !imgError && (
            <div className="absolute inset-0 animate-pulse bg-gray-200" />
          )}

          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={`Foto de ${productName}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`
                h-full w-full object-cover transition duration-500
                ${imgLoaded ? 'scale-100 opacity-100 group-hover:scale-105' : 'scale-95 opacity-0'}
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

          {hasDiscount && available && (
            <div className="absolute bottom-2 left-2 rounded-xl bg-red-500 px-2 py-1 text-[11px] font-black text-white shadow-lg">
              -{discountPercent}%
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(ProductCard)