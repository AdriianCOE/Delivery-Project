import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import SEO from '../components/seo/SEO'
import MarketingLayout from '../pages/MarketingLayout'
import {
  FiArrowRight,
  FiAward,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiLink,
  FiMail,
  FiMessageCircle,
  FiMonitor,
  FiPhone,
  FiSend,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiTrendingUp,
  FiUser,
  FiZap,
} from 'react-icons/fi'

const CONTACT_EMAIL = 'contato@pratoby.com'
const CONTACT_WHATSAPP = '5579999786984'
const PUBLIC_STORE_BASE_URL = 'https://pratoby.com'

const plans = [
  {
    id: 'essencial',
    name: 'Essencial',
    subtitle: 'Para começar a vender online',
    price: 'R$ 59/mês',
    commission: '+ 0% de comissão por venda',
    icon: FiZap,
    features: [
      'Cardápio digital ilimitado',
      'Pedidos em tempo real',
      'Link próprio da loja',
      'Sem taxa por pedido',
      'Painel de controle',
      'Horários automáticos',
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    subtitle: 'Mais escolhido pelos lojistas',
    price: 'R$ 89/mês',
    commission: '+ 0% de comissão por venda',
    icon: FiStar,
    popular: true,
    features: [
      'Tudo do Essencial',
      'Cupons de desconto',
      'Taxa por bairro',
      'Campos personalizados',
      'Relatórios avançados',
      'WhatsApp integrado',
      'Suporte prioritário',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Para quem quer vender mais',
    price: 'R$ 159/mês',
    commission: '+ 0% de comissão por venda',
    icon: FiAward,
    features: [
      'Tudo do Profissional',
      'Multi-loja até 3 unidades',
      'API de integração',
      'Domínio personalizado',
      'Marca branca',
      'Gerente de conta dedicado',
    ],
  },
]

const benefits = [
  {
    icon: FiShield,
    title: '0% comissão',
    text: 'Venda direto pelo seu próprio link, sem taxa por pedido.',
  },
  {
    icon: FiClock,
    title: 'Pedido em tempo real',
    text: 'Receba e acompanhe tudo pelo painel do lojista.',
  },
  {
    icon: FiMonitor,
    title: 'Operação simples',
    text: 'Cardápio, status, pagamento e contato em um só lugar.',
  },
]

const contactSteps = [
  'Você informa os dados da loja',
  'A gente entende o melhor plano',
  'Sua loja começa a vender pelo link',
]

function slugify(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
}

function buildWhatsAppLink({
  name,
  business,
  phone,
  message,
  selectedPlan,
  publicStoreLink,
}) {
  const text = [
    'Olá! Vim pelo site do PratoBy.',
    '',
    name ? `Meu nome é ${name}.` : '',
    business ? `Minha loja: ${business}.` : '',
    phone ? `Meu WhatsApp: ${phone}.` : '',
    selectedPlan
      ? `Plano de interesse: ${selectedPlan.name} (${selectedPlan.price} ${selectedPlan.commission}).`
      : '',
    publicStoreLink ? `Prévia do link desejado: ${publicStoreLink}` : '',
    '',
    message ||
      'Quero saber como começar a vender online com loja própria e 0% comissão por venda.',
  ]
    .filter(Boolean)
    .join('\n')

  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`
}

function buildMailtoLink({
  name,
  business,
  phone,
  message,
  selectedPlan,
  publicStoreLink,
}) {
  const subject = encodeURIComponent('Contato pelo site PratoBy')

  const body = encodeURIComponent(
    [
      'Olá, PratoBy!',
      '',
      name ? `Nome: ${name}` : '',
      business ? `Loja: ${business}` : '',
      phone ? `WhatsApp: ${phone}` : '',
      selectedPlan
        ? `Plano de interesse: ${selectedPlan.name} (${selectedPlan.price} ${selectedPlan.commission})`
        : '',
      publicStoreLink ? `Prévia do link desejado: ${publicStoreLink}` : '',
      '',
      message ||
        'Quero saber como começar a vender online com loja própria e 0% comissão por venda.',
    ]
      .filter(Boolean)
      .join('\n'),
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
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
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
  const Icon = plan.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative rounded-[1.45rem] border p-4 text-left transition-all duration-300',
        active
          ? 'border-[#f97316] bg-orange-50 shadow-lg shadow-orange-600/10 ring-4 ring-orange-100'
          : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md',
      ].join(' ')}
    >
      {plan.popular && (
        <span className="absolute right-4 top-4 rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Mais popular
        </span>
      )}

      <div className="flex items-start gap-3 pr-20">
        <span
          className={[
            'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            active
              ? 'bg-[#f97316] text-white shadow-md shadow-orange-600/20'
              : 'bg-orange-50 text-[#f97316]',
          ].join(' ')}
        >
          <Icon size={18} />
        </span>

        <div>
          <h3 className="text-base font-black text-[#111827]">{plan.name}</h3>

          <p className="mt-1 text-xs font-bold text-[#6b7280]">
            {plan.subtitle}
          </p>

          <p className="mt-2 text-sm font-black text-[#f97316]">
            {plan.price}
          </p>

          <p className="mt-1 text-[11px] font-black text-[#f97316]">
            {plan.commission}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.features.slice(0, 3).map((feature) => (
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
    [form.planId],
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
    [form, selectedPlan, publicStoreLink],
  )

  const mailtoLink = useMemo(
    () =>
      buildMailtoLink({
        ...form,
        selectedPlan,
        publicStoreLink,
      }),
    [form, selectedPlan, publicStoreLink],
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
      <SEO
        title="Contato | PratoBy"
        description="Fale com o PratoBy para criar sua loja online própria, receber pedidos em tempo real e vender com 0% comissão por venda."
        path="/contato"
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white">
            <div className="pointer-events-none absolute -left-40 top-28 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -right-40 top-36 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-b from-transparent to-[#f9fafb]" />

            <div className="relative mx-auto grid max-w-7xl items-start gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="text-center lg:text-left"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
                  <FiMessageCircle size={15} />
                  Fale com o PratoBy
                </span>

                <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  Vamos colocar sua loja para{' '}
                  <span className="text-[#f97316]">vender online?</span>
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg lg:mx-0">
                  Envie seus dados e receba um atendimento direto para escolher o
                  melhor plano e começar com loja própria, pedidos em tempo real e
                  0% comissão por venda.
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {[
                    'Loja própria',
                    '0% comissão',
                    'Pedidos em tempo real',
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316]"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-xl">
                  {benefits.map((item, index) => {
                    const Icon = item.icon

                    return (
                      <motion.article
                        key={item.title}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.12 + index * 0.08 }}
                        className="rounded-[1.5rem] border border-gray-100 bg-white p-4 text-left shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                          <Icon size={18} />
                        </div>

                        <h3 className="mt-3 text-sm font-black text-[#111827]">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                          {item.text}
                        </p>
                      </motion.article>
                    )
                  })}
                </div>

                <div className="mt-8 rounded-[2rem] border border-gray-100 bg-[#f9fafb] p-5 text-left lg:max-w-xl">
                  <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
                    <FiTrendingUp className="text-[#f97316]" />
                    Como o contato funciona
                  </p>

                  <div className="mt-4 grid gap-3">
                    {contactSteps.map((step, index) => (
                      <div
                        key={step}
                        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-black text-[#f97316]">
                          {index + 1}
                        </span>

                        <span className="text-sm font-bold text-[#6b7280]">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
  <a
    href={whatsappLink}
    target="_blank"
    rel="noreferrer"
    className="group rounded-[1.5rem] border border-orange-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/60"
  >
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/20 transition group-hover:scale-105">
        <FiMessageCircle size={19} />
      </span>

      <div className="min-w-0">
        <p className="text-sm font-black text-[#111827]">
          Chamar no WhatsApp
        </p>

        <p className="mt-1 text-xs font-bold text-[#9ca3af]">
          (79) 99978-69**
        </p>
      </div>
    </div>
  </a>

  <a
    href={mailtoLink}
    className="group rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/60"
  >
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition group-hover:scale-105 group-hover:bg-[#f97316] group-hover:text-white">
        <FiMail size={19} />
      </span>

      <div className="min-w-0">
        <p className="text-sm font-black text-[#111827]">
          Enviar e-mail
        </p>

        <p className="mt-1 truncate text-xs font-bold text-[#9ca3af]">
          contato@pratoby.com
        </p>
      </div>
    </div>
  </a>
</div>
              </motion.div>

              <motion.div
                id="formulario"
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="rounded-[2.5rem] border border-gray-100 bg-white p-5 shadow-2xl shadow-gray-200/80 sm:p-6 lg:p-8"
              >
                <div className="rounded-[2rem] bg-[#111827] p-6 text-white">
                  <p className="text-sm font-black uppercase tracking-wide text-orange-300">
                    Solicitação
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-tight">
                    Monte sua mensagem
                  </h2>

                  <p className="mt-3 text-sm font-semibold leading-6 text-white/60">
                    As informações abaixo já entram prontas no WhatsApp ou e-mail.
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
                    icon={FiShoppingBag}
                    value={form.business}
                    onChange={(event) => updateField('business', event.target.value)}
                    placeholder="Ex: Capivaras Lanches"
                    autoComplete="organization"
                  />

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
                        onClick={() =>
                          copyToClipboard(publicStoreLink, setLinkCopied)
                        }
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-[#111827] shadow-sm transition hover:text-[#f97316]"
                      >
                        <FiCopy />
                        {linkCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-5 text-[#9a3412]">
                      Essa é uma prévia automática. O link final pode ser ajustado
                      antes da publicação.
                    </p>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Plano de interesse
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
                      onChange={(event) =>
                        updateField('message', event.target.value)
                      }
                      placeholder="Quero começar a vender online com loja própria..."
                      className="min-h-[130px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-bold leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
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
              </motion.div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55 }}
              className="rounded-[2.25rem] border border-orange-100 bg-[#fff7ed] p-6 shadow-sm sm:p-8 lg:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="flex items-center gap-2 text-sm font-black text-[#f97316]">
                    <FiCheckCircle />
                    Antes de começar
                  </p>

                  <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                    Quer comparar os planos antes?
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280]">
                    Veja os detalhes do Essencial, Profissional e Premium, ou mande
                    sua dúvida direto pelo WhatsApp.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    to="/planos"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-[#111827] px-6 text-sm font-black text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-black"
                  >
                    Ver planos
                    <FiArrowRight size={18} />
                  </Link>

                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                  >
                    Chamar no WhatsApp
                    <FiMessageCircle size={18} />
                  </a>
                </div>
              </div>
            </motion.div>

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
        </main>
      </MarketingLayout>
    </>
  )
}