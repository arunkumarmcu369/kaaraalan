/**
 * ResponsiveTable — desktop/tablet: native table; mobile: stacked cards.
 * columns: [{ key, label, render?: (row) => node, mobileLabel?: string, hideOnMobile?: boolean }]
 */
export default function ResponsiveTable({
  columns,
  rows = [],
  rowKey = 'id',
  empty,
  onRowClick,
}) {
  if (!rows.length) {
    return empty || null
  }

  return (
    <div className="w-full">
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-brand-100 md:block">
        <table className="min-w-full divide-y divide-brand-100 bg-white/90 text-left text-sm">
          <thead className="bg-brand-50/80">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-bold text-ink/70">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {rows.map((row) => (
              <tr
                key={row[rowKey]}
                className={onRowClick ? 'interactive-row' : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 align-middle text-ink"
                    onClick={(e) => {
                      if (col.stopRowClick) e.stopPropagation()
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row[rowKey]}
            className={`rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 ${
              onRowClick ? 'interactive-row' : ''
            }`}
            onClick={() => onRowClick?.(row)}
          >
            <dl className="space-y-2">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((col) => (
                  <div
                    key={col.key}
                    className="flex items-start justify-between gap-3"
                    onClick={(e) => {
                      if (col.stopRowClick) e.stopPropagation()
                    }}
                  >
                    <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                      {col.mobileLabel || col.label}
                    </dt>
                    <dd className="text-right text-sm font-medium text-ink">
                      {col.render ? col.render(row) : row[col.key]}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
