import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import MarketingLayout from '../pages/MarketingLayout'
import SEO from '../components/seo/SEO'
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiExternalLink,
  FiGrid,
  FiLink,
  FiMessageCircle,
  FiMonitor,
  FiPackage,
  FiShield,
  FiShoppingBag,
  FiSliders,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi'

const PRINCIPLES = [
  {
    icon: FiTrendingUp,
    title: 'Menos comissão',
    text: 'A loja vende direto pelo próprio link, sem taxa em cima de cada pedido.',
  },
  {
    icon: FiLink,
    title: 'Marca própria',
    text: 'O cliente acessa uma loja com identidade do estabelecimento, não uma vitrine genérica.',
  },
  {
    icon: FiMonitor,
    title: 'Operação clara',
    text: 'Pedidos, status, pagamento e atendimento ficam organizados no painel do lojista.',
  },
]

const FEATURES = [
  {
    icon: FiShoppingBag,
    title: 'Loja online própria',
    text: 'Um link simples para divulgar no Instagram, WhatsApp, bio ou QR Code.',
  },
  {
    icon: FiPackage,
    title: 'Cardápio completo',
    text: 'Produtos, categorias, adicionais, observações e opções do jeito que a loja vende.',
  },
  {
    icon: FiClock,
    title: 'Pedidos em tempo real',
    text: 'O lojista recebe o pedido no painel e acompanha o andamento da operação.',
  },
  {
    icon: FiSliders,
    title: 'Controle do lojista',
    text: 'Horários, taxas, cupons, bairros e status da loja em uma central simples.',
  },
  {
    icon: FiShield,
    title: 'Histórico confiável',
    text: 'O pedido mantém os dados da venda salvos para consulta e organização.',
  },
  {
    icon: FiZap,
    title: 'Experiência rápida',
    text: 'Mobile-first para o cliente comprar sem fricção direto pelo celular.',
  },
]

const AUDIENCES = [
  'Restaurantes',
  'Lanchonetes',
  'Pizzarias',
  'Hamburguerias',
  'Açaíterias',
  'Cafeterias',
  'Docerias',
  'Marmitarias',
]

const viewportOnce = {
  once: true,
  margin: '-80px',
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: viewportOnce,
}

const fadeLeft = {
  initial: { opacity: 0, x: -28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: viewportOnce,
}

const fadeRight = {
  initial: { opacity: 0, x: 28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: viewportOnce,
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316]">
      {children}
    </span>
  )
}

function FeatureCard({ item, index = 0 }) {
  const Icon = item.icon

  return (
    <motion.article
      {...fadeUp}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      className="group rounded-[1.65rem] border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-orange-100/50"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition group-hover:bg-[#f97316] group-hover:text-white">
        <Icon size={20} />
      </div>

      <h3 className="mt-4 text-base font-black text-[#111827]">
        {item.title}
      </h3>

      <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
        {item.text}
      </p>
    </motion.article>
  )
}

export default function AboutPage() {
  return (
    <>
      <SEO
        title="Sobre o PratoBy | Cardápio digital para restaurantes"
        description="Conheça o PratoBy, uma plataforma para restaurantes, lanchonetes e confeitarias venderem online com cardápio digital, pedidos e delivery próprio."
        path="/sobre"
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative bg-white">
            <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-gray-100 blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <motion.div
                {...fadeLeft}
                transition={{ duration: 0.6 }}
              >
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                    <FiCompass size={15} />
                    Sobre o PratoBy
                  </div>

                  <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                    Delivery próprio para quem quer vender direto.
                  </h1>

                  <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg">
                    O PratoBy ajuda lojas locais a criarem uma experiência de pedido
                    online simples, bonita e sem comissão do PratoBy por pedido.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge>Sem comissão do PratoBy</Badge>
                    <Badge>Link próprio</Badge>
                    <Badge>Pedidos em tempo real</Badge>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/contato"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95"
                    >
                      Falar sobre minha loja
                      <FiMessageCircle size={17} />
                    </Link>

                    <Link
                      to="/exemplos"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-6 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] active:scale-95"
                    >
                      Ver exemplos
                      <FiExternalLink size={16} />
                    </Link>
                  </div>
                </motion.div>

                <motion.div
                    {...fadeRight}
                    transition={{ duration: 0.65, delay: 0.1 }}
                    className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200/80"
                  >
                  <div className="rounded-[1.7rem] bg-[#111827] p-5 text-white sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-orange-300">
                          Central do lojista
                        </p>
                        <h2 className="mt-2 text-2xl font-black">
                          Operação simples, pedido organizado.
                        </h2>
                      </div>

                      <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/20">
                        Loja aberta
                      </span>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">Pedido #2847</p>
                            <p className="mt-1 text-xs font-semibold text-white/55">
                              2x Combo Capivara · Pix manual
                            </p>
                          </div>

                          <p className="text-sm font-black text-orange-300">
                            R$ 89,80
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {['Novo', 'Preparo', 'Entrega'].map((item, index) => (
                            <span
                              key={item}
                              className={`rounded-full px-3 py-1 text-[11px] font-black ${
                                index === 0
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                          <p className="text-xs font-bold text-white/50">
                            Hoje
                          </p>
                          <p className="mt-1 text-xl font-black">18 pedidos</p>
                        </div>

                        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                          <p className="text-xs font-bold text-white/50">
                            Faturamento
                          </p>
                          <p className="mt-1 text-xl font-black">R$ 847</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Cliente compra', FiShoppingBag],
                      ['Painel recebe', FiMonitor],
                      ['Loja entrega', FiCheckCircle],
                    ].map(([label, Icon]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 text-center"
                      >
                        <Icon className="mx-auto text-[#f97316]" size={19} />
                        <p className="mt-2 text-xs font-black text-[#111827]">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          <section className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <motion.div
  {...fadeUp}
  transition={{ duration: 0.55 }}
  className="mx-auto mb-8 max-w-3xl text-center"
>
              <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                Por que existe
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                Para dar mais controle ao lojista.
              </h2>

              <p className="mt-4 text-base font-semibold leading-8 text-[#6b7280]">
                A proposta é simples: sua loja, seus clientes, seus pedidos e sua marca.
              </p>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-3">
                        {PRINCIPLES.map((item, index) => (
              <FeatureCard key={item.title} item={item} index={index} />
            ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
          <motion.div
  {...fadeUp}
  transition={{ duration: 0.6 }}
  className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-gray-200/60"
>
              <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-[#111827] p-7 text-white sm:p-9 lg:p-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                    <FiGrid size={23} />
                  </div>

                  <h2 className="mt-6 text-3xl font-black tracking-tight">
                    Não é só um cardápio bonito.
                  </h2>

                  <p className="mt-4 text-sm font-semibold leading-7 text-white/60">
                    É uma base para o lojista vender online com mais organização:
                    cardápio, pedido, status, atendimento e histórico no mesmo fluxo.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {AUDIENCES.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:p-8">
                {FEATURES.map((item, index) => (
  <FeatureCard key={item.title} item={item} index={index} />
))}
                </div>
              </div>
            </motion.div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <motion.div
  {...fadeUp}
  transition={{ duration: 0.6 }}
  className="relative overflow-hidden rounded-[2rem] bg-[#f97316] p-7 text-white shadow-2xl shadow-orange-600/20 sm:p-10 lg:p-12"
>
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />

              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/70">
                    Próximo passo
                  </p>

                  <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                    Quer ver como ficaria para sua loja?
                  </h2>

                  <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/80 sm:text-base">
                    Fale sobre seu cardápio, bairros de entrega e rotina de pedidos.
                    A gente te ajuda a entender o melhor formato.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    to="/contato"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-white px-6 text-sm font-black text-[#111827] shadow-xl transition hover:-translate-y-0.5 hover:bg-orange-50 active:scale-95"
                  >
                    Entrar em contato
                    <FiMessageCircle size={17} />
                  </Link>

                  <Link
                    to="/planos"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] border border-white/25 bg-white/10 px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-95"
                  >
                    Ver planos
                    <FiArrowRight size={17} />
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