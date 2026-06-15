// src/pages/merchant/menu/components/MenuProductsTab.jsx
// Aba de produtos: barra de filtros, lista de ProductRows, estado vazio.

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiBox,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCoffee,
  FiCopy,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiGift,
  FiHome,
  FiImage,
  FiList,
  FiPackage,
  FiSearch,
  FiStar,
  FiTag,
  FiTrash2,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi'

import { formatMoney, normalizeMoney } from '../utils/menuFormatters'
import { STATUS_FILTERS, VISUAL_BADGE_OPTIONS } from '../utils/menuPayloads'
import MenuEmptyState from './MenuEmptyState'
import { hasOutOfStock } from '../../../../utils/productStatus'
import { getProductSchedulingBadges } from '../../../../utils/publicScheduling'
import AnimatedSegmentedControl from '../../../../components/ui/AnimatedSegmentedControl'

// ── ProductBadges ──────────────────────────────────────────────────────────────

function productShowsCouponBadge(product) {
  return product?.acceptsCoupons !== false
    && product?.acceptsCoupon !== false
    && product?.couponEligible !== false
    && product?.showCouponBadge !== false
}

const VISUAL_BADGE_LABELS = new Map(
  VISUAL_BADGE_OPTIONS.map((badge) => [badge.id, badge.label])
)

const VISUAL_BADGE_ICONS = {
  artesanal: FiCoffee,
  caseiro: FiHome,
  feito_na_hora: FiZap,
  especial_da_casa: FiStar,
  cremoso: FiTag,
  saboroso: FiTag,
  para_compartilhar: FiUsers,
  acompanhamento: FiPackage,
  novidade: FiGift,
  edicao_limitada: FiClock,
  premium: FiStar,
}

function normalizeVisualBadgeId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getProductVisualBadges(product) {
  const raw = Array.isArray(product?.visualBadges) ? product.visualBadges : []

  return [
    ...new Map(
      raw
        .map((badge) => {
          const id = normalizeVisualBadgeId(badge?.id || badge?.value || badge)
          const label = VISUAL_BADGE_LABELS.get(id) || String(badge?.label || '').trim()

          if (!id || !label) return null

          return [
            id,
            {
              l: label,
              Icon: VISUAL_BADGE_ICONS[id] || FiTag,
              c: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/25 dark:text-orange-300 dark:ring-orange-900/50',
            },
          ]
        })
        .filter(Boolean)
    ).values(),
  ].slice(0, 5)
}

function getServingLabel(product) {
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
  }

  const legacy = product?.serves ?? product?.portion
  if (legacy === undefined || legacy === null || legacy === '') return ''

  const numeric = Number(legacy)
  if (Number.isFinite(numeric) && numeric > 0) {
    const rounded = Math.floor(numeric)
    return `Serve ${rounded} ${rounded === 1 ? 'pessoa' : 'pessoas'}`
  }

  return String(legacy).trim().slice(0, 40)
}

function hasProductOptions(product) {
  return Boolean(
    Array.isArray(product?.optionGroups) && product.optionGroups.length > 0
      || Array.isArray(product?.optionsGroups) && product.optionsGroups.length > 0
      || Array.isArray(product?.customizationGroups) && product.customizationGroups.length > 0
      || Array.isArray(product?.choiceGroups) && product.choiceGroups.length > 0
      || Array.isArray(product?.options) && product.options.length > 0
      || Array.isArray(product?.extras) && product.extras.length > 0
  )
}

function getGroupMin(group) {
  const required = group?.required || group?.isRequired
  const rawMin = group?.min ?? group?.minSelections ?? group?.minSelected
  const numericMin = Number(rawMin)

  if (Number.isFinite(numericMin) && numericMin > 0) return Math.floor(numericMin)

  return required ? 1 : 0
}

function isIncludedPricingMode(group) {
  const mode = String(group?.pricingMode || group?.priceMode || '').toLowerCase()

  return ['included', 'included_first', 'first_included', 'firstincluded'].includes(mode)
}

function getOptionPrice(option) {
  return normalizeMoney(option?.price ?? option?.unitPrice, option?.priceCents ?? option?.unitPriceCents)
}

function getMinimumRequiredOptionsPrice(product) {
  const groups = Array.isArray(product?.optionGroups) ? product.optionGroups : []

  return groups.reduce((total, group) => {
    const min = getGroupMin(group)

    if (min <= 0 || isIncludedPricingMode(group)) return total

    const availablePrices = (Array.isArray(group.options) ? group.options : [])
      .filter((option) => option?.available !== false && option?.isAvailable !== false)
      .map(getOptionPrice)
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((a, b) => a - b)

    if (availablePrices.length === 0) return total

    let groupTotal = 0
    for (let index = 0; index < min; index += 1) {
      groupTotal += availablePrices[index] ?? availablePrices[availablePrices.length - 1]
    }

    return total + groupTotal
  }, 0)
}

function ProductQuickInfo({ product }) {
  const chips = []
  const servingLabel = getServingLabel(product)
  const optionGroupsCount = Array.isArray(product.optionGroups) ? product.optionGroups.length : 0
  const requiredOptionsPrice = getMinimumRequiredOptionsPrice(product)

  if (product.preparationTime) chips.push({ label: product.preparationTime, Icon: FiClock })
  if (hasProductOptions(product)) chips.push({ label: optionGroupsCount > 0 ? `${optionGroupsCount} grupo${optionGroupsCount > 1 ? 's' : ''} de opções` : 'Com opções', Icon: FiList })
  if (requiredOptionsPrice > 0) chips.push({ label: `Opções +${formatMoney(requiredOptionsPrice)}`, Icon: FiPackage })
  if (servingLabel) chips.push({ label: servingLabel, Icon: FiUsers })
  if (product.scheduling?.mode === 'asap_only') chips.push({ label: 'Somente imediato', Icon: FiCalendar })
  if (product.stock !== undefined && product.stock !== null && product.stock !== '') chips.push({ label: `Estoque ${Number(product.stock)}`, Icon: FiPackage })

  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.slice(0, 5).map((chip) => {
        const Icon = chip.Icon

        return (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-600 ring-1 ring-gray-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"
          >
            <Icon size={11} />
            {chip.label}
          </span>
        )
      })}
    </div>
  )
}

function ProductBadges({ product, store }) {
  const badges = []

  if (productShowsCouponBadge(product)) {
    badges.push({
      l: 'Cupom',
      c: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-300 dark:ring-emerald-900/50',
    })
  }

  getProductVisualBadges(product).forEach((badge) => {
    badges.push(badge)
  })

  getProductSchedulingBadges(product, store).forEach((badge) => {
    badges.push({
      l: badge.label,
      c: badge.tone === 'amber'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : badge.tone === 'green'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : badge.tone === 'orange'
            ? 'bg-orange-50 text-orange-700 ring-orange-200'
            : 'bg-gray-50 text-gray-600 ring-gray-200',
    })
  })

  if (product.isFeatured)              badges.push({ l: '⭐ Destaque',    c: 'bg-yellow-50 text-yellow-700 ring-yellow-200' })
  if (product.isPromotion)             badges.push({ l: '🏷️ Promoção',    c: 'bg-red-50 text-red-600 ring-red-200' })
  if (hasOutOfStock(product))          badges.push({ l: 'Esgotado',       c: 'bg-red-50 text-red-600 ring-red-200' })
  if (product.isAvailable === false)   badges.push({ l: 'Indisponível',   c: 'bg-orange-50 text-orange-700 ring-orange-200' })
  if (product.isVisible === false)     badges.push({ l: 'Oculto',         c: 'bg-gray-100 text-gray-500 ring-gray-200' })
  if (product.isActive === false)      badges.push({ l: 'Inativo',        c: 'bg-red-50 text-red-500 ring-red-200' })

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b, index) => {
        const Icon = b.Icon

        return (
          <span
            key={`${b.l}-${index}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${b.c}`}
          >
            {Icon ? <Icon size={10} aria-hidden="true" /> : null}
            {b.l}
          </span>
        )
      })}
    </div>
  )
}

// ── ProductRow ─────────────────────────────────────────────────────────────────

function ProductRow({ product, categories, store, onEdit, onDuplicate, onDelete, onToggle }) {
  const basePrice = normalizeMoney(product.price, product.priceCents)
  const requiredOptionsPrice = getMinimumRequiredOptionsPrice(product)
  const price = basePrice + requiredOptionsPrice
  const showFromPrice = requiredOptionsPrice > 0
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
            <span className="text-sm font-black text-[#f97316]">
              {showFromPrice ? 'A partir de ' : ''}
              {formatMoney(price)}
            </span>
            {product.oldPrice != null && normalizeMoney(product.oldPrice, product.oldPriceCents) > 0 && (
              <span className="text-xs font-bold text-gray-400 line-through">
                {formatMoney(normalizeMoney(product.oldPrice, product.oldPriceCents))}
              </span>
            )}
            <ProductBadges product={product} store={store} />
          </div>
          <ProductQuickInfo product={product} />
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
  store,
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

  const productGroups = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const groupsById = new Map()

    filteredProducts.forEach((product) => {
      const categoryId = product.categoryId || '__uncategorized__'
      const category = categoryById.get(categoryId)
      const groupKey = category ? category.id : '__uncategorized__'

      if (!groupsById.has(groupKey)) {
        groupsById.set(groupKey, {
          id: groupKey,
          name: category?.name || 'Sem categoria',
          order: category ? Number(category.order ?? 9999) : 999999,
          products: [],
        })
      }

      groupsById.get(groupKey).products.push(product)
    })

    return Array.from(groupsById.values())
      .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name))
  }, [categories, filteredProducts])

  const hasFilters = search || filterStatus !== 'all' || filterCategoryId !== 'all'

  return (
    <div className="space-y-4">
      {/* Filter bar (Unified Container) */}
      <div className="flex overflow-x-auto pb-4 justify-start md:justify-center [scrollbar-width:none] w-full">
        <div className="inline-flex shrink-0 items-center gap-2 rounded-[1.25rem] border border-gray-200 bg-gray-100/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          
          {/* Search */}
          <div className="relative w-56 sm:w-64 shrink-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={14} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-9 w-full rounded-[14px] bg-white pl-9 pr-8 text-sm font-bold text-[#111827] outline-none shadow-sm transition-all focus:ring-2 focus:ring-orange-100 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-orange-900/30"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300">
                <FiX size={14} />
              </button>
            )}
          </div>

          <div className="h-5 w-px shrink-0 bg-gray-300 dark:bg-zinc-700" />

          {/* Category filter */}
          <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}
            className="h-9 w-40 sm:w-48 shrink-0 cursor-pointer rounded-[14px] bg-white px-3 text-sm font-bold text-[#111827] outline-none shadow-sm transition-all focus:ring-2 focus:ring-orange-100 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-orange-900/30">
            <option value="all">Todas categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <div className="h-5 w-px shrink-0 bg-gray-300 dark:bg-zinc-700" />

          {/* Status filter pills */}
          <div className="shrink-0">
            <AnimatedSegmentedControl
              size="md"
              variant="neutral"
              value={filterStatus}
              onChange={setFilterStatus}
              className="!bg-transparent !border-transparent dark:!bg-transparent dark:!border-transparent !p-0"
              options={STATUS_FILTERS.map((f) => ({
                value: f.id,
                label: f.label
              }))}
            />
          </div>
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
        <div className="space-y-5">
          {productGroups.map((group) => (
            <section key={group.id} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
                    <FiList size={14} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-[#111827]">
                      {group.name}
                    </h3>
                    <p className="text-xs font-bold text-[#9ca3af]">
                      {group.products.length} produto{group.products.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {group.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    categories={categories}
                    store={store}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    onToggle={onToggle}
                  />
                ))}
              </AnimatePresence>
            </section>
          ))}
        </div>
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
