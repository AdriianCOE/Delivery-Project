import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../services/firebase'
import SubscriptionStatusBadge from '../../components/billing/SubscriptionStatusBadge'
import {
  formatBillingDate,
  formatPlanName,
  getTrialDaysRemaining,
  normalizeBillingCycle,
} from '../../utils/billingStatus'
import {
  FiSearch,
  FiFilter,
  FiExternalLink,
  FiLoader,
  FiShoppingBag,
  FiUsers,
  FiTrendingUp,
  FiAlertCircle,
  FiCheckCircle,
  FiCalendar,
  FiMail,
} from 'react-icons/fi'

export default function AdminSubscriptionsPage() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [expiringFilter, setExpiringFilter] = useState(false)

  // Listen to all stores
  useEffect(() => {
    setLoading(true)
    const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setStores(items)
      setLoading(false)
    }, (err) => {
      console.error('[AdminSubscriptionsPage] error listing stores:', err)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Calculate Metrics
  const stats = useMemo(() => {
    let total = stores.length
    let active = 0
    let trialing = 0
    let pastDue = 0
    let blockedOrCanceled = 0
    let expiringSoon = 0

    stores.forEach((store) => {
      const status = store.subscriptionStatus || 'checkout_pending'
      const trialEndsAt = store.trialEndsAt
      const daysLeft = trialEndsAt ? getTrialDaysRemaining(trialEndsAt) : null

      if (status === 'active') active++
      else if (status === 'trialing') {
        trialing++
        if (daysLeft !== null && daysLeft <= 3 && daysLeft > 0) {
          expiringSoon++
        }
      } else if (status === 'past_due') pastDue++
      else if (status === 'canceled' || status === 'blocked') blockedOrCanceled++
    })

    return { total, active, trialing, pastDue, blockedOrCanceled, expiringSoon }
  }, [stores])

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const name = String(store.name || '').toLowerCase()
      const slug = String(store.slug || store.storeSlug || '').toLowerCase()
      const email = String(store.ownerEmail || store.owner?.email || '').toLowerCase()
      const searchMatch =
        name.includes(search.toLowerCase()) ||
        slug.includes(search.toLowerCase()) ||
        email.includes(search.toLowerCase())

      const status = store.subscriptionStatus || 'checkout_pending'
      const statusMatch = statusFilter === 'all' || status === statusFilter

      const plan = store.plan || 'essential'
      const planMatch = planFilter === 'all' || plan === planFilter

      const trialEndsAt = store.trialEndsAt
      const daysLeft = trialEndsAt ? getTrialDaysRemaining(trialEndsAt) : null
      const expiringMatch =
        !expiringFilter ||
        (status === 'trialing' && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0)

      return searchMatch && statusMatch && planMatch && expiringMatch
    })
  }, [stores, search, statusFilter, planFilter, expiringFilter])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <FiLoader className="h-10 w-10 animate-spin text-[#f97316]" />
        <p className="mt-4 text-sm font-bold text-[#6b7280]">Carregando painel de assinaturas...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">
      {/* Page Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#f97316]">
          Painel Administrativo
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
          Assinaturas
        </h1>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6b7280]">
          Acompanhe os planos, trials, pendências financeiras e status das lojas parceiras.
        </p>
      </div>

      {/* Summary Stats Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Lojas Totais</span>
            <span className="rounded-xl bg-orange-50 p-2 text-[#f97316]"><FiShoppingBag size={14} /></span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#111827]">{stats.total}</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Teste Ativo</span>
            <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><FiCalendar size={14} /></span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#111827]">{stats.trialing}</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Assinaturas Ativas</span>
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><FiCheckCircle size={14} /></span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#111827]">{stats.active}</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Pendente/Atrasada</span>
            <span className="rounded-xl bg-red-50 p-2 text-red-600"><FiAlertCircle size={14} /></span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#111827]">{stats.pastDue}</p>
        </div>

        <div className="rounded-3xl border-2 border-orange-100 bg-orange-50/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f97316]">Vence em 3 dias</span>
            <span className="rounded-xl bg-[#f97316] p-2 text-white"><FiTrendingUp size={14} /></span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#111827]">{stats.expiringSoon}</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-4 top-3.5 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Buscar por loja, slug ou e-mail do dono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-2xl border border-gray-100 bg-gray-50/50 pl-11 pr-4 text-xs font-semibold text-[#111827] outline-none transition focus:border-orange-200 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2">
              <FiFilter className="text-gray-400" size={14} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-[#111827] outline-none cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="checkout_pending">Aguardando Ativação</option>
                <option value="trialing">Teste Grátis</option>
                <option value="active">Ativas</option>
                <option value="past_due">Atrasadas</option>
                <option value="canceled">Canceladas</option>
                <option value="blocked">Bloqueadas</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2">
              <FiFilter className="text-gray-400" size={14} />
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-[#111827] outline-none cursor-pointer"
              >
                <option value="all">Todos os Planos</option>
                <option value="essential">Básico</option>
                <option value="professional">Profissional</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setExpiringFilter(!expiringFilter)}
              className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-xs font-black transition active:scale-95 ${
                expiringFilter
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'border border-gray-100 bg-white text-[#6b7280] hover:bg-gray-50'
              }`}
            >
              Vencendo logo
            </button>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="mt-6">
        {filteredStores.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400">Nenhuma assinatura encontrada para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-1">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-left">
                <thead className="bg-[#f9fafb]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Loja / Slug</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Dono</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Plano / Ciclo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Período Limite</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af] text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStores.map((store) => {
                    const status = store.subscriptionStatus || 'checkout_pending'
                    const planName = formatPlanName(store.plan)
                    const cycle = normalizeBillingCycle(store.billingCycle)
                    const trialEnds = store.trialEndsAt
                    const periodEnds = store.currentPeriodEnd
                    const storeSlug = store.slug || store.storeSlug
                    const ownerEmail = store.ownerEmail || store.owner?.email

                    return (
                      <tr key={store.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-[#111827]">{store.name || 'Loja sem nome'}</p>
                          <p className="text-xs font-bold text-[#f97316]">/{storeSlug || '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-[#6b7280] flex items-center gap-1">
                            <FiMail size={12} /> {ownerEmail || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-[#111827]">{planName}</p>
                          <p className="text-xs font-bold text-[#9ca3af]">{cycle}</p>
                        </td>
                        <td className="px-6 py-4">
                          <SubscriptionStatusBadge status={status} />
                        </td>
                        <td className="px-6 py-4">
                          {status === 'trialing' ? (
                            <div>
                              <p className="text-xs font-black text-indigo-600">
                                Teste até {formatBillingDate(trialEnds)}
                              </p>
                              <p className="text-[10px] font-bold text-[#9ca3af]">
                                ({getTrialDaysRemaining(trialEnds) ?? 0} dias restantes)
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-[#6b7280]">
                              Cobrança: {formatBillingDate(periodEnds || trialEnds)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/${storeSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:border-orange-200 hover:text-[#f97316] transition shadow-sm"
                              title="Visitar loja pública"
                            >
                              <FiExternalLink size={13} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid gap-4 lg:hidden">
              {filteredStores.map((store) => {
                const status = store.subscriptionStatus || 'checkout_pending'
                const planName = formatPlanName(store.plan)
                const cycle = normalizeBillingCycle(store.billingCycle)
                const trialEnds = store.trialEndsAt
                const periodEnds = store.currentPeriodEnd
                const storeSlug = store.slug || store.storeSlug
                const ownerEmail = store.ownerEmail || store.owner?.email

                return (
                  <div key={store.id} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-[#111827]">{store.name || 'Loja sem nome'}</h4>
                        <p className="text-xs font-bold text-[#f97316]">/{storeSlug || '—'}</p>
                      </div>
                      <SubscriptionStatusBadge status={status} />
                    </div>

                    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-[#9ca3af]">Dono:</span>
                        <span className="font-black text-[#6b7280]">{ownerEmail || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-[#9ca3af]">Plano / Ciclo:</span>
                        <span className="font-black text-[#111827]">{planName} · {cycle}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-[#9ca3af]">Período Limite:</span>
                        <span className="font-black text-[#111827]">
                          {status === 'trialing'
                            ? `Teste até ${formatBillingDate(trialEnds)} (${getTrialDaysRemaining(trialEnds) ?? 0}d left)`
                            : `Cobrança: ${formatBillingDate(periodEnds || trialEnds)}`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-gray-50 pt-3">
                      <a
                        href={`/${storeSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 hover:border-orange-200 hover:text-[#f97316] transition shadow-sm"
                      >
                        <FiExternalLink size={13} />
                        Ver loja
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
