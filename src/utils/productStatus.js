// Fonte única de verdade para regras de visibilidade e disponibilidade de produto.
// Importe daqui — nunca espalhe filtros pelo projeto.

export function isProductDeleted(product) {
  return product?.isDeleted === true || Boolean(product?.deletedAt)
}

export function isProductHidden(product) {
  return product?.isVisible === false || product?.hidden === true
}

export function isProductInactive(product) {
  return product?.isActive === false || product?.active === false
}

export function isProductUnavailable(product) {
  return product?.isAvailable === false || product?.available === false
}

/**
 * Retorna apenas o status público; nunca depende da quantidade exata no catálogo.
 * @returns {'in_stock'|'low_stock'|'sold_out'|'not_tracked'}
 */
export function getPublicStockStatus(product) {
  const publicStock = product?.publicStock
  if (publicStock && typeof publicStock === 'object') {
    const validStatuses = ['in_stock', 'low_stock', 'sold_out', 'not_tracked']
    if (validStatuses.includes(publicStock.status)) return publicStock.status
  }

  // Fallback para documentos internos usados pelo painel e dados legados.
  const stock = product?.stock
  if (stock === undefined || stock === null || stock === '') return 'not_tracked'

  if (
    (typeof stock === 'number' && Number.isFinite(stock)) ||
    (typeof stock === 'string' && stock.trim() !== '' && Number.isFinite(Number(stock)))
  ) {
    return Number(stock) <= 0 ? 'sold_out' : 'in_stock'
  }

  if (typeof stock === 'object' && stock.enabled === true) {
    const quantity = Math.max(0, Math.floor(Number(stock.quantity) || 0))
    const threshold = Math.max(0, Math.floor(Number(stock.lowStockThreshold) || 0))
    if (stock.allowBackorder === true) return 'in_stock'
    if (quantity <= 0) return 'sold_out'
    return quantity <= threshold ? 'low_stock' : 'in_stock'
  }

  return 'not_tracked'
}

export function isPubliclySoldOut(product) {
  return getPublicStockStatus(product) === 'sold_out'
}

// Compatibilidade para telas internas que ainda consomem stock diretamente.
export function hasOutOfStock(product) {
  const stock = product?.stock
  if (stock === undefined || stock === null || stock === '') return false

  if (
    (typeof stock === 'number' && Number.isFinite(stock)) ||
    (typeof stock === 'string' && stock.trim() !== '' && Number.isFinite(Number(stock)))
  ) {
    return Number(stock) <= 0
  }

  if (typeof stock === 'object') {
    if (stock.enabled !== true || stock.allowBackorder === true) return false
    return Number(stock.quantity) <= 0
  }

  return false
}

/**
 * Não filtra isAvailable: produto indisponível aparece com CTA bloqueado.
 */
export function shouldShowProductInStorefront(product) {
  if (!product) return false
  if (isProductDeleted(product)) return false
  if (isProductHidden(product)) return false
  if (isProductInactive(product)) return false
  if (product?.paused === true) return false
  if (
    product?.publicStock?.status === 'sold_out' &&
    product?.publicStock?.soldOutBehavior === 'hide'
  ) return false
  return true
}

export function canAddProductToCart(product) {
  if (!shouldShowProductInStorefront(product)) return false
  if (isProductUnavailable(product)) return false
  if (isPubliclySoldOut(product)) return false
  return true
}

/**
 * @returns {'deleted'|'hidden'|'inactive'|'out_of_stock'|'low_stock'|'unavailable'|'available'}
 */
export function getProductDisplayStatus(product) {
  if (isProductDeleted(product)) return 'deleted'
  if (isProductHidden(product)) return 'hidden'
  if (isProductInactive(product)) return 'inactive'

  const stockStatus = getPublicStockStatus(product)
  if (stockStatus === 'sold_out') return 'out_of_stock'
  if (stockStatus === 'low_stock') return 'low_stock'
  if (isProductUnavailable(product)) return 'unavailable'
  return 'available'
}
