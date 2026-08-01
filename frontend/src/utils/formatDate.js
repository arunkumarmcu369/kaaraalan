/** Shared date/time formatting for the admin & dealer portals. */
const DATE_OPTS = { day: '2-digit', month: '2-digit', year: 'numeric' }
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }

export function formatDate(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  // Always DD/MM/YYYY
  return d.toLocaleDateString('en-GB', DATE_OPTS)
}

export function formatTime(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', TIME_OPTS)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(d)} ${formatTime(d)}`
}
