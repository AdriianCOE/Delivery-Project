// ─────────────────────────────────────────────────────────────
// src/pages/auth/OnboardingPage.jsx
// Página de onboarding pendente — merchant criou conta mas
// ainda não completou verificação / ativação de loja.
// ─────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { sendEmailVerification } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiLogOut,
  FiMessageCircle,
  FiPhone,
  FiShield,
  FiShoppingBag,
  FiUser,
  FiZap,
  FiMail,
  FiRefreshCw,
  FiSend,
  FiAlertCircle,
} from 'react-icons/fi'

import { useAuth } from '../../contexts/AuthContext'
import { auth as firebaseAuth, functions } from '../../services/firebase'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'account',
    label: 'Conta criada',
    icon: FiUser,
    status: 'completed',
    description: 'Sua conta foi registrada com sucesso',
  },
  {
    id: 'whatsapp',
    label: 'Confirmar WhatsApp',
    icon: FiPhone,
    status: 'current',
    description: 'Validar número para receber pedidos',
  },
  {
    id: 'trial',
    label: 'Iniciar teste grátis',
    icon: FiZap,
    status: 'upcoming',
    description: 'Ativar período de 14 dias sem custo',
  },
  {
    id: 'store',
    label: 'Ativar loja',
    icon: FiShoppingBag,
    status: 'upcoming',
    description: 'Configurar cardápio e começar a vender',
  },
]

// ─────────────────────────────────────────────────────────────
// ANIMAÇÕES (alinhadas com LoginPage / SignupPage)
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
// HEADER MOBILE (mesmo padrão Login / Signup)
// ─────────────────────────────────────────────────────────────

function OnboardingMobileHeader() {
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
          Início
        </Link>
      </div>
    </motion.header>
  )
}

// ─────────────────────────────────────────────────────────────
// STEP ITEM
// ─────────────────────────────────────────────────────────────

function StepItem({ step, index, isLast }) {
  const Icon = step.icon

  const isCompleted = step.status === 'completed'
  const isCurrent = step.status === 'current'

  return (
    <div className="flex gap-4">
      {/* coluna do ícone + linha vertical */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
            isCompleted
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : isCurrent
                ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/25 ring-4 ring-orange-100'
                : 'bg-gray-100 text-gray-400'
          }`}
        >
          {isCompleted ? <FiCheckCircle size={18} /> : <Icon size={18} />}
        </div>

        {!isLast && (
          <div
            className={`mt-2 w-0.5 flex-1 rounded-full ${
              isCompleted ? 'bg-emerald-200' : 'bg-gray-200'
            }`}
            style={{ minHeight: '1.5rem' }}
          />
        )}
      </div>

      {/* conteúdo do passo */}
      <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
        <p
          className={`text-sm font-black ${
            isCompleted
              ? 'text-emerald-600'
              : isCurrent
                ? 'text-[#111827]'
                : 'text-gray-400'
          }`}
        >
          {step.label}
          {isCompleted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-600 ring-1 ring-emerald-100">
              Feito
            </span>
          )}
          {isCurrent && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f97316] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f97316]" />
              </span>
              Próxima
            </span>
          )}
        </p>
        <p
          className={`mt-1 text-xs font-semibold leading-5 ${
            isCurrent ? 'text-[#6b7280]' : 'text-gray-400'
          }`}
        >
          {step.description}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [resendStatus, setResendStatus] = useState({ type: '', message: '' })
  const [isResending, setIsResending] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [showPhoneCode, setShowPhoneCode] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState({ type: '', message: '' })
  const [isRequestingPhone, setIsRequestingPhone] = useState(false)
  const [isConfirmingPhone, setIsConfirmingPhone] = useState(false)
  const [phoneDebugCode, setPhoneDebugCode] = useState('')

  const [isStartingTrial, setIsStartingTrial] = useState(false)
  const [trialStatus, setTrialStatus] = useState({ type: '', message: '' })

  function getCallableErrorCode(error) {
    return String(error?.code || '').replace('functions/', '')
  }

  const isLoading =
    auth?.loading === true ||
    auth?.authLoading === true ||
    auth?.isLoading === true

  const handleLogout = useCallback(async () => {
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }, [auth, navigate])

  // Se não está logado (e não carregando), manda pro login
  if (!isLoading && !auth?.user) {
    return <Navigate to="/login" replace />
  }

  // Se é admin/developer, manda pro admin
  if (
    !isLoading &&
    auth?.role &&
    ['admin', 'developer'].includes(auth.role)
  ) {
    return <Navigate to="/admin" replace />
  }

  // Se é merchant ativo (com loja), manda pro dashboard
  if (!isLoading && auth?.role === 'merchant') {
    const onboardingStatus =
      auth?.userData?.onboardingStatus ||
      auth?.user?.onboardingStatus ||
      ''

    const subscriptionStatus =
      auth?.userData?.subscriptionStatus ||
      auth?.user?.subscriptionStatus ||
      ''

    const hasMerchantStore =
      Boolean(auth?.storeId || auth?.userData?.storeId || auth?.user?.storeId) ||
      (Array.isArray(auth?.storeIds) && auth.storeIds.length > 0) ||
      (Array.isArray(auth?.userData?.storeIds) && auth.userData.storeIds.length > 0) ||
      (Array.isArray(auth?.user?.storeIds) && auth.user.storeIds.length > 0)

    const isPending =
      !hasMerchantStore ||
      ['phone_pending'].includes(onboardingStatus) ||
      ['pending_checkout'].includes(subscriptionStatus)

    if (!isPending) {
      return <Navigate to="/dashboard" replace />
    }
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f9fafb] px-6">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#f97316] text-white shadow-xl shadow-orange-600/20">
            <FiShield size={28} />
          </div>
          <p className="mt-5 text-lg font-black tracking-tight text-[#111827]">
            PratoBy
          </p>
          <p className="mt-1 text-sm font-medium text-[#6b7280]">
            Carregando sua conta...
          </p>
          <div className="mx-auto mt-5 h-2 w-40 overflow-hidden rounded-full bg-orange-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#f97316]" />
          </div>
        </div>
      </div>
    )
  }

  const displayName =
    auth?.user?.displayName ||
    auth?.userData?.ownerName ||
    auth?.user?.email?.split('@')[0] ||
    ''

  const email = firebaseAuth.currentUser?.email || auth?.user?.email || ''
  const emailVerified = firebaseAuth.currentUser?.emailVerified || auth?.user?.emailVerified || false
  const isGoogleProvider = firebaseAuth.currentUser?.providerData?.some(
    (provider) => provider.providerId === 'google.com'
  ) || false

  const handleResendVerificationEmail = async () => {
    setResendStatus({ type: '', message: '' })
    if (!firebaseAuth.currentUser) {
      setResendStatus({ type: 'error', message: 'Sessão expirada. Faça login novamente.' })
      return
    }
    if (emailVerified) {
      setResendStatus({ type: 'success', message: 'Seu e-mail já está confirmado.' })
      return
    }
    
    setIsResending(true)
    try {
      await sendEmailVerification(firebaseAuth.currentUser)
      setResendStatus({ type: 'success', message: 'Enviamos um novo e-mail de verificação.' })
    } catch (error) {
      if (error?.code === 'auth/too-many-requests') {
        setResendStatus({ type: 'error', message: 'Muitas tentativas. Aguarde alguns minutos antes de reenviar.' })
      } else {
        setResendStatus({ type: 'error', message: 'Não foi possível reenviar o e-mail agora.' })
      }
    } finally {
      setIsResending(false)
    }
  }

  const handleRefreshEmailStatus = async () => {
    setResendStatus({ type: '', message: '' })
    if (!firebaseAuth.currentUser) {
      setResendStatus({ type: 'error', message: 'Sessão expirada. Faça login novamente.' })
      return
    }
    
    setIsRefreshing(true)
    try {
      await firebaseAuth.currentUser.reload()
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      if (firebaseAuth.currentUser.emailVerified) {
        setResendStatus({ type: 'success', message: 'E-mail confirmado com sucesso.' })
      } else {
        setResendStatus({ type: 'error', message: 'Ainda não identificamos a confirmação. Verifique sua caixa de entrada.' })
      }
    } catch (error) {
      setResendStatus({ type: 'error', message: 'Não foi possível verificar o status no momento.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRequestPhoneCode = async (e) => {
    e?.preventDefault()
    setPhoneStatus({ type: '', message: '' })
    setPhoneDebugCode('')
    
    if (!phone) {
      setPhoneStatus({ type: 'error', message: 'Digite seu WhatsApp.' })
      return
    }

    setIsRequestingPhone(true)
    try {
      const requestVerification = httpsCallable(functions, 'requestPhoneVerification')
      const result = await requestVerification({ phone })
      
      if (result.data?.alreadyVerified) {
        setPhoneStatus({ type: 'success', message: 'Seu WhatsApp já estava confirmado!' })
        if (auth.refreshUserData) await auth.refreshUserData()
        return
      }

      setShowPhoneCode(true)
      setPhoneStatus({ type: 'success', message: 'Código enviado com sucesso!' })
      
      if (result.data?.debugCode) {
        setPhoneDebugCode(result.data.debugCode)
      }
    } catch (error) {
      const code = getCallableErrorCode(error)
      let msg = 'Não foi possível enviar o código agora.'
      
      if (code === 'already-exists') msg = 'Este WhatsApp já está vinculado a outra conta.'
      if (code === 'resource-exhausted') msg = 'Muitas tentativas. Aguarde alguns minutos.'
      if (code === 'invalid-argument') msg = error.message || 'Número inválido.'
      if (code === 'unauthenticated') msg = 'Sua sessão expirou. Entre novamente.'
      if (code === 'failed-precondition') msg = error.message || msg
      
      setPhoneStatus({ type: 'error', message: msg })
    } finally {
      setIsRequestingPhone(false)
    }
  }

  const handleConfirmPhoneCode = async (e) => {
    e?.preventDefault()
    setPhoneStatus({ type: '', message: '' })
    
    if (!phoneCode || phoneCode.length !== 6) {
      setPhoneStatus({ type: 'error', message: 'Digite o código de 6 dígitos.' })
      return
    }

    setIsConfirmingPhone(true)
    try {
      const confirmVerification = httpsCallable(functions, 'confirmPhoneVerification')
      await confirmVerification({ code: phoneCode })
      
      setPhoneStatus({ type: 'success', message: 'WhatsApp confirmado com sucesso!' })
      setShowPhoneCode(false)
      
      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
    } catch (error) {
      const code = getCallableErrorCode(error)
      let msg = 'Não foi possível confirmar o código.'
      
      if (code === 'invalid-argument') msg = 'Código inválido ou incorreto.'
      if (code === 'deadline-exceeded') msg = 'Código expirado. Envie um novo código.'
      if (code === 'resource-exhausted') msg = 'Muitas tentativas. Solicite um novo código mais tarde.'
      if (code === 'failed-precondition') msg = error.message || msg
      if (code === 'permission-denied') msg = 'Permissão negada.'
      
      setPhoneStatus({ type: 'error', message: msg })
    } finally {
      setIsConfirmingPhone(false)
    }
  }

  const handleStartTrial = async () => {
    setTrialStatus({ type: '', message: '' })
    setIsStartingTrial(true)

    try {
      const startTrial = httpsCallable(functions, 'startFreeTrial')
      await startTrial()

      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
      
      // Navigate to billing page after onboarding
      navigate('/dashboard/billing', { replace: true })
    } catch (error) {
      const code = getCallableErrorCode(error)
      let msg = 'Não foi possível iniciar o teste grátis no momento.'

      if (code === 'unauthenticated') msg = 'Sua sessão expirou. Faça login novamente.'
      if (code === 'permission-denied') msg = 'Acesso negado.'
      if (code === 'failed-precondition') msg = error.message || 'Complete as etapas anteriores primeiro.'
      if (code === 'already-exists') msg = error.message || 'Você já possui uma loja ou trial.'
      if (code === 'resource-exhausted') msg = error.message || 'Muitas tentativas simultâneas.'

      setTrialStatus({ type: 'error', message: msg })
    } finally {
      setIsStartingTrial(false)
    }
  }

  const userPhoneVerified = auth?.user?.phoneVerified || auth?.userData?.phoneVerified || false
  const userPhoneE164 = auth?.user?.phoneE164 || auth?.userData?.phoneE164 || ''

  // ── Render ─────────────────────────────────────────────────
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f9fafb] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
      <OnboardingMobileHeader />

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

      {/* CONTEÚDO CENTRAL */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="w-full max-w-md">

          {/* CARD PRINCIPAL */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-5 shadow-2xl shadow-orange-900/10 backdrop-blur sm:p-8"
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {/* Logo bar — desktop */}
              <motion.div
                variants={fadeUp}
                className="mb-8 hidden rounded-[1.5rem] border border-gray-100 bg-[#fafafa] p-3 shadow-sm lg:flex lg:items-center lg:justify-between lg:gap-4"
              >
                <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Ir para início">
                  <img
                    src="/icons/icon-192.png"
                    alt="PratoBy"
                    className="h-10 w-10 rounded-2xl object-cover shadow-lg shadow-orange-600/20 ring-1 ring-black/5 transition duration-300 group-hover:scale-105"
                  />
                  <div className="min-w-0 leading-none">
                    <p className="text-xl font-black tracking-tighter text-[#111827]">
                      Prato<span className="text-[#f97316]">By</span>
                    </p>
                    <p className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                      Cardápio digital e delivery
                    </p>
                  </div>
                </Link>
                <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#9ca3af] ring-1 ring-gray-100">
                  Onboarding
                </span>
              </motion.div>

              {/* Badge + headline */}
              <motion.div variants={fadeUp} className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-600 ring-1 ring-emerald-100">
                  <FiCheckCircle size={12} />
                  Conta criada com sucesso
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  {displayName ? (
                    <>Bem-vindo, {displayName}!</>
                  ) : (
                    <>Conta criada com sucesso</>
                  )}
                </h1>

                <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
                  Agora falta confirmar seu WhatsApp e finalizar a ativação da sua loja.
                </p>
              </motion.div>

              {/* ETAPAS VISUAIS */}
              <motion.div
                variants={fadeUp}
                className="mb-6 rounded-[1.5rem] border border-orange-100/60 bg-orange-50/30 p-5"
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  <FiClock size={12} className="text-[#f97316]" />
                  Progresso do cadastro
                </div>

                {STEPS.map((step, index) => {
                  let status = step.status
                  if (step.id === 'whatsapp') {
                    status = userPhoneVerified ? 'completed' : 'current'
                  }
                  if (step.id === 'trial') {
                    status = userPhoneVerified ? 'current' : 'upcoming'
                  }
                  return (
                    <StepItem
                      key={step.id}
                      step={{ ...step, status }}
                      index={index}
                      isLast={index === STEPS.length - 1}
                    />
                  )
                })}
              </motion.div>

              {/* SEGURANÇA DA CONTA */}
              <motion.div
                variants={fadeUp}
                className="mb-6 rounded-[1.5rem] border border-orange-100/60 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  <FiShield size={12} className="text-[#f97316]" />
                  Segurança da conta
                </div>

                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    emailVerified ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
                  }`}>
                    <FiMail size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#111827]">
                      {emailVerified ? 'E-mail confirmado' : 'Confirmação de e-mail'}
                    </p>
                    
                    {isGoogleProvider ? (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Seu e-mail <strong className="text-[#111827]">{email}</strong> foi validado pelo Google.
                      </p>
                    ) : emailVerified ? (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Seu e-mail <strong className="text-[#111827]">{email}</strong> já foi confirmado.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                          Enviamos um link de verificação para <strong className="text-[#111827]">{email}</strong>. 
                          Confirme seu e-mail para manter sua conta segura.
                        </p>

                        {resendStatus.message && (
                          <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-bold leading-5 ${
                            resendStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {resendStatus.type === 'success' ? <FiCheckCircle size={15} className="shrink-0 mt-0.5" /> : <FiAlertCircle size={15} className="shrink-0 mt-0.5" />}
                            <span>{resendStatus.message}</span>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleRefreshEmailStatus}
                            disabled={isRefreshing}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#f97316] transition hover:bg-orange-100 disabled:opacity-50 sm:text-xs sm:normal-case sm:tracking-normal"
                          >
                            <FiRefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                            Verificar novamente
                          </button>
                          <button
                            type="button"
                            onClick={handleResendVerificationEmail}
                            disabled={isResending}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] disabled:opacity-50 sm:text-xs sm:normal-case sm:tracking-normal"
                          >
                            <FiSend size={12} />
                            Reenviar e-mail
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* PRÓXIMA ETAPA — CONFIRMAÇÃO DE WHATSAPP / TELEFONE */}
              <motion.div
                variants={fadeUp}
                className={`mb-6 rounded-[1.5rem] border p-5 ${
                  userPhoneVerified
                    ? 'border-emerald-100/60 bg-emerald-50/30'
                    : 'border-orange-200/60 bg-gradient-to-br from-orange-50 to-amber-50/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${
                    userPhoneVerified 
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                      : 'bg-[#f97316] text-white shadow-orange-600/20'
                  }`}>
                    {userPhoneVerified ? <FiCheckCircle size={22} /> : <FiMessageCircle size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#111827]">
                      {userPhoneVerified ? 'WhatsApp confirmado' : 'Confirmar WhatsApp'}
                    </p>
                    
                    {userPhoneVerified ? (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Seu número <strong className="text-[#111827]">{userPhoneE164}</strong> foi confirmado com sucesso.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                          Precisamos confirmar seu número para ativar as notificações de novos pedidos da sua loja.
                        </p>

                        {phoneStatus.message && (
                          <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-bold leading-5 ${
                            phoneStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {phoneStatus.type === 'success' ? <FiCheckCircle size={15} className="shrink-0 mt-0.5" /> : <FiAlertCircle size={15} className="shrink-0 mt-0.5" />}
                            <span>{phoneStatus.message}</span>
                          </div>
                        )}

                        {!showPhoneCode ? (
                          <form onSubmit={handleRequestPhoneCode} className="mt-4 flex flex-col gap-2">
                            <input
                              type="tel"
                              placeholder="DDD + Número (Ex: 11999999999)"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                              disabled={isRequestingPhone}
                              className="h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-[#111827] outline-none placeholder:text-gray-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                              required
                            />
                            <button
                              type="submit"
                              disabled={isRequestingPhone || !phone}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#ea580c] disabled:opacity-50"
                            >
                              {isRequestingPhone ? <FiRefreshCw className="animate-spin" size={14} /> : <FiSend size={14} />}
                              Enviar código
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={handleConfirmPhoneCode} className="mt-4 flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Código de 6 dígitos"
                              value={phoneCode}
                              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              disabled={isConfirmingPhone}
                              className="h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-center text-lg font-black tracking-widest text-[#111827] outline-none placeholder:text-gray-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                              required
                            />
                            
                            {phoneDebugCode && (
                              <div className="rounded-lg bg-orange-100 p-2 text-center text-xs font-bold text-orange-800">
                                (Dev) Código de teste: {phoneDebugCode}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={isConfirmingPhone || phoneCode.length !== 6}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#ea580c] disabled:opacity-50"
                            >
                              {isConfirmingPhone ? <FiRefreshCw className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
                              Confirmar código
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPhoneCode(false)
                                setPhoneStatus({ type: '', message: '' })
                              }}
                              disabled={isConfirmingPhone}
                              className="mt-1 text-xs font-bold text-[#6b7280] hover:text-[#111827]"
                            >
                              Voltar / Alterar número
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* BOTÕES DE AÇÃO */}
              <motion.div variants={fadeUp} className="space-y-3">
                {trialStatus.message && (
                  <div className={`flex items-start gap-2 rounded-xl p-3 text-xs font-bold leading-5 ${
                    trialStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {trialStatus.type === 'success' ? <FiCheckCircle size={15} className="shrink-0 mt-0.5" /> : <FiAlertCircle size={15} className="shrink-0 mt-0.5" />}
                    <span>{trialStatus.message}</span>
                  </div>
                )}

                {/* CTA principal */}
                {userPhoneVerified ? (
                  <>
                    <div className="mb-4 text-center px-2">
                      <p className="text-[13px] font-semibold leading-relaxed text-[#6b7280]">
                        Seu teste começa quando a loja for criada. Durante o teste, você pode configurar cardápio, receber pedidos e validar sua operação.
                      </p>
                    </div>
                  <button
                    type="button"
                    onClick={handleStartTrial}
                    disabled={isStartingTrial}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isStartingTrial ? (
                      <>
                        <FiRefreshCw size={16} className="animate-spin" />
                        Ativando loja...
                      </>
                    ) : (
                      <>
                        <FiZap size={16} />
                        Ativar 14 dias grátis
                        <FiArrowRight
                          size={16}
                          className="transition group-hover:translate-x-0.5"
                        />
                      </>
                    )}
                  </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!showPhoneCode) {
                        document.querySelector('input[type="tel"]')?.focus()
                      } else {
                        document.querySelector('input[type="text"]')?.focus()
                      }
                    }}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98]"
                  >
                    Confirmar WhatsApp
                    <FiArrowRight
                      size={16}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </button>
                )}

                {/* Ações secundárias */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-[#6b7280] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:text-[#111827] active:scale-[0.98]"
                  >
                    <FiLogOut size={15} />
                    Sair da conta
                  </button>


                  <Link
                    to="/login"
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-[#6b7280] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:text-[#111827] active:scale-[0.98]"
                  >
                    <FiUser size={15} />
                    Outra conta
                  </Link>
                </div>
              </motion.div>

              {/* Rodapé do card */}
              <motion.div
                variants={fadeUp}
                className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-5 text-xs font-bold text-[#6b7280]"
              >
                <span>PratoBy Cloud · Onboarding</span>
                <span className="inline-flex items-center gap-1">
                  <FiClock size={12} />© {new Date().getFullYear()} PratoBy
                </span>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Links abaixo do card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#6b7280]"
          >
            <Link to="/" className="transition hover:text-[#111827]">
              Início
            </Link>
            <Link to="/contato" className="inline-flex items-center gap-1 transition hover:text-[#111827]">
              <FiMessageCircle size={12} />
              Contato
            </Link>
            <Link to="/planos" className="transition hover:text-[#111827]">
              Planos
            </Link>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
