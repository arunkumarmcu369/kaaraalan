/** Canonical flavours for the order matrix (fixed order). */
export const FLAVOURS = [
  'Paneer',
  'Lemon',
  'Orange',
  'BlueBerry',
  'Ginger',
  'Nannari',
  'Grape',
  'Pineapple',
]

/** Display order: PET (300 ml) then PET (220 ml) */
export const PET_SIZES = [300, 220]
export const PET_COLUMN_KEYS = ['pet_300', 'pet_220']

const ALIASES = {
  panneer: 'paneer',
  panner: 'paneer',
  'blue berry': 'blueberry',
  'blue-berry': 'blueberry',
  blueberry: 'blueberry',
  'pine apple': 'pineapple',
  'pine-apple': 'pineapple',
}

/** Normalize flavour names for matching (e.g. PANNEER → Paneer). */
export function flavourKey(name) {
  let key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  if (ALIASES[key]) key = ALIASES[key]
  return key
}

export function canonicalFlavour(name) {
  const key = flavourKey(name)
  return FLAVOURS.find((f) => flavourKey(f) === key) || null
}

/** Plain-text flavour label (no emojis). */
export function formatFlavourLabel(name) {
  return canonicalFlavour(name) || name
}
