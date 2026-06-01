import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi'

export default function FloatingToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onClose, 3200)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  if (typeof document === 'undefined') return null

  const isSuccess = toast.type === 'success'
  const isError = toast.type === 'error'
  const isWarning = toast.type === 'warning'
  
  let Icon = FiInfo
  let iconClass = 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
  let title = toast.title || 'Aviso'

  if (isSuccess) {
    Icon = FiCheckCircle
    iconClass = 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10' 
    title = toast.title || 'Tudo certo'
  } else if (isError) {
    Icon = FiAlertCircle
    iconClass = 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
    title = toast.title || 'Erro'
  } else if (isWarning) {
    Icon = FiAlertTriangle
    iconClass = 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
    title = toast.title || 'Atenção'
  } else if (toast.type === 'info') {
    title = toast.title || 'Atenção'
  } else {
    // default to warning for backward compatibility
    Icon = FiAlertTriangle
    iconClass = 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
    title = toast.title || 'Atenção'
  }

  const toastContent = (
    <div className="fixed left-1/2 top-5 z-[200] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#6b7280] dark:text-zinc-400">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-[#111827] dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
          aria-label="Fechar"
        >
          <FiX size={16} />
        </button>
      </div>
    </div>
  )

  return createPortal(toastContent, document.body)
}
