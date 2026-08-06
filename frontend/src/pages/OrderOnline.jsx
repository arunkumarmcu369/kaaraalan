import { Link } from 'react-router-dom'
import BrandLogo from '../components/common/BrandLogo'
import ProductGrid from '../components/orderOnline/ProductGrid'
import { useOrderOnlineCart } from '../context/OrderOnlineCartContext'

export default function OrderOnline() {
  const { addItem, itemCount } = useOrderOnlineCart()

  return (
    <div className="min-h-dvh bg-[#f7faf8]">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Back
          </Link>
          <Link
            to="/order-online/cart"
            className="relative inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100"
          >
            Cart
            {itemCount > 0 && (
              <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 pb-8 pt-2 sm:px-6 lg:px-8">
          <BrandLogo size="lg" className="mx-auto block" />
          <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight text-brand-800 sm:text-4xl">
            Order Online
          </h1>
          <p className="mt-2 max-w-xl text-center text-base text-muted">
            Select your favourite flavours and place your order.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProductGrid onAddToCart={addItem} />
      </div>
    </div>
  )
}
