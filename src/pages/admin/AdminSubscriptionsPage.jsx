import React, { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
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
  FiEdit2,
  FiX,
  FiSave
} from 'react-icons/fi'

function formatRequestType(type) {
  if (type === 'plan_change') return 'Troca de Plano'
  if (type === 'cancellation') return 'Cancelamento'
  if (type === 'due_date_change') return 'Alteração de Vencimento'
  return type
}

function RequestStatusBadge({ status }) {
  switch (status) {
    case 'pending':
      return <span className="inline-flex text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Pendente</span>
    case 'processing':
      return <span className="inline-flex text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Em Análise</span>
    case 'done':
      return <span className="inline-flex text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Concluído</span>
    case 'rejected':
      return <span className="inline-flex text-red-600 bg-red-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Rejeitado</span>
    default:
      return <span className="inline-flex text-gray-600 bg-gray-50 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{status || 'Desconhecido'}</span>
  }
}

export default function AdminSubscriptionsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [expiringFilter, setExpiringFilter] = useState(false)

  const [changeRequests, setChangeRequests] = useState([])
  const [cancelRequests, setCancelRequests] = useState([])
  const [dueDateRequests, setDueDateRequests] = useState([])
  
  const [editingRequest, setEditingRequest] = useState(null)
  const [editingStatus, setEditingStatus] = useState('')
  const [editingNotes, setEditingNotes] = useState('')
  const [savingRequest, setSavingRequest] = useState(false)

  useEffect(() => {
    setLoading(true)
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.error('[AdminSubscriptionsPage] error listing stores:', err)
      setLoading(false)
    })

    const unsubReq1 = onSnapshot(collection(db, 'subscriptionChangeRequests'), (snapshot) => {
      setChangeRequests(snapshot.docs.map((d) => ({ id: d.id, collectionName: 'subscriptionChangeRequests', ...d.data() })))
    })
    const unsubReq2 = onSnapshot(collection(db, 'subscriptionCancellationRequests'), (snapshot) => {
      setCancelRequests(snapshot.docs.map((d) => ({ id: d.id, collectionName: 'subscriptionCancellationRequests', ...d.data() })))
    })
    const unsubReq3 = onSnapshot(collection(db, 'subscriptionDueDateRequests'), (snapshot) => {
      setDueDateRequests(snapshot.docs.map((d) => ({ id: d.id, collectionName: 'subscriptionDueDateRequests', ...d.data() })))
    })

    return () => {
      unsubStores()
      unsubReq1()
      unsubReq2()
      unsubReq3()
    }
  }, [])

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

  const allRequests = useMemo(() => {
    return [...changeRequests, ...cancelRequests, ...dueDateRequests].sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
      return timeB - timeA
    })
  }, [changeRequests, cancelRequests, dueDateRequests])

  const pendingRequestsCount = allRequests.filter(r => r.status === 'pending').length

  const handleSaveRequest = async () => {
    if (!editingRequest) return
    setSavingRequest(true)
    try {
      const adminUpdateSubscriptionRequestStatus = httpsCallable(functions, 'adminUpdateSubscriptionRequestStatus')
      await adminUpdateSubscriptionRequestStatus({
        collectionName: editingRequest.collectionName,
        requestId: editingRequest.id,
        status: editingStatus,
        notes: editingNotes
      })
      setEditingRequest(null)
    } catch (err) {
      console.error('Error updating request', err)
      alert(err.message || 'Erro ao atualizar solicitação')
    } finally {
      setSavingRequest(false)
    }
  }

  const openEditModal = (req) => {
    setEditingRequest(req)
    setEditingStatus(req.status || 'pending')
    setEditingNotes(req.notes || '')
  }

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
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#f97316]">
          Painel Administrativo
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
            Assinaturas
          </h1>
        </div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6b7280]">
          Acompanhe os planos, trials, pendências financeiras e gerencie solicitações.
        </p>
      </div>

      <div className="mt-6 flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-6 text-sm font-black border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-[#f97316] text-[#f97316]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`py-3 px-6 text-sm font-black border-b-2 transition flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-[#f97316] text-[#f97316]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Solicitações Manuais
          {pendingRequestsCount > 0 && (
            <span className="flex h-5 items-center justify-center rounded-full bg-red-100 px-2 text-[10px] font-black text-red-600">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

          <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <FiSearch className="absolute left-4 top-3.5 text-gray-400" size={17} />
                <input
                  type="text"
                  placeholder="Buscar por loja, slug ou e-mail..."
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

          <div className="mt-6">
            {filteredStores.length === 0 ? (
              <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-400">Nenhuma assinatura encontrada.</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-1">
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
      )}

      {activeTab === 'requests' && (
        <div className="mt-6">
          {allRequests.length === 0 ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-bold text-gray-400">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-1">
              <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-100 text-left">
                  <thead className="bg-[#f9fafb]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Data</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Loja ID</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Tipo</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">Detalhes / Notas</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9ca3af] text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-gray-700">
                            {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('pt-BR') : 'Data Indisponível'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-gray-900">{req.storeId}</p>
                          <p className="text-[10px] text-gray-500 font-semibold truncate max-w-[120px]" title={req.userId}>Usr: {req.userId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-gray-800">{formatRequestType(req.type)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <RequestStatusBadge status={req.status} />
                          {req.processedBy && (
                            <p className="mt-1 text-[9px] font-semibold text-gray-400">Por {req.processedBy}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-600 space-y-1">
                            {req.type === 'plan_change' && (
                              <>
                                <p><span className="font-bold">Para:</span> {req.payload?.targetPlan} ({req.payload?.billingCycle})</p>
                                <p><span className="font-bold">Direção:</span> {req.payload?.direction}</p>
                              </>
                            )}
                            {req.type === 'cancellation' && (
                              <>
                                <p><span className="font-bold">Modo:</span> {req.payload?.cancelMode}</p>
                                <p><span className="font-bold">Motivo:</span> {req.payload?.reason || 'Não informado'}</p>
                              </>
                            )}
                            {req.type === 'due_date_change' && (
                              <p><span className="font-bold">Novo Dia:</span> {req.payload?.desiredDueDay}</p>
                            )}
                            {req.notes && (
                              <div className="mt-2 rounded bg-amber-50 p-2 border border-amber-100">
                                <p className="text-[10px] font-bold text-amber-800">Notas do Admin:</p>
                                <p className="text-[11px] text-amber-700 mt-0.5">{req.notes}</p>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditModal(req)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] hover:bg-orange-100 transition shadow-sm"
                          >
                            <FiEdit2 size={12} /> Alterar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden space-y-4">
                {allRequests.map((req) => (
                  <div key={req.id} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-gray-900">{formatRequestType(req.type)}</p>
                        <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                          {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('pt-BR') : ''}
                        </p>
                      </div>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <div className="mt-3 py-3 border-t border-gray-100 text-xs text-gray-700 space-y-1">
                      <p><span className="font-bold">Loja:</span> {req.storeId}</p>
                      {req.type === 'plan_change' && <p><span className="font-bold">Plano Alvo:</span> {req.payload?.targetPlan}</p>}
                      {req.type === 'due_date_change' && <p><span className="font-bold">Dia Alvo:</span> {req.payload?.desiredDueDay}</p>}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => openEditModal(req)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316] shadow-sm"
                      >
                        <FiEdit2 size={12} /> Gerenciar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl relative">
            <button
              onClick={() => setEditingRequest(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
            >
              <FiX size={20} />
            </button>
            <h3 className="text-lg font-black text-gray-900 mb-1">Processar Solicitação</h3>
            <p className="text-xs font-bold text-gray-500 mb-6">{formatRequestType(editingRequest.type)} - Loja: {editingRequest.storeId}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-1.5">Status</label>
                <select
                  value={editingStatus}
                  onChange={(e) => setEditingStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                >
                  <option value="pending">Pendente</option>
                  <option value="processing">Em Análise (Processing)</option>
                  <option value="done">Concluído (Feito no Asaas)</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-1.5">Anotações Internas (Notes)</label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  rows={4}
                  placeholder="Ex: Trocado manualmente no painel do Asaas..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveRequest}
                disabled={savingRequest}
                className="mt-2 w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f97316] text-white font-black hover:bg-[#ea580c] transition active:scale-95 disabled:opacity-50"
              >
                {savingRequest ? <FiLoader className="animate-spin" /> : <FiSave />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
