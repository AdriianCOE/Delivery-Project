// src/pages/merchant/menu/components/MenuStatsCards.jsx
// Cards de estatísticas do cardápio — filtros rápidos por status.

import { AnimatePresence, motion } from 'motion/react'
import {
  FiBox,
  FiCalendar,
  FiCheck,
  FiHeart,
  FiImage,
  FiList,
  FiMap,
  FiMapPin,
  FiPackage,
  FiStar,
  FiTag,
  FiX,
} from 'react-icons/fi'

import { BAIRROS_ARACAJU } from '../utils/deliveryPayloads'

// ─── Paleta sem azul — apenas cores da marca ─────────────────────────────────

const PALETTES = {
  orange: {
    icon:   'bg-orange-50   dark:bg-orange-500/10 text-[#f97316]',
    glow:   'from-orange-400/8  to-transparent',
    active: 'shadow-orange-100/60 dark:shadow-orange-900/20',
  },
  green: {
    icon:   'bg-emerald-50  dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    glow:   'from-emerald-400/8 to-transparent',
    active: 'shadow-emerald-100/60 dark:shadow-emerald-900/20',
  },
  red: {
    icon:   'bg-red-50      dark:bg-red-500/10     text-red-500     dark:text-red-400',
    glow:   'from-red-400/8     to-transparent',
    active: 'shadow-red-100/60 dark:shadow-red-900/20',
  },
  amber: {
    icon:   'bg-amber-50    dark:bg-amber-500/10   text-amber-600   dark:text-amber-400',
    glow:   'from-amber-400/8   to-transparent',
    active: 'shadow-amber-100/60 dark:shadow-amber-900/20',
  },
  yellow: {
    icon:   'bg-yellow-50   dark:bg-yellow-500/10  text-yellow-600  dark:text-yellow-400',
    glow:   'from-yellow-400/8  to-transparent',
    active: 'shadow-yellow-100/60 dark:shadow-yellow-900/20',
  },
  gray: {
    icon:   'bg-gray-100    dark:bg-slate-800       text-gray-500    dark:text-slate-400',
    glow:   'from-gray-400/5    to-transparent',
    active: 'shadow-gray-100/60 dark:shadow-slate-900/20',
  },
}

function StatCard({ icon: Icon, label, value, color = 'orange', onClick, active }) {
  const pal = PALETTES[color] ?? PALETTES.orange

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex flex-col gap-3 overflow-hidden rounded-[1.5rem] border p-4 text-left',
        'bg-white dark:bg-slate-900',
        'transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]',
        active
          ? `border-[#f97316] dark:border-[#f97316] ring-2 ring-orange-100 dark:ring-orange-900/30 shadow-lg ${pal.active}`
          : 'border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-slate-700',
      ].join(' ')}
    >
      {/* gradiente de cor suave no topo */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${pal.glow}`}
      />

      {/* ícone */}
      <div className={`relative grid h-10 w-10 place-items-center rounded-2xl ${pal.icon} transition-transform duration-200 group-hover:scale-110`}>
        <Icon size={18} />
      </div>

      {/* texto */}
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#9ca3af] dark:text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black tracking-tight text-[#111827] dark:text-slate-50">
          {value}
        </p>
      </div>

      {/* borda inferior ativa */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#f97316]"
        />
      )}
    </button>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * @param {{ store: object, stats: object, activeTab: string, filterStatus: string, setActiveTab: fn, setFilterStatus: fn }} props
 */
export default function MenuStatsCards({ store, stats, activeTab, filterStatus, setActiveTab, setFilterStatus }) {
  const isCouponsTab  = activeTab === 'coupons'
  const isDeliveryTab = activeTab === 'delivery'

  const deliveryFees = store?.deliveryFees || {}
  const deliveryActiveCount = stats?.deliveryActive || 0
  let deliveryCustomCount = 0
  let deliveryFreeCount   = 0

  if (isDeliveryTab) {
    Object.entries(deliveryFees).forEach(([bname, fee]) => {
      const isActive = fee !== undefined && fee !== null && fee !== ''
      if (isActive) {
        if (!BAIRROS_ARACAJU.includes(bname)) deliveryCustomCount++
        if (Number(fee) === 0) deliveryFreeCount++
      }
    })
  }

  return (
    <AnimatePresence mode="wait">

      {/* ── Produtos / Categorias ── */}
      {!isCouponsTab && !isDeliveryTab && (
        <motion.div
          key="products-stats"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <StatCard
            icon={FiPackage} label="Total" value={stats.total} color="orange"
            onClick={() => { setActiveTab('products'); setFilterStatus('all') }}
            active={activeTab === 'products' && filterStatus === 'all'}
          />
          <StatCard
            icon={FiCheck} label="Ativos" value={stats.active} color="green"
            onClick={() => { setActiveTab('products'); setFilterStatus('active') }}
            active={activeTab === 'products' && filterStatus === 'active'}
          />
          <StatCard
            icon={FiX} label="Indisponíveis" value={stats.unavailable} color="red"
            onClick={() => { setActiveTab('products'); setFilterStatus('unavailable') }}
            active={activeTab === 'products' && filterStatus === 'unavailable'}
          />
          <StatCard
            icon={FiList} label="Categorias" value={stats.categories} color="amber"
            onClick={() => setActiveTab('categories')}
            active={activeTab === 'categories'}
          />
          <StatCard
            icon={FiStar} label="Destaques" value={stats.featured} color="yellow"
            onClick={() => { setActiveTab('products'); setFilterStatus('featured') }}
            active={activeTab === 'products' && filterStatus === 'featured'}
          />
          <StatCard
            icon={FiImage} label="Sem imagem" value={stats.noImage} color="gray"
            onClick={() => { setActiveTab('products'); setFilterStatus('no-image') }}
            active={activeTab === 'products' && filterStatus === 'no-image'}
          />
        </motion.div>
      )}

      {/* ── Cupons ── */}
      {isCouponsTab && (
        <motion.div
          key="coupons-stats"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <StatCard
            icon={FiTag}      label="Total de Cupons" value={stats.couponsTotal    ?? 0} color="orange"
            onClick={() => setActiveTab('coupons')} active
          />
          <StatCard
            icon={FiCheck}    label="Cupons Ativos"   value={stats.couponsActive   ?? 0} color="green"
            onClick={() => setActiveTab('coupons')} active
          />
          <StatCard
            icon={FiCalendar} label="Válidos Agora"   value={stats.couponsValidNow ?? 0} color="amber"
            onClick={() => setActiveTab('coupons')} active
          />
        </motion.div>
      )}

      {/* ── Entrega ── */}
      {isDeliveryTab && (
        <motion.div
          key="delivery-stats"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <StatCard
            icon={FiMapPin} label="Bairros Ativos"      value={deliveryActiveCount} color="green"
            onClick={() => setActiveTab('delivery')} active
          />
          <StatCard
            icon={FiMap}    label="Bairros Customizados" value={deliveryCustomCount} color="amber"
            onClick={() => setActiveTab('delivery')} active
          />
          <StatCard
            icon={FiHeart}  label="Entrega Grátis"       value={deliveryFreeCount}   color="orange"
            onClick={() => setActiveTab('delivery')} active
          />
        </motion.div>
      )}

    </AnimatePresence>
  )
}