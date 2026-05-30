// src/pages/merchant/menu/components/MenuStatsCards.jsx
// Cards de estatísticas do cardápio — filtros rápidos por status.

import { AnimatePresence, motion } from 'motion/react'
import {
  FiBox,
  FiCalendar,
  FiCheck,
  FiImage,
  FiList,
  FiPackage,
  FiStar,
  FiTag,
  FiX,
  FiMapPin,
  FiMap,
  FiHeart
} from 'react-icons/fi'

import { BAIRROS_ARACAJU } from '../utils/deliveryPayloads'

function StatCard({ icon: Icon, label, value, color, onClick, active }) {
  const palettes = {
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-[#f97316]',
    green:  'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    red:    'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400',
    blue:   'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    gray:   'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-[1.5rem] border bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        active 
          ? 'border-[#f97316] ring-2 ring-orange-100 dark:ring-orange-900/30 dark:border-[#f97316]' 
          : 'border-gray-100 dark:border-slate-800'
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${palettes[color] || palettes.orange}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-[#9ca3af] dark:text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-[#111827] dark:text-slate-50">{value}</p>
      </div>
    </button>
  )
}

/**
 * @param {{ store: object, stats: object, activeTab: string, filterStatus: string, setActiveTab: fn, setFilterStatus: fn }} props
 */
export default function MenuStatsCards({ store, stats, activeTab, filterStatus, setActiveTab, setFilterStatus }) {
  const isCouponsTab = activeTab === 'coupons'
  const isDeliveryTab = activeTab === 'delivery'

  // Compute Delivery Stats
  const deliveryFees = store?.deliveryFees || {}
  const deliveryActiveCount = stats?.deliveryActive || 0
  let deliveryCustomCount = 0
  let deliveryFreeCount = 0

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
    <AnimatePresence mode="popLayout">
      {!isCouponsTab && !isDeliveryTab && (
        <motion.div
          key="products-stats"
          initial={{ opacity: 0, y: -15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
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
            icon={FiList} label="Categorias" value={stats.categories} color="blue"
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

      {isCouponsTab && (
        <motion.div
          key="coupons-stats"
          initial={{ opacity: 0, y: -15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <StatCard
            icon={FiTag} label="Total de Cupons" value={stats.couponsTotal ?? 0} color="orange"
            onClick={() => setActiveTab('coupons')}
            active={true}
          />
          <StatCard
            icon={FiCheck} label="Cupons Ativos" value={stats.couponsActive ?? 0} color="green"
            onClick={() => setActiveTab('coupons')}
            active={true}
          />
          <StatCard
            icon={FiCalendar} label="Válidos Agora" value={stats.couponsValidNow ?? 0} color="blue"
            onClick={() => setActiveTab('coupons')}
            active={true}
          />
        </motion.div>
      )}

      {isDeliveryTab && (
        <motion.div
          key="delivery-stats"
          initial={{ opacity: 0, y: -15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <StatCard
            icon={FiMapPin} label="Bairros Ativos" value={deliveryActiveCount} color="green"
            onClick={() => setActiveTab('delivery')}
            active={true}
          />
          <StatCard
            icon={FiMap} label="Bairros Customizados" value={deliveryCustomCount} color="blue"
            onClick={() => setActiveTab('delivery')}
            active={true}
          />
          <StatCard
            icon={FiHeart} label="Entrega Grátis" value={deliveryFreeCount} color="orange"
            onClick={() => setActiveTab('delivery')}
            active={true}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
