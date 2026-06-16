// src/pages/merchant/menu/components/MenuDeliveryAreasTab.jsx
// Aba de gestao de taxas de entrega por bairro.

import { useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiEdit,
  FiMap,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import { BAIRROS_ARACAJU, formatMoneyBrl } from '../utils/deliveryPayloads'
import AnimatedSegmentedControl from '../../../../components/ui/AnimatedSegmentedControl'

function getDeliverySaveErrorMessage(err) {
  if (err?.code === 'permission-denied') {
    return 'Seu usuario nao tem permissao para alterar as taxas desta loja.'
  }
  return 'Nao foi possivel salvar a area de entrega. Tente novamente.'
}

function DeliveryMetric({ label, value, tone = 'slate' }) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  }[tone]

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none">{value}</p>
    </div>
  )
}

export default function MenuDeliveryAreasTab({
  store,
  onSaveFees,
  onEditArea,
  onAddArea,
  onToast,
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingKey, setSavingKey] = useState(null)

  const deliveryFees = store?.deliveryFees || {}

  const allMappedAreas = useMemo(() => {
    const customBairros = Object.keys(deliveryFees).filter(
      (bairro) => !BAIRROS_ARACAJU.includes(bairro)
    )
    const combined = [...BAIRROS_ARACAJU, ...customBairros]

    return combined
      .map((neighborhood) => {
        const feeValue = deliveryFees[neighborhood]
        const isActive = feeValue !== undefined && feeValue !== null && feeValue !== ''

        return {
          neighborhood,
          fee: isActive ? Number(feeValue) : null,
          isActive,
          isCustom: !BAIRROS_ARACAJU.includes(neighborhood),
        }
      })
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood))
  }, [deliveryFees])

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase()

    return allMappedAreas.filter((item) => {
      const matchesSearch = item.neighborhood.toLowerCase().includes(term)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive)

      return matchesSearch && matchesStatus
    })
  }, [allMappedAreas, search, statusFilter])

  const stats = useMemo(() => {
    const active = allMappedAreas.filter((area) => area.isActive)
    return {
      activeCount: active.length,
      customActiveCount: active.filter((area) => area.isCustom).length,
      freeCount: active.filter((area) => area.fee === 0).length,
    }
  }, [allMappedAreas])

  const saveFees = async (newFees, successToast, key) => {
    setSavingKey(key)
    try {
      await onSaveFees(newFees)
      onToast?.({
        type: 'success',
        title: successToast.title,
        message: successToast.message,
      })
    } catch (err) {
      console.error('[MenuDeliveryAreasTab] saveFees:', err)
      onToast?.({
        type: 'error',
        title: err?.code === 'permission-denied' ? 'Sem permissao para salvar' : 'Erro ao salvar',
        message: getDeliverySaveErrorMessage(err),
      })
    } finally {
      setSavingKey(null)
    }
  }

  const handleToggleActive = async (area) => {
    if (!area.isActive) {
      onEditArea({ ...area, fee: null })
      return
    }

    const newFees = { ...deliveryFees, [area.neighborhood]: null }
    await saveFees(
      newFees,
      {
        title: 'Bairro desativado',
        message: `${area.neighborhood} saiu da area de entrega.`,
      },
      `toggle:${area.neighborhood}`
    )
  }

  const handleDeleteCustom = async (area) => {
    if (!window.confirm(`Excluir permanentemente o bairro "${area.neighborhood}"?`)) {
      return
    }

    const newFees = { ...deliveryFees }
    delete newFees[area.neighborhood]

    await saveFees(
      newFees,
      {
        title: 'Bairro removido',
        message: `${area.neighborhood} foi removido da area de entrega.`,
      },
      `delete:${area.neighborhood}`
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-orange-600 dark:text-orange-400">
              <FiMapPin size={14} />
              Areas de entrega
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
              Taxas por bairro
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
              Ative os bairros atendidos pela loja e defina a taxa cobrada no checkout.
              Bairros inativos nao aparecem como area atendida.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <DeliveryMetric label="Ativos" value={stats.activeCount} tone="green" />
            <DeliveryMetric label="Custom." value={stats.customActiveCount} />
            <DeliveryMetric label="Gratis" value={stats.freeCount} tone="orange" />
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar bairro"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold text-slate-950 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-orange-500/15"
              />
            </label>

            <div className="w-full shrink-0 sm:w-auto">
              <AnimatedSegmentedControl
                size="md"
                variant="neutral"
                fullWidthMobile
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

          <button
            type="button"
            onClick={onAddArea}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] active:scale-[0.98] sm:w-auto"
          >
            <FiPlus size={16} />
            Adicionar bairro
          </button>
        </div>
      </section>

      {filteredAreas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <FiMap size={22} />
          </div>
          <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">
            Nenhum bairro encontrado
          </h3>
          <p className="mt-2 max-w-sm text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ajuste a busca ou o filtro para ver outras areas cadastradas.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="hidden grid-cols-[1fr_8rem_8rem_8rem] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 md:grid">
            <span>Bairro</span>
            <span>Origem</span>
            <span>Taxa</span>
            <span className="text-right">Acoes</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAreas.map((area) => {
              const isSavingToggle = savingKey === `toggle:${area.neighborhood}`
              const isSavingDelete = savingKey === `delete:${area.neighborhood}`

              return (
                <div
                  key={area.neighborhood}
                  className="grid gap-4 px-4 py-4 transition hover:bg-orange-50/40 dark:hover:bg-slate-800/45 md:grid-cols-[1fr_8rem_8rem_8rem] md:items-center md:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                        {area.neighborhood}
                      </p>
                      {area.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <FiCheckCircle size={12} />
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 md:hidden">
                      {area.isCustom ? 'Bairro customizado' : 'Bairro padrao'} - {area.isActive ? formatMoneyBrl(area.fee) : 'Sem taxa configurada'}
                    </p>
                  </div>

                  <div className="hidden md:block">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                      area.isCustom
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {area.isCustom ? 'Custom' : 'Padrao'}
                    </span>
                  </div>

                  <p className="hidden text-sm font-black text-slate-950 dark:text-white md:block">
                    {area.isActive ? formatMoneyBrl(area.fee) : 'Inativo'}
                  </p>

                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <label className="inline-flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
                      <span className="md:hidden">Atender</span>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={area.isActive}
                        disabled={Boolean(savingKey)}
                        onChange={() => handleToggleActive(area)}
                      />
                      <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[#f97316] peer-disabled:opacity-60 dark:bg-slate-700">
                        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${area.isActive ? 'translate-x-5' : ''}`} />
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => onEditArea(area)}
                      disabled={Boolean(savingKey)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316] disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-500/10"
                      title="Editar taxa"
                    >
                      <FiEdit size={15} />
                    </button>

                    {area.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(area)}
                        disabled={Boolean(savingKey)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-red-100 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
                        title="Excluir bairro"
                      >
                        <FiTrash2 size={15} className={isSavingDelete ? 'animate-pulse' : ''} />
                      </button>
                    )}

                    {isSavingToggle && (
                      <span className="text-xs font-black text-orange-600 dark:text-orange-300">
                        Salvando
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
