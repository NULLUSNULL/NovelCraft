import { useCallback, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ChevronRight,
  Clock3,
  Feather,
  FileText,
  Focus,
  History,
  MapPin,
  NotebookPen,
  PanelRight,
  PanelRightClose,
  Pin,
  UserRound
} from 'lucide-react'
import type { DocumentNode } from '@shared/types'
import {
  characterName,
  countWords,
  formatNumber,
  formatRelativeDate,
  getStatusLabel,
  stripHtml
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { AiActionDialog, RichEditor } from './RichEditor'

interface AiInvocation {
  action: string
  range: { from: number; to: number }
  text: string
}

export function EditorView({ node }: { node: DocumentNode }) {
  const project = useAppStore((state) => state.project)
  const updateNode = useAppStore((state) => state.updateNode)
  const updateNodeContent = useAppStore((state) => state.updateNodeContent)
  const saveStatus = useAppStore((state) => state.saveStatus)
  const savedAt = useAppStore((state) => state.savedAt)
  const setSnapshotsOpen = useAppStore((state) => state.setSnapshotsOpen)
  const setFocusMode = useAppStore((state) => state.setFocusMode)
  const focusMode = useAppStore((state) => state.focusMode)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const setInspectorTab = useAppStore((state) => state.setInspectorTab)
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen)
  const inspectorOpen = useAppStore((state) => state.inspectorOpen)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [ai, setAi] = useState<AiInvocation | null>(null)

  const chapter = node.type === 'scene' ? project?.nodes[node.parentId] : undefined
  const wordCount = node.wordCount || 0
  const readingTime = Math.max(1, Math.round(wordCount / 230))
  const goalProgress = node.wordGoal > 0 ? Math.min(100, Math.round((wordCount / node.wordGoal) * 100)) : null
  const location = project?.locations.find((item) => item.id === node.locationId)
  const pov = project?.characters.find((character) => character.id === node.pov)

  const handleEditorReady = useCallback((instance: Editor | null) => {
    setEditor(instance)
  }, [])

  const openAi = useCallback((action: string) => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    setAi({ action, range: { from, to }, text })
  }, [editor])

  if (!project) return null

  const isNote = node.type === 'note'
  const isScene = node.type === 'scene'

  return (
    <div className="editor-view" data-testid="editor-view">
      <header className="doc-header">
        <div className="doc-header-top">
          <div className="doc-breadcrumb">
            {isNote ? <NotebookPen size={12} /> : <FileText size={12} />}
            <span>{isNote ? 'Investigación' : 'Manuscrito'}</span>
            {chapter && (
              <>
                <ChevronRight size={11} />
                <button className="breadcrumb-link" onClick={() => selectDocument(chapter.id)}>
                  {chapter.title}
                </button>
              </>
            )}
            {isNote && (
              <>
                <ChevronRight size={11} />
                <span>Nota</span>
              </>
            )}
          </div>
          <div className="doc-header-actions">
            <button className="icon-btn sm" onClick={() => setFocusMode(!focusMode)} title="Modo concentración">
              <Focus size={14} />
            </button>
            <button className="icon-btn sm" onClick={() => setSnapshotsOpen(true)} title="Historial de versiones">
              <History size={14} />
            </button>
            <button
              className="icon-btn sm"
              onClick={() => setInspectorOpen(!inspectorOpen)}
              title={inspectorOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
              aria-label={inspectorOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
            >
              {inspectorOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
            </button>
          </div>
        </div>
        <div className="doc-title-row">
          <input
            className="doc-title-input"
            value={node.title}
            onChange={(event) => updateNode(node.id, { title: event.target.value })}
            placeholder={isNote ? 'Título de la nota' : 'Título de la escena'}
            aria-label="Título del documento"
          />
          {isNote && node.pinned && <Pin size={14} className="accent" />}
        </div>
        {isScene && (
          <div className="doc-meta-row">
            <label className={`doc-status-select status-${node.status}`}>
              <span className={`status-dot ${node.status}`} />
              <select
                value={node.status}
                onChange={(event) => updateNode(node.id, { status: event.target.value as DocumentNode['status'] })}
                aria-label="Estado de la escena"
              >
                {(['idea', 'outline', 'draft', 'revised', 'final'] as const).map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </label>
            {pov && (
              <button className="doc-meta-chip" onClick={() => { setInspectorOpen(true); setInspectorTab('scene') }}>
                <UserRound size={11} />
                {pov.name}
              </button>
            )}
            {location && (
              <button className="doc-meta-chip" onClick={() => { setInspectorOpen(true); setInspectorTab('scene') }}>
                <MapPin size={11} />
                {location.name}
              </button>
            )}
            {node.storyDate && (
              <span className="doc-meta-chip muted">
                <Clock3 size={11} />
                {formatRelativeDate(node.storyDate)}{node.storyTime ? ` · ${node.storyTime}` : ''}
              </span>
            )}
            {node.summary && <span className="doc-meta-summary">{node.summary}</span>}
          </div>
        )}
        {isNote && (
          <div className="doc-meta-row">
            <span className="chip" style={{ borderColor: node.noteColor, color: node.noteColor }}>
              {node.tags[0] || 'Nota de investigación'}
            </span>
            <span className="doc-meta-summary">{node.summary}</span>
          </div>
        )}
        <div className="doc-progress-line">
          <div className="doc-progress-track">
            <div style={{ width: `${goalProgress ?? Math.min(100, (wordCount / 1500) * 100)}%` }} />
          </div>
          <span>{goalProgress !== null ? `${goalProgress}% de ${formatNumber(node.wordGoal)} palabras` : 'Sin objetivo de escena'}</span>
        </div>
      </header>

      <div className="editor-scroll">
        <RichEditor
          key={node.id}
          node={node}
          content={node.content}
          onChange={(content) => updateNodeContent(node.id, content, countWords(content))}
          onAiRequest={openAi}
          onEditorReady={handleEditorReady}
        />
      </div>

      <footer className="editor-statusbar">
        <div className="statusbar-left">
          <span>{formatNumber(wordCount)} palabras</span>
          <span className="statusbar-sep" />
          <span>{readingTime} min de lectura</span>
          {node.storyDate && (
            <>
              <span className="statusbar-sep" />
              <span>{node.storyDate}</span>
            </>
          )}
          {isScene && node.pov && (
            <>
              <span className="statusbar-sep" />
              <span>POV: {characterName(project, node.pov)}</span>
            </>
          )}
        </div>
        <div className="statusbar-right">
          <button className="save-status" onClick={() => setSnapshotsOpen(true)}>
            {saveStatus === 'saving' && <><span className="spinner" style={{ width: 10, height: 10 }} /> Guardando...</>}
            {saveStatus === 'saved' && <><span className="save-dot" /> Guardado{savedAt ? ` · ${new Date(savedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}</>}
            {saveStatus === 'dirty' && <><span className="save-dot pending" /> Cambios sin guardar</>}
            {saveStatus === 'error' && <><span className="save-dot error" /> Error al guardar</>}
          </button>
        </div>
      </footer>

      {ai && (
        <AiActionDialog
          key={`${ai.action}-${ai.range.from}-${ai.range.to}`}
          node={node}
          action={ai.action}
          range={ai.range}
          text={ai.text}
          editor={editor}
          onClose={() => setAi(null)}
        />
      )}
    </div>
  )
}
