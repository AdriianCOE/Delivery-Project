// src/pages/merchant/menu/components/DeliveryAreaEditorDrawer.jsx
// Modal de criação/edição de taxa de entrega por bairro.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { FiCheck, FiLoader, FiMapPin, FiX } from 'react-icons/fi'
import {
  normalizeNeighborhoodName,
  parseBrlToNumber,
  moneyToInputBrl,
} from '../utils/deliveryPayloads'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   editingArea: { neighborhood: string, fee: number|null, isCustom: boolean }|null,
 *   allNeighborhoods: string[],
 *   onSave: (originalName: string, newName: string, fee: number) => Promise<void>|void,
 *   onToast: (toast: { type: 'success'|'error'|'info'|'warning', message: string }) => void,
 * }} props
 */
export default function DeliveryAreaEditorDrawer({
  open,
  onClose,
  editingArea,
  allNeighborhoods = [],
  onSave,
  onToast,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const nameInputRef = useRef(null)

  const [name, setName] = useState('')
  const [feeInput, setFeeInput] = useState('0,00')
  const [saving, setSaving] = useState(false)

  const isEditing = Boolean(editingArea)
  const isPreset = Boolean(editingArea && !editingArea.isCustom)

  const originalName = editingArea?.neighborhood || ''

  const normalizedNeighborhoods = useMemo(
    () => allNeighborhoods.map((item) => normalizeNeighborhoodName(item)),
    [allNeighborhoods]
  )

  const closeDrawer = useCallback(() => {
    if (saving) return
    onClose()
  }, [onClose, saving])

  useEffect(() => {
    if (!open) return

    setSaving(false)

    if (editingArea) {
      setName(editingArea.neighborhood || '')
      setFeeInput(moneyToInputBrl(editingArea.fee ?? 0))
    } else {
      setName('')
      setFeeInput('0,00')
    }

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus?.()
    }, 80)

    return () => window.clearTimeout(focusTimer)
  }, [open, editingArea])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, closeDrawer])

  const handleFeeChange = (event) => {
    const raw = event.target.value.replace(/\D/g, '')
    const cents = Number(raw) || 0
    const value = cents / 100

    setFeeInput(
      value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }

  const validateForm = () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      onToast({ type: 'error', message: 'O nome do bairro é obrigatório.' })
      return null
    }

    const fee = parseBrlToNumber(feeInput)

    if (fee === null || fee < 0) {
      onToast({
        type: 'error',
        message: 'A taxa de entrega deve ser maior ou igual a zero.',
      })
      return null
    }

    const normalizedNewName = normalizeNeighborhoodName(trimmedName)
    const normalizedOriginalName = normalizeNeighborhoodName(originalName)

    const isDuplicate = normalizedNeighborhoods.some((normalizedName) => {
      if (isEditing && normalizedName === normalizedOriginalName) return false
      return normalizedName === normalizedNewName
    })

    if (isDuplicate) {
      onToast({
        type: 'error',
        message: 'Já existe um bairro cadastrado com este nome nesta loja.',
      })
      return null
    }

    return {
      trimmedName,
      fee,
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (saving) return

    const validData = validateForm()
    if (!validData) return

    setSaving(true)

    try {
      await onSave(originalName, validData.trimmedName, validData.fee)
      onClose()
    } catch (error) {
      console.error('[DeliveryAreaEditorDrawer] handleSubmit:', error)
      onToast({ type: 'error', message: 'Erro ao salvar a taxa do bairro.' })
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999]">
          <motion.button
            type="button"
            aria-label="Fechar modal"
            className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />

          <div className="absolute inset-0 flex min-h-[100dvh] items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="relative my-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-2xl shadow-black/20 dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-gray-100 bg-gradient-to-br from-orange-50 via-white to-white px-5 py-5 dark:border-zinc-800 dark:from-orange-950/20 dark:via-zinc-900 dark:to-zinc-900 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-[#f97316] dark:bg-orange-500/15">
                      <FiMapPin size={19} />
                    </div>

                    <div className="min-w-0">
                      <h2
                        id={titleId}
                        className="text-lg font-black leading-tight text-[#111827] dark:text-zinc-100"
                      >
                        {isEditing ? 'Editar bairro' : 'Adicionar bairro'}
                      </h2>
                      <p
                        id={descriptionId}
                        className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400"
                      >
                        Configure a taxa cobrada para entregar nesse bairro.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeDrawer}
                    disabled={saving}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#6b7280] shadow-sm ring-1 ring-gray-100 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-700"
                    aria-label="Fechar"
                  >
                    <FiX size={17} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="delivery-area-neighborhood"
                      className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400"
                    >
                      Nome do bairro *
                    </label>

                    <input
                      ref={nameInputRef}
                      id="delivery-area-neighborhood"
                      name="neighborhood"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={isPreset || saving}
                      placeholder="Ex: Farolândia, Centro..."
                      autoComplete="address-level3"
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-orange-500/20 dark:disabled:bg-zinc-800"
                    />

                    {isPreset && (
                      <p className="mt-1.5 text-xs font-semibold leading-relaxed text-gray-500 dark:text-zinc-500">
                        Bairros padrões da cidade não podem ter seus nomes renomeados.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="delivery-area-fee"
                      className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400"
                    >
                      Taxa de entrega *
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#6b7280] dark:text-zinc-400">
                        R$
                      </span>

                      <input
                        id="delivery-area-fee"
                        name="deliveryFee"
                        type="text"
                        inputMode="numeric"
                        value={feeInput}
                        onChange={handleFeeChange}
                        disabled={saving}
                        placeholder="0,00"
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-black text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-orange-500/20"
                      />
                    </div>

                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                      Use 0,00 para configurar entrega grátis nesse bairro.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-black text-[#6b7280] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:py-2.5"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-5 py-3 text-xs font-black text-white shadow-md shadow-orange-200 transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-orange-950/50 sm:py-2.5"
                  >
                    {saving ? <FiLoader className="animate-spin" size={14} /> : <FiCheck size={14} />}
                    {saving
                      ? 'Salvando...'
                      : isEditing
                        ? 'Salvar alterações'
                        : 'Adicionar bairro'}
                  </button>
                </div>
              </form>
            </motion.section>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}