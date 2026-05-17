import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiArrowRight, FiMenu, FiX } from 'react-icons/fi'

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-orange-600/20"
      />

      <div className="leading-none">
        <p className="text-2xl font-black tracking-tighter text-[#111827]">
          Prato<span className="text-[#f97316]">by</span>
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
    <main className="min-h-screen overflow-x-hidden bg-[#f9fafb] pt-[76px] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="shrink-0"
            aria-label="Ir para início"
            onClick={() => setIsMenuOpen(false)}
          >
            <Logo />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {navLinks.map((item) => {
              const active = isActivePath(item.to)

              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    active
                      ? 'bg-orange-50 text-[#f97316]'
                      : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              Entrar
            </Link>

            <Link
              to="/dashboard"
              className="hidden rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] xl:inline-flex"
            >
              Painel
            </Link>

            <Link
              to="/contato"
              className="rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-90"
            >
              Criar minha loja
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition active:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Entrar
            </Link>

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] ring-1 ring-gray-100 transition active:bg-gray-100"
              onClick={() => setIsMenuOpen((current) => !current)}
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
                    className={`rounded-2xl px-4 py-3 text-center text-sm font-black ${
                      active
                        ? 'bg-orange-50 text-[#f97316]'
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
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-center text-sm font-black text-white"
              >
                Criar minha loja
                <FiArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </nav>

      {children}

      <footer className="border-t border-gray-100 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm font-bold text-[#6b7280] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="PratoBy"
              className="h-8 w-8 rounded-xl object-cover grayscale transition hover:grayscale-0"
            />

            <p>
              © {new Date().getFullYear()}{' '}
              <span className="font-black text-[#111827]">PratoBy</span>. Todos os direitos reservados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-9">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`transition ${
                  isActivePath(item.to) ? 'text-[#f97316]' : 'hover:text-[#f97316]'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link to="/login" className="transition hover:text-[#f97316]">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}


