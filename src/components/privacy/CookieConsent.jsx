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

    let timer = null
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        setVisible(true)
      }, 300)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      if (timer) window.clearTimeout(timer)
    }
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
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-4 sm:pb-4"
      role="region"
      aria-label="Aviso de cookies"
    >
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-orange-100 bg-white/95 shadow-xl shadow-gray-900/10 ring-1 ring-white/70 backdrop-blur-xl dark:border-orange-500/20 dark:bg-zinc-950/95 dark:shadow-black/30 dark:ring-white/10">
        <div className="p-3 sm:p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-300 sm:flex">
              <FiShield size={18} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-black tracking-tight text-[#111827] dark:text-white">
                    Cookies para melhorar sua experiência
                  </h2>

                  <p className="mt-1 text-xs font-medium leading-5 text-[#6b7280] dark:text-zinc-300">
                    Usamos cookies essenciais para manter o carrinho funcionando.
                    Com sua permissão, lembramos preferências neste dispositivo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-orange-300 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
                  aria-label="Continuar apenas com cookies essenciais"
                >
                  <FiX aria-hidden="true" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-100 bg-white px-3 text-xs font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-orange-300 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Só essenciais
                </button>

                <button
                  type="button"
                  onClick={handleAcceptPreferences}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-700 px-3 text-xs font-black text-white shadow-md shadow-orange-200 transition hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 active:scale-[0.98] dark:bg-orange-600 dark:hover:bg-orange-500 dark:shadow-orange-950/40 dark:focus:ring-offset-zinc-950"
                >
                  <FiCheck aria-hidden="true" />
                  Aceitar preferências
                </button>
              </div>

              <p className="sr-only">
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
