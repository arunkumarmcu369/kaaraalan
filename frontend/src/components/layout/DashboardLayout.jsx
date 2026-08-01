import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [liveEvent, setLiveEvent] = useState(null)
  const { isAdmin, isDealer, user } = useAuth()
  const wsUrl = `${import.meta.env.VITE_WS_BASE_URL}/${isAdmin ? 'admin' : 'dealer'}`

  useWebSocket(wsUrl, {
    enabled: !!user && !user.must_reset_password && (isAdmin || isDealer),
    onMessage: (msg) => setLiveEvent({ ...msg, _ts: Date.now() }),
  })

  const mobileLinks = isAdmin
    ? [
        { to: '/dashboard', label: 'Home', end: true },
        { to: '/dashboard/orders', label: 'Orders' },
        { to: '/dashboard/stocks', label: 'Stocks' },
        { to: '/dashboard/batch-required', label: 'Batch' },
      ]
    : [
        { to: '/dashboard', label: 'Home', end: true },
        { to: '/dashboard/stock', label: 'Order' },
        { to: '/dashboard/orders', label: 'Orders' },
      ]

  const linkClass = ({ isActive }) =>
    `flex flex-1 flex-col items-center rounded-lg px-2 py-2 text-[11px] font-bold ${
      isActive ? 'bg-brand-100 text-brand-800' : 'text-ink/70 hover:bg-brand-50'
    }`

  return (
    <div className="flex min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} liveEvent={liveEvent} />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
          <Outlet context={{ liveEvent }} />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-brand-100 bg-white/95 px-2 py-1.5 backdrop-blur lg:hidden">
          {mobileLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <button
            type="button"
            className="flex flex-1 flex-col items-center rounded-lg px-2 py-2 text-[11px] font-bold text-ink/70 hover:bg-brand-50"
            onClick={() => setMenuOpen(true)}
          >
            More
          </button>
        </nav>
      </div>
    </div>
  )
}
