import { useMemo, useState } from 'react'
import Select from './Select'
import Input from './Input'

export const REPORT_PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Date Range' },
]

/** Local calendar date as YYYY-MM-DD */
function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Resolve a period selection into inclusive date_from / date_to (YYYY-MM-DD). */
export function resolvePeriodDates(range, dateFrom = '', dateTo = '') {
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  if (range === 'custom') {
    return {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }
  }

  if (range === 'today') {
    const iso = toISODate(today)
    return { date_from: iso, date_to: iso }
  }

  if (range === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const iso = toISODate(y)
    return { date_from: iso, date_to: iso }
  }

  const days = range === '30d' ? 30 : 7
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return { date_from: toISODate(from), date_to: toISODate(today) }
}

/**
 * Shared report-period state for every analytics / listing page.
 * API params use: { range, date_from?, date_to? }
 */
export function useReportPeriod(defaultRange = '7d') {
  const [range, setRange] = useState(defaultRange)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = useMemo(() => {
    if (range === 'custom') {
      return {
        range: 'custom',
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }
    }
    return { range }
  }, [range, dateFrom, dateTo])

  const dateBounds = useMemo(
    () => resolvePeriodDates(range, dateFrom, dateTo),
    [range, dateFrom, dateTo]
  )

  const isValid =
    range !== 'custom' || (Boolean(dateFrom) && Boolean(dateTo) && dateFrom <= dateTo)

  const onRangeChange = (next) => {
    setRange(next)
    if (next !== 'custom') {
      setDateFrom('')
      setDateTo('')
    }
  }

  return {
    range,
    setRange: onRangeChange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    params,
    dateBounds,
    isValid,
  }
}

/**
 * Standard Report Period filter used across the admin/dealer portals.
 */
export default function ReportPeriodFilter({
  range,
  onRangeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  title = 'Report period',
  className = '',
  error = '',
}) {
  return (
    <section className={`rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-brand-100 sm:p-6 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Select
          label="Date filter"
          value={range}
          onChange={(e) => onRangeChange?.(e.target.value)}
          options={REPORT_PERIOD_OPTIONS}
          className="w-52"
        />
        {range === 'custom' && (
          <>
            <Input
              label="From"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => onDateFromChange?.(e.target.value)}
              className="w-44"
            />
            <Input
              label="To"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => onDateToChange?.(e.target.value)}
              className="w-44"
            />
          </>
        )}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
    </section>
  )
}
