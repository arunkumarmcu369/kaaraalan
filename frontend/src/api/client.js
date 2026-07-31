import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (!original || original._retry) throw error

    const status = error.response?.status
    const url = original.url || ''
    if (status !== 401 || url.includes('/auth/login') || url.includes('/auth/refresh')) {
      throw error
    }

    original._retry = true
    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh').finally(() => {
          refreshPromise = null
        })
      }
      await refreshPromise
      return api(original)
    } catch {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?reason=session'
      }
      throw error
    }
  }
)

export default api
