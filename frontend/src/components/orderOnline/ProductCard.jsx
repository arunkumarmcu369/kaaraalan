import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import ProductImage from './ProductImage'
import { findOnlineVariant, formatInr } from '../../constants/orderOnlineProducts'

export default function ProductCard({ product, onAddToCart }) {
  const navigate = useNavigate()
  const variants = product.variants || []
  const [selectedId, setSelectedId] = useState(variants[0]?.id || '')
  const [message, setMessage] = useState('')
  const selected = findOnlineVariant(product, selectedId) || variants[0]

  const buildLine = (quantity = 1) => {
    if (!selected) return null
    return {
      productId: product.id,
      productName: product.name,
      flavour: product.name,
      variantId: selected.id,
      variantLabel: selected.label,
      sizeLabel: `${selected.volumeMl} ml`,
      price: selected.price,
      quantity,
    }
  }

  const handleBuyNow = () => {
    const line = buildLine(1)
    if (!line) return
    navigate('/order-online/checkout', { state: { mode: 'buyNow', items: [line] } })
  }

  const handleAddToCart = () => {
    const line = buildLine(1)
    if (!line) return
    onAddToCart?.(line)
    setMessage('Added to cart')
    window.setTimeout(() => setMessage(''), 1600)
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
      <ProductImage
        imageKey={product.imageKey}
        name={product.name}
        className="aspect-[3/4] w-full border-b border-brand-50"
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <h3 className="text-center text-xl font-extrabold tracking-tight text-ink">
          {product.name}
        </h3>

        <div className="flex justify-center gap-2">
          {variants.map((variant) => {
            const active = variant.id === selectedId
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedId(variant.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                    : 'bg-white text-ink ring-1 ring-brand-200 hover:bg-brand-50'
                }`}
              >
                {variant.volumeMl} ml
              </button>
            )
          })}
        </div>

        {selected && (
          <p className="text-center text-sm font-bold tabular-nums text-brand-700">
            {formatInr(selected.price)}
          </p>
        )}

        <div className="mt-auto space-y-2.5">
          <Button type="button" className="w-full py-3 text-base" onClick={handleBuyNow}>
            Buy Now
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full py-3 text-base"
            onClick={handleAddToCart}
          >
            Add to Cart
          </Button>
          {message && (
            <p className="text-center text-xs font-semibold text-brand-700" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
