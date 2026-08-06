export default function QuantitySelector({ value = 0, onChange, min = 0, max = 999, className = '' }) {
  const qty = Number(value) || 0

  const set = (next) => {
    const n = Math.max(min, Math.min(max, Number.parseInt(String(next), 10) || 0))
    onChange?.(n)
  }

  return (
    <div className={`inline-flex items-center overflow-hidden rounded-lg ring-1 ring-brand-200 ${className}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        className="px-3 py-2 text-sm font-bold text-ink hover:bg-brand-50 disabled:opacity-40"
        disabled={qty <= min}
        onClick={() => set(qty - 1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        className="w-12 border-x border-brand-100 bg-white py-2 text-center text-sm font-bold tabular-nums text-ink outline-none"
        value={qty}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '')
          set(digits === '' ? 0 : digits)
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className="px-3 py-2 text-sm font-bold text-ink hover:bg-brand-50 disabled:opacity-40"
        disabled={qty >= max}
        onClick={() => set(qty + 1)}
      >
        +
      </button>
    </div>
  )
}
