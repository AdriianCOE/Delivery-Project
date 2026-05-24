import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  signInWithPopup,
  updateProfile,
  signOut,
  sendEmailVerification,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions, googleProvider } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { PLAN_OPTIONS } from '../../utils/planCatalog'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiUser,
  FiZap,
} from 'react-icons/fi'

// ─────────────────────────────────────────────────────────────
// DADOS DOS PLANOS
// ─────────────────────────────────────────────────────────────

const PLANS = PLAN_OPTIONS.map((plan) => ({
  ...plan,
  price: plan.priceMonthly,
  priceAnnual: plan.equivalentMonthly,
  popular: Boolean(plan.popular || plan.highlight),
  features: plan.features.filter((feature) => feature !== '14 dias grátis inclusos'),
}))

const SEGMENTS = [
  'Hamburgueria',
  'Pizzaria',
  'Restaurante',
  'Lanchonete',
  'Açaí / Sorvetes',
  'Sushi / Japonês',
  'Padaria / Confeitaria',
  'Marmita / Comida caseira',
  'Bar / Petiscos',
  'Outro',
]

const TERMS_VERSION = '2026-05-24'
const PRIVACY_VERSION = '2026-05-24'
const TERMS_REQUIRED_MESSAGE = 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.'

// ─────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES
// ─────────────────────────────────────────────────────────────

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

function getBrazilianPhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55')) {
    return digits.slice(2, 13)
  }
  return digits.slice(0, 11)
}

function formatPhoneBR(value) {
  const truncated = getBrazilianPhoneDigits(value)

  if (truncated.length === 0) return ''
  if (truncated.length <= 2) return `(${truncated}`
  if (truncated.length <= 6) return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`
  if (truncated.length <= 10) return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`
  return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`
}

function isValidBrazilianMobilePhone(value) {
  const digits = getBrazilianPhoneDigits(value)
  if (digits.length !== 11) return false
  if (digits[0] === '0' || digits[2] !== '9') return false

  const localNumber = digits.slice(2)
  const localTail = localNumber.slice(1)
  const obviousLocalNumbers = new Set([
    '999999999',
    '999111111',
    '900000000',
    '911111111',
  ])

  if (/^(\d)\1+$/.test(digits)) return false
  if (/(\d)\1{4,}/.test(localNumber)) return false
  if (obviousLocalNumbers.has(localNumber)) return false
  return !['12345678', '87654321', '11111111', '00000000'].some((pattern) => localTail.includes(pattern))
}

// ─────────────────────────────────────────────────────────────
// ANIMAÇÕES (espelhando LoginPage)
// ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const floatAnimation = {
  animate: {
    y: [0, -14, 0],
    scale: [1, 1.03, 1],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
}

// ─────────────────────────────────────────────────────────────
// LOGO (idêntica ao LoginPage)
// ─────────────────────────────────────────────────────────────

function PratoByLogo({ dark = false, compact = false }) {
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Ir para início">
      <img
        src="/icons/icon-192.png"
        alt="PratoBy"
        className={`${
          compact ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-[1.35rem]'
        } object-cover shadow-lg shadow-orange-600/20 ring-1 ring-black/5 transition duration-300 group-hover:scale-105`}
      />
      <div className="min-w-0 leading-none">
        <p
          className={`font-black tracking-tighter ${
            compact ? 'text-xl' : 'text-2xl'
          } ${dark ? 'text-white' : 'text-[#111827]'}`}
        >
          Prato<span className="text-[#f97316]">By</span>
        </p>
        <p
          className={`mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] ${
            dark ? 'text-white/55' : 'text-[#9ca3af]'
          }`}
        >
          Cardápio digital e delivery
        </p>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// HEADER MOBILE (idêntico ao LoginPage)
// ─────────────────────────────────────────────────────────────

function SignupMobileHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl lg:hidden"
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
        <span className="block h-full w-full rounded-full bg-[#f97316]" />
      </span>
      <div className="mx-auto flex h-16 sm:h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <PratoByLogo compact />
        <Link
          to="/login"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 sm:px-4 text-xs sm:text-sm font-black text-[#111827] shadow-sm active:scale-95"
          aria-label="Já tenho conta"
        >
          <FiArrowLeft size={14} className="hidden sm:block" />
          <span className="hidden sm:block">Já tenho conta</span>
          <span className="sm:hidden">Entrar</span>
        </Link>
      </div>
    </motion.header>
  )
}

// ─────────────────────────────────────────────────────────────
// INPUT FIELD (idêntico ao LoginPage)
// ─────────────────────────────────────────────────────────────

function InputField({ label, icon: Icon, rightElement, className = '', ...props }) {
  return (
    <label className={`block ${className}`} htmlFor={props.id}>
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={17}
          />
        )}
        <input
          {...props}
          className={`h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 ${
            Icon ? 'pl-11' : ''
          } ${rightElement ? 'pr-12' : ''}`}
        />
        {rightElement}
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────
// SELECT FIELD
// ─────────────────────────────────────────────────────────────

function SelectField({ label, icon: Icon, className = '', ...props }) {
  return (
    <label className={`block ${className}`} htmlFor={props.id}>
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={17}
          />
        )}
        <select
          {...props}
          className={`h-12 w-full appearance-none rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] shadow-sm outline-none transition focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-70 ${
            Icon ? 'pl-11' : ''
          }`}
        >
          {props.children}
        </select>
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD DO PLANO
// ─────────────────────────────────────────────────────────────

function PlanCard({ plan, selected, cycle, onSelect }) {
    const price = cycle === 'annual' ? plan.priceAnnual : plan.price
  
    return (
      <motion.button
        type="button"
        layout
        onClick={() => onSelect(plan.id)}
        aria-label={`Selecionar plano ${plan.name}`}
        aria-pressed={selected}
        whileTap={{ scale: 0.985 }}
        animate={{
          y: selected ? -3 : 0,
          scale: selected ? 1.015 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 360,
          damping: 26,
        }}
        className={[
          'group relative w-full cursor-pointer rounded-[1.5rem] border-2 p-4 text-left transition-colors duration-200 sm:p-5',
          selected
            ? 'border-[#f97316] bg-orange-50/70 shadow-lg shadow-orange-100'
            : 'border-gray-100 bg-white shadow-sm hover:border-orange-200 hover:shadow-md',
        ].join(' ')}
      >
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-br from-orange-100/80 via-white/10 to-transparent"
            />
          )}
        </AnimatePresence>
  
        {plan.popular && (
          <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-black text-white shadow-md shadow-orange-500/30">
            <FiStar size={10} />
            Mais popular
          </span>
        )}
  
        <motion.span
          animate={{
            backgroundColor: selected ? '#f97316' : '#ffffff',
            borderColor: selected ? '#f97316' : '#e5e7eb',
          }}
          transition={{ duration: 0.18 }}
          className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2"
        >
          <AnimatePresence>
            {selected && (
              <motion.span
                initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              >
                <FiCheck size={11} className="text-white" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
  
        <div className="relative z-10">
          <p className="pr-7 text-sm font-black text-[#111827]">{plan.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">
            {plan.description}
          </p>
  
          <div className="mt-3 flex items-baseline gap-1">
            <motion.span
              key={`${plan.id}-${cycle}-price`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-black text-[#111827]"
            >
              R$ {price}
            </motion.span>
  
            <span className="text-xs font-bold text-[#9ca3af]">
              {cycle === 'annual' ? '/mês no anual' : '/mês'}
            </span>
          </div>
  
          <AnimatePresence mode="wait">
            {cycle === 'annual' && (
              <motion.span
                key="annual-badge"
                initial={{ opacity: 0, y: 5, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-[#f97316]"
              >
                <FiZap size={9} />
                2 meses grátis
              </motion.span>
            )}
          </AnimatePresence>
  
          <ul className="mt-4 space-y-1.5">
            {plan.features.map((feat, idx) => (
              <li
                key={feat}
                className={`flex items-start gap-2 text-xs font-semibold text-[#6b7280] ${idx >= 3 ? 'hidden sm:flex' : ''}`}
              >
                <FiCheckCircle
                  size={13}
                  className={`mt-0.5 shrink-0 transition-colors ${
                    selected ? 'text-[#f97316]' : 'text-gray-400'
                  }`}
                />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.button>
    )
  }

// ─────────────────────────────────────────────────────────────
// CARD RESUMO
// ─────────────────────────────────────────────────────────────

function SummaryCard({ plan, cycle }) {
    const price = cycle === 'annual' ? plan.priceAnnual : plan.price
    const cycleLabel = cycle === 'annual' ? 'Anual' : 'Mensal'
  
    return (
      <motion.div
        layout
        className="overflow-hidden rounded-[1.5rem] border border-orange-100/80 bg-orange-50/40 p-5"
      >
        <p className="mb-4 text-xs font-black uppercase tracking-widest text-[#9ca3af]">
          Resumo do plano
        </p>
  
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${plan.id}-${cycle}`}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-black text-[#111827]">
                  Plano {plan.name}
                </p>
                <p className="text-xs font-semibold text-[#6b7280]">
                  {plan.description}
                </p>
              </div>
  
              <div className="text-left sm:text-right">
                <p className="text-xl font-black text-[#111827]">
                  R$ {price}
                  <span className="text-xs font-bold text-[#9ca3af]">
                    {cycle === 'annual' ? '/mês no anual' : '/mês'}
                  </span>
                </p>
                <p className="text-[11px] font-bold text-[#f97316]">
                  {cycleLabel}
                </p>
              </div>
            </div>
  
            <div className="mt-4 space-y-2 border-t border-orange-100 pt-4">
              {[
                { icon: FiCheckCircle, text: '14 dias grátis inclusos' },
                { icon: FiCheckCircle, text: '0% de comissão por pedido' },
                { icon: FiCheckCircle, text: 'Pagamento seguro via Asaas' },
              ].map(({ icon: Icon, text }, index) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.035 }}
                  className="flex items-center gap-2 text-xs font-bold text-[#374151]"
                >
                  <Icon size={13} className="shrink-0 text-[#f97316]" />
                  {text}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    )
  }

// ─────────────────────────────────────────────────────────────
// ÍCONE DO GOOGLE (SVG inline — react-icons/fi não tem)
// ─────────────────────────────────────────────────────────────

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// ALERT BOX (idêntico ao LoginPage)
// ─────────────────────────────────────────────────────────────

function AlertBox({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700"
    >
      <div className="flex items-start gap-3">
        <FiAlertCircle className="mt-0.5 shrink-0" size={17} />
        <span>{children}</span>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUserData } = useAuth()

  const [selectedPlanId, setSelectedPlanId] = useState(() => {
    const plan = searchParams.get('plan')
    const validPlans = ['essential', 'professional', 'premium']
    return validPlans.includes(plan) ? plan : 'professional'
  })

  const [billingCycle, setBillingCycle] = useState(() => {
    const cycle = searchParams.get('cycle')
    const validCycles = ['monthly', 'annual']
    return validCycles.includes(cycle) ? cycle : 'monthly'
  })
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    storeName: '',
    segment: '',
    city: '',
    password: '',
    confirmPassword: '',
  })
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [termsModalSubmitting, setTermsModalSubmitting] = useState(false)

  // ── Derivados ──────────────────────────────
  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1],
    [selectedPlanId]
  )

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.name.trim() &&
          form.email.trim() &&
          form.whatsapp.trim() &&
          form.storeName.trim() &&
          form.password.trim() &&
          form.confirmPassword.trim() &&
          getPasswordStrength(form.password).level !== 'weak' &&
          !isLoading
      ),
    [form, isLoading]
  )

  // ── Handlers ──────────────────────────────
  const getFriendlyError = (error) => {
    const code = error?.code || ''
    if (code === 'auth/email-already-in-use') return (
      <span className="flex items-center gap-1 flex-wrap">
        Este e-mail já está em uso. <Link to="/login" className="underline hover:text-red-900 transition">Entre com sua conta</Link> ou use outro e-mail.
      </span>
    )
    if (code === 'auth/invalid-email') return 'Digite um e‑mail válido.'
    if (code === 'auth/weak-password') return 'Use uma senha com ao menos 6 caracteres.'
    if (code === 'auth/popup-closed-by-user') return 'Cadastro com Google cancelado.'
    if (code === 'auth/network-request-failed') return 'Falha de conexão. Verifique sua internet.'
    if (error?.message?.includes('signup/existing-account'))
      return 'Esta conta já possui um cadastro pendente. Use o login para continuar.'
    if (error?.message?.includes('signup/terms-required'))
      return TERMS_REQUIRED_MESSAGE
    if (error?.message?.includes('signup/account-already-has-store'))
      return 'Esta conta já possui uma loja. Entre pelo login.'
    if (error?.message?.includes('permission-denied'))
      return 'Acesso negado. Contate o suporte.'
    return 'Ocorreu um erro ao criar a conta. Tente novamente.'
  }

  const buildComplianceFields = useCallback(() => {
    const fields = {
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      marketingOptIn: Boolean(marketingOptIn),
    }

    if (marketingOptIn) {
      fields.marketingOptInAt = serverTimestamp()
      fields.marketingOptInSource = 'signup'
    }

    return fields
  }, [marketingOptIn])

  const saveUserDocument = useCallback(async (user, authProvider, displayNameOverride) => {
    if (!termsAccepted) {
      throw new Error('signup/terms-required')
    }

    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      // Document already exists, prevent overwrite
      throw new Error('signup/existing-account');
    }
    const finalDisplayName = displayNameOverride || form.name.trim();
    await setDoc(userRef, {
      uid: user.uid,
      role: 'merchant',
      email: user.email,
      displayName: finalDisplayName,
      phone: getBrazilianPhoneDigits(form.whatsapp),
      phoneVerified: false,
      plan: selectedPlanId,
      billingCycle,
      subscriptionStatus: 'pending_checkout',
      onboardingStatus: 'phone_pending',
      storeId: null,
      storeIds: [],
      storeKeys: [],
      signup: {
        storeName: form.storeName || '',
        segment: form.segment || '',
        city: form.city || '',
        source: 'signup_page',
        authProvider,
      },
      ...buildComplianceFields(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    if (refreshUserData) {
      await refreshUserData()
    }
  }, [billingCycle, buildComplianceFields, form, marketingOptIn, refreshUserData, selectedPlanId, termsAccepted])

  const handleField = useCallback((field) => (e) => {
    let value = e.target.value
    if (field === 'whatsapp') {
      value = formatPhoneBR(value)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }, [])

  const handlePlanSelect = useCallback((planId) => {
    setSelectedPlanId(planId)
  }, [])

  const handleCycleChange = useCallback((cycle) => {
    setBillingCycle(cycle)
  }, [])

  const handleAcceptLatestTerms = useCallback(async () => {
    if (termsModalSubmitting) return

    setTermsModalSubmitting(true)
    setFormError('')
    try {
      const acceptLatestTerms = httpsCallable(functions, 'acceptLatestTerms')
      await acceptLatestTerms()
      if (refreshUserData) {
        await refreshUserData()
      }
      setTermsModalOpen(false)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      console.error(error)
      setFormError('Não foi possível registrar o aceite agora. Tente novamente.')
    } finally {
      setTermsModalSubmitting(false)
    }
  }, [navigate, refreshUserData, termsModalSubmitting])

  const handleCloseTermsModal = useCallback(async () => {
    if (termsModalSubmitting) return
    setTermsModalOpen(false)
    try {
      await signOut(auth)
    } catch (error) {
      console.warn('[Signup] Não foi possível encerrar a sessão após recusar termos.', error)
    }
    setFormError(TERMS_REQUIRED_MESSAGE)
  }, [termsModalSubmitting])

  const validateGoogleProfileFields = useCallback(() => {
    if (!termsAccepted) return TERMS_REQUIRED_MESSAGE
    if (!form.whatsapp.trim()) return 'Preencha seu WhatsApp primeiro.'
    if (!isValidBrazilianMobilePhone(form.whatsapp)) {
      return 'Informe um celular válido com DDD e 9 dígitos antes de continuar.'
    }
    if (!form.storeName.trim()) return 'Preencha o nome da sua loja primeiro.'
    return ''
  }, [form.storeName, form.whatsapp, termsAccepted])

  const handleGoogleSignup = useCallback(async () => {
    setFormError('')

    setIsLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const isNewUser = Boolean(getAdditionalUserInfo(result)?.isNewUser)
      const userRef = doc(db, 'users', user.uid)
      const existingProfile = await getDoc(userRef)

      if (existingProfile.exists()) {
        const profile = existingProfile.data() || {}
        if (
          profile.termsAccepted === true &&
          profile.termsVersion === TERMS_VERSION &&
          profile.privacyVersion === PRIVACY_VERSION
        ) {
          if (refreshUserData) {
            await refreshUserData()
          }
          navigate('/dashboard', { replace: true })
          return
        }

        setTermsModalOpen(true)
        return
      }

      const validationError = validateGoogleProfileFields()
      if (validationError) {
        if (isNewUser) {
          await deleteUser(user).catch(() => {})
        }
        await signOut(auth)
        setFormError(validationError)
        return
      }

      try {
        await saveUserDocument(user, 'google', user.displayName)
        navigate('/onboarding', {
          replace: true,
          state: { accountCreated: true, displayName: user.displayName || '' },
        })
      } catch (docError) {
        // Roll back created Google account if doc creation fails
        if (isNewUser) {
          await deleteUser(user).catch(() => {})
        }
        await signOut(auth);
        setFormError(getFriendlyError(docError));
      }
    } catch (error) {
      console.error(error)
      setFormError(getFriendlyError(error))
      try { await signOut(auth) } catch (e) {}
    } finally {
      setIsLoading(false)
    }
  }, [navigate, refreshUserData, saveUserDocument, validateGoogleProfileFields])

  const handleContinue = useCallback(
    async (e) => {
      e.preventDefault()
      if (!form.name.trim()) return setFormError('Informe seu nome completo.')
      if (!form.email.trim()) return setFormError('Informe seu e-mail.')
      if (!/\S+@\S+\.\S+/.test(form.email)) return setFormError('Digite um e-mail válido.')
      if (!form.whatsapp.trim()) return setFormError('Informe seu WhatsApp.')
      if (!isValidBrazilianMobilePhone(form.whatsapp)) {
        return setFormError('Informe um celular válido com DDD e 9 dígitos.')
      }
      if (!form.storeName.trim()) return setFormError('Informe o nome da sua loja.')
      const strength = getPasswordStrength(form.password)
      if (strength.level === 'weak') {
        return setFormError('Use uma senha mais forte, com pelo menos 8 caracteres, letras e números.')
      }
      if (form.password !== form.confirmPassword) return setFormError('As senhas não coincidem.')
      if (!termsAccepted) return setFormError(TERMS_REQUIRED_MESSAGE)

      setIsLoading(true)
      try {
        const result = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        const user = result.user;
        await updateProfile(user, { displayName: form.name.trim() });
        try {
          await saveUserDocument(user, 'password', form.name.trim());
          try {
            if (!user.emailVerified) {
              await sendEmailVerification(user)
            }
          } catch (emailError) {
            console.warn('[Signup] Não foi possível enviar verificação de e-mail.', emailError)
          }
          navigate('/onboarding', {
            replace: true,
            state: { accountCreated: true, displayName: form.name.trim() },
          })
        } catch (docError) {
          // Roll back auth account if user document creation fails
          await deleteUser(user).catch(() => {});
          await signOut(auth);
          setFormError(getFriendlyError(docError));
        }
      } catch (error) {
        console.error(error)
        setFormError(getFriendlyError(error))
        try { await signOut(auth) } catch (e) {}
      } finally {
        setIsLoading(false)
      }
    },
    [form, selectedPlanId, billingCycle, navigate, saveUserDocument, termsAccepted]
  )

  // ─────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-dvh bg-[#f9fafb] pt-16 sm:pt-[68px] text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0 overflow-x-hidden">
      <SignupMobileHeader />

      {/* Blobs flutuantes — idêntico ao LoginPage */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          variants={floatAnimation}
          animate="animate"
          className="absolute -left-40 top-20 h-[28rem] w-[28rem] rounded-full bg-orange-100/80 blur-3xl"
        />
        <motion.div
          variants={floatAnimation}
          animate="animate"
          transition={{ delay: 1 }}
          className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-orange-200/50 blur-3xl"
        />
        <motion.div
          variants={floatAnimation}
          animate="animate"
          transition={{ delay: 2 }}
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl"
        />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">

        {/* ── PAINEL ESQUERDO (desktop only) ───────────────── */}
        <section className="relative hidden overflow-hidden bg-[#111827] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#f97316]/25 blur-3xl" />
            <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#fb923c]/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_32rem)]" />
          </div>

          {/* Topo */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <PratoByLogo dark />
            <Link
              to="/login"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur transition hover:bg-white hover:text-[#111827]"
            >
              Voltar ao login
            </Link>
          </div>

          {/* Centro */}
          <div className="relative z-10 py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-orange-100 backdrop-blur">
              <FiShield className="text-[#f97316]" />
              Comece em minutos, sem comissão por pedido
            </span>

            <h1 className="mt-8 text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">
              Sua loja online,
              <span className="block text-[#f97316]">sem comissão.</span>
            </h1>

            <p className="mt-6 max-w-sm text-lg font-medium leading-8 text-gray-300">
              Cardápio digital, pedidos em tempo real e link exclusivo para divulgar onde quiser.
              Sem marketplace, sem comissão por venda.
            </p>

            <div className="mt-9 grid gap-3 text-sm font-bold text-gray-200 sm:grid-cols-2">
              {[
                '14 dias grátis',
                '0% de comissão por pedido',
                'Link próprio da loja',
                'Suporte no WhatsApp',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <FiCheckCircle className="shrink-0 text-[#f97316]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé do painel esquerdo */}
          <div className="relative z-10 rounded-[1.75rem] border border-white/10 bg-white/[0.08] p-5 backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] shadow-lg shadow-orange-950/20">
                <FiShoppingBag size={20} />
              </div>
              <div>
                <p className="font-black">Já tem conta?</p>
                <p className="mt-1 text-sm font-medium leading-6 text-gray-300">
                  Acesse o painel e gerencie pedidos, cardápio e configurações da sua loja.
                </p>
                <Link
                  to="/login"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-[#f97316] transition hover:text-orange-400"
                >
                  Entrar no painel
                  <FiArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── PAINEL DIREITO — conteúdo principal ─────────── */}
        <section className="flex flex-col justify-start px-4 pb-10 pt-5 sm:px-6 lg:overflow-y-auto lg:max-h-dvh lg:px-8 lg:py-10 xl:px-12">
          <div className="mx-auto w-full max-w-md sm:max-w-2xl min-w-0">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >

              {/* Hero mobile compacto */}
              <div className="mb-6 rounded-2xl bg-orange-50/50 p-4 border border-orange-100 sm:hidden">
                <h2 className="text-xl font-black text-[#111827] leading-tight">Crie sua loja em minutos</h2>
                <p className="mt-1 text-xs font-bold text-[#6b7280]">Teste grátis por 14 dias. Sem comissão por pedido.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#f97316] px-2 py-1 text-[10px] font-black text-white">14 dias grátis</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-200 px-2 py-1 text-[10px] font-black text-[#111827]">Sem comissão</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-200 px-2 py-1 text-[10px] font-black text-[#111827]">Link próprio</span>
                </div>
              </div>

              {/* Cabeçalho da seção desktop (hide on mobile) */}
              <motion.div variants={fadeUp} className="mb-7 hidden sm:block">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                  <FiZap size={11} />
                  Etapa 1 de 2 — Conta e plano
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  Crie sua loja online
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                  Escolha um plano, configure sua conta e comece com 14 dias grátis. Seu teste será ativado após a confirmação.
                </p>
              </motion.div>

              {/* Toggle ciclo de cobrança */}
              <motion.div variants={fadeUp} className="mb-6">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-[#6b7280]">
                  Ciclo de cobrança
                </p>
                <div className="grid grid-cols-2 w-full sm:inline-flex sm:w-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                  {[
                    { value: 'monthly', label: 'Mensal' },
                    { value: 'annual', label: 'Anual' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleCycleChange(opt.value)}
                      aria-pressed={billingCycle === opt.value}
                      className={[
                        'relative flex items-center justify-center rounded-[1rem] px-2 sm:px-4 py-2 text-sm font-black transition-all duration-200 min-w-0',
                        billingCycle === opt.value
                          ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/25'
                          : 'text-[#6b7280] hover:text-[#111827]',
                      ].join(' ')}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.value === 'annual' && billingCycle !== 'annual' && (
                        <span className="ml-1.5 shrink-0 inline-block rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-black text-[#f97316]">
                          -17%
                        </span>
                      )}
                      {opt.value === 'annual' && billingCycle === 'annual' && (
                        <span className="ml-1.5 shrink-0 inline-block rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-black text-white">
                          2 meses grátis
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Cards dos planos */}
              <motion.div variants={fadeUp} className="mb-7">
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-[#6b7280]">
                  Escolha seu plano
                </p>

                {/* Mobile: Lista vertical empilhada */}
                <div className="grid gap-3 sm:hidden pt-2">
                  {PLANS.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      selected={selectedPlanId === plan.id}
                      cycle={billingCycle}
                      onSelect={handlePlanSelect}
                    />
                  ))}
                </div>

                {/* Desktop: grid 3 colunas */}
                <div className="hidden grid-cols-3 gap-4 sm:grid">
                  {PLANS.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      selected={selectedPlanId === plan.id}
                      cycle={billingCycle}
                      onSelect={handlePlanSelect}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Divisor */}
              <motion.div variants={fadeUp}>
                <div className="mb-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-black uppercase tracking-widest text-[#9ca3af]">
                    Seus dados
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              </motion.div>

              {/* Botão Google (Mobile-first placement) */}
              <motion.div variants={fadeUp} className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                  aria-label="Continuar com Google"
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-black text-[#374151] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <GoogleIcon size={18} />
                  Continuar com Google
                </button>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-black text-[#9ca3af]">ou preencha os dados</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              </motion.div>

              {/* Formulário */}
              <motion.form variants={fadeUp} onSubmit={handleContinue} noValidate>
                {formError && <AlertBox>{formError}</AlertBox>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Nome completo *"
                    icon={FiUser}
                    id="name"
                    type="text"
                    placeholder="João da Silva"
                    autoComplete="name"
                    value={form.name}
                    onChange={handleField('name')}
                    required
                  />
                  <InputField
                    label="E-mail *"
                    icon={FiMail}
                    id="email"
                    type="email"
                    placeholder="joao@gmail.com"
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={handleField('email')}
                    required
                  />
                  <InputField
                    label="WhatsApp *"
                    icon={FiPhone}
                    id="whatsapp"
                    type="tel"
                    placeholder="(79) 99999-9999"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={15}
                    value={form.whatsapp}
                    onChange={handleField('whatsapp')}
                    required
                  />
                  <InputField
                    label="Nome da loja *"
                    icon={FiShoppingBag}
                    id="storeName"
                    type="text"
                    placeholder="Lanchonete do João"
                    value={form.storeName}
                    onChange={handleField('storeName')}
                    required
                  />
                  <SelectField
                    label="Segmento"
                    icon={FiShoppingBag}
                    id="segment"
                    value={form.segment}
                    onChange={handleField('segment')}
                  >
                    <option value="">Selecione o segmento</option>
                    {SEGMENTS.map((seg) => (
                      <option key={seg} value={seg}>{seg}</option>
                    ))}
                  </SelectField>
                  <InputField
                    label="Cidade"
                    icon={FiMapPin}
                    id="city"
                    type="text"
                    placeholder="Aracaju, SE"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={handleField('city')}
                  />
                  <div className="flex flex-col">
                    <InputField
                      label="Senha *"
                      icon={FiLock}
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={handleField('password')}
                      required
                    />
                    {form.password && (
                      <div className="mt-2 px-1">
                        <div className="flex gap-1 h-1.5 w-full max-w-[200px] mb-1">
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(form.password).score >= 1 ? (getPasswordStrength(form.password).level === 'weak' ? 'bg-red-500' : getPasswordStrength(form.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(form.password).score >= 2 ? (getPasswordStrength(form.password).level === 'weak' ? 'bg-red-500' : getPasswordStrength(form.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(form.password).score >= 3 ? (getPasswordStrength(form.password).level === 'medium' ? 'bg-amber-500' : 'bg-green-500') : 'bg-gray-200'}`} />
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(form.password).score >= 4 ? 'bg-green-500' : 'bg-gray-200'}`} />
                        </div>
                        <p className={`text-[10px] font-bold ${getPasswordStrength(form.password).level === 'weak' ? 'text-red-600' : getPasswordStrength(form.password).level === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                          {getPasswordStrength(form.password).label}
                        </p>
                        <p className="text-[9px] font-semibold text-gray-500 mt-0.5">
                          Use pelo menos 8 caracteres, misturando letras e números.
                        </p>
                      </div>
                    )}
                  </div>
                  <InputField
                    label="Confirmar senha *"
                    icon={FiLock}
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleField('confirmPassword')}
                    required
                  />
                </div>

                {/* Resumo */}
                <div className="mt-6">
                  <SummaryCard plan={selectedPlan} cycle={billingCycle} />
                </div>

                <div className="mt-5 space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/30">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => {
                        setTermsAccepted(event.target.checked)
                        setFormError('')
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="text-xs font-semibold leading-5 text-[#4b5563]">
                      <span className="font-black text-[#111827]">Li e aceito</span> os{' '}
                      <Link to="/termos" className="font-black text-[#f97316] underline underline-offset-2 hover:text-[#ea580c]">
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link to="/privacidade" className="font-black text-[#f97316] underline underline-offset-2 hover:text-[#ea580c]">
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-left transition hover:border-gray-200 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="text-xs font-semibold leading-5 text-[#6b7280]">
                      Quero receber novidades, atualizações do produto e dicas para vender mais com o PratoBy.
                    </span>
                  </label>
                </div>

                {/* CTA principal */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Processando...
                    </>
                  ) : (
                    <>
                      Criar conta e continuar
                      <FiArrowRight
                        size={15}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-xs font-semibold text-[#9ca3af]">
                  Seus dados são usados para criar sua conta e proteger o acesso ao painel.
                </p>
              </motion.form>

              {/* Rodapé da seção */}
              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-gray-100 pt-6 text-xs font-bold text-[#6b7280]"
              >
                <Link to="/" className="transition hover:text-[#111827]">Início</Link>
                <Link to="/planos" className="transition hover:text-[#111827]">Planos</Link>
                <Link to="/contato" className="transition hover:text-[#111827]">Contato</Link>
                <Link to="/login" className="transition hover:text-[#111827]">Entrar</Link>
              </motion.div>

            </motion.div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {termsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-[1.5rem] border border-orange-100 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                  <FiShield size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#111827]">Aceite os termos atualizados</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#6b7280]">
                    Para continuar usando o PratoBy, confirme que leu e aceita os Termos de Uso e a Política de Privacidade.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-orange-50/70 p-4 text-xs font-semibold leading-5 text-[#9a3412]">
                Versões vigentes: Termos {TERMS_VERSION} e Privacidade {PRIVACY_VERSION}.
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAcceptLatestTerms}
                  disabled={termsModalSubmitting}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {termsModalSubmitting ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                  Aceitar e continuar
                </button>
                <button
                  type="button"
                  onClick={handleCloseTermsModal}
                  disabled={termsModalSubmitting}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Agora não
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
