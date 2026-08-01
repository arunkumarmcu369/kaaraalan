/** Display dealer names in ALL CAPS across the app. */
export function formatDealerName(name) {
  const value = String(name || '').trim()
  return value ? value.toUpperCase() : '—'
}
