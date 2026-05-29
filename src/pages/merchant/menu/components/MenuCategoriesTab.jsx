// src/pages/merchant/menu/components/MenuCategoriesTab.jsx
// Aba de categorias: lista com controles de ordem, ativação, edição e exclusão.

import { AnimatePresence, motion } from 'motion/react'
import {
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiList,
  FiPlus,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import MenuEmptyState from './MenuEmptyState'

// ── CategoryRow ────────────────────────────────────────────────────────────────

function CategoryRow({ category, productCount, index, total, onEdit, onDelete, onMoveUp, onMoveDown, onToggleActive }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-100 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex w-full min-w-0 items-start gap-3 sm:flex-1 sm:items-center sm:gap-4">
        {/* Order controls */}
        <div className="flex shrink-0 gap-1 sm:flex-col sm:gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="grid h-8 w-8 place-items-center rounded-lg bg-gray-50 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30 sm:h-6 sm:w-6" aria-label="Subir">
            <FiChevronUp size={13} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="grid h-8 w-8 place-items-center rounded-lg bg-gray-50 text-gray-400 transition hover:bg-gray-100 disabled:opacity-30 sm:h-6 sm:w-6" aria-label="Descer">
            <FiChevronDown size={13} />
          </button>
        </div>

        {/* Icon */}
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiList size={18} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-black text-[#111827] sm:truncate">{category.name}</p>
          {category.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[#9ca3af] sm:line-clamp-1">{category.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#6b7280]">{productCount} produto{productCount !== 1 ? 's' : ''}</span>
            {!category.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500">Inativa</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-1">
        <button type="button" title={category.isActive !== false ? 'Desativar' : 'Ativar'}
          aria-label={category.isActive !== false ? 'Desativar categoria' : 'Ativar categoria'}
          onClick={() => onToggleActive(category.id, category.isActive !== false)}
          className={`grid h-10 w-full place-items-center rounded-xl transition sm:h-8 sm:w-8 ${
            category.isActive !== false ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}>
          {category.isActive !== false ? <FiCheck size={14} /> : <FiX size={14} />}
        </button>
        <button type="button" title="Editar" aria-label="Editar categoria" onClick={() => onEdit(category)}
          className="grid h-10 w-full place-items-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100 sm:h-8 sm:w-8">
          <FiEdit2 size={14} />
        </button>
        <button type="button" title="Excluir" aria-label="Excluir categoria" onClick={() => onDelete(category)}
          className="grid h-10 w-full place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 sm:h-8 sm:w-8">
          <FiTrash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

// ── MenuCategoriesTab ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   categories: object[],
 *   productCountByCategory: object,
 *   onEdit: fn,
 *   onDelete: fn,
 *   onToggleActive: fn,
 *   onMoveUp: fn,
 *   onMoveDown: fn,
 *   onCreateCategory: fn,
 * }} props
 */
export default function MenuCategoriesTab({
  categories,
  productCountByCategory,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  onCreateCategory,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-[#9ca3af]">
          {categories.length} categoria{categories.length !== 1 ? 's' : ''} · use ↑↓ para reordenar
        </p>
        <button type="button" onClick={onCreateCategory}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c] sm:w-auto">
          <FiPlus size={15} /> Nova categoria
        </button>
      </div>

      {categories.length > 0 ? (
        <AnimatePresence mode="popLayout">
          {categories.map((cat, idx) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              index={idx}
              total={categories.length}
              productCount={productCountByCategory[cat.id] || 0}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onMoveUp={() => onMoveUp(cat)}
              onMoveDown={() => onMoveDown(cat)}
            />
          ))}
        </AnimatePresence>
      ) : (
        <MenuEmptyState
          icon={FiList}
          title="Crie sua primeira categoria"
          description="Organize os produtos em categorias como Hambúrgueres, Bebidas, Sobremesas..."
          action={{ label: 'Criar categoria', onClick: onCreateCategory }}
        />
      )}
    </div>
  )
}
