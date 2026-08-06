import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { cartLineKey } from '../constants/orderOnlineProducts'

const STORAGE_KEY = 'kaaraalan_order_online_cart'
const OrderOnlineCartContext = createContext(null)

function loadCart() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function OrderOnlineCartProvider({ children }) {
  const [cart, setCart] = useState(loadCart)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const addItem = useCallback((line) => {
    const key = cartLineKey(line.productId, line.variantId)
    setCart((prev) => {
      const existing = prev[key]
      const quantity = Math.max(1, Number(line.quantity) || 1)
      return {
        ...prev,
        [key]: existing
          ? { ...existing, quantity: existing.quantity + quantity }
          : { key, ...line, quantity },
      }
    })
  }, [])

  const updateQty = useCallback((key, quantity) => {
    setCart((prev) => {
      if (!prev[key]) return prev
      const qty = Number.parseInt(String(quantity), 10) || 0
      if (qty < 1) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: { ...prev[key], quantity: qty } }
    })
  }, [])

  const removeItem = useCallback((key) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const clearCart = useCallback(() => setCart({}), [])

  const items = useMemo(
    () =>
      Object.values(cart).sort((a, b) =>
        `${a.productName}${a.variantLabel}`.localeCompare(`${b.productName}${b.variantLabel}`)
      ),
    [cart]
  )

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  )

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )

  const value = useMemo(
    () => ({
      cart,
      items,
      itemCount,
      subtotal,
      addItem,
      updateQty,
      removeItem,
      clearCart,
    }),
    [cart, items, itemCount, subtotal, addItem, updateQty, removeItem, clearCart]
  )

  return (
    <OrderOnlineCartContext.Provider value={value}>{children}</OrderOnlineCartContext.Provider>
  )
}

export function useOrderOnlineCart() {
  const ctx = useContext(OrderOnlineCartContext)
  if (!ctx) throw new Error('useOrderOnlineCart must be used within OrderOnlineCartProvider')
  return ctx
}
