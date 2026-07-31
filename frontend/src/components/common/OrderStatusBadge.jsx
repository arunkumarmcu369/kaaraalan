const styles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-800',
  rejected: 'bg-red-100 text-red-800',
  fulfilled: 'bg-sky-100 text-sky-800',
  default: 'bg-brand-50 text-brand-700',
}

/** Format order status; rejected shows REJECTED (reason). */
export function formatOrderStatus(status, rejectionReason) {
  const s = String(status || '').toLowerCase()
  if (s === 'rejected') {
    const reason = String(rejectionReason || '').trim()
    return reason ? `REJECTED (${reason})` : 'REJECTED'
  }
  return String(status || '').toUpperCase()
}

export default function OrderStatusBadge({ status, rejectionReason, className = '' }) {
  const label = formatOrderStatus(status, rejectionReason)
  const tone = String(status || '').toLowerCase()
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-bold tracking-wide ${styles[tone] || styles.default} ${className}`}
      style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
    >
      {label}
    </span>
  )
}
