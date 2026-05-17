export function getOrderInternalId(order, fallbackId = '') {
  return (
    order?.firestoreId ||
    order?.docId ||
    order?._docId ||
    fallbackId ||
    order?.id ||
    ''
  )
}

export function getOrderShortCode(order, fallbackId = '') {
  const internalId = String(getOrderInternalId(order, fallbackId) || '').trim()

  if (internalId) {
    return internalId.slice(-4).toUpperCase()
  }

  return '----'
}

export function getOrderDisplayNumber(order, fallbackId = '') {
  return `#${getOrderShortCode(order, fallbackId)}`
}

