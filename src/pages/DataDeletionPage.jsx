import SEO from '../components/seo/SEO'
import { buildBreadcrumbJsonLd } from '../components/seo/seoConfig'
import MarketingLayout from './MarketingLayout'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft as ArrowLeft,
  FiCheckCircle as CheckCircle,
  FiClock as Clock,
  FiFileText as FileText,
  FiMail as Mail,
  FiShield as Shield,
  FiUserCheck as UserCheck,
} from 'react-icons/fi'

const SUPPORT_EMAIL = 'contato@pratoby.com'
const EMAIL_SUBJECT = 'Exclusão de dados'
const MAILTO_LINK = `mailto:${SUPPORT_EMAIL}?subject=Exclus%C3%A3o%20de%20dados`

const REQUEST_DATA = [
  'nome completo;',
  'e-mail usado na conta;',
  'telefone/WhatsApp vinculado, se aplicável;',
  'nome da loja, se aplicável;',
  'descrição da solicitação.',
]

export default function DataDeletionPage() {
  return (
    <MarketingLayout>
      <SEO
        title="Exclusão de dados do usuário | PratoBy"
        description="Saiba como solicitar exclusão, correção ou anonimização de dados pessoais tratados pelo PratoBy."
        path="/data-deletion"
        structuredData={buildBreadcrumbJsonLd([
          { name: 'Início', path: '/' },
          { name: 'Exclusão de dados do usuário', path: '/data-deletion' },
        ])}
      />

      <div className="w-full font-sans text-[#111827] selection:bg-orange-100 selection:text-[#f97316]">
        <nav className="w-full border-b border-gray-100 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="group flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-[#111827]">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
              Voltar para o início
            </Link>
            <div className="text-sm font-black tracking-tight">
              Prato<span className="text-[#f97316]">By</span> <span className="font-medium text-gray-400">· Dados do usuário</span>
            </div>
          </div>
        </nav>

        <header className="border-b border-gray-100 bg-white px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <Shield size={13} />
                Direitos do titular
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500">
                <Clock size={13} />
                Prazo estimado: até 15 dias úteis
              </div>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Exclusão de dados do usuário
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-gray-500 sm:text-lg">
              Usuários, clientes finais e lojistas podem solicitar exclusão, correção ou anonimização de dados pessoais tratados pelo PratoBy.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="space-y-8">
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#f97316]">
                    <Mail size={20} />
                  </div>
                  <h2 className="text-xl font-black text-[#111827] sm:text-2xl">Como solicitar</h2>
                </div>

                <div className="space-y-4 text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
                  <p>
                    Para solicitar exclusão, correção ou anonimização de dados pessoais, envie um e-mail para{' '}
                    <a href={MAILTO_LINK} className="font-black text-[#f97316] hover:text-orange-600">
                      {SUPPORT_EMAIL}
                    </a>{' '}
                    com o assunto <strong>{EMAIL_SUBJECT}</strong>.
                  </p>
                  <p>
                    O pedido será analisado após validação da titularidade ou da autorização para representar a pessoa titular dos dados. Podemos solicitar informações adicionais quando necessário para proteger a segurança da conta e evitar atendimento indevido.
                  </p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#f97316]">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-xl font-black text-[#111827] sm:text-2xl">Dados que devem ser informados</h2>
                </div>

                <p className="mb-5 text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
                  Para localizar os dados corretamente, inclua no e-mail:
                </p>

                <ul className="grid gap-3 text-sm font-semibold text-gray-600 sm:text-base">
                  {REQUEST_DATA.map((item) => (
                    <li key={item} className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                      <CheckCircle size={18} className="mt-0.5 shrink-0 text-[#f97316]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#f97316]">
                    <UserCheck size={20} />
                  </div>
                  <h2 className="text-xl font-black text-[#111827] sm:text-2xl">Prazo e possíveis retenções</h2>
                </div>

                <div className="space-y-4 text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
                  <p>
                    O prazo estimado para resposta e execução da solicitação é de até <strong>15 dias úteis</strong> após a validação da titularidade.
                  </p>
                  <p>
                    Alguns dados podem ser mantidos quando houver obrigação legal ou fiscal, prevenção à fraude, segurança da plataforma, cumprimento contratual, exercício regular de direitos ou defesa de direitos em processos administrativos, judiciais ou arbitrais.
                  </p>
                  <p>
                    A exclusão de dados pode afetar o acesso à conta, histórico operacional, recursos do painel ou atendimento de pedidos, conforme a natureza dos dados solicitados.
                  </p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-orange-100 bg-orange-50/40 p-6 shadow-sm sm:p-10">
                <h2 className="text-xl font-black text-[#111827] sm:text-2xl">Documentos relacionados</h2>
                <p className="mt-3 text-sm font-medium leading-relaxed text-orange-950 sm:text-base">
                  Para mais detalhes sobre tratamento de dados e regras de uso da plataforma, consulte a{' '}
                  <Link to="/privacy" className="font-black text-[#f97316] hover:text-orange-600">
                    Política de Privacidade
                  </Link>{' '}
                  e os{' '}
                  <Link to="/terms" className="font-black text-[#f97316] hover:text-orange-600">
                    Termos de Uso
                  </Link>
                  .
                </p>
              </section>
            </div>

            <aside className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-28">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">Solicitação por e-mail</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-[#111827]">
                Envie sua solicitação
              </h2>
              <div className="mt-5 space-y-3 text-sm font-semibold leading-relaxed text-gray-600">
                <p>
                  <span className="font-black text-[#111827]">E-mail:</span>{' '}
                  <a href={MAILTO_LINK} className="text-[#f97316] hover:text-orange-600">
                    {SUPPORT_EMAIL}
                  </a>
                </p>
                <p>
                  <span className="font-black text-[#111827]">Assunto sugerido:</span> {EMAIL_SUBJECT}
                </p>
              </div>

              <a
                href={MAILTO_LINK}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[linear-gradient(135deg,#fb923c_0%,#f97316_45%,#f59e0b_100%)] px-6 text-sm font-black text-white shadow-[0_12px_30px_rgba(249,115,22,.32)] transition hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(249,115,22,.42)] active:translate-y-0 active:scale-[0.98]"
              >
                <Mail size={16} />
                Enviar e-mail
              </a>
            </aside>
          </div>
        </main>
      </div>
    </MarketingLayout>
  )
}
