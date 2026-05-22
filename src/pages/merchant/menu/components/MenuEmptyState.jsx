// src/pages/merchant/menu/components/MenuEmptyState.jsx
// Estado vazio reutilizável para abas de produtos e categorias.

import { FiPlus } from 'react-icons/fi'

/**
 * @param {{ icon: React.ComponentType, title: string, description?: string, action?: { label: string, onClick: fn } }} props
 */
export default function MenuEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-orange-50 text-[#f97316]">
        <Icon size={36} />
      </div>
      <h3 className="mt-5 text-xl font-black text-[#111827]">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#6b7280]">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
        >
          <FiPlus size={16} /> {action.label}
        </button>
      )}
    </div>
  )
}
