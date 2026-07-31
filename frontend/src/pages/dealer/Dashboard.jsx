import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dealerSummary } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import EmptyState from '../../components/common/EmptyState'

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function DealerDashboard() {
  const defaults = useMemo(() => defaultRange(), [])
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['dealer-summary', dateFrom, dateTo],
    queryFn: () =>
      dealerSummary({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Input
          label="From Date"
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          label="To Date"
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

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
