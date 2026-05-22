// src/utils/productStatus.js
// Fonte única de verdade para regras de visibilidade e disponibilidade de produto.
// Importe daqui — nunca espalhe filtros pelo projeto.

/**
 * Produto foi deletado (não deve aparecer em lugar algum para o cliente).
 */
export function isProductDeleted(product) {
  return product?.isDeleted === true || Boolean(product?.deletedAt)
}

/**
 * Produto está oculto pelo lojista (isVisible=false ou campo legado hidden).
 * Produto oculto NÃO aparece no cardápio público.
 */
export function isProductHidden(product) {
  return product?.isVisible === false || product?.hidden === true
}

/**
 * Produto foi desativado pelo lojista (isActive=false).
 * Tratado como "não publicado" para o cliente.
 */
export function isProductInactive(product) {
  return product?.isActive === false || product?.active === false
}

/**
 * Produto está indisponível momentaneamente (isAvailable=false).
 * Produto indisponível APARECE no cardápio, mas CTA fica bloqueado.
 */
export function isProductUnavailable(product) {
  return product?.isAvailable === false || product?.available === false
}

/**
 * Estoque esgotado — apenas quando controle de estoque está ativo.
 * stock=undefined/null/'' = sem controle → produto NÃO some.
 * stock=0 = controle ativo e zerado → aparece como esgotado.
 */
export function hasOutOfStock(product) {
  const stock = product?.stock
  if (stock === undefined || stock === null || stock === '') return false
  return Number(stock) <= 0
}

/**
 * Deve o produto aparecer no cardápio público?
 * NÃO filtra isAvailable (indisponível aparece, mas bloqueado).
 */
export function shouldShowProductInStorefront(product) {
  if (!product) return false
  if (isProductDeleted(product)) return false
  if (isProductHidden(product)) return false
  if (isProductInactive(product)) return false
  if (product?.paused === true) return false
  return true
}

/**
 * O cliente pode adicionar este produto ao carrinho?
 */
export function canAddProductToCart(product) {
  if (!shouldShowProductInStorefront(product)) return false
  if (isProductUnavailable(product)) return false
  if (hasOutOfStock(product)) return false
  return true
}

/**
 * Retorna o status de exibição para uso em badges/overlays.
 * @returns {'deleted'|'hidden'|'inactive'|'out_of_stock'|'unavailable'|'available'}
 */
export function getProductDisplayStatus(product) {
  if (isProductDeleted(product)) return 'deleted'
  if (isProductHidden(product)) return 'hidden'
  if (isProductInactive(product)) return 'inactive'
  if (hasOutOfStock(product)) return 'out_of_stock'
  if (isProductUnavailable(product)) return 'unavailable'
  return 'available'
}
