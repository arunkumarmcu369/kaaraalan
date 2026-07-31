import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import LottieAnimation from '../../components/common/LottieAnimation'
import { createDealer, deleteDealer, listDealers } from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import successAnim from '../../assets/lottie/success.json'

const schema = z.object({
  dealer_name: z.string().min(2),
  shop_name: z.string().optional(),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  gst_number: z.string().optional(),
})

export default function AdminDealers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [open, setOpen] = useState(false)
  const [creds, setCreds] = useState(null)

  const dealersQ = useQuery({
    queryKey: ['dealers', search, page, pageSize],
    queryFn: () => listDealers({ search: search || undefined, page, page_size: pageSize }),
  })

  const form = useForm({ resolver: zodResolver(schema) })
  const meta = dealersQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const createM = useMutation({
    mutationFn: createDealer,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setOpen(false)
      form.reset()
      setCreds(data)
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed'),
  })

  const columns = [
    { key: 'dealer_name', label: 'Dealer' },
    { key: 'shop_name', label: 'Shop', render: (r) => r.shop_name || '—' },
    { key: 'phone', label: 'Phone' },
    { key: 'username', label: 'Username' },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => <Badge tone={r.is_active ? 'active' : 'inactive'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm('Deactivate this dealer?')) {
              deleteDealer(r.id).then(() => qc.invalidateQueries({ queryKey: ['dealers'] }))
            }
          }}
        >
          Deactivate
        </Button>
      ),
    },
  ]

  const copyCreds = async () => {
    if (!creds) return
    await navigator.clipboard.writeText(`Username: ${creds.username}\nPassword: ${creds.password}`)
    alert('Copied to clipboard')
  }

  return (
    <div>
      <PageHeader
        title="Dealers"
        subtitle="Onboard retailers and issue one-time credentials"
        actions={<Button onClick={() => setOpen(true)}>Onboard dealer</Button>}
      />
      <Input
        className="mb-4 max-w-md"
        placeholder="Search name, shop, phone…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
      />
      {dealersQ.isLoading ? (
        <Spinner />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={dealersQ.data?.items || []}
            empty={<EmptyState title="No dealers" description="Onboard your first retailer." />}
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
        onClose={() => setOpen(false)}
        title="Onboard dealer"
        size="lg"
        footer={
          <Button loading={createM.isPending} onClick={form.handleSubmit((d) => createM.mutate({
            ...d,
            email: d.email || null,
          }))}>
            Create dealer
          </Button>
        }
      >
        <form className="grid gap-3 sm:grid-cols-2">
          <Input label="Dealer name" error={form.formState.errors.dealer_name?.message} {...form.register('dealer_name')} />
          <Input label="Shop name" {...form.register('shop_name')} />
          <Input label="Phone" error={form.formState.errors.phone?.message} {...form.register('phone')} />
          <Input label="Email" error={form.formState.errors.email?.message} {...form.register('email')} />
          <Input label="GST number" className="sm:col-span-2" {...form.register('gst_number')} />
          <Input label="Address" className="sm:col-span-2" {...form.register('address')} />
        </form>
      </Modal>

      <Modal
        open={!!creds}
        onClose={() => setCreds(null)}
        title="Save these credentials"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>
              Copy
            </Button>
            <Button onClick={() => setCreds(null)}>Done</Button>
          </>
        }
      >
        <div className="mx-auto h-28 w-28">
          <LottieAnimation animationData={successAnim} loop={false} />
        </div>
        <p className="mb-3 text-center text-sm text-muted">
          These credentials will not be shown again.
        </p>
        <div className="space-y-2 rounded-xl bg-brand-50 p-4 font-mono text-sm">
          <p>
            <span className="font-sans font-bold text-muted">Username:</span> {creds?.username}
          </p>
          <p>
            <span className="font-sans font-bold text-muted">Password:</span> {creds?.password}
          </p>
        </div>
      </Modal>
    </div>
  )
}
