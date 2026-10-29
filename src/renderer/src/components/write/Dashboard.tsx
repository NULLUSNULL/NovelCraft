import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Feather,
  FilePlus2,
  MapPin,
  Network,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  Target,
  UsersRound
} from 'lucide-react'
import {
  formatNumber,
  getManuscriptScenes,
  getNoteChildren,
  getProjectWordCount,
  initials,
  stripHtml
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ProjectForm, projectToForm } from '../project/ProjectManager'
import { AppIcon } from '../AppIcon'

export function Dashboard() {
  const project = useAppStore((state) => state.project)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const setView = useAppStore((state) => state.setView)
  const addScene = useAppStore((state) => state.addScene)
  const addChapter = useAppStore((state) => state.addChapter)
  const addNote = useAppStore((state) => state.addNote)
  const selectPlot = useAppStore((state) => state.selectPlot)
  const selectEntity = useAppStore((state) => state.selectEntity)
  const [editOpen, setEditOpen] = useState(false)
  if (!project) return null

  const scenes = getManuscriptScenes(project)
  const notes = getNoteChildren(project)
  const words = getProjectWordCount(project)
  const progress = project.wordGoal ? Math.min(100, Math.round((words / project.wordGoal) * 100)) : 0
  const remaining = Math.max(0, project.wordGoal - words)
  const activePlots = project.plots.filter((plot) => plot.status === 'activa')
  const continueScene =
    project.nodes[project.lastDocumentId] && (project.nodes[project.lastDocumentId].type === 'scene' || project.nodes[project.lastDocumentId].type === 'note')
      ? project.nodes[project.lastDocumentId]
      : scenes.find((scene) => scene.status === 'draft') || scenes[0]
  const continueChapter = continueScene ? project.nodes[continueScene.parentId] : undefined
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const recentScenes = [...scenes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const recentNotes = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

  return (
    <div className="dashboard" data-testid="dashboard">
      <div className="dashboard-inner">
        <header className="dashboard-hero-header">
          <div>
            <div className="dashboard-greeting">{greeting}{project.author ? `, ${project.author.split(' ')[0]}` : ''}</div>
            <h1>{project.title}</h1>
            <div className="dashboard-subtitle">
              <span>{project.genre}</span>
              <span className="dot-sep" />
              <span>{project.language}</span>
              <span className="dot-sep" />
              <span>{scenes.length} escenas</span>
            </div>
          </div>
          <div className="dashboard-header-actions">
            <button className="btn" onClick={() => setEditOpen(true)}>
              <Pencil size={14} />
              Editar proyecto
            </button>
            <button className="btn" onClick={() => setView('publish')}>
              <BookOpen size={14} />
              Publicar
            </button>
            <button className="btn btn-primary" onClick={() => (continueScene ? selectDocument(continueScene.id) : addScene(getFirstChapterId(project)))}>
              <Feather size={14} />
              Seguir escribiendo
            </button>
          </div>
        </header>

        <div className="dashboard-grid-top">
          <section className="dashboard-card project-overview">
            <div
              className="overview-cover"
              style={{
                '--cover': project.coverColor,
                ...(project.coverImage
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.5)), url(${project.coverImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }
                  : {})
              } as React.CSSProperties}
            >
              <AppIcon className="overview-cover-mark" />
              <span className="overview-cover-title">{project.title}</span>
              <span className="overview-cover-author">{project.author}</span>
            </div>
            <div className="overview-content">
              <div className="overview-eyebrow">
                <Sparkles size={12} />
                Sinopsis
              </div>
              <p className="overview-synopsis">
                {stripHtml(project.synopsis) || 'Aún no has escrito la sinopsis de tu novela. Añádela para darle un norte a la historia.'}
              </p>
              {project.description && <p className="overview-description">{project.description}</p>}
              <div className="overview-tags">
                <span className="chip accent">{project.genre}</span>
                <span className="chip">{formatNumber(words)} palabras</span>
                <span className="chip">{project.plots.length} tramas</span>
              </div>
            </div>
          </section>

          <section className="dashboard-card progress-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Objetivo</div>
                <h2>Progreso de escritura</h2>
              </div>
              <Target size={17} className="accent" />
            </div>
            <div className="progress-ring-wrap">
              <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg`, '--ring-color': project.coverColor } as React.CSSProperties}>
                <div className="progress-ring-inner">
                  <strong>{progress}%</strong>
                  <span>completado</span>
                </div>
              </div>
              <div className="progress-breakdown">
                <div>
                  <span className="progress-value">{formatNumber(words)}</span>
                  <span className="progress-label">escritas</span>
                </div>
                <div>
                  <span className="progress-value">{formatNumber(remaining)}</span>
                  <span className="progress-label">restantes</span>
                </div>
                <div>
                  <span className="progress-value">{formatNumber(project.wordGoal)}</span>
                  <span className="progress-label">objetivo</span>
                </div>
              </div>
            </div>
            <div className="progress-target-note">
              <Clock3 size={13} />
              {project.targetDate
                ? `Fecha objetivo: ${new Date(project.targetDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Define una fecha objetivo en los ajustes del proyecto.'}
            </div>
          </section>
        </div>

        <div className="dashboard-grid-main">
          <section className="dashboard-card continue-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Retomar</div>
                <h2>{continueScene ? continueScene.title : 'Tu primera escena'}</h2>
              </div>
              <Feather size={17} className="accent" />
            </div>
            {continueScene ? (
              <>
                <div className="continue-context">
                  <span>{continueChapter?.title || 'Manuscrito'}</span>
                  <span className="dot-sep" />
                  <span>{formatNumber(continueScene.wordCount)} palabras</span>
                  <span className={`chip ${continueScene.status === 'final' ? 'green' : 'accent'}`}>{continueScene.status}</span>
                </div>
                <p className="continue-excerpt">
                  {stripHtml(continueScene.content).slice(0, 330) || continueScene.summary || 'Esta escena todavía está en blanco. Es un buen momento para empezar.'}
                </p>
                <button className="btn btn-primary" onClick={() => selectDocument(continueScene.id)}>
                  Continuar escribiendo
                  <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => addChapter()}>
                Crear el primer capítulo
              </button>
            )}
            <div className="quick-actions">
              <button onClick={() => addChapter()}>
                <FilePlus2 size={14} />
                Capítulo
              </button>
              <button onClick={() => { const chapterId = getFirstChapterId(project); if (chapterId) selectDocument(chapterId) }}>
                <BookOpen size={14} />
                Manuscrito
              </button>
              <button onClick={() => addNote()}>
                <NotebookPen size={14} />
                Nota
              </button>
              <button onClick={() => setView('codex')}>
                <UsersRound size={14} />
                Codex
              </button>
            </div>
          </section>

          <section className="dashboard-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Narrativa</div>
                <h2>Tramas activas</h2>
              </div>
              <button className="icon-btn sm" onClick={() => setView('plots')} title="Ver grafos">
                <Network size={14} />
              </button>
            </div>
            <div className="dashboard-plot-list">
              {activePlots.slice(0, 4).map((plot) => (
                <button
                  className="dashboard-plot-row"
                  key={plot.id}
                  onClick={() => {
                    selectPlot(plot.id)
                    setView('plots')
                  }}
                >
                  <span className="plot-swatch" style={{ background: plot.color }} />
                  <span className="grow">
                    <span className="dashboard-plot-title">{plot.title}</span>
                    <span className="dashboard-plot-meta">{plot.sceneIds.length} escenas · {plot.type}</span>
                  </span>
                  <ArrowRight size={13} />
                </button>
              ))}
              {!activePlots.length && (
                <div className="dashboard-empty">
                  <Network size={20} />
                  <p>No hay tramas activas. Crea la primera para conectar tu historia.</p>
                  <button className="btn sm" onClick={() => setView('plots')}>
                    <Plus size={12} />
                    Ir a tramas
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="dashboard-grid-bottom">
          <section className="dashboard-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Elenco</div>
                <h2>Personajes</h2>
              </div>
              <button className="icon-btn sm" onClick={() => setView('codex')} title="Abrir codex">
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="character-strip">
              {project.characters.slice(0, 5).map((character) => (
                <button
                  className="character-mini"
                  key={character.id}
                  onClick={() => selectEntity('character', character.id)}
                  title={character.name}
                >
                  <span
                    className="character-mini-avatar"
                    style={{
                      background: character.avatar ? undefined : character.color,
                      backgroundImage: character.avatar ? `url(${character.avatar})` : undefined
                    }}
                  >
                    {!character.avatar && initials(character.name)}
                  </span>
                  <span className="character-mini-name">{character.name.split(' ')[0]}</span>
                  <span className="character-mini-role">{character.role.split('·')[0] || 'Personaje'}</span>
                </button>
              ))}
              {!project.characters.length && (
                <div className="dashboard-empty">
                  <UsersRound size={20} />
                  <p>Da vida a tu historia creando tu primer personaje.</p>
                  <button className="btn sm" onClick={() => setView('codex')}>Crear personaje</button>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Reciente</div>
                <h2>Escenas</h2>
              </div>
              <span className="faint" style={{ fontSize: 10 }}>{scenes.length} en total</span>
            </div>
            <div className="recent-list">
              {recentScenes.map((scene) => (
                <button className="recent-row" key={scene.id} onClick={() => selectDocument(scene.id)}>
                  <span className={`status-dot ${scene.status}`} />
                  <span className="grow">
                    <span className="recent-title">{scene.title}</span>
                    <span className="recent-sub">{project.nodes[scene.parentId]?.title}</span>
                  </span>
                  <span className="recent-words">{formatNumber(scene.wordCount)}</span>
                </button>
              ))}
              {!recentScenes.length && (
                <div className="dashboard-empty">
                  <Feather size={20} />
                  <p>Todavía no hay escenas escritas.</p>
                  <button className="btn sm" onClick={() => addScene(getFirstChapterId(project))}>Escribir la primera</button>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-card">
            <div className="card-heading-row">
              <div>
                <div className="card-eyebrow">Investigación</div>
                <h2>Notas recientes</h2>
              </div>
              <button className="icon-btn sm" onClick={() => addNote()} title="Nueva nota">
                <Plus size={14} />
              </button>
            </div>
            <div className="recent-list">
              {recentNotes.map((note) => (
                <button className="recent-row" key={note.id} onClick={() => selectDocument(note.id)}>
                  <NotebookPen size={13} style={{ color: note.noteColor }} />
                  <span className="grow">
                    <span className="recent-title">{note.title}</span>
                    <span className="recent-sub">{note.summary || 'Nota de investigación'}</span>
                  </span>
                </button>
              ))}
              {!recentNotes.length && (
                <div className="dashboard-empty">
                  <NotebookPen size={20} />
                  <p>Guarda referencias, ideas y documentación del mundo.</p>
                  <button className="btn sm" onClick={() => addNote()}>Crear nota</button>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="dashboard-footer">
          <span><MapPin size={11} /> {project.locations.length} ubicaciones</span>
          <span>{project.items.length} ítems</span>
          <span>{project.plots.length} tramas</span>
          <span className="grow" />
          <span className="faint">NovelCraft · Estudio literario</span>
        </footer>
      </div>
      <ProjectForm
        open={editOpen}
        mode="edit"
        projectId={project.id}
        initial={projectToForm(project)}
        onClose={() => setEditOpen(false)}
      />
    </div>
  )
}

function getFirstChapterId(project: { nodes: Record<string, { type: string; parentId: string; order: number }> }): string {
  const chapter = Object.values(project.nodes)
    .filter((node) => node.type === 'chapter')
    .sort((a, b) => a.order - b.order)[0]
  return chapter ? Object.entries(project.nodes).find(([, node]) => node === chapter)?.[0] || '' : ''
}
