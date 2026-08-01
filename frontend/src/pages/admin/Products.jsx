import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProduct, deleteProduct, listProducts, updateProduct } from '../../api'
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
  })
  .superRefine((data, ctx) => {
    if (data.product_type === 'pet' && ![220, 300].includes(Number(data.size_ml))) {
      ctx.addIssue({ code: 'custom', path: ['size_ml'], message: 'Select PET (220 ml) or PET (300 ml)' })
    }
  })

const emptyForm = { name: '', product_type: 'glass', size_ml: '', price: '', stock: 0 }

export default function AdminProducts() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

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

  const saveM = useMutation({
    mutationFn: (data) => {
      const payload = {
        name: data.name,
        product_type: data.product_type,
        size_ml: data.product_type === 'pet' ? Number(data.size_ml) : null,
        price: Number(data.price),
        stock: Number(data.stock),
      }
      return editing ? updateProduct(editing.id, payload) : createProduct(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      closeModal()
    },
    onError: (e) => alert(e.response?.data?.detail || 'Save failed'),
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
        key: 'actions',
        label: 'Actions',
        stopRowClick: true,
        render: (r) => (
          <div className="flex flex-wrap justify-end gap-2 md:justify-start">
            <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirm('Deactivate this product?')) {
                  deleteProduct(r.id).then(() => qc.invalidateQueries({ queryKey: ['products'] }))
                }
              }}
            >
              Deactivate
            </Button>
          </div>
        ),
      },
    ],
    [qc]
  )

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage GLASS and PET products"
        actions={<Button onClick={openCreate}>Add Product</Button>}
      />
      {productsQ.isLoading ? (
        <Spinner />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={productsQ.data?.items || []}
            empty={<EmptyState title="No products yet" description="Add your first product." />}
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
        open={open}
        onClose={closeModal}
        title={editing ? 'Edit Product' : 'Add Product'}
        footer={
          <Button loading={saveM.isPending} onClick={form.handleSubmit((d) => saveM.mutate(d))}>
            Save
          </Button>
        }
      >
        <form className="space-y-3">
          <Select
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
        </form>
      </Modal>
    </div>
  )
}
