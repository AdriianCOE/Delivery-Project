import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import CookieConsent from './components/privacy/CookieConsent'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
        <CookieConsent />
      </CartProvider>
    </AuthProvider>
  )
}