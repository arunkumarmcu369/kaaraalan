import api from './client'

export const listDealers = (params) => api.get('/dealers', { params }).then((r) => r.data)
export const createDealer = (data) => api.post('/dealers', data).then((r) => r.data)
export const updateDealer = (id, data) => api.patch(`/dealers/${id}`, data).then((r) => r.data)
export const deactivateDealer = (id) => api.post(`/dealers/${id}/deactivate`).then((r) => r.data)
export const reactivateDealer = (id) => api.post(`/dealers/${id}/reactivate`).then((r) => r.data)
export const deleteDealer = (id) => api.delete(`/dealers/${id}`).then((r) => r.data)

export const listProducts = (params) => api.get('/products', { params }).then((r) => r.data)
export const createProduct = (data) => api.post('/products', data).then((r) => r.data)
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data).then((r) => r.data)
export const deactivateProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data)
/** @deprecated Use deactivateProduct — soft-deletes (deactivates) the product */
export const deleteProduct = deactivateProduct
export const reactivateProduct = (id) => api.post(`/products/${id}/reactivate`).then((r) => r.data)
export const permanentlyDeleteProduct = (id) =>
  api.delete(`/products/${id}/permanent`).then((r) => r.data)
export const updateVariant = (id, data) => api.patch(`/variants/${id}`, data).then((r) => r.data)

export const listStocks = (params) => api.get('/stocks', { params }).then((r) => r.data)
export const updateStock = (variantId, data) =>
  api.patch(`/stocks/${variantId}`, data).then((r) => r.data)
export const getStockMatrix = () => api.get('/stocks/matrix').then((r) => r.data)
export const updateStockMatrix = (data) => api.put('/stocks/matrix', data).then((r) => r.data)
export const listStockHistory = (params) =>
  api.get('/stocks/history', { params }).then((r) => r.data)
export const listLowStock = () => api.get('/stocks/low-stock').then((r) => r.data)
export const dealerStockView = () => api.get('/stocks/dealer-view').then((r) => r.data)

export const listOrders = (params) => api.get('/orders', { params }).then((r) => r.data)
export const myOrders = (params) => api.get('/orders/mine', { params }).then((r) => r.data)
export const createOrder = (data) => api.post('/orders', data).then((r) => r.data)
export const approveOrder = (id) => api.patch(`/orders/${id}/approve`).then((r) => r.data)
export const rejectOrder = (id, reason) =>
  api.patch(`/orders/${id}/reject`, { reason }).then((r) => r.data)
export const fulfillOrder = (id) => api.patch(`/orders/${id}/fulfill`).then((r) => r.data)

export async function downloadOrdersPdf(params = {}) {
  const response = await api.get('/orders/export/pdf', {
    params,
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition'] || ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  const filename = match?.[1] || 'kaaraalan_orders.pdf'
  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
  return filename
}

export const adminSummary = (params) =>
  api.get('/dashboard/admin/summary', { params }).then((r) => r.data)
export const pendingOrdersDetail = (params) =>
  api.get('/dashboard/admin/pending-orders', { params }).then((r) => r.data)
export const revenueReport = (params) =>
  api.get('/dashboard/admin/revenue-report', { params }).then((r) => r.data)
export const salesTrend = (params = {}) => {
  const query = typeof params === 'string' ? { range: params } : params
  return api.get('/dashboard/admin/sales-trend', { params: query }).then((r) => r.data)
}
export const batchRequired = (params = {}) =>
  api.get('/dashboard/admin/batch-required', { params }).then((r) => r.data)

export const getEmptyCratesSummary = (params = {}) =>
  api.get('/empty-crates/summary', { params }).then((r) => r.data)
export const updateEmptyCrates = (data) =>
  api.put('/empty-crates/balances', data).then((r) => r.data)
export const listEmptyCratesHistory = (params = {}) =>
  api.get('/empty-crates/history', { params }).then((r) => r.data)
export const dealerSummary = (params) =>
  api.get('/dashboard/dealer/summary', { params }).then((r) => r.data)
export const listNotifications = (params) =>
  api.get('/dashboard/notifications', { params }).then((r) => r.data)
export const markNotificationsRead = (ids) =>
  api.post('/dashboard/notifications/mark-read', { ids }).then((r) => r.data)

export async function downloadDailyReport(params, format = 'pdf') {
  const response = await api.get('/reports/daily', {
    params: { ...params, format },
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition'] || ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  const fallback = `kaaraalan_daily_report.${format}`
  const filename = match?.[1] || fallback
  const blob = new Blob([response.data], {
    type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
  return filename
}
