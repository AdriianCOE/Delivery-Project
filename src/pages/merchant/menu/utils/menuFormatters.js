// src/pages/merchant/menu/utils/menuFormatters.js
// Formatadores de moeda e utilitários de string para o MenuManagement.
// Sem dependências de React ou Firebase — puramente funções puras.

export function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) return Number(centsValue || 0) / 100
  const n = Number(value || 0)
  return n > 999 ? n / 100 : n
}

export function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

export function createLocalId(prefix = 'item') {
  try { return crypto.randomUUID() } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}
