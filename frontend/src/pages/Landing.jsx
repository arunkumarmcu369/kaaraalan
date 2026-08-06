import { Link } from 'react-router-dom'
import BrandLogo from '../components/common/BrandLogo'

function DealerIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function BottleIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Minimal goli / Codd-neck bottle */}
      <path d="M10 2.75h4" />
      <path d="M10.75 2.75v2.1c0 .55-.22 1.08-.6 1.47L9.5 7.1A2.75 2.75 0 0 0 8.75 9v10.5A1.75 1.75 0 0 0 10.5 21.25h3A1.75 1.75 0 0 0 15.25 19.5V9c0-.7-.26-1.37-.73-1.9l-.65-.78a2.1 2.1 0 0 1-.62-1.47V2.75" />
      <path d="M9 11.5h6" />
      {/* Soft sparkle */}
      <path d="M18.25 5.25v2.5M17 6.5h2.5" />
      <circle cx="12" cy="15.75" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

const choices = [
  {
    to: '/login',
    title: 'Dealer Login',
    description: 'Existing dealers can log in to place and manage orders.',
    Icon: DealerIcon,
    accent: {
      ring: 'ring-brand-200',
      iconBg: 'bg-brand-100 text-brand-700',
      title: 'text-brand-800',
      hover: 'hover:ring-brand-400 hover:shadow-brand-600/15',
      glow: 'from-brand-50 to-white',
    },
  },
  {
    to: '/order-online',
    title: 'Order Online',
    description: 'Place your Kaaraalan Goli Soda orders online.',
    Icon: BottleIcon,
    accent: {
      ring: 'ring-sky-200',
      iconBg: 'text-[#E53935]',
      iconBgStyle: { backgroundColor: '#FDECEC' },
      title: 'text-sky-900',
      hover: 'hover:ring-sky-400 hover:shadow-sky-600/15',
      glow: 'from-sky-50 to-white',
    },
  },
]

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-white px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center">
        <BrandLogo size="lg" className="mx-auto block" />
        <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight text-brand-800 sm:text-3xl">
          Welcome
        </h1>
        <p className="mt-2 text-center text-base text-muted sm:text-lg">
          Choose how you&apos;d like to continue
        </p>

        <div className="mt-10 grid w-full gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
          {choices.map(({ to, title, description, Icon, accent }) => (
            <Link
              key={to}
              to={to}
              className={`group relative flex flex-col rounded-2xl bg-gradient-to-b p-6 ring-1 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-xl sm:p-7 ${accent.glow} ${accent.ring} ${accent.hover}`}
            >
              <span
                className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-105 ${accent.iconBg}`}
                style={accent.iconBgStyle}
              >
                <Icon className="h-7 w-7" />
              </span>
              <h2 className={`text-xl font-extrabold tracking-tight ${accent.title}`}>{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
              <span className="mt-5 text-sm font-bold text-ink/70 transition group-hover:text-ink">
                Continue →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
