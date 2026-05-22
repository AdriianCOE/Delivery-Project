import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FiShield } from 'react-icons/fi'
import { useAuth } from '../../contexts/AuthContext'

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase()

  if (normalized === 'lojista') return 'merchant'
  if (normalized === 'dev') return 'developer'

  return normalized
}

function getFallbackRouteByRole(role) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'admin' || normalizedRole === 'developer') {
    return '/admin'
  }

  if (normalizedRole === 'merchant') {
    return '/dashboard'
  }

  return '/'
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#F97316] text-white shadow-xl shadow-orange-600/20">
          <FiShield size={28} />
        </div>

        <div className="mt-5">
          <p className="text-lg font-black tracking-tight text-[#111827]">
            PratoBy
          </p>

          <p className="mt-1 text-sm font-medium text-[#6B7280]">
            Verificando seu acesso...
          </p>
        </div>

        <div className="mx-auto mt-5 h-2 w-40 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#F97316]" />
        </div>
      </div>
    </div>
  )
}

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectTo = '/login',
  unauthorizedTo,
}) {
  const auth = useAuth()
  const location = useLocation()

  const isLoading =
    auth?.loading === true ||
    auth?.authLoading === true ||
    auth?.isLoading === true

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!auth?.user) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location }}
      />
    )
  }

  // Redirect pending merchants to onboarding (never blocks admin/developer/active merchants)
  if (auth?.role === 'merchant') {
    const onboardingStatus =
      auth?.userData?.onboardingStatus ||
      auth?.user?.onboardingStatus ||
      ''

    const subscriptionStatus =
      auth?.userData?.subscriptionStatus ||
      auth?.user?.subscriptionStatus ||
      ''

    const hasMerchantStore =
      Boolean(auth?.storeId || auth?.userData?.storeId || auth?.user?.storeId) ||
      (Array.isArray(auth?.storeIds) && auth.storeIds.length > 0) ||
      (Array.isArray(auth?.userData?.storeIds) && auth.userData.storeIds.length > 0) ||
      (Array.isArray(auth?.user?.storeIds) && auth.user.storeIds.length > 0)

      const isPendingMerchant =
      !hasMerchantStore ||
      ['phone_pending'].includes(onboardingStatus) ||
      ['pending_checkout'].includes(subscriptionStatus)

    if (isPendingMerchant && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />
    }
  }

  const hasRoleRestriction =
    Array.isArray(allowedRoles) && allowedRoles.length > 0;

  if (hasRoleRestriction && !auth.hasRole(allowedRoles)) {
    const fallbackRoute = unauthorizedTo || getFallbackRouteByRole(auth.role);
    const isSameRoute = fallbackRoute === location.pathname;
    return (
      <Navigate
        to={isSameRoute ? '/' : fallbackRoute}
        replace
      />
    );
  }

  return children || <Outlet />
}


