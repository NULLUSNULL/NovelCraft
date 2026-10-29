import { BookCheck, CheckCircle2, Circle, FileText, Sparkles } from 'lucide-react'
import { formatNumber, getManuscriptScenes, getManuscriptChapters, getProjectWordCount } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { CoverUpload } from '../ui/Form'

export function PublishSidebar() {
  const project = useAppStore((state) => state.project)
  const updateProjectMeta = useAppStore((state) => state.updateProjectMeta)
  if (!project) return null
  const scenes = getManuscriptScenes(project)
  const chapters = getManuscriptChapters(project)
  const words = getProjectWordCount(project)
  const finalized = scenes.filter((scene) => scene.status === 'final').length
  const checks = [
    { label: 'Sinopsis escrita', done: Boolean(project.synopsis.trim()) },
    { label: 'Capítulos creados', done: chapters.length > 0 },
    { label: 'Escenas con contenido', done: scenes.some((scene) => scene.wordCount > 0) },
    { label: 'Al menos una escena final', done: finalized > 0 },
    { label: 'Objetivo de palabras', done: words >= project.wordGoal }
  ]

  return (
    <>
      <div className="sidebar-scroll publish-sidebar">
        <div className="publish-summary-card">
          <CoverUpload
            compact
            value={project.coverImage || ''}
            color={project.coverColor}
            title={project.title}
            author={project.author}
            width={48}
            height={65}
            onChange={(coverImage) => updateProjectMeta({ coverImage })}
          />
          <div className="publish-summary-info">
            <strong>{project.title}</strong>
            <span>{project.author || 'Autor/a sin definir'}</span>
            <span>{project.genre}</span>
          </div>
        </div>
        <div className="publish-stat-grid">
          <div>
            <span>{formatNumber(words)}</span>
            <small>palabras</small>
          </div>
          <div>
            <span>{chapters.length}</span>
            <small>capítulos</small>
          </div>
          <div>
            <span>{scenes.length}</span>
            <small>escenas</small>
          </div>
          <div>
            <span>{finalized}</span>
            <small>finales</small>
          </div>
        </div>
        <div className="sidebar-section-label">Preparación</div>
        <div className="publish-checklist">
          {checks.map((check) => (
            <div className={`publish-check ${check.done ? 'done' : ''}`} key={check.label}>
              {check.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>{check.label}</span>
            </div>
          ))}
        </div>
        <div className="sidebar-note-card">
          <div className="sidebar-note-head">
            <Sparkles size={12} />
            <span>Consejo</span>
          </div>
          <p>Marca las escenas como «Final» para incluirlas o excluirlas al compilar el manuscrito.</p>
        </div>
      </div>
      <div className="sidebar-footer">
        <div className="goal-line">
          <span><BookCheck size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Manuscrito</span>
          <span className="goal-value">{Math.round((finalized / Math.max(1, scenes.length)) * 100)}% finalizado</span>
        </div>
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${(finalized / Math.max(1, scenes.length)) * 100}%` }} />
        </div>
        <div className="sidebar-footer-meta">
          <span><FileText size={10} /> {scenes.length - finalized} pendientes</span>
          <span>{project.language}</span>
        </div>
      </div>
    </>
  )
}
