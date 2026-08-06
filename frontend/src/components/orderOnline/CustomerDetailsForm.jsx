import Input from '../common/Input'

const FIELDS = [
  { name: 'customerName', label: 'Customer Name', required: true, autoComplete: 'name' },
  {
    name: 'mobile',
    label: 'Mobile Number',
    required: true,
    autoComplete: 'tel',
    inputMode: 'numeric',
    maxLength: 10,
  },
  {
    name: 'address',
    label: 'Delivery Address',
    required: true,
    autoComplete: 'street-address',
  },
  { name: 'village', label: 'Village / Town', required: true, autoComplete: 'address-level2' },
  { name: 'district', label: 'District', required: true, autoComplete: 'address-level1' },
  {
    name: 'pincode',
    label: 'Pincode',
    required: true,
    autoComplete: 'postal-code',
    inputMode: 'numeric',
    maxLength: 6,
  },
]

export const EMPTY_CUSTOMER = {
  customerName: '',
  mobile: '',
  address: '',
  village: '',
  district: '',
  pincode: '',
}

export function validateCustomer(values) {
  const errors = {}
  if (!values.customerName?.trim()) errors.customerName = 'Name is required'
  if (!/^[6-9]\d{9}$/.test(String(values.mobile || '').trim())) {
    errors.mobile = 'Enter a valid 10-digit mobile number'
  }
  if (!values.address?.trim()) errors.address = 'Address is required'
  if (!values.village?.trim()) errors.village = 'Village / Town is required'
  if (!values.district?.trim()) errors.district = 'District is required'
  if (!/^\d{6}$/.test(String(values.pincode || '').trim())) {
    errors.pincode = 'Enter a valid 6-digit pincode'
  }
  return errors
}

export default function CustomerDetailsForm({ values, errors = {}, onChange }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <h2 className="text-lg font-extrabold text-ink">Customer Details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Input
            key={field.name}
            className={field.name === 'address' ? 'sm:col-span-2' : ''}
            label={field.label}
            name={field.name}
            required={field.required}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            value={values[field.name] || ''}
            error={errors[field.name]}
            onChange={(e) => {
              let next = e.target.value
              if (field.name === 'mobile' || field.name === 'pincode') {
                next = next.replace(/[^\d]/g, '')
              }
              onChange?.(field.name, next)
            }}
          />
        ))}
      </div>
    </section>
  )
}
