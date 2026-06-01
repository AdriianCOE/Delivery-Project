import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../components/seo/SEO'
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiMapPin,
  FiMessageCircle,
  FiShoppingBag,
  FiStar,
  FiZap,
  FiMenu,
  FiX
} from 'react-icons/fi'

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

const examples = [
  {
    name: 'Pizzaria Bella Massa',
    type: 'Pizzaria',
    emoji: '🍕',
    description:
      'Modelo ideal para pizzarias com tamanhos, sabores, bordas recheadas, adicionais e promoções.',
    items: ['Pizza Calabresa', 'Meio a Meio', 'Borda Recheada'],
    features: ['Tamanhos', 'Sabores', 'Bordas', 'Combos'],
    averageTicket: 'R$ 58,90',
    deliveryTime: '35-50 min',
    slug: '/la-bella-pizza',
    badge: 'Demo ativa',
  },
  {
    name: 'Burger Prime',
    type: 'Hamburgueria',
    emoji: '🍔',
    description:
      'Perfeito para hambúrgueres artesanais com adicionais, combos, molhos e opções extras.',
    items: ['Smash Duplo', 'Combo Bacon', 'Batata Cheddar'],
    features: ['Adicionais', 'Combos', 'Molhos', 'Bebidas'],
    averageTicket: 'R$ 42,90',
    deliveryTime: '25-40 min',
    slug: '/exemplos',
    badge: 'Modelo',
  },
  {
    name: 'Açaí Tropical',
    type: 'Açaiteria',
    emoji: '🍧',
    description:
      'Modelo para lojas com tamanhos, complementos, frutas, cremes, coberturas e adicionais.',
    items: ['Açaí 500ml', 'Cupuaçu', 'Monte seu copo'],
    features: ['Tamanhos', 'Frutas', 'Cremes', 'Extras'],
    averageTicket: 'R$ 27,90',
    deliveryTime: '20-35 min',
    slug: '/exemplos',
    badge: 'Modelo',
  },
  {
    name: 'Sushi House',
    type: 'Japonês',
    emoji: '🍣',
    description:
      'Cardápio visual para combinados, temakis, hot rolls, bebidas e promoções especiais.',
    items: ['Combo 32 peças', 'Temaki Salmão', 'Hot Roll'],
    features: ['Combos', 'Temakis', 'Promoções', 'Bebidas'],
    averageTicket: 'R$ 74,90',
    deliveryTime: '40-60 min',
    slug: '/exemplos',
    badge: 'Modelo',
  },
]

const benefits = [
  'Visual mobile-first',
  'Link próprio da loja',
  'Pedido organizado no WhatsApp',
  'Sem comissão por venda',
]

const steps = [
  {
    title: 'Escolha o modelo',
    description: 'Pizzaria, hambúrguer, açaí, japonês ou qualquer outro tipo de operação.',
  },
  {
    title: 'Personalize a loja',
    description: 'Ajuste cores, categorias, produtos, adicionais, entrega, horários e cupons.',
  },
  {
    title: 'Comece a vender',
    description: 'Divulgue o link no Instagram, WhatsApp, Google Maps e cartão de visita.',
  },
]

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-orange-600/20"
      />

      <div className="leading-none">
        <p className="text-2xl font-black tracking-tighter text-[#111827]">
          Prato<span className="text-[#f97316]">by</span>
        </p>
        <p className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
          Cardápio digital e delivery
        </p>
      </div>
    </div>
  )
}

function ExampleCard({ example }) {
  return (
    <article className="group overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <div className="relative overflow-hidden border-b border-gray-100 bg-white p-8">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-100/70 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-orange-50 blur-3xl" />

        <div className="relative flex items-start justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316]">
              <FiShoppingBag size={13} />
              {example.type}
            </span>

            <h2 className="mt-5 text-2xl font-black tracking-tight text-[#111827]">
              {example.name}
            </h2>

            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#6b7280]">
              {example.description}
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#f9fafb] text-4xl shadow-sm ring-1 ring-gray-100 transition-transform duration-300 group-hover:scale-110">
            {example.emoji}
          </div>
        </div>

        <div className="relative mt-7 rounded-[2rem] border border-gray-100 bg-[#f9fafb] p-4 shadow-inner">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                Prévia do cardápio
              </p>
              <p className="mt-1 text-sm font-black text-[#111827]">
                {example.badge}
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#16a34a] shadow-sm">
              Aberto
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {example.items.map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-xs font-black text-[#f97316]">
                    {index + 1}
                  </span>

                  <p className="text-sm font-black text-[#111827]">
                    {item}
                  </p>
                </div>

                <span className="text-xs font-black text-[#6b7280]">
                  Ver
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
              <FiStar className="text-[#f97316]" />
              Ticket médio
            </div>

            <p className="mt-2 text-xl font-black text-[#111827]">
              {example.averageTicket}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
              <FiClock className="text-[#f97316]" />
              Entrega
            </div>

            <p className="mt-2 text-xl font-black text-[#111827]">
              {example.deliveryTime}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-black text-[#111827]">
            Recursos desse modelo
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {example.features.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] shadow-sm"
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
            Ver exemplo
            <FiArrowRight size={18} />
          </Link>

          <Link
            to="/contato"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-4 text-sm font-black text-[#111827] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
          >
            Quero esse
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function RestaurantExamplesPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <>
      <SEO
        title="Exemplos de cardápio digital | PratoBy"
        description="Veja modelos de cardápio digital para pizzaria, hamburgueria, açaiteria, japonês e lojas de delivery no PratoBy."
        path="/exemplos"
      />

      <main className="min-h-screen overflow-x-hidden bg-[#f9fafb] pt-[76px] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased">
      
      {/* NAVBAR PADRONIZADO */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0" aria-label="Ir para início">
            <Logo />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-orange-50 text-[#f97316]'
                      : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              Entrar
            </Link>

            <Link
              to="/dashboard"
              className="hidden rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] xl:inline-flex"
            >
              Painel
            </Link>

            <Link
              to="/contato"
              className="rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-90"
            >
              Criar minha loja
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition active:bg-gray-50"
            >
              Entrar
            </Link>

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] ring-1 ring-gray-100 transition active:bg-gray-100"
              onClick={() => setIsMenuOpen((current) => !current)}
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {isMenuOpen ? <FiX size={23} /> : <FiMenu size={23} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="absolute inset-x-0 top-full border-b border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200/70 md:hidden">
            <div className="grid gap-2">
              {navLinks.map((item) => {
                const isActive = location.pathname === item.to
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={`rounded-2xl px-4 py-3 text-center text-sm font-black ${
                      isActive
                        ? 'bg-orange-50 text-[#f97316]'
                        : 'bg-[#f9fafb] text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}

              <Link
                to="/contato"
                onClick={() => setIsMenuOpen(false)}
                className="mt-2 rounded-2xl bg-[#f97316] px-4 py-3 text-center text-sm font-black text-white"
              >
                Criar minha loja
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* HEADER DA PÁGINA (HERO SECTION) */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-white py-12 sm:py-20">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-orange-50/80 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-black text-[#f97316] shadow-sm">
              <FiZap />
              Modelos prontos para restaurantes
            </span>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
              Veja como o PratoBy pode ficar na prática.
            </h1>

            <p className="mt-6 text-lg leading-8 text-[#6b7280]">
              Exemplos pensados para diferentes tipos de operação: pizzaria,
              hamburgueria, açaíteria, japonês e qualquer loja que vende por delivery.
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
              <Link
                to="/planos"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/30 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
              >
                Ver planos
                <FiArrowRight size={18} />
              </Link>

              <Link
                to="/contato"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-sm font-black text-[#111827] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
              >
                Criar minha loja
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
              Demonstrações
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
              Modelos por tipo de restaurante
            </h2>
          </div>

          <p className="max-w-xl text-sm font-medium leading-6 text-[#6b7280]">
            Use esses exemplos como base. Depois é só trocar nome, logo, cores,
            produtos, adicionais, taxas e horários.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {examples.map((example) => (
            <ExampleCard key={example.name} example={example} />
          ))}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-lg font-black text-[#f97316]">
                {index + 1}
              </div>

              <h3 className="mt-5 text-xl font-black text-[#111827]">
                {step.title}
              </h3>

              <p className="mt-3 text-sm font-medium leading-6 text-[#6b7280]">
                {step.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-[2.5rem] border border-orange-100 bg-[#fff7ed] p-8 shadow-sm transition-all hover:shadow-md sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-[#f97316]">
                <FiMapPin />
                Seu restaurante também pode ter um link próprio
              </div>

              <h3 className="mt-3 text-2xl font-black text-[#111827] sm:text-3xl">
                Exemplo: pratoby.com/sua-loja
              </h3>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b7280]">
                Cada lojista divulga seu próprio link no Instagram, WhatsApp,
                Google Maps, bio, panfleto, cartão de visita ou QR Code na mesa.
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
      </section>

      {/* FOOTER PADRONIZADO */}
      <footer className="border-t border-gray-100 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm font-bold text-[#6b7280] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="PratoBy"
              className="h-8 w-8 rounded-xl object-cover grayscale transition hover:grayscale-0"
            />

            <p>
              © {new Date().getFullYear()}{' '}
              <span className="font-black text-[#111827]">PratoBy</span>. Todos os direitos reservados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-9">
            {navLinks.map((item) => (
              <Link 
                key={item.label} 
                to={item.to} 
                className="transition hover:text-[#f97316]"
              >
                {item.label}
              </Link>
            ))}
            <Link to="/login" className="transition hover:text-[#f97316]">
              Login
            </Link>
          </div>
        </div>
      </footer>
      </main>
    </>
  )
}

