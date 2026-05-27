import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import {
  FiArrowRight,
  FiExternalLink,
  FiInstagram,
  FiMenu,
  FiTwitter,
  FiX,
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
    href: 'https://www.instagram.com/pratobybr',
    icon: FiInstagram,
    hoverClass: 'hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600',
  },
  {
    label: 'Twitter / X',
    href: 'https://x.com/',
    icon: FiTwitter,
    hoverClass: 'hover:border-sky-200 hover:bg-sky-50 hover:text-sky-500',
  },
]

function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className={`rounded-2xl object-cover shadow-lg shadow-orange-600/20 ${
          compact ? 'h-9 w-9' : 'h-11 w-11'
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
        <p className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
          Cardápio digital e delivery
        </p>
      </div>
    </div>
  )
}

/* ─── Botão "Entrar" ─────────────────────────────────────────── */
export function BtnEntrar({ className = '', onClick }) {
  return (
    <Link
      to="/login"
      onClick={onClick}
      className={[
        // base
        'group relative inline-flex h-11 items-center justify-center overflow-hidden',
        'rounded-[1.35rem] border border-gray-200/80 bg-white px-6',
        'text-[13px] font-bold text-gray-600',
        // sombra inicial super sutil
        'shadow-[0_1px_2px_rgba(0,0,0,.04)]',
        // hover - transição aveludada
        'transition-all duration-300 hover:-translate-y-[2px]',
        'hover:border-orange-200 hover:shadow-[0_4px_12px_rgba(249,115,22,.08)]',
        'hover:text-[#f97316] hover:bg-orange-50/30',
        // active - clique responsivo
        'active:scale-[0.98] active:translate-y-0 active:shadow-none',
        className,
      ].join(' ')}
    >
      {/* brilho interno no hover - mantido da sua ideia brilhante */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249,115,22,.08) 0%, transparent 70%)',
        }}
      />
      <span className="relative z-10">Entrar</span>
    </Link>
  )
}

/* ─── Botão "Criar minha loja" ───────────────────────────────── */
export function BtnCriarLoja({ className = '', onClick, size = 'md' }) {
  const h = size === 'sm' ? 'h-11' : 'h-12'
  const px = size === 'sm' ? 'px-6' : 'px-8'
  const text = size === 'sm' ? 'text-[13px]' : 'text-sm'

  return (
    <Link
      to="/cadastro"
      onClick={onClick}
      className={[
        // base
        'group relative inline-flex items-center justify-center gap-2 overflow-hidden',
        `${h} ${px} ${text}`,
        'rounded-[1.35rem] font-black text-white',
        // fundo: gradiente premium
        'bg-gradient-to-r from-orange-500 to-amber-500',
        // sombra inicial (Glow difuso)
        'shadow-[0_1px_2px_rgba(249,115,22,.3),0_4px_16px_rgba(249,115,22,.25)]',
        // hover: aumenta proporção e intensifica o brilho
        'transition-all duration-300 hover:-translate-y-[2px] hover:scale-[1.02]',
        'hover:shadow-[0_2px_4px_rgba(249,115,22,.3),0_8px_24px_rgba(249,115,22,.4)]',
        // active: afunda ao clicar
        'active:scale-[0.98] active:translate-y-0 active:shadow-sm',
        className,
      ].join(' ')}
    >
      {/* shimmer animado no hover (feixe de luz) */}
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/15 transition-transform duration-500 ease-out group-hover:translate-x-[200%]"
      />
      {/* borda brilhante no topo (glass effect) */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full bg-white/40"
      />
      <span className="relative z-10">Criar minha loja</span>
      <FiArrowRight
        size={15}
        className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-0"
      />
    </Link>
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

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl">
        {/* linha laranja no rodapé do header */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <span className="block h-full w-full rounded-full bg-[#f97316]" />
        </span>

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0" aria-label="Ir para início">
            <Logo />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((item) => {
              const active = isActivePath(item.to)
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`group relative rounded-full px-4 py-2 text-sm font-black transition-all duration-200 ${
                    active
                      ? 'bg-orange-50 text-[#f97316] shadow-sm ring-1 ring-orange-100'
                      : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-4 -bottom-1 h-[2px] rounded-full bg-[#f97316]" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* CTAs desktop */}
          <div className="hidden items-center gap-2.5 md:flex">
            <BtnEntrar />
            <BtnCriarLoja />
          </div>

          {/* Mobile: entrar + hamburguer */}
          <div className="flex items-center gap-2 md:hidden">
            <BtnEntrar className="h-11 px-4 text-sm" />
            <button
              type="button"
              onClick={() => setIsMenuOpen((c) => !c)}
              className="flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-gray-50 text-[#111827] ring-1 ring-gray-100 transition active:scale-95"
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
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
                  open: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
                  closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
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
                  <BtnCriarLoja
                    className="mt-1 w-full justify-center rounded-[1.25rem]"
                    onClick={() => setIsMenuOpen(false)}
                    size="sm"
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── CONTEÚDO ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* ── FOOTER PREMIUM COMPACTO ───────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        {/* faixa laranja no topo */}
        <div className="h-[3px] w-full bg-gradient-to-r from-orange-300 via-[#f97316] to-orange-400" />

        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div
            className="rounded-[1.75rem] border border-gray-100 px-5 py-5 sm:px-7"
            style={{
              background:
                'linear-gradient(135deg, #fafafa 0%, #fff7f0 50%, #fafafa 100%)',
              boxShadow:
                '0 1px 3px rgba(0,0,0,.04), 0 0 0 1px rgba(249,115,22,.06)',
            }}
          >
            {/* linha única no desktop, coluna no mobile */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              {/* Logo */}
              <Link
                to="/"
                aria-label="Ir para início"
                className="shrink-0 self-start transition-opacity hover:opacity-80 sm:self-auto"
              >
                <Logo compact />
              </Link>

              {/* Links de navegação — centro */}
              <nav className="flex flex-wrap gap-x-1 gap-y-1.5 sm:justify-center">
                {footerLinks.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`rounded-full px-3 py-1 text-[12px] font-bold transition-all duration-150 ${
                      isActivePath(item.to)
                        ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Lado direito: redes + exemplo */}
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                {/* redes sociais */}
                {socialLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.label}
                      className={[
                        'inline-flex h-8 w-8 items-center justify-center rounded-full',
                        'border border-gray-200 bg-white text-gray-400',
                        'shadow-[0_1px_2px_rgba(0,0,0,.05)]',
                        'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md',
                        item.hoverClass,
                      ].join(' ')}
                    >
                      <Icon size={14} />
                    </a>
                  )
                })}

                {/* divisor */}
                <span className="mx-0.5 h-5 w-px bg-gray-200" />

                {/* ver exemplo */}
                <a
                  href="https://pratoby.com/capivaras-lanches"
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    'group inline-flex h-8 items-center gap-1.5 rounded-full',
                    'border border-orange-200/80 bg-white px-3',
                    'text-[11px] font-black text-[#f97316]',
                    'shadow-[0_1px_2px_rgba(249,115,22,.1),0_0_0_1px_rgba(249,115,22,.08)]',
                    'transition-all duration-150 hover:-translate-y-0.5',
                    'hover:border-orange-300 hover:bg-orange-50',
                    'hover:shadow-[0_3px_8px_rgba(249,115,22,.2)]',
                  ].join(' ')}
                >
                  Ver exemplo
                  <FiExternalLink
                    size={11}
                    className="transition-transform duration-150 group-hover:translate-x-px"
                  />
                </a>
              </div>
            </div>

            {/* separador + copyright */}
            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3.5">
              {/* ponto laranja decorativo */}
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f97316]"
                aria-hidden="true"
              />
              <p className="text-[11px] font-semibold text-gray-400">
                © {new Date().getFullYear()} PratoBy. Todos os direitos reservados.
              </p>
              <span className="ml-auto text-[11px] font-semibold text-gray-300">
                Feito com 🧡 no Brasil
              </span>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}