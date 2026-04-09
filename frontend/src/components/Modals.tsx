import type { FormEvent } from 'react'

import type { CatalogItem, DocumentStatus } from '../types'
import type { CatalogDraft, DocumentDraft } from '../utils/ui'

type DocumentModalProps = {
  draft: DocumentDraft
  catalog: CatalogItem[]
  mode: 'create' | 'edit'
  onChange: (draft: DocumentDraft) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

type CatalogModalProps = {
  title: string
  draft: CatalogDraft
  onChange: (draft: CatalogDraft) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const documentStatuses: DocumentStatus[] = ['draft', 'active', 'review', 'archived']

export function DocumentModal({ draft, catalog, mode, onChange, onClose, onSubmit }: DocumentModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-card" role="dialog">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{mode === 'create' ? 'New record' : 'Edit record'}</span>
            <h3>{mode === 'create' ? 'Create document' : 'Update document'}</h3>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Starter catalog item
            <select value={draft.catalog_item_id} onChange={(event) => onChange({ ...draft, catalog_item_id: event.target.value })}>
              <option value="">No starter item</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Custom title
            <input
              placeholder="Leave blank to use the starter title"
              value={draft.custom_title}
              onChange={(event) => onChange({ ...draft, custom_title: event.target.value })}
            />
          </label>
          <label>
            Owner
            <input placeholder="Marcus, HR, Security lead" value={draft.owner} onChange={(event) => onChange({ ...draft, owner: event.target.value })} />
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as DocumentStatus })}>
              {documentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Storage link or file path
            <input
              placeholder="C:\\Docs\\Policy.docx or https://..."
              value={draft.storage_link}
              onChange={(event) => onChange({ ...draft, storage_link: event.target.value })}
            />
          </label>
          <label>
            Last review date
            <input type="date" value={draft.last_review_date} onChange={(event) => onChange({ ...draft, last_review_date: event.target.value })} />
          </label>
          <label>
            Next review date
            <input type="date" value={draft.next_review_date} onChange={(event) => onChange({ ...draft, next_review_date: event.target.value })} />
          </label>
          <label>
            Review cadence (months)
            <input
              inputMode="numeric"
              placeholder="12"
              value={draft.review_frequency_months}
              onChange={(event) => onChange({ ...draft, review_frequency_months: event.target.value })}
            />
          </label>
          <label className="wide">
            Tags
            <input placeholder="policy, governance, evidence" value={draft.tags_text} onChange={(event) => onChange({ ...draft, tags_text: event.target.value })} />
          </label>
          <label className="wide">
            Internal notes
            <textarea
              placeholder="What this document proves, where the source lives, or what needs updating next."
              rows={4}
              value={draft.notes}
              onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            />
          </label>
          <div className="card-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Save document
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CatalogModal({ title, draft, onChange, onClose, onSubmit }: CatalogModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-card" role="dialog">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Starter item</span>
            <h3>{title}</h3>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="toggle-row">
            <span>Required item</span>
            <input checked={draft.required} onChange={(event) => onChange({ ...draft, required: event.target.checked })} type="checkbox" />
          </label>
          <label className="toggle-row">
            <span>Active in workspace</span>
            <input checked={draft.active} onChange={(event) => onChange({ ...draft, active: event.target.checked })} type="checkbox" />
          </label>
          <label>
            Suggested owner role
            <input value={draft.default_owner_role} onChange={(event) => onChange({ ...draft, default_owner_role: event.target.value })} />
          </label>
          <label>
            Review cadence (months)
            <input
              inputMode="numeric"
              value={draft.review_frequency_months}
              onChange={(event) => onChange({ ...draft, review_frequency_months: event.target.value })}
            />
          </label>
          <label className="wide">
            English description
            <textarea rows={3} value={draft.description_en} onChange={(event) => onChange({ ...draft, description_en: event.target.value })} />
          </label>
          <label className="wide">
            Swedish helper text
            <textarea rows={3} value={draft.description_sv} onChange={(event) => onChange({ ...draft, description_sv: event.target.value })} />
          </label>
          <div className="card-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Save starter item
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
