import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import BrandLogo from '../../components/common/BrandLogo'
import {
  createDealer,
  deactivateDealer,
  deleteDealer,
  listDealers,
  reactivateDealer,
  updateDealer,
} from '../../api'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import PasswordInput from '../../components/common/PasswordInput'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import ResponsiveTable from '../../components/table/ResponsiveTable'
import Pagination from '../../components/table/Pagination'
import { formatDealerName } from '../../utils/formatDealerName'

const HISTORICAL_DELETE_MSG =
  'This dealer has historical records and cannot be deleted. Please deactivate instead.'

const createSchema = z.object({
  dealer_name: z.string().min(2, 'Dealer name required'),
  shop_name: z.string().optional(),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
})

const editSchema = z.object({
  dealer_name: z.string().min(2, 'Dealer name required'),
  shop_name: z.string().optional(),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  current_password: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
})

export default function AdminDealers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [creds, setCreds] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const dealersQ = useQuery({
    queryKey: ['dealers', search, page, pageSize],
    queryFn: () => listDealers({ search: search || undefined, page, page_size: pageSize }),
  })

  const createForm = useForm({ resolver: zodResolver(createSchema) })
  const editForm = useForm({ resolver: zodResolver(editSchema) })
  const meta = dealersQ.data?.meta || { page: 1, page_size: pageSize, total: 0, total_pages: 1 }

  const patchDealerActiveInCache = (id, isActive) => {
    qc.setQueriesData({ queryKey: ['dealers'] }, (old) => {
      if (!old?.items) return old
      return {
        ...old,
        items: old.items.map((d) => (d.id === id ? { ...d, is_active: isActive } : d)),
      }
    })
  }

  const createM = useMutation({
    mutationFn: createDealer,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setOpen(false)
      createForm.reset()
      setCreds({
        username: data.username,
        password: data.password,
        dealer_name: data.dealer?.dealer_name,
      })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to create dealer'),
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }) => updateDealer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setEditing(null)
      editForm.reset()
    },
    onError: (e) => {
      alert(e.response?.data?.detail || 'Update failed')
    },
  })

  const deactivateM = useMutation({
    mutationFn: (id) => deactivateDealer(id),
    onSuccess: (_data, id) => {
      patchDealerActiveInCache(id, false)
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setDeactivateTarget(null)
      setSuccessMessage('Dealer deactivated successfully.')
    },
    onError: (e) => alert(e.response?.data?.detail || 'Deactivate failed'),
  })

  const reactivateM = useMutation({
    mutationFn: (id) => reactivateDealer(id),
    onSuccess: (_data, id) => {
      patchDealerActiveInCache(id, true)
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setSuccessMessage('Dealer reactivated successfully.')
    },
    onError: (e) => alert(e.response?.data?.detail || 'Reactivate failed'),
  })

  const deleteM = useMutation({
    mutationFn: (id) => deleteDealer(id),
    onSuccess: (_data, id) => {
      qc.setQueriesData({ queryKey: ['dealers'] }, (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((d) => d.id !== id),
          meta: old.meta
            ? { ...old.meta, total: Math.max(0, (old.meta.total || 1) - 1) }
            : old.meta,
        }
      })
      qc.invalidateQueries({ queryKey: ['dealers'] })
      setDeleteTarget(null)
      setSuccessMessage('Dealer deleted successfully.')
    },
    onError: (e) => {
      const detail = e.response?.data?.detail
      alert(typeof detail === 'string' ? detail : HISTORICAL_DELETE_MSG)
    },
  })

  const openEdit = (row) => {
    setEditing(row)
    editForm.reset({
      dealer_name: row.dealer_name || '',
      shop_name: row.shop_name || '',
      phone: row.phone || '',
      email: row.email || '',
      username: row.username || '',
      current_password: row.password || '',
      password: '',
    })
  }

  const columns = useMemo(
    () => [
      {
        key: 'dealer_name',
        label: 'Dealer Name',
        render: (r) => formatDealerName(r.dealer_name),
      },
      { key: 'shop_name', label: 'Shop Name', render: (r) => formatDealerName(r.shop_name) },
      { key: 'phone', label: 'Phone' },
      { key: 'username', label: 'Username' },
      {
        key: 'is_active',
        label: 'Status',
        render: (r) => (
          <Badge tone={r.is_active ? 'active' : 'inactive'}>
            {r.is_active ? 'Active' : 'Inactive'}
          </Badge>
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

  const copyCreds = async () => {
    if (!creds) return
    await navigator.clipboard.writeText(`Username: ${creds.username}\nPassword: ${creds.password}`)
    alert('Copied to clipboard')
  }

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title="Dealers"
        subtitle="Onboard retailers and manage login credentials"
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
            Onboard dealer
          </Button>
        }
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
          <div className="min-w-0 overflow-x-auto">
            <ResponsiveTable
              columns={columns}
              rows={dealersQ.data?.items || []}
              empty={<EmptyState title="No dealers" description="Onboard your first retailer." />}
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
        onClose={() => !createM.isPending && setOpen(false)}
        title="Onboard dealer"
        size="lg"
        onSubmit={createForm.handleSubmit((d) => {
          if (createM.isPending) return
          createM.mutate({
            dealer_name: d.dealer_name,
            shop_name: d.shop_name || null,
            phone: (d.phone || '').trim() || null,
            email: d.email || null,
          })
        })}
        footer={
          <Button type="submit" loading={createM.isPending}>
            Create dealer
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Dealer Name"
            error={createForm.formState.errors.dealer_name?.message}
            {...createForm.register('dealer_name')}
          />
          <Input label="Shop Name" {...createForm.register('shop_name')} />
          <Input
            label="Phone Number"
            error={createForm.formState.errors.phone?.message}
            {...createForm.register('phone')}
          />
          <Input
            label="Email"
            error={createForm.formState.errors.email?.message}
            {...createForm.register('email')}
          />
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => !updateM.isPending && setEditing(null)}
        title="Edit Dealer"
        size="lg"
        onSubmit={editForm.handleSubmit((d) => {
          if (updateM.isPending || !editing) return
          const payload = {
            dealer_name: d.dealer_name,
            shop_name: d.shop_name || null,
            phone: (d.phone || '').trim() || null,
            email: d.email || null,
            username: d.username.trim(),
          }
          const next = (d.password || '').trim()
          if (next) {
            payload.password = next
          }
          updateM.mutate({ id: editing.id, payload })
        })}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateM.isPending}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Dealer Name"
            error={editForm.formState.errors.dealer_name?.message}
            {...editForm.register('dealer_name')}
          />
          <Input label="Shop Name" {...editForm.register('shop_name')} />
          <Input
            label="Phone Number"
            error={editForm.formState.errors.phone?.message}
            {...editForm.register('phone')}
          />
          <Input
            label="Email"
            error={editForm.formState.errors.email?.message}
            {...editForm.register('email')}
          />
          <Input
            label="Username"
            className="sm:col-span-2"
            error={editForm.formState.errors.username?.message}
            {...editForm.register('username')}
          />
          <PasswordInput
            label="Current Password"
            autoComplete="current-password"
            readOnly
            error={editForm.formState.errors.current_password?.message}
            {...editForm.register('current_password')}
          />
          <PasswordInput
            label="New Password"
            autoComplete="new-password"
            error={editForm.formState.errors.password?.message}
            {...editForm.register('password')}
          />
        </div>
      </Modal>

      <Modal
        open={!!deactivateTarget}
        onClose={() => !deactivateM.isPending && setDeactivateTarget(null)}
        title="Deactivate Dealer?"
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
          This will prevent the dealer from logging in and placing new orders. Historical orders and
          reports are preserved.
        </p>
        {deactivateTarget?.dealer_name && (
          <p className="mt-3 text-sm font-semibold text-ink">
            {formatDealerName(deactivateTarget.dealer_name)}
          </p>
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteM.isPending && setDeleteTarget(null)}
        title="Delete Dealer?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteM.isPending}>
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
          Are you sure you want to permanently delete this dealer? This cannot be undone.
        </p>
        {deleteTarget?.dealer_name && (
          <p className="mt-3 text-sm font-semibold text-ink">
            {formatDealerName(deleteTarget.dealer_name)}
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

      <Modal
        open={!!creds}
        onClose={() => setCreds(null)}
        title="Dealer created"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>
              Copy Credentials
            </Button>
            <Button onClick={() => setCreds(null)}>Done</Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">
            ✓
          </div>
          <p className="text-sm font-semibold text-ink">
            {creds?.dealer_name ? `${formatDealerName(creds.dealer_name)} onboarded` : 'Dealer onboarded'}
          </p>
          <p className="text-sm text-muted">Please share these credentials with the dealer.</p>
        </div>
        <div className="mt-4 space-y-2 rounded-xl bg-brand-50 p-4 font-mono text-sm">
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
