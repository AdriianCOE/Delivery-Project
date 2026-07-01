import { motion } from 'motion/react'
import type { IconType } from 'react-icons'
import {
  FiBarChart2 as BarChart2,
  FiBell as Bell,
  FiChevronRight as ChevronRight,
  FiClock as Clock,
  FiCreditCard as CreditCard,
  FiGrid as LayoutDashboard,
  FiLogOut as LogOut,
  FiMessageSquare as MessageSquare,
  FiSettings as Settings,
  FiShoppingBag as ShoppingBag,
  FiStar as Star,
  FiHome as Store,
  FiTrendingUp as TrendingUp,
  FiUser as User,
  FiUsers as Users,
  FiZap as Zap,
} from 'react-icons/fi'

import PratoByLogoIcon from '../../../components/ui/PratoByLogoIcon'

const CAPIVARA_LOGO =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto,w_64,h_64,c_fill/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png'

type NavItem = {
  icon: IconType
  label: string
  sub: string
  active?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', sub: 'Visão geral da operação', active: true },
  { icon: ShoppingBag, label: 'Pedidos', sub: 'Kanban e comandas' },
  { icon: Store, label: 'Cardápio', sub: 'Produtos e categorias' },
  { icon: BarChart2, label: 'Estatísticas', sub: 'Resumo de vendas' },
  { icon: Star, label: 'Avaliações', sub: 'Feedback dos clientes' },
  { icon: Settings, label: 'Configurações', sub: 'Loja, horários e Pix' },
  { icon: CreditCard, label: 'Assinatura', sub: 'Plano, teste e cobrança' },
  { icon: User, label: 'Perfil', sub: 'Conta e segurança' },
]

const METRICS = [
  { label: 'Faturamento', value: 'R$ 847,80', sub: '+12% vs período ant...', icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { label: 'Pedidos', value: '18', sub: '+5 vs período ant...', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { label: 'Ticket Médio', value: 'R$ 47,10', sub: 'pico às 19h', icon: BarChart2, color: 'text-violet-400', bg: 'bg-violet-400/10' },
  { label: 'Clientes', value: '14', sub: 'clientes únicos', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { label: 'Conclusão', value: '94%', sub: 'pedidos entregues', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { label: 'Economia', value: 'R$ 89,00', sub: 'promoções + cupons', icon: MessageSquare, color: 'text-pink-400', bg: 'bg-pink-400/10' },
]

const RECENT_ORDERS = [
  { id: '#2847', customer: 'João Silva', items: '2x Capivara Clássico + Batata Rústica', value: 'R$ 72,00', payment: 'Pix', neighborhood: 'Atalaia', time: 'Agora', status: 'Novo' as const },
  { id: '#2846', customer: 'Maria Costa', items: '1x Combo Capivara + Refri', value: 'R$ 42,00', payment: 'Cartão', neighborhood: 'Farolândia', time: '5 min', status: 'Preparo' as const },
  { id: '#2845', customer: 'Carlos Andrade', items: '3x Batata Rústica + 2x Refri', value: 'R$ 60,00', payment: 'Pix', neighborhood: 'Jardins', time: '12 min', status: 'Entrega' as const },
  { id: '#2844', customer: 'Ana Beatriz', items: '1x Capivara Clássico', value: 'R$ 28,00', payment: 'Dinheiro', neighborhood: 'Centro', time: '18 min', status: 'Entregue' as const },
  { id: '#2843', customer: 'Lucas Mendes', items: '2x Combo Capivara', value: 'R$ 78,00', payment: 'Pix', neighborhood: 'Luzia', time: '25 min', status: 'Entregue' as const },
]

function getOrderStatusStyle(status: string) {
  switch (status) {
    case 'Novo':
      return 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/25'
    case 'Preparo':
      return 'bg-orange-400/15 text-orange-300 ring-orange-400/25'
    case 'Entrega':
      return 'bg-blue-400/15 text-blue-300 ring-blue-400/25'
    case 'Entregue':
      return 'bg-slate-400/10 text-slate-400 ring-slate-400/20'
    default:
      return 'bg-white/5 text-slate-400 ring-white/10'
  }
}

/* -------------------------------------------------------------------------- */

function DashboardScreen() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0f172a] text-white font-sans">

      {/* ÔöÇÔöÇ SIDEBAR ÔöÇÔöÇ */}
      <aside className="flex w-[148px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b1120]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.07]">
          <PratoByLogoIcon size="tiny" className="shadow-none" />
          <div className="min-w-0">
            <p className="text-[10px] font-black text-white leading-tight">PratoBy</p>
            <p className="text-[8px] font-semibold text-slate-500 leading-tight">Painel do lojista</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
          <p className="px-1.5 py-1.5 text-[7px] font-black uppercase tracking-[0.12em] text-slate-600">Principal</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all ${
                  item.active
                    ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon size={11} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black leading-tight truncate">{item.label}</p>
                  <p className={`text-[7px] font-semibold leading-tight truncate ${item.active ? 'text-orange-100/70' : 'text-slate-600'}`}>
                    {item.sub}
                  </p>
                </div>
                {item.active && <ChevronRight size={8} className="shrink-0 ml-auto text-orange-200/60" />}
              </div>
            )
          })}
        </div>

        {/* User footer */}
        <div className="border-t border-white/[0.07] p-2">
          <div className="flex items-center gap-2">
            <img
              src={CAPIVARA_LOGO}
              alt="Pedro Alcantara"
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black text-white truncate">Pedro Alcantara</p>
              <p className="text-[7px] text-slate-500 truncate">capivara@pratoby.com</p>
            </div>
            <Star size={8} className="shrink-0 text-slate-600" />
          </div>
          <button type="button" className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[7px] font-black text-red-400 ring-1 ring-red-500/20">
            <LogOut size={7} />
            Sair da conta
          </button>
          <p className="mt-1 text-center text-[6px] text-slate-700">© 2026 PratoBy</p>
        </div>
      </aside>

      {/* ÔöÇÔöÇ MAIN CONTENT ÔöÇÔöÇ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0b1120]/80 px-4 py-2 backdrop-blur-sm">
          <div>
            <p className="text-[10px] font-black text-white">Bom dia, Pedro Alcantara</p>
            <p className="text-[8px] font-semibold text-slate-500">Qua, 28 de Mai · 18:29 · /capivaras-lanches</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[8px] font-black text-slate-300 hover:bg-white/10 transition">
              <Store size={9} />
              Ver loja
            </button>
            <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-slate-400">
              <Bell size={11} />
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#f97316] ring-1 ring-[#0b1120]" />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">
              <img
                src={CAPIVARA_LOGO}
                alt=""
                width={20}
                height={20}
                loading="lazy"
                decoding="async"
                className="h-5 w-5 rounded-md object-cover"
              />
              <span className="text-[8px] font-black text-white">Perfil</span>
            </div>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden p-3 space-y-3">

          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tempo Real
                </span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-black text-emerald-300 ring-1 ring-emerald-400/20">
                  ● Loja Aberta 
                </span>
                <span className="text-[8px] text-slate-400 font-semibold">👥 16 visitantes agora</span>
              </div>
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-red-500/80 px-2.5 py-1 text-[8px] font-black text-white shadow-md shadow-red-500/30 transition hover:bg-red-600">
              Fechar loja
            </button>
          </div>

          {/* Store hero */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={CAPIVARA_LOGO}
                  alt="Capivara's Lanches"
                  width={36}
                  height={36}
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 shrink-0 rounded-xl bg-white object-cover"
                />
                <div>
                  <p className="text-[8px] font-semibold text-slate-500">Olá, capivara</p>
                  <p className="text-sm font-black text-white leading-tight">Capivara&apos;s Lanches</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">
                    <span className="text-[#f97316]">/capivaras-lanches</span>
                    {' '}·  Hoje: 15:00 às 20:00
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-center">
                {[['Pendentes', '4'], ['Preparo', '2'], ['Em Rota', '1']].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">{label}</p>
                    <p className="text-lg font-black text-white">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[8px] font-semibold text-slate-500">
              Acompanhe pedidos, faturamento, clientes online e os principais pontos da operação em tempo real.
            </p>
          </div>

          {/* Quick status */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Atenção Agora', val: '1', sub: 'Pedido aguardando confirmação', color: 'text-orange-300', ring: 'ring-orange-400/20 bg-orange-400/5' },
              { label: 'Revisão', val: '0', sub: 'Pedidos com alerta de preço', color: 'text-yellow-300', ring: 'ring-yellow-400/20 bg-yellow-400/5' },
              { label: 'Operação', val: '3', sub: 'Pedidos em andamento agora', color: 'text-cyan-300', ring: 'ring-cyan-400/20 bg-cyan-400/5' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-2.5 ring-1 ${s.ring}`}>
                <p className="text-[7px] font-black uppercase tracking-wider text-slate-500">{s.label}</p>
                <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-[7px] text-slate-500 leading-tight mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Period filter + Metrics */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex gap-1">
                {['Hoje', '7 dias', '30 dias'].map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    className={`rounded-full px-2.5 py-0.5 text-[8px] font-black ${
                      i === 1
                        ? 'bg-[#f97316] text-white'
                        : 'bg-white/5 text-slate-400 ring-1 ring-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tempo real ativo
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
              {METRICS.map((m) => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
                    <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg ${m.bg}`}>
                      <Icon size={11} className={m.color} />
                    </div>
                    <p className="text-[7px] font-bold uppercase tracking-wide text-slate-500">{m.label}</p>
                    <p className="text-[11px] font-black text-white mt-0.5">{m.value}</p>
                    <p className="text-[7px] text-slate-600 truncate">{m.sub}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Insights + Recent Orders */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.06]">
              <div>
                <p className="text-[7px] font-black uppercase tracking-wider text-slate-500">Insights Rápidos</p>
                <p className="text-[10px] font-black text-white">Resumo do dia</p>
              </div>
              <button type="button" className="flex items-center gap-1 text-[8px] font-black text-[#f97316]">
                Ver estatísticas <ChevronRight size={9} />
              </button>
            </div>

            {/* Orders table header */}
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] gap-1 px-3 py-1.5 text-[7px] font-black uppercase tracking-wider text-slate-600 border-b border-white/[0.04]">
              <span>Pedido</span>
              <span>Cliente / Itens</span>
              <span>Valor</span>
              <span>Pagamento</span>
              <span>Bairro</span>
              <span>Status</span>
            </div>

            {/* Orders rows */}
            {RECENT_ORDERS.map((order, idx) => (
              <div
                key={order.id}
                className={`grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] gap-1 px-3 py-2 items-center ${
                  idx % 2 === 0 ? 'bg-white/[0.02]' : ''
                } ${idx < RECENT_ORDERS.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
              >
                <div>
                  <p className="text-[9px] font-black text-white">{order.id}</p>
                  <p className="text-[7px] text-slate-500 flex items-center gap-0.5">
                    <Clock size={6} /> {order.time}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black text-white truncate">{order.customer}</p>
                  <p className="text-[7px] text-slate-500 truncate">{order.items}</p>
                </div>
                <p className="text-[9px] font-black text-white">{order.value}</p>
                <p className="text-[8px] font-semibold text-slate-400">{order.payment}</p>
                <p className="text-[8px] font-semibold text-slate-400">{order.neighborhood}</p>
                <span className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ring-1 ${getOrderStatusStyle(order.status)}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

import { useRef, useEffect, useState } from 'react'

/* -------------------------------------------------------------------------- */

export function ProductDemoSection() {
  const screenRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setScale(entries[0].contentRect.width / 1000)
      }
    })
    if (screenRef.current) {
      observer.observe(screenRef.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative overflow-hidden bg-[#0f172a] py-14 text-white lg:py-24">
      {/* Background glows */}
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#f97316]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 bottom-20 h-48 w-[600px] -translate-x-1/2 rounded-full bg-violet-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-3xl text-left sm:text-center lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-orange-200 backdrop-blur-xl">
            <LayoutDashboard size={14} />
            Painel do lojista
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            O controle da loja em uma tela simples.
          </h2>

          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:mx-auto sm:text-base">
            O lojista recebe pedidos, acompanha o preparo, organiza pagamentos e fala com o
            cliente sem depender de planilhas ou aplicativos confusos.
          </p>
        </motion.div>

        {/* ÔöÇÔöÇ LAPTOP MOCKUP (Flat 2D) ÔöÇÔöÇ */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Floating label badges */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute -left-4 top-40 z-30 hidden md:block lg:-left-16 xl:-left-24"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 backdrop-blur-xl shadow-xl"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-black text-white">Gestão em tempo real</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">Atualizações instantâneas</p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute -right-4 top-56 z-30 hidden md:block lg:-right-12 xl:-right-20"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 backdrop-blur-xl shadow-xl"
            >
              <p className="text-[9px] font-black text-violet-300">Tudo no mesmo lugar</p>
              <p className="text-[8px] text-slate-400 mt-0.5">Sem pular entre abas e planilhas</p>
            </motion.div>
          </motion.div>

          {/* The laptop container — flat 2D */}
          <div className="relative flex flex-col items-center">
            {/* Screen lid + bezel */}
            <div
              className="relative z-10 w-[94%] rounded-t-xl sm:rounded-t-2xl border-[1px] border-[#e5e7eb]/80 bg-[#171717] p-2 sm:p-3 md:p-4"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Screen inner */}
              <div
                ref={screenRef}
                className="overflow-hidden rounded sm:rounded-md bg-[#0f172a] relative"
                style={{
                  aspectRatio: '16/10',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="absolute left-0 top-0 w-[1000px] h-[625px]"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <DashboardScreen />
                </div>
              </div>
            </div>

            {/* ÔöÇÔöÇ LAPTOP BASE (Flat) ÔöÇÔöÇ */}
            <div
              className="relative z-20 h-2 sm:h-3 md:h-4 w-[98%] rounded-b-md sm:rounded-b-lg"
              style={{
                background: 'linear-gradient(to bottom, #f3f4f6, #9ca3af)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 20px rgba(0,0,0,0.4)',
              }}
            >
              {/* Thumb notch */}
              <div className="absolute left-1/2 top-0 h-1 sm:h-1.5 w-12 sm:w-20 -translate-x-1/2 rounded-b-md bg-[#6b7280]/30 shadow-inner" />
            </div>
          </div>

          {/* Ground shadow + glow */}
          <div
            className="absolute -bottom-8 left-1/2 -z-10 -translate-x-1/2"
            style={{
              width: '90%',
              height: '50px',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.65) 0%, transparent 70%)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="absolute -bottom-12 left-1/2 -z-10 -translate-x-1/2"
            style={{
              width: '55%',
              height: '40px',
              background: 'radial-gradient(ellipse, rgba(249,115,22,0.15) 0%, transparent 70%)',
              filter: 'blur(24px)',
            }}
          />
        </motion.div>

      </div>
    </section>
  )
}
