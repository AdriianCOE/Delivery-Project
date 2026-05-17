import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from '../../services/firebase'

import {
  FiActivity,
  FiAlertTriangle,
  FiArchive,
  FiArrowRight,
  FiArrowUpRight,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDatabase,
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiFilter,
  FiGlobe,
  FiGrid,
  FiHelpCircle,
  FiHome,
  FiInfo,
  FiLink,
  FiLock,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiSliders,
  FiStar,
  FiTrash2,
  FiTruck,
  FiUnlock,
  FiUser,
  FiX,
  FiXCircle,
  FiZap,
} from 'react-icons/fi'

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
const PUBLIC_STORE_BASE_URL =
  import.meta.env.VITE_PUBLIC_STORE_BASE_URL || window.location.origin

const PLAN_OPTIONS = [
  {
    id: 'essencial',
    label: 'Essencial',
    price: 'R$ 49/mês',
    badge: 'Entrada',
    description: 'Cardápio digital, carrinho e WhatsApp.',
  },
  {
    id: 'profissional',
    label: 'Profissional',
    price: 'R$ 89/mês',
    badge: 'Mais vendido',
    description: 'Dashboard, cupons, bairros e avaliações.',
  },
  {
    id: 'white-label',
    label: 'White-label',
    price: 'R$ 149/mês',
    badge: 'Premium',
    description: 'Personalização, domínio próprio e suporte prioritário.',
  },
]

const SUBSCRIPTION_STATUS = [
  { id: 'trial', label: 'Teste', tone: 'blue' },
  { id: 'active', label: 'Ativa', tone: 'green' },
  { id: 'past_due', label: 'Pendente', tone: 'amber' },
  { id: 'paused', label: 'Pausada', tone: 'gray' },
  { id: 'canceled', label: 'Cancelada', tone: 'red' },
]

const FILTERS = [
  { id: 'all', label: 'Todas', icon: FiGrid },
  { id: 'active', label: 'Ativas', icon: FiCheckCircle },
  { id: 'inactive', label: 'Inativas', icon: FiXCircle },
  { id: 'open', label: 'Abertas', icon: FiZap },
  { id: 'closed', label: 'Fechadas', icon: FiClock },
  { id: 'blocked', label: 'Bloqueadas', icon: FiLock },
  { id: 'trial', label: 'Teste', icon: FiStar },
  { id: 'past_due', label: 'Pendentes', icon: FiAlertTriangle },
  { id: 'archived', label: 'Arquivadas', icon: FiArchive },
]



const DEV_CHECKLIST = [
  {
    label: 'Rotas públicas',
    description: 'Lojas usam /:storeSlug, não /store/:slug.',
    done: true,
  },
  {
    label: 'Valores em centavos',
    description: 'Salvar também minOrderCents, deliveryFeeCents e totais em int64.',
    done: true,
  },
  {
    label: 'WhatsApp normalizado',
    description: 'Salvar com DDI 55 para links e mensagens automáticas.',
    done: true,
  },
  {
    label: 'Planos e assinatura',
    description: 'planId e subscriptionStatus prontos para cobrança futura.',
    done: true,
  },
]

const DEFAULT_EDIT_FORM = {
  name: '',
  storeSlug: '',
  description: '',
  category: '',
  city: '',
  neighborhood: '',
  ownerName: '',
  ownerEmail: '',
  ownerUid: '',
  themeColor: '#f97316',
  whatsapp: '',
  instagram: '',
  deliveryTime: '25-40 min',
  minOrder: '0,00',
  deliveryFee: '0,00',
  planId: 'profissional',
  subscriptionStatus: 'trial',
  isOpen: true,
  isActive: true,
  isBlocked: false,
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function getStoreSlug(store) {
  return String(store?.storeSlug || store?.slug || store?.id || '').trim()
}

function getStoreDocId(store) {
  return store?.id || store?.storeId || store?.storeSlug || store?.slug
}

function getPlan(store) {
  const planId = store?.planId || store?.plan || store?.subscription?.planId || 'essencial'
  return PLAN_OPTIONS.find((plan) => plan.id === planId) || PLAN_OPTIONS[0]
}

function getSubscriptionStatus(store) {
  const id =
    store?.subscriptionStatus ||
    store?.subscription?.status ||
    store?.billingStatus ||
    (store?.isActive === false ? 'paused' : 'trial')

  return SUBSCRIPTION_STATUS.find((status) => status.id === id) || SUBSCRIPTION_STATUS[0]
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numberValue = Number(value || 0)

  if (numberValue > 999) return numberValue / 100

  return numberValue
}

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function normalizePhoneBR(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`

  return digits
}

function sanitizeSocial(value) {
  return String(value || '').replace('@', '').trim()
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
}

function getStoreUrl(storeOrSlug) {
  const slug = typeof storeOrSlug === 'string' ? storeOrSlug : getStoreSlug(storeOrSlug)
  const cleanBase = String(PUBLIC_STORE_BASE_URL || window.location.origin).replace(/\/$/, '')
  return `${cleanBase}/${slug || 'sua-loja'}`
}

function getDateLabel(value) {
  if (!value) return '—'

  const date = value?.toDate ? value.toDate() : new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function getStoreStatus(store) {
  if (store?.isDeleted) {
    return {
      label: 'Arquivada',
      className: 'bg-gray-100 text-gray-600',
      dot: 'bg-gray-400',
      icon: FiArchive,
    }
  }

  if (store?.isBlocked) {
    return {
      label: 'Bloqueada',
      className: 'bg-red-50 text-red-600',
      dot: 'bg-red-500',
      icon: FiLock,
    }
  }

  if (store?.isActive === false) {
    return {
      label: 'Inativa',
      className: 'bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
      icon: FiXCircle,
    }
  }

  if (store?.isOpen === false) {
    return {
      label: 'Fechada',
      className: 'bg-orange-50 text-orange-700',
      dot: 'bg-orange-500',
      icon: FiClock,
    }
  }

  return {
    label: 'Aberta',
    className: 'bg-orange-50 text-[#f97316]',
    dot: 'bg-[#f97316]',
    icon: FiZap,
  }
}

function getToneClass(tone, variant = 'soft') {
  const map = {
    green: {
      soft: 'bg-green-50 text-green-700',
      icon: 'bg-green-50 text-green-700',
      dot: 'bg-green-500',
    },
    blue: {
      soft: 'bg-blue-50 text-blue-700',
      icon: 'bg-blue-50 text-blue-700',
      dot: 'bg-blue-500',
    },
    amber: {
      soft: 'bg-amber-50 text-amber-700',
      icon: 'bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
    },
    red: {
      soft: 'bg-red-50 text-red-700',
      icon: 'bg-red-50 text-red-700',
      dot: 'bg-red-500',
    },
    gray: {
      soft: 'bg-gray-100 text-gray-700',
      icon: 'bg-gray-100 text-gray-700',
      dot: 'bg-gray-400',
    },
    orange: {
      soft: 'bg-orange-50 text-[#f97316]',
      icon: 'bg-orange-50 text-[#f97316]',
      dot: 'bg-[#f97316]',
    },
  }

  return map[tone]?.[variant] || map.orange[variant]
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined

    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const success = toast.type === 'success'
  const Icon = success ? FiCheckCircle : FiAlertTriangle

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[90] mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/50 sm:bottom-5 sm:left-auto sm:mx-0">
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            success ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'
          )}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827]">
            {success ? 'Tudo certo' : 'Atenção'}
          </p>

          <p className="mt-0.5 text-sm leading-5 text-[#6b7280]">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 transition hover:text-[#111827]"
          aria-label="Fechar aviso"
        >
          <FiX />
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, description, tone = 'orange' }) {
  return (
    <article className="rounded-[1.8rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-[#111827]">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>

        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            getToneClass(tone, 'icon')
          )}
        >
          <Icon size={20} />
        </div>
      </div>
    </article>
  )
}

function EmptyState({ loading, filter, searchTerm }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
        {loading ? <FiRefreshCw className="animate-spin" /> : <FiSearch />}
      </div>

      <h3 className="mt-5 text-xl font-black text-[#111827]">
        {loading ? 'Carregando lojas...' : 'Nenhuma loja encontrada'}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[#6b7280]">
        {loading
          ? 'Buscando dados em tempo real no Firestore.'
          : `Não encontramos lojas para o filtro "${filter}"${searchTerm ? ` e busca "${searchTerm}"` : ''}.`}
      </p>
    </div>
  )
}

function ToggleButton({ active, onClick, label, activeLabel, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'bg-orange-50 text-[#f97316]'
          : 'bg-gray-100 text-[#6b7280] hover:bg-gray-200'
      )}
    >
      {active ? <FiCheckCircle /> : <FiXCircle />}
      {active ? activeLabel || label : label}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
        {label}
      </span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={cn(
        'h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100',
        props.className
      )}
    />
  )
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={cn(
        'h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100',
        props.className
      )}
    />
  )
}

function StoreBadge({ store }) {
  const status = getStoreStatus(store)

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black', status.className)}>
      <span className={cn('h-2 w-2 rounded-full', status.dot)} />
      {status.label}
    </span>
  )
}

function SubscriptionBadge({ store }) {
  const status = getSubscriptionStatus(store)

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black', getToneClass(status.tone, 'soft'))}>
      <span className={cn('h-2 w-2 rounded-full', getToneClass(status.tone, 'dot'))} />
      {status.label}
    </span>
  )
}

function getStoreLogoUrl(store) {
  return (
    store?.logoURL ||
    store?.logoUrl ||
    store?.logo ||
    store?.logoImage ||
    store?.imageUrl ||
    store?.avatarURL ||
    store?.avatarUrl ||
    store?.branding?.logoURL ||
    store?.branding?.logoUrl ||
    store?.settings?.logoURL ||
    store?.settings?.logoUrl ||
    ''
  )
}

function StoreLogo({ store, slug }) {
  const logoUrl = getStoreLogoUrl(store)
  const fallbackLetter = (store?.name || slug || 'P').charAt(0).toUpperCase()

  if (logoUrl) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-gray-100">
        <img
          src={logoUrl}
          alt={`Logo de ${store?.name || 'loja'}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
            event.currentTarget.parentElement.dataset.failed = 'true'
          }}
        />

        <span className="hidden text-xl font-black text-white [[data-failed=true]_&]:flex">
          {fallbackLetter}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg"
      style={{ backgroundColor: store?.themeColor || '#f97316' }}
    >
      {fallbackLetter}
    </div>
  )
}

function StoreCard({ store, onCopyLink, onToggleStore, onArchiveStore, onEditStore }) {
  const slug = getStoreSlug(store)
  const status = getStoreStatus(store)
  const StatusIcon = status.icon || FiInfo
  const plan = getPlan(store)
  const storeUrl = getStoreUrl(store)
  const docId = getStoreDocId(store)
  const minOrder = normalizeMoney(store.minOrder, store.minOrderCents)
  const deliveryFee = normalizeMoney(store.deliveryFee, store.deliveryFeeCents)

  return (
    <article className="group rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/70">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StoreBadge store={store} />
            <SubscriptionBadge store={store} />

            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              <FiCreditCard size={13} />
              {plan.label}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <StoreLogo store={store} slug={slug} />

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-black tracking-tight text-[#111827]">
                {store.name || 'Loja sem nome'}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[#6b7280]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <FiLink className="shrink-0" />
                  <span className="truncate">/{slug || 'sem-slug'}</span>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <FiDatabase />
                  {docId || 'sem-id'}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <FiClock />
                  Criada em {getDateLabel(store.createdAt)}
                </span>
              </div>

              {store.description && (
                <p className="mt-3 line-clamp-2 max-w-3xl text-sm font-medium leading-6 text-[#6b7280]">
                  {store.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[#f9fafb] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiUser className="text-[#f97316]" />
                Responsável
              </p>
              <p className="mt-2 truncate text-sm font-black text-[#111827]">
                {store.ownerName || store.ownerEmail || '—'}
              </p>
            </div>

            <div className="rounded-2xl bg-[#f9fafb] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiPhone className="text-[#f97316]" />
                WhatsApp
              </p>
              <p className="mt-2 truncate text-sm font-black text-[#111827]">
                {store.whatsapp || store.whatsapp1 || '—'}
              </p>
            </div>

            <div className="rounded-2xl bg-[#f9fafb] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiTruck className="text-[#f97316]" />
                Entrega
              </p>
              <p className="mt-2 truncate text-sm font-black text-[#111827]">
                {store.deliveryTime || '—'} · {formatMoney(deliveryFee)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#f9fafb] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                <FiShoppingBag className="text-[#f97316]" />
                Pedido mínimo
              </p>
              <p className="mt-2 truncate text-sm font-black text-[#111827]">
                {formatMoney(minOrder)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:w-[260px]">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onCopyLink(store)}
              className="flex h-11 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-orange-50 hover:text-[#f97316]"
              title="Copiar link público"
            >
              <FiCopy />
            </button>

            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-orange-50 hover:text-[#f97316]"
              title="Ver loja pública"
            >
              <FiExternalLink />
            </a>

            <button
              type="button"
              onClick={() => onEditStore(store)}
              className="flex h-11 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition hover:bg-orange-100"
              title="Editar loja"
            >
              <FiEdit2 />
            </button>
          </div>

          <div className="grid gap-2 rounded-[1.4rem] border border-gray-100 bg-[#f9fafb] p-3">
            <ToggleButton
              active={store.isActive !== false}
              label="Inativa"
              activeLabel="Ativa"
              onClick={() => onToggleStore(store, 'isActive')}
              disabled={store.isDeleted}
            />

            <ToggleButton
              active={store.isOpen !== false}
              label="Fechada"
              activeLabel="Aberta"
              onClick={() => onToggleStore(store, 'isOpen')}
              disabled={store.isDeleted || store.isActive === false || store.isBlocked}
            />

            <button
              type="button"
              onClick={() => onToggleStore(store, 'isBlocked')}
              disabled={store.isDeleted}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60',
                store.isBlocked
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-gray-100 text-[#6b7280] hover:bg-gray-200'
              )}
            >
              {store.isBlocked ? <FiLock /> : <FiUnlock />}
              {store.isBlocked ? 'Bloqueada' : 'Desbloqueada'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onArchiveStore(store)}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition',
              store.isDeleted
                ? 'bg-gray-100 text-[#111827] hover:bg-gray-200'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            )}
          >
            {store.isDeleted ? <FiRefreshCw /> : <FiTrash2 />}
            {store.isDeleted ? 'Restaurar loja' : 'Arquivar loja'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs font-bold text-[#6b7280]">
        <span className="inline-flex items-center gap-2">
          <StatusIcon className="text-[#f97316]" />
          {store.city || store.neighborhood ? `${store.city || 'Cidade'} ${store.neighborhood ? `· ${store.neighborhood}` : ''}` : 'Localização não definida'}
        </span>

        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 text-[#f97316] transition hover:text-[#ea580c]"
        >
          <span className="min-w-0 break-all">
            {storeUrl.replace(/^https?:\/\//, '')}
          </span>
          <FiArrowUpRight className="shrink-0" />
        </a>
      </div>
    </article>
  )
}

export default function AdminDashboard() {
  const [stores, setStores] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStore, setEditingStore] = useState(null)
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM)

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  useEffect(() => {
    setLoading(true)

    const unsubscribe = onSnapshot(
      collection(db, 'stores'),
      (snapshot) => {
        const list = snapshot.docs.map((storeDoc) => ({
          id: storeDoc.id,
          storeId: storeDoc.id,
          ...storeDoc.data(),
        }))

        setStores(list)
        setLoading(false)
      },
      (error) => {
        console.error(error)
        setStores([])
        setLoading(false)
        showToast('error', 'Erro ao carregar lojas. Confira permissão, internet e regras do Firestore.')
      }
    )

    return () => unsubscribe()
  }, [showToast])

  const stats = useMemo(() => {
    const notArchived = stores.filter((store) => !store.isDeleted)
    const activeStores = notArchived.filter((store) => store.isActive !== false)
    const openStores = notArchived.filter(
      (store) => store.isActive !== false && store.isBlocked !== true && store.isOpen !== false
    )
    const trialStores = notArchived.filter((store) => getSubscriptionStatus(store).id === 'trial')
    const pastDueStores = notArchived.filter((store) => getSubscriptionStatus(store).id === 'past_due')
    const whiteLabelStores = notArchived.filter((store) => getPlan(store).id === 'white-label')

    return {
      total: notArchived.length,
      active: activeStores.length,
      open: openStores.length,
      blocked: notArchived.filter((store) => store.isBlocked).length,
      archived: stores.filter((store) => store.isDeleted).length,
      trial: trialStores.length,
      pastDue: pastDueStores.length,
      whiteLabel: whiteLabelStores.length,
    }
  }, [stores])

  const planStats = useMemo(() => {
    return PLAN_OPTIONS.map((plan) => ({
      ...plan,
      count: stores.filter((store) => !store.isDeleted && getPlan(store).id === plan.id).length,
    }))
  }, [stores])

  const filteredStores = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return stores
      .filter((store) => {
        const subscriptionId = getSubscriptionStatus(store).id

        if (filter !== 'archived' && store.isDeleted) return false
        if (filter === 'active') return store.isActive !== false && !store.isDeleted
        if (filter === 'inactive') return store.isActive === false && !store.isDeleted
        if (filter === 'open') {
          return (
            store.isOpen !== false &&
            store.isActive !== false &&
            store.isBlocked !== true &&
            !store.isDeleted
          )
        }
        if (filter === 'closed') return store.isOpen === false && !store.isDeleted
        if (filter === 'blocked') return store.isBlocked === true && !store.isDeleted
        if (filter === 'trial') return subscriptionId === 'trial' && !store.isDeleted
        if (filter === 'past_due') return subscriptionId === 'past_due' && !store.isDeleted
        if (filter === 'archived') return store.isDeleted === true

        return true
      })
      .filter((store) => {
        if (!term) return true

        const searchableText = [
          store.name,
          store.slug,
          store.storeSlug,
          store.storeId,
          store.ownerEmail,
          store.ownerName,
          store.ownerUid,
          store.whatsapp,
          store.whatsapp1,
          store.city,
          store.neighborhood,
          store.category,
          getPlan(store).label,
          getSubscriptionStatus(store).label,
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(term)
      })
      .sort((a, b) => {
        const aDate = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0)
        const bDate = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0)

        return bDate.getTime() - aDate.getTime()
      })
  }, [filter, searchTerm, stores])

  const handleCopyLink = useCallback(
    async (store) => {
      const url = getStoreUrl(store)

      try {
        await navigator.clipboard.writeText(url)
        showToast('success', 'Link público da loja copiado.')
      } catch {
        showToast('error', 'Não foi possível copiar o link.')
      }
    },
    [showToast]
  )

  const handleToggleStore = useCallback(
  async (store, field) => {
    const storeDocId = getStoreDocId(store)

    if (!storeDocId) {
      showToast('error', 'Loja sem ID de documento válido.')
      return
    }

    const currentValue =
      field === 'isBlocked'
        ? Boolean(store[field])
        : store[field] ?? true

    try {
      await updateDoc(doc(db, 'stores', storeDocId), {
        [field]: !currentValue,
        updatedAt: serverTimestamp(),
      })

      showToast('success', 'Status da loja atualizado.')
    } catch (error) {
      console.error(error)
      showToast('error', 'Erro ao atualizar loja.')
    }
  },
  [showToast]
)

  const handleArchiveStore = useCallback(
    async (store) => {
      const storeDocId = getStoreDocId(store)

      if (!storeDocId) {
        showToast('error', 'Loja sem ID de documento válido.')
        return
      }

      const confirmed = window.confirm(
        store.isDeleted
          ? 'Deseja restaurar esta loja?'
          : 'Deseja arquivar esta loja? Ela sairá da lista principal, mas continuará salva no Firestore.'
      )

      if (!confirmed) return

      try {
        await updateDoc(doc(db, 'stores', storeDocId), {
          isDeleted: !store.isDeleted,
          isActive: store.isDeleted ? true : false,
          updatedAt: serverTimestamp(),
          ...(store.isDeleted
            ? { restoredAt: serverTimestamp() }
            : { deletedAt: serverTimestamp() }),
        })

        showToast('success', store.isDeleted ? 'Loja restaurada.' : 'Loja arquivada.')
      } catch (error) {
        console.error(error)
        showToast('error', 'Erro ao arquivar/restaurar loja.')
      }
    },
    [showToast]
  )

  const openEditModal = useCallback((store) => {
    setEditingStore(store)
    setEditForm({
      name: store.name || '',
      storeSlug: getStoreSlug(store),
      description: store.description || '',
      category: store.category || store.type || '',
      city: store.city || '',
      neighborhood: store.neighborhood || '',
      ownerName: store.ownerName || store.owner?.name || '',
      ownerEmail: store.ownerEmail || store.owner?.email || '',
      ownerUid: store.ownerUid || store.owner?.uid || '',
      themeColor: store.themeColor || '#f97316',
      whatsapp: store.whatsapp || store.whatsapp1 || '',
      instagram: store.instagram || store.social?.instagram || '',
      deliveryTime: store.deliveryTime || '25-40 min',
      minOrder: moneyToInput(store.minOrder, store.minOrderCents),
      deliveryFee: moneyToInput(store.deliveryFee, store.deliveryFeeCents),
      planId: getPlan(store).id,
      subscriptionStatus: getSubscriptionStatus(store).id,
      isOpen: store.isOpen ?? true,
      isActive: store.isActive ?? true,
      isBlocked: store.isBlocked ?? false,
    })
    setIsEditModalOpen(true)
  }, [])

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false)
    setEditingStore(null)
    setEditForm(DEFAULT_EDIT_FORM)
  }, [])

  const updateEditForm = useCallback((field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const handleSaveStore = useCallback(async () => {
    if (!editingStore) return

    const storeDocId = getStoreDocId(editingStore)

    if (!storeDocId) {
      showToast('error', 'Loja sem ID de documento válido.')
      return
    }

    if (!editForm.name.trim()) {
      showToast('error', 'Informe o nome da loja.')
      return
    }

    const safeSlug = slugify(editForm.storeSlug || editForm.name)

    if (!safeSlug) {
      showToast('error', 'Informe um slug válido para a loja.')
      return
    }

    setSaving(true)

    try {
      const minOrder = parseCurrency(editForm.minOrder)
      const deliveryFee = parseCurrency(editForm.deliveryFee)
      const whatsapp = normalizePhoneBR(editForm.whatsapp)
      const instagram = sanitizeSocial(editForm.instagram)
      const selectedPlan = PLAN_OPTIONS.find((plan) => plan.id === editForm.planId) || PLAN_OPTIONS[1]

      await updateDoc(doc(db, 'stores', storeDocId), {
        name: editForm.name.trim(),
        storeSlug: safeSlug,
        slug: safeSlug,
        storeId: editingStore.storeId || storeDocId,
        storeKeys: Array.from(
          new Set([editingStore.storeId, storeDocId, safeSlug, editingStore.storeSlug, editingStore.slug].filter(Boolean))
        ),
        description: editForm.description.trim(),
        category: editForm.category.trim(),
        type: editForm.category.trim(),
        city: editForm.city.trim(),
        neighborhood: editForm.neighborhood.trim(),
        ownerName: editForm.ownerName.trim(),
        ownerEmail: editForm.ownerEmail.trim(),
        ownerUid: editForm.ownerUid.trim(),
        owner: {
          name: editForm.ownerName.trim(),
          email: editForm.ownerEmail.trim(),
          uid: editForm.ownerUid.trim(),
        },
        themeColor: editForm.themeColor || '#f97316',
        whatsapp,
        whatsapp1: whatsapp,
        instagram,
        social: {
          instagram,
        },
        deliveryTime: editForm.deliveryTime.trim() || '25-40 min',
        minOrder,
        minOrderCents: Math.round(minOrder * 100),
        deliveryFee,
        deliveryFeeCents: Math.round(deliveryFee * 100),
        planId: selectedPlan.id,
        planName: selectedPlan.label,
        subscriptionStatus: editForm.subscriptionStatus,
        subscription: {
          ...(editingStore.subscription || {}),
          planId: selectedPlan.id,
          planName: selectedPlan.label,
          status: editForm.subscriptionStatus,
          priceLabel: selectedPlan.price,
          updatedAt: serverTimestamp(),
        },
        isOpen: editForm.isOpen,
        isActive: editForm.isActive,
        isBlocked: editForm.isBlocked,
        updatedAt: serverTimestamp(),
      })

      showToast('success', 'Loja atualizada com compatibilidade de plano, slug e centavos.')
      closeEditModal()
    } catch (error) {
      console.error(error)
      showToast('error', 'Erro ao salvar loja.')
    } finally {
      setSaving(false)
    }
  }, [closeEditModal, editForm, editingStore, showToast])

  const currentPublicLink = getStoreUrl(editForm.storeSlug || slugify(editForm.name))

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f9fafb] pb-24 text-[#111827] lg:pb-10">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[2.4rem] bg-[#111827] p-6 text-white shadow-xl shadow-gray-300/40 sm:p-8">
          <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-orange-100">
                <FiShield className="text-[#f97316]" />
                PratoBy Cloud · v{APP_VERSION}
              </span>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Operação global das lojas
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-gray-300 sm:text-base">
                Gerencie lojas, planos, status de assinatura, links públicos, WhatsApp,
                taxas e bloqueios sem acessar o Firestore manualmente.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/admin/stores/new"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/30 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
                >
                  <FiPlus />
                  Criar nova loja
                </Link>

                <Link
                  to="/"
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <FiGlobe />
                  Ver site público
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[430px]">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/10 p-5">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-300">
                  <FiActivity className="text-[#f97316]" />
                  Lojas ativas
                </p>
                <p className="mt-3 text-4xl font-black">{stats.active}</p>
                <p className="mt-1 text-xs font-bold text-gray-400">
                  {stats.total} lojas não arquivadas
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-white/10 p-5">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-300">
                  <FiZap className="text-[#f97316]" />
                  Recebendo pedidos
                </p>
                <p className="mt-3 text-4xl font-black">{stats.open}</p>
                <p className="mt-1 text-xs font-bold text-gray-400">
                  abertas, ativas e sem bloqueio
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            icon={FiShoppingBag}
            label="Total"
            value={stats.total}
            description="lojas visíveis"
            tone="orange"
          />
          <StatCard
            icon={FiActivity}
            label="Ativas"
            value={stats.active}
            description="liberadas no sistema"
            tone="blue"
          />
          <StatCard
            icon={FiZap}
            label="Abertas"
            value={stats.open}
            description="recebendo pedidos"
            tone="green"
          />
          <StatCard
            icon={FiStar}
            label="Em teste"
            value={stats.trial}
            description="trial/onboarding"
            tone="amber"
          />
          <StatCard
            icon={FiAlertTriangle}
            label="Pendentes"
            value={stats.pastDue}
            description="assinatura atrasada"
            tone="red"
          />
          <StatCard
            icon={FiArchive}
            label="Arquivadas"
            value={stats.archived}
            description="fora da lista"
            tone="gray"
          />
        </div>

        {/* LAYOUT EM DUAS COLUNAS ESTRUTURAIS */}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          
          {/* COLUNA ESQUERDA (Principal: Busca + Lista de Lojas) */}
          <div className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] pl-12 pr-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                    placeholder="Buscar por loja, slug, dono, e-mail, cidade, plano ou WhatsApp..."
                  />
                </div>

                <div className="min-w-0 max-w-full overflow-x-auto pb-1 xl:pb-0">
                  <div className="flex w-max items-center gap-2">
                    <span className="hidden items-center gap-2 text-sm font-black text-[#6b7280] xl:flex">
                      <FiFilter />
                      Filtros
                    </span>

                    {FILTERS.map((item) => {
                      const Icon = item.icon || FiFilter
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFilter(item.id)}
                          className={cn(
                            'inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition',
                            filter === item.id
                              ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
                              : 'bg-gray-50 text-[#6b7280] hover:bg-gray-100 hover:text-[#111827]'
                          )}
                        >
                          <Icon size={15} />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs font-bold text-[#6b7280]">
                <span>
                  Mostrando <strong className="text-[#111827]">{filteredStores.length}</strong> de{' '}
                  <strong className="text-[#111827]">{stores.length}</strong> lojas carregadas.
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setFilter('all')
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 transition hover:bg-gray-200 hover:text-[#111827]"
                >
                  <FiRefreshCw />
                  Limpar busca
                </button>
              </div>
            </section>

            <section className="min-w-0 space-y-4">
              {filteredStores.length === 0 ? (
                <EmptyState loading={loading} filter={filter} searchTerm={searchTerm} />
              ) : (
                filteredStores.map((store) => (
                  <StoreCard
                    key={getStoreDocId(store)}
                    store={store}
                    onCopyLink={handleCopyLink}
                    onToggleStore={handleToggleStore}
                    onArchiveStore={handleArchiveStore}
                    onEditStore={openEditModal}
                  />
                ))
              )}
            </section>
          </div>

          {/* COLUNA DIREITA (Sidebar: Planos + Checklist + Atalhos) */}
          <aside className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                    Planos
                  </p>
                  <h2 className="mt-1 text-lg font-black text-[#111827]">
                    Distribuição atual
                  </h2>
                </div>
                <FiCreditCard className="text-[#f97316]" size={22} />
              </div>

              <div className="mt-4 space-y-3">
                {planStats.map((plan) => (
                  <div key={plan.id} className="rounded-2xl bg-[#f9fafb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#111827]">{plan.label}</p>
                        <p className="text-xs font-bold text-[#6b7280]">{plan.price}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#f97316] shadow-sm">
                        {plan.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-orange-100 bg-[#fff7ed] p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#f97316] shadow-sm">
                  <FiHelpCircle size={20} />
                </div>
                <div>
                  <p className="font-black text-[#111827]">Checklist admin</p>
                  <p className="text-xs font-bold text-[#9a3412]">Compatibilidade do BoraPedir/PratoBy</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {DEV_CHECKLIST.map((item) => (
                  <div key={item.label} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316]">
                      <FiCheck size={13} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#111827]">{item.label}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                Atalhos úteis
              </p>

              <div className="mt-4 grid gap-2">
                <Link
                  to="/admin/orders"
                  className="flex items-center justify-between rounded-2xl bg-[#f9fafb] px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-orange-50 hover:text-[#f97316]"
                >
                  Pedidos globais
                  <FiArrowRight />
                </Link>
                <Link
                  to="/admin/subscriptions"
                  className="flex items-center justify-between rounded-2xl bg-[#f9fafb] px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-orange-50 hover:text-[#f97316]"
                >
                  Assinaturas
                  <FiArrowRight />
                </Link>
                <Link
                  to="/admin/settings"
                  className="flex items-center justify-between rounded-2xl bg-[#f9fafb] px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-orange-50 hover:text-[#f97316]"
                >
                  Configurações
                  <FiArrowRight />
                </Link>
              </div>
            </section>
          </aside>
        </div>


      </section>

      {isEditModalOpen && editingStore && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#111827]">
                  Editar loja
                </h2>

                <p className="mt-1 text-sm font-semibold text-[#6b7280]">
                  Ajustes rápidos de vitrine, operação, assinatura e acesso.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
                aria-label="Fechar modal"
              >
                <FiX />
              </button>
            </div>

            <div className="max-h-[calc(92vh-162px)] space-y-6 overflow-y-auto p-5">
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <FiHome className="text-[#f97316]" />
                  Identidade pública
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome da loja">
                    <TextInput
                      value={editForm.name}
                      onChange={(event) => updateEditForm('name', event.target.value)}
                      placeholder="Ex: Capivaras Lanches"
                    />
                  </Field>

                  <Field label="Slug público">
                    <TextInput
                      value={editForm.storeSlug}
                      onChange={(event) => updateEditForm('storeSlug', slugify(event.target.value))}
                      placeholder="capivaras-lanches"
                    />
                  </Field>

                  <div className="sm:col-span-2 rounded-[1.4rem] border border-orange-100 bg-orange-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                      <FiLink />
                      Link público da loja
                    </p>
                    <p className="mt-2 break-all text-sm font-black text-[#111827]">
                      {currentPublicLink.replace(/^https?:\/\//, '')}
                    </p>
                  </div>

                  <Field label="Categoria">
                    <TextInput
                      value={editForm.category}
                      onChange={(event) => updateEditForm('category', event.target.value)}
                      placeholder="Pizzaria, hamburgueria, açaí..."
                    />
                  </Field>

                  <Field label="Cor principal">
                    <div className="flex h-12 items-center gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] px-4">
                      <input
                        type="color"
                        value={editForm.themeColor}
                        onChange={(event) => updateEditForm('themeColor', event.target.value)}
                        className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                      />

                      <span className="text-sm font-black text-[#111827]">
                        {editForm.themeColor}
                      </span>
                    </div>
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Descrição">
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(event) => updateEditForm('description', event.target.value)}
                        placeholder="Resumo que aparece na loja pública."
                        className="w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-bold leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <FiUser className="text-[#f97316]" />
                  Responsável e contato
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do responsável">
                    <TextInput
                      value={editForm.ownerName}
                      onChange={(event) => updateEditForm('ownerName', event.target.value)}
                      placeholder="Nome do lojista"
                    />
                  </Field>

                  <Field label="E-mail do responsável">
                    <TextInput
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(event) => updateEditForm('ownerEmail', event.target.value)}
                      placeholder="email@loja.com"
                    />
                  </Field>

                  <Field label="UID do usuário Firebase">
                    <TextInput
                      value={editForm.ownerUid}
                      onChange={(event) => updateEditForm('ownerUid', event.target.value)}
                      placeholder="uid do Auth"
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <TextInput
                      value={editForm.whatsapp}
                      onChange={(event) => updateEditForm('whatsapp', event.target.value)}
                      placeholder="(79) 99999-9999"
                    />
                  </Field>

                  <Field label="Instagram">
                    <TextInput
                      value={editForm.instagram}
                      onChange={(event) => updateEditForm('instagram', event.target.value)}
                      placeholder="@perfil"
                    />
                  </Field>

                  <Field label="Cidade">
                    <TextInput
                      value={editForm.city}
                      onChange={(event) => updateEditForm('city', event.target.value)}
                      placeholder="Aracaju"
                    />
                  </Field>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <FiTruck className="text-[#f97316]" />
                  Operação e valores
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Tempo médio">
                    <TextInput
                      value={editForm.deliveryTime}
                      onChange={(event) => updateEditForm('deliveryTime', event.target.value)}
                      placeholder="25-40 min"
                    />
                  </Field>

                  <Field label="Pedido mínimo">
                    <TextInput
                      value={editForm.minOrder}
                      onChange={(event) => updateEditForm('minOrder', event.target.value)}
                      placeholder="0,00"
                    />
                  </Field>

                  <Field label="Taxa padrão">
                    <TextInput
                      value={editForm.deliveryFee}
                      onChange={(event) => updateEditForm('deliveryFee', event.target.value)}
                      placeholder="0,00"
                    />
                  </Field>

                  <Field label="Bairro principal">
                    <TextInput
                      value={editForm.neighborhood}
                      onChange={(event) => updateEditForm('neighborhood', event.target.value)}
                      placeholder="Centro"
                    />
                  </Field>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <FiCreditCard className="text-[#f97316]" />
                  Plano e assinatura
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PLAN_OPTIONS.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => updateEditForm('planId', plan.id)}
                        className={cn(
                          'rounded-[1.4rem] border p-4 text-left transition',
                          editForm.planId === plan.id
                            ? 'border-[#f97316] bg-orange-50 ring-4 ring-orange-100'
                            : 'border-gray-100 bg-[#f9fafb] hover:border-orange-100 hover:bg-white'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-[#111827]">{plan.label}</p>
                          {editForm.planId === plan.id && <FiCheck className="text-[#f97316]" />}
                        </div>
                        <p className="mt-1 text-xs font-black text-[#f97316]">{plan.price}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280]">{plan.description}</p>
                      </button>
                    ))}
                  </div>

                  <Field label="Status da assinatura">
                    <SelectInput
                      value={editForm.subscriptionStatus}
                      onChange={(event) => updateEditForm('subscriptionStatus', event.target.value)}
                    >
                      {SUBSCRIPTION_STATUS.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                  <FiSliders className="text-[#f97316]" />
                  Controles rápidos
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#f9fafb] p-4">
                    <span className="text-sm font-black text-[#111827]">Ativa</span>
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(event) => updateEditForm('isActive', event.target.checked)}
                      className="h-5 w-5 accent-[#f97316]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#f9fafb] p-4">
                    <span className="text-sm font-black text-[#111827]">Aberta</span>
                    <input
                      type="checkbox"
                      checked={editForm.isOpen}
                      onChange={(event) => updateEditForm('isOpen', event.target.checked)}
                      className="h-5 w-5 accent-[#f97316]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#f9fafb] p-4">
                    <span className="text-sm font-black text-[#111827]">Bloqueada</span>
                    <input
                      type="checkbox"
                      checked={editForm.isBlocked}
                      onChange={(event) => updateEditForm('isBlocked', event.target.checked)}
                      className="h-5 w-5 accent-[#f97316]"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-black text-[#111827] transition hover:bg-gray-200 sm:flex-1"
              >
                Cancelar
              </button>

              <a
                href={currentPublicLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] transition hover:border-orange-200 hover:text-[#f97316] sm:flex-1"
              >
                <FiEye />
                Prévia
              </a>

              <button
                type="button"
                onClick={handleSaveStore}
                disabled={saving}
                className="rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70 sm:flex-[2]"
              >
                {saving ? 'Salvando...' : 'Salvar loja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}


