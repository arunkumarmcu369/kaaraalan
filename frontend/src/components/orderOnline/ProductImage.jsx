import { resolveOrderOnlineImage } from '../../utils/orderOnlineImages'

export default function ProductImage({ imageKey, name, className = '' }) {
  const src = resolveOrderOnlineImage(imageKey)

  if (src) {
    return (
      <div className={`overflow-hidden bg-brand-50/60 ${className}`}>
        <img src={src} alt={name || ''} className="h-full w-full object-contain p-3" loading="lazy" />
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-brand-50 to-brand-100/40 text-brand-700 ${className}`}
      role="img"
      aria-label={`${name || 'Product'} image placeholder`}
    >
      <svg
        viewBox="0 0 48 72"
        className="h-20 w-auto opacity-70"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M18 6h12" strokeLinecap="round" />
        <path d="M20 6v4.5c0 1.2-.4 2.3-1.2 3.2L16 17.5A5 5 0 0 0 14.5 21v38A5 5 0 0 0 19.5 64h9A5 5 0 0 0 33.5 59V21c0-1.4-.5-2.7-1.5-3.7l-2.8-3.1A5 5 0 0 1 28 10.5V6" />
        <circle cx="24" cy="42" r="3.5" fill="currentColor" stroke="none" opacity="0.35" />
      </svg>
      <span className="px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
        Bottle image coming soon
      </span>
    </div>
  )
}
