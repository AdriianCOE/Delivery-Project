import { deleteToken, getToken, onMessage } from 'firebase/messaging'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import {
  functions,
  db,
  firebaseConfig,
  getSupportedMessaging,
} from '../services/firebase'
import { auth } from '../services/firebaseAuth'
import { httpsCallable } from 'firebase/functions'
import { notificationPreferenceEnabled } from './notificationPreferences'

let foregroundFcmUnsubscribe = null
let warnedMissingVapidKey = false
const FOREGROUND_FCM_DEDUPE_MS = 2 * 60 * 1000
const foregroundFcmDedupe = new Map()
const foregroundFcmConfig = {
  merchantEnabled: false,
  merchantPreferences: null,
  customerEnabled: false,
  customerOrderIds: new Set(),
}

function warnMissingVapidKeyOnce() {
  if (warnedMissingVapidKey || !import.meta.env.DEV) return

  warnedMissingVapidKey = true
  console.warn('[FCM] VITE_FIREBASE_MESSAGING_VAPID_KEY nao configurada. Push nao funcionara neste ambiente.')
}

function hasNotificationApi() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function getNotificationPermission() {
  if (!hasNotificationApi()) return 'unsupported'
  return Notification.permission
}

function getWebPushPlatformState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIos: false, isStandalone: false }
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1)
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  return { isIos, isStandalone }
}

let fcmServiceWorkerRegistrationPromise = null
let fcmTokenRequestPromise = null

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isIndexedDbClosingError(error) {
  return (
    error?.name === 'InvalidStateError' ||
    String(error?.message || '').toLowerCase().includes('database connection is closing') ||
    String(error?.message || '').toLowerCase().includes('idbdatabase')
  )
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

function getOrderShortCode(orderId) {
  return String(orderId || '').trim().slice(-4).toUpperCase() || '----'
}

function openNotificationTarget(url) {
  if (typeof window === 'undefined') return
  const targetUrl = String(url || '/dashboard/orders')
  window.focus?.()
  window.location.assign(targetUrl)
}

function isFocusedVisiblePage() {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible' && document.hasFocus?.() === true
}

function getFcmPayloadType(data = {}) {
  const type = String(data.type || '').trim()
  if (type === 'order_status_update') return 'order_status_update'
  if (type === 'merchant_test') return 'merchant_test'
  return 'new_order'
}

function getFcmNotificationUrl(data = {}, type = 'new_order') {
  if (type === 'order_status_update') {
    return data.url || data.trackingUrl || data.trackingPath || '/'
  }

  return data.url || '/dashboard/orders'
}

function getFcmNotificationTag({ type, orderId, status }) {
  if (type === 'order_status_update') {
    return `pratoby-order-status-${orderId || 'unknown'}-${status || 'updated'}`
  }

  if (type === 'merchant_test') {
    return 'pratoby-merchant-test'
  }

  return `pratoby-new-order-${orderId || 'unknown'}`
}

function getForegroundFcmDedupeKey(type, data = {}) {
  if (type === 'new_order') {
    const orderId = String(data.orderId || '').trim()
    return orderId ? `new_order:${orderId}` : ''
  }

  return ''
}

function pruneForegroundFcmDedupe(now = Date.now()) {
  foregroundFcmDedupe.forEach((timestamp, key) => {
    if (now - timestamp > FOREGROUND_FCM_DEDUPE_MS) {
      foregroundFcmDedupe.delete(key)
    }
  })
}

export function markMerchantOrderNotificationSeen(orderId) {
  const normalizedOrderId = String(orderId || '').trim()
  if (!normalizedOrderId) return

  const now = Date.now()
  pruneForegroundFcmDedupe(now)
  foregroundFcmDedupe.set(`new_order:${normalizedOrderId}`, now)
}

function shouldSkipForegroundFcmNotification(type, data = {}) {
  const key = getForegroundFcmDedupeKey(type, data)
  if (!key) return false

  const now = Date.now()
  pruneForegroundFcmDedupe(now)

  const lastSeenAt = foregroundFcmDedupe.get(key)
  if (lastSeenAt && now - lastSeenAt <= FOREGROUND_FCM_DEDUPE_MS) {
    return true
  }

  foregroundFcmDedupe.set(key, now)
  return false
}

function canShowForegroundBrowserNotification({ type, data, ignoreFocus = false, ignorePreferences = false }) {
  if (getNotificationPermission() !== 'granted') {
    return { allowed: false, reason: 'permission-not-granted' }
  }

  if (!ignoreFocus && isFocusedVisiblePage()) {
    return { allowed: false, reason: 'focused-visible' }
  }

  if (type === 'new_order' && !ignorePreferences) {
    if (!foregroundFcmConfig.merchantEnabled) {
      return { allowed: false, reason: 'merchant-listener-disabled' }
    }

    if (
      !notificationPreferenceEnabled(foregroundFcmConfig.merchantPreferences, 'channels', 'browser') ||
      !notificationPreferenceEnabled(foregroundFcmConfig.merchantPreferences, 'events', 'newOrder')
    ) {
      return { allowed: false, reason: 'preference-disabled' }
    }
  }

  if (type === 'order_status_update' && foregroundFcmConfig.customerEnabled) {
    const orderId = String(data?.orderId || '').trim()
    if (foregroundFcmConfig.customerOrderIds.size && !foregroundFcmConfig.customerOrderIds.has(orderId)) {
      return { allowed: false, reason: 'order-not-registered' }
    }
  }

  if (type === 'order_status_update' && !foregroundFcmConfig.customerEnabled) {
    return { allowed: false, reason: 'customer-listener-disabled' }
  }

  return { allowed: true }
}

function showForegroundFcmBrowserNotification(payload, options = {}) {
  const data = payload?.data || {}
  const type = getFcmPayloadType(data)
  const permission = canShowForegroundBrowserNotification({
    type,
    data,
    ignoreFocus: options.ignoreFocus === true,
    ignorePreferences: options.ignorePreferences === true,
  })

  if (!permission.allowed) {
    return { shown: false, reason: permission.reason }
  }

  if (!options.ignoreDedupe && shouldSkipForegroundFcmNotification(type, data)) {
    return { shown: false, reason: 'duplicate-order' }
  }

  const orderId = data.orderId || ''
  const orderNumber = `#${getOrderShortCode(orderId)}`
  const title = type === 'order_status_update'
    ? data.title || 'Pedido atualizado'
    : type === 'merchant_test'
      ? data.title || 'Push ativado no PratoBy'
      : 'Novo pedido recebido'
  const body = type === 'order_status_update'
    ? data.body || `Pedido ${orderNumber} foi atualizado.`
    : type === 'merchant_test'
      ? data.body || 'Este dispositivo já pode receber avisos de novos pedidos.'
      : 'Toque para abrir o painel de pedidos.'

  const notification = new Notification(title, {
    body,
    icon: '/icons/android-chrome-512x512.png',
    badge: '/icons/favicon-32x32.png',
    tag: getFcmNotificationTag({ type, orderId, status: data.status }),
    renotify: true,
    data: {
      url: getFcmNotificationUrl(data, type),
      type,
      orderId,
      status: data.status || '',
    },
  })

  notification.onclick = () => {
    notification.close()
    openNotificationTarget(notification.data?.url)
  }

  return { shown: true }
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
  fcmServiceWorkerRegistrationPromise = null
  fcmTokenRequestPromise = null

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

  if (!fcmServiceWorkerRegistrationPromise) {
    fcmServiceWorkerRegistrationPromise = (async () => {
      const existingRegistration = await navigator.serviceWorker.getRegistration('/')

      if (
        existingRegistration?.active?.scriptURL &&
        existingRegistration.active.scriptURL.includes('/firebase-messaging-sw.js')
      ) {
        existingRegistration.update().catch(() => {})
        return existingRegistration
      }

      const registration = await navigator.serviceWorker.register(getFirebaseMessagingSwUrl(), {
        scope: '/',
      })

      registration.update().catch(() => {})

      if (!registration.active) {
        await waitForServiceWorkerActivation(registration.installing || registration.waiting)
      }

      await navigator.serviceWorker.ready

      return registration.active ? registration : navigator.serviceWorker.ready
    })().catch((error) => {
      fcmServiceWorkerRegistrationPromise = null
      throw error
    })
  }

  return fcmServiceWorkerRegistrationPromise
}

async function getFcmTokenWithRecovery(messaging, vapidKey) {
  if (fcmTokenRequestPromise) {
    return fcmTokenRequestPromise
  }

  fcmTokenRequestPromise = (async () => {
    const serviceWorkerRegistration = await registerMessagingServiceWorker()

    const tokenOptions = {
      vapidKey,
      serviceWorkerRegistration,
    }

    try {
      return await getToken(messaging, tokenOptions)
    } catch (error) {
      if (isIndexedDbClosingError(error)) {
        console.warn('[FCM] IndexedDB estava fechando durante getToken. Tentando novamente...', error)
        await wait(900)
        return getToken(messaging, tokenOptions)
      }

      if (getFcmErrorReason(error) !== 'push-service-error') {
        throw error
      }

      console.warn('[FCM] Falha no push service. Limpando subscription antiga e tentando novamente.', error)

      await clearMessagingPushSubscription(serviceWorkerRegistration)
      await resetMessagingServiceWorker()

      fcmServiceWorkerRegistrationPromise = null

      const freshRegistration = await registerMessagingServiceWorker()

      return getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: freshRegistration,
      })
    } finally {
      fcmTokenRequestPromise = null
    }
  })()

  return fcmTokenRequestPromise
}

function getPlatform() {
  if (typeof navigator === 'undefined') return 'unknown'
  return navigator.userAgentData?.platform || navigator.platform || 'web'
}

export async function isFcmSupported() {
  const platformState = getWebPushPlatformState()

  if (platformState.isIos && !platformState.isStandalone) {
    console.info('[FCM] iOS Safari fora de PWA; push web requer app na Tela de Inicio.')
    return {
      supported: false,
      reason: 'ios-pwa-required',
      permission: getNotificationPermission(),
      ...platformState,
    }
  }

  if (!hasNotificationApi()) {
    console.info('[FCM] Notification API indisponivel neste navegador.')
    return {
      supported: false,
      reason: 'unsupported',
      permission: 'unsupported',
      ...platformState,
    }
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.info('[FCM] Service Worker indisponivel neste navegador.')
    return {
      supported: false,
      reason: 'service-worker-unavailable',
      permission: getNotificationPermission(),
      ...platformState,
    }
  }

  if (typeof window === 'undefined' || !('PushManager' in window)) {
    console.info('[FCM] Push API indisponivel neste navegador.')
    return {
      supported: false,
      reason: 'push-api-unavailable',
      permission: getNotificationPermission(),
      ...platformState,
    }
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.info('[FCM] Web Crypto indisponivel; token FCM nao pode ser gerado.')
    return {
      supported: false,
      reason: 'crypto-unavailable',
      permission: getNotificationPermission(),
      ...platformState,
    }
  }

  const messaging = await getSupportedMessaging()
  if (!messaging) {
    return {
      supported: false,
      reason: 'messaging-unavailable',
      permission: getNotificationPermission(),
      ...platformState,
    }
  }

  return {
    supported: true,
    reason: 'supported',
    permission: getNotificationPermission(),
    ...platformState,
  }
}

export async function requestFcmPermissionAndToken({ skipPermissionPrompt = false } = {}) {
  const support = await isFcmSupported()
  if (!support.supported) return support

  const vapidKey = import.meta.env.VITE_FIREBASE_MESSAGING_VAPID_KEY
  if (!vapidKey) {
    warnMissingVapidKeyOnce()

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
    if (skipPermissionPrompt) {
      return {
        supported: true,
        permission,
        token: '',
        tokenHash: '',
        reason: 'permission-not-granted',
      }
    }
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    console.info('[FCM] Permissao de notificacao nao concedida.', { permission })
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

  if (token) {
    console.info('[FCM] Token FCM obtido para este dispositivo.', {
      tokenHash,
      platform: getPlatform(),
    })
  }

  return {
    supported: true,
    permission,
    token,
    tokenHash,
    reason: token ? 'token-created' : 'token-empty',
  }
}

async function ensureForegroundFcmListener() {
  if (foregroundFcmUnsubscribe) {
    return { registered: true, alreadyRegistered: true }
  }

  const support = await isFcmSupported()
  if (!support.supported || support.permission !== 'granted') {
    return { registered: false, reason: support.reason || support.permission }
  }

  const messaging = await getSupportedMessaging()
  if (!messaging) {
    return { registered: false, reason: 'messaging-unavailable' }
  }

  foregroundFcmUnsubscribe = onMessage(messaging, (payload) => {
    const data = payload?.data || {}
    const type = data.type || 'new_order'

    if (!['new_order', 'order_status_update', 'merchant_test'].includes(type)) return

    try {
      const result = showForegroundFcmBrowserNotification(payload, {
        ignoreFocus: type === 'merchant_test',
        ignorePreferences: type === 'merchant_test',
        ignoreDedupe: type === 'merchant_test',
      })

      console.info('[FCM] Mensagem foreground recebida:', {
        type,
        shown: result?.shown,
        reason: result?.reason,
        data,
      })
    } catch (error) {
      console.warn('[FCM] Não foi possível mostrar push em primeiro plano.', error)
    }
  })

  return { registered: true, alreadyRegistered: false }
}

export async function ensureMerchantForegroundFcmListener(options = {}) {
  foregroundFcmConfig.merchantEnabled = true

  if (options.preferences) {
    foregroundFcmConfig.merchantPreferences = options.preferences
  }

  return ensureForegroundFcmListener()
}

export async function ensureCustomerOrderForegroundFcmListener({ orderId } = {}) {
  foregroundFcmConfig.customerEnabled = true

  const normalizedOrderId = String(orderId || '').trim()
  if (normalizedOrderId) {
    foregroundFcmConfig.customerOrderIds.add(normalizedOrderId)
  }

  return ensureForegroundFcmListener()
}

export function showLocalMerchantPushTestNotification() {
  const result = showForegroundFcmBrowserNotification({
    data: {
      type: 'merchant_test',
      title: 'Teste local de push',
      body: 'Este navegador consegue exibir notificações locais do painel.',
      url: '/dashboard/orders',
    },
  }, { ignoreFocus: true, ignorePreferences: true, ignoreDedupe: true })

  return {
    ...result,
    reason: result.shown ? 'test-shown' : result.reason,
  }
}

export async function sendMerchantTestPush({ storeId } = {}) {
  const normalizedStoreId = String(storeId || '').trim()
  if (!normalizedStoreId) {
    throw new Error('storeId obrigatorio para teste de push.')
  }

  const sendMerchantTestPushCallable = httpsCallable(functions, 'sendMerchantTestPush')
  const result = await sendMerchantTestPushCallable({ storeId: normalizedStoreId })

  return result.data || { ok: true }
}

export async function requestCustomerOrderFcmPermissionAndToken({ orderId, trackingToken, skipPermissionPrompt = false }) {
  const result = await requestFcmPermissionAndToken({ skipPermissionPrompt })

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
    if (permission === 'granted' && !vapidKey) warnMissingVapidKeyOnce()

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
    if (permission === 'granted' && !vapidKey) warnMissingVapidKeyOnce()

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
