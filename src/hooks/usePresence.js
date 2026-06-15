// hooks/usePresence.js
import { useEffect, useState } from 'react'
import {
  ref,
  onValue,
  onDisconnect,
  set,
  remove,
  serverTimestamp,
} from 'firebase/database'
import { rtdb } from '../services/firebase'

const AUTH_SESSION_MARKER = 'pratoby:auth:session'
const FIREBASE_AUTH_STORAGE_PREFIX = 'firebase:authUser:'

function hasStoredDashboardAuth() {
  if (typeof window === 'undefined') return false

  try {
    if (window.localStorage.getItem(AUTH_SESSION_MARKER) === '1') return true

    for (let index = 0; index < window.localStorage.length; index += 1) {
      if (window.localStorage.key(index)?.startsWith(FIREBASE_AUTH_STORAGE_PREFIX)) {
        return true
      }
    }
  } catch {
    return false
  }

  return false
}

async function getPresenceUser() {
  const [
    { browserSessionPersistence, setPersistence, signInAnonymously },
    { auth },
  ] = await Promise.all([
    import('firebase/auth'),
    import('../services/firebaseAuth'),
  ])

  // Guard: if ANY authenticated user is active (merchant or previous anon session),
  // skip setPersistence entirely. Calling it here could downgrade a merchant's
  // localStorage-based session to sessionStorage, logging them out on the next tab.
  if (auth.currentUser) return auth.currentUser
  if (hasStoredDashboardAuth()) return null

  // Only change persistence when we are certain no user is active.
  await setPersistence(auth, browserSessionPersistence)
  const credential = await signInAnonymously(auth)
  return credential.user
}

export function usePresence(storeId, isMerchant = false) {
  const [activeUsers, setActiveUsers] = useState(0)

  useEffect(() => {
    if (!storeId) {
      setActiveUsers(0)
      return
    }

    const safeStoreId = String(storeId).replace(/[.#$/[\]]/g, '_')

    let myUserRef = null
    let unsubscribeConnected = null
    let unsubscribePresence = null
    let isRegisteringPresence = false
    let isCancelled = false

    const startPresence = () => {
      if (isCancelled) return

      const connectedRef = ref(rtdb, '.info/connected')
      const storePresenceCountRef = ref(rtdb, `presenceCounts/${safeStoreId}/activeCount`)

      unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() !== true) return

        if (!isMerchant && !myUserRef && !isRegisteringPresence) {
          isRegisteringPresence = true

          try {
            const presenceUser = await getPresenceUser()
            if (isCancelled || !presenceUser?.uid) return

            myUserRef = ref(rtdb, `presence/${safeStoreId}/${presenceUser.uid}`)

            await onDisconnect(myUserRef).remove()

            await set(myUserRef, {
              online: true,
              connectedAt: serverTimestamp(),
            })
          } catch (error) {
            console.error('Erro ao registrar presença:', error)
          } finally {
            isRegisteringPresence = false
          }
        }
      })

      unsubscribePresence = onValue(storePresenceCountRef, (snapshot) => {
        const value = Number(snapshot.val() || 0)
        setActiveUsers(Number.isFinite(value) ? Math.max(0, value) : 0)
      })
    }

    const startTimer = window.setTimeout(startPresence, isMerchant ? 0 : 2500)

    return () => {
      isCancelled = true
      window.clearTimeout(startTimer)

      if (myUserRef) {
        remove(myUserRef).catch(() => {})
      }

      unsubscribeConnected?.()
      unsubscribePresence?.()
    }
  }, [storeId, isMerchant])

  return activeUsers
}

