// src/pages/merchant/menu/components/CategoryEditorDrawer.jsx
// Modal de criação/edição de categoria (centrado na tela).

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FiCheck, FiLoader, FiX } from 'react-icons/fi'

import { saveMenuItem } from '../../../../services/menuManagement'
import { getCallableErrorMessage } from '../../../../utils/callableError'
import { buildStoreScopedPayload } from '../../../../utils/storeIdentity'
import { cleanObject } from '../utils/menuPayloads'

/**
 * @param {{
 *   open: boolean,
 *   onClose: fn,
 *   editingCategory: object|null,
 *   storeId: string,
 *   store: object,
 *   categories: object[],
 *   onToast: fn,
 * }} props
 */
export default function CategoryEditorDrawer({ open, onClose, editingCategory, storeId, store, categories, onToast }) {
  const [form, setForm]   = useState({ name: '', description: '', isActive: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editingCategory
      ? { name: editingCategory.name || '', description: editingCategory.description || '', isActive: editingCategory.isActive !== false }
      : { name: '', description: '', isActive: true }
    )
  }, [open, editingCategory])

  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [open])

  const handleSave = async () => {
    if (!form.name.trim()) { onToast({ type: 'error', message: 'Nome da categoria é obrigatório.' }); return }
    setSaving(true)
    try {
      const scope = buildStoreScopedPayload(store)
      const nextOrder = categories.filter((c) => c.isDeleted !== true && !c.deletedAt).length

      if (import.meta.env.DEV) console.log('[CategoryEditorDrawer] Salvando categoria scope:', scope)

      const data = cleanObject({
        ...scope,
        name:        form.name.trim().slice(0, 60),
        description: form.description.trim().slice(0, 300),
        isActive:    Boolean(form.isActive),
        isDeleted:   false,
      })

      if (editingCategory?.id) {
        if (editingCategory.isVisible !== undefined) data.isVisible = editingCategory.isVisible
        await saveMenuItem({
          storeId,
          entityType: 'category',
          entityId: editingCategory.id,
          payload: data,
        })
        onToast({ type: 'success', message: 'Categoria atualizada!' })
      } else {
        data.order = nextOrder
        data.position = nextOrder
        data.isVisible = true
        await saveMenuItem({
          storeId,
          entityType: 'category',
          payload: data,
        })
        onToast({ type: 'success', message: 'Categoria criada!' })
      }
      onClose()
    } catch (err) {
      console.error('[CategoryEditorDrawer] handleSave:', err)
      onToast({ type: 'error', message: getCallableErrorMessage(err, 'Erro ao salvar categoria.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="relative flex flex-col max-h-[100dvh] w-full max-w-sm overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Header fixo */}
              <div className="shrink-0 border-b border-gray-100 dark:border-zinc-800 px-5 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-[#111827] dark:text-zinc-100">
                    {editingCategory ? 'Editar categoria' : 'Nova categoria'}
                  </h2>
                  <button type="button" onClick={onClose}
                    className="grid h-8 w-8 place-items-center rounded-full bg-gray-50 text-[#6b7280] transition hover:bg-gray-200 hover:rotate-90 active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700" aria-label="Fechar">
                    <FiX size={16} />
                  </button>
                </div>
              </div>

              {/* Corpo com scroll */}
              <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Hambúrgueres, Bebidas..." maxLength={60} autoFocus
                      className="h-12 w-full rounded-xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none transition-all hover:border-orange-200 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900/30 shadow-sm" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Descrição (opcional)</label>
                    <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Breve descrição" maxLength={200}
                      className="h-12 w-full rounded-xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none transition-all hover:border-orange-200 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900/30 shadow-sm" />
                  </div>
                  <label className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-orange-200 hover:bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-slate-600 hover:shadow-md">
                    <div>
                      <p className="text-sm font-black text-[#111827] dark:text-zinc-100 transition-colors group-hover:text-[#f97316]">Categoria ativa</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">Aparece na loja quando ativa</p>
                    </div>
                    <div className="relative shrink-0">
                      <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="sr-only" />
                      <div className={`h-6 w-11 rounded-full transition-colors duration-300 ${form.isActive ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-600 shadow-inner'}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer fixo */}
              <div className="shrink-0 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 px-5 py-4">
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} disabled={saving}
                    className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] py-3 text-sm font-black text-white shadow-md shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/40 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
                    {saving
                      ? <><FiLoader className="animate-spin" size={14} /> Salvando...</>
                      : <><FiCheck size={14} />{editingCategory ? 'Salvar' : 'Criar'}</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
