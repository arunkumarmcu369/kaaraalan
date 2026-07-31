import { forwardRef } from 'react'

const Select = forwardRef(function Select(
  { label, error, options = [], className = '', placeholder, id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm font-semibold text-ink/80">{label}</span>}
      <select
        ref={ref}
        id={inputId}
        className={`w-full rounded-lg border bg-white/90 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-300 ${
          error ? 'border-danger' : 'border-brand-200'
        }`}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  )
})

export default Select
