const PRATOBY_LOGO = '/icons/icon-192.png'

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
  const plan = String(
    storeData?.effectivePlan ||
      userData?.effectivePlan ||
      storeData?.billingPlan ||
      storeData?.selectedPlan ||
      storeData?.plan ||
      storeData?.planId ||
      userData?.billingPlan ||
      userData?.selectedPlan ||
      userData?.plan ||
      userData?.planId ||
      'essential'
  ).toLowerCase().trim()

  if (plan === 'premium') return 'premium'
  if (plan === 'professional' || plan === 'profissional' || plan === 'plus') {
    return 'professional'
  }
  return 'essential'
}

export function getMerchantDisplayLogoUrl(storeData, userData) {
  const storeLogoUrl = getStoreLogoUrl(storeData)
  const plan = getPlanId(storeData, userData)

  if (plan === 'premium' && storeLogoUrl) return storeLogoUrl
  return PRATOBY_LOGO
}
