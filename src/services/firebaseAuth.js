import { getAuth, GoogleAuthProvider } from 'firebase/auth'

import app from './firebaseApp'

export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account',
})
