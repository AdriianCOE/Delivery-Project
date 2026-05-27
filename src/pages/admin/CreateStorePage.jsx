import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiEyeOff,
  FiGlobe,
  FiImage,
  FiInstagram,
  FiLink,
  FiLoader,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiShield,
  FiShoppingBag,
  FiTruck,
  FiUpload,
  FiUser,
  FiZap,
} from 'react-icons/fi'

import { auth, functions } from '../../services/firebase'
import { uploadImageToCloudinary } from '../../services/cloudinary'

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ESTADOS_BR = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const DEFAULT_THEME = '#f97316'
const PUBLIC_STORE_BASE_PATH = ''

const PLAN_OPTIONS = [
  {
    id: 'essential',
    label: 'Essencial',
    price: 'R$ 59,99/mês',
    description: 'Cardápio digital, link próprio e pedido pelo WhatsApp.',
    features: ['Link próprio', 'Sem comissão', 'Cardápio digital'],
  },
  {
    id: 'professional',
    label: 'Professional',
    price: 'R$ 89,99/mês',
    description: 'Mais controle para cupons, entrega, painel e operação.',
    features: ['Dashboard', 'Cupons', 'Taxa por bairro'],
    popular: true,
  },
  {
    id: 'premium',
    label: 'Premium (White-label)',
    price: 'R$ 159,99/mês',
    description: 'Experiência premium para marcas maiores ou redes.',
    features: ['Visual premium', 'Domínio próprio', 'Suporte prioritário'],
  },
]

const BILLING_CYCLE_OPTIONS = [
  { id: 'monthly', label: 'Mensal', description: 'Cobrança mês a mês.' },
  { id: 'annual', label: 'Anual', description: 'Cobrança anual com desconto.' },
]

const SUBSCRIPTION_STATUS_OPTIONS = [
  { id: 'trialing', label: 'Em teste (Trialing)', description: 'Período gratuito ativo.' },
  { id: 'active', label: 'Ativa', description: 'Assinatura paga em andamento.' },
  { id: 'blocked', label: 'Bloqueada', description: 'Acesso suspenso ou cancelado.' },
]

const DEFAULT_FORM = {
  name: '',
  customSlug: '',
  description: '',
  category: 'Restaurante',
  ownerName: '',
  whatsapp1: '',
  whatsapp2: '',
  instagram: '',
  activeDays: ['Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  hoursOpen: '18:00',
  hoursClose: '23:30',
  minOrder: '0,00',
  deliveryFee: '5,00',
  freeDeliveryFrom: '',
  deliveryTime: '25-40 min',
  themeColor: DEFAULT_THEME,
  email: '',
  password: '',
  planId: 'professional',
  billingCycle: 'monthly',
  subscriptionStatus: 'trialing',
  isActive: true,
  isOpen: true,
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: 'Aracaju',
  state: 'SE',
}

function getPasswordStrength(password) {
  const value = String(password || '')
  let score = 0

  if (value.length >= 8) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1

  if (!value) return { level: 'empty', label: '', score: 0 }
  if (value.length < 8 || score <= 1) return { level: 'weak', label: 'Senha fraca', score }
  if (score <= 3) return { level: 'medium', label: 'Senha boa', score }
  return { level: 'strong', label: 'Senha forte', score }
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function slugify(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}


function formatCurrencyPreview(value) {
  return parseCurrency(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getPhoneDigitsBR(value) {
  let digits = String(value || '').replace(/\D/g, '')

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2)
  }

  return digits
}

function normalizePhoneBR(value) {
  const digits = getPhoneDigitsBR(value)

  if (!digits) return ''
  if (digits.length >= 10) return `55${digits}`

  return digits
}

function isValidPhoneBR(value) {
  const digits = getPhoneDigitsBR(value)

  if (digits.length === 10) return true
  if (digits.length === 11) return digits[2] === '9'

  return false
}

function sanitizeSocial(value) {
  return String(value || '')
    .replace('@', '')
    .trim()
}

function getOrigin() {
  if (typeof window === 'undefined') return ''

  return window.location.origin
}

function getPublicStorePath(slug) {
  return `${PUBLIC_STORE_BASE_PATH}/${slug}`.replace(/\/+/g, '/')
}

function getPublicStoreUrl(slug) {
  const origin = getOrigin()
  const path = getPublicStorePath(slug)

  return origin ? `${origin}${path}` : path
}

function validateImageFile(file) {
  if (!file) return ''

  const maxSizeMB = 4
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    return 'Use uma imagem em JPG, PNG ou WEBP.'
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    return `A imagem deve ter no máximo ${maxSizeMB}MB.`
  }

  return ''
}



async function uploadStoreAsset(file, folder) {
  if (!file) return null

  const uploadResult = await uploadImageToCloudinary(file, folder)

  return uploadResult?.secure_url || uploadResult?.url || null
}

function buildWeeklyOpeningHours(activeDays, open, close) {
  return DAYS_OF_WEEK.map((day) => {
    const enabled = activeDays.includes(day)

    return {
      day,
      days: [day],
      label: day,
      open: enabled ? open : '',
      close: enabled ? close : '',
      enabled,
      isOpen: enabled,
      closed: !enabled,
    }
  })
}

function buildOpeningHoursMap(activeDays, open, close) {
  return DAYS_OF_WEEK.reduce((acc, day) => {
    const enabled = activeDays.includes(day)

    acc[day] = {
      day,
      days: [day],
      label: day,
      open: enabled ? open : '',
      close: enabled ? close : '',
      enabled,
      isOpen: enabled,
      closed: !enabled,
    }

    return acc
  }, {})
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="min-w-0 rounded-[1.8rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={20} />
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-black text-[#111827]">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm font-medium leading-6 text-[#6b7280]">
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

function TextInput({ label, icon: Icon, className = '', inputClassName = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <div className="relative min-w-0">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        )}

        <input
          {...props}
          className={cn(
            'h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100',
            Icon && 'pl-11',
            inputClassName
          )}
        />
      </div>
    </div>
  )
}

function Textarea({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}

      <textarea
        {...props}
        className="min-h-[104px] w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-bold leading-6 text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
      />
    </div>
  )
}

function SelectInput({ label, className = '', children, ...props }) {
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

function ToggleCard({ title, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 transition hover:border-orange-100 hover:bg-orange-50/40">
      <div>
        <p className="text-sm font-black text-[#111827]">
          {title}
        </p>

        <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#f97316]"
      />
    </label>
  )
}

function PlanOption({ plan, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-[1.5rem] border p-4 text-left transition-all duration-300',
        active
          ? 'border-[#f97316] bg-orange-50 shadow-lg shadow-orange-600/10 ring-4 ring-orange-100'
          : 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md'
      )}
    >
      {plan.popular && (
        <span className="absolute right-4 top-4 rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Popular
        </span>
      )}

      <div className="flex gap-3 pr-16">
        <span
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            active
              ? 'border-[#f97316] bg-[#f97316] text-white'
              : 'border-gray-300 bg-white text-transparent'
          )}
        >
          <FiCheck size={13} />
        </span>

        <div className="min-w-0">
          <h3 className="font-black text-[#111827]">
            {plan.label}
          </h3>

          <p className="mt-1 text-sm font-black text-[#f97316]">
            {plan.price}
          </p>

          <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280]">
            {plan.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.features.map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-gray-100 bg-white px-3 py-1 text-[11px] font-black text-[#6b7280]"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  )
}

function StatusOption({ option, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition',
        active
          ? 'border-[#f97316] bg-orange-50 text-[#111827] ring-4 ring-orange-100'
          : 'border-gray-100 bg-[#f9fafb] text-[#6b7280] hover:border-orange-100 hover:bg-white'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border',
            active
              ? 'border-[#f97316] bg-[#f97316] text-white'
              : 'border-gray-300 text-transparent'
          )}
        >
          <FiCheck size={13} />
        </span>

        <p className="text-sm font-black">
          {option.label}
        </p>
      </div>

      <p className="mt-2 text-xs font-semibold leading-5">
        {option.description}
      </p>
    </button>
  )
}

function PreviewRow({ icon: Icon, children }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-[#f9fafb] p-3 text-sm font-bold text-[#111827]">
      <Icon className="shrink-0 text-[#f97316]" />
      <span className="min-w-0 break-all">
        {children}
      </span>
    </div>
  )
}

export default function CreateStorePage() {
  const navigate = useNavigate()

  const bannerInputRef = useRef(null)
  const logoInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [bannerPreview, setBannerPreview] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [formData, setFormData] = useState(DEFAULT_FORM)

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const previewSlug = useMemo(() => {
    return slugify(formData.customSlug || formData.name) || 'nome-da-loja'
  }, [formData.customSlug, formData.name])

  const publicStoreUrl = useMemo(() => getPublicStoreUrl(previewSlug), [previewSlug])

  const selectedPlan = useMemo(() => {
    return PLAN_OPTIONS.find((plan) => plan.id === formData.planId) || PLAN_OPTIONS[1]
  }, [formData.planId])

  const selectedSubscriptionStatus = useMemo(() => {
    return (
      SUBSCRIPTION_STATUS_OPTIONS.find((status) => status.id === formData.subscriptionStatus) ||
      SUBSCRIPTION_STATUS_OPTIONS[0]
    )
  }, [formData.subscriptionStatus])

  const handleImagePreview = useCallback((file, type) => {
    if (!file) return

    const validationError = validateImageFile(file)

    if (validationError) {
      setFormError(validationError)
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      if (type === 'banner') {
        setBannerFile(file)
        setBannerPreview(event.target.result)
      }

      if (type === 'logo') {
        setLogoFile(file)
        setLogoPreview(event.target.result)
      }
    }

    reader.readAsDataURL(file)
    setFormError('')
  }, [])

  const toggleDay = useCallback((day) => {
    setFormData((prev) => {
      const activeDays = prev.activeDays.includes(day)
        ? prev.activeDays.filter((item) => item !== day)
        : [...prev.activeDays, day]

      return {
        ...prev,
        activeDays: DAYS_OF_WEEK.filter((item) => activeDays.includes(item)),
      }
    })
  }, [])

  const handleCopyPreviewLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicStoreUrl)
      setSuccessMessage('Link copiado.')
      window.setTimeout(() => setSuccessMessage(''), 2200)
    } catch {
      setFormError('Não foi possível copiar o link.')
    }
  }, [publicStoreUrl])

  const handleCepBlur = useCallback(async () => {
    const cep = formData.cep.replace(/\D/g, '')

    if (cep.length !== 8) return

    try {
      setCepLoading(true)
      setFormError('')

      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()

      if (data?.erro) {
        setFormError('CEP não encontrado.')
        return
      }

      setFormData((prev) => ({
        ...prev,
        street: prev.street || data.logradouro || '',
        neighborhood: prev.neighborhood || data.bairro || '',
        city: prev.city || data.localidade || '',
        state: data.uf || prev.state,
      }))
    } catch {
      setFormError('Não foi possível buscar o CEP automaticamente.')
    } finally {
      setCepLoading(false)
    }
  }, [formData.cep])

  const validateForm = useCallback(() => {
    const baseSlug = slugify(formData.customSlug || formData.name)
    const normalizedEmail = formData.email.trim().toLowerCase()

    if (!formData.name.trim()) return 'Informe o nome da loja.'
    if (!baseSlug) return 'Informe um nome válido para gerar o link da loja.'
    if (!formData.ownerName.trim()) return 'Informe o nome do responsável.'
    if (!normalizedEmail) return 'Informe o e-mail de login do lojista.'
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return 'Informe um e-mail válido.'
    if (formData.password.length < 8) return 'A senha provisória precisa ter pelo menos 8 caracteres.'
    const strength = getPasswordStrength(formData.password)
    if (strength.level === 'weak') return 'Use uma senha provisória mais forte, misturando letras e números.'
    if (!formData.whatsapp1.trim()) return 'Informe o WhatsApp principal da loja.'
    if (!isValidPhoneBR(formData.whatsapp1)) return 'Informe um WhatsApp brasileiro válido com DDD.'
    if (formData.whatsapp2 && !isValidPhoneBR(formData.whatsapp2)) return 'Informe um WhatsApp secundário válido ou deixe em branco.'
    if (formData.activeDays.length === 0) return 'Selecione pelo menos um dia de funcionamento.'
    if (!formData.hoursOpen || !formData.hoursClose) return 'Informe o horário de abertura e fechamento.'

    return ''
  }, [formData])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      if (loading) return

      setFormError('')
      setSuccessMessage('')

      const validationError = validateForm()

      if (validationError) {
        setFormError(validationError)
        return
      }

      setLoading(true)

      try {
        const adminCreateStore = httpsCallable(functions, 'adminCreateStore')
        
        const payload = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          ownerName: formData.ownerName,
          whatsapp: formData.whatsapp1,
          customSlug: formData.customSlug,
          plan: formData.planId,
          billingCycle: formData.billingCycle,
          subscriptionStatus: formData.subscriptionStatus,
          isActive: formData.isActive,
          isOpen: formData.isOpen,
          category: formData.category,
          city: formData.city
        }

        const result = await adminCreateStore(payload)
        const data = result.data

        if (!data?.ok) {
          throw new Error('Erro ao criar loja.')
        }

        const finalSlug = data.storeSlug
        
        setSuccessMessage(`Loja criada! ID: ${data.storeId} | Link: ${data.publicUrl}`)

        window.setTimeout(() => {
          navigate('/admin')
        }, 1500)
      } catch (error) {
        console.error(error)
        const message = error?.message || 'Erro ao criar loja.'
        setFormError(message)
      } finally {
        setLoading(false)
      }
    },
    [bannerFile, formData, loading, logoFile, navigate, validateForm]
  )

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f9fafb] pb-24 text-[#111827] lg:pb-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid w-full max-w-7xl min-w-0 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:px-8"
      >
        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-[2.4rem] bg-[#111827] p-6 text-white shadow-xl shadow-gray-300/40 sm:p-8">
            <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15"
                >
                  <FiArrowLeft />
                  Voltar ao admin
                </button>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-orange-100">
                  <FiShield className="text-[#f97316]" />
                  Onboarding PratoBy
                </span>

                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Criar nova loja
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-gray-300 sm:text-base">
                  Configure identidade, acesso do lojista, plano, assinatura, horários, entrega
                  e compatibilidade com os pedidos em tempo real.
                </p>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 xl:w-[360px]">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-300">
                  <FiLink />
                  Link público
                </p>

                <div className="mt-3 flex min-w-0 items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-black/20 px-3 py-2 text-sm font-black text-white">
                    {publicStoreUrl.replace(/^https?:\/\//, '')}
                  </code>

                  <button
                    type="button"
                    onClick={handleCopyPreviewLink}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20"
                    aria-label="Copiar link"
                  >
                    <FiCopy />
                  </button>
                </div>

                <p className="mt-3 text-xs font-semibold leading-5 text-white/60">
                  Se o slug já existir, o sistema adiciona um sufixo automaticamente.
                </p>
              </div>
            </div>
          </div>

          {(formError || successMessage) && (
            <div
              className={cn(
                'rounded-[1.4rem] border p-4',
                formError
                  ? 'border-red-100 bg-red-50 text-red-700'
                  : 'border-orange-100 bg-orange-50 text-[#f97316]'
              )}
            >
              <div className="flex items-start gap-3">
                {formError ? (
                  <FiAlertCircle className="mt-0.5 shrink-0" />
                ) : (
                  <FiCheckCircle className="mt-0.5 shrink-0" />
                )}

                <p className="text-sm font-bold leading-6">
                  {formError || successMessage}
                </p>
              </div>
            </div>
          )}

          <Section
            icon={FiImage}
            title="Identidade visual"
            description="Imagens podem ser adicionadas depois nas configurações da loja."
          />

          <Section
            icon={FiShoppingBag}
            title="Dados da loja"
            description="Essas informações aparecem na vitrine pública e alimentam a gestão global do admin."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Nome da loja"
                icon={FiShoppingBag}
                required
                placeholder="Ex: Pizzaria do Adrian"
                value={formData.name}
                onChange={(event) => updateField('name', event.target.value)}
              />

              <TextInput
                label="Categoria"
                icon={FiGlobe}
                placeholder="Ex: Pizzaria, Hamburgueria..."
                value={formData.category}
                onChange={(event) => updateField('category', event.target.value)}
              />

              <Textarea
                label="Descrição curta"
                className="md:col-span-2"
                placeholder="Ex: As melhores pizzas artesanais da cidade, feitas no forno à lenha."
                value={formData.description}
                onChange={(event) => updateField('description', event.target.value)}
              />

              <TextInput
                label="Slug personalizado"
                icon={FiLink}
                placeholder="pizzaria-do-adrian"
                value={formData.customSlug}
                onChange={(event) => updateField('customSlug', slugify(event.target.value))}
              />

              <div>
                <Label>Cor principal da loja</Label>

                <div className="flex h-12 items-center gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] px-4">
                  <input
                    type="color"
                    value={formData.themeColor}
                    onChange={(event) => updateField('themeColor', event.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                  />

                  <span className="text-sm font-black text-[#111827]">
                    {formData.themeColor}
                  </span>

                  <button
                    type="button"
                    onClick={() => updateField('themeColor', DEFAULT_THEME)}
                    className="ml-auto text-xs font-black text-[#f97316]"
                  >
                    Usar PratoBy
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon={FiCreditCard}
            title="Plano e assinatura"
            description="Define como a loja aparece na distribuição de planos do AdminDashboard."
          >
            <div className="grid gap-3 lg:grid-cols-3">
              {PLAN_OPTIONS.map((plan) => (
                <PlanOption
                  key={plan.id}
                  plan={plan}
                  active={formData.planId === plan.id}
                  onClick={() => updateField('planId', plan.id)}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                <StatusOption
                  key={option.id}
                  option={option}
                  active={formData.subscriptionStatus === option.id}
                  onClick={() => updateField('subscriptionStatus', option.id)}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {BILLING_CYCLE_OPTIONS.map((option) => (
                <StatusOption
                  key={option.id}
                  option={option}
                  active={formData.billingCycle === option.id}
                  onClick={() => updateField('billingCycle', option.id)}
                />
              ))}
            </div>
          </Section>

          <Section
            icon={FiUser}
            title="Responsável e acesso"
            description="Cria o usuário lojista com permissão merchant sem derrubar a sessão do admin."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Nome do responsável"
                icon={FiUser}
                required
                placeholder="Ex: Adrian Costa"
                value={formData.ownerName}
                onChange={(event) => updateField('ownerName', event.target.value)}
              />

              <TextInput
                label="E-mail de login"
                icon={FiMail}
                type="email"
                required
                placeholder="lojista@email.com"
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
              />

              <div className="md:col-span-2">
                <Label>Senha inicial</Label>

                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] pl-11 pr-12 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#111827]"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2 px-1">
                    <div className="flex gap-1 h-1.5 w-full max-w-[200px] mb-1">
                      <div className={`h-full flex-1 rounded-full ${getPasswordStrength(formData.password).score >= 1 ? (getPasswordStrength(formData.password).level === 'weak' ? 'bg-red-500' : getPasswordStrength(formData.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${getPasswordStrength(formData.password).score >= 2 ? (getPasswordStrength(formData.password).level === 'weak' ? 'bg-red-500' : getPasswordStrength(formData.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${getPasswordStrength(formData.password).score >= 3 ? (getPasswordStrength(formData.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${getPasswordStrength(formData.password).score >= 4 ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                    <p className={`text-[10px] font-bold ${getPasswordStrength(formData.password).level === 'weak' ? 'text-red-600' : getPasswordStrength(formData.password).level === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                      {getPasswordStrength(formData.password).label}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section
            icon={FiPhone}
            title="Contato e redes sociais"
            description="O WhatsApp principal será usado no atendimento, pedidos e ações rápidas."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="WhatsApp principal"
                icon={FiPhone}
                required
                placeholder="(79) 99999-9999"
                value={formData.whatsapp1}
                onChange={(event) => updateField('whatsapp1', event.target.value)}
              />

              <TextInput
                label="WhatsApp secundário"
                icon={FiPhone}
                placeholder="Opcional"
                value={formData.whatsapp2}
                onChange={(event) => updateField('whatsapp2', event.target.value)}
              />

              <TextInput
                label="Instagram"
                icon={FiInstagram}
                placeholder="@pizzariadoadrian"
                value={formData.instagram}
                onChange={(event) => updateField('instagram', event.target.value)}
                className="md:col-span-2"
              />
            </div>
          </Section>

          <Section
            icon={FiClock}
            title="Funcionamento e entrega"
            description="Defina dias, horários, entrega padrão, pedido mínimo e status inicial da loja."
          >
            <div className="space-y-5">
              <div>
                <Label>Dias de funcionamento</Label>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = formData.activeDays.includes(day)

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          'rounded-2xl px-2 py-3 text-xs font-black transition',
                          active
                            ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
                            : 'bg-[#f9fafb] text-[#6b7280] hover:bg-orange-50 hover:text-[#f97316]'
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Abre às"
                  type="time"
                  required
                  value={formData.hoursOpen}
                  onChange={(event) => updateField('hoursOpen', event.target.value)}
                />

                <TextInput
                  label="Fecha às"
                  type="time"
                  required
                  value={formData.hoursClose}
                  onChange={(event) => updateField('hoursClose', event.target.value)}
                />

                <TextInput
                  label="Tempo médio"
                  icon={FiTruck}
                  placeholder="25-40 min"
                  value={formData.deliveryTime}
                  onChange={(event) => updateField('deliveryTime', event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Pedido mínimo"
                  icon={FiDollarSign}
                  placeholder="0,00"
                  value={formData.minOrder}
                  onChange={(event) => updateField('minOrder', event.target.value)}
                />

                <TextInput
                  label="Taxa de entrega padrão"
                  icon={FiTruck}
                  placeholder="5,00"
                  value={formData.deliveryFee}
                  onChange={(event) => updateField('deliveryFee', event.target.value)}
                />

                <TextInput
                  label="Frete grátis a partir de"
                  icon={FiZap}
                  placeholder="Opcional"
                  value={formData.freeDeliveryFrom}
                  onChange={(event) => updateField('freeDeliveryFrom', event.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ToggleCard
                  title="Loja aberta após criar"
                  description="Permite receber pedidos imediatamente."
                  checked={formData.isOpen}
                  onChange={(checked) => updateField('isOpen', checked)}
                />

                <ToggleCard
                  title="Loja ativa no sistema"
                  description="Desative para bloquear temporariamente no onboarding."
                  checked={formData.isActive}
                  onChange={(checked) => updateField('isActive', checked)}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={FiMapPin}
            title="Localização"
            description="Esses dados ajudam na identificação da loja. As taxas por bairro podem ser refinadas depois."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="CEP"
                placeholder="49000-000"
                value={formData.cep}
                onChange={(event) => updateField('cep', event.target.value)}
                onBlur={handleCepBlur}
              />

              <TextInput
                label="Rua"
                placeholder={cepLoading ? 'Buscando CEP...' : 'Rua das Flores'}
                value={formData.street}
                onChange={(event) => updateField('street', event.target.value)}
              />

              <TextInput
                label="Número"
                placeholder="123"
                value={formData.number}
                onChange={(event) => updateField('number', event.target.value)}
              />

              <TextInput
                label="Bairro"
                placeholder="Centro"
                value={formData.neighborhood}
                onChange={(event) => updateField('neighborhood', event.target.value)}
              />

              <TextInput
                label="Complemento"
                placeholder="Loja A, sala 2..."
                value={formData.complement}
                onChange={(event) => updateField('complement', event.target.value)}
              />

              <TextInput
                label="Cidade"
                placeholder="Aracaju"
                value={formData.city}
                onChange={(event) => updateField('city', event.target.value)}
              />

              <SelectInput
                label="Estado"
                value={formData.state}
                onChange={(event) => updateField('state', event.target.value)}
              >
                {ESTADOS_BR.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </SelectInput>
            </div>
          </Section>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-[#f97316] px-6 py-4 text-base font-black text-white shadow-xl shadow-orange-600/20 transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <FiLoader className="animate-spin" />
                Criando loja...
              </>
            ) : (
              <>
                <FiSave />
                Criar loja no PratoBy
              </>
            )}
          </button>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
          <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-2xl shadow-gray-200/70">
            <div
              className="relative h-40 bg-gradient-to-br from-[#111827] to-[#f97316]"
              style={{
                background: bannerPreview
                  ? undefined
                  : `linear-gradient(135deg, #111827, ${formData.themeColor || DEFAULT_THEME})`,
              }}
            >
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt="Prévia do banner"
                  className="h-full w-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-black/10" />
            </div>

            <div className="relative p-5">
              <div className="-mt-14 flex items-end gap-4">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] border-4 border-white bg-white shadow-xl"
                  style={{ color: formData.themeColor || DEFAULT_THEME }}
                >
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Prévia da logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiShoppingBag size={34} />
                  )}
                </div>

                <div className="min-w-0 pb-2">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-black',
                      formData.isOpen ? 'bg-orange-50 text-[#f97316]' : 'bg-red-50 text-red-600'
                    )}
                  >
                    {formData.isOpen ? 'Aberta' : 'Fechada'}
                  </span>

                  <p className="mt-2 truncate text-xs font-black text-[#6b7280]">
                    {selectedPlan.label} · {selectedSubscriptionStatus.label}
                  </p>
                </div>
              </div>

              <h2 className="mt-4 break-words text-2xl font-black tracking-tight text-[#111827]">
                {formData.name || 'Nome da loja'}
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-[#6b7280]">
                {formData.description || 'Descrição curta da loja aparecerá aqui para convencer o cliente.'}
              </p>

              <div className="mt-5 grid gap-3">
                <PreviewRow icon={FiLink}>{publicStoreUrl.replace(/^https?:\/\//, '')}</PreviewRow>
                <PreviewRow icon={FiClock}>{formData.hoursOpen} às {formData.hoursClose}</PreviewRow>
                <PreviewRow icon={FiTruck}>{formData.deliveryTime || '25-40 min'}</PreviewRow>
                <PreviewRow icon={FiDollarSign}>Mínimo: {formatCurrencyPreview(formData.minOrder)}</PreviewRow>
                <PreviewRow icon={FiTruck}>Entrega padrão: {formatCurrencyPreview(formData.deliveryFee)}</PreviewRow>
              </div>

              <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-[#f97316]">
                  <FiCheckCircle />
                  Pronto para white-label
                </p>

                <p className="mt-2 text-xs font-semibold leading-5 text-orange-800">
                  A loja será criada com storeSlug, storeId, storeKeys, owner, plano,
                  assinatura, centavos financeiros e compatibilidade com links novos e antigos.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
              <FiImage className="text-[#f97316]" />
              Cloudinary
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-[#6b7280]">
              Banner e logo são enviados para o Cloudinary. A loja também pode ser criada sem imagens e editada depois.
            </p>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-[#111827]">
              <FiShield className="text-[#f97316]" />
              Compatibilidade admin
            </p>

            <ul className="mt-3 space-y-2 text-xs font-bold leading-5 text-[#6b7280]">
              <li className="flex gap-2"><FiCheck className="mt-1 shrink-0 text-[#f97316]" /> storeSlug e slug sincronizados</li>
              <li className="flex gap-2"><FiCheck className="mt-1 shrink-0 text-[#f97316]" /> Valores salvos em reais e centavos</li>
              <li className="flex gap-2"><FiCheck className="mt-1 shrink-0 text-[#f97316]" /> Plano e assinatura para distribuição</li>
              <li className="flex gap-2"><FiCheck className="mt-1 shrink-0 text-[#f97316]" /> Usuário merchant vinculado por storeIds</li>
            </ul>
          </div>
        </aside>
      </form>
    </main>
  )
}


