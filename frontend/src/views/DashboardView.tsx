import type { DashboardData, DocumentRecord } from '../types'
import { formatDate, relativeReviewLabel, severityTone } from '../utils/ui'

type DashboardViewProps = {
  dashboard: DashboardData
  documents: DocumentRecord[]
  onCreateDocument: () => void
  onBrowseCatalog: () => void
}

export function DashboardView({
  dashboard,
  documents,
  onCreateDocument,
  onBrowseCatalog,
}: DashboardViewProps) {
  return (
    <section className="view-grid">
      {documents.length === 0 ? (
        <article className="panel intro-panel">
          <span className="eyebrow">Getting started</span>
          <h3>Start from the built-in TISAX catalog</h3>
          <p>
            Your workspace is seeded with a practical starter set. Create a document record for each real policy,
            register, or evidence file you already keep elsewhere.
          </p>
          <div className="intro-actions">
            <button className="primary-button" onClick={onCreateDocument} type="button">
              Create first document
            </button>
            <button className="secondary-button" onClick={onBrowseCatalog} type="button">
              Browse starter catalog
            </button>
          </div>
        </article>
      ) : null}

      <article className="panel summary-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Overview</span>
            <h3>Compliance attention</h3>
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span>Missing required</span>
            <strong>{dashboard.summary.missing_required}</strong>
          </div>
          <div className="summary-card">
            <span>Needs owner</span>
            <strong>{dashboard.summary.needs_owner}</strong>
          </div>
          <div className="summary-card">
            <span>Due soon</span>
            <strong>{dashboard.summary.due_soon}</strong>
          </div>
          <div className="summary-card">
            <span>Overdue</span>
            <strong>{dashboard.summary.overdue}</strong>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Alerts</span>
            <h3>Top priorities</h3>
          </div>
        </div>
        <div className="stack">
          {dashboard.alerts.length === 0 ? (
            <p className="muted">No urgent gaps right now.</p>
          ) : (
            dashboard.alerts.map((alert) => (
              <article className="alert-row" key={`${alert.kind}-${alert.title}`}>
                <span className={`pill ${severityTone(alert.severity)}`}>{alert.kind.replace('_', ' ')}</span>
                <div>
                  <h4>{alert.title}</h4>
                  <p>{alert.detail}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Upcoming</span>
            <h3>Next review dates</h3>
          </div>
        </div>
        <div className="stack">
          {dashboard.upcoming_reviews.length === 0 ? (
            <p className="muted">No review dates scheduled yet.</p>
          ) : (
            dashboard.upcoming_reviews.map((document) => (
              <article className="review-row" key={document.id}>
                <div>
                  <h4>{document.title}</h4>
                  <p>{document.area}</p>
                </div>
                <div className="review-date">
                  <span className={`pill ${document.overdue ? 'danger' : document.due_soon ? 'warning' : 'success'}`}>
                    {relativeReviewLabel(document)}
                  </span>
                  <strong>{formatDate(document.next_review_date)}</strong>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
