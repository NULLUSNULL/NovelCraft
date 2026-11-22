import { useState } from 'react'
import { ArrowRight, BookOpen, FilePlus2, MapPin, Sparkles, UsersRound } from 'lucide-react'
import type { DocumentNode } from '@shared/types'
import { formatNumber, getChapterScenes, getStatusLabel, stripHtml } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ChapterAnalysisReview } from './ChapterAnalysisReview'

export function ChapterOverview({ chapter }: { chapter: DocumentNode }) {
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const updateNode = useAppStore((state) => state.updateNode)
  const addScene = useAppStore((state) => state.addScene)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  if (!project) return null
  const scenes = getChapterScenes(project, chapter.id)
  const analysisProvider = settings.providers.find(
    (provider) =>
      provider.id === settings.ai.activeProviderId &&
      provider.protocol !== 'comfyui' &&
      provider.supportsText !== false
  )
  const possessionEvents = (project.itemPossessionEvents || [])
    .filter((event) => event.chapterId === chapter.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const words = scenes.reduce((total, scene) => total + scene.wordCount, 0)
  const finalScenes = scenes.filter((scene) => scene.status === 'final').length
  const povs = Array.from(new Set(scenes.map((scene) => scene.pov).filter(Boolean)))
    .map((id) => project.characters.find((character) => character.id === id)?.name)
    .filter(Boolean)
  const locations = Array.from(new Set(scenes.map((scene) => scene.locationId).filter(Boolean)))
    .map((id) => project.locations.find((location) => location.id === id)?.name)
    .filter(Boolean)

  return (
    <div className="chapter-page">
      <div className="chapter-inner">
        <div className="doc-breadcrumb">
          <BookOpen size={12} />
          <span>Manuscrito</span>
          <span className="breadcrumb-sep">/</span>
          <span>Capítulo</span>
        </div>
        <input
          className="title-input chapter-title-input"
          value={chapter.title}
          onChange={(event) => updateNode(chapter.id, { title: event.target.value })}
          aria-label="Título del capítulo"
        />
        <textarea
          className="chapter-summary-input"
          value={chapter.summary}
          onChange={(event) => updateNode(chapter.id, { summary: event.target.value })}
          placeholder="Resumen del capítulo, objetivo dramático, lo que cambia..."
          rows={2}
        />
        <div className="chapter-meta-row">
          <span className="chip">{formatNumber(words)} palabras</span>
          <span className="chip">{scenes.length} escenas</span>
          <span className="chip green">{finalScenes} finalizadas</span>
          {povs.length > 0 && (
            <span className="chapter-meta-detail">
              <UsersRound size={12} /> POV: {povs.join(', ')}
            </span>
          )}
          {locations.length > 0 && (
            <span className="chapter-meta-detail">
              <MapPin size={12} /> {locations.slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        <div className="chapter-outline-head">
          <div>
            <div className="card-eyebrow">Outline</div>
            <h2>Escenas del capítulo</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={() => setAnalysisOpen(true)}
              disabled={!analysisProvider}
              title={analysisProvider ? 'Analizar tramas y posesión de objetos del capítulo' : 'Configura un proveedor de texto activo en Ajustes > IA'}
            >
              <Sparkles size={13} />
              Analizar capítulo
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => addScene(chapter.id)}>
              <FilePlus2 size={13} />
              Nueva escena
            </button>
          </div>
        </div>
        {!analysisProvider && (
          <p className="field-hint" style={{ marginTop: -10 }}>
            Para analizar, configura un proveedor de texto activo en Ajustes → IA.
          </p>
        )}

        <div className="scene-card-list">
          {scenes.map((scene, index) => {
            const pov = project.characters.find((character) => character.id === scene.pov)
            const location = project.locations.find((item) => item.id === scene.locationId)
            return (
              <button
                className="scene-card"
                key={scene.id}
                onClick={() => selectDocument(scene.id)}
              >
                <span className="scene-card-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="scene-card-main">
                  <span className="scene-card-top">
                    <span className="scene-card-title">{scene.title}</span>
                    <span className={`chip status-chip-${scene.status}`}>{getStatusLabel(scene.status)}</span>
                  </span>
                  <span className="scene-card-summary">
                    {scene.summary || stripHtml(scene.content).slice(0, 150) || 'Escena sin resumen todavía.'}
                  </span>
                  <span className="scene-card-meta">
                    <span>{formatNumber(scene.wordCount)} palabras</span>
                    {pov && <span>POV: {pov.name}</span>}
                    {location && <span>{location.name}</span>}
                    {scene.storyDate && <span>{scene.storyDate}{scene.storyTime ? ` · ${scene.storyTime}` : ''}</span>}
                  </span>
                </span>
                <span className="scene-card-progress">
                  <span className="scene-card-bar">
                    <span style={{ width: `${Math.min(100, scene.wordGoal ? (scene.wordCount / scene.wordGoal) * 100 : scene.wordCount > 0 ? 100 : 0)}%` }} />
                  </span>
                  {scene.wordGoal > 0 && <span className="faint">{scene.wordCount}/{scene.wordGoal}</span>}
                </span>
                <ArrowRight size={15} className="scene-card-arrow" />
              </button>
            )
          })}
          {!scenes.length && (
            <button className="scene-card scene-card-empty" onClick={() => addScene(chapter.id)}>
              <FilePlus2 size={19} />
              <span>
                <strong>Primera escena de «{chapter.title}»</strong>
                <small>Empieza a escribir y deja que la historia encuentre su ritmo.</small>
              </span>
            </button>
          )}
        </div>

        {possessionEvents.length > 0 && (
          <section className="chapter-note" aria-label="Historial de posesión de objetos">
            <strong>Historial de posesión aceptado</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {possessionEvents.map((event) => {
                const item = project.items.find((entry) => entry.id === event.itemId)
                const from = project.characters.find((entry) => entry.id === event.fromCharacterId)
                const to = project.characters.find((entry) => entry.id === event.toCharacterId)
                const scene = project.nodes[event.sceneId]
                const eventLabel = event.action === 'acquisition'
                  ? `${to?.name || 'Un personaje'} adquirió`
                  : event.action === 'loss'
                    ? `${from?.name || 'Un personaje'} perdió`
                    : `${from?.name || 'Un personaje'} transfirió a ${to?.name || 'otro personaje'}`
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="text-link"
                    onClick={() => scene && selectDocument(scene.id)}
                    style={{ textAlign: 'left', overflowWrap: 'anywhere' }}
                  >
                    {eventLabel} «{item?.name || 'objeto'}» · {scene?.title || 'escena'}
                    {event.summary ? ` — ${event.summary}` : ''}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <div className="chapter-note">
          <strong>Consejo de estructura</strong>
          <p>Un capítulo suele funcionar cuando cada escena cambia algo: una decisión, una revelación o una relación.</p>
        </div>
      </div>
      {analysisOpen && analysisProvider && (
        <ChapterAnalysisReview
          project={project}
          chapterId={chapter.id}
          provider={analysisProvider}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </div>
  )
}
