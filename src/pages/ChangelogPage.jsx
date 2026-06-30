import { Link } from 'react-router-dom'
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiZap,
} from 'react-icons/fi'
import MarketingLayout, { BtnCriarLoja } from './MarketingLayout'
import SEO from '../components/seo/SEO'
import { buildBreadcrumbJsonLd } from '../components/seo/seoConfig'
import { changelogEntries, changelogTypeLabels } from '../data/changelog'

const FALLBACK_TYPE = 'improved'

const TYPE_ORDER = ['new', 'improved', 'fixed', 'security']

const TYPE_STYLES = {
  new: {
    Icon: FiZap,
    label: changelogTypeLabels?.new ?? 'Novo',
    className: 'bg-orange-50 text-orange-700 ring-orange-100',
  },
  improved: {
    Icon: FiRefreshCw,
    label: changelogTypeLabels?.improved ?? 'Melhoria',
    className: 'bg-blue-50 text-blue-700 ring-blue-100',
  },
  fixed: {
    Icon: FiCheckCircle,
    label: changelogTypeLabels?.fixed ?? 'Correção',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  security: {
    Icon: FiShield,
    label: changelogTypeLabels?.security ?? 'Segurança',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
}

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const structuredData = [
  buildBreadcrumbJsonLd([
    { name: 'Início', path: '/' },
    { name: 'Novidades', path: '/novidades' },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Novidades do PratoBy',
    description:
      'Atualizações curadas do PratoBy para restaurantes, lanchonetes, pizzarias e confeitarias.',
    url: 'https://pratoby.com/novidades',
  },
]

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function normalizeDate(value) {
  if (!value) return null

  const date = new Date(`${value}T12:00:00-03:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = normalizeDate(value)
  return date ? DATE_FORMATTER.format(date) : 'Data não informada'
}

function getValidType(type) {
  return TYPE_STYLES[type] ? type : FALLBACK_TYPE
}

function groupItemsByType(items = []) {
  return items.reduce((groups, item) => {
    const type = getValidType(item?.type)

    if (!groups[type]) groups[type] = []
    groups[type].push(item)

    return groups
  }, {})
}

function getOrderedGroups(items = []) {
  const groups = groupItemsByType(items)

  return TYPE_ORDER.filter((type) => groups[type]?.length).map((type) => ({
    type,
    items: groups[type],
    style: TYPE_STYLES[type],
  }))
}

function LatestUpdateCard({ entry }) {
  if (!entry) return null

  return (
    <aside
      className="rounded-[1.45rem] border border-orange-100 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,.08)]"
      aria-label="Última atualização do PratoBy"
    >
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-orange-500">
        Última atualização
      </p>
      <p className="mt-2 text-lg font-black text-gray-950">{entry.title}</p>
      {entry.summary ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">{entry.summary}</p>
      ) : null}
    </aside>
  )
}

function TypeBadge({ style }) {
  const Icon = style.Icon

  return (
    <p
      className={cx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ring-1',
        style.className,
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {style.label}
    </p>
  )
}

function ChangelogItem({ item, index }) {
  return (
    <li className="flex gap-3 text-sm font-semibold leading-6 text-gray-700">
      <FiCheckCircle className="mt-1 shrink-0 text-[#f97316]" size={15} aria-hidden="true" />
      <span>{item?.text ?? `Atualização ${index + 1}`}</span>
    </li>
  )
}

function ChangelogGroup({ group }) {
  return (
    <section aria-label={group.style.label}>
      <TypeBadge style={group.style} />
      <ul className="mt-3 grid gap-2.5">
        {group.items.map((item, index) => (
          <ChangelogItem key={`${group.type}-${index}-${item?.text ?? 'item'}`} item={item} index={index} />
        ))}
      </ul>
    </section>
  )
}

function TagList({ tags = [] }) {
  if (!tags.length) return null

  return (
    <div className="flex flex-wrap gap-2 mt-4" aria-label="Áreas impactadas">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-black text-gray-600">
          {tag}
        </span>
      ))}
    </div>
  )
}

function ChangelogEntryCard({ entry }) {
  const groups = getOrderedGroups(entry.items)
  const date = normalizeDate(entry.date)

  return (
    <article className="relative overflow-hidden rounded-[1.6rem] border border-gray-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,.09)] sm:p-6">
      <div
        className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#f97316] via-orange-400 to-amber-300"
        aria-hidden="true"
      />

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        <header>
          <time
            dateTime={date ? date.toISOString().slice(0, 10) : undefined}
            className="text-sm font-black text-[#f97316]"
          >
            {formatDate(entry.date)}
          </time>

          <h2 className="mt-2 text-2xl font-black tracking-normal text-gray-950">{entry.title}</h2>

          {entry.summary ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-gray-500">{entry.summary}</p>
          ) : null}

          <TagList tags={entry.tags} />
        </header>

        <div className="grid gap-5">
          {groups.length ? (
            groups.map((group) => <ChangelogGroup key={group.type} group={group} />)
          ) : (
            <p className="p-4 text-sm font-semibold leading-6 text-gray-500 rounded-2xl bg-gray-50">
              Esta versão ainda não possui itens detalhados publicados.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-orange-200 bg-orange-50/40 p-8 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Em breve</p>
      <h2 className="mt-2 text-2xl font-black text-gray-950">As novidades aparecerão aqui.</h2>
      <p className="max-w-xl mx-auto mt-3 text-sm font-semibold leading-6 text-gray-600">
        Estamos preparando o histórico de melhorias do PratoBy para você acompanhar a evolução do produto.
      </p>
    </div>
  )
}

function HeroSection({ latestEntry }) {
  return (
    <section className="relative px-4 pt-4 overflow-hidden pb-14 sm:px-6 lg:px-8">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,.16),transparent_34rem)]"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto">
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#f97316] shadow-sm">
              <FiClock size={14} aria-hidden="true" />
              Produto em evolução
            </span>

            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] tracking-normal text-[#111827] sm:text-5xl lg:text-6xl">
              Novidades do PratoBy
            </h1>

            <p className="max-w-2xl mt-5 text-base font-semibold leading-8 text-gray-600 sm:text-lg">
              Melhorias curadas para lojistas acompanharem o que mudou no cardápio digital, nos pedidos online,
              na loja pública e no painel.
            </p>
          </div>

          <LatestUpdateCard entry={latestEntry} />
        </div>
      </div>
    </section>
  )
}

function EntriesSection({ entries }) {
  return (
    <section className="px-4 pb-16 sm:px-6 lg:px-8" aria-labelledby="changelog-list-title">
      <div className="grid max-w-6xl gap-6 mx-auto">
        <h2 id="changelog-list-title" className="sr-only">
          Histórico de novidades do PratoBy
        </h2>

        {entries.length ? (
          entries.map((entry) => (
            <ChangelogEntryCard key={entry.id ?? `${entry.date}-${entry.title}`} entry={entry} />
          ))
        ) : (
          <EmptyState />
        )}
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 rounded-[1.6rem] bg-[#111827] p-6 text-white shadow-[0_22px_65px_rgba(15,23,42,.18)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Comece agora</p>
          <h2 className="mt-2 text-2xl font-black tracking-normal">
            Venda pelo seu próprio link, sem comissão por pedido.
          </h2>
          <p className="max-w-2xl mt-2 text-sm font-semibold leading-6 text-white/60">
            O PratoBy evolui para simplificar a rotina de restaurantes, lanchonetes, pizzarias e confeitarias.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <BtnCriarLoja className="w-full sm:w-auto" />
          <Link
            to="/planos"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-white/80 transition hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-[#111827]"
          >
            Ver planos
            <FiArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function ChangelogPage() {
  const entries = Array.isArray(changelogEntries) ? changelogEntries : []
  const latestEntry = entries[0]

  return (
    <MarketingLayout>
      <SEO
        title="Novidades do PratoBy | Melhorias do cardápio digital"
        description="Veja as últimas melhorias do PratoBy para cardápio digital, delivery próprio, pedidos online, dashboard e assinatura."
        path="/novidades"
        structuredData={structuredData}
      />

      <HeroSection latestEntry={latestEntry} />
      <EntriesSection entries={entries} />
      <CtaSection />
    </MarketingLayout>
  )
}
