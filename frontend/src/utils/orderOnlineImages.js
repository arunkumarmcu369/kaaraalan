/**
 * Resolves optional bottle images from `src/assets/order-online/`.
 * Drop files named `{imageKey}.png|jpg|jpeg|webp` to replace placeholders.
 */
const imageModules = import.meta.glob('../assets/order-online/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', {
  eager: true,
  import: 'default',
})

function normalizePathKey(path) {
  const file = path.split('/').pop() || ''
  return file.replace(/\.[^.]+$/, '').toLowerCase()
}

const byKey = Object.fromEntries(
  Object.entries(imageModules).map(([path, url]) => [normalizePathKey(path), url])
)

export function resolveOrderOnlineImage(imageKey) {
  if (!imageKey) return null
  return byKey[String(imageKey).toLowerCase()] || null
}
