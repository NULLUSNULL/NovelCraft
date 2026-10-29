import { useMemo } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  MapPin,
  NotebookPen,
  Sparkles,
  Target,
  UserRound,
  X
} from 'lucide-react'
import type { DocumentNode } from '@shared/types'
import {
  formatNumber,
  getChapterScenes,
  getStatusLabel
} from '@shared/project'
import { useAppStore } from '../store/useAppStore'
import { AiAssistant } from './AiAssistant'
import { ColorPicker, Field, MultiSelect, TagInput } from './ui/Form'
import { Switch } from './ui/Modal'

function InspectorSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-head">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function SceneInspector({ node }: { node: DocumentNode }) {
  const project = useAppStore((state) => state.project)
  const updateNode = useAppStore((state) => state.updateNode)
  const selectDocument = useAppStore((state) => state.selectDocument)
  if (!project) return null
  const chapter = project.nodes[node.parentId]
  const characterOptions = project.characters.map((character) => ({
    id: character.id,
    label: character.name,
    sub: character.role,
    color: character.color
  }))
  const locationOptions = project.locations.map((location) => ({
    id: location.id,
    label: location.name,
    sub: location.type,
    color: location.color
  }))
  const plotOptions = project.plots.map((plot) => ({
    id: plot.id,
    label: plot.title,
    sub: plot.type,
    color: plot.color
  }))
  const itemOptions = project.items.map((item) => ({
    id: item.id,
    label: item.name,
    sub: item.type,
    color: item.color
  }))

  return (
    <div className="inspector-scroll">
      <InspectorSection title="Metadatos de escena" icon={<FileText size={13} />}>
        <Field label="Estado">
          <div className="status-pills">
            {(['idea', 'outline', 'draft', 'revised', 'final'] as const).map((status) => (
              <button
                key={status}
                className={node.status === status ? 'active' : ''}
                onClick={() => updateNode(node.id, { status })}
              >
                <span className={`status-dot ${status}`} />
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Resumen">
          <textarea
            className="textarea sm"
            value={node.summary}
            onChange={(event) => updateNode(node.id, { summary: event.target.value })}
            placeholder="Qué ocurre y qué cambia en esta escena..."
            rows={3}
          />
        </Field>
        <Field label="Capítulo">
          <button className="inspector-chapter-link" onClick={() => chapter && selectDocument(chapter.id)}>
            <BookOpen size={12} />
            <span>{chapter?.title || 'Sin capítulo'}</span>
            <ArrowRight size={12} />
          </button>
        </Field>
      </InspectorSection>

      <InspectorSection title="Vínculos" icon={<Sparkles size={13} />}>
        <Field label="Punto de vista">
          <MultiSelect
            options={characterOptions}
            value={node.pov ? [node.pov] : []}
            onChange={(next) => updateNode(node.id, { pov: next[0] || '' })}
            placeholder="Sin POV asignado"
            compact
          />
        </Field>
        <Field label="Ubicación">
          <MultiSelect
            options={locationOptions}
            value={node.locationId ? [node.locationId] : []}
            onChange={(next) => updateNode(node.id, { locationId: next[0] || '' })}
            placeholder="Sin ubicación"
            compact
          />
        </Field>
        <Field label="Personajes">
          <MultiSelect
            options={characterOptions}
            value={node.characterIds}
            onChange={(characterIds) => updateNode(node.id, { characterIds })}
            placeholder="Añadir personajes"
            compact
          />
        </Field>
        <Field label="Tramas">
          <MultiSelect
            options={plotOptions}
            value={node.plotIds}
            onChange={(plotIds) => updateNode(node.id, { plotIds })}
            placeholder="Vincular tramas"
            compact
          />
        </Field>
        <Field label="Ítems">
          <MultiSelect
            options={itemOptions}
            value={node.itemIds}
            onChange={(itemIds) => updateNode(node.id, { itemIds })}
            placeholder="Vincular ítems"
            compact
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Tensión dramática" icon={<Target size={13} />}>
        <Field label="Objetivo de la escena">
          <textarea className="textarea sm" value={node.goal} onChange={(event) => updateNode(node.id, { goal: event.target.value })} rows={2} placeholder="Qué busca el personaje" />
        </Field>
        <Field label="Conflicto">
          <textarea className="textarea sm" value={node.conflict} onChange={(event) => updateNode(node.id, { conflict: event.target.value })} rows={2} placeholder="Qué se opone" />
        </Field>
        <Field label="Resultado">
          <textarea className="textarea sm" value={node.outcome} onChange={(event) => updateNode(node.id, { outcome: event.target.value })} rows={2} placeholder="Qué cambia al final" />
        </Field>
      </InspectorSection>

      <InspectorSection title="Temporalidad" icon={<CalendarDays size={13} />}>
        <div className="field-row">
          <Field label="Fecha">
            <input className="input sm" type="date" value={node.storyDate} onChange={(event) => updateNode(node.id, { storyDate: event.target.value })} />
          </Field>
          <Field label="Hora">
            <input className="input sm" type="time" value={node.storyTime} onChange={(event) => updateNode(node.id, { storyTime: event.target.value })} />
          </Field>
        </div>
        <Field label="Objetivo de palabras" hint={node.wordGoal > 0 ? `${formatNumber(node.wordCount)} de ${formatNumber(node.wordGoal)} palabras` : 'Sin objetivo'}>
          <input
            className="input sm"
            type="number"
            min={0}
            step={100}
            value={node.wordGoal || ''}
            onChange={(event) => updateNode(node.id, { wordGoal: Number(event.target.value) || 0 })}
            placeholder="Ej. 1200"
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Etiquetas">
        <TagInput value={node.tags} onChange={(tags) => updateNode(node.id, { tags })} />
      </InspectorSection>
    </div>
  )
}

function ChapterInspector({ node }: { node: DocumentNode }) {
  const project = useAppStore((state) => state.project)
  const updateNode = useAppStore((state) => state.updateNode)
  const selectDocument = useAppStore((state) => state.selectDocument)
  if (!project) return null
  const scenes = getChapterScenes(project, node.id)
  const words = scenes.reduce((total, scene) => total + scene.wordCount, 0)
  return (
    <div className="inspector-scroll">
      <InspectorSection title="Capítulo" icon={<BookOpen size={13} />}>
        <Field label="Resumen">
          <textarea
            className="textarea sm"
            value={node.summary}
            onChange={(event) => updateNode(node.id, { summary: event.target.value })}
            rows={4}
            placeholder="Objetivo del capítulo, arco de tensión..."
          />
        </Field>
        <div className="inspector-stat-grid">
          <div>
            <span>{scenes.length}</span>
            <small>escenas</small>
          </div>
          <div>
            <span>{formatNumber(words)}</span>
            <small>palabras</small>
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Escenas">
        <div className="inspector-scene-list">
          {scenes.map((scene, index) => (
            <button key={scene.id} onClick={() => selectDocument(scene.id)}>
              <span className="inspector-scene-index">{index + 1}</span>
              <span className="grow">
                <span className="inspector-scene-title">{scene.title}</span>
                <span className="inspector-scene-meta">{scene.status} · {formatNumber(scene.wordCount)} palabras</span>
              </span>
              <ArrowRight size={12} />
            </button>
          ))}
          {!scenes.length && <p className="form-empty-text">Sin escenas. Añade la primera desde la vista del capítulo.</p>}
        </div>
      </InspectorSection>
    </div>
  )
}

function NoteInspector({ node }: { node: DocumentNode }) {
  const updateNode = useAppStore((state) => state.updateNode)
  return (
    <div className="inspector-scroll">
      <InspectorSection title="Nota de investigación" icon={<NotebookPen size={13} />}>
        <Field label="Resumen">
          <textarea className="textarea sm" value={node.summary} onChange={(event) => updateNode(node.id, { summary: event.target.value })} rows={3} placeholder="Idea principal de esta nota..." />
        </Field>
        <div className="setting-row" style={{ padding: '10px 0' }}>
          <div className="setting-info">
            <div className="setting-title">Fijar nota</div>
            <div className="setting-desc">Mantén esta nota visible en tu espacio de trabajo.</div>
          </div>
          <Switch checked={node.pinned} onChange={(pinned) => updateNode(node.id, { pinned })} />
        </div>
        <Field label="Color">
          <ColorPicker value={node.noteColor} onChange={(noteColor) => updateNode(node.id, { noteColor })} />
        </Field>
        <Field label="Etiquetas">
          <TagInput value={node.tags} onChange={(tags) => updateNode(node.id, { tags })} />
        </Field>
      </InspectorSection>
      <InspectorSection title="Actividad">
        <div className="inspector-timeline">
          <div>
            <span />
            <p>Creada el {new Date(node.createdAt).toLocaleDateString('es-ES')}</p>
          </div>
          <div>
            <span />
            <p>Última edición {new Date(node.updatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </InspectorSection>
    </div>
  )
}

export function Inspector() {
  const project = useAppStore((state) => state.project)
  const view = useAppStore((state) => state.view)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const inspectorTab = useAppStore((state) => state.inspectorTab)
  const setInspectorTab = useAppStore((state) => state.setInspectorTab)
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen)
  const node = project && selectedDocumentId ? project.nodes[selectedDocumentId] : undefined
  const isWrite = view === 'write'
  const activeTab = isWrite ? inspectorTab : 'ai'

  const title = useMemo(() => {
    if (!node) return 'Inspector'
    if (node.type === 'chapter') return 'Capítulo'
    if (node.type === 'note') return 'Nota'
    return 'Escena'
  }, [node])

  return (
    <aside className="inspector">
      <div className="inspector-head">
        {isWrite ? (
          <div className="inspector-tabs">
            <button className={activeTab === 'scene' ? 'active' : ''} onClick={() => setInspectorTab('scene')}>
              <FileText size={12} />
              {title}
            </button>
            <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setInspectorTab('ai')}>
              <Sparkles size={12} />
              Asistente
            </button>
          </div>
        ) : (
          <div className="inspector-standalone-title">
            <span className="ai-orb small">
              <Sparkles size={12} />
            </span>
            Asistente IA
          </div>
        )}
        <button className="icon-btn sm" onClick={() => setInspectorOpen(false)} title="Cerrar panel">
          <X size={14} />
        </button>
      </div>

      {activeTab === 'ai' ? (
        <AiAssistant />
      ) : !node ? (
        <div className="inspector-scroll">
          <div className="inspector-placeholder">
            <div className="empty-icon" style={{ width: 45, height: 45, borderRadius: 13, marginBottom: 10 }}>
              <UserRound size={19} />
            </div>
            <h3>Sin documento activo</h3>
            <p>Selecciona una escena, capítulo o nota para editar sus metadatos.</p>
          </div>
        </div>
      ) : node.type === 'scene' ? (
        <SceneInspector node={node} />
      ) : node.type === 'chapter' ? (
        <ChapterInspector node={node} />
      ) : (
        <NoteInspector node={node} />
      )}
    </aside>
  )
}
