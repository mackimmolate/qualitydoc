import type { FormEvent } from 'react'

import type { SettingsDraft } from '../utils/ui'

type SettingsViewProps = {
  draft: SettingsDraft
  onChange: (draft: SettingsDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onRequestNotifications: () => void
}

export function SettingsView({ draft, onChange, onSubmit, onRequestNotifications }: SettingsViewProps) {
  return (
    <section className="view-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Workspace</span>
            <h3>Local settings</h3>
          </div>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Workspace name
            <input value={draft.workspace_name} onChange={(event) => onChange({ ...draft, workspace_name: event.target.value })} />
          </label>
          <label>
            Due soon window (days)
            <input
              inputMode="numeric"
              value={draft.due_soon_days}
              onChange={(event) => onChange({ ...draft, due_soon_days: event.target.value })}
            />
          </label>
          <label className="wide">
            Document root path
            <input
              placeholder="C:\\Users\\marcusj\\Documents\\GitHub\\qualitydoc\\Total dokument 240326"
              value={draft.document_root_path}
              onChange={(event) => onChange({ ...draft, document_root_path: event.target.value })}
            />
          </label>
          <label className="toggle-row">
            <span>Browser notifications</span>
            <input
              checked={draft.notification_enabled}
              onChange={(event) => onChange({ ...draft, notification_enabled: event.target.checked })}
              type="checkbox"
            />
          </label>
          <p className="helper-copy">
            Notifications run in-app once per day while the app is open. The document root is scanned locally and the
            original Word and Excel files stay outside the app.
          </p>
          <div className="card-actions">
            <button className="secondary-button" onClick={onRequestNotifications} type="button">
              Request browser permission
            </button>
            <button className="primary-button" type="submit">
              Save settings
            </button>
          </div>
        </form>
      </article>
    </section>
  )
}
