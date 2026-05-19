import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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

        <AnimatePresence>
  {isMenuOpen && (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-0 top-full border-b border-gray-100 bg-white/95 p-4 shadow-2xl shadow-gray-200/70 backdrop-blur-xl md:hidden"
    >
      <motion.div
        initial="closed"
        animate="open"
        exit="closed"
        variants={{
          open: {
            transition: {
              staggerChildren: 0.045,
              delayChildren: 0.04,
            },
          },
          closed: {
            transition: {
              staggerChildren: 0.025,
              staggerDirection: -1,
            },
          },
        }}
        className="grid gap-2 rounded-[1.75rem] border border-gray-100 bg-[#fafafa] p-2 shadow-sm"
      >
        {navLinks.map((item) => {
          const active = isActivePath(item.to)

          return (
            <motion.div
              key={item.label}
              variants={{
                open: { opacity: 1, y: 0, scale: 1 },
                closed: { opacity: 0, y: -8, scale: 0.98 },
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Link
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={`block rounded-[1.25rem] px-4 py-3 text-center text-sm font-black transition active:scale-[0.98] ${
                  active
                    ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
                    : 'bg-white text-[#111827] shadow-sm ring-1 ring-gray-100 hover:bg-orange-50 hover:text-[#f97316]'
                }`}
              >
                {item.label}
              </Link>
            </motion.div>
          )
        })}

        <motion.div
          variants={{
            open: { opacity: 1, y: 0, scale: 1 },
            closed: { opacity: 0, y: -8, scale: 0.98 },
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Link
            to="/contato"
            onClick={() => setIsMenuOpen(false)}
            className="mt-1 flex items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-[#ea580c] active:scale-[0.98]"
          >
            Criar minha loja
            <FiArrowRight size={16} />
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
      </header>

      <div>{children}</div>

      <footer className="border-t border-gray-100 bg-white">
  {/* Barra superior com um leve gradiente */}
  <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-[#f97316]" />

  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    {/* Cartão Unificado (p-5 no mobile para não apertar muito os cantos) */}
    <div className="flex flex-col gap-6 rounded-[2rem] border border-gray-100 bg-[#fafafa] p-5 shadow-sm sm:p-8">
      
      {/* Parte Superior: Logo e Ações */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
        <Link to="/" aria-label="Ir para início" className="inline-flex shrink-0 transition-transform hover:scale-105">
          <Logo compact />
        </Link>

        {/* Grupo de Ações: Espaçado no mobile, Agrupado na direita no PC */}
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          
          {/* Redes Sociais */}
          <div className="flex items-center gap-2">
            {socialLinks.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`${item.label} em breve`}
                  title={`${item.label} em breve`}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${item.colorClass}`}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>

          {/* Botão "Ver exemplo" */}
          <a
            href="https://pratoby.com/capivaras-lanches"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-fit shrink-0 items-center justify-center gap-2 rounded-full border border-orange-200 bg-white px-4 text-xs font-black text-[#f97316] shadow-sm transition-all hover:-translate-y-1 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md hover:shadow-orange-100/50"
          >
            Ver exemplo
            <FiExternalLink size={14} />
          </a>

        </div>
      </div>

      {/* Divisória Sutil */}
      <div className="h-px w-full bg-gray-200/70" />

      {/* Parte Inferior: Links e Direitos */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Links de Navegação (Centralizados no celular) */}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {footerLinks.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-full border border-gray-200/60 bg-white px-3.5 py-1.5 text-[13px] font-bold text-gray-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Copyright (Centralizado no celular) */}
        <p className="text-center text-[11px] font-semibold text-gray-400 sm:text-left sm:text-xs">
          © {new Date().getFullYear()} PratoBy. Todos os direitos reservados.
        </p>
      </div>
      
    </div>
  </div>
</footer>
    </main>
  )
}