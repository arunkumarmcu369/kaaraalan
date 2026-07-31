/**
 * Order-approved illustration (Heroicons / Lucide–style SVG).
 * Green checkmark + document — matches brand greens.
 */
export default function OrderApprovedIllustration({ className = '' }) {
  return (
    <div
      className={`mx-auto flex h-[140px] w-[140px] items-center justify-center sm:h-40 sm:w-40 ${className}`}
      role="img"
      aria-label="Order approved"
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <circle cx="80" cy="80" r="72" fill="#eef9f4" />
        <circle cx="80" cy="80" r="58" fill="#d5f0e4" opacity="0.7" />

        {/* Document */}
        <rect
          x="48"
          y="36"
          width="64"
          height="78"
          rx="8"
          fill="#ffffff"
          stroke="#21735a"
          strokeWidth="3"
        />
        <path d="M96 36v18a6 6 0 0 0 6 6h18" stroke="#21735a" strokeWidth="3" strokeLinejoin="round" />
        <path d="M96 36l24 24" stroke="#21735a" strokeWidth="3" strokeLinecap="round" />

        {/* Doc lines */}
        <rect x="60" y="58" width="32" height="5" rx="2.5" fill="#aee0cb" />
        <rect x="60" y="70" width="40" height="5" rx="2.5" fill="#aee0cb" />
        <rect x="60" y="82" width="24" height="5" rx="2.5" fill="#aee0cb" />

        {/* Success badge */}
        <circle cx="104" cy="112" r="28" fill="#2d8f6f" />
        <circle cx="104" cy="112" r="22" fill="#21735a" />
        <path
          d="M92 112.5l7 7 16-16"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
