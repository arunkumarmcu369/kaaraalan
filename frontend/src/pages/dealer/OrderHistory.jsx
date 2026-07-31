import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

export default function DealerOrderHistory() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [detail, setDetail] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page, pageSize],
    queryFn: () => myOrders({ page, page_size: pageSize }),
  })

  const meta = data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

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
  ]

  return (
    <div>
      <PageHeader title="Order history" subtitle="Track pending, approved, and rejected orders" />
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
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}
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
