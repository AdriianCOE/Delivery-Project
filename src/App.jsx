import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { DashboardThemeProvider } from './contexts/DashboardThemeContext'
import CookieConsent from './components/privacy/CookieConsent'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <DashboardThemeProvider>
          <AppRoutes />
          <CookieConsent />
        </DashboardThemeProvider>
      </CartProvider>
    </AuthProvider>
  )
}