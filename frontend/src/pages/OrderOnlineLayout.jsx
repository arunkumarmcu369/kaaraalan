import { Outlet } from 'react-router-dom'
import { OrderOnlineCartProvider } from '../context/OrderOnlineCartContext'

export default function OrderOnlineLayout() {
  return (
    <OrderOnlineCartProvider>
      <Outlet />
    </OrderOnlineCartProvider>
  )
}
