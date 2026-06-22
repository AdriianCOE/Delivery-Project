import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { FaCrown as Crown } from 'react-icons/fa6'
import {
  FiArrowRight as ArrowRight,
  FiCheck as Check,
  FiMousePointer as MousePointer2,
  FiX as X,
  FiZap as Zap,
} from 'react-icons/fi'

const features = [
  { name: 'Link próprio', importance: 'high' },
  { name: 'Sem comissão do PratoBy por pedido', importance: 'high' },
  { name: 'Cardápio organizado', importance: 'medium' },
  { name: 'Carrinho com adicionais', importance: 'medium' },
  { name: 'Painel de pedidos', importance: 'high' },
  { name: 'Controle da marca', importance: 'high' },
  { name: 'Acompanhamento do pedido', importance: 'medium' },
  { name: 'Cupons e taxa por bairro', importance: 'medium' },
]

const comparison = {
  whatsapp: [false, true, false, false, false, false, false, false],
  apps: [false, false, true, true, false, false, true, false],
  pratoby: [true, true, true, true, true, true, true, true],
}

const columns = [
  {
    key: 'whatsapp',
    title: 'WhatsApp',
    subtitle: 'Manual',
    note: 'Fácil de começar, difícil de escalar',
  },
  {
    key: 'apps',
    title: 'Apps de delivery',
    subtitle: 'Com comissão',
    note: 'Boa vitrine, pouca margem',
  },
  {
    key: 'pratoby',
    title: 'PratoBy',
    subtitle: '0% de comissão',
    note: 'Seu link, sua marca, seu cliente',
    recommended: true,
  },
] as const

export function ComparisonSection() {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>('pratoby')

  function renderValue(value: boolean, highlight = false) {
    if (value) {
      return (
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
            highlight
              ? 'bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-md shadow-orange-300/50'
              : 'bg-emerald-50'
          }`}
        >
          <Check className={highlight ? 'text-white' : 'text-emerald-600'} size={18} />
        </div>
      )
    }

    return (
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
        <X className="text-slate-400" size={18} />
      </div>
    )
  }

  return (
    <section className="relative overflow-hidden bg-[#f8fafc] py-16 lg:py-24">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-orange-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-slate-200/80 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mx-auto mb-12 max-w-4xl text-center lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-[#f97316] shadow-sm">
            <Zap className="text-[#f97316]" size={17} />
            Comparação direta
          </div>

          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl">
            {/* Cada span com 'block' força uma quebra de linha */}
            <span className="block">WhatsApp organiza pouco</span>
            <span className="block">Apps cobram muito</span>
            <span className="block text-[#f97316]">PratoBy é o ideal</span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-[#6b7280]">
            Compare o que muda na operação, na marca e no lucro quando a loja para de depender
            só de conversa manual ou de plataformas com comissão.
          </p>

          <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
            {columns.map((column) => (
              <button
                key={column.key}
                type="button"
                onMouseEnter={() => setHoveredColumn(column.key)}
                onFocus={() => setHoveredColumn(column.key)}
                className={`rounded-[1.4rem] border px-4 py-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${
                  hoveredColumn === column.key
                    ? column.recommended
                      ? 'border-orange-200 bg-orange-50 shadow-orange-100/70'
                      : 'border-slate-200 bg-white shadow-slate-100/70'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <p
                  className={`text-sm font-black ${
                    column.recommended ? 'text-[#f97316]' : 'text-[#111827]'
                  }`}
                >
                  {column.title}
                </p>

                <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                  {column.note}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#6b7280] ring-1 ring-slate-100">
            <MousePointer2 size={14} className="text-[#f97316]" />
            Passe o mouse nas colunas para comparar
          </div>
        </motion.div>

        <div className="space-y-4 lg:hidden">
          {columns
            .slice()
            .reverse()
            .map((column) => {
              const values = comparison[column.key]

              return (
                <motion.article
                  key={column.key}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`rounded-[2rem] border p-6 shadow-sm ${
                    column.recommended
                      ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-orange-100/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-4 text-center">
                    {column.recommended && (
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#f97316] px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-md">
                        <Crown size={15} />
                        Recomendado
                      </div>
                    )}

                    <h3 className="text-2xl font-black text-[#111827]">{column.title}</h3>
                    <p className="mt-1 text-sm font-bold text-[#6b7280]">{column.subtitle}</p>
                  </div>

                  <div className="space-y-2">
                    {features.map((feature, index) => (
                      <div
                        key={feature.name}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-100"
                      >
                        {renderValue(values[index], column.recommended)}
                        <span className="text-sm font-bold text-[#111827]">
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.article>
              )
            })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 lg:block"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-5 text-left text-sm font-black uppercase tracking-wide text-slate-500">
                  Funcionalidade
                </th>

                {columns.map((column) => (
                  <th
                    key={column.key}
                    onMouseEnter={() => setHoveredColumn(column.key)}
                    onMouseLeave={() => setHoveredColumn(null)}
                    className={`px-6 py-5 text-center transition-all ${
                      column.recommended
                        ? 'bg-gradient-to-br from-orange-50 to-orange-100/70'
                        : hoveredColumn === column.key
                          ? 'bg-slate-100'
                          : ''
                    }`}
                  >
                    {column.recommended && (
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#f97316] px-3 py-1.5 text-xs font-black text-white shadow-md">
                        <Crown size={14} />
                        Recomendado
                      </div>
                    )}

                    <div className="text-base font-black text-[#111827]">
                      {column.title}
                    </div>

                    <div
                      className={`mt-1 text-xs font-bold ${
                        column.recommended ? 'text-emerald-600' : 'text-[#6b7280]'
                      }`}
                    >
                      {column.subtitle}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {features.map((feature, index) => (
                <motion.tr
                  key={feature.name}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                  className={`border-b border-slate-100 last:border-0 transition hover:bg-slate-50 ${
                    feature.importance === 'high' ? 'bg-orange-50/20' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#111827]">{feature.name}</span>

                      {feature.importance === 'high' && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                          Essencial
                        </span>
                      )}
                    </div>
                  </td>

                  {columns.map((column) => (
                    <td
                      key={column.key}
                      onMouseEnter={() => setHoveredColumn(column.key)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      className={`px-6 py-4 text-center transition-all ${
                        column.recommended
                          ? 'bg-gradient-to-br from-orange-50 to-orange-100/50'
                          : hoveredColumn === column.key
                            ? 'bg-slate-100'
                            : ''
                      }`}
                    >
                      {renderValue(comparison[column.key][index], column.recommended)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="mt-10 text-center"
        >
          <Link
            to="/cadastro"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-8 py-4 text-base font-black text-white shadow-xl shadow-orange-200 transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c]"
          >
            Criar minha loja
            <ArrowRight size={18} />
          </Link>

          <p className="mt-4 text-sm font-semibold text-[#6b7280]">
            Comece com sua loja online e valide seu delivery próprio.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
