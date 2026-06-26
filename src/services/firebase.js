import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging'

import app, { firebaseConfig } from './firebaseApp'

let appCheckInstancePromise = null
let appCheckConfigWarningShown = false

function warnAppCheckConfig(message) {
  if (appCheckConfigWarningShown) return
  appCheckConfigWarningShown = true

  if (import.meta.env.PROD) {
    console.warn(message)
  } else if (import.meta.env.DEV) {
    console.info(message)
  }
}

export async function ensureAppCheck() {
  if (appCheckInstancePromise) return appCheckInstancePromise

  const enabled = String(import.meta.env.VITE_FIREBASE_APPCHECK_ENABLED || '').toLowerCase() === 'true'
  const providerType = String(import.meta.env.VITE_FIREBASE_APPCHECK_PROVIDER || 'enterprise').toLowerCase()
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
  const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN

  if (!enabled || !siteKey || typeof window === 'undefined') {
    if (!enabled) {
      warnAppCheckConfig('[AppCheck] VITE_FIREBASE_APPCHECK_ENABLED diferente de true; App Check frontend desativado.')
    } else if (!siteKey) {
      warnAppCheckConfig('[AppCheck] VITE_FIREBASE_APPCHECK_SITE_KEY ausente; App Check frontend desativado.')
    }
    return null
  }

  appCheckInstancePromise = (async () => {
    const {
      initializeAppCheck,
      ReCaptchaEnterpriseProvider,
      ReCaptchaV3Provider,
    } = await import('firebase/app-check')

    try {
      if (!import.meta.env.PROD && debugToken) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken
      } else if (typeof window !== 'undefined' && 'FIREBASE_APPCHECK_DEBUG_TOKEN' in window) {
        try {
          delete window.FIREBASE_APPCHECK_DEBUG_TOKEN
        } catch {
          window.FIREBASE_APPCHECK_DEBUG_TOKEN = undefined
        }
      }

      const provider = providerType === 'v3'
        ? new ReCaptchaV3Provider(siteKey)
        : new ReCaptchaEnterpriseProvider(siteKey)

      return initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true,
      })
    } catch (error) {
      appCheckInstancePromise = null
      console.warn('[AppCheck] Nao foi possivel inicializar App Check.', error)
      return null
    }
  })()

  return appCheckInstancePromise
}

export const appCheck = null

let messaging = null
let realtimeDatabase = null

export async function getSupportedMessaging() {
  if (typeof window === 'undefined') return null

  try {
    const supported = await isMessagingSupported()
    if (!supported) return null

    if (!messaging) {
      messaging = getMessaging(app)
    }

    return messaging
  } catch (error) {
    console.warn('[FCM] Firebase Messaging indisponivel neste navegador.', error)
    return null
  }
}

export async function getRealtimeDatabase() {
  if (realtimeDatabase) return realtimeDatabase

  const { getDatabase } = await import('firebase/database')
  realtimeDatabase = getDatabase(app)

  return realtimeDatabase
}

export { messaging, firebaseConfig }

export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, 'southamerica-east1')

export default app
