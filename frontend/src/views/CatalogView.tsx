import type { CatalogItem } from '../types'

type CatalogViewProps = {
  groupedCatalog: Record<string, CatalogItem[]>
  onEditItem: (item: CatalogItem) => void
  onCreateRecord: (itemId: number) => void
}

export function CatalogView({ groupedCatalog, onEditItem, onCreateRecord }: CatalogViewProps) {
  return (
    <section className="view-grid">
      {Object.entries(groupedCatalog).map(([area, items]) => (
        <article className="panel" key={area}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{area}</span>
              <h3>{items.length} starter items</h3>
            </div>
          </div>
          <div className="stack">
            {items.map((item) => (
              <article className="catalog-card" key={item.id}>
                <div className="catalog-header">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{`${item.code} | ${item.required ? 'Required' : 'Optional'}`}</p>
                  </div>
                  <div className="pill-row">
                    <span className={`pill ${item.missing ? 'danger' : 'success'}`}>
                      {item.missing ? 'Missing' : `${item.coverage_count} linked`}
                    </span>
                  </div>
                </div>
                <p>{item.description_en}</p>
                <p className="helper-copy">{item.description_sv}</p>
                <div className="catalog-meta">
                  <span>
                    <strong>Owner role:</strong> {item.default_owner_role ?? 'Not set'}
                  </span>
                  <span>
                    <strong>Review cadence:</strong> {item.review_frequency_months ?? 'n/a'} months
                  </span>
                </div>
                <div className="pill-row">
                  {item.tisax_tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="secondary-button" onClick={() => onEditItem(item)} type="button">
                    Edit starter item
                  </button>
                  <button className="secondary-button" onClick={() => onCreateRecord(item.id)} type="button">
                    Create linked record
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
