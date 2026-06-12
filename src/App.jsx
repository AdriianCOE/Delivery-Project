import { lazy, Suspense, useEffect, useState } from 'react'
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

  if (!shouldLoadAuthProvider(pathname)) {
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
      const idleId = window.requestIdleCallback(showConsent, { timeout: 2000 })

      return () => {
        window.cancelIdleCallback?.(idleId)
      }
    }

    const timeoutId = window.setTimeout(showConsent, 1200)

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