import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/common/BrandLogo'
import Button from '../components/common/Button'
import QuantitySelector from '../components/orderOnline/QuantitySelector'
import { useOrderOnlineCart } from '../context/OrderOnlineCartContext'
import { formatInr } from '../constants/orderOnlineProducts'

export default function OrderOnlineCart() {
  const navigate = useNavigate()
  const { items, subtotal, updateQty, removeItem, itemCount } = useOrderOnlineCart()

  return (
    <div className="min-h-dvh bg-[#f7faf8]">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/order-online" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Continue shopping
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-6">
          <BrandLogo size="md" className="mx-auto block" />
          <h1 className="mt-4 text-2xl font-extrabold text-brand-800">Shopping Cart</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {!items.length ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
            <p className="text-muted">Your cart is empty.</p>
            <Link to="/order-online" className="mt-4 inline-block">
              <Button type="button">Browse flavours</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-ink">{item.productName}</p>
                      <p className="text-sm font-semibold text-muted">
                        {item.sizeLabel || item.variantLabel}
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-brand-700">
                        {formatInr(item.price)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-bold text-danger hover:underline"
                      onClick={() => removeItem(item.key)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <QuantitySelector
                      value={item.quantity}
                      min={1}
                      onChange={(n) => updateQty(item.key, n)}
                    />
                    <p className="text-base font-extrabold tabular-nums text-ink">
                      {formatInr(item.price * item.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-muted">Items</span>
                <span className="font-bold">{itemCount}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-base font-extrabold text-ink">Total</span>
                <span className="text-base font-extrabold tabular-nums text-brand-700">
                  {formatInr(subtotal)}
                </span>
              </div>
              <Button
                type="button"
                size="lg"
                className="mt-5 w-full py-3.5 text-base"
                onClick={() => navigate('/order-online/checkout', { state: { mode: 'cart' } })}
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
