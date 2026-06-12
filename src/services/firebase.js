import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)

function initializeOptionalAppCheck(firebaseApp) {
  const enabled = String(import.meta.env.VITE_FIREBASE_APPCHECK_ENABLED || '').toLowerCase() === 'true'
  const providerType = String(import.meta.env.VITE_FIREBASE_APPCHECK_PROVIDER || 'enterprise').toLowerCase()
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
  const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN

  if (!enabled || !siteKey || typeof window === 'undefined') {
    if (import.meta.env.DEV && !enabled) {
      console.info('[AppCheck] VITE_FIREBASE_APPCHECK_ENABLED diferente de true; App Check frontend desativado.')
    } else if (import.meta.env.DEV && !siteKey) {
      console.info('[AppCheck] VITE_FIREBASE_APPCHECK_SITE_KEY ausente; App Check frontend desativado.')
    }
    return null
  }

  try {
    if (debugToken) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken
    }

    const provider = providerType === 'v3'
      ? new ReCaptchaV3Provider(siteKey)
      : new ReCaptchaEnterpriseProvider(siteKey)

    return initializeAppCheck(firebaseApp, {
      provider,
      isTokenAutoRefreshEnabled: true,
    })
  } catch (error) {
    console.warn('[AppCheck] Não foi possível inicializar App Check.', error)
    return null
  }
}

export const appCheck = initializeOptionalAppCheck(app)

let messaging = null

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

export { messaging, firebaseConfig }

export const db = getFirestore(app)
export const storage = getStorage(app)
export const rtdb = getDatabase(app)
export const functions = getFunctions(app, 'southamerica-east1')

export default app
