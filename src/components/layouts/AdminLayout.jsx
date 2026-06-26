import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiCloud,
  FiCode,
  FiCreditCard,
  FiDatabase,
  FiDollarSign,
  FiFlag,
  FiGlobe,
  FiHardDrive,
  FiHome,
  FiLayers,
  FiLifeBuoy,
  FiLock,
  FiLogOut,
  FiMenu,
  FiMonitor,
  FiPlusCircle,
  FiSearch,
  FiSettings,
  FiShield,
  FiShoppingBag,
  FiTruck,
  FiUserCheck,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi'

import PratoByLogoIcon from '../ui/PratoByLogoIcon'

import { auth } from '../../services/firebaseAuth'

const BRAND_ORANGE = '#f97316'
const APP_ENV = import.meta.env.MODE || 'development'
const SHOW_ADMIN_STUB_NAV =
  String(import.meta.env.VITE_SHOW_ADMIN_STUB_NAV || '').toLowerCase() === 'true'

const MAIN_ITEMS = [
  {
    id: 'overview',
    label: 'Admin',
    description: 'Visão geral do SaaS',
    to: '/admin',
    icon: FiHome,
    match: 'exact',
  },
  {
    id: 'new-store',
    label: 'Nova loja',
    description: 'Implantação rápida',
    to: '/admin/stores/new',
    icon: FiPlusCircle,
    match: 'section',
  },
  {
    id: 'orders',
    label: 'Pedidos',
    description: 'Monitoramento global',
    to: '/admin/orders',
    icon: FiShoppingBag,
    match: 'section',
    pilotHidden: true,
  },
  {
    id: 'subscriptions',
    label: 'Assinaturas',
    description: 'Planos, status e cobrança',
    to: '/admin/subscriptions',
    icon: FiCreditCard,
    match: 'section',
  },
  {
    id: 'users',
    label: 'Usuários',
    description: 'Admins, lojistas e permissões',
    to: '/admin/users',
    icon: FiUsers,
    match: 'section',
    pilotHidden: true,
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Marca, domínio e integrações',
    to: '/admin/settings',
    icon: FiSettings,
    match: 'section',
    pilotHidden: true,
  },
]

const VISIBLE_MAIN_ITEMS = MAIN_ITEMS.filter((item) => SHOW_ADMIN_STUB_NAV || item.pilotHidden !== true)

const QUICK_ACTIONS = [
  {
    label: 'Nova loja',
    description: 'Cadastrar cliente',
    to: '/admin/stores/new',
    icon: FiPlusCircle,
  },
  {
    label: 'Todas as lojas',
    description: 'Buscar por storeSlug',
    to: '/admin/stores',
    icon: FiSearch,
  },
  {
    label: 'Site público',
    description: 'Abrir landing page',
    to: '/',
    icon: FiGlobe,
  },
]

const FUTURE_SECTIONS = [
  {
    title: 'Operação SaaS',
    items: [
      {
        label: 'Planos públicos',
        description: 'Preços, limites e recursos',
        icon: FiDollarSign,
        feature: 'planos-publicos',
      },
      {
        label: 'Implantação guiada',
        description: 'Checklist para publicar lojas',
        icon: FiClipboard,
        feature: 'implantacao-guiada',
      },
      {
        label: 'Suporte',
        description: 'Tickets, dúvidas e chamados',
        icon: FiLifeBuoy,
        feature: 'suporte',
      },
      {
        label: 'Cupons globais',
        description: 'Campanhas por rede/cidade',
        icon: FiZap,
        feature: 'cupons-globais',
      },
      {
        label: 'Relatórios SaaS',
        description: 'MRR, churn, GMV e lojas',
        icon: FiBarChart2,
        feature: 'relatorios-saas',
      },
    ],
  },
  {
    title: 'Desenvolvedor',
    items: [
      {
        label: 'Firestore Inspector',
        description: 'stores, orders e products',
        icon: FiDatabase,
        feature: 'firestore-inspector',
      },
      {
        label: 'Cloudinary',
        description: 'Uploads, presets e assets',
        icon: FiCloud,
        feature: 'cloudinary',
      },
      {
        label: 'Feature flags',
        description: 'Recursos por loja/plano',
        icon: FiFlag,
        feature: 'feature-flags',
      },
      {
        label: 'Logs e eventos',
        description: 'Erros e ações críticas',
        icon: FiActivity,
        feature: 'logs-eventos',
      },
      {
        label: 'Índices Firestore',
        description: 'Consultas e performance',
        icon: FiHardDrive,
        feature: 'indices-firestore',
      },
      {
        label: 'Webhooks',
        description: 'Pix, WhatsApp e automações',
        icon: FiCode,
        feature: 'webhooks',
      },
    ],
  },
  {
    title: 'Roadmap',
    items: [
      {
        label: 'White-label avançado',
        description: 'Marca e tema avançados',
        icon: FiLayers,
        feature: 'white-label-avancado',
      },
      {
        label: 'Painel de cozinha',
        description: 'Produção e impressão',
        icon: FiMonitor,
        feature: 'painel-cozinha',
      },
      {
        label: 'Entregadores',
        description: 'Motoboys, rotas e taxas',
        icon: FiTruck,
        feature: 'entregadores',
      },
      {
        label: 'Permissões avançadas',
        description: 'Papéis por usuário e loja',
        icon: FiUserCheck,
        feature: 'permissoes-avancadas',
      },
    ],
  },
]

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function normalizePath(path) {
  const cleanPath = String(path || '').split('?')[0].replace(/\/+$/, '')
  return cleanPath || '/'
}

function isRouteActive(item, pathname) {
  const currentPath = normalizePath(pathname)
  const targetPath = normalizePath(item.to)
  const excludedPaths = item.exclude || []

  const isExcluded = excludedPaths.some((excludedPath) => {
    const normalizedExcludedPath = normalizePath(excludedPath)
    return (
      currentPath === normalizedExcludedPath ||
      currentPath.startsWith(`${normalizedExcludedPath}/`)
    )
  })

  if (isExcluded) return false

  if (item.match === 'exact') {
    return currentPath === targetPath
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

function AdminMark({ compact = false }) {
  return (
    <Link
      to="/admin"
      className="flex min-w-0 items-center gap-3 rounded-[1.35rem] transition hover:bg-gray-50/80"
    >
      <PratoByLogoIcon size={compact ? 'sm' : 'lg'} />

      <div className="min-w-0">
        <p
          className={cn(
            compact ? 'text-base' : 'text-lg',
            'truncate font-black tracking-tight text-[#111827]'
          )}
        >
          PratoBy Admin
        </p>
        <p className="truncate text-xs font-bold text-[#6b7280]">
          Gestão global das lojas
        </p>
      </div>
    </Link>
  )
}

function SidebarSection({ title, children }) {
  return (
    <section>
      <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#9ca3af]">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function MainNavItem({ item, pathname, onNavigate }) {
  const Icon = item.icon
  const active = isRouteActive(item, pathname)

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-[1.35rem] px-3 py-3 text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-orange-100',
        active
          ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
          : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition',
          active
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
            active ? 'text-white/75' : 'text-[#9ca3af]'
          )}
        >
          {item.description}
        </span>
      </span>

      {active ? (
        <FiChevronRight className="shrink-0" size={16} />
      ) : null}
    </Link>
  )
}

function QuickActionItem({ action, onNavigate }) {
  const Icon = action.icon

  return (
    <Link
      to={action.to}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] transition group-hover:bg-[#f97316] group-hover:text-white">
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#111827]">
          {action.label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-bold text-[#9ca3af]">
          {action.description}
        </span>
      </span>

      <FiArrowRight className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#f97316]" />
    </Link>
  )
}

function SoonNavItem({ item, onClick }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group flex w-full items-center gap-3 rounded-[1.25rem] px-3 py-3 text-left text-sm font-black text-[#6b7280] transition hover:bg-[#f9fafb] hover:text-[#111827] focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gray-50 text-[#6b7280] transition group-hover:bg-white group-hover:text-[#f97316]">
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

      <FiLock className="shrink-0 text-gray-300" size={15} />
    </button>
  )
}

function MobileNavItem({ item, pathname }) {
  const Icon = item.icon
  const active = isRouteActive(item, pathname)

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-black transition',
        active ? 'bg-orange-50 text-[#f97316]' : 'text-[#6b7280] active:bg-gray-50'
      )}
    >
      <Icon size={19} />
      <span className="mt-1 max-w-full truncate">{item.label}</span>
    </Link>
  )
}

function SoonToast({ feature, onClose }) {
  useEffect(() => {
    if (!feature) return undefined
    const timer = window.setTimeout(onClose, 2800)
    return () => window.clearTimeout(timer)
  }, [feature, onClose])

  if (!feature) return null

  return (
    <div className="fixed right-4 top-4 z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200/80">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiClock />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827]">
            {feature.label} está chegando
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            A área já ficou reservada para o admin/desenvolvedor. Quando a funcionalidade existir, é só trocar esse botão por uma rota real.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          aria-label="Fechar aviso"
        >
          <FiX />
        </button>
      </div>
    </div>
  )
}

function AdminStatusCard() {
  return (
    <div className="mt-4 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4">
      <div className="flex items-center gap-2 text-[#f97316]">
        <FiShield />
        <p className="text-xs font-black uppercase tracking-wide">
          Área administrativa
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#9a3412]">
        Controle lojas, planos, acessos e recursos globais do PratoBy.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-[#111827] shadow-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          Ambiente
        </span>
        <span className="uppercase text-[#f97316]">{APP_ENV}</span>
      </div>
    </div>
  )
}

function MobileMoreSheet({ open, pathname, onClose, onSoonClick, onLogout }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar menu"
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
      />

      <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <p className="text-lg font-black text-[#111827]">Menu admin</p>
            <p className="text-xs font-bold text-[#6b7280]">
              Gestão global, lojas e recursos futuros.
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

        <div className="max-h-[calc(88vh-73px)] space-y-6 overflow-y-auto p-4 pb-28">
          <SidebarSection title="Principal">
            {VISIBLE_MAIN_ITEMS.map((item) => (
              <MainNavItem
                key={item.id}
                item={item}
                pathname={pathname}
                onNavigate={onClose}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="Ações rápidas">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionItem key={action.to} action={action} onNavigate={onClose} />
            ))}
          </SidebarSection>

          {FUTURE_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SoonNavItem
                  key={item.feature}
                  item={item}
                  onClick={(feature) => {
                    onSoonClick(feature)
                    onClose()
                  }}
                />
              ))}
            </SidebarSection>
          ))}

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-100"
          >
            <FiLogOut size={17} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ pathname, onSoonClick, onLogout }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[19.5rem] shrink-0 overflow-hidden border-r border-gray-100 bg-white/92 p-4 backdrop-blur-xl lg:block">
      <div className="flex h-full min-h-0 flex-col">
        <div className="rounded-[1.5rem] border border-gray-100 bg-white p-3 shadow-sm">
          <AdminMark />
        </div>

        <nav className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <SidebarSection title="Principal">
            {VISIBLE_MAIN_ITEMS.map((item) => (
              <MainNavItem key={item.id} item={item} pathname={pathname} />
            ))}
          </SidebarSection>

          <SidebarSection title="Ações rápidas">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionItem key={action.to} action={action} />
            ))}
          </SidebarSection>

          {FUTURE_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SoonNavItem key={item.feature} item={item} onClick={onSoonClick} />
              ))}
            </SidebarSection>
          ))}
        </nav>

        <div className="pt-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-100"
          >
            <FiLogOut size={17} />
            Sair da conta
          </button>

          <AdminStatusCard />
        </div>
      </div>
    </aside>
  )
}

function MobileBottomNav({ pathname, onOpenMore }) {
  const mobileItems = VISIBLE_MAIN_ITEMS.slice(0, 4)
  const isMoreActive = VISIBLE_MAIN_ITEMS.slice(4).some((item) => isRouteActive(item, pathname))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 px-2 py-2 shadow-2xl shadow-gray-300/60 backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => (
          <MobileNavItem key={item.id} item={item} pathname={pathname} />
        ))}

        <button
          type="button"
          onClick={onOpenMore}
          className={cn(
            'flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-black transition active:bg-gray-50',
            isMoreActive ? 'bg-orange-50 text-[#f97316]' : 'text-[#6b7280]'
          )}
        >
          <FiMenu size={19} />
          <span className="mt-1 max-w-full truncate">Mais</span>
        </button>
      </div>
    </nav>
  )
}

function AdminDesktopTopbar({ activeItem, onOpenSoon }) {
  const Icon = activeItem.icon || FiHome
  const userEmail = auth.currentUser?.email

  return (
    <header className="sticky top-0 z-30 hidden border-b border-gray-100 bg-[#f9fafb]/85 px-6 py-4 backdrop-blur-xl lg:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#f97316] shadow-sm ring-1 ring-gray-100">
            <Icon size={20} />
          </span>

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#9ca3af]">
              Admin PratoBy
            </p>
            <h1 className="truncate text-xl font-black tracking-tight text-[#111827]">
              {activeItem.label}
            </h1>
            <p className="truncate text-xs font-bold text-[#6b7280]">
              {activeItem.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenSoon({ label: 'Busca global' })}
            className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
          >
            <FiSearch size={16} />
            <span className="hidden xl:inline">Busca global</span>
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2.5 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
          >
            <FiMonitor size={16} />
            <span className="hidden xl:inline">Painel lojista</span>
          </Link>

          <Link
            to="/admin/stores/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-600/25 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
          >
            <FiPlusCircle size={16} />
            Nova loja
          </Link>

          <div className="hidden max-w-[220px] rounded-full bg-white px-4 py-2.5 text-right shadow-sm ring-1 ring-gray-100 2xl:block">
            <p className="truncate text-xs font-black text-[#111827]">
              {userEmail || 'Admin conectado'}
            </p>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#9ca3af]">
              {APP_ENV}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentOutlet = useOutlet()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [soonFeature, setSoonFeature] = useState(null)

  const pathname = location.pathname

  const activeItem = useMemo(() => {
    return MAIN_ITEMS.find((item) => isRouteActive(item, pathname)) || MAIN_ITEMS[0]
  }, [pathname])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  async function handleLogout() {
    try {
      await signOut(auth)
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f9fafb] text-[#111827]">
      <SoonToast feature={soonFeature} onClose={() => setSoonFeature(null)} />

      {/* Background Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-orange-100/50 blur-3xl" />
        <div className="absolute -right-28 top-1/3 h-80 w-80 rounded-full bg-gray-200/60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-50 blur-3xl" />
      </div>

      <div className="relative flex h-screen min-h-0 overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Sidebar pathname={pathname} onSoonClick={setSoonFeature} onLogout={handleLogout} />

        <section className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          
          {/* Header Mobile */}
          <header className="shrink-0 z-30 border-b border-gray-100 bg-[#f9fafb]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <AdminMark compact />

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-100 bg-white text-[#111827] shadow-sm"
                aria-label="Abrir menu"
              >
                <FiMenu size={20} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#9ca3af]">
                  Página atual
                </p>
                <p className="truncate text-sm font-black text-[#111827]">
                  {activeItem.label}
                </p>
              </div>

              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: BRAND_ORANGE }}
              />
            </div>
          </header>

          {/* Header Desktop */}
          <div className="shrink-0 hidden lg:block">
            <AdminDesktopTopbar activeItem={activeItem} onOpenSoon={setSoonFeature} />
          </div>

          {/* Área de Conteúdo Rolável (Scroll isolado) */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="min-h-full"
              >
                {currentOutlet}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>

      <MobileBottomNav pathname={pathname} onOpenMore={() => setMobileMenuOpen(true)} />

      <MobileMoreSheet
        open={mobileMenuOpen}
        pathname={pathname}
        onClose={() => setMobileMenuOpen(false)}
        onSoonClick={setSoonFeature}
        onLogout={handleLogout}
      />
    </main>
  )
}


