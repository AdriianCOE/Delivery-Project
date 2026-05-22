export function uniqueArray(values) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
}

export function getStoreDocId(store) {
  return String(store?.id || store?.docId || store?.storeId || '').trim()
}

export function getStorePublicSlug(store) {
  return String(store?.storeSlug || store?.slug || '').trim()
}

export function getStoreKeys(store) {
  const storeId = getStoreDocId(store)
  const storeSlug = getStorePublicSlug(store)

  return uniqueArray([
    storeId,
    storeSlug,
    store?.storeId,
    store?.docId,
    store?.id,
    store?.slug,
    store?.storeSlug,
    ...(Array.isArray(store?.storeKeys) ? store.storeKeys : []),
  ])
}

export function buildStoreScopedPayload(store) {
  const storeId = getStoreDocId(store)
  const storeSlug = getStorePublicSlug(store)

  return {
    storeId,
    storeSlug,
    storeKeys: uniqueArray([storeId, storeSlug]),
  }
}
