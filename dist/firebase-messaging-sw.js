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

if (firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.messagingSenderId) {
  firebase.initializeApp(firebaseConfig)

  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {}
    const orderId = String(data.orderId || '').trim()
    const orderNumber = orderId ? `#${orderId.slice(-4).toUpperCase()}` : '#----'
    const title = 'Novo pedido recebido'
    const options = {
      body: `Pedido ${orderNumber} aguardando confirmacao`,
      icon: '/android-chrome-512x512.png',
      badge: '/favicon.png',
      tag: data.orderId ? `new-order-${data.orderId}` : 'new-order',
      renotify: true,
      data: {
        type: data.type || 'new_order',
        orderId: data.orderId || '',
        storeId: data.storeId || '',
        url: data.url || '/dashboard/orders',
      },
    }

    self.registration.showNotification(title, options)
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(event.notification?.data?.url || '/dashboard/orders', self.location.origin)

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
