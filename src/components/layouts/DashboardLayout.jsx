import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { AnimatePresence, motion } from 'motion/react'

import { auth } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import ProfilePanel from '../merchant/ProfilePanel'

import {
  FiArchive,
  FiBarChart2,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
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
      {
        label: 'Assinatura',
        description: 'Mensalidade e status da loja',
        icon: FiArchive,
        to: '/dashboard/assinatura',
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
            'truncate font-black tracking-tight text-[#111827]'
          )}
        >
          PratoBy
        </p>

        <p className="truncate text-xs font-bold text-[#6b7280]">
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
          'group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black transition active:scale-[0.99]',
          isActive
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
            : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition',
              isActive
                ? 'bg-white/15 text-white'
                : 'bg-gray-50 text-[#6b7280] group-hover:bg-white group-hover:text-[#f97316]'
            )}
          >
            <Icon size={18} />
          </span>

          <span className="min-w-0 flex-1">
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

          {isActive && <FiChevronRight className="shrink-0" size={16} />}
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
          'group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition active:scale-[0.99]',
          isActive
            ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
            : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition',
              isActive
                ? 'bg-white text-[#f97316]'
                : 'bg-gray-50 text-[#6b7280] group-hover:bg-white group-hover:text-[#f97316]'
            )}
          >
            <Icon size={18} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{item.label}</span>

              <span className="shrink-0 rounded-full bg-[#111827] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                Em breve
              </span>
            </span>

            <span className="mt-0.5 block truncate text-[11px] font-bold text-[#9ca3af]">
              {item.description}
            </span>
          </span>

          <FiLock
            className={cn(
              'shrink-0',
              isActive ? 'text-[#f97316]' : 'text-gray-300'
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
            ? 'bg-orange-50 text-[#f97316]'
            : 'text-[#6b7280] active:bg-gray-50'
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
    <div className="fixed right-4 top-4 z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-gray-100 bg-white/95 p-4 shadow-2xl shadow-gray-900/10 ring-1 ring-white/70 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiClock />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827]">
            {feature.label} está no roadmap
          </p>

          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            Esta área já ficou reservada no painel para crescer sem quebrar a navegação atual.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
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
        className="absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl ring-1 ring-white/70 flex flex-col"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4">
          <div>
            <p className="text-lg font-black text-[#111827]">
              Menu do painel
            </p>
            <p className="text-xs font-bold text-[#6b7280]">
              Áreas atuais e futuras do PratoBy.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-50 text-[#111827]"
            aria-label="Fechar menu"
          >
            <FiX />
          </button>
        </div>

        <div className="shrink-0 p-4 pb-0">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenProfileModal()
            }}
            className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.98] active:bg-orange-50"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[0.85rem] bg-orange-50 text-[#f97316]">
              {photoURL ? (
                <img src={photoURL} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black">
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#111827]">{name}</p>
              {email && <p className="truncate text-xs font-semibold text-[#6b7280]">{email}</p>}
            </div>
            <FiChevronRight size={16} className="text-gray-300 transition group-hover:text-[#f97316]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 pb-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4">
          <div>
            <p className="text-lg font-black text-[#111827]">Perfil da Conta</p>
            <p className="text-xs font-bold text-[#6b7280]">Gerencie sua conta e segurança</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#f9fafb] p-4 sm:p-6 [scrollbar-width:thin]">
          <ProfilePanel onLogout={null} />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white p-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827]"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-100"
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
        className="group flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-orange-100 hover:bg-orange-50/40"
      >
        {/* Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl">
          {photoURL ? (
            <img src={photoURL} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-50 text-sm font-black text-[#f97316]">
              {initial}
            </div>
          )}
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#111827]">{name}</p>
          {email && (
            <p className="truncate text-[11px] font-semibold text-[#9ca3af]">{email}</p>
          )}
        </div>

        {/* Ícone de perfil */}
        <FiUser
          size={14}
          className="shrink-0 text-gray-300 transition group-hover:text-[#f97316]"
        />
      </button>
    </div>
  )
}

function Sidebar({ onLogout, user, userData, onOpenProfileModal }) {
  return (
    <aside className="hidden h-[100dvh] w-[18.5rem] shrink-0 overflow-hidden border-r border-gray-100 bg-white/[0.92] p-4 shadow-[18px_0_50px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:block">
      <div className="flex h-full min-h-0 flex-col">
        <div className="rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-3 shadow-sm ring-1 ring-white">
          <PratoByMark />
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
      </div>
    </aside>
  )
}

function MobileBottomNav({ onOpenMore, moreActive }) {
  const mobileItems = MAIN_ITEMS.slice(0, 4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 px-2 pt-2 shadow-2xl shadow-gray-300/60 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => (
          <MobileNavItem key={item.to} item={item} />
        ))}

        <button
          type="button"
          onClick={onOpenMore}
          className={cn(
            'flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition active:scale-[0.98] active:bg-gray-50',
            moreActive ? 'bg-orange-50 text-[#f97316]' : 'text-[#6b7280]'
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [soonFeature, setSoonFeature] = useState(null)

  const { user, userData, logout } = authContext || {}


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
    <main className="h-[100dvh] overflow-hidden bg-[#f9fafb] text-[#111827]">
      <SoonToast
        feature={soonFeature}
        onClose={() => setSoonFeature(null)}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100/55 blur-3xl" />
        <div className="absolute right-[-7rem] top-1/3 h-80 w-80 rounded-full bg-gray-200/60 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-50 blur-3xl" />
      </div>

      <div className="relative flex h-[100dvh] min-h-0 overflow-hidden">
        <Sidebar onLogout={handleLogout} user={user} userData={userData} onOpenProfileModal={() => setProfileModalOpen(true)} />

        <section className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-28 lg:pb-8">
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-full"
      >
        <Outlet />
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