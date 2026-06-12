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

const AUTH_SESSION_MARKER = 'pratoby:auth:session'
const FIREBASE_AUTH_STORAGE_PREFIX = 'firebase:authUser:'

function matchesRoutePrefix(pathname = '', prefixes = []) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function storageHasFirebaseAuth(storage) {
  if (!storage) return false

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)

      if (key?.startsWith(FIREBASE_AUTH_STORAGE_PREFIX)) {
        return true
      }
    }
  } catch {
    return false
  }

  return false
}

function hasStoredAuthSession() {
  if (typeof window === 'undefined') return false

  try {
    if (window.localStorage.getItem(AUTH_SESSION_MARKER) === '1') {
      return true
    }

    return (
      storageHasFirebaseAuth(window.localStorage) ||
      storageHasFirebaseAuth(window.sessionStorage)
    )
  } catch {
    return false
  }
}

function shouldLoadAuthProvider(pathname = '') {
  if (matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)) {
    return true
  }

  return hasStoredAuthSession()
}

function AuthBoundary({ children }) {
  const { pathname } = useLocation()
  const [hasSession, setHasSession] = useState(() => hasStoredAuthSession())

  useEffect(() => {
    setHasSession(hasStoredAuthSession())
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorageChange = () => {
      setHasSession(hasStoredAuthSession())
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const shouldLoadAuth = useMemo(() => {
    if (matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)) {
      return true
    }

    return hasSession
  }, [pathname, hasSession])

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