export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-white/80 px-4 py-3 text-sm ring-1 ring-brand-100 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted">
        Showing <span className="font-semibold text-ink">{from}</span>–
        <span className="font-semibold text-ink">{to}</span> of{' '}
        <span className="font-semibold text-ink">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-muted">
          <span>Rows</span>
          <select
            className="rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-ink outline-none focus:ring-2 focus:ring-brand-300"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            Previous
          </button>
          <span className="min-w-[5.5rem] text-center font-semibold text-ink">
            Page {page} / {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= totalPages || total === 0}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
