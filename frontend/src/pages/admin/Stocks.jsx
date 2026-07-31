import { useEffect, useRef, useState } from 'react'
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

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString()
}

function CurrentWithDelta({ current, previous }) {
  const curr = Number(current ?? 0)
  if (previous == null || previous === '') {
    return <span className="font-semibold text-ink">{curr}</span>
  }
  const delta = curr - Number(previous)
  if (delta === 0) {
    return <span className="font-semibold text-ink">{curr}</span>
  }
  const sign = delta > 0 ? '+' : ''
  return (
    <span className="font-semibold text-ink">
      {curr}{' '}
      <span className={delta > 0 ? 'text-brand-600' : 'text-danger'}>
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

export default function AdminStocks() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [values, setValues] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const hydratedRef = useRef(false)

  const matrixQ = useQuery({
    queryKey: ['stock-matrix'],
    queryFn: getStockMatrix,
    refetchOnWindowFocus: false,
  })

  const historyQ = useQuery({
    queryKey: ['stock-history', page, pageSize],
    queryFn: () => listStockHistory({ page, page_size: pageSize }),
  })

  // Hydrate inputs once from server; do not overwrite while the user is typing
  // (background refetches used to wipe the first keystroke).
  useEffect(() => {
    if (!matrixQ.data?.rows || hydratedRef.current) return
    setValues(rowsToValues(matrixQ.data.rows))
    hydratedRef.current = true
  }, [matrixQ.data])

  const updateM = useMutation({
    mutationFn: updateStockMatrix,
    onSuccess: (data) => {
      if (data?.rows) {
        setValues(rowsToValues(data.rows))
        hydratedRef.current = true
      }
      qc.invalidateQueries({ queryKey: ['stock-matrix'] })
      qc.invalidateQueries({ queryKey: ['stock-history'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Stock update failed'),
  })

  const submit = () => {
    const rows = (matrixQ.data?.rows || []).map((row) => ({
      flavour: row.flavour,
      glass: Number(values[`${row.flavour}::glass`] ?? 0),
      pet_300: Number(values[`${row.flavour}::pet_300`] ?? 0),
      pet_220: Number(values[`${row.flavour}::pet_220`] ?? 0),
    }))
    updateM.mutate({ rows })
  }

  const info = matrixQ.data?.info || {}
  const meta = historyQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const historyColumns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.created_at) },
    { key: 'time', label: 'Time', render: (r) => formatTime(r.created_at) },
    { key: 'updated_by', label: 'Updated By' },
    { key: 'previous_glass_total', label: `Previous ${LABEL_GLASS}` },
    { key: 'previous_pet_300_total', label: `Previous ${LABEL_PET_300}` },
    { key: 'previous_pet_220_total', label: `Previous ${LABEL_PET_220}` },
    { key: 'new_glass_total', label: `New ${LABEL_GLASS}` },
    { key: 'new_pet_300_total', label: `New ${LABEL_PET_300}` },
    { key: 'new_pet_220_total', label: `New ${LABEL_PET_220}` },
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
          <StockMatrixTable
            rows={matrixQ.data?.rows || []}
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />

          <div className="flex justify-end">
            <Button loading={updateM.isPending} onClick={submit}>
              Update Stock
            </Button>
          </div>

          <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-brand-100 sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
              Stock Information
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last Updated Date
                </dt>
                <dd className="mt-1 font-semibold text-ink">{formatDate(info.last_updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last Updated Time
                </dt>
                <dd className="mt-1 font-semibold text-ink">{formatTime(info.last_updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Updated By
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {info.updated_by || user?.username || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Previous Total {LABEL_GLASS}
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {info.previous_total_glass ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Previous Total {LABEL_PET_300}
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {info.previous_total_pet_300 ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Previous Total {LABEL_PET_220}
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {info.previous_total_pet_220 ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Current Total {LABEL_GLASS}
                </dt>
                <dd className="mt-1">
                  <CurrentWithDelta
                    current={info.current_total_glass}
                    previous={info.previous_total_glass}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Current Total {LABEL_PET_300}
                </dt>
                <dd className="mt-1">
                  <CurrentWithDelta
                    current={info.current_total_pet_300}
                    previous={info.previous_total_pet_300}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Current Total {LABEL_PET_220}
                </dt>
                <dd className="mt-1">
                  <CurrentWithDelta
                    current={info.current_total_pet_220}
                    previous={info.previous_total_pet_220}
                  />
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
              Stock Update History
            </h2>
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
                      description="History appears after the first Update Stock."
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
