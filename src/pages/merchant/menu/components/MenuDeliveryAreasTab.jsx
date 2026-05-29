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
      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* Ativos */}
        <div className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-black uppercase tracking-wider text-[#6b7280]">
            Bairros Ativos
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#111827]">
              {stats.activeCount}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              Entrega disponível
            </span>
          </div>
        </div>

        {/* Customizados */}
        <div className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-black uppercase tracking-wider text-[#6b7280]">
            Bairros Customizados
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#111827]">
              {stats.customActiveCount}
            </span>
            <span className="text-xs font-bold text-[#6b7280]">
              Criados manualmente
            </span>
          </div>
        </div>

        {/* Frete Grátis */}
        <div className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-black uppercase tracking-wider text-[#6b7280]">
            Entrega Grátis (R$ 0,00)
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#111827]">
              {stats.freeCount}
            </span>
            <span className="text-xs font-bold text-[#f97316]">
              Bairros com taxa zero
            </span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE CONTROLE E FILTROS ── */}
      <div className="flex flex-col gap-3 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Busca e Status */}
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {/* Input Busca */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-100 bg-[#f9fafb] pl-11 pr-4 text-xs font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white"
            />
          </div>

          {/* Filtros Status */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-50 p-1 sm:flex">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'active', label: 'Ativos' },
              { id: 'inactive', label: 'Inativos' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-black transition sm:py-1.5 ${
                  statusFilter === f.id
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-[#6b7280] hover:text-[#f97316]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* CTA Novo Bairro */}
        <button
          type="button"
          onClick={onAddArea}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#f97316] px-4 text-xs font-black text-white shadow-md shadow-orange-200 transition hover:bg-[#ea580c] sm:w-auto"
        >
          <FiPlus size={14} /> Adicionar bairro
        </button>
      </div>

      {/* ── LISTAGEM DE BAIRROS ── */}
      {filteredAreas.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-[#f97316]">
            <FiMapPin size={24} />
          </div>
          <h3 className="mt-4 text-base font-black text-[#111827]">
            Nenhum bairro encontrado
          </h3>
          <p className="mx-auto mt-2 max-w-xs text-xs font-bold text-[#6b7280]">
            Não encontramos bairros correspondentes à busca ou filtros selecionados.
          </p>
        </div>
      ) : (
        <>
          {/* Layout Mobile (Card list) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {filteredAreas.map((area) => (
              <div
                key={area.neighborhood}
                className="flex flex-col justify-between gap-3 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-[#111827]">
                      {area.neighborhood}
                    </h4>
                    <span className="mt-1 inline-block rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black text-gray-400 uppercase tracking-wide">
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
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#6b7280]">
                      Taxa
                    </span>
                    <p className="text-sm font-black text-[#111827]">
                      {area.isActive
                        ? formatMoneyBrl(area.fee)
                        : 'Sem taxa (Inativo)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditArea(area)}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-gray-50 text-[#6b7280] transition hover:bg-orange-50 hover:text-[#f97316]"
                      title="Editar Taxa"
                    >
                      <FiEdit size={14} />
                    </button>
                    {area.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(area)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100"
                        title="Excluir Bairro"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Layout Desktop (Table view) */}
          <div className="hidden overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm sm:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Bairro
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Origem
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Taxa
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6b7280]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAreas.map((area) => (
                  <tr key={area.neighborhood} className="hover:bg-gray-50/20">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[#111827]">
                        {area.neighborhood}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          area.isCustom
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {area.isCustom ? 'Customizado' : 'Padrão Cidade'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-[#111827]">
                        {area.isActive
                          ? formatMoneyBrl(area.fee)
                          : 'Sem taxa configurada'}
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
                          <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        </label>
                        <span
                          className={`text-xs font-bold ${
                            area.isActive ? 'text-emerald-600' : 'text-gray-400'
                          }`}
                        >
                          {area.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEditArea(area)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 text-[#6b7280] transition hover:bg-orange-50 hover:text-[#f97316]"
                          title="Editar Taxa"
                        >
                          <FiEdit size={14} />
                        </button>
                        {area.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(area)}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100"
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
