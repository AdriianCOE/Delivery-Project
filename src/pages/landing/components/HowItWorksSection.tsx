import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import type { IconType } from 'react-icons'
import { FaWandMagicSparkles as Sparkles } from 'react-icons/fa6'
import {
  FiArrowRight as ArrowRight,
  FiCheckCircle as CheckCircle2,
  FiClock as Clock3,
  FiLink as Link2,
  FiPackage as PackagePlus,
  FiShare2 as Share2,
  FiShoppingBag as Store,
  FiZap as Zap,
} from 'react-icons/fi'

type Step = {
  number: string
  icon: IconType
  title: string
  description: string
  detail: string
}

type Highlight = {
  icon: IconType
  label: string
}

const steps: Step[] = [
  {
    number: '01',
    icon: Store,
    title: 'Cadastre sua loja',
    description:
      'Adicione nome, logo, horários, bairros de entrega e as informações principais da operação.',
    detail: 'Configuração inicial simples',
  },
  {
    number: '02',
    icon: PackagePlus,
    title: 'Monte seu cardápio',
    description:
      'Crie categorias, produtos, fotos, adicionais, opções obrigatórias e preços do jeito que sua loja vende.',
    detail: 'Produtos, categorias e adicionais',
  },
  {
    number: '03',
    icon: Share2,
    title: 'Compartilhe e venda',
    description:
      'Divulgue o link da loja, receba pedidos em tempo real e acompanhe tudo pelo painel do lojista.',
    detail: 'Pedidos online direto no painel',
  },
]

const highlights: Highlight[] = [
  {
    icon: Zap,
    label: 'Sem comissão do PratoBy por pedido',
  },
  {
    icon: Clock3,
    label: 'Pedidos em tempo real',
  },
  {
    icon: Link2,
    label: 'Link próprio da loja',
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      className="relative overflow-hidden bg-white py-16 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
      <div className="pointer-events-none absolute -left-28 top-20 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="lg:pr-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
              <Sparkles size={15} />
              Como funciona
            </div>

            <h2 className="mt-5 max-w-xl text-3xl font-black tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">
  Venda online com sua própria loja.
</h2>

<p className="mt-4 max-w-xl text-base font-semibold leading-8 text-[#6b7280]">
  Crie seu cardápio, compartilhe o link e receba pedidos em tempo real,
  sem depender de marketplace.
</p>

<div className="mt-5 flex flex-wrap gap-2">
  {['Sem comissão do PratoBy', 'Pedidos em tempo real', 'Link próprio'].map((item) => (
    <span
      key={item}
      className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316]"
    >
      {item}
    </span>
  ))}
</div>
          </motion.div>

          <div className="relative">
            <div className="absolute left-6 top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-orange-200 via-gray-200 to-transparent sm:block" />

            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon

                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5, delay: index * 0.12 }}
                    className="group relative"
                  >
                    <div className="relative rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-100/60 sm:p-5">
                      <div className="flex gap-4">
                        <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/25">
                          <Icon size={21} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                              Passo {step.number}
                            </span>

                            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-black text-[#9ca3af] ring-1 ring-gray-100">
                              {step.detail}
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-[#111827] sm:text-xl">
                            {step.title}
                          </h3>

                          <p className="mt-2 text-sm font-semibold leading-7 text-[#6b7280]">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="mt-5 overflow-hidden rounded-[1.75rem] border border-orange-100 bg-gradient-to-br from-[#fff7ed] via-white to-white p-5 shadow-xl shadow-orange-100/50"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                    Resultado
                  </p>

                  <h3 className="mt-1 text-xl font-black text-[#111827]">
                    Um delivery próprio, bonito e pronto para vender.
                  </h3>

                  <p className="mt-2 max-w-xl text-sm font-semibold leading-7 text-[#6b7280]">
                    O cliente acessa o link, monta o pedido e o lojista recebe
                    tudo organizado no painel.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                  <CheckCircle2 size={18} />
                  Loja publicada
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
