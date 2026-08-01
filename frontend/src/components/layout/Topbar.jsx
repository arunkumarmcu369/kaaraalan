import { useEffect, useRef, useState } from 'react'
import { listNotifications, markNotificationsRead } from '../../api'
import Button from '../common/Button'
import { useAuth } from '../../hooks/useAuth'
import { formatDealerName } from '../../utils/formatDealerName'

export default function Topbar({ onMenu, liveEvent }) {
  const { user, logout, isAdmin, isDealer } = useAuth()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)
  const showBell = isAdmin || isDealer

  const load = async () => {
    if (!showBell) return
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
  }, [showBell, user?.id])

  useEffect(() => {
    if (!liveEvent) return
    if (liveEvent.type === 'new_order' || liveEvent.type === 'order_updated') {
      setUnread((u) => u + 1)
      setNotes((prev) => [
        {
          id: `live-${Date.now()}`,
          type: liveEvent.type,
          message:
            liveEvent.message ||
            (liveEvent.type === 'new_order'
              ? `New order from ${formatDealerName(liveEvent.dealer_name)}`
              : `Order ${liveEvent.order_number} → ${liveEvent.status}`),
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    }
  }, [liveEvent])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleBell = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
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
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">
            Welcome, {formatDealerName(user?.dealer_name) !== '—' ? formatDealerName(user?.dealer_name) : user?.username}
          </p>
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700 sm:block">
            Kaaraalan Goli Soda
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showBell && (
          <div className="relative" ref={panelRef}>
            <Button variant="secondary" size="sm" onClick={toggleBell} aria-label="Notifications" aria-expanded={open}>
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
