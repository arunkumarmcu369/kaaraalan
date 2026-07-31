import { useEffect, useState } from 'react'
import { listNotifications, markNotificationsRead } from '../../api'
import Button from '../common/Button'
import { useAuth } from '../../hooks/useAuth'

export default function Topbar({ onMenu, liveEvent }) {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState([])
  const [unread, setUnread] = useState(0)

  const load = async () => {
    if (!isAdmin) return
    try {
      const data = await listNotifications({ page_size: 15 })
      setNotes(data.items || [])
      setUnread(data.unread_count || 0)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
  }, [isAdmin])

  useEffect(() => {
    if (liveEvent?.type === 'new_order') {
      setUnread((u) => u + 1)
      setNotes((prev) => [
        {
          id: `live-${Date.now()}`,
          type: 'new_order',
          message: liveEvent.message || `New order from ${liveEvent.dealer_name}`,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    }
  }, [liveEvent])

  const openBell = async () => {
    setOpen((o) => !o)
    if (!open && unread > 0) {
      try {
        await markNotificationsRead(null)
        setUnread(0)
        setNotes((prev) => prev.map((n) => ({ ...n, is_read: true })))
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/40 bg-white/50 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMenu} aria-label="Menu">
          ☰
        </Button>
        <div className="hidden sm:block">
          <p className="text-sm font-bold text-ink">Welcome, {user?.dealer_name || user?.username}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={openBell} aria-label="Notifications">
              🔔
              {unread > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">
                  {unread}
                </span>
              )}
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-brand-100">
                <div className="border-b border-brand-50 px-4 py-2 text-sm font-bold">Notifications</div>
                <ul className="max-h-72 overflow-y-auto">
                  {notes.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted">No notifications</li>
                  )}
                  {notes.map((n) => (
                    <li key={n.id} className="border-b border-brand-50 px-4 py-3 text-sm">
                      <p className="font-medium text-ink">{n.message}</p>
                      <p className="mt-1 text-xs text-muted">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </header>
  )
}
