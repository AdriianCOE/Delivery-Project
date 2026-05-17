import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../components/seo/SEO'
import {
  FiArrowRight,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiExternalLink,
  FiHeart,
  FiLink,
  FiLock,
  FiMail,
  FiMenu,
  FiMessageCircle,
  FiPercent,
  FiSmartphone,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap,
  FiHelpCircle,
  FiShield,
} from 'react-icons/fi'



const EXAMPLE_SLUG = 'capivaras-lanches'
const EXAMPLE_LINK_LABEL = `pratoby.com/${EXAMPLE_SLUG}`
const EXAMPLE_URL = `https://pratoby.com/${EXAMPLE_SLUG}`

const navLinks = [
  { label: 'Início', to: '/' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Planos', to: '/planos' },
  { label: 'Contato', to: '/contato' },
]

const benefits = [
  {
    icon: FiPercent,
    label: '0% de comissão',
    title: 'Sem taxa abusiva sobre pedidos',
    description:
      'Você não paga porcentagem em cima de cada venda. O pedido é seu, o cliente é seu e o lucro fica com sua loja.',
  },
  {
    icon: FiLink,
    label: 'Link próprio',
    title: 'Um link exclusivo para sua loja',
    description:
      'Divulgue seu cardápio no Instagram, WhatsApp, Google Maps e embalagem com um link exclusivo da sua loja.',
  },
  {
    icon: FiMessageCircle,
    label: 'WhatsApp',
    title: 'Pedido direto para sua operação',
    description:
      'Receba o pedido no painel, confirme Pix, imprima a comanda e fale com o cliente direto pelo WhatsApp.',
  },
]

// Imagens reais para dar vida ao mockup
const menuItems = [
  {
    name: 'Capivara Clássico',
    description: 'Pão brioche, blend artesanal, queijo e molho da casa.',
    price: 'R$ 28,00',
    oldPrice: 'R$ 32,00',
    badge: 'Popular',
    image: 'https://png.pngtree.com/png-vector/20231016/ourmid/pngtree-burger-food-png-free-download-png-image_10199386.png',
  },
  {
    name: 'Batata Rústica',
    description: 'Porção crocante com tempero especial e molho exclusivo.',
    price: 'R$ 16,00',
    oldPrice: '',
    badge: 'Destaque',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2EIlmcWfSfEeLI19XjB-n1mLnjc0gVWSpmw&s',
  },
  {
    name: 'Refrigerante lata',
    description: 'Escolha Coca-Cola, Guaraná ou Pepsi no pedido.',
    price: 'R$ 6,00',
    oldPrice: '',
    badge: 'Opções',
    image: 'https://bomdemais.instantdelivery.com.br/_core/_uploads/447/2024/09/133817092429kgajifed.png',
  },
]

const FAQS = [
  {
    question: 'O PratoBy cobra comissão por pedido?',
    answer:
      'Não. O PratoBy não cobra porcentagem em cima de cada venda. A proposta é oferecer um cardápio digital com link próprio, sem taxa abusiva sobre os pedidos.',
  },
  {
    question: 'O cliente é meu ou fica preso em uma plataforma?',
    answer:
      'O cliente continua sendo da sua loja. Você divulga o seu próprio link, recebe o pedido no seu painel e mantém o relacionamento pelo WhatsApp, Instagram ou atendimento direto.',
  },
  {
    question: 'O cliente precisa baixar aplicativo?',
    answer:
      'Não. O cardápio abre direto pelo navegador do celular. O cliente acessa o link, escolhe os itens, informa entrega ou retirada e finaliza o pedido.',
  },
  {
    question: 'Como a loja recebe os pedidos?',
    answer:
      'Os pedidos aparecem em tempo real no painel do lojista. A loja consegue acompanhar os dados do cliente, itens escolhidos, endereço, forma de pagamento e status do pedido.',
  },
  {
    question: 'Como funciona o Pix manual?',
    answer:
      'A loja cadastra a chave Pix nas configurações. Quando o cliente escolhe Pix, o sistema mostra QR Code e Pix copia e cola no acompanhamento do pedido. Depois, o lojista confirma o pagamento no painel.',
  },
  {
    question: 'Dá para imprimir comanda?',
    answer:
      'Sim. O painel possui opção de imprimir comanda do pedido, com itens, adicionais, observações, dados do cliente e informações úteis para a produção.',
  },
]

const LANDING_INTRO_KEY = '@PratoBy:landingIntroSeen'

function useLandingIntro() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !sessionStorage.getItem(LANDING_INTRO_KEY)
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!showIntro) return

    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(LANDING_INTRO_KEY, '1')
      } catch {
        // ignora se o navegador bloquear storage
      }

      setShowIntro(false)
    }, 850)

    return () => clearTimeout(timer)
  }, [showIntro])

  return showIntro
}

function LandingIntro({ show }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white">
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100 blur-3xl" />
      <div className="absolute -right-24 bottom-20 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-[#f97316]/30 blur-2xl" />

          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white shadow-2xl shadow-orange-200 ring-1 ring-orange-100">
            <img
              src="/icons/icon-192.png"
              alt="PratoBy"
              className="h-16 w-16 rounded-2xl object-cover"
            />
          </div>
        </div>

        <p className="mt-6 text-3xl font-black tracking-tighter text-[#111827]">
          Prato<span className="text-[#f97316]">By</span>
        </p>

        <p className="mt-2 text-sm font-bold text-[#6b7280]">
          Abrindo seu cardápio digital...
        </p>

        <div className="mt-6 h-2 w-56 overflow-hidden rounded-full bg-orange-100">
          <div className="landing-loading-bar h-full rounded-full bg-[#f97316]" />
        </div>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-orange-600/20"
      />

      <div className="leading-none">
        {/* NOME DA MARCA ESTILIZADO */}
        <p className="text-2xl font-black tracking-tighter text-[#111827]">
          Prato<span className="text-[#f97316]">by</span>
        </p>
        {/* SUBTÍTULO MAIS ESPAÇADO E MODERNO */}
        <p className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
          Cardápio digital e delivery
        </p>
      </div>
    </div>
  )
}

function SmartImage({ src, alt, className = '' }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse rounded-[1rem] bg-gradient-to-br from-gray-100 via-white to-orange-50" />
      )}

      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`${className} transition-all duration-500 ${
          loaded ? 'scale-100 opacity-100 blur-0' : 'scale-95 opacity-0 blur-sm'
        }`}
      />
    </div>
  )
}

function MenuMockup() {
  return (
    <div className="landing-float relative z-10 mx-auto w-full max-w-[390px]">
      <div className="pointer-events-none absolute -left-20 top-20 z-30 hidden animate-bounce rounded-[1.5rem] border border-gray-100 bg-white px-4 py-3 shadow-2xl shadow-gray-200/70 lg:block xl:-left-28 [animation-duration:3s]">
        <p className="flex items-center gap-2 text-xs font-black text-[#111827]">
          <FiPercent className="text-[#f97316]" />
          0% de comissão
        </p>

        <p className="mt-1 text-[11px] font-bold text-[#6b7280]">
          Sem taxa por pedido
        </p>
      </div>

      <div className="relative z-20 rounded-[2.5rem] border border-gray-200 bg-white p-3 shadow-2xl shadow-gray-300/70">
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-[#f9fafb]">
          
          {/* HEADER DO CARDÁPIO */}
          <div className="relative overflow-hidden bg-[#111827] px-4 pb-5 pt-4 text-white">
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#f97316]/30 blur-3xl" />
            <div className="absolute -left-16 bottom-0 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {/* AQUI ENTROU A SUA LOGO DO CLOUDINARY */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                  <img 
                    src="https://res.cloudinary.com/dsionrn26/image/upload/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png" 
                    alt="Logo Capivara's Lanches" 
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    Capivara&apos;s Lanches
                  </p>

                  <p className="mt-1 text-[11px] font-bold text-white/60">
                    Aberta · Hoje até 20:00
                  </p>
                </div>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <FiHeart />
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-bold text-white/50">Pedido</p>
                <p className="mt-1 text-sm font-black">Rápido</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-bold text-white/50">Pix</p>
                <p className="mt-1 text-sm font-black">QR Code</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-bold text-white/50">Link</p>
                <p className="mt-1 text-sm font-black">Exclusivo</p>
              </div>
            </div>
          </div>

          {/* CORPO DO CARDÁPIO */}
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#111827]">
                  Hambúrgueres
                </p>

                <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                  Exemplo de cardápio minimalista
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] ring-1 ring-gray-100">
                3 itens
              </span>
            </div>

            <div className="flex gap-2 overflow-hidden">
              {['Mais pedidos', 'Promoções', 'Bebidas'].map((item, index) => (
                <span
                  key={item}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                    index === 0
                      ? 'bg-[#f97316] text-white'
                      : 'bg-white text-[#6b7280] ring-1 ring-gray-100'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {menuItems.map((item, index) => (
                <div
                  key={item.name}
                  className="flex gap-3 rounded-[1.4rem] border border-gray-100 bg-white p-3 shadow-sm"
                >
                  {/* IMAGENS REAIS DOS PRODUTOS AQUI */}
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-gray-50">
                    <SmartImage
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-contain p-1 hover:scale-110"
                    />
                    
                    {index === 0 && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
                        -13%
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-black text-[#111827]">
                        {item.name}
                      </p>

                      <span className="rounded-full bg-orange-50 px-2 py-1 text-[9px] font-black text-[#f97316]">
                        {item.badge}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[#6b7280]">
                      {item.description}
                    </p>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        {item.oldPrice && (
                          <p className="text-[10px] font-bold text-gray-400 line-through">
                            {item.oldPrice}
                          </p>
                        )}

                        <p className="text-sm font-black text-[#111827]">
                          {item.price}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="rounded-xl bg-[#f97316] px-3 py-2 text-[11px] font-black text-white shadow-sm"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[1.3rem] bg-[#111827] px-4 py-3 text-white shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black">Carrinho</p>
                  <p className="mt-0.5 text-[11px] font-bold text-white/60">
                    3 itens escolhidos
                  </p>
                </div>

                <p className="text-sm font-black">R$ 50,00</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <a
        href={EXAMPLE_URL}
        target="_blank"
        rel="noreferrer"
        className="group relative mt-6 block overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white p-[1px] shadow-xl shadow-orange-100/60 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-200/70"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-white to-orange-50 opacity-80" />

        <div className="relative rounded-[1.7rem] bg-gradient-to-br from-white to-orange-50/70 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#f97316]">
                <FiExternalLink size={13} />
                Ver exemplo real
              </div>

              <p className="mt-3 truncate text-lg font-black tracking-tight text-[#111827]">
                pratoby.com/<span className="text-[#f97316]">capivaras-lanches</span>
              </p>

              <p className="mt-1 text-xs font-bold text-[#6b7280]">
                Cardápio de demonstração aberto em nova aba
              </p>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/25 transition duration-300 group-hover:scale-105">
              <FiArrowRight size={20} />
            </div>
          </div>
        </div>
      </a>
    </div>
  )
}

function FaqItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-[#f9fafb] sm:px-6"
      >
        <span className="text-sm font-black leading-6 text-[#111827] sm:text-base">
          {faq.question}
        </span>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <FiChevronDown size={18} />
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm font-semibold leading-7 text-[#6b7280] sm:px-6">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const location = useLocation()
  const showIntro = useLandingIntro()

  return (
    <>
      <SEO
        title="PratoBy | Cardápio Digital"
        description="Venda pelo próprio cardápio digital, receba pedidos online e divulgue um link exclusivo da sua loja. Sem comissão por pedido."
        path="/"
      />

      <LandingIntro show={showIntro} />
      <main
        className={`min-h-screen overflow-x-hidden bg-[#f9fafb] pt-[76px] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased transition-all duration-700 ${
          showIntro ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-xl landing-nav-enter">
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <span className="landing-top-line block h-full w-1/3 rounded-full bg-[#f97316]" />
        </span>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/" className="shrink-0" aria-label="Ir para início">
              <Logo />
            </Link>

          {/* MENU DESKTOP */}
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

          {/* BOTÕES DESKTOP */}
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

          {/* CONTROLES MOBILE (Login + Hamburguer) */}
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

        {/* DROPDOWN DO MENU MOBILE */}
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

        <div className="w-full animate-[fadeIn_0.4s_ease-out]">
          
        <header className="relative overflow-hidden border-b border-gray-100 bg-white landing-hero-enter">
        <div className="absolute -left-40 top-32 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl" />
        <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#f9fafb]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center lg:px-8 lg:py-20">
          <div className="landing-reveal text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
              <FiShield />
              Delivery white-label para restaurantes
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-tight text-[#111827] sm:text-6xl lg:text-7xl">
  Seu cardápio online, seus clientes.{' '}
  <br className="hidden lg:block" />
  <span className="text-[#f97316]">
    Zero taxas por pedido.
  </span>
</h1>

            <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg lg:mx-0">
              O PratoBy cria uma página de pedido moderna para sua loja vender
              pelo próprio link. Sem outras lojas competindo espaço com
              seu cliente e absolutamente nenhuma taxa sobre cada venda.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4 text-left">
                <div className="flex items-center gap-2">
                  <FiPercent className="text-[#f97316]" />
                  <p className="text-2xl font-black text-[#f97316]">0%</p>
                </div>

                <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#9a3412]">
                  de comissão por pedido
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4 text-left">
                <div className="flex items-center gap-2">
                  <FiUsers className="text-[#f97316]" />
                  <p className="text-sm font-black text-[#111827]">
                    Cliente seu
                  </p>
                </div>

                <p className="mt-1 text-xs font-bold leading-5 text-[#6b7280]">
                  O relacionamento fica com sua loja.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4 text-left">
                <div className="flex items-center gap-2">
                  <FiLink className="text-[#f97316]" />
                  <p className="text-sm font-black text-[#111827]">
                    Link próprio
                  </p>
                </div>

                <p className="mt-1 truncate text-xs font-bold leading-5 text-[#6b7280]">
                  {EXAMPLE_LINK_LABEL}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <Link
                to="/contato"
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.6rem] bg-[#f97316] px-6 text-base font-black text-white shadow-2xl shadow-orange-200 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-95 sm:w-auto"
              >
                Criar minha loja
                <FiArrowRight />
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
                <FiExternalLink />
                Ver exemplo
              </a>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              {[
                'Sem comissão por venda',
                'Cliente e link da loja',
                'Pix com QR Code',
                'Painel do lojista',
                'Tracking do pedido',
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-black text-[#6b7280] shadow-sm"
                >
                  <FiCheckCircle className="text-[#f97316]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-reveal landing-delay-2">
            <MenuMockup />
          </div>
        </div>
      </header>

      <section className="bg-[#f9fafb] py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm ring-1 ring-gray-100">
              <FiZap />
              O básico para vender online
            </span>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Uma estrutura simples para o restaurante vender pelo próprio link.
            </h2>

            <p className="mt-4 text-base font-semibold leading-7 text-[#6b7280]">
              Seu cliente entra no cardápio, escolhe os itens, acompanha o
              pedido e você gerencia tudo no painel da loja.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {benefits.map((item) => {
  const Icon = item.icon

  return (
    <article
      key={item.title}
      className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-100/40 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="rounded-full bg-orange-50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
          {item.label}
        </span>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={21} />
        </div>
      </div>

      <h3 className="mt-6 text-xl font-black text-[#111827]">
        {item.title}
      </h3>

      <p className="mt-3 text-sm font-semibold leading-7 text-[#6b7280]">
        {item.description}
      </p>
    </article>
  )
})}
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
              <FiClock />
              Fluxo do pedido
            </span>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Do link ao preparo, sem complicar a operação.
            </h2>

            <p className="mt-4 text-base font-semibold leading-8 text-[#6b7280]">
              O cliente pede pelo cardápio, a loja recebe no painel, confirma o
              pagamento e acompanha o status até finalizar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['1', 'Divulgue seu link', EXAMPLE_LINK_LABEL, FiLink],
              ['2', 'Cliente monta o pedido', 'Itens, adicionais, observação e entrega.', FiSmartphone],
              ['3', 'Pagamento configurado', 'Pix, dinheiro ou maquininha.', FiCreditCard],
              ['4', 'Lojista gerencia no painel', 'Confirma Pix, imprime comanda e muda status.', FiTrendingUp],
            ].map(([number, title, description, Icon]) => (
              <div
                key={number}
                className="rounded-[1.7rem] border border-gray-100 bg-[#f9fafb] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f97316] text-sm font-black text-white">
                    {number}
                  </div>

                  <Icon className="text-[#f97316]" size={20} />
                </div>

                <p className="mt-4 text-base font-black text-[#111827]">
                  {title}
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO DE PERGUNTAS FREQUENTES */}
      <section className="relative z-10 mx-auto max-w-4xl border-t border-gray-100 px-4 py-10 sm:px-6 lg:px-8 sm:py-16">
        <div className="mx-auto text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
            <FiHelpCircle size={28} />
          </div>

          <h2 className="mt-6 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
            Perguntas Frequentes
          </h2>

          <p className="mt-4 text-base leading-7 text-[#6b7280]">
            Tudo o que precisa saber antes de criar o seu cardápio conosco.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-gray-200/40">
          {FAQS.map((faq, index) => (
            <FaqItem
              key={index}
              faq={faq}
              isOpen={openFaqIndex === index}
              onToggle={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
            />
          ))}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.4rem] bg-[#111827] p-6 text-white shadow-2xl shadow-gray-300/70 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-100">
                <FiLock className="text-[#f97316]" />
                Teste com uma loja piloto
              </p>

              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
                Monte um link profissional antes de depender de aplicativo.
              </h2>

              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-gray-300 sm:text-base">
                Comece com uma loja, valide o fluxo real e divulgue um cardápio
                com cara de marca própria.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
              <Link
                to="/sobre"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-base font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/40"
              >
                Conhecer o projeto
                <FiArrowRight />
              </Link>

              <Link
                to="/contato"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-black text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/15"
              >
                Entrar em contato
                <FiMail />
              </Link>
            </div>
          </div>
        </div>
      </section>

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
        {/* 👆 AQUI FECHA A NOSSA DIV DE ANIMAÇÃO GERAL, antes de fechar o main */}

      </main>
    </>
  )
}