import api from './client'

export const listDealers = (params) => api.get('/dealers', { params }).then((r) => r.data)
export const createDealer = (data) => api.post('/dealers', data).then((r) => r.data)
export const updateDealer = (id, data) => api.patch(`/dealers/${id}`, data).then((r) => r.data)
export const deleteDealer = (id) => api.delete(`/dealers/${id}`).then((r) => r.data)

export const listProducts = (params) => api.get('/products', { params }).then((r) => r.data)
export const createProduct = (data) => api.post('/products', data).then((r) => r.data)
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data).then((r) => r.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data)
export const updateVariant = (id, data) => api.patch(`/variants/${id}`, data).then((r) => r.data)

export const listStocks = (params) => api.get('/stocks', { params }).then((r) => r.data)
export const updateStock = (variantId, data) =>
  api.patch(`/stocks/${variantId}`, data).then((r) => r.data)
export const getStockMatrix = () => api.get('/stocks/matrix').then((r) => r.data)
export const updateStockMatrix = (data) => api.put('/stocks/matrix', data).then((r) => r.data)
export const listStockHistory = (params) =>
  api.get('/stocks/history', { params }).then((r) => r.data)
export const dealerStockView = () => api.get('/stocks/dealer-view').then((r) => r.data)

export const listOrders = (params) => api.get('/orders', { params }).then((r) => r.data)
export const myOrders = (params) => api.get('/orders/mine', { params }).then((r) => r.data)
export const createOrder = (data) => api.post('/orders', data).then((r) => r.data)
export const approveOrder = (id) => api.patch(`/orders/${id}/approve`).then((r) => r.data)
export const rejectOrder = (id, reason) =>
  api.patch(`/orders/${id}/reject`, { reason }).then((r) => r.data)

export const adminSummary = (params) =>
  api.get('/dashboard/admin/summary', { params }).then((r) => r.data)
export const salesTrend = (params = {}) => {
  const query = typeof params === 'string' ? { range: params } : params
  return api.get('/dashboard/admin/sales-trend', { params: query }).then((r) => r.data)
}
export const batchRequired = (params = {}) =>
  api.get('/dashboard/admin/batch-required', { params }).then((r) => r.data)
export const dealerSummary = (params) =>
  api.get('/dashboard/dealer/summary', { params }).then((r) => r.data)
export const listNotifications = (params) =>
  api.get('/dashboard/notifications', { params }).then((r) => r.data)
export const markNotificationsRead = (ids) =>
  api.post('/dashboard/notifications/mark-read', { ids }).then((r) => r.data)
