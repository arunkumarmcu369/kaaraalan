import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmptyCratesSummary,
  listEmptyCratesHistory,
  updateEmptyCrates,
} from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'
import { formatDate, formatTime } from '../../utils/formatDate'
import { formatDealerName } from '../../utils/formatDealerName'

const ALL_ORDERS = ''
const NON_COLOUR_KEY = '__non_colour__'

function displayFlavour(name) {
  if (name === 'BlueBerry') return 'Blueberry'
  if (name === 'Non-Colour') return 'Non-Colour Separated'
  return name
}

/** Parse crate input as a non-negative integer string (or empty while typing). */
function parseIntegerInput(raw) {
  if (raw === '' || raw == null) return ''
  const digits = String(raw).replace(/[^\d]/g, '')
  if (digits === '') return ''
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n) || n < 0) return ''
  return n
}

function toStoredInt(value) {
  if (value === '' || value == null) return 0
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function formatSigned(delta) {
  const n = Number.parseInt(String(delta ?? 0), 10) || 0
  if (!n) return <span className="text-muted">0</span>
  const sign = n > 0 ? '+' : ''
  return (
    <span className={`font-bold ${n > 0 ? 'text-brand-600' : 'text-danger'}`}>
      {sign}
      {n}
    </span>
  )
}

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function valuesFromSummary(flavours = [], nonColour = 0) {
  const next = { [NON_COLOUR_KEY]: toStoredInt(nonColour) }
  for (const row of flavours) {
    next[row.flavour] = toStoredInt(row.available)
  }
  return next
}

function serverKeyFromSummary(flavours = [], nonColour = 0) {
  return `${flavours.map((f) => `${f.flavour}:${toStoredInt(f.available)}`).join('|')}|nc:${toStoredInt(nonColour)}`
}

export default function AdminEmptyCrates() {
  const qc = useQueryClient()
  const period = useReportPeriod('today')
  const historyPeriod = useReportPeriod('30d')
  const periodKey = JSON.stringify(period.params)
  const [orderId, setOrderId] = useState(ALL_ORDERS)
  const [orderPeriodKey, setOrderPeriodKey] = useState(periodKey)
  const effectiveOrderId = orderPeriodKey === periodKey ? orderId : ALL_ORDERS

  const [values, setValues] = useState({})
  const [baselines, setBaselines] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const hydratedRef = useRef(false)

  const queryParams = useMemo(() => {
    const params = { ...period.params }
    if (effectiveOrderId) params.order_id = effectiveOrderId
    return params
  }, [period.params, effectiveOrderId])

  const summaryQ = useQuery({
    queryKey: ['empty-crates-summary', queryParams],
    queryFn: () => getEmptyCratesSummary(queryParams),
    enabled: period.isValid,
  })

  const lastUpdateQ = useQuery({
    queryKey: ['empty-crates-last-update'],
    queryFn: () =>
      listEmptyCratesHistory({
        page: 1,
        page_size: 1,
        range: 'custom',
        date_from: '2020-01-01',
        date_to: toISODate(new Date()),
      }),
  })

  const historyQ = useQuery({
    queryKey: ['empty-crates-history', page, pageSize, historyPeriod.params],
    queryFn: () =>
      listEmptyCratesHistory({
        page,
        page_size: pageSize,
        ...historyPeriod.params,
      }),
    enabled: historyPeriod.isValid,
  })

  const flavours = summaryQ.data?.flavours || []
  const orders = summaryQ.data?.orders || []
  const totals = summaryQ.data?.totals || {}
  const nonColourAvailable = toStoredInt(summaryQ.data?.non_colour_available)
  const colourTotal = flavours.reduce((sum, row) => sum + toStoredInt(row.available), 0)
  const lastUpdate = lastUpdateQ.data?.items?.[0] || null
  const showOrderCheck = Boolean(effectiveOrderId)

  useEffect(() => {
    if (orderPeriodKey !== periodKey) {
      setOrderId(ALL_ORDERS)
      setOrderPeriodKey(periodKey)
    }
  }, [periodKey, orderPeriodKey])

  useEffect(() => {
    if (!effectiveOrderId || !summaryQ.data) return
    const stillPresent = (summaryQ.data.orders || []).some((o) => o.id === effectiveOrderId)
    if (!stillPresent) {
      setOrderId(ALL_ORDERS)
      setOrderPeriodKey(periodKey)
    }
  }, [summaryQ.data, effectiveOrderId, periodKey])

  useEffect(() => {
    if (!flavours.length) return
    const key = serverKeyFromSummary(flavours, nonColourAvailable)
    if (!hydratedRef.current || hydratedRef.current !== key) {
      const next = valuesFromSummary(flavours, nonColourAvailable)
      setValues(next)
      setBaselines(next)
      hydratedRef.current = key
    }
  }, [flavours, nonColourAvailable])

  const applySavedValues = (data) => {
    if (!data?.flavours) return
    const next = valuesFromSummary(data.flavours, data.non_colour_available)
    setValues(next)
    setBaselines(next)
    hydratedRef.current = serverKeyFromSummary(data.flavours, data.non_colour_available)
  }

  const updateM = useMutation({
    mutationFn: updateEmptyCrates,
    onSuccess: (data) => {
      applySavedValues(data)
      qc.invalidateQueries({ queryKey: ['empty-crates-summary'] })
      qc.invalidateQueries({ queryKey: ['empty-crates-history'] })
      qc.invalidateQueries({ queryKey: ['empty-crates-last-update'] })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Empty crates update failed'),
  })

  const hasChanges = useMemo(() => {
    if (toStoredInt(values[NON_COLOUR_KEY]) !== toStoredInt(baselines[NON_COLOUR_KEY])) return true
    return flavours.some(
      (row) => toStoredInt(values[row.flavour]) !== toStoredInt(baselines[row.flavour])
    )
  }, [flavours, values, baselines])

  const submit = () => {
    if (updateM.isPending || !hasChanges) return
    updateM.mutate({
      items: flavours.map((row) => ({
        flavour: row.flavour,
        available: toStoredInt(values[row.flavour]),
      })),
      non_colour_available: toStoredInt(values[NON_COLOUR_KEY]),
    })
  }

  const setIntValue = (key, raw) => {
    setValues((prev) => ({
      ...prev,
      [key]: parseIntegerInput(raw),
    }))
  }

  const orderOptions = useMemo(
    () => [
      { value: ALL_ORDERS, label: 'All Approved Orders' },
      ...orders.map((o) => ({
        value: o.id,
        label: o.dealer_name
          ? `${o.order_number} - ${formatDealerName(o.dealer_name)}`
          : o.order_number,
      })),
    ],
    [orders]
  )

  const meta = historyQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }
  const orderEnough = Boolean(totals.enough)
  const requiredCrates = toStoredInt(totals.required)
  const availableCrates = toStoredInt(totals.available)
  const shortageCrates = toStoredInt(totals.shortage ?? Math.max(0, requiredCrates - availableCrates))

  const historyColumns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.created_at) },
    { key: 'time', label: 'Time', render: (r) => formatTime(r.created_at) },
    {
      key: 'updated_by',
      label: 'Updated By',
      render: (r) => (
        <span className="font-semibold uppercase tracking-wide text-ink">{r.updated_by}</span>
      ),
    },
    { key: 'flavour', label: 'Flavour', render: (r) => displayFlavour(r.flavour) },
    { key: 'previous_value', label: 'Previous Value' },
    { key: 'new_value', label: 'New Value' },
    { key: 'difference', label: 'Difference', render: (r) => formatSigned(r.difference) },
    {
      key: 'comment',
      label: 'Comments',
      render: (r) => r.comment || <span className="text-muted">—</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Empty Crates"
        subtitle="Check empty crate availability before production and dispatch (does not affect stock or orders)"
      />

      <ReportPeriodFilter
        className="mb-4"
        range={period.range}
        onRangeChange={period.setRange}
        dateFrom={period.dateFrom}
        onDateFromChange={period.setDateFrom}
        dateTo={period.dateTo}
        onDateToChange={period.setDateTo}
        error={!period.isValid ? 'Select a valid custom date range.' : ''}
      />

      <Select
        className="mb-5 max-w-md"
        label="Order Selection"
        value={effectiveOrderId}
        onChange={(e) => {
          setOrderId(e.target.value)
          setOrderPeriodKey(periodKey)
        }}
        options={orderOptions}
        disabled={!period.isValid || summaryQ.isLoading}
      />

      {summaryQ.isLoading ? (
        <Spinner />
      ) : summaryQ.error ? (
        <EmptyState title="Could not load empty crates" description="Please try again." />
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl bg-white/90 px-4 py-4 shadow-sm ring-1 ring-brand-100 sm:px-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Last Updated Date
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {lastUpdate ? formatDate(lastUpdate.created_at) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Last Updated Time
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {lastUpdate ? formatTime(lastUpdate.created_at) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Updated By</p>
                <p className="mt-1 text-sm font-bold uppercase tracking-wide text-ink">
                  {lastUpdate?.updated_by || '—'}
                </p>
              </div>
            </div>
          </section>

          {showOrderCheck && (
            <section
              className={`rounded-2xl px-4 py-4 shadow-sm ring-1 sm:px-5 ${
                orderEnough
                  ? 'bg-emerald-50/90 ring-emerald-200'
                  : 'bg-red-50/90 ring-red-200'
              }`}
            >
              <p
                className={`text-base font-extrabold ${
                  orderEnough ? 'text-emerald-800' : 'text-red-800'
                }`}
              >
                {orderEnough
                  ? '✓ Enough Empty Crates Available'
                  : '✗ Not Enough Empty Crates'}
              </p>
              {!orderEnough && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-muted">Required Crates:</span>{' '}
                    <span className="font-bold tabular-nums">{requiredCrates.toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-muted">Available Crates:</span>{' '}
                    <span className="font-bold tabular-nums">{availableCrates.toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-muted">Shortage:</span>{' '}
                    <span className="font-bold tabular-nums text-red-700">
                      {shortageCrates.toLocaleString()}
                    </span>
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-brand-100">
              <div className="border-b border-brand-100 bg-brand-800 px-4 py-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">
                  Empty Crates
                </h2>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-50/80">
                      <th className="border-b border-brand-100 px-4 py-3 text-left font-bold uppercase tracking-wide text-ink/70">
                        Flavour
                      </th>
                      <th className="border-b border-brand-100 px-4 py-3 text-center font-bold uppercase tracking-wide text-ink/70">
                        Empty Crates
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flavours.map((row) => (
                      <tr key={row.flavour} className="bg-white odd:bg-brand-50/40">
                        <td className="border-b border-brand-50 px-4 py-2.5 font-semibold text-ink">
                          {displayFlavour(row.flavour)}
                        </td>
                        <td className="border-b border-brand-50 px-4 py-2.5 text-center font-semibold tabular-nums text-ink">
                          {toStoredInt(row.available).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-brand-100/70">
                      <td className="px-4 py-3 font-extrabold uppercase tracking-wide text-ink">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-center text-base font-extrabold tabular-nums text-ink">
                        {colourTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-brand-100">
              <div className="border-b border-brand-100 bg-brand-800 px-4 py-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">
                  Non-Colour Separated
                </h2>
              </div>
              <div className="flex flex-1 flex-col justify-center px-5 py-6">
                <Input
                  label="Non-Colour Separated Total"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={
                    Object.prototype.hasOwnProperty.call(values, NON_COLOUR_KEY)
                      ? values[NON_COLOUR_KEY] === '' || values[NON_COLOUR_KEY] == null
                        ? ''
                        : String(values[NON_COLOUR_KEY])
                      : String(nonColourAvailable)
                  }
                  onChange={(e) => setIntValue(NON_COLOUR_KEY, e.target.value)}
                />
              </div>
            </aside>
          </section>

          <section className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-brand-100 sm:p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">
              Update Empty Crates
            </h2>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {flavours.map((row) => (
                  <Input
                    key={row.flavour}
                    label={displayFlavour(row.flavour)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={
                      Object.prototype.hasOwnProperty.call(values, row.flavour)
                        ? values[row.flavour] === '' || values[row.flavour] == null
                          ? ''
                          : String(values[row.flavour])
                        : String(toStoredInt(row.available))
                    }
                    onChange={(e) => setIntValue(row.flavour, e.target.value)}
                  />
                ))}
              </div>
              <div className="flex justify-center pt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="min-w-[14rem] px-10 py-4 text-lg"
                  loading={updateM.isPending}
                  disabled={!hasChanges}
                >
                  Update Empty Crates
                </Button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
              Empty Crates Update History
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
                      title="No empty crate updates yet"
                      description="History appears after you update empty crate counts."
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
