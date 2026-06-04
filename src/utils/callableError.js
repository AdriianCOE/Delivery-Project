export function getCallableErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || '').trim()

  if (!message || /functions\/(internal|unknown)/i.test(message)) {
    return fallbackMessage
  }

  return message
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^Firebase:\s*/i, '')
    .trim() || fallbackMessage
}

