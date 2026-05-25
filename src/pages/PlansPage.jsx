import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import MarketingLayout from '../pages/MarketingLayout'
import SEO from '../components/seo/SEO'
import { PLAN_OPTIONS } from '../utils/planCatalog'
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiLink,
  FiMessageCircle,
  FiMonitor,
  FiShield,
} from 'react-icons/fi'
import AnimatedSegmentedControl from '../components/ui/AnimatedSegmentedControl'

const plans = PLAN_OPTIONS

const benefits = [
  {
    icon: FiShield,
    label: '0% comissão por venda',
  },
  {
    icon: FiClock,
    label: 'Pedidos em tempo real',
  },
  {
    icon: FiLink,
    label: 'Link próprio da loja',
  },
]

function PlanCard({ plan, index, cycle }) {
  const Icon = plan.icon
  const isAnnual = cycle === 'annual'
  const displayPrice = isAnnual ? plan.equivalentMonthly : plan.priceMonthly

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={[
        'group relative flex h-full flex-col rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-7',
        plan.highlight
          ? 'border-orange-300 shadow-orange-100/70 ring-4 ring-orange-50'
          : 'border-gray-100 hover:border-orange-100 hover:shadow-orange-100/50',
      ].join(' ')}
    >
      {plan.badge && (
        <div className="absolute right-5 top-5 rounded-full bg-[#111827] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-md">
          {plan.badge}
        </div>
      )}

      <div
        className={[
          'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
          plan.highlight
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/25'
            : 'bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white',
        ].join(' ')}
      >
        <Icon size={22} />
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-black tracking-tight text-[#111827]">
          {plan.name}
        </h2>

        <p className="mt-2 min-h-[44px] text-sm font-semibold leading-6 text-[#6b7280]">
          {plan.subtitle}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black tracking-tight text-[#111827]">
            R$ {displayPrice}
          </span>

          <span className="pb-1 text-sm font-bold text-[#6b7280]">
            /mês
          </span>
        </div>
        
        {isAnnual && (
          <div className="mt-1">
            <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-100/50">
              2 meses grátis
            </span>
            <p className="mt-1.5 text-xs font-semibold text-[#6b7280]">
              R$ {plan.priceAnnual} cobrados ao ano
            </p>
          </div>
        )}

        <p className={`text-xs font-black text-[#43A047] ${isAnnual ? 'mt-2' : 'mt-2'}`}>
          {plan.commission}
        </p>
      </div>

      <Link
        to={`/cadastro?plan=${plan.id}&cycle=${cycle}`}
        className={[
          'mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] px-5 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-95',
          plan.highlight
            ? 'bg-[#f97316] text-white shadow-xl shadow-orange-600/25 hover:bg-[#ea580c]'
            : 'bg-[#111827] text-white shadow-md hover:bg-black',
        ].join(' ')}
      >
        {plan.cta}
        <FiArrowRight size={17} />
      </Link>

      <div className="mt-7 h-px bg-gray-100" />

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-sm font-bold leading-6 text-[#374151]"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316]">
              <FiCheck size={13} />
            </span>

            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  )
}

export default function PlansPage() {
  const [billingCycle, setBillingCycle] = useState('monthly')

  return (
    <>
      <SEO
        title="Planos | PratoBy"
        description="Planos do PratoBy para vender online com loja própria, pedidos em tempo real e 0% comissão por venda."
        path="/planos"
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white">
            <div className="pointer-events-none absolute -left-28 top-20 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="mx-auto max-w-3xl text-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
                  <FiShield size={15} />
                  Planos simples e sem comissão
                </span>

                <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  Escolha o plano ideal para sua loja vender online.
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg">
                  Loja própria, pedidos em tempo real e 0% comissão por venda.
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {benefits.map((item) => {
                    const Icon = item.icon

                    return (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3.5 py-2 text-xs font-black text-[#374151] shadow-sm"
                      >
                        <Icon size={15} className="text-[#f97316]" />
                        {item.label}
                      </span>
                    )
                  })}
                </div>
              </motion.div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                  Planos
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  Comece simples. Evolua quando precisar.
                </h2>
                
                <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-[#6b7280]">
                  Todos os planos mantêm a proposta principal do PratoBy: vender
                  direto, com loja própria e sem comissão por pedido.
                </p>
              </div>

              <div className="mt-6 flex sm:mt-0">
                <AnimatedSegmentedControl
                  options={[
                    { label: 'Mensal', value: 'monthly' },
                    { 
                      label: (
                        <span className="flex items-center gap-1.5">
                          Anual
                          {billingCycle === 'annual' ? (
                            <span className="shrink-0 inline-block rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">-17%</span>
                          ) : (
                            <span className="shrink-0 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">-17%</span>
                          )}
                        </span>
                      ), 
                      value: 'annual' 
                    }
                  ]}
                  value={billingCycle}
                  onChange={(newCycle) => setBillingCycle(newCycle)}
                  size="md"
                  variant="primary"
                />
              </div>
            </motion.div>

            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan, index) => (
                <PlanCard key={plan.name} plan={plan} index={index} cycle={billingCycle} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-sm font-semibold text-[#6b7280]">
                <strong className="text-[#374151]">Nesta etapa, você pode criar sua loja e iniciar o teste grátis.</strong><br/>
                Após o período de 14 dias, você escolhe continuar no plano selecionado. A cobrança real será configurada apenas na etapa de pagamento.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55 }}
              className="mt-8 rounded-[2rem] border border-orange-100 bg-[#fff7ed] p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#111827]">
                    Não sabe qual plano escolher?
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280]">
                    Fale sobre sua loja, volume de pedidos e rotina de entrega.
                    A gente te ajuda a escolher o melhor começo.
                  </p>
                </div>

                <Link
                  to="/contato"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95"
                >
                  <FiMessageCircle size={17} />
                  Falar com consultor
                </Link>
              </div>
            </motion.div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
