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

const LAST_UPDATED = '24 de maio de 2026'
const SUPPORT_EMAIL = 'contato@pratoby.com'

const SECTIONS = [
  {
    id: 'escopo',
    title: '1. Escopo desta Política',
    shortTitle: 'Escopo',
    icon: Eye,
    summary:
      'Esta Política explica como o PratoBy trata dados de lojistas, usuários do painel e clientes finais que fazem pedidos nas lojas publicadas.',
    content: (
      <>
        <p>
          Esta Política de Privacidade se aplica ao uso do PratoBy, incluindo painel administrativo, loja pública, cardápio digital, checkout, notificações, páginas institucionais e demais recursos relacionados à operação da plataforma.
        </p>
        <p>
          O PratoBy é uma plataforma SaaS para que estabelecimentos de alimentação vendam diretamente para seus clientes. Por isso, alguns dados são tratados para permitir que o lojista configure a loja, receba pedidos, acompanhe a operação e mantenha seu histórico comercial.
        </p>
        <p>
          Quando o consumidor final faz um pedido pelo link de uma loja, os dados informados são usados para viabilizar aquele pedido e ficam relacionados à operação do lojista responsável pelo atendimento, preparo, cobrança e entrega.
        </p>
      </>
    ),
  },
  {
    id: 'coleta',
    title: '2. Informações que Coletamos',
    shortTitle: 'Dados coletados',
    icon: Database,
    summary:
      'Coletamos somente os dados necessários para criar a loja, processar pedidos, calcular entrega, enviar notificações e manter a segurança da plataforma.',
    content: (
      <>
        <p>
          Para fazer o PratoBy funcionar, podemos coletar e tratar diferentes tipos de dados, conforme o perfil de uso:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Dados do lojista e da conta:</strong> nome, e-mail, telefone, credenciais de acesso, dados da loja, configurações operacionais, informações de cobrança e histórico de assinatura.
          </li>
          <li>
            <strong>Dados da loja pública:</strong> nome do estabelecimento, slug/link público, endereço ou área de atendimento, horários, produtos, categorias, preços, adicionais, imagens, cupons e taxas configuradas pelo lojista.
          </li>
          <li>
            <strong>Dados do consumidor final:</strong> nome, telefone, itens do pedido, observações, forma de pagamento escolhida, endereço, número, complemento, bairro e CEP, quando necessários para retirada, entrega ou contato sobre o pedido.
          </li>
          <li>
            <strong>Dados técnicos e de segurança:</strong> endereço IP, identificadores de sessão, informações do navegador, logs de erro, eventos de autenticação, tokens de notificação e registros necessários para prevenir abuso, fraude e instabilidade.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'uso',
    title: '3. Como Usamos os Dados',
    shortTitle: 'Uso dos dados',
    icon: Settings,
    summary:
      'Os dados são usados para operar o sistema: exibir cardápio, criar pedidos, avisar o lojista, calcular taxas e manter o serviço seguro.',
    content: (
      <>
        <p>
          Não vendemos dados pessoais. Usamos as informações coletadas para finalidades ligadas ao funcionamento do PratoBy e à prestação do serviço contratado pelo lojista.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>criar e manter a conta do lojista;</li>
          <li>publicar a loja, cardápio, produtos, preços, cupons e configurações comerciais;</li>
          <li>processar pedidos enviados pelo consumidor final e exibi-los no painel do lojista;</li>
          <li>calcular taxa de entrega por bairro, CEP ou regra definida pela loja;</li>
          <li>enviar notificações transacionais sobre novos pedidos, status, assinatura, trial, alertas operacionais e suporte;</li>
          <li>prevenir fraudes, abuso, spam, scraping indevido, tentativas de invasão e uso fora das regras da plataforma;</li>
          <li>melhorar estabilidade, desempenho, segurança e experiência de uso do produto.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'compartilhamento',
    title: '4. Compartilhamento com Terceiros',
    shortTitle: 'Terceiros',
    icon: ShieldCheck,
    summary:
      'Compartilhamos dados apenas quando necessário para infraestrutura, cobrança, e-mails, notificações, suporte, obrigação legal ou operação do pedido.',
    content: (
      <>
        <p>
          O PratoBy pode utilizar provedores de tecnologia para hospedar dados, autenticar usuários, processar cobrança, enviar e-mails transacionais, entregar notificações push, monitorar erros e manter a plataforma funcionando.
        </p>
        <p>
          Esses provedores recebem apenas os dados necessários para executar suas funções e devem observar medidas adequadas de segurança, confidencialidade e proteção de dados.
        </p>
        <p>
          Também podemos compartilhar informações quando necessário para cumprir obrigação legal, atender ordem de autoridade competente, investigar fraude, proteger direitos do PratoBy, do lojista, do consumidor final ou de terceiros.
        </p>
      </>
    ),
  },
  {
    id: 'armazenamento-local',
    title: '5. Cookies, LocalStorage e Preferências',
    shortTitle: 'Cookies',
    icon: Database,
    summary:
      'Usamos armazenamento local e recursos do navegador para lembrar preferências, facilitar o checkout e manter sessões de uso.',
    content: (
      <>
        <p>
          Podemos usar cookies, localStorage e tecnologias semelhantes para manter sessão, lembrar preferências, melhorar a experiência do checkout e evitar que o cliente precise digitar os mesmos dados repetidamente no mesmo dispositivo.
        </p>
        <p>
          Dados salvos localmente ficam no navegador ou dispositivo utilizado. Se o aparelho for compartilhado com outras pessoas, recomendamos limpar os dados do navegador ou evitar salvar informações pessoais no checkout.
        </p>
        <p>
          O usuário pode bloquear cookies ou apagar dados locais pelas configurações do navegador. Algumas funções, como login, carrinho, checkout, preferências e notificações, podem deixar de funcionar corretamente se esses recursos forem bloqueados.
        </p>
      </>
    ),
  },
  {
    id: 'seguranca',
    title: '6. Segurança e Retenção',
    shortTitle: 'Segurança',
    icon: Lock,
    summary:
      'Adotamos medidas técnicas e operacionais para proteger os dados, mas nenhum sistema online é totalmente imune a riscos.',
    content: (
      <>
        <p>
          O PratoBy adota medidas técnicas e organizacionais para proteger dados contra acessos não autorizados, alterações indevidas, perda, uso abusivo e exposição desnecessária. Isso inclui controles de acesso, autenticação, regras de segurança, logs, segregação de permissões e monitoramento operacional.
        </p>
        <p>
          Apesar desses cuidados, nenhum serviço digital é 100% livre de riscos. Por isso, também recomendamos que lojistas usem senhas fortes, protejam seus dispositivos, evitem compartilhar credenciais e revisem permissões de acesso sempre que necessário.
        </p>
        <p>
          Os dados são mantidos pelo tempo necessário para prestar o serviço, cumprir obrigações legais, resolver disputas, prevenir fraude, manter histórico operacional da loja ou atender solicitações legítimas de suporte e auditoria.
        </p>
      </>
    ),
  },
  {
    id: 'direitos',
    title: '7. Direitos do Titular de Dados',
    shortTitle: 'Direitos LGPD',
    icon: ShieldCheck,
    summary:
      'Titulares podem solicitar confirmação, acesso, correção, exclusão, portabilidade e outras medidas previstas na LGPD.',
    content: (
      <>
        <p>
          Nos termos da Lei Geral de Proteção de Dados, titulares podem solicitar informações e providências sobre seus dados pessoais, incluindo confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento quando aplicável.
        </p>
        <p>
          Para exercer seus direitos, entre em contato pelo e-mail <a href={`mailto:${SUPPORT_EMAIL}`} className="font-black text-[#f97316] hover:text-orange-600">{SUPPORT_EMAIL}</a>. Dependendo do tipo de dado e da relação com o pedido, poderemos solicitar informações adicionais para confirmar identidade ou direcionar a solicitação ao lojista responsável pela relação com o consumidor final.
        </p>
        <p>
          Algumas solicitações podem não ser atendidas integralmente quando houver obrigação legal de retenção, necessidade de prevenção à fraude, exercício regular de direitos, cumprimento de contrato ou outra base legal aplicável.
        </p>
      </>
    ),
  },
  {
    id: 'alteracoes',
    title: '8. Alterações desta Política',
    shortTitle: 'Alterações',
    icon: Clock,
    summary:
      'Esta Política pode ser atualizada para acompanhar mudanças no produto, na operação, em provedores ou na legislação.',
    content: (
      <>
        <p>
          Podemos atualizar esta Política de Privacidade para refletir novos recursos, mudanças técnicas, alterações de fornecedores, ajustes de segurança, exigências legais ou evolução do PratoBy.
        </p>
        <p>
          Quando a alteração for relevante, poderemos comunicar os lojistas pelo painel, e-mail ou outro canal disponível. A versão mais recente ficará sempre publicada nesta página.
        </p>
      </>
    ),
  },
]

function getSectionLabel(section) {
  return section.shortTitle || section.title.replace(/^\d+\.\s*/, '')
}

export default function PrivacyPage() {
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
        title="Política de Privacidade | PratoBy"
        description="Política de privacidade do PratoBy sobre dados de lojistas, clientes, pedidos, notificações, segurança e direitos previstos na LGPD."
        path="/privacidade"
      />

      <div className="w-full font-sans text-[#111827] selection:bg-orange-100 selection:text-[#f97316]">
        <nav className="w-full border-b border-gray-100 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="group flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-[#111827]">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              Voltar para o início
            </Link>
            <div className="text-sm font-black tracking-tight">
              Prato<span className="text-[#f97316]">By</span> <span className="font-medium text-gray-400">· Privacidade</span>
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
              <div className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <ShieldCheck size={13} />
                Alinhada à LGPD
              </div>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Política de Privacidade
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-gray-500 sm:text-lg">
              Entenda como o PratoBy usa dados para manter sua loja funcionando, entregar pedidos com segurança e respeitar os direitos de lojistas e consumidores.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
            <aside className="sticky top-28 hidden rounded-3xl border border-gray-100 bg-white p-4 shadow-sm lg:block">
              <p className="mb-3 px-3 text-xs font-black uppercase tracking-wider text-gray-400">Tópicos</p>
              <nav className="space-y-1" aria-label="Navegação da política de privacidade">
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
              <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/60 p-5 text-sm font-semibold leading-relaxed text-emerald-950 sm:p-6">
                <p>
                  <span className="font-black text-emerald-700">Transparência prática:</span> o PratoBy usa dados para o pedido chegar ao painel certo, para o lojista atender o cliente e para manter a plataforma segura. Não vendemos dados pessoais.
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
