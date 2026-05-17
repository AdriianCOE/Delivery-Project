import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FiCheck, FiShield, FiX } from 'react-icons/fi'

const CONSENT_KEY = 'pratoby_cookie_consent'

export function getCookieConsent() {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

export function hasPreferenceConsent() {
  const consent = getCookieConsent()

  return consent?.preferences === true
}

export default function CookieConsent() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  const isPrivateRoute =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register')

  useEffect(() => {
    if (isPrivateRoute) return undefined

    const savedConsent = getCookieConsent()

    if (!savedConsent) {
      const timer = window.setTimeout(() => {
        setVisible(true)
      }, 900)

      return () => window.clearTimeout(timer)
    }

    return undefined
  }, [isPrivateRoute])

  const saveConsent = (preferences) => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        necessary: true,
        preferences,
        analytics: preferences,
        acceptedAt: new Date().toISOString(),
        version: '1.0',
      })
    )

    setVisible(false)
  }

  if (!visible || isPrivateRoute) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.7rem] border border-orange-100 bg-white/95 shadow-2xl shadow-gray-900/15 ring-1 ring-white/70 backdrop-blur-xl">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
              <FiShield size={21} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-tight text-[#111827]">
                    Usamos cookies para melhorar sua experiência
                  </h2>

                  <p className="mt-1.5 text-sm font-medium leading-6 text-[#6b7280]">
                    O PratoBy usa cookies essenciais para manter o carrinho funcionando
                    e, com sua permissão, pode lembrar seus dados de entrega para
                    agilizar seus próximos pedidos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => saveConsent(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827]"
                  aria-label="Fechar aviso de cookies"
                >
                  <FiX />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => saveConsent(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 text-sm font-black text-[#6b7280] transition hover:bg-gray-50 hover:text-[#111827] active:scale-[0.98]"
                >
                  Continuar com essenciais
                </button>

                <button
                  type="button"
                  onClick={() => saveConsent(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-4 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-[#ea580c] active:scale-[0.98]"
                >
                  <FiCheck />
                  Aceitar e agilizar meus pedidos
                </button>
              </div>

              <p className="mt-3 text-[11px] font-semibold leading-5 text-[#9ca3af]">
                Cookies essenciais ficam sempre ativos. Dados de preferência são usados
                apenas para facilitar próximos pedidos neste dispositivo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}