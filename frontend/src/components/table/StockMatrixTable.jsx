import { formatFlavourLabel } from '../../constants/flavours'
import { LABEL_GLASS, LABEL_PET_300, LABEL_PET_220 } from '../../constants/labels'

const COLUMNS = [
  { key: 'glass', label: LABEL_GLASS },
  { key: 'pet_300', label: LABEL_PET_300 },
  { key: 'pet_220', label: LABEL_PET_220 },
]

export default function StockMatrixTable({
  rows = [],
  values = {},
  onChange,
  emptyLabel = 'No flavours available',
}) {
  const totals = rows.reduce(
    (acc, row) => {
      for (const col of COLUMNS) {
        const key = `${row.flavour}::${col.key}`
        const raw = Object.prototype.hasOwnProperty.call(values, key)
          ? values[key]
          : row[col.key]
        acc[col.key] += Number(raw || 0)
      }
      return acc
    },
    { glass: 0, pet_300: 0, pet_220: 0 }
  )

  if (!rows.length) {
    return (
      <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-muted ring-1 ring-brand-100">
        {emptyLabel}
      </div>
    )
  }

  const handle = (key, raw) => {
    if (raw === '') {
      onChange?.(key, '')
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    onChange?.(key, Math.max(0, parsed))
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-brand-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-800 text-white">
            <th className="border border-brand-700 px-3 py-3 text-left font-bold uppercase tracking-wide">
              Flavour
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.flavour} className="bg-white odd:bg-brand-50/40">
              <td className="border border-brand-100 px-3 py-2.5 font-semibold uppercase text-ink">
                {formatFlavourLabel(row.flavour)}
              </td>
              {COLUMNS.map((col) => {
                const fieldKey = `${row.flavour}::${col.key}`
                const hasValue = Object.prototype.hasOwnProperty.call(values, fieldKey)
                const display = hasValue
                  ? values[fieldKey] === '' || values[fieldKey] == null
                    ? ''
                    : String(values[fieldKey])
                  : String(row[col.key] ?? 0)
                return (
                  <td key={col.key} className="border border-brand-100 px-2 py-2 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={display}
                      aria-label={`${row.flavour} ${col.label} stock`}
                      className="mx-auto w-24 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-center text-ink outline-none focus:ring-2 focus:ring-brand-300"
                      onChange={(e) => handle(fieldKey, e.target.value)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-brand-100/80 font-bold">
            <td className="border border-brand-200 px-3 py-3 uppercase text-ink">Total</td>
            {COLUMNS.map((col) => (
              <td key={col.key} className="border border-brand-200 px-3 py-3 text-center text-ink">
                {totals[col.key]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
