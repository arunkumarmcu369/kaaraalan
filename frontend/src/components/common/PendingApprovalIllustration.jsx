/**
 * Pending-approval illustration (Heroicons / Lucide–style SVG).
 * Communicates: order submitted, waiting for admin review.
 */
export default function PendingApprovalIllustration({ className = '' }) {
  return (
    <div
      className={`mx-auto flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40 ${className}`}
      role="img"
      aria-label="Order pending admin approval"
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Soft brand wash */}
        <circle cx="80" cy="80" r="72" fill="#eef9f4" />
        <circle cx="80" cy="80" r="58" fill="#d5f0e4" opacity="0.65" />

        {/* Clipboard body */}
        <rect
          x="46"
          y="38"
          width="68"
          height="86"
          rx="10"
          fill="#ffffff"
          stroke="#21735a"
          strokeWidth="3"
        />
        {/* Clipboard clip */}
        <rect x="64" y="28" width="32" height="16" rx="5" fill="#2d8f6f" />
        <rect x="70" y="32" width="20" height="8" rx="3" fill="#eef9f4" />

        {/* Checklist lines */}
        <rect x="58" y="58" width="36" height="6" rx="3" fill="#aee0cb" />
        <rect x="58" y="72" width="44" height="6" rx="3" fill="#aee0cb" />
        <rect x="58" y="86" width="28" height="6" rx="3" fill="#aee0cb" />

        {/* Pending clock badge (amber + brand) */}
        <circle cx="108" cy="108" r="26" fill="#fef3c7" stroke="#f59e0b" strokeWidth="3" />
        <circle cx="108" cy="108" r="18" fill="#ffffff" stroke="#d97706" strokeWidth="2.5" />
        {/* Clock hands */}
        <path
          d="M108 98v12l8 5"
          stroke="#21735a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="108" cy="108" r="2.5" fill="#21735a" />

        {/* Small check accent — submitted */}
        <circle cx="52" cy="108" r="12" fill="#2d8f6f" />
        <path
          d="M46.5 108.5l3.5 3.5 7.5-8"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
