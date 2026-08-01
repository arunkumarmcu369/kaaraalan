import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  adminSummary,
  listLowStock,
  pendingOrdersDetail,
  revenueReport,
  salesTrend,
} from '../../api'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import StackedLineChart from '../../components/charts/StackedLineChart'
import FlavourTrendChart from '../../components/charts/FlavourTrendChart'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'
import Select from '../../components/common/Select'
import { LABEL_GLASS } from '../../constants/labels'
import { formatDealerName } from '../../utils/formatDealerName'
import { formatDate } from '../../utils/formatDate'

function crateLabel(item) {
  if (item.bottle_type === 'glass' || item.size_label === 'GLASS') return LABEL_GLASS
  return item.size_label || item.bottle_type
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString()}`
}

function ClickableCard({ onClick, children }) {
  return (
    <button type="button" className="w-full rounded-2xl text-left" onClick={onClick}>
      {children}
    </button>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { liveEvent } = useOutletContext() || {}
  const period = useReportPeriod('7d')
  const [lowOpen, setLowOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [revenueOpen, setRevenueOpen] = useState(false)
  const [chartView, setChartView] = useState('overall')

  const filterParams = period.params
  const queriesEnabled = period.isValid

  const summaryQ = useQuery({
    queryKey: ['admin-summary', filterParams],
    queryFn: () => adminSummary(filterParams),
    enabled: queriesEnabled,
    refetchInterval: liveEvent ? false : 30000,
  })
  const trendQ = useQuery({
    queryKey: ['sales-trend', filterParams],
    queryFn: () => salesTrend(filterParams),
    enabled: queriesEnabled,
    refetchInterval: liveEvent ? false : 30000,
  })
  const lowQ = useQuery({
    queryKey: ['low-stock'],
    queryFn: listLowStock,
    enabled: lowOpen,
  })
  const pendingQ = useQuery({
    queryKey: ['pending-orders-detail', filterParams],
    queryFn: () => pendingOrdersDetail(filterParams),
    enabled: pendingOpen && queriesEnabled,
  })
  const revenueQ = useQuery({
    queryKey: ['revenue-report', filterParams],
    queryFn: () => revenueReport(filterParams),
    enabled: revenueOpen && queriesEnabled,
  })

  useEffect(() => {
    if (liveEvent?.type === 'order_updated' || liveEvent?.type === 'new_order') {
      summaryQ.refetch()
      trendQ.refetch()
    }
  }, [liveEvent])

  if (summaryQ.isLoading) return <Spinner />
  if (summaryQ.isError) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Simplifying Goli Soda operations every day" />
        <ReportPeriodFilter
          className="mb-5"
          range={period.range}
          onRangeChange={period.setRange}
          dateFrom={period.dateFrom}
          onDateFromChange={period.setDateFrom}
          dateTo={period.dateTo}
          onDateToChange={period.setDateTo}
          error={!period.isValid ? 'Select a valid custom date range.' : ''}
        />
        <EmptyState
          title="Could not load dashboard"
          description={summaryQ.error?.response?.data?.detail || 'Please refresh and try again.'}
        />
      </div>
    )
  }

  const s = summaryQ.data || {}

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Simplifying Goli Soda operations every day" />
      <ReportPeriodFilter
        className="mb-5"
        range={period.range}
        onRangeChange={period.setRange}
        dateFrom={period.dateFrom}
        onDateFromChange={period.setDateFrom}
        dateTo={period.dateTo}
        onDateToChange={period.setDateTo}
        error={!period.isValid ? 'Select a valid custom date range.' : ''}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClickableCard onClick={() => setPendingOpen(true)}>
          <StatCard
            label="Pending orders"
            value={s.pending_orders ?? 0}
            tone="warn"
            hint="Click to view details"
          />
        </ClickableCard>
        <ClickableCard onClick={() => navigate('/dashboard/orders')}>
          <StatCard
            label="Orders"
            value={s.todays_orders ?? 0}
            tone="sky"
            hint="Click to view all orders"
          />
        </ClickableCard>
        <ClickableCard onClick={() => setRevenueOpen(true)}>
          <StatCard
            label="Revenue"
            value={formatMoney(s.revenue)}
            hint={`${s.active_dealers ?? 0} active dealers · Click for report`}
          />
        </ClickableCard>
        <ClickableCard onClick={() => setLowOpen(true)}>
          <StatCard
            label="Low stock alerts"
            value={s.low_stock_alerts ?? 0}
            tone={(s.low_stock_alerts ?? 0) > 0 ? 'warn' : 'sky'}
            hint="Click to view details"
          />
        </ClickableCard>
      </div>
      {(s.low_stock_alerts ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setLowOpen(true)}
          className="mt-3 w-full rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100/80"
        >
          {s.low_stock_alerts} product variant(s) need restocking. Click to view details.
        </button>
      )}
      <section className="mt-6 w-full min-w-0 overflow-hidden rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-ink">Crates sold</h2>
            <span className="text-xs font-semibold text-muted">
              {chartView === 'overall' ? 'Stacked by crate type · live' : 'By flavour · live'}
            </span>
          </div>
          <Select
            className="w-full sm:w-48"
            label="View"
            value={chartView}
            onChange={(e) => setChartView(e.target.value)}
            options={[
              { value: 'overall', label: 'Overall' },
              { value: 'flavour', label: 'By Flavour' },
            ]}
          />
        </div>
        <div className="w-full min-w-0 overflow-hidden">
          {trendQ.isLoading ? (
            <Spinner />
          ) : chartView === 'overall' ? (
            <StackedLineChart
              categories={trendQ.data?.categories || []}
              series={trendQ.data?.series || []}
            />
          ) : (
            <FlavourTrendChart
              categories={trendQ.data?.categories || []}
              flavourSeries={trendQ.data?.flavour_series || []}
            />
          )}
        </div>
      </section>

      <Modal
        open={pendingOpen}
        onClose={() => setPendingOpen(false)}
        title="Pending orders"
        size="xl"
        footer={<Button onClick={() => setPendingOpen(false)}>Close</Button>}
      >
        {pendingQ.isLoading ? (
          <Spinner />
        ) : !(pendingQ.data || []).length ? (
          <EmptyState title="No pending orders" description="Nothing waiting for approval in this period." />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-brand-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-brand-800 text-left text-white">
                  <th className="px-3 py-2 font-bold">Order ID</th>
                  <th className="px-3 py-2 font-bold">Dealer Name</th>
                  <th className="px-3 py-2 font-bold">Date</th>
                  <th className="px-3 py-2 font-bold">Due Date</th>
                  <th className="px-3 py-2 font-bold">Quantity</th>
                  <th className="px-3 py-2 font-bold">Amount</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(pendingQ.data || []).map((row) => (
                  <tr key={row.id} className="odd:bg-brand-50/50">
                    <td className="px-3 py-2 font-semibold text-ink">{row.order_number}</td>
                    <td className="px-3 py-2 font-medium">{formatDealerName(row.dealer_name)}</td>
                    <td className="px-3 py-2">
                      {row.created_at ? formatDate(row.created_at) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.due_date ? formatDate(row.due_date) : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.total_quantity}</td>
                    <td className="px-3 py-2 font-semibold">{formatMoney(row.total_amount)}</td>
                    <td className="px-3 py-2">
                      <OrderStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={revenueOpen}
        onClose={() => setRevenueOpen(false)}
        title="Revenue report"
        size="xl"
        footer={<Button onClick={() => setRevenueOpen(false)}>Close</Button>}
      >
        {revenueQ.isLoading ? (
          <Spinner />
        ) : !(revenueQ.data?.items || []).length ? (
          <EmptyState title="No revenue" description="No approved or fulfilled orders in this period." />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-brand-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-brand-800 text-left text-white">
                  <th className="px-3 py-2 font-bold">Dealer Name</th>
                  <th className="px-3 py-2 font-bold">Orders</th>
                  <th className="px-3 py-2 font-bold">Total Revenue</th>
                  <th className="px-3 py-2 font-bold">Paid Amount</th>
                  <th className="px-3 py-2 font-bold">Pending Amount</th>
                </tr>
              </thead>
              <tbody>
                {(revenueQ.data?.items || []).map((row) => (
                  <tr key={row.dealer_id || row.dealer_name} className="odd:bg-brand-50/50">
                    <td className="px-3 py-2 font-semibold text-ink">
                      {formatDealerName(row.dealer_name)}
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.orders_count}</td>
                    <td className="px-3 py-2 font-semibold">{formatMoney(row.total_revenue)}</td>
                    <td className="px-3 py-2 font-semibold text-brand-700">
                      {formatMoney(row.paid_amount)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-amber-700">
                      {formatMoney(row.pending_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-100/80 font-bold">
                  <td className="px-3 py-3 text-ink" colSpan={2}>
                    Grand Total Revenue
                  </td>
                  <td className="px-3 py-3 text-ink">
                    {formatMoney(revenueQ.data?.grand_total_revenue)}
                  </td>
                  <td className="px-3 py-3 text-brand-700">
                    {formatMoney(revenueQ.data?.grand_paid_amount)}
                  </td>
                  <td className="px-3 py-3 text-amber-700">
                    {formatMoney(revenueQ.data?.grand_pending_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={lowOpen}
        onClose={() => setLowOpen(false)}
        title="Low stock alerts"
        size="xl"
        footer={<Button onClick={() => setLowOpen(false)}>Close</Button>}
      >
        {lowQ.isLoading ? (
          <Spinner />
        ) : !(lowQ.data?.items || []).length ? (
          <EmptyState title="No low stock items" description="All products are above their thresholds." />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-brand-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-brand-800 text-left text-white">
                  <th className="px-3 py-2 font-bold">Flavour</th>
                  <th className="px-3 py-2 font-bold">Crate Type</th>
                  <th className="px-3 py-2 font-bold">Current Stock</th>
                  <th className="px-3 py-2 font-bold">Threshold</th>
                  <th className="px-3 py-2 font-bold">Short By</th>
                </tr>
              </thead>
              <tbody>
                {(lowQ.data?.items || []).map((item) => (
                  <tr key={item.product_variant_id} className="bg-red-50 text-danger odd:bg-red-50/80">
                    <td className="px-3 py-2 font-semibold uppercase">{item.flavour}</td>
                    <td className="px-3 py-2 font-medium">{crateLabel(item)}</td>
                    <td className="px-3 py-2 font-semibold">{item.current_stock}</td>
                    <td className="px-3 py-2 font-semibold">{item.threshold}</td>
                    <td className="px-3 py-2 font-bold">{item.short_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
