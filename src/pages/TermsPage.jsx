import { useState, useEffect } from 'react'
import SEO from '../components/seo/SEO'
import MarketingLayout from './MarketingLayout'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft as ArrowLeft,
  FiChevronRight as ChevronRight,
  FiClock as Clock,
  FiCreditCard as CreditCard,
  FiFileText as FileText,
  FiShield as ShieldAlert,
  FiShoppingBag as ShoppingBag,
  FiUserCheck as UserCheck,
} from 'react-icons/fi'
import { FaScaleBalanced as Scale } from 'react-icons/fa6'

const LAST_UPDATED = '24 de maio de 2026'
const SUPPORT_EMAIL = 'contato@pratoby.com'

const SECTIONS = [
  {
    id: 'aceitacao',
    title: '1. Aceitação dos Termos',
    shortTitle: 'Aceitação',
    icon: UserCheck,
    summary:
      'Ao criar uma conta, acessar o painel ou publicar uma loja pelo PratoBy, você concorda com estas regras de uso.',
    content: (
      <>
        <p>
          Estes Termos de Uso regulam o acesso e a utilização do PratoBy, uma plataforma SaaS para cardápio digital, pedidos online e gestão operacional de estabelecimentos de alimentação.
        </p>
        <p>
          Ao se cadastrar, acessar o painel administrativo, configurar uma loja, publicar um cardápio ou utilizar qualquer recurso da plataforma, você declara que leu, entendeu e concorda com estes Termos.
        </p>
        <p>
          Caso você esteja usando o PratoBy em nome de uma empresa, restaurante, lanchonete, hamburgueria, pizzaria, cafeteria, delivery ou outro estabelecimento, você declara possuir autorização para aceitar estes Termos em nome desse negócio.
        </p>
      </>
    ),
  },
  {
    id: 'servico',
    title: '2. O que é o PratoBy',
    shortTitle: 'Serviço',
    icon: ShoppingBag,
    summary:
      'O PratoBy fornece tecnologia para o lojista vender direto, com cardápio próprio, painel de pedidos e gestão sem comissão cobrada pelo PratoBy por pedido.',
    content: (
      <>
        <p>
          O PratoBy é uma solução tecnológica para ajudar lojistas a venderem diretamente para seus clientes, sem depender de marketplace e sem comissão cobrada pelo PratoBy por pedido.
        </p>
        <p>
          A plataforma pode incluir, conforme o plano contratado e os recursos disponíveis: página pública da loja, cardápio digital, carrinho, validação de cupom, cálculo de entrega, painel de pedidos, KDS/cozinha, painel de retirada, notificações, relatórios, gestão de assinatura e recursos administrativos.
        </p>
        <p>
          O PratoBy não é restaurante, não é aplicativo de entrega, não prepara alimentos, não contrata entregadores e não participa da negociação entre o lojista e o consumidor final. A relação de compra e venda ocorre diretamente entre a loja e o cliente.
        </p>
      </>
    ),
  },
  {
    id: 'conta',
    title: '3. Conta, Loja e Segurança',
    shortTitle: 'Conta',
    icon: FileText,
    summary:
      'O lojista deve manter dados atualizados, proteger o acesso ao painel e responder pelas ações realizadas em sua conta.',
    content: (
      <>
        <p>
          Para usar o PratoBy, o lojista deve fornecer informações verdadeiras, completas e atualizadas, incluindo dados de contato, dados da loja, informações de cobrança e demais dados necessários para a prestação do serviço.
        </p>
        <p>
          O lojista é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as ações realizadas em sua conta, inclusive alterações de cardápio, preços, horários, taxas de entrega, cupons, status de pedidos e configurações da loja.
        </p>
        <p>
          Se houver suspeita de acesso indevido, vazamento de senha ou uso não autorizado do painel, o lojista deve trocar suas credenciais e comunicar o suporte do PratoBy assim que possível.
        </p>
      </>
    ),
  },
  {
    id: 'pedidos',
    title: '4. Pedidos, Preços, Pagamentos e Entregas',
    shortTitle: 'Pedidos',
    icon: Scale,
    summary:
      'A loja é responsável por produtos, preços, entrega, atendimento, disponibilidade e relação com o consumidor final.',
    content: (
      <>
        <p>
          O lojista é o único responsável pelas informações exibidas em sua loja, incluindo nomes de produtos, descrições, fotos, preços, adicionais, disponibilidade, tempo de preparo, áreas de entrega, taxas, promoções e cupons.
        </p>
        <p>
          Os pedidos recebidos pelo PratoBy são encaminhados ao painel da loja para processamento pelo próprio estabelecimento. A preparação dos produtos, a qualidade dos alimentos, a emissão de documentos fiscais, a cobrança do cliente, a entrega e o atendimento pós-venda são responsabilidades do lojista.
        </p>
        <p>
          O PratoBy pode exibir ou registrar formas de pagamento configuradas pela loja, como Pix, dinheiro, cartão na entrega ou outras opções disponíveis. Salvo quando expressamente informado em recurso específico, o PratoBy não intermedeia o pagamento do pedido entre cliente final e lojista.
        </p>
      </>
    ),
  },
  {
    id: 'assinatura',
    title: '5. Planos, Teste Gratuito e Cancelamento',
    shortTitle: 'Assinatura',
    icon: CreditCard,
    summary:
      'Os recursos completos dependem do plano ativo. Não há fidelidade, e o lojista pode solicitar cancelamento pelo painel ou suporte.',
    content: (
      <>
        <p>
          O acesso aos recursos completos do PratoBy depende da contratação de um plano, conforme valores, limites, benefícios e condições apresentados no momento da assinatura.
        </p>
        <p>
          Quando houver teste gratuito, ele será aplicado conforme as regras exibidas no checkout ou na página do plano. O período de teste pode depender da confirmação do provedor de pagamento e poderá ser encerrado se houver fraude, abuso, uso indevido ou violação destes Termos.
        </p>
        <p>
          O lojista pode solicitar o cancelamento da assinatura pelo painel, quando disponível, ou pelo canal oficial de suporte. Não cobramos multa de fidelidade. Após o cancelamento, o acesso poderá permanecer ativo até o fim do ciclo já pago ou do período informado no momento da contratação.
        </p>
        <p>
          Solicitações de alteração de plano, vencimento, cancelamento ou ajustes de cobrança podem passar por análise operacional e confirmação do provedor de pagamento antes de serem efetivadas.
        </p>
      </>
    ),
  },
  {
    id: 'uso-aceitavel',
    title: '6. Uso Aceitável da Plataforma',
    shortTitle: 'Uso aceitável',
    icon: ShieldAlert,
    summary:
      'É proibido usar o PratoBy para fraude, abuso, spam, invasão, scraping indevido ou venda de itens ilegais.',
    content: (
      <>
        <p>
          O lojista se compromete a usar o PratoBy de forma lícita, ética e compatível com a finalidade da plataforma. É proibido tentar burlar regras de segurança, explorar falhas, executar automações abusivas, coletar dados de forma indevida ou prejudicar a estabilidade do serviço.
        </p>
        <p>
          Também é proibido utilizar a plataforma para vender produtos ou serviços ilegais, enganosos, perigosos, falsificados, sem autorização regulatória quando exigida, ou que violem direitos de terceiros.
        </p>
        <p>
          Em caso de uso indevido, risco à segurança, fraude, chargeback abusivo, violação legal ou descumprimento destes Termos, o PratoBy poderá limitar recursos, suspender a loja, remover conteúdo ou encerrar a conta, sem prejuízo das medidas legais cabíveis.
        </p>
      </>
    ),
  },
  {
    id: 'disponibilidade',
    title: '7. Disponibilidade, Suporte e Limitação de Responsabilidade',
    shortTitle: 'Disponibilidade',
    icon: Clock,
    summary:
      'Trabalhamos para manter a plataforma estável, mas falhas de internet, provedores externos e indisponibilidades pontuais podem ocorrer.',
    content: (
      <>
        <p>
          O PratoBy busca manter a plataforma disponível, segura e funcional, mas nenhum sistema online é totalmente imune a instabilidades, manutenções, falhas de internet, indisponibilidades de provedores externos, erros de configuração ou eventos fora do controle razoável da empresa.
        </p>
        <p>
          Sempre que possível, incidentes relevantes serão tratados com prioridade técnica. Ainda assim, o PratoBy não será responsável por lucros cessantes, perda de vendas, atrasos de entrega, reclamações de consumidores, falhas operacionais da loja ou decisões comerciais tomadas pelo lojista.
        </p>
        <p>
          O suporte será prestado pelos canais oficiais informados pela empresa, em horários e condições compatíveis com o plano contratado e com a fase atual do produto.
        </p>
      </>
    ),
  },
  {
    id: 'propriedade',
    title: '8. Propriedade Intelectual e Dados da Loja',
    shortTitle: 'Propriedade',
    icon: ShieldAlert,
    summary:
      'A tecnologia e a marca PratoBy pertencem ao PratoBy. Os dados comerciais da loja continuam ligados ao lojista.',
    content: (
      <>
        <p>
          A marca PratoBy, o design, os fluxos, o código, a arquitetura, os componentes, os textos institucionais, os recursos da plataforma e demais elementos do software são protegidos por direitos de propriedade intelectual.
        </p>
        <p>
          O lojista mantém os direitos sobre as informações comerciais que inserir na plataforma, como dados da loja, produtos, categorias, preços, descrições, pedidos e histórico operacional, respeitadas as regras de privacidade, segurança, retenção e funcionamento técnico do serviço.
        </p>
        <p>
          O uso da plataforma não transfere ao lojista qualquer direito sobre o código, infraestrutura, marca ou tecnologia do PratoBy, e também não autoriza cópia, engenharia reversa, revenda não autorizada ou criação de produto concorrente baseado no acesso ao sistema.
        </p>
      </>
    ),
  },
  {
    id: 'alteracoes',
    title: '9. Alterações dos Termos e Contato',
    shortTitle: 'Alterações',
    icon: FileText,
    summary:
      'Podemos atualizar estes Termos para acompanhar evolução do produto, exigências legais e melhorias de segurança.',
    content: (
      <>
        <p>
          O PratoBy poderá atualizar estes Termos para refletir novos recursos, mudanças operacionais, ajustes de segurança, alterações legais ou melhorias do produto. Quando a mudança for relevante, poderemos comunicar o lojista pelo painel, e-mail ou outro canal disponível.
        </p>
        <p>
          A continuidade de uso da plataforma após a atualização dos Termos será considerada aceite da nova versão, respeitados os direitos do usuário e as regras aplicáveis.
        </p>
        <p>
          Para dúvidas sobre estes Termos, fale com o PratoBy pelo e-mail <a href={`mailto:${SUPPORT_EMAIL}`} className="font-black text-[#f97316] hover:text-orange-600">{SUPPORT_EMAIL}</a>.
        </p>
      </>
    ),
  },
]

function getSectionLabel(section) {
  return section.shortTitle || section.title.replace(/^\d+\.\s*/, '')
}

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200

      for (const section of SECTIONS) {
        const el = document.getElementById(section.id)
        if (el && el.offsetTop <= scrollPosition && el.offsetTop + el.offsetHeight > scrollPosition) {
          setActiveSection(section.id)
          break
        }
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (!el) return

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: el.offsetTop - 110,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
    setActiveSection(id)
  }

  return (
    <MarketingLayout>
      <SEO
        title="Termos de Uso | PratoBy"
        description="Termos de uso do PratoBy para lojistas, restaurantes, clientes e usuários da plataforma."
        path="/termos"
      />

      <div className="w-full font-sans text-[#111827] selection:bg-orange-100 selection:text-[#f97316]">
        <nav className="w-full border-b border-gray-100 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="group flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-[#111827]">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              Voltar para o início
            </Link>
            <div className="text-sm font-black tracking-tight">
              Prato<span className="text-[#f97316]">By</span> <span className="font-medium text-gray-400">· Termos</span>
            </div>
          </div>
        </nav>

        <header className="border-b border-gray-100 bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                <Clock size={13} />
                Última atualização: {LAST_UPDATED}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#f97316]">
                <Scale size={13} />
                Sem comissão do PratoBy por pedido
              </div>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Termos de Uso
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-gray-500 sm:text-lg">
              Regras claras para o lojista vender direto pelo PratoBy, entender os limites da plataforma e usar o sistema com segurança, transparência e responsabilidade.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
            <aside className="sticky top-28 hidden rounded-3xl border border-gray-100 bg-white p-4 shadow-sm lg:block">
              <p className="mb-3 px-3 text-xs font-black uppercase tracking-wider text-gray-400">Navegação</p>
              <nav className="space-y-1" aria-label="Navegação dos termos de uso">
                {SECTIONS.map((section) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.id

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all ${
                        isActive
                          ? 'bg-orange-50 text-[#f97316]'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-[#111827]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon size={16} className={isActive ? 'text-[#f97316]' : 'text-gray-400'} />
                        <span className="truncate">{getSectionLabel(section)}</span>
                      </div>
                      {isActive && <ChevronRight size={14} className="text-[#f97316]" />}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="-mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-3 lg:hidden [&::-webkit-scrollbar]:hidden">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold shadow-sm ring-1 ring-gray-100 ${
                    activeSection === section.id
                      ? 'bg-[#111827] text-white ring-gray-900'
                      : 'bg-white text-gray-500'
                  }`}
                >
                  {getSectionLabel(section)}
                </button>
              ))}
            </div>

            <div className="space-y-10 lg:col-span-3">
              <div className="rounded-[2rem] border border-orange-100 bg-orange-50/40 p-5 text-sm font-semibold leading-relaxed text-orange-950 sm:p-6">
                <p>
                  <span className="font-black text-[#f97316]">Importante:</span> este texto foi escrito para ser claro para lojistas e clientes, mas não substitui revisão jurídica. Antes de publicar em produção, vale conferir CNPJ/razão social, canal de suporte, política comercial e versão dos termos usada no backend.
                </p>
              </div>

              {SECTIONS.map((section) => {
                const Icon = section.icon

                return (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-32 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-10"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#f97316]">
                        <Icon size={20} />
                      </div>
                      <h2 className="text-xl font-black text-[#111827] sm:text-2xl">{section.title}</h2>
                    </div>

                    <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs font-semibold leading-relaxed text-orange-950 sm:text-sm">
                      <span className="font-black text-[#f97316]">Em poucas palavras:</span> {section.summary}
                    </div>

                    <div className="space-y-4 text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
                      {section.content}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    </MarketingLayout>
  )
}
