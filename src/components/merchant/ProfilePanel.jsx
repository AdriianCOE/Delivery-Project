import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  FiAlertCircle,
  FiCamera,
  FiCheckCircle,
  FiChevronRight,
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiGrid,
  FiInfo,
  FiLoader,
  FiLock,
  FiMail,
  FiPhone,
  FiSettings,
  FiShield,
  FiUser,
  FiX,
  FiMonitor,
  FiXCircle,
  FiLogOut,
  FiSun,
  FiMoon,
} from 'react-icons/fi'

import app, { auth } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardTheme } from '../../contexts/DashboardThemeContext'
import {
  getCloudinaryOptimizedUrl,
  uploadImageToCloudinary,
} from '../../services/cloudinary'

// ─── Cloud Function callable ────────────────────────────────
const _fns = getFunctions(app, 'southamerica-east1')
const callUpdateMyProfile = httpsCallable(_fns, 'updateMyProfile')

// ─── Utilities ──────────────────────────────────────────────

function friendlyAuthError(code) {
  const map = {
    'auth/requires-recent-login':
      'Por segurança, saia e entre novamente antes de alterar dados críticos da conta.',
    'auth/email-already-in-use': 'Este e-mail já está em uso por outra conta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/wrong-password': 'Senha atual incorreta.',
    'auth/weak-password': 'Nova senha muito fraca. Use ao menos 8 caracteres.',
    'auth/popup-closed-by-user': 'Autenticação cancelada pelo usuário.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde antes de tentar novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
    'auth/user-mismatch': 'Credenciais não correspondem ao usuário atual.',
  }
  return map[code] || 'Ocorreu um erro. Tente novamente.'
}

function getPasswordStrength(pwd) {
  if (!pwd) return null
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { label: 'Fraca', color: 'text-red-500', bar: 'bg-red-400', w: 'w-1/4' }
  if (score <= 2) return { label: 'Regular', color: 'text-amber-500', bar: 'bg-amber-400', w: 'w-2/4' }
  if (score <= 3) return { label: 'Boa', color: 'text-orange-500', bar: 'bg-orange-400', w: 'w-3/4' }
  return { label: 'Forte', color: 'text-green-600', bar: 'bg-green-500', w: 'w-full' }
}

function formatSubscriptionStatus(status) {
  const map = {
    active: 'Ativa',
    trial: 'Período de teste',
    trialing: 'Período de teste',
    inactive: 'Inativa',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelada',
    cancelled: 'Cancelada',
  }
  return map[String(status || '').toLowerCase()] || status || '—'
}

function formatPlanName(plan) {
  const map = {
    essential: 'Essencial',
    professional: 'Profissional',
    premium: 'Premium',
  }
  return map[String(plan || '').toLowerCase()] || plan || '—'
}

function formatBillingCycle(cycle) {
  if (!cycle) return '—'
  const c = String(cycle).toLowerCase()
  if (c.includes('annual') || c.includes('anual') || c === 'yearly') return 'Anual'
  return 'Mensal'
}

// ─── Small UI components ─────────────────────────────────────

export function Toast({ toast, onClose }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div className="fixed right-4 top-4 z-[99] w-[calc(100vw-2rem)] max-w-sm">
      <div
        className={`flex items-start gap-3 rounded-[1.5rem] border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${
          isError
            ? 'border-red-100 bg-white text-red-700 dark:bg-zinc-900 dark:border-red-900/30 dark:text-red-400'
            : 'border-orange-100 bg-white text-[#111827] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200'
        }`}
      >
        {isError ? (
          <FiAlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
        ) : (
          <FiCheckCircle className="mt-0.5 shrink-0 text-[#f97316]" size={18} />
        )}
        <p className="flex-1 text-sm font-bold leading-5">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 rounded-xl p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
          <FiX size={15} />
        </button>
      </div>
    </div>
  )
}

function Badge({ verified, labelTrue, labelFalse, unregistered }) {
  if (unregistered) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 ring-1 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
        Não cadastrado
      </span>
    )
  }
  if (verified) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-green-700 ring-1 ring-green-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:ring-emerald-900/40">
        {labelTrue}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#f97316] ring-1 ring-orange-100 dark:bg-orange-950/25 dark:text-orange-400 dark:ring-orange-900/40">
      {labelFalse}
    </span>
  )
}

function SectionCard({ icon: Icon, title, description, children, className = '' }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-100/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_4px_25px_rgba(0,0,0,0.15)] dark:hover:shadow-none ${className}`}>
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-950/20 dark:text-[#f97316]">
          <Icon size={17} />
        </span>
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
          {description && (
            <p className="text-[11px] font-semibold text-[#9ca3af] dark:text-zinc-500">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#6b7280] dark:text-zinc-400">
      {children}
    </span>
  )
}

function TextInput({ icon: Icon, rightEl, className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
          size={16}
        />
      )}
      <input
        {...props}
        className={`h-11 w-full rounded-2xl border border-gray-200 bg-white px-3.5 text-sm font-bold text-[#111827] shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:focus:border-orange-500 dark:focus:ring-orange-950/20 dark:disabled:bg-zinc-900 ${
          Icon ? 'pl-10' : ''
        } ${rightEl ? 'pr-11' : ''}`}
      />
      {rightEl}
    </div>
  )
}

function SaveBtn({ loading, disabled, children = 'Salvar alterações' }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 text-sm font-black text-white shadow-md shadow-orange-500/20 transition hover:bg-[#ea580c] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none sm:w-auto"
    >
      {loading ? <FiLoader className="animate-spin" size={16} /> : null}
      {children}
    </button>
  )
}

function InlineError({ message }) {
  if (!message) return null
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-700">
      <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
      {message}
    </div>
  )
}

// ─── Avatar Section ───────────────────────────────────────────

function AvatarCard({ user, userData, onSuccess, onError }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const currentPhoto = useMemo(() => {
    const raw = user?.photoURL || userData?.photoURL || userData?.avatarUrl || null
    return raw ? getCloudinaryOptimizedUrl(raw, 200) : null
  }, [user, userData])

  const displayName = user?.displayName || userData?.displayName || userData?.name || '—'
  const email = user?.email || '—'

  function handleFileSelect(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      onError('Selecione um arquivo de imagem válido.')
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      onError('A imagem deve ter no máximo 5 MB.')
      return
    }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadImageToCloudinary(file, 'PratoBy/avatars')
      const photoURL = result.secure_url

      await updateProfile(auth.currentUser, { photoURL })
      await callUpdateMyProfile({ photoURL, avatarUrl: photoURL })

      setPreview(null)
      setFile(null)
      onSuccess('Foto de perfil atualizada.')
    } catch (err) {
      onError(err?.message || 'Não foi possível salvar a foto. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  function handleCancel() {
    setPreview(null)
    setFile(null)
  }

  const avatarSrc = preview || currentPhoto

  return (
    <SectionCard icon={FiUser} title="Foto de perfil" description="Visível no painel">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-[1.25rem] bg-orange-50 ring-2 ring-orange-100">
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[#f97316]">
                {(displayName[0] || '?').toUpperCase()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Trocar foto de perfil"
            className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-500/30 transition hover:bg-[#ea580c] active:scale-95"
          >
            <FiCamera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-base font-black text-[#111827]">{displayName}</p>
          <p className="mt-0.5 text-sm font-semibold text-[#6b7280]">{email}</p>
          {!preview && (
            <p className="mt-2 text-xs font-semibold text-[#9ca3af]">
              JPG, PNG ou WEBP · Máx. 5 MB
            </p>
          )}
          {preview && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="flex h-9 items-center gap-1.5 rounded-2xl bg-[#f97316] px-4 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:bg-[#ea580c] disabled:opacity-50"
              >
                {uploading ? <FiLoader className="animate-spin" size={13} /> : null}
                {uploading ? 'Salvando...' : 'Salvar foto'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={uploading}
                className="flex h-9 items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 text-xs font-black text-[#6b7280] transition hover:border-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Display Name Card ────────────────────────────────────────

function DisplayNameCard({ user, userData, onSuccess, onError }) {
  const current = user?.displayName || userData?.displayName || userData?.name || ''
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return setError('Nome deve ter ao menos 2 caracteres.')
    if (trimmed.length > 80) return setError('Nome deve ter no máximo 80 caracteres.')
    setSaving(true)
    setError('')
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed })
      await callUpdateMyProfile({ displayName: trimmed })
      onSuccess('Nome atualizado com sucesso.')
    } catch (err) {
      const msg = err?.code ? friendlyAuthError(err.code) : (err?.message || 'Erro ao salvar nome.')
      setError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard icon={FiEdit2} title="Nome de exibição" description="Como você aparece no painel">
      <form onSubmit={handleSave}>
        <FieldLabel>Nome completo</FieldLabel>
        <TextInput
          id="displayName"
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
          disabled={saving}
        />
        <InlineError message={error} />
        <SaveBtn loading={saving} disabled={name.trim() === current.trim() || !name.trim()} />
      </form>
    </SectionCard>
  )
}

// ─── Security Card (email + senha) ───────────────────────────

function SecurityCard({ user, onSuccess, onError }) {
  const [section, setSection] = useState(null) // 'email' | 'password'
  const isGoogleUser = !auth.currentUser?.providerData?.some(p => p.providerId === 'password')

  // Email state
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, next: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')

  const strength = useMemo(() => getPasswordStrength(pwForm.next), [pwForm.next])

  async function handleEmailChange(e) {
    e.preventDefault()
    const newEmail = emailForm.newEmail.trim().toLowerCase()
    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
      return setEmailError('Digite um e-mail válido.')
    }
    if (newEmail === user?.email?.toLowerCase()) {
      return setEmailError('O novo e-mail é igual ao atual.')
    }
    setEmailSaving(true)
    setEmailError('')
    try {
      if (!isGoogleUser) {
        const credential = EmailAuthProvider.credential(user.email, emailForm.password)
        await reauthenticateWithCredential(auth.currentUser, credential)
      }
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail)
      setEmailForm({ newEmail: '', password: '' })
      setSection(null)
      onSuccess(`E-mail de confirmação enviado para ${newEmail}. O e-mail só será alterado após verificação.`)
    } catch (err) {
      const msg = friendlyAuthError(err?.code)
      setEmailError(msg)
    } finally {
      setEmailSaving(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (!pwForm.current) return setPwError('Digite sua senha atual.')
    if (pwForm.next.length < 8) return setPwError('A nova senha deve ter ao menos 8 caracteres.')
    if (!/[A-Za-z]/.test(pwForm.next) || !/[0-9]/.test(pwForm.next)) {
      return setPwError('Use letras e números na nova senha.')
    }
    if (pwForm.next !== pwForm.confirm) return setPwError('As senhas não coincidem.')
    setPwSaving(true)
    setPwError('')
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, pwForm.next)
      setPwForm({ current: '', next: '', confirm: '' })
      setSection(null)
      onSuccess('Senha alterada com sucesso.')
    } catch (err) {
      setPwError(friendlyAuthError(err?.code))
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <SectionCard icon={FiShield} title="Segurança da conta" description="E-mail e senha">

      {/* E-mail atual */}
      <div className="mb-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="block text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
                E-mail atual
              </span>
              <Badge
                verified={auth.currentUser?.emailVerified}
                labelTrue="Verificado"
                labelFalse="Pendente"
              />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <FiMail size={14} className="shrink-0 text-[#9ca3af]" />
              <span className="min-w-0 truncate break-all text-sm font-bold text-[#111827]">{user?.email || '—'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row w-full sm:w-auto shrink-0">
            {!auth.currentUser?.emailVerified && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendEmailVerification(auth.currentUser)
                    onSuccess('E-mail de verificação enviado.')
                  } catch {
                    onError('Não foi possível enviar a verificação.')
                  }
                }}
                className="w-full sm:w-auto rounded-2xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f97316] transition hover:bg-orange-100"
              >
                Verificar
              </button>
            )}
            <button
              type="button"
              onClick={() => setSection(section === 'email' ? null : 'email')}
              className="w-full sm:w-auto rounded-2xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] transition hover:border-gray-300 hover:text-[#111827]"
            >
              {section === 'email' ? 'Cancelar' : 'Alterar'}
            </button>
          </div>
        </div>

        {section === 'email' && (
          <form onSubmit={handleEmailChange} className="mt-4 space-y-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
            {isGoogleUser ? (
              <div className="flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-700">
                <FiInfo size={14} className="mt-0.5 shrink-0" />
                Sua conta usa login com Google. O e-mail é gerenciado pela sua Conta Google e pode não ser alterável aqui.
              </div>
            ) : null}
            <div>
              <FieldLabel>Novo e-mail</FieldLabel>
              <TextInput
                icon={FiMail}
                type="email"
                placeholder="novo@email.com"
                inputMode="email"
                value={emailForm.newEmail}
                onChange={e => setEmailForm(f => ({ ...f, newEmail: e.target.value }))}
                disabled={emailSaving}
                autoComplete="email"
              />
            </div>
            {!isGoogleUser && (
              <div>
                <FieldLabel>Senha atual (confirmação)</FieldLabel>
                <TextInput
                  icon={FiLock}
                  type="password"
                  placeholder="Digite sua senha atual"
                  value={emailForm.password}
                  onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))}
                  disabled={emailSaving}
                  autoComplete="current-password"
                />
              </div>
            )}
            <InlineError message={emailError} />
            <SaveBtn loading={emailSaving}>Confirmar alteração</SaveBtn>
          </form>
        )}
      </div>

      <div className="h-px w-full bg-gray-100" />

      {/* Senha */}
      <div className="mt-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="min-w-0">
            <FieldLabel>Senha</FieldLabel>
            <div className="flex items-center gap-2 min-w-0">
              <FiLock size={14} className="shrink-0 text-[#9ca3af]" />
              <span className="text-sm font-bold text-[#111827]">••••••••</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSection(section === 'password' ? null : 'password')}
            className="w-full sm:w-auto shrink-0 rounded-2xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] transition hover:border-gray-300 hover:text-[#111827]"
          >
            {section === 'password' ? 'Cancelar' : 'Alterar'}
          </button>
        </div>

        {section === 'password' && (
          isGoogleUser ? (
            <div className="mt-4 flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
              <FiInfo size={16} className="mt-0.5 shrink-0" />
              Sua conta usa login com Google. A senha é gerenciada diretamente pela sua Conta Google.
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
              <div>
                <FieldLabel>Senha atual</FieldLabel>
                <TextInput
                  icon={FiLock}
                  type={showPw.current ? 'text' : 'password'}
                  placeholder="Senha atual"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  disabled={pwSaving}
                  autoComplete="current-password"
                  rightEl={
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                      aria-label={showPw.current ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#111827]"
                    >
                      {showPw.current ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  }
                />
              </div>
              <div>
                <FieldLabel>Nova senha</FieldLabel>
                <TextInput
                  icon={FiLock}
                  type={showPw.next ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  disabled={pwSaving}
                  autoComplete="new-password"
                  rightEl={
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                      aria-label={showPw.next ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#111827]"
                    >
                      {showPw.next ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  }
                />
                {strength && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.bar} ${strength.w}`} />
                    </div>
                    <p className={`mt-1 text-[11px] font-black ${strength.color}`}>
                      Força: {strength.label}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Confirmar nova senha</FieldLabel>
                <TextInput
                  icon={FiLock}
                  type="password"
                  placeholder="Repita a nova senha"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  disabled={pwSaving}
                  autoComplete="new-password"
                />
              </div>
              <InlineError message={pwError} />
              <SaveBtn loading={pwSaving}>Alterar senha</SaveBtn>
            </form>
          )
        )}
      </div>
    </SectionCard>
  )
}

// ─── Phone Card ───────────────────────────────────────────────

function PhoneCard({ userData, onSuccess }) {
  const phone = userData?.phone || userData?.whatsapp || userData?.phoneNumber || null
  const verified = Boolean(userData?.phoneVerified)
  const [editing, setEditing] = useState(false)
  const [newPhone, setNewPhone] = useState('')

  return (
    <SectionCard icon={FiPhone} title="Telefone / WhatsApp" description="Verificação e contato">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="block text-[11px] font-black uppercase tracking-wide text-[#6b7280]">
              Número atual
            </span>
            <Badge
              verified={verified}
              labelTrue="Verificado"
              labelFalse="Pendente"
              unregistered={!phone}
            />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <FiPhone size={14} className="shrink-0 text-[#9ca3af]" />
            <span className="truncate text-sm font-bold text-[#111827]">{phone || 'Não cadastrado'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="w-full sm:w-auto shrink-0 rounded-2xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-[#6b7280] transition hover:border-gray-300 hover:text-[#111827]"
        >
          {editing ? 'Cancelar' : 'Alterar'}
        </button>
      </div>

      {editing && (
        <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
          <FieldLabel>Novo número com DDD</FieldLabel>
          <TextInput
            icon={FiPhone}
            type="tel"
            placeholder="(79) 99999-9999"
            inputMode="tel"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
          />
          <div className="mt-3 flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-700">
            <FiInfo size={13} className="mt-0.5 shrink-0" />
            A troca de telefone pelo painel será liberada em uma próxima etapa. Para alterar agora, entre em contato com o suporte.
          </div>
          {/* TODO: chamar requestPhoneVerification({ phone: newPhone }) quando Cloud Function estiver disponível */}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Subscription Card (read-only) ───────────────────────────

function SubscriptionCard({ userData }) {
  const plan = formatPlanName(userData?.plan || userData?.planId)
  const cycle = formatBillingCycle(userData?.billingCycle)
  const status = formatSubscriptionStatus(userData?.subscriptionStatus)
  const onboarding = userData?.onboardingStatus

  const trialDaysLeft = useMemo(() => {
    if (!userData?.trialEndsAt) return null
    const end = userData.trialEndsAt?.toDate?.() ?? new Date(userData.trialEndsAt)
    if (Number.isNaN(end.getTime())) return null
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000))
  }, [userData])

  const rows = [
    { label: 'Plano', value: plan },
    { label: 'Ciclo', value: cycle },
    { label: 'Status', value: status },
    onboarding ? { label: 'Onboarding', value: onboarding } : null,
    trialDaysLeft !== null
      ? { label: 'Trial', value: `${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` }
      : null,
    userData?.storeId ? { label: 'ID da loja', value: String(userData.storeId).slice(0, 16) + '...' } : null,
  ].filter(Boolean)

  return (
    <SectionCard
      icon={FiShield}
      title="Conta e assinatura"
      description="Somente leitura"
    >
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-2.5 dark:bg-zinc-950">
            <span className="text-xs font-black uppercase tracking-wide text-[#9ca3af] dark:text-zinc-500">{row.label}</span>
            <span className="text-sm font-black text-[#111827] dark:text-white">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#9ca3af]">
        <FiInfo size={11} />
        Para alterar plano ou assinatura, acesse a área de suporte.
      </p>
    </SectionCard>
  )
}


function ThemeCard() {
  const { theme, setTheme } = useDashboardTheme()

  const options = [
    { id: 'light', label: 'Claro', icon: FiSun },
    { id: 'dark', label: 'Escuro', icon: FiMoon },
    { id: 'system', label: 'Sistema', icon: FiMonitor },
  ]

  return (
    <SectionCard
      icon={FiSettings}
      title="Aparência do painel"
      description="Personalize o tema visual"
    >
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon
          const active = theme === opt.id

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-black transition active:scale-95 cursor-pointer ${
                active
                  ? 'border-[#f97316] bg-orange-50/50 text-[#f97316] dark:bg-orange-950/20 dark:border-[#f97316] dark:text-[#f97316]'
                  : 'border-gray-100 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─── Main Panel ────────────────────────────────────────────────

export default function ProfilePanel({ onLogout }) {
  const { user, userData, refreshUserData } = useAuth()
  const [toast, setToast] = useState(null)

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleSuccess = useCallback(
    async (msg) => {
      if (typeof refreshUserData === 'function') {
        await refreshUserData().catch(() => {})
      }
      showToast('success', msg)
    },
    [refreshUserData, showToast]
  )

  const handleError = useCallback(
    (msg) => showToast('error', msg),
    [showToast]
  )

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#f97316]" />
      </div>
    )
  }

  return (
    <div className="w-full">
      <Toast toast={toast} onClose={() => setToast(null)} />
      
      <div className="space-y-4">
        {/* Avatar (full width) */}
        <AvatarCard
          user={user}
          userData={userData}
          onSuccess={handleSuccess}
          onError={handleError}
        />

        {/* 2-column grid on desktop */}
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <DisplayNameCard
              user={user}
              userData={userData}
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <SubscriptionCard userData={userData} />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <SecurityCard
              user={user}
              userData={userData}
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <PhoneCard
              userData={userData}
              onSuccess={handleSuccess}
            />
            <ThemeCard />
          </div>
        </div>
      </div>
    </div>
  )
}
