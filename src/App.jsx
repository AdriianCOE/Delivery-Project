import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import AppRoutes from './routes/AppRoutes'
import { CartProvider } from './contexts/CartContext'
import { DashboardThemeProvider } from './contexts/DashboardThemeContext'

const AuthProvider = lazy(() =>
  import('./contexts/AuthContext').then((module) => ({
    default: module.AuthProvider,
  }))
)

const CookieConsent = lazy(() => import('./components/privacy/CookieConsent'))

const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/cadastro',
  '/onboarding',
  '/auth/action',
  '/admin',
  '/dashboard',
]

function matchesRoutePrefix(pathname = '', prefixes = []) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function shouldLoadAuthProvider(pathname = '') {
  return matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)
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
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const showConsent = () => setShouldRender(true)

    if ('requestIdleCallback' in window) {
      let idleId = null
      const timeoutId = window.setTimeout(() => {
        idleId = window.requestIdleCallback(showConsent, { timeout: 1000 })
      }, 2200)

      return () => {
        window.clearTimeout(timeoutId)
        if (idleId !== null) {
          window.cancelIdleCallback?.(idleId)
        }
      }
    }

    const timeoutId = window.setTimeout(showConsent, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

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
    <AuthBoundary>
      <CartProvider>
        <DashboardThemeProvider>
          <AppRoutes />
          <DeferredCookieConsent />
        </DashboardThemeProvider>
      </CartProvider>
    </AuthBoundary>
  )
}
