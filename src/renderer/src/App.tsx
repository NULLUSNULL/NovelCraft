import { useEffect, useRef } from 'react'
import { AlertTriangle, Feather, Loader2 } from 'lucide-react'
import { useAppStore } from './store/useAppStore'
import {
  useAutoSave,
  useAutoSaveSettings,
  useBeforeClose,
  useGlobalShortcuts,
  useTheme
} from './lib/hooks'
import { TitleBar } from './components/TitleBar'
import { Rail } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Inspector } from './components/Inspector'
import { WriteView } from './components/write/WriteView'
import { CodexView } from './components/codex/CodexView'
import { PlotsView } from './components/plots/PlotsView'
import { PublishView } from './components/publish/PublishView'
import { ProjectManager } from './components/project/ProjectManager'
import { SettingsModal } from './components/settings/SettingsModal'
import { CommandPalette } from './components/commands/CommandPalette'
import { SnapshotsDialog } from './components/history/SnapshotsDialog'
import { BackupManager } from './components/history/BackupManager'
import { TrashDialog } from './components/history/TrashDialog'
import { Toasts } from './components/ui/Toasts'
import { AppIcon } from './components/AppIcon'
import { FirstRunTour } from './components/help/FirstRunTour'

const EDITOR_FONTS = {
  serif: "'Newsreader Variable', Georgia, serif",
  sans: "'Manrope Variable', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono Variable', monospace"
} as const

export default function App() {
  const booted = useAppStore((state) => state.booted)
  const bootError = useAppStore((state) => state.bootError)
  const bootstrap = useAppStore((state) => state.bootstrap)
  const project = useAppStore((state) => state.project)
  const view = useAppStore((state) => state.view)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const inspectorOpen = useAppStore((state) => state.inspectorOpen)
  const inspectorTab = useAppStore((state) => state.inspectorTab)
  const focusMode = useAppStore((state) => state.focusMode)
  const settings = useAppStore((state) => state.settings)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen)
  const setInspectorTab = useAppStore((state) => state.setInspectorTab)
  const bootStarted = useRef(false)

  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true
    void bootstrap()
  }, [bootstrap])

  useTheme()
  useAutoSave()
  useAutoSaveSettings()
  useBeforeClose()
  useGlobalShortcuts()

  useEffect(() => {
    if (settings.ai.enabled || inspectorTab !== 'ai') return
    setInspectorTab('scene')
    setInspectorOpen(true)
  }, [inspectorTab, setInspectorOpen, setInspectorTab, settings.ai.enabled])

  useEffect(() => {
    document.title = project ? `${project.title} — NovelCraft` : 'NovelCraft'
  }, [project])

  const showSidebar = Boolean(project) && sidebarOpen && !focusMode
  const showInspector =
    Boolean(project) &&
    inspectorOpen &&
    !focusMode &&
    (view === 'write' || (view !== 'plots' && inspectorTab === 'ai'))

  if (!booted) {
    return (
      <div className="splash" data-testid="splash">
        <div className="splash-glow" />
        <div className="splash-brand">
          <AppIcon className="brand-mark xl" />
          <h1>NovelCraft</h1>
          <p>Estudio literario</p>
        </div>
        <Loader2 size={17} className="splash-spinner" style={{ animation: 'spin 900ms linear infinite' }} />
      </div>
    )
  }

  return (
    <div
      className={`app ${focusMode ? 'focus-mode' : ''} ${settings.editor.focusDim ? 'dim-mode' : ''}`}
      data-animations={settings.general.animations ? 'on' : 'off'}
      style={{
        '--editor-width': `${settings.editor.maxWidth}px`,
        '--editor-line-height': settings.editor.lineHeight,
        '--editor-font': EDITOR_FONTS[settings.editor.fontFamily]
      } as React.CSSProperties}
    >
      <TitleBar />
      <div className="app-body">
        {!focusMode && <Rail />}
        {showSidebar && <Sidebar />}
        {showSidebar && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Cerrar panel lateral" />}
        <main className="workspace">
          <div className="workspace-inner">
            {bootError ? (
              <div className="boot-error">
                <div className="empty-icon"><AlertTriangle size={24} /></div>
                <h2>No se pudo iniciar la biblioteca</h2>
                <p>{bootError}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  <Feather size={14} />
                  Reintentar
                </button>
              </div>
            ) : !project ? (
              <div className="no-project">
                <div className="empty-icon"><Feather size={24} /></div>
                <h2>Tu historia espera</h2>
                <p>Abre o crea un proyecto desde la biblioteca.</p>
                <button className="btn btn-primary" onClick={() => useAppStore.getState().setProjectManagerOpen(true)}>
                  Abrir biblioteca
                </button>
              </div>
            ) : (
              <div className="view">
                {view === 'write' && <WriteView />}
                {view === 'codex' && <CodexView />}
                {view === 'plots' && <PlotsView />}
                {view === 'publish' && <PublishView />}
              </div>
            )}
          </div>
          {showInspector && <Inspector />}
          {showInspector && <button className="inspector-backdrop" onClick={() => setInspectorOpen(false)} aria-label="Cerrar inspector" />}
        </main>
      </div>

      <ProjectManager />
      <SettingsModal />
      <SnapshotsDialog />
      <BackupManager />
      <TrashDialog />
      <CommandPalette />
      <FirstRunTour />
      <Toasts />
    </div>
  )
}
