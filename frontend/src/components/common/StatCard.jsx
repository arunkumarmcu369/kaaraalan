export default function StatCard({ label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'from-brand-600 to-brand-800',
    accent: 'from-accent to-orange-800',
    warn: 'from-amber-500 to-amber-700',
    sky: 'from-sky-500 to-sky-700',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-brand-100 backdrop-blur">
      <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${tones[tone]}`} />
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
