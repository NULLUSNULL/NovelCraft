import { Link2, Network, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getManuscriptScenes } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'

const TYPE_LABEL: Record<string, string> = {
  principal: 'Principal',
  secundaria: 'Secundaria',
  romance: 'Romance',
  misterio: 'Misterio',
  conflicto: 'Conflicto',
  tema: 'Tema'
}

export function PlotsSidebar() {
  const project = useAppStore((state) => state.project)
  const selectedPlotId = useAppStore((state) => state.selectedPlotId)
  const selectPlot = useAppStore((state) => state.selectPlot)
  const addPlot = useAppStore((state) => state.addPlot)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!project) return []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return project.plots
    return project.plots.filter((plot) =>
      `${plot.title} ${plot.type} ${plot.status} ${plot.summary} ${plot.tags.join(' ')}`
        .toLowerCase()
        .includes(normalized)
    )
  }, [project, query])

  if (!project) return null
  const sceneCount = getManuscriptScenes(project).length

  return (
    <>
      <div className="sidebar-toolbar">
        <div className="search-box">
          <Search size={13} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tramas..." />
        </div>
        <button className="icon-btn sm" onClick={() => addPlot()} title="Nueva trama">
          <Plus size={15} />
        </button>
      </div>
      <div className="sidebar-scroll">
        <div className="sidebar-section-label">Tramas · {filtered.length}</div>
        <div className="plot-list">
          {filtered.map((plot) => (
            <button
              className={`plot-row ${selectedPlotId === plot.id ? 'selected' : ''}`}
              key={plot.id}
              onClick={() => selectPlot(plot.id)}
            >
              <span className="plot-swatch" style={{ background: plot.color }} />
              <span className="grow">
                <span className="plot-name">{plot.title}</span>
                <span className="plot-meta">
                  <span>{TYPE_LABEL[plot.type]}</span>
                  <span>·</span>
                  <span>{plot.status}</span>
                  <span>·</span>
                  <span>{plot.sceneIds.length} escenas</span>
                </span>
              </span>
            </button>
          ))}
          {!filtered.length && (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">
                <Network size={19} />
              </div>
              <h3>{query ? 'Sin resultados' : 'Sin tramas'}</h3>
              <p>Conecta las líneas argumentales de tu novela para ver cómo se cruzan.</p>
              {!query && (
                <button className="btn sm mt-12" onClick={() => addPlot()}>
                  <Plus size={12} />
                  Crear trama
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sidebar-note-card">
          <div className="sidebar-note-head">
            <Link2 size={12} />
            <span>Grafo narrativo</span>
          </div>
          <p>Arrastra desde los conectores de cada trama para crear relaciones de causa, conflicto o convergencia.</p>
        </div>
      </div>
      <div className="sidebar-footer">
        <div className="goal-line">
          <span>{project.plots.length} tramas</span>
          <span className="goal-value">{sceneCount} escenas</span>
        </div>
        <div className="plot-legend">
          {['principal', 'secundaria', 'romance'].map((type) => (
            <span key={type}>
              <i style={{ background: project.plots.find((plot) => plot.type === type)?.color || 'var(--faint)' }} />
              {TYPE_LABEL[type]}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
