// ─────────────────────────────────────────────────────────────
// src/pages/auth/LoginPage.jsx
// Login premium para PratoBy — preserva a lógica de autenticação.
// ─────────────────────────────────────────────────────────────

import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiEye,
  FiEyeOff,
  FiGlobe,
  FiHelpCircle,
  FiInfo,
  FiLoader,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiShield,
  FiShoppingBag,
  FiSmartphone,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi'

import { db } from '../../services/firebase'
import { auth, googleProvider } from '../../services/firebaseAuth'
import SEO from '../../components/seo/SEO'
import PratoByLogoIcon from '../../components/ui/PratoByLogoIcon'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
const APP_ENV = import.meta.env.MODE || 'production'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BENEFITS = [
  {
    icon: FiShoppingBag,
    title: 'Pedidos centralizados',
    helper: 'Receba, confirme e acompanhe tudo no painel.',
  },
  {
    icon: FiSmartphone,
    title: 'Cardápio mobile-first',
    helper: 'Experiência rápida para o cliente pedir pelo link.',
  },
]

const OPERATION_STEPS = [
  {
    label: 'Pedido recebido',
    helper: 'Cliente compra pelo link próprio da loja.',
  },
  {
    label: 'Painel atualizado',
    helper: 'Status, itens e dados do cliente aparecem em tempo real.',
  },
]

const DASHBOARD_METRICS = [
  { label: 'Pedidos', value: 'Online', icon: FiShoppingBag },
  { label: 'Canal', value: 'Próprio', icon: FiGlobe },
  { label: 'Comissão', value: '0%', icon: FiTrendingUp },
]

// ─────────────────────────────────────────────────────────────
// LÓGICA DE AUTH
// ─────────────────────────────────────────────────────────────

function getFriendlyAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Digite um e-mail válido.'
    case 'auth/user-disabled':
      return 'Este usuário foi desativado. Entre em contato com o suporte.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha inválidos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente novamente.'
    case 'auth/missing-password':
      return 'Digite sua senha para continuar.'
    case 'auth/missing-email':
      return 'Digite seu e-mail para continuar.'
    default:
      return 'Não foi possível entrar agora. Tente novamente.'
  }
}

function normalizeRole(userData) {
  return String(
    userData?.role ||
      userData?.userRole ||
      userData?.type ||
      userData?.accountType ||
      ''
  )
    .trim()
    .toLowerCase()
}

function getPostLoginRoute(userData) {
  const role = normalizeRole(userData)
  if (['admin', 'developer', 'dev', 'superadmin', 'owner'].includes(role)) {
    return '/admin'
  }

  if (role === 'merchant') {
    const onboardingStatus = String(userData?.onboardingStatus || '').trim()
    const subscriptionStatus = String(userData?.subscriptionStatus || '').trim()

    const hasStore =
      Boolean(userData?.storeId) ||
      (Array.isArray(userData?.storeIds) && userData.storeIds.length > 0)

    if (onboardingStatus === 'phone_pending' || userData?.phoneVerified !== true) {
      return '/onboarding'
    }

    if (!hasStore) {
      return '/onboarding'
    }

    if (
      [
        'checkout_pending',
        'pending_checkout',
        'billing_pending',
        'billing_pending_payment_method',
      ].includes(subscriptionStatus)
    ) {
      return '/dashboard/billing'
    }

    if (
      ['trialing', 'active', 'past_due', 'blocked', 'canceled', 'cancelled', 'trial_ended'].includes(
        subscriptionStatus
      )
    ) {
      return '/dashboard'
    }

    return '/dashboard'
  }

  return '/'
}

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
// ANIMAÇÕES E COMPONENTES VISUAIS
// ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
  },
}

const softIn = {
  hidden: { opacity: 0, scale: 0.96, y: 18, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.075, delayChildren: 0.08 },
  },
}

function PratoByLogo({ dark = false, compact = false }) {
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Ir para início">
      <PratoByLogoIcon
        size={compact ? 'sm' : 'lg'}
        className={dark ? 'shadow-orange-950/30 ring-white/10' : 'shadow-orange-600/20 ring-black/5'}
        interactive
      />
      <div className="min-w-0 leading-none">
        <p
          className={`font-black tracking-tighter ${
            compact ? 'text-xl' : 'text-2xl'
          } ${dark ? 'text-white' : 'text-slate-950'}`}
        >
          Prato<span className="text-orange-500">By</span>
        </p>
        <p
          className={`mt-1 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.18em] ${
            dark ? 'text-white/50' : 'text-slate-400'
          }`}
        >
          Cardápio digital
        </p>
      </div>
    </Link>
  )
}

function LoginMobileHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50 border-b border-orange-100/80 bg-white/90 shadow-sm shadow-orange-950/5 backdrop-blur-2xl lg:hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <PratoByLogo compact />
        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 text-sm font-black text-slate-900 shadow-sm shadow-orange-950/5 transition active:scale-95"
          aria-label="Voltar para o site"
        >
          <FiArrowLeft size={16} />
          Voltar
        </Link>
      </div>
    </motion.header>
  )
}

function InputField({ label, icon: Icon, rightElement, className = '', ...props }) {
  const [focused, setFocused] = useState(false)
  const hasValue = Boolean(props.value)

  return (
    <label className={`block ${className}`} htmlFor={props.id}>
      <span
        className={`mb-2 block text-xs font-black uppercase tracking-[0.16em] transition-colors duration-200 ${
          focused ? 'text-orange-600' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
      <div className="relative">
        <div
          className={`absolute inset-0 rounded-[1.25rem] transition duration-200 ${
            focused ? 'bg-orange-500/10 blur-md' : 'bg-transparent'
          }`}
          aria-hidden="true"
        />
        {Icon && (
          <Icon
            className={`pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 transition-colors duration-200 ${
              focused || hasValue ? 'text-orange-500' : 'text-slate-400'
            }`}
            size={17}
          />
        )}
        <input
          {...props}
          onFocus={(event) => {
            setFocused(true)
            props.onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            props.onBlur?.(event)
          }}
          className={`relative z-0 h-[52px] w-full rounded-[1.25rem] border border-orange-100/90 bg-white/95 px-4 text-sm font-bold text-slate-950 shadow-sm shadow-orange-950/5 outline-none transition placeholder:text-slate-400 hover:border-orange-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${
            Icon ? 'pl-11' : ''
          } ${rightElement ? 'pr-12' : ''}`}
        />
        {rightElement}
      </div>
    </label>
  )
}

function AlertBox({ type = 'error', children }) {
  const isSuccess = type === 'success'
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={
        isSuccess
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -5, 5, 0] }
      }
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={
        isSuccess
          ? { duration: 0.22, ease: 'easeOut' }
          : {
              x: { duration: 0.36, ease: 'easeInOut' },
              default: { duration: 0.22, ease: 'easeOut' },
            }
      }
      className={`mb-5 rounded-[1.25rem] border px-4 py-3 text-sm font-bold leading-6 shadow-sm ${
        isSuccess
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700 shadow-emerald-950/5'
          : 'border-red-100 bg-red-50 text-red-700 shadow-red-950/5'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <FiCheckCircle className="mt-0.5 shrink-0" size={17} />
        ) : (
          <FiAlertCircle className="mt-0.5 shrink-0" size={17} />
        )}
        <span>{children}</span>
      </div>
    </motion.div>
  )
}

function BenefitCard({ icon: Icon, title, helper }) {
  return (
    <motion.div
      variants={fadeUp}
      className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.1] hover:ring-1 hover:ring-orange-300/20"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-orange-400/10 blur-2xl transition group-hover:bg-orange-400/20" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-orange-300 ring-1 ring-white/10">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-orange-50/65">{helper}</p>
        </div>
      </div>
    </motion.div>
  )
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-white/45">
        <Icon size={13} />
        <p className="text-[10px] font-black uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function WorkflowPanel() {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.075] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -right-14 bottom-0 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <FiTrendingUp className="text-orange-300" />
          </span>
          Fluxo de trabalho
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/15 px-3 py-1 text-[11px] font-black text-emerald-100">
          Ao vivo
        </span>
      </div>

      <div className="relative mt-5 grid gap-3">
        <div className="absolute left-[17px] top-4 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-orange-400/50 via-white/10 to-transparent" />
        {OPERATION_STEPS.map((step, index) => (
          <div
            key={step.label}
            className="group relative flex items-start gap-3 rounded-2xl bg-slate-950/35 p-3 ring-1 ring-white/5 transition duration-200 hover:bg-slate-950/45 hover:ring-orange-300/20"
          >
            <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-black text-white shadow-lg shadow-orange-950/25 ring-1 ring-white/20">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black leading-5 text-white">{step.label}</p>
              <p className="mt-0.5 text-xs font-semibold leading-5 text-orange-100/65">
                {step.helper}
              </p>
            </div>
            <span className="mt-1 hidden rounded-full bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/40 transition group-hover:text-orange-100 sm:inline-flex">
              etapa {index + 1}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}


// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, userData, loading } = useContext(AuthContext)
  const [postLoginRedirectPath, setPostLoginRedirectPath] = useState('')

  useEffect(() => {
    if (!loading && user && userData) {
      const redirectPath = postLoginRedirectPath || getPostLoginRoute(userData)
      navigate(redirectPath, { replace: true })
    }
  }, [loading, navigate, postLoginRedirectPath, user, userData])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberAccess, setRememberAccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const canSubmit = Boolean(
    EMAIL_PATTERN.test(cleanEmail) && password && !isLoading && !isResettingPassword
  )

  async function handleLogin(event) {
    event.preventDefault()
    if (isLoading) return

    setError('')
    setSuccess('')

    if (!cleanEmail) {
      setError('Digite seu e-mail para continuar.')
      return
    }

    if (!password) {
      setError('Digite sua senha para continuar.')
      return
    }

    setPostLoginRedirectPath('')
    setIsLoading(true)
    try {
      await setPersistence(
        auth,
        rememberAccess ? browserLocalPersistence : browserSessionPersistence
      )
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password)
      const uid = userCredential.user.uid
      const userDoc = await getDoc(doc(db, 'users', uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setError('Usuário não encontrado no sistema. Peça acesso ao administrador.')
        return
      }

      const nextUserData = userDoc.data() || {}
      const redirectPath = getPostLoginRoute(nextUserData)
      setPostLoginRedirectPath(redirectPath)
    } catch (err) {
      setPostLoginRedirectPath('')
      setError(getFriendlyAuthError(err?.code))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    if (isLoading) return

    setError('')
    setSuccess('')
    setPostLoginRedirectPath('')
    setIsLoading(true)

    try {
      await setPersistence(
        auth,
        rememberAccess ? browserLocalPersistence : browserSessionPersistence
      )
      const result = await signInWithPopup(auth, googleProvider)
      const nextUser = result.user
      const userDoc = await getDoc(doc(db, 'users', nextUser.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setError(
          <span className="flex flex-wrap items-center gap-1">
            Conta não encontrada.
            <Link to="/cadastro" className="underline transition hover:text-red-900">
              Crie sua loja para começar.
            </Link>
          </span>
        )
        return
      }

      const nextUserData = userDoc.data() || {}
      const redirectPath = getPostLoginRoute(nextUserData)
      setPostLoginRedirectPath(redirectPath)
    } catch (err) {
      setPostLoginRedirectPath('')
      console.error('[LoginPage] Erro no login com Google:', err)
      const code = err?.code
      if (code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase Authentication. Adicione o domínio nas configurações do Firebase.')
      } else if (code === 'auth/operation-not-allowed') {
        setError('Login com Google ainda não está ativado no Firebase Authentication.')
      } else if (code === 'auth/popup-blocked') {
        setError('O navegador bloqueou a janela do Google. Permita pop-ups para continuar.')
      } else if (code === 'auth/cancelled-popup-request') {
        setError('Uma tentativa de login já estava em andamento.')
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Login com Google cancelado.')
      } else if (code === 'auth/network-request-failed') {
        setError('Falha de conexão. Verifique sua internet e tente novamente.')
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('Este e-mail já existe com outro método de login. Entre usando o método original.')
      } else {
        setError('Não foi possível entrar com Google. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasswordReset() {
    setError('')
    setSuccess('')

    if (!cleanEmail) {
      setError('Digite seu e-mail primeiro para recuperar a senha.')
      return
    }

    setIsResettingPassword(true)
    try {
      await sendPasswordResetEmail(auth, cleanEmail)
      setSuccess('Enviamos um link de recuperação para seu e-mail.')
    } catch (err) {
      setError(getFriendlyAuthError(err?.code))
    } finally {
      setIsResettingPassword(false)
    }
  }

  if (loading || postLoginRedirectPath) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-orange-50 text-slate-950">
        <SEO
          title="Entrar no PratoBy | Painel do lojista"
          description="Acesse o painel do PratoBy para gerenciar cardápio digital, pedidos online, configurações da loja e operação do delivery próprio."
          path="/login"
          noIndex
          noFollow
        />
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative flex flex-col items-center justify-center gap-5 rounded-[2rem] border border-orange-100 bg-white/90 p-8 shadow-2xl shadow-orange-950/10 backdrop-blur"
        >
          <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-orange-50 ring-1 ring-orange-100">
            <div className="absolute inset-0 animate-ping rounded-3xl bg-orange-400/20" />
            <FiLoader className="relative animate-spin text-orange-500" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-slate-900">Verificando sessão...</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Preparando seu painel PratoBy.</p>
          </div>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#fff7ed] pt-20 text-slate-950 antialiased selection:bg-orange-100 selection:text-orange-700 lg:pt-0">
      <SEO
        title="Entrar no PratoBy | Painel do lojista"
        description="Acesse o painel do PratoBy para gerenciar cardápio digital, pedidos online, configurações da loja e operação do delivery próprio."
        path="/login"
        noIndex
        noFollow
      />
      <LoginMobileHeader />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-orange-300/25 blur-3xl lg:hidden" />
        <div className="absolute -bottom-32 right-[-8rem] h-80 w-80 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.72),rgba(255,247,237,0.94))] lg:hidden" />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,1.02fr)_minmax(430px,0.72fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(460px,0.72fr)]">
        <section className="relative hidden overflow-hidden bg-slate-950 px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-700" />
            <div className="absolute -right-40 top-16 h-[30rem] w-[30rem] rounded-full bg-orange-500/20 blur-3xl" />
            <div className="absolute -left-40 bottom-12 h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.22),transparent_32rem),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42rem)]" />
            <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:44px_44px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-between gap-4"
          >
            <PratoByLogo dark />
            <Link
              to="/"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 shadow-lg shadow-black/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
            >
              Voltar ao site
            </Link>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative z-10 mx-auto flex w-full max-w-[64rem] flex-1 flex-col justify-center py-10"
          >
            <motion.div variants={fadeUp} className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-300/25 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-100 shadow-lg shadow-orange-950/10 backdrop-blur-xl">
              <FiShield className="text-orange-300" />
              Acesso operacional do lojista
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-7 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.055em] xl:text-6xl"
            >
              Entre no painel que mantém
              <span className="block bg-gradient-to-r from-orange-200 via-orange-400 to-orange-600 bg-clip-text text-transparent">
                sua loja vendendo.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-300"
            >
              Controle cardápio, pedidos, status, horários, entrega e pagamentos em um ambiente rápido, seguro e feito para operação real.
            </motion.p>

            <motion.div variants={staggerContainer} className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <BenefitCard key={benefit.title} {...benefit} />
              ))}
            </motion.div>

          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative z-10 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"
          >
            <motion.div
              variants={fadeUp}
              className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.075] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-950/30 ring-1 ring-white/20">
                  <FiZap size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black tracking-tight text-white">PratoBy Cloud</p>
                    <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-100">
                      Sem comissão
                    </span>
                  </div>
                  <p className="mt-2 max-w-[34rem] text-sm font-semibold leading-6 text-slate-300">
                    Cardápio digital para negócios locais venderem direto, sem depender de marketplace.
                  </p>
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-3 gap-2">
                {DASHBOARD_METRICS.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </motion.div>

            <WorkflowPanel />
          </motion.div>
        </section>

        <section className="relative flex min-h-dvh items-center justify-center border-l border-orange-100/70 bg-white/80 px-4 py-6 backdrop-blur-xl sm:px-6 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.11),transparent_26rem)]" />
          <div className="relative w-full max-w-[31rem]">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mb-5 lg:hidden"
            >
              <div className="overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white/85 p-4 shadow-xl shadow-orange-950/10 backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-600/20">
                    <FiZap size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-950">Painel PratoBy</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Entre para gerenciar pedidos, cardápio e operação da sua loja.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden rounded-[2rem] border border-orange-100/90 bg-white/95 p-5 shadow-2xl shadow-orange-950/10 backdrop-blur-2xl sm:p-8"
            >
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.div
                  variants={fadeUp}
                  className="mb-7 hidden rounded-[1.35rem] border border-orange-100/80 bg-gradient-to-r from-orange-50 to-white p-3 shadow-sm lg:flex lg:items-center lg:justify-between lg:gap-4"
                >
                  <PratoByLogo compact />
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-400 ring-1 ring-orange-100">
                    v{APP_VERSION}
                  </span>
                </motion.div>

                <motion.div variants={fadeUp} className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-orange-600 ring-1 ring-orange-100">
                    <FiShield size={12} />
                    Acesso seguro
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-[2.45rem]">
                    Bem-vindo de volta
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Acesse sua loja para acompanhar pedidos, editar o cardápio e manter a operação atualizada.
                  </p>
                </motion.div>

                <AnimatePresence mode="wait">
                  {error && (
                    <AlertBox key="error" type="error">
                      {error}
                    </AlertBox>
                  )}
                  {!error && success && (
                    <AlertBox key="success" type="success">
                      {success}
                    </AlertBox>
                  )}
                </AnimatePresence>

                <motion.div variants={fadeUp} className="mb-5">
                  <motion.button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading || isResettingPassword}
                    whileHover={{ y: -2, scale: 1.005, borderColor: '#d1d5db' }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm shadow-slate-950/5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-orange-50/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                    <span className="relative flex items-center gap-3">
                      <GoogleIcon size={18} />
                      Entrar com Google
                    </span>
                  </motion.button>

                  <div className="mt-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                      ou use e-mail e senha
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
                  </div>
                </motion.div>

                <motion.form variants={fadeUp} onSubmit={handleLogin} className="space-y-4">
                  <InputField
                    label="E-mail"
                    icon={FiMail}
                    id="email"
                    type="email"
                    placeholder="lojista@email.com"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading}
                    required
                  />

                  <InputField
                    label="Senha"
                    icon={FiLock}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoading}
                    required
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        disabled={isLoading}
                      >
                        <motion.span
                          whileTap={{ scale: 0.82 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          className="block"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={showPassword ? 'eye-off' : 'eye-on'}
                              initial={{ opacity: 0, scale: 0.8, rotate: -25 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.8, rotate: 25 }}
                              transition={{ duration: 0.15 }}
                              className="block"
                            >
                              {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                            </motion.span>
                          </AnimatePresence>
                        </motion.span>
                      </button>
                    }
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500">
                      <input
                        type="checkbox"
                        checked={rememberAccess}
                        onChange={(event) => setRememberAccess(event.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-orange-200 text-orange-500 accent-orange-500 focus:ring-orange-500"
                      />
                      Manter conectado neste dispositivo
                    </label>

                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isResettingPassword || isLoading}
                      className="w-fit text-xs font-black text-orange-600 transition hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResettingPassword ? 'Enviando...' : 'Esqueci minha senha'}
                    </button>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!canSubmit}
                    whileHover={
                      canSubmit
                        ? { y: -2, scale: 1.01, boxShadow: '0 20px 28px -8px rgba(234, 88, 12, 0.35)' }
                        : {}
                    }
                    whileTap={canSubmit ? { scale: 0.985 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-[1.25rem] bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 text-sm font-black text-white shadow-xl shadow-orange-600/25 transition disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
                    {isLoading ? (
                      <>
                        <FiLoader className="relative animate-spin" size={16} />
                        <span className="relative">Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative">Entrar no painel</span>
                        <FiArrowRight size={16} className="relative transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </motion.button>
                </motion.form>

                <motion.div
                  variants={fadeUp}
                  className="mt-6 overflow-hidden rounded-[1.45rem] border border-orange-100/80 bg-gradient-to-br from-orange-50/80 to-white shadow-sm shadow-orange-950/5"
                >
                  <div className="flex gap-3 border-b border-orange-100/70 p-4">
                    <FiInfo className="mt-0.5 shrink-0 text-orange-500" size={16} />
                    <div>
                      <p className="text-sm font-black text-slate-950">Plataforma para operação real</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Gerencie loja, pedidos, cardápio, pagamentos e atendimento em um único painel.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <FiHelpCircle className="shrink-0 text-orange-500" size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-950">Ainda não tem conta?</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        Crie sua loja e comece seu teste grátis com recursos Premium.
                      </p>
                    </div>
                    <Link
                      to="/cadastro"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-600/20 active:scale-[0.98]"
                    >
                      Criar minha loja
                      <FiArrowRight size={13} />
                    </Link>
                  </div>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5 text-xs font-bold text-slate-500"
                >
                  <span>PratoBy Cloud · {APP_ENV}</span>
                  <span className="inline-flex items-center gap-1">
                    <FiClock size={12} />© {new Date().getFullYear()} PratoBy
                  </span>
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-500"
            >
              <Link to="/" className="transition hover:text-slate-950">
                Início
              </Link>
              <Link to="/sobre" className="transition hover:text-slate-950">
                Sobre
              </Link>
              <Link to="/contato" className="inline-flex items-center gap-1 transition hover:text-slate-950">
                <FiMessageCircle size={12} />
                Contato
              </Link>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  )
}
