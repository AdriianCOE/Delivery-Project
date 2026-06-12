import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  doc,
  getDoc,
  getDocFromCache,
} from 'firebase/firestore'

import { setSentryUser } from '../services/sentry'

import { db } from '../services/firebase'

export const AuthContext = createContext(null)

const publicAuthFallback = {
  firebaseUser: null,
  user: null,
  userData: null,
  role: '',
  loading: false,
  authLoading: false,
  isLoading: false,
  authError: null,
  isAuthenticated: false,
  isAdmin: false,
  isDeveloper: false,
  isMerchant: false,
  storeId: null,
  storeIds: [],
  hasRole: () => false,
  logout: async () => {},
  refreshUserData: async () => null,
}

function normalizeFirebaseUser(firebaseUser) {
  if (!firebaseUser) return null

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    phoneNumber: firebaseUser.phoneNumber,
    providerId: firebaseUser.providerId,
    isAnonymous: firebaseUser.isAnonymous === true,
  }
}

async function isAnonymousFirebaseUser(firebaseUser) {
  if (!firebaseUser) return false
  if (firebaseUser.isAnonymous === true) return true

  try {
    const token = await firebaseUser.getIdTokenResult?.()
    const signInProvider =
      token?.signInProvider ||
      token?.claims?.firebase?.sign_in_provider

    return signInProvider === 'anonymous'
  } catch {
    return firebaseUser.isAnonymous === true
  }
}

async function loadUserData(uid) {
  const userRef = doc(db, 'users', uid)

  try {
    const snapshot = await getDoc(userRef)
    return snapshot.exists() ? snapshot.data() : null

  } catch (serverError) {
    console.warn('[Auth] Firestore indisponível. Tentando cache local...', serverError)

    try {
      const cachedSnapshot = await getDocFromCache(userRef)
      return cachedSnapshot.exists() ? cachedSnapshot.data() : null
    } catch (cacheError) {
      console.warn('[Auth] Nenhum cache local encontrado para o usuário.', cacheError)
      return null
    }
  }
}

function getNormalizedRole(userData) {
  const role = String(userData?.role || '').trim().toLowerCase()

  if (role === 'lojista') return 'merchant'
  if (role === 'dev') return 'developer'

  return role
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const authLoadIdRef = useRef(0)

  useEffect(() => {
    let isMounted = true
    let unsubscribeAuth = null

    async function bootAuth() {
      const [
        { onAuthStateChanged },
        { auth },
      ] = await Promise.all([
        import('firebase/auth'),
        import('../services/firebaseAuth'),
      ])

      if (!isMounted) return

      unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
        if (!isMounted) return
        const loadId = authLoadIdRef.current + 1
        authLoadIdRef.current = loadId

        setLoading(true)
        setAuthError(null)

        try {
          if (!currentFirebaseUser) {
            setFirebaseUser(null)
            setUser(null)
            setUserData(null)
            setSentryUser(null)
            return
          }

          const anonymousAuth = await isAnonymousFirebaseUser(currentFirebaseUser)
          const baseUser = {
            ...normalizeFirebaseUser(currentFirebaseUser),
            isAnonymous: anonymousAuth,
          }
          
          if (anonymousAuth) {
            setFirebaseUser(baseUser)
            setUser(null)
            setUserData(null)
            setSentryUser(null)
            setLoading(false)
            return
          }

          const firestoreUserData = await loadUserData(currentFirebaseUser.uid)
          const normalizedRole = getNormalizedRole(firestoreUserData)

          if (!isMounted || authLoadIdRef.current !== loadId) return

          if (!firestoreUserData) {
            setFirebaseUser(baseUser)
            setUser(null)
            setUserData(null)
            setSentryUser(null)
            return
          }

          const mergedUser = {
            ...baseUser,
            ...firestoreUserData,
            role: normalizedRole || firestoreUserData.role || '',
          }

          setFirebaseUser(baseUser)
          setUser(mergedUser)
          setUserData({
            ...firestoreUserData,
            role: normalizedRole || firestoreUserData.role || '',
          })
          setSentryUser(mergedUser)
        } catch (error) {
          console.error('[Auth] Erro ao carregar usuário:', error)
          if (!isMounted || authLoadIdRef.current !== loadId) return
          setAuthError(error)

          const fallbackUser = normalizeFirebaseUser(currentFirebaseUser)

          setFirebaseUser(fallbackUser)
          setUser(null)
          setUserData(null)
          setSentryUser(null)
        } finally {
          if (isMounted && authLoadIdRef.current === loadId) {
            setLoading(false)
          }
        }
      })
    }

    bootAuth().catch((error) => {
      console.error('[Auth] Erro ao inicializar Firebase Auth:', error)
      if (isMounted) {
        setAuthError(error)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false

      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth()
      }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const [
        { signOut },
        { auth },
      ] = await Promise.all([
        import('firebase/auth'),
        import('../services/firebaseAuth'),
      ])
      await signOut(auth)
    } catch (error) {
      console.warn('Erro ao executar signOut do Firebase:', error)
    } finally {
      setFirebaseUser(null)
      setUser(null)
      setUserData(null)
      setSentryUser(null)
    }
  }, [])

  const refreshUserData = useCallback(async () => {
    const { auth } = await import('../services/firebaseAuth')
    const currentUser = auth.currentUser || firebaseUser
    if (!currentUser) return null

    try {
      const anonymousAuth = await isAnonymousFirebaseUser(currentUser)
      const baseUser = {
        ...normalizeFirebaseUser(currentUser),
        isAnonymous: anonymousAuth,
      }

      if (anonymousAuth) {
        setFirebaseUser(baseUser)
        setUser(null)
        setUserData(null)
        setSentryUser(null)
        return null
      }

      const firestoreUserData = await loadUserData(currentUser.uid)
      const normalizedRole = getNormalizedRole(firestoreUserData)

      if (!firestoreUserData) {
        setFirebaseUser(baseUser)
        setUser(null)
        setUserData(null)
        setSentryUser(null)
        return null
      }

      const mergedUser = {
        ...baseUser,
        ...firestoreUserData,
        role: normalizedRole || firestoreUserData.role || '',
      }

      setFirebaseUser(baseUser)
      setUser(mergedUser)
      setUserData({
        ...firestoreUserData,
        role: normalizedRole || firestoreUserData.role || '',
      })
      setSentryUser(mergedUser)

      return firestoreUserData
    } catch (error) {
      console.error('[Auth] Erro ao recarregar dados do usuário:', error)
      return null
    }
  }, [firebaseUser])

  const role = useMemo(() => getNormalizedRole(userData) || getNormalizedRole(user), [user, userData])

  const hasRole = useCallback(
    (allowedRoles = []) => {
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return true
      }

      const normalizedAllowedRoles = allowedRoles.map((item) => {
        const allowedRole = String(item).trim().toLowerCase()
        if (allowedRole === 'lojista') return 'merchant'
        if (allowedRole === 'dev') return 'developer'
        return allowedRole
      })

      return normalizedAllowedRoles.includes(role)
    },
    [role]
  )

  const value = useMemo(
    () => ({
      firebaseUser,
      user,
      userData,
      role,
      loading,
      authLoading: loading,
      isLoading: loading,
      authError,
      isAuthenticated: Boolean(user),
      isAdmin: role === 'admin' || role === 'developer',
      isDeveloper: role === 'developer',
      isMerchant: role === 'merchant',
      storeId: userData?.storeId || user?.storeId || null,
      storeIds: userData?.storeIds || user?.storeIds || [],
      hasRole,
      logout,
      refreshUserData,
    }),
    [authError, firebaseUser, hasRole, loading, logout, refreshUserData, role, user, userData]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    return publicAuthFallback
  }

  return context
}


