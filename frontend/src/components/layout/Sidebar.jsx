import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/batch-required', label: 'Batch Required' },
  { to: '/dashboard/products', label: 'Products' },
  { to: '/dashboard/dealers', label: 'Dealers' },
  { to: '/dashboard/stocks', label: 'Stocks' },
]

const dealerLinks = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/stock', label: 'Place Order' },
  { to: '/dashboard/orders', label: 'Orders' },
]

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth()
  const links = isAdmin ? adminLinks : dealerLinks

  const linkClass = ({ isActive }) =>
    `block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      isActive
        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
        : 'text-ink/80 hover:bg-white/55'
    }`

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,86vw)] flex-col border-r border-white/40 bg-white/45 p-4 shadow-xl backdrop-blur-xl transition-transform lg:static lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="glass-panel mb-6 rounded-2xl px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700">
            Kaaraalan
          </p>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Goli Soda</h1>
          <p className="mt-1 text-xs capitalize text-muted">{user?.role} portal</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={onClose}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
