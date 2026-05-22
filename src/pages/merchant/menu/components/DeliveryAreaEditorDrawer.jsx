// src/pages/merchant/menu/components/DeliveryAreaEditorDrawer.jsx
// Modal de criação/edição de taxa de entrega por bairro.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FiCheck, FiLoader, FiX } from 'react-icons/fi'
import {
  normalizeNeighborhoodName,
  parseBrlToNumber,
  moneyToInputBrl,
} from '../utils/deliveryPayloads'

/**
 * @param {{
 *   open: boolean,
 *   onClose: fn,
 *   editingArea: { neighborhood: string, fee: number|null, isCustom: boolean }|null,
 *   allNeighborhoods: string[],
 *   onSave: fn,
 *   onToast: fn,
 * }} props
 */
export default function DeliveryAreaEditorDrawer({
  open,
  onClose,
  editingArea,
  allNeighborhoods,
  onSave,
  onToast,
}) {
  const [name, setName] = useState('')
  const [feeInput, setFeeInput] = useState('0,00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingArea) {
      setName(editingArea.neighborhood)
      setFeeInput(moneyToInputBrl(editingArea.fee ?? 0))
    } else {
      setName('')
      setFeeInput('0,00')
    }
  }, [open, editingArea])

  const handleFeeChange = (e) => {
    // Máscara de moeda em tempo real
    const raw = e.target.value.replace(/\D/g, '')
    const cents = Number(raw) || 0
    const val = cents / 100
    setFeeInput(
      val.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }

  const handleSaveClick = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      onToast({ type: 'error', message: 'O nome do bairro é obrigatório.' })
      return
    }

    const fee = parseBrlToNumber(feeInput)
    if (fee === null || fee < 0) {
      onToast({ type: 'error', message: 'A taxa de entrega deve ser maior ou igual a zero.' })
      return
    }

    // Validação de duplicidade usando normalização robusta (lowercase + trim + sem acentos)
    const normNewName = normalizeNeighborhoodName(trimmedName)
    const originalName = editingArea?.neighborhood || ''
    const normOriginalName = normalizeNeighborhoodName(originalName)

    const isDuplicate = allNeighborhoods.some((b) => {
      // Se estiver editando e for o mesmo bairro original, ignora
      if (editingArea && normalizeNeighborhoodName(b) === normOriginalName) {
        return false
      }
      return normalizeNeighborhoodName(b) === normNewName
    })

    if (isDuplicate) {
      onToast({
        type: 'error',
        message: 'Já existe um bairro cadastrado com este nome nesta loja.',
      })
      return
    }

    setSaving(true)
    try {
      await onSave(originalName, trimmedName, fee)
      onClose()
    } catch (err) {
      console.error('[DeliveryAreaEditorDrawer] handleSave:', err)
      onToast({ type: 'error', message: 'Erro ao salvar a taxa do bairro.' })
    } finally {
      setSaving(false)
    }
  }

  const isPreset = editingArea && !editingArea.isCustom

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-[2rem] bg-white p-6 shadow-2xl [scrollbar-width:thin]"
            >
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#111827]">
                  {editingArea ? 'Editar bairro' : 'Adicionar bairro'}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 text-[#6b7280] transition hover:bg-gray-100"
                  aria-label="Fechar"
                >
                  <FiX size={17} />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Nome do Bairro *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPreset}
                    placeholder="Ex: Farolândia, Centro..."
                    className="h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {isPreset && (
                    <p className="mt-1.5 text-xs font-semibold text-gray-400">
                      Bairros padrões da cidade não podem ter seus nomes renomeados.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Taxa de Entrega (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#6b7280]">
                      R$
                    </span>
                    <input
                      type="text"
                      value={feeInput}
                      onChange={handleFeeChange}
                      placeholder="0,00"
                      className="h-12 w-full rounded-2xl border border-gray-200 pl-11 pr-4 text-sm font-black text-[#111827] outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-[#6b7280]">
                    Digite `0,00` para configurar como entrega **Grátis**.
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-[#6b7280] transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#f97316] px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-200 transition hover:bg-[#ea580c] disabled:opacity-50"
                >
                  {saving ? (
                    <FiLoader className="animate-spin" size={14} />
                  ) : (
                    <FiCheck size={14} />
                  )}
                  {editingArea ? 'Salvar alterações' : 'Adicionar bairro'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
