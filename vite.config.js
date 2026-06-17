import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPackageName(id) {
  const normalized = id.replace(/\\/g, '/')
  const parts = normalized.split('/node_modules/')
  if (parts.length < 2) return ''

  const packagePath = parts.pop()
  const [scopeOrName, name] = packagePath.split('/')

  return scopeOrName?.startsWith('@') ? `${scopeOrName}/${name || ''}` : scopeOrName
}

function manualChunks(id) {
  const normalized = id.replace(/\\/g, '/')

  if (normalized.endsWith('/src/services/firebaseApp.js')) {
    return 'firebase-app'
  }

  const packageName = getPackageName(id)
  if (!packageName) return undefined

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
    return 'vendor-react'
  }
  if (packageName === 'react-router' || packageName === 'react-router-dom') return 'vendor-react'
  if (packageName === 'firebase') {
    if (normalized.includes('/firebase/app/dist/')) return 'vendor-firebase-core'
    if (normalized.includes('/firebase/app-check')) return 'vendor-firebase-app-check'
    if (normalized.includes('/firebase/auth')) return 'vendor-firebase-auth'
    if (normalized.includes('/firebase/database')) return 'vendor-firebase-database'
    if (normalized.includes('/firebase/firestore')) return 'vendor-firebase-firestore'
    if (normalized.includes('/firebase/functions')) return 'vendor-firebase-functions'
    if (normalized.includes('/firebase/messaging')) return 'vendor-firebase-messaging'
    if (normalized.includes('/firebase/storage')) return 'vendor-firebase-storage'
    return 'vendor-firebase-core'
  }
  if (packageName === '@firebase/app') return 'vendor-firebase-core'
  if (packageName === '@firebase/firestore') return 'vendor-firebase-firestore'
  if (packageName === '@firebase/auth') return 'vendor-firebase-auth'
  if (packageName === '@firebase/messaging') return 'vendor-firebase-messaging'
  if (packageName === '@firebase/functions') return 'vendor-firebase-functions'
  if (packageName === '@firebase/database') return 'vendor-firebase-database'
  if (packageName === '@firebase/storage') return 'vendor-firebase-storage'
  if (packageName.startsWith('@firebase/')) return 'vendor-firebase-core'
  if (packageName.startsWith('@sentry/')) return 'vendor-sentry'
  if (packageName === 'react-icons') return 'vendor-icons'
  if (packageName === 'lucide-react') return 'vendor-lucide'
  if (packageName === 'framer-motion' || packageName === 'motion') return 'vendor-motion'
  if (packageName.startsWith('@dnd-kit/')) return 'vendor-dnd'
  if (packageName === 'qrcode.react') return 'vendor-qrcode'
  if (packageName === 'react-helmet-async' || packageName === 'helmet-async') return 'vendor-seo'
  // Firebase transitive deps
  if (packageName === 'idb') return 'vendor-firebase-core'
  if (packageName === 'tslib') return 'vendor-firebase-core'
  if (packageName === 'undici-types') return 'vendor-misc'
  // React Router transitive deps
  if (packageName === 'history' || packageName.startsWith('@remix-run/')) return 'vendor-react'

  return 'vendor-misc'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssMinify: true,
    cssCodeSplit: true,
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
