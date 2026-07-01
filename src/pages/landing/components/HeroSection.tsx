import { Link } from 'react-router-dom'
import { FaPercent as BadgePercent } from 'react-icons/fa6'
import {
  FiArrowRight as ArrowRight,
  FiCheckCircle as CheckCircle2,
  FiClock as Clock,
  FiLink as LinkIcon,
  FiMessageCircle as MessageCircle,
  FiShield as ShieldCheck,
  FiShoppingBag as ShoppingBag,
  FiTrendingUp as TrendingUp,
  FiUsers as Users,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import type { ElementType } from 'react'

import { PhoneMockup } from './PhoneMockup'

type HeroBadge = {
  icon: ElementType
  title: string
  subtitle: string
  featured?: boolean
}

type TrustLink = {
  label: string
  shortLabel: string
  to: string
}

type ProofItem = {
  icon: ElementType
  text: string
  shortText: string
}

// ==========================================
// 2. Constantes de Dados
// ==========================================
const HERO_BADGES = [
  {
    icon: BadgePercent,
    title: '0%',
    subtitle: 'comissão do PratoBy por pedido',
    featured: true,
  },
  {
    icon: Users,
    title: 'Cliente seu',
    subtitle: 'relacionamento direto com sua loja',
  },
  {
    icon: LinkIcon,
    title: 'Link próprio',
    subtitle: 'divulgue onde quiser em qualquer lugar',
  },
] as const satisfies readonly HeroBadge[]

const TRUST_LINKS = [
  { label: 'Delivery sem comissão', shortLabel: 'Sem comissão', to: '/delivery-sem-comissao' },
  { label: 'Cardápio digital', shortLabel: 'Cardápio', to: '/cardapio-digital' },
  { label: 'Sistema para confeitaria', shortLabel: 'Confeitaria', to: '/sistema-para-confeitaria' },
] as const satisfies readonly TrustLink[]

const PROOF_ITEMS = [
  { icon: ShieldCheck, text: 'Sem comissão por pedido', shortText: 'Sem comissão' },
  { icon: Clock, text: 'Configuração acompanhada', shortText: 'Configuração' },
  { icon: ShoppingBag, text: 'Pedidos no painel da loja', shortText: 'Pedidos' },
] as const satisfies readonly ProofItem[]

// ==========================================
// 3. Utilitários e Classes Base
// ==========================================
// Dica: Para projetos grandes, recomenda-se usar `clsx` e `tailwind-merge`
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const TRUST_LINK_BASE_CLASS =
  'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-2 text-[10px] font-black text-[#64748b] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500/30 sm:gap-2 sm:px-3 sm:text-xs'

const PROOF_PILL_BASE_CLASS =
  'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-green-50 px-2.5 py-2 text-[10px] font-black text-green-700 ring-1 ring-green-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20 sm:gap-2 sm:px-4 sm:text-xs'

// ==========================================
// 4. Subcomponentes Visuais
// ==========================================
function HeroBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-12 h-[30rem] w-[30rem] rounded-full bg-orange-100/70 blur-3xl dark:bg-orange-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-24 h-[28rem] w-[28rem] rounded-full bg-amber-100/70 blur-3xl dark:bg-amber-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-[#f9fafb] dark:to-zinc-950"
      />
    </>
  )
}

function Eyebrow() {
  return (
    <p className="landing-reveal inline-flex max-w-full items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10 sm:text-xs">
      <TrendingUp size={15} className="shrink-0" aria-hidden="true" />
      <span className="truncate">Chega de pagar 27% de comissão</span>
    </p>
  )
}

export function HeroTitle() {
  return (
    <h1
      id="hero-title"
      className="mt-7 text-[2.15rem] font-black leading-[1.05] tracking-tight text-gray-900 dark:text-white min-[380px]:text-[2.35rem] sm:text-6xl lg:text-7xl"
    >
      <span className="block">Seu cardápio digital</span>
      <span className="block whitespace-nowrap text-orange-500">Seu delivery próprio</span>
      <span className="relative inline-block pb-4 text-orange-500">
        Zero comissão.
        <svg
          className="pointer-events-none absolute -bottom-1 left-[-4%] h-6 w-[108%]"
          viewBox="0 0 320 28"
          fill="none"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 17C52 11 94 10 136 12C180 14 224 20 312 13"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </h1>
  )
}

function HeroBadgeCard({ badge }: { badge: HeroBadge }) {
  const Icon = badge.icon

  return (
    <article
      className={cn(
        'min-h-[82px] rounded-[1.15rem] border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[116px] sm:rounded-[1.5rem] sm:p-4',
        badge.featured
          ? 'border-orange-100 bg-orange-50 shadow-orange-100/50 dark:border-orange-500/20 dark:bg-orange-500/10'
          : 'border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      )}
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Icon size={15} className="shrink-0 text-[#f97316] sm:size-[18px]" aria-hidden="true" />
        <p
          className={cn(
            'min-w-0',
            badge.featured
              ? 'text-lg font-black leading-none text-[#f97316] sm:text-2xl'
              : 'truncate text-[11px] font-black text-[#111827] dark:text-zinc-100 sm:text-sm'
          )}
        >
          {badge.title}
        </p>
      </div>
      <p
        className={cn(
          'mt-1.5 line-clamp-2 text-[9px] font-bold leading-[0.875rem] sm:text-xs sm:leading-5',
          badge.featured
            ? 'uppercase tracking-wide text-[#9a3412] dark:text-orange-200'
            : 'text-[#64748b] dark:text-zinc-400'
        )}
      >
        {badge.subtitle}
      </p>
    </article>
  )
}

function HeroBadges() {
  return (
    <div
      className="landing-reveal landing-delay-2 mt-6 grid grid-cols-3 gap-2 sm:gap-3"
      aria-label="Destaques do PratoBy"
    >
      {HERO_BADGES.map((badge) => (
        <HeroBadgeCard key={badge.title} badge={badge} />
      ))}
    </div>
  )
}

function HeroActions() {
  return (
    <div className="landing-reveal landing-delay-2 mt-6 space-y-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:space-y-0 lg:justify-start">
      <Link
        to="/cadastro"
        aria-label="Começar teste grátis de 14 dias no PratoBy"
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.5rem] bg-[#f97316] px-6 text-base font-black text-white shadow-xl shadow-orange-200 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] active:scale-95 dark:shadow-orange-950/40 sm:w-auto sm:min-w-[240px]"
      >
        Começar 14 dias grátis
        <ArrowRight size={18} aria-hidden="true" />
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
        <Link
          to="/planos"
          className="inline-flex h-[52px] w-full items-center justify-center rounded-[1.35rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-500/40 sm:h-14 sm:w-auto sm:px-6 sm:text-base"
        >
          Ver planos
        </Link>
        <Link
          to="/contato"
          aria-label="Falar com o time do PratoBy"
          className="inline-flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[1.35rem] border border-orange-100 bg-orange-50 px-4 text-sm font-black text-[#f97316] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] active:scale-95 dark:border-orange-500/20 dark:bg-orange-500/10 dark:hover:bg-orange-500/15 sm:h-14 sm:w-auto sm:px-6 sm:text-base"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Falar
        </Link>
      </div>
    </div>
  )
}

function HeroTrustLinks() {
  return (
    <div className="mt-8 flex flex-wrap gap-2 lg:mt-10">
      {TRUST_LINKS.map((link) => (
        <Link key={link.label} to={link.to} className={TRUST_LINK_BASE_CLASS}>
          <span className="hidden sm:inline">{link.label}</span>
          <span className="sm:hidden">{link.shortLabel}</span>
        </Link>
      ))}
    </div>
  )
}

function HeroProofItems() {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {PROOF_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.text} className={PROOF_PILL_BASE_CLASS}>
            <Icon size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{item.text}</span>
            <span className="sm:hidden">{item.shortText}</span>
          </div>
        )
      })}
    </div>
  )
}

function TrustLinks() {
  return (
    <nav
      aria-label="Páginas relacionadas ao PratoBy"
      className="landing-reveal landing-delay-2 mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 lg:justify-start"
    >
      {TRUST_LINKS.map((item) => (
        <Link key={item.label} to={item.to} aria-label={item.label} className={TRUST_LINK_BASE_CLASS}>
          <CheckCircle2 size={13} className="shrink-0 text-[#f97316] sm:size-[15px]" aria-hidden="true" />
          <span className="truncate sm:hidden">{item.shortLabel}</span>
          <span className="hidden sm:inline">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

function ProofPills() {
  return (
    <ul className="landing-reveal landing-delay-2 mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2 lg:justify-start">
      {PROOF_ITEMS.map((item) => {
        const Icon = item.icon

        return (
          <li key={item.text} className="min-w-0">
            <span aria-label={item.text} className={PROOF_PILL_BASE_CLASS}>
              <Icon size={13} className="shrink-0 sm:size-[14px]" aria-hidden="true" />
              <span className="truncate sm:hidden">{item.shortText}</span>
              <span className="hidden sm:inline">{item.text}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HeroContent() {
  return (
    <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
      <Eyebrow />
      <HeroTitle />

      <p className="mx-auto mt-6 max-w-xl text-base font-semibold leading-8 text-[#64748b] dark:text-zinc-400 sm:text-lg lg:mx-0">
        Crie sua loja online, receba pedidos pelo próprio link e venda sem comissão por pedido.
        Organize entrega, retirada, encomendas e atendimento em um painel simples.
      </p>

      <HeroBadges />
      <HeroActions />
      <TrustLinks />
      <ProofPills />
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="landing-hero-enter landing-delay-2 relative mx-auto flex min-h-[520px] w-full max-w-[470px] items-start justify-center lg:mx-0 lg:min-h-[690px] lg:justify-end">
      <div
        aria-hidden="true"
        className="absolute inset-x-8 top-10 h-72 rounded-full bg-orange-200/35 blur-3xl dark:bg-orange-500/10"
      />

      <div
        aria-hidden="true"
        className="landing-float relative w-full"
      >
        <PhoneMockup />
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-white pb-8 pt-8 text-[#111827] dark:bg-zinc-950 dark:text-white sm:pt-16 lg:pb-16 lg:pt-16"
    >
      <HeroBackground />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:gap-14">
          <HeroContent />
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
