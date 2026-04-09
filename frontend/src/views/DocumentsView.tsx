import { api } from '../api'
import type { AttentionFilter, DocumentFilters, DocumentRecord, DocumentStatus } from '../types'
import { attentionBadges, formatDate, statusTone } from '../utils/ui'

const statusOptions: Array<{ value: DocumentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'In review' },
  { value: 'archived', label: 'Archived' },
]

const attentionOptions: Array<{ value: AttentionFilter; label: string }> = [
  { value: 'all', label: 'All attention' },
  { value: 'needs_owner', label: 'Needs owner' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'healthy', label: 'Healthy' },
]

type DocumentsViewProps = {
  documents: DocumentRecord[]
  filters: DocumentFilters
  areaOptions: string[]
  onUpdateFilter: <K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => void
  onEditDocument: (document: DocumentRecord) => void
  onOpenDocument: (documentId: number) => void
}

export function DocumentsView({
  documents,
  filters,
  areaOptions,
  onUpdateFilter,
  onEditDocument,
  onOpenDocument,
}: DocumentsViewProps) {
  return (
    <section className="view-grid documents-view">
      <article className="panel filter-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Register</span>
            <h3>Document filters</h3>
          </div>
          <button className="secondary-button link-button" onClick={() => void api.downloadDocumentsCsv(filters)} type="button">
            Export CSV
          </button>
        </div>
        <div className="filter-grid">
          <label>
            Search
            <input
              placeholder="title, owner, code, tag"
              type="search"
              value={filters.query}
              onChange={(event) => onUpdateFilter('query', event.target.value)}
            />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => onUpdateFilter('status', event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Area
            <select value={filters.area} onChange={(event) => onUpdateFilter('area', event.target.value)}>
              <option value="all">All areas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attention
            <select
              value={filters.attention}
              onChange={(event) => onUpdateFilter('attention', event.target.value as AttentionFilter)}
            >
              {attentionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Records</span>
            <h3>{documents.length} documents in view</h3>
          </div>
        </div>
        <div className="stack">
          {documents.length === 0 ? (
            <p className="muted">No documents match the current filters.</p>
          ) : (
            documents.map((document) => (
              <article className="document-card" key={document.id}>
                <div className="document-header">
                  <div>
                    <h4>{document.title}</h4>
                    <p>{`${document.catalog_code ?? 'CUSTOM'} | ${document.area}`}</p>
                  </div>
                  <div className="pill-row">
                    <span className={`pill ${statusTone(document.status)}`}>{document.status}</span>
                    {attentionBadges(document).map((badge) => (
                      <span
                        className={`pill ${badge === 'Healthy' ? 'success' : badge === 'Needs owner' ? 'warning' : 'danger'}`}
                        key={badge}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="document-meta">
                  <span>
                    <strong>Owner:</strong> {document.owner ?? 'Unassigned'}
                  </span>
                  <span>
                    <strong>Review:</strong> {formatDate(document.next_review_date)}
                  </span>
                  <span>
                    <strong>Cadence:</strong> {document.effective_review_frequency_months ?? 'n/a'} months
                  </span>
                </div>
                <p className="document-notes">{document.notes ?? 'No internal notes yet.'}</p>
                <div className="tag-row">
                  {(document.tags.length > 0 ? document.tags : ['untagged']).map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="secondary-button" onClick={() => onEditDocument(document)} type="button">
                    Edit
                  </button>
                  <button className="secondary-button" onClick={() => onOpenDocument(document.id)} type="button">
                    Open document
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
