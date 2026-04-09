import type { CatalogItem, DocumentInput, DocumentRecord, DocumentStatus, Settings } from '../types'

export type DocumentDraft = {
  catalog_item_id: string
  custom_title: string
  owner: string
  status: DocumentStatus
  storage_link: string
  last_review_date: string
  next_review_date: string
  review_frequency_months: string
  notes: string
  tags_text: string
}

export type SettingsDraft = {
  workspace_name: string
  notification_enabled: boolean
  due_soon_days: string
}

export type CatalogDraft = {
  required: boolean
  active: boolean
  default_owner_role: string
  review_frequency_months: string
  description_en: string
  description_sv: string
}

export function emptyDocumentDraft(catalogItemId?: number): DocumentDraft {
  return {
    catalog_item_id: catalogItemId ? String(catalogItemId) : '',
    custom_title: '',
    owner: '',
    status: 'active',
    storage_link: '',
    last_review_date: '',
    next_review_date: '',
    review_frequency_months: '',
    notes: '',
    tags_text: '',
  }
}

export function settingsToDraft(settings: Settings): SettingsDraft {
  return {
    workspace_name: settings.workspace_name,
    notification_enabled: settings.notification_enabled,
    due_soon_days: String(settings.due_soon_days),
  }
}

export function catalogToDraft(item: CatalogItem): CatalogDraft {
  return {
    required: item.required,
    active: item.active,
    default_owner_role: item.default_owner_role ?? '',
    review_frequency_months: item.review_frequency_months ? String(item.review_frequency_months) : '',
    description_en: item.description_en,
    description_sv: item.description_sv,
  }
}

export function documentToDraft(document: DocumentRecord): DocumentDraft {
  return {
    catalog_item_id: document.catalog_item_id ? String(document.catalog_item_id) : '',
    custom_title: document.custom_title ?? '',
    owner: document.owner ?? '',
    status: document.status,
    storage_link: document.storage_link ?? '',
    last_review_date: document.last_review_date ?? '',
    next_review_date: document.next_review_date ?? '',
    review_frequency_months: document.review_frequency_months ? String(document.review_frequency_months) : '',
    notes: document.notes ?? '',
    tags_text: document.tags.join(', '),
  }
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function numberOrNull(value: string): number | null {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function tagsFromText(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function toDocumentPayload(draft: DocumentDraft): DocumentInput {
  return {
    catalog_item_id: numberOrNull(draft.catalog_item_id),
    custom_title: emptyToNull(draft.custom_title),
    owner: emptyToNull(draft.owner),
    status: draft.status,
    storage_link: emptyToNull(draft.storage_link),
    last_review_date: emptyToNull(draft.last_review_date),
    next_review_date: emptyToNull(draft.next_review_date),
    review_frequency_months: numberOrNull(draft.review_frequency_months),
    notes: emptyToNull(draft.notes),
    tags: tagsFromText(draft.tags_text),
  }
}

export function formatDate(value: string | null): string {
  if (!value) {
    return 'Not scheduled'
  }

  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function relativeReviewLabel(document: DocumentRecord): string {
  if (document.overdue) {
    return 'Overdue'
  }
  if (document.due_soon) {
    return 'Due soon'
  }
  return 'Healthy'
}

export function attentionBadges(document: DocumentRecord): string[] {
  const badges: string[] = []
  if (document.needs_owner) {
    badges.push('Needs owner')
  }
  if (document.overdue) {
    badges.push('Overdue')
  }
  if (document.due_soon) {
    badges.push('Due soon')
  }
  if (badges.length === 0) {
    badges.push('Healthy')
  }
  return badges
}

export function statusTone(status: DocumentStatus): string {
  if (status === 'archived') {
    return 'muted'
  }
  if (status === 'review') {
    return 'accent'
  }
  if (status === 'draft') {
    return 'warning'
  }
  return 'success'
}

export function severityTone(severity: string): string {
  if (severity === 'high') {
    return 'danger'
  }
  if (severity === 'medium') {
    return 'warning'
  }
  return 'neutral'
}
