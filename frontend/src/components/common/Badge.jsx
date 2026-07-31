const styles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-800',
  rejected: 'bg-red-100 text-red-800',
  fulfilled: 'bg-sky-100 text-sky-800',
  active: 'bg-brand-100 text-brand-800',
  inactive: 'bg-slate-100 text-slate-600',
  glass: 'bg-cyan-100 text-cyan-800',
  plastic: 'bg-violet-100 text-violet-800',
  low: 'bg-orange-100 text-orange-800',
  default: 'bg-brand-50 text-brand-700',
}

export default function Badge({ children, tone = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${styles[tone] || styles.default} ${className}`}
    >
      {children}
    </span>
  )
}
