import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { approveOrder, getStockMatrix, listDealers, listOrders, rejectOrder } from '../../api'
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

function StockAvailability({ available }) {
  if (available) {
    return <span className="whitespace-nowrap text-sm font-semibold text-brand-700">🟢 Available</span>
  }
  return <span className="whitespace-nowrap text-sm font-semibold text-danger">🔴 Not Available</span>
}

export default function AdminOrders() {
  const qc = useQueryClient()
  const { liveEvent } = useOutletContext() || {}
  const [status, setStatus] = useState('')
  const [dealerId, setDealerId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [successOpen, setSuccessOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const dealersQ = useQuery({ queryKey: ['dealers-mini'], queryFn: () => listDealers({ page_size: 100 }) })
  const ordersQ = useQuery({
    queryKey: ['orders', status, dealerId, page, pageSize],
    queryFn: () =>
      listOrders({
        page,
        page_size: pageSize,
        status: status || undefined,
        dealer_id: dealerId || undefined,
      }),
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

  const meta = ordersQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }
  const stockRows = stockQ.data?.rows || []

  const columns = useMemo(
    () => [
      { key: 'order_number', label: 'Order #' },
      { key: 'dealer_name', label: 'Dealer' },
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
        render: (r) =>
          r.status === 'pending' ? (
            <div className="flex flex-wrap justify-end gap-2 md:justify-start">
              <Button size="sm" onClick={() => approveM.mutate(r.id)} loading={approveM.isPending}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejectTarget(r)}>
                Reject
              </Button>
            </div>
          ) : (
            '—'
          ),
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
    [approveM.isPending, stockQ.data, stockRows]
  )

  return (
    <div>
      <PageHeader title="Orders" subtitle="Approve to deduct stock; reject with a reason" />
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
            label: d.dealer_name,
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
                <p className="font-bold text-ink">{detail.dealer_name}</p>
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
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectM.isPending}
              onClick={() => rejectM.mutate({ id: rejectTarget.id, reason })}
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
