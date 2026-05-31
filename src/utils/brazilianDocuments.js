export function cleanBrazilianDocument(value) {
  return String(value || '').replace(/\D/g, '')
}

function hasRepeatedDigits(digits) {
  return /^(\d)\1+$/.test(digits)
}

export function isValidCpf(value) {
  const digits = cleanBrazilianDocument(value)
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false

  const numbers = digits.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += numbers[i] * (10 - i)
  const firstCheck = (sum * 10) % 11
  if ((firstCheck === 10 ? 0 : firstCheck) !== numbers[9]) return false

  sum = 0
  for (let i = 0; i < 10; i += 1) sum += numbers[i] * (11 - i)
  const secondCheck = (sum * 10) % 11
  return (secondCheck === 10 ? 0 : secondCheck) === numbers[10]
}

export function isValidCnpj(value) {
  const digits = cleanBrazilianDocument(value)
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false

  const numbers = digits.split('').map(Number)
  const calcCheckDigit = (length) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + numbers[index] * weight, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return calcCheckDigit(12) === numbers[12] && calcCheckDigit(13) === numbers[13]
}

export function formatCpf(value) {
  const digits = cleanBrazilianDocument(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatCnpj(value) {
  const digits = cleanBrazilianDocument(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function getBrazilianDocumentType(value) {
  const digits = cleanBrazilianDocument(value)
  if (digits.length <= 11) return isValidCpf(digits) ? 'cpf' : null
  if (digits.length === 14) return isValidCnpj(digits) ? 'cnpj' : null
  return null
}

export function formatBrazilianDocument(value) {
  const digits = cleanBrazilianDocument(value)
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits)
}
