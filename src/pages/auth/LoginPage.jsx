// ─────────────────────────────────────────────────────────────
// src/pages/auth/LoginPage.jsx
// ─────────────────────────────────────────────────────────────

import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { AnimatePresence, motion } from 'motion/react'   // ← CORRIGIDO: era 'framer-motion'
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiEyeOff,
  FiHelpCircle,
  FiInfo,
  FiLoader,
  FiLock,
  FiMail,
  FiMessageCircle,
  FiShield,
  FiSmartphone,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi'

import { auth, db, googleProvider } from '../../services/firebase'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
const APP_ENV = import.meta.env.MODE || 'production'

const BENEFITS = [
  'Pedidos em tempo real no painel',
  'Cardápio com link exclusivo da loja',
  'Sem comissão por pedido',
  'Produtos, horários, cupons e entrega em um só lugar',
]

const METRICS = [
  { label: 'Pedidos', value: '24', helper: 'hoje' },
  { label: 'Conversão', value: '+18%', helper: 'sem app' },
  { label: 'Comissão', value: '0%', helper: 'por pedido' },
]

// ─────────────────────────────────────────────────────────────
// LÓGICA DE AUTH (preservada integralmente)
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
    const onboardingStatus = userData?.onboardingStatus || ''
    const subscriptionStatus = userData?.subscriptionStatus || ''
    
    const hasStore =
      Boolean(userData?.storeId) ||
      (Array.isArray(userData?.storeIds) && userData.storeIds.length > 0)
    
    const isPending =
      !hasStore ||
      ['phone_pending'].includes(onboardingStatus) ||
      ['pending_checkout'].includes(subscriptionStatus)
      
    return isPending ? '/onboarding' : '/dashboard'
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
// VARIANTES DE ANIMAÇÃO (espelhando SignupPage)
// ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
}

const floatAnimation = {
  animate: {
    y: [0, -14, 0],
    scale: [1, 1.03, 1],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
}

// ─────────────────────────────────────────────────────────────
// LOGO (idêntica à SignupPage)
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
// HEADER MOBILE (idêntico à SignupPage — só muda o botão)
// ─────────────────────────────────────────────────────────────

function LoginMobileHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl lg:hidden"
    >
      {/* barra laranja decorativa na base do header */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
        <span className="block h-full w-full rounded-full bg-[#f97316]" />
      </span>

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0" aria-label="Ir para início">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="PratoBy"
              className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-orange-600/20"
            />
            <div className="leading-none">
              <p className="text-2xl font-black tracking-tighter text-[#111827]">
                Prato<span className="text-[#f97316]">By</span>
              </p>
              <p className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                Cardápio digital e delivery
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition active:scale-95"
          aria-label="Voltar para o site"
        >
          <FiArrowLeft size={16} />
          Voltar
        </Link>
      </div>
    </motion.header>
  )
}

// ─────────────────────────────────────────────────────────────
// INPUT FIELD (idêntico à SignupPage)
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
// ALERT BOX — agora com AnimatePresence para sair com animação
// ─────────────────────────────────────────────────────────────

function AlertBox({ type = 'error', children }) {
  const isSuccess = type === 'success'
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${
        isSuccess
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-red-100 bg-red-50 text-red-700'
      }`}
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

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, userData, loading } = useContext(AuthContext)

  useEffect(() => {
    if (!loading && user && userData) {
      const redirectPath = getPostLoginRoute(userData)
      navigate(redirectPath, { replace: true })
    }
  }, [loading, user, userData, navigate])

  // ── Estado (preservado integralmente) ──────────────────────
  const [email,               setEmail]               = useState('')
  const [password,            setPassword]            = useState('')
  const [rememberAccess,      setRememberAccess]      = useState(false)
  const [showPassword,        setShowPassword]        = useState(false)
  const [error,               setError]               = useState('')
  const [success,             setSuccess]             = useState('')
  const [isLoading,           setIsLoading]           = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const canSubmit  = Boolean(cleanEmail && password && !isLoading && !isResettingPassword)

  // ── handleLogin (preservado integralmente) ─────────────────
  async function handleLogin(event) {
    event.preventDefault()
    if (isLoading) return

    setError('')
    setSuccess('')

    if (!cleanEmail) { setError('Digite seu e-mail para continuar.'); return }
    if (!password)   { setError('Digite sua senha para continuar.');  return }

    setIsLoading(true)
    try {
      await setPersistence(
        auth,
        rememberAccess ? browserLocalPersistence : browserSessionPersistence
      )
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password)
      const uid            = userCredential.user.uid
      const userDoc        = await getDoc(doc(db, 'users', uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setError('Usuário não encontrado no sistema. Peça acesso ao administrador.')
        return
      }

      const userData     = userDoc.data() || {}
      const redirectPath = getPostLoginRoute(userData)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(getFriendlyAuthError(err?.code))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    if (isLoading) return
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      await setPersistence(
        auth,
        rememberAccess ? browserLocalPersistence : browserSessionPersistence
      )
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const userDoc = await getDoc(doc(db, 'users', user.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setError(
          <span className="flex items-center gap-1">
            Conta não encontrada. <Link to="/cadastro" className="underline hover:text-red-900 transition">Crie sua loja para começar.</Link>
          </span>
        )
        return
      }

      const userData = userDoc.data() || {}
      const redirectPath = getPostLoginRoute(userData)
      navigate(redirectPath, { replace: true })
    } catch (err) {
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

  // ── handlePasswordReset (preservado integralmente) ─────────
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

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#f97316]"></div>
          <p className="text-sm font-bold text-gray-500">Verificando sessão...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f9fafb] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
      <LoginMobileHeader />

      {/* BLOBS FLUTUANTES */}
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

      {/* GRID PRINCIPAL */}
      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">

        {/* ── LADO ESQUERDO — painel de apresentação ─── */}
        <section className="relative hidden overflow-hidden bg-[#111827] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-12">
          {/* gradientes internos do painel escuro */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#f97316]/25 blur-3xl" />
            <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#fb923c]/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_32rem)]" />
            {/* grade sutil para textura */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          {/* topo: logo + link "Voltar ao site" */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <PratoByLogo dark />
            <Link
              to="/"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur transition hover:bg-white hover:text-[#111827]"
            >
              Voltar ao site
            </Link>
          </div>

          {/* centro: headline + benefícios */}
          <div className="relative z-10 max-w-2xl py-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-orange-100 backdrop-blur">
              <FiShield className="text-[#f97316]" />
              Painel exclusivo para lojistas e administradores
            </span>

            <h1 className="mt-8 max-w-xl text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">
              Seu delivery próprio,
              <span className="block text-[#f97316]">sem comissão.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-gray-300">
              Entre para gerenciar pedidos, cardápio, horários, entrega e atendimento em
              uma experiência rápida, segura e feita para vender pelo link da sua loja.
            </p>

            <div className="mt-9 grid gap-3 text-sm font-bold text-gray-200 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition duration-200 hover:border-orange-500/30 hover:bg-white/8"
                >
                  <FiCheckCircle className="shrink-0 text-[#f97316]" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          {/* base: dois cards informativos */}
          <div className="relative z-10 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            {/* card PratoBy Cloud */}
            <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] shadow-lg shadow-orange-950/20">
                  <FiZap size={22} />
                </div>
                <div>
                  <p className="font-black">PratoBy Cloud</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-gray-300">
                    Cardápio digital e delivery white-label para negócios locais venderem
                    direto, sem depender de marketplace.
                  </p>
                </div>
              </div>
            </div>

            {/* card métricas */}
            <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <FiTrendingUp className="text-[#f97316]" />
                Visão rápida da operação
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {METRICS.map((metric, i) => (
                  <div
                    key={metric.label}
                    className={`rounded-2xl bg-white/10 p-3 ${
                      i < METRICS.length - 1 ? 'border-r border-white/5' : ''
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/45">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">{metric.value}</p>
                    <p className="text-xs font-bold text-orange-100/70">{metric.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── LADO DIREITO — formulário de login ─── */}
        <section className="flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="w-full max-w-md">

            {/* CARD PRINCIPAL */}
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-5 shadow-2xl shadow-orange-900/10 backdrop-blur sm:p-8"
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {/* barra logo — só desktop (dentro do card) */}
                <motion.div
                  variants={fadeUp}
                  className="mb-8 hidden rounded-[1.5rem] border border-gray-100 bg-[#fafafa] p-3 shadow-sm lg:flex lg:items-center lg:justify-between lg:gap-4"
                >
                  <PratoByLogo compact />
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#9ca3af] ring-1 ring-gray-100">
                    v{APP_VERSION}
                  </span>
                </motion.div>

                {/* headline */}
                <motion.div variants={fadeUp} className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                    <FiShield size={12} />
                    Acesso seguro
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                    Entrar no painel
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                    Acesse sua conta para gerenciar pedidos, loja, cardápio, horários e
                    configurações.
                  </p>
                </motion.div>

                {/* alertas com AnimatePresence para saída suave */}
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

                {/* Botão Google */}
                <motion.div variants={fadeUp} className="mb-5">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-black text-[#374151] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <GoogleIcon size={18} />
                    Entrar com Google
                  </button>

                  <div className="mt-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-[11px] font-black text-[#9ca3af]">ou entre com seu e-mail</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                </motion.div>

                {/* formulário */}
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        disabled={isLoading}
                      >
                        {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                      </button>
                    }
                  />

                  {/* lembrar + esqueci */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#6b7280]">
                      <input
                        type="checkbox"
                        checked={rememberAccess}
                        onChange={(e) => setRememberAccess(e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-orange-200 text-[#f97316] accent-[#f97316] focus:ring-[#f97316]"
                      />
                      Manter conectado neste dispositivo
                    </label>

                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isResettingPassword || isLoading}
                      className="text-xs font-black text-[#f97316] transition hover:text-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResettingPassword ? 'Enviando...' : 'Esqueci minha senha'}
                    </button>
                  </div>

                  {/* CTA principal */}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <>
                        <FiLoader className="animate-spin" size={16} />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar no painel
                        <FiArrowRight
                          size={16}
                          className="transition group-hover:translate-x-0.5"
                        />
                      </>
                    )}
                  </button>
                </motion.form>

                {/* bloco "Ainda não tem conta?" — visual mais premium */}
                <motion.div
                  variants={fadeUp}
                  className="mt-6 overflow-hidden rounded-3xl border border-orange-100/70 bg-orange-50/40"
                >
                  {/* linha superior: info da plataforma */}
                  <div className="flex gap-3 border-b border-orange-100/60 p-4">
                    <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" size={16} />
                    <div>
                      <p className="text-sm font-black text-[#111827]">
                        Plataforma para operação real
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Use o painel para gerenciar loja, pedidos, cardápio e atendimento
                        em tempo real.
                      </p>
                    </div>
                  </div>

                  {/* linha inferior: CTA de cadastro */}
                  <div className="flex items-center gap-3 p-4">
                    <FiHelpCircle className="shrink-0 text-[#f97316]" size={16} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#111827]">
                        Ainda não tem conta?
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">
                      Crie sua loja e comece seu teste grátis.
                      </p>
                    </div>
                    <Link
                      to="/cadastro"
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-[#f97316] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-600/15 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-lg hover:shadow-orange-600/20 active:scale-[0.98]"
                    >
                      Criar minha loja
                      <FiArrowRight size={13} />
                    </Link>
                  </div>
                </motion.div>

                {/* rodapé do card */}
                <motion.div
                  variants={fadeUp}
                  className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-5 text-xs font-bold text-[#6b7280]"
                >
                  <span>PratoBy Cloud · {APP_ENV}</span>
                  <span className="inline-flex items-center gap-1">
                    <FiClock size={12} />© {new Date().getFullYear()} PratoBy
                  </span>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* links de navegação abaixo do card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#6b7280]"
            >
              <Link to="/" className="transition hover:text-[#111827]">
                Início
              </Link>
              <Link to="/sobre" className="transition hover:text-[#111827]">
                Sobre
              </Link>
              <Link
                to="/contato"
                className="inline-flex items-center gap-1 transition hover:text-[#111827]"
              >
                <FiMessageCircle size={12} />
                Contato
              </Link>
              <span className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <FiSmartphone size={12} />
                Mobile-first
              </span>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  )
}