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
  const packageName = getPackageName(id)
  if (!packageName) return undefined

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
    return 'vendor-react'
  }
  if (packageName === 'react-router' || packageName === 'react-router-dom') return 'vendor-router'
  if (packageName === 'firebase') {
    if (normalized.includes('/firebase/app-check')) return 'vendor-firebase-app-check'
    if (normalized.includes('/firebase/auth')) return 'vendor-firebase-auth'
    if (normalized.includes('/firebase/database')) return 'vendor-firebase-database'
    if (normalized.includes('/firebase/firestore')) return 'vendor-firebase-firestore'
    if (normalized.includes('/firebase/functions')) return 'vendor-firebase-functions'
    if (normalized.includes('/firebase/messaging')) return 'vendor-firebase-messaging'
    if (normalized.includes('/firebase/storage')) return 'vendor-firebase-storage'
    return 'vendor-firebase-app'
  }
  if (packageName === '@firebase/app') return 'vendor-firebase-app'
  if (packageName === '@firebase/firestore') return 'vendor-firebase-firestore'
  if (packageName === '@firebase/auth') return 'vendor-firebase-auth'
  if (packageName === '@firebase/messaging') return 'vendor-firebase-messaging'
  if (packageName === '@firebase/functions') return 'vendor-firebase-functions'
  if (packageName === '@firebase/database') return 'vendor-firebase-database'
  if (packageName === '@firebase/storage') return 'vendor-firebase-storage'
  if (packageName.startsWith('@firebase/')) return 'vendor-firebase'
  if (packageName.startsWith('@sentry/')) return 'vendor-sentry'
  if (packageName === 'react-icons') return 'vendor-icons'
  if (packageName === 'lucide-react') return 'vendor-lucide'
  if (packageName === 'framer-motion' || packageName === 'motion') return 'vendor-motion'
  if (packageName === '@dnd-kit/core' || packageName === '@dnd-kit/sortable') return 'vendor-dnd'
  if (packageName === 'qrcode.react') return 'vendor-qrcode'
  if (packageName === 'react-helmet-async') return 'vendor-seo'

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
