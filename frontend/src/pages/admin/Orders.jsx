import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { approveOrder, fulfillOrder, getStockMatrix, listDealers, listOrders, rejectOrder, downloadOrdersPdf } from '../../api'
import { buildOrderMatrix, isOrderStockAvailable } from '../../utils/orderMatrix'
import PageHeader from '../../components/common/PageHeader'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import OrderMatrixTable from '../../components/table/OrderMatrixTable'
import { MrpDisplayTable } from '../../components/table/MrpTable'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import Button from '../../components/common/Button'
import Select from '../../components/common/Select'
import Input from '../../components/common/Input'
import Modal from '../../components/common/Modal'
import EmptyState from '../../components/common/EmptyState'
import Spinner from '../../components/common/Spinner'
import OrderApprovedIllustration from '../../components/common/OrderApprovedIllustration'
import { formatDealerName } from '../../utils/formatDealerName'
import ReportPeriodFilter, { REPORT_PERIOD_OPTIONS, useReportPeriod } from '../../components/common/ReportPeriodFilter'

function StockAvailability({ available }) {
  if (available) {
    return <span className="whitespace-nowrap text-sm font-semibold text-brand-700">🟢 Available</span>
  }
  return <span className="whitespace-nowrap text-sm font-semibold text-danger">🔴 Not Available</span>
}

function OrderTimeline({ order }) {
  const steps = [
    { key: 'pending', label: 'Placed', at: order.created_at },
    {
      key: 'approved',
      label: 'Approved',
      at: order.status === 'approved' || order.status === 'fulfilled' ? order.reviewed_at : null,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      at: order.status === 'rejected' ? order.reviewed_at : null,
      hide: order.status !== 'rejected' && order.status !== 'pending',
    },
    {
      key: 'fulfilled',
      label: 'Fulfilled',
      at: order.status === 'fulfilled' ? order.reviewed_at : null,
      hide: order.status === 'rejected',
    },
  ].filter((s) => !s.hide)

  const active = String(order.status || '').toLowerCase()
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Timeline</p>
      <ol className="space-y-2">
        {steps.map((s) => {
          const done =
            s.key === 'pending' ||
            (s.key === 'approved' && (active === 'approved' || active === 'fulfilled')) ||
            (s.key === 'rejected' && active === 'rejected') ||
            (s.key === 'fulfilled' && active === 'fulfilled')
          return (
            <li key={s.key} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${done ? 'bg-brand-600' : 'bg-brand-200'}`} />
              <div>
                <p className={`font-semibold ${done ? 'text-ink' : 'text-muted'}`}>{s.label}</p>
                {s.at && (
                  <p className="text-xs text-muted">{new Date(s.at).toLocaleString()}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function AdminOrders() {
  const qc = useQueryClient()
  const { liveEvent } = useOutletContext() || {}
  const period = useReportPeriod('30d')
  const [status, setStatus] = useState('')
  const [dealerId, setDealerId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [successOpen, setSuccessOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const dealersQ = useQuery({ queryKey: ['dealers-mini'], queryFn: () => listDealers({ page_size: 100 }) })
  const ordersQ = useQuery({
    queryKey: ['orders', status, dealerId, page, pageSize, period.dateBounds],
    queryFn: () =>
      listOrders({
        page,
        page_size: pageSize,
        status: status || undefined,
        dealer_id: dealerId || undefined,
        date_from: period.dateBounds.date_from,
        date_to: period.dateBounds.date_to,
      }),
    enabled: period.isValid,
  })

  // Live stock levels for the Stock column (refreshes so the indicator stays current)
  const stockQ = useQuery({
    queryKey: ['stock-matrix'],
    queryFn: getStockMatrix,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (liveEvent?.type === 'order_updated' || liveEvent?.type === 'new_order') {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stock-matrix'] })
    }
  }, [liveEvent, qc])

  const approveM = useMutation({
    mutationFn: approveOrder,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stock-matrix'] })
      setSuccessOpen(true)
      setDetail(data)
    },
    onError: (e) => alert(e.response?.data?.detail || 'Approve failed'),
  })

  const rejectM = useMutation({
    mutationFn: ({ id, reason }) => rejectOrder(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setRejectTarget(null)
      setReason('')
      setDetail(null)
    },
    onError: (e) => alert(e.response?.data?.detail || 'Reject failed'),
  })

  const fulfillM = useMutation({
    mutationFn: fulfillOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setDetail(null)
    },
    onError: (e) => alert(e.response?.data?.detail || 'Fulfill failed'),
  })

  const exportCsv = () => {
    const rows = ordersQ.data?.items || []
    const header = ['order_number', 'dealer_name', 'status', 'due_date', 'total_quantity', 'total_amount', 'created_at']
    const lines = [header.join(',')]
    for (const r of rows) {
      const qty = r.total_quantity ?? r.items?.reduce((s, i) => s + i.quantity, 0) ?? 0
      lines.push(
        [
          r.order_number,
          `"${formatDealerName(r.dealer_name).replace(/"/g, '""')}"`,
          r.status,
          r.due_date,
          qty,
          r.total_amount,
          r.created_at,
        ].join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = async () => {
    if (!period.isValid) return
    setExportingPdf(true)
    try {
      const periodLabel =
        REPORT_PERIOD_OPTIONS.find((o) => o.value === period.range)?.label || period.range
      await downloadOrdersPdf({
        status: status || undefined,
        dealer_id: dealerId || undefined,
        date_from: period.dateBounds.date_from,
        date_to: period.dateBounds.date_to,
        period_label: periodLabel,
      })
    } catch (e) {
      let message = e.message || 'Failed to export PDF'
      const data = e.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          const parsed = JSON.parse(text)
          if (parsed?.detail) message = parsed.detail
        } catch {
          /* keep fallback */
        }
      } else if (typeof data?.detail === 'string') {
        message = data.detail
      }
      alert(message)
    } finally {
      setExportingPdf(false)
    }
  }

  const meta = ordersQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }
  const stockRows = stockQ.data?.rows || []
  const hasOrders = (ordersQ.data?.meta?.total ?? ordersQ.data?.items?.length ?? 0) > 0

  const columns = useMemo(
    () => [
      { key: 'order_number', label: 'Order #' },
      {
        key: 'dealer_name',
        label: 'Dealer',
        render: (r) => formatDealerName(r.dealer_name),
      },
      {
        key: 'total_quantity',
        label: 'Qty',
        render: (r) => r.total_quantity ?? r.items?.reduce((s, i) => s + i.quantity, 0),
      },
      { key: 'due_date', label: 'Due' },
      {
        key: 'status',
        label: 'Status',
        render: (r) => (
          <OrderStatusBadge status={r.status} rejectionReason={r.rejection_reason} />
        ),
      },
      {
        key: 'total_amount',
        label: 'Amount',
        render: (r) => `₹${Number(r.total_amount).toLocaleString()}`,
      },
      {
        key: 'actions',
        label: 'Actions',
        stopRowClick: true,
        render: (r) => {
          if (r.status === 'pending') {
            return (
              <div className="flex flex-wrap justify-end gap-2 md:justify-start">
                <Button size="sm" onClick={() => approveM.mutate(r.id)} loading={approveM.isPending}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectTarget(r)}>
                  Reject
                </Button>
              </div>
            )
          }
          if (r.status === 'approved') {
            return (
              <Button size="sm" variant="secondary" onClick={() => fulfillM.mutate(r.id)} loading={fulfillM.isPending}>
                Fulfill
              </Button>
            )
          }
          return '—'
        },
      },
      {
        key: 'stock',
        label: 'Stock',
        render: (r) => {
          if (r.status !== 'pending') return '—'
          if (!stockQ.data) return <span className="text-muted">…</span>
          return (
            <StockAvailability available={isOrderStockAvailable(r.items || [], stockRows)} />
          )
        },
      },
    ],
    [approveM.isPending, fulfillM.isPending, stockQ.data, stockRows]
  )

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Approve to deduct stock; fulfill when dispatched"
        actions={
          <>
            <Button
              loading={exportingPdf}
              disabled={exportingPdf || !period.isValid || !hasOrders}
              onClick={exportPdf}
            >
              Export PDF
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!ordersQ.data?.items?.length}>
              Export CSV
            </Button>
          </>
        }
      />
      <ReportPeriodFilter
        className="mb-4"
        range={period.range}
        onRangeChange={(value) => {
          period.setRange(value)
          setPage(1)
        }}
        dateFrom={period.dateFrom}
        onDateFromChange={(value) => {
          period.setDateFrom(value)
          setPage(1)
        }}
        dateTo={period.dateTo}
        onDateToChange={(value) => {
          period.setDateTo(value)
          setPage(1)
        }}
        error={!period.isValid ? 'Select a valid custom date range.' : ''}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          placeholder="All statuses"
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'fulfilled', label: 'Fulfilled' },
          ]}
        />
        <Select
          label="Dealer"
          value={dealerId}
          onChange={(e) => {
            setDealerId(e.target.value)
            setPage(1)
          }}
          placeholder="All dealers"
          options={(dealersQ.data?.items || []).map((d) => ({
            value: d.id,
            label: formatDealerName(d.dealer_name),
          }))}
        />
      </div>
      {ordersQ.isLoading ? (
        <Spinner />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={ordersQ.data?.items || []}
            onRowClick={setDetail}
            empty={<EmptyState title="No orders" description="Orders from dealers will appear here." />}
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Order details" size="xl">
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Dealer name</p>
                <p className="font-bold text-ink">{formatDealerName(detail.dealer_name)}</p>
                {detail.shop_name && <p className="text-sm text-muted">{detail.shop_name}</p>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Order date</p>
                <p className="font-medium text-ink">{new Date(detail.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Order ID</p>
                <p className="font-semibold text-ink">{detail.order_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p>
                <OrderStatusBadge
                  status={detail.status}
                  rejectionReason={detail.rejection_reason}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Order table</p>
              <OrderMatrixTable rows={buildOrderMatrix(detail.items || [])} />
            </div>

            <MrpDisplayTable
              mrp_glass={detail.mrp_glass}
              mrp_pet_300={detail.mrp_pet_300}
              mrp_pet_220={detail.mrp_pet_220}
            />

            <div className="flex items-center justify-between border-t border-brand-100 pt-3">
              <p className="text-sm text-muted">Due {detail.due_date}</p>
              <p className="text-lg font-extrabold text-ink">
                Total: ₹{Number(detail.total_amount).toLocaleString()}
              </p>
            </div>

            {detail.status === 'pending' && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => setRejectTarget(detail)}>
                  Reject
                </Button>
                <Button onClick={() => approveM.mutate(detail.id)} loading={approveM.isPending}>
                  Approve
                </Button>
              </div>
            )}
            {detail.status === 'approved' && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => fulfillM.mutate(detail.id)} loading={fulfillM.isPending}>
                  Mark fulfilled
                </Button>
              </div>
            )}
            {detail.status === 'rejected' && detail.rejection_reason && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
                Rejection reason: {detail.rejection_reason}
              </p>
            )}
            <OrderTimeline order={detail} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject order"
        onSubmit={() => {
          if (rejectM.isPending || !rejectTarget || reason.trim().length < 3) return
          rejectM.mutate({ id: rejectTarget.id, reason })
        }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={rejectM.isPending}
              disabled={reason.trim().length < 3}
            >
              Reject
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Rejecting {rejectTarget?.order_number} — stock will not change.
        </p>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal open={successOpen} onClose={() => setSuccessOpen(false)} title="Order approved">
        <div className="flex flex-col items-center gap-4 px-2 py-2 text-center">
          <OrderApprovedIllustration />
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Stock deducted and order marked approved.
          </p>
        </div>
      </Modal>
    </div>
  )
}
