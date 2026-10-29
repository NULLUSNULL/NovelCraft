import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { DocumentTree } from './sidebar/DocumentTree'
import { CodexSidebar } from './sidebar/CodexSidebar'
import { PlotsSidebar } from './sidebar/PlotsSidebar'
import { PublishSidebar } from './sidebar/PublishSidebar'

export function Sidebar() {
  const view = useAppStore((state) => state.view)
  const project = useAppStore((state) => state.project)
  const addChapter = useAppStore((state) => state.addChapter)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const setTrashOpen = useAppStore((state) => state.setTrashOpen)

  if (!project) return null

  const config = {
    write: { eyebrow: 'Manuscrito', title: 'Estructura', sub: 'Planifica capítulos y escenas' },
    codex: { eyebrow: 'Enciclopedia', title: 'Codex', sub: 'El mundo de tu novela' },
    plots: { eyebrow: 'Narrativa', title: 'Tramas', sub: 'Conexiones y temporalidad' },
    publish: { eyebrow: 'Salida', title: 'Publicar', sub: 'Compila y exporta tu obra' }
  }[view]

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div>
          <div className="sidebar-eyebrow">{config.eyebrow}</div>
          <h1 className="sidebar-heading">{config.title}</h1>
          <p className="sidebar-sub">{config.sub}</p>
        </div>
        <div className="row">
          {view === 'write' && (
            <button className="icon-btn sm" onClick={() => addChapter()} title="Nuevo capítulo">
              <Plus size={15} />
            </button>
          )}
          <button
            className="icon-btn sm sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            title="Ocultar panel"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      </header>
      {view === 'write' && <DocumentTree />}
      {view === 'codex' && <CodexSidebar />}
      {view === 'plots' && <PlotsSidebar />}
      {view === 'publish' && <PublishSidebar />}
      {view === 'write' && (
        <button className="sidebar-trash-btn" onClick={() => setTrashOpen(true)} title="Abrir papelera">
          <Trash2 size={13} />
          <span>Papelera</span>
          {project.trash.length > 0 && <span className="sidebar-trash-count">{project.trash.length}</span>}
        </button>
      )}
    </aside>
  )
}
