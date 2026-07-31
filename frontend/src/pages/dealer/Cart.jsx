import { Navigate } from 'react-router-dom'

/** Cart flow is replaced by the Flavour | Glass | PET order table on Stock. */
export default function DealerCart() {
  return <Navigate to="/dashboard/stock" replace />
}
