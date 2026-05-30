// src/pages/merchant/menu/components/CategoryEditorDrawer.jsx
// Modal de criação/edição de categoria (centrado na tela).

import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { AnimatePresence, motion } from 'motion/react'
import { FiCheck, FiLoader, FiX } from 'react-icons/fi'

import { db } from '../../../../services/firebase'
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
        updatedAt:   serverTimestamp(),
      })

      if (editingCategory?.id) {
        if (editingCategory.isVisible !== undefined) data.isVisible = editingCategory.isVisible
        await updateDoc(doc(db, 'categories', editingCategory.id), data)
        onToast({ type: 'success', message: 'Categoria atualizada!' })
      } else {
        data.order = nextOrder
        data.position = nextOrder
        data.isVisible = true
        data.createdAt = serverTimestamp()
        await addDoc(collection(db, 'categories'), data)
        onToast({ type: 'success', message: 'Categoria criada!' })
      }
      onClose()
    } catch (err) {
      console.error('[CategoryEditorDrawer] handleSave:', err)
      onToast({ type: 'error', message: 'Erro ao salvar categoria.' })
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
              className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 [scrollbar-width:thin]"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#111827] dark:text-zinc-100">
                  {editingCategory ? 'Editar categoria' : 'Nova categoria'}
                </h2>
                <button type="button" onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 text-[#6b7280] transition hover:bg-gray-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700" aria-label="Fechar">
                  <FiX size={17} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Nome *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Hambúrgueres, Bebidas, Sobremesas..." maxLength={60} autoFocus
                    className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-500/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">Descrição (opcional)</label>
                  <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Breve descrição" maxLength={200}
                    className="h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-500/20" />
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-zinc-100">Categoria ativa</p>
                    <p className="text-xs text-[#9ca3af]">Aparece na loja quando ativa</p>
                  </div>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 accent-[#f97316]" />
                </label>
              </div>

              <div className="mt-5 flex gap-3">
                <button type="button" onClick={onClose} disabled={saving}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-3 text-sm font-black text-white shadow-md shadow-orange-200 transition hover:bg-[#ea580c] disabled:opacity-60 dark:shadow-orange-950/50">
                  {saving
                    ? <><FiLoader className="animate-spin" size={14} /> Salvando...</>
                    : <><FiCheck size={14} />{editingCategory ? 'Salvar' : 'Criar'}</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
