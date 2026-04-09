import type {
  CatalogItem,
  CatalogUpdateInput,
  DashboardData,
  DocumentFilters,
  DocumentInput,
  DocumentRecord,
  Settings,
  SettingsInput,
} from './types'
import { demoApi } from './demoApi'

const API_ROOT = '/api'
const appMode = import.meta.env.VITE_APP_MODE === 'pages-demo' ? 'pages-demo' : 'live'

function buildQuery(filters: Partial<DocumentFilters>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === 'all') {
      continue
    }
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed with ${response.status}`
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      message = response.statusText || message
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function downloadFromUrl(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}

const liveApi = {
  mode: 'live' as const,
  getDashboard: () => request<DashboardData>('/dashboard'),
  getCatalog: () => request<CatalogItem[]>('/catalog'),
  updateCatalog: (id: number, payload: CatalogUpdateInput) =>
    request<CatalogItem>(`/catalog/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getDocuments: (filters: Partial<DocumentFilters>) => request<DocumentRecord[]>(`/documents${buildQuery(filters)}`),
  createDocument: (payload: DocumentInput) =>
    request<DocumentRecord>('/documents', { method: 'POST', body: JSON.stringify(payload) }),
  updateDocument: (id: number, payload: Partial<DocumentInput>) =>
    request<DocumentRecord>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  openDocumentLink: (id: number) =>
    request<{ ok: boolean; message: string }>(`/documents/${id}/open-link`, { method: 'POST' }),
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (payload: SettingsInput) =>
    request<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  async downloadDocumentsCsv(filters: Partial<DocumentFilters>): Promise<void> {
    downloadFromUrl(`${API_ROOT}/export/documents.csv${buildQuery(filters)}`, 'qualitydoc-documents.csv')
  },
}

export const api = appMode === 'pages-demo' ? demoApi : liveApi
export const isPagesDemo = appMode === 'pages-demo'
