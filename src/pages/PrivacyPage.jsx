import { useState, useEffect } from 'react'
import SEO from '../components/seo/SEO'
import MarketingLayout from './MarketingLayout'
import { Link } from 'react-router-dom'
import {
  Eye,
  Settings,
  Database,
  Lock,
  ArrowLeft,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'

const SECTIONS = [
  { id: 'coleta', title: '1. Informações que Coletamos', icon: Eye, summary: 'Coletamos dados cadastrais dos lojistas para faturamento e dados básicos dos clientes finais apenas para que o restaurante consiga processar e entregar o pedido.' },
  { id: 'uso', title: '2. Como Usamos os Dados', icon: Settings, summary: 'Os dados servem unicamente para fazer o sistema funcionar: emitir o pedido no painel ao vivo e calcular a taxa de entrega por bairro.' },
  { id: 'cookies', title: '3. Cookies e Armazenamento Local', icon: Database, summary: 'Usamos o localStorage do navegador do cliente para guardar o nome e endereço de forma segura, evitando que o cliente tenha de digitar tudo novamente no próximo pedido.' },
  { id: 'seguranca', title: '4. Segurança da Informação', icon: Lock, summary: 'Garantimos proteção reforçada através de firewalls e regras de segurança automatizadas na nuvem para blindar o acesso ao banco de dados.' },
  { id: 'direitos', title: '5. Direitos do Titular (LGPD)', icon: ShieldCheck, summary: 'Em conformidade total com a LGPD, o titular da conta ou cliente final pode pedir a alteração ou exclusão total dos seus dados a qualquer momento.' },
]

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('coleta')

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
        title="Privacidade | PratoBy"
        description="Política de privacidade do PratoBy e informações sobre tratamento de dados, pedidos, clientes e lojistas."
        path="/privacidade"
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
          
          {/* Contêiner Flex: items-center alinha na mesma linha, mb-6 afasta do título */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            
            {/* Badge 1 (Sem mb-4) */}
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500">
              <Clock size={13} />
              Última atualização: 19 de Maio de 2026
            </div>
            
            {/* Badge 2 (Sem mb-4) */}
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck size={13} />
              Em conformidade com a LGPD
            </div>

          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#111827]">
            Política de Privacidade
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-500 max-w-2xl font-medium leading-relaxed">
            Entenda detalhadamente como protegemos as suas informações operacionais e quais os dados coletados para a entrega de pedidos.
          </p>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* STICKY SIDEBAR NAVIGATION */}
          <aside className="sticky top-28 hidden lg:block bg-white border border-gray-100 p-4 rounded-3xl shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400 px-3 mb-3">Tópicos</p>
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

          {/* PRIVACY POLICY CONTENT */}
          <div className="lg:col-span-3 space-y-12">
            
            {/* SECTION 1 */}
            <section id="coleta" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <Eye size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">1. Informações que Coletamos</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[0].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Para o funcionamento regular da plataforma, coletamos dados em dois fluxos distintos:
                </p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                  <li><strong>Dados do Lojista:</strong> Nome completo, e-mail comercial, número de telefone, credenciais administrativas e informações para cobrança recorrente.</li>
                  <li><strong>Dados do Consumidor Final:</strong> Quando um cliente faz um pedido através do link do restaurante, solicitamos o nome, telefone de contato e dados de endereço completo (rua, número, CEP, complemento e bairro) essenciais para a rota de entrega.</li>
                </ul>
              </div>
            </section>

            {/* SECTION 2 */}
            <section id="uso" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <Settings size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">2. Como Usamos as Informações</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[1].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Não vendemos, compartilhamos ou alugamos dados pessoais para empresas de marketing terceiras. Toda a informação coletada é aplicada rigorosamente para os seguintes fins estruturais:
                </p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                  <li>Processar, validar e notificar os lojistas em tempo real sobre pedidos recebidos.</li>
                  <li>Calcular dinamicamente a taxa de entrega estipulada pelo lojista para o bairro correspondente do cliente.</li>
                  <li>Gerenciar o status de presença online da loja para a correta exibição do cardápio digital aos visitantes.</li>
                </ul>
              </div>
            </section>

            {/* SECTION 3 */}
            <section id="cookies" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <Database size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">3. Uso de Armazenamento Local e Cookies</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[2].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Para garantir uma experiência de checkout fluida e ágil (Experiência One-Click), usamos o mecanismo de <strong>localStorage</strong> do próprio navegador do dispositivo do usuário final.
                </p>
                <p>
                  Esse recurso permite armazenar localmente no celular do cliente as informações básicas inseridas no último pedido (como Nome e Endereço). Assim, o cliente não precisa reinserir todos os campos repetidamente a cada nova compra no mesmo restaurante. Estes dados permanecem armazenados estritamente na sandbox do navegador do usuário.
                </p>
              </div>
            </section>

            {/* SECTION 4 */}
            <section id="seguranca" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <Lock size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">4. Segurança da Informação</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[3].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  O PratoBy usa infraestrutura moderna baseada em cloud computing para o processamento das transações. Adotamos rígidos protocolos de criptografia de tráfego e firewalls ativos.
                </p>
                <p>
                  Todas as comunicações com as nossas bases de dados de armazenamento contam com regras automáticas severas de leitura e gravação server-side. Isso impede que terceiros mal-intencionados ou agentes externos consigam interceptar os logs operacionais ou desviar relatórios confidenciais de faturamento das lojas.
                </p>
              </div>
            </section>

            {/* SECTION 5 */}
            <section id="direitos" className="scroll-mt-32 bg-white border border-gray-100 p-6 sm:p-10 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#f97316] border border-orange-100">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827]">5. Direitos do Titular de Dados (LGPD)</h2>
              </div>
              
              <div className="mb-6 rounded-2xl border-l-4 border-orange-500 bg-orange-50/40 p-4 text-xs sm:text-sm font-semibold text-orange-950 leading-relaxed">
                <span className="font-black text-[#f97316]">Em poucas palavras:</span> {SECTIONS[4].summary}
              </div>

              <div className="prose text-sm sm:text-base text-gray-600 space-y-4 font-medium leading-relaxed">
                <p>
                  Em conformidade com as diretrizes legais vigentes da Lei Geral de Proteção de Dados (LGPD), asseguramos aos titulares todos os direitos fundamentais sobre as suas informações armazenadas na nuvem.
                </p>
                <p>
                  Você pode, a qualquer momento, entrar em contato com o nosso canal oficial de suporte para requerer a <strong>confirmação da existência de tratamento, a correção de dados incompletos ou a exclusão definitiva e total</strong> dos seus dados dos nossos servidores, sem custos ou burocracias desnecessárias.
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