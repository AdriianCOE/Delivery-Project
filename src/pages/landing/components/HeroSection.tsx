import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PhoneMockup } from './PhoneMockup'

const EXAMPLE_URL = 'https://pratoby.com/capivaras-lanches'

const heroBadges = [
  {
    icon: BadgePercent,
    title: '0%',
    subtitle: 'de comissão por pedido',
    featured: true,
  },
  {
    icon: Users,
    title: 'Cliente seu',
    subtitle: 'O relacionamento fica com sua loja.',
  },
  {
    icon: LinkIcon,
    title: 'Link próprio',
    subtitle: 'pratoby.com/capivaras-lanches',
  },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pb-6 pt-24 lg:pb-8 lg:pt-24">
      <div className="pointer-events-none absolute -left-40 top-24 h-[30rem] w-[30rem] rounded-full bg-orange-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-44 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#f9fafb]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
              <TrendingUp size={16} />
              Chega de pagar 27% de comissão
            </div>

            <h1 className="mt-7 text-4xl font-black leading-[1.04] tracking-tight text-[#111827] sm:text-6xl lg:text-7xl">
              Seu delivery próprio,{' '}
              <br className="hidden lg:block" />

              <span className="text-[#f97316]">
                sem taxa{' '}
              </span>

              <span className="relative inline-block text-[#f97316]">
                nenhuma.
                <svg
                  className="absolute -bottom-3 left-[-5%] h-4 w-[110%]"
                  viewBox="0 0 190 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M7 11C39 5 73 6 103 9C133 12 162 13 184 8"
                    stroke="#f97316"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                </svg>
              </span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg lg:mx-0">
              Crie um cardápio digital profissional, receba pedidos em tempo real
              e venda pelo seu próprio link com uma experiência moderna para o cliente.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {heroBadges.map((item) => {
                const Icon = item.icon

                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: item.featured ? 0.15 : 0.25 }}
                    className={`rounded-[1.5rem] border p-4 text-left shadow-sm ${
                      item.featured
                        ? 'border-orange-100 bg-orange-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        size={18}
                        className={item.featured ? 'text-[#f97316]' : 'text-[#f97316]'}
                      />

                      <p
                        className={
                          item.featured
                            ? 'text-2xl font-black text-[#f97316]'
                            : 'text-sm font-black text-[#111827]'
                        }
                      >
                        {item.title}
                      </p>
                    </div>

                    <p
                      className={`mt-1 text-xs font-bold leading-5 ${
                        item.featured ? 'uppercase tracking-wide text-[#9a3412]' : 'text-[#6b7280]'
                      }`}
                    >
                      {item.subtitle}
                    </p>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <Link
                to="/contato"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.6rem] bg-[#f97316] px-6 text-base font-black text-white shadow-2xl shadow-orange-200 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-95 sm:w-auto"
              >
                Criar minha loja
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/planos"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.6rem] border border-gray-200 bg-white px-6 text-base font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] active:scale-95 sm:w-auto"
              >
                Ver planos
              </Link>

              <a
                href={EXAMPLE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.6rem] border border-gray-200 bg-white px-6 text-base font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] active:scale-95 sm:w-auto"
              >
                <ExternalLink size={18} />
                Ver exemplo
              </a>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              {[
                'Sem comissão por venda',
                'Cliente e link da loja',
                'Pix com QR Code',
                'Painel do lojista',
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-black text-[#6b7280] shadow-sm"
                >
                  <CheckCircle2 size={15} className="text-[#f97316]" />
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-xs font-black text-green-700 ring-1 ring-green-100">
              <ShieldCheck size={15} />
              Ambiente seguro processado por PratoBy
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
            className="relative flex justify-center lg:justify-end"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}