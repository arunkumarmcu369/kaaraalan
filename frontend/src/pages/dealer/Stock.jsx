import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createOrder, dealerStockView } from '../../api'
import { buildFlavourMatrix } from '../../utils/orderMatrix'
import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Modal from '../../components/common/Modal'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import OrderMatrixTable from '../../components/table/OrderMatrixTable'
import { MrpInputTable } from '../../components/table/MrpTable'
import PendingApprovalIllustration from '../../components/common/PendingApprovalIllustration'

export default function DealerStock() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['dealer-stock'],
    queryFn: dealerStockView,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })
  const [qtys, setQtys] = useState({})
  const [mrp, setMrp] = useState({})
  const [dueDate, setDueDate] = useState('')
  const [done, setDone] = useState(null)

  const rows = useMemo(() => buildFlavourMatrix(data || []), [data])
  const hasCatalog = useMemo(
    () => rows.some((r) => r.glass || Object.values(r.pets || {}).some(Boolean)),
    [rows]
  )

  const setQty = (key, value) => {
    setQtys((prev) => {
      if (prev[key] === value) return prev
      return { ...prev, [key]: value }
    })
  }

  const orderItems = useMemo(() => {
    const items = []
    for (const row of rows) {
      const glassQty = Number(qtys[`${row.flavour}::glass`] || 0)
      if (glassQty > 0 && row.glass) {
        items.push({ product_variant_id: row.glass.id, quantity: glassQty })
      }

      for (const size of [300, 220]) {
        const qty = Number(qtys[`${row.flavour}::pet_${size}`] || 0)
        const variant = row.pets?.[size]
        if (qty > 0 && variant) {
          items.push({ product_variant_id: variant.id, quantity: qty })
        }
      }
    }
    return items
  }, [rows, qtys])

  const estimatedTotal = useMemo(() => {
    let total = 0
    for (const row of rows) {
      const glassQty = Number(qtys[`${row.flavour}::glass`] || 0)
      if (glassQty > 0 && row.glass) total += glassQty * row.glass.price

      for (const size of [300, 220]) {
        const qty = Number(qtys[`${row.flavour}::pet_${size}`] || 0)
        const variant = row.pets?.[size]
        if (qty > 0 && variant) total += qty * variant.price
      }
    }
    return total
  }, [rows, qtys])

  const submitM = useMutation({
    mutationFn: createOrder,
    onSuccess: (res) => {
      setQtys({})
      setMrp({})
      setDueDate('')
      setDone(res)
      qc.invalidateQueries({ queryKey: ['my-orders'] })
      qc.invalidateQueries({ queryKey: ['dealer-summary'] })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Order failed'),
  })

  const tomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  if (isLoading) return <Spinner />
  if (error) {
    return <EmptyState title="Could not load products" description="Please try again." />
  }

  return (
    <div>
      <PageHeader
        title="Place order"
        subtitle="Enter GLASS, PET (300 ml), and PET (220 ml) quantities for each flavour, then submit one order"
      />

      {!hasCatalog ? (
        <EmptyState
          title="No products available"
          description="Ask admin to add GLASS / PET products for the 8 flavours."
        />
      ) : (
        <div className="space-y-5">
          <OrderMatrixTable
            rows={rows}
            editable
            qtys={qtys}
            onQtyChange={setQty}
          />

          <MrpInputTable
            values={mrp}
            onChange={(key, value) => setMrp((prev) => ({ ...prev, [key]: value }))}
          />

          <div className="flex flex-col gap-4 rounded-2xl bg-white/90 p-4 ring-1 ring-brand-100 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 sm:max-w-md">
              <Input
                label="Due date"
                type="date"
                min={tomorrow()}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div>
                <p className="text-sm font-semibold text-ink/80">Estimated total</p>
                <p className="mt-1.5 text-2xl font-extrabold text-ink">
                  ₹{estimatedTotal.toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              loading={submitM.isPending}
              disabled={!dueDate || orderItems.length === 0}
              onClick={() =>
                submitM.mutate({
                  due_date: dueDate,
                  items: orderItems,
                  mrp_glass: mrp.mrp_glass === '' || mrp.mrp_glass == null ? null : Number(mrp.mrp_glass),
                  mrp_pet_300:
                    mrp.mrp_pet_300 === '' || mrp.mrp_pet_300 == null ? null : Number(mrp.mrp_pet_300),
                  mrp_pet_220:
                    mrp.mrp_pet_220 === '' || mrp.mrp_pet_220 == null ? null : Number(mrp.mrp_pet_220),
                })
              }
            >
              Submit order
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!done}
        onClose={() => {
          setDone(null)
          navigate('/dashboard/orders')
        }}
        title="Order placed"
        footer={<Button onClick={() => navigate('/dashboard/orders')}>View order history</Button>}
      >
        <div className="flex flex-col items-center gap-4 px-2 py-2 text-center">
          <PendingApprovalIllustration />
          {done?.order_number && (
            <p className="text-sm font-semibold text-ink">{done.order_number}</p>
          )}
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Your order has been submitted and is pending admin approval.
          </p>
        </div>
      </Modal>
    </div>
  )
}
