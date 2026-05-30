// src/pages/merchant/menu/components/MenuProductsTab.jsx
// Aba de produtos: barra de filtros, lista de ProductRows, estado vazio.

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiBox,
  FiCheck,
  FiCopy,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiImage,
  FiList,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

import { formatMoney, normalizeMoney } from '../utils/menuFormatters'
import { STATUS_FILTERS } from '../utils/menuPayloads'
import MenuEmptyState from './MenuEmptyState'
import { hasOutOfStock } from '../../../../utils/productStatus'

// ── ProductBadges ──────────────────────────────────────────────────────────────

function ProductBadges({ product }) {
  const badges = []
  if (product.isFeatured)              badges.push({ l: '⭐ Destaque',    c: 'bg-yellow-50 text-yellow-700 ring-yellow-200' })
  if (product.isPromotion)             badges.push({ l: '🏷️ Promoção',    c: 'bg-red-50 text-red-600 ring-red-200' })
  if (hasOutOfStock(product))          badges.push({ l: 'Esgotado',       c: 'bg-red-50 text-red-600 ring-red-200' })
  if (product.isAvailable === false)   badges.push({ l: 'Indisponível',   c: 'bg-orange-50 text-orange-700 ring-orange-200' })
  if (product.isVisible === false)     badges.push({ l: 'Oculto',         c: 'bg-gray-100 text-gray-500 ring-gray-200' })
  if (product.isActive === false)      badges.push({ l: 'Inativo',        c: 'bg-red-50 text-red-500 ring-red-200' })
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b.l} className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${b.c}`}>
          {b.l}
        </span>
      ))}
    </div>
  )
}

// ── ProductRow ─────────────────────────────────────────────────────────────────

function ProductRow({ product, categories, onEdit, onDuplicate, onDelete, onToggle }) {
  const price   = normalizeMoney(product.price, product.priceCents)
  const catName = categories.find((c) => c.id === product.categoryId)?.name || ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-100 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex w-full min-w-0 gap-3 sm:flex-1 sm:items-center sm:gap-4">
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name}
              className="h-full w-full rounded-2xl object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
              <FiImage size={22} />
            </div>
          )}
          {product.isFeatured && (
            <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-yellow-400 text-[10px]">⭐</div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="line-clamp-2 text-sm font-black text-[#111827] sm:truncate">{product.name}</p>
            {catName && <span className="text-xs font-bold text-[#9ca3af]">{catName}</span>}
          </div>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[#9ca3af] sm:line-clamp-1">{product.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-[#f97316]">{formatMoney(price)}</span>
            {product.oldPrice != null && normalizeMoney(product.oldPrice, product.oldPriceCents) > 0 && (
              <span className="text-xs font-bold text-gray-400 line-through">
                {formatMoney(normalizeMoney(product.oldPrice, product.oldPriceCents))}
              </span>
            )}
            <ProductBadges product={product} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid w-full grid-cols-5 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-1">
        <button type="button" title={product.isAvailable !== false ? 'Marcar indisponível' : 'Marcar disponível'}
          aria-label={product.isAvailable !== false ? 'Marcar produto indisponível' : 'Marcar produto disponível'}
          onClick={() => onToggle(product.id, 'isAvailable', product.isAvailable !== false)}
          className={`grid h-10 w-full place-items-center rounded-xl transition sm:h-8 sm:w-8 ${
            product.isAvailable !== false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
          }`}>
          {product.isAvailable !== false ? <FiCheck size={14} /> : <FiX size={14} />}
        </button>

        <button type="button" title={product.isVisible !== false ? 'Ocultar' : 'Exibir'}
          aria-label={product.isVisible !== false ? 'Ocultar produto do cardápio' : 'Exibir produto no cardápio'}
          onClick={() => onToggle(product.id, 'isVisible', product.isVisible !== false)}
          className="grid h-10 w-full place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 sm:h-8 sm:w-8">
          {product.isVisible !== false ? <FiEye size={14} /> : <FiEyeOff size={14} />}
        </button>

        <button type="button" title="Editar" aria-label="Editar produto" onClick={() => onEdit(product)}
          className="grid h-10 w-full place-items-center rounded-xl bg-orange-50 text-orange-600 transition hover:bg-orange-100 sm:h-8 sm:w-8">
          <FiEdit2 size={14} />
        </button>

        <button type="button" title="Duplicar" aria-label="Duplicar produto" onClick={() => onDuplicate(product)}
          className="grid h-10 w-full place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 sm:h-8 sm:w-8">
          <FiCopy size={14} />
        </button>

        <button type="button" title="Excluir" aria-label="Excluir produto" onClick={() => onDelete(product.id)}
          className="grid h-10 w-full place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 sm:h-8 sm:w-8">
          <FiTrash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ── MenuProductsTab ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   products: object[],
 *   categories: object[],
 *   search: string,
 *   setSearch: fn,
 *   filterCategoryId: string,
 *   setFilterCategoryId: fn,
 *   filterStatus: string,
 *   setFilterStatus: fn,
 *   onEdit: fn,
 *   onDuplicate: fn,
 *   onDelete: fn,
 *   onToggle: fn,
 *   onCreateProduct: fn,
 * }} props
 */
export default function MenuProductsTab({
  products,
  categories,
  search,
  setSearch,
  filterCategoryId,
  setFilterCategoryId,
  filterStatus,
  setFilterStatus,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onCreateProduct,
  onCreateCategory,
}) {
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => filterCategoryId === 'all' || p.categoryId === filterCategoryId)
      .filter((p) => {
        switch (filterStatus) {
          case 'active':      return p.isActive !== false && p.isAvailable !== false && p.isVisible !== false
          case 'unavailable': return p.isAvailable === false
          case 'hidden':      return p.isVisible === false
          case 'featured':    return p.isFeatured === true
          case 'promo':       return p.isPromotion === true
          case 'no-image':    return !p.imageUrl
          default:            return true
        }
      })
      .filter((p) =>
        !search.trim() ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        (Number(a?.order ?? 9999) - Number(b?.order ?? 9999)) ||
        (a.name || '').localeCompare(b.name || '')
      )
  }, [products, filterCategoryId, filterStatus, search])

  const hasFilters = search || filterStatus !== 'all' || filterCategoryId !== 'all'

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <FiX size={15} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}
          className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] lg:w-56">
          <option value="all">Todas as categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Status filter pills */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilterStatus(f.id)}
              className={`h-10 shrink-0 rounded-xl px-3 text-xs font-black transition lg:h-auto lg:py-1.5 ${
                filterStatus === f.id ? 'bg-[#f97316] text-white' : 'bg-white border border-gray-200 text-[#6b7280] hover:border-orange-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results info */}
      {hasFilters && (
        <p className="text-xs font-bold text-[#9ca3af]">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Product list */}
      {filteredProducts.length > 0 ? (
        <AnimatePresence mode="popLayout">
          {filteredProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              categories={categories}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </AnimatePresence>
      ) : categories.length === 0 ? (
        <MenuEmptyState
          icon={FiList}
          title="Crie uma categoria antes"
          description="Você precisa de pelo menos uma categoria (ex: 'Lanches', 'Bebidas') antes de cadastrar produtos."
          action={{ label: 'Criar categoria', onClick: onCreateCategory }}
        />
      ) : (
        <MenuEmptyState
          icon={FiBox}
          title={hasFilters ? 'Nenhum produto encontrado' : 'Adicione seu primeiro produto'}
          description={hasFilters
            ? 'Tente ajustar os filtros ou a busca.'
            : 'Crie produtos para que apareçam no seu cardápio digital.'}
          action={!search && filterStatus === 'all' && filterCategoryId === 'all'
            ? { label: 'Criar primeiro produto', onClick: onCreateProduct }
            : undefined}
        />
      )}
    </div>
  )
}
