import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [liveEvent, setLiveEvent] = useState(null)
  const { isAdmin } = useAuth()
  const wsUrl = `${import.meta.env.VITE_WS_BASE_URL}/admin`

  useWebSocket(wsUrl, {
    enabled: isAdmin,
    onMessage: (msg) => setLiveEvent({ ...msg, _ts: Date.now() }),
  })

  return (
    <div className="flex min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenuOpen(true)} liveEvent={liveEvent} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet context={{ liveEvent }} />
        </main>
        {/* Mobile bottom nav */}
        <nav className="sticky bottom-0 z-20 flex justify-around border-t border-brand-100 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
          {/* Links rendered via Sidebar drawer; keep compact hint */}
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs font-bold text-brand-700"
            onClick={() => setMenuOpen(true)}
          >
            Menu
          </button>
        </nav>
      </div>
    </div>
  )
}
