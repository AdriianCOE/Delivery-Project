import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import AppRoutes from './routes/AppRoutes'
import { ConfirmDialogProvider } from './components/ui/ConfirmDialogProvider'

const AuthProvider = lazy(() =>
  import('./contexts/AuthContext').then((module) => ({
    default: module.AuthProvider,
  }))
)

const CookieConsent = lazy(() => import('./components/privacy/CookieConsent'))

const COOKIE_CONSENT_KEY = 'pratoby_cookie_consent'

const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/cadastro',
  '/onboarding',
  '/auth/action',
  '/admin',
  '/dashboard',
]

const COOKIE_PRIVATE_ROUTE_PREFIXES = [
  ...AUTH_ROUTE_PREFIXES,
  '/pedido',
  '/order',
  '/tracking',
  '/store',
]

const PUBLIC_MARKETING_PATHS = new Set([
  '',
  'sobre',
  'contato',
  'planos',
  'exemplos',
  'privacidade',
  'termos',
  'cardapio-digital',
  'delivery-sem-comissao',
  'sistema-para-confeitaria',
  'sistema-para-lanchonete',
  'sistema-para-pizzaria',
  'cardapio-digital-para-restaurante',
  'Cardapio-Digital',
])

function matchesRoutePrefix(pathname = '', prefixes = []) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isLikelyPublicStorefrontPath(pathname = '') {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 1) return false

  return !PUBLIC_MARKETING_PATHS.has(segments[0])
}

function shouldLoadAuthProvider(pathname = '') {
  return matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)
    || matchesRoutePrefix(pathname, ['/store'])
    || isLikelyPublicStorefrontPath(pathname)
}

function AuthBoundary({ children }) {
  const { pathname } = useLocation()
  const shouldLoadAuth = useMemo(
    () => shouldLoadAuthProvider(pathname),
    [pathname]
  )

  if (!shouldLoadAuth) {
    return children
  }

  return (
    <Suspense fallback={null}>
      <AuthProvider>{children}</AuthProvider>
    </Suspense>
  )
}

function DeferredCookieConsent() {
  const { pathname } = useLocation()
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (matchesRoutePrefix(pathname, COOKIE_PRIVATE_ROUTE_PREFIXES)) return undefined
    if (isLikelyPublicStorefrontPath(pathname)) return undefined

    try {
      if (window.localStorage.getItem(COOKIE_CONSENT_KEY)) return undefined
    } catch {
      // Se o storage estiver bloqueado, o componente lida com o fallback depois.
    }

    const showConsent = () => setShouldRender(true)

    if ('requestIdleCallback' in window) {
      let idleId = null
      const timeoutId = window.setTimeout(() => {
        idleId = window.requestIdleCallback(showConsent, { timeout: 1800 })
      }, 5200)

      return () => {
        window.clearTimeout(timeoutId)
        if (idleId !== null) {
          window.cancelIdleCallback?.(idleId)
        }
      }
    }

    const timeoutId = window.setTimeout(showConsent, 6000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pathname])

  if (!shouldRender) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <CookieConsent />
    </Suspense>
  )
}

export default function App() {
  return (
    <ConfirmDialogProvider>
      <AuthBoundary>
        <AppRoutes />
        <DeferredCookieConsent />
      </AuthBoundary>
    </ConfirmDialogProvider>
  )
}
