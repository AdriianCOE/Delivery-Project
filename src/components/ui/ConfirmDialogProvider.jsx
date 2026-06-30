import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiHelpCircle, FiX } from 'react-icons/fi'

import FloatingToast from './FloatingToast'

const ConfirmDialogContext = createContext(null)

function ConfirmDialog({ dialog, onResolve }) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!dialog) return undefined
    const previousFocus = document.activeElement
    confirmRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onResolve(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [dialog, onResolve])

  if (!dialog || typeof document === 'undefined') return null

  const destructive = dialog.tone === 'danger'
  const Icon = destructive ? FiAlertTriangle : FiHelpCircle

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false)
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pratoby-confirm-title"
        aria-describedby="pratoby-confirm-description"
        className="w-full max-w-md rounded-t-3xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900 sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            destructive
              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
              : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300'
          }`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="pratoby-confirm-title" className="text-lg font-black text-gray-900 dark:text-zinc-50">
              {dialog.title || 'Confirmar ação'}
            </h2>
            <p id="pratoby-confirm-description" className="mt-1 text-sm leading-5 text-gray-600 dark:text-zinc-400">
              {dialog.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-300"
            aria-label="Cancelar e fechar"
          >
            <FiX size={17} />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="h-11 rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-700 dark:border-white/10 dark:text-zinc-200"
          >
            {dialog.cancelLabel || 'Cancelar'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResolve(true)}
            className={`h-11 rounded-xl px-5 text-sm font-black text-white ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {dialog.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const resolverRef = useRef(null)

  const resolveDialog = useCallback((confirmed) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback((options) => {
    resolverRef.current?.(false)
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog(typeof options === 'string' ? { description: options } : options)
    })
  }, [])

  const notify = useCallback((options) => {
    setToast(typeof options === 'string' ? { type: 'info', message: options } : options)
  }, [])

  const value = useMemo(() => ({ confirm, notify }), [confirm, notify])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog dialog={dialog} onResolve={resolveDialog} />
      <FloatingToast toast={toast} onClose={() => setToast(null)} />
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)
  if (!context) throw new Error('useConfirmDialog deve ser usado dentro de ConfirmDialogProvider.')
  return context
}
