import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
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

import { PhoneMockup } from './PhoneMockup'

type HeroBadge = {
  icon: IconType
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
  icon: IconType
  text: string
  shortText: string
}

const heroBadges: HeroBadge[] = [
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
]

const trustLinks: TrustLink[] = [
  {
    label: 'Delivery sem comissão',
    shortLabel: 'Sem comissão',
    to: '/delivery-sem-comissao',
  },
  {
    label: 'Cardápio digital',
    shortLabel: 'Cardápio',
    to: '/cardapio-digital',
  },
  {
    label: 'Sistema para confeitaria',
    shortLabel: 'Confeitaria',
    to: '/sistema-para-confeitaria',
  },
]

const proofItems: ProofItem[] = [
  {
    icon: ShieldCheck,
    text: 'Sem comissão por pedido',
    shortText: 'Sem comissão',
  },
  {
    icon: Clock,
    text: 'Configuração acompanhada',
    shortText: 'Configuração',
  },
  {
    icon: ShoppingBag,
    text: 'Pedidos no painel da loja',
    shortText: 'Pedidos',
  },
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion()

  const contentAnimation = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: 'easeOut' },
      }

  const phoneAnimation = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 22 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.65, delay: 0.12, ease: 'easeOut' },
      }

  return (
    <section className="relative isolate overflow-hidden bg-white pb-8 pt-8 text-[#111827] dark:bg-zinc-950 dark:text-white sm:pt-15 lg:pb-15 lg:pt-15">
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

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:gap-14">
          <motion.div {...contentAnimation} className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10 sm:text-xs">
              <TrendingUp size={15} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Chega de pagar 27% de comissão</span>
            </div>

            <h1 className="mt-7 text-[2.15rem] font-black leading-[1.02] tracking-tight text-[#111827] min-[380px]:text-[2.35rem] sm:text-6xl lg:text-7xl">
              <span className="block whitespace-nowrap">Seu cardápio digital.</span>

              <span className="block whitespace-nowrap text-[#f97316]">Seu delivery.</span>

              <span className="relative inline-block whitespace-nowrap pb-4 text-[#f97316]">
                Zero comissão.

                <motion.svg
                  className="pointer-events-none absolute -bottom-1 left-[-4%] h-6 w-[108%]"
                  viewBox="0 0 320 28"
                  fill="none"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : {
                          y: [0, -1, 0],
                        }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          y: {
                            duration: 2.8,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          },
                        }
                  }
                >
                  <motion.path
                    d="M8 17C52 11 94 10 136 12C180 14 224 20 312 13"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0 }}
                    animate={
                      prefersReducedMotion
                        ? { pathLength: 1, opacity: 1 }
                        : {
                            pathLength: [0, 1, 1],
                            opacity: [0, 1, 1],
                          }
                    }
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.2 }
                        : {
                            duration: 1.8,
                            times: [0, 0.55, 1],
                            repeat: Infinity,
                            repeatDelay: 2.4,
                            ease: 'easeInOut',
                          }
                    }
                  />
                </motion.svg>
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base font-semibold leading-8 text-[#64748b] dark:text-zinc-400 sm:text-lg lg:mx-0">
              Crie sua loja online, receba pedidos pelo próprio link e venda sem comissão por
              pedido. Organize entrega, retirada, encomendas e atendimento em um painel simples.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {heroBadges.map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.article
                    key={item.title}
                    initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? undefined
                        : { duration: 0.35, delay: 0.12 + index * 0.07, ease: 'easeOut' }
                    }
                    className={cx(
                      'min-h-[82px] rounded-[1.15rem] border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[116px] sm:rounded-[1.5rem] sm:p-4',
                      item.featured
                        ? 'border-orange-100 bg-orange-50 shadow-orange-100/50 dark:border-orange-500/20 dark:bg-orange-500/10'
                        : 'border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    )}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Icon
                        size={15}
                        className="shrink-0 text-[#f97316] sm:size-[18px]"
                        aria-hidden="true"
                      />

                      <p
                        className={cx(
                          'min-w-0',
                          item.featured
                            ? 'text-lg font-black leading-none text-[#f97316] sm:text-2xl'
                            : 'truncate text-[11px] font-black text-[#111827] dark:text-zinc-100 sm:text-sm'
                        )}
                      >
                        {item.title}
                      </p>
                    </div>

                    <p
                      className={cx(
                        'mt-1.5 line-clamp-2 text-[9px] font-bold leading-3.5 sm:text-xs sm:leading-5',
                        item.featured
                          ? 'uppercase tracking-wide text-[#9a3412] dark:text-orange-200'
                          : 'text-[#64748b] dark:text-zinc-400'
                      )}
                    >
                      {item.subtitle}
                    </p>
                  </motion.article>
                )
              })}
            </div>

            <div className="mt-6 space-y-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:space-y-0 lg:justify-start">
              <Link
                to="/cadastro"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.5rem] bg-[#f97316] px-6 text-base font-black text-white shadow-xl shadow-orange-200 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-95 dark:shadow-orange-950/40 sm:w-auto sm:min-w-[240px]"
              >
                Começar 14 dias grátis
                <ArrowRight size={18} aria-hidden="true" />
              </Link>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
                <Link
                  to="/planos"
                  className="inline-flex h-[52px] w-full items-center justify-center rounded-[1.35rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-500/40 sm:h-14 sm:w-auto sm:px-6 sm:text-base"
                >
                  Ver planos
                </Link>

                <Link
                  to="/contato"
                  className="inline-flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[1.35rem] border border-orange-100 bg-orange-50 px-4 text-sm font-black text-[#f97316] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-100 active:scale-95 dark:border-orange-500/20 dark:bg-orange-500/10 dark:hover:bg-orange-500/15 sm:h-14 sm:w-auto sm:px-6 sm:text-base"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Falar
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 lg:justify-start">
              {trustLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-2 text-[10px] font-black text-[#64748b] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500/30 sm:gap-2 sm:px-3 sm:text-xs"
                >
                  <CheckCircle2 size={13} className="shrink-0 text-[#f97316] sm:size-[15px]" aria-hidden="true" />

                  <span className="truncate sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2 lg:justify-start">
              {proofItems.map((item) => {
                const Icon = item.icon

                return (
                  <span
                    key={item.text}
                    title={item.text}
                    className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-green-50 px-2.5 py-2 text-[10px] font-black text-green-700 ring-1 ring-green-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20 sm:gap-2 sm:px-4 sm:text-xs"
                  >
                    <Icon size={13} className="shrink-0 sm:size-[14px]" aria-hidden="true" />

                    <span className="truncate sm:hidden">{item.shortText}</span>
                    <span className="hidden sm:inline">{item.text}</span>
                  </span>
                )
              })}
            </div>
          </motion.div>

          <motion.div
            {...phoneAnimation}
            className="relative mx-auto flex min-h-[520px] w-full max-w-[470px] items-start justify-center lg:mx-0 lg:min-h-[690px] lg:justify-end"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-8 top-10 h-72 rounded-full bg-orange-200/35 blur-3xl dark:bg-orange-500/10"
            />

            <div className="relative w-full">
              <PhoneMockup />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="sr-only">
        Plataforma de cardápio digital e delivery próprio para negócios de alimentação venderem
        online sem comissão por pedido.
      </div>
    </section>
  )
}