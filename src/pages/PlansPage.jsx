import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MarketingLayout from '../pages/MarketingLayout'
import SEO from '../components/seo/SEO'
import {
  FiArrowRight,
  FiCheck,
  FiAward,
  FiMessageCircle,
  FiShield,
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

const plans = [
  {
    name: 'Essencial',
    price: 'R$ 59',
    period: '/mês',
    description: 'Para pequenos restaurantes que querem começar a receber pedidos organizados online.',
    icon: FiZap,
    highlight: false,
    features: [
      'Cardápio digital mobile-first',
      'Link exclusivo do estabelecimento',
      'Categorias, opções e adicionais',
      'Carrinho inteligente com resumo',
      'Pedidos estruturados no WhatsApp',
      'Sem taxas ou comissões por venda',
    ],
    cta: 'Começar no Essencial',
  },
  {
    name: 'Profissional',
    price: 'R$ 89',
    period: '/mês',
    description: 'Para lojas que precisam de gestão em tempo real, Pix e atendimento no local.',
    icon: FiStar,
    highlight: true,
    badge: 'Mais vendido',
    features: [
      'Tudo do plano Essencial',
      'Painel de pedidos em tempo real',
      'Gerador de QR Code por Mesa',
      'Pix Manual com Copia e Cola',
      'Taxas de entrega por bairro',
      'Controle de horários de abertura',
      'Cupons de desconto',
    ],
    cta: 'Quero o Profissional',
  },
  {
    name: 'White-label',
    price: 'R$ 159',
    period: '/mês',
    description: 'A experiência premium. O seu próprio ecossistema de delivery e PDV.',
    icon: FiAward,
    highlight: false,
    features: [
      'Tudo do plano Profissional',
      'OutScreen (Tela para Cozinha)',
      'MotoBot (Gestão de Entregadores)',
      'Identidade visual personalizada',
      'Configuração com domínio próprio',
      'Métricas e histórico de clientes',
      'Suporte prioritário via WhatsApp',
    ],
    cta: 'Montar White-label',
  },
]

const benefits = [
  'Zero comissão por pedido',
  'Painel do lojista em tempo real',
  'Pagamento via Pix integrado',
  'QR Codes para mesas e balcão',
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

export default function PlansPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

return (
    <>
      <SEO title="Planos | PratoBy" />
      <MarketingLayout>

      <main className="min-h-screen overflow-x-hidden bg-[#f9fafb] pt-[76px] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased">

        {/* 👇 2. MÁGICA DA ANIMAÇÃO (Com w-full para travar o pulo lateral) */}
        <div className="w-full animate-[fadeIn_0.4s_ease-out]">
          
          <section className="relative overflow-hidden border-b border-gray-100 bg-white py-12 sm:py-20">
            <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-100/60 blur-3xl" />
            <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-orange-50/80 blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-black text-[#f97316] shadow-sm">
                  <FiShield />
                  Planos justos, sem taxa escondida
                </span>

                <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  Escolha o plano ideal para modernizar a sua loja.
                </h1>

                <p className="mt-6 text-lg leading-8 text-[#6b7280]">
                  O PratoBy entrega muito mais que um link de cardápio. É um sistema completo para gestão de pedidos, autoatendimento na mesa e integração com WhatsApp.
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
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {plans.map((plan) => {
                const Icon = plan.icon

                return (
                  <article
                    key={plan.name}
                    className={[
                      'group relative rounded-[2.5rem] border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl',
                      plan.highlight
                        ? 'border-orange-400 ring-4 ring-orange-50'
                        : 'border-gray-100',
                    ].join(' ')}
                  >
                    {plan.badge && (
                      <div className="absolute right-6 top-6 rounded-full bg-[#111827] px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-md">
                        {plan.badge}
                      </div>
                    )}

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition-transform duration-300 group-hover:scale-110 group-hover:bg-[#f97316] group-hover:text-white">
                      <Icon size={24} />
                    </div>

                    <h2 className="mt-6 text-2xl font-black text-[#111827]">
                      {plan.name}
                    </h2>

                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#6b7280]">
                      {plan.description}
                    </p>

                    <div className="mt-6 flex items-end gap-1">
                      <span className="text-4xl font-black tracking-tight text-[#111827]">
                        {plan.price}
                      </span>
                      <span className="pb-1 text-sm font-bold text-[#6b7280]">
                        {plan.period}
                      </span>
                    </div>

                    <Link
                      to="/contato"
                      className={[
                        'mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-black transition-all duration-300 hover:-translate-y-1',
                        plan.highlight
                          ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/30 hover:bg-[#ea580c] hover:shadow-orange-600/40'
                          : 'bg-[#111827] text-white shadow-md hover:bg-black',
                      ].join(' ')}
                    >
                      {plan.cta}
                      <FiArrowRight size={18} />
                    </Link>

                    <ul className="mt-8 space-y-4">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm font-bold leading-6 text-[#111827]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316]">
                            <FiCheck size={14} />
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>

            <div className="mt-16 rounded-[2.5rem] border border-orange-100 bg-[#fff7ed] p-8 shadow-sm transition-all hover:shadow-md sm:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#111827]">
                    Ainda com dúvidas sobre qual plano escolher?
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b7280]">
                    Fale com a nossa equipe. Ajudamos a entender o tamanho da sua operação e sugerimos a estrutura perfeita para gerir o seu delivery e atendimento local.
                  </p>
                </div>

                <Link
                  to="/contato"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                >
                  <FiMessageCircle size={18} />
                  Falar com consultor
                </Link>
              </div>
            </div>
          </section>

        </div>
        </main>
      </MarketingLayout>
    </>
  )
}