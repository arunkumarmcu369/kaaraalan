import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dealerSummary } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'

export default function DealerDashboard() {
  const period = useReportPeriod('30d')

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['dealer-summary', period.params],
    queryFn: () => dealerSummary(period.params),
    enabled: period.isValid,
  })

  return (
    <div>
      <PageHeader
        title="Dealer dashboard"
        subtitle="Order activity for the selected date range"
        actions={
          <Link to="/dashboard/stock">
            <Button>Place order</Button>
          </Link>
        }
      />

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

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Could not load dashboard" description="Try again in a moment." />
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${isFetching ? 'opacity-70' : ''}`}>
            <StatCard label="Pending" value={data?.pending_orders ?? 0} tone="warn" />
            <StatCard label="Approved" value={data?.approved_orders ?? 0} />
            <StatCard label="Rejected" value={data?.rejected_orders ?? 0} tone="accent" />
            <StatCard label="Total orders" value={data?.total_orders ?? 0} tone="sky" />
          </div>
          <section className="mt-6 rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100 sm:p-6">
            <h2 className="mb-4 text-lg font-bold">Recent activity</h2>
            {!data?.recent_orders?.length ? (
              <EmptyState
                title="No orders in this range"
                description="Adjust the dates or place a new order."
              />
            ) : (
              <ul className="divide-y divide-brand-50">
                {data.recent_orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-bold text-ink">{o.order_number}</p>
                      <p className="text-xs text-muted">
                        {new Date(o.created_at).toLocaleString()} · Due {o.due_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">
                        ₹{Number(o.total_amount).toLocaleString()}
                      </span>
                      <OrderStatusBadge status={o.status} rejectionReason={o.rejection_reason} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
