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
import {
  browserSessionPersistence,
  setPersistence,
  signInAnonymously,
} from 'firebase/auth'
import { auth, rtdb } from '../services/firebase'

async function getPresenceUser() {
  // Guard: if ANY authenticated user is active (merchant or previous anon session),
  // skip setPersistence entirely. Calling it here could downgrade a merchant's
  // localStorage-based session to sessionStorage, logging them out on the next tab.
  if (auth.currentUser) return auth.currentUser

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

    const connectedRef = ref(rtdb, '.info/connected')
    const storePresenceRef = ref(rtdb, `presence/${safeStoreId}`)

    let myUserRef = null
    let unsubscribePresence = null
    let isRegisteringPresence = false
    let isCancelled = false

    const unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
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

    unsubscribePresence = onValue(storePresenceRef, (snapshot) => {
      const value = snapshot.val()

      if (!value) {
        setActiveUsers(0)
        return
      }

      setActiveUsers(Object.keys(value).length)
    })

    return () => {
      isCancelled = true

      if (myUserRef) {
        remove(myUserRef).catch(() => {})
      }

      unsubscribeConnected()
      unsubscribePresence?.()
    }
  }, [storeId, isMerchant])

  return activeUsers
}

