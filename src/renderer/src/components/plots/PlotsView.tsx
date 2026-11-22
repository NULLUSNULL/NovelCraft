import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from '@xyflow/react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  GitBranch,
  Link2,
  Maximize2,
  Network,
  PanelRight,
  PanelRightClose,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
  Waypoints,
  X
} from 'lucide-react'
import type { AiProvider, DocumentNode, Plot } from '@shared/types'
import {
  formatNumber,
  getManuscriptChapters,
  getManuscriptScenes,
  getStatusLabel,
  initials,
  scenesForPlot,
  stripHtml
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker, Field, MultiSelect, TagInput } from '../ui/Form'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { ChapterAnalysisReview } from '../write/ChapterAnalysisReview'
import { CodexAiDraftField } from '../codex/CodexAiDraftField'

interface PlotNodeData extends Record<string, unknown> {
  plot: Plot
  characterNames: string[]
  sceneCount: number
  selected: boolean
}

function PlotNodeCard({ data, selected }: NodeProps) {
  const plotData = data as unknown as PlotNodeData
  const plot = plotData.plot
  return (
    <div className={`plot-node ${selected ? 'selected' : ''}`} style={{ '--plot-color': plot.color } as React.CSSProperties}>
      <Handle type="target" position={Position.Left} className="plot-handle" />
      <div className="plot-node-head">
        <span className="plot-node-kind" style={{ color: plot.color }}>
          {plot.type}
        </span>
        <span className={`plot-node-status ${plot.status}`}>{plot.status}</span>
      </div>
      <div className="plot-node-title">{plot.title}</div>
      <div className="plot-node-summary">{plot.summary || plot.premise || 'Sin descripción'}</div>
      <div className="plot-node-foot">
        <span>
          <GitBranch size={10} />
          {plotData.sceneCount} escenas
        </span>
        <span className="plot-node-avatars">
          {plotData.characterNames.slice(0, 3).map((name) => (
            <i key={name} title={name}>{initials(name)}</i>
          ))}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="plot-handle" />
    </div>
  )
}

const nodeTypes = { plot: PlotNodeCard }

const EDGE_STYLE = {
  causa: 'solid',
  conflicto: 'dashed',
  convergencia: 'solid',
  contrapunto: 'dotted'
} as const

function PlotGraph({
  onFit,
  onSelectPlot,
  onSelectEdge
}: {
  onFit: (instance: ReactFlowInstance) => void
  onSelectPlot: () => void
  onSelectEdge: () => void
}) {
  const project = useAppStore((state) => state.project)
  const selectedPlotId = useAppStore((state) => state.selectedPlotId)
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId)
  const selectPlot = useAppStore((state) => state.selectPlot)
  const selectEdge = useAppStore((state) => state.selectEdge)
  const addPlotEdge = useAppStore((state) => state.addPlotEdge)
  const updatePlot = useAppStore((state) => state.updatePlot)

  const initialNodes: Node[] = useMemo(
    () =>
      (project?.plots || []).map((plot) => ({
        id: plot.id,
        type: 'plot',
        position: plot.position,
        data: {
          plot,
          selected: plot.id === selectedPlotId,
          sceneCount: plot.sceneIds.length || plot.chapterIds?.length || 0,
          characterNames: plot.characterIds
            .map((id) => project?.characters.find((character) => character.id === id)?.name)
            .filter((name): name is string => Boolean(name))
        }
      })),
    [project?.plots, project?.characters, selectedPlotId]
  )

  const initialEdges: Edge[] = useMemo(
    () =>
      (project?.plotEdges || []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: edge.type === 'convergencia',
        selected: edge.id === selectedEdgeId,
        style: {
          stroke: edge.id === selectedEdgeId ? 'var(--accent)' : 'color-mix(in srgb, var(--text) 28%, transparent)',
          strokeWidth: edge.id === selectedEdgeId ? 2 : 1.4,
          strokeDasharray: EDGE_STYLE[edge.type] === 'dashed' ? '5 4' : EDGE_STYLE[edge.type] === 'dotted' ? '2 4' : undefined
        },
        labelStyle: { fill: 'var(--muted)', fontSize: 9, fontFamily: 'Manrope Variable' },
        labelBgStyle: { fill: 'var(--bg-1)', fillOpacity: 0.9 },
        labelBgPadding: [4, 3] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'color-mix(in srgb, var(--text) 40%, transparent)', width: 16, height: 16 }
      })),
    [project?.plotEdges, selectedEdgeId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) addPlotEdge(connection.source, connection.target)
    },
    [addPlotEdge]
  )

  if (!project) return null

  return (
    <div className="plot-graph" data-testid="plot-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, node) => {
          selectPlot(node.id)
        }}
        onNodeDoubleClick={(_, node) => {
          selectPlot(node.id)
          onSelectPlot()
        }}
        onEdgeClick={(_, edge) => {
          selectPlot('')
          selectEdge(edge.id)
        }}
        onEdgeDoubleClick={(_, edge) => {
          selectPlot('')
          selectEdge(edge.id)
          onSelectEdge()
        }}
        onPaneClick={() => selectPlot('')}
        onNodeDragStop={(_, node) => updatePlot(node.id, { position: node.position })}
        onInit={onFit}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 1.5 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className="react-flow-dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.1} color="color-mix(in srgb, var(--text) 13%, transparent)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as unknown as PlotNodeData
            return data.plot?.color || 'var(--accent)'
          }}
          maskColor="color-mix(in srgb, var(--bg-0) 72%, transparent)"
          style={{ background: 'var(--bg-1)' }}
        />
      </ReactFlow>
      <div className="plot-graph-hint">
        <Link2 size={11} />
        Arrastra desde el conector derecho de una trama hasta otra para crear una relación.
      </div>
    </div>
  )
}

function PlotTimeline({ onSelectPlot }: { onSelectPlot: () => void }) {
  const project = useAppStore((state) => state.project)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const selectPlot = useAppStore((state) => state.selectPlot)
  if (!project) return null
  const scenes = getManuscriptScenes(project)
  const dated = scenes
    .filter((scene) => scene.storyDate)
    .sort((a, b) => `${a.storyDate}T${a.storyTime || '00:00'}`.localeCompare(`${b.storyDate}T${b.storyTime || '00:00'}`))
  const undated = scenes.filter((scene) => !scene.storyDate)
  const groups = new Map<string, DocumentNode[]>()
  for (const scene of dated) {
    if (!groups.has(scene.storyDate)) groups.set(scene.storyDate, [])
    groups.get(scene.storyDate)?.push(scene)
  }

  const renderScene = (scene: DocumentNode) => {
    const plots = scene.plotIds
      .map((id) => project.plots.find((plot) => plot.id === id))
      .filter((plot): plot is Plot => Boolean(plot))
    return (
      <button className="timeline-scene" key={scene.id} onClick={() => selectDocument(scene.id)}>
        <div className="timeline-scene-head">
          <span className={`status-dot ${scene.status}`} />
          <span className="timeline-scene-title">{scene.title}</span>
          <span className="timeline-scene-time">{scene.storyTime || '—'}</span>
        </div>
        <div className="timeline-scene-summary">
          {scene.summary || stripHtml(scene.content).slice(0, 120) || 'Sin resumen'}
        </div>
        {plots.length > 0 && (
          <div className="timeline-plots">
            {plots.map((plot) => (
              <span
                className="timeline-plot-chip"
                key={plot.id}
                style={{ borderColor: `color-mix(in srgb, ${plot.color} 45%, transparent)`, color: plot.color }}
                onClick={(event) => {
                  event.stopPropagation()
                  selectPlot(plot.id)
                  onSelectPlot()
                }}
              >
                {plot.title}
              </span>
            ))}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="timeline-view">
      <div className="timeline-axis-head">
        <CalendarDays size={13} />
        Cronología de la historia
        <span className="faint">· ordenada por fecha narrativa</span>
      </div>
      {groups.size === 0 && <div className="timeline-empty">Añade fechas a tus escenas para construir la cronología.</div>}
      {[...groups.entries()].map(([date, group]) => (
        <div className="timeline-group" key={date}>
          <div className="timeline-date">
            <span>{new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
            <small>{new Date(`${date}T12:00:00`).getFullYear()}</small>
          </div>
          <div className="timeline-group-line">
            <span className="timeline-dot" />
          </div>
          <div className="timeline-scenes">{group.map(renderScene)}</div>
        </div>
      ))}
      {undated.length > 0 && (
        <div className="timeline-group undated">
          <div className="timeline-date">
            <span>?</span>
            <small>Sin fecha</small>
          </div>
          <div className="timeline-group-line">
            <span className="timeline-dot" />
          </div>
          <div className="timeline-scenes">{undated.map(renderScene)}</div>
        </div>
      )}
    </div>
  )
}

function PlotInspectorPanel({
  open,
  onClose,
  onDelete
}: {
  open: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const project = useAppStore((state) => state.project)
  const selectedPlotId = useAppStore((state) => state.selectedPlotId)
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId)
  const updatePlot = useAppStore((state) => state.updatePlot)
  const updatePlotEdge = useAppStore((state) => state.updatePlotEdge)
  const deletePlotEdge = useAppStore((state) => state.deletePlotEdge)
  const selectEdge = useAppStore((state) => state.selectEdge)
  if (!project) return null
  const plot = project.plots.find((item) => item.id === selectedPlotId)
  const edge = project.plotEdges.find((item) => item.id === selectedEdgeId)

  if (!plot && !edge && open) {
    return (
      <aside className="plots-panel plots-panel-empty" aria-label="Detalles de trama">
        <div className="plots-empty-panel">
          <Network size={20} />
          <h3>Detalles de la trama</h3>
          <p>Selecciona una tarjeta o una conexión del grafo para ver y editar sus características aquí.</p>
        </div>
      </aside>
    )
  }

  if (edge) {
    if (!open) return null
    const source = project.plots.find((item) => item.id === edge.source)
    const target = project.plots.find((item) => item.id === edge.target)
    return (
      <aside className="plots-panel">
        <div className="plots-panel-head">
          <div>
            <div className="card-eyebrow">Conexión</div>
            <h2>Relación de tramas</h2>
          </div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Cerrar detalles de la relación"><X size={14} /></button>
        </div>
        <div className="plots-panel-scroll">
          <div className="edge-endpoints">
            <span style={{ color: source?.color }}>{source?.title}</span>
            <ArrowRight size={14} />
            <span style={{ color: target?.color }}>{target?.title}</span>
          </div>
          <Field label="Etiqueta">
            <input className="input" value={edge.label} onChange={(event) => updatePlotEdge(edge.id, { label: event.target.value })} />
          </Field>
          <Field label="Tipo de relación">
            <select className="select" value={edge.type} onChange={(event) => updatePlotEdge(edge.id, { type: event.target.value as typeof edge.type })}>
              <option value="causa">Causa</option>
              <option value="conflicto">Conflicto</option>
              <option value="convergencia">Convergencia</option>
              <option value="contrapunto">Contrapunto</option>
            </select>
          </Field>
          <button className="btn btn-danger btn-block mt-16" onClick={() => deletePlotEdge(edge.id)}>
            <Trash2 size={13} />
            Eliminar conexión
          </button>
        </div>
      </aside>
    )
  }

  if (!plot || !open) {
    return null
  }

  const characterOptions = project.characters.map((character) => ({ id: character.id, label: character.name, sub: character.role, color: character.color }))
  const scenes = getManuscriptScenes(project)
  const sceneOptions = scenes.map((scene) => ({ id: scene.id, label: scene.title, sub: project.nodes[scene.parentId]?.title }))
  const chapterOptions = getManuscriptChapters(project).map((chapter) => ({
    id: chapter.id,
    label: chapter.title,
    sub: `${getManuscriptScenes(project).filter((scene) => scene.parentId === chapter.id).length} escenas`
  }))
  const locationOptions = project.locations.map((location) => ({ id: location.id, label: location.name, sub: location.type, color: location.color }))
  const itemOptions = project.items.map((item) => ({ id: item.id, label: item.name, sub: item.type, color: item.color }))
  const linkedScenes = scenesForPlot(project, plot.id)
  const chapters = getManuscriptChapters(project).filter((chapter) =>
    (plot.chapterIds || []).includes(chapter.id) || linkedScenes.some((scene) => scene.parentId === chapter.id)
  )
  const chapterContext = `TRAMA: ${plot.title}
RESUMEN: ${plot.summary}
PREMISA: ${plot.premise}
CONFLICTO: ${plot.conflict}
APUESTAS: ${plot.stakes}
TEMA: ${plot.theme}
PERSONAJES: ${plot.characterIds.map((id) => project.characters.find((character) => character.id === id)?.name).filter(Boolean).join(', ')}
LUGARES: ${(plot.locationIds || []).map((id) => project.locations.find((location) => location.id === id)?.name).filter(Boolean).join(', ')}
OBJETOS: ${(plot.itemIds || []).map((id) => project.items.find((item) => item.id === id)?.name).filter(Boolean).join(', ')}
CAPÍTULOS: ${chapters.map((chapter) => chapter.title).join(', ')}
RESOLUCIÓN ACTUAL: ${plot.resolution}`

  return (
    <aside className="plots-panel">
      <div className="plots-panel-head">
        <div className="grow">
          <div className="card-eyebrow">Trama</div>
          <input className="plot-title-input" value={plot.title} onChange={(event) => updatePlot(plot.id, { title: event.target.value })} />
        </div>
        <button className="icon-btn sm danger" onClick={onDelete} title="Eliminar trama"><Trash2 size={14} /></button>
      </div>
      <div className="plots-panel-scroll">
        <div className="field-row">
          <Field label="Tipo">
            <select className="select sm" value={plot.type} onChange={(event) => updatePlot(plot.id, { type: event.target.value as Plot['type'] })}>
              <option value="principal">Principal</option>
              <option value="secundaria">Secundaria</option>
              <option value="romance">Romance</option>
              <option value="misterio">Misterio</option>
              <option value="conflicto">Conflicto</option>
              <option value="tema">Tema</option>
            </select>
          </Field>
          <Field label="Estado">
            <select className="select sm" value={plot.status} onChange={(event) => updatePlot(plot.id, { status: event.target.value as Plot['status'] })}>
              <option value="latente">Latente</option>
              <option value="activa">Activa</option>
              <option value="resuelta">Resuelta</option>
              <option value="abandonada">Abandonada</option>
            </select>
          </Field>
        </div>
        <Field label="Resumen">
          <textarea className="textarea sm" value={plot.summary} onChange={(event) => updatePlot(plot.id, { summary: event.target.value })} rows={3} />
        </Field>
        <Field label="Premisa">
          <textarea className="textarea sm" value={plot.premise} onChange={(event) => updatePlot(plot.id, { premise: event.target.value })} rows={2} />
        </Field>
        <Field label="Conflicto central">
          <textarea className="textarea sm" value={plot.conflict} onChange={(event) => updatePlot(plot.id, { conflict: event.target.value })} rows={2} />
        </Field>
        <Field label="Apuestas">
          <textarea className="textarea sm" value={plot.stakes} onChange={(event) => updatePlot(plot.id, { stakes: event.target.value })} rows={2} />
        </Field>
        <Field label="Tema">
          <input className="input sm" value={plot.theme} onChange={(event) => updatePlot(plot.id, { theme: event.target.value })} />
        </Field>
        <CodexAiDraftField
          label="Resolución"
          skill="plot-resolution"
          value={plot.resolution}
          context={chapterContext}
          onChange={(resolution) => updatePlot(plot.id, { resolution })}
          rows={3}
          placeholder="Describe cómo podría cerrarse esta línea narrativa…"
        />
        <div className="inspector-subhead"><Clock3 size={12} />Temporalidad</div>
        <div className="field-row">
          <Field label="Inicio">
            <input className="input sm" value={plot.temporalStart} onChange={(event) => updatePlot(plot.id, { temporalStart: event.target.value })} placeholder="Día 1 / 2026-09-14" />
          </Field>
          <Field label="Fin">
            <input className="input sm" value={plot.temporalEnd} onChange={(event) => updatePlot(plot.id, { temporalEnd: event.target.value })} placeholder="Día 7 / 2026-09-21" />
          </Field>
        </div>
        <Field label="Personajes" className="mt-12">
          <MultiSelect options={characterOptions} value={plot.characterIds} onChange={(characterIds) => updatePlot(plot.id, { characterIds })} placeholder="Vincular personajes" compact />
        </Field>
        <Field label="Capítulos">
          <MultiSelect options={chapterOptions} value={plot.chapterIds || []} onChange={(chapterIds) => updatePlot(plot.id, { chapterIds })} placeholder="Vincular capítulos" compact />
        </Field>
        <Field label="Escenas">
          <MultiSelect options={sceneOptions} value={plot.sceneIds} onChange={(sceneIds) => updatePlot(plot.id, { sceneIds })} placeholder="Vincular escenas" compact />
        </Field>
        <Field label="Lugares importantes">
          <MultiSelect options={locationOptions} value={plot.locationIds || []} onChange={(locationIds) => updatePlot(plot.id, { locationIds })} placeholder="Vincular lugares" compact />
        </Field>
        <Field label="Objetos importantes">
          <MultiSelect options={itemOptions} value={plot.itemIds || []} onChange={(itemIds) => updatePlot(plot.id, { itemIds })} placeholder="Vincular objetos" compact />
        </Field>
        <Field label="Color">
          <ColorPicker value={plot.color} onChange={(color) => updatePlot(plot.id, { color })} />
        </Field>
        <Field label="Etiquetas">
          <TagInput value={plot.tags} onChange={(tags) => updatePlot(plot.id, { tags })} />
        </Field>
        <div className="inspector-subhead"><Waypoints size={12} />Capítulos y escenas · {chapters.length} capítulos · {linkedScenes.length} escenas</div>
        <div className="plot-linked-scenes">
          {chapters.map((chapter) => (
            <div className="plot-linked-scene" key={chapter.id}>
              <BookOpen size={12} />
              <span className="grow truncate">{chapter.title}</span>
              <span className="faint">{getManuscriptScenes(project).filter((scene) => scene.parentId === chapter.id && plot.sceneIds.includes(scene.id)).length} escenas vinculadas</span>
            </div>
          ))}
          {linkedScenes.map((scene) => (
            <div className="plot-linked-scene" key={scene.id}>
              <span className={`status-dot ${scene.status}`} />
              <span className="grow truncate">{scene.title}</span>
              <span className="faint">{formatNumber(scene.wordCount)}</span>
            </div>
          ))}
          {!linkedScenes.length && <p className="form-empty-text">Sin escenas vinculadas.</p>}
        </div>
      </div>
    </aside>
  )
}

export function PlotsView() {
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const addPlot = useAppStore((state) => state.addPlot)
  const deletePlot = useAppStore((state) => state.deletePlot)
  const selectedPlotId = useAppStore((state) => state.selectedPlotId)
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId)
  const selectPlot = useAppStore((state) => state.selectPlot)
  const inspectorOpen = useAppStore((state) => state.inspectorOpen)
  const inspectorTab = useAppStore((state) => state.inspectorTab)
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen)
  const setInspectorTab = useAppStore((state) => state.setInspectorTab)
  const [mode, setMode] = useState<'graph' | 'timeline'>('graph')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false)
  const [chapterAnalysisOpen, setChapterAnalysisOpen] = useState(false)
  const [plotDetailsOpen, setPlotDetailsOpen] = useState(false)
  const [edgeDetailsOpen, setEdgeDetailsOpen] = useState(false)
  const [plotDetailsColumnOpen, setPlotDetailsColumnOpen] = useState(true)
  const [analysisChapterId, setAnalysisChapterId] = useState('')
  const [analysisScope, setAnalysisScope] = useState<'chapter' | 'novel'>('chapter')

  if (!project) return null
  const chapters = getManuscriptChapters(project)
  const analysisProvider = settings.providers.find(
    (provider): provider is AiProvider =>
      provider.id === settings.ai.activeProviderId &&
      provider.protocol !== 'comfyui' &&
      provider.supportsText !== false
  )
  const selectedAnalysisChapterId = chapters.some((chapter) => chapter.id === analysisChapterId)
    ? analysisChapterId
    : chapters[0]?.id || ''

  return (
    <div className="plots-view">
      <header className="plots-toolbar">
        <div>
          <div className="card-eyebrow">Narrativa</div>
          <h1>Grafo de tramas</h1>
        </div>
        <div className="plots-toolbar-center">
          <div className="segmented">
            <button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}>
              <Network size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              Grafo
            </button>
            <button className={mode === 'timeline' ? 'active' : ''} onClick={() => setMode('timeline')}>
              <CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              Cronología
            </button>
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn-sm"
            onClick={() => {
              setAnalysisChapterId(selectedAnalysisChapterId)
              setAnalysisScope('chapter')
              setChapterPickerOpen(true)
            }}
            disabled={!analysisProvider || !chapters.length}
            title={!analysisProvider
              ? 'Configura un proveedor de texto activo en Ajustes → IA'
              : !chapters.length
                ? 'Añade un capítulo al manuscrito para analizar sus tramas'
                : 'Analizar las tramas de un capítulo o de toda la novela'}
          >
            <Sparkles size={13} />
            Analizar tramas
          </button>
          {mode === 'graph' && (
            <button className="icon-btn sm" onClick={() => flow?.fitView({ padding: 0.3 })} title="Ajustar vista">
              <Maximize2 size={14} />
            </button>
          )}
          {mode === 'graph' && (
            <button
              className={`icon-btn sm ${plotDetailsColumnOpen ? 'active' : ''}`}
              onClick={() => setPlotDetailsColumnOpen((open) => !open)}
              title={plotDetailsColumnOpen ? 'Ocultar detalles para ampliar el grafo' : 'Mostrar detalles de la trama'}
              aria-label={plotDetailsColumnOpen ? 'Ocultar detalles para ampliar el grafo' : 'Mostrar detalles de la trama'}
              aria-pressed={plotDetailsColumnOpen}
            >
              {plotDetailsColumnOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
            </button>
          )}
          <button
            className={`icon-btn sm ${inspectorOpen && inspectorTab === 'ai' ? 'active' : ''}`}
            onClick={() => {
              const assistantOpen = inspectorOpen && inspectorTab === 'ai'
              setInspectorTab('ai')
              setInspectorOpen(!assistantOpen)
            }}
            title={inspectorOpen && inspectorTab === 'ai' ? 'Ocultar asistente' : 'Mostrar asistente'}
            aria-label={inspectorOpen && inspectorTab === 'ai' ? 'Ocultar asistente' : 'Mostrar asistente'}
          >
            <Sparkles size={14} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setMode('graph'); addPlot() }}>
            <Plus size={13} />
            Nueva trama
          </button>
        </div>
      </header>
      <div className="plots-body">
        <div className="plots-canvas">
          {project.plots.length === 0 ? (
            <div className="empty-state plots-empty">
              <div className="empty-icon"><Network size={27} /></div>
              <h2>Teje las líneas de tu novela</h2>
              <p>Crea tramas, relaciónalas y descubre cómo se cruzan. Cada trama puede vincular personajes, escenas y una temporalidad propia.</p>
              <button className="btn btn-primary" onClick={() => addPlot()}>
                <Plus size={14} />
                Crear primera trama
              </button>
            </div>
          ) : mode === 'graph' ? (
            <PlotGraph
              onFit={setFlow}
              onSelectPlot={() => setPlotDetailsOpen(true)}
              onSelectEdge={() => setEdgeDetailsOpen(true)}
            />
          ) : (
            <PlotTimeline onSelectPlot={() => setPlotDetailsOpen(true)} />
          )}
        </div>
        {mode === 'graph' && plotDetailsColumnOpen && (
          <PlotInspectorPanel
            open
            onClose={() => {
              setPlotDetailsOpen(false)
              setEdgeDetailsOpen(false)
              selectPlot('')
            }}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
      </div>
      <Modal
        open={plotDetailsOpen || edgeDetailsOpen}
        onClose={() => {
          setPlotDetailsOpen(false)
          setEdgeDetailsOpen(false)
        }}
        title={selectedEdgeId
          ? 'Relación de tramas'
          : project.plots.find((plot) => plot.id === selectedPlotId)?.title || 'Detalles de trama'}
        subtitle={selectedEdgeId
          ? 'Edita o elimina esta conexión.'
          : 'Edita la línea narrativa y sus vínculos en el manuscrito.'}
        eyebrow={selectedEdgeId ? 'Grafo narrativo' : 'Ficha de trama'}
        size="xl"
        className={selectedEdgeId ? 'plot-edge-modal' : 'plot-detail-modal'}
      >
        <PlotInspectorPanel
          open={plotDetailsOpen || edgeDetailsOpen}
          onClose={() => {
            setPlotDetailsOpen(false)
            setEdgeDetailsOpen(false)
          }}
          onDelete={() => setConfirmDelete(true)}
        />
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (selectedPlotId) deletePlot(selectedPlotId)
          setPlotDetailsOpen(false)
          selectPlot('')
        }}
        title="Eliminar trama"
        message="Se eliminará la trama, sus conexiones y se desvinculará de todas las escenas. Los personajes no se eliminarán."
        confirmLabel="Eliminar trama"
        danger
      />
      <Modal
        open={chapterPickerOpen}
        onClose={() => setChapterPickerOpen(false)}
        title="Analizar tramas"
        subtitle="Analiza un capítulo concreto o recorre toda la novela para consolidar las tramas a lo largo del tiempo."
        eyebrow="Lectura narrativa"
        size="md"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setChapterPickerOpen(false)}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedAnalysisChapterId}
              onClick={() => {
                setAnalysisChapterId(selectedAnalysisChapterId)
                setChapterPickerOpen(false)
                setChapterAnalysisOpen(true)
              }}
            >
              <BookOpen size={13} />
              {analysisScope === 'novel' ? 'Analizar novela completa' : 'Analizar capítulo'}
            </button>
          </>
        }
      >
        {chapters.length ? (
          <>
            <div className="segmented plot-analysis-scope" role="group" aria-label="Alcance del análisis">
              <button
                type="button"
                className={analysisScope === 'chapter' ? 'active' : ''}
                aria-pressed={analysisScope === 'chapter'}
                onClick={() => setAnalysisScope('chapter')}
              >
                Un capítulo
              </button>
              <button
                type="button"
                className={analysisScope === 'novel' ? 'active' : ''}
                aria-pressed={analysisScope === 'novel'}
                onClick={() => setAnalysisScope('novel')}
              >
                Toda la novela
              </button>
            </div>
            {analysisScope === 'chapter' ? (
              <Field label="Capítulo del manuscrito">
                <select
                  className="select"
                  value={selectedAnalysisChapterId}
                  onChange={(event) => setAnalysisChapterId(event.target.value)}
                  autoFocus
                >
                  {chapters.map((chapter, index) => (
                    <option key={chapter.id} value={chapter.id}>
                      {index + 1}. {chapter.title || 'Capítulo sin título'}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="form-card">
                <strong>{chapters.length} capítulos en el manuscrito</strong>
                <p style={{ marginBottom: 0 }}>
                  Se analizarán uno por uno para reducir errores por límite de contexto. Las propuestas repetidas se consolidarán y podrás revisarlas antes de aplicarlas.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="form-card">
            <strong>Aún no hay capítulos.</strong>
            <p style={{ marginBottom: 0 }}>Añade capítulos al manuscrito antes de analizar las tramas.</p>
          </div>
        )}
        <p className="field-hint">
          La IA propondrá cambios de trama, asociaciones y conflictos respaldados por el texto. Revisa y acepta cada propuesta antes de modificar el grafo.
        </p>
      </Modal>
      {chapterAnalysisOpen && analysisProvider && selectedAnalysisChapterId && (
        <ChapterAnalysisReview
          project={project}
          chapterId={selectedAnalysisChapterId}
          provider={analysisProvider}
          mode="plots"
          wholeNovel={analysisScope === 'novel'}
          onClose={() => setChapterAnalysisOpen(false)}
        />
      )}
    </div>
  )
}
