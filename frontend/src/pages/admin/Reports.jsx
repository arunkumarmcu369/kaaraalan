import { useState } from 'react'
import { downloadDailyReport } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'

export default function AdminReports() {
  const period = useReportPeriod('today')
  const [exporting, setExporting] = useState(null)
  const [error, setError] = useState('')

  const exportReport = async (format) => {
    if (!period.isValid) {
      setError('Select a valid custom date range.')
      return
    }
    setError('')
    setExporting(format)
    try {
      await downloadDailyReport(period.params, format)
    } catch (e) {
      const detail = e.response?.data?.detail
      if (detail && typeof detail === 'string') {
        setError(detail)
      } else if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text()
          const parsed = JSON.parse(text)
          setError(parsed.detail || `Failed to export ${format.toUpperCase()}`)
        } catch {
          setError(`Failed to export ${format.toUpperCase()}`)
        }
      } else {
        setError(e.message || `Failed to export ${format.toUpperCase()}`)
      }
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Daily Reports"
        subtitle="Generate printable reports and export business data."
      />

      <ReportPeriodFilter
        range={period.range}
        onRangeChange={(value) => {
          period.setRange(value)
          setError('')
        }}
        dateFrom={period.dateFrom}
        onDateFromChange={period.setDateFrom}
        dateTo={period.dateTo}
        onDateToChange={period.setDateTo}
        error={error || (!period.isValid ? 'Select a valid custom date range.' : '')}
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-brand-100">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Export PDF</p>
          <p className="mt-3 text-2xl font-extrabold text-ink">
            {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </p>
          <p className="mt-2 text-sm text-muted">
            Printable daily business report with logo, tables, and page numbers.
          </p>
          <div className="mt-5">
            <Button
              loading={exporting === 'pdf'}
              disabled={!!exporting || !period.isValid}
              onClick={() => exportReport('pdf')}
            >
              Export PDF
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-brand-100">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Export CSV</p>
          <p className="mt-3 text-2xl font-extrabold text-ink">
            {exporting === 'csv' ? 'Preparing…' : 'Download CSV'}
          </p>
          <p className="mt-2 text-sm text-muted">
            UTF-8 spreadsheet compatible with Microsoft Excel.
          </p>
          <div className="mt-5">
            <Button
              variant="secondary"
              loading={exporting === 'csv'}
              disabled={!!exporting || !period.isValid}
              onClick={() => exportReport('csv')}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-brand-50/70 p-5 ring-1 ring-brand-100">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Included in every export</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>1. Dashboard summary</li>
          <li>2. Order summary</li>
          <li>3. Current stock</li>
          <li>4. Batch production summary</li>
          <li>5. Stock update history</li>
        </ul>
      </section>
    </div>
  )
}
