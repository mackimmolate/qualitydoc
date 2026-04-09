export type ViewName = 'dashboard' | 'documents' | 'catalog' | 'settings'
export type DocumentStatus = 'draft' | 'active' | 'review' | 'archived'
export type AttentionFilter = 'all' | 'needs_owner' | 'due_soon' | 'overdue' | 'healthy'

export interface DashboardSummary {
  total_documents: number
  active_documents: number
  coverage_percent: number
  missing_required: number
  needs_owner: number
  due_soon: number
  overdue: number
}

export interface DashboardAlert {
  kind: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export interface CatalogItem {
  id: number
  code: string
  title: string
  area: string
  description_en: string
  description_sv: string
  required: boolean
  active: boolean
  default_owner_role: string | null
  review_frequency_months: number | null
  tisax_tags: string[]
  coverage_count: number
  missing: boolean
  needs_owner_count: number
  due_soon_count: number
  overdue_count: number
}

export interface DocumentRecord {
  id: number
  catalog_item_id: number | null
  catalog_code: string | null
  catalog_title: string | null
  area: string
  title: string
  custom_title: string | null
  owner: string | null
  status: DocumentStatus
  storage_link: string | null
  last_review_date: string | null
  next_review_date: string | null
  review_frequency_months: number | null
  effective_review_frequency_months: number | null
  recommended_owner_role: string | null
  notes: string | null
  tags: string[]
  needs_owner: boolean
  due_soon: boolean
  overdue: boolean
  archived: boolean
  updated_at: string
}

export interface DashboardData {
  summary: DashboardSummary
  alerts: DashboardAlert[]
  upcoming_reviews: DocumentRecord[]
}

export interface Settings {
  workspace_name: string
  notification_enabled: boolean
  due_soon_days: number
}

export interface DocumentFilters {
  query: string
  status: string
  area: string
  attention: AttentionFilter
}

export interface DocumentInput {
  catalog_item_id: number | null
  custom_title: string | null
  owner: string | null
  status: DocumentStatus
  storage_link: string | null
  last_review_date: string | null
  next_review_date: string | null
  review_frequency_months: number | null
  notes: string | null
  tags: string[]
}

export interface CatalogUpdateInput {
  required?: boolean
  active?: boolean
  default_owner_role?: string | null
  review_frequency_months?: number | null
  description_en?: string | null
  description_sv?: string | null
}

export interface SettingsInput {
  workspace_name?: string
  notification_enabled?: boolean
  due_soon_days?: number
}
