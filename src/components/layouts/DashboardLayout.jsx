import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { AnimatePresence, motion } from 'motion/react'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import { db, functions } from '../../services/firebase'
import { auth } from '../../services/firebaseAuth'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardTheme } from '../../contexts/DashboardThemeContext'
import ProfilePanel from '../merchant/ProfilePanel'
import NotificationsOnboardingBanner from '../merchant/NotificationsOnboardingBanner'
import { DashboardPageSkeleton } from '../shared/Skeletons'
import DashboardNotificationBell from '../notifications/DashboardNotificationBell'
import DashboardTrialRibbon from '../notifications/DashboardTrialRibbon'
import { useDashboardNotifications } from '../../hooks/useDashboardNotifications'
import { getDashboardAreaForPath } from '../../utils/notificationFormatters'
import { notificationPreferenceEnabled } from '../../utils/notificationPreferences'
import { getCallableErrorMessage } from '../../utils/callableError'

import {
  FiBarChart2,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiGrid,
  FiHome,
  FiLayers,
  FiLoader,
  FiLock,
  FiLogOut,
  FiMenu,
  FiMonitor,
  FiMoon,
  FiPhone,
  FiPieChart,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiSun,
  FiTruck,
  FiUser,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
  FiZap,
} from 'react-icons/fi'

const NAV_SECTIONS = [
  {
    title: 'Início',
    items: [
      {
        label: 'Dashboard',
        description: 'Visão geral da operação',
        to: '/dashboard',
        icon: FiHome,
        end: true,
        priority: 'normal',
      },
    ],
  },
  {
    title: 'Operação',
    description: 'Pedidos, cozinha e retirada',
    items: [
      {
        label: 'Pedidos',
        description: 'Pedidos online, agendados e balcão',
        to: '/dashboard/orders',
        icon: FiShoppingBag,
        priority: 'critical',
      },
      {
        label: 'Tela de Cozinha',
        description: 'Produção em tempo real',
        to: '/dashboard/out-screen',
        icon: FiMonitor,
        priority: 'high',
      },
      {
        label: 'Painel de Retirada',
        description: 'Pedidos prontos para clientes',
        to: '/dashboard/out-screen/customer',
        icon: FiClock,
        priority: 'high',
      },
    ],
  },
  {
    title: 'Cardápio e loja',
    description: 'Vitrine pública e experiência do cliente',
    items: [
      {
        label: 'Cardápio',
        description: 'Produtos, categorias e adicionais',
        to: '/dashboard/menu',
        icon: FiGrid,
        priority: 'high',
      },
      {
        label: 'QR Codes',
        description: 'Link e QR da loja',
        to: '/dashboard/qrcodes',
        icon: FiGrid,
        priority: 'normal',
      },
      {
        label: 'Avaliações',
        description: 'Feedback dos clientes',
        to: '/dashboard/reviews',
        icon: FiStar,
        priority: 'normal',
      },
    ],
  },
  {
    title: 'Gestão',
    description: 'Vendas, pagamentos e assinatura',
    items: [
      {
        label: 'Estatísticas',
        description: 'Faturamento, canais e produtos',
        to: '/dashboard/stats',
        icon: FiBarChart2,
        priority: 'normal',
      },
      {
        label: 'Pagamentos',
        description: 'Pix, maquininha, Asaas e encomendas',
        to: '/dashboard/pagamentos',
        icon: FiDollarSign,
        priority: 'billing',
      },
      {
        label: 'Assinatura',
        description: 'Plano, teste e cobrança',
        to: '/dashboard/billing',
        icon: FiCreditCard,
        priority: 'billing',
      },
    ],
  },
  {
    title: 'Conta',
    description: 'Loja, operação e segurança',
    items: [
      {
        label: 'Configurações',
        description: 'Loja, horários, entrega e agendamento',
        to: '/dashboard/settings',
        icon: FiSettings,
        priority: 'settings',
      },
      {
        label: 'Perfil',
        description: 'Conta e segurança',
        to: '/dashboard/profile',
        action: 'PROFILE_MODAL',
        icon: FiUser,
        priority: 'settings',
      },
    ],
  },
]

const MAIN_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

const MOBILE_NAV_PATHS = [
  '/dashboard/orders',
  '/dashboard/menu',
  '/dashboard/out-screen',
  '/dashboard',
]

const FUTURE_SECTIONS = [
  {
    title: 'Crescimento',
    items: [
      {
        label: 'Clientes',
        description: 'Histórico, recorrência e fidelização',
        icon: FiUsers,
        to: '/dashboard/users',
      },
      {
        label: 'Relatórios',
        description: 'Análises avançadas e exportações',
        icon: FiPieChart,
        to: '/dashboard/relatorios',
      },
    ],
  },
  {
    title: 'Operação avançada',
    items: [
      {
        label: 'MotoBot',
        description: 'Motoboys, entregas e rotas',
        icon: FiTruck,
        to: '/dashboard/motobot',
      },
      {
        label: 'Automações',
        description: 'Sino, fechamento e impressão',
        icon: FiZap,
        to: '/dashboard/automacoes',
      },
      {
        label: 'Equipe',
        description: 'Usuários, permissões e funções',
        icon: FiLayers,
        to: '/dashboard/equipe',
      },
    ],
  },
]

const DASHBOARD_ROUTE_PREFETCHERS = {
  '/dashboard/orders': () => import('../../pages/merchant/OrdersPage'),
  '/dashboard/menu': () => import('../../pages/merchant/MenuManagementPage'),
  '/dashboard/pagamentos': () => import('../../pages/merchant/PaymentsPage'),
  '/dashboard/qrcodes': () => import('../../pages/merchant/QRCodePage'),
  '/dashboard/settings': () => import('../../pages/merchant/Settings'),
  '/dashboard/stats': () => import('../../pages/merchant/Statistics'),
  '/dashboard/out-screen': () => import('../../pages/merchant/KitchenDisplayPage'),
  '/dashboard/out-screen/customer': () => import('../../pages/merchant/CustomerDisplayPage'),
  '/dashboard/reviews': () => import('../../pages/merchant/Reviews'),
  '/dashboard/billing': () => import('../../pages/merchant/BillingPage'),
}

function prefetchDashboardRoute(path) {
  const prefetcher = DASHBOARD_ROUTE_PREFETCHERS[path]
  if (!prefetcher) return

  prefetcher().catch(() => {
    // Prefetch é melhoria de UX. Se falhar, a rota ainda carrega normal depois.
  })
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function isPathActive(pathname, item) {
  if (item.end) return pathname === item.to

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function getNavNotificationArea(item) {
  return getDashboardAreaForPath(item?.to)
}

function formatBadgeCount(count) {
  if (!count) return null
  return count > 99 ? '99+' : String(count)
}

function NotificationBadge({ count = 0, active = false }) {
  const label = formatBadgeCount(count)

  if (label) {
    return (
      <span
        className={cn(
          'relative z-10 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none shadow-sm',
          active
            ? 'bg-white text-[#f97316] ring-1 ring-white/60'
            : 'bg-red-500 text-white ring-2 ring-white dark:ring-zinc-900'
        )}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'relative z-10 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm',
        active ? 'bg-white ring-2 ring-white/40' : 'bg-red-500 ring-2 ring-white dark:ring-zinc-900'
      )}
    />
  )
}

function PratoByMark({ compact = false, collapsed = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src="/icons/android-chrome-192x192.png"
        alt="PratoBy"
        className={cn(
          compact || collapsed ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-3xl',
          'shrink-0 object-cover shadow-lg shadow-orange-600/15'
        )}
      />

      {!collapsed && (
        <div className="min-w-0">
          <p
            className={cn(
              compact ? 'text-base' : 'text-lg',
              'truncate font-black tracking-tight text-[#111827] dark:text-white'
            )}
          >
            Prato<span className="text-[#f97316]">By</span>
          </p>

          <p className="truncate text-xs font-bold text-[#6b7280] dark:text-zinc-400">
            Painel do lojista
          </p>
        </div>
      )}
    </div>
  )
}

function SidebarSection({ title, children, collapsed = false }) {
  return (
    <section className={cn('min-w-0 snap-start scroll-mt-4', !collapsed && 'rounded-[1.5rem] border border-gray-100 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/60 p-2 mb-2')}>
      {!collapsed ? (
        <p className="mb-1.5 px-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
          {title}
        </p>
      ) : (
        <div className="my-3 h-[1px] bg-gray-100 dark:bg-zinc-800 mx-2" />
      )}

      <div className="space-y-1">{children}</div>
    </section>
  )
}

function MainNavItem({ item, onNavigate, onCustomAction, collapsed = false, badgeCount = 0, hasNotification = false }) {
  const Icon = item.icon
  const [isHovered, setIsHovered] = useState(false)
  const showNotification = badgeCount > 0 || hasNotification
  const notificationLabel = badgeCount > 0
    ? `${item.label}, ${badgeCount > 99 ? '99 ou mais' : badgeCount} notificações não lidas`
    : `${item.label}, há notificação nova`

  const priorityStyles = {
    critical: 'text-orange-600 dark:text-orange-500',
    high: 'text-zinc-800 dark:text-zinc-200',
    normal: 'text-[#6b7280] dark:text-zinc-400',
    billing: 'text-emerald-600 dark:text-emerald-500',
    settings: 'text-[#6b7280] dark:text-zinc-400',
  }
  const colorClass = item.priority ? priorityStyles[item.priority] : priorityStyles.normal

  const handleClick = (e) => {
    if (item.action) {
      e.preventDefault()
      if (onCustomAction) onCustomAction(item.action)
      if (onNavigate) onNavigate()
      return
    }
    if (onNavigate) onNavigate()
  }

  return (
    <NavLink
      to={item.to}
      onMouseEnter={() => prefetchDashboardRoute(item.to)}
      onFocus={() => prefetchDashboardRoute(item.to)}
      end={item.end}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={showNotification ? notificationLabel : item.label}
      data-has-notification={showNotification ? 'true' : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex min-w-0 items-center rounded-2xl px-3 py-3 text-sm font-black transition active:scale-[0.99] cursor-pointer',
          collapsed ? 'justify-center px-1' : 'gap-3',
          isActive
            ? 'text-white'
            : cn(colorClass, 'hover:bg-[#f9fafb] hover:text-[#111827] dark:hover:bg-zinc-800 dark:hover:text-white')
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-2xl bg-[#f97316] shadow-lg shadow-orange-600/20"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            />
          )}
          <span
            className={cn(
              'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition',
              isActive
                ? 'bg-white/15 text-white'
                : 'bg-gray-50 text-[#6b7280] group-hover:bg-white group-hover:text-[#f97316] dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700'
            )}
          >
            <Icon size={18} />
          </span>

          {!collapsed && (
            <span className="relative z-10 min-w-0 flex-1 animate-[fadeIn_0.2s_ease-out]">
              <span className="block truncate">{item.label}</span>

              <span
                className={cn(
                  'mt-0.5 block truncate text-[11px] font-bold',
                  isActive ? 'text-white/75' : 'text-[#9ca3af]'
                )}
              >
                {item.description}
              </span>
            </span>
          )}

          {!collapsed && isActive && <FiChevronRight className="relative z-10 shrink-0" size={16} />}

          {showNotification && (
            <span
              className={cn(
                collapsed
                  ? 'absolute right-1.5 top-1.5 z-20'
                  : 'relative z-10 ml-1'
              )}
            >
              <NotificationBadge count={badgeCount} active={isActive} />
            </span>
          )}

          {/* Tooltip para sidebar colapsada */}
          {collapsed && isHovered && (
            <div className="absolute left-20 z-[9999] pointer-events-none flex items-center">
              <div className="h-0 w-0 border-y-6 border-y-transparent border-r-6 border-r-zinc-900/95 dark:border-r-white/95" />
              <div className="rounded-xl border border-white/10 bg-zinc-900/95 dark:bg-white/95 px-3 py-2 text-xs font-black text-white dark:text-zinc-900 shadow-xl backdrop-blur-md whitespace-nowrap">
                <p className="font-black">{item.label}</p>
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-0.5">{item.description}</p>
              </div>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
}

function ComingSoonNavItem({ item, onNavigate, collapsed = false }) {
  const Icon = item.icon
  const [isHovered, setIsHovered] = useState(false)

  return (
    <NavLink
      onMouseEnter={() => item.to && prefetchDashboardRoute(item.to)}
      onFocus={() => item.to && prefetchDashboardRoute(item.to)}
      onTouchStart={() => item.to && prefetchDashboardRoute(item.to)} 
      to={item.to}
      onClick={onNavigate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={({ isActive }) =>
        cn(
          'group relative flex min-w-0 items-center rounded-2xl px-3 py-3 text-left text-sm font-black transition active:scale-[0.99] cursor-pointer',
          collapsed ? 'justify-center px-1' : 'gap-3',
          isActive
            ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100 dark:bg-orange-950/20 dark:ring-orange-900/30'
            : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition',
              isActive
                ? 'bg-white text-[#f97316] dark:bg-zinc-800 dark:text-[#f97316]'
                : 'bg-gray-50 text-[#6b7280] group-hover:bg-white group-hover:text-[#f97316] dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700'
            )}
          >
            <Icon size={18} />
          </span>

          {!collapsed && (
            <span className="min-w-0 flex-1 animate-[fadeIn_0.2s_ease-out]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{item.label}</span>

                <span className="shrink-0 rounded-full bg-[#111827] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white dark:bg-zinc-800 dark:text-zinc-300">
                  Em breve
                </span>
              </span>

              <span className="mt-0.5 block truncate text-[11px] font-bold text-[#9ca3af] dark:text-zinc-500">
                {item.description}
              </span>
            </span>
          )}

          {!collapsed && (
            <FiLock
              className={cn(
                'shrink-0',
                isActive ? 'text-[#f97316]' : 'text-gray-300 dark:text-zinc-600'
              )}
              size={15}
            />
          )}

          {/* Tooltip para sidebar colapsada */}
          {collapsed && isHovered && (
            <div className="absolute left-20 z-[9999] pointer-events-none flex items-center">
              <div className="h-0 w-0 border-y-6 border-y-transparent border-r-6 border-r-zinc-900/95 dark:border-r-white/95" />
              <div className="rounded-xl border border-white/10 bg-zinc-900/95 dark:bg-white/95 px-3 py-2 text-xs font-black text-white dark:text-zinc-900 shadow-xl backdrop-blur-md whitespace-nowrap">
                <p className="font-black">{item.label} (Em breve)</p>
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-0.5">{item.description}</p>
              </div>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
}

function MobileNavItem({ item, badgeCount = 0, hasNotification = false }) {
  const Icon = item.icon
  const showNotification = badgeCount > 0 || hasNotification

  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={showNotification
        ? `${item.label}, ${badgeCount > 0 ? `${badgeCount > 99 ? '99 ou mais' : badgeCount} notificações não lidas` : 'há notificação nova'}`
        : item.label}
      className={({ isActive }) =>
        cn(
          'relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98]',
          isActive
            ? 'bg-orange-50 text-[#f97316] dark:bg-orange-950/20'
            : 'text-[#6b7280] active:bg-gray-50 dark:text-zinc-400 dark:active:bg-zinc-800/50'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon size={19} />
            {showNotification && (
              <span className="absolute -right-2 -top-2">
                <NotificationBadge count={badgeCount} active={isActive} />
              </span>
            )}
          </span>

          <span className="mt-1 max-w-full truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function SoonToast({ feature, onClose }) {
  useEffect(() => {
    if (!feature) return undefined

    const timer = window.setTimeout(onClose, 2600)

    return () => window.clearTimeout(timer)
  }, [feature, onClose])

  if (!feature) return null

  return createPortal(
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-[1.5rem] border border-gray-100 bg-white/95 p-4 shadow-2xl shadow-gray-900/10 ring-1 ring-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:ring-zinc-800">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-950/25">
          <FiClock />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
            {feature.label} está no roadmap
          </p>

          <p className="mt-1 text-xs leading-5 text-[#6b7280] dark:text-zinc-400">
            Esta área já ficou reservada no painel para crescer sem quebrar a navegação atual.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Fechar"
        >
          <FiX />
        </button>
      </div>
    </div>,
    document.body
  )
}

function MobileMoreSheet({
  open,
  onClose,
  onLogout,
  isLoggingOut,
  user,
  userData,
  onOpenProfileModal,
  soundMuted,
  onToggleSound,
  theme,
  onSetTheme,
  notificationCounts = {}
}) {
  if (!open) return null

  const name =
    userData?.displayName ||
    userData?.name ||
    user?.displayName ||
    user?.email?.split('@')?.[0] ||
    'Lojista'

  const email = user?.email || ''
  const photoURL = userData?.photoURL || userData?.avatarUrl || user?.photoURL || null
  const initial = (name[0] || 'L').toUpperCase()

  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        type="button"
        onClick={onClose}
        aria-label="Fechar menu"
        className="absolute inset-0 w-full cursor-default border-none bg-black/35 backdrop-blur-sm"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl ring-1 ring-white/70 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="shrink-0 border-b border-orange-100/30 bg-gradient-to-b from-[#fffaf5] to-white px-4 pb-4 pt-4 dark:from-zinc-950 dark:to-zinc-900/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/android-chrome-192x192.png"
                  alt="PratoBy"
                  className="h-10 w-10 rounded-2xl shrink-0 object-cover shadow-md shadow-orange-600/10"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black tracking-tight text-[#111827] dark:text-white">
                      Prato<span className="text-[#f97316]">By</span>
                    </p>
                    <span className="rounded-full bg-orange-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-[#f97316] dark:text-zinc-400 ring-1 ring-orange-100/50 dark:ring-zinc-700/50 shadow-sm">
                      {import.meta.env.VITE_APP_VERSION || 'v0.0.8'}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-[#6b7280] dark:text-zinc-500 uppercase tracking-wider">
                    Painel do lojista
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400 whitespace-nowrap">
                Acesse sua conta, recursos e próximas áreas do PratoBy.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-gray-500 shadow-sm border border-gray-100 transition hover:bg-orange-50 active:scale-95 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 cursor-pointer"
              aria-label="Fechar menu"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>

        <div className="shrink-0 p-4 pb-0">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenProfileModal()
            }}
            className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.98] active:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-950 dark:active:bg-zinc-900"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[0.85rem] bg-orange-50 text-[#f97316] dark:bg-zinc-800 dark:text-zinc-400">
              {photoURL ? (
                <img src={photoURL} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black">
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{name}</p>
              {email && <p className="truncate text-xs font-semibold text-[#6b7280] dark:text-zinc-400">{email}</p>}
            </div>
            <FiChevronRight size={16} className="text-gray-300 transition group-hover:text-[#f97316]" />
          </button>
        </div>

        {/* Preferências do Painel no Mobile (Som e Tema) */}
        <div className="shrink-0 px-4 pt-3 pb-1 grid grid-cols-2 gap-3">
          {/* Som / Mudo */}
          <button
            type="button"
            onClick={onToggleSound}
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-gray-100 bg-white py-3 px-4 shadow-sm transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
          >
            {soundMuted ? (
              <>
                <FiVolumeX size={18} className="text-red-500 shrink-0" />
                <span className="text-xs font-black text-gray-700 dark:text-zinc-300">Som Mudo</span>
              </>
            ) : (
              <>
                <FiVolume2 size={18} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-black text-gray-700 dark:text-zinc-300">Som Ativo</span>
              </>
            )}
          </button>

          {/* Tema Dark / Light */}
          <button
            type="button"
            onClick={() => onSetTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-gray-100 bg-white py-3 px-4 shadow-sm transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <FiSun size={18} className="text-amber-500 shrink-0" />
                <span className="text-xs font-black text-gray-700 dark:text-zinc-300">Modo Claro</span>
              </>
            ) : (
              <>
                <FiMoon size={18} className="text-indigo-500 shrink-0" />
                <span className="text-xs font-black text-gray-700 dark:text-zinc-300">Modo Escuro</span>
              </>
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 scroll-smooth snap-y snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <MainNavItem
                  key={item.to}
                  item={item}
                  badgeCount={notificationCounts[getNavNotificationArea(item)] || 0}
                  onNavigate={onClose}
                  onCustomAction={(action) => {
                    if (action === 'PROFILE_MODAL') {
                      onOpenProfileModal()
                    }
                  }}
                />
              ))}
            </SidebarSection>
          ))}

          {FUTURE_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <ComingSoonNavItem
                  key={item.to}
                  item={item}
                  onNavigate={onClose}
                />
              ))}
            </SidebarSection>
          ))}

          {/* Logout rápido no mobile */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                if (!isLoggingOut) {
                  onLogout()
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3 text-sm font-black text-red-600 transition hover:border-red-200 hover:bg-red-100 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoggingOut ? <FiLoader size={16} className="animate-spin" /> : <FiLogOut size={16} />}
              {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
            </button>

            <p className="text-center text-[10px] font-bold text-[#c7cbd1]">
              PratoBy · Painel do lojista
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Profile Modal

function ProfileModal({ open, onClose, onLogout, isLoggingOut, _user, _userData }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 w-full cursor-default border-none bg-black/40 backdrop-blur-sm"
        aria-label="Fechar"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-950/30">
              <FiUser size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-[#111827] dark:text-white">Perfil da conta</h2>
              <p className="mt-1 truncate text-sm font-semibold text-[#6b7280] dark:text-zinc-400">
                Gerencie seus dados, segurança e preferências do painel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f9fafb] p-4 sm:p-6 [scrollbar-width:thin] dark:bg-zinc-950">
          <ProfilePanel onLogout={null} />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={onClose}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
          >
            Fechar
          </button>
          <button
            disabled={isLoggingOut}
            onClick={() => {
              if (!isLoggingOut) {
                onLogout()
              }
            }}
            className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 cursor-pointer disabled:opacity-70"
          >
            {isLoggingOut ? <FiLoader size={16} className="animate-spin" /> : <FiLogOut size={16} />}
            {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// User card (sidebar footer)

function SidebarUserCard({ user, userData, onOpenProfileModal, collapsed = false }) {
  const name =
    userData?.displayName ||
    userData?.name ||
    user?.displayName ||
    user?.email?.split('@')?.[0] ||
    'Lojista'

  const email = user?.email || ''
  const photoURL = userData?.photoURL || userData?.avatarUrl || user?.photoURL || null
  const initial = (name[0] || 'L').toUpperCase()
  const [isHovered, setIsHovered] = useState(false)

  const planId = userData?.effectivePlan || userData?.billingPlan || userData?.selectedPlan || userData?.plan || 'essential'
  const planBadges = {
    essential: { label: 'ESSENCIAL', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    professional: { label: 'PRO', classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
    premium: { label: 'PREMIUM', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  }
  const activePlanBadge = planBadges[planId] || planBadges.essential

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
      {/* Card do usuário */}
      <button
        type="button"
        onClick={onOpenProfileModal}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:border-orange-100 hover:bg-orange-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 dark:hover:border-orange-500/30 cursor-pointer text-left',
          collapsed ? 'w-12 h-12 justify-center p-0 mx-auto gap-0' : 'px-3 py-2.5'
        )}
      >
        {/* Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
          {photoURL ? (
            <img src={photoURL} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-sm font-black text-[#f97316] dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400">
              {initial}
            </div>
          )}
        </div>

        {/* Texto */}
        {!collapsed && (
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{name}</p>
              {userData?.subscriptionStatus === 'active' && (
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider", activePlanBadge.classes)}>
                  {activePlanBadge.label}
                </span>
              )}
              {userData?.subscriptionStatus === 'trialing' && (
                <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">TRIAL</span>
              )}
              {['past_due', 'blocked', 'canceled'].includes(userData?.subscriptionStatus) && (
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-700 dark:bg-red-500/20 dark:text-red-400">AVISO</span>
              )}
            </div>
            {email && (
              <p className="truncate text-[11px] font-medium text-gray-500 dark:text-zinc-500 mt-0.5">{email}</p>
            )}
          </div>
        )}

        {/* Ícone de perfil */}
        {!collapsed && (
          <FiSettings
            size={14}
            className="shrink-0 text-gray-400 transition duration-300 group-hover:rotate-45 group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
          />
        )}

        {/* Tooltip para sidebar colapsada */}
        {collapsed && isHovered && (
          <div className="absolute left-16 z-[9999] pointer-events-none flex items-center">
            <div className="h-0 w-0 border-y-6 border-y-transparent border-r-6 border-r-zinc-900/95 dark:border-r-white/95" />
            <div className="rounded-xl border border-white/10 bg-zinc-900/95 dark:bg-white/95 px-3 py-2 text-xs font-black text-white dark:text-zinc-900 shadow-xl backdrop-blur-md whitespace-nowrap">
              <p className="font-black">{name}</p>
              <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-0.5">Ver perfil da conta</p>
            </div>
          </div>
        )}
      </button>
    </div>
  )
}

function useHiddenNotifications(containerRef, notificationCounts, collapsed) {
  const [hiddenAbove, setHiddenAbove] = useState(false)
  const [hiddenBelow, setHiddenBelow] = useState(false)

  const checkVisibility = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const elements = container.querySelectorAll('[data-has-notification="true"]')

    let isAbove = false
    let isBelow = false

    elements.forEach(el => {
      const elRect = el.getBoundingClientRect()
      if (elRect.bottom < rect.top) {
        isAbove = true
      }
      if (elRect.top > rect.bottom) {
        isBelow = true
      }
    })

    setHiddenAbove(isAbove)
    setHiddenBelow(isBelow)
  }, [containerRef, notificationCounts, collapsed])

  useEffect(() => {
    checkVisibility()

    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', checkVisibility, { passive: true })
    window.addEventListener('resize', checkVisibility, { passive: true })

    const resizeObserver = new ResizeObserver(() => checkVisibility())
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', checkVisibility)
      window.removeEventListener('resize', checkVisibility)
      resizeObserver.disconnect()
    }
  }, [checkVisibility])

  const scrollToNextHidden = useCallback((direction) => {
    if (!containerRef.current) return
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const elements = Array.from(container.querySelectorAll('[data-has-notification="true"]'))

    if (direction === 'down') {
      const firstBelow = elements.find(el => el.getBoundingClientRect().top > rect.bottom)
      if (firstBelow) {
        firstBelow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    } else {
      const aboveElements = elements.filter(el => el.getBoundingClientRect().bottom < rect.top)
      if (aboveElements.length > 0) {
        const lastAbove = aboveElements[aboveElements.length - 1]
        lastAbove.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [containerRef])

  return { hiddenAbove, hiddenBelow, scrollToNextHidden }
}

function Sidebar({ onLogout, isLoggingOut, user, userData, onOpenProfileModal, collapsed = false, onToggle, notificationCounts = {} }) {
  const scrollRef = useRef(null)
  const { hiddenAbove, hiddenBelow, scrollToNextHidden } = useHiddenNotifications(scrollRef, notificationCounts, collapsed)

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 296 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="relative z-50 hidden h-[100dvh] shrink-0 border-r border-gray-100 bg-white/[0.92] p-4 shadow-[18px_0_50px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:block dark:bg-zinc-900/[0.92] dark:border-zinc-800 dark:shadow-[18px_0_50px_rgba(0,0,0,0.2)]"
    >
      {/* Botão de colapso absolutizado na borda direita */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3.5 top-10 z-[60] flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-all duration-200 hover:scale-[1.15] hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
        aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
      >
        <FiChevronRight
          className={cn('transition-transform duration-300', !collapsed && 'rotate-180')}
          size={14}
        />
      </button>

      <div className="flex h-full min-h-0 flex-col">
        <div className={cn(
          'relative rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white to-orange-50/40 shadow-sm ring-1 ring-white dark:from-zinc-800 dark:to-zinc-900 dark:border-zinc-700/50 dark:ring-zinc-800 transition-all duration-300',
          collapsed ? 'p-1.5 flex justify-center' : 'p-3'
        )}>
          <PratoByMark collapsed={collapsed} />
          {!collapsed && (
            <div className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black tracking-wide text-gray-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
              {import.meta.env.VITE_APP_VERSION || 'v0.0.8'}
            </div>
          )}
        </div>

        <div className="relative mt-5 min-h-0 flex-1">
          {!collapsed && hiddenAbove && (
            <div className="absolute left-0 right-1 top-0 z-20 flex justify-center bg-gradient-to-b from-white via-white/80 to-transparent pb-4 pt-1 pointer-events-none dark:from-zinc-900 dark:via-zinc-900/80">
              <button
                type="button"
                onClick={() => scrollToNextHidden('up')}
                aria-label="Há notificações mais acima"
                className="pointer-events-auto relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white text-orange-500 shadow-md ring-1 ring-black/5 transition hover:bg-orange-50 hover:text-orange-600 dark:bg-zinc-800 dark:text-orange-400 dark:ring-white/10 dark:hover:bg-zinc-700"
              >
                <FiChevronUp size={14} />
                <span className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-[#f97316] ring-2 ring-white dark:ring-zinc-800" />
              </button>
            </div>
          )}

          <nav
            ref={scrollRef}
            className="h-full space-y-3 overflow-y-auto pr-1 scroll-smooth snap-y snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV_SECTIONS.map((section) => (
              <SidebarSection key={section.title} title={section.title} collapsed={collapsed}>
                {section.items.map((item) => (
                  <MainNavItem
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    badgeCount={notificationCounts[getNavNotificationArea(item)] || 0}
                    onCustomAction={(action) => {
                      if (action === 'PROFILE_MODAL') {
                        onOpenProfileModal()
                      }
                    }}
                  />
                ))}
              </SidebarSection>
            ))}

            {FUTURE_SECTIONS.map((section) => (
              <SidebarSection key={section.title} title={section.title} collapsed={collapsed}>
                {section.items.map((item) => (
                  <ComingSoonNavItem key={item.to} item={item} collapsed={collapsed} />
                ))}
              </SidebarSection>
            ))}
          </nav>

          {!collapsed && hiddenBelow && (
            <div className="absolute bottom-0 left-0 right-1 z-20 flex justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 pt-4 pointer-events-none dark:from-zinc-900 dark:via-zinc-900/80">
              <button
                type="button"
                onClick={() => scrollToNextHidden('down')}
                aria-label="Há notificações mais abaixo"
                className="pointer-events-auto relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white text-orange-500 shadow-md ring-1 ring-black/5 transition hover:bg-orange-50 hover:text-orange-600 dark:bg-zinc-800 dark:text-orange-400 dark:ring-white/10 dark:hover:bg-zinc-700"
              >
                <FiChevronDown size={14} />
                <span className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-[#f97316] ring-2 ring-white dark:ring-zinc-800" />
              </button>
            </div>
          )}
        </div>

        {/* Rodape - card de usuario */}
        <SidebarUserCard user={user} userData={userData} onOpenProfileModal={onOpenProfileModal} collapsed={collapsed} />

        {/* Logout rápido no desktop */}
        <div className="mt-2 space-y-2">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onLogout}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 text-xs font-black text-red-600 transition hover:bg-red-100 active:scale-[0.98] cursor-pointer disabled:opacity-70 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20',
              collapsed ? 'w-12 h-10 justify-center px-0 mx-auto' : 'w-full px-3 py-2 text-left'
            )}
          >
            <div className="flex shrink-0 items-center justify-center">
              {isLoggingOut ? (
                <FiLoader size={15} className="animate-spin text-red-500" />
              ) : (
                <FiLogOut size={15} className={collapsed ? 'text-gray-400 transition-colors' : ''} />
              )}
            </div>
            {!collapsed && <span className="text-sm font-semibold">{isLoggingOut ? 'Saindo...' : 'Sair da conta'}</span>}
          </button>

          {!collapsed && (
            <p className="text-center text-[10px] font-bold text-gray-400 dark:text-zinc-600">
              PratoBy · Painel do lojista
            </p>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

function MobileBottomNav({ onOpenMore, moreActive, notificationCounts = {} }) {
  const mobileItems = MOBILE_NAV_PATHS.map((to) => MAIN_ITEMS.find((item) => item.to === to)).filter(Boolean)
  const hiddenHasNotification = MAIN_ITEMS.filter((item) => !MOBILE_NAV_PATHS.includes(item.to)).some((item) => {
    const area = getNavNotificationArea(item)
    return area && notificationCounts[area] > 0
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 px-2 pt-2 shadow-2xl shadow-gray-300/60 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden dark:bg-zinc-900/95 dark:border-zinc-800 dark:shadow-[0_-10px_50px_rgba(0,0,0,0.3)]">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => (
          <MobileNavItem
            key={item.to}
            item={item}
            badgeCount={notificationCounts[getNavNotificationArea(item)] || 0}
          />
        ))}

        <button
          type="button"
          onClick={onOpenMore}
          aria-label={hiddenHasNotification ? 'Mais, há notificações em itens escondidos' : 'Mais'}
          className={cn(
            'relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98] active:bg-gray-50 dark:active:bg-zinc-800',
            moreActive
              ? 'bg-orange-50 text-[#f97316] dark:bg-orange-950/20'
              : 'text-[#6b7280] dark:text-zinc-400'
          )}
        >
          <span className="relative">
            <FiMenu size={19} />
            {hiddenHasNotification && (
              <span className="absolute -right-2 -top-2">
                <NotificationBadge active={moreActive} />
              </span>
            )}
          </span>

          <span className="mt-1 max-w-full truncate">Mais</span>
        </button>
      </div>
    </nav>
  )
}
export default function DashboardLayout() {
  useEffect(() => {
  const timer = window.setTimeout(() => {
    prefetchDashboardRoute('/dashboard/orders')
    prefetchDashboardRoute('/dashboard/menu')
    prefetchDashboardRoute('/dashboard/pagamentos')
    prefetchDashboardRoute('/dashboard/qrcodes')
    prefetchDashboardRoute('/dashboard/settings')
    prefetchDashboardRoute('/dashboard/stats')
    prefetchDashboardRoute('/dashboard/out-screen')
  }, 1200)

  return () => window.clearTimeout(timer)
}, [])
  const location = useLocation()
  const navigate = useNavigate()
  const authContext = useAuth()
  const currentOutlet = useOutlet()
  const notificationState = useDashboardNotifications()
  const { countsByArea = {}, markAreaAsRead } = notificationState

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('pratoby-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('pratoby-sidebar-collapsed', String(next))
      } catch (e) {
        console.warn(e)
      }
      return next
    })
  }

  const { theme, setTheme } = useDashboardTheme()

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const [soundMuted, setSoundMuted] = useState(() => {
    try {
      return localStorage.getItem('pratoby-sound-muted') === 'true'
    } catch {
      return false
    }
  })

  const toggleSound = () => {
    const next = !soundMuted
    setSoundMuted(next)
    try {
      localStorage.setItem('pratoby-sound-muted', String(next))
    } catch (e) {
      console.warn(e)
    }
    notificationState.setNotificationPreference?.('channels', 'sound', !next)
  }

  // 1. New Order Sound Dispatcher & Global Listener
  useEffect(() => {
    const handlePlayNewOrderSound = () => {
      if (soundMuted) return
      if (!notificationPreferenceEnabled(notificationState.preferences, 'channels', 'sound')) return
      if (!notificationPreferenceEnabled(notificationState.preferences, 'events', 'newOrder')) return

      try {
        const audio = new Audio('/sounds/notification.mp3')
        audio.volume = 0.35
        audio.play().catch((err) => {
          console.warn('[Sound] Autoplay impedido pelo navegador:', err)
        })
      } catch (err) {
        console.error('[Sound] Erro ao instanciar ou tocar som:', err)
      }
    }

    window.addEventListener('play-new-order-sound', handlePlayNewOrderSound)
    return () => window.removeEventListener('play-new-order-sound', handlePlayNewOrderSound)
  }, [notificationState.preferences, soundMuted])

  // 2. Sync selectedStoreId dynamically from localStorage or context
  const { user, userData, logout, loading } = authContext || {}
  const [currentStoreId, setCurrentStoreId] = useState(() => {
    try {
      return localStorage.getItem('@PratoBy:selectedStoreId') || userData?.storeId || user?.storeId || ''
    } catch {
      return userData?.storeId || user?.storeId || ''
    }
  })

  useEffect(() => {
    const handleSyncStoreId = () => {
      try {
        const saved = localStorage.getItem('@PratoBy:selectedStoreId')
        const fallback = userData?.storeId || user?.storeId || ''
        const target = saved || fallback
        if (target !== currentStoreId) {
          setCurrentStoreId(target)
        }
      } catch (e) {
        console.warn(e)
      }
    }

    const interval = setInterval(handleSyncStoreId, 1500)
    window.addEventListener('storage', handleSyncStoreId)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleSyncStoreId)
    }
  }, [currentStoreId, userData?.storeId, user?.storeId])

  // 3. Real-time store status listener
  const [storeData, setStoreData] = useState(null)
  const [storeLoading, setStoreLoading] = useState(true)
  const [storeError, setStoreError] = useState(null)
  const [storeToggleLoading, setStoreToggleLoading] = useState(false)
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false)

  useEffect(() => {
    if (!currentStoreId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoreData(null)
      setStoreLoading(false)
      return undefined
    }

    setStoreLoading(true)
    setStoreError(null)

    const unsubscribe = onSnapshot(
      doc(db, 'stores', currentStoreId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setStoreData({
            ...data,
            id: snapshot.id,
            isOpen: data.isOpen ?? true,
          })
        } else {
          setStoreData(null)
        }
        setStoreLoading(false)
      },
      (err) => {
        console.error('Erro ao escutar dados da loja no Topbar:', err)
        setStoreError('Não foi possível carregar o status atual da loja.')
        setStoreLoading(false)
      }
    )

    return () => unsubscribe()
  }, [currentStoreId])

  // 4. Safe Store toggle action
  const handleToggleStoreOpen = async () => {
    if (!currentStoreId || !storeData || storeToggleLoading) return

    const nextStatus = !storeData.isOpen

    try {
      setStoreToggleLoading(true)
      setStoreError(null)
      const updateStoreSettings = httpsCallable(functions, 'updateStoreSettings')
      await updateStoreSettings({
        storeId: currentStoreId,
        payload: {
          isOpen: nextStatus,
        },
      })
      setConfirmStatusModalOpen(false)
    } catch (err) {
      console.error('Erro ao alternar status da loja:', err)
      setStoreError(getCallableErrorMessage(err, 'Ocorreu um erro ao atualizar o status. Tente novamente.'))
    } finally {
      setStoreToggleLoading(false)
    }
  }

  // 5. Command Palette keystrokes
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()

        const activeEl = document.activeElement
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        )
        if (isInput) return

        setCommandPaletteOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 6. Command Palette options
  const storeSlug =
    userData?.storeSlug ||
    userData?.slug ||
    ''
  const dashboardSubscriptionStatus = String(userData?.subscriptionStatus || '').trim()
  const publicStoreHref =
    storeSlug &&
    !['checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'].includes(dashboardSubscriptionStatus)
      ? `/${String(storeSlug).replace(/^\/+/, '')}`
      : ''

  const COMMANDS = useMemo(() => {
  const navCommands = NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => item.to || item.action)
      .map((item) => ({
        id: item.to || item.action || item.label,
        label: item.label,
        path: item.action ? undefined : item.to,
        action: item.action,
        description: item.description || section.description || '',
      }))
  )

  const extraCommands = []

  if (publicStoreHref) {
    extraCommands.push({
      id: 'public_store',
      label: 'Loja pública',
      path: publicStoreHref,
      external: true,
      description: 'Visualizar cardápio do cliente final',
    })
  }

  extraCommands.push(
    {
      id: 'support',
      label: 'Suporte',
      action: 'SUPPORT',
      description: 'Falar com o suporte técnico no WhatsApp',
    },
    {
      id: 'logout',
      label: 'Sair',
      action: 'LOGOUT',
      description: 'Encerrar sessão com segurança',
    }
  )

  return [...navCommands, ...extraCommands]
}, [publicStoreHref])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await new Promise((resolve) => setTimeout(resolve, 600))

      if (typeof logout === 'function') {
        await logout()
      } else {
        try {
          await signOut(auth)
        } catch (authError) {
          console.warn('Erro ao executar signOut do Firebase (possivelmente bloqueado pelo adblocker):', authError)
        }
      }
    } catch (error) {
      console.error('Erro ao sair:', error)
    } finally {
      setIsLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  const handleCommandSelect = (cmd) => {
    setCommandPaletteOpen(false)
    if (cmd.path) {
      if (cmd.external) {
      window.open(cmd.path, '_blank', 'noopener,noreferrer')
    } else {
      navigate(cmd.path)
    }
    } else if (cmd.action === 'SUPPORT') {
      window.open('https://wa.me/5579999786984?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20meu%20painel%20do%20PratoBy.', '_blank')
    } else if (cmd.action === 'LOGOUT') {
      handleLogout()
    }
  }

  // 7. Speed Dial link copy
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [copyToastOpen, setCopyToastOpen] = useState(false)

  const handleCopyStoreLink = () => {
    if (!publicStoreHref) return
    const fullUrl = window.location.origin + publicStoreHref
    navigator.clipboard.writeText(fullUrl)
      .then(() => {
        setCopyToastOpen(true)
        setTimeout(() => setCopyToastOpen(false), 2500)
      })
      .catch((err) => console.error('Erro ao copiar link:', err))
  }

  // Time & Greeting State
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const brTimeOpts = { timeZone: 'America/Sao_Paulo' }
  const hour = parseInt(now.toLocaleTimeString('pt-BR', { ...brTimeOpts, hour: 'numeric', hour12: false }), 10)
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'
  const timeStr = now.toLocaleTimeString('pt-BR', { ...brTimeOpts, hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('pt-BR', { ...brTimeOpts, weekday: 'short', day: '2-digit', month: 'short' })

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [soonFeature, setSoonFeature] = useState(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const storeName =
    userData?.storeName ||
    userData?.signup?.storeName ||
    userData?.name ||
    'Sua loja'

  const avatarUrl = userData?.photoURL || userData?.avatarUrl || user?.photoURL || ''
  const avatarInitial = (userData?.displayName || userData?.name || user?.displayName || storeName || 'L')[0]?.toUpperCase() || 'L'

  const moreActive = useMemo(() => {
  const isBottomItem = MOBILE_NAV_PATHS.some((path) => {
    const item = MAIN_ITEMS.find((navItem) => navItem.to === path)
    return item ? isPathActive(location.pathname, item) : location.pathname === path
  })

  return !isBottomItem
}, [location.pathname])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const area = getDashboardAreaForPath(location.pathname)
    if (area) {
      markAreaAsRead(area)
    }
  }, [location.pathname, markAreaAsRead])

  return (
    <main className="dashboard-shell h-[100dvh] overflow-hidden bg-[#f9fafb] text-[#111827] dark:bg-zinc-950 dark:text-zinc-50 transition-colors">
      <SoonToast
        feature={soonFeature}
        onClose={() => setSoonFeature(null)}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100/55 blur-3xl dark:bg-orange-900/10 pointer-events-none" />
        <div className="absolute right-[-7rem] top-1/3 h-80 w-80 rounded-full bg-gray-200/60 blur-3xl dark:bg-zinc-800/10 pointer-events-none" />
        <div className="absolute bottom-[-8rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-50 blur-3xl dark:bg-zinc-900/10 pointer-events-none" />
      </div>

      <div className="relative flex h-[100dvh] min-h-0 overflow-hidden">
        <Sidebar
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          user={user}
          userData={userData}
          onOpenProfileModal={() => setProfileModalOpen(true)}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          notificationCounts={countsByArea}
        />

        <section className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
          {/* Topbar/Header do Dashboard */}
          <div className="relative z-40 flex h-[4.25rem] shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white/90 px-4 shadow-sm shadow-gray-900/[0.03] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-black/20 lg:px-8">
            {/* Esquerda: Menu Mobile Toggle + Título da Loja */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-700 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 lg:hidden"
                aria-label="Abrir menu"
              >
                <FiMenu size={20} />
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] ring-1 ring-orange-100 dark:bg-orange-950/20 dark:ring-orange-900/30 sm:grid">
                  <FiHome size={17} />
                </span>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black leading-5 text-[#111827] dark:text-white sm:text-base">
                      {greeting}, {storeName}
                    </p>

                    {/* Badge do Status da Loja */}
                    {storeLoading ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-bold text-gray-400 dark:bg-zinc-900/50">
                        <FiLoader className="animate-spin" size={8} />
                      </span>
                    ) : storeData ? (
                      <button
                        type="button"
                        onClick={() => setConfirmStatusModalOpen(true)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition hover:scale-105 active:scale-95 cursor-pointer shadow-sm shrink-0',
                          storeData.isOpen
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:ring-emerald-900/30'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/25 dark:text-red-400 dark:ring-red-900/30'
                        )}
                      >
                        <span className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          storeData.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                        )} />
                        <span className="hidden xs:inline">{storeData.isOpen ? 'Aberta' : 'Fechada'}</span>
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-[11px] font-bold leading-4 text-[#6b7280] dark:text-zinc-400">
                    <span className="capitalize">{dateStr}</span>
                    <span>·</span>
                    <span>{timeStr}</span>
                    <span>·</span>
                    <span>{storeSlug ? `/${String(storeSlug).replace(/^\/+/, '')}` : 'Painel do lojista'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direita: Sino de notificações + Quick Profile */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Botão Buscar no painel... (Ctrl + K) */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/50 px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:bg-gray-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500 dark:hover:bg-zinc-800/80 md:flex cursor-pointer"
              >
                <FiSearch size={14} className="text-gray-400 dark:text-zinc-500" />
                <span>Buscar...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 font-mono text-[9px] font-bold text-gray-400 dark:border-zinc-700 dark:bg-zinc-800">
                  Ctrl K
                </kbd>
              </button>

              {publicStoreHref && (
                <a
                  href={publicStoreHref}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden h-10 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 text-xs font-black text-[#6b7280] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-[#f97316] sm:inline-flex"
                >
                  <FiExternalLink size={14} />
                  Ver loja
                </a>
              )}

              {/* Botão de Som/Mudo */}
              <button
                type="button"
                onClick={toggleSound}
                className="hidden lg:grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label={soundMuted ? 'Ativar som de novo pedido' : 'Silenciar som de novo pedido'}
              >
                {soundMuted ? (
                  <FiVolumeX size={18} className="text-red-500" />
                ) : (
                  <FiVolume2 size={18} className="text-emerald-500" />
                )}
              </button>

              {/* Botão Alternador de Tema Dark/Light */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="relative hidden lg:grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Alternar tema"
              >
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex items-center justify-center"
                >
                  {theme === 'dark' ? (
                    <FiSun size={18} className="text-amber-500" />
                  ) : (
                    <FiMoon size={18} className="text-indigo-600" />
                  )}
                </motion.div>
              </button>

              <DashboardNotificationBell
                notificationState={notificationState}
                storeId={currentStoreId}
              />

              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="flex h-10 items-center gap-2 rounded-2xl border border-gray-100 bg-white px-1.5 pr-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                aria-label="Meu Perfil"
              >
                <div className="h-8 w-8 overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100 dark:bg-zinc-800 dark:ring-zinc-700">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#f97316]">
                      {avatarInitial}
                    </div>
                  )}
                </div>
                <span className="hidden max-w-[7rem] truncate text-xs font-black text-[#111827] dark:text-zinc-100 md:block">
                  Perfil
                </span>
              </button>
            </div>
          </div>

          <div className="pratoby-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-28 lg:pb-8">
            {/* Trial Banner Global */}
            <DashboardTrialRibbon />
            <NotificationsOnboardingBanner />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={loading ? 'loading-skeleton' : location.pathname}
                initial={{ opacity: 0, y: 8, scale: 0.99, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, scale: 0.99, filter: 'blur(2px)' }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-full"
              >
                {loading ? <DashboardPageSkeleton /> : currentOutlet}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <MobileBottomNav
          moreActive={moreActive}
          onOpenMore={() => setMobileMenuOpen(true)}
          notificationCounts={countsByArea}
        />

        <AnimatePresence>
          {mobileMenuOpen && (
            <MobileMoreSheet
              open={mobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
              user={user}
              userData={userData}
              onOpenProfileModal={() => setProfileModalOpen(true)}
              soundMuted={soundMuted}
              onToggleSound={toggleSound}
              theme={theme}
              onSetTheme={setTheme}
              notificationCounts={countsByArea}
            />
          )}
          {profileModalOpen && (
            <ProfileModal
              open={profileModalOpen}
              onClose={() => setProfileModalOpen(false)}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
              user={user}
              userData={userData}
            />
          )}
          {isLoggingOut && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md"
            >
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-zinc-800" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#f97316] animate-spin" />
                </div>
                <h3 className="text-base font-black text-[#111827] dark:text-white uppercase tracking-wider animate-pulse mt-2">
                  Encerrando sessão...
                </h3>
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                  Limpando dados e saindo com segurança da sua conta.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Command Palette Overlay */}
        <AnimatePresence>
          {commandPaletteOpen && (
            <CommandPalette
              open={commandPaletteOpen}
              onClose={() => setCommandPaletteOpen(false)}
              commands={COMMANDS}
              onSelect={handleCommandSelect}
            />
          )}
        </AnimatePresence>

        {/* Modal de Confirmação para Status da Loja */}
        <AnimatePresence>
          {confirmStatusModalOpen && storeData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !storeToggleLoading && setConfirmStatusModalOpen(false)}
                className="absolute inset-0 w-full cursor-default border-none bg-black/40 backdrop-blur-sm"
                aria-label="Fechar"
                disabled={storeToggleLoading}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <div className="flex flex-col items-center text-center">
                  <div className={cn(
                    'grid h-16 w-16 place-items-center rounded-full mb-4 shadow-lg',
                    storeData.isOpen
                      ? 'bg-red-50 text-red-500 shadow-red-500/10 dark:bg-red-950/20'
                      : 'bg-emerald-50 text-emerald-500 shadow-emerald-500/10 dark:bg-emerald-950/20'
                  )}>
                    {storeData.isOpen ? <FiX size={28} /> : <FiZap size={28} />}
                  </div>

                  <h3 className="text-lg font-black text-[#111827] dark:text-white">
                    {storeData.isOpen ? 'Fechar Loja?' : 'Abrir Loja?'}
                  </h3>

                  <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-500 dark:text-zinc-400">
                    {storeData.isOpen
                      ? 'Finalize ou cancele os pedidos ativos antes de fechar. Depois disso, novos pedidos ficarão pausados.'
                      : 'Ao abrir a loja, novos pedidos começarão a chegar no painel.'}
                  </p>

                  {storeError && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      {storeError}
                    </p>
                  )}

                  <div className="mt-6 flex w-full gap-3">
                    <button
                      type="button"
                      disabled={storeToggleLoading}
                      onClick={() => setConfirmStatusModalOpen(false)}
                      className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-xs font-black text-gray-500 transition hover:bg-gray-50 active:scale-98 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={storeToggleLoading}
                      onClick={handleToggleStoreOpen}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black text-white transition active:scale-98 cursor-pointer disabled:opacity-50',
                        storeData.isOpen
                          ? 'bg-red-500 shadow-lg shadow-red-500/15 hover:bg-red-600'
                          : 'bg-emerald-500 shadow-lg shadow-emerald-500/15 hover:bg-emerald-600'
                      )}
                    >
                      {storeToggleLoading ? (
                        <FiLoader className="animate-spin" size={14} />
                      ) : storeData.isOpen ? (
                        'Sim, Fechar'
                      ) : (
                        'Sim, Abrir'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Speed Dial de Ações Rápidas */}
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          <AnimatePresence>
            {speedDialOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.85 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex flex-col items-end gap-2.5"
              >
                {publicStoreHref && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyStoreLink()
                      setSpeedDialOpen(false)
                    }}
                    className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/95 px-3 py-2 text-xs font-black text-gray-700 shadow-lg ring-1 ring-white/70 backdrop-blur-md transition hover:scale-105 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300 dark:ring-zinc-800 cursor-pointer"
                  >
                    <FiExternalLink size={14} className="text-[#f97316]" />
                    <span>Copiar link da loja</span>
                  </button>
                )}
                <a
                  href="https://wa.me/5579999786984?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20meu%20painel%20do%20PratoBy."
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setSpeedDialOpen(false)}
                  className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/95 px-3 py-2 text-xs font-black text-gray-700 shadow-lg ring-1 ring-white/70 backdrop-blur-md transition hover:scale-105 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300 dark:ring-zinc-800 cursor-pointer"
                >
                  <FiPhone size={14} className="text-emerald-500" />
                  <span>Falar com o suporte</span>
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setSpeedDialOpen((prev) => !prev)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-600/15 hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer"
            aria-label="Ações rápidas"
          >
            <motion.div
              animate={{ rotate: speedDialOpen ? 135 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <FiZap size={20} />
            </motion.div>
          </button>
        </div>

        {/* Toast de Cópia Sucesso */}
        <AnimatePresence>
          {copyToastOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              className="fixed left-1/2 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 shadow-xl dark:border-emerald-950/20 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              <span>Link da loja copiado com sucesso!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

// Command Palette Component

function CommandPalette({ open, onClose, commands, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const filteredCommands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return commands
    return commands.filter((cmd) => {
      const label = String(cmd.label || '').toLowerCase()
      const description = String(cmd.description || '').toLowerCase()

      return label.includes(query) || description.includes(query)
    })
  }, [commands, searchQuery])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredCommands, selectedIndex, onClose, onSelect])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 w-full cursor-default border-none bg-black/45 backdrop-blur-md"
        aria-label="Fechar busca"
      />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white/90 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/90 dark:ring-zinc-800"
      >
        <div className="flex items-center gap-3 border-b border-gray-100/80 px-4 py-3 dark:border-zinc-800/80">
          <FiSearch size={18} className="text-gray-400 dark:text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="O que você está buscando hoje?"
            className="flex-1 bg-transparent border-none text-sm font-semibold outline-none text-[#111827] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-0"
          />
          <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400 dark:bg-zinc-800 dark:text-zinc-500">
            ESC
          </span>
        </div>

        <div className="pratoby-scrollbar max-h-[350px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs font-semibold text-gray-400 dark:text-zinc-500">
              Nenhum comando ou página encontrada.
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCommands.map((cmd, idx) => {
                const isActive = idx === selectedIndex
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => onSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition cursor-pointer',
                      isActive
                        ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/15'
                        : 'hover:bg-gray-50 text-gray-700 dark:hover:bg-zinc-800/50 dark:text-zinc-300'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-black', isActive ? 'text-white' : 'text-[#111827] dark:text-zinc-100')}>
                        {cmd.label}
                      </p>
                      <p className={cn('text-[10px] font-bold mt-0.5', isActive ? 'text-white/85' : 'text-[#9ca3af]')}>
                        {cmd.description}
                      </p>
                    </div>
                    {isActive && (
                      <span className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                        Enter
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100/50 bg-gray-50/50 px-4 py-2.5 text-[10px] font-bold text-gray-400 dark:border-zinc-800/50 dark:bg-zinc-950/20 dark:text-zinc-500">
          <div className="flex items-center gap-3">
            <span>Setas: navegar</span>
            <span>Enter: ir para</span>
          </div>
          <span>PratoBy Command Palette</span>
        </div>
      </motion.div>
    </div>
  )
}
