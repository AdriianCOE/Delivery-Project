import { getEffectivePlan, hasPlanFeature } from './planCatalog'

const PRATOBY_LOGO = '/icons/favicon-32x32.png'

export function getDisplayStoreName(storeData, userData, fallback = 'PratoBy') {
  return String(
    storeData?.storeName ||
      storeData?.name ||
      storeData?.displayName ||
      userData?.storeName ||
      userData?.signup?.storeName ||
      fallback
  ).trim()
}

export function getStoreLogoUrl(storeData) {
  return String(
    storeData?.logoUrl ||
      storeData?.logoURL ||
      storeData?.logo ||
      storeData?.avatarUrl ||
      storeData?.branding?.logoUrl ||
      storeData?.branding?.logoURL ||
      storeData?.settings?.logoUrl ||
      storeData?.settings?.logoURL ||
      ''
  ).trim()
}

export function getPlanId(storeData, userData) {
  return getEffectivePlan({ ...(userData || {}), ...(storeData || {}) }) || 'essential'
}

export function getMerchantDisplayLogoUrl(storeData, userData) {
  const storeLogoUrl = getStoreLogoUrl(storeData)
  const brandingData = { ...(userData || {}), ...(storeData || {}) }

  if (storeLogoUrl && hasPlanFeature(brandingData, 'customBranding')) return storeLogoUrl
  return PRATOBY_LOGO
}
