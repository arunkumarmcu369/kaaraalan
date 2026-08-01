import { FLAVOURS, PET_SIZES, flavourKey, canonicalFlavour } from '../constants/flavours'

function emptyRow(flavour) {
  return {
    flavour,
    glass: null,
    pets: Object.fromEntries(PET_SIZES.map((s) => [s, null])),
  }
}

function cellFromVariant(v) {
  return {
    id: v.id,
    price: Number(v.price ?? 0),
    size_ml: v.size_ml != null ? Number(v.size_ml) : null,
    size_label: v.size_label || null,
    sku: v.sku,
  }
}

/** Resolve PET size in ml; coerce types and map legacy 250 → 220. */
export function resolvePetSize(v, cell = {}) {
  const candidates = [
    cell.size_ml,
    v?.size_ml,
    v?.volume_liters != null ? Math.round(Number(v.volume_liters) * 1000) : null,
  ]

  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    let ml = Number(raw)
    if (!Number.isFinite(ml)) continue
    ml = Math.round(ml)
    if (ml === 250) ml = 220
    if (PET_SIZES.includes(ml)) return ml
  }

  const label = String(v?.size_label || cell.size_label || '')
  if (label.includes('300')) return 300
  if (label.includes('220') || label.includes('250')) return 220
  return null
}

/**
 * Always return all 8 flavours with glass + PET 300/220 slots filled from stock.
 */
export function buildFlavourMatrix(groups = []) {
  const rows = FLAVOURS.map((flavour) => emptyRow(flavour))
  const byKey = new Map(rows.map((r) => [flavourKey(r.flavour), r]))

  for (const group of groups) {
    const canon = canonicalFlavour(group.flavour_name || group.name)
    if (!canon) continue
    const row = byKey.get(flavourKey(canon))
    if (!row) continue

    for (const v of group.variants || []) {
      const type =
        v.product_type || (v.bottle_type === 'glass' ? 'glass' : 'pet')
      const cell = cellFromVariant(v)

      if (type === 'glass') {
        if (!row.glass) row.glass = cell
        continue
      }

      const sizeMl = resolvePetSize(v, cell)
      if (sizeMl == null) continue
      if (!row.pets[sizeMl]) {
        row.pets[sizeMl] = { ...cell, size_ml: sizeMl, size_label: `${sizeMl} ml` }
      }
    }
  }

  return rows
}

/**
 * Pivot order line items into Flavour | Glass | PET 300 | PET 220.
 */
export function buildOrderMatrix(items = []) {
  const rows = FLAVOURS.map((flavour) => ({
    flavour,
    glass: 0,
    pet_300: 0,
    pet_220: 0,
  }))
  const byKey = new Map(rows.map((r) => [flavourKey(r.flavour), r]))

  for (const item of items) {
    const canon = canonicalFlavour(item.name || item.flavour_name)
    if (!canon) continue
    const row = byKey.get(flavourKey(canon))
    if (!row) continue

    const type =
      item.product_type || (item.bottle_type === 'glass' ? 'glass' : 'pet')
    const qty = Number(item.quantity || 0)

    if (type === 'glass') {
      row.glass += qty
      continue
    }

    const sizeMl = resolvePetSize(item, item)
    if (sizeMl === 300) row.pet_300 += qty
    else if (sizeMl === 220) row.pet_220 += qty
  }

  return rows
}

export function matrixTotals(rows, { editable = false, qtys = {} } = {}) {
  return rows.reduce(
    (acc, row) => {
      const glassQty = editable
        ? Number(qtys[`${row.flavour}::glass`] || 0)
        : Number(row.glass || 0)
      const pet300 = editable
        ? Number(qtys[`${row.flavour}::pet_300`] || 0)
        : Number(row.pet_300 || 0)
      const pet220 = editable
        ? Number(qtys[`${row.flavour}::pet_220`] || 0)
        : Number(row.pet_220 || 0)
      return {
        glass: acc.glass + glassQty,
        pet_300: acc.pet_300 + pet300,
        pet_220: acc.pet_220 + pet220,
      }
    },
    { glass: 0, pet_300: 0, pet_220: 0 }
  )
}

/**
 * Whether current stock covers every GLASS / PET 300 / PET 220 line on the order.
 * Compares per flavour × crate type against stock matrix rows.
 */
export function isOrderStockAvailable(items = [], stockRows = []) {
  const needed = buildOrderMatrix(items)
  const stockByKey = new Map(
    (stockRows || []).map((r) => [flavourKey(r.flavour), r])
  )

  for (const row of needed) {
    const orderedGlass = Number(row.glass || 0)
    const orderedPet300 = Number(row.pet_300 || 0)
    const orderedPet220 = Number(row.pet_220 || 0)
    if (!orderedGlass && !orderedPet300 && !orderedPet220) continue

    const stock = stockByKey.get(flavourKey(row.flavour)) || {}
    if (orderedGlass > Number(stock.glass || 0)) return false
    if (orderedPet300 > Number(stock.pet_300 || 0)) return false
    if (orderedPet220 > Number(stock.pet_220 || 0)) return false
  }
  return true
}
