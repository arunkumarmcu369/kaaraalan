import { LABEL_GLASS, LABEL_PET_300, LABEL_PET_220 } from '../../constants/labels'

const MRP_ROWS = [
  { key: 'mrp_glass', label: LABEL_GLASS },
  { key: 'mrp_pet_300', label: LABEL_PET_300 },
  { key: 'mrp_pet_220', label: LABEL_PET_220 },
]

/** Editable MRP table for dealer place-order (reference only — not used in billing). */
export function MrpInputTable({ values = {}, onChange }) {
  const handle = (key, raw) => {
    if (raw === '') {
      onChange?.(key, '')
      return
    }
    // Allow typing decimals freely; keep only valid non-negative numeric text
    if (!/^\d*\.?\d*$/.test(raw)) return
    onChange?.(key, raw)
  }

  return (
    <div>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-ink">MRP</p>
      <div className="overflow-x-auto rounded-xl ring-1 ring-brand-200">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-800 text-white">
              <th className="border border-brand-700 px-3 py-3 text-left font-bold uppercase tracking-wide">
                Type
              </th>
              <th className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide">
                MRP
              </th>
            </tr>
          </thead>
          <tbody>
            {MRP_ROWS.map((row) => (
              <tr key={row.key} className="bg-white odd:bg-brand-50/40">
                <td className="border border-brand-100 px-3 py-2.5 font-semibold text-ink">
                  {row.label}
                </td>
                <td className="border border-brand-100 px-2 py-2 text-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={values[row.key] ?? ''}
                    placeholder="0"
                    aria-label={`${row.label} MRP`}
                    className="mx-auto w-28 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-center text-ink outline-none focus:ring-2 focus:ring-brand-300"
                    onChange={(e) => handle(row.key, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted">For bottle label printing only — does not affect order total.</p>
    </div>
  )
}

/** Read-only MRP table for admin order details. */
export function MrpDisplayTable({ mrp_glass, mrp_pet_300, mrp_pet_220 }) {
  const values = {
    mrp_glass,
    mrp_pet_300,
    mrp_pet_220,
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">MRP</p>
      <div className="overflow-x-auto rounded-xl ring-1 ring-brand-200">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-800 text-white">
              <th className="border border-brand-700 px-3 py-3 text-left font-bold uppercase tracking-wide">
                Type
              </th>
              <th className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide">
                MRP
              </th>
            </tr>
          </thead>
          <tbody>
            {MRP_ROWS.map((row) => {
              const val = values[row.key]
              return (
                <tr key={row.key} className="bg-white odd:bg-brand-50/40">
                  <td className="border border-brand-100 px-3 py-2.5 font-semibold text-ink">
                    {row.label}
                  </td>
                  <td className="border border-brand-100 px-3 py-2.5 text-center font-medium text-ink">
                    {val == null || val === '' ? '—' : `₹${Number(val).toLocaleString()}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
