// src/pages/merchant/menu/components/MenuDeliveryAreasTab.jsx
// Aba de Gestão de Taxas de Entrega por Bairro.

import { useMemo, useState } from 'react'
import {
  FiEdit,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import { BAIRROS_ARACAJU, formatMoneyBrl } from '../utils/deliveryPayloads'
import AnimatedSegmentedControl from '../../../../components/ui/AnimatedSegmentedControl'

/**
 * @param {{
 *   store: object,
 *   onSaveFees: fn,
 *   onEditArea: fn,
 *   onAddArea: fn,
 *   onToast: fn,
 * }} props
 */
export default function MenuDeliveryAreasTab({
  store,
  onSaveFees,
  onEditArea,
  onAddArea,
  onToast,
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'

  const deliveryFees = store?.deliveryFees || {}

  // 1. Mapeia todos os bairros (Presets Aracaju + Customizados no banco que não estão no preset)
  const allMappedAreas = useMemo(() => {
    const customBairros = Object.keys(deliveryFees).filter(
      (b) => !BAIRROS_ARACAJU.includes(b)
    )
    const combined = [...BAIRROS_ARACAJU, ...customBairros]

    return combined
      .map((bname) => {
        const feeValue = deliveryFees[bname]
        const isActive =
          feeValue !== undefined && feeValue !== null && feeValue !== ''
        const isCustom = !BAIRROS_ARACAJU.includes(bname)

        return {
          neighborhood: bname,
          fee: isActive ? Number(feeValue) : null,
          isActive,
          isCustom,
        }
      })
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood))
  }, [deliveryFees])

  // 2. Filtros e Busca
  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase()

    return allMappedAreas.filter((item) => {
      // Busca por nome
      const matchesSearch = item.neighborhood.toLowerCase().includes(term)

      // Filtro de status
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive)

      return matchesSearch && matchesStatus
    })
  }, [allMappedAreas, search, statusFilter])

  // 3. Métricas
  const stats = useMemo(() => {
    const active = allMappedAreas.filter((a) => a.isActive)
    const customActive = active.filter((a) => a.isCustom)
    const free = active.filter((a) => a.fee === 0)

    return {
      activeCount: active.length,
      customActiveCount: customActive.length,
      freeCount: free.length,
    }
  }, [allMappedAreas])

  // 4. Toggle Ativo/Inativo
  const handleToggleActive = async (area) => {
    const newFees = { ...deliveryFees }

    if (area.isActive) {
      // Desativar: salvar como null no banco
      newFees[area.neighborhood] = null
      try {
        await onSaveFees(newFees)
        onToast({
          type: 'success',
          message: `Bairro "${area.neighborhood}" desativado.`,
        })
      } catch (err) {
        console.error(err)
        onToast({ type: 'error', message: 'Erro ao desativar bairro.' })
      }
    } else {
      // Reativar: regra de negócio: não reativar automaticamente com R$ 0,00.
      // Abrir o drawer para informar a taxa.
      onEditArea({
        ...area,
        fee: null, // força preenchimento novo
      })
    }
  }

  // 5. Excluir bairro customizado
  const handleDeleteCustom = async (area) => {
    if (!window.confirm(`Excluir permanentemente o bairro "${area.neighborhood}"?`)) {
      return
    }

    const newFees = { ...deliveryFees }
    delete newFees[area.neighborhood]

    try {
      await onSaveFees(newFees)
      onToast({
        type: 'success',
        message: `Bairro "${area.neighborhood}" excluído.`,
      })
    } catch (err) {
      console.error(err)
      onToast({ type: 'error', message: 'Erro ao excluir bairro.' })
    }
  }

  return (
    <div className="space-y-6">
      {/* ── BARRA DE CONTROLE E FILTROS ── */}
      <div className="flex flex-col gap-3 rounded-[2rem] border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between transition-all">
        {/* Busca e Status */}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Input Busca */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 md:h-10 w-full rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-11 pr-4 text-sm font-bold text-[#111827] dark:text-slate-50 outline-none transition-all duration-200 focus:border-[#f97316] dark:focus:border-[#f97316] focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 placeholder-slate-400"
            />
          </div>

          {/* Filtros Status */}
          <div className="w-full shrink-0 sm:w-auto">
            <AnimatedSegmentedControl
              size="md"
              variant="neutral"
              fullWidthMobile={true}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
              ]}
            />
          </div>
        </div>

        {/* CTA Novo Bairro */}
        <button
          type="button"
          onClick={onAddArea}
          className="flex h-11 md:h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-4 text-sm md:text-xs font-black text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-orange-500/40 active:translate-y-0 active:scale-95 sm:w-auto"
        >
          <FiPlus size={14} /> Adicionar bairro
        </button>
      </div>

      {/* ── LISTAGEM DE BAIRROS ── */}
      {filteredAreas.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 py-12 text-center transition-all">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-[#f97316]">
            <FiMapPin size={24} />
          </div>
          <h3 className="mt-4 text-base font-black text-[#111827] dark:text-slate-50">
            Nenhum bairro encontrado
          </h3>
          <p className="mx-auto mt-2 max-w-xs text-xs font-bold text-slate-500 dark:text-slate-400">
            Não encontramos bairros correspondentes à busca ou filtros selecionados.
          </p>
        </div>
      ) : (
        <>
          {/* Layout Mobile (Card list) */}
          <div className="grid grid-cols-1 gap-4 sm:hidden">
            {filteredAreas.map((area) => (
              <div
                key={area.neighborhood}
                className="group flex flex-col justify-between gap-3 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md hover:border-orange-100 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-black text-[#111827] dark:text-slate-50">
                      {area.neighborhood}
                    </h4>
                    <span className="mt-1 inline-block rounded-md bg-gray-50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      {area.isCustom ? 'Customizado' : 'Padrão Cidade'}
                    </span>
                  </div>

                  {/* Switch Toggle */}
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={area.isActive}
                      onChange={() => handleToggleActive(area)}
                    />
                    <div className={`h-6 w-11 rounded-full transition-colors duration-300 ${area.isActive ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-700 shadow-inner'}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${area.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 pt-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Taxa
                    </span>
                    <p className="text-sm font-black text-[#111827] dark:text-slate-50">
                      {area.isActive
                        ? formatMoneyBrl(area.fee)
                        : <span className="text-slate-400 dark:text-slate-500 italic font-medium">Sem taxa (Inativo)</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditArea(area)}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#f97316] dark:hover:text-[#f97316] active:scale-90"
                      title="Editar Taxa"
                    >
                      <FiEdit size={16} />
                    </button>
                    {area.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(area)}
                        className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 transition-all hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90"
                        title="Excluir Bairro"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Layout Desktop (Table view) */}
          <div className="hidden overflow-hidden rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm sm:block transition-all">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bairro
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Origem
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Taxa
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {filteredAreas.map((area) => (
                  <tr key={area.neighborhood} className="transition-colors hover:bg-orange-50/30 dark:hover:bg-slate-800/50 group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[#111827] dark:text-slate-50">
                        {area.neighborhood}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          area.isCustom
                            ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {area.isCustom ? 'Customizado' : 'Padrão Cidade'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-[#111827] dark:text-slate-50">
                        {area.isActive
                          ? formatMoneyBrl(area.fee)
                          : <span className="text-slate-400 dark:text-slate-500 font-medium italic">Sem taxa configurada</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Switch */}
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={area.isActive}
                            onChange={() => handleToggleActive(area)}
                          />
                          <div className={`h-6 w-11 rounded-full transition-colors duration-300 ${area.isActive ? 'bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-inner shadow-orange-900/20' : 'bg-gray-300 dark:bg-slate-700 shadow-inner'}`}>
                            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${area.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </label>
                        <span
                          className={`text-xs font-bold ${
                            area.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {area.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-80 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEditArea(area)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#f97316] dark:hover:text-[#f97316] active:scale-90"
                          title="Editar Taxa"
                        >
                          <FiEdit size={14} />
                        </button>
                        {area.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(area)}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 transition-all hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90"
                            title="Excluir Bairro"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
