// hooks/usePresence.js
import { useEffect, useState } from 'react'
import {
  ref,
  onValue,
  onDisconnect,
  push,
  set,
  remove,
  serverTimestamp,
} from 'firebase/database'
import { rtdb } from '../services/firebase'

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

    const unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true) return

      if (!isMerchant) {
        myUserRef = push(storePresenceRef)

        try {
          await onDisconnect(myUserRef).remove()

          await set(myUserRef, {
            online: true,
            connectedAt: serverTimestamp(),
          })
        } catch (error) {
          console.error('Erro ao registrar presença:', error)
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
      if (myUserRef) {
        remove(myUserRef).catch(() => {})
      }

      unsubscribeConnected()
      unsubscribePresence?.()
    }
  }, [storeId, isMerchant])

  return activeUsers
}

