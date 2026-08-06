import { Link } from 'react-router-dom'
import BrandLogo from '../common/BrandLogo'
import Button from '../common/Button'
import { formatInr } from '../../constants/orderOnlineProducts'

export default function OrderSuccess({ order, onShopAgain }) {
  if (!order) return null

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 text-center">
      <BrandLogo size="lg" className="mx-auto block" />
      <div className="mt-8 w-full rounded-2xl bg-brand-50/80 p-6 ring-1 ring-brand-100 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-brand-800 sm:text-3xl">
          Your order has been placed successfully.
        </h1>
        <p className="mt-3 text-sm text-muted">Thank you for ordering Kaaraalan Goli Soda.</p>
        <p className="mt-5 rounded-xl bg-white px-4 py-3 font-mono text-sm font-bold text-ink ring-1 ring-brand-100">
          Order ID: {order.orderId}
        </p>
        <p className="mt-3 text-base font-extrabold tabular-nums text-brand-700">
          Total: {formatInr(order.total)}
        </p>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={onShopAgain}>
          Order again
        </Button>
        <Link to="/">
          <Button type="button" size="lg" variant="secondary">
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  )
}
