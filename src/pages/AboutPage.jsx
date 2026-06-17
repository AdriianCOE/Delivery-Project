import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import MarketingLayout, { BtnCriarLoja } from '../pages/MarketingLayout'
import SEO from '../components/seo/SEO'
import { MARKETING_SEO, buildBreadcrumbJsonLd } from '../components/seo/seoConfig'
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiExternalLink,
  FiHeart,
  FiLink,
  FiLock,
  FiMapPin,
  FiMessageCircle,
  FiMonitor,
  FiPackage,
  FiPercent,
  FiShield,
  FiShoppingBag,
  FiSliders,
  FiSmartphone,
  FiTruck,
  FiZap,
} from 'react-icons/fi'

const viewportOnce = {
  once: true,
  margin: '-80px',
}

const fadeUp = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: viewportOnce,
}

const proofPoints = [
  {
    icon: FiPercent,
    label: 'Sem comissão do PratoBy',
    text: 'A assinatura não cresce conforme o pedido cresce.',
  },
  {
    icon: FiLink,
    label: 'Link próprio',
    text: 'A loja divulga a própria marca no Instagram, WhatsApp e QR Code.',
  },
  {
    icon: FiMonitor,
    label: 'Painel em tempo real',
    text: 'Pedido, status e histórico ficam centralizados para a equipe.',
  },
]

const missionCards = [
  {
    icon: FiShield,
    title: 'Mais independência para restaurantes locais',
    text: 'O PratoBy foi criado para lojas que querem vender online sem depender de vitrines que ficam entre a marca e o cliente.',
  },
  {
    icon: FiZap,
    title: 'Venda direta, sem fricção',
    text: 'A experiência pública é mobile-first: abrir o cardápio, escolher itens e finalizar o pedido precisa ser rápido.',
  },
  {
    icon: FiSliders,
    title: 'Controle simples para o lojista',
    text: 'O painel reúne cardápio, bairros, horários, cupons, pedidos e configurações sem exigir uma operação técnica.',
  },
]

const workflow = [
  {
    icon: FiSmartphone,
    title: 'Cliente acessa',
    text: 'Pelo link da loja, QR Code, Instagram ou WhatsApp.',
  },
  {
    icon: FiShoppingBag,
    title: 'Pedido nasce organizado',
    text: 'Produtos, adicionais, observações, entrega ou retirada entram no mesmo fluxo.',
  },
  {
    icon: FiClock,
    title: 'Equipe acompanha',
    text: 'O painel mostra pedidos novos e ajuda a controlar o status da operação.',
  },
  {
    icon: FiTruck,
    title: 'Loja entrega e fideliza',
    text: 'O relacionamento continua com a marca do restaurante, não com um marketplace.',
  },
]

const audiences = [
  {
    id: 'restaurante',
    label: 'Restaurante',
    icon: FiShoppingBag,
    title: 'Rotina de almoço, jantar e retirada',
    text: 'Cardápio organizado por categorias, taxas por bairro, horários de funcionamento e pedidos em tempo real.',
    items: ['Produtos e adicionais', 'Entrega ou retirada', 'Histórico de pedidos'],
  },
  {
    id: 'confeitaria',
    label: 'Confeitaria',
    icon: FiHeart,
    title: 'Encomendas, kits e datas especiais',
    text: 'Uma vitrine própria para doces, bolos, sobremesas e kits festa com comunicação direta com o cliente.',
    items: ['Fotos valorizadas', 'Observações no pedido', 'Atendimento pelo WhatsApp'],
  },
  {
    id: 'lanchonete',
    label: 'Lanchonete',
    icon: FiPackage,
    title: 'Combos, adicionais e alto giro',
    text: 'Fluxo pensado para cardápios com variações, complementos e pedidos rápidos pelo celular.',
    items: ['Combos e opcionais', 'Cupons de divulgação', 'Status operacional'],
  },
]

const trustItems = [
  {
    icon: FiLock,
    title: 'Base segura',
    text: 'Arquitetura com Firebase, autenticação, regras de acesso e rotas públicas separadas do painel.',
  },
  {
    icon: FiCreditCard,
    title: 'Venda sem comissão',
    text: 'O PratoBy não cobra percentual por pedido recebido pela loja.',
  },
  {
    icon: FiMapPin,
    title: 'Operação local',
    text: 'Bairros, taxas, horários e atendimento seguem a lógica real do estabelecimento.',
  },
]

function SectionHeader({ label, title, text, align = 'center' }) {
  const alignment = align === 'left' ? 'text-left' : 'mx-auto text-center'

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5 }}
      className={`${alignment} max-w-3xl`}
    >
      <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f97316]">
        {label}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
        {title}
      </h2>
      {text && (
        <p className="mt-4 text-base font-semibold leading-8 text-[#6b7280]">
          {text}
        </p>
      )}
    </motion.div>
  )
}

function IconTile({ icon: Icon, className = '' }) {
  return (
    <span
      className={[
        'grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] bg-orange-50 text-[#f97316] ring-1 ring-orange-100',
        className,
      ].join(' ')}
    >
      <Icon size={20} />
    </span>
  )
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-orange-100/55 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-[2rem] border border-gray-100 bg-white p-3 shadow-2xl shadow-gray-200/80">
        <div className="rounded-[1.7rem] bg-[#111827] p-4 text-white sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                Loja pública
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Capivaras Lanches
              </h2>
              <p className="mt-1 text-xs font-bold text-white/50">
                pratoby.com/capivaras-lanches
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/20">
              Aberta
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              ['Combo artesanal', 'Burger, fritas e bebida', 'R$ 42,90'],
              ['Batata rústica', 'Porção com molho da casa', 'R$ 21,90'],
              ['Refrigerante lata', '350ml gelado', 'R$ 7,00'],
            ].map(([title, subtitle, price], index) => (
              <div
                key={title}
                className={[
                  'flex items-center gap-3 rounded-[1.25rem] p-3 ring-1 ring-white/10',
                  index === 0 ? 'bg-white text-[#111827]' : 'bg-white/10 text-white',
                ].join(' ')}
              >
                <div
                  className={[
                    'grid h-12 w-12 place-items-center rounded-2xl text-lg',
                    index === 0 ? 'bg-orange-50 text-[#f97316]' : 'bg-white/10 text-orange-300',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <FiShoppingBag />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{title}</p>
                  <p className={['mt-1 truncate text-xs font-semibold', index === 0 ? 'text-gray-500' : 'text-white/55'].join(' ')}>
                    {subtitle}
                  </p>
                </div>
                <p className={['text-sm font-black', index === 0 ? 'text-[#f97316]' : 'text-orange-300'].join(' ')}>
                  {price}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ['Pedidos hoje', '18'],
            ['Ticket médio', 'R$ 47'],
            ['Comissão', '0%'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-1 text-xl font-black text-[#111827]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AudienceSwitcher() {
  const [selectedId, setSelectedId] = useState(audiences[0].id)
  const selected = audiences.find((item) => item.id === selectedId) || audiences[0]
  const SelectedIcon = selected.icon

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.55 }}
      className="mt-9 overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-gray-200/60"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-gray-100 bg-[#111827] p-5 text-white sm:p-7 lg:border-b-0 lg:border-r lg:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
            Tipos de operação
          </p>
          <div className="mt-5 grid gap-2">
            {audiences.map((item) => {
              const Icon = item.icon
              const active = item.id === selectedId

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={active}
                  className={[
                    'flex items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition',
                    active
                      ? 'border-orange-300/40 bg-white text-[#111827] shadow-lg'
                      : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={[
                        'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
                        active ? 'bg-orange-50 text-[#f97316]' : 'bg-white/10 text-orange-300',
                      ].join(' ')}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="truncate text-sm font-black">{item.label}</span>
                  </span>
                  <FiArrowRight className={active ? 'text-[#f97316]' : 'text-white/35'} size={16} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <IconTile icon={SelectedIcon} />
          <h3 className="mt-5 text-3xl font-black tracking-tight text-[#111827]">
            {selected.title}
          </h3>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280] sm:text-base">
            {selected.text}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {selected.items.map((item) => (
              <div key={item} className="rounded-[1.25rem] border border-gray-100 bg-[#f9fafb] p-4">
                <FiCheckCircle size={18} className="text-[#f97316]" />
                <p className="mt-3 text-sm font-black leading-5 text-[#111827]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function AboutPage() {
  return (
    <>
      <SEO
        {...MARKETING_SEO.about}
        structuredData={buildBreadcrumbJsonLd([{ name: 'Início', path: '/' }, { name: 'Sobre', path: '/sobre' }])}
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#f9fafb]" />
            <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_470px] lg:gap-16">
                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.58 }}
                  className="text-center lg:text-left"
                >
                  <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-[#111827] sm:text-6xl lg:mx-0 lg:text-7xl">
                    Sobre o PratoBy
                    <span className="block text-[#f97316]">delivery próprio para vender direto.</span>
                  </h1>

                  <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg lg:mx-0">
                    O PratoBy é uma plataforma white-label para restaurantes, confeitarias,
                    lanchonetes e operações locais criarem cardápio digital, receberem pedidos
                    online e manterem o relacionamento com seus próprios clientes.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                    <BtnCriarLoja className="w-full sm:w-auto" />
                    <Link
                      to="/exemplos"
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-6 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:text-[#f97316] active:scale-95 sm:w-auto"
                    >
                      Ver lojas exemplo
                      <FiExternalLink size={16} />
                    </Link>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {proofPoints.map((item) => {
                      const Icon = item.icon

                      return (
                        <div
                          key={item.label}
                          className="rounded-[1.35rem] border border-gray-100 bg-white p-4 text-left shadow-sm"
                        >
                          <Icon size={18} className="text-[#f97316]" />
                          <p className="mt-3 text-sm font-black text-[#111827]">{item.label}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">{item.text}</p>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 26 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                >
                  <ProductPreview />
                </motion.div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeader
              label="Por que existe"
              title="Para o lojista vender online sem perder controle."
              text="A proposta é reduzir dependência de marketplaces, simplificar a operação e deixar a marca da loja no centro da experiência."
            />

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {missionCards.map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.article
                    key={item.title}
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: index * 0.07 }}
                    className="rounded-[1.65rem] border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-orange-100/40"
                  >
                    <IconTile icon={Icon} />
                    <h3 className="mt-5 text-lg font-black text-[#111827]">{item.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-7 text-[#6b7280]">{item.text}</p>
                  </motion.article>
                )
              })}
            </div>
          </section>

          <section className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
              <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
                <SectionHeader
                  align="left"
                  label="Como funciona"
                  title="Um fluxo direto entre cliente, loja e equipe."
                  text="A loja publica o cardápio, o cliente faz o pedido pelo celular e a equipe acompanha tudo no painel."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  {workflow.map((item, index) => {
                    const Icon = item.icon

                    return (
                      <motion.article
                        key={item.title}
                        {...fadeUp}
                        transition={{ duration: 0.45, delay: index * 0.06 }}
                        className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-5"
                      >
                        <div className="flex items-center gap-3">
                          <IconTile icon={Icon} className="h-10 w-10 rounded-2xl" />
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                            0{index + 1}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-black text-[#111827]">{item.title}</h3>
                        <p className="mt-2 text-sm font-semibold leading-7 text-[#6b7280]">{item.text}</p>
                      </motion.article>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeader
              label="Para várias rotinas"
              title="A mesma base, ajustada ao tipo de loja."
              text="O PratoBy funciona para operações de pedido imediato, retirada, entrega local e vendas com atendimento pelo WhatsApp."
            />
            <AudienceSwitcher />
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.55 }}
              className="overflow-hidden rounded-[2rem] border border-gray-100 bg-[#111827] text-white shadow-2xl shadow-gray-300/60"
            >
              <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
                <div className="p-7 sm:p-9 lg:p-10">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                    Confiança e continuidade
                  </p>
                  <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                    Produto em evolução para operação real.
                  </h2>
                  <p className="mt-4 text-sm font-semibold leading-7 text-white/60 sm:text-base">
                    A plataforma junta experiência pública, painel do lojista, regras de produto,
                    pedidos e configurações em um sistema pensado para uso diário.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/planos"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-white px-6 text-sm font-black text-[#111827] transition hover:-translate-y-0.5 hover:bg-orange-50 active:scale-95"
                    >
                      Ver planos
                      <FiArrowRight size={17} />
                    </Link>
                    <Link
                      to="/contato"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-white/5 px-6 text-sm font-black text-white/85 transition hover:-translate-y-0.5 hover:bg-white/10 active:scale-95"
                    >
                      Falar com o PratoBy
                      <FiMessageCircle size={17} />
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-white/10 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
                  {trustItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <div key={item.title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5">
                        <div className="flex items-start gap-4">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] bg-white/10 text-orange-300">
                            <Icon size={20} />
                          </span>
                          <div>
                            <h3 className="text-base font-black text-white">{item.title}</h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-white/58">{item.text}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.55 }}
              className="relative overflow-hidden rounded-[2rem] bg-[#f97316] p-7 text-white shadow-2xl shadow-orange-600/20 sm:p-10 lg:p-12"
            >
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
                    Próximo passo
                  </p>
                  <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                    Quer entender como o PratoBy ficaria na sua loja?
                  </h2>
                  <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/82 sm:text-base">
                    Conte sua rotina de pedidos, entrega, retirada e cardápio. A gente ajuda a escolher o melhor começo.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <BtnCriarLoja className="bg-white text-[#111827] shadow-xl hover:bg-orange-50" />
                  <Link
                    to="/contato"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] border border-white/25 bg-white/10 px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-95"
                  >
                    Conversar agora
                    <FiMessageCircle size={17} />
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
