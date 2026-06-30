// src/pages/ContactPage.jsx
// Página pública de contato, vendas e suporte do PratoBy.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  FiArrowRight,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCopy,
  FiGlobe,
  FiHelpCircle,
  FiLogIn,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiSend,
  FiShield,
  FiUser,
  FiZap,
} from 'react-icons/fi'

import SEO from '../components/seo/SEO'
import {
  MARKETING_SEO,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from '../components/seo/seoConfig'
import MarketingLayout from '../pages/MarketingLayout'

const CONTACT_EMAIL = 'contato@pratoby.com'
const CONTACT_WHATSAPP = '5579998681594'

const subjectOptions = [
  { label: 'Quero conhecer o PratoBy', value: 'Quero conhecer o PratoBy' },
  { label: 'Quero começar com acompanhamento', value: 'Quero começar com acompanhamento' },
  { label: 'Tenho dúvida sobre planos', value: 'Tenho dúvida sobre planos' },
  { label: 'Já sou lojista e preciso de suporte', value: 'Já sou lojista e preciso de suporte' },
  { label: 'Parceria ou outro assunto', value: 'Parceria ou outro assunto' },
]

const businessTypeOptions = [
  { label: 'Selecione uma opção', value: '' },
  { label: 'Confeitaria', value: 'Confeitaria' },
  { label: 'Lanchonete', value: 'Lanchonete' },
  { label: 'Restaurante', value: 'Restaurante' },
  { label: 'Pizzaria', value: 'Pizzaria' },
  { label: 'Hamburgueria', value: 'Hamburgueria' },
  { label: 'Açaí / Sobremesas', value: 'Açaí / Sobremesas' },
  { label: 'Outro negócio de alimentação', value: 'Outro negócio de alimentação' },
]

const contactBlocks = [
  {
    icon: FiZap,
    title: 'Começar com acompanhamento',
    description:
      'Ideal para quem quer configurar a loja com acompanhamento e testar o PratoBy com mais segurança.',
    cta: 'Criar minha loja',
    link: '/cadastro',
    isExternal: false,
    highlight: true,
  },
  {
    icon: FiMessageCircle,
    title: 'Falar com vendas',
    description:
      'Tire dúvidas sobre planos, funcionamento, encomendas, delivery e próximos passos pelo WhatsApp.',
    cta: 'Chamar no WhatsApp',
    link: `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
      'Olá! Vim pela página de contato do PratoBy e quero saber mais.'
    )}`,
    isExternal: true,
  },
  {
    icon: FiLogIn,
    title: 'Já sou lojista',
    description:
      'Acesse o painel para gerenciar pedidos, cardápio, horários, entregas e configurações da sua loja.',
    cta: 'Entrar no painel',
    link: '/login',
    isExternal: false,
  },
]

const trustPoints = [
  {
    icon: FiShield,
    title: 'Sem comissão por pedido',
    description: 'O lojista vende pelo próprio link e não paga percentual ao PratoBy por cada venda.',
  },
  {
    icon: FiClock,
    title: 'Configuração assistida',
    description: 'Nossa equipe pode orientar os primeiros passos para sua loja começar com mais segurança.',
  },
  {
    icon: FiGlobe,
    title: 'Link próprio da loja',
    description: 'A loja pode divulgar o cardápio no Instagram, WhatsApp, Google e QR Code.',
  },
]

const faqs = [
  {
    q: 'O PratoBy cobra comissão por pedido?',
    a: 'Não. O PratoBy trabalha com planos de assinatura e não cobra comissão própria sobre cada pedido recebido pela loja.',
  },
  {
    q: 'Preciso ter site próprio?',
    a: 'Não. O PratoBy cria uma loja online com link público para você divulgar no Instagram, WhatsApp, Google ou QR Code.',
  },
  {
    q: 'O PratoBy serve para encomendas?',
    a: 'Sim. O sistema foi pensado também para negócios como confeitarias, doces, bolos, kits e produtos que precisam de agendamento.',
  },
  {
    q: 'Já posso usar em uma loja real?',
    a: 'Sim. Recomendamos começar com configuração assistida, validando cardápio, horários, entrega, pagamento e fluxo de pedidos antes de divulgar em escala.',
  },
  {
    q: 'Como começo?',
    a: 'Você pode criar sua conta, escolher um plano e iniciar a configuração da loja. Se preferir, fale pelo WhatsApp para receber orientação antes.',
  },
]

function Field({
  id,
  label,
  icon: Icon,
  type = 'text',
  as = 'input',
  className = '',
  ...props
}) {
  const Component = as

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400">
        {label}
      </span>

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
            size={18}
          />
        )}

        <Component
          id={id}
          name={id}
          {...(as === 'input' ? { type } : {})}
          {...props}
          className={[
            'w-full rounded-2xl border border-gray-200 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-orange-500/20',
            Icon ? 'pl-11' : '',
            as === 'textarea' ? 'min-h-[132px] resize-none py-3 leading-relaxed' : 'h-14',
            className,
          ].join(' ')}
        />
      </div>
    </label>
  )
}

function SelectField({ id, label, icon: Icon, options, ...props }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400">
        {label}
      </span>

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
            size={18}
          />
        )}

        <select
          id={id}
          name={id}
          {...props}
          className={[
            'h-14 w-full appearance-none rounded-2xl border border-gray-200 bg-[#f9fafb] px-4 pr-11 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-500/20',
            Icon ? 'pl-11' : '',
          ].join(' ')}
        >
          {options.map((option) => (
            <option key={option.value || option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <FiChevronDown
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
          size={18}
        />
      </div>
    </label>
  )
}

function ContactAction({ block }) {
  const Icon = block.icon

  const className = [
    'group flex h-full flex-col rounded-[2rem] border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
    block.highlight
      ? 'border-orange-200 bg-orange-50/80 shadow-orange-100/60 dark:border-orange-500/30 dark:bg-orange-500/10 dark:shadow-none'
      : 'border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900',
  ].join(' ')

  const content = (
    <>
      <div
        className={[
          'grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-105',
          block.highlight
            ? 'bg-[#f97316] text-white shadow-md shadow-orange-600/20'
            : 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10',
        ].join(' ')}
      >
        <Icon size={23} />
      </div>

      <h3 className="mt-5 text-lg font-black text-[#111827] dark:text-zinc-100">
        {block.title}
      </h3>

      <p className="mt-2 flex-1 text-sm font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
        {block.description}
      </p>

      <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#f97316] transition group-hover:text-[#ea580c]">
        {block.cta}
        <FiArrowRight className="transition group-hover:translate-x-1" size={17} />
      </span>
    </>
  )

  if (block.isExternal) {
    return (
      <a href={block.link} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    )
  }

  return (
    <Link to={block.link} className={className}>
      {content}
    </Link>
  )
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    contactInfo: '',
    businessType: '',
    subject: 'Quero conhecer o PratoBy',
    message: '',
  })

  const [emailCopied, setEmailCopied] = useState(false)

  const whatsappUrl = useMemo(() => {
    const text = [
      'Olá! Vim pela página de contato do PratoBy.',
      '',
      form.name ? `Meu nome: ${form.name}` : '',
      form.contactInfo ? `Meu contato: ${form.contactInfo}` : '',
      form.businessType ? `Tipo de negócio: ${form.businessType}` : '',
      form.subject ? `Assunto: ${form.subject}` : '',
      '',
      form.message ? `Mensagem:\n${form.message}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`
  }, [form])

  const mailtoUrl = useMemo(() => {
    const subject = encodeURIComponent(`Contato PratoBy: ${form.subject}`)
    const body = encodeURIComponent(
      [
        'Olá, equipe PratoBy!',
        '',
        form.name ? `Nome: ${form.name}` : '',
        form.contactInfo ? `Contato de retorno: ${form.contactInfo}` : '',
        form.businessType ? `Tipo de negócio: ${form.businessType}` : '',
        form.subject ? `Assunto: ${form.subject}` : '',
        '',
        form.message ? `Mensagem:\n${form.message}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )

    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
  }, [form])

  function updateField(field, value) {
    setForm((previousForm) => ({ ...previousForm, [field]: value }))
  }

  async function copyEmail() {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API indisponível')
      }

      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setEmailCopied(true)
      window.setTimeout(() => setEmailCopied(false), 2200)
    } catch {
      setEmailCopied(false)
    }
  }

  function openWhatsApp() {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  function openEmail() {
    window.location.href = mailtoUrl
  }

  return (
    <>
      <SEO
        {...MARKETING_SEO.contact}
        structuredData={[
          buildBreadcrumbJsonLd([
            { name: 'Início', path: '/' },
            { name: 'Contato', path: '/contato' },
          ]),
          buildFaqPageJsonLd(faqs),
        ]}
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827] dark:bg-zinc-950 dark:text-zinc-100">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="pointer-events-none absolute -left-40 top-24 h-[28rem] w-[28rem] rounded-full bg-orange-100/70 blur-3xl dark:bg-orange-500/10" />
            <div className="pointer-events-none absolute -right-40 top-32 h-[28rem] w-[28rem] rounded-full bg-gray-100 blur-3xl dark:bg-zinc-800/70" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-b from-transparent to-[#f9fafb] dark:to-zinc-950" />

            <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mx-auto max-w-3xl"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
                  <FiMessageCircle size={15} />
                  Atendimento, vendas e suporte
                </span>

                <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight text-[#111827] dark:text-white sm:text-5xl lg:text-6xl">
                  Fale com o <span className="text-[#f97316]">PratoBy</span>
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-8 text-[#6b7280] dark:text-zinc-400 sm:text-lg">
                  Tire dúvidas, peça ajuda ou comece com acompanhamento. O PratoBy ajuda
                  negócios de alimentação a venderem online pelo próprio link, sem comissão por
                  pedido.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    to="/cadastro"
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 text-base font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] sm:w-auto"
                  >
                    Começar minha loja
                    <FiArrowRight size={20} />
                  </Link>

                  <a
                    href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
                      'Olá! Vim pelo site do PratoBy e quero falar com vocês.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-gray-200 bg-white px-8 text-base font-black text-[#111827] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-500/40 sm:w-auto"
                  >
                    Chamar no WhatsApp
                  </a>
                </div>

                <p className="mt-5 text-xs font-bold text-[#6b7280] dark:text-zinc-500">
                  Atendimento consultivo para configurar sua loja com mais segurança.
                </p>
              </motion.div>
            </div>
          </section>

          <section className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {contactBlocks.map((block, index) => (
                <motion.div
                  key={block.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <ContactAction block={block} />
                </motion.div>
              ))}
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
            <motion.div
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-xs font-black uppercase tracking-[0.22em] text-[#f97316]">
                Contato rápido
              </span>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] dark:text-white sm:text-4xl">
                Conte um pouco sobre sua loja
              </h2>

              <p className="mt-3 text-base font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                Preencha os campos e envie pelo WhatsApp ou e-mail. Quanto mais contexto você
                mandar, mais rápido conseguimos orientar o próximo passo.
              </p>

              <div className="mt-8 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-xl shadow-gray-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8">
                <div className="grid gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      id="contact-name"
                      label="Seu nome"
                      icon={FiUser}
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="Como podemos te chamar?"
                      autoComplete="name"
                    />

                    <Field
                      id="contact-info"
                      label="E-mail ou WhatsApp"
                      icon={FiPhone}
                      value={form.contactInfo}
                      onChange={(event) => updateField('contactInfo', event.target.value)}
                      placeholder="Seu melhor contato"
                      autoComplete="email"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField
                      id="contact-business-type"
                      label="Tipo de negócio"
                      icon={FiGlobe}
                      value={form.businessType}
                      onChange={(event) => updateField('businessType', event.target.value)}
                      options={businessTypeOptions}
                    />

                    <SelectField
                      id="contact-subject"
                      label="Assunto"
                      icon={FiMessageCircle}
                      value={form.subject}
                      onChange={(event) => updateField('subject', event.target.value)}
                      options={subjectOptions}
                    />
                  </div>

                  <Field
                    id="contact-message"
                    as="textarea"
                    label="Mensagem"
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="Ex: Tenho uma confeitaria em Aracaju, vendo por encomenda e quero receber pedidos pelo meu próprio link..."
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
                    >
                      <FiSend />
                      Enviar pelo WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={openEmail}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-black text-[#111827] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:text-[#f97316] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-orange-500/40"
                    >
                      <FiMail />
                      Enviar por e-mail
                    </button>
                  </div>

                  <p className="text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-500">
                    O formulário não salva dados no site. Ele apenas monta a mensagem para você
                    enviar pelo canal escolhido.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="rounded-[2rem] border border-orange-100 bg-orange-50/70 p-6 dark:border-orange-500/20 dark:bg-orange-500/10 sm:p-8">
                <h2 className="text-2xl font-black tracking-tight text-[#111827] dark:text-white">
                  Melhor caminho para começar
                </h2>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                  Se sua loja ainda não usa o PratoBy, recomendamos começar com configuração assistida.
                  Assim fica mais fácil configurar cardápio, horários, entrega, retirada, pagamentos
                  e primeiro pedido de validação.
                </p>

                <div className="mt-6 grid gap-4">
                  {trustPoints.map((point) => {
                    const Icon = point.icon

                    return (
                      <div key={point.title} className="flex gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#f97316] shadow-sm dark:bg-zinc-900">
                          <Icon size={18} />
                        </div>

                        <div>
                          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
                            {point.title}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                            {point.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Link
                  to="/cadastro"
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-4 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-black dark:bg-white dark:text-zinc-950"
                >
                  Criar conta no PratoBy
                  <FiArrowRight />
                </Link>
              </div>

              <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                <p className="text-base font-black text-[#111827] dark:text-zinc-100">
                  Canais diretos
                </p>

                <div className="mt-5 space-y-3">
                  <a
                    href={`https://wa.me/${CONTACT_WHATSAPP}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-500/30 dark:hover:bg-orange-500/10"
                  >
                    <span>
                      <span className="block text-sm font-black text-[#111827] dark:text-zinc-100">
                        WhatsApp
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-[#6b7280] dark:text-zinc-400">
                        Atendimento comercial e dúvidas rápidas
                      </span>
                    </span>
                    <FiMessageCircle className="shrink-0 text-[#f97316]" />
                  </a>

                  <button
                    type="button"
                    onClick={copyEmail}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-4 text-left transition hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-500/30 dark:hover:bg-orange-500/10"
                  >
                    <span>
                      <span className="block text-sm font-black text-[#111827] dark:text-zinc-100">
                        {emailCopied ? 'E-mail copiado!' : CONTACT_EMAIL}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-[#6b7280] dark:text-zinc-400">
                        Clique para copiar o endereço
                      </span>
                    </span>
                    <FiCopy className="shrink-0 text-[#f97316]" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </section>

          <section className="border-t border-gray-100 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="text-xs font-black uppercase tracking-[0.22em] text-[#f97316]">
                  Dúvidas comuns
                </span>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] dark:text-white">
                  Antes de falar com a gente
                </h2>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                  Algumas respostas rápidas sobre o PratoBy, venda online e configuração assistida.
                </p>
              </div>

              <div className="mt-10 grid gap-5">
                {faqs.map((faq) => (
                  <article
                    key={faq.q}
                    className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-6 transition hover:border-orange-100 hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-orange-500/30"
                  >
                    <h3 className="flex items-start gap-3 text-base font-black text-[#111827] dark:text-zinc-100">
                      <FiCheckCircle className="mt-1 shrink-0 text-[#f97316]" size={18} />
                      {faq.q}
                    </h3>

                    <p className="ml-7 mt-2 text-sm font-semibold leading-relaxed text-[#6b7280] dark:text-zinc-400">
                      {faq.a}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
