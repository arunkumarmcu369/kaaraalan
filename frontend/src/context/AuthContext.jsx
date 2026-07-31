import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { useIdleTimeout } from '../hooks/useIdleTimeout'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [idleMessage, setIdleMessage] = useState('')

  const loadUser = useCallback(async () => {
    try {
      const data = await authApi.me()
      setUser(data)
      return data
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = async (username, password) => {
    const data = await authApi.login(username, password)
    setUser(data)
    setIdleMessage('')
    return data
  }

  const logout = async (message = '') => {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    setUser(null)
    if (message) setIdleMessage(message)
  }

  const idleMinutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 60)
  useIdleTimeout(!!user, idleMinutes, () => {
    logout('Session ended due to inactivity. Please sign in again.')
  })

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser: loadUser,
      idleMessage,
      clearIdleMessage: () => setIdleMessage(''),
      isAdmin: user?.role === 'admin',
      isDealer: user?.role === 'dealer',
    }),
    [user, loading, idleMessage, loadUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
