import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
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

const PLANS = [
  {
    id: 'essential',
    name: 'Essencial',
    description: 'Para começar a vender online',
    price: 59,
    priceAnnual: 49,
    features: [
      'Cardápio digital ilimitado',
      'Pedidos em tempo real',
      'Link próprio da loja',
      'Sem taxa por pedido',
      'Painel de controle',
      'Horários automáticos',
    ],
    popular: false,
  },
  {
    id: 'professional',
    name: 'Profissional',
    description: 'Mais popular entre os lojistas',
    price: 89,
    priceAnnual: 74,
    features: [
      'Tudo do Essencial',
      'Cupons de desconto',
      'Taxa por bairro',
      'Campos personalizados',
      'Relatórios avançados',
      'WhatsApp integrado',
      'Suporte prioritário',
    ],
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Para quem quer vender mais',
    price: 159,
    priceAnnual: 133,
    features: [
      'Tudo do Profissional',
      'Multi-loja até 3',
      'API de integração',
      'Domínio personalizado',
      'Marca branca',
      'Gerente de conta dedicado',
    ],
    popular: false,
  },
]

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
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <PratoByLogo />
        <Link
          to="/login"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm active:scale-95"
          aria-label="Já tenho conta"
        >
          <FiArrowLeft size={16} />
          Já tenho conta
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
            {plan.features.map((feat) => (
              <li
                key={feat}
                className="flex items-start gap-2 text-xs font-semibold text-[#6b7280]"
              >
                <FiCheckCircle
                  size={13}
                  className={`mt-0.5 shrink-0 transition-colors ${
                    selected ? 'text-[#f97316]' : 'text-gray-400'
                  }`}
                />
                {feat}
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-black text-[#111827]">
                  Plano {plan.name}
                </p>
                <p className="text-xs font-semibold text-[#6b7280]">
                  {plan.description}
                </p>
              </div>
  
              <div className="text-right">
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
                { icon: FiCheckCircle, text: '14 dias de teste grátis' },
                { icon: FiCheckCircle, text: '0% de comissão por pedido' },
                { icon: FiCheckCircle, text: 'Cancelamento a qualquer hora' },
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
  const [selectedPlanId, setSelectedPlanId] = useState('professional')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    storeName: '',
    segment: '',
    city: '',
  })
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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
          !isLoading
      ),
    [form, isLoading]
  )

  // ── Handlers ──────────────────────────────
  const handleField = useCallback((field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setFormError('')
  }, [])

  const handlePlanSelect = useCallback((planId) => {
    setSelectedPlanId(planId)
  }, [])

  const handleCycleChange = useCallback((cycle) => {
    setBillingCycle(cycle)
  }, [])

  const handleGoogleSignup = useCallback(() => {
    console.log('[SignupPage] Google signup — integração pendente')
  }, [])

  const handleContinue = useCallback(
    (e) => {
      e.preventDefault()
      if (!form.name.trim()) return setFormError('Informe seu nome completo.')
      if (!form.email.trim()) return setFormError('Informe seu e-mail.')
      if (!/\S+@\S+\.\S+/.test(form.email)) return setFormError('Digite um e-mail válido.')
      if (!form.whatsapp.trim()) return setFormError('Informe seu WhatsApp.')
      if (!form.storeName.trim()) return setFormError('Informe o nome da sua loja.')

      setIsLoading(true)
      console.log('[SignupPage] Dados do cadastro:', {
        plan: selectedPlanId,
        cycle: billingCycle,
        ...form,
      })

      // Simulação — integração real virá nas próximas etapas
      setTimeout(() => {
        setIsLoading(false)
        setSubmitted(true)
      }, 1200)
    },
    [form, selectedPlanId, billingCycle]
  )

  // ─────────────────────────────────────────────────────────
  // RENDER — ESTADO "PRÓXIMA ETAPA"
  // ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center bg-[#f9fafb] px-4 text-[#111827] antialiased">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md rounded-[2rem] border border-orange-100/80 bg-white p-8 text-center shadow-2xl shadow-orange-900/10"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-50 ring-1 ring-orange-100">
            <FiCheckCircle size={32} className="text-[#f97316]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#111827]">
            Tudo certo, {form.name.split(' ')[0]}!
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
          Recebemos seus dados. Na próxima etapa, você poderá confirmar seu WhatsApp{' '}
            <strong className="text-[#111827]">{form.whatsapp}</strong>, iniciar o teste grátis
            e ativar sua loja com segurança.
          </p>
          <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-4 text-sm font-bold text-[#374151]">
            Plano <span className="text-[#f97316]">{selectedPlan.name}</span> ·{' '}
            {billingCycle === 'annual' ? 'Cobrança anual' : 'Cobrança mensal'} ·{' '}
            14 dias grátis
          </div>
          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-[#ea580c]"
          >
            Voltar ao site
            <FiArrowRight size={15} />
          </Link>
        </motion.div>
      </main>
    )
  }

  // ─────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-dvh bg-[#f9fafb] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
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
              to="/"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur transition hover:bg-white hover:text-[#111827]"
            >
              Voltar ao site
            </Link>
          </div>

          {/* Centro */}
          <div className="relative z-10 py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-orange-100 backdrop-blur">
              <FiShield className="text-[#f97316]" />
              Comece em minutos, cancele quando quiser
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
                '14 dias de teste grátis',
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
        <section className="flex flex-col justify-start px-4 py-6 sm:px-6 lg:overflow-y-auto lg:max-h-dvh lg:px-8 lg:py-10 xl:px-12">
          <div className="mx-auto w-full max-w-2xl">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >

              {/* Cabeçalho da seção */}
              <motion.div variants={fadeUp} className="mb-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                  <FiZap size={11} />
                  Etapa 1 de 2 — Conta e plano
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  Crie sua loja online
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                  Escolha um plano, configure sua conta e comece seu teste grátis.
                </p>
              </motion.div>

              {/* Toggle ciclo de cobrança */}
              <motion.div variants={fadeUp} className="mb-6">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-[#6b7280]">
                  Ciclo de cobrança
                </p>
                <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
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
                        'relative rounded-[1rem] px-4 py-2 text-sm font-black transition-all duration-200',
                        billingCycle === opt.value
                          ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/25'
                          : 'text-[#6b7280] hover:text-[#111827]',
                      ].join(' ')}
                    >
                      {opt.label}
                      {opt.value === 'annual' && billingCycle !== 'annual' && (
                        <span className="ml-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-[#f97316]">
                          -17%
                        </span>
                      )}
                      {opt.value === 'annual' && billingCycle === 'annual' && (
                        <span className="ml-2 inline-block rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">
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

                {/* Mobile: scroll horizontal com snap */}
                <div className="flex gap-3 overflow-x-auto px-1 pt-4 pb-3 sm:hidden" style={{ scrollSnapType: 'x mandatory' }}>
                  {PLANS.map((plan) => (
                    <div key={plan.id} className="w-[78vw] shrink-0" style={{ scrollSnapAlign: 'start' }}>
                      <PlanCard
                        plan={plan}
                        selected={selectedPlanId === plan.id}
                        cycle={billingCycle}
                        onSelect={handlePlanSelect}
                      />
                    </div>
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

              {/* Botão Google */}
              <motion.div variants={fadeUp} className="mb-5">
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  aria-label="Continuar com Google"
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-black text-[#374151] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:scale-[0.98]"
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
                </div>

                {/* Resumo */}
                <div className="mt-6">
                  <SummaryCard plan={selectedPlan} cycle={billingCycle} />
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
                      Continuar cadastro
                      <FiArrowRight
                        size={15}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-xs font-semibold text-[#9ca3af]">
                  Ao continuar, você concorda com os{' '}
                  <Link to="/termos" className="font-black text-[#6b7280] underline underline-offset-2 hover:text-[#111827]">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/privacidade" className="font-black text-[#6b7280] underline underline-offset-2 hover:text-[#111827]">
                    Política de Privacidade
                  </Link>
                  .
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
    </main>
  )
}