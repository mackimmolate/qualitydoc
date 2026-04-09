import { type FormEvent, startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from 'react'

import { api, isPagesDemo } from './api'
import { CatalogModal, DocumentModal } from './components/Modals'
import type {
  CatalogItem,
  DashboardData,
  DocumentFilters,
  DocumentRecord,
  LibraryFile,
  LibraryFilters,
  Settings,
  ViewName,
} from './types'
import {
  catalogToDraft,
  documentToDraft,
  emptyDocumentDraft,
  emptyToNull,
  libraryFileToDraft,
  numberOrNull,
  settingsToDraft,
  toDocumentPayload,
} from './utils/ui'
import { CatalogView } from './views/CatalogView'
import { DashboardView } from './views/DashboardView'
import { DocumentsView } from './views/DocumentsView'
import { LibraryView } from './views/LibraryView'
import { SettingsView } from './views/SettingsView'

type DocumentEditorState = {
  mode: 'create' | 'edit'
  documentId?: number
  sourceLibraryFileId?: number
  draft: ReturnType<typeof emptyDocumentDraft>
}

type CatalogEditorState = {
  itemId: number
  title: string
  draft: ReturnType<typeof catalogToDraft>
}

const viewLabels: Record<ViewName, string> = {
  dashboard: 'Dashboard',
  library: 'Library',
  documents: 'Documents',
  catalog: 'Catalog',
  settings: 'Settings',
}

function App() {
  const [activeView, setActiveView] = useState<ViewName>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<ReturnType<typeof settingsToDraft> | null>(null)
  const [documentEditor, setDocumentEditor] = useState<DocumentEditorState | null>(null)
  const [catalogEditor, setCatalogEditor] = useState<CatalogEditorState | null>(null)
  const [filters, setFilters] = useState<DocumentFilters>({
    query: '',
    status: 'all',
    area: 'all',
    attention: 'all',
  })
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({
    query: '',
    status: 'unmapped',
    area: 'all',
    presence: 'present',
  })
  const [initializing, setInitializing] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const deferredQuery = useDeferredValue(filters.query)
  const deferredLibraryQuery = useDeferredValue(libraryFilters.query)

  const loadWorkspace = useEffectEvent(async (nextDocumentFilters: DocumentFilters, nextLibraryFilters: LibraryFilters) => {
    if (!initializing) {
      setRefreshing(true)
    }

    setError(null)
    try {
      const [nextDashboard, nextCatalog, nextDocuments, nextLibraryFiles, nextSettings] = await Promise.all([
        api.getDashboard(),
        api.getCatalog(),
        api.getDocuments(nextDocumentFilters),
        api.getLibraryFiles(nextLibraryFilters),
        api.getSettings(),
      ])
      setDashboard(nextDashboard)
      setCatalog(nextCatalog)
      setDocuments(nextDocuments)
      setLibraryFiles(nextLibraryFiles)
      setSettings(nextSettings)
      setSettingsDraft(settingsToDraft(nextSettings))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load the workspace.')
    } finally {
      setInitializing(false)
      setRefreshing(false)
    }
  })

  useEffect(() => {
    void loadWorkspace(
      { ...filters, query: deferredQuery },
      { ...libraryFilters, query: deferredLibraryQuery },
    )
  }, [deferredQuery, deferredLibraryQuery, filters, libraryFilters, refreshKey])

  const maybeSendNotifications = useEffectEvent((nextDashboard: DashboardData, nextSettings: Settings) => {
    if (!nextSettings.notification_enabled || typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission !== 'granted') {
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    if (window.localStorage.getItem('qualitydoc:last-notification-day') === today) {
      return
    }

    const snippets: string[] = []
    if (nextDashboard.summary.overdue > 0) snippets.push(`${nextDashboard.summary.overdue} overdue`)
    if (nextDashboard.summary.missing_required > 0) snippets.push(`${nextDashboard.summary.missing_required} missing`)
    if (nextDashboard.summary.needs_owner > 0) snippets.push(`${nextDashboard.summary.needs_owner} without owner`)

    if (snippets.length === 0) {
      return
    }

    new Notification(`${nextSettings.workspace_name} attention`, { body: snippets.join(' | ') })
    window.localStorage.setItem('qualitydoc:last-notification-day', today)
  })

  useEffect(() => {
    if (dashboard && settings) {
      maybeSendNotifications(dashboard, settings)
    }
  }, [dashboard, settings])

  function updateFilter<K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) {
    startTransition(() => {
      setFilters((current) => ({ ...current, [key]: value }))
    })
  }

  function updateLibraryFilter<K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) {
    startTransition(() => {
      setLibraryFilters((current) => ({ ...current, [key]: value }))
    })
  }

  function refreshCurrentView() {
    setRefreshKey((current) => current + 1)
  }

  function openCreateDocument(catalogItemId?: number) {
    const suggestedCatalog = catalogItemId ?? catalog.find((item) => item.missing)?.id ?? catalog[0]?.id
    setDocumentEditor({ mode: 'create', draft: emptyDocumentDraft(suggestedCatalog) })
    setActiveView('documents')
  }

  function openImportFromLibrary(file: LibraryFile) {
    setDocumentEditor({
      mode: 'create',
      sourceLibraryFileId: file.id,
      draft: libraryFileToDraft(file),
    })
    setActiveView('library')
  }

  function openEditDocument(document: DocumentRecord) {
    setDocumentEditor({ mode: 'edit', documentId: document.id, draft: documentToDraft(document) })
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!documentEditor) return

    setBusyLabel(documentEditor.mode === 'create' ? 'Saving document...' : 'Updating document...')
    setError(null)
    setNotice(null)
    try {
      const payload = toDocumentPayload(documentEditor.draft)
      if (documentEditor.mode === 'create' && documentEditor.sourceLibraryFileId) {
        await api.createDocumentFromLibrary(documentEditor.sourceLibraryFileId, payload)
        setNotice('Library file imported into the register.')
      } else if (documentEditor.mode === 'create') {
        await api.createDocument(payload)
        setNotice('Document saved. TISAX coverage refreshed.')
      } else if (documentEditor.documentId) {
        await api.updateDocument(documentEditor.documentId, payload)
        setNotice('Document updated.')
      }
      setDocumentEditor(null)
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save the document.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function saveCatalogItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!catalogEditor) return

    setBusyLabel('Updating catalog item...')
    setError(null)
    setNotice(null)
    try {
      await api.updateCatalog(catalogEditor.itemId, {
        required: catalogEditor.draft.required,
        active: catalogEditor.draft.active,
        default_owner_role: emptyToNull(catalogEditor.draft.default_owner_role),
        review_frequency_months: numberOrNull(catalogEditor.draft.review_frequency_months),
        description_en: emptyToNull(catalogEditor.draft.description_en),
        description_sv: emptyToNull(catalogEditor.draft.description_sv),
      })
      setCatalogEditor(null)
      setNotice('Starter catalog updated.')
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update the catalog item.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settingsDraft) return

    setBusyLabel('Saving settings...')
    setError(null)
    setNotice(null)
    try {
      const updated = await api.updateSettings({
        workspace_name: settingsDraft.workspace_name.trim() || 'QualityDoc',
        notification_enabled: settingsDraft.notification_enabled,
        due_soon_days: numberOrNull(settingsDraft.due_soon_days) ?? 30,
        document_root_path: emptyToNull(settingsDraft.document_root_path),
      })
      setSettings(updated)
      setSettingsDraft(settingsToDraft(updated))
      setNotice('Settings saved.')
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save settings.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function openLinkedDocument(documentId: number) {
    setBusyLabel('Opening linked document...')
    setError(null)
    setNotice(null)
    try {
      const response = await api.openDocumentLink(documentId)
      setNotice(response.message)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to open the linked document.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function openLibraryFile(fileId: number) {
    setBusyLabel('Opening scanned file...')
    setError(null)
    setNotice(null)
    try {
      const response = await api.openLibraryFile(fileId)
      setNotice(response.message)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to open the scanned file.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function updateLibraryMapping(fileId: number, catalogItemId: number | null) {
    setBusyLabel('Saving library mapping...')
    setError(null)
    setNotice(null)
    try {
      await api.updateLibraryFile(fileId, { catalog_item_id: catalogItemId })
      setNotice('Library mapping updated.')
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update the library mapping.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function toggleIgnored(file: LibraryFile) {
    const nextStatus = file.import_status === 'ignored' ? 'unmapped' : 'ignored'
    setBusyLabel(nextStatus === 'ignored' ? 'Ignoring file...' : 'Returning file to inbox...')
    setError(null)
    setNotice(null)
    try {
      await api.updateLibraryFile(file.id, { import_status: nextStatus })
      setNotice(nextStatus === 'ignored' ? 'File removed from the active inbox.' : 'File returned to the active inbox.')
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update the library status.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function scanLibrary() {
    setBusyLabel('Scanning local document library...')
    setError(null)
    setNotice(null)
    try {
      const result = await api.scanLibrary()
      setNotice(
        `Scan complete: ${result.scanned_count} files checked, ${result.discovered_count} new, ${result.updated_count} refreshed, ${result.missing_count} missing from disk.`,
      )
      refreshCurrentView()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to scan the document library.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
      setError('Browser notifications are not available in this environment.')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotice('Browser notifications enabled. Bra val.')
    } else {
      setError('Notification permission was not granted.')
    }
  }

  const groupedCatalog = catalog.reduce<Record<string, CatalogItem[]>>((groups, item) => {
    groups[item.area] = [...(groups[item.area] ?? []), item]
    return groups
  }, {})
  const areaOptions = Array.from(new Set(catalog.map((item) => item.area)))

  if (initializing) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <span className="eyebrow">QualityDoc</span>
          <h1>Building your TISAX workspace</h1>
          <p>Loading starter catalog, scanned library files, documents, and reminder rules.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Local-first TISAX register</span>
          <h1>{settings?.workspace_name ?? 'QualityDoc'}</h1>
          <p>
            Calm control over TISAX evidence, review cadence, and missing documentation.
            <span className="helper-copy"> Enkel att anvanda, tydlig att folja upp.</span>
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card soft">
            <span>Coverage</span>
            <strong>{dashboard?.summary.coverage_percent ?? 0}%</strong>
            <small>of required starter items</small>
          </div>
          <div className="metric-card">
            <span>Library inbox</span>
            <strong>{libraryFiles.filter((file) => file.import_status === 'unmapped' && file.is_present).length}</strong>
            <small>scanned files still to review</small>
          </div>
          <div className="metric-card alert">
            <span>Attention</span>
            <strong>{(dashboard?.summary.missing_required ?? 0) + (dashboard?.summary.overdue ?? 0)}</strong>
            <small>missing or overdue</small>
          </div>
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <nav className="view-nav" aria-label="Primary">
            {Object.entries(viewLabels).map(([view, label]) => (
              <button
                key={view}
                className={activeView === view ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveView(view as ViewName)}
                type="button"
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <section className="sidebar-card">
            <h2>What v1 does best</h2>
            <p>Tracks document ownership, freshness, starter coverage, and now scans your local document library for import.</p>
          </section>
          <section className="sidebar-card compact">
            <h2>Smart rules</h2>
            <ul className="mini-list">
              <li>Flags missing required TISAX documents</li>
              <li>Indexes your local Word and Excel library by filename metadata</li>
              <li>Turns scanned files into linked register records without duplicating storage</li>
            </ul>
          </section>
        </aside>

        <main className="workspace-main">
          <div className="toolbar">
            <div>
              <span className="eyebrow">Current view</span>
              <h2>{viewLabels[activeView]}</h2>
            </div>
            <div className="toolbar-actions">
              <button className="secondary-button" onClick={refreshCurrentView} type="button">
                Refresh
              </button>
              <button className="primary-button" onClick={() => openCreateDocument()} type="button">
                Add document
              </button>
            </div>
          </div>

          {refreshing ? <div className="info-banner subtle">Refreshing data...</div> : null}
          {isPagesDemo ? (
            <div className="info-banner subtle">
              GitHub Pages demo mode. Changes stay in this browser only, and local file paths cannot be opened here.
            </div>
          ) : null}
          {busyLabel ? <div className="info-banner subtle">{busyLabel}</div> : null}
          {error ? <div className="info-banner danger">{error}</div> : null}
          {notice ? <div className="info-banner success">{notice}</div> : null}

          {activeView === 'dashboard' && dashboard ? (
            <DashboardView
              dashboard={dashboard}
              documents={documents}
              onCreateDocument={() => openCreateDocument()}
              onBrowseCatalog={() => setActiveView('catalog')}
            />
          ) : null}

          {activeView === 'library' ? (
            <LibraryView
              files={libraryFiles}
              catalog={catalog}
              filters={libraryFilters}
              settings={settings}
              isPagesDemo={isPagesDemo}
              onUpdateFilter={updateLibraryFilter}
              onScan={scanLibrary}
              onOpenFile={openLibraryFile}
              onPrepareImport={openImportFromLibrary}
              onUpdateMapping={updateLibraryMapping}
              onToggleIgnored={toggleIgnored}
            />
          ) : null}

          {activeView === 'documents' ? (
            <DocumentsView
              documents={documents}
              filters={filters}
              areaOptions={areaOptions}
              onUpdateFilter={updateFilter}
              onEditDocument={openEditDocument}
              onOpenDocument={openLinkedDocument}
            />
          ) : null}

          {activeView === 'catalog' ? (
            <CatalogView
              groupedCatalog={groupedCatalog}
              onEditItem={(item) => setCatalogEditor({ itemId: item.id, title: item.title, draft: catalogToDraft(item) })}
              onCreateRecord={openCreateDocument}
            />
          ) : null}

          {activeView === 'settings' && settingsDraft ? (
            <SettingsView
              draft={settingsDraft}
              onChange={setSettingsDraft}
              onSubmit={saveSettings}
              onRequestNotifications={requestNotificationPermission}
            />
          ) : null}
        </main>
      </div>

      {documentEditor ? (
        <DocumentModal
          catalog={catalog}
          draft={documentEditor.draft}
          mode={documentEditor.mode}
          onChange={(draft) => setDocumentEditor((current) => (current ? { ...current, draft } : current))}
          onClose={() => setDocumentEditor(null)}
          onSubmit={saveDocument}
        />
      ) : null}

      {catalogEditor ? (
        <CatalogModal
          title={catalogEditor.title}
          draft={catalogEditor.draft}
          onChange={(draft) => setCatalogEditor((current) => (current ? { ...current, draft } : current))}
          onClose={() => setCatalogEditor(null)}
          onSubmit={saveCatalogItem}
        />
      ) : null}
    </div>
  )
}

export default App
