import { formatFlavourLabel } from '../../constants/flavours'
import { LABEL_GLASS, LABEL_PET_300, LABEL_PET_220 } from '../../constants/labels'
import { matrixTotals } from '../../utils/orderMatrix'

/** Fully controlled qty input — any non-negative integer allowed. */
function QtyInput({ value, ariaLabel, onChange }) {
  const display = value === '' || value === undefined || value === null ? '' : String(value)

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={display}
      placeholder="0"
      aria-label={ariaLabel}
      className="mx-auto w-20 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-center text-ink outline-none focus:ring-2 focus:ring-brand-300"
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          onChange('')
          return
        }
        // Digits only — reject non-numeric keystrokes without clamping
        if (!/^\d+$/.test(raw)) return
        // Strip leading zeros but keep a single 0
        const normalized = raw.replace(/^0+(?=\d)/, '')
        onChange(Number.parseInt(normalized, 10))
      }}
    />
  )
}

function EditableCell({ available, qtyKey, qtys, onQtyChange, ariaLabel }) {
  if (!available) return <span className="text-muted">—</span>
  return (
    <div className="flex flex-col items-center gap-0.5">
      <QtyInput
        value={qtys[qtyKey]}
        ariaLabel={ariaLabel}
        onChange={(v) => onQtyChange?.(qtyKey, v)}
      />
    </div>
  )
}

export default function OrderMatrixTable({
  rows = [],
  editable = false,
  qtys = {},
  onQtyChange,
  emptyLabel = 'No flavours available',
}) {
  const totals = matrixTotals(rows, { editable, qtys })

  if (!rows.length) {
    return (
      <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-muted ring-1 ring-brand-100">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-brand-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-800 text-white">
            <th className="border border-brand-700 px-3 py-3 text-left font-bold uppercase tracking-wide">
              Flavour
            </th>
            <th className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide">
              {LABEL_GLASS}
            </th>
            <th className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide">
              {LABEL_PET_300}
            </th>
            <th className="border border-brand-700 px-3 py-3 text-center font-bold uppercase tracking-wide">
              {LABEL_PET_220}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const glassKey = `${row.flavour}::glass`
            const pet300Key = `${row.flavour}::pet_300`
            const pet220Key = `${row.flavour}::pet_220`

            return (
              <tr key={row.flavour} className="bg-white odd:bg-brand-50/40">
                <td className="border border-brand-100 px-3 py-2.5 font-semibold uppercase text-ink">
                  {formatFlavourLabel(row.flavour)}
                </td>
                <td className="border border-brand-100 px-2 py-2 text-center">
                  {editable ? (
                    <EditableCell
                      available={row.glass}
                      qtyKey={glassKey}
                      qtys={qtys}
                      onQtyChange={onQtyChange}
                      ariaLabel={`${row.flavour} ${LABEL_GLASS} quantity`}
                    />
                  ) : (
                    <span className="font-medium text-ink">{Number(row.glass || 0)}</span>
                  )}
                </td>
                <td className="border border-brand-100 px-2 py-2 text-center">
                  {editable ? (
                    <EditableCell
                      available={row.pets?.[300]}
                      qtyKey={pet300Key}
                      qtys={qtys}
                      onQtyChange={onQtyChange}
                      ariaLabel={`${row.flavour} ${LABEL_PET_300} quantity`}
                    />
                  ) : (
                    <span className="font-medium text-ink">{Number(row.pet_300 || 0)}</span>
                  )}
                </td>
                <td className="border border-brand-100 px-2 py-2 text-center">
                  {editable ? (
                    <EditableCell
                      available={row.pets?.[220]}
                      qtyKey={pet220Key}
                      qtys={qtys}
                      onQtyChange={onQtyChange}
                      ariaLabel={`${row.flavour} ${LABEL_PET_220} quantity`}
                    />
                  ) : (
                    <span className="font-medium text-ink">{Number(row.pet_220 || 0)}</span>
                  )}
                </td>
              </tr>
            )
          })}
          <tr className="bg-brand-100/80 font-bold">
            <td className="border border-brand-200 px-3 py-3 uppercase text-ink">Total</td>
            <td className="border border-brand-200 px-3 py-3 text-center text-ink">{totals.glass}</td>
            <td className="border border-brand-200 px-3 py-3 text-center text-ink">{totals.pet_300}</td>
            <td className="border border-brand-200 px-3 py-3 text-center text-ink">{totals.pet_220}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
