import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getStockMatrix, listStockHistory, updateStockMatrix } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { LABEL_GLASS, LABEL_PET_300, LABEL_PET_220 } from '../../constants/labels'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import StockMatrixTable from '../../components/table/StockMatrixTable'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'
import { formatDate, formatTime } from '../../utils/formatDate'

function formatSigned(delta) {
  const n = Number(delta || 0)
  if (!n) return <span className="text-muted">0</span>
  const sign = n > 0 ? '+' : ''
  return <span className={`font-bold ${n > 0 ? 'text-brand-600' : 'text-danger'}`}>{sign}{n}</span>
}

function UpdatedByCell({ row }) {
  const source = String(row.source || 'admin').toLowerCase()
  if (source === 'system') {
    return (
      <div>
        <p className="font-bold uppercase tracking-wide text-ink">SYSTEM</p>
        {row.note && <p className="text-xs text-muted">{row.note}</p>}
      </div>
    )
  }
  return (
    <div>
      <p className="font-bold uppercase tracking-wide text-ink">ADMIN</p>
      <p className="text-xs text-muted">{row.updated_by}</p>
    </div>
  )
}

function CurrentWithDelta({ current, previous }) {
  const curr = Number(current ?? 0)
  if (previous == null || previous === '') {
    return <span className="font-semibold text-[#111827]">{curr}</span>
  }
  const delta = curr - Number(previous)
  if (delta === 0) {
    return <span className="font-semibold text-[#111827]">{curr}</span>
  }
  const sign = delta > 0 ? '+' : ''
  return (
    <span className="font-semibold text-[#111827]">
      {curr}{' '}
      <span style={{ color: delta > 0 ? '#16A34A' : '#DC2626' }}>
        ({sign}
        {delta})
      </span>
    </span>
  )
}

function rowsToValues(rows = []) {
  const values = {}
  for (const row of rows) {
    values[`${row.flavour}::glass`] = Number(row.glass || 0)
    values[`${row.flavour}::pet_300`] = Number(row.pet_300 || 0)
    values[`${row.flavour}::pet_220`] = Number(row.pet_220 || 0)
  }
  return values
}

function sumBucket(rows, values, key) {
  return rows.reduce((sum, row) => {
    const field = `${row.flavour}::${key}`
    const raw = Object.prototype.hasOwnProperty.call(values, field) ? values[field] : row[key]
    return sum + Number(raw || 0)
  }, 0)
}

export default function AdminStocks() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [values, setValues] = useState({})
  const [baselines, setBaselines] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const hydratedRef = useRef(false)
  const historyPeriod = useReportPeriod('30d')

  const matrixQ = useQuery({
    queryKey: ['stock-matrix'],
    queryFn: getStockMatrix,
    refetchOnWindowFocus: false,
  })

  const historyQ = useQuery({
    queryKey: ['stock-history', page, pageSize, historyPeriod.dateBounds],
    queryFn: () =>
      listStockHistory({
        page,
        page_size: pageSize,
        date_from: historyPeriod.dateBounds.date_from,
        date_to: historyPeriod.dateBounds.date_to,
      }),
    enabled: historyPeriod.isValid,
  })

  useEffect(() => {
    if (!matrixQ.data?.rows || hydratedRef.current) return
    const next = rowsToValues(matrixQ.data.rows)
    setValues(next)
    setBaselines(next)
    hydratedRef.current = true
  }, [matrixQ.data])

  const updateM = useMutation({
    mutationFn: updateStockMatrix,
    onSuccess: (data) => {
      if (data?.rows) {
        const next = rowsToValues(data.rows)
        setValues(next)
        setBaselines(next)
        hydratedRef.current = true
      }
      qc.invalidateQueries({ queryKey: ['stock-matrix'] })
      qc.invalidateQueries({ queryKey: ['stock-history'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['admin-summary'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Stock update failed'),
  })

  const submit = () => {
    if (updateM.isPending || !hasChanges) return
    const rows = (matrixQ.data?.rows || []).map((row) => ({
      flavour: row.flavour,
      glass: Number(values[`${row.flavour}::glass`] ?? 0),
      pet_300: Number(values[`${row.flavour}::pet_300`] ?? 0),
      pet_220: Number(values[`${row.flavour}::pet_220`] ?? 0),
    }))
    updateM.mutate({ rows })
  }

  const rows = matrixQ.data?.rows || []
  const preview = useMemo(() => {
    const glassPrev = sumBucket(rows, baselines, 'glass')
    const pet300Prev = sumBucket(rows, baselines, 'pet_300')
    const pet220Prev = sumBucket(rows, baselines, 'pet_220')
    const glassNew = sumBucket(rows, values, 'glass')
    const pet300New = sumBucket(rows, values, 'pet_300')
    const pet220New = sumBucket(rows, values, 'pet_220')
    return [
      { label: LABEL_GLASS, from: glassPrev, to: glassNew, delta: glassNew - glassPrev },
      { label: LABEL_PET_300, from: pet300Prev, to: pet300New, delta: pet300New - pet300Prev },
      { label: LABEL_PET_220, from: pet220Prev, to: pet220New, delta: pet220New - pet220Prev },
    ]
  }, [rows, values, baselines])

  const hasChanges = preview.some((p) => p.delta !== 0)
  const info = matrixQ.data?.info || {}
  const meta = historyQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const historyColumns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.created_at) },
    { key: 'time', label: 'Time', render: (r) => formatTime(r.created_at) },
    { key: 'updated_by', label: 'Updated By', render: (r) => <UpdatedByCell row={r} /> },
    { key: 'previous_glass_total', label: `Previous ${LABEL_GLASS}` },
    { key: 'new_glass_total', label: `New ${LABEL_GLASS}` },
    {
      key: 'glass_change',
      label: `${LABEL_GLASS} Change`,
      render: (r) => formatSigned(r.glass_change ?? r.new_glass_total - r.previous_glass_total),
    },
    { key: 'previous_pet_300_total', label: `Previous ${LABEL_PET_300}` },
    { key: 'new_pet_300_total', label: `New ${LABEL_PET_300}` },
    {
      key: 'pet_300_change',
      label: `${LABEL_PET_300} Change`,
      render: (r) => formatSigned(r.pet_300_change ?? r.new_pet_300_total - r.previous_pet_300_total),
    },
    { key: 'previous_pet_220_total', label: `Previous ${LABEL_PET_220}` },
    { key: 'new_pet_220_total', label: `New ${LABEL_PET_220}` },
    {
      key: 'pet_220_change',
      label: `${LABEL_PET_220} Change`,
      render: (r) => formatSigned(r.pet_220_change ?? r.new_pet_220_total - r.previous_pet_220_total),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Stocks"
        subtitle={`Enter daily ${LABEL_GLASS}, ${LABEL_PET_300}, and ${LABEL_PET_220} stock for each flavour`}
      />

      {matrixQ.isLoading ? (
        <Spinner />
      ) : matrixQ.error ? (
        <EmptyState title="Could not load stock" description="Please try again." />
      ) : (
        <div className="space-y-5">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <StockMatrixTable
              rows={rows}
              values={values}
              baselines={baselines}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />

            <div className="flex justify-center">
              <Button
                type="submit"
                size="lg"
                className="min-w-[14rem] px-10 py-4 text-lg"
                loading={updateM.isPending}
                disabled={!hasChanges}
              >
                Update Stock
              </Button>
            </div>
          </form>

          {hasChanges && (
            <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-brand-100 sm:p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">Stock Changes</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {preview.map((p) => (
                  <div key={p.label} className="rounded-xl bg-brand-50/60 px-3 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{p.label}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {p.from} → {p.to}
                    </p>
                    <p className="mt-1">{formatSigned(p.delta)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 sm:p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#111827]">
              Stock Information
            </h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: '#4F6EF7', backgroundColor: '#F5F8FF' }}
              >
                <div
                  className="border-b px-3 text-center text-[19px] font-extrabold uppercase tracking-wide"
                  style={{
                    borderColor: '#4F6EF7',
                    color: '#3B5BDB',
                    backgroundColor: 'rgba(79, 110, 247, 0.08)',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                  }}
                >
                  Update Details
                </div>
                <dl className="space-y-3 p-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4F6EF7' }}>
                      Last Updated Date
                    </dt>
                    <dd className="mt-1 font-semibold text-[#111827]">
                      {formatDate(info.last_updated_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4F6EF7' }}>
                      Last Updated Time
                    </dt>
                    <dd className="mt-1 font-semibold text-[#111827]">
                      {formatTime(info.last_updated_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4F6EF7' }}>
                      Updated By
                    </dt>
                    <dd className="mt-1 font-semibold uppercase text-[#111827]">
                      {info.updated_by || user?.username || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: '#D97706', backgroundColor: '#FFF8ED' }}
              >
                <div
                  className="border-b px-3 text-center text-[19px] font-extrabold uppercase tracking-wide"
                  style={{
                    borderColor: '#D97706',
                    color: '#B45309',
                    backgroundColor: 'rgba(217, 119, 6, 0.08)',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                  }}
                >
                  Previous Totals
                </div>
                <dl className="space-y-3 p-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D97706' }}>
                      Previous Total <span className="font-extrabold">{LABEL_GLASS}</span>
                    </dt>
                    <dd className="mt-1 font-semibold text-[#111827]">
                      {info.previous_total_glass ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D97706' }}>
                      Previous Total <span className="font-extrabold">PET</span> (
                      <span style={{ color: '#2563EB' }}>300 ml</span>)
                    </dt>
                    <dd className="mt-1 font-semibold text-[#111827]">
                      {info.previous_total_pet_300 ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D97706' }}>
                      Previous Total <span className="font-extrabold">PET</span> (
                      <span style={{ color: '#7C3AED' }}>220 ml</span>)
                    </dt>
                    <dd className="mt-1 font-semibold text-[#111827]">
                      {info.previous_total_pet_220 ?? '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: '#059669', backgroundColor: '#F0FDF4' }}
              >
                <div
                  className="border-b px-3 text-center text-[19px] font-extrabold uppercase tracking-wide"
                  style={{
                    borderColor: '#059669',
                    color: '#047857',
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                  }}
                >
                  Current Totals
                </div>
                <dl className="space-y-3 p-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#059669' }}>
                      Current Total <span className="font-extrabold">{LABEL_GLASS}</span>
                    </dt>
                    <dd className="mt-1">
                      <CurrentWithDelta
                        current={info.current_total_glass}
                        previous={info.previous_total_glass}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#059669' }}>
                      Current Total <span className="font-extrabold">PET</span> (
                      <span style={{ color: '#2563EB' }}>300 ml</span>)
                    </dt>
                    <dd className="mt-1">
                      <CurrentWithDelta
                        current={info.current_total_pet_300}
                        previous={info.previous_total_pet_300}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#059669' }}>
                      Current Total <span className="font-extrabold">PET</span> (
                      <span style={{ color: '#7C3AED' }}>220 ml</span>)
                    </dt>
                    <dd className="mt-1">
                      <CurrentWithDelta
                        current={info.current_total_pet_220}
                        previous={info.previous_total_pet_220}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
              Stock Update History
            </h2>
            <ReportPeriodFilter
              className="mb-4"
              range={historyPeriod.range}
              onRangeChange={(value) => {
                historyPeriod.setRange(value)
                setPage(1)
              }}
              dateFrom={historyPeriod.dateFrom}
              onDateFromChange={(value) => {
                historyPeriod.setDateFrom(value)
                setPage(1)
              }}
              dateTo={historyPeriod.dateTo}
              onDateToChange={(value) => {
                historyPeriod.setDateTo(value)
                setPage(1)
              }}
              error={!historyPeriod.isValid ? 'Select a valid custom date range.' : ''}
            />
            {historyQ.isLoading ? (
              <Spinner />
            ) : (
              <>
                <ResponsiveTable
                  columns={historyColumns}
                  rows={historyQ.data?.items || []}
                  empty={
                    <EmptyState
                      title="No stock updates yet"
                      description="History appears after stock updates or order approvals."
                    />
                  }
                />
                <Pagination
                  page={meta.page}
                  pageSize={meta.page_size}
                  total={meta.total}
                  totalPages={meta.total_pages}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setPage(1)
                  }}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
