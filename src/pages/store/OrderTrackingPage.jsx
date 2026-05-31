import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Link, useParams } from 'react-router-dom'
import { formatBrazilianPhone, normalizeBrazilianPhoneForWhatsApp } from '../../utils/phone'
import {
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDownload,
  FiHeart,
  FiHome,
  FiLoader,
  FiMapPin,
  FiMessageCircle,
  FiPackage,
  FiShoppingBag,
  FiStar,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi'

import { db, functions } from '../../services/firebase'
import StoreFooter from '../../components/layouts/StoreFooter'

const DELIVERY_STATUS_STEPS = [
  {
    id: 'pendente',
    label: 'Recebido',
    description: 'A loja recebeu seu pedido.',
    icon: FiClock,
  },
  {
    id: 'preparando',
    label: 'Preparando',
    description: 'Seu pedido está sendo preparado.',
    icon: FiPackage,
  },
  {
    id: 'em_rota',
    label: 'Em rota',
    description: 'Seu pedido saiu para entrega.',
    icon: FiTruck,
  },
  {
    id: 'entregue',
    label: 'Entregue',
    description: 'Pedido finalizado.',
    icon: FiCheckCircle,
  },
]

const PICKUP_STATUS_STEPS = [
  {
    id: 'pendente',
    label: 'Recebido',
    description: 'A loja recebeu seu pedido.',
    icon: FiClock,
  },
  {
    id: 'preparando',
    label: 'Preparando',
    description: 'Seu pedido está sendo preparado.',
    icon: FiPackage,
  },
  {
    id: 'pronto',
    label: 'Pronto',
    description: 'Seu pedido está pronto para retirada.',
    icon: FiCheck,
  },
  {
    id: 'entregue',
    label: 'Finalizado',
    description: 'Pedido finalizado.',
    icon: FiCheckCircle,
  },
]

const REVIEW_TAGS = [
  { id: 'comida_boa', label: 'Comida boa' },
  { id: 'entrega_rapida', label: 'Entrega rápida' },
  { id: 'bem_embalado', label: 'Bem embalado' },
  { id: 'veio_quente', label: 'Veio quentinho' },
  { id: 'demorou', label: 'Demorou' },
  { id: 'pedido_errado', label: 'Pedido errado' },
  { id: 'atendimento_ruim', label: 'Atendimento ruim' },
]

const INITIAL_REVIEW = {
  rating: 5,
  foodRating: 5,
  deliveryRating: 5,
  serviceRating: 5,
  wouldOrderAgain: true,
  tags: [],
  comment: '',
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeStatus(status) {
  const currentStatus = String(status || 'pendente').toLowerCase().trim()

  const statusMap = {
    novo: 'pendente',
    new: 'pendente',
    recebido: 'pendente',
    recebidos: 'pendente',
    aguardando: 'pendente',
    aguardando_confirmacao: 'pendente',
    awaiting_confirmation: 'pendente',
    pending: 'pendente',
    pendente: 'pendente',

    accepted: 'preparando',
    aceito: 'preparando',
    confirmado: 'preparando',
    em_preparo: 'preparando',
    in_preparation: 'preparando',
    preparing: 'preparando',
    preparo: 'preparando',
    preparando: 'preparando',

    pronto: 'pronto',
    pronta: 'pronto',
    ready: 'pronto',
    ready_for_pickup: 'pronto',
    aguardando_retirada: 'pronto',

    entregando: 'em_rota',
    saiu_para_entrega: 'em_rota',
    saiu_entrega: 'em_rota',
    em_entrega: 'em_rota',
    out_for_delivery: 'em_rota',
    on_the_way: 'em_rota',
    in_route: 'em_rota',
    em_rota: 'em_rota',

    concluido: 'entregue',
    concluído: 'entregue',
    finalizado: 'entregue',
    entregue: 'entregue',
    delivered: 'entregue',
    finished: 'entregue',

    cancelado: 'cancelado',
    canceled: 'cancelado',
    cancelled: 'cancelado',
  }

  return statusMap[currentStatus] || currentStatus || 'pendente'
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  // Compatibilidade com registros antigos em centavos.
  // Evita quebrar pedidos reais acima de R$ 300,00.
  if (numericValue > 999) return numericValue / 100

  return numericValue
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function toDate(value) {
  if (!value) return null
  if (value?.toDate) return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(value) {
  const date = toDate(value)

  if (!date) return '—'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(value) {
  const date = toDate(value)

  if (!date) return ''

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeBrazilianWhatsApp(value) {
  let digits = onlyDigits(value)

  if (!digits) return ''

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (!digits.startsWith('55')) {
    digits = `55${digits}`
  }

  return digits
}

function buildWhatsAppUrl(phone, message) {
  const finalPhone = normalizeBrazilianPhoneForWhatsApp(phone)

  if (!finalPhone) return ''

  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message || '')}`
}


function getPaymentMethodId(order) {
  return String(
    order?.payment?.method ||
      order?.paymentType ||
      order?.paymentMethod ||
      ''
  )
    .toLowerCase()
    .trim()
}

function getPaymentStatusId(order) {
  return String(order?.payment?.status || order?.paymentStatus || '')
    .toLowerCase()
    .trim()
}

function isPixManualOrder(order) {
  const method = getPaymentMethodId(order)

  return [
    'pix',
    'pix_manual',
    'manual_pix',
    'pix_static',
    'pix_manual_store',
  ].includes(method)
}

function isPaymentPaid(order) {
  const paymentStatus = getPaymentStatusId(order)

  return (
    paymentStatus === 'paid' ||
    paymentStatus === 'pago' ||
    Boolean(order?.payment?.paidAt || order?.paidAt || order?.payment?.confirmedAt)
  )
}

function isPixPaymentPending(order) {
  if (!isPixManualOrder(order) || isPaymentPaid(order)) return false

  const paymentStatus = getPaymentStatusId(order)

  return ['', 'pending', 'awaiting_payment', 'manual_confirmation', 'proof_sent'].includes(paymentStatus)
}

function getPixCopyPaste(order) {
  return (
    order?.payment?.pixCopyPaste ||
    order?.payment?.copyPaste ||
    order?.payment?.brCode ||
    order?.payment?.pixCode ||
    order?.pixCopyPaste ||
    order?.pixCode ||
    ''
  )
}

function getPixKeyLabel(order) {
  return (
    order?.payment?.pixKey ||
    order?.payment?.pixKeyNormalized ||
    order?.pixKey ||
    ''
  )
}

function getPixMerchantName(order, store) {
  return (
    order?.payment?.pixMerchantName ||
    store?.pix?.merchantName ||
    store?.pix?.receiverName ||
    getStoreName(order, store)
  )
}

function getStoreLogoUrl(order, store) {
  return (
    order?.storeLogoURL ||
    order?.storeLogoUrl ||
    order?.store?.logoURL ||
    order?.store?.logoUrl ||
    store?.logoURL ||
    store?.logoUrl ||
    store?.logo ||
    store?.logoImage ||
    store?.imageUrl ||
    store?.avatarURL ||
    store?.avatarUrl ||
    store?.branding?.logoURL ||
    store?.branding?.logoUrl ||
    store?.settings?.logoURL ||
    store?.settings?.logoUrl ||
    ''
  )
}

function StoreLogo({
  order,
  store,
  className = 'h-11 w-11',
  rounded = 'rounded-2xl',
  fallbackClassName = '',
}) {
  const [imageError, setImageError] = useState(false)

  const logoUrl = getStoreLogoUrl(order, store)
  const storeName = getStoreName(order, store)

  const initials = storeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()

  if (logoUrl && !imageError) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${storeName}`}
        className={`${className} ${rounded} shrink-0 object-cover ring-1 ring-gray-100`}
        loading="lazy"
        onError={() => setImageError(true)}
      />
    )
  }

  return (
    <div
      className={`${className} ${rounded} ${fallbackClassName} flex shrink-0 items-center justify-center bg-orange-50 text-sm font-black text-[#f97316] ring-1 ring-orange-100`}
      title={storeName}
    >
      {initials || <FiHome size={18} />}
    </div>
  )
}

function getPixMerchantCity(order, store) {
  return (
    order?.payment?.pixMerchantCity ||
    store?.pix?.merchantCity ||
    store?.pix?.receiverCity ||
    store?.city ||
    store?.address?.city ||
    ''
  )
}

function getPaymentProofUrl(order) {
  return (
    order?.payment?.proofUrl ||
    order?.payment?.receiptUrl ||
    order?.paymentProofUrl ||
    order?.proofUrl ||
    order?.receiptUrl ||
    ''
  )
}

function getPixProofContactMessage(order, store) {
  const displayNumber = getOrderDisplayNumber(order)
  const storeName = getStoreName(order, store)
  const total = formatMoney(getOrderTotal(order))

  return [
    `Olá, ${storeName}.`,
    `Segue o comprovante do Pix do pedido ${displayNumber}.`,
    `Valor: ${total}.`,
    'Vou anexar a imagem do comprovante aqui na conversa.',
  ].join(' ')
}


function getStatusSteps(order) {
  const orderType = getOrderType(order)

  return orderType === 'delivery' ? DELIVERY_STATUS_STEPS : PICKUP_STATUS_STEPS
}

function getStoreName(order, store) {
  return (
    order?.storeName ||
    store?.name ||
    store?.storeName ||
    store?.displayName ||
    'Restaurante'
  )
}

function getStorePhone(order, store) {
  return (
    order?.storeWhatsApp ||
    order?.storeWhatsapp ||
    order?.storePhone ||
    order?.restaurantPhone ||
    order?.merchantPhone ||
    store?.whatsapp ||
    store?.whatsApp ||
    store?.phone ||
    store?.contactPhone ||
    store?.settings?.whatsapp ||
    ''
  )
}

function getCancelContactMessage(order, store) {
  const displayNumber = getOrderDisplayNumber(order)
  const storeName = getStoreName(order, store)

  return [
    `Olá, ${storeName}.`,
    `Gostaria de falar sobre o pedido ${displayNumber}.`,
    'Se ainda for possível, quero solicitar o cancelamento ou ajustar o pedido.',
  ].join(' ')
}

function getSupportContactMessage(order, store) {
  const displayNumber = getOrderDisplayNumber(order)
  const storeName = getStoreName(order, store)

  return [
    `Olá, ${storeName}.`,
    `Tenho uma dúvida sobre o pedido ${displayNumber}.`,
  ].join(' ')
}

function getStoreSlugFromOrder(order, fallbackSlug) {
  return (
    order?.storeSlug ||
    order?.storePublicId ||
    fallbackSlug ||
    order?.storeId ||
    order?.storeDocId ||
    ''
  )
}

function getOrderStoreKeys(order) {
  return uniqueArray([
    ...(Array.isArray(order?.storeKeys) ? order.storeKeys : []),
    order?.storeSlug,
    order?.storeId,
    order?.storeDocId,
    order?.storePublicId,
  ])
}

function getCustomerName(order) {
  return order?.customerName || order?.customer?.name || 'Cliente'
}

function getCustomerPhone(order) {
  return order?.customerPhone || order?.customer?.phone || ''
}

function getDeliveryAddress(order) {
  const address = order?.deliveryAddress

  if (address && typeof address === 'object') {
    const main = [address.street, address.number].filter(Boolean).join(', ')
    const second = [address.neighborhood, address.complement].filter(Boolean).join(' · ')
    const reference = address.reference ? `Ref: ${address.reference}` : ''

    return [main, second, reference].filter(Boolean).join(' · ') || 'Endereço não informado'
  }

  if (typeof order?.address === 'string') return order.address

  if (getOrderType(order) === 'pickup') return 'Retirada na loja'
  if (getOrderType(order) === 'dine_in') {
    return order?.tableLabel || order?.tableName || (order?.tableNumber ? `Mesa ${order.tableNumber}` : 'Pedido na mesa')
  }

  return 'Endereço não informado'
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : []
}

function getItemQuantity(item) {
  return Number(item?.quantity || item?.qty || 1)
}

function getOrderDisplayNumber(order, fallbackId = '') {
  const internalId = String(
    order?.firestoreId ||
    order?.docId ||
    order?._docId ||
    fallbackId ||
    order?.id ||
    ''
  ).trim()

  if (internalId) {
    return `#${internalId.slice(-4).toUpperCase()}`
  }

  return '#----'
}

function getOrderType(order) {
  const type = String(order?.orderType || order?.type || '').toLowerCase()

  if (['pickup', 'retirada', 'takeaway', 'takeout'].includes(type)) return 'pickup'
  if (['dine_in', 'mesa', 'table', 'local'].includes(type)) return 'dine_in'

  return 'delivery'
}


function getItemPrice(item) {
  return normalizeMoney(
    item?.basePrice ?? item?.price,
    item?.basePriceCents ?? item?.priceCents
  )
}

function getItemOldPrice(item) {
  return normalizeMoney(
    item?.oldPrice ?? item?.compareAtPrice,
    item?.oldPriceCents ?? item?.compareAtPriceCents
  )
}

function getRawItemExtras(item) {
  return [
    ...(Array.isArray(item?.extras) ? item.extras : []),
    ...(Array.isArray(item?.selectedOptions) ? item.selectedOptions : []),
    ...(Array.isArray(item?.addons) ? item.addons : []),
  ]
}

function getItemExtras(item) {
  const seen = new Set()

  return getRawItemExtras(item).filter((extra) => {
    const key = [
      extra?.type || '',
      extra?.groupTitle || '',
      extra?.name || '',
      normalizeMoney(extra?.price, extra?.priceCents),
      Number(extra?.quantity || extra?.qty || 1),
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getItemOptions(item) {
  return getItemExtras(item).filter(
    (extra) => extra?.type === 'option' || extra?.groupTitle
  )
}

function getItemAdditionals(item) {
  return getItemExtras(item).filter(
    (extra) => extra?.type !== 'option' && !extra?.groupTitle
  )
}

function getItemExtrasTotal(item) {
  return getItemExtras(item).reduce((acc, extra) => {
    const price = normalizeMoney(extra?.price, extra?.priceCents)
    const quantity = Number(extra?.quantity || extra?.qty || 1)

    return acc + price * quantity
  }, 0)
}

function getItemTotal(item) {
  if (item?.total !== undefined || item?.totalCents !== undefined) {
    return normalizeMoney(item.total, item.totalCents)
  }

  return (getItemPrice(item) + getItemExtrasTotal(item)) * getItemQuantity(item)
}

function getItemOriginalUnitPrice(item) {
  const currentPrice = getItemPrice(item)
  const oldPrice = getItemOldPrice(item)

  if (oldPrice > currentPrice) return oldPrice

  return currentPrice
}

function getItemOriginalTotal(item) {
  return (
    (getItemOriginalUnitPrice(item) + getItemExtrasTotal(item)) *
    getItemQuantity(item)
  )
}

function getPromotionInfo(item) {
  const currentPrice = getItemPrice(item)
  const oldPrice = getItemOldPrice(item)

  const savedPromotion = item?.promotion || {}
  const activeFromSavedData = Boolean(savedPromotion.active || item?.isPromotion)

  if (!oldPrice || !currentPrice || oldPrice <= currentPrice) {
    return {
      active: activeFromSavedData,
      oldPrice: normalizeMoney(savedPromotion.oldPrice, savedPromotion.oldPriceCents),
      currentPrice,
      percent: Number(savedPromotion.percent || 0),
      savings: normalizeMoney(savedPromotion.savings, savedPromotion.savingsCents),
    }
  }

  const savings = oldPrice - currentPrice
  const percent = Math.round((savings / oldPrice) * 100)

  return {
    active: true,
    oldPrice,
    currentPrice,
    percent,
    savings,
  }
}

function getItemOptionsSummary(item) {
  if (item?.optionsSummary) return item.optionsSummary

  const options = getItemOptions(item)
  const additionals = getItemAdditionals(item)

  const optionText = options.map((option) => {
    const quantity = Number(option.quantity || option.qty || 1)
    const prefix = quantity > 1 ? `${quantity}x ` : ''

    return option.groupTitle
      ? `${option.groupTitle}: ${prefix}${option.name}`
      : `${prefix}${option.name}`
  })

  const additionalText = additionals.map((extra) => {
    const quantity = Number(extra.quantity || extra.qty || 1)
    const prefix = quantity > 1 ? `${quantity}x ` : ''

    return `+ ${prefix}${extra.name}`
  })

  return [...optionText, ...additionalText].join(' · ')
}


function getOrderSubtotal(order) {
  const savedSubtotal = normalizeMoney(order?.subtotal, order?.subtotalCents)

  if (savedSubtotal > 0) return savedSubtotal

  return getOrderItems(order).reduce((acc, item) => acc + getItemTotal(item), 0)
}

function getOrderSubtotalWithoutPromotions(order) {
  const savedValue = normalizeMoney(
    order?.subtotalWithoutPromotions,
    order?.subtotalWithoutPromotionsCents
  )

  if (savedValue > 0) return savedValue

  return getOrderItems(order).reduce(
    (acc, item) => acc + getItemOriginalTotal(item),
    0
  )
}

function getOrderPromotionSavings(order) {
  const savedValue = normalizeMoney(
    order?.promotionSavings,
    order?.promotionSavingsCents
  )

  if (savedValue > 0) return savedValue

  return Math.max(
    0,
    getOrderSubtotalWithoutPromotions(order) - getOrderSubtotal(order)
  )
}

function getOrderDiscount(order) {
  return normalizeMoney(order?.discount, order?.discountCents)
}

function getOrderDeliveryFee(order) {
  return normalizeMoney(order?.deliveryFee, order?.deliveryFeeCents)
}

function getOrderTotal(order) {
  const savedTotal = normalizeMoney(order?.total, order?.totalCents)

  if (savedTotal > 0) return savedTotal

  return (
    Math.max(0, getOrderSubtotal(order) - getOrderDiscount(order)) +
    getOrderDeliveryFee(order)
  )
}

function getPaymentLabel(order) {
  const method = order?.payment?.method || order?.paymentMethod || ''

  const map = {
    pix: 'Pix',
    pix_manual: 'Pix manual',
    pix_static: 'Pix manual',
    card: 'Cartão',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    card_on_delivery: 'Maquininha na entrega',
    cash: 'Dinheiro',
    money: 'Dinheiro',
    Pix: 'Pix manual',
    Cartão: 'Maquininha na entrega',
    Dinheiro: 'Dinheiro',
  }

  return order?.payment?.label || map[method] || method || 'Não informado'
}

function getPaymentStatusLabel(order) {
  const status = getPaymentStatusId(order)

  const map = {
    awaiting_payment: 'Aguardando pagamento',
    pending: 'Aguardando confirmação',
    proof_sent: 'Comprovante enviado',
    pay_on_delivery: 'A receber na entrega',
    manual_confirmation: 'Confirmação manual',
    paid: 'Pago',
    pago: 'Pago',
    canceled: 'Cancelado',
    refunded: 'Estornado',
  }

  return map[status] || (isPixManualOrder(order) ? 'Aguardando confirmação' : 'Manual')
}

function getCancellationReason(order) {
  return (
    order?.cancellationReason ||
    order?.cancelReason ||
    order?.canceledReason ||
    order?.cancellation?.reason ||
    order?.cancel?.reason ||
    ''
  )
}

function getStatusContent(order) {
  const status = normalizeStatus(order?.status)

if (status === 'cancelado') {
  const cancellationReason = getCancellationReason(order)

  return {
    title: 'Pedido cancelado',
    description: cancellationReason
      ? 'A loja informou o motivo do cancelamento abaixo.'
      : 'Entre em contato com a loja se precisar de mais detalhes.',
    tone: 'red',
    icon: FiXCircle,
  }
}
  if (isPixPaymentPending(order) && status === 'pendente') {
    return {
      title: 'Esperando confirmação de pagamento',
      description: 'Copie o Pix, faça o pagamento e envie o comprovante para a loja confirmar seu pedido.',
      tone: 'amber',
      icon: FiCreditCard,
    }
  }

  if (status === 'pendente') {
    return {
      title: 'Pedido recebido',
      description: 'A loja já recebeu seu pedido e deve confirmar em breve.',
      tone: 'amber',
      icon: FiClock,
    }
  }

  if (status === 'preparando') {
    return {
      title: 'Pedido em preparo',
      description: 'A loja está preparando tudo com cuidado.',
      tone: 'green',
      icon: FiPackage,
    }
  }

  if (status === 'pronto') {
    return {
      title: 'Pedido pronto',
      description: 'Seu pedido está pronto. Fale com a loja se precisar de ajuda.',
      tone: 'blue',
      icon: FiCheck,
    }
  }

  if (status === 'em_rota') {
    return {
      title: 'Saiu para entrega',
      description: 'Seu pedido está a caminho. Fique de olho no telefone.',
      tone: 'blue',
      icon: FiTruck,
    }
  }

  return {
    title: getOrderType(order) === 'delivery' ? 'Pedido entregue' : 'Pedido finalizado',
    description: 'Obrigado por pedir pelo PratoBy.',
    tone: 'green',
    icon: FiCheckCircle,
  }
}

function getStepTime(order, stepId) {
  if (stepId === 'pendente') {
    return (
      order?.createdAt ||
      order?.receivedAt ||
      order?.pendingAt
    )
  }

  if (stepId === 'preparando') {
    return (
      order?.preparingAt ||
      order?.confirmedAt ||
      order?.acceptedAt
    )
  }

  if (stepId === 'pronto') {
    return (
      order?.readyAt ||
      order?.readyForPickupAt ||
      order?.preparedAt
    )
  }

  if (stepId === 'em_rota') {
    return (
      order?.outForDeliveryAt ||
      order?.deliveryStartedAt ||
      order?.inRouteAt
    )
  }

  if (stepId === 'entregue') {
    return (
      order?.deliveredAt ||
      order?.customerConfirmedDeliveryAt ||
      order?.finishedAt
    )
  }

  return null
}

function RatingInput({ label, value, onChange }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
        {label}
      </p>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
              star <= value
                ? 'bg-amber-50 text-amber-500'
                : 'bg-gray-50 text-gray-300'
            }`}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            <FiStar
              size={22}
              className={star <= value ? 'fill-amber-500' : ''}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function OrderItemCard({ item, index }) {
  const promo = getPromotionInfo(item)
  const options = getItemOptions(item)
  const additionals = getItemAdditionals(item)
  const optionsSummary = getItemOptionsSummary(item)

  return (
    <div
      key={`${item.cartItemId || item.id || item.name}-${index}`}
      className="rounded-2xl border border-gray-100 p-4"
    >
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <p className="font-black text-[#111827]">
            <span className="text-[#f97316]">
              {getItemQuantity(item)}x
            </span>{' '}
            {item.name}
          </p>

          {promo.active && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600">
                Promoção
              </span>

              {promo.oldPrice > promo.currentPrice && (
                <>
                  <span className="text-xs font-bold text-gray-400 line-through">
                    {formatMoney(promo.oldPrice)}
                  </span>

                  <span className="text-xs font-black text-[#f97316]">
                    {formatMoney(promo.currentPrice)}
                  </span>

                  {promo.percent > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                      -{promo.percent}%
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {options.length > 0 && (
            <div className="mt-2 space-y-1">
              {options.map((option, optionIndex) => {
                const quantity = Number(option.quantity || option.qty || 1)
                const price = normalizeMoney(option.price, option.priceCents)
                const totalOptionPrice = price * quantity

                return (
                  <p
                    key={`${option.groupTitle}-${option.name}-${optionIndex}`}
                    className="text-xs leading-5 text-[#6b7280]"
                  >
                    <strong>{option.groupTitle || 'Opção'}:</strong>{' '}
                    {quantity > 1 ? `${quantity}x ` : ''}
                    {option.name}
                    {totalOptionPrice > 0 ? ` · + ${formatMoney(totalOptionPrice)}` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {additionals.length > 0 && (
            <div className="mt-2 space-y-1">
              {additionals.map((extra, extraIndex) => {
                const quantity = Number(extra.quantity || extra.qty || 1)
                const price = normalizeMoney(extra.price, extra.priceCents)
                const totalExtraPrice = price * quantity

                return (
                  <p
                    key={`${extra.name}-${extraIndex}`}
                    className="text-xs leading-5 text-[#6b7280]"
                  >
                    <strong>Adicional:</strong>{' '}
                    {quantity > 1 ? `${quantity}x ` : ''}
                    {extra.name}
                    {totalExtraPrice > 0 ? ` · + ${formatMoney(totalExtraPrice)}` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {!options.length && !additionals.length && optionsSummary && (
            <p className="mt-2 text-xs leading-5 text-[#6b7280]">
              {optionsSummary}
            </p>
          )}

          {(item.observation || item.itemObservation || item.notes) && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
              Obs: {item.observation || item.itemObservation || item.notes}
            </p>
          )}
        </div>

        <p className="shrink-0 text-sm font-black text-[#111827]">
          {formatMoney(getItemTotal(item))}
        </p>
      </div>
    </div>
  )
}

function ReceiptTotals({ order }) {
  const promotionSavings = getOrderPromotionSavings(order)
  const subtotalWithoutPromotions = getOrderSubtotalWithoutPromotions(order)
  const subtotal = getOrderSubtotal(order)
  const discount = getOrderDiscount(order)
  const deliveryFee = getOrderDeliveryFee(order)
  const total = getOrderTotal(order)

  return (
    <div className="border-t border-dashed border-gray-200 pt-5">
      <div className="space-y-2">
        {promotionSavings > 0 ? (
          <>
            <div className="flex justify-between text-sm text-[#6b7280]">
              <span>Itens sem promoção</span>
              <span>{formatMoney(subtotalWithoutPromotions)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-red-600">
              <span>Economia em promoções</span>
              <span>-{formatMoney(promotionSavings)}</span>
            </div>

            <div className="flex justify-between text-sm text-[#6b7280]">
              <span>Subtotal com promoções</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-sm text-[#6b7280]">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between text-sm font-bold text-[#f97316]">
            <span>
              Cupom {order.couponCode ? `(${order.couponCode})` : ''}
            </span>
            <span>-{formatMoney(discount)}</span>
          </div>
        )}

        {getOrderType(order) === 'delivery' && (
          <div className="flex justify-between text-sm text-[#6b7280]">
            <span>Entrega</span>
            <span>{formatMoney(deliveryFee)}</span>
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <div className="flex justify-between text-xl font-black text-[#111827]">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>

          {(promotionSavings > 0 || discount > 0) && (
            <p className="mt-1 text-right text-xs font-bold text-[#f97316]">
              Economia total de {formatMoney(promotionSavings + discount)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


function PixManualPaymentCard({
  order,
  store,
  copied,
  onCopyPix,
  onSendProof,
  proofLoading,
  orderDisplayNumber,
}) {
  const pixCopyPaste = getPixCopyPaste(order)
  const pixKey = getPixKeyLabel(order)
  const proofUrl = getPaymentProofUrl(order)
  const pixPaid = isPaymentPaid(order)
  const proofSent = Boolean(order?.payment?.proofSentAt || order?.proofSentAt)
  const merchantName = getPixMerchantName(order, store)
  const merchantCity = getPixMerchantCity(order, store)

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm print:hidden">
      <div className="bg-amber-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
            <FiCreditCard size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700 shadow-sm">
              Pix
            </span>

            <h3 className="mt-3 text-xl font-black tracking-tight text-[#111827]">
              {pixPaid ? 'Pagamento confirmado' : 'Aguardando pagamento Pix'}
            </h3>

            <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
              {pixPaid
                ? 'A loja já confirmou o pagamento. Agora é só acompanhar o preparo do pedido.'
                : 'Faça o Pix usando o copia e cola abaixo. Depois envie o comprovante para a loja pelo WhatsApp.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
              Valor do Pix
            </p>
            <p className="mt-1 text-2xl font-black text-[#111827]">
              {formatMoney(getOrderTotal(order))}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
              Status
            </p>
            <p className={`mt-1 text-sm font-black ${pixPaid ? 'text-green-600' : 'text-amber-700'}`}>
              {pixPaid ? 'Pago' : proofSent ? 'Comprovante enviado' : 'Aguardando confirmação'}
            </p>
          </div>
        </div>

        {pixKey && (
          <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
              Chave Pix
            </p>
            <p className="mt-1 break-all font-mono text-sm font-black text-[#111827]">
              {pixKey}
            </p>
          </div>
        )}

        {(merchantName || merchantCity) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {merchantName && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Recebedor
                </p>
                <p className="mt-1 truncate text-sm font-black text-[#111827]">
                  {merchantName}
                </p>
              </div>
            )}

            {merchantCity && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Cidade
                </p>
                <p className="mt-1 truncate text-sm font-black text-[#111827]">
                  {merchantCity}
                </p>
              </div>
            )}
          </div>
        )}

        {pixCopyPaste && !pixPaid && (
  <>
    <PixQrCodeBox
      pixCopyPaste={pixCopyPaste}
      orderDisplayNumber={orderDisplayNumber}
    />

    <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[#111827]">
          Pix copia e cola
        </p>

        <button
          type="button"
          onClick={onCopyPix}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:text-[#f97316]"
        >
          <FiCopy />
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <p className="mt-3 max-h-28 overflow-y-auto break-all rounded-xl bg-white p-3 font-mono text-xs font-bold leading-5 text-[#6b7280]">
        {pixCopyPaste}
      </p>
    </div>
  </>
)}

        {proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:text-[#f97316]"
          >
            <FiDownload />
            Ver comprovante enviado
          </a>
        ) : !pixPaid ? (
          <button
            type="button"
            onClick={onSendProof}
            disabled={proofLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {proofLoading ? (
              <>
                <FiLoader className="animate-spin" />
                Abrindo WhatsApp...
              </>
            ) : (
              <>
                <FiMessageCircle />
                Enviar comprovante à loja
              </>
            )}
          </button>
        ) : null}

        {!pixPaid && (
          <p className="text-xs font-semibold leading-5 text-[#6b7280]">
            O preparo começa após a loja confirmar o pagamento. Se já pagou, envie o comprovante pelo WhatsApp para agilizar.
          </p>
        )}
      </div>
    </section>
  )
}

function PixQrCodeBox({ pixCopyPaste, orderDisplayNumber }) {
  if (!pixCopyPaste) return null

  const qrCodeId = `pix-qrcode-${String(orderDisplayNumber || 'pedido')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()}`

  async function handleCopyPix() {
    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      alert('Pix copia e cola copiado.')
    } catch {
      alert('Não foi possível copiar o Pix.')
    }
  }

  function handleDownloadQrCode() {
    const canvas = document.getElementById(qrCodeId)

    if (!canvas) return

    const imageUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')

    link.href = imageUrl
    link.download = `pix-${String(orderDisplayNumber || 'pedido')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase()}.png`

    link.click()
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-orange-100 bg-white p-4">
      <div className="text-center">
        <p className="text-sm font-black text-[#111827]">
          Escaneie o QR Code Pix
        </p>

        <p className="mt-1 text-xs font-bold leading-5 text-[#6b7280]">
          Abra o app do seu banco, escaneie o código e envie o comprovante para a loja.
        </p>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="rounded-[1.5rem] border border-gray-100 bg-white p-3 shadow-sm">
          <QRCodeCanvas
            id={qrCodeId}
            value={pixCopyPaste}
            size={220}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#111827"
          />
        </div>
      </div>
    </div>
  )
}

function getTrackingFooterStore(order, store) {
  if (!order && !store) return null

  const storeName = getStoreName(order, store)
  const logoUrl = getStoreLogoUrl(order, store)
  const whatsapp = getStorePhone(order, store)

  return {
    ...store,

    name: storeName,
    storeName,

    logoUrl:
      logoUrl ||
      store?.logoUrl ||
      store?.logo ||
      store?.imageUrl ||
      '/icons/icon-192.png',

    logo:
      logoUrl ||
      store?.logo ||
      store?.logoUrl ||
      '/icons/icon-192.png',

    whatsapp:
      whatsapp ||
      store?.whatsapp ||
      store?.phone ||
      store?.contactPhone ||
      '',

    phone:
      whatsapp ||
      store?.phone ||
      store?.whatsapp ||
      '',

    description:
      store?.shortDescription ||
      store?.description ||
      order?.storeDescription ||
      `Acompanhe seu pedido na ${storeName}.`,

    themeColor:
      store?.themeColor ||
      store?.primaryColor ||
      store?.brandColor ||
      '#f97316',

    address:
      store?.address ||
      order?.storeAddress ||
      order?.store?.address ||
      null,

    city:
      store?.city ||
      store?.address?.city ||
      order?.storeCity ||
      order?.store?.city ||
      '',
  }
}

export default function OrderTrackingPage() {
  const { slug, orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelRequestLoading, setCancelRequestLoading] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [proofLoading, setProofLoading] = useState(false)

  const [review, setReview] = useState(INITIAL_REVIEW)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSent, setReviewSent] = useState(false)

  const audioRef = useRef(null)
  const previousStatusRef = useRef(null)

  useEffect(() => {
    audioRef.current = new Audio('/confirmation.mp3')
    audioRef.current.preload = 'auto'

    const unlockAudio = async () => {
      if (!audioRef.current) return
      try {
        audioRef.current.muted = true
        await audioRef.current.play()
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.muted = false
      } catch {
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('touchstart', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    })
  }, [])

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = onSnapshot(
      doc(db, 'orders', orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null)
          setAccessError(false)
          setLoading(false)
          return
        }

        const data = {
          ...snapshot.data(),
          id: snapshot.id,
          firestoreId: snapshot.id,
        }

        const storeKeys = getOrderStoreKeys(data)

        const shouldBlockAccess =
          slug &&
          storeKeys.length > 0 &&
          !storeKeys.includes(slug)

        if (shouldBlockAccess) {
          setOrder(null)
          setAccessError(true)
          setLoading(false)
          return
        }

        setOrder(data)
        setAccessError(false)
        setLoading(false)
      },
      () => {
        setOrder(null)
        setAccessError(false)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [orderId, slug])

  useEffect(() => {
    const storeKey = getStoreSlugFromOrder(order, slug)

    if (!storeKey) {
      setStore(null)
      return undefined
    }

    let isMounted = true

    async function loadPublicStore() {
      try {
        const getPublicStoreProfile = httpsCallable(functions, 'getPublicStoreProfile')
        const result = await getPublicStoreProfile({
          storeId: order?.storeId,
          storeDocId: order?.storeDocId,
          storeSlug: storeKey,
        })
        const publicStore = result?.data?.store || null

        if (isMounted) setStore(publicStore)
      } catch {
        if (isMounted) setStore(null)
      }
    }

    loadPublicStore()

    return () => {
      isMounted = false
    }
  }, [order, slug])


  const status = normalizeStatus(order?.status)

  useEffect(() => {
    if (status && previousStatusRef.current && status !== previousStatusRef.current) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(e => console.log('Navegador bloqueou o áudio:', e))
        
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      }
    }
    if (status) {
      previousStatusRef.current = status
    }
  }, [status])
const isCanceled = status === 'cancelado'
const cancellationReason = getCancellationReason(order)
const isDelivered = status === 'entregue'
  const canConfirmDelivery = status === 'em_rota' || status === 'pronto'
  const canRequestCancel = !isCanceled && !isDelivered
  const reviewAlreadySubmitted = Boolean(
    reviewSent ||
      order?.review?.submitted ||
      order?.reviewId
  )

  const storeSlug = getStoreSlugFromOrder(order, slug)
  const footerStore = useMemo(() => {
  return getTrackingFooterStore(order, store)
}, [order, store])
  const orderDisplayNumber = getOrderDisplayNumber(order, orderId)
  const storePhone = getStorePhone(order, store)
  const isPixManual = isPixManualOrder(order)
  const pixPaymentPending = isPixPaymentPending(order)
  const pixPaid = isPixManual && isPaymentPaid(order)
  const pixCopyPaste = getPixCopyPaste(order)
  const shouldShowPixCard = isPixManual && !isCanceled && !isDelivered && (pixPaymentPending || pixPaid)
  const statusContent = getStatusContent(order)
  const StatusIcon = statusContent.icon

  const statusSteps = useMemo(() => getStatusSteps(order), [order])

  const currentStepIndex = useMemo(() => {
    const directIndex = statusSteps.findIndex((step) => step.id === status)

    if (directIndex >= 0) return directIndex
    if (status === 'em_rota' && getOrderType(order) !== 'delivery') return 2

    return 0
  }, [order, status, statusSteps])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleConfirmDelivery = useCallback(async () => {
    if (!order?.id || actionLoading) return

    const confirmed = window.confirm(
      getOrderType(order) === 'delivery'
        ? 'Você confirma que recebeu o pedido?'
        : 'Você confirma que retirou/recebeu o pedido?'
    )

    if (!confirmed) return

    try {
      setActionLoading(true)

      const confirmCustomerDelivery = httpsCallable(functions, 'confirmCustomerDelivery')
      await confirmCustomerDelivery({
        orderId: order.id,
        trackingToken: order.trackingToken || order.id,
      })
    } catch (error) {
      console.error(error)
      alert('Não foi possível confirmar o recebimento agora.')
    } finally {
      setActionLoading(false)
    }
  }, [actionLoading, order])

  const openStoreWhatsApp = useCallback((message) => {
    const url = buildWhatsAppUrl(storePhone, message)

    if (!url) {
      alert('A loja ainda não possui WhatsApp configurado para contato.')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }, [storePhone])

  const handleCopyPix = useCallback(async () => {
    if (!pixCopyPaste) return

    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      setPixCopied(true)
      window.setTimeout(() => setPixCopied(false), 2200)
    } catch (error) {
      console.error(error)
      alert('Não foi possível copiar o Pix automaticamente. Toque e segure no código para copiar manualmente.')
    }
  }, [pixCopyPaste])

  const handleSendPixProof = useCallback(async () => {
    if (!order?.id || proofLoading) return

    try {
      setProofLoading(true)

      const markCustomerPixProofSent = httpsCallable(functions, 'markCustomerPixProofSent')
      await markCustomerPixProofSent({
        orderId: order.id,
        trackingToken: order.trackingToken || order.id,
      })
    } catch (error) {
      console.info('Não foi possível registrar o envio do comprovante no pedido.', error)
    } finally {
      setProofLoading(false)
      openStoreWhatsApp(getPixProofContactMessage(order, store))
    }
  }, [openStoreWhatsApp, order, proofLoading, store])

  const handleContactStore = useCallback(() => {
    if (!order) return
    openStoreWhatsApp(getSupportContactMessage(order, store))
  }, [openStoreWhatsApp, order, store])

  const handleCancelRequest = useCallback(async () => {
    if (!order?.id || cancelRequestLoading) return

    const confirmed = window.confirm(
      'O cancelamento precisa ser confirmado pela loja. Deseja solicitar pelo WhatsApp?'
    )

    if (!confirmed) return

    try {
      setCancelRequestLoading(true)

      const requestCustomerOrderCancellation = httpsCallable(functions, 'requestCustomerOrderCancellation')
      await requestCustomerOrderCancellation({
        orderId: order.id,
        trackingToken: order.trackingToken || order.id,
      })
    } catch (error) {
      console.info('Não foi possível registrar a solicitação no pedido.', error)
    } finally {
      setCancelRequestLoading(false)
      openStoreWhatsApp(getCancelContactMessage(order, store))
    }
  }, [cancelRequestLoading, openStoreWhatsApp, order, store])

  const toggleReviewTag = useCallback((tagId) => {
    setReview((current) => {
      const hasTag = current.tags.includes(tagId)

      return {
        ...current,
        tags: hasTag
          ? current.tags.filter((tag) => tag !== tagId)
          : [...current.tags, tagId],
      }
    })
  }, [])

  const handleSubmitReview = useCallback(async () => {
    if (!order?.id || reviewLoading) return

    if (!isDelivered) {
      setReviewError('A avaliação só fica disponível após a entrega.')
      return
    }

    if (reviewAlreadySubmitted) {
      setReviewError('Esse pedido já foi avaliado.')
      return
    }

    if (!review.rating) {
      setReviewError('Escolha uma nota geral.')
      return
    }

    try {
      setReviewLoading(true)
      setReviewError('')

      const submitPublicOrderReview = httpsCallable(functions, 'submitPublicOrderReview')
      await submitPublicOrderReview({
        orderId: order.id,
        trackingToken: order.trackingToken || order.id,
        review: {
          rating: Number(review.rating),
          foodRating: Number(review.foodRating),
          deliveryRating: Number(review.deliveryRating),
          serviceRating: Number(review.serviceRating),
          wouldOrderAgain: Boolean(review.wouldOrderAgain),
          tags: review.tags,
          comment: review.comment.trim(),
        },
      })

      setReviewSent(true)
    } catch (error) {
      console.error(error)
      setReviewError('Não foi possível enviar sua avaliação.')
    } finally {
      setReviewLoading(false)
    }
  }, [
    isDelivered,
    order,
    review,
    reviewAlreadySubmitted,
    reviewLoading,
    slug,
  ])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-6">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-orange-100 border-t-[#f97316]" />

          <p className="mt-5 text-sm font-bold text-[#6b7280]">
            Carregando seu pedido...
          </p>
        </div>
      </div>
    )
  }

  if (!order || accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-2xl shadow-gray-200/70">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
            <FiXCircle size={32} />
          </div>

          <h1 className="mt-5 text-2xl font-black text-[#111827]">
            Pedido não encontrado
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#6b7280]">
            O pedido pode não existir, ter sido removido ou o link pode estar incorreto.
          </p>

          <Link
            to={`/${slug || ''}`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c]"
          >
            <FiArrowLeft />
            Voltar para a loja
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 py-4 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/${storeSlug}`}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-[#111827] transition hover:bg-gray-100"
              aria-label="Voltar para loja"
            >
              <FiArrowLeft size={20} />
            </Link>

            <div className="flex min-w-0 items-center gap-3">
              <StoreLogo
                order={order}
                store={store}
                className="h-11 w-11"
              />

              <div className="min-w-0">
                <h1 className="truncate text-lg font-black leading-tight text-[#111827]">
                  Acompanhar pedido
                </h1>

                <p className="truncate text-xs font-bold text-[#6b7280]">
                  {getStoreName(order, store)} · {orderDisplayNumber}
                </p>
              </div>
            </div>
          </div>
    
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-4 text-sm font-black text-white transition hover:bg-black"
          >
            <FiDownload />
            Baixar recibo
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <section
          className={`overflow-hidden rounded-[2rem] p-6 text-white shadow-xl ${
            statusContent.tone === 'red'
              ? 'bg-red-600'
              : statusContent.tone === 'blue'
                ? 'bg-sky-600'
                : statusContent.tone === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-[#f97316]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <StatusIcon size={26} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white/80">
                Status do pedido
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight">
                {statusContent.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/85">
                {statusContent.description}
              </p>
            </div>
          </div>

          {!isCanceled && !isDelivered && (
            <div className="mt-5 rounded-2xl bg-white/15 p-4">
              <p className="flex items-center gap-2 text-sm font-black">
                <FiClock />
                Atualização em tempo real
              </p>

              <p className="mt-1 text-xs leading-5 text-white/80">
                Mantenha esta tela aberta para acompanhar o andamento do pedido.
              </p>
            </div>
          )}
        </section>

        {!isCanceled && (
  <section className="grid gap-3 print:hidden sm:grid-cols-2">
    <button
      type="button"
      onClick={handleContactStore}
      className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
    >
      <FiMessageCircle />
      Falar com restaurante
    </button>

    {canRequestCancel && (
      <button
        type="button"
        onClick={handleCancelRequest}
        disabled={cancelRequestLoading}
        className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {cancelRequestLoading ? (
          <>
            <FiLoader className="animate-spin" />
            Abrindo contato...
          </>
        ) : (
          <>
            <FiXCircle />
            Solicitar cancelamento
          </>
        )}
      </button>
    )}
  </section>
)}

        {shouldShowPixCard && (
          <PixManualPaymentCard
            order={order}
            store={store}
            copied={pixCopied}
            onCopyPix={handleCopyPix}
            onSendProof={handleSendPixProof}
            proofLoading={proofLoading}
            orderDisplayNumber={orderDisplayNumber}
          />
        )}

        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm print:hidden">
{isCanceled ? (
  <div className="py-8 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-500 ring-1 ring-red-100">
      <FiXCircle size={38} />
    </div>

    <h2 className="mt-4 text-xl font-black text-[#111827]">
      Pedido cancelado
    </h2>

    {cancellationReason ? (
      <div className="mx-auto mt-5 max-w-lg rounded-[1.4rem] border border-red-100 bg-red-50 p-4 text-left">
        <p className="text-xs font-black uppercase tracking-wide text-red-600">
          Motivo informado pela loja
        </p>

        <p className="mt-2 text-sm font-bold leading-6 text-red-800">
          {cancellationReason}
        </p>
      </div>
    ) : (
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">
        A loja cancelou este pedido. Se tiver dúvidas, entre em contato com a loja.
      </p>
    )}

    <button
      type="button"
      onClick={handleContactStore}
      className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-5 py-3 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 active:scale-[0.98]"
    >
      <FiMessageCircle />
      Falar com a loja
    </button>
  </div>
) : (
            <div className="relative space-y-8">
              <div className="absolute bottom-7 left-[23px] top-7 w-1 rounded-full bg-gray-100" />

              {statusSteps.map((step, index) => {
                const Icon = step.icon
                const isCompleted = index <= currentStepIndex
                const isCurrent = index === currentStepIndex
                const timeLabel = formatTime(getStepTime(order, step.id))

                return (
                  <div
                    key={step.id}
                    className={`relative flex items-center gap-4 ${
                      isCompleted ? 'opacity-100' : 'opacity-45'
                    }`}
                  >
                    <div
                      className={`z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-4 border-white shadow-sm ${
                        isCurrent
                          ? 'bg-[#111827] text-white'
                          : isCompleted
                            ? 'bg-[#f97316] text-white'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-black ${
                          isCurrent ? 'text-[#111827]' : 'text-[#6b7280]'
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="mt-0.5 text-xs leading-5 text-[#6b7280]">
                        {step.description}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        isCurrent
                          ? 'bg-orange-50 text-[#f97316]'
                          : 'bg-gray-50 text-[#6b7280]'
                      }`}
                    >
                      {timeLabel || (isCurrent ? 'Agora' : '—')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {canConfirmDelivery && (
          <section className="rounded-[2rem] border border-orange-100 bg-orange-50 p-5 shadow-sm print:hidden">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#f97316]">
                <FiTruck size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-[#111827]">
                  {getOrderType(order) === 'delivery' ? 'Pedido chegou?' : 'Pedido retirado?'}
                </h3>

                <p className="mt-1 text-sm leading-6 text-[#6b7280]">
                  Confirme o recebimento para finalizar o pedido e liberar a avaliação.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={actionLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actionLoading ? (
                <>
                  <FiLoader className="animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <FiCheck />
                  Confirmar que recebi
                </>
              )}
            </button>
          </section>
        )}

        {isDelivered && (
          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm print:hidden">
            {reviewAlreadySubmitted ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-[#f97316]">
                  <FiHeart size={30} />
                </div>

                <h2 className="mt-4 text-xl font-black text-[#111827]">
                  Obrigado pela avaliação!
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                  Sua opinião foi enviada de forma privada para a loja.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#f97316]">
                    <FiStar />
                    Avaliação privada
                  </span>

                  <h2 className="mt-3 text-2xl font-black tracking-tight text-[#111827]">
                    Como foi sua experiência?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                    Essa avaliação será vista apenas pelo lojista para melhorar o atendimento.
                  </p>
                </div>

                <div className="space-y-5">
                  <RatingInput
                    label="Nota geral"
                    value={review.rating}
                    onChange={(value) =>
                      setReview((current) => ({
                        ...current,
                        rating: value,
                      }))
                    }
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <RatingInput
                      label="Comida"
                      value={review.foodRating}
                      onChange={(value) =>
                        setReview((current) => ({
                          ...current,
                          foodRating: value,
                        }))
                      }
                    />

                    <RatingInput
                      label="Entrega"
                      value={review.deliveryRating}
                      onChange={(value) =>
                        setReview((current) => ({
                          ...current,
                          deliveryRating: value,
                        }))
                      }
                    />

                    <RatingInput
                      label="Atendimento"
                      value={review.serviceRating}
                      onChange={(value) =>
                        setReview((current) => ({
                          ...current,
                          serviceRating: value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      O que marcou sua experiência?
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {REVIEW_TAGS.map((tag) => {
                        const active = review.tags.includes(tag.id)

                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleReviewTag(tag.id)}
                            className={`rounded-2xl px-3 py-2 text-xs font-black transition ${
                              active
                                ? 'bg-[#f97316] text-white'
                                : 'bg-gray-50 text-[#6b7280] hover:bg-orange-50 hover:text-[#f97316]'
                            }`}
                          >
                            {tag.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Você pediria novamente?
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setReview((current) => ({
                            ...current,
                            wouldOrderAgain: true,
                          }))
                        }
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                          review.wouldOrderAgain
                            ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-100'
                            : 'bg-gray-50 text-[#6b7280]'
                        }`}
                      >
                        Sim
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setReview((current) => ({
                            ...current,
                            wouldOrderAgain: false,
                          }))
                        }
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                          !review.wouldOrderAgain
                            ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
                            : 'bg-gray-50 text-[#6b7280]'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Comentário opcional
                    </label>

                    <textarea
                      rows={4}
                      value={review.comment}
                      onChange={(event) =>
                        setReview((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                      placeholder="Conte para a loja o que foi bom ou o que pode melhorar..."
                      className="w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  {reviewError && (
                    <div className="flex gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                      <FiAlertCircle className="mt-0.5 shrink-0" />
                      {reviewError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={reviewLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {reviewLoading ? (
                      <>
                        <FiLoader className="animate-spin" />
                        Enviando avaliação...
                      </>
                    ) : (
                      <>
                        <FiStar />
                        Enviar avaliação
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        <section
            id="receipt"
            className="receipt-print rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none"
          >
          <div className="border-b border-dashed border-gray-200 pb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] print:hidden">
              <FiShoppingBag size={26} />
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-[#111827]">
              Recibo {orderDisplayNumber}
            </h2> 

            <p className="mt-2 text-sm text-[#6b7280]">
              {formatDateTime(order.createdAt)}
            </p>

            <p className="mt-1 text-sm font-bold text-[#6b7280]">
              {getStoreName(order, store)}
            </p>

            <p className="mt-1 font-mono text-xs font-bold text-gray-400">
              ID interno: {order.firestoreId || order.id}
            </p>
          </div>

          <div className="space-y-6 py-6">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                Cliente
              </p>

              <div className="break-inside-avoid rounded-2xl bg-[#f9fafb] p-4 print:border print:border-gray-200">
                <p className="font-black text-[#111827]">
                  {getCustomerName(order)}
                </p>

                <p className="mt-1 text-sm text-[#6b7280]">
                  {formatBrazilianPhone(getCustomerPhone(order))}
                </p>

                <p className="mt-2 flex gap-2 text-sm leading-6 text-[#6b7280]">
                  <FiMapPin className="mt-1 shrink-0" />
                  {getDeliveryAddress(order)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                Itens
              </p>

              <div className="space-y-3">
                {getOrderItems(order).map((item, index) => (
                  <OrderItemCard
                    key={`${item.cartItemId || item.id || item.name}-${index}`}
                    item={item}
                    index={index}
                  />
                ))}
              </div>
            </div>
            

            <ReceiptTotals order={order} />

            <div className="rounded-2xl bg-[#f9fafb] p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#6b7280]">
                Pagamento
              </p>

              <p className="font-black text-[#111827]">
                {getPaymentLabel(order)}
              </p>

              <p className="mt-1 text-sm text-[#6b7280]">
                {getPaymentStatusLabel(order)}
              </p>

              {order.changeFor && (
                <p className="mt-1 text-sm text-[#6b7280]">
                  Troco: {order.changeFor}
                </p>
              )}

              {isPixManualOrder(order) && (
                <div className="mt-3 break-inside-avoid rounded-xl border border-orange-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                      Pix
                    </span>

                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                      isPaymentPaid(order)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isPaymentPaid(order) ? 'Pago' : 'Aguardando'}
                    </span>
                  </div>

                  {getPixKeyLabel(order) && (
                    <p className="mt-2 break-all font-mono text-xs font-bold text-[#6b7280]">
                      Chave: {getPixKeyLabel(order)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {(order.customerObservation || order.orderObservation) && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="mb-1 text-xs font-black uppercase tracking-wide text-amber-700">
                  Observação
                </p>

                <p className="text-sm leading-6 text-amber-800">
                  {order.orderObservation || order.customerObservation}
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 print:hidden sm:grid-cols-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-4 text-sm font-black text-white transition hover:bg-black"
          >
            <FiDownload />
            Baixar recibo
          </button>

          <Link
            to={`/${storeSlug}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-black text-[#111827] shadow-sm transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316]"
          >
            <FiHome />
            Voltar para loja
          </Link>
        </div>
      </div>
      {footerStore && (
  <div className="print:hidden">
    <div className="mx-auto max-w-3xl px-4 pb-5 pt-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-100 to-orange-200" />

        <span className="shrink-0 rounded-full border border-orange-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#f97316] shadow-sm">
          Pedido via PratoBy
        </span>

        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-orange-100 to-orange-200" />
      </div>
    </div>

    <StoreFooter store={footerStore} />
  </div>
)}
    </main>
  )
}

