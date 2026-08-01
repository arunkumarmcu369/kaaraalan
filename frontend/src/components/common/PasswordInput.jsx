import { forwardRef, useState } from 'react'

function EyeClosedIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6a2 2 0 002.8 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.1 6.1C4.4 7.4 3.2 9 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EyeOpenIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const PasswordInput = forwardRef(function PasswordInput(
  { label, error, className = '', id, ...props },
  ref
) {
  const [visible, setVisible] = useState(false)
  const inputId = id || props.name

  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm font-semibold text-ink/80">{label}</span>}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
            error ? 'border-danger' : 'border-brand-200'
          }`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="interactive-text absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  )
})

export default PasswordInput
