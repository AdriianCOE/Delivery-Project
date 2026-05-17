import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import {
  FiStar,
  FiMessageCircle,
  FiCheckCircle,
  FiAlertTriangle,
  FiSearch,
  FiFilter,
  FiSmile,
  FiX,
  FiHeart,
  FiCalendar
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

// --- UTILIDADES ---
const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function getStoreKeys(store) {
  return uniqueArray([
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
    store?.id,
    store?.storeId,
    store?.storeDocId,
    store?.storeSlug,
    store?.slug,
  ]).slice(0, 10)
}

function normalizePhoneBR(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`
  return digits
}

function getDateLabel(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getReviewRating(review) {
  return Number(review?.rating || review?.average || 0)
}

// Lógica de Datas para o Filtro
const NOW = new Date()
const START_OF_TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())

const START_OF_7_DAYS = new Date(START_OF_TODAY)
START_OF_7_DAYS.setDate(START_OF_7_DAYS.getDate() - 7)

const START_OF_30_DAYS = new Date(START_OF_TODAY)
START_OF_30_DAYS.setDate(START_OF_30_DAYS.getDate() - 30)


// --- COMPONENTES MENORES ---
function StatCard({ icon: Icon, label, value, description, tone = 'orange' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-[#f97316]',
  }

  return (
    <article className="group min-w-0 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl hover:shadow-gray-200/60">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-black uppercase tracking-widest text-[#6b7280]">
          {label}
        </p>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${
            tones[tone] || tones.orange
          }`}
        >
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-4">
        <p className="truncate text-3xl font-black tracking-tight text-[#111827]">
          {value}
        </p>
        {description && (
          <p className="mt-1.5 truncate text-sm font-bold text-[#6b7280]">
            {description}
          </p>
        )}
      </div>
    </article>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
        <Icon size={28} />
      </div>
      <h3 className="mt-5 text-lg font-black text-[#111827]">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#6b7280]">
          {description}
        </p>
      )}
    </div>
  )
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const Icon = isSuccess ? FiCheckCircle : FiAlertTriangle

  return (
    <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/50">
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isSuccess ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'}`}>
          <Icon size={17} />
        </div>
        <div>
          <p className="text-sm font-black text-[#111827]">{isSuccess ? 'Sucesso' : 'Atenção'}</p>
          <p className="mt-0.5 text-sm font-bold text-[#6b7280]">{toast.message}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-2 text-gray-400 transition hover:text-gray-700">
          <FiX />
        </button>
      </div>
    </div>
  )
}

// --- PÁGINA PRINCIPAL ---
export default function Reviews() {
  const { user } = useAuth()

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [reviews, setReviews] = useState([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingReviews, setLoadingReviews] = useState(true)
  
  // Estados de Filtro
  const [period, setPeriod] = useState('30d') // today, 7d, 30d, all
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos') // todos, pendentes, resolvidas
  
  const [toast, setToast] = useState(null)

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const selectedStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId) || stores[0] || null
  }, [selectedStoreId, stores])

  // 1. Busca Lojas
  useEffect(() => {
    if (!user?.uid) {
      setStores([])
      setLoadingStores(false)
      return
    }

    const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', user.uid))
    const unsubscribe = onSnapshot(storesQuery, (snapshot) => {
      const storesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      setStores(storesData)
      setLoadingStores(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // 2. Define Loja Selecionada
  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId('')
      return
    }
    setSelectedStoreId((current) => {
      if (stores.some((s) => s.id === current)) return current
      const saved = localStorage.getItem(SELECTED_STORE_KEY)
      if (stores.some((s) => s.id === saved)) return saved
      return stores[0].id
    })
  }, [stores])

  // 3. Busca Avaliações
  useEffect(() => {
    if (!selectedStore) {
      setReviews([])
      setLoadingReviews(false)
      return
    }

    const storeKeys = getStoreKeys(selectedStore)
    if (!storeKeys.length) {
      setReviews([])
      setLoadingReviews(false)
      return
    }

    setLoadingReviews(true)

    const reviewsQuery = query(collection(db, 'reviews'), where('storeId', 'in', storeKeys))
    
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
          return dateB - dateA
        })
      setReviews(data)
      setLoadingReviews(false)
    }, () => {
      showToast('error', 'Erro ao carregar avaliações.')
      setLoadingReviews(false)
    })

    return () => unsubscribe()
  }, [selectedStore, showToast])


  // --- FILTRO DE TEMPO E ESTATÍSTICAS ---
  const reviewsByPeriod = useMemo(() => {
    return reviews.filter(r => {
      if (period === 'all') return true
      const rDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(0)
      
      if (period === 'today') return rDate >= START_OF_TODAY
      if (period === '7d') return rDate >= START_OF_7_DAYS
      if (period === '30d') return rDate >= START_OF_30_DAYS
      return true
    })
  }, [reviews, period])

  const stats = useMemo(() => {
    if (!reviewsByPeriod.length) return { average: 0, total: 0, problems: 0, happy: 0 }
    
    const totalRating = reviewsByPeriod.reduce((acc, r) => acc + getReviewRating(r), 0)
    
    return {
      average: (totalRating / reviewsByPeriod.length).toFixed(1),
      total: reviewsByPeriod.length,
      problems: reviewsByPeriod.filter((r) => getReviewRating(r) <= 3 && !r.resolved).length,
      happy: reviewsByPeriod.filter((r) => getReviewRating(r) >= 4).length
    }
  }, [reviewsByPeriod])

  // --- FILTROS DE BUSCA E STATUS ---
  const finalFilteredReviews = useMemo(() => {
    let filtered = reviewsByPeriod
    const term = search.toLowerCase().trim()

    if (filter === 'pendentes') {
      filtered = filtered.filter(r => getReviewRating(r) <= 3 && !r.resolved)
    } else if (filter === 'resolvidas') {
      filtered = filtered.filter(r => r.resolved)
    }

    if (term) {
      filtered = filtered.filter(r => {
        return (
          (r.customerName || '').toLowerCase().includes(term) ||
          (r.orderId || '').toLowerCase().includes(term) ||
          (r.comment || '').toLowerCase().includes(term)
        )
      })
    }

    return filtered
  }, [reviewsByPeriod, search, filter])

  // --- AÇÕES ---
  const handleResolveReview = async (reviewId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        resolved: !currentStatus,
        resolvedAt: !currentStatus ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      showToast('success', !currentStatus ? 'Avaliação marcada como resolvida!' : 'Avaliação reaberta.')
    } catch {
      showToast('error', 'Erro ao atualizar avaliação.')
    }
  }

  const handleOpenWhatsApp = (review) => {
    const phone = normalizePhoneBR(review.customerPhone || review.phone || review.customer?.phone)
    if (!phone) {
      showToast('error', 'O cliente não informou o WhatsApp.')
      return
    }
    const message = encodeURIComponent(`Olá, ${review.customerName || 'tudo bem'}! Aqui é da loja ${selectedStore?.name}. Vimos sua avaliação no PratoBy e gostaríamos de entender melhor sua experiência com a gente!`)
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] pb-20 text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* LADO ESQUERDO */}
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiStar size={18} /> 
                </span>
                <h1 className="text-2xl font-black tracking-tight text-[#111827]">
                  Avaliações
                </h1>
              </div>
              <p className="mt-1 text-sm text-[#6b7280]">
                Gestão de qualidade e feedback dos seus clientes.
              </p>
            </div>
          </div>

          {/* LADO DIREITO */}
          <div className="flex flex-wrap items-center gap-2">
            {stores.length > 1 && (
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  localStorage.setItem(SELECTED_STORE_KEY, e.target.value)
                }}
                className="h-11 cursor-pointer rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || 'Loja'}
                  </option>
                ))}
              </select>
            )}
          </div>
          
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingStores || loadingReviews ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-[2rem] bg-white shadow-sm" />
            ))}
          </div>
        ) : (
          <>
            {/* FILTRO DE TEMPO */}
            <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm sm:w-max">
              <span className="hidden pl-3 pr-2 text-[#6b7280] sm:block">
                <FiCalendar />
              </span>
              {[
                { id: 'today', label: 'Hoje' },
                { id: '7d', label: 'Últimos 7 dias' },
                { id: '30d', label: 'Últimos 30 dias' },
                { id: 'all', label: 'Todo o período' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-black transition ${
                    period === p.id
                      ? 'bg-[#f97316] text-white shadow-sm'
                      : 'text-[#6b7280] hover:bg-gray-50 hover:text-[#111827]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* CARDS DE ESTATÍSTICA */}
            <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={FiStar}
                label="Média do Período"
                value={stats.average}
                description="Nota média da loja"
                tone="orange"
              />
              <StatCard
                icon={FiSmile}
                label="Total de Avaliações"
                value={stats.total}
                description="Opiniões recebidas"
                tone="blue"
              />
              <StatCard
                icon={FiHeart}
                label="Clientes Felizes"
                value={stats.happy}
                description="Avaliações 4 ou 5 estrelas"
                tone="green"
              />
              <StatCard
                icon={FiAlertTriangle}
                label="Requer Atenção"
                value={stats.problems}
                description="Avaliações ≤ 3 pendentes"
                tone={stats.problems > 0 ? "red" : "amber"}
              />
            </div>

            {/* BARRA DE PESQUISA E FILTROS DE STATUS */}
            <div className="mb-6 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, número do pedido ou comentário..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] pl-12 pr-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                  <span className="hidden items-center gap-2 text-sm font-black text-[#6b7280] xl:flex">
                    <FiFilter /> Status
                  </span>
                  {[
                    { id: 'todos', label: 'Todas' },
                    { id: 'pendentes', label: 'Pendentes' },
                    { id: 'resolvidas', label: 'Resolvidas' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilter(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black transition ${
                        filter === tab.id
                          ? 'bg-[#111827] text-white shadow-sm'
                          : 'bg-gray-50 text-[#6b7280] hover:bg-gray-100 hover:text-[#111827]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* LISTA DE AVALIAÇÕES */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {finalFilteredReviews.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={FiStar}
                    title="Nenhuma avaliação encontrada"
                    description={search || filter !== 'todos' ? 'Nenhuma avaliação atende aos filtros de busca atuais.' : 'Quando os clientes avaliarem os pedidos neste período, elas aparecerão aqui.'}
                  />
                </div>
              ) : (
                finalFilteredReviews.map((review) => {
                  const rating = getReviewRating(review)
                  const isProblem = rating <= 3

                  return (
                    <div key={review.id} className={`flex flex-col rounded-[2rem] border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${isProblem && !review.resolved ? 'border-amber-200 ring-4 ring-amber-50' : 'border-gray-100 hover:border-orange-100'}`}>
                      
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <FiStar 
                                key={star} 
                                className={`${star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-200'}`} 
                                size={16} 
                              />
                            ))}
                          </div>
                          <p className="mt-3 truncate text-lg font-black tracking-tight text-[#111827]">{review.customerName || 'Cliente anônimo'}</p>
                          <p className="mt-0.5 truncate text-xs font-bold text-[#6b7280]">Pedido #{review.orderId?.slice(0, 6)?.toUpperCase() || '—'} · {getDateLabel(review.createdAt)}</p>
                        </div>

                        {review.resolved ? (
                          <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#f97316]">Resolvida</span>
                        ) : isProblem ? (
                          <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-600 ring-1 ring-red-100">Atenção</span>
                        ) : null}
                      </div>

                      {/* COMENTÁRIO */}
                      {review.comment ? (
                        <p className="mt-5 flex-1 rounded-2xl bg-[#f9fafb] p-4 text-sm font-medium leading-6 text-[#111827]">
                          "{review.comment}"
                        </p>
                      ) : (
                        <p className="mt-5 flex-1 rounded-2xl border border-dashed border-gray-100 bg-[#f9fafb]/60 p-4 text-sm font-medium italic leading-6 text-[#9ca3af]">
                          O cliente não deixou comentário, apenas a nota.
                        </p>
                      )}

                      {/* TAGS */}
                      {(Array.isArray(review.tags) && review.tags.length > 0) || review.wouldOrderAgain !== undefined ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {review.wouldOrderAgain !== undefined && (
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ${review.wouldOrderAgain ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'}`}>
                              {review.wouldOrderAgain ? '👍 Pediria novamente' : '👎 Não pediria novamente'}
                            </span>
                          )}
                          {review.tags?.map((tag) => (
                            <span key={tag} className="rounded-full border border-gray-100 bg-[#f9fafb] px-3 py-1 text-[11px] font-black text-[#6b7280]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* AÇÕES (BOTÕES) */}
                      <div className="mt-6 flex gap-3 border-t border-gray-100 pt-5">
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(review)}
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#20bd5a]"
                        >
                          <FiMessageCircle size={16} /> WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResolveReview(review.id, review.resolved)}
                          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black shadow-sm transition ${
                            review.resolved
                              ? 'border-gray-200 bg-white text-[#111827] hover:bg-gray-50'
                              : 'border-orange-100 bg-orange-50 text-[#f97316] hover:bg-orange-100'
                          }`}
                        >
                          {review.resolved ? 'Reabrir caso' : 'Marcar resolvido'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
        <DashboardFooter store={selectedStore} />
    </main>
  )
}

