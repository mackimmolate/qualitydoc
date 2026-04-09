import type { CatalogItem, LibraryFile, LibraryFilters, Settings } from '../types'
import { formatBytes, formatDate, formatDateTime } from '../utils/ui'

type LibraryViewProps = {
  files: LibraryFile[]
  catalog: CatalogItem[]
  filters: LibraryFilters
  settings: Settings | null
  isPagesDemo: boolean
  onUpdateFilter: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void
  onScan: () => void
  onOpenFile: (fileId: number) => void
  onPrepareImport: (file: LibraryFile) => void
  onUpdateMapping: (fileId: number, catalogItemId: number | null) => void
  onToggleIgnored: (file: LibraryFile) => void
}

export function LibraryView({
  files,
  catalog,
  filters,
  settings,
  isPagesDemo,
  onUpdateFilter,
  onScan,
  onOpenFile,
  onPrepareImport,
  onUpdateMapping,
  onToggleIgnored,
}: LibraryViewProps) {
  const presentFiles = files.filter((file) => file.is_present)
  const linkedFiles = files.filter((file) => file.import_status === 'linked')
  const unmappedFiles = files.filter((file) => file.import_status === 'unmapped')
  const missingFiles = files.filter((file) => !file.is_present)
  const areaOptions = Array.from(
    new Set(files.map((file) => file.effective_catalog_area).filter((value): value is string => Boolean(value))),
  )

  if (isPagesDemo) {
    return (
      <section className="view-grid">
        <article className="panel">
          <span className="eyebrow">Local only</span>
          <h3>Library scanning is disabled in GitHub Pages mode</h3>
          <p>
            The Pages demo cannot inspect local folders. Use the local app to scan `Total dokument 240326` and import
            real files into the register.
          </p>
        </article>
      </section>
    )
  }

  return (
    <section className="view-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Document root</span>
            <h3>Local evidence library</h3>
          </div>
          <button className="primary-button" onClick={onScan} type="button">
            Scan library
          </button>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span>Present files</span>
            <strong>{presentFiles.length}</strong>
          </div>
          <div className="summary-card">
            <span>Unmapped</span>
            <strong>{unmappedFiles.length}</strong>
          </div>
          <div className="summary-card">
            <span>Linked</span>
            <strong>{linkedFiles.length}</strong>
          </div>
          <div className="summary-card">
            <span>Missing on disk</span>
            <strong>{missingFiles.length}</strong>
          </div>
        </div>
        <p className="helper-copy">
          Root path: {settings?.document_root_path ?? 'Not configured'}
          {' | '}
          Last scan: {formatDateTime(settings?.library_last_scanned_at ?? null)}
        </p>
      </article>

      {!settings?.document_root_path ? (
        <article className="panel">
          <span className="eyebrow">Configuration needed</span>
          <h3>Set a document root path in Settings</h3>
          <p>
            Point the app at `Total dokument 240326`, save settings, then run a scan. The scan stores metadata only and
            keeps the original files in place.
          </p>
        </article>
      ) : null}

      <article className="panel filter-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Review queue</span>
            <h3>Scanned files</h3>
          </div>
        </div>
        <div className="filter-grid">
          <label>
            Search
            <input
              placeholder="title, filename, mapped catalog"
              type="search"
              value={filters.query}
              onChange={(event) => onUpdateFilter('query', event.target.value)}
            />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => onUpdateFilter('status', event.target.value as LibraryFilters['status'])}>
              <option value="all">All statuses</option>
              <option value="unmapped">Unmapped</option>
              <option value="linked">Linked</option>
              <option value="ignored">Ignored</option>
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
            Presence
            <select value={filters.presence} onChange={(event) => onUpdateFilter('presence', event.target.value as LibraryFilters['presence'])}>
              <option value="present">Present only</option>
              <option value="missing">Missing only</option>
              <option value="all">Present + missing</option>
            </select>
          </label>
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Inbox</span>
            <h3>{files.length} scanned files in view</h3>
          </div>
        </div>
        <div className="stack">
          {files.length === 0 ? (
            <p className="muted">No scanned files yet. Run a library scan after you configure the document root.</p>
          ) : (
            files.map((file) => (
              <article className="document-card" key={file.id}>
                <div className="document-header">
                  <div>
                    <h4>{file.title_guess}</h4>
                    <p>{file.filename}</p>
                  </div>
                  <div className="pill-row">
                    <span className={`pill ${file.is_present ? 'success' : 'danger'}`}>
                      {file.is_present ? 'On disk' : 'Missing on disk'}
                    </span>
                    <span className={`pill ${file.import_status === 'linked' ? 'success' : file.import_status === 'ignored' ? 'muted' : 'warning'}`}>
                      {file.import_status}
                    </span>
                  </div>
                </div>

                <div className="document-meta">
                  <span>
                    <strong>Date:</strong> {formatDate(file.document_date)}
                  </span>
                  <span>
                    <strong>Revision:</strong> {file.revision ?? 'n/a'}
                  </span>
                  <span>
                    <strong>Size:</strong> {formatBytes(file.file_size_bytes)}
                  </span>
                </div>

                <div className="stack tight">
                  <label>
                    Mapped TISAX item
                    <select
                      value={file.catalog_item_id ?? ''}
                      onChange={(event) => onUpdateMapping(file.id, event.target.value ? Number(event.target.value) : null)}
                    >
                      <option value="">No saved mapping</option>
                      {catalog.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} | {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="library-note">
                    <strong>Suggestion:</strong>{' '}
                    {file.suggested_catalog_title
                      ? `${file.suggested_catalog_code} | ${file.suggested_catalog_title}`
                      : 'No strong suggestion yet'}
                  </div>
                  <div className="library-note">
                    <strong>Path:</strong> {file.relative_path}
                  </div>
                  {file.linked_document_title ? (
                    <div className="library-note">
                      <strong>Linked record:</strong> {file.linked_document_title}
                    </div>
                  ) : null}
                </div>

                <div className="card-actions">
                  <button className="secondary-button" onClick={() => onPrepareImport(file)} type="button">
                    Create record
                  </button>
                  <button className="secondary-button" disabled={!file.is_present} onClick={() => onOpenFile(file.id)} type="button">
                    Open file
                  </button>
                  <button className="secondary-button" onClick={() => onToggleIgnored(file)} type="button">
                    {file.import_status === 'ignored' ? 'Return to inbox' : 'Ignore'}
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
