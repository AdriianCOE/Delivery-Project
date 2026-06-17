import { Link, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  FiArrowRight,
  FiCheckCircle,
  FiHelpCircle,
  FiLayers,
  FiLink,
  FiMessageCircle,
  FiRepeat,
  FiSettings,
  FiShoppingBag,
  FiUsers,
} from 'react-icons/fi'

import SEO from '../components/seo/SEO'
import {
  SEO_INTENT_PAGES,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
} from '../components/seo/seoConfig'
import MarketingLayout from './MarketingLayout'

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-sm font-semibold leading-7 text-[#6b7280] sm:text-base">
          {description}
        </p>
      )}
    </div>
  )
}

function ListCard({ icon: Icon, title, children }) {
  return (
    <article className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-lg font-black text-[#111827]">{title}</h3>
      <div className="mt-4">{children}</div>
    </article>
  )
}

export default function SeoIntentPage() {
  const location = useLocation()
  const page = SEO_INTENT_PAGES[location.pathname]

  if (!page) return <Navigate to="/404" replace />

  const jsonLd = [
    buildWebPageJsonLd(page),
    buildBreadcrumbJsonLd([
      { name: 'Início', path: '/' },
      { name: page.eyebrow, path: page.path },
    ]),
    buildFaqPageJsonLd(page.faqs),
  ].filter(Boolean)

  return (
    <>
      <SEO
        title={page.title}
        description={page.description}
        path={page.path}
        structuredData={jsonLd}
      />

      <MarketingLayout>
        <main className="overflow-hidden bg-[#f9fafb] text-[#111827]">
          <section className="relative overflow-hidden border-b border-gray-100 bg-white">
            <div className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" />

            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
                  <FiLink size={15} />
                  {page.eyebrow}
                </span>

                <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
                  {page.h1}
                </h1>

                <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#4b5563] sm:text-lg">
                  {page.subtitle}
                </p>

                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#6b7280] sm:text-base">
                  {page.intro}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/cadastro"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95"
                  >
                    Criar minha loja
                    <FiArrowRight size={17} />
                  </Link>

                  <Link
                    to="/contato"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-6 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] active:scale-95"
                  >
                    Falar com consultor
                    <FiMessageCircle size={17} />
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-2xl shadow-gray-200/70"
              >
                <div className="rounded-[1.65rem] bg-[#111827] p-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-orange-300">
                        Loja online
                      </p>
                      <h2 className="mt-2 text-2xl font-black">
                        Pedido direto pelo link
                      </h2>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-300">
                      Online
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {page.benefits.slice(0, 3).map((benefit) => (
                      <div
                        key={benefit}
                        className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-sm font-bold leading-6 text-white/85"
                      >
                        <FiCheckCircle className="mt-1 shrink-0 text-orange-300" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeader
              eyebrow="Benefícios"
              title="O que sua loja ganha"
              description="Recursos práticos para vender online sem transformar a operação em um marketplace."
            />

            <div className="grid gap-5 md:grid-cols-2">
              {page.benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  {...fadeUp}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                  className="flex items-start gap-4 rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                    <FiCheckCircle size={20} />
                  </span>
                  <p className="text-sm font-bold leading-7 text-[#374151]">
                    {benefit}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="border-y border-gray-100 bg-white py-14 sm:py-16">
            <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
              <ListCard icon={FiLayers} title="Como funciona">
                <ol className="space-y-3">
                  {page.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm font-semibold leading-6 text-[#4b5563]">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-black text-[#f97316]">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </ListCard>

              <ListCard icon={FiUsers} title="Para quem é">
                <div className="flex flex-wrap gap-2">
                  {page.audiences.map((audience) => (
                    <span
                      key={audience}
                      className="rounded-full border border-gray-100 bg-[#f9fafb] px-3 py-1.5 text-xs font-black text-[#4b5563]"
                    >
                      {audience}
                    </span>
                  ))}
                </div>
              </ListCard>

              <ListCard icon={FiShoppingBag} title="Próximo passo">
                <p className="text-sm font-semibold leading-7 text-[#4b5563]">
                  Compare os planos ou fale com o PratoBy para entender o melhor formato para sua operação.
                </p>
                <div className="mt-5 grid gap-3">
                  <Link
                    to="/planos"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.15rem] bg-[#111827] px-5 text-sm font-black text-white transition hover:bg-black"
                  >
                    Ver planos
                    <FiArrowRight size={16} />
                  </Link>
                  <Link
                    to="/contato"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.15rem] border border-orange-100 bg-orange-50 px-5 text-sm font-black text-[#f97316] transition hover:bg-orange-100"
                  >
                    Contato
                    <FiMessageCircle size={16} />
                  </Link>
                </div>
              </ListCard>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeader
              eyebrow="Diferenciais"
              title="Por que vender pelo próprio link?"
              description="O PratoBy complementa WhatsApp e redes sociais com um fluxo de pedido mais claro para cliente e lojista."
            />

            <div className="grid gap-5 md:grid-cols-3">
              <ListCard icon={FiLink} title="Canal próprio">
                <p className="text-sm font-semibold leading-7 text-[#4b5563]">
                  O cliente acessa o link da sua loja, escolhe os produtos e finaliza sem depender de vitrine de terceiros.
                </p>
              </ListCard>

              <ListCard icon={FiSettings} title="Controle operacional">
                <p className="text-sm font-semibold leading-7 text-[#4b5563]">
                  Produtos, disponibilidade, horários, entrega, retirada e comunicação ficam sob controle do lojista.
                </p>
              </ListCard>

              <ListCard icon={FiRepeat} title="Menos pedido solto">
                <p className="text-sm font-semibold leading-7 text-[#4b5563]">
                  Em vez de montar pedido manualmente por mensagem, a loja recebe itens, observações e dados em um painel organizado.
                </p>
              </ListCard>
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                Continue comparando soluções
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['Planos', '/planos'],
                  ['Contato', '/contato'],
                  ['Cardápio digital', '/cardapio-digital'],
                  ['Delivery sem comissão', '/delivery-sem-comissao'],
                  ['Sistema para confeitaria', '/sistema-para-confeitaria'],
                  ['Sistema para lanchonete', '/sistema-para-lanchonete'],
                  ['Sistema para pizzaria', '/sistema-para-pizzaria'],
                  ['Cardápio para restaurante', '/cardapio-digital-para-restaurante'],
                  ['Loja online para restaurante', '/Cardapio-Digital'],
                  ['Exemplos', '/exemplos'],
                ]
                  .filter(([, to]) => to !== page.path)
                  .map(([label, to]) => (
                    <Link
                      key={to}
                      to={to}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-[#f9fafb] px-4 py-2 text-xs font-black text-[#374151] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
                    >
                      {label}
                      <FiArrowRight size={14} />
                    </Link>
                  ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeader
              eyebrow="FAQ"
              title="Perguntas frequentes"
              description="Respostas objetivas para quem quer vender direto pelo próprio link."
            />

            <div className="grid gap-4">
              {page.faqs.map((faq) => (
                <motion.article
                  key={faq.q}
                  {...fadeUp}
                  transition={{ duration: 0.45 }}
                  className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <h3 className="flex items-start gap-3 text-base font-black text-[#111827]">
                    <FiHelpCircle className="mt-1 shrink-0 text-[#f97316]" />
                    {faq.q}
                  </h3>
                  <p className="ml-8 mt-2 text-sm font-semibold leading-7 text-[#6b7280]">
                    {faq.a}
                  </p>
                </motion.article>
              ))}
            </div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
