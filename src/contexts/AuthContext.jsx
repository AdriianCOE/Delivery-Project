import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
} from 'firebase/auth'

import {
  doc,
  getDoc,
  getDocFromCache,
} from 'firebase/firestore'

import { auth, db } from '../services/firebase'

export const AuthContext = createContext(null)

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

  useEffect(() => {
    let isMounted = true
    let unsubscribeAuth = null

    async function bootAuth() {
      try {
        // Mantém a sessão somente enquanto a aba/janela existir.
        // Ao fechar o navegador/aba, o usuário precisará logar novamente.
        await setPersistence(auth, browserSessionPersistence)
      } catch (error) {
        console.warn('[Auth] Não foi possível definir persistência de sessão.', error)
      }

      unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
        if (!isMounted) return

        setLoading(true)
        setAuthError(null)

        try {
          if (!currentFirebaseUser) {
            setFirebaseUser(null)
            setUser(null)
            setUserData(null)
            return
          }

          const baseUser = normalizeFirebaseUser(currentFirebaseUser)
          const firestoreUserData = await loadUserData(currentFirebaseUser.uid)
          const normalizedRole = getNormalizedRole(firestoreUserData)

          if (!isMounted) return

          const mergedUser = {
            ...baseUser,
            ...(firestoreUserData || {}),
            role: normalizedRole || firestoreUserData?.role || '',
          }

          setFirebaseUser(baseUser)
          setUser(mergedUser)
          setUserData({
            ...(firestoreUserData || {}),
            role: normalizedRole || firestoreUserData?.role || '',
          })
        } catch (error) {
          console.error('[Auth] Erro ao carregar usuário:', error)
          setAuthError(error)

          const fallbackUser = normalizeFirebaseUser(currentFirebaseUser)

          setFirebaseUser(fallbackUser)
          setUser(fallbackUser)
          setUserData(null)
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      })
    }

    bootAuth()

    return () => {
      isMounted = false

      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth()
      }
    }
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
    setFirebaseUser(null)
    setUser(null)
    setUserData(null)
  }, [])

  const role = useMemo(() => getNormalizedRole(userData) || getNormalizedRole(user), [user, userData])

  const hasRole = useCallback(
    (allowedRoles = []) => {
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return true
      }

      const normalizedAllowedRoles = allowedRoles.map((item) =>
        String(item).trim().toLowerCase() === 'lojista'
          ? 'merchant'
          : String(item).trim().toLowerCase()
      )

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
    }),
    [authError, firebaseUser, hasRole, loading, logout, role, user, userData]
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
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}


