import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listProducts, updateProduct } from '../../api'
import { LABEL_GLASS, LABEL_PET_220, LABEL_PET_300 } from '../../constants/labels'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'

export default function AdminPrices() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [target, setTarget] = useState(null)
  const [price, setPrice] = useState('')

  const productsQ = useQuery({
    queryKey: ['products', page, pageSize],
    queryFn: () => listProducts({ page, page_size: pageSize, active_only: true }),
  })

  const updateM = useMutation({
    mutationFn: ({ id, price }) => updateProduct(id, { price: Number(price) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setTarget(null)
    },
    onError: (e) => alert(e.response?.data?.detail || 'Update failed'),
  })

  const meta = productsQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Product' },
      {
        key: 'product_type',
        label: 'Type',
        render: (r) => (
          <Badge tone={r.product_type === 'pet' ? 'plastic' : 'glass'}>
            {r.product_type === 'pet' ? 'PET' : LABEL_GLASS}
          </Badge>
        ),
      },
      { key: 'size_label', label: 'Size', render: (r) => {
        if (r.product_type === 'pet' || r.bottle_type === 'pet' || r.bottle_type === 'plastic') {
          if (Number(r.size_ml) === 300) return LABEL_PET_300
          if (Number(r.size_ml) === 220) return LABEL_PET_220
        }
        return r.size_label || '—'
      }},
      { key: 'sku', label: 'SKU' },
      {
        key: 'price',
        label: 'Price',
        render: (r) => `₹${Number(r.price).toFixed(2)}`,
      },
      {
        key: 'actions',
        label: 'Actions',
        stopRowClick: true,
        render: (r) => (
          <Button
            size="sm"
            onClick={() => {
              setTarget(r)
              setPrice(String(r.price))
            }}
          >
            Edit price
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div>
      <PageHeader title="Prices" subtitle="Update product pricing without changing stock" />
      {productsQ.isLoading ? (
        <Spinner />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={productsQ.data?.items || []}
            empty={<EmptyState title="No priced products" description="Add products first." />}
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
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Edit price — ${target?.sku || ''}`}
        footer={
          <Button loading={updateM.isPending} onClick={() => updateM.mutate({ id: target.id, price })}>
            Save price
          </Button>
        }
      >
        <Input
          label="Price (₹)"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </Modal>
    </div>
  )
}
