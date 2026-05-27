import { useEffect, useState } from 'react'
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
  FiShield,
  FiShoppingBag,
  FiTrendingUp,
  FiUsers,
  FiMinus,
  FiMonitor,
} from 'react-icons/fi'
import AnimatedSegmentedControl from '../components/ui/AnimatedSegmentedControl'

const planShortDescriptions = {
  essential: 'Para começar com loja própria, cardápio online e pedidos organizados.',
  professional: 'Para lojas que querem vender mais com cupons, alertas e uma operação mais completa.',
  premium: 'Para operações maiores que precisam de marca forte, suporte próximo e mais controle.',
}

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

const planLabels = {
  essential: 'Essencial',
  professional: 'Professional',
  premium: 'Premium',
}

const planOptionsForComparison = [
  { label: 'Essencial', value: 'essential' },
  { label: 'Professional', value: 'professional' },
  { label: 'Premium', value: 'premium' },
]


const planFeatures = [
  {
    category: 'Cardápio e vendas',
    icon: FiShoppingBag,
    items: [
      {
        name: 'Produtos e categorias',
        essential: 'Ilimitado',
        professional: 'Ilimitado',
        premium: 'Ilimitado',
      },
      {
        name: 'Fotos por produto',
        essential: '1 foto',
        professional: 'Até 4 fotos',
        premium: 'Até 10 fotos',
      },
      {
        name: 'Opções, adicionais e observações',
        essential: true,
        professional: true,
        premium: true,
      },
      {
        name: '0% comissão por pedido',
        essential: true,
        professional: true,
        premium: true,
      },
      {
        name: 'Horários de funcionamento',
        essential: true,
        professional: true,
        premium: true,
      },
    ],
  },
  {
    category: 'Gestão e marketing',
    icon: FiTrendingUp,
    items: [
      {
        name: 'Painel em tempo real',
        essential: true,
        professional: true,
        premium: true,
      },
      {
        name: 'Cupons de desconto',
        essential: false,
        professional: true,
        premium: true,
      },
      {
        name: 'Banners promocionais',
        essential: false,
        professional: true,
        premium: true,
      },
      {
        name: 'Relatórios de vendas',
        essential: 'Básicos',
        professional: 'Avançados',
        premium: 'Completos',
      },
      {
        name: 'Campos personalizados',
        essential: false,
        professional: true,
        premium: true,
      },
    ],
  },
  {
    category: 'Operação e suporte',
    icon: FiMonitor,
    items: [
      {
        name: 'Taxa de entrega',
        essential: 'Fixa',
        professional: 'Por bairro/raio',
        premium: 'Avançada',
      },
      {
        name: 'WhatsApp para atendimento',
        essential: 'Botão de conversa',
        professional: 'Alertas e mensagens',
        premium: 'Fluxos avançados',
      },
      {
        name: 'Multi-loja',
        essential: false,
        professional: false,
        premium: 'Até 3 unidades',
      },
      {
        name: 'Domínio personalizado',
        essential: false,
        professional: false,
        premium: true,
      },
      {
        name: 'Suporte',
        essential: 'E-mail',
        professional: 'WhatsApp prioritário',
        premium: 'Acompanhamento próximo',
      },
    ],
  },
]

function FeatureValue({ value, highlight = false }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span
        className={[
          'inline-flex h-7 w-7 items-center justify-center rounded-full',
          highlight ? 'bg-orange-100 text-[#f97316]' : 'bg-emerald-50 text-emerald-600',
        ].join(' ')}
      >
        <FiCheck size={16} className="stroke-[3]" />
      </span>
    ) : (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 text-gray-300">
        <FiMinus size={16} className="stroke-[3]" />
      </span>
    )
  }

  return (
    <span
      className={[
        'text-center text-xs font-black leading-5 sm:text-sm',
        highlight ? 'text-[#ea580c]' : 'text-gray-600',
      ].join(' ')}
    >
      {value}
    </span>
  )
}

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
        'group relative flex h-full flex-col rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:bg-zinc-900 sm:p-7',
        plan.highlight
          ? 'border-orange-300 shadow-orange-100/70 ring-4 ring-orange-50 dark:border-orange-500/70 dark:shadow-orange-950/20 dark:ring-orange-500/10'
          : 'border-gray-100 hover:border-orange-100 hover:shadow-orange-100/50 dark:border-zinc-800 dark:hover:border-orange-500/50',
      ].join(' ')}
    >
      {plan.badge && (
        <div className="absolute right-5 top-5 rounded-full bg-[#111827] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-md dark:bg-white dark:text-zinc-950">
          {plan.badge}
        </div>
      )}

      <div
        className={[
          'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
          plan.highlight
            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/25'
            : 'bg-orange-50 text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white dark:bg-orange-500/10',
        ].join(' ')}
      >
        <Icon size={22} />
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-black tracking-tight text-[#111827] dark:text-white">
          {plan.name}
        </h2>

        <p className="mt-2 min-h-[44px] text-sm font-semibold leading-6 text-[#6b7280] dark:text-zinc-400">
          {plan.subtitle}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black tracking-tight text-[#111827] dark:text-white">
            R$ {displayPrice}
          </span>

          <span className="pb-1 text-sm font-bold text-[#6b7280] dark:text-zinc-400">
            /mês
          </span>
        </div>

        {isAnnual && (
          <div className="mt-1">
            <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-100/50 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20">
              2 meses grátis
            </span>
            <p className="mt-1.5 text-xs font-semibold text-[#6b7280] dark:text-zinc-400">
              R$ {plan.priceAnnual} cobrados ao ano
            </p>
          </div>
        )}

        <p className="mt-2 text-xs font-black text-[#43A047] dark:text-emerald-400">
          {plan.commission}
        </p>
      </div>

      <Link
        to={`/cadastro?plan=${plan.id}&cycle=${cycle}`}
        className={[
          'mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] px-5 text-sm font-black transition-all duration-300 hover:-translate-y-0.5 active:scale-95',
          plan.highlight
            ? 'bg-[#f97316] text-white shadow-xl shadow-orange-600/25 hover:bg-[#ea580c]'
            : 'bg-[#111827] text-white shadow-md hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-orange-50',
        ].join(' ')}
      >
        {plan.cta}
        <FiArrowRight size={17} />
      </Link>

      <div className="mt-7 h-px bg-gray-100 dark:bg-zinc-800" />

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-sm font-bold leading-6 text-[#374151] dark:text-zinc-200"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316] dark:bg-orange-500/10">
              <FiCheck size={13} />
            </span>

            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  )
}


function PlanComparisonSection({ selectedMobilePlan, setSelectedMobilePlan, scrollToPlans }) {
  return (
    <motion.section
      id="comparacao"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55 }}
      className="mt-16 border-t border-gray-100 pt-16 dark:border-zinc-800 md:mt-24"
    >
      <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
          Recursos em detalhe
        </span>
        <h3 className="text-2xl font-black tracking-tight text-[#111827] dark:text-white md:text-3xl lg:text-4xl">
          Compare os planos PratoBy
        </h3>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400 md:text-base">
          Comece no plano certo para sua rotina. Depois, evolua quando sua operação pedir mais marketing, automação ou suporte.
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-gray-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20 lg:block">
        <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] border-b border-gray-100 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-950/70">
          <div className="p-6 text-xs font-black uppercase tracking-widest text-gray-400">Recurso</div>
          {planOptionsForComparison.map((plan) => {
  const isRecommended = plan.value === 'professional'

  return (
    <div
      key={plan.value}
      className={[
        'relative p-6 text-center',
        isRecommended ? 'bg-orange-50/80 dark:bg-orange-500/10' : '',
      ].join(' ')}
    >
      {isRecommended ? (
        <span className="mb-3 inline-flex rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-orange-600/20">
          Recomendado
        </span>
      ) : (
        <span className="mb-3 inline-flex h-[24px]" aria-hidden="true" />
      )}

      <p
        className={[
          'text-lg font-black',
          isRecommended ? 'text-[#f97316]' : 'text-[#111827] dark:text-white',
        ].join(' ')}
      >
        {plan.label}
      </p>

      <p className="mx-auto mt-2 max-w-[180px] text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
        {planShortDescriptions[plan.value]}
      </p>
    </div>
  )
})}
</div>

{planFeatures.map((category) => {
          const Icon = category.icon

          return (
            <div key={category.category}>
              <div className="flex items-center gap-3 border-y border-gray-100 bg-gray-50/70 px-6 py-4 text-xs font-black uppercase tracking-widest text-[#111827] dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200">
                <Icon size={15} className="text-[#f97316]" />
                {category.category}
              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {category.items.map((item) => (
                  <div key={item.name} className="grid grid-cols-[1.25fr_1fr_1fr_1fr] transition-colors hover:bg-orange-50/20 dark:hover:bg-orange-500/5">
                    <div className="flex items-center px-6 py-4 text-sm font-bold text-gray-700 dark:text-zinc-200">
                      {item.name}
                    </div>
                    {planOptionsForComparison.map((plan) => (
                      <div
                        key={plan.value}
                        className={[
                          'flex items-center justify-center px-5 py-4',
                          plan.value === 'professional' ? 'bg-orange-50/70 dark:bg-orange-500/10' : '',
                        ].join(' ')}
                      >
                        <FeatureValue value={item[plan.value]} highlight={plan.value === 'professional'} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] items-center border-t border-gray-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-bold text-gray-500 dark:text-zinc-400">Quer começar agora?</div>
          {planOptionsForComparison.map((plan) => (
            <div key={plan.value} className={['flex justify-center', plan.value === 'professional' ? 'rounded-2xl bg-orange-50 py-3 dark:bg-orange-500/10' : ''].join(' ')}>
              <button
                type="button"
                onClick={scrollToPlans}
                className={[
                  'rounded-full px-5 py-2.5 text-xs font-black transition-all hover:-translate-y-0.5 active:scale-95',
                  plan.value === 'professional'
                    ? 'bg-[#f97316] text-white shadow-xl shadow-orange-600/20 hover:bg-[#ea580c]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
                ].join(' ')}
              >
                Ver {plan.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:hidden">
        <AnimatedSegmentedControl
          options={planOptionsForComparison}
          value={selectedMobilePlan}
          onChange={setSelectedMobilePlan}
          size="md"
          variant="primary"
        />

        <div className="mt-5 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-xl shadow-gray-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <div className="rounded-[1.5rem] bg-orange-50 p-5 dark:bg-orange-500/10">
            <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">Plano selecionado</p>
            <h4 className="mt-2 text-2xl font-black text-[#111827] dark:text-white">
              {planLabels[selectedMobilePlan]}
            </h4>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280] dark:text-zinc-400">
              {planShortDescriptions[selectedMobilePlan]}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {planFeatures.map((category) => {
              const Icon = category.icon

              return (
                <div key={category.category} className="rounded-[1.5rem] border border-gray-100 p-4 dark:border-zinc-800">
                  <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#111827] dark:text-white">
                    <Icon size={15} className="text-[#f97316]" />
                    {category.category}
                  </h5>

                  <div className="mt-4 space-y-3">
                    {category.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-zinc-950/70">
                        <span className="text-sm font-bold leading-5 text-gray-700 dark:text-zinc-200">{item.name}</span>
                        <FeatureValue value={item[selectedMobilePlan]} highlight />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={scrollToPlans}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition-all hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95"
          >
            Escolher {planLabels[selectedMobilePlan]}
            <FiArrowRight size={17} />
          </button>
        </div>
      </div>
    </motion.section>
  )
}

export default function PlansPage() {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [selectedMobilePlan, setSelectedMobilePlan] = useState('professional')

  useEffect(() => {
    if (window.location.hash !== '#comparacao') return

    const timer = window.setTimeout(() => {
      const element = document.getElementById('comparacao')
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [])

  const scrollToPlans = () => {
    const element = document.getElementById('pricing-plans')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <SEO
        title="Planos | PratoBy"
        description="Planos do PratoBy para vender online com loja própria, pedidos em tempo real e 0% comissão por venda."
        path="/planos"
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827] dark:bg-zinc-950 dark:text-zinc-100">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="pointer-events-none absolute -left-28 top-20 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl dark:bg-orange-500/10" />
            <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl dark:bg-amber-500/10" />

            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="mx-auto max-w-3xl text-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
                  <FiShield size={15} />
                  Planos simples e sem comissão
                </span>

                <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827] dark:text-white sm:text-5xl lg:text-6xl">
                  Escolha o plano ideal para sua loja vender online.
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] dark:text-zinc-400 sm:text-lg">
                  Loja própria, pedidos em tempo real e 0% comissão por venda. Comece com 14 dias grátis e evolua quando sua operação pedir mais recursos.
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {benefits.map((item) => {
                    const Icon = item.icon

                    return (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3.5 py-2 text-xs font-black text-[#374151] shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
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

          <section id="pricing-plans" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
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

                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827] dark:text-white sm:text-4xl">
                  Comece simples. Evolua quando precisar.
                </h2>

                <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-[#6b7280] dark:text-zinc-400">
                  Todos os planos mantêm a proposta principal do PratoBy: vender direto, com loja própria e sem comissão por pedido.
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
                            <span className="inline-block shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">-17%</span>
                          ) : (
                            <span className="inline-block shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">-17%</span>
                          )}
                        </span>
                      ),
                      value: 'annual',
                    },
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

            <div className="mt-10 rounded-[1.5rem] border border-gray-100 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold leading-7 text-[#6b7280] dark:text-zinc-400">
                <strong className="text-[#374151] dark:text-zinc-100">Nesta etapa, você pode criar sua loja e iniciar o teste grátis.</strong>
                <br />
                Após 14 dias, você escolhe continuar no plano selecionado. A cobrança real só é configurada na etapa de pagamento.
              </p>
            </div>

            <PlanComparisonSection
              selectedMobilePlan={selectedMobilePlan}
              setSelectedMobilePlan={setSelectedMobilePlan}
              scrollToPlans={scrollToPlans}
            />

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55 }}
              className="mt-10 overflow-hidden rounded-[2rem] border border-orange-100 bg-[#fff7ed] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10"
            >
              <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
                <div className="p-6 sm:p-8">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:bg-zinc-950">
                    <FiUsers size={14} />
                    Ajuda na escolha
                  </span>
                  <h3 className="mt-4 text-2xl font-black text-[#111827] dark:text-white">
                    Não sabe qual plano escolher?
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280] dark:text-zinc-400">
                    Fale sobre sua loja, volume de pedidos e rotina de entrega. A gente te ajuda a escolher o melhor começo, sem empurrar recurso que você ainda não precisa.
                  </p>
                </div>

                <div className="flex items-center border-t border-orange-100/70 p-6 dark:border-orange-500/20 sm:p-8 lg:border-l lg:border-t-0">
                  <Link
                    to="/contato"
                    className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95 lg:w-auto"
                  >
                    <FiMessageCircle size={17} />
                    Falar com consultor
                  </Link>
                </div>
              </div>
            </motion.div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
