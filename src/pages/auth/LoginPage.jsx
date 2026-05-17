import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { motion } from 'framer-motion'
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

import { auth, db } from '../../services/firebase'

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

function getPanelPathByRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()

  if (['admin', 'developer', 'dev', 'superadmin', 'owner'].includes(normalizedRole)) {
    return '/admin'
  }

  return '/dashboard'
}

function getSafeRedirectPath(fromLocation, role) {
  const fallbackPath = getPanelPathByRole(role)
  const requestedPath =
    typeof fromLocation === 'string'
      ? fromLocation
      : fromLocation?.pathname

  if (!requestedPath || requestedPath === '/' || requestedPath === '/login') {
    return fallbackPath
  }

  if (!requestedPath.startsWith('/')) {
    return fallbackPath
  }

  if (requestedPath.startsWith('/admin')) {
    return ['admin', 'developer', 'dev', 'superadmin', 'owner'].includes(role)
      ? requestedPath
      : fallbackPath
  }

  if (requestedPath.startsWith('/dashboard')) {
    return requestedPath
  }

  return fallbackPath
}

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
          className={`mt-1 truncate text-[10px] font-bold uppercase tracking-widest ${
            dark ? 'text-white/55' : 'text-[#9ca3af]'
          }`}
        >
          Cardápio digital e delivery
        </p>
      </div>
    </Link>
  )
}

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
            size={18}
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

function AlertBox({ type = 'error', children }) {
  const isSuccess = type === 'success'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${
        isSuccess
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-red-100 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <FiCheckCircle className="mt-0.5 shrink-0" size={18} />
        ) : (
          <FiAlertCircle className="mt-0.5 shrink-0" size={18} />
        )}

        <span>{children}</span>
      </div>
    </motion.div>
  )
}

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
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
}

const floatAnimation = {
  animate: {
    y: [0, -14, 0],
    scale: [1, 1.03, 1],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberAccess, setRememberAccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const canSubmit = Boolean(cleanEmail && password && !isLoading && !isResettingPassword)

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

      const userData = userDoc.data() || {}
      const role = normalizeRole(userData)
      const redirectPath = getSafeRedirectPath(location.state?.from, role)

      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(getFriendlyAuthError(err?.code))
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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f9fafb] text-[#111827] selection:bg-orange-100 selection:text-[#f97316] antialiased">
      
      {/* 1. BLOBS FLUTUANTES (Animados com Framer Motion) */}
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

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
        
        {/* LADO ESQUERDO (Apresentação - Mantido igual) */}
        <section className="relative hidden overflow-hidden bg-[#111827] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#f97316]/25 blur-3xl" />
            <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#fb923c]/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_32rem)]" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4">
            <PratoByLogo dark />

            <Link
              to="/"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur transition hover:bg-white hover:text-[#111827]"
            >
              Voltar ao site
            </Link>
          </div>

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
              Entre para gerenciar pedidos, cardápio, horários, entrega e atendimento em uma experiência rápida, segura e feita para vender pelo link da sua loja.
            </p>

            <div className="mt-9 grid gap-3 text-sm font-bold text-gray-200 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <FiCheckCircle className="shrink-0 text-[#f97316]" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] shadow-lg shadow-orange-950/20">
                  <FiZap size={22} />
                </div>

                <div>
                  <p className="font-black">PratoBy Cloud</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-gray-300">
                    Cardápio digital e delivery white-label para negócios locais venderem direto, sem depender de marketplace.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <FiTrendingUp className="text-[#f97316]" />
                Visão rápida da operação
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {METRICS.map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-white/10 p-3">
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

        {/* LADO DIREITO (Login) */}
        <section className="flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
              <PratoByLogo compact />

              <Link
                to="/"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-[#111827] shadow-sm transition hover:text-[#f97316] active:scale-95"
                aria-label="Voltar para início"
              >
                <FiArrowLeft />
              </Link>
            </div>

            {/* 2. CARTÃO DE LOGIN COM ANIMAÇÃO PRINCIPAL */}
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-5 shadow-2xl shadow-orange-900/10 backdrop-blur sm:p-8"
            >
              
              {/* 3. WRAPPER DO STAGGER CONTAINER */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                
                {/* ELEMENTOS FILHOS ANIMADOS EM CASCATA COM FADEUP */}
                <motion.div variants={fadeUp} className="mb-8 hidden items-start justify-between gap-4 lg:flex">
                  <PratoByLogo />

                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#f97316] ring-1 ring-orange-100">
                    v{APP_VERSION}
                  </span>
                </motion.div>

                <motion.div variants={fadeUp} className="mb-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
                    <FiShield />
                    Acesso seguro
                  </div>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                    Entrar no painel
                  </h2>

                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                    Acesse sua conta para gerenciar pedidos, loja, cardápio, horários e configurações.
                  </p>
                </motion.div>

                {error && (
                  <motion.div variants={fadeUp}>
                    <AlertBox>{error}</AlertBox>
                  </motion.div>
                )}

                {success && (
                  <motion.div variants={fadeUp}>
                    <AlertBox type="success">{success}</AlertBox>
                  </motion.div>
                )}

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
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        disabled={isLoading}
                      >
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    }
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#6b7280]">
                      <input
                        type="checkbox"
                        checked={rememberAccess}
                        onChange={(event) => setRememberAccess(event.target.checked)}
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

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <>
                        <FiLoader className="animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar no painel
                        <FiArrowRight className="transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </motion.form>

                <motion.div variants={fadeUp} className="mt-6 grid gap-3 rounded-3xl border border-orange-100/70 bg-orange-50/40 p-4">
                  <div className="flex gap-3">
                    <FiInfo className="mt-0.5 shrink-0 text-[#f97316]" />

                    <div>
                      <p className="text-sm font-black text-[#111827]">
                        Plataforma para operação real
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Use o painel para gerenciar loja, pedidos, cardápio e atendimento em tempo real.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <FiHelpCircle className="mt-0.5 shrink-0 text-[#f97316]" />

                    <div>
                      <p className="text-sm font-black text-[#111827]">
                        Precisa de acesso?
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Fale com o responsável pela implantação da sua loja ou entre em contato com o suporte.
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-5 text-xs font-bold text-[#6b7280]">
                  <span>PratoBy Cloud · {APP_ENV}</span>

                  <span className="inline-flex items-center gap-1">
                    <FiClock />
                    © {new Date().getFullYear()} PratoBy
                  </span>
                </motion.div>
                
              </motion.div>
            </motion.div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#6b7280]">
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
                <FiMessageCircle />
                Contato
              </Link>
              <span className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <FiSmartphone />
                Mobile-first
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}