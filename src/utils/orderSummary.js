import { getItemDisplayOptionGroups } from './orderItems'
import { getOrderDisplayNumber } from './orderNumber'
import { normalizeBrazilianPhoneForWhatsApp } from './phone'

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || ''
}

function formatMoneyFromOrderValue(value, centsValue) {
  const cents = Number(centsValue)
  if (Number.isFinite(cents) && cents > 0) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return ''

  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getOrderSavedTotalLabel(order) {
  return formatMoneyFromOrderValue(
    firstValue(order?.total, order?.totalAmount, order?.amount),
    firstValue(order?.totalCents, order?.totalAmountCents, order?.amountCents)
  )
}

function getItemName(item) {
  return firstValue(item?.name, item?.productName, item?.title, item?.label, 'Item')
}

function getItemQuantity(item) {
  const quantity = Number(firstValue(item?.quantity, item?.qty, item?.amount, 1))
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function getItemTotalLabel(item) {
  return formatMoneyFromOrderValue(
    firstValue(item?.total, item?.subtotal, item?.price),
    firstValue(item?.totalCents, item?.subtotalCents, item?.priceCents)
  )
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function getItemOptionsLines(item) {
  return getItemDisplayOptionGroups(item).flatMap((group) => {
    const options = group.options.map((option) => {
      const quantity = Number(option.quantity || 1)
      const prefix = quantity > 1 ? `${quantity}x ` : ''
      return `${prefix}${option.name}`
    })

    return options.length ? [`  ${group.name}: ${options.join(', ')}`] : []
  })
}

export function getOrderCustomerName(order) {
  return firstValue(order?.customerName, order?.customer?.name, order?.clientName, 'Cliente')
}

export function getOrderCustomerPhone(order) {
  return firstValue(order?.customerPhone, order?.customer?.phone, order?.phone)
}

export function getOrderWhatsAppPhone(order) {
  return normalizeBrazilianPhoneForWhatsApp(getOrderCustomerPhone(order))
}

export function hasValidOrderWhatsAppPhone(order) {
  return Boolean(getOrderWhatsAppPhone(order))
}

export function buildOrderWhatsAppMessage(order, options = {}) {
  const customerName = getOrderCustomerName(order)
  const storeName = firstValue(options.storeName, options.store?.name, order?.storeName, 'sua loja')
  const total = firstValue(options.totalLabel, getOrderSavedTotalLabel(order), 'total não informado')

  return `Olá, ${customerName}! Recebemos seu pedido ${getOrderDisplayNumber(order)} na ${storeName} pelo PratoBy. Já vamos preparar e te avisamos por aqui. Total: ${total}.`
}

export function buildOrderWhatsAppUrl(order, options = {}) {
  const phone = getOrderWhatsAppPhone(order)
  if (!phone) return ''

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildOrderWhatsAppMessage(order, options))}`
}

export function buildOrderClipboardSummary(order, options = {}) {
  const items = getOrderItems(order)
  const itemLines = items.flatMap((item) => {
    const total = getItemTotalLabel(item)
    const header = `* ${getItemQuantity(item)}x ${getItemName(item)}${total ? ` — ${total}` : ''}`
    return [header, ...getItemOptionsLines(item)]
  })

  return [
    `Pedido ${getOrderDisplayNumber(order)}`,
    `Cliente: ${getOrderCustomerName(order)}`,
    `Telefone: ${getOrderCustomerPhone(order) || 'Não informado'}`,
    `Tipo: ${firstValue(options.deliveryTypeLabel, order?.deliveryTypeLabel, order?.orderType, order?.type, 'Não informado')}`,
    `Endereço: ${firstValue(options.addressLabel, order?.address?.full, order?.deliveryAddress, 'Não informado')}`,
    '',
    'Itens:',
    ...(itemLines.length ? itemLines : ['* Itens não disponíveis']),
    '',
    `Total: ${firstValue(options.totalLabel, getOrderSavedTotalLabel(order), 'Não informado')}`,
    `Pagamento: ${firstValue(options.paymentLabel, order?.paymentLabel, order?.paymentMethod, order?.payment?.method, 'Não informado')}`,
    `Observações: ${firstValue(options.notes, order?.notes, order?.observation, order?.customerNote, 'Nenhuma')}`,
  ].join('\n')
}
