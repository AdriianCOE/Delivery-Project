import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import SEO from '../components/seo/SEO'
import MarketingLayout from '../pages/MarketingLayout'
import {
  FiArrowRight,
  FiCheckCircle,
  FiCopy,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiSend,
  FiUser,
  FiHelpCircle,
  FiLogIn,
  FiZap,
} from 'react-icons/fi'

const CONTACT_EMAIL = 'contato@pratoby.com'
const CONTACT_WHATSAPP = '5579999786984'

const contactBlocks = [
  {
    icon: FiZap,
    title: 'Quero contratar',
    description: 'Conheça os planos e comece sua loja online agora mesmo.',
    cta: 'Criar minha loja',
    link: '/cadastro',
    isExternal: false,
    highlight: true,
  },
  {
    icon: FiHelpCircle,
    title: 'Tenho dúvidas',
    description: 'Fale com nosso atendimento antes de começar.',
    cta: 'Chamar no WhatsApp',
    link: `https://wa.me/${CONTACT_WHATSAPP}`,
    isExternal: true,
  },
  {
    icon: FiLogIn,
    title: 'Já sou lojista',
    description: 'Acesse o painel ou fale com o suporte.',
    cta: 'Entrar no painel',
    link: '/login',
    isExternal: false,
  },
]

const faqs = [
  {
    q: 'O PratoBy cobra comissão por pedido?',
    a: 'Não cobramos comissão do PratoBy por pedido. Você vende direto e recebe o valor descontadas apenas as taxas da sua maquininha ou gateway de pagamento, se houver.',
  },
  {
    q: 'Preciso ter site próprio?',
    a: 'O PratoBy gera uma loja online com link exclusivo para você. Você não precisa contratar domínio ou hospedagem por fora.',
  },
  {
    q: 'Posso divulgar o link no Instagram e WhatsApp?',
    a: 'Sim! O link é seu. Recomendamos colocar na bio do Instagram, no link do WhatsApp Business e em QR Codes nas mesas.',
  },
  {
    q: 'Preciso de cartão de crédito para começar?',
    a: 'Sim. Você informa o cartão para ativar o teste, mas não paga nada durante os 14 dias grátis. A cobrança só acontece depois do período de teste, caso você continue com o plano.',
  },
  {
    q: 'Como começo meu teste grátis?',
    a: 'Basta clicar em "Começar teste grátis" ou "Criar minha loja", preencher o cadastro rápido e você já poderá configurar seus produtos e testar por 14 dias.',
  },
]

function Input({ label, icon: Icon, type = 'text', as = 'input', ...props }) {
  const Component = as
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
        <Component
          type={type}
          {...props}
          className={`w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 ${
            Icon ? 'pl-11' : ''
          } ${as === 'textarea' ? 'py-3 min-h-[120px] resize-none' : 'h-14'}`}
        />
      </div>
    </label>
  )
}

function Select({ label, icon: Icon, options, ...props }) {
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
        <select
          {...props}
          className={`h-14 w-full appearance-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 ${
            Icon ? 'pl-11' : ''
          }`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </label>
  )
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    contactInfo: '',
    subject: 'Quero contratar',
    message: '',
  })

  const [emailCopied, setEmailCopied] = useState(false)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
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

  const buildWhatsAppMessage = () => {
    const text = [
      'Olá! Vim pela página de contato do PratoBy.',
      '',
      form.name ? `Meu nome: ${form.name}` : '',
      form.contactInfo ? `Meu contato: ${form.contactInfo}` : '',
      form.subject ? `Assunto: ${form.subject}` : '',
      '',
      form.message ? `Mensagem:\n${form.message}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`
  }

  const buildMailtoMessage = () => {
    const subject = encodeURIComponent(`Contato PratoBy: ${form.subject}`)
    const body = encodeURIComponent(
      [
        'Olá, equipe PratoBy!',
        '',
        form.name ? `Nome: ${form.name}` : '',
        form.contactInfo ? `Contato de retorno: ${form.contactInfo}` : '',
        form.subject ? `Assunto: ${form.subject}` : '',
        '',
        form.message ? `Mensagem:\n${form.message}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <>
      <SEO
        title="Contato | PratoBy"
        description="Fale com o PratoBy, tire dúvidas ou comece sua loja online sem comissão do PratoBy por pedido."
        path="/contato"
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          {/* Hero Section */}
          <section className="relative overflow-hidden border-b border-gray-100 bg-white">
            <div className="pointer-events-none absolute -left-40 top-28 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -right-40 top-36 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-b from-transparent to-[#f9fafb]" />

            <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24 text-center">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="mx-auto max-w-3xl"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
                  <FiMessageCircle size={15} />
                  Suporte & Vendas
                </span>

                <h1 className="mt-6 text-4xl font-black leading-[1.1] tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  Fale com o <span className="text-[#f97316]">PratoBy</span>
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] sm:text-lg">
                  Tire dúvidas, fale com o suporte ou comece sua loja online sem comissão do PratoBy por pedido.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    to="/cadastro"
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 text-base font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] sm:w-auto"
                  >
                    Começar teste grátis
                    <FiArrowRight size={20} />
                  </Link>

                  <Link
                    to="/login"
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-gray-200 bg-white px-8 text-base font-black text-[#111827] transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 sm:w-auto"
                  >
                    Entrar no painel
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Blocos de Contato */}
          <section className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 sm:grid-cols-3">
              {contactBlocks.map((block, index) => {
                const Icon = block.icon
                return (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    className={`flex flex-col rounded-[2rem] border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
                      block.highlight
                        ? 'border-orange-200 bg-orange-50/50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        block.highlight
                          ? 'bg-[#f97316] text-white shadow-md shadow-orange-600/20'
                          : 'bg-orange-50 text-[#f97316]'
                      }`}
                    >
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-5 text-lg font-black text-[#111827]">
                      {block.title}
                    </h3>
                    <p className="mt-2 flex-grow text-sm font-semibold leading-relaxed text-[#6b7280]">
                      {block.description}
                    </p>
                    <div className="mt-6">
                      {block.isExternal ? (
                        <a
                          href={block.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex font-bold text-[#f97316] hover:text-[#ea580c] items-center gap-2"
                        >
                          {block.cta} <FiArrowRight />
                        </a>
                      ) : (
                        <Link
                          to={block.link}
                          className="inline-flex font-bold text-[#f97316] hover:text-[#ea580c] items-center gap-2"
                        >
                          {block.cta} <FiArrowRight />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>

          {/* Formulário & FAQ */}
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-black tracking-tight text-[#111827]">
                Mande uma mensagem
              </h2>
              <p className="mt-3 text-base font-semibold leading-relaxed text-[#6b7280]">
                Preencha o formulário simples abaixo e escolha se prefere enviar por WhatsApp ou E-mail. Responderemos o mais rápido possível.
              </p>

              <div className="mt-8 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/50 sm:p-8">
                <div className="grid gap-5">
                  <Input
                    label="Seu nome"
                    icon={FiUser}
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Como podemos te chamar?"
                  />
                  
                  <Input
                    label="E-mail ou WhatsApp"
                    icon={FiPhone}
                    value={form.contactInfo}
                    onChange={(e) => updateField('contactInfo', e.target.value)}
                    placeholder="Seu melhor contato"
                  />

                  <Select
                    label="Assunto"
                    icon={FiMessageCircle}
                    value={form.subject}
                    onChange={(e) => updateField('subject', e.target.value)}
                    options={[
                      { label: 'Quero contratar', value: 'Quero contratar' },
                      { label: 'Tenho dúvida sobre planos', value: 'Dúvida sobre planos' },
                      { label: 'Já sou lojista', value: 'Já sou lojista' },
                      { label: 'Suporte', value: 'Suporte' },
                      { label: 'Outro', value: 'Outro' },
                    ]}
                  />

                  <Input
                    as="textarea"
                    label="Mensagem"
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    placeholder="Escreva sua dúvida ou solicitação..."
                  />

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <a
                      href={buildWhatsAppMessage()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                    >
                      <FiSend />
                      WhatsApp
                    </a>

                    <a
                      href={buildMailtoMessage()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-black text-[#111827] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316]"
                    >
                      <FiMail />
                      E-mail
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-16 lg:mt-0"
            >
              <h2 className="text-2xl font-black tracking-tight text-[#111827]">
                Perguntas Frequentes
              </h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#6b7280]">
                Tudo o que você precisa saber antes de começar sua loja no PratoBy.
              </p>

              <div className="mt-8 grid gap-6">
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="rounded-[1.5rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-orange-100 hover:shadow-md"
                  >
                    <h3 className="flex items-start gap-3 text-base font-black text-[#111827]">
                      <FiCheckCircle className="mt-1 shrink-0 text-[#f97316]" size={18} />
                      {faq.q}
                    </h3>
                    <p className="ml-7 mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-[2rem] border border-orange-100 bg-orange-50/50 p-6 sm:p-8">
                <p className="text-base font-black text-[#111827]">
                  Ficou alguma dúvida?
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
                  Nosso suporte está pronto para ajudar você a configurar sua loja e começar a vender sem pagar comissões.
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(CONTACT_EMAIL, setEmailCopied)}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:text-[#f97316]"
                >
                  <FiCopy />
                  {emailCopied ? 'E-mail copiado!' : `Copiar ${CONTACT_EMAIL}`}
                </button>
              </div>
            </motion.div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
