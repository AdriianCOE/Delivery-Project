import { Link, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiArrowRight,
  FiCompass,
  FiHome,
  FiMail,
  FiMapPin,
  FiSearch,
  FiSettings,
} from 'react-icons/fi'
import MarketingLayout from '../pages/MarketingLayout'
import SEO from '../components/seo/SEO'

const suggestions = [
  {
    label: 'Página inicial',
    to: '/',
    icon: FiHome,
    description: 'Volte para a apresentação do PratoBy e veja como funciona.',
  },
  {
    label: 'Planos',
    to: '/planos',
    icon: FiMapPin,
    description: 'Compare os planos para sua loja começar a vender pelo próprio link.',
  },
  {
    label: 'Contato',
    to: '/contato',
    icon: FiMail,
    description: 'Fale com a gente para montar o cardápio digital da sua loja.',
  },
  {
    label: 'Painel do lojista',
    to: '/dashboard',
    icon: FiSettings,
    description: 'Acesse pedidos, produtos, categorias e configurações da loja.',
  },
]

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <>
      <SEO
        title="Página não encontrada | PratoBy"
        description="A página que você tentou acessar não foi encontrada no PratoBy. Volte para o início, veja os planos ou fale com nosso atendimento."
        path="/404"
        noIndex
        noFollow
      />

      <MarketingLayout>
      <section className="relative overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-16 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl" />
          <div className="absolute -right-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-amber-100/70 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
              <FiCompass />
              Rota não encontrada
            </div>

            <h1 className="mt-7 text-6xl font-black tracking-tighter text-[#111827] sm:text-7xl lg:text-8xl">
              Erro <span className="text-[#f97316]">404</span>
            </h1>

            <p className="mt-6 max-w-xl text-xl font-black leading-8 text-[#111827] sm:text-2xl sm:leading-10">
              Essa página saiu para entrega, mas parece que pegou o endereço errado.
            </p>

            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280] sm:text-base sm:leading-8">
              O link pode estar incompleto, a página pode ter mudado ou essa rota ainda não existe no PratoBy. Confira o endereço ou volte para uma das áreas principais.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-6 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-1 hover:bg-[#ea580c] active:scale-95"
              >
                Ir para início
                <FiArrowRight />
              </Link>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316] active:scale-95"
              >
                <FiArrowLeft />
                Voltar página
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-2xl shadow-orange-900/5 sm:p-6 lg:p-8">
            <div className="rounded-[1.6rem] border border-orange-100 bg-orange-50/70 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#f97316] shadow-sm">
                  <FiSearch size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#111827]">
                    Para onde você quer ir?
                  </h2>

                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                    Escolha uma opção abaixo para continuar navegando pelo PratoBy.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {suggestions.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-center gap-4 rounded-[1.4rem] border border-gray-100 bg-[#f9fafb] p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-100 hover:bg-white hover:shadow-lg hover:shadow-orange-900/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#f97316] shadow-sm transition group-hover:bg-orange-50">
                      <Icon size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#111827]">
                        {item.label}
                      </p>

                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        {item.description}
                      </p>
                    </div>

                    <FiArrowRight className="hidden shrink-0 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#f97316] sm:block" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      </MarketingLayout>
    </>
  )
}