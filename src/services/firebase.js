import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'


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
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY

  if (!siteKey || typeof window === 'undefined') {
    if (import.meta.env.DEV && !siteKey) {
      console.info('[AppCheck] VITE_FIREBASE_APPCHECK_SITE_KEY ausente; App Check frontend desativado.')
    }
    return null
  }

  try {
    return initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (error) {
    console.warn('[AppCheck] Nao foi possivel inicializar App Check.', error)
    return null
  }
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const rtdb = getDatabase(app)
export const functions = getFunctions(app, 'southamerica-east1')
export const appCheck = initializeOptionalAppCheck(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account',
})


export default app
