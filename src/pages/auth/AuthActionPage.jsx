import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth'
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiMail,
  FiShield,
  FiZap,
} from 'react-icons/fi'

import { auth } from '../../services/firebaseAuth'

const ACTION_COPY = {
  verifyEmail: {
    loadingTitle: 'Confirmando seu e-mail...',
    loadingText: 'Estamos validando o link enviado para sua caixa de entrada.',
    successTitle: 'E-mail confirmado',
    successText:
      'Seu e-mail foi confirmado com sucesso. Agora você pode continuar a ativação da sua loja.',
    badge: 'Confirmação de e-mail',
  },
  resetPassword: {
    loadingTitle: 'Validando link de senha...',
    loadingText: 'Conferindo se o link ainda está válido antes de criar sua nova senha.',
    successTitle: 'Senha atualizada',
    successText: 'Sua senha foi redefinida com sucesso. Você já pode acessar o painel.',
    badge: 'Redefinição de senha',
  },
  recoverEmail: {
    loadingTitle: 'Recuperando e-mail...',
    loadingText: 'Estamos revertendo a alteração de e-mail da sua conta com segurança.',
    successTitle: 'E-mail recuperado',
    successText: 'Sua conta voltou para o e-mail anterior com segurança.',
    badge: 'Recuperação de conta',
  },
}

const SECURITY_POINTS = [
  'Links temporários validados pelo Firebase Auth',
  'Conta protegida antes de liberar acesso ao painel',
  'Próximo passo claro para continuar sua loja',
]

function PratoByLogo({ compact = false, dark = false }) {
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Ir para início">
      <img
        src="/icons/android-chrome-192x192.png"
        alt="PratoBy"
        className={`${
          compact ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-[1.35rem]'
        } object-cover shadow-lg shadow-orange-600/20 ring-1 ring-black/5 transition duration-300 group-hover:scale-105`}
      />
      <div className="min-w-0 leading-none">
        <p
          className={`font-black tracking-tighter ${compact ? 'text-xl' : 'text-2xl'} ${
            dark ? 'text-white' : 'text-[#111827]'
          }`}
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

function InputField({ label, icon: Icon, rightElement, helper, className = '', ...props }) {
  const [focused, setFocused] = useState(false)

  return (
    <label className={`block ${className}`} htmlFor={props.id}>
      <span
        className={`mb-2 block text-xs font-black uppercase tracking-wide transition-colors duration-200 ${
          focused ? 'text-[#f97316]' : 'text-[#6b7280]'
        }`}
      >
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
              focused ? 'text-[#f97316]' : 'text-gray-400'
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
          className={`h-12 w-full rounded-2xl border border-orange-100/80 bg-white px-4 text-sm font-bold text-[#111827] shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 ${
            Icon ? 'pl-11' : ''
          } ${rightElement ? 'pr-12' : ''}`}
        />
        {rightElement}
      </div>
      {helper && <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280]">{helper}</p>}
    </label>
  )
}

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

function PasswordStrengthMeter({ password = '', confirmPassword = '' }) {
  const checks = [
    { label: '6+ caracteres', valid: password.length >= 6 },
    { label: 'letra e número', valid: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: 'confirmação igual', valid: Boolean(password) && password === confirmPassword },
  ]
  const score = checks.filter((item) => item.valid).length
  const percent = (score / checks.length) * 100

  return (
    <div className="rounded-2xl border border-orange-100/80 bg-orange-50/45 p-3">
      <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-orange-100">
        <div
          className="h-full rounded-full bg-[#f97316] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {checks.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
              item.valid
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-white text-[#6b7280] ring-1 ring-orange-100'
            }`}
          >
            {item.valid && <FiCheckCircle size={12} />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
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
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
}

export default function AuthActionPage() {
  const [searchParams] = useSearchParams()

  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const hasProcessedActionRef = useRef(false)
  const copy = useMemo(() => ACTION_COPY[mode] || ACTION_COPY.verifyEmail, [mode])
  const canSubmitPassword = Boolean(
    newPassword.length >= 6 && confirmPassword && newPassword === confirmPassword && !isSubmitting
  )

  useEffect(() => {
    if (!mode || !oobCode) {
      setStatus('error')
      setErrorMessage('Link inválido ou incompleto.')
      return
    }

    if (hasProcessedActionRef.current) return
    hasProcessedActionRef.current = true

    const handleAction = async () => {
      try {
        switch (mode) {
          case 'verifyEmail':
            await applyActionCode(auth, oobCode)
            setStatus('success')
            break

          case 'resetPassword':
            await verifyPasswordResetCode(auth, oobCode)
            setStatus('form')
            break

          case 'recoverEmail':
            await checkActionCode(auth, oobCode)
            await applyActionCode(auth, oobCode)
            setStatus('success')
            break

          default:
            setStatus('error')
            setErrorMessage('Ação não reconhecida.')
        }
      } catch (err) {
        setStatus('error')
        if (err?.code === 'auth/invalid-action-code' || err?.code === 'auth/expired-action-code') {
          setErrorMessage('O link é inválido ou expirou. Tente solicitar novamente.')
        } else if (err?.code === 'auth/network-request-failed') {
          setErrorMessage('Falha de conexão. Verifique sua internet e tente novamente.')
        } else {
          setErrorMessage('Não foi possível processar a solicitação no momento.')
        }
      }
    }

    handleAction()
  }, [mode, oobCode])

  const handleResetPassword = async (event) => {
    event.preventDefault()
    setFormError('')

    if (newPassword.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
      setStatus('success')
    } catch (err) {
      if (err?.code === 'auth/weak-password') {
        setFormError('Use uma senha com ao menos 6 caracteres.')
      } else if (err?.code === 'auth/invalid-action-code' || err?.code === 'auth/expired-action-code') {
        setStatus('error')
        setErrorMessage('O link de redefinição é inválido ou expirou.')
      } else {
        setFormError('Não foi possível redefinir a senha. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderLoading = () => (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
        <FiLoader size={28} className="animate-spin" />
      </div>
      <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
        <FiShield size={12} /> {copy.badge}
      </p>
      <h2 className="text-2xl font-black tracking-tight text-[#111827]">{copy.loadingTitle}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">{copy.loadingText}</p>
    </motion.div>
  )

  const renderError = () => (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-red-50 text-red-600 ring-1 ring-red-100">
        <FiAlertCircle size={32} />
      </div>
      <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-600 ring-1 ring-red-100">
        Link não validado
      </p>
      <h2 className="text-2xl font-black tracking-tight text-[#111827]">Não foi possível concluir</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">{errorMessage}</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
        >
          Voltar ao login
          <FiArrowRight size={16} />
        </Link>
        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-black text-[#6b7280] transition hover:border-orange-200 hover:text-[#111827]"
        >
          Ir para o site
        </Link>
      </div>
    </motion.div>
  )

  const renderSuccess = () => (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <FiCheckCircle size={32} />
      </div>
      <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
        Tudo certo
      </p>
      <h2 className="text-2xl font-black tracking-tight text-[#111827]">{copy.successTitle}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">{copy.successText}</p>

      <div className="mt-7 flex flex-col gap-3">
        {mode === 'verifyEmail' && (
          <Link
            to="/onboarding"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
          >
            Continuar ativação
            <FiArrowRight size={16} />
          </Link>
        )}

        <Link
          to="/login"
          className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${
            mode === 'verifyEmail'
              ? 'border border-gray-200 bg-white text-[#6b7280] hover:border-orange-200 hover:text-[#111827]'
              : 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20 hover:bg-[#ea580c]'
          }`}
        >
          {mode === 'resetPassword' ? 'Entrar com nova senha' : 'Entrar no painel'}
          <FiArrowRight size={16} />
        </Link>
      </div>
    </motion.div>
  )

  const renderForm = () => (
    <motion.div variants={fadeUp}>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
          <FiShield size={28} />
        </div>
        <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100">
          Redefinição segura
        </p>
        <h2 className="text-2xl font-black tracking-tight text-[#111827]">Criar nova senha</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
          Escolha uma senha nova para acessar sua conta no PratoBy.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {formError && (
          <AlertBox key="reset-error" type="error">
            {formError}
          </AlertBox>
        )}
      </AnimatePresence>

      <form onSubmit={handleResetPassword} className="space-y-4">
        <InputField
          label="Nova senha"
          icon={FiLock}
          id="newPassword"
          type={showPassword ? 'text' : 'password'}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={isSubmitting}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-gray-400 transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              disabled={isSubmitting}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showPassword ? 'eye-off' : 'eye-on'}
                  initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 20 }}
                  transition={{ duration: 0.15 }}
                >
                  {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                </motion.span>
              </AnimatePresence>
            </button>
          }
        />

        <InputField
          label="Confirmar nova senha"
          icon={FiLock}
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repita a nova senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
          required
        />

        <PasswordStrengthMeter password={newPassword} confirmPassword={confirmPassword} />

        <button
          type="submit"
          disabled={!canSubmitPassword}
          className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-xl hover:shadow-orange-600/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <FiLoader className="animate-spin" size={16} />
              Salvando...
            </>
          ) : (
            <>
              Salvar nova senha
              <FiArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  )

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#fff7ed] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-x-0 top-0 z-50 border-b border-orange-100 bg-white/95 shadow-sm backdrop-blur-xl lg:hidden"
      >
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#f97316]" />
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <PratoByLogo compact />
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:bg-gray-50 active:scale-95"
            aria-label="Voltar para o login"
          >
            <FiArrowLeft size={16} />
            Voltar
          </Link>
        </div>
      </motion.header>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[28rem] w-[28rem] rounded-full bg-orange-100/80 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-orange-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,0.92fr)_minmax(430px,0.72fr)]">
        <section className="relative hidden overflow-hidden bg-[#09090b] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#f97316]" />
            <div className="absolute -right-40 top-16 h-96 w-96 rounded-full bg-[#f97316]/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_34rem)]" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4">
            <PratoByLogo dark />
            <Link
              to="/login"
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white/80 backdrop-blur transition hover:bg-white hover:text-[#111827]"
            >
              Voltar ao login
            </Link>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative z-10 max-w-2xl py-12"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-100"
            >
              <FiShield className="text-[#f97316]" />
              Central segura de conta
            </motion.span>

            <motion.h1 variants={fadeUp} className="mt-7 max-w-2xl text-5xl font-black leading-[1.03] tracking-tight xl:text-6xl">
              Acesso protegido para
              <span className="block text-[#f97316]">sua operação.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg font-medium leading-8 text-gray-300">
              Confirmação de e-mail, recuperação de conta e redefinição de senha com uma experiência clara, rápida e segura.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 grid gap-3 text-sm font-bold text-gray-200 sm:grid-cols-2">
              {SECURITY_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <FiCheckCircle className="shrink-0 text-[#f97316]" />
                  {point}
                </div>
              ))}
            </motion.div>
          </motion.div>

          <div className="relative z-10 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] shadow-lg shadow-orange-950/20">
                  <FiZap size={22} />
                </div>
                <div>
                  <p className="font-black">PratoBy Cloud</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-gray-300">
                    O link muda o acesso, mas mantém o fluxo simples para o lojista voltar ao painel.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <FiMail className="text-[#f97316]" />
                Precisa de ajuda?
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-gray-300">
                Se o link expirou, solicite outro pelo login ou fale com o suporte do PratoBy.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-dvh items-center justify-center border-l border-orange-100/70 bg-white/85 px-4 py-6 backdrop-blur sm:px-6 lg:px-10 lg:py-10">
          <div className="w-full max-w-[31rem]">
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-6 shadow-2xl shadow-orange-950/10 backdrop-blur sm:p-8"
            >
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <motion.div variants={fadeUp} className="mb-7 hidden rounded-[1.25rem] border border-orange-100/80 bg-orange-50/45 p-3 shadow-sm lg:flex lg:items-center lg:justify-between lg:gap-4">
                  <PratoByLogo compact />
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#9ca3af] ring-1 ring-orange-100">
                    Conta segura
                  </span>
                </motion.div>

                {status === 'loading' && renderLoading()}
                {status === 'error' && renderError()}
                {status === 'success' && renderSuccess()}
                {status === 'form' && renderForm()}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-[#6b7280]"
            >
              <span>PratoBy Cloud</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <FiClock size={12} />© {new Date().getFullYear()} PratoBy
              </span>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  )
}
