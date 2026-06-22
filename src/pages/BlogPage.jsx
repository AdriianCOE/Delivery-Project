import { Link } from 'react-router-dom'
import { FiArrowRight, FiBookOpen, FiClock, FiSearch } from 'react-icons/fi'

import SEO from '../components/seo/SEO'
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '../components/seo/seoConfig'
import { BLOG_POSTS } from '../data/blogPosts'
import MarketingLayout from './MarketingLayout'

const BLOG_SEO = {
  title: 'Blog PratoBy | Tutoriais de cardápio digital e delivery',
  description:
    'Tutoriais rápidos sobre cardápio digital, delivery próprio, QR Code, pedidos online e venda direta para restaurantes.',
  path: '/blog',
}

export default function BlogPage() {
  const jsonLd = [
    buildWebPageJsonLd(BLOG_SEO),
    buildBreadcrumbJsonLd([
      { name: 'Início', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]),
  ]

  return (
    <>
      <SEO
        title={BLOG_SEO.title}
        description={BLOG_SEO.description}
        path={BLOG_SEO.path}
        structuredData={jsonLd}
      />

      <MarketingLayout>
        <main className="bg-[#f9fafb] text-[#111827]">
          <section className="border-b border-gray-100 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                <FiBookOpen size={15} />
                Blog PratoBy
              </span>

              <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                <div>
                  <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl">
                    Tutoriais rápidos para vender mais pelo cardápio digital
                  </h1>
                  <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#4b5563] sm:text-lg">
                    Conteúdos práticos sobre cardápio online, delivery próprio, QR Code,
                    pedidos digitais e divulgação do link da loja.
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-gray-100 bg-[#fff7ed] p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#f97316] shadow-sm">
                      <FiSearch size={19} />
                    </span>
                    <div>
                      <h2 className="text-lg font-black text-[#111827]">
                        Conteúdo pensado para busca
                      </h2>
                      <p className="mt-2 text-sm font-semibold leading-7 text-[#6b7280]">
                        Cada tutorial responde dúvidas reais de lojistas e aponta para
                        páginas comerciais relevantes do PratoBy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-5 md:grid-cols-3">
              {BLOG_POSTS.map((post) => (
                <article
                  key={post.slug}
                  className="flex h-full flex-col rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-lg hover:shadow-orange-100/50"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                    {post.category}
                  </p>
                  <h2 className="mt-4 text-xl font-black leading-tight text-[#111827]">
                    <Link to={`/blog/${post.slug}`} className="hover:text-[#f97316]">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#9ca3af]">
                    <FiClock size={14} />
                    {post.readingTime}
                  </p>
                  <p className="mt-4 flex-1 text-sm font-semibold leading-7 text-[#6b7280]">
                    {post.description}
                  </p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#f97316] transition hover:text-[#ea580c]"
                  >
                    Ler tutorial
                    <FiArrowRight size={16} />
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[1.75rem] border border-orange-100 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                  Próximo passo
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#111827]">
                  Quer transformar o tutorial em loja online?
                </h2>
                <p className="mt-2 text-sm font-semibold leading-7 text-[#6b7280]">
                  Compare os planos do PratoBy e veja como criar um cardápio digital
                  com pedidos online pelo próprio link.
                </p>
              </div>
              <Link
                to="/planos"
                className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-[1.25rem] bg-[#f97316] px-6 text-sm font-black text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] active:scale-95 sm:mt-0"
              >
                Ver planos
                <FiArrowRight size={17} />
              </Link>
            </div>
          </section>
        </main>
      </MarketingLayout>
    </>
  )
}
