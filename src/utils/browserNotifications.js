import { getOrderDisplayNumber } from './orderNumber'

// TODO Fase 2 — Push para lojista: inicializar Firebase Messaging, criar service worker,
// configurar VAPID, criar callable registerFcmToken, salvar token por uid/storeId,
// enviar push de novo pedido via backend e remover tokens inválidos.
// TODO Fase 3 — Push para cliente: botão no tracking para receber atualizações,
// vincular token a orderId/trackingToken e enviar push de mudança de status sem dados sensíveis.

function getOrderTotal(order) {
  const cents = order?.totalCents ?? order?.totalAmountCents ?? order?.amountCents
  if (Number(cents) > 0) return Number(cents) / 100

  const total = order?.total ?? order?.totalAmount ?? order?.amount
  return Number(total) || 0
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function isBrowserNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission() {
  if (!isBrowserNotificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export function getNewOrderNotificationBody(order, fallbackId = '') {
  return `${getOrderDisplayNumber(order, fallbackId)} - ${formatMoney(getOrderTotal(order))}`
}

export function showNewOrderBrowserNotification(order, options = {}) {
  if (getBrowserNotificationPermission() !== 'granted') return null

  const orderId = String(options.orderId || order?.firestoreId || order?.id || '').trim()
  const notification = new Notification('Novo pedido recebido 🍽️', {
    body: options.body || getNewOrderNotificationBody(order, orderId),
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32x32.png',
    tag: `pratoby-new-order-${orderId || 'unknown'}`,
    requireInteraction: true,
  })

  // Notificação local enquanto o dashboard está aberto/em background; não é push real com navegador fechado.
  notification.onclick = () => {
    try {
      window.focus()
    } catch {
      // Some browsers can reject focus from notification callbacks.
    }

    if (typeof options.onClick === 'function') {
      options.onClick()
    }

    notification.close()
  }

  return notification
}
