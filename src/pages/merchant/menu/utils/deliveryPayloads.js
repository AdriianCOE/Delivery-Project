// src/pages/merchant/menu/utils/deliveryPayloads.js
// Utilitários de sanitização, formatação e presets para a gestão de taxas de entrega.

export const BAIRROS_ARACAJU = [
  '13 de Julho',
  '17 de Março',
  'Aeroporto',
  'América',
  'Atalaia',
  'Bugio',
  'Capucho',
  'Centro',
  'Cidade Nova',
  'Cirurgia',
  'Coroa do Meio',
  'Dezoito do Forte',
  'Dom Luciano',
  'Farolândia',
  'Getúlio Vargas',
  'Grageru',
  'Inácio Barbosa',
  'Industrial',
  'Jabotiana',
  'Japãozinho',
  'Jardim Centenário',
  'Jardins',
  'José Conrado de Araújo',
  'Lamarão',
  'Luzia',
  'Marivan',
  'Novo Paraíso',
  'Olaria',
  'Palestina',
  'Pereira Lobo',
  'Ponto Novo',
  'Porto Dantas',
  'Salgado Filho',
  'Santa Maria',
  'Santo Antônio',
  'Santos Dumont',
  'São Conrado',
  'São José',
  'Siqueira Campos',
  'Soledade',
  'Suíssa',
  'Zona de Expansão',
]

/**
 * Normaliza uma string de bairro para comparação sem acentos, sem espaços extras e em caixa baixa.
 */
export function normalizeNeighborhoodName(str) {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
}

/**
 * Converte valor em formato BRL (string) para número decimal flutuante.
 */
export function parseBrlToNumber(value) {
  if (value === null || value === undefined || value === '') return null
  let cleaned = String(value).replace(/[^\d.,]/g, '')
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Converte valor numérico para string no formato "R$ X,XX".
 */
export function formatMoneyBrl(value) {
  if (value === null || value === undefined || value === '') return 'R$ 0,00'
  const num = Number(value)
  if (num === 0) return 'Grátis'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Converte valor numérico para preenchimento de inputs monetários ("X,XX").
 */
export function moneyToInputBrl(value) {
  if (value === null || value === undefined || value === '') return ''
  return Number(value).toFixed(2).replace('.', ',')
}
