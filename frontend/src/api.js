import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000', timeout: 120000 })

// Turns any axios failure into a readable string, whether the backend
// responded with {detail: "..."}, plain text, or never responded at all.
export function friendlyError(e) {
  if (e.response) {
    const data = e.response.data
    if (typeof data === 'string' && data.trim()) return data
    if (data?.detail) return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    return `Server responded with ${e.response.status} ${e.response.statusText || ''}`.trim()
  }
  if (e.code === 'ECONNABORTED') return 'Request timed out — the backend took too long to respond.'
  if (e.request) return 'Could not reach the backend at http://localhost:8000. Is it running?'
  return e.message || 'Unknown error'
}

export const checkHealth = () => api.get('/health')
export const getDatasets = () => api.get('/datasets')
export const deleteDataset = (id) => api.delete(`/datasets/${id}`)
export const previewColumns = (file) => {
  const fd = new FormData(); fd.append('file', file)
  return api.post('/upload/preview', fd)
}
export const uploadDataset = (file, mapping, name, onUploadProgress) => {
  const fd = new FormData(); fd.append('file', file)
  return api.post('/upload', fd, {
    params: { ...mapping, dataset_name: name },
    timeout: 10 * 60 * 1000, // scoring + graph writes can take minutes on large datasets
    onUploadProgress,
  })
}
export const getAlerts = (dataset_id, threshold = 0.7) =>
  api.get('/alerts/suspicious', { params: { dataset_id, threshold } })
export const getTransactions = (dataset_id, threshold = 0.7, limit = 50, offset = 0) =>
  api.get('/transactions', { params: { dataset_id, threshold, limit, offset } })
export const getNetwork = (account_id, dataset_id) =>
  api.get(`/account/${account_id}/network`, { params: { dataset_id } })
export const getStats = (dataset_id) =>
  api.get('/stats', { params: { dataset_id } })
export const getTopSuspicious = (dataset_id, threshold = 0.7) =>
  api.get('/accounts/top-suspicious', { params: { dataset_id, threshold } })