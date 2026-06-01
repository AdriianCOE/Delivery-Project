import { deleteToken, getToken } from 'firebase/messaging'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import {
  functions,
  auth,
  db,
  firebaseConfig,
  getSupportedMessaging,
} from '../services/firebase'
import { httpsCallable } from 'firebase/functions'

function hasNotificationApi() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function getNotificationPermission() {
  if (!hasNotificationApi()) return 'unsupported'
  return Notification.permission
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function getMerchantTokenHash(token) {
  const uid = auth.currentUser?.uid
  if (!uid || !token) return ''
  return sha256Hex(`${uid}:${token}`)
}

async function sha256OrderTokenHash({ orderId, trackingToken, token }) {
  if (!orderId || !trackingToken || !token) return ''
  return sha256Hex(`${orderId}:${trackingToken}:${token}`)
}

function getFirebaseMessagingSwUrl() {
  const publicConfig = {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    databaseURL: firebaseConfig.databaseURL,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  }

  return `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(publicConfig))}`
}

function waitForServiceWorkerActivation(worker) {
  if (!worker || worker.state === 'activated') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.removeEventListener('statechange', handleStateChange)
      reject(new Error('Service worker nao ativou a tempo.'))
    }, 10000)

    function handleStateChange() {
      if (worker.state === 'activated') {
        window.clearTimeout(timeout)
        worker.removeEventListener('statechange', handleStateChange)
        resolve()
      }
    }

    worker.addEventListener('statechange', handleStateChange)
    handleStateChange()
  })
}

function getFcmErrorReason(error) {
  const message = String(error?.message || error?.name || error || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  if (code.includes('permission') || message.includes('permission')) {
    return 'permission-denied'
  }

  if (
    error?.name === 'AbortError' ||
    message.includes('push service') ||
    message.includes('registration failed')
  ) {
    return 'push-service-error'
  }

  if (message.includes('vapid')) {
    return 'invalid-vapid-key'
  }

  if (message.includes('service worker')) {
    return 'service-worker-error'
  }

  return 'token-error'
}

async function clearMessagingPushSubscription(registration) {
  try {
    const subscription = await registration?.pushManager?.getSubscription?.()
    if (subscription) await subscription.unsubscribe()
  } catch (error) {
    console.warn('[FCM] Nao foi possivel limpar push subscription antiga.', error)
  }
}

async function resetMessagingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async (registration) => {
      const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || ''

      if (!scriptUrl.includes('/firebase-messaging-sw.js')) return

      await clearMessagingPushSubscription(registration)
      await registration.unregister()
    }))
  } catch (error) {
    console.warn('[FCM] Nao foi possivel reiniciar service worker FCM.', error)
  }
}

async function registerMessagingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  const registration = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), {
    scope: '/',
  })

  registration.update().catch(() => {})

  if (!registration.active) {
    await waitForServiceWorkerActivation(registration.installing || registration.waiting)
  }

  return registration.active
    ? registration
    : navigator.serviceWorker.ready
}

async function getFcmTokenWithRecovery(messaging, vapidKey) {
  const serviceWorkerRegistration = await registerMessagingServiceWorker()

  try {
    return await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    })
  } catch (error) {
    if (getFcmErrorReason(error) !== 'push-service-error') {
      throw error
    }

    console.warn('[FCM] Falha no push service. Limpando subscription antiga e tentando novamente.', error)
    await clearMessagingPushSubscription(serviceWorkerRegistration)
    await resetMessagingServiceWorker()

    const freshRegistration = await registerMessagingServiceWorker()
    return getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: freshRegistration,
    })
  }
}

function getPlatform() {
  if (typeof navigator === 'undefined') return 'unknown'
  return navigator.userAgentData?.platform || navigator.platform || 'web'
}

export async function isFcmSupported() {
  if (!hasNotificationApi()) {
    return {
      supported: false,
      reason: 'unsupported',
      permission: 'unsupported',
    }
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      supported: false,
      reason: 'service-worker-unavailable',
      permission: getNotificationPermission(),
    }
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return {
      supported: false,
      reason: 'crypto-unavailable',
      permission: getNotificationPermission(),
    }
  }

  const messaging = await getSupportedMessaging()
  if (!messaging) {
    return {
      supported: false,
      reason: 'messaging-unavailable',
      permission: getNotificationPermission(),
    }
  }

  return {
    supported: true,
    reason: 'supported',
    permission: getNotificationPermission(),
  }
}

export async function requestFcmPermissionAndToken() {
  const support = await isFcmSupported()
  if (!support.supported) return support

  const vapidKey = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY
  if (!vapidKey) {
    return {
      supported: true,
      permission: getNotificationPermission(),
      token: '',
      tokenHash: '',
      reason: 'missing-vapid-key',
    }
  }

  let permission = getNotificationPermission()
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    return {
      supported: true,
      permission,
      token: '',
      tokenHash: '',
      reason: permission === 'denied' ? 'permission-denied' : 'permission-not-granted',
    }
  }

  const messaging = await getSupportedMessaging()
  let token = ''

  try {
    token = await getFcmTokenWithRecovery(messaging, vapidKey)
  } catch (error) {
    const reason = getFcmErrorReason(error)

    console.error('[FCM] Erro ao obter token push.', error)

    return {
      supported: true,
      permission,
      token: '',
      tokenHash: '',
      reason,
      errorMessage: String(error?.message || error?.name || error || ''),
    }
  }

  const tokenHash = await getMerchantTokenHash(token)

  return {
    supported: true,
    permission,
    token,
    tokenHash,
    reason: token ? 'token-created' : 'token-empty',
  }
}

export async function requestCustomerOrderFcmPermissionAndToken({ orderId, trackingToken }) {
  const result = await requestFcmPermissionAndToken()

  if (!result.token) return result

  return {
    ...result,
    tokenHash: await sha256OrderTokenHash({
      orderId,
      trackingToken,
      token: result.token,
    }),
  }
}

export async function saveMerchantFcmToken({ storeId, token, tokenHash }) {
  const uid = auth.currentUser?.uid

  if (!uid) {
    throw new Error('Usuario autenticado obrigatorio para salvar notificacao push.')
  }

  const resolvedTokenHash = tokenHash || await getMerchantTokenHash(token)

  if (!storeId || !token || !resolvedTokenHash) {
    throw new Error('storeId, token e tokenHash sao obrigatorios.')
  }

  const tokenRef = doc(db, 'stores', storeId, 'notificationTokens', resolvedTokenHash)
  const existingToken = await getDoc(tokenRef)

  const payload = {
    uid,
    storeId,
    token,
    enabled: true,
    platform: getPlatform(),
    userAgent: typeof navigator === 'undefined' ? '' : String(navigator.userAgent || '').slice(0, 600),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }

  if (!existingToken.exists()) {
    payload.createdAt = serverTimestamp()
  }

  await setDoc(tokenRef, payload, { merge: true })

  return { tokenHash: resolvedTokenHash }
}

export async function disableMerchantFcmToken({ storeId, token, tokenHash }) {
  if (!storeId) return { disabled: false, reason: 'missing-store-id' }

  let resolvedToken = token
  let resolvedTokenHash = tokenHash

  try {
    const permission = getNotificationPermission()
    const vapidKey = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY

    if ((!resolvedToken || !resolvedTokenHash) && permission === 'granted' && vapidKey) {
      const messaging = await getSupportedMessaging()
      const serviceWorkerRegistration = await registerMessagingServiceWorker()
      resolvedToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      })
      resolvedTokenHash = await getMerchantTokenHash(resolvedToken)
    }

    if (resolvedTokenHash) {
      const tokenRef = doc(db, 'stores', storeId, 'notificationTokens', resolvedTokenHash)
      const tokenSnapshot = await getDoc(tokenRef)

      if (tokenSnapshot.exists()) {
        await setDoc(tokenRef, {
          enabled: false,
          updatedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        }, { merge: true })
      }
    }

    if (resolvedToken) {
      const messaging = await getSupportedMessaging()
      if (messaging) await deleteToken(messaging)
    }

    return { disabled: true, tokenHash: resolvedTokenHash || '' }
  } catch (error) {
    console.warn('[FCM] Nao foi possivel desativar token push.', error)
    return { disabled: false, reason: 'disable-failed', error }
  }
}

export async function saveCustomerOrderFcmToken({ orderId, trackingToken, token }) {
  if (!orderId || !trackingToken || !token) {
    throw new Error('orderId, trackingToken e token sao obrigatorios.')
  }

  const registerCustomerOrderPushToken = httpsCallable(functions, 'registerCustomerOrderPushToken')
  const result = await registerCustomerOrderPushToken({
    orderId,
    trackingToken,
    token,
    platform: getPlatform(),
    userAgent: typeof navigator === 'undefined' ? '' : String(navigator.userAgent || '').slice(0, 600),
  })

  return result.data || { ok: true }
}

export async function disableCustomerOrderFcmToken({ orderId, trackingToken, token, tokenHash }) {
  if (!orderId || !trackingToken) {
    return { disabled: false, reason: 'missing-order' }
  }

  let resolvedToken = token
  let resolvedTokenHash = tokenHash

  try {
    const permission = getNotificationPermission()
    const vapidKey = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY

    if ((!resolvedToken || !resolvedTokenHash) && permission === 'granted' && vapidKey) {
      const messaging = await getSupportedMessaging()
      const serviceWorkerRegistration = await registerMessagingServiceWorker()
      resolvedToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      })
      resolvedTokenHash = await sha256OrderTokenHash({ orderId, trackingToken, token: resolvedToken })
    }

    const disableCustomerOrderPushToken = httpsCallable(functions, 'disableCustomerOrderPushToken')
    await disableCustomerOrderPushToken({
      orderId,
      trackingToken,
      token: resolvedToken,
      tokenHash: resolvedTokenHash,
    })

    if (resolvedToken) {
      const messaging = await getSupportedMessaging()
      if (messaging) await deleteToken(messaging)
    }

    return { disabled: true, tokenHash: resolvedTokenHash || '' }
  } catch (error) {
    console.warn('[FCM] Nao foi possivel desativar push do pedido.', error)
    return { disabled: false, reason: 'disable-failed', error }
  }
}
