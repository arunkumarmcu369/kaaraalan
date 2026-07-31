import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      addItem: (variant, qty = 1) => {
        const items = [...get().items]
        const idx = items.findIndex((i) => i.product_variant_id === variant.id)
        const nextQty = Math.min(
          variant.quantity_available,
          (idx >= 0 ? items[idx].quantity : 0) + qty
        )
        if (nextQty <= 0) return
        const productType =
          variant.product_type ||
          (variant.bottle_type === 'glass' ? 'glass' : 'pet')
        const row = {
          product_variant_id: variant.id,
          name: variant.name || variant.flavour_name,
          flavour_name: variant.flavour_name || variant.name,
          bottle_type: variant.bottle_type,
          product_type: productType,
          volume_liters: variant.volume_liters,
          size_ml: variant.size_ml,
          size_label: variant.size_label,
          price: Number(variant.price),
          quantity_available: variant.quantity_available,
          quantity: nextQty,
        }
        if (idx >= 0) items[idx] = row
        else items.push(row)
        set({ items })
      },
      setQty: (id, quantity) => {
        set({
          items: get()
            .items.map((i) =>
              i.product_variant_id === id
                ? { ...i, quantity: Math.max(1, Math.min(i.quantity_available, quantity)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })
      },
      removeItem: (id) => set({ items: get().items.filter((i) => i.product_variant_id !== id) }),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    { name: 'kaaralan-cart' }
  )
)
