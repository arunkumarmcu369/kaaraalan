import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { changePassword } from '../../api/auth'
import { useAuth } from '../../hooks/useAuth'
import BrandLogo from '../../components/common/BrandLogo'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'

const schema = z
  .object({
    current_password: z.string().min(1, 'Current password required'),
    new_password: z.string().min(1, 'New password required'),
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export default function ChangePassword() {
  const { refreshUser, logout } = useAuth()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setError('')
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      await refreshUser()
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not update password')
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa] px-4 py-10">
      <div className="login-glass w-full max-w-[400px] rounded-[1.5rem] px-7 py-9 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size="md" />
          <h1 className="mt-4 text-lg font-extrabold text-ink">Set a new password</h1>
          <p className="mt-1 text-sm text-muted">
            Your account requires a password change before you can continue.
          </p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && (
            <p className="rounded-xl bg-red-50/90 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={errors.current_password?.message}
            {...register('current_password')}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.new_password?.message}
            {...register('new_password')}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />
          <Button type="submit" className="mt-2 w-full" loading={isSubmitting}>
            Update password
          </Button>
          <button
            type="button"
            className="interactive-text w-full pt-1 text-center text-sm font-semibold text-muted"
            onClick={() => logout()}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
