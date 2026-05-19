import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  Clock,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  ShoppingCart,
  Store,
  TrendingUp,
} from 'lucide-react'

const CAPIVARA_LOGO =
  'https://res.cloudinary.com/dsionrn26/image/upload/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png'

type DashboardMetric = {
  label: string
  value: string
  helper: string
  icon: LucideIcon
  tone: string
}

type DashboardOrder = {
  id: string
  customer: string
  item: string
  value: string
  payment: string
  neighborhood: string
  time: string
  status: 'Novo' | 'Preparo'
}

type DashboardFeature = {
  icon: LucideIcon
  title: string
  desc: string
}

const metrics: DashboardMetric[] = [
  {
    label: 'Hoje',
    value: 'R$ 847,80',
    helper: 'Faturamento',
    icon: TrendingUp,
    tone: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/20',
  },
  {
    label: 'Pedidos',
    value: '18',
    helper: '4 ativos agora',
    icon: ShoppingCart,
    tone: 'text-orange-300 bg-orange-400/10 ring-orange-400/20',
  },
  {
    label: 'Status',
    value: 'Aberta',
    helper: 'Até 20:00',
    icon: Store,
    tone: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/20',
  },
]

const orders: DashboardOrder[] = [
  {
    id: '#2847',
    customer: 'João Silva',
    item: '2x Capivara Clássico + Batata',
    value: 'R$ 89,80',
    payment: 'Pix',
    neighborhood: 'Atalaia',
    time: 'Agora',
    status: 'Novo',
  },
  {
    id: '#2846',
    customer: 'Maria Costa',
    item: '1x Combo Capivara',
    value: 'R$ 36,00',
    payment: 'Cartão na entrega',
    neighborhood: 'Farolândia',
    time: '5 min',
    status: 'Preparo',
  },
]

const features: DashboardFeature[] = [
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    desc: 'Avise o cliente em poucos cliques.',
  },
  {
    icon: CreditCard,
    title: 'Pagamento organizado',
    desc: 'Pix, cartão e dinheiro no pedido.',
  },
  {
    icon: PackageCheck,
    title: 'Status do pedido',
    desc: 'Novo, preparo, entrega e finalizado.',
  },
]

const flow = [
  {
    label: 'Novo',
    value: '9',
    className: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/20',
  },
  {
    label: 'Preparo',
    value: '4',
    className: 'bg-orange-400/10 text-orange-200 ring-orange-400/20',
  },
  {
    label: 'Entregado',
    value: '12',
    className: 'bg-cyan-400/10 text-cyan-200 ring-cyan-400/20',
  },
]

function getStatusClass(status: DashboardOrder['status']) {
  if (status === 'Novo') {
    return 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/20'
  }

  return 'bg-orange-400/15 text-orange-300 ring-orange-400/20'
}

export function ProductDemoSection() {
  return (
    <section className="relative overflow-hidden bg-[#0f172a] py-14 text-white lg:py-24">
      <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-[#f97316]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-8 max-w-3xl text-left sm:text-center lg:mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-orange-200 backdrop-blur-xl">
            <LayoutDashboard size={14} />
            Painel do lojista
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            O controle da loja em uma tela simples.
          </h2>

          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:mx-auto sm:text-base">
            O lojista recebe pedidos, acompanha o preparo, organiza pagamentos e
            fala com o cliente sem depender de planilhas ou aplicativos confusos.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <div className="border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={CAPIVARA_LOGO}
                  alt="Capivara's Lanches"
                  className="h-11 w-11 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-white/20"
                />

                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-white sm:text-lg">
                    Central de operação
                  </h3>

                  <p className="truncate text-xs font-semibold text-slate-400 sm:text-sm">
                    Capivara&apos;s Lanches
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/20">
                Aberta
              </span>
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_22rem] lg:p-8">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {metrics.map((metric, index) => {
                  const Icon = metric.icon

                  return (
                    <div
                      key={metric.label}
                      className={`rounded-[1.4rem] border border-white/10 bg-white/5 p-4 ${
                        index === 2 ? 'hidden sm:block' : ''
                      }`}
                    >
                      <div
                        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${metric.tone}`}
                      >
                        <Icon size={18} />
                      </div>

                      <p className="text-xs font-bold text-slate-400">
                        {metric.label}
                      </p>

                      <p className="mt-1 text-xl font-black text-white">
                        {metric.value}
                      </p>

                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {metric.helper}
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-[#0b1120]/80 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-black text-white sm:text-lg">
                      Pedidos ativos
                    </h4>

                    <p className="text-xs font-semibold text-slate-400 sm:text-sm">
                      Acompanhe o pedido do recebimento até a entrega.
                    </p>
                  </div>

                  <Clock className="hidden text-orange-300 sm:block" size={20} />
                </div>

                <div className="space-y-3">
                  {orders.map((order, index) => (
                    <div
                      key={order.id}
                      className={`rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 ${
                        index > 0 ? 'hidden md:block' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-white">
                              {order.id} · {order.customer}
                            </p>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${getStatusClass(
                                order.status,
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-slate-300">
                            {order.item}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {order.time} · {order.neighborhood} · {order.payment}
                          </p>
                        </div>

                        <p className="shrink-0 text-base font-black text-white">
                          {order.value}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-[#f97316] px-3 py-2 text-xs font-black text-white transition hover:bg-[#ea580c]"
                        >
                          Atualizar status
                        </button>

                        <button
                          type="button"
                          className="rounded-xl bg-white/5 px-3 py-2 text-xs font-black text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
                        >
                          Comanda
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:hidden">
                {flow.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl px-3 py-3 text-center ring-1 ${item.className}`}
                  >
                    <p className="text-lg font-black">{item.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-wide opacity-80">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="hidden space-y-5 lg:block">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-white">Fluxo do dia</h4>
                    <p className="mt-1 text-sm font-semibold text-slate-400">
                      Resumo dos pedidos em andamento.
                    </p>
                  </div>

                  <CheckCircle2 className="text-emerald-300" size={22} />
                </div>

                <div className="grid gap-3">
                  {flow.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${item.className}`}
                    >
                      <span className="text-sm font-black uppercase tracking-wide">
                        {item.label}
                      </span>

                      <span className="text-xl font-black">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-[#f97316]/20 to-white/[0.04] p-5">
                <h4 className="font-black text-white">
                  Menos bagunça na operação.
                </h4>

                <p className="mt-2 text-sm font-semibold leading-6 text-orange-100/80">
                  Tudo que o lojista precisa para vender online aparece no mesmo
                  lugar: pedido, status, pagamento e contato do cliente.
                </p>
              </div>

              <div className="space-y-3">
                {features.map((feature) => {
                  const Icon = feature.icon

                  return (
                    <div
                      key={feature.title}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-orange-300 ring-1 ring-white/10">
                        <Icon size={18} />
                      </div>

                      <div>
                        <h5 className="text-sm font-black text-white">
                          {feature.title}
                        </h5>

                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </section>
  )
}