const { defineSecret } = require('firebase-functions/params')

const BREVO_API_KEY = defineSecret('BREVO_API_KEY')

const BREVO_TEMPLATES = {
  welcome: {
    id: 2,
    tag: 'welcome_pratoby',
  },
  trialStarted: {
    id: 1,
    tag: 'trial_started',
  },
}

function getSecretValue(secret, envName) {
  try {
    return secret.value() || process.env[envName] || ''
  } catch (_error) {
    return process.env[envName] || ''
  }
}

async function sendBrevoTransactionalEmail({
  to,
  name,
  templateId,
  params,
  tags = [],
  idempotencyKey,
}) {
  const apiKey = getSecretValue(BREVO_API_KEY, 'BREVO_API_KEY')

  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada.')
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      templateId: Number(templateId),
      to: [
        {
          email: to,
          name: name || undefined,
        },
      ],
      params,
      tags,
    }),
  })

  const text = await response.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch (_error) {
    body = { raw: text }
  }

  if (!response.ok) {
    const message = body?.message || body?.error || `Brevo retornou HTTP ${response.status}.`
    const error = new Error(message)
    error.status = response.status
    error.body = body
    throw error
  }

  return body
}

function firstNameFrom(value) {
  const name = String(value || '').trim()
  return name.split(/\s+/)[0] || 'Lojista'
}

function formatDatePtBr(value) {
  if (!value) return 'em 14 dias'

  const date =
    typeof value.toDate === 'function'
      ? value.toDate()
      : typeof value.toMillis === 'function'
        ? new Date(value.toMillis())
        : new Date(value)

  if (Number.isNaN(date.getTime())) return 'em 14 dias'

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

module.exports = {
  BREVO_API_KEY,
  BREVO_TEMPLATES,
  sendBrevoTransactionalEmail,
  firstNameFrom,
  formatDatePtBr,
}