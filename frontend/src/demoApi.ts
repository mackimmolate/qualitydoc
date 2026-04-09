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
import { createDemoState, type DemoState, type StoredCatalogItem, type StoredDocument } from './demoData'

const STORAGE_KEY = 'qualitydoc:pages-demo'

function waitForTick(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 80)
  })
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeTags(tags: string[] | null | undefined): string[] {
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const tag of tags ?? []) {
    const value = tag.trim()
    if (!value) {
      continue
    }
    const lowered = value.toLowerCase()
    if (seen.has(lowered)) {
      continue
    }
    seen.add(lowered)
    deduped.push(value)
  }
  return deduped
}

function addMonths(dateText: string, months: number): string {
  const [year, month, day] = dateText.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setMonth(date.getMonth() + months)
  while (date.getDate() < day) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

function deriveNextReview(lastReviewDate: string | null, reviewMonths: number | null): string | null {
  if (!lastReviewDate || !reviewMonths) {
    return null
  }
  return addMonths(lastReviewDate, reviewMonths)
}

function loadState(): DemoState {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = createDemoState()
    saveState(seeded)
    return seeded
  }

  try {
    return JSON.parse(raw) as DemoState
  } catch {
    const seeded = createDemoState()
    saveState(seeded)
    return seeded
  }
}

function saveState(state: DemoState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function mutateState(mutator: (state: DemoState) => DemoState): DemoState {
  const next = mutator(loadState())
  saveState(next)
  return next
}

function todayText(): string {
  return new Date().toISOString().slice(0, 10)
}

function compareDate(left: string | null, right: string | null): number {
  if (left === right) {
    return 0
  }
  if (!left) {
    return 1
  }
  if (!right) {
    return -1
  }
  return left.localeCompare(right)
}

function catalogById(state: DemoState): Map<number, StoredCatalogItem> {
  return new Map(state.catalog.map((item) => [item.id, item]))
}

function toDocumentRecord(document: StoredDocument, state: DemoState): DocumentRecord {
  const catalogItem = document.catalog_item_id ? catalogById(state).get(document.catalog_item_id) ?? null : null
  const effectiveReviewFrequency = document.review_frequency_months ?? catalogItem?.review_frequency_months ?? null
  const nextReviewDate = document.next_review_date ?? deriveNextReview(document.last_review_date, effectiveReviewFrequency)
  const archived = document.status === 'archived'
  const today = todayText()
  const dueSoonBoundary = new Date()
  dueSoonBoundary.setDate(dueSoonBoundary.getDate() + state.settings.due_soon_days)
  const dueSoonBoundaryText = dueSoonBoundary.toISOString().slice(0, 10)
  const overdue = !archived && !!nextReviewDate && nextReviewDate < today
  const dueSoon = !archived && !!nextReviewDate && nextReviewDate >= today && nextReviewDate <= dueSoonBoundaryText
  const owner = normalizeText(document.owner)

  return {
    id: document.id,
    catalog_item_id: document.catalog_item_id,
    catalog_code: catalogItem?.code ?? null,
    catalog_title: catalogItem?.title ?? null,
    area: catalogItem?.area ?? 'Custom',
    title: normalizeText(document.custom_title) ?? catalogItem?.title ?? 'Untitled document',
    custom_title: normalizeText(document.custom_title),
    owner,
    status: document.status,
    storage_link: normalizeText(document.storage_link),
    last_review_date: document.last_review_date,
    next_review_date: nextReviewDate,
    review_frequency_months: document.review_frequency_months,
    effective_review_frequency_months: effectiveReviewFrequency,
    recommended_owner_role: catalogItem?.default_owner_role ?? null,
    notes: normalizeText(document.notes),
    tags: normalizeTags(document.tags),
    needs_owner: !archived && !owner,
    due_soon: dueSoon && !overdue,
    overdue,
    archived,
    updated_at: document.updated_at,
  }
}

function getAllDocumentRecords(state: DemoState): DocumentRecord[] {
  return state.documents.map((document) => toDocumentRecord(document, state))
}

function filterDocuments(documents: DocumentRecord[], filters: Partial<DocumentFilters>): DocumentRecord[] {
  let next = [...documents]

  if (filters.query?.trim()) {
    const needle = filters.query.trim().toLowerCase()
    next = next.filter((document) => {
      return (
        document.title.toLowerCase().includes(needle) ||
        (document.owner ?? '').toLowerCase().includes(needle) ||
        (document.catalog_code ?? '').toLowerCase().includes(needle) ||
        document.area.toLowerCase().includes(needle) ||
        (document.notes ?? '').toLowerCase().includes(needle) ||
        document.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }

  if (filters.status && filters.status !== 'all') {
    next = next.filter((document) => document.status === filters.status)
  }

  if (filters.area && filters.area !== 'all') {
    next = next.filter((document) => document.area === filters.area)
  }

  if (filters.attention && filters.attention !== 'all') {
    if (filters.attention === 'needs_owner') next = next.filter((document) => document.needs_owner)
    if (filters.attention === 'due_soon') next = next.filter((document) => document.due_soon)
    if (filters.attention === 'overdue') next = next.filter((document) => document.overdue)
    if (filters.attention === 'healthy') next = next.filter((document) => !document.needs_owner && !document.due_soon && !document.overdue)
  }

  return next.sort((left, right) => {
    if (left.archived !== right.archived) {
      return left.archived ? 1 : -1
    }
    return left.title.localeCompare(right.title)
  })
}

function toCatalogRead(item: StoredCatalogItem, documents: DocumentRecord[]): CatalogItem {
  const linked = documents.filter((document) => document.catalog_item_id === item.id && !document.archived)
  return {
    ...item,
    coverage_count: linked.length,
    missing: item.active && item.required && linked.length === 0,
    needs_owner_count: linked.filter((document) => document.needs_owner).length,
    due_soon_count: linked.filter((document) => document.due_soon).length,
    overdue_count: linked.filter((document) => document.overdue).length,
  }
}

function buildDashboard(state: DemoState): DashboardData {
  const documents = getAllDocumentRecords(state)
  const catalog = state.catalog.map((item) => toCatalogRead(item, documents))
  const requiredCatalog = catalog.filter((item) => item.active && item.required)
  const coveredRequired = requiredCatalog.filter((item) => item.coverage_count > 0).length
  const alerts = [
    ...catalog
      .filter((item) => item.missing)
      .map((item) => ({
        kind: 'missing',
        severity: 'high' as const,
        title: item.title,
        detail: `Missing required TISAX document in ${item.area}.`,
      })),
    ...documents
      .filter((document) => document.overdue)
      .map((document) => ({
        kind: 'overdue',
        severity: 'high' as const,
        title: document.title,
        detail: 'Review date has passed. Demo data shows how overdue evidence is surfaced.',
      })),
    ...documents
      .filter((document) => document.needs_owner)
      .map((document) => ({
        kind: 'needs_owner',
        severity: 'medium' as const,
        title: document.title,
        detail: 'Document has no owner assigned.',
      })),
    ...documents
      .filter((document) => document.due_soon)
      .map((document) => ({
        kind: 'due_soon',
        severity: 'low' as const,
        title: document.title,
        detail: 'Review date is approaching soon.',
      })),
  ].slice(0, 10)

  return {
    summary: {
      total_documents: documents.length,
      active_documents: documents.filter((document) => !document.archived).length,
      coverage_percent: requiredCatalog.length ? Math.round((coveredRequired / requiredCatalog.length) * 100) : 100,
      missing_required: catalog.filter((item) => item.missing).length,
      needs_owner: documents.filter((document) => document.needs_owner).length,
      due_soon: documents.filter((document) => document.due_soon).length,
      overdue: documents.filter((document) => document.overdue).length,
    },
    alerts,
    upcoming_reviews: documents
      .filter((document) => !document.archived && document.next_review_date)
      .sort((left, right) => compareDate(left.next_review_date, right.next_review_date))
      .slice(0, 5),
  }
}

function toCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.URL.revokeObjectURL(url)
}

async function getStatefulDocuments(filters: Partial<DocumentFilters>): Promise<DocumentRecord[]> {
  await waitForTick()
  return filterDocuments(getAllDocumentRecords(loadState()), filters)
}

export const demoApi = {
  mode: 'pages-demo' as const,
  async getDashboard(): Promise<DashboardData> {
    await waitForTick()
    return buildDashboard(loadState())
  },
  async getCatalog(): Promise<CatalogItem[]> {
    await waitForTick()
    const state = loadState()
    const documents = getAllDocumentRecords(state)
    return state.catalog.map((item) => toCatalogRead(item, documents))
  },
  async updateCatalog(id: number, payload: CatalogUpdateInput): Promise<CatalogItem> {
    await waitForTick()
    const state = mutateState((current) => {
      return {
        ...current,
        catalog: current.catalog.map((item) =>
          item.id === id
            ? {
                ...item,
                required: payload.required === undefined ? item.required : payload.required,
                active: payload.active === undefined ? item.active : payload.active,
                default_owner_role:
                  payload.default_owner_role === undefined ? item.default_owner_role : normalizeText(payload.default_owner_role),
                review_frequency_months:
                  payload.review_frequency_months === undefined ? item.review_frequency_months : payload.review_frequency_months,
                description_en:
                  payload.description_en === undefined ? item.description_en : normalizeText(payload.description_en) ?? '',
                description_sv:
                  payload.description_sv === undefined ? item.description_sv : normalizeText(payload.description_sv) ?? '',
              }
            : item,
        ),
      }
    })
    const documents = getAllDocumentRecords(state)
    const item = state.catalog.find((entry) => entry.id === id)
    if (!item) {
      throw new Error('Catalog item not found.')
    }
    return toCatalogRead(item, documents)
  },
  async getDocuments(filters: Partial<DocumentFilters>): Promise<DocumentRecord[]> {
    return getStatefulDocuments(filters)
  },
  async createDocument(payload: DocumentInput): Promise<DocumentRecord> {
    await waitForTick()
    const nextState = mutateState((current) => {
      const catalogItem = payload.catalog_item_id
        ? current.catalog.find((item) => item.id === payload.catalog_item_id) ?? null
        : null
      const reviewFrequency = payload.review_frequency_months ?? catalogItem?.review_frequency_months ?? null
      const document: StoredDocument = {
        id: current.next_document_id,
        catalog_item_id: payload.catalog_item_id,
        custom_title: normalizeText(payload.custom_title),
        owner: normalizeText(payload.owner),
        status: payload.status,
        storage_link: normalizeText(payload.storage_link),
        last_review_date: payload.last_review_date,
        next_review_date: payload.next_review_date ?? deriveNextReview(payload.last_review_date, reviewFrequency),
        review_frequency_months: payload.review_frequency_months,
        notes: normalizeText(payload.notes),
        tags: normalizeTags(payload.tags),
        updated_at: new Date().toISOString(),
      }
      return {
        ...current,
        documents: [document, ...current.documents],
        next_document_id: current.next_document_id + 1,
      }
    })
    return toDocumentRecord(nextState.documents[0], nextState)
  },
  async updateDocument(id: number, payload: Partial<DocumentInput>): Promise<DocumentRecord> {
    await waitForTick()
    const nextState = mutateState((current) => {
      return {
        ...current,
        documents: current.documents.map((document) => {
          if (document.id !== id) {
            return document
          }
          const nextCatalogId = payload.catalog_item_id === undefined ? document.catalog_item_id : payload.catalog_item_id
          const catalogItem = nextCatalogId ? current.catalog.find((item) => item.id === nextCatalogId) ?? null : null
          const reviewFrequency =
            payload.review_frequency_months === undefined
              ? document.review_frequency_months ?? catalogItem?.review_frequency_months ?? null
              : payload.review_frequency_months
          const lastReviewDate = payload.last_review_date === undefined ? document.last_review_date : payload.last_review_date
          const explicitNextReviewDate =
            payload.next_review_date === undefined
              ? document.next_review_date
              : payload.next_review_date
          return {
            ...document,
            catalog_item_id: nextCatalogId,
            custom_title: payload.custom_title === undefined ? document.custom_title : normalizeText(payload.custom_title),
            owner: payload.owner === undefined ? document.owner : normalizeText(payload.owner),
            status: payload.status ?? document.status,
            storage_link: payload.storage_link === undefined ? document.storage_link : normalizeText(payload.storage_link),
            last_review_date: lastReviewDate,
            next_review_date:
              payload.next_review_date === undefined
                ? deriveNextReview(lastReviewDate, reviewFrequency) ?? explicitNextReviewDate
                : explicitNextReviewDate,
            review_frequency_months:
              payload.review_frequency_months === undefined ? document.review_frequency_months : payload.review_frequency_months,
            notes: payload.notes === undefined ? document.notes : normalizeText(payload.notes),
            tags: payload.tags === undefined ? document.tags : normalizeTags(payload.tags),
            updated_at: new Date().toISOString(),
          }
        }),
      }
    })
    const updated = nextState.documents.find((document) => document.id === id)
    if (!updated) {
      throw new Error('Document not found.')
    }
    return toDocumentRecord(updated, nextState)
  },
  async openDocumentLink(id: number): Promise<{ ok: boolean; message: string }> {
    await waitForTick()
    const document = getAllDocumentRecords(loadState()).find((entry) => entry.id === id)
    if (!document) {
      throw new Error('Document not found.')
    }
    if (!document.storage_link) {
      throw new Error('Document has no stored link.')
    }
    if (document.storage_link.startsWith('http://') || document.storage_link.startsWith('https://')) {
      window.open(document.storage_link, '_blank', 'noopener')
      return { ok: true, message: 'External demo link opened in a new tab.' }
    }
    throw new Error('Local file paths cannot be opened from the GitHub Pages demo. Use the local app for that.')
  },
  async getSettings(): Promise<Settings> {
    await waitForTick()
    return loadState().settings
  },
  async updateSettings(payload: SettingsInput): Promise<Settings> {
    await waitForTick()
    const nextState = mutateState((current) => ({
      ...current,
      settings: {
        workspace_name: payload.workspace_name ?? current.settings.workspace_name,
        notification_enabled: payload.notification_enabled ?? current.settings.notification_enabled,
        due_soon_days: payload.due_soon_days ?? current.settings.due_soon_days,
      },
    }))
    return nextState.settings
  },
  async downloadDocumentsCsv(filters: Partial<DocumentFilters>): Promise<void> {
    const documents = await getStatefulDocuments(filters)
    const lines = [
      ['Title', 'Catalog Code', 'Area', 'Owner', 'Status', 'Last Review', 'Next Review', 'Needs Owner', 'Due Soon', 'Overdue', 'Link', 'Tags'].join(','),
      ...documents.map((document) =>
        [
          document.title,
          document.catalog_code ?? '',
          document.area,
          document.owner ?? '',
          document.status,
          document.last_review_date ?? '',
          document.next_review_date ?? '',
          document.needs_owner ? 'yes' : 'no',
          document.due_soon ? 'yes' : 'no',
          document.overdue ? 'yes' : 'no',
          document.storage_link ?? '',
          document.tags.join('; '),
        ]
          .map((value) => toCsvValue(value))
          .join(','),
      ),
    ]
    downloadText('qualitydoc-documents-demo.csv', lines.join('\n'))
  },
}
