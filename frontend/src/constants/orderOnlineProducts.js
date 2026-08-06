/**
 * Order Online catalogue — edit this file to change flavours, prices, or image keys.
 *
 * To add a real bottle photo later:
 * 1. Drop the image in `src/assets/order-online/` named `{imageKey}.png` (or .jpg / .webp)
 *    e.g. paneer.png, lemon.png, blueberry.png
 * 2. Refresh — ProductImage resolves it automatically.
 */

export const ORDER_ONLINE_VARIANTS = [
  { id: 'pet_220', label: '220 ml PET', volumeMl: 220 },
  { id: 'pet_300', label: '300 ml PET', volumeMl: 300 },
]

/** Default unit prices (INR) — change per flavour below if needed. */
const DEFAULT_PRICES = {
  pet_220: 18,
  pet_300: 22,
}

/**
 * @typedef {{ id: string, label: string, volumeMl: number, price: number }} OnlineVariant
 * @typedef {{ id: string, name: string, imageKey: string, variants: OnlineVariant[] }} OnlineProduct
 */

/** @type {OnlineProduct[]} */
export const ORDER_ONLINE_PRODUCTS = [
  {
    id: 'paneer',
    name: 'Paneer',
    imageKey: 'paneer',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'lemon',
    name: 'Lemon',
    imageKey: 'lemon',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'orange',
    name: 'Orange',
    imageKey: 'orange',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'blueberry',
    name: 'Blueberry',
    imageKey: 'blueberry',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'ginger',
    name: 'Ginger',
    imageKey: 'ginger',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'nannari',
    name: 'Nannari',
    imageKey: 'nannari',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'grape',
    name: 'Grape',
    imageKey: 'grape',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
  {
    id: 'pineapple',
    name: 'Pineapple',
    imageKey: 'pineapple',
    variants: [
      { ...ORDER_ONLINE_VARIANTS[0], price: DEFAULT_PRICES.pet_220 },
      { ...ORDER_ONLINE_VARIANTS[1], price: DEFAULT_PRICES.pet_300 },
    ],
  },
]

export function findOnlineProduct(productId) {
  return ORDER_ONLINE_PRODUCTS.find((p) => p.id === productId) || null
}

export function findOnlineVariant(product, variantId) {
  return product?.variants?.find((v) => v.id === variantId) || null
}

export function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

export function cartLineKey(productId, variantId) {
  return `${productId}::${variantId}`
}

export function parseCartLineKey(key) {
  const [productId, variantId] = String(key).split('::')
  return { productId, variantId }
}
