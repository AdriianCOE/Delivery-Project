import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { FiAlertCircle, FiAlertTriangle, FiBell, FiCheck, FiInfo, FiX } from 'react-icons/fi'
import { useDashboardNotifications } from '../../hooks/useDashboardNotifications'

function NotificationIcon({ type }) {
  if (type === 'critical') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
        <FiAlertCircle size={16} />
      </span>
    )
  }

  if (type === 'warning') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
        <FiAlertTriangle size={16} />
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
      <FiInfo size={16} />
    </span>
  )
}

export default function DashboardNotificationBell() {
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading,
  } = useDashboardNotifications()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 hover:text-gray-700 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Notificações"
        aria-expanded={isOpen}
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-4 top-[4.75rem] z-[90] w-[calc(100vw-2rem)] max-w-[22.5rem] overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white shadow-2xl shadow-gray-900/10 ring-1 ring-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[22.5rem]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100">
                  Notificações
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                  {unreadCount === 0
                    ? 'Nenhuma notificação nova'
                    : `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`}
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="shrink-0 rounded-full px-2 py-1 text-[11px] font-black text-[#f97316] transition hover:bg-orange-50 hover:text-[#ea580c] dark:hover:bg-orange-950/20"
                >
                  Marcar lidas
                </button>
              )}
            </div>

            <div className="max-h-[min(420px,70vh)] space-y-2 overflow-y-auto p-2.5 [scrollbar-width:thin]">
              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-5 text-xs font-bold text-gray-500 dark:bg-zinc-950 dark:text-zinc-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                  Carregando notificações...
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center dark:bg-zinc-950">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <FiCheck size={18} />
                  </span>
                  <p className="mt-3 text-sm font-black text-gray-900 dark:text-zinc-100">
                    Tudo certo por aqui
                  </p>
                  <p className="mx-auto mt-1 max-w-[15rem] text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                    Sua loja está em dia com as tarefas e faturamento.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const isUnread = unreadNotifications.some((unread) => unread.id === notification.id)

                  return (
                    <article
                      key={notification.id}
                      className={`group relative flex items-start gap-3 rounded-2xl border p-3 transition ${
                        isUnread
                          ? 'border-orange-100 bg-orange-50/60 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/10 dark:hover:bg-orange-950/20'
                          : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      {isUnread && (
                        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-[#f97316]" />
                      )}

                      <div className="shrink-0 pl-1">
                        <NotificationIcon type={notification.type} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          to={notification.link}
                          onClick={() => {
                            markAsRead(notification.id)
                            setIsOpen(false)
                          }}
                          className="block"
                        >
                          <h4 className="text-xs font-black leading-5 text-gray-900 transition group-hover:text-[#f97316] dark:text-zinc-100">
                            {notification.title}
                          </h4>
                          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                            {notification.description}
                          </p>
                        </Link>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification.id)}
                          className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          aria-label="Marcar notificação como lida"
                          title="Marcar como lida"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </article>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
