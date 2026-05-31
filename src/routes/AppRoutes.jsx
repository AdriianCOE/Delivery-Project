import { lazy, Suspense } from 'react'
import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import ScrollToTop from '../utils/ScrollToTop'

// Públicas

// Admin
import AdminLayout from '../components/layouts/AdminLayout'

// Lojista
import { ComingSoon } from '../pages/merchant/ComingSoon'

// Layouts / Proteção
import ProtectedRoute from '../components/auth/ProtectedRoute'
import { GlobalOrderAlert } from '../components/merchant/GlobalOrderAlert'
import DashboardLayout from '../components/layouts/DashboardLayout'

// Ícones dos placeholders
import {
  FiCreditCard,
  FiDollarSign,
  FiGrid,
  FiLayers,
  FiMonitor,
  FiPieChart,
  FiTruck,
  FiUsers,
  FiZap,
  FiShoppingBag,
  FiSettings,
} from 'react-icons/fi'

const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const SignupPage = lazy(() => import('../pages/auth/SignupPage'))
const OnboardingPage = lazy(() => import('../pages/auth/OnboardingPage'))
const AuthActionPage = lazy(() => import('../pages/auth/AuthActionPage'))

const AboutPage = lazy(() => import('../pages/AboutPage'))
const ContactPage = lazy(() => import('../pages/ContactPage'))
const LandingPage = lazy(() => import('../pages/landing/LandingPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const StoreFrontPage = lazy(() => import('../pages/store/StoreFrontPage'))
const OrderTrackingPage = lazy(() => import('../pages/store/OrderTrackingPage'))
const PlansPage = lazy(() => import('../pages/PlansPage'))
const RestaurantExamplesPage = lazy(() => import('../pages/RestaurantExamplesPage'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'))
const TermsPage = lazy(() => import('../pages/TermsPage'))

const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const CreateStorePage = lazy(() => import('../pages/admin/CreateStorePage'))
const AdminSubscriptionsPage = lazy(() => import('../pages/admin/AdminSubscriptionsPage'))

const MerchantDashboard = lazy(() => import('../pages/merchant/MerchantDashboard'))
const OrdersPage = lazy(() => import('../pages/merchant/OrdersPage'))
const Statistics = lazy(() => import('../pages/merchant/Statistics'))
const Settings = lazy(() => import('../pages/merchant/Settings'))
const Reviews = lazy(() => import('../pages/merchant/Reviews'))
const MenuManagementPage = lazy(() => import('../pages/merchant/menu/MenuManagementPage'))
const BillingPage = lazy(() => import('../pages/merchant/BillingPage'))
const SubscriptionManagementPage = lazy(() => import('../pages/merchant/SubscriptionManagementPage'))
const ProfilePage = lazy(() => import('../pages/merchant/ProfilePage'))
const KitchenDisplayPage = lazy(() => import('../pages/merchant/KitchenDisplayPage'))
const CustomerDisplayPage = lazy(() => import('../pages/merchant/CustomerDisplayPage'))

function RouteFallback() {
  return (
    <div
      className="grid min-h-screen place-items-center bg-[#f9fafb] px-6 text-[#111827] transition-colors dark:bg-zinc-950 dark:text-zinc-50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-[16rem] flex-col items-center text-center">
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-orange-100 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="absolute inset-0 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15" />
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-orange-100 border-t-[#f97316] dark:border-zinc-700 dark:border-t-orange-400" />
        </div>

        <p className="mt-4 text-sm font-black text-[#111827] dark:text-zinc-100">
          PratoBy
        </p>
        <p className="mt-1 text-xs font-semibold text-[#6b7280] dark:text-zinc-400">
          Carregando...
        </p>
        <div className="mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-orange-100 dark:bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#f97316]" />
        </div>
        <span className="sr-only">
          Carregando...
        </span>
      </div>
    </div>
  )
}

function MerchantDashboardShell() {
  return (
    <>
      <GlobalOrderAlert />
      <DashboardLayout />
    </>
  )
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/auth/action" element={<AuthActionPage />} />
        <Route path="/sobre" element={<AboutPage />} />
        <Route path="/contato" element={<ContactPage />} />
        <Route path="/planos" element={<PlansPage />} />
        <Route path="/exemplos" element={<RestaurantExamplesPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/privacy" element={<Navigate to="/privacidade" replace />} />
        <Route path="/terms" element={<Navigate to="/termos" replace />} />

        {/* Página 404 manual */}
        <Route path="/404" element={<NotFoundPage />} />

        {/* Loja pública: formato antigo */}
        <Route path="/store/:slug" element={<StoreFrontPage />} />
        <Route path="/store/:slug/order/:orderId" element={<OrderTrackingPage />} />
        <Route path="/store/:slug/pedido/:orderId" element={<OrderTrackingPage />} />

        {/* Compatibilidade para links antigos/de tracking */}
        <Route path="/tracking/:orderId" element={<OrderTrackingPage />} />
        <Route path="/pedido/:orderId" element={<OrderTrackingPage />} />
        <Route path="/order/:orderId" element={<OrderTrackingPage />} />
        <Route path="/menu" element={<Navigate to="/dashboard/menu" replace />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'developer']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="stores" element={<AdminDashboard />} />
          <Route path="stores/new" element={<CreateStorePage />} />

          <Route
            path="orders"
            element={<ComingSoon title="Pedidos globais" icon={FiShoppingBag} />}
          />

          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />

          <Route
            path="users"
            element={<ComingSoon title="Usuários e permissões" icon={FiUsers} />}
          />

          <Route
            path="settings"
            element={<ComingSoon title="Configurações admin" icon={FiSettings} />}
          />

          <Route path="create-store" element={<Navigate to="/admin/stores/new" replace />} />
        </Route>

        {/* Dashboard do lojista */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['merchant', 'lojista', 'admin', 'developer']}>
              <MerchantDashboardShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<MerchantDashboard />} />

          <Route path="orders" element={<OrdersPage />} />
          <Route path="menu" element={<MenuManagementPage />} />
          <Route path="stats" element={<Statistics />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="settings" element={<Settings />} />

          <Route path="financeiro" element={<ComingSoon title="Financeiro" icon={FiDollarSign} />} />
          <Route path="qrcodes" element={<ComingSoon title="QR Codes" icon={FiGrid} />} />
          <Route path="users" element={<ComingSoon title="Clientes e CRM" icon={FiUsers} />} />
          <Route path="motobot" element={<ComingSoon title="MotoBot / Motoboys" icon={FiTruck} />} />
          <Route path="motoboy" element={<Navigate to="/dashboard/motobot" replace />} />

          <Route path="pix-automatico" element={<ComingSoon title="Pix automático" icon={FiCreditCard} />} />
          <Route path="relatorios" element={<ComingSoon title="Relatórios avançados" icon={FiPieChart} />} />
          <Route path="equipe" element={<ComingSoon title="Equipe e permissões" icon={FiLayers} />} />
          <Route path="automacoes" element={<ComingSoon title="Automações" icon={FiZap} />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="assinatura" element={<Navigate to="/dashboard/billing" replace />} />
          <Route path="subscription-management" element={<SubscriptionManagementPage />} />
          <Route path="gerenciar-assinatura" element={<Navigate to="/dashboard/subscription-management" replace />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* ── Telas de TV / KDS — fora do DashboardLayout (sem sidebar/topbar) ── */}
        <Route
          path="/dashboard/out-screen"
          element={
            <ProtectedRoute allowedRoles={['merchant', 'lojista', 'admin', 'developer']}>
              <KitchenDisplayPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/out-screen/customer"
          element={
            <ProtectedRoute allowedRoles={['merchant', 'lojista', 'admin', 'developer']}>
              <CustomerDisplayPage />
            </ProtectedRoute>
          }
        />

        {/* Compatibilidade com URLs antigas */}
        <Route path="/orders" element={<Navigate to="/dashboard/orders" replace />} />
        <Route path="/Statistics" element={<Navigate to="/dashboard/stats" replace />} />
        <Route path="/statistics" element={<Navigate to="/dashboard/stats" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/Reviews" element={<Navigate to="/dashboard/reviews" replace />} />
        <Route path="/reviews" element={<Navigate to="/dashboard/reviews" replace />} />
        <Route path="/menu" element={<Navigate to="/dashboard/menu" replace />} />
        <Route path="/qrcodes" element={<Navigate to="/dashboard/qrcodes" replace />} />
        <Route path="/users" element={<Navigate to="/dashboard/users" replace />} />
        <Route path="/out-screen" element={<Navigate to="/dashboard/out-screen" replace />} />
        <Route path="/motoboy" element={<Navigate to="/dashboard/motobot" replace />} />

        {/* Loja pública: formato principal do PratoBy */}
        <Route path="/:slug/pedido/:orderId" element={<OrderTrackingPage />} />
        <Route path="/:slug/order/:orderId" element={<OrderTrackingPage />} />
        <Route path="/:slug" element={<StoreFrontPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
