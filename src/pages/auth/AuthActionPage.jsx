import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
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
  FiShield,
} from 'react-icons/fi'

import { auth } from '../../services/firebaseAuth'

// ─────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────

function PratoByLogo({ compact = false }) {
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
        <p className={`font-black tracking-tighter text-[#111827] ${compact ? 'text-xl' : 'text-2xl'}`}>
          Prato<span className="text-[#f97316]">By</span>
        </p>
        <p className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
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
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
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
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function AuthActionPage() {
  const [searchParams] = useSearchParams()

  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  const [status, setStatus] = useState('loading') // 'loading', 'success', 'error', 'form'
  const [errorMessage, setErrorMessage] = useState('')
  
  // States for resetPassword form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const hasProcessedActionRef = useRef(false)

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
            // Verify code before showing the form
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

  const handleResetPassword = async (e) => {
    e.preventDefault()
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

  // ── Render Helpers ─────────────────────────────────────────

  const renderLoading = () => (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
        <FiLoader size={28} className="animate-spin" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-[#111827]">
        {mode === 'verifyEmail' ? 'Confirmando seu e-mail...' : 'Aguarde...'}
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
        Processando sua solicitação com segurança.
      </p>
    </motion.div>
  )

  const renderError = () => (
    <motion.div variants={fadeUp} className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-red-50 text-red-600 ring-1 ring-red-100">
        <FiAlertCircle size={32} />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-[#111827]">
        Não foi possível concluir
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
        {errorMessage}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-[#ea580c]"
        >
          Voltar para o login
          <FiArrowRight size={16} />
        </Link>
      </div>
    </motion.div>
  )

  const renderSuccess = () => {
    let title = 'Operação concluída'
    let text = 'Ação realizada com sucesso.'
    
    if (mode === 'verifyEmail') {
      title = 'E-mail confirmado'
      text = 'Seu e-mail foi confirmado com sucesso. Agora você pode continuar a ativação da sua loja.'
    } else if (mode === 'resetPassword') {
      title = 'Senha atualizada'
      text = 'Sua senha foi redefinida com sucesso.'
    } else if (mode === 'recoverEmail') {
      title = 'E-mail recuperado'
      text = 'Sua conta voltou para o e-mail anterior com segurança.'
    }

    return (
      <motion.div variants={fadeUp} className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <FiCheckCircle size={32} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-[#111827]">
          {title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
          {text}
        </p>
        
        <div className="mt-8 flex flex-col gap-3">
          {mode === 'verifyEmail' && (
            <Link
              to="/onboarding"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-[#ea580c]"
            >
              Continuar ativação
              <FiArrowRight size={16} />
            </Link>
          )}

          <Link
            to="/login"
            className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${
              mode === 'verifyEmail' 
                ? 'border border-gray-200 bg-white text-[#6b7280] hover:text-[#111827]'
                : 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20 hover:bg-[#ea580c]'
            }`}
          >
            {mode === 'verifyEmail' ? 'Entrar no painel' : (mode === 'resetPassword' ? 'Entrar com nova senha' : 'Entrar novamente')}
            <FiArrowRight size={16} />
          </Link>
        </div>
      </motion.div>
    )
  }

  const renderForm = () => (
    <motion.div variants={fadeUp}>
      <div className="text-center mb-6">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-50 text-[#f97316] ring-1 ring-orange-100">
          <FiShield size={28} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-[#111827]">
          Redefinir senha
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6b7280]">
          Crie uma nova senha para acessar sua conta no PratoBy.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {formError && (
          <AlertBox key="error" type="error">
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
          placeholder="••••••••"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isSubmitting}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              disabled={isSubmitting}
            >
              {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
            </button>
          }
        />
        
        <InputField
          label="Confirmar nova senha"
          icon={FiLock}
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <button
          type="submit"
          disabled={isSubmitting || !newPassword || !confirmPassword}
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
    <main className="relative min-h-dvh overflow-hidden bg-[#f9fafb] pt-20 text-[#111827] antialiased selection:bg-orange-100 selection:text-[#f97316] lg:pt-0">
      
      {/* HEADER MOBILE & DESKTOP (Simples) */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl"
      >
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <span className="block h-full w-full rounded-full bg-[#f97316]" />
        </span>

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <PratoByLogo compact />

          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.25rem] border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] shadow-sm transition hover:bg-gray-50 active:scale-95"
            aria-label="Voltar para o login"
          >
            <FiArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar ao login</span>
            <span className="sm:hidden">Voltar</span>
          </Link>
        </div>
      </motion.header>

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
            className="rounded-[2rem] border border-orange-100/80 bg-white/95 p-6 shadow-2xl shadow-orange-900/10 backdrop-blur sm:p-8"
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {status === 'loading' && renderLoading()}
              {status === 'error' && renderError()}
              {status === 'success' && renderSuccess()}
              {status === 'form' && renderForm()}
            </motion.div>
          </motion.div>

          {/* RODAPÉ FORA DO CARD */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-[#6b7280]"
          >
            <span>PratoBy Cloud</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <FiClock size={12} />© {new Date().getFullYear()} PratoBy
            </span>
          </motion.div>

        </div>
      </div>
    </main>
  )
}
