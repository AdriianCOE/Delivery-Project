import { motion } from 'motion/react'
import {
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  Printer,
  ShoppingCart,
  Smartphone,
  TrendingUp,
} from 'lucide-react'

const CAPIVARA_LOGO =
  'https://res.cloudinary.com/dsionrn26/image/upload/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png'

const products = [
  {
    name: 'Capivara Clássico',
    desc: 'Pão brioche, blend artesanal, queijo e molho da casa.',
    price: 'R$ 28,00',
    image:
      'https://png.pngtree.com/png-vector/20231016/ourmid/pngtree-burger-food-png-free-download-png-image_10199386.png',
  },
  {
    name: 'Batata Rústica',
    desc: 'Porção crocante com tempero especial.',
    price: 'R$ 16,00',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2EIlmcWfSfEeLI19XjB-n1mLnjc0gVWSpmw&s',
  },
]

const orders = [
  {
    id: '#2847',
    customer: 'João Silva',
    items: '2x Capivara Clássico + Batata',
    value: 'R$ 89,80',
    status: 'Novo',
  },
  {
    id: '#2846',
    customer: 'Maria Costa',
    items: '1x Capivara Clássico',
    value: 'R$ 28,00',
    status: 'Preparo',
  },
]

export function ProductDemoSection() {
  return (
    <section className="relative overflow-hidden bg-[#0f172a] py-16 text-white lg:py-24">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-[#f97316]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mx-auto mb-12 max-w-3xl text-center lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-200 shadow-sm backdrop-blur-xl">
            Produto na prática
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Uma experiência bonita para o cliente.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-8 text-slate-300">
            O PratoBy organiza os dois lados do pedido: quem compra tem uma jornada rápida,
            e quem vende recebe tudo com clareza para produzir, confirmar pagamento e acompanhar status.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <motion.article
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl lg:p-10"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f97316]/15 text-[#fb923c] ring-1 ring-[#f97316]/20">
                <Smartphone size={22} />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Para o cliente</h3>
                <p className="text-sm font-semibold text-slate-400">
                  Simples, rápido e bonito.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
              <div className="relative overflow-hidden px-4 pb-5 pt-5">
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-[1px]"
                  style={{ backgroundImage: `url(${CAPIVARA_LOGO})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#111827]/95 via-[#111827]/88 to-[#f97316]/70" />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={CAPIVARA_LOGO}
                      alt="Capivara's Lanches"
                      className="h-12 w-12 rounded-2xl bg-white object-cover"
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        Capivara&apos;s Lanches
                      </p>

                      <p className="mt-1 text-xs font-bold text-white/65">
                        Aberta · Hoje até 20:00
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-400/20">
                    Online
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {products.map((product) => (
                  <div
                    key={product.name}
                    className="flex gap-3 rounded-[1.25rem] border border-white/10 bg-white/10 p-3"
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-16 w-16 shrink-0 rounded-2xl bg-white/90 object-contain p-1"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {product.name}
                      </p>

                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">
                        {product.desc}
                      </p>

                      <p className="mt-2 text-sm font-black text-orange-300">
                        {product.price}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="self-center rounded-2xl bg-[#f97316] px-3 py-2 text-xs font-black text-white"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-4">
                <div className="rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    <span className="text-sm font-black text-emerald-200">
                      Pedido confirmado
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200/80">
                    <Clock size={14} />
                    Em preparo · previsão de 35min
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                {['Sem baixar app', 'Acompanhamento em tempo real'].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 ring-1 ring-white/10"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl lg:p-10"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
                <LayoutDashboard size={22} />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Para o lojista</h3>
                <p className="text-sm font-semibold text-slate-400">
                  Controle total em tempo real.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1120]">
              <div className="flex border-b border-white/10">
                <div className="flex w-16 flex-col items-center gap-3 bg-black/20 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f97316]">
                    <LayoutDashboard size={19} className="text-white" />
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                    <ShoppingCart size={18} className="text-slate-400" />
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                    <TrendingUp size={18} className="text-slate-400" />
                  </div>
                </div>

                <div className="flex-1 space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold text-slate-400">Hoje</p>
                      <p className="mt-1 text-2xl font-black text-white">R$ 847</p>
                      <p className="text-xs font-black text-emerald-300">+23%</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold text-slate-400">Pedidos</p>
                      <p className="mt-1 text-2xl font-black text-white">18</p>
                      <p className="text-xs font-semibold text-slate-500">4 ativos</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-black text-white">
                            {order.id} · {order.customer}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                              order.status === 'Novo'
                                ? 'bg-emerald-400/15 text-emerald-300'
                                : 'bg-orange-400/15 text-orange-300'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <p className="mb-2 text-xs font-semibold text-slate-400">
                          {order.items}
                        </p>

                        <div className="flex items-center justify-between">
                          <p className="font-black text-white">{order.value}</p>

                          {order.status === 'Novo' ? (
                            <button
                              type="button"
                              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-white"
                            >
                              Aceitar
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-orange-300">
                              Preparando
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 p-4 sm:grid-cols-3">
                {[
                  [Bell, 'Pedido em tempo real'],
                  [Printer, 'Comanda rápida'],
                  [CreditCard, 'Pix manual'],
                  [MessageCircle, 'WhatsApp do cliente'],
                  [TrendingUp, 'Resumo do dia'],
                  [CheckCircle2, 'Status organizado'],
                ].map(([Icon, label]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 ring-1 ring-white/10"
                  >
                    <Icon size={14} className="text-emerald-300" />
                    {String(label)}
                  </div>
                ))}
              </div>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  )
}
