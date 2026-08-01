import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { batchRequired } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import Select from '../../components/common/Select'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'
import { formatDateTime } from '../../utils/formatDate'
import { formatDealerName } from '../../utils/formatDealerName'

const ALL_ORDERS = ''

function formatBatches(value) {
  return Number(value || 0).toFixed(2)
}

function formatSyrup(value) {
  return `${Number(value || 0).toFixed(2)} kg`
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-brand-50 py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-base font-bold tabular-nums text-ink">{value}</span>
    </div>
  )
}

function FlavourCard({ flavour, total_crates, batches_required, total_syrup_kg }) {
  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-brand-100">
      <h2 className="mb-3 text-lg font-extrabold tracking-tight text-ink">{flavour}</h2>
      <MetricRow label="Total Crates" value={Number(total_crates || 0).toLocaleString()} />
      <MetricRow label="Batches Required" value={formatBatches(batches_required)} />
      <MetricRow label="Total Syrup Required (kg)" value={formatSyrup(total_syrup_kg)} />
    </section>
  )
}

function OrderInfo({ order }) {
  if (!order) return null
  return (
    <div className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-brand-100">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Order ID</p>
          <p className="mt-1 text-sm font-bold text-ink">{order.order_number}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Dealer Name</p>
          <p className="mt-1 text-sm font-bold text-ink">{formatDealerName(order.dealer_name)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Order Date & Time</p>
          <p className="mt-1 text-sm font-bold text-ink">{formatDateTime(order.created_at)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Crates</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-ink">
            {Number(order.total_crates || 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Order Status</p>
          <div className="mt-1">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminBatchRequired() {
  const period = useReportPeriod('today')
  const periodKey = JSON.stringify(period.params)
  const [orderId, setOrderId] = useState(ALL_ORDERS)
  const [orderPeriodKey, setOrderPeriodKey] = useState(periodKey)
  const effectiveOrderId = orderPeriodKey === periodKey ? orderId : ALL_ORDERS

  const queryParams = useMemo(() => {
    const params = { ...period.params }
    if (effectiveOrderId) params.order_id = effectiveOrderId
    return params
  }, [period.params, effectiveOrderId])

  const batchQ = useQuery({
    queryKey: ['batch-required', queryParams],
    queryFn: () => batchRequired(queryParams),
    enabled: period.isValid,
  })

  const data = batchQ.data || {}
  const flavours = data.flavours || []
  const orders = data.orders || []
  const selectedOrder = data.selected_order || null

  useEffect(() => {
    if (orderPeriodKey !== periodKey) {
      setOrderId(ALL_ORDERS)
      setOrderPeriodKey(periodKey)
    }
  }, [periodKey, orderPeriodKey])

  useEffect(() => {
    if (!effectiveOrderId || !batchQ.data) return
    const stillPresent = (batchQ.data.orders || []).some((o) => o.id === effectiveOrderId)
    if (!stillPresent) {
      setOrderId(ALL_ORDERS)
      setOrderPeriodKey(periodKey)
    }
  }, [batchQ.data, effectiveOrderId, periodKey])

  const orderOptions = useMemo(
    () => [
      { value: ALL_ORDERS, label: 'All Approved Orders' },
      ...orders.map((o) => ({
        value: o.id,
        label: `${o.order_number} - ${formatDealerName(o.dealer_name)}`,
      })),
    ],
    [orders]
  )

  const noOrders = !batchQ.isLoading && !batchQ.error && orders.length === 0

  return (
    <div>
      <PageHeader
        title="Batch Required"
        subtitle="Syrup batches needed by flavour from approved orders"
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
        label="Order"
        value={effectiveOrderId}
        onChange={(e) => {
          setOrderId(e.target.value)
          setOrderPeriodKey(periodKey)
        }}
        options={orderOptions}
        disabled={!period.isValid || batchQ.isLoading}
      />

      {batchQ.isLoading ? (
        <Spinner />
      ) : batchQ.error ? (
        <EmptyState title="Could not load batch data" description="Please try again." />
      ) : noOrders ? (
        <EmptyState title="No approved orders found for the selected period." />
      ) : (
        <div className="space-y-5">
          {selectedOrder && <OrderInfo order={selectedOrder} />}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {flavours.map((row) => (
              <FlavourCard key={row.flavour} {...row} />
            ))}
          </div>
          <div className="rounded-2xl bg-brand-800 px-5 py-5 text-white shadow-sm sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-100">
                  Grand Total Crates
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {Number(data.grand_total_crates || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-100">
                  Grand Total Batches Required
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {formatBatches(data.grand_total_batches)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-100">
                  Grand Total Syrup Required (kg)
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {formatSyrup(data.grand_total_syrup_kg)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
