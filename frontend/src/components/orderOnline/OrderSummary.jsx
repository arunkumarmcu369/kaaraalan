import { formatInr } from '../../constants/orderOnlineProducts'

const METHOD_LABELS = {
  cod: 'Cash on Delivery',
  online: 'Online Payment',
}

const GATEWAY_LABELS = {
  razorpay: 'Razorpay',
  phonepe: 'PhonePe',
  upi: 'UPI',
}

export default function OrderSummary({
  items = [],
  customer,
  paymentMethod,
  paymentGateway,
  total = 0,
}) {
  const paymentLabel =
    paymentMethod === 'online'
      ? `${METHOD_LABELS.online}${paymentGateway ? ` (${GATEWAY_LABELS[paymentGateway] || paymentGateway})` : ''}`
      : METHOD_LABELS[paymentMethod] || '—'

  const addressLines = [
    customer?.address,
    [customer?.village, customer?.district].filter(Boolean).join(', '),
    customer?.pincode ? `PIN ${customer.pincode}` : '',
    customer?.mobile ? `Mobile: ${customer.mobile}` : '',
  ].filter(Boolean)

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <h2 className="text-lg font-extrabold text-ink">Order Summary</h2>

      {!items.length ? (
        <p className="mt-3 text-sm text-muted">No products selected.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-brand-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-50/80 text-xs font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Flavour</th>
                <th className="px-3 py-2">Bottle Size</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {items.map((item) => (
                <tr key={item.key || `${item.productId}-${item.variantId}`}>
                  <td className="px-3 py-2 font-semibold text-ink">Kaaraalan PET</td>
                  <td className="px-3 py-2 font-semibold text-ink">
                    {item.flavour || item.productName}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {item.sizeLabel || item.variantLabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {formatInr(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-t border-brand-100 pt-3">
          <dt className="font-semibold text-muted">Grand Total</dt>
          <dd className="text-lg font-extrabold tabular-nums text-brand-700">{formatInr(total)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Customer</dt>
          <dd className="mt-1 font-semibold text-ink">{customer?.customerName || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Delivery Address</dt>
          <dd className="mt-1 whitespace-pre-line font-medium text-ink">
            {addressLines.length ? addressLines.join('\n') : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Payment Method</dt>
          <dd className="mt-1 font-semibold text-ink">{paymentLabel}</dd>
        </div>
      </dl>
    </section>
  )
}
