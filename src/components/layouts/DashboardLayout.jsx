import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { AnimatePresence, motion } from 'motion/react'

import { auth } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import ProfilePanel from '../merchant/ProfilePanel'
import { DashboardPageSkeleton } from '../shared/Skeletons'
import DashboardNotificationBell from '../notifications/DashboardNotificationBell'
import DashboardTrialRibbon from '../notifications/DashboardTrialRibbon'

import {
  FiArchive,
  FiBarChart2,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiGrid,
  FiHome,
  FiLayers,
  FiLock,
  FiLogOut,
  FiMenu,
  FiMonitor,
  FiPieChart,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiTruck,
  FiUser,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi'

const MAIN_ITEMS = [
  {
    label: 'Dashboard',
    description: 'Visão geral da operação',
    to: '/dashboard',
    icon: FiHome,
    end: true,
  },
  {
    label: 'Pedidos',
    description: 'Kanban e comandas',
    to: '/dashboard/orders',
    icon: FiShoppingBag,
  },
  {
    label: 'Cardápio',
    description: 'Produtos e categorias',
    to: '/dashboard/menu',
    icon: FiGrid,
  },
  {
    label: 'Estatísticas',
    description: 'Resumo de vendas',
    to: '/dashboard/stats',
    icon: FiBarChart2,
  },
  {
    label: 'Avaliações',
    description: 'Feedback dos clientes',
    to: '/dashboard/reviews',
    icon: FiStar,
  },
  {
    label: 'Configurações',
    description: 'Loja, horários e Pix',
    to: '/dashboard/settings',
    icon: FiSettings,
  },
  {
    label: 'Assinatura',
    description: 'Plano, teste e cobrança',
    icon: FiCreditCard,
    to: '/dashboard/billing',
  },
  {
    label: 'Perfil',
    description: 'Conta e segurança',
    to: '/dashboard/profile',
    action: 'PROFILE_MODAL',
    icon: FiUser,
  },
]

const FUTURE_SECTIONS = [
  {
    title: 'Crescimento',
    items: [
      {
        label: 'QR Codes',
        description: 'Mesas, balcão e cardápio impresso',
        icon: FiGrid,
        to: '/dashboard/qrcodes',
      },
      {
        label: 'OutScreen',
        description: 'Tela de cozinha e painel de retirada',
        icon: FiMonitor,
        to: '/dashboard/out-screen',
      },
      {
        label: 'Clientes',
        description: 'Histórico, gasto total e recorrência',
        icon: FiUsers,
        to: '/dashboard/users',
      },
      {
        label: 'MotoBot',
        description: 'Motoboys, entregas e rotas',
        icon: FiTruck,
        to: '/dashboard/motobot',
      },
    ],
  },
  {
    title: 'Avançado',
    items: [
      {
        label: 'Financeiro',
        description: 'Recebíveis e resumo de caixa',
        icon: FiDollarSign,
        to: '/dashboard/financeiro',
      },
      {
        label: 'Pix automático',
        description: 'Webhook e confirmação automática',
        icon: FiCreditCard,
        to: '/dashboard/pix-automatico',
      },
      {
        label: 'Relatórios',
        description: 'Produtos, bairros e horários de pico',
        icon: FiPieChart,
        to: '/dashboard/relatorios',
      },
      {
        label: 'Equipe',
        description: 'Usuários, permissões e funções',
        icon: FiLayers,
        to: '/dashboard/equipe',
      },
      {
        label: 'Automações',
        description: 'Sino, fechamento e impressão',
        icon: FiZap,
        to: '/dashboard/automacoes',
      },
    ],
  },
]

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function isPathActive(pathname, item) {
  if (item.end) return pathname === item.to

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function PratoByMark({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className={cn(
          compact ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-3xl',
          'shrink-0 object-cover shadow-lg shadow-orange-600/15'
        )}
      />

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
    </div>
  )
}

function SidebarSection({ title, children }) {
  return (
    <section className="min-w-0">
      <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
        {title}
      </p>

      <div className="space-y-1">{children}</div>
    </section>
  )
}

function MainNavItem({ item, onNavigate, onCustomAction }) {
  const Icon = item.icon

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
      end={item.end}
      onClick={handleClick}
      className={({ isActive }) =>
        cn(
          'group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition active:scale-[0.99] cursor-pointer',
          isActive
            ? 'text-white'
            : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
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

          <span className="relative z-10 min-w-0 flex-1">
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

          {isActive && <FiChevronRight className="relative z-10 shrink-0" size={16} />}
        </>
      )}
    </NavLink>
  )
}

function ComingSoonNavItem({ item, onNavigate }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition active:scale-[0.99] cursor-pointer',
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

          <span className="min-w-0 flex-1">
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

          <FiLock
            className={cn(
              'shrink-0',
              isActive ? 'text-[#f97316]' : 'text-gray-300 dark:text-zinc-600'
            )}
            size={15}
          />
        </>
      )}
    </NavLink>
  )
}

function MobileNavItem({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98]',
          isActive
            ? 'bg-orange-50 text-[#f97316] dark:bg-orange-950/20'
            : 'text-[#6b7280] active:bg-gray-50 dark:text-zinc-400 dark:active:bg-zinc-800/50'
        )
      }
    >
      <Icon size={19} />

      <span className="mt-1 max-w-full truncate">{item.label}</span>
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

  return (
    <div className="fixed right-4 top-4 z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-gray-100 bg-white/95 p-4 shadow-2xl shadow-gray-900/10 ring-1 ring-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:ring-zinc-800">
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
    </div>
  )
}

function MobileMoreSheet({ open, onClose, onLogout, user, userData, onOpenProfileModal }) {
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
        <div className="shrink-0 border-b border-orange-100/70 bg-[#fffaf5] px-4 pb-4 pt-4 dark:bg-zinc-950 dark:border-zinc-800/80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#f97316] shadow-sm ring-1 ring-orange-100 dark:bg-zinc-900 dark:ring-zinc-800">
                Painel do lojista
              </span>
              <p className="mt-2 text-xl font-black leading-tight text-[#111827] dark:text-white">
                Menu do painel
              </p>
              <p className="mt-1 max-w-[17rem] text-xs font-semibold leading-5 text-[#6b7280] dark:text-zinc-400">
                Acesse sua conta, recursos e próximas áreas do PratoBy.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#111827] shadow-sm ring-1 ring-orange-100 transition hover:bg-orange-50 active:scale-[0.98] dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:hover:bg-zinc-700"
              aria-label="Fechar menu"
            >
              <FiX />
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarSection title="Principal">
            {MAIN_ITEMS.map((item) => (
              <MainNavItem
                key={item.to}
                item={item}
                onNavigate={onClose}
                onCustomAction={(action) => {
                  if (action === 'PROFILE_MODAL') {
                    onOpenProfileModal()
                  }
                }}
              />
            ))}
          </SidebarSection>

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
              onClick={() => {
                onClose()
                onLogout()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3 text-sm font-black text-red-600 transition hover:border-red-200 hover:bg-red-100 active:scale-[0.98]"
            >
              <FiLogOut size={16} />
              Sair da conta
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

// ─── Profile Modal ──────────────────────────────────────────────────────────

function ProfileModal({ open, onClose, onLogout, user, userData }) {
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
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 cursor-pointer"
          >
            <FiLogOut size={16} />
            Sair da conta
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── User card (sidebar footer) ──────────────────────────────────────────────

function SidebarUserCard({ user, userData, onOpenProfileModal }) {
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
    <div className="mt-4">
      {/* Card do usuário */}
      <button
        type="button"
        onClick={onOpenProfileModal}
        className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-orange-100 hover:bg-orange-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 dark:hover:border-orange-500/30 cursor-pointer"
      >
        {/* Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl">
          {photoURL ? (
            <img src={photoURL} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-50 text-sm font-black text-[#f97316] dark:bg-zinc-800 dark:text-zinc-400">
              {initial}
            </div>
          )}
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{name}</p>
          {email && (
            <p className="truncate text-[11px] font-semibold text-[#9ca3af] dark:text-zinc-500">{email}</p>
          )}
        </div>

        {/* Ícone de perfil */}
        <FiUser
          size={14}
          className="shrink-0 text-gray-300 transition group-hover:text-[#f97316] dark:text-zinc-600"
        />
      </button>
    </div>
  )
}

function Sidebar({ onLogout, user, userData, onOpenProfileModal }) {
  return (
    <aside className="hidden h-[100dvh] w-[18.5rem] shrink-0 overflow-hidden border-r border-gray-100 bg-white/[0.92] p-4 shadow-[18px_0_50px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:block dark:bg-zinc-900/[0.92] dark:border-zinc-800 dark:shadow-[18px_0_50px_rgba(0,0,0,0.2)]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-3 shadow-sm ring-1 ring-white dark:from-zinc-800 dark:to-zinc-900 dark:border-zinc-700/50 dark:ring-zinc-800">
          <PratoByMark />
          <div className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black tracking-wide text-gray-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
            {import.meta.env.VITE_APP_VERSION || 'v0.0.7'}
          </div>
        </div>

        <nav className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarSection title="Principal">
            {MAIN_ITEMS.map((item) => (
              <MainNavItem
                key={item.to}
                item={item}
                onCustomAction={(action) => {
                  if (action === 'PROFILE_MODAL') {
                    onOpenProfileModal()
                  }
                }}
              />
            ))}
          </SidebarSection>

          {FUTURE_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <ComingSoonNavItem key={item.to} item={item} />
              ))}
            </SidebarSection>
          ))}
        </nav>

        {/* Rodapé — card de usuário */}
        <SidebarUserCard user={user} userData={userData} onOpenProfileModal={onOpenProfileModal} />

        {/* Logout rápido no desktop */}
        <div className="mt-2 space-y-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 active:scale-[0.98] cursor-pointer dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <FiLogOut size={13} className="shrink-0" />
            <span>Sair da conta</span>
          </button>
          
          <p className="text-center text-[10px] font-bold text-gray-400 dark:text-zinc-600">
            © 2026 PratoBy
          </p>
        </div>
      </div>
    </aside>
  )
}

function MobileBottomNav({ onOpenMore, moreActive }) {
  const mobileItems = MAIN_ITEMS.slice(0, 4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 px-2 pt-2 shadow-2xl shadow-gray-300/60 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden dark:bg-zinc-900/95 dark:border-zinc-800 dark:shadow-[0_-10px_50px_rgba(0,0,0,0.3)]">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => (
          <MobileNavItem key={item.to} item={item} />
        ))}

        <button
          type="button"
          onClick={onOpenMore}
          className={cn(
            'flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98] active:bg-gray-50 dark:active:bg-zinc-800',
            moreActive
              ? 'bg-orange-50 text-[#f97316] dark:bg-orange-950/20'
              : 'text-[#6b7280] dark:text-zinc-400'
          )}
        >
          <FiMenu size={19} />

          <span className="mt-1 max-w-full truncate">Mais</span>
        </button>
      </div>
    </nav>
  )
}

export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const authContext = useAuth()
  const currentOutlet = useOutlet()

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

  const { user, userData, logout, loading } = authContext || {}
  const storeName =
    userData?.storeName ||
    userData?.signup?.storeName ||
    userData?.name ||
    'Sua loja'
  const storeSlug =
    userData?.storeSlug ||
    userData?.slug ||
    (Array.isArray(userData?.storeKeys) ? userData.storeKeys.find(Boolean) : '') ||
    ''
  const publicStoreHref = storeSlug ? `/${String(storeSlug).replace(/^\/+/, '')}` : ''
  const avatarUrl = userData?.photoURL || userData?.avatarUrl || user?.photoURL || ''
  const avatarInitial = (userData?.displayName || userData?.name || user?.displayName || storeName || 'L')[0]?.toUpperCase() || 'L'


  const moreActive = useMemo(() => {
    const bottomItems = MAIN_ITEMS.slice(0, 4)
    const isBottomItem = bottomItems.some((item) =>
      isPathActive(location.pathname, item)
    )

    return !isBottomItem
  }, [location.pathname])

  const handleLogout = async () => {
    try {
      if (typeof logout === 'function') {
        await logout()
      } else {
        await signOut(auth)
      }

      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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
        <Sidebar onLogout={handleLogout} user={user} userData={userData} onOpenProfileModal={() => setProfileModalOpen(true)} />

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
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-5 text-[#111827] dark:text-white sm:text-base">
                    {greeting}, {storeName}
                  </p>
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

              <DashboardNotificationBell />

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

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-28 lg:pb-8">
            {/* Trial Banner Global */}
            <DashboardTrialRibbon />

            <AnimatePresence mode="wait">
              <motion.div
                key={loading ? 'loading-skeleton' : location.pathname}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
        />

        <AnimatePresence>
          {mobileMenuOpen && (
            <MobileMoreSheet
              open={mobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
              onLogout={handleLogout}
              user={user}
              userData={userData}
              onOpenProfileModal={() => setProfileModalOpen(true)}
            />
          )}
          {profileModalOpen && (
            <ProfileModal
              open={profileModalOpen}
              onClose={() => setProfileModalOpen(false)}
              onLogout={handleLogout}
              user={user}
              userData={userData}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
