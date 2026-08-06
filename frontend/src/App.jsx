import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import { ProtectedRoute, RoleBasedRoute } from './routes/ProtectedRoute'
import AuthLayout from './components/layout/AuthLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import Landing from './pages/Landing'
import OrderOnlineLayout from './pages/OrderOnlineLayout'
import OrderOnline from './pages/OrderOnline'
import OrderOnlineCart from './pages/OrderOnlineCart'
import OrderOnlineCheckout from './pages/OrderOnlineCheckout'
import Login from './pages/auth/Login'
import ChangePassword from './pages/auth/ChangePassword'
import DashboardHome from './pages/DashboardHome'
import AdminOrders from './pages/admin/Orders'
import AdminProducts from './pages/admin/Products'
import AdminDealers from './pages/admin/Dealers'
import AdminStocks from './pages/admin/Stocks'
import AdminBatchRequired from './pages/admin/BatchRequired'
import AdminEmptyCrates from './pages/admin/EmptyCrates'
import AdminReports from './pages/admin/Reports'
import DealerStock from './pages/dealer/Stock'
import DealerOrderHistory from './pages/dealer/OrderHistory'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function OrdersPage() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminOrders /> : <DealerOrderHistory />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/order-online" element={<OrderOnlineLayout />}>
              <Route index element={<OrderOnline />} />
              <Route path="cart" element={<OrderOnlineCart />} />
              <Route path="checkout" element={<OrderOnlineCheckout />} />
            </Route>

            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />

              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/dashboard/orders" element={<OrdersPage />} />

                <Route element={<RoleBasedRoute role="admin" />}>
                  <Route path="/dashboard/products" element={<AdminProducts />} />
                  <Route path="/dashboard/dealers" element={<AdminDealers />} />
                  <Route path="/dashboard/stocks" element={<AdminStocks />} />
                  <Route path="/dashboard/batch-required" element={<AdminBatchRequired />} />
                  <Route path="/dashboard/empty-crates" element={<AdminEmptyCrates />} />
                  <Route path="/dashboard/reports" element={<AdminReports />} />
                </Route>

                <Route element={<RoleBasedRoute role="dealer" />}>
                  <Route path="/dashboard/stock" element={<DealerStock />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
