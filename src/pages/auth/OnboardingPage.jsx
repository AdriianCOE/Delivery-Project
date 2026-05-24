// ─────────────────────────────────────────────────────────────
// src/pages/auth/OnboardingPage.jsx
// Página de onboarding pendente — merchant criou conta mas
// ainda não completou verificação / ativação de loja.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  unlink,
} from 'firebase/auth'
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
  FiX,
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
    label: 'Confirmar telefone',
    icon: FiPhone,
    status: 'current',
    description: 'Validar número para receber pedidos',
  },
  {
    id: 'trial',
    label: 'Configurar cobrança',
    icon: FiZap,
    status: 'upcoming',
    description: 'Ativar 14 dias grátis no próximo passo',
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
// ANIMAÇÕES
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
// VALIDAÇÃO DE TELEFONE BRASILEIRO
// ─────────────────────────────────────────────────────────────

function validateBrazilianMobilePhone(value) {
  const rawDigits = String(value || '').replace(/\D/g, '')
  let nationalDigits = ''

  if (rawDigits.length === 13 && rawDigits.startsWith('55')) {
    nationalDigits = rawDigits.slice(2)
  } else if (rawDigits.length === 11) {
    nationalDigits = rawDigits
  } else {
    return { ok: false }
  }

  const ddd = nationalDigits.slice(0, 2)
  const localNumber = nationalDigits.slice(2)
  const localTail = localNumber.slice(1)

  if (ddd.startsWith('0') || localNumber.length !== 9 || localNumber[0] !== '9') {
    return { ok: false }
  }

  const repeatedRun = /(\d)\1{4,}/
  const obviousLocalNumbers = new Set([
    '999999999',
    '999111111',
    '900000000',
    '911111111',
  ])

  if (
    /^(\d)\1+$/.test(nationalDigits) ||
    /(\d)\1{3}$/.test(localNumber) ||
    repeatedRun.test(localNumber) ||
    obviousLocalNumbers.has(localNumber) ||
    ['12345678', '87654321', '11111111', '00000000'].some((pattern) => localTail.includes(pattern))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    phoneDigits: `55${nationalDigits}`,
    phoneE164: `+55${nationalDigits}`,
  }
}

function normalizeBrazilianPhoneE164(value) {
  const validatedPhone = validateBrazilianMobilePhone(value)
  return validatedPhone.ok ? validatedPhone.phoneE164 : null
}

function toBrazilianPhoneInput(value) {
  const normalized = normalizeBrazilianPhoneE164(value)
  if (!normalized) return String(value || '').replace(/\D/g, '')
  return normalized.replace(/^\+55/, '')
}

function formatBrazilianPhone(value) {
  const normalized = normalizeBrazilianPhoneE164(value)
  if (!normalized) return String(value || '')

  const digits = normalized.replace(/^\+55/, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
}

function pickExistingPhone(...values) {
  for (const value of values) {
    const normalized = normalizeBrazilianPhoneE164(value)
    if (normalized) return normalized
  }
  return ''
}

function shouldUnlinkPhoneAfterBackendFailure(error) {
  const callableCode = String(error?.code || '').replace('functions/', '')
  return ['already-exists', 'permission-denied', 'failed-precondition'].includes(callableCode)
}

function getLinkedPhoneMismatchMessage() {
  return 'Sua conta já possui outro telefone vinculado. Para alterar, use a área de perfil ou suporte.'
}

// ─────────────────────────────────────────────────────────────
// HEADER MOBILE
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

  // — e-mail —
  const [resendStatus, setResendStatus] = useState({ type: '', message: '' })
  const [isResending, setIsResending] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // — telefone —
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [showPhoneCode, setShowPhoneCode] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState({ type: '', message: '' })
  const [isRequestingPhone, setIsRequestingPhone] = useState(false)
  const [isConfirmingPhone, setIsConfirmingPhone] = useState(false)
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneSendCount, setPhoneSendCount] = useState(0)
  const [phoneCooldownUntil, setPhoneCooldownUntil] = useState(0)
  const [phoneCooldownNow, setPhoneCooldownNow] = useState(() => Date.now())
  const recaptchaVerifierRef = useRef(null)
  const phoneVerificationIdRef = useRef('')
  const phoneSeededRef = useRef(false)
  const phoneCodeInputRef = useRef(null)

  // — trial —
  const [isStartingTrial, setIsStartingTrial] = useState(false)
  const [trialStatus, setTrialStatus] = useState({ type: '', message: '' })

  // ── helpers ──────────────────────────────────────────────

  function getCallableErrorCode(error) {
    return String(error?.code || '').replace('functions/', '')
  }

  function resetRecaptchaVerifier() {
    try {
      recaptchaVerifierRef.current?.clear?.()
    } catch (error) {
      console.warn('[Onboarding] failed to clear reCAPTCHA verifier:', error)
    }
    recaptchaVerifierRef.current = null
  }

  async function getRecaptchaVerifier() {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current
    }

    if (!document.getElementById('recaptcha-container')) {
      throw new Error('recaptcha-container-not-found')
    }

    const verifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
      size: 'invisible',
      'expired-callback': () => {
        resetRecaptchaVerifier()
      },
    })

    recaptchaVerifierRef.current = verifier
    await verifier.render()
    return verifier
  }

  // ── effects ──────────────────────────────────────────────

  // limpa recaptcha ao desmontar
  useEffect(() => {
    return () => {
      resetRecaptchaVerifier()
    }
  }, [])

  // tick do cooldown
  useEffect(() => {
    if (!phoneCooldownUntil || phoneCooldownUntil <= phoneCooldownNow) return undefined

    const intervalId = window.setInterval(() => {
      setPhoneCooldownNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [phoneCooldownNow, phoneCooldownUntil])

  // seed do número vindo do signup
  const existingSignupPhoneE164 = pickExistingPhone(
    auth?.userData?.phoneE164,
    auth?.user?.phoneE164,
    auth?.userData?.signup?.phone,
    auth?.userData?.signup?.whatsapp,
    auth?.user?.signup?.phone,
    auth?.user?.signup?.whatsapp,
    auth?.userData?.phone,
    auth?.user?.phone,
    firebaseAuth.currentUser?.phoneNumber
  )

  const userPhoneVerified = auth?.user?.phoneVerified || auth?.userData?.phoneVerified || false
  const userPhoneE164 = auth?.user?.phoneE164 || auth?.userData?.phoneE164 || ''

  useEffect(() => {
    if (phoneSeededRef.current || userPhoneVerified || !existingSignupPhoneE164) return
    setPhone(toBrazilianPhoneInput(existingSignupPhoneE164))
    setIsEditingPhone(false)
    phoneSeededRef.current = true
  }, [existingSignupPhoneE164, userPhoneVerified])

  // auto-foca o input de código quando ele aparece
  useEffect(() => {
    if (!showPhoneCode || isEditingPhone) return
    const timer = setTimeout(() => {
      phoneCodeInputRef.current?.focus()
    }, 160)
    return () => clearTimeout(timer)
  }, [showPhoneCode, isEditingPhone])

  // ── valores derivados ─────────────────────────────────────

  const isLoading =
    auth?.loading === true ||
    auth?.authLoading === true ||
    auth?.isLoading === true

  const currentPhoneE164 = normalizeBrazilianPhoneE164(phone)
  const currentPhoneDisplay = currentPhoneE164 ? formatBrazilianPhone(currentPhoneE164) : ''
  const phoneCooldownSeconds = Math.max(0, Math.ceil((phoneCooldownUntil - phoneCooldownNow) / 1000))
  const isPhoneSendCoolingDown = phoneCooldownSeconds > 0
  const isPhoneSendLimitReached = phoneSendCount >= 3

  const phoneSendButtonLabel = isPhoneSendLimitReached
    ? 'Aguarde alguns minutos'
    : isPhoneSendCoolingDown
    ? `Reenviar código em ${phoneCooldownSeconds}s`
    : 'Enviar código por SMS'

  const phoneResendButtonLabel = isPhoneSendLimitReached
    ? 'Aguarde alguns minutos'
    : isPhoneSendCoolingDown
    ? `Reenviar em ${phoneCooldownSeconds}s`
    : 'Reenviar código'

  // estados visuais do card de telefone
  const showEditPhoneForm =
    isEditingPhone ||
    (!showPhoneCode && !existingSignupPhoneE164 && !userPhoneVerified)

  const showCodeInputInline =
    !userPhoneVerified && !isEditingPhone && showPhoneCode

  const showNumberCard =
    !userPhoneVerified &&
    !isEditingPhone &&
    !showPhoneCode &&
    Boolean(existingSignupPhoneE164) &&
    Boolean(currentPhoneE164)

  // ── handlers ─────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }, [auth, navigate])

  // ── early returns ─────────────────────────────────────────

  if (!isLoading && !auth?.user) {
    return <Navigate to="/login" replace />
  }

  if (
    !isLoading &&
    auth?.role &&
    ['admin', 'developer'].includes(auth.role)
  ) {
    return <Navigate to="/admin" replace />
  }

  if (!isLoading && auth?.role === 'merchant') {
    const onboardingStatus =
      auth?.userData?.onboardingStatus ||
      auth?.user?.onboardingStatus ||
      ''

    const subscriptionStatus =
      auth?.userData?.subscriptionStatus ||
      auth?.user?.subscriptionStatus ||
      ''
    const normalizedSubscriptionStatus =
      subscriptionStatus === 'pending_checkout' ? 'checkout_pending' : subscriptionStatus
    const isBillingPending =
      ['checkout_pending', 'billing_pending'].includes(normalizedSubscriptionStatus) ||
      onboardingStatus === 'billing_pending'

    const hasMerchantStore =
      Boolean(auth?.storeId || auth?.userData?.storeId || auth?.user?.storeId) ||
      (Array.isArray(auth?.storeIds) && auth.storeIds.length > 0) ||
      (Array.isArray(auth?.userData?.storeIds) && auth.userData.storeIds.length > 0) ||
      (Array.isArray(auth?.user?.storeIds) && auth.user.storeIds.length > 0)

    const isPending =
      (!hasMerchantStore &&
       !['trialing', 'active', 'past_due', 'blocked', 'canceled', 'checkout_pending', 'billing_pending'].includes(normalizedSubscriptionStatus) &&
       onboardingStatus !== 'completed' &&
       onboardingStatus !== 'billing_pending') ||
      ['phone_pending', 'pending'].includes(onboardingStatus)

    const shouldRedirectToBilling =
      hasMerchantStore &&
      (!isPending ||
        isBillingPending ||
        normalizedSubscriptionStatus === 'trialing' ||
        onboardingStatus === 'completed')

    if (shouldRedirectToBilling) {
      return <Navigate to="/dashboard/billing" replace />
    }
  }

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

  // ── dados do usuário ──────────────────────────────────────

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

  // ── handlers de e-mail ────────────────────────────────────

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
    } catch {
      setResendStatus({ type: 'error', message: 'Não foi possível verificar o status no momento.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  // ── handlers de telefone ──────────────────────────────────

  // "Trocar número" é a ÚNICA ação que limpa o verificationId.
  // Reenviar SMS mantém a seção de código visível.
  const handleChangePhoneNumber = () => {
    setIsEditingPhone(true)
    setShowPhoneCode(false)
    setPhoneCode('')
    setPhoneStatus({ type: '', message: '' })
    phoneVerificationIdRef.current = ''
    resetRecaptchaVerifier()
  }

  const handleRequestPhoneCode = async (e) => {
    e?.preventDefault()
    setPhoneStatus({ type: '', message: '' })

    if (isRequestingPhone) return

    if (isPhoneSendLimitReached) {
      setPhoneStatus({ type: 'error', message: 'Muitas tentativas. Aguarde alguns minutos.' })
      return
    }

    if (isPhoneSendCoolingDown) {
      setPhoneStatus({ type: 'error', message: `Reenviar código em ${phoneCooldownSeconds}s.` })
      return
    }

    const phoneValidation = validateBrazilianMobilePhone(phone)
    if (!phoneValidation.ok) {
      setPhoneStatus({ type: 'error', message: 'Informe um celular válido para receber o código por SMS.' })
      return
    }
    const phoneE164 = phoneValidation.phoneE164

    const currentUser = firebaseAuth.currentUser
    if (!currentUser) {
      setPhoneStatus({ type: 'error', message: 'Sessão expirada. Entre novamente.' })
      return
    }

    setIsRequestingPhone(true)
    try {
      const precheckPhoneClaim = httpsCallable(functions, 'precheckFirebasePhoneClaim')
      await precheckPhoneClaim({ phoneE164 })

      if (currentUser.phoneNumber) {
        const linkedPhoneE164 = normalizeBrazilianPhoneE164(currentUser.phoneNumber)
        if (linkedPhoneE164 !== phoneE164) {
          setPhoneStatus({ type: 'error', message: getLinkedPhoneMismatchMessage() })
          setShowPhoneCode(false)
          return
        }

        await currentUser.getIdToken(true)
        const confirmVerified = httpsCallable(functions, 'confirmFirebasePhoneVerified')
        await confirmVerified()
        if (auth.refreshUserData) await auth.refreshUserData()
        setPhoneStatus({ type: 'success', message: 'Seu telefone já estava confirmado!' })
        setShowPhoneCode(false)
        setPhoneCode('')
        phoneVerificationIdRef.current = ''
        return
      }

      const appVerifier = await getRecaptchaVerifier()
      const provider = new PhoneAuthProvider(firebaseAuth)
      const verificationId = await provider.verifyPhoneNumber(phoneE164, appVerifier)

      // sempre que o SMS é enviado com sucesso:
      // - manter (ou abrir) a seção inline de código
      // - limpar o campo de código para nova digitação
      phoneVerificationIdRef.current = verificationId
      setShowPhoneCode(true)
      setPhoneCode('')
      setIsEditingPhone(false)
      setPhoneSendCount((count) => count + 1)
      setPhoneCooldownUntil(Date.now() + 60 * 1000)
      setPhoneCooldownNow(Date.now())
      setPhoneStatus({ type: 'success', message: 'SMS enviado! Verifique seu celular.' })
    } catch (error) {
      console.error('[Onboarding] Firebase Phone Auth request failed:', error)
      const code = String(error?.code || '')
      const callableCode = getCallableErrorCode(error)
      let msg = 'Não foi possível enviar o SMS agora.'

      if (callableCode === 'already-exists') msg = 'Este telefone já está vinculado a outra conta.'
      if (code.includes('too-many-requests') || callableCode === 'resource-exhausted') msg = 'Muitas tentativas. Aguarde alguns minutos.'
      if (code.includes('invalid-phone-number') || callableCode === 'invalid-argument') msg = 'Informe um celular válido.'
      if (code.includes('captcha') || error?.message === 'recaptcha-container-not-found') {
        msg = 'Não foi possível validar a segurança do envio. Tente novamente.'
      }
      if (code.includes('already-exists')) msg = 'Este telefone já está vinculado a outra conta.'

      resetRecaptchaVerifier()
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

    if (isConfirmingPhone) return

    setIsConfirmingPhone(true)
    let linkedPhoneToCurrentUser = false
    try {
      const currentUser = firebaseAuth.currentUser
      const verificationId = phoneVerificationIdRef.current

      if (!currentUser) {
        throw new Error('auth/user-not-found')
      }

      const phoneE164 = normalizeBrazilianPhoneE164(phone)
      if (!phoneE164) {
        throw new Error('auth/invalid-phone-number')
      }

      if (currentUser.phoneNumber) {
        const linkedPhoneE164 = normalizeBrazilianPhoneE164(currentUser.phoneNumber)
        if (linkedPhoneE164 !== phoneE164) {
          setPhoneStatus({ type: 'error', message: getLinkedPhoneMismatchMessage() })
          setShowPhoneCode(false)
          return
        }

        await currentUser.getIdToken(true)
        const confirmVerified = httpsCallable(functions, 'confirmFirebasePhoneVerified')
        await confirmVerified()
        if (auth.refreshUserData) await auth.refreshUserData()
        setPhoneStatus({ type: 'success', message: 'Telefone verificado com sucesso!' })
        setShowPhoneCode(false)
        setPhoneCode('')
        phoneVerificationIdRef.current = ''
        return
      }

      if (!verificationId) {
        throw new Error('auth/missing-verification-id')
      }

      const originalUid = currentUser.uid
      const credential = PhoneAuthProvider.credential(verificationId, phoneCode)
      const linkedCredential = await linkWithCredential(currentUser, credential)
      linkedPhoneToCurrentUser = true

      if (linkedCredential.user.uid !== originalUid) {
        throw new Error('auth/uid-changed')
      }

      await linkedCredential.user.reload()
      await linkedCredential.user.getIdToken(true)

      const confirmVerified = httpsCallable(functions, 'confirmFirebasePhoneVerified')
      await confirmVerified()

      setPhoneStatus({ type: 'success', message: 'Telefone verificado com sucesso!' })
      setShowPhoneCode(false)
      setPhoneCode('')
      phoneVerificationIdRef.current = ''

      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }
    } catch (error) {
      console.error('[Onboarding] Firebase Phone Auth confirmation failed:', error)
      const code = String(error?.code || error?.message || '')
      const callableCode = getCallableErrorCode(error)
      let msg = 'Não foi possível confirmar o código.'

      if (code.includes('credential-already-in-use') || callableCode === 'already-exists') {
        msg = 'Este telefone já está vinculado a outra conta.'
      } else if (code.includes('invalid-verification-code') || callableCode === 'invalid-argument') {
        msg = 'Código inválido. Verifique e tente novamente.'
      } else if (code.includes('code-expired') || callableCode === 'deadline-exceeded') {
        msg = 'Código expirado. Reenvie um novo SMS.'
      } else if (code.includes('too-many-requests') || callableCode === 'resource-exhausted') {
        msg = 'Muitas tentativas. Aguarde alguns minutos.'
      } else if (code.includes('provider-already-linked')) {
        try {
          await firebaseAuth.currentUser?.getIdToken(true)
          const confirmVerified = httpsCallable(functions, 'confirmFirebasePhoneVerified')
          await confirmVerified()
          if (auth.refreshUserData) await auth.refreshUserData()
          setPhoneStatus({ type: 'success', message: 'Telefone verificado com sucesso!' })
          setShowPhoneCode(false)
          return
        } catch (confirmError) {
          console.error('[Onboarding] failed to sync already linked phone:', confirmError)
        }
      }

      if (linkedPhoneToCurrentUser && shouldUnlinkPhoneAfterBackendFailure(error)) {
        try {
          await unlink(firebaseAuth.currentUser, PhoneAuthProvider.PROVIDER_ID)
          await firebaseAuth.currentUser?.reload()
          await firebaseAuth.currentUser?.getIdToken(true)
        } catch (unlinkError) {
          console.error('[Onboarding] failed to unlink phone after backend rejection:', unlinkError)
        }
      }

      // NÃO limpar showPhoneCode nem verificationId em caso de erro —
      // o usuário deve poder tentar novamente sem precisar reenviar o SMS.
      setPhoneStatus({ type: 'error', message: msg })
    } finally {
      setIsConfirmingPhone(false)
    }
  }

  // ── trial ─────────────────────────────────────────────────

  const handleStartTrial = async () => {
    setTrialStatus({ type: '', message: '' })
    setIsStartingTrial(true)

    try {
      const startTrial = httpsCallable(functions, 'startFreeTrial')
      const result = await startTrial()

      if (auth.refreshUserData) {
        await auth.refreshUserData()
      }

      navigate(result.data?.nextPath || '/dashboard/billing', { replace: true })
    } catch (error) {
      const code = getCallableErrorCode(error)
      let msg = 'Não foi possível continuar para faturamento no momento.'

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

  // ── render ────────────────────────────────────────────────

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f9fafb] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
      <OnboardingMobileHeader />

      {/* blobs flutuantes */}
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

      {/* conteúdo central */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="w-full max-w-md">

          {/* card principal */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-5 shadow-2xl shadow-orange-900/10 backdrop-blur sm:p-8"
          >
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">

              {/* logo bar — desktop */}
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

              {/* badge + headline */}
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
                  Agora falta confirmar seu telefone e finalizar a ativação da sua loja.
                </p>
              </motion.div>

              {/* etapas visuais */}
              <motion.div
                variants={fadeUp}
                className="mb-6 rounded-[1.5rem] border border-gray-100 bg-[#fafafa] p-5"
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  <FiClock size={12} className="text-gray-400" />
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

              {/* segurança da conta / e-mail */}
              <motion.div
                variants={fadeUp}
                className="mb-6 rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  <FiShield size={12} className="text-gray-400" />
                  Segurança da conta
                </div>

                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    emailVerified
                      ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                      : 'bg-gray-50 text-gray-400 ring-1 ring-gray-100'
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
                          Enviamos um link de verificação para{' '}
                          <strong className="text-[#111827]">{email}</strong>.{' '}
                          Confirme seu e-mail para manter sua conta segura.
                        </p>

                        {resendStatus.message && (
                          <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-bold leading-5 ${
                            resendStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {resendStatus.type === 'success'
                              ? <FiCheckCircle size={15} className="mt-0.5 shrink-0" />
                              : <FiAlertCircle size={15} className="mt-0.5 shrink-0" />}
                            <span>{resendStatus.message}</span>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleRefreshEmailStatus}
                            disabled={isRefreshing}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#f97316] transition hover:bg-gray-100 disabled:opacity-50 sm:text-xs sm:normal-case sm:tracking-normal"
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

              {/* ═══════════════════════════════════════════════════════
                  CARD DE CONFIRMAÇÃO DE TELEFONE — FLUXO INLINE
              ═══════════════════════════════════════════════════════ */}
              <motion.div
                variants={fadeUp}
                className={`mb-6 overflow-hidden rounded-[1.5rem] border transition-colors duration-300 ${
                  userPhoneVerified
                    ? 'border-emerald-100 bg-emerald-50/30'
                    : showCodeInputInline
                    ? 'border-orange-100 bg-orange-50/20 shadow-sm'
                    : 'border-gray-100 bg-white shadow-sm'
                }`}
              >
                {/* ── cabeçalho do card ── */}
                <div className="flex items-start gap-4 p-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                    userPhoneVerified
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : showCodeInputInline
                      ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
                      : 'bg-gray-50 text-gray-400 ring-1 ring-gray-100'
                  }`}>
                    {userPhoneVerified
                      ? <FiCheckCircle size={22} />
                      : showCodeInputInline
                      ? <FiMessageCircle size={22} />
                      : <FiPhone size={22} />
                    }
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#111827]">
                      {userPhoneVerified
                        ? 'Telefone verificado'
                        : showCodeInputInline
                        ? 'Digite o código recebido'
                        : 'Confirmar telefone'}
                    </p>

                    {/* STATE 3 — verificado */}
                    {userPhoneVerified && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-[#6b7280]">
                          Número confirmado:{' '}
                          <strong className="text-[#111827]">{formatBrazilianPhone(userPhoneE164)}</strong>
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          <FiCheckCircle size={10} />
                          Verificado
                        </span>
                      </div>
                    )}

                    {/* descrição estado 2 (código enviado) */}
                    {showCodeInputInline && (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Enviamos um SMS para{' '}
                        <strong className="text-[#111827]">{currentPhoneDisplay}</strong>.
                      </p>
                    )}

                    {/* descrição estado 1 e edição */}
                    {!userPhoneVerified && !showCodeInputInline && (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">
                        Enviaremos um SMS para confirmar que este número pertence a você.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── corpo do card (estados não-verificados) ── */}
                {!userPhoneVerified && (
                  <div className="px-5 pb-5">
                    {/* recaptcha invisível — sempre presente */}
                    <div id="recaptcha-container" />

                    {/* alerta de status */}
                    {phoneStatus.message && (
                      <div className={`mb-4 flex items-start gap-2.5 rounded-2xl p-3.5 text-xs font-bold leading-5 ${
                        phoneStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                          : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                      }`}>
                        {phoneStatus.type === 'success'
                          ? <FiCheckCircle size={15} className="mt-0.5 shrink-0" />
                          : <FiAlertCircle size={15} className="mt-0.5 shrink-0" />}
                        <span>{phoneStatus.message}</span>
                      </div>
                    )}

                    {/* ════════════════════════════════
                        ESTADO: formulário de edição
                        (isEditingPhone OU sem número seeded)
                    ════════════════════════════════ */}
                    {showEditPhoneForm && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                            Número de telefone
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="Ex: 79 99978-6984"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRequestPhoneCode(e) }}
                            disabled={isRequestingPhone}
                            className="h-12 w-full rounded-2xl border border-gray-200 bg-[#f9fafb] px-4 text-sm font-bold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                            autoFocus={isEditingPhone}
                          />
                          <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                            DDD + número celular · ex: 11 9 1234-5678
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleRequestPhoneCode}
                          disabled={isRequestingPhone || isPhoneSendCoolingDown || isPhoneSendLimitReached || !phone.trim()}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] text-sm font-black text-white shadow-lg shadow-orange-600/15 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/20 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50"
                        >
                          {isRequestingPhone
                            ? <FiRefreshCw className="animate-spin" size={16} />
                            : <FiSend size={16} />}
                          {isRequestingPhone ? 'Enviando SMS...' : 'Enviar código por SMS'}
                        </button>

                        {/* cancelar troca — só aparece quando estava editando e há um número original */}
                        {isEditingPhone && existingSignupPhoneE164 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhone(toBrazilianPhoneInput(existingSignupPhoneE164))
                              setIsEditingPhone(false)
                              setPhoneStatus({ type: '', message: '' })
                            }}
                            disabled={isRequestingPhone}
                            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-2.5 text-xs font-black text-[#6b7280] transition hover:border-gray-200 hover:text-[#111827] disabled:opacity-50"
                          >
                            <FiX size={13} />
                            Cancelar troca
                          </button>
                        )}
                      </div>
                    )}

                    {/* ════════════════════════════════
                        ESTADO 2: input de código inline
                    ════════════════════════════════ */}
                    {showCodeInputInline && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                            Código de 6 dígitos
                          </label>

                          {/* input grande centralizado */}
                          <input
                            ref={phoneCodeInputRef}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            maxLength={6}
                            value={phoneCode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                              setPhoneCode(val)
                              // auto-submit ao completar os 6 dígitos
                              if (val.length === 6 && !isConfirmingPhone) {
                                setTimeout(() => handleConfirmPhoneCode(), 0)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && phoneCode.length === 6) handleConfirmPhoneCode(e)
                            }}
                            disabled={isConfirmingPhone}
                            className="h-16 w-full rounded-2xl border-2 border-orange-200 bg-white px-4 text-center text-2xl font-black tracking-[0.5em] text-[#111827] outline-none transition placeholder:text-gray-200 placeholder:tracking-normal placeholder:text-xl focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                          />

                          <p className="mt-1.5 text-center text-[11px] text-[#9ca3af]">
                            O código expira em 10 minutos
                          </p>
                        </div>

                        {/* botão verificar */}
                        <button
                          type="button"
                          onClick={handleConfirmPhoneCode}
                          disabled={isConfirmingPhone || phoneCode.length !== 6}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] text-sm font-black text-white shadow-lg shadow-orange-600/15 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/20 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50"
                        >
                          {isConfirmingPhone
                            ? <FiRefreshCw className="animate-spin" size={16} />
                            : <FiCheckCircle size={16} />}
                          {isConfirmingPhone ? 'Verificando...' : 'Verificar código'}
                        </button>

                        {/* reenviar + trocar número */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRequestPhoneCode}
                            disabled={isRequestingPhone || isConfirmingPhone || isPhoneSendCoolingDown || isPhoneSendLimitReached}
                            className="flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-orange-100 bg-orange-50 text-xs font-black text-[#f97316] transition hover:bg-orange-100 disabled:opacity-50"
                          >
                            {isRequestingPhone
                              ? <FiRefreshCw className="animate-spin" size={13} />
                              : <FiRefreshCw size={13} />}
                            {isRequestingPhone ? 'Enviando...' : phoneResendButtonLabel}
                          </button>

                          <button
                            type="button"
                            onClick={handleChangePhoneNumber}
                            disabled={isRequestingPhone || isConfirmingPhone}
                            className="flex h-11 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 text-xs font-black text-[#6b7280] transition hover:border-gray-200 hover:text-[#111827] disabled:opacity-50"
                          >
                            Trocar número
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ════════════════════════════════
                        ESTADO 1: card do número informado
                    ════════════════════════════════ */}
                    {showNumberCard && (
                      <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
                        {/* número + badge + trocar */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#9ca3af]">
                              Número informado
                            </p>
                            <p className="mt-1.5 text-xl font-black tracking-tight text-[#111827]">
                              {currentPhoneDisplay}
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Aguardando verificação
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleChangePhoneNumber}
                            disabled={isRequestingPhone}
                            className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-[#6b7280] transition hover:border-gray-300 hover:text-[#f97316] disabled:opacity-50"
                          >
                            Trocar número
                          </button>
                        </div>

                        {/* botão enviar SMS */}
                        <button
                          type="button"
                          onClick={handleRequestPhoneCode}
                          disabled={isRequestingPhone || isPhoneSendCoolingDown || isPhoneSendLimitReached || !currentPhoneE164}
                          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] text-sm font-black text-white shadow-lg shadow-orange-600/15 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/20 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50"
                        >
                          {isRequestingPhone
                            ? <FiRefreshCw className="animate-spin" size={16} />
                            : <FiSend size={16} />}
                          {isRequestingPhone ? 'Enviando SMS...' : phoneSendButtonLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* ── botões de ação ── */}
              <motion.div variants={fadeUp} className="space-y-3">
                {trialStatus.message && (
                  <div className={`flex items-start gap-2 rounded-xl p-3 text-xs font-bold leading-5 ${
                    trialStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {trialStatus.type === 'success'
                      ? <FiCheckCircle size={15} className="mt-0.5 shrink-0" />
                      : <FiAlertCircle size={15} className="mt-0.5 shrink-0" />}
                    <span>{trialStatus.message}</span>
                  </div>
                )}

                {/* CTA principal */}
                {userPhoneVerified ? (
                  <>
                    <div className="px-2 pb-1 text-center">
                      <p className="text-[13px] font-semibold leading-relaxed text-[#6b7280]">
                        Você não será cobrado agora. Configure a cobrança no próximo passo para ativar os 14 dias grátis.
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
                          Criando loja...
                        </>
                      ) : (
                        <>
                          <FiZap size={16} />
                          Criar loja e continuar
                          <FiArrowRight
                            size={16}
                            className="transition group-hover:translate-x-0.5"
                          />
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs font-bold leading-5 text-[#6b7280]">
                    Confirme seu telefone por SMS para continuar para o faturamento.
                  </div>
                )}

                {/* ações secundárias */}
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

              {/* rodapé do card */}
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

          {/* links abaixo do card */}
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

      {/* ═══════════════════════════════════════════════════════
          MODAL REMOVIDO — o input de código agora é inline
          dentro do card acima (showCodeInputInline).
          Trocar número é a única ação que limpa verificationId.
      ═══════════════════════════════════════════════════════ */}

    </main>
  )
}