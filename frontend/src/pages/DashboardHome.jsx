import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminDashboard from './admin/Dashboard'
import DealerDashboard from './dealer/Dashboard'
import Spinner from '../components/common/Spinner'

export default function DashboardHome() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return isAdmin ? <AdminDashboard /> : <DealerDashboard />
}
