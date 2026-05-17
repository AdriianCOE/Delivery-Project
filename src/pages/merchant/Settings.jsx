import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardFooter from '../../components/layouts/DashboardFooter'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiGlobe,
  FiImage,
  FiInstagram,
  FiLink,
  FiLoader,
  FiMapPin,
  FiMessageCircle,
  FiMonitor,
  FiPhone,
  FiSave,
  FiSettings,
  FiShield,
  FiShoppingBag,
  FiUpload,
  FiX,
  FiZap,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadImageToCloudinary } from '../../services/cloudinary'

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const BRAND_GREEN = '#f97316'
const DEFAULT_THEME = '#f97316'

const DAYS_OF_WEEK = [
  { id: 'sun', short: 'Dom', label: 'Domingo' },
  { id: 'mon', short: 'Seg', label: 'Segunda' },
  { id: 'tue', short: 'Ter', label: 'Terça' },
  { id: 'wed', short: 'Qua', label: 'Quarta' },
  { id: 'thu', short: 'Qui', label: 'Quinta' },
  { id: 'fri', short: 'Sex', label: 'Sexta' },
  { id: 'sat', short: 'Sáb', label: 'Sábado' },
]

const SEGMENTS = [
  'Restaurante',
  'Pizzaria',
  'Hamburgueria',
  'Lanchonete',
  'Açaíteria',
  'Cafeteria',
  'Doceria',
  'Marmitaria',
  'Bar',
  'Outro',
]

const DEFAULT_FORM = {
  name: '',
  slug: '',
  description: '',
  segment: 'Restaurante',
  logoUrl: '',
  bannerUrl: '',
  themeColor: DEFAULT_THEME,
  whatsapp: '',
  instagram: '',
  isOpen: true,
  isActive: true,
  openingHours: {
  sun: { enabled: false, open: '18:00', close: '22:00' },
  mon: { enabled: false, open: '18:00', close: '22:00' },
  tue: { enabled: true, open: '18:00', close: '23:30' },
  wed: { enabled: true, open: '18:00', close: '23:30' },
  thu: { enabled: true, open: '18:00', close: '23:30' },
  fri: { enabled: true, open: '18:00', close: '00:00' },
  sat: { enabled: true, open: '18:00', close: '00:00' },
  },
  hoursOpen: '18:00',
  hoursClose: '23:30',
  deliveryTime: '40-50 min',
  minOrder: '0,00',
  acceptDelivery: true,
  acceptPickup: true,
  acceptDineIn: false,
  newOrderSoundEnabled: true,
  printAfterConfirm: true,
  autoCloseEnabled: false,
  autoCloseGraceMinutes: '30',
  paymentPix: true,
  paymentCard: true,
  paymentCash: true,
  pixEnabled: false,
  pixKey: '',
  pixKeyType: 'phone',
  pixMerchantName: '',
  pixMerchantCity: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: 'SE',
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function getTodayKey() {
  return DAYS_OF_WEEK[new Date().getDay()]?.id || 'sun'
}

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
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

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  if (numericValue > 999) return numericValue / 100

  return numericValue
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignora ambientes sem localStorage.
  }
}

function getStoreSlug(store) {
  return store?.storeSlug || store?.slug || store?.id || ''
}

function getStoreKeys(store, nextSlug = '') {
  return uniqueArray([
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
    store?.id,
    store?.storeId,
    store?.storeDocId,
    store?.storeSlug,
    store?.slug,
    nextSlug,
  ])
}

function getStorePublicUrl(storeOrSlug) {
  const slug =
    typeof storeOrSlug === 'string'
      ? storeOrSlug
      : getStoreSlug(storeOrSlug)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return `${origin}/${slug}`
}

function getAddressFromStore(store) {
  const address = store?.address || {}

  if (typeof address === 'string') {
    return {
      cep: store?.cep || '',
      street: address,
      number: store?.number || '',
      neighborhood: store?.neighborhood || '',
      complement: store?.complement || '',
      city: store?.city || '',
      state: store?.state || 'SE',
    }
  }

  return {
    cep: address.cep || store?.cep || '',
    street: address.street || address.rua || store?.street || '',
    number: address.number || address.numero || store?.number || '',
    neighborhood:
      address.neighborhood ||
      address.bairro ||
      store?.neighborhood ||
      '',
    complement:
      address.complement ||
      address.complemento ||
      store?.complement ||
      '',
    city: address.city || address.cidade || store?.city || '',
    state: address.state || address.uf || store?.state || 'SE',
  }
}

function normalizeStore(storeDoc) {
  const data = storeDoc.data() || {}

  return {
    ...data,
    id: storeDoc.id,
    storeId: data.storeId || storeDoc.id,
    storeDocId: data.storeDocId || storeDoc.id,
    storeSlug: data.storeSlug || data.slug || storeDoc.id,
    slug: data.slug || data.storeSlug || storeDoc.id,
  }
}

function getDefaultOpeningHours() {
  return {
    sun: { enabled: false, open: '18:00', close: '22:00' },
    mon: { enabled: false, open: '18:00', close: '22:00' },
    tue: { enabled: true, open: '18:00', close: '23:30' },
    wed: { enabled: true, open: '18:00', close: '23:30' },
    thu: { enabled: true, open: '18:00', close: '23:30' },
    fri: { enabled: true, open: '18:00', close: '00:00' },
    sat: { enabled: true, open: '18:00', close: '00:00' },
  }
}

function normalizeOpeningHours(store) {
  const saved =
    store?.openingHours ||
    store?.settings?.openingHours ||
    {}

  const fallbackOpen = store?.hoursOpen || '18:00'
  const fallbackClose = store?.hoursClose || '23:30'
  const activeDays = Array.isArray(store?.activeDays) ? store.activeDays : []

  return DAYS_OF_WEEK.reduce((acc, day) => {
    const current = saved?.[day.id] || saved?.[day.short] || {}

    acc[day.id] = {
      enabled:
        current.enabled ??
        activeDays.includes(day.short) ??
        false,
      open: current.open || fallbackOpen,
      close: current.close || fallbackClose,
    }

    return acc
  }, {})
}

function mapStoreToForm(store) {
  const address = getAddressFromStore(store)
  const settings = store?.settings || {}
  const pix = store?.pix || {}

  return {
    ...DEFAULT_FORM,
    name: store?.name || '',
    slug: getStoreSlug(store),
    description: store?.description || '',
    segment: store?.segment || store?.category || 'Restaurante',
    logoUrl: store?.logoUrl || store?.logoURL || store?.logo || store?.avatarUrl || '',
    bannerUrl:
      store?.bannerUrl ||
      store?.bannerURL ||
      store?.coverUrl ||
      store?.coverURL ||
      store?.bannerImageUrl ||
      '',
    themeColor:
      store?.themeColor ||
      store?.primaryColor ||
      store?.accentColor ||
      store?.colors?.primary ||
      settings?.themeColor ||
      DEFAULT_THEME,
    whatsapp:
      store?.whatsapp ||
      store?.whatsapp1 ||
      store?.phone ||
      store?.settings?.whatsapp ||
      '',
    instagram:
      store?.instagram ||
      store?.social?.instagram ||
      store?.settings?.instagram ||
      '',
    isOpen: store?.isOpen ?? true,
    isActive: store?.isActive ?? true,
    openingHours: normalizeOpeningHours(store),
    deliveryTime: store?.deliveryTime || settings?.deliveryTime || DEFAULT_FORM.deliveryTime,
    minOrder: moneyToInput(store?.minOrder, store?.minOrderCents),
    acceptDelivery: settings?.acceptDelivery ?? store?.acceptDelivery ?? true,
    acceptPickup: settings?.acceptPickup ?? store?.acceptPickup ?? true,
    acceptDineIn: settings?.acceptDineIn ?? store?.acceptDineIn ?? false,
    newOrderSoundEnabled:
      settings?.newOrderSoundEnabled ??
      store?.newOrderSoundEnabled ??
      true,
    printAfterConfirm:
      settings?.printAfterConfirm ??
      store?.printAfterConfirm ??
      true,
    autoCloseEnabled:
      settings?.autoCloseEnabled ??
      store?.autoCloseEnabled ??
      false,
    autoCloseGraceMinutes: String(
      settings?.autoCloseGraceMinutes ??
      store?.autoCloseGraceMinutes ??
      30
    ),
    paymentPix: store?.paymentMethods?.pix ?? true,
    paymentCard: store?.paymentMethods?.card ?? true,
    paymentCash: store?.paymentMethods?.cash ?? true,
    pixEnabled: pix?.enabled ?? false,
    pixKey: pix?.key || '',
    pixKeyType: pix?.keyType || 'phone',
    pixMerchantName: pix?.merchantName || store?.name || '',
    pixMerchantCity: pix?.merchantCity || address.city || '',
    ...address,
  }
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-200">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isSuccess
              ? 'bg-orange-50 text-[#f97316]'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {isSuccess ? <FiCheckCircle /> : <FiAlertCircle />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827]">
            {isSuccess ? 'Tudo certo' : 'Atenção'}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#6b7280]">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-50 hover:text-[#111827]"
        >
          <FiX />
        </button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-base font-black text-[#111827]">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm leading-6 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  )
}

function Label({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
      {children}
    </label>
  )
}

function Input({ label, icon: Icon, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        )}

        <input
          {...props}
          className={`h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 ${
            Icon ? 'pl-11' : ''
          } ${props.className || ''}`}
        />
      </div>
    </div>
  )
}

function Select({ label, children, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <select
        {...props}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      >
        {children}
      </select>
    </div>
  )
}

function Textarea({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <textarea
        {...props}
        className="min-h-[110px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      />
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 text-left transition hover:bg-white"
    >
      <div>
        <p className="text-sm font-black text-[#111827]">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            {description}
          </p>
        )}
      </div>

      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-[#f97316]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  )
}

function ImageUploadField({
  label,
  description,
  value,
  uploading,
  aspect = 'square',
  onUpload,
  onChangeUrl,
  onRemove,
}) {
  const previewClass =
    aspect === 'banner'
      ? 'h-40 w-full rounded-[1.5rem]'
      : 'h-32 w-32 rounded-[1.5rem]'

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#111827]">
            {label}
          </p>

          {description && (
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>

        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
          >
            Remover
          </button>
        )}
      </div>

      <div className={aspect === 'banner' ? 'space-y-3' : 'flex flex-col gap-4 sm:flex-row sm:items-center'}>
        <div className={`${previewClass} flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-200 bg-white text-gray-400`}>
          {value ? (
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <FiImage size={24} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]">
            {uploading ? <FiLoader className="animate-spin" /> : <FiUpload />}
            {uploading ? 'Enviando imagem...' : value ? 'Trocar imagem' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''

                if (file) onUpload(file)
              }}
              className="hidden"
            />
          </label>

          <Input
            placeholder="Ou cole uma URL de imagem"
            value={value || ''}
            onChange={(event) => onChangeUrl(event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

function StoreSelector({ stores, selectedStoreId, onSelect }) {
  if (stores.length <= 1) return null

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
      <Label>Loja selecionada</Label>
      <select
        value={selectedStoreId}
        onChange={(event) => onSelect(event.target.value)}
        className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-black text-[#111827] outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name || store.storeSlug || store.id}
          </option>
        ))}
      </select>
    </div>
  )
}

function EmptyState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="max-w-md rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <FiShoppingBag size={24} />
        </div>

        <h1 className="mt-5 text-2xl font-black text-[#111827]">
          Nenhuma loja encontrada
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#6b7280]">
          Você ainda não possui uma loja vinculada à sua conta.
        </p>

        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </main>
  )
}

export default function Settings() {
  const { user } = useAuth()

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState('')
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const selectedStore = useMemo(() => {
    return stores.find((store) => store.id === selectedStoreId) || stores[0] || null
  }, [selectedStoreId, stores])

  const publicSlug = slugify(form.slug || form.name)
  const publicUrl = getStorePublicUrl(publicSlug)

  const themeVars = useMemo(() => ({
    '--store-theme': form.themeColor || BRAND_GREEN,
  }), [form.themeColor])

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const updateOpeningHour = useCallback((dayId, field, value) => {
  setForm((prev) => {
    const defaultHours = getDefaultOpeningHours()
    const currentDayHours = prev.openingHours?.[dayId] || defaultHours[dayId]

    return {
      ...prev,
      openingHours: {
        ...(prev.openingHours || defaultHours),
        [dayId]: {
          ...currentDayHours,
          [field]: value,
        },
      },
    }
  })
}, [])

  const handleSelectStore = useCallback((storeId) => {
    setSelectedStoreId(storeId)
    safeSetLocalStorage(SELECTED_STORE_KEY, storeId)
  }, [])

  useEffect(() => {
    if (!user?.uid) {
      setStores([])
      setLoadingStores(false)
      return undefined
    }

    setLoadingStores(true)

    const storesQuery = query(
      collection(db, 'stores'),
      where('ownerId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      storesQuery,
      (snapshot) => {
        const nextStores = snapshot.docs.map(normalizeStore)

        setStores(nextStores)
        setLoadingStores(false)
      },
      (error) => {
        console.error(error)
        setStores([])
        setLoadingStores(false)
        showToast('error', 'Erro ao carregar suas lojas.')
      }
    )

    return () => unsubscribe()
  }, [showToast, user?.uid])

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId('')
      return
    }

    setSelectedStoreId((current) => {
      if (stores.some((store) => store.id === current)) return current

      const savedStoreId = safeGetLocalStorage(SELECTED_STORE_KEY)

      if (stores.some((store) => store.id === savedStoreId)) {
        return savedStoreId
      }

      return stores[0].id
    })
  }, [stores])

  useEffect(() => {
    if (!selectedStore) return

    setForm(mapStoreToForm(selectedStore))
  }, [selectedStore])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      showToast('success', 'Link da loja copiado.')
    } catch {
      showToast('error', 'Não foi possível copiar o link.')
    }
  }, [publicUrl, showToast])

  const handleUploadStoreImage = useCallback(
    async (file, fieldName) => {
      if (!file || !selectedStore) return

      if (!file.type?.startsWith('image/')) {
        showToast('error', 'Envie uma imagem válida.')
        return
      }

      const maxSizeInMb = 6

      if (file.size > maxSizeInMb * 1024 * 1024) {
        showToast('error', `Imagem muito pesada. Use até ${maxSizeInMb}MB.`)
        return
      }

      setUploadingImage(fieldName)

      try {
        const folder = `PratoBy/${getStoreSlug(selectedStore) || selectedStore.id}/branding/${fieldName}`
        const uploaded = await uploadImageToCloudinary(file, folder)
        const imageUrl = uploaded?.secure_url || uploaded?.url || uploaded

        if (!imageUrl) {
          throw new Error('Cloudinary não retornou a URL da imagem.')
        }

        updateField(fieldName, imageUrl)
        showToast('success', 'Imagem enviada. Salve para aplicar na loja.')
      } catch (error) {
        console.error(error)
        showToast('error', error?.message || 'Erro ao enviar imagem.')
      } finally {
        setUploadingImage('')
      }
    },
    [selectedStore, showToast, updateField]
  )


  const checkSlugAvailability = useCallback(
    async (nextSlug) => {
      if (!selectedStore) return false

      const cleanSlug = slugify(nextSlug)

      if (!cleanSlug) return false

      const currentSlug = getStoreSlug(selectedStore)

      if (cleanSlug === currentSlug) return true

      const docSnap = await getDoc(doc(db, 'stores', cleanSlug))

      if (docSnap.exists() && docSnap.id !== selectedStore.id) {
        return false
      }

      const slugQuery = query(
        collection(db, 'stores'),
        where('storeSlug', '==', cleanSlug),
        limit(1)
      )

      const slugSnap = await getDocs(slugQuery)

      const usedByAnotherStore = slugSnap.docs.some(
        (storeDoc) => storeDoc.id !== selectedStore.id
      )

      return !usedByAnotherStore
    },
    [selectedStore]
  )

  const handleSave = useCallback(async () => {
    if (!selectedStore || saving) return

    const cleanName = form.name.trim()
    const nextSlug = slugify(form.slug || form.name)

    if (!cleanName) {
      showToast('error', 'Digite o nome da loja.')
      return
    }

    if (!nextSlug || nextSlug.length < 3) {
      showToast('error', 'O link da loja precisa ter pelo menos 3 caracteres.')
      return
    }

    setSaving(true)

    try {
      const isSlugAvailable = await checkSlugAvailability(nextSlug)

      if (!isSlugAvailable) {
        showToast('error', 'Esse link já está em uso por outra loja.')
        return
      }

      const minOrder = parseCurrency(form.minOrder)
      const openingHours = form.openingHours || getDefaultOpeningHours()

      const activeDays = DAYS_OF_WEEK
        .filter((day) => openingHours?.[day.id]?.enabled)
        .map((day) => day.short)

      const firstOpenDay = DAYS_OF_WEEK.find(
        (day) => openingHours?.[day.id]?.enabled
      )

      const hoursOpen = firstOpenDay
        ? openingHours[firstOpenDay.id].open
        : '18:00'

      const hoursClose = firstOpenDay
        ? openingHours[firstOpenDay.id].close
        : '23:30'

      const settings = {
        ...(selectedStore.settings || {}),
        themeColor: form.themeColor || DEFAULT_THEME,
        acceptDelivery: form.acceptDelivery,
        acceptPickup: form.acceptPickup,
        acceptDineIn: form.acceptDineIn,
        deliveryTime: form.deliveryTime.trim() || DEFAULT_FORM.deliveryTime,
        newOrderSoundEnabled: form.newOrderSoundEnabled,
        printAfterConfirm: form.printAfterConfirm,
        autoCloseEnabled: form.autoCloseEnabled,
        autoCloseGraceMinutes: Number(form.autoCloseGraceMinutes || 30),
        openingHours,
        whatsapp: normalizePhoneBR(form.whatsapp),
        instagram: sanitizeSocial(form.instagram),
      }

      const payload = {
        name: cleanName,
        description: form.description.trim(),
        segment: form.segment || 'Restaurante',
        category: form.segment || 'Restaurante',

        storeSlug: nextSlug,
        slug: nextSlug,
        storeKeys: getStoreKeys(selectedStore, nextSlug),

        logoUrl: form.logoUrl?.trim() || null,
        logo: form.logoUrl?.trim() || null,
        bannerUrl: form.bannerUrl?.trim() || null,
        coverUrl: form.bannerUrl?.trim() || null,
        themeColor: form.themeColor || DEFAULT_THEME,

        whatsapp: normalizePhoneBR(form.whatsapp),
        whatsapp1: normalizePhoneBR(form.whatsapp),
        phone: normalizePhoneBR(form.whatsapp),
        instagram: sanitizeSocial(form.instagram),
        social: {
          ...(selectedStore.social || {}),
          instagram: sanitizeSocial(form.instagram),
        },

        isOpen: form.isOpen,
        isActive: form.isActive,

        activeDays,
        hoursOpen,
        hoursClose,
        openingHours,
        settings,

        deliveryTime: form.deliveryTime.trim() || DEFAULT_FORM.deliveryTime,
        minOrder,
        minOrderCents: Math.round(minOrder * 100),

        acceptDelivery: form.acceptDelivery,
        acceptPickup: form.acceptPickup,
        acceptDineIn: form.acceptDineIn,

        paymentMethods: {
          pix: form.paymentPix,
          card: form.paymentCard,
          cash: form.paymentCash,
        },

        pix: {
          enabled: form.pixEnabled,
          key: form.pixKey.trim(),
          keyType: form.pixKeyType,
          merchantName: form.pixMerchantName.trim() || cleanName,
          merchantCity: form.pixMerchantCity.trim() || form.city.trim(),
        },

        address: {
          cep: form.cep.trim(),
          street: form.street.trim(),
          number: form.number.trim(),
          neighborhood: form.neighborhood.trim(),
          complement: form.complement.trim(),
          city: form.city.trim(),
          state: form.state.trim() || 'SE',
        },

        cep: form.cep.trim(),
        street: form.street.trim(),
        number: form.number.trim(),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim() || 'SE',

        updatedAt: serverTimestamp(),
      }

      await updateDoc(doc(db, 'stores', selectedStore.id), payload)

      safeSetLocalStorage(SELECTED_STORE_KEY, selectedStore.id)
      showToast('success', 'Configurações da loja salvas.')
    } catch (error) {
      console.error(error)
      showToast('error', error?.message || 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }, [checkSlugAvailability, form, saving, selectedStore, showToast])

  if (loadingStores) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-orange-100 border-t-[#f97316]" />
          <p className="text-sm font-black text-[#111827]">
            Carregando configurações...
          </p>
        </div>
      </main>
    )
  }

  if (!selectedStore) {
    return <EmptyState />
  }

  return (
    <main style={themeVars}
      className="min-h-screen bg-[#f9fafb] pb-20 text-[#111827]"
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#f9fafb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-4">

            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiSettings size={18} />
                </span>

                <h1 className="text-2xl font-black tracking-tight text-[#111827]">
                  Configurações
                </h1>
              </div>

              <p className="mt-1 text-sm text-[#6b7280]">
                Identidade, link, contato, horários e operação da loja.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              <FiExternalLink />
              Ver loja
            </a>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <aside className="space-y-5 lg:order-2">
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            onSelect={handleSelectStore}
          />

          <section className="overflow-hidden rounded-[1.8rem] border border-gray-100 bg-white shadow-sm">
            <div className="relative h-40 bg-[#111827]">
              {form.bannerUrl ? (
                <img
                  src={form.bannerUrl}
                  alt={form.name}
                  className="h-full w-full object-cover opacity-80"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#111827] to-[#f97316]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiShoppingBag className="text-[#f97316]" size={26} />
                  )}
                </div>

                <div className="min-w-0 pb-1 text-white">
                  <p className="truncate text-xl font-black">
                    {form.name || 'Nome da loja'}
                  </p>
                  <p className="truncate text-xs font-bold opacity-80">
                    /store/{publicSlug || 'nome-da-loja'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f9fafb] p-4">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Status
                  </p>
                  <p className={`mt-1 text-sm font-black ${form.isOpen ? 'text-[#f97316]' : 'text-red-600'}`}>
                    {form.isOpen ? 'Aberta' : 'Fechada'}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#f9fafb] p-4">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Horário
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827]">
                    {form.hoursOpen} às {form.hoursClose}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
              >
                <FiCopy />
                Copiar link público
              </button>
            </div>
          </section>
        </aside>

        <div className="space-y-6 lg:order-1">  
          <Section
            icon={FiGlobe}
            title="Identidade da loja"
            description="Essas informações aparecem no cardápio público e no compartilhamento da loja."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nome da loja"
                icon={FiShoppingBag}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Ex: La Bella Pizza"
              />

              <Select
                label="Segmento"
                value={form.segment}
                onChange={(event) => updateField('segment', event.target.value)}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </Select>

              <Input
                label="Link da loja"
                icon={FiLink}
                value={form.slug}
                onChange={(event) => updateField('slug', slugify(event.target.value))}
                placeholder="la-bella-pizza"
              />

              <Input
                label="Cor principal"
                type="color"
                value={form.themeColor}
                onChange={(event) => updateField('themeColor', event.target.value)}
                className="[&>div>input]:h-12 [&>div>input]:p-1"
              />

              <Textarea
                label="Descrição curta"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Pizzas artesanais com massa de longa fermentação..."
                className="md:col-span-2"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                Link público
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="break-all text-sm font-bold text-[#111827]">
                  {publicUrl}
                </p>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#111827] shadow-sm"
                >
                  <FiCopy />
                  Copiar
                </button>
              </div>
            </div>
          </Section>

          <Section
            icon={FiImage}
            title="Logo e banner"
            description="Imagens usadas no cabeçalho do cardápio público."
          >
            <div className="grid gap-4">
              <ImageUploadField
                label="Banner da loja"
                description="Imagem horizontal para o topo do cardápio."
                aspect="banner"
                value={form.bannerUrl}
                uploading={uploadingImage === 'bannerUrl'}
                onUpload={(file) => handleUploadStoreImage(file, 'bannerUrl')}
                onChangeUrl={(value) => updateField('bannerUrl', value)}
                onRemove={() => updateField('bannerUrl', '')}
              />

              <ImageUploadField
                label="Logo da loja"
                description="Imagem quadrada usada no perfil e nos cards."
                value={form.logoUrl}
                uploading={uploadingImage === 'logoUrl'}
                onUpload={(file) => handleUploadStoreImage(file, 'logoUrl')}
                onChangeUrl={(value) => updateField('logoUrl', value)}
                onRemove={() => updateField('logoUrl', '')}
              />
            </div>
          </Section>

          <Section
            icon={FiPhone}
            title="Contato e redes sociais"
            description="Número principal da loja e perfil social exibido para o cliente."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="WhatsApp da loja"
                icon={FiMessageCircle}
                value={form.whatsapp}
                onChange={(event) => updateField('whatsapp', event.target.value)}
                placeholder="(79) 99999-9999"
              />

              <Input
                label="Instagram"
                icon={FiInstagram}
                value={form.instagram}
                onChange={(event) => updateField('instagram', sanitizeSocial(event.target.value))}
                placeholder="la_bella_pizza"
              />
            </div>
          </Section>

          <Section
  icon={FiClock}
  title="Horário de funcionamento"
  description="Defina dias e horários diferentes para cada dia da semana."
>
  <div className="space-y-3">
    {DAYS_OF_WEEK.map((day) => {
      const dayHours = form.openingHours?.[day.id] || {
        enabled: false,
        open: '18:00',
        close: '23:30',
      }

      return (
        <div
          key={day.id}
          className="grid gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 sm:grid-cols-[1fr_130px_130px]"
        >
          <button
            type="button"
            onClick={() =>
              updateOpeningHour(day.id, 'enabled', !dayHours.enabled)
            }
            className="flex items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-[#111827]">
                  {day.label}
                </p>

                {getTodayKey() === day.id && (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                    Hoje
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#6b7280]">
                {dayHours.enabled
                  ? `${dayHours.open} às ${dayHours.close}`
                  : 'Fechado'}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                dayHours.enabled
                  ? 'bg-orange-50 text-[#f97316]'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {dayHours.enabled ? 'Aberto' : 'Fechado'}
            </span>
          </button>

          <input
            type="time"
            disabled={!dayHours.enabled}
            value={dayHours.open}
            onChange={(event) =>
              updateOpeningHour(day.id, 'open', event.target.value)
            }
            className="h-11 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-bold disabled:opacity-40"
          />

          <input
            type="time"
            disabled={!dayHours.enabled}
            value={dayHours.close}
            onChange={(event) =>
              updateOpeningHour(day.id, 'close', event.target.value)
            }
            className="h-11 rounded-2xl border border-gray-100 bg-white px-3 text-sm font-bold disabled:opacity-40"
          />
        </div>
      )
    })}
  </div>
</Section>

          <Section
            icon={FiMapPin}
            title="Endereço"
            description="Endereço textual da loja. Entrega por bairro continua sendo configurada no editor do cardápio."
          >
            <div className="grid gap-4 md:grid-cols-6">
              <Input
                label="CEP"
                value={form.cep}
                onChange={(event) => updateField('cep', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Rua"
                value={form.street}
                onChange={(event) => updateField('street', event.target.value)}
                className="md:col-span-4"
              />

              <Input
                label="Número"
                value={form.number}
                onChange={(event) => updateField('number', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Bairro"
                value={form.neighborhood}
                onChange={(event) => updateField('neighborhood', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Complemento"
                value={form.complement}
                onChange={(event) => updateField('complement', event.target.value)}
                className="md:col-span-2"
              />

              <Input
                label="Cidade"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                className="md:col-span-3"
              />

              <Input
                label="Estado"
                value={form.state}
                onChange={(event) => updateField('state', event.target.value.toUpperCase())}
                className="md:col-span-3"
              />
            </div>
          </Section>

          <Section
            icon={FiMonitor}
            title="Operação"
            description="Configurações gerais de atendimento. Itens, cupons e taxas por bairro ficam no editor do cardápio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                checked={form.isOpen}
                onChange={(value) => updateField('isOpen', value)}
                label="Loja aberta agora"
                description="Quando desligado, o cliente vê a loja como fechada."
              />

              <Toggle
                checked={form.isActive}
                onChange={(value) => updateField('isActive', value)}
                label="Loja ativa"
                description="Use para desativar temporariamente o cardápio público."
              />

              <Toggle
                checked={form.acceptDelivery}
                onChange={(value) => updateField('acceptDelivery', value)}
                label="Aceitar delivery"
                description="Permite pedidos para entrega."
              />

              <Toggle
                checked={form.acceptPickup}
                onChange={(value) => updateField('acceptPickup', value)}
                label="Aceitar retirada"
                description="Permite pedidos para retirar no balcão."
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Input
                label="Tempo médio"
                icon={FiClock}
                value={form.deliveryTime}
                onChange={(event) => updateField('deliveryTime', event.target.value)}
                placeholder="40-50 min"
              />

              <Input
                label="Pedido mínimo"
                value={form.minOrder}
                onChange={(event) => updateField('minOrder', event.target.value)}
                placeholder="0,00"
              />

              <Input
                label="Tolerância auto fechamento"
                type="number"
                min="0"
                value={form.autoCloseGraceMinutes}
                onChange={(event) => updateField('autoCloseGraceMinutes', event.target.value)}
                placeholder="30"
              />
            </div>
          </Section>

          <Section
            icon={FiZap}
            title="Notificações e comanda"
            description="Configurações usadas no painel de pedidos."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                checked={form.newOrderSoundEnabled}
                onChange={(value) => updateField('newOrderSoundEnabled', value)}
                label="Sino de novo pedido"
                description="Toca alerta quando chegar pedido novo."
              />

              <Toggle
                checked={form.printAfterConfirm}
                onChange={(value) => updateField('printAfterConfirm', value)}
                label="Imprimir ao confirmar"
                description="Abre a comanda depois que o pedido for aceito."
              />
            </div>
          </Section>

          <Section
            icon={FiShield}
            title="Pagamentos"
            description="Formas de pagamento aceitas e dados para Pix manual."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Toggle
                checked={form.paymentPix}
                onChange={(value) => updateField('paymentPix', value)}
                label="Pix"
                description="Aceitar pagamento via Pix."
              />

              <Toggle
                checked={form.paymentCard}
                onChange={(value) => updateField('paymentCard', value)}
                label="Cartão"
                description="Cartão na entrega ou balcão."
              />

              <Toggle
                checked={form.paymentCash}
                onChange={(value) => updateField('paymentCash', value)}
                label="Dinheiro"
                description="Permitir pagamento em dinheiro."
              />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-gray-100 bg-[#f9fafb] p-4">
              <Toggle
                checked={form.pixEnabled}
                onChange={(value) => updateField('pixEnabled', value)}
                label="Gerar QR Code Pix manual"
                description="Usa a chave Pix da loja para mostrar QR Code/copia e cola no pedido."
              />

              {form.pixEnabled && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Select
                    label="Tipo de chave Pix"
                    value={form.pixKeyType}
                    onChange={(event) => updateField('pixKeyType', event.target.value)}
                  >
                    <option value="phone">Telefone</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="random">Chave aleatória</option>
                  </Select>

                  <Input
                    label="Chave Pix"
                    value={form.pixKey}
                    onChange={(event) => updateField('pixKey', event.target.value)}
                    placeholder="Chave Pix da loja"
                  />

                  <Input
                    label="Nome no Pix"
                    value={form.pixMerchantName}
                    onChange={(event) => updateField('pixMerchantName', event.target.value)}
                    placeholder={form.name || 'Nome da loja'}
                  />

                  <Input
                    label="Cidade no Pix"
                    value={form.pixMerchantCity}
                    onChange={(event) => updateField('pixMerchantCity', event.target.value)}
                    placeholder={form.city || 'Aracaju'}
                  />
                </div>
              )}
            </div>
          </Section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
            >
              <FiArrowLeft />
              Voltar
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </div>
      <DashboardFooter store={selectedStore}/>
    </main>
  )
}


