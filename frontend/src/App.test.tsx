import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from './App'
import type { CatalogItem, DashboardData, DocumentRecord, LibraryFile, Settings } from './types'

const catalog: CatalogItem[] = [
  {
    id: 1,
    code: 'GOV-001',
    title: 'Information Security Policy',
    area: 'Governance',
    description_en: 'Core policy',
    description_sv: 'Grundpolicy',
    required: true,
    active: true,
    default_owner_role: 'Security lead',
    review_frequency_months: 12,
    tisax_tags: ['policy'],
    coverage_count: 0,
    missing: true,
    needs_owner_count: 0,
    due_soon_count: 0,
    overdue_count: 0,
  },
]

function dashboardFromDocuments(documents: DocumentRecord[]): DashboardData {
  return {
    summary: {
      total_documents: documents.length,
      active_documents: documents.filter((item) => !item.archived).length,
      coverage_percent: documents.length > 0 ? 100 : 0,
      missing_required: documents.length > 0 ? 0 : 1,
      needs_owner: documents.filter((item) => item.needs_owner).length,
      due_soon: documents.filter((item) => item.due_soon).length,
      overdue: documents.filter((item) => item.overdue).length,
    },
    alerts: documents.length
      ? []
      : [{ kind: 'missing', severity: 'high', title: 'Information Security Policy', detail: 'Missing required TISAX document.' }],
    upcoming_reviews: documents.filter((item) => item.next_review_date),
  }
}

function createFetchMock() {
  const settings: Settings = {
    workspace_name: 'QualityDoc',
    notification_enabled: false,
    due_soon_days: 30,
    document_root_path: null,
    library_last_scanned_at: null,
  }

  let documents: DocumentRecord[] = []
  const libraryFiles: LibraryFile[] = []

  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'

    if (url.endsWith('/api/dashboard')) {
      return Response.json(dashboardFromDocuments(documents))
    }

    if (url.endsWith('/api/catalog')) {
      return Response.json(catalog)
    }

    if (url.includes('/api/library/files') && method === 'GET') {
      return Response.json(libraryFiles)
    }

    if (url.endsWith('/api/library/scan') && method === 'POST') {
      return Response.json({
        root_path: 'C:/Docs',
        scanned_at: '2026-04-09T10:00:00',
        scanned_count: 0,
        discovered_count: 0,
        updated_count: 0,
        missing_count: 0,
      })
    }

    if (url.includes('/api/documents') && method === 'GET') {
      return Response.json(documents)
    }

    if (url.endsWith('/api/settings') && method === 'GET') {
      return Response.json(settings)
    }

    if (url.endsWith('/api/settings') && method === 'PATCH') {
      Object.assign(settings, JSON.parse(String(init?.body)))
      return Response.json(settings)
    }

    if (url.endsWith('/api/documents') && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as Record<string, string | null>
      const document: DocumentRecord = {
        id: documents.length + 1,
        catalog_item_id: Number(payload.catalog_item_id ?? 1),
        catalog_code: 'GOV-001',
        catalog_title: 'Information Security Policy',
        area: 'Governance',
        title: (payload.custom_title as string | null) ?? 'Information Security Policy',
        custom_title: payload.custom_title as string | null,
        owner: payload.owner as string | null,
        status: 'active',
        storage_link: payload.storage_link as string | null,
        last_review_date: payload.last_review_date as string | null,
        next_review_date: payload.next_review_date as string | null,
        review_frequency_months: 12,
        effective_review_frequency_months: 12,
        recommended_owner_role: 'Security lead',
        notes: payload.notes as string | null,
        tags: [],
        needs_owner: false,
        due_soon: false,
        overdue: false,
        archived: false,
        updated_at: '2026-04-09T10:00:00',
      }
      documents = [document]
      return Response.json(document, { status: 201 })
    }

    if (url.includes('/open-link')) {
      return Response.json({ ok: true, message: 'Document opened.' })
    }

    return new Response(null, { status: 404 })
  })
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFetchMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows onboarding and starter catalog visibility', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText(/Start from the built-in TISAX catalog/i)).toBeInTheDocument()

    const navigation = screen.getByRole('navigation', { name: /primary/i })
    await user.click(within(navigation).getByRole('button', { name: /^catalog$/i }))
    expect(await screen.findByText(/Information Security Policy/i)).toBeInTheDocument()
  })

  it('creates a document from the register flow', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /documents/i }))
    await user.click(screen.getByRole('button', { name: /add document/i }))
    await user.type(screen.getByLabelText(/Custom title/i), 'Main policy')
    await user.type(screen.getByLabelText(/^Owner$/i), 'Marcus')
    await user.click(screen.getByRole('button', { name: /save document/i }))

    await waitFor(() => {
      expect(screen.getByText(/Main policy/i)).toBeInTheDocument()
    })
  })
})
