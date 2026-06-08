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

function normalizeOrderStatus(order) {
  return String(order?.status || order?.currentStatus || '')
    .trim()
    .toLowerCase()
}

function isFinalOrderStatus(status) {
  return ['entregue', 'finalizado', 'concluido', 'concluído'].includes(status)
}

function isCanceledOrderStatus(status) {
  return ['cancelado', 'canceled'].includes(status)
}

function isScheduledWhatsAppOrder(order) {
  return order?.orderTiming === 'scheduled' ||
    Boolean(
      order?.scheduledFor ||
      order?.scheduledDate ||
      order?.scheduledDateKey ||
      order?.scheduledTime ||
      order?.scheduledTimeLabel
    )
}

function getScheduledWhatsAppLabel(order) {
  const explicitLabel = firstValue(
    order?.scheduledLabel,
    order?.scheduledDateLabel,
    order?.scheduledDisplayLabel,
    order?.schedulingSnapshot?.scheduledLabel
  )

  if (explicitLabel) return explicitLabel

  const dateLabel = firstValue(
    order?.scheduledDateFormatted,
    order?.scheduledDateKey,
    order?.scheduledDate
  )

  const timeLabel = firstValue(
    order?.scheduledTimeLabel,
    order?.scheduledTime
  )

  if (dateLabel && timeLabel) return `${dateLabel} às ${timeLabel}`
  if (dateLabel) return dateLabel
  if (timeLabel) return timeLabel

  const scheduledFor = order?.scheduledFor

  try {
    const date =
      typeof scheduledFor?.toDate === 'function'
        ? scheduledFor.toDate()
        : scheduledFor
          ? new Date(scheduledFor)
          : null

    if (date && !Number.isNaN(date.getTime())) {
      const day = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(date)

      const hour = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(date)

      return `${day} às ${hour}`
    }
  } catch {
    // fallback abaixo
  }

  return ''
}

function isPickupOrder(order) {
  const type = String(firstValue(
    order?.fulfillmentType,
    order?.deliveryType,
    order?.orderType,
    order?.type
  )).toLowerCase()

  return Boolean(
    order?.isPickup ||
    order?.pickup ||
    type.includes('retirada') ||
    type.includes('pickup') ||
    type.includes('takeout') ||
    type.includes('balcao') ||
    type.includes('balcão')
  )
}

function getPaymentStatusText(order) {
  const paymentStatus = String(firstValue(
    order?.paymentStatus,
    order?.payment?.status
  )).toLowerCase()

  const paid = Boolean(
    order?.isPaid ||
    order?.paid ||
    paymentStatus === 'paid' ||
    paymentStatus === 'pago'
  )

  // Retorna sem o espaço inicial para controle preciso na montagem da string externa
  if (paid) return 'Pagamento confirmado.'
  return ''
}

export function buildOrderWhatsAppMessage(order, options = {}) {
  const customerName = getOrderCustomerName(order)
  const storeName = firstValue(options.storeName, options.store?.name, order?.storeName, 'sua loja')
  const total = firstValue(options.totalLabel, getOrderSavedTotalLabel(order), 'total não informado')
  const orderNumber = getOrderDisplayNumber(order)
  const status = normalizeOrderStatus(order)
  const scheduled = isScheduledWhatsAppOrder(order)
  const scheduledLabel = getScheduledWhatsAppLabel(order)
  const pickup = isPickupOrder(order)
  const paymentText = getPaymentStatusText(order)

  // 1. Guardas para Estados Terminais (Cancelado e Finalizado)
  if (isCanceledOrderStatus(status)) {
    return `Olá, *${customerName}*! ❌ Seu pedido ${orderNumber} na loja *${storeName}* foi cancelado. Se tiver qualquer dúvida, fale com a gente por aqui.`
  }

  // Correção de espaçamento dinâmico aqui
  const financeSuffix = ` Total: *${total}*.${paymentText ? ` ${paymentText}` : ''}`

  if (isFinalOrderStatus(status)) {
    return `Olá, *${customerName}*! 🎉 Seu pedido ${orderNumber} na loja *${storeName}* foi finalizado. Obrigado pela preferência!${financeSuffix}`
  }

  // 2. Normalização do status (mapeia variações para um padrão único)
  const currentStatus = String(status || '').toLowerCase().trim()
  let normalizedStatus = 'outro'

  if (['preparando', 'preparo', 'preparing'].includes(currentStatus)) normalizedStatus = 'preparando'
  else if (['pronto', 'pronta', 'ready'].includes(currentStatus)) normalizedStatus = 'pronto'
  else if (['em_rota', 'em rota', 'saiu_para_entrega', 'saiu_entrega'].includes(currentStatus)) normalizedStatus = 'em_rota'
  else if (['confirmado', 'confirmed', 'accepted'].includes(currentStatus)) normalizedStatus = 'confirmado'
  else if (['pendente', 'pending', 'novo'].includes(currentStatus)) normalizedStatus = 'pendente'

  let coreMessage = ''

  // 3. Dicionário de mensagens centrais (Agendado vs Imediato)
  if (scheduled) {
    const timeLabel = scheduledLabel ? ` para *${scheduledLabel}*` : ''
    const timeCtx = scheduledLabel ? ` (*${scheduledLabel}*)` : ''

    const scheduledMap = {
      preparando: `👨‍🍳 Estamos preparando seu pedido agendado ${orderNumber}${timeLabel}.`,
      pronto: pickup 
        ? `🛍️ Seu pedido agendado ${orderNumber} está pronto para retirada${timeCtx}.`
        : `📦 Seu pedido agendado ${orderNumber} está pronto${timeCtx}. Em breve seguiremos com a próxima etapa.`,
      em_rota: `🛵 Seu pedido agendado ${orderNumber} saiu para entrega${timeCtx}.`, // Corrigido aqui (de '漏' para '🛵')
      confirmado: `✅ Seu pedido ${orderNumber} na loja *${storeName}* está confirmado e agendado${timeLabel}. Qualquer mudança, avisaremos por aqui.`,
      outro: `⏳ Recebemos seu pedido ${orderNumber} na loja *${storeName}*. Ele está agendado${timeLabel}.`
    }
    coreMessage = scheduledMap[normalizedStatus] || scheduledMap.outro
  } else {
    const immediateMap = {
      preparando: `👨‍🍳 Estamos preparando seu pedido ${orderNumber} na loja *${storeName}*.`,
      pronto: pickup
        ? `🛍️ Seu pedido ${orderNumber} está pronto para retirada na loja *${storeName}*.`
        : `📦 Seu pedido ${orderNumber} está pronto na loja *${storeName}*. Em breve seguiremos com a próxima etapa.`,
      em_rota: `🛵 Seu pedido ${orderNumber} saiu para entrega.`,
      confirmado: `✅ Seu pedido ${orderNumber} foi confirmado na loja *${storeName}* e já está na nossa fila.`,
      pendente: `⏳ Recebemos seu pedido ${orderNumber} na loja *${storeName}*. Ele está aguardando confirmação.`,
      outro: `👋 Recebemos seu pedido ${orderNumber} na loja *${storeName}* pelo PratoBy.`
    }
    coreMessage = immediateMap[normalizedStatus] || immediateMap.outro
  }

  // 4. Montagem Final Unificada (Padrão de layout limpo)
  return `Olá, *${customerName}*! ${coreMessage}${financeSuffix}`
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