import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { myOrders } from '../../api'
import { buildOrderMatrix } from '../../utils/orderMatrix'
import PageHeader from '../../components/common/PageHeader'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import OrderMatrixTable from '../../components/table/OrderMatrixTable'
import { MrpDisplayTable } from '../../components/table/MrpTable'
import ReportPeriodFilter, { useReportPeriod } from '../../components/common/ReportPeriodFilter'

function OrderTimeline({ order }) {
  const active = String(order.status || '').toLowerCase()
  const steps = [
    { key: 'pending', label: 'Placed', at: order.created_at },
    {
      key: 'reviewed',
      label: active === 'rejected' ? 'Rejected' : 'Approved',
      at:
        active === 'approved' || active === 'fulfilled' || active === 'rejected'
          ? order.reviewed_at
          : null,
    },
    {
      key: 'fulfilled',
      label: 'Fulfilled',
      at: active === 'fulfilled' ? order.reviewed_at : null,
      hide: active === 'rejected',
    },
  ].filter((s) => !s.hide)

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Timeline</p>
      <ol className="space-y-2">
        {steps.map((s) => {
          const done =
            s.key === 'pending' ||
            (s.key === 'reviewed' && s.at) ||
            (s.key === 'fulfilled' && active === 'fulfilled')
          return (
            <li key={s.key} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${done ? 'bg-brand-600' : 'bg-brand-200'}`} />
              <div>
                <p className={`font-semibold ${done ? 'text-ink' : 'text-muted'}`}>{s.label}</p>
                {s.at && <p className="text-xs text-muted">{new Date(s.at).toLocaleString()}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      {active === 'rejected' && order.rejection_reason && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          Reason: {order.rejection_reason}
        </p>
      )}
    </div>
  )
}

export default function DealerOrderHistory() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { liveEvent } = useOutletContext() || {}
  const period = useReportPeriod('30d')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [detail, setDetail] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page, pageSize, period.dateBounds],
    queryFn: () =>
      myOrders({
        page,
        page_size: pageSize,
        date_from: period.dateBounds.date_from,
        date_to: period.dateBounds.date_to,
      }),
    enabled: period.isValid,
  })

  useEffect(() => {
    if (liveEvent?.type === 'order_updated') {
      qc.invalidateQueries({ queryKey: ['my-orders'] })
      qc.invalidateQueries({ queryKey: ['dealer-summary'] })
      setDetail((prev) =>
        prev && String(prev.id) === String(liveEvent.order_id)
          ? { ...prev, status: liveEvent.status, rejection_reason: liveEvent.rejection_reason }
          : prev
      )
    }
  }, [liveEvent, qc])

  const meta = data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const reorder = (order) => {
    navigate('/dashboard/stock', {
      state: {
        reorder: {
          items: order.items || [],
          mrp_glass: order.mrp_glass,
          mrp_pet_300: order.mrp_pet_300,
          mrp_pet_220: order.mrp_pet_220,
        },
      },
    })
  }

  const columns = [
    { key: 'order_number', label: 'Order #' },
    { key: 'due_date', label: 'Due date' },
    {
      key: 'total_quantity',
      label: 'Qty',
      render: (r) => r.total_quantity ?? r.items?.reduce((s, i) => s + i.quantity, 0),
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (r) => `₹${Number(r.total_amount).toLocaleString()}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <OrderStatusBadge status={r.status} rejectionReason={r.rejection_reason} />
      ),
    },
    {
      key: 'created_at',
      label: 'Placed',
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: '',
      stopRowClick: true,
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => reorder(r)}>
          Reorder
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Order history" subtitle="Track pending, approved, rejected, and fulfilled orders" />
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
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={data?.items || []}
            onRowClick={setDetail}
            empty={
              <EmptyState title="No orders yet" description="Orders you place will show up here." />
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

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Order details"
        size="xl"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && (
              <Button
                onClick={() => {
                  reorder(detail)
                  setDetail(null)
                }}
              >
                Reorder
              </Button>
            )}
          </div>
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Order ID</p>
                <p className="font-semibold text-ink">{detail.order_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Order date</p>
                <p className="font-medium text-ink">{new Date(detail.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Due date</p>
                <p className="font-medium text-ink">{detail.due_date}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p>
                <OrderStatusBadge
                  status={detail.status}
                  rejectionReason={detail.rejection_reason}
                />
              </div>
            </div>

            <OrderTimeline order={detail} />

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
          </div>
        )}
      </Modal>
    </div>
  )
}
