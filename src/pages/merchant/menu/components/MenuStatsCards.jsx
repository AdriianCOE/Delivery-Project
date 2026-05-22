// src/pages/merchant/menu/components/MenuStatsCards.jsx
// Cards de estatísticas do cardápio — filtros rápidos por status.

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
} from 'react-icons/fi'

function StatCard({ icon: Icon, label, value, color, onClick, active }) {
  const palettes = {
    orange: 'bg-orange-50 text-[#f97316]',
    green:  'bg-emerald-50 text-emerald-600',
    red:    'bg-red-50 text-red-500',
    blue:   'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray:   'bg-gray-100 text-gray-500',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-[1.5rem] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
        active ? 'border-[#f97316] ring-2 ring-orange-100' : 'border-gray-100'
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${palettes[color] || palettes.orange}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-[#9ca3af]">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-[#111827]">{value}</p>
      </div>
    </button>
  )
}

/**
 * @param {{ stats: object, activeTab: string, filterStatus: string, setActiveTab: fn, setFilterStatus: fn }} props
 */
export default function MenuStatsCards({ stats, activeTab, filterStatus, setActiveTab, setFilterStatus }) {
  const isCouponsTab = activeTab === 'coupons'

  if (isCouponsTab) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
    </div>
  )
}
