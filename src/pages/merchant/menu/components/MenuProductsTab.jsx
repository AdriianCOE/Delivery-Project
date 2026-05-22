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
      className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-100 hover:shadow-md"
    >
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
          <p className="truncate text-sm font-black text-[#111827]">{product.name}</p>
          {catName && <span className="text-xs font-bold text-[#9ca3af]">{catName}</span>}
        </div>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[#9ca3af]">{product.description}</p>
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

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" title={product.isAvailable !== false ? 'Marcar indisponível' : 'Marcar disponível'}
          onClick={() => onToggle(product.id, 'isAvailable', product.isAvailable !== false)}
          className={`grid h-8 w-8 place-items-center rounded-xl transition ${
            product.isAvailable !== false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
          }`}>
          {product.isAvailable !== false ? <FiCheck size={14} /> : <FiX size={14} />}
        </button>

        <button type="button" title={product.isVisible !== false ? 'Ocultar' : 'Exibir'}
          onClick={() => onToggle(product.id, 'isVisible', product.isVisible !== false)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100">
          {product.isVisible !== false ? <FiEye size={14} /> : <FiEyeOff size={14} />}
        </button>

        <button type="button" title="Editar" onClick={() => onEdit(product)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100">
          <FiEdit2 size={14} />
        </button>

        <button type="button" title="Duplicar" onClick={() => onDuplicate(product)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100">
          <FiCopy size={14} />
        </button>

        <button type="button" title="Excluir" onClick={() => onDelete(product.id)}
          className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100">
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
      <div className="flex flex-col gap-3 sm:flex-row">
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
          className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] sm:w-48">
          <option value="all">Todas as categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Status filter pills */}
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilterStatus(f.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition ${
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
