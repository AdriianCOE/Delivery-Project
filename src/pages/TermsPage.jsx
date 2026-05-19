import { useState, useEffect } from 'react'
import SEO from '../components/seo/SEO'
import MarketingLayout from './MarketingLayout'
import { Link } from 'react-router-dom'
import {
  Clock,
  UserCheck,
  ShoppingBag,
  CreditCard,
  Scale,
  ArrowLeft,
  ShieldAlert,
  ChevronRight,
  FileText,
} from 'lucide-react'

const SECTIONS = [
  { id: 'aceitacao', title: '1. Aceitação dos Termos', icon: UserCheck, summary: 'Ao criar uma conta ou utilizar a plataforma PratoBy, está a concordar com as nossas regras de utilização.' },
  { id: 'servicos', title: '2. Descrição do Serviço', icon: ShoppingBag, summary: 'O PratoBy é um ecossistema de cardápio digital e gestão. Não cobramos comissões sobre as suas vendas e não intermediamos as entregas.' },
  { id: 'contas', title: '3. Registo e Segurança', icon: FileText, summary: 'É responsável por manter a segurança da sua palavra-passe e por todas as ações realizadas no seu painel administrativo.' },
  { id: 'pagamentos', title: '4. Subscrições e Cancelamento', icon: CreditCard, summary: 'Os planos são cobrados mensalmente. Pode cancelar a sua subscrição a qualquer momento, sem fidelizações ou multas.' },
  { id: 'responsabilidade', title: '5. Responsabilidades', icon: Scale, summary: 'Não nos responsabilizamos por problemas nas entregas, disputas financeiras com clientes ou falhas na ligação à internet da sua loja.' },
  { id: 'propriedade', title: '6. Propriedade Intelectual', icon: ShieldAlert, summary: 'O código, a tecnologia e a marca PratoBy pertencem-nos. Os dados das suas vendas e dos seus produtos são 100% seus.' },
]

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('aceitacao')

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
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 110,
        behavior: 'smooth',
      })
      setActiveSection(id)
    }
  }

  return (
    <MarketingLayout>
      <SEO
        title="Termos de Uso | PratoBy"
        description="Termos de uso do PratoBy para lojistas, restaurantes e usuários da plataforma."
        path="/termos"
      />

      <div className="w-full font-sans text-[#111827] selection:bg-orange-100 selection:text-[#f97316]">
        {/* HEADER NAV (Corrigido: agora rola junto com a página) */}
        <nav className="w-full border-b border-gray-100 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="group flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#111827] transition-colors">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              Voltar para a Home
            </Link>
            <div className="text-sm font-black tracking-tight">
              Prato<span className="text-[#f97316]">By</span> <span className="text-gray-400 font-medium">· Privacidade</span>
            </div>
          </div>
        </nav>

      {/* HERO SECTION */}
      <header className="bg-white border-b border-gray-100 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 mb-4">
            <Clock size={13} />
            Última atualização: 19 de Maio de 2026
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#111827]">
            Termos de Serviço
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-500 max-w-2xl font-medium leading-relaxed">
            Regras transparentes e sem letras miúdas sobre como funciona a nossa plataforma e a sua subscrição no PratoBy.
          </p>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* STICKY SIDEBAR NAVIGATION */}
          <aside className="sticky top-28 hidden lg:block bg-white border border-gray-100 p-4 rounded-3xl shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400 px-3 mb-3">Navegação</p>
            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-orange-50 text-[#f97316]'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-[#111827]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon size={16} className={isActive ? 'text-[#f97316]' : 'text-gray-400'} />
                      <span className="truncate">{section.title.split('. ')[1]}</span>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-[#f97316]" />}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* MOBILE QUICK MENU */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 [&::-webkit-scrollbar]:hidden shrink-0">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ring-1 ring-gray-100 shadow-sm ${
                  activeSection === section.id
                    ? 'bg-[#111827] text-white ring-gray-900'
                    : 'bg-white text-gray-500'
                }`}
              >
                {section.title.split('. ')[1]}
              </button>
            ))}
          </div>

          {/* LEGAL DOCUMENT CONTENT */}
          <div className="lg:col-span-3 space-y-12">
            
            {/* SECTION 1 */}
            <section id="aceitacao" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <UserCheck size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">1. Aceitação dos Termos</h2>
              </div>
              
              {/* Plain text box summary */}
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[0].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Ao aceder, registar-se ou utilizar o ecossistema PratoBy, está a celebrar um contrato vinculativo com a nossa empresa, aceitando integralmente as condições descritas neste documento.
                </p>
                <p>
                  Se não concordar com qualquer cláusula aqui presente, aconselhamos que interrompa de imediato a utilização do nosso software, painel administrativo e links de cardápio associados.
                </p>
              </div>
            </section>

            {/* SECTION 2 */}
            <section id="servicos" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <ShoppingBag size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">2. Descrição do Serviço</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[1].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  O PratoBy disponibiliza uma solução tecnológica de software como serviço (SaaS) focada na automação de pedidos e e-commerce para restaurantes e estabelecimentos comerciais do ramo da alimentação.
                </p>
                <p>
                  Reforçamos que o PratoBy <strong>não retém comissões por vendas</strong>. Toda e qualquer transação financeira efetuada (seja via Pix, dinheiro ou terminais de pagamento na entrega) é processada e destinada integralmente à conta do lojista, sem qualquer intermediação do nosso software.
                </p>
              </div>
            </section>

            {/* SECTION 3 */}
            <section id="contas" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <FileText size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">3. Registo e Segurança da Conta</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[2].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Para configurar a sua loja online, deve fornecer dados verídicos, precisos e atualizados (tais como nome do estabelecimento, e-mail de contacto corporativo e dados fiscais necessários).
                </p>
                <p>
                  É estritamente proibido partilhar as suas credenciais de acesso com terceiros não autorizados. Quaisquer prejuízos causados por má utilização das chaves de acesso serão da inteira responsabilidade do titular da conta.
                </p>
              </div>
            </section>

            {/* SECTION 4 */}
            <section id="pagamentos" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <CreditCard size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">4. Modelos de Planos e Cancelamento</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[3].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  A ativação das funcionalidades completas do painel operacional ocorre mediante a subscrição de um plano recorrente mensal, debitado automaticamente através do método escolhido no checkout administrativo.
                </p>
                <p>
                  O cancelamento pode ser acionado a qualquer momento diretamente na aba de faturação do seu painel. Não existem taxas ocultas de quebra de contrato. Após o cancelamento, o acesso ao painel de pedidos permanecerá ativo até ao término do ciclo de faturação já liquidado.
                </p>
              </div>
            </section>

            {/* SECTION 5 */}
            <section id="responsabilidade" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <Scale size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">5. Limitação de Responsabilidade</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[4].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  O PratoBy atua estritamente como fornecedor da ferramenta tecnológica de vendas. Não possuímos qualquer responsabilidade civil ou criminal sobre a qualidade dos produtos alimentares vendidos, atrasos na entrega efetuada pelos estafetas do estabelecimento ou desacordos comerciais entre a loja e o consumidor final.
                </p>
                <p>
                  A infraestrutura do servidor é monitorizada continuamente para manter uma taxa de uptime de 99.9%, porém, falhas pontuais causadas por indisponibilidade na rede global de internet ou operadoras locais não dão direito a indemnizações financeiras.
                </p>
              </div>
            </section>

            {/* SECTION 6 */}
            <section id="propriedade" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <ShieldAlert size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">6. Propriedade Intelectual e Dados</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[5].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Todos os elementos de design do software, identidade visual, estrutura do banco de dados e linhas de código fonte do PratoBy são propriedade intelectual exclusiva da nossa marca.
                </p>
                <p>
                  Por outro lado, <strong>a base de dados de clientes, histórico de faturamento e listas de produtos pertencem integralmente ao lojista</strong>, garantindo que o seu histórico comercial seja protegido e exportável de acordo com as diretrizes do mercado.
                </p>
              </div>
            </section>

          </div>
        </div>
      </main>
      </div>
  </MarketingLayout>
  )
}