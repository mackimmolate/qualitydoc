import { type FormEvent, startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from 'react'

import { api, isPagesDemo } from './api'
import { CatalogModal, DocumentModal } from './components/Modals'
import type {
  CatalogItem,
  DashboardData,
  DocumentFilters,
  DocumentRecord,
  Settings,
  ViewName,
} from './types'
import {
  catalogToDraft,
  emptyDocumentDraft,
  emptyToNull,
  numberOrNull,
  settingsToDraft,
  toDocumentPayload,
  documentToDraft,
} from './utils/ui'
import { CatalogView } from './views/CatalogView'
import { DashboardView } from './views/DashboardView'
import { DocumentsView } from './views/DocumentsView'
import { SettingsView } from './views/SettingsView'

type DocumentEditorState = {
  mode: 'create' | 'edit'
  documentId?: number
  draft: ReturnType<typeof emptyDocumentDraft>
}

type CatalogEditorState = {
  itemId: number
  title: string
  draft: ReturnType<typeof catalogToDraft>
}

const viewLabels: Record<ViewName, string> = {
  dashboard: 'Dashboard',
  documents: 'Documents',
  catalog: 'Catalog',
  settings: 'Settings',
}

function App() {
  const [activeView, setActiveView] = useState<ViewName>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
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
  const [initializing, setInitializing] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const deferredQuery = useDeferredValue(filters.query)

  const loadWorkspace = useEffectEvent(async (nextFilters: DocumentFilters) => {
    if (!initializing) {
      setRefreshing(true)
    }

    setError(null)
    try {
      const [nextDashboard, nextCatalog, nextDocuments, nextSettings] = await Promise.all([
        api.getDashboard(),
        api.getCatalog(),
        api.getDocuments(nextFilters),
        api.getSettings(),
      ])
      setDashboard(nextDashboard)
      setCatalog(nextCatalog)
      setDocuments(nextDocuments)
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
    void loadWorkspace({ ...filters, query: deferredQuery })
  }, [deferredQuery, filters, refreshKey])

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

  function refreshCurrentView() {
    setRefreshKey((current) => current + 1)
  }

  function openCreateDocument(catalogItemId?: number) {
    const suggestedCatalog = catalogItemId ?? catalog.find((item) => item.missing)?.id ?? catalog[0]?.id
    setDocumentEditor({ mode: 'create', draft: emptyDocumentDraft(suggestedCatalog) })
    setActiveView('documents')
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
      if (documentEditor.mode === 'create') {
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
          <p>Loading starter catalog, documents, and reminder rules.</p>
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
          <div className="metric-card soft"><span>Coverage</span><strong>{dashboard?.summary.coverage_percent ?? 0}%</strong><small>of required starter items</small></div>
          <div className="metric-card"><span>Active documents</span><strong>{dashboard?.summary.active_documents ?? 0}</strong><small>documents currently in play</small></div>
          <div className="metric-card alert"><span>Attention</span><strong>{(dashboard?.summary.missing_required ?? 0) + (dashboard?.summary.overdue ?? 0)}</strong><small>missing or overdue</small></div>
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <nav className="view-nav" aria-label="Primary">
            {Object.entries(viewLabels).map(([view, label]) => (
              <button key={view} className={activeView === view ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(view as ViewName)} type="button">
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <section className="sidebar-card">
            <h2>What v1 does best</h2>
            <p>Tracks document ownership, freshness, starter coverage, and reminders without adding process overhead.</p>
          </section>
          <section className="sidebar-card compact">
            <h2>Smart rules</h2>
            <ul className="mini-list">
              <li>Flags missing required TISAX documents</li>
              <li>Surfaces stale review dates and owner gaps</li>
              <li>Keeps files outside the app with safe open-link actions</li>
            </ul>
          </section>
        </aside>

        <main className="workspace-main">
          <div className="toolbar">
            <div><span className="eyebrow">Current view</span><h2>{viewLabels[activeView]}</h2></div>
            <div className="toolbar-actions">
              <button className="secondary-button" onClick={refreshCurrentView} type="button">Refresh</button>
              <button className="primary-button" onClick={() => openCreateDocument()} type="button">Add document</button>
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

          {activeView === 'dashboard' && dashboard ? <DashboardView dashboard={dashboard} documents={documents} onCreateDocument={() => openCreateDocument()} onBrowseCatalog={() => setActiveView('catalog')} /> : null}
          {activeView === 'documents' ? <DocumentsView documents={documents} filters={filters} areaOptions={areaOptions} onUpdateFilter={updateFilter} onEditDocument={openEditDocument} onOpenDocument={openLinkedDocument} /> : null}
          {activeView === 'catalog' ? <CatalogView groupedCatalog={groupedCatalog} onEditItem={(item) => setCatalogEditor({ itemId: item.id, title: item.title, draft: catalogToDraft(item) })} onCreateRecord={openCreateDocument} /> : null}
          {activeView === 'settings' && settingsDraft ? <SettingsView draft={settingsDraft} onChange={setSettingsDraft} onSubmit={saveSettings} onRequestNotifications={requestNotificationPermission} /> : null}
        </main>
      </div>

      {documentEditor ? <DocumentModal catalog={catalog} draft={documentEditor.draft} mode={documentEditor.mode} onChange={(draft) => setDocumentEditor((current) => (current ? { ...current, draft } : current))} onClose={() => setDocumentEditor(null)} onSubmit={saveDocument} /> : null}
      {catalogEditor ? <CatalogModal title={catalogEditor.title} draft={catalogEditor.draft} onChange={(draft) => setCatalogEditor((current) => (current ? { ...current, draft } : current))} onClose={() => setCatalogEditor(null)} onSubmit={saveCatalogItem} /> : null}
    </div>
  )
}

export default App
