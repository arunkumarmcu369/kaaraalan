import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createProduct,
  deactivateProduct,
  listProducts,
  permanentlyDeleteProduct,
  reactivateProduct,
  updateProduct,
} from '../../api'
import { FLAVOURS, formatFlavourLabel } from '../../constants/flavours'
import { LABEL_GLASS, LABEL_PET_220, LABEL_PET_300 } from '../../constants/labels'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'

const schema = z
  .object({
    name: z.string().min(1, 'Product name required'),
    product_type: z.enum(['glass', 'pet']),
    size_ml: z.coerce.number().optional().nullable(),
    price: z.coerce.number().positive('Price must be greater than 0'),
    stock: z.coerce.number().int().min(0),
    reorder_level: z.coerce.number().int().min(0),
  })
  .superRefine((data, ctx) => {
    if (data.product_type === 'pet' && ![220, 300].includes(Number(data.size_ml))) {
      ctx.addIssue({ code: 'custom', path: ['size_ml'], message: 'Select PET (220 ml) or PET (300 ml)' })
    }
  })

const emptyForm = { name: '', product_type: 'glass', size_ml: '', price: '', stock: 0, reorder_level: 10 }

const HISTORICAL_DELETE_MSG =
  'This product has historical records and cannot be deleted. Please deactivate it instead.'

export default function AdminProducts() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const productsQ = useQuery({
    queryKey: ['products', page, pageSize],
    queryFn: () => listProducts({ page, page_size: pageSize }),
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyForm,
  })
  const productType = useWatch({ control: form.control, name: 'product_type' })

  useEffect(() => {
    if (productType === 'glass') form.setValue('size_ml', null)
  }, [productType, form])

  const invalidateProductQueries = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['stocks'] })
    qc.invalidateQueries({ queryKey: ['stock-matrix'] })
    qc.invalidateQueries({ queryKey: ['admin-summary'] })
    qc.invalidateQueries({ queryKey: ['low-stock'] })
  }

  const patchProductActiveInCache = (id, isActive) => {
    qc.setQueriesData({ queryKey: ['products'] }, (old) => {
      if (!old?.items) return old
      return {
        ...old,
        items: old.items.map((item) => (item.id === id ? { ...item, is_active: isActive } : item)),
      }
    })
  }

  const saveM = useMutation({
    mutationFn: (data) => {
      const payload = {
        name: data.name,
        product_type: data.product_type,
        size_ml: data.product_type === 'pet' ? Number(data.size_ml) : null,
        price: Number(data.price),
        stock: Number(data.stock),
        reorder_level: Number(data.reorder_level),
      }
      return editing ? updateProduct(editing.id, payload) : createProduct(payload)
    },
    onSuccess: () => {
      invalidateProductQueries()
      closeModal()
    },
    onError: (e) => alert(e.response?.data?.detail || 'Save failed'),
  })

  const deactivateM = useMutation({
    mutationFn: (id) => deactivateProduct(id),
    onSuccess: (_data, id) => {
      patchProductActiveInCache(id, false)
      invalidateProductQueries()
      setDeactivateTarget(null)
      setSuccessMessage('Product deactivated successfully.')
    },
    onError: (e) => alert(e.response?.data?.detail || 'Deactivate failed'),
  })

  const reactivateM = useMutation({
    mutationFn: (id) => reactivateProduct(id),
    onSuccess: (_data, id) => {
      patchProductActiveInCache(id, true)
      invalidateProductQueries()
      setSuccessMessage('Product reactivated successfully.')
    },
    onError: (e) => alert(e.response?.data?.detail || 'Reactivate failed'),
  })

  const deleteM = useMutation({
    mutationFn: (id) => permanentlyDeleteProduct(id),
    onSuccess: (_data, id) => {
      qc.setQueriesData({ queryKey: ['products'] }, (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((item) => item.id !== id),
          meta: old.meta
            ? { ...old.meta, total: Math.max(0, (old.meta.total || 1) - 1) }
            : old.meta,
        }
      })
      invalidateProductQueries()
      setDeleteTarget(null)
      setSuccessMessage('Product deleted successfully.')
    },
    onError: (e) => {
      const detail = e.response?.data?.detail
      alert(typeof detail === 'string' ? detail : HISTORICAL_DELETE_MSG)
    },
  })

  const closeModal = () => {
    setOpen(false)
    setEditing(null)
    form.reset(emptyForm)
  }

  const openCreate = () => {
    setEditing(null)
    form.reset(emptyForm)
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    form.reset({
      name: row.name,
      product_type: row.product_type,
      size_ml: row.size_ml || '',
      price: Number(row.price),
      stock: row.stock,
      reorder_level: Number(row.reorder_level ?? 10),
    })
    setOpen(true)
  }

  const meta = productsQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Product Name' },
      {
        key: 'product_type',
        label: 'Product Type',
        render: (r) => (
          <Badge tone={r.product_type === 'pet' ? 'plastic' : 'glass'}>
            {r.product_type === 'pet' ? 'PET' : LABEL_GLASS}
          </Badge>
        ),
      },
      {
        key: 'size_label',
        label: 'Size',
        render: (r) => {
          if (r.product_type === 'pet') {
            if (Number(r.size_ml) === 300) return LABEL_PET_300
            if (Number(r.size_ml) === 220) return LABEL_PET_220
          }
          return r.product_type === 'glass' ? LABEL_GLASS : r.size_label || '—'
        },
      },
      {
        key: 'price',
        label: 'Price',
        render: (r) => `₹${Number(r.price).toFixed(2)}`,
      },
      {
        key: 'reorder_level',
        label: 'Low Stock Level',
        render: (r) => r.reorder_level ?? 0,
      },
      {
        key: 'is_active',
        label: 'Status',
        render: (r) => (
          <Badge tone={r.is_active ? 'active' : 'inactive'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        stopRowClick: true,
        render: (r) => (
          <div className="flex max-w-[18rem] flex-wrap justify-end gap-2 sm:max-w-none md:justify-start">
            <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
              Edit
            </Button>
            {r.is_active ? (
              <Button size="sm" variant="warn" onClick={() => setDeactivateTarget(r)}>
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                loading={reactivateM.isPending && reactivateM.variables === r.id}
                onClick={() => reactivateM.mutate(r.id)}
              >
                Reactivate
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setDeleteTarget(r)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [reactivateM.isPending, reactivateM.variables]
  )

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title="Products"
        subtitle="Manage GLASS and PET products"
        actions={
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            Add Product
          </Button>
        }
      />
      {productsQ.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="min-w-0 overflow-x-auto">
            <ResponsiveTable
              columns={columns}
              rows={productsQ.data?.items || []}
              empty={<EmptyState title="No products yet" description="Add your first product." />}
            />
          </div>
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
        open={open}
        onClose={closeModal}
        title={editing ? 'Edit Product' : 'Add Product'}
        onSubmit={form.handleSubmit((d) => {
          if (saveM.isPending) return
          saveM.mutate(d)
        })}
        footer={
          <Button type="submit" loading={saveM.isPending}>
            Save
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            className="sm:col-span-2"
            label="Flavour"
            placeholder="Select flavour"
            error={form.formState.errors.name?.message}
            options={FLAVOURS.map((f) => ({ value: f, label: formatFlavourLabel(f) }))}
            {...form.register('name')}
          />
          <Select
            label="Product Type"
            options={[
              { value: 'glass', label: LABEL_GLASS },
              { value: 'pet', label: 'PET' },
            ]}
            {...form.register('product_type')}
          />
          {productType === 'pet' && (
            <Select
              label="PET Size"
              placeholder="Select size"
              error={form.formState.errors.size_ml?.message}
              options={[
                { value: 220, label: LABEL_PET_220 },
                { value: 300, label: LABEL_PET_300 },
              ]}
              {...form.register('size_ml')}
            />
          )}
          <Input
            label="Price (₹)"
            type="number"
            step="0.01"
            error={form.formState.errors.price?.message}
            {...form.register('price')}
          />
          <Input
            label="Stock"
            type="number"
            error={form.formState.errors.stock?.message}
            {...form.register('stock')}
          />
          <Input
            className="sm:col-span-2"
            label="Low Stock Alert Level"
            type="number"
            error={form.formState.errors.reorder_level?.message}
            {...form.register('reorder_level')}
          />
        </div>
      </Modal>

      <Modal
        open={!!deactivateTarget}
        onClose={() => !deactivateM.isPending && setDeactivateTarget(null)}
        title="Deactivate Product?"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={deactivateM.isPending}
              onClick={() => setDeactivateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="warn"
              loading={deactivateM.isPending}
              onClick={() => deactivateM.mutate(deactivateTarget.id)}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This will set the product status to Inactive. It will no longer appear in dealer ordering
          screens or stock calculations. You can keep it for records.
        </p>
        {deactivateTarget?.name && (
          <p className="mt-3 text-sm font-semibold text-ink">
            {deactivateTarget.name}
            {deactivateTarget.size_label ? ` · ${deactivateTarget.size_label}` : ''}
          </p>
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteM.isPending && setDeleteTarget(null)}
        title="Delete Product?"
        footer={
          <>
            <Button variant="secondary" disabled={deleteM.isPending} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteM.isPending}
              onClick={() => deleteM.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Are you sure you want to permanently delete this product?
        </p>
        {deleteTarget?.name && (
          <p className="mt-3 text-sm font-semibold text-ink">
            {deleteTarget.name}
            {deleteTarget.size_label ? ` · ${deleteTarget.size_label}` : ''}
          </p>
        )}
      </Modal>

      <Modal
        open={!!successMessage}
        onClose={() => setSuccessMessage('')}
        title="Success"
        footer={<Button onClick={() => setSuccessMessage('')}>OK</Button>}
      >
        <p className="text-sm text-ink">{successMessage}</p>
      </Modal>
    </div>
  )
}
