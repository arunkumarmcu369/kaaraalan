const GATEWAYS = [
  {
    id: 'razorpay',
    label: 'Razorpay',
    hint: 'Cards, UPI, net banking — integrate with Razorpay Checkout later',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    hint: 'PhonePe Business / PG — wire SDK when credentials are ready',
  },
  {
    id: 'upi',
    label: 'UPI',
    hint: 'Direct UPI intent / collect — placeholder for VPA flow',
  },
]

export default function PaymentSection({
  method,
  gateway,
  onMethodChange,
  onGatewayChange,
  error,
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <h2 className="text-lg font-extrabold text-ink">Payment</h2>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-brand-100 hover:bg-brand-50/50">
          <input
            type="radio"
            name="paymentMethod"
            className="mt-1"
            checked={method === 'cod'}
            onChange={() => onMethodChange?.('cod')}
          />
          <span>
            <span className="block font-bold text-ink">Cash on Delivery</span>
            <span className="text-sm text-muted">Pay when your order arrives.</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-brand-100 hover:bg-brand-50/50">
          <input
            type="radio"
            name="paymentMethod"
            className="mt-1"
            checked={method === 'online'}
            onChange={() => onMethodChange?.('online')}
          />
          <span>
            <span className="block font-bold text-ink">Online Payment</span>
            <span className="text-sm text-muted">Pay securely via gateway (coming soon).</span>
          </span>
        </label>
      </div>

      {method === 'online' && (
        <div className="mt-4 rounded-xl bg-sky-50/80 p-4 ring-1 ring-sky-100">
          <p className="text-sm font-bold uppercase tracking-wide text-sky-900">
            Payment gateway
          </p>
          <p className="mt-1 text-xs text-muted">
            No credentials are configured. Choose a provider for the UI placeholder — integrate
            Razorpay / PhonePe / UPI later via environment variables.
          </p>
          <div className="mt-3 space-y-2">
            {GATEWAYS.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/80 p-3 ring-1 ring-sky-100"
              >
                <input
                  type="radio"
                  name="paymentGateway"
                  className="mt-1"
                  checked={gateway === g.id}
                  onChange={() => onGatewayChange?.(g.id)}
                />
                <span>
                  <span className="block font-bold text-ink">{g.label}</span>
                  <span className="text-xs text-muted">{g.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-sky-300 bg-white/60 px-3 py-4 text-center text-sm text-muted">
            Payment SDK mount point —{' '}
            <code className="text-xs font-semibold text-ink">
              VITE_RAZORPAY_KEY_ID / VITE_PHONEPE_* / UPI
            </code>
          </div>
        </div>
      )}
    </section>
  )
}
