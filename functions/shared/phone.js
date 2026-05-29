function normalizeBrazilianPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits
    }
  }
  if (digits.length !== 12 && digits.length !== 13) {
    return null
  }
  return { phoneDigits: digits, phoneE164: '+' + digits }
}

function validateBrazilianMobilePhone(phone) {
  const rawDigits = String(phone || '').replace(/\D/g, '')
  let nationalDigits

  if (rawDigits.length === 13 && rawDigits.startsWith('55')) {
    nationalDigits = rawDigits.slice(2)
  } else if (rawDigits.length === 11) {
    nationalDigits = rawDigits
  } else {
    return { ok: false }
  }

  const ddd = nationalDigits.slice(0, 2)
  const localNumber = nationalDigits.slice(2)
  const localTail = localNumber.slice(1)

  if (ddd.startsWith('0') || localNumber.length !== 9 || localNumber[0] !== '9') {
    return { ok: false }
  }

  const repeatedRun = /(\d)\1{4,}/
  const obviousLocalNumbers = new Set([
    '999999999',
    '999111111',
    '900000000',
    '911111111',
  ])

  if (
    /^(\d)\1+$/.test(nationalDigits) ||
    /(\d)\1{3}$/.test(localNumber) ||
    repeatedRun.test(localNumber) ||
    obviousLocalNumbers.has(localNumber) ||
    ['12345678', '87654321', '11111111', '00000000'].some((pattern) => localTail.includes(pattern))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    phoneDigits: `55${nationalDigits}`,
    phoneE164: `+55${nationalDigits}`,
  }
}

module.exports = {
  normalizeBrazilianPhone,
  validateBrazilianMobilePhone,
}
