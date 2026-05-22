import { FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'

import { auth } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import ProfilePanel from '../../components/merchant/ProfilePanel'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      if (typeof logout === 'function') {
        await logout()
      } else {
        await signOut(auth)
      }
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] pb-20 text-[#111827]">
      <DashboardPageHeader
        title="Perfil"
        description="Gerencie sua conta e segurança"
        icon={FiUser}
        maxWidth="max-w-4xl"
      />

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ProfilePanel onLogout={handleLogout} />
      </div>
    </main>
  )
}