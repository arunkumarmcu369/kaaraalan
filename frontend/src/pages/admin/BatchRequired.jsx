import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { batchRequired } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'

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

export default function AdminBatchRequired() {
  const [range, setRange] = useState('today')
  const [selectedDate, setSelectedDate] = useState('')

  const filterParams = selectedDate ? { date: selectedDate } : { range }

  const batchQ = useQuery({
    queryKey: ['batch-required', filterParams],
    queryFn: () => batchRequired(filterParams),
  })

  const data = batchQ.data || {}
  const flavours = data.flavours || []

  return (
    <div>
      <PageHeader
        title="Batch Required"
        subtitle="Syrup batches needed by flavour from approved orders"
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

      {batchQ.isLoading ? (
        <Spinner />
      ) : batchQ.error ? (
        <EmptyState title="Could not load batch data" description="Please try again." />
      ) : (
        <div className="space-y-5">
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
