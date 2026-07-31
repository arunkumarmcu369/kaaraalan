import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, className = '', id, type = 'text', ...props },
  ref
) {
  const inputId = id || props.name
  const isDate = type === 'date' || type === 'datetime-local' || type === 'time'
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm font-semibold text-ink/80">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${
          isDate
            ? 'date-input [color-scheme:light] scheme-light'
            : ''
        } ${error ? 'border-danger' : 'border-brand-200'}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  )
})

export default Input
