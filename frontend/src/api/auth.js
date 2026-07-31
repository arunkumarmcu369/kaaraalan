import api from './client'

export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)

export const logout = () => api.post('/auth/logout').then((r) => r.data)

export const me = () => api.get('/auth/me').then((r) => r.data)

export const refresh = () => api.post('/auth/refresh').then((r) => r.data)

export const changePassword = (data) =>
  api.post('/auth/change-password', data).then((r) => r.data)
