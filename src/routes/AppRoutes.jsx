import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import LoginPage from '../pages/auth/LoginPage'
import SignupPage from '../pages/auth/SignupPage'
import OnboardingPage from '../pages/auth/OnboardingPage'
import AuthActionPage from '../pages/auth/AuthActionPage'
import ScrollToTop from '../utils/ScrollToTop'

// Públicas
import AboutPage from '../pages/AboutPage'
import ContactPage from '../pages/ContactPage'
import LandingPage from "../pages/landing/LandingPage"
import NotFoundPage from '../pages/NotFoundPage'
import StoreFrontPage from '../pages/store/StoreFrontPage'
import OrderTrackingPage from '../pages/store/OrderTrackingPage'
import PlansPage from '../pages/PlansPage'
import ProfilePage from '../pages/merchant/ProfilePage'
import RestaurantExamplesPage from '../pages/RestaurantExamplesPage'
import PrivacyPage from '../pages/PrivacyPage'
import TermsPage from '../pages/TermsPage'

// Admin
import AdminLayout from '../components/layouts/AdminLayout'
import AdminDashboard from '../pages/admin/AdminDashboard'
import CreateStorePage from '../pages/admin/CreateStorePage'
import AdminSubscriptionsPage from '../pages/admin/AdminSubscriptionsPage'

// Lojista
import MerchantDashboard from '../pages/merchant/MerchantDashboard'
import OrdersPage from '../pages/merchant/OrdersPage'
import Statistics from '../pages/merchant/Statistics'
import Settings from '../pages/merchant/Settings'
import Reviews from '../pages/merchant/Reviews'
import MenuManagementPage from '../pages/merchant/menu/MenuManagementPage'
import { ComingSoon } from '../pages/merchant/ComingSoon'
import BillingPage from '../pages/merchant/BillingPage'
import SubscriptionManagementPage from '../pages/merchant/SubscriptionManagementPage'
import KitchenDisplayPage from '../pages/merchant/KitchenDisplayPage'
import CustomerDisplayPage from '../pages/merchant/CustomerDisplayPage'

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
    </>
  )
}
