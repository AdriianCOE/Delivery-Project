import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FiCheck, FiShield, FiX } from 'react-icons/fi'

const CONSENT_KEY = 'pratoby_cookie_consent'
const CONSENT_VERSION = '1.0'

const PRIVATE_ROUTE_PREFIXES = [
  '/dashboard',
  '/login',
  '/register',
  '/cadastro',
  '/admin',
]

function safeParseConsent(raw) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== CONSENT_VERSION) return null
    if (parsed.necessary !== true) return null

    return {
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      acceptedAt: parsed.acceptedAt || null,
      version: CONSENT_VERSION,
    }
  } catch {
    return null
  }
}

export function getCookieConsent() {
  if (typeof window === 'undefined') return null

  try {
    return safeParseConsent(window.localStorage.getItem(CONSENT_KEY))
  } catch {
    return null
  }
}

export function hasPreferenceConsent() {
  return getCookieConsent()?.preferences === true
}

export function hasAnalyticsConsent() {
  return getCookieConsent()?.analytics === true
}

function persistCookieConsent({ preferences }) {
  if (typeof window === 'undefined') return null

  const consent = {
    necessary: true,
    preferences: preferences === true,
    analytics: preferences === true,
    acceptedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  }

  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))

    window.dispatchEvent(
      new CustomEvent('pratoby:cookie-consent-changed', {
        detail: consent,
      })
    )
  } catch {
    // Se localStorage estiver bloqueado, não quebra a experiência do usuário.
  }

  return consent
}

export default function CookieConsent() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  const isPrivateRoute = useMemo(
    () => PRIVATE_ROUTE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix)),
    [location.pathname]
  )

  useEffect(() => {
    if (isPrivateRoute) {
      setVisible(false)
      return undefined
    }

    const savedConsent = getCookieConsent()

    if (savedConsent) {
      setVisible(false)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setVisible(true)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [isPrivateRoute])

  const saveConsent = useCallback((preferences) => {
    persistCookieConsent({ preferences })
    setVisible(false)
  }, [])

  const handleEssentialOnly = useCallback(() => {
    saveConsent(false)
  }, [saveConsent])

  const handleAcceptPreferences = useCallback(() => {
    saveConsent(true)
  }, [saveConsent])

  if (!visible || isPrivateRoute) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-5 sm:pb-5"
      role="region"
      aria-label="Aviso de cookies"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.7rem] border border-orange-100 bg-white/95 shadow-2xl shadow-gray-900/15 ring-1 ring-white/70 backdrop-blur-xl dark:border-orange-500/20 dark:bg-zinc-950/95 dark:shadow-black/30 dark:ring-white/10">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300">
              <FiShield size={21} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-tight text-[#111827] dark:text-white">
                    Cookies para melhorar sua experiência
                  </h2>

                  <p className="mt-1.5 text-sm font-medium leading-6 text-[#6b7280] dark:text-zinc-300">
                    Usamos cookies essenciais para manter o carrinho funcionando.
                    Com sua permissão, também podemos lembrar dados de entrega neste
                    dispositivo para agilizar seus próximos pedidos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-orange-300 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
                  aria-label="Continuar apenas com cookies essenciais"
                >
                  <FiX aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-orange-300 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Continuar com essenciais
                </button>

                <button
                  type="button"
                  onClick={handleAcceptPreferences}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-[#ea580c] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 active:scale-[0.98] dark:shadow-orange-950/40 dark:focus:ring-offset-zinc-950"
                >
                  <FiCheck aria-hidden="true" />
                  Aceitar e agilizar meus pedidos
                </button>
              </div>

              <p className="mt-3 text-[11px] font-semibold leading-5 text-[#9ca3af] dark:text-zinc-500">
                Cookies essenciais ficam sempre ativos. Dados de preferência são
                usados apenas para facilitar próximos pedidos neste dispositivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}