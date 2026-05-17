import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../components/seo/SEO'
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiCode,
  FiCompass,
  FiHome,
  FiLayers,
  FiMail,
  FiMessageCircle,
  FiShield,
  FiShoppingBag,
  FiTarget,
  FiTool,
  FiTrendingUp,
  FiZap,
  FiSmartphone,
  FiMenu,
  FiX
} from 'react-icons/fi'

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

const TIMELINE = [
  {
    icon: FiCompass,
    title: 'A dor',
    description:
      'Muitas lojas dependem de mensagens soltas no WhatsApp, prints de cardápio e pedidos desorganizados em horários de pico.',
  },
  {
    icon: FiTool,
    title: 'A ideia',
    description:
      'Criar uma ferramenta simples, bonita e acessível para transformar o cardápio digital em um fluxo real de pedido.',
  },
  {
    icon: FiCode,
    title: 'A construção',
    description:
      'O PratoBy começou como um produto próprio, com foco em React, Firebase, Cloudinary, mobile-first e operação em tempo real.',
  },
  {
    icon: FiTrendingUp,
    title: 'O objetivo',
    description:
      'Ajudar estabelecimentos a venderem pelo próprio link, com menos dependência de marketplace e mais controle da operação.',
  },
]

const DIFFERENCES = [
  'Sem comissão por pedido',
  'Pedido salvo com snapshot completo',
  'Comanda térmica para cozinha',
  'Horários configuráveis por dia',
  'Opções e adicionais estilo app de delivery',
  'Dashboard em tempo real para o lojista',
  'Link próprio para cada estabelecimento',
  'Estrutura preparada para QR Code, Pix e OutScreen',
]

const STACK = [
  'React',
  'Vite',
  'Tailwind CSS',
  'Firebase',
  'Firestore',
  'Cloudinary',
  'React Router',
  'Mobile-first',
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

function TimelineCard({ item, index }) {
  const Icon = item.icon

  return (
    <article className="group relative rounded-[1.7rem] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-orange-900/5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition-transform duration-300 group-hover:scale-110 group-hover:bg-[#f97316] group-hover:text-white">
          <Icon size={21} />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
            0{index + 1}
          </p>

          <h3 className="mt-1 text-lg font-black text-[#111827]">
            {item.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#6b7280]">
            {item.description}
          </p>
        </div>
      </div>
    </article>
  )
}

function MiniButton({ to, children, variant = 'dark', icon: Icon = FiArrowRight }) {
  const styles =
    variant === 'green' // Utilizando 'green' como nome mas aplicando as cores da marca (Laranja)
      ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20 hover:bg-[#ea580c] hover:shadow-orange-600/30'
      : variant === 'white'
        ? 'border border-gray-200 bg-white text-[#111827] shadow-sm hover:border-orange-200 hover:text-[#f97316]'
        : 'bg-[#111827] text-white shadow-lg hover:bg-black'

  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-black transition-all duration-300 hover:-translate-y-1 ${styles}`}
    >
      {children}
      <Icon size={16} />
    </Link>
  )
}

export default function AboutPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

return (
    <>
      <SEO title="Sobre | PratoBy" path="/sobre" />
      
      <main className="min-h-screen overflow-x-hidden bg-[#f9fafb] pt-[76px] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased">
        
        {/* 1. NAVBAR FIXO (Fica de fora da animação) */}
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

        {/* 👇 2. MÁGICA DA ANIMAÇÃO (Com w-full a abraçar todo o conteúdo) */}
        <div className="w-full animate-[fadeIn_0.4s_ease-out]">
          
          {/* ELEMENTOS DE FUNDO DO ABOUT */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-gray-200/80 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-50/80 blur-3xl" />
          </div>

          <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
                  <FiBookOpen />
                  História, missão e construção
                </div>

                <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  O PratoBy nasceu para resolver uma operação real.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6b7280]">
                  Não é só uma página bonita de cardápio. A ideia é dar ao pequeno estabelecimento uma forma simples de vender, organizar pedidos e atender melhor sem depender totalmente de aplicativos abusivos.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <MiniButton to="/contato" variant="green" icon={FiMessageCircle}>
                    Falar sobre implantação
                  </MiniButton>

                  <MiniButton to="/" variant="white" icon={FiHome}>
                    Voltar para início
                  </MiniButton>
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-gray-100 bg-white p-5 shadow-2xl shadow-gray-200/80 transition-all hover:shadow-orange-900/5">
                <div className="rounded-[2rem] bg-[#111827] p-8 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                      <FiTarget size={23} />
                    </div>

                    <span className="rounded-full bg-orange-400/15 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-orange-300">
                      Missão
                    </span>
                  </div>

                  <h2 className="mt-10 text-3xl font-black tracking-tight">
                    Transformar pedido bagunçado em operação clara.
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-white/60">
                    O cliente monta o pedido sozinho. O lojista recebe tudo estruturado. A cozinha imprime uma comanda simples. O acompanhamento acontece em tempo real.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    ['Mobile', 'primeiro no celular'],
                    ['Tempo real', 'pedidos ao vivo'],
                    ['Operação', 'menos improviso'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-3xl border border-gray-100 bg-[#f9fafb] p-5 transition-colors hover:border-orange-100 hover:bg-orange-50/50">
                      <FiCheckCircle className="text-[#f97316]" size={20} />
                      <p className="mt-3 text-sm font-black text-[#111827]">
                        {title}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#6b7280]">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                  Por que existe
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827]">
                  Da dor ao produto.
                </h2>
              </div>

              <MiniButton to="/contato" variant="white" icon={FiMail}>
                Conversar agora
              </MiniButton>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {TIMELINE.map((item, index) => (
                <TimelineCard key={item.title} item={item} index={index} />
              ))}
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-2xl shadow-gray-200/80 lg:grid lg:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-[#111827] p-8 text-white sm:p-12 lg:p-14">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                  <FiShoppingBag size={26} />
                </div>

                <h2 className="mt-6 text-3xl font-black tracking-tight">
                  Para quem o PratoBy foi feito?
                </h2>

                <p className="mt-5 text-base leading-8 text-white/60">
                  Para restaurantes, lanchonetes, pizzarias, hamburguerias, açaíterias, cafeterias, docerias, marmitarias e lojas locais que querem vender direto pelo próprio link.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {['Restaurantes', 'Pizzarias', 'Lanchonetes', 'Açaí', 'Cafeterias', 'Docerias'].map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-8 sm:p-12 lg:p-14">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiLayers size={26} />
                </div>

                <h2 className="mt-6 text-3xl font-black tracking-tight text-[#111827]">
                  O que torna diferente?
                </h2>

                <p className="mt-5 text-base leading-8 text-[#6b7280]">
                  O foco não é só divulgar produtos. O foco é criar um pequeno sistema operacional para a loja receber, controlar, imprimir, acompanhar e evoluir seus pedidos.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {DIFFERENCES.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 transition hover:border-orange-100 hover:bg-orange-50/50">
                      <FiCheckCircle className="mt-0.5 shrink-0 text-[#f97316]" />
                      <p className="text-sm font-black leading-6 text-[#111827]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiCode size={24} />
                </div>

                <h2 className="mt-6 text-2xl font-black tracking-tight text-[#111827]">
                  Construção técnica
                </h2>

                <p className="mt-4 text-sm leading-7 text-[#6b7280]">
                  O projeto é construído com uma stack moderna para front-end, tempo real, imagens na nuvem e experiência mobile-first.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {STACK.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-100 bg-[#f9fafb] px-4 py-2 text-xs font-black text-[#111827] transition hover:border-orange-200 hover:text-[#f97316]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {[
                  {
                    icon: FiSmartphone,
                    title: 'UX mobile-first',
                    text: 'O cliente precisa conseguir pedir sem pensar muito, direto no celular.',
                  },
                  {
                    icon: FiClock,
                    title: 'Operação em tempo real',
                    text: 'Pedido chegou, painel atualiza, sino toca e o lojista age rápido.',
                  },
                  {
                    icon: FiShield,
                    title: 'Histórico confiável',
                    text: 'O pedido salva snapshot dos itens para preservar o histórico de venda.',
                  },
                  {
                    icon: FiZap,
                    title: 'Evolução contínua',
                    text: 'Pix, QR Code por mesa, OutScreen, clientes e financeiro entram no roadmap.',
                  },
                ].map((item) => {
                  const Icon = item.icon

                  return (
                    <article key={item.title} className="group rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-900/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition-transform duration-300 group-hover:scale-110 group-hover:bg-[#f97316] group-hover:text-white">
                        <Icon size={22} />
                      </div>

                      <h3 className="mt-6 text-lg font-black text-[#111827]">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                        {item.text}
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.5rem] bg-[#f97316] p-8 text-white shadow-2xl shadow-orange-600/20 sm:p-12 lg:p-16">
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-white/70">
                    PratoBy em teste
                  </p>

                  <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                    Quer testar em uma loja real?
                  </h2>

                  <p className="mt-5 max-w-xl text-base leading-8 text-white/80">
                    Fale sobre sua operação, cardápio e fluxo de pedidos. A gente te ajuda a entender como o PratoBy pode encaixar.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
                  <Link
                    to="/contato"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-black text-[#111827] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-orange-50 hover:shadow-2xl"
                  >
                    Entrar em contato
                    <FiMessageCircle />
                  </Link>

                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-base font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Já tenho acesso
                    <FiArrowRight />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER */}
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

        </div>
        {/* 👆 FIM DA DIV DE ANIMAÇÃO */}
      </main>
    </>
  )
}