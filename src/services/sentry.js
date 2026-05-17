import * as Sentry from '@sentry/react'

const isProduction = import.meta.env.PROD
const dsn = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `pratoby@${import.meta.env.VITE_APP_VERSION || 'dev'}`,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    tracesSampleRate: isProduction ? 0.15 : 1.0,

    replaysSessionSampleRate: isProduction ? 0.03 : 0,
    replaysOnErrorSampleRate: 1.0,

    ignoreErrors: [
      'No Listener: tabs:outgoing.message.ready',
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded',
    ],

    beforeSend(event) {
      if (event?.request?.cookies) {
        delete event.request.cookies
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