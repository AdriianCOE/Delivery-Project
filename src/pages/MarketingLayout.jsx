import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FiArrowRight,
  FiCheckCircle,
  FiExternalLink,
  FiInstagram,
  FiMenu,
  FiShield,
  FiTwitter,
  FiX,
  FiZap,
} from 'react-icons/fi'

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

const footerLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
  { label: 'Privacidade', to: '/privacidade' },
  { label: 'Termos', to: '/termos' },
]

const socialLinks = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/pratoby',
    icon: FiInstagram,
    colorClass:
      'hover:border-pink-100 hover:bg-pink-50 hover:text-pink-600',
  },
  {
    label: 'Twitter / X',
    href: 'https://x.com/pratoby',
    icon: FiTwitter,
    colorClass:
      'hover:border-sky-100 hover:bg-sky-50 hover:text-sky-600',
  },
]

const footerBadges = [
  {
    label: 'Sistema funcional',
    icon: FiCheckCircle,
    className: 'bg-orange-50 text-[#f97316] ring-orange-100',
  },
  {
    label: '0% comissão por pedido',
    icon: FiZap,
    className: 'bg-orange-50 text-[#f97316] ring-orange-100',
  },
]

function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className={`rounded-2xl object-cover shadow-lg shadow-orange-600/20 ${
          compact ? 'h-10 w-10' : 'h-11 w-11'
        }`}
      />

      <div className="leading-none">
        <p
          className={`font-black tracking-tighter text-[#111827] ${
            compact ? 'text-xl' : 'text-2xl'
          }`}
        >
          Prato<span className="text-[#f97316]">By</span>
        </p>

        <p className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
          Cardápio digital e delivery
        </p>
      </div>
    </div>
  )
}

export default function MarketingLayout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  function isActivePath(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  return (
    <main className="min-h-screen bg-white pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <span className="block h-full w-full rounded-full bg-[#f97316]" />
        </span>

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0" aria-label="Ir para início">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {navLinks.map((item) => {
              const active = isActivePath(item.to)

              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`group relative rounded-full px-4 py-2 text-sm font-black transition-all duration-300 ${
                    active
                      ? 'bg-orange-50 text-[#f97316] shadow-sm ring-1 ring-orange-100'
                      : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                  }`}
                >
                  {item.label}

                  {active && (
                    <span className="absolute inset-x-4 -bottom-1 h-1 rounded-full bg-[#f97316]" />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-[1.4rem] border border-gray-200 bg-white px-5 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] active:scale-95"
            >
              Entrar
            </Link>

            <Link
              to="/contato"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.4rem] bg-[#f97316] px-5 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95"
            >
              Criar minha loja
              <FiArrowRight size={16} />
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-[1.25rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm active:scale-95"
            >
              Entrar
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-gray-50 text-[#111827] ring-1 ring-gray-100 transition active:scale-95"
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FiX size={23} /> : <FiMenu size={23} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="absolute inset-x-0 top-full border-b border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200/70 md:hidden">
            <div className="grid gap-2">
              {navLinks.map((item) => {
                const active = isActivePath(item.to)

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={`rounded-[1.25rem] px-4 py-3 text-center text-sm font-black transition active:scale-[0.98] ${
                      active
                        ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
                        : 'bg-[#f9fafb] text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}

              <Link
                to="/contato"
                onClick={() => setIsMenuOpen(false)}
                className="mt-2 rounded-[1.25rem] bg-[#f97316] px-4 py-3 text-center text-sm font-black text-white"
              >
                Criar minha loja
              </Link>
            </div>
          </div>
        )}
      </header>

      <div>{children}</div>

      <footer className="border-t border-gray-100 bg-white">
  <div className="h-1 w-full bg-[#f97316]" />

  <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <Link to="/" aria-label="Ir para início" className="shrink-0">
        <Logo compact />
      </Link>

      <nav className="flex flex-wrap items-center justify-center gap-2">
        {footerLinks.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="rounded-full px-3.5 py-2 text-sm font-bold text-[#6b7280] transition hover:bg-orange-50 hover:text-[#f97316]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-center gap-2 lg:justify-end">
        {socialLinks.map((item) => {
          const Icon = item.icon

          return (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              aria-label={item.label}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-[#6b7280] shadow-sm transition hover:-translate-y-0.5 ${item.colorClass}`}
            >
              <Icon size={18} />
            </a>
          )
        })}

        <a
          href="https://pratoby.com/capivaras-lanches"
          target="_blank"
          rel="noreferrer"
          className="hidden h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] sm:inline-flex"
        >
          Ver exemplo
          <FiExternalLink size={14} />
        </a>
      </div>
    </div>

    <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-[#9ca3af]">
        © {new Date().getFullYear()} PratoBy. Todos os direitos reservados.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] ring-1 ring-orange-100">
          <FiZap size={13} />
          0% comissão
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-[#6b7280] ring-1 ring-gray-100">
          <FiCheckCircle size={13} />
          Sistema funcional
        </span>
      </div>
    </div>
  </div>
</footer>
    </main>
  )
}