import { useMemo, useState } from 'react'
import SEO from '../components/seo/SEO'
import { Link } from 'react-router-dom'
import {
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiLink,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiSend,
  FiShoppingBag,
  FiStar,
  FiUser,
  FiZap,
} from 'react-icons/fi'
import MarketingLayout from '../pages/MarketingLayout'

const CONTACT_EMAIL = 'contato@pratoby.com'
const CONTACT_WHATSAPP = '5579999786984'
const PUBLIC_STORE_BASE_URL = 'https://pratoby.com'

const plans = [
  {
    id: 'essencial',
    name: 'Essencial',
    price: 'R$ 49/mês',
    description: 'Para começar com cardápio digital e pedidos pelo WhatsApp.',
    features: ['Link exclusivo', 'Cardápio digital', 'Sem comissão'],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 'R$ 89/mês',
    description: 'Para vender com painel, cupons, taxas por bairro e gestão melhor.',
    features: ['Dashboard', 'Cupons', 'Taxa por bairro'],
    popular: true,
  },
  {
    id: 'white-label',
    name: 'White-label',
    price: 'R$ 149/mês',
    description: 'Para uma experiência mais premium e personalizada.',
    features: ['Visual premium', 'Domínio próprio', 'Suporte prioritário'],
  },
]

const benefits = [
  {
    title: 'Teste rápido',
    text: 'A gente te ajuda a validar com uma loja piloto antes de complicar a operação.',
  },
  {
    title: 'Configuração assistida',
    text: 'Você pode começar com cadastro acompanhado, link pronto e cardápio organizado.',
  },
  {
    title: 'Sem comissão',
    text: 'A venda acontece pelo seu próprio link e sem taxa em cima de cada pedido.',
  },
]

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
}

function buildWhatsAppLink({ name, business, phone, message, selectedPlan, publicStoreLink }) {
  const text = [
    'Olá! Vim pelo site do PratoBy.',
    '',
    name ? `Meu nome é ${name}.` : '',
    business ? `Minha loja/negócio: ${business}.` : '',
    phone ? `Meu WhatsApp: ${phone}.` : '',
    selectedPlan ? `Plano de interesse: ${selectedPlan.name} (${selectedPlan.price}).` : '',
    publicStoreLink ? `Prévia do link desejado: ${publicStoreLink}` : '',
    '',
    message || 'Quero saber mais sobre o cardápio digital e delivery.',
  ]
    .filter(Boolean)
    .join('\n')

  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`
}

function buildMailtoLink({ name, business, phone, message, selectedPlan, publicStoreLink }) {
  const subject = encodeURIComponent('Contato pelo site PratoBy')

  const body = encodeURIComponent(
    [
      'Olá, PratoBy!',
      '',
      name ? `Nome: ${name}` : '',
      business ? `Loja/negócio: ${business}` : '',
      phone ? `WhatsApp: ${phone}` : '',
      selectedPlan ? `Plano de interesse: ${selectedPlan.name} (${selectedPlan.price})` : '',
      publicStoreLink ? `Prévia do link desejado: ${publicStoreLink}` : '',
      '',
      message || 'Quero saber mais sobre o PratoBy.',
    ]
      .filter(Boolean)
      .join('\n')
  )

  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
}

function Input({ label, icon: Icon, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
        {label}
      </span>

      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        )}

        <input
          {...props}
          className={`h-14 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 ${
            Icon ? 'pl-11' : ''
          }`}
        />
      </div>
    </label>
  )
}

function PlanOption({ plan, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-[1.6rem] border p-4 text-left transition-all duration-300 ${
        active
          ? 'border-[#f97316] bg-orange-50 shadow-lg shadow-orange-600/10 ring-4 ring-orange-100'
          : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md'
      }`}
    >
      {plan.popular && (
        <span className="absolute right-4 top-4 rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Popular
        </span>
      )}

      <div className="flex items-start gap-3 pr-16">
        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            active
              ? 'border-[#f97316] bg-[#f97316] text-white'
              : 'border-gray-300 bg-white text-transparent'
          }`}
        >
          <FiCheck size={13} />
        </span>

        <div>
          <h3 className="text-base font-black text-[#111827]">{plan.name}</h3>

          <p className="mt-1 text-sm font-black text-[#f97316]">
            {plan.price}
          </p>

          <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280]">
            {plan.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.features.map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-gray-100 bg-white px-3 py-1 text-[11px] font-black text-[#6b7280]"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  )
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    business: '',
    phone: '',
    message: '',
    planId: 'profissional',
  })

  const [emailCopied, setEmailCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.planId) || plans[1],
    [form.planId]
  )

  const storeSlug = useMemo(() => {
    const generated = slugify(form.business)
    return generated || 'sua-loja'
  }, [form.business])

  const publicStoreLink = useMemo(() => {
    return `${PUBLIC_STORE_BASE_URL}/${storeSlug}`
  }, [storeSlug])

  const whatsappLink = useMemo(
    () =>
      buildWhatsAppLink({
        ...form,
        selectedPlan,
        publicStoreLink,
      }),
    [form, selectedPlan, publicStoreLink]
  )

  const mailtoLink = useMemo(
    () =>
      buildMailtoLink({
        ...form,
        selectedPlan,
        publicStoreLink,
      }),
    [form, selectedPlan, publicStoreLink]
  )

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function copyToClipboard(value, callback) {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API indisponível')
      }

      await navigator.clipboard.writeText(value)
      callback(true)
      window.setTimeout(() => callback(false), 2200)
    } catch {
      callback(false)
    }
  }

return (
    <>
      <SEO title="Contato | PratoBy" />
      <MarketingLayout>
        
        <div className="w-full animate-[fadeIn_0.4s_ease-out]">
          
          <header className="relative overflow-hidden border-b border-gray-100 bg-white">
        <div className="absolute -left-40 top-32 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl" />
        <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#f9fafb]" />

        <div className="relative mx-auto grid max-w-7xl items-start gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-20">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
              <FiZap />
              Fale com o PratoBy
            </span>

            <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-tight text-[#111827] sm:text-6xl lg:text-7xl">
              Vamos montar o{' '}
              <span className="text-[#f97316]">cardápio da sua loja?</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg lg:mx-0">
              Preencha os dados, escolha o plano de interesse e envie uma mensagem
              pronta pelo WhatsApp ou e-mail. A ideia é deixar o primeiro contato
              rápido, organizado e sem enrolação.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-[1.7rem] border border-orange-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-900/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiMessageCircle size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#111827]">WhatsApp</p>
                  <p className="mt-1 text-sm font-semibold text-[#6b7280]">
                    Melhor para começar rápido.
                  </p>
                </div>

                <FiArrowRight className="text-[#f97316] transition group-hover:translate-x-1" />
              </a>

              <a
                href={mailtoLink}
                className="group flex items-center gap-4 rounded-[1.7rem] border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-orange-900/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-[#111827]">
                  <FiMail size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#111827]">E-mail</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#6b7280]">
                    {CONTACT_EMAIL}
                  </p>
                </div>

                <FiArrowRight className="text-[#f97316] transition group-hover:translate-x-1" />
              </a>
            </div>

            <div className="mt-8 rounded-[2rem] border border-gray-100 bg-[#f9fafb] p-5 text-left lg:max-w-xl">
              <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
                <FiShoppingBag className="text-[#f97316]" />
                Resumo do interesse
              </p>

              <div className="mt-4 grid gap-3 text-sm font-bold text-[#6b7280]">
                <div className="flex items-center justify-between gap-4">
                  <span>Plano escolhido</span>
                  <span className="text-right font-black text-[#111827]">
                    {selectedPlan.name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Investimento</span>
                  <span className="text-right font-black text-[#f97316]">
                    {selectedPlan.price}
                  </span>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                    Prévia do link
                  </p>

                  <p className="mt-1 break-all text-sm font-black leading-5 text-[#111827]">
                    {publicStoreLink.replace('https://', '')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            id="formulario"
            className="rounded-[2.5rem] border border-gray-100 bg-white p-5 shadow-2xl shadow-gray-200/80 sm:p-6 lg:p-8"
          >
            <div className="rounded-[2rem] bg-[#111827] p-6 text-white">
              <p className="text-sm font-black uppercase tracking-wide text-orange-300">
                Pré-atendimento
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight">
                Monte sua solicitação
              </h2>

              <p className="mt-3 text-sm font-semibold leading-6 text-white/60">
                Essas informações já entram na mensagem enviada para o contato.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Seu nome"
                  icon={FiUser}
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Ex: Adrian"
                  autoComplete="name"
                />

                <Input
                  label="Seu WhatsApp"
                  icon={FiPhone}
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="(79) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <Input
                label="Nome da loja"
                icon={FiMapPin}
                value={form.business}
                onChange={(event) => updateField('business', event.target.value)}
                placeholder="Ex: Capivaras Lanches"
                autoComplete="organization"
              />

              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Prévia do link
                </span>

                <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                        <FiLink />
                        Link sugerido
                      </p>

                      <p className="mt-2 break-all text-base font-black leading-6 text-[#111827]">
                        {publicStoreLink.replace('https://', '')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(publicStoreLink, setLinkCopied)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-[#111827] shadow-sm transition hover:text-[#f97316]"
                    >
                      <FiCopy />
                      {linkCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>

                  <p className="mt-3 text-xs font-semibold leading-5 text-[#9a3412]">
                    Essa é só uma prévia automática. O link final pode ser ajustado
                    antes da publicação.
                  </p>
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Escolha de plano
                </span>

                <div className="grid gap-3">
                  {plans.map((plan) => (
                    <PlanOption
                      key={plan.id}
                      plan={plan}
                      active={form.planId === plan.id}
                      onClick={() => updateField('planId', plan.id)}
                    />
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Mensagem
                </span>

                <textarea
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  placeholder="Quero testar o PratoBy na minha loja..."
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-bold leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-6 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                >
                  <FiSend />
                  Enviar no WhatsApp
                </a>

                <a
                  href={mailtoLink}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-4 text-sm font-black text-[#111827] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
                >
                  <FiMail />
                  Enviar e-mail
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
              Por que começar agora
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
              Um caminho simples para vender pelo seu próprio link
            </h2>
          </div>

          <p className="max-w-xl text-sm font-semibold leading-6 text-[#6b7280]">
            Você não precisa montar um app completo para começar. O PratoBy cria
            uma experiência moderna, rápida e fácil de divulgar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                <FiCheckCircle size={22} />
              </div>

              <p className="mt-5 text-lg font-black text-[#111827]">
                {item.title}
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-[2.5rem] border border-orange-100 bg-[#fff7ed] p-8 shadow-sm sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-[#f97316]">
                <FiStar />
                Ainda quer ver antes de chamar?
              </p>

              <h3 className="mt-3 text-2xl font-black text-[#111827] sm:text-3xl">
                Veja os planos ou fale direto pelo WhatsApp
              </h3>

              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#6b7280]">
                Compare os pacotes, tire dúvidas e comece com uma loja piloto antes
                de depender de marketplace ou aplicativo próprio.
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

              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
              >
                Chamar no WhatsApp
                <FiMessageCircle size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => copyToClipboard(CONTACT_EMAIL, setEmailCopied)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-200 hover:text-[#f97316]"
          >
            <FiCopy />
            {emailCopied ? 'E-mail copiado' : `Copiar ${CONTACT_EMAIL}`}
          </button>
        </div>
      </section>
      </div>
      </MarketingLayout>
    </>
  )
}