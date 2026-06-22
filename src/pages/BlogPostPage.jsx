import { Link, Navigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiClock, FiHelpCircle } from 'react-icons/fi'

import SEO from '../components/seo/SEO'
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildWebPageJsonLd,
} from '../components/seo/seoConfig'
import { getBlogPostBySlug } from '../data/blogPosts'
import MarketingLayout from './MarketingLayout'

function buildBlogPostJsonLd(post) {
  const url = absoluteUrl(`/blog/${post.slug}`)

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    image: DEFAULT_OG_IMAGE,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    inLanguage: 'pt-BR',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icons/android-chrome-512x512.png`,
      },
    },
  }
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const post = getBlogPostBySlug(slug)

  if (!post) return <Navigate to="/404" replace />

  const path = `/blog/${post.slug}`
  const page = {
    title: `${post.title} | Blog PratoBy`,
    description: post.description,
    path,
  }
  const jsonLd = [
    buildWebPageJsonLd(page),
    buildBreadcrumbJsonLd([
      { name: 'Início', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
    buildBlogPostJsonLd(post),
    buildFaqPageJsonLd(post.faqs),
  ].filter(Boolean)

  return (
    <>
      <SEO
        title={page.title}
        description={page.description}
        path={page.path}
        type="article"
        structuredData={jsonLd}
      />

      <MarketingLayout>
        <main className="bg-[#f9fafb] text-[#111827]">
          <article>
            <header className="border-b border-gray-100 bg-white">
              <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 text-sm font-black text-[#f97316] transition hover:text-[#ea580c]"
                >
                  <FiArrowLeft size={16} />
                  Voltar ao blog
                </Link>

                <p className="mt-8 text-xs font-black uppercase tracking-wide text-[#f97316]">
                  {post.category}
                </p>
                <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl">
                  {post.title}
                </h1>
                <p className="mt-5 text-base font-semibold leading-8 text-[#4b5563] sm:text-lg">
                  {post.intro}
                </p>
                <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#9ca3af]">
                  <FiClock size={16} />
                  {post.readingTime} de leitura
                </p>
              </div>
            </header>

            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
              <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                <div className="space-y-10">
                  {post.sections.map((section) => (
                    <section key={section.title}>
                      <h2 className="text-2xl font-black tracking-tight text-[#111827]">
                        {section.title}
                      </h2>
                      <div className="mt-4 space-y-4">
                        {section.paragraphs.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="text-sm font-semibold leading-8 text-[#4b5563] sm:text-base"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              <section className="mt-8 rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-2xl font-black tracking-tight text-[#111827]">
                  Perguntas frequentes
                </h2>
                <div className="mt-5 grid gap-4">
                  {post.faqs.map((faq) => (
                    <div key={faq.q} className="rounded-[1.25rem] bg-[#f9fafb] p-4">
                      <h3 className="flex items-start gap-3 text-base font-black text-[#111827]">
                        <FiHelpCircle className="mt-1 shrink-0 text-[#f97316]" />
                        {faq.q}
                      </h3>
                      <p className="ml-8 mt-2 text-sm font-semibold leading-7 text-[#6b7280]">
                        {faq.a}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 rounded-[1.75rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                  Continue no PratoBy
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#111827]">
                  Páginas relacionadas
                </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.relatedLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-[#f9fafb] px-4 py-2 text-xs font-black text-[#374151] transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
                    >
                      {link.label}
                      <FiArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </article>
        </main>
      </MarketingLayout>
    </>
  )
}
