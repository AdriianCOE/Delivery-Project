import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import {
  FiArrowRight,
  FiCheckCircle,
  FiExternalLink,
  FiInstagram,
  FiMenu,
  FiMessageCircle,
  FiShield,
  FiX,
  FiZap,
} from 'react-icons/fi'

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Exemplos', to: '/exemplos' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

const footerGroups = [
  {
    title: 'Produto',
    links: [
      { label: 'Início', to: '/' },
      { label: 'Exemplos', to: '/exemplos' },
      { label: 'Blog', to: '/blog' },
      { label: 'Planos', to: '/planos' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', to: '/sobre' },
      { label: 'Planos', to: '/planos' },
      { label: 'Exemplos', to: '/exemplos' },
      { label: 'Contato', to: '/contato' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacidade', to: '/privacidade' },
      { label: 'Termos', to: '/termos' },
      { label: 'Exclusão de dados', to: '/data-deletion' },
    ],
  },
]

const socialLinks = [
  {
    label: 'Instagram do PratoBy',
    href: 'https://www.instagram.com/pratobybr',
    icon: FiInstagram,
  },
]

const trustHighlights = [
  { icon: FiShield, label: 'Sem comissão do PratoBy' },
  { icon: FiZap, label: 'Pedidos em tempo real' },
]

const easeOut = [0.16, 1, 0.3, 1]
const springTransition = { type: 'spring', stiffness: 500, damping: 36, mass: 0.8 }

function Logo({ compact = false, inverted = false, mobile = false }) {
  const iconSize = compact
    ? 'h-14 w-14'
    : mobile
      ? 'h-14 w-14 min-[390px]:h-16 min-[390px]:w-16 sm:h-[4.1rem] sm:w-[4.1rem]'
      : 'h-14 w-14 sm:h-[4.1rem] sm:w-[4.1rem]'

  const markSize = compact
    ? 'h-9 w-9'
    : mobile
      ? 'h-10 w-10 min-[390px]:h-11 min-[390px]:w-11 sm:h-12 sm:w-12'
      : 'h-11 w-11 sm:h-12 sm:w-12'

  const titleSize = compact
    ? 'text-2xl'
    : mobile
      ? 'text-[1.55rem] min-[390px]:text-[1.78rem] sm:text-[1.95rem]'
      : 'text-[1.95rem]'

  return (
    <div className="group flex min-w-0 items-center gap-3 min-[390px]:gap-3.5">
      <span
        className={[
          'relative grid shrink-0 place-items-center overflow-hidden rounded-[1.15rem] min-[390px]:rounded-[1.35rem]',
          inverted
            ? 'bg-white shadow-[0_16px_38px_rgba(249,115,22,.24)] ring-1 ring-white/10'
            : 'bg-white shadow-[0_18px_42px_rgba(249,115,22,.24)] ring-1 ring-orange-100/80',
          iconSize,
        ].join(' ')}
      >
        <span className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50" />
        <span className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-orange-200/45 blur-xl" />
        <img
          src="/icons/pratoby-mark-96.png"
          alt="PratoBy"
          width="96"
          height="96"
          decoding="async"
          className={[
            'relative z-10 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105',
            markSize,
          ].join(' ')}
        />
      </span>

      <div className="min-w-0 leading-none">
        <p
          className={[
            'whitespace-nowrap font-black tracking-tighter',
            titleSize,
            inverted ? 'text-white' : 'text-[#111827]',
          ].join(' ')}
        >
          Prato<span className="text-[#f97316]">By</span>
        </p>
        <p
          className={[
            'mt-1.5 block max-w-[155px] whitespace-normal text-[8px] font-black uppercase leading-[1.15] tracking-[0.18em] min-[390px]:max-w-none min-[390px]:whitespace-nowrap min-[390px]:text-[9px] sm:text-[10px]',
            inverted ? 'text-white/45' : 'text-gray-400',
          ].join(' ')}
        >
          Cardápio digital
        </p>
      </div>
    </div>
  )
}

export function BtnEntrar({ className = '', onClick }) {
  return (
    <Link
      to="/login"
      onClick={onClick}
      className={[
        'group relative inline-flex h-11 items-center justify-center overflow-hidden',
        'rounded-[1.25rem] border border-gray-200/80 bg-white/90 px-6',
        'text-[13px] font-black text-gray-700 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,.05)]',
        'transition-all duration-300 hover:-translate-y-[2px]',
        'hover:border-orange-200 hover:bg-orange-50/70 hover:text-[#f97316]',
        'hover:shadow-[0_10px_24px_rgba(249,115,22,.12)]',
        'active:translate-y-0 active:scale-[0.98] active:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2',
        className,
      ].join(' ')}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249,115,22,.12) 0%, transparent 70%)',
        }}
      />
      <span className="relative z-10">Entrar</span>
    </Link>
  )
}

export function BtnCriarLoja({ className = '', onClick, size = 'md' }) {
  const h = size === 'sm' ? 'h-11' : 'h-12'
  const px = size === 'sm' ? 'px-6' : 'px-8'
  const text = size === 'sm' ? 'text-[13px]' : 'text-sm'

  return (
    <Link
      to="/cadastro"
      onClick={onClick}
      className={[
        'group relative inline-flex items-center justify-center gap-2 overflow-hidden',
        `${h} ${px} ${text}`,
        'rounded-[1.25rem] font-black text-white',
        'bg-[linear-gradient(135deg,#fb923c_0%,#f97316_45%,#f59e0b_100%)]',
        'shadow-[0_12px_30px_rgba(249,115,22,.32),inset_0_1px_0_rgba(255,255,255,.35)]',
        'transition-all duration-300 hover:-translate-y-[2px] hover:scale-[1.015]',
        'hover:shadow-[0_18px_40px_rgba(249,115,22,.42),inset_0_1px_0_rgba(255,255,255,.45)]',
        'active:translate-y-0 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2',
        className,
      ].join(' ')}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-white/20 transition-transform duration-700 ease-out group-hover:translate-x-[190%]" />
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-white/50" />
      <span className="relative z-10">Criar minha loja</span>
      <FiArrowRight
        size={15}
        className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-0"
      />
    </Link>
  )
}

function DesktopNav({ isActivePath }) {
  return (
    <nav className="hidden items-center rounded-[1.45rem] border border-gray-200/70 bg-white/78 p-1 shadow-[0_10px_30px_rgba(15,23,42,.06)] backdrop-blur-xl lg:flex">
      {navLinks.map((item) => {
        const active = isActivePath(item.to)
        return (
          <Link
            key={item.label}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={[
              'group relative overflow-hidden rounded-[1.1rem] px-4 py-2.5 text-[13px] font-black',
              'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300',
              active
                ? 'bg-orange-50 text-[#f97316] shadow-sm ring-1 ring-orange-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-[#111827]',
            ].join(' ')}
          >
            <span className="relative z-10">{item.label}</span>
            {active && (
              <motion.span
                layoutId="marketing-active-nav"
                className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-[#f97316]"
                transition={springTransition}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function MobileMenu({ isOpen, closeMenu, isActivePath }) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar menu"
            onClick={closeMenu}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-[#111827]/35 backdrop-blur-[4px] lg:hidden"
          />

          <motion.aside
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="fixed left-2 right-2 top-[5rem] z-50 min-[390px]:top-[5.5rem] sm:left-4 sm:right-4 sm:top-[6rem] lg:hidden"
          >
            <div className="mx-auto max-w-md overflow-hidden rounded-[1.8rem] border border-white/75 bg-white/96 p-2 shadow-[0_26px_78px_rgba(15,23,42,.22)] backdrop-blur-2xl ring-1 ring-orange-100/70">
              <div className="rounded-[1.55rem] bg-gradient-to-br from-orange-50 via-white to-amber-50 p-3">
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                  <Logo compact />
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-orange-100 bg-white text-gray-700 shadow-sm transition active:scale-95"
                    aria-label="Fechar menu"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                <motion.nav
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={{
                    open: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
                    closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                  }}
                  className="grid gap-2"
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
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
                        <Link
                          to={item.to}
                          onClick={closeMenu}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'flex items-center justify-between rounded-[1.2rem] border px-4 py-3 text-sm font-black transition active:scale-[0.99]',
                            active
                              ? 'border-orange-200 bg-white text-[#f97316] shadow-sm'
                              : 'border-transparent bg-white/55 text-gray-700 hover:border-orange-100 hover:bg-white',
                          ].join(' ')}
                        >
                          {item.label}
                          <FiArrowRight
                            size={16}
                            className={[
                              'transition-transform',
                              active ? 'translate-x-0 text-[#f97316]' : 'text-gray-400',
                            ].join(' ')}
                          />
                        </Link>
                      </motion.div>
                    )
                  })}
                </motion.nav>

                <div className="mt-3 grid gap-2 border-t border-orange-100/80 pt-3">
                  <BtnCriarLoja onClick={closeMenu} className="w-full" size="sm" />
                  <Link
                    to="/contato"
                    onClick={closeMenu}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border border-orange-100 bg-white text-[13px] font-black text-gray-700 shadow-sm transition active:scale-[0.98]"
                  >
                    <FiMessageCircle size={15} className="text-[#f97316]" />
                    Falar com o PratoBy
                  </Link>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function FooterLink({ item, isActivePath }) {
  const active = isActivePath(item.to)
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={[
        'block rounded-full px-0 py-1 text-[12px] font-bold leading-snug transition-colors sm:text-sm',
        active ? 'text-orange-300' : 'text-white/60 hover:text-white',
      ].join(' ')}
    >
      {item.label}
    </Link>
  )
}

export default function MarketingLayout({ children }) {
  const location = useLocation()
  const prefersReducedMotion = useReducedMotion()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function isActivePath(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (!isMenuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen || typeof window === 'undefined') return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  const currentYear = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,237,213,.82),transparent_31rem),linear-gradient(180deg,#fff_0%,#fffaf5_54%,#fff_100%)] pt-[6rem] text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] min-[390px]:pt-[6.35rem] sm:pt-[6.6rem]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-[#f97316] focus:shadow-xl"
      >
        Pular para o conteúdo
      </a>

      <header className="fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4 sm:pt-3">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-visible rounded-[1.45rem] border border-white/80 bg-white/[0.94] shadow-[0_12px_34px_rgba(15,23,42,.08)] ring-1 ring-orange-100/60 backdrop-blur-2xl sm:rounded-[1.9rem] sm:bg-white/90 sm:shadow-[0_18px_55px_rgba(15,23,42,.09)]">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent sm:inset-x-6" />
            <div className="pointer-events-none absolute -bottom-9 left-8 hidden h-16 w-48 rounded-full bg-orange-100/50 blur-3xl sm:block" />

            <div className="flex min-h-[4.35rem] items-center justify-between gap-2 px-2.5 py-2 min-[390px]:min-h-[4.75rem] min-[390px]:px-3 sm:min-h-[4.95rem] sm:gap-3 sm:px-4 lg:px-5">
              <Link
                to="/"
                className="min-w-0 flex-1 rounded-2xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 lg:flex-none"
                aria-label="Ir para início"
              >
                <Logo mobile />
              </Link>

              <DesktopNav isActivePath={isActivePath} />

              <div className="hidden items-center gap-2.5 lg:flex">
                <BtnEntrar />
                <BtnCriarLoja />
              </div>

              <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
                <BtnEntrar className="h-10 rounded-[1.1rem] px-3 text-[12px] shadow-sm min-[390px]:px-4 sm:h-11 sm:px-5" />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  className="grid h-10 w-10 place-items-center rounded-[1.1rem] border border-gray-200/70 bg-white text-[#111827] shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:h-11 sm:w-11 sm:rounded-[1.2rem]"
                  aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                  aria-expanded={isMenuOpen}
                >
                  {isMenuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <MobileMenu
          isOpen={isMenuOpen}
          closeMenu={() => setIsMenuOpen(false)}
          isActivePath={isActivePath}
        />
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          id="conteudo"
          key={location.pathname}
          className="relative z-10 flex-1 outline-none"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.992, filter: 'blur(6px)' }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.996, filter: 'blur(4px)' }}
          transition={{
            duration: 0.34,
            ease: [0.22, 1, 0.36, 1],
          }}
          tabIndex={-1}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <footer className="relative overflow-hidden bg-[#0f172a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(249,115,22,.22),transparent_28rem),radial-gradient(circle_at_90%_15%,rgba(251,146,60,.16),transparent_26rem)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
            <div className="max-w-xl">
              <Link
                to="/"
                aria-label="Ir para início"
                className="inline-flex rounded-2xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
              >
                <Logo compact inverted />
              </Link>

              <p className="mt-5 max-w-lg text-sm leading-7 text-white/60">
                Cardápio digital, pedidos online, QR Code e delivery próprio para restaurantes, lanchonetes e confeitarias venderem sem comissão do PratoBy por pedido.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {trustHighlights.map((item) => {
                  const Icon = item.icon
                  return (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-white/80 shadow-sm"
                    >
                      <Icon size={14} className="text-orange-300" />
                      {item.label}
                    </span>
                  )
                })}
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <BtnCriarLoja className="w-full shadow-[0_16px_36px_rgba(249,115,22,.38)] sm:w-auto" />
                <Link
                  to="/exemplos"
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.06] px-6 text-sm font-black text-white/80 transition hover:-translate-y-[2px] hover:bg-white/[0.1] hover:text-white active:translate-y-0 active:scale-[0.98] sm:w-auto"
                >
                  Ver exemplos
                  <FiExternalLink size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 min-[390px]:gap-4 sm:gap-6">
              {footerGroups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300 sm:text-xs">
                    {group.title}
                  </p>
                  <nav className="mt-3 grid gap-1.5">
                    {group.links.map((item) => (
                      <FooterLink key={item.label} item={item} isActivePath={isActivePath} />
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-white/40 sm:flex-row sm:items-center sm:gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden="true" />
                © {currentYear} PratoBy. Todos os direitos reservados.
              </span>

              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" aria-hidden="true" />

              <span className="inline-flex items-center gap-1.5 text-white/50">
                Feito no Brasil com <span className="text-orange-300">♥</span> para pequenos negócios.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/contato"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-black text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              >
                <FiMessageCircle size={14} className="text-orange-300" />
                Fale com a gente
              </Link>

              {socialLinks.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 transition hover:-translate-y-0.5 hover:bg-white/[0.1] hover:text-white"
                  >
                    <Icon size={15} />
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

