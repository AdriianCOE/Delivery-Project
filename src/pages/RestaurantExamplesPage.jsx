import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import SEO from '../components/seo/SEO'
import { MARKETING_SEO, buildBreadcrumbJsonLd } from '../components/seo/seoConfig'
import MarketingLayout from '../pages/MarketingLayout'
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiExternalLink,
  FiGift,
  FiMapPin,
  FiMessageCircle,
  FiShoppingBag,
  FiStar,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi'

const examples = [
  {
    name: 'Capivaras Lanches',
    type: 'Lanchonete / fast-food',
    emoji: '🍔',
    description:
      'Uma loja demo para operação rápida: combos, adicionais, entrega, retirada e acompanhamento do pedido em tempo real.',
    items: ['Capivara Burger', 'Combo Família', 'Batata Rústica'],
    features: ['Combos', 'Adicionais', 'Entrega e retirada', 'Status do pedido'],
    averageTicket: 'R$ 39,90',
    deliveryTime: '30-45 min',
    slug: '/capivaras-lanches',
    badge: 'Demo de lanchonete',
    highlight: 'Pedidos rápidos',
    gradient: 'from-orange-500 via-amber-500 to-yellow-400',
    softGradient: 'from-orange-50 via-amber-50 to-white',
  },
  {
    name: 'Doce Capivara Confeitaria',
    type: 'Confeitaria',
    emoji: '🧁',
    description:
      'Um exemplo pensado para bolos, doces, sobremesas e kits festa, com foco em encomendas agendadas e atendimento organizado.',
    items: ['Bolo de Chocolate', 'Kit Festa 20 pessoas', 'Brownie Gourmet'],
    features: ['Agendamento', 'Pix antecipado', 'Kits festa', 'Encomendas'],
    averageTicket: 'R$ 89,90',
    deliveryTime: 'Sob encomenda',
    slug: '/doce-capivara-confeitaria',
    badge: 'Demo de confeitaria',
    highlight: 'Encomendas agendadas',
    gradient: 'from-[#D9773F] via-[#F4A6A6] to-[#FFF4E6]',
    softGradient: 'from-[#fff4e6] via-[#fff8f1] to-white',
  },
]

const benefits = [
  'Loja pública com link próprio',
  'Pedido organizado no painel',
  'Sem comissão do PratoBy por pedido',
  'Visual pronto para mobile',
]

const steps = [
  {
    icon: FiShoppingBag,
    title: 'Veja a experiência do cliente',
    description:
      'Abra as lojas demo como se fosse comprar e veja categorias, produtos, adicionais, carrinho e status do pedido.',
  },
  {
    icon: FiGift,
    title: 'Compare dois tipos de operação',
    description:
      'Capivaras Lanches mostra pedidos rápidos. Doce Capivara mostra encomendas e produtos mais planejados.',
  },
  {
    icon: FiTrendingUp,
    title: 'Imagine sua loja no mesmo formato',
    description:
      'Depois é só trocar nome, logo, cores, produtos, horários, taxas, pagamentos e regras de atendimento.',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
}

function PreviewItem({ item, index }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100/70"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xs font-black text-[#f97316]">
          {index + 1}
        </span>

        <p className="truncate text-sm font-black text-[#111827]">{item}</p>
      </div>

      <span className="shrink-0 text-xs font-black text-[#f97316]">Ver</span>
    </motion.div>
  )
}

function ExampleCard({ example, index }) {
  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.22 }}
      variants={fadeUp}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-[2.25rem] border border-gray-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_90px_rgba(249,115,22,0.16)]"
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${example.gradient}`} />

      <div className={`relative overflow-hidden bg-gradient-to-br ${example.softGradient} p-6 sm:p-8`}>
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/70 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-orange-200/30 blur-3xl" />

        <div className="relative flex items-start justify-between gap-5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm backdrop-blur">
              <FiShoppingBag size={13} />
              {example.type}
            </span>

            <h2 className="mt-5 text-2xl font-black tracking-tight text-[#111827] sm:text-3xl">
              {example.name}
            </h2>

            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#4b5563]">
              {example.description}
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm ring-1 ring-gray-100 transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20 sm:text-5xl">
            {example.emoji}
          </div>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          transition={{ staggerChildren: 0.06, delayChildren: 0.06 }}
          className="relative mt-7 rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-inner backdrop-blur"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                Prévia da loja
              </p>
              <p className="mt-1 text-sm font-black text-[#111827]">
                {example.badge}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#16a34a] shadow-sm ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
              Aberto
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {example.items.map((item, itemIndex) => (
              <PreviewItem key={item} item={item} index={itemIndex} />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
              <FiStar className="text-[#f97316]" />
              Ticket médio
            </div>

            <p className="mt-2 text-xl font-black text-[#111827]">
              {example.averageTicket}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
              <FiClock className="text-[#f97316]" />
              Atendimento
            </div>

            <p className="mt-2 text-xl font-black text-[#111827]">
              {example.deliveryTime}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-black text-[#111827]">
            O que esse exemplo demonstra
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {example.features.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-xs font-black text-[#4b5563] shadow-sm"
              >
                <FiCheck className="text-[#f97316]" size={13} />
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={example.slug}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#111827] px-6 py-4 text-sm font-black text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-black"
          >
            Abrir exemplo
            <FiExternalLink size={17} />
          </Link>

          <Link
            to="/contato"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-4 text-sm font-black text-[#111827] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
          >
            Quero uma parecida
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

function StepCard({ step, index }) {
  const Icon = step.icon

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.32 }}
      variants={fadeUp}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-lg font-black text-[#111827]">{step.title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
        {step.description}
      </p>
    </motion.div>
  )
}

export default function RestaurantExamplesPage() {
  return (
    <>
      <SEO
        {...MARKETING_SEO.examples}
        structuredData={buildBreadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Exemplos', path: '/exemplos' }])}
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white py-14 sm:py-20">
            <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-amber-100/80 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="mx-auto max-w-4xl text-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-black text-[#f97316] shadow-sm">
                  <FiZap />
                  Exemplos oficiais do PratoBy
                </span>

                <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  Veja duas lojas prontas funcionando na prática.
                </h1>

                <p className="mx-auto mt-6 max-w-3xl text-lg font-medium leading-8 text-[#4b5563]">
                  Use a Capivaras Lanches para entender uma operação rápida de delivery e a Doce Capivara Confeitaria para ver encomendas, kits festa e produtos agendados.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {benefits.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-[#f9fafb] px-4 py-2 text-sm font-bold text-[#111827] shadow-sm"
                    >
                      <FiCheck className="text-[#f97316]" size={16} />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    href="#exemplos"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                  >
                    Ver exemplos
                    <FiArrowRight size={18} />
                  </a>

                  <Link
                    to="/contato"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-sm font-black text-[#111827] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
                  >
                    Quero uma loja assim
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          <section className="relative py-12 sm:py-16">
            <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
              {steps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index} />
              ))}
            </div>
          </section>

          <section id="exemplos" className="relative pb-16 sm:pb-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                className="mb-8 flex flex-col gap-4 sm:mb-10 lg:flex-row lg:items-end lg:justify-between"
              >
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f97316]">
                    Lojas demo
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                    Escolha um exemplo para abrir.
                  </h2>
                </div>

                <p className="max-w-xl text-sm font-semibold leading-6 text-[#6b7280]">
                  Os exemplos mostram como o PratoBy se adapta a operações diferentes, sem precisar virar marketplace e sem comissão do PratoBy por pedido.
                </p>
              </motion.div>

              <div className="grid gap-6 lg:grid-cols-2">
                {examples.map((example, index) => (
                  <ExampleCard key={example.name} example={example} index={index} />
                ))}
              </div>
            </div>
          </section>

          <section className="border-y border-gray-100 bg-white py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.32 }}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="overflow-hidden rounded-[2.5rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10"
              >
                <div className="relative">
                  <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-orange-200/50 blur-3xl" />

                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black text-[#f97316]">
                        <FiMapPin />
                        Seu negócio também pode ter um link próprio
                      </div>

                      <h3 className="mt-3 text-2xl font-black text-[#111827] sm:text-3xl">
                        Exemplo: pratoby.com/sua-loja
                      </h3>

                      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#4b5563]">
                        Divulgue o link no Instagram, WhatsApp, Google Business, bio, panfleto, cartão de visita ou QR Code. O cliente acessa, escolhe os produtos e envia o pedido organizado.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        to="/planos"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-8 py-4 text-sm font-black text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-black"
                      >
                        Ver planos
                        <FiArrowRight size={18} />
                      </Link>

                      <Link
                        to="/contato"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                      >
                        <FiMessageCircle size={18} />
                        Falar comigo
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}

