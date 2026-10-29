import { useState } from 'react'
import { Check, Minus, Search, Square, X, CloudOff, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { AppIcon } from './AppIcon'

export function TitleBar() {
  const project = useAppStore((state) => state.project)
  const appInfo = useAppStore((state) => state.appInfo)
  const saveStatus = useAppStore((state) => state.saveStatus)
  const setProjectManagerOpen = useAppStore((state) => state.setProjectManagerOpen)
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen)
  const [maximized, setMaximized] = useState(false)
  const isMac = appInfo?.platform === 'darwin'

  return (
    <header className={`titlebar ${isMac ? 'platform-darwin' : ''}`}>
      <div className="titlebar-brand">
        <AppIcon className="brand-mark" />
        <span className="brand-name">NovelCraft</span>
      </div>
      {project && (
        <button className="project-chip" onClick={() => setProjectManagerOpen(true)} title="Abrir gestor de proyectos">
          <span className="project-chip-dot" style={{ background: project.coverColor, color: project.coverColor }} />
          <span className="project-chip-name">{project.title}</span>
          {saveStatus === 'saving' && <Loader2 size={11} className="spin" style={{ animation: 'spin 800ms linear infinite' }} />}
          {saveStatus === 'saved' && <Check size={11} style={{ color: 'var(--green)' }} />}
          {saveStatus === 'error' && <CloudOff size={11} style={{ color: 'var(--danger)' }} />}
        </button>
      )}
      <div className="titlebar-center">
        <button className="command-trigger" onClick={() => setCommandPaletteOpen(true)}>
          <Search size={13} />
          <span>Buscar o ejecutar un comando</span>
          <span className="kbd">Ctrl K</span>
        </button>
      </div>
      {!isMac && (
        <div className="window-controls">
          <button className="window-control" onClick={() => window.novelcraft.minimizeWindow()} title="Minimizar">
            <Minus size={14} />
          </button>
          <button
            className="window-control"
            onClick={async () => setMaximized(await window.novelcraft.maximizeWindow())}
            title={maximized ? 'Restaurar' : 'Maximizar'}
          >
            <Square size={11} />
          </button>
          <button className="window-control close" onClick={() => window.novelcraft.closeWindow()} title="Cerrar">
            <X size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
