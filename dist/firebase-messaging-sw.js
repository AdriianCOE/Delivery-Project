importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js')

function getFirebaseConfigFromSearch() {
  try {
    const params = new URL(self.location.href).searchParams
    const encodedConfig = params.get('config')
    if (!encodedConfig) return null

    return JSON.parse(decodeURIComponent(encodedConfig))
  } catch (error) {
    console.warn('[FCM SW] Firebase config invalida.', error)
    return null
  }
}

const firebaseConfig = getFirebaseConfigFromSearch()

function getNotificationTargetUrl(data = {}) {
  const explicitUrl = String(data.url || data.link || '').trim()
  if (explicitUrl) return explicitUrl

  const type = String(data.type || '').trim()
  const orderId = String(data.orderId || '').trim()

  if (type === 'order_status_update') {
    return '/'
  }

  if (orderId) {
    return `/dashboard/orders?orderId=${encodeURIComponent(orderId)}`
  }

  return '/dashboard/orders'
}

if (firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.messagingSenderId) {
  firebase.initializeApp(firebaseConfig)

  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {}
    const notificationPayload = payload.notification || {}
    const orderId = String(data.orderId || '').trim()
    const orderNumber = orderId ? `#${orderId.slice(-4).toUpperCase()}` : '#----'
    const type = data.type || 'new_order'
    const isCustomerStatusUpdate = type === 'order_status_update'
    const isMerchantTest = type === 'merchant_test'
    console.info('[FCM SW] background message', {
      type,
      hasOrderId: Boolean(orderId),
      status: data.status || '',
    })
    const title = notificationPayload.title || (isCustomerStatusUpdate
      ? data.title || 'Pedido atualizado'
      : isMerchantTest
        ? data.title || 'Push ativado no PratoBy'
      : 'Novo pedido recebido')
    const options = {
      body: notificationPayload.body || (isCustomerStatusUpdate
        ? data.body || `Pedido ${orderNumber} foi atualizado.`
        : isMerchantTest
          ? data.body || 'Este dispositivo ja pode receber avisos de novos pedidos.'
          : 'Toque para abrir o painel de pedidos.'),
      icon: notificationPayload.icon || '/icons/android-chrome-192x192.png',
      badge: notificationPayload.badge || '/icons/android-chrome-192x192.png',
      tag: notificationPayload.tag || (isCustomerStatusUpdate
        ? `pratoby-order-status-${data.orderId || 'unknown'}-${data.status || 'updated'}`
        : isMerchantTest
          ? `pratoby-merchant-test-${data.storeId || 'store'}`
        : `pratoby-new-order-${data.orderId || 'unknown'}`),
      renotify: notificationPayload.renotify !== false,
      requireInteraction: notificationPayload.requireInteraction === true || type === 'new_order',
      data: {
        type,
        orderId: data.orderId || '',
        storeId: data.storeId || '',
        status: data.status || '',
        url: getNotificationTargetUrl(data),
      },
    }

    self.registration.showNotification(title, options)
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  let targetUrl = new URL('/dashboard/orders', self.location.origin)

  try {
    const notificationData = event.notification?.data || {}
    const fcmData = notificationData?.FCM_MSG?.data || {}
    const candidateTarget = notificationData.url || getNotificationTargetUrl(fcmData)
    const candidateUrl = new URL(candidateTarget || '/dashboard/orders', self.location.origin)

    if (
      candidateUrl.origin === self.location.origin &&
      ['http:', 'https:'].includes(candidateUrl.protocol)
    ) {
      targetUrl = candidateUrl
    }
  } catch {
    targetUrl = new URL('/dashboard/orders', self.location.origin)
  }

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of windowClients) {
      const clientUrl = new URL(client.url)
      if (clientUrl.origin === targetUrl.origin) {
        await client.focus()
        return client.navigate(targetUrl.href)
      }
    }

    return clients.openWindow(targetUrl.href)
  })())
})
