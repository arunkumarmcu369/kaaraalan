import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../hooks/useAuth'

const schema = z.object({
  username: z.string().min(1, 'Username required'),
  password: z.string().min(1, 'Password required'),
})

export default function Login() {
  const { login, user, idleMessage, clearIdleMessage } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (params.get('reason') === 'session') {
      setError('Your session expired. Please sign in again.')
    }
  }, [params])

  const onSubmit = async (values) => {
    setError('')
    clearIdleMessage()
    try {
      await login(values.username, values.password)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed')
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {(error || idleMessage) && (
        <p className="rounded-xl bg-red-50/90 px-3 py-2 text-sm text-danger" role="alert">
          {error || idleMessage}
        </p>
      )}

      <div>
        <input
          type="text"
          autoComplete="username"
          placeholder="Username"
          aria-label="Username"
          className={`login-glass-field ${errors.username ? 'is-error' : ''}`}
          {...register('username')}
        />
        {errors.username && (
          <p className="mt-1.5 text-xs text-danger">{errors.username.message}</p>
        )}
      </div>

      <div>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          className={`login-glass-field ${errors.password ? 'is-error' : ''}`}
          {...register('password')}
        />
        {errors.password && (
          <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>
        )}
      </div>

      <button type="submit" className="login-glass-button mt-2" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
