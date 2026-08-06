import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/common/BrandLogo'
import Button from '../components/common/Button'
import CustomerDetailsForm, {
  EMPTY_CUSTOMER,
  validateCustomer,
} from '../components/orderOnline/CustomerDetailsForm'
import PaymentSection from '../components/orderOnline/PaymentSection'
import OrderSummary from '../components/orderOnline/OrderSummary'
import OrderSuccess from '../components/orderOnline/OrderSuccess'
import { useOrderOnlineCart } from '../context/OrderOnlineCartContext'
import { formatInr } from '../constants/orderOnlineProducts'

function generateOrderId() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `WEB-${y}${m}${d}-${seq}`
}

export default function OrderOnlineCheckout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { items: cartItems, clearCart } = useOrderOnlineCart()

  const mode = location.state?.mode || 'cart'
  const buyNowItems = location.state?.items || []

  const checkoutItems = useMemo(() => {
    if (mode === 'buyNow' && buyNowItems.length) return buyNowItems
    return cartItems
  }, [mode, buyNowItems, cartItems])

  const total = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [checkoutItems]
  )

  const [customer, setCustomer] = useState(EMPTY_CUSTOMER)
  const [customerErrors, setCustomerErrors] = useState({})
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentGateway, setPaymentGateway] = useState('razorpay')
  const [paymentError, setPaymentError] = useState('')
  const [formError, setFormError] = useState('')
  const [placedOrder, setPlacedOrder] = useState(null)

  if (!checkoutItems.length && !placedOrder) {
    return <Navigate to="/order-online" replace />
  }

  const placeOrder = (e) => {
    e.preventDefault()
    setFormError('')
    setPaymentError('')

    const errors = validateCustomer(customer)
    setCustomerErrors(errors)
    if (Object.keys(errors).length) {
      setFormError('Please complete all customer details.')
      return
    }
    if (!paymentMethod) {
      setPaymentError('Select a payment method.')
      return
    }
    if (paymentMethod === 'online' && !paymentGateway) {
      setPaymentError('Select a payment gateway.')
      return
    }

    const order = {
      orderId: generateOrderId(),
      items: checkoutItems,
      customer: { ...customer },
      paymentMethod,
      paymentGateway: paymentMethod === 'online' ? paymentGateway : null,
      total,
      placedAt: new Date().toISOString(),
    }
    if (mode !== 'buyNow') clearCart()
    setPlacedOrder(order)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (placedOrder) {
    return (
      <div className="min-h-dvh bg-white">
        <OrderSuccess
          order={placedOrder}
          onShopAgain={() => {
            setPlacedOrder(null)
            navigate('/order-online', { replace: true })
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#f7faf8]">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to={mode === 'buyNow' ? '/order-online' : '/order-online/cart'}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            ← Back
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-6">
          <BrandLogo size="md" className="mx-auto block" />
          <h1 className="mt-4 text-2xl font-extrabold text-brand-800">Checkout</h1>
        </div>
      </header>

      <form
        className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6"
        onSubmit={placeOrder}
        noValidate
      >
        <CustomerDetailsForm
          values={customer}
          errors={customerErrors}
          onChange={(name, value) => {
            setCustomer((prev) => ({ ...prev, [name]: value }))
            setCustomerErrors((prev) => {
              if (!prev[name]) return prev
              const next = { ...prev }
              delete next[name]
              return next
            })
          }}
        />

        <OrderSummary
          items={checkoutItems}
          customer={customer}
          paymentMethod={paymentMethod}
          paymentGateway={paymentGateway}
          total={total}
        />

        <PaymentSection
          method={paymentMethod}
          gateway={paymentGateway}
          error={paymentError}
          onMethodChange={(m) => {
            setPaymentMethod(m)
            setPaymentError('')
          }}
          onGatewayChange={(g) => {
            setPaymentGateway(g)
            setPaymentError('')
          }}
        />

        {formError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full py-4 text-lg shadow-md shadow-brand-600/20">
          Place Order · {formatInr(total)}
        </Button>
      </form>
    </div>
  )
}
