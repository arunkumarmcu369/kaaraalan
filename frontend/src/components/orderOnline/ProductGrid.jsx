import ProductCard from './ProductCard'
import { ORDER_ONLINE_PRODUCTS } from '../../constants/orderOnlineProducts'

export default function ProductGrid({ products = ORDER_ONLINE_PRODUCTS, onAddToCart }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>
  )
}
