import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminSummary, salesTrend } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import StackedLineChart from '../../components/charts/StackedLineChart'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'

export default function AdminDashboard() {
  const { liveEvent } = useOutletContext() || {}
  const [range, setRange] = useState('7d')
  const [selectedDate, setSelectedDate] = useState('')

  const filterParams = selectedDate
    ? { date: selectedDate }
    : { range }

  const summaryQ = useQuery({
    queryKey: ['admin-summary', filterParams],
    queryFn: () => adminSummary(filterParams),
    refetchInterval: liveEvent ? false : 30000,
  })
  const trendQ = useQuery({
    queryKey: ['sales-trend', filterParams],
    queryFn: () => salesTrend(filterParams),
    refetchInterval: liveEvent ? false : 30000,
  })

  useEffect(() => {
    if (liveEvent?.type === 'order_updated' || liveEvent?.type === 'new_order') {
      summaryQ.refetch()
      trendQ.refetch()
    }
  }, [liveEvent])

  if (summaryQ.isLoading) return <Spinner />

  const s = summaryQ.data || {}

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Simplifying Goli Soda operations every day"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={range}
              onChange={(e) => {
                setRange(e.target.value)
                setSelectedDate('')
              }}
              options={[
                { value: 'today', label: 'Today' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ]}
              className="w-40"
            />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
              aria-label="Select date"
            />
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Pending orders" value={s.pending_orders ?? 0} tone="warn" />
        <StatCard label="Orders" value={s.todays_orders ?? 0} tone="sky" />
        <StatCard
          label="Revenue"
          value={`₹${Number(s.revenue || 0).toLocaleString()}`}
          hint={`${s.active_dealers ?? 0} active dealers`}
        />
      </div>
      <section className="mt-6 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Bottles sold</h2>
          <span className="text-xs font-semibold text-muted">Stacked by bottle type · live</span>
        </div>
        {trendQ.isLoading ? (
          <Spinner />
        ) : (
          <StackedLineChart
            categories={trendQ.data?.categories || []}
            series={trendQ.data?.series || []}
          />
        )}
      </section>
    </div>
  )
}
