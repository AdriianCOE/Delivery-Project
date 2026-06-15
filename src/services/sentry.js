import * as Sentry from '@sentry/react'

const isProduction = import.meta.env.PROD
const dsn = import.meta.env.VITE_SENTRY_DSN

function isPublicStorefrontPath() {
  if (typeof window === 'undefined') return false

  const pathname = window.location?.pathname || '/'
  const privatePrefixes = [
    '/admin',
    '/dashboard',
    '/login',
    '/cadastro',
    '/onboarding',
    '/pedido',
    '/tracking',
  ]

  return pathname !== '/' && !privatePrefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ))
}

export function initSentry() {
  if (!dsn) return

  const isPublicStorefront = isPublicStorefrontPath()
  const integrations = [
    Sentry.browserTracingIntegration(),
  ]

  if (!isPublicStorefront) {
    integrations.push(
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      })
    )
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `pratoby@${import.meta.env.VITE_APP_VERSION || 'dev'}`,

    integrations,

    tracesSampleRate: isProduction ? (isPublicStorefront ? 0.01 : 0.05) : 1.0,

    replaysSessionSampleRate: isProduction && !isPublicStorefront ? 0.01 : 0,
    replaysOnErrorSampleRate: isProduction && !isPublicStorefront ? 0.05 : 0,

    ignoreErrors: [
      'No Listener: tabs:outgoing.message.ready',
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
      'No Listener: tabs:outgoing.message.ready',
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',

      // Android/WebView/keyboard/third-party noise
      'Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone',

      // Google reCAPTCHA/third-party cleanup noise after iframe/container removal.
      // Só mantenha se o stack não apontar para código nosso.
      "Cannot read properties of null (reading 'removeChild')",
    ],


    beforeSend(event) {
      if (event?.request?.cookies) {
        delete event.request.cookies
      }

      const message = String(
        event?.exception?.values?.[0]?.value ||
        event?.message ||
        ''
      )

      const stackFrames = event?.exception?.values?.[0]?.stacktrace?.frames || []
      const stackText = stackFrames
        .map((frame) => `${frame.filename || ''} ${frame.function || ''}`)
        .join('\n')
        .toLowerCase()

      if (message.includes('enableDidUserTypeOnKeyboardLogging')) {
        return null
      }

      if (
        message.includes("Cannot read properties of null (reading 'removeChild')") &&
        (
          stackText.includes('recaptcha') ||
          stackText.includes('google.com') ||
          stackText.includes('gstatic') ||
          stackText.includes('chrome-extension') ||
          stackText.includes('moz-extension')
        )
      ) {
        return null
      }

      return event
    },
  })
}

export function setSentryUser(user) {
  if (!dsn) return

  if (!user) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: user.uid,
    email: user.email,
    role: user.role,
    storeId: user.storeId || user.storeSlug,
  })
}

export function captureAppError(error, context = {}) {
  if (!dsn) return

  Sentry.captureException(error, {
    extra: context,
  })
}

export { Sentry }
