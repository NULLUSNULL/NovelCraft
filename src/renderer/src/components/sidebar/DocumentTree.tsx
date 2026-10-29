import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Copy,
  FileText,
  GripVertical,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Trash2,
  LayoutDashboard,
  FilePlus2
} from 'lucide-react'
import type { DocumentNode, ID } from '@shared/types'
import { MANUSCRIPT_ID, RESEARCH_ID } from '@shared/types'
import {
  formatNumber,
  getChapterScenes,
  getManuscriptChapters,
  getNoteChildren,
  getProjectWordCount,
  getStatusLabel
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/Modal'

type DropPosition = 'before' | 'after' | 'inside'
interface DropTarget {
  id: ID
  position: DropPosition
}

interface MenuState {
  x: number
  y: number
  node: DocumentNode
}

export function DocumentTree() {
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const collapsedChapters = useAppStore((state) => state.collapsedChapters)
  const toggleChapter = useAppStore((state) => state.toggleChapter)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const openDashboard = useAppStore((state) => state.openDashboard)
  const addChapter = useAppStore((state) => state.addChapter)
  const addScene = useAppStore((state) => state.addScene)
  const addNote = useAppStore((state) => state.addNote)
  const updateNode = useAppStore((state) => state.updateNode)
  const deleteNode = useAppStore((state) => state.deleteNode)
  const duplicateNode = useAppStore((state) => state.duplicateNode)
  const moveNode = useAppStore((state) => state.moveNode)
  const trashRetentionDays = useAppStore((state) => state.settings.backups.trashRetentionDays)
  const [query, setQuery] = useState('')
  const [draggedId, setDraggedId] = useState<ID>('')
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [editingId, setEditingId] = useState<ID>('')
  const [editValue, setEditValue] = useState('')
  const [deleting, setDeleting] = useState<DocumentNode | null>(null)
  const dropTimeout = useRef<number | null>(null)
  const cancelEditRef = useRef(false)

  const chapters = useMemo(() => (project ? getManuscriptChapters(project) : []), [project])
  const notes = useMemo(() => (project ? getNoteChildren(project) : []), [project])
  const normalizedQuery = query.trim().toLowerCase()

  const filteredChapters = useMemo(() => {
    if (!project || !normalizedQuery) return chapters
    return chapters.filter((chapter) => {
      if (`${chapter.title} ${chapter.summary}`.toLowerCase().includes(normalizedQuery)) return true
      return getChapterScenes(project, chapter.id).some((scene) =>
        `${scene.title} ${scene.summary} ${scene.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [chapters, normalizedQuery, project])

  const filteredNotes = useMemo(() => {
    if (!normalizedQuery) return notes
    return notes.filter((note) =>
      `${note.title} ${note.summary} ${note.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
    )
  }, [notes, normalizedQuery])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key !== 'F2') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const node = project?.nodes[selectedDocumentId]
      if (!node) return
      event.preventDefault()
      cancelEditRef.current = false
      setEditingId(node.id)
      setEditValue(node.title)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [project, selectedDocumentId])

  if (!project) return null

  const totalWords = getProjectWordCount(project)
  const progress = project.wordGoal ? Math.min(100, Math.round((totalWords / project.wordGoal) * 100)) : 0
  const chapterCount = chapters.length
  const notesCount = notes.length

  const beginEdit = (node: DocumentNode): void => {
    cancelEditRef.current = false
    setEditingId(node.id)
    setEditValue(node.title)
  }

  const commitEdit = (): void => {
    if (!editingId) return
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      setEditingId('')
      return
    }
    const title = editValue.trim()
    if (title) updateNode(editingId, { title })
    setEditingId('')
  }

  const cancelEdit = (): void => {
    cancelEditRef.current = true
    setEditingId('')
  }

  const openMenu = (event: React.MouseEvent, node: DocumentNode): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, node })
  }

  const menuItems = (node: DocumentNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        id: 'open',
        label: 'Abrir',
        icon: <FileText size={14} />,
        action: () => selectDocument(node.id)
      },
      {
        id: 'rename',
        label: 'Renombrar',
        icon: <Pencil size={14} />,
        shortcut: 'F2',
        action: () => beginEdit(node)
      }
    ]
    if (node.type === 'chapter') {
      items.push({
        id: 'add-scene',
        label: 'Nueva escena',
        icon: <FilePlus2 size={14} />,
        action: () => addScene(node.id)
      })
    }
    items.push(
      {
        id: 'duplicate',
        label: 'Duplicar',
        icon: <Copy size={14} />,
        action: () => duplicateNode(node.id)
      },
      { id: 'sep', divider: true },
      {
        id: 'delete',
        label: node.type === 'chapter' ? 'Eliminar capítulo' : 'Eliminar documento',
        icon: <Trash2 size={14} />,
        danger: true,
        action: () => setDeleting(node)
      }
    )
    return items
  }

  const canDropOn = (source: DocumentNode, target: DocumentNode): boolean => {
    if (source.id === target.id) return false
    if (source.type === 'chapter') return target.type === 'chapter'
    if (source.type === 'scene') return target.type === 'scene' || target.type === 'chapter'
    if (source.type === 'note') return target.type === 'note'
    return false
  }

  const handleDragStart = (event: React.DragEvent, node: DocumentNode): void => {
    setDraggedId(node.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.id)
  }

  const handleDragOver = (event: React.DragEvent, target: DocumentNode): void => {
    const source = project.nodes[draggedId]
    if (!source || !canDropOn(source, target)) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    let position: DropPosition = ratio < 0.5 ? 'before' : 'after'
    if (source.type === 'scene' && target.type === 'chapter') {
      position = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'inside'
    }
    setDropTarget({ id: target.id, position })
    if (dropTimeout.current) window.clearTimeout(dropTimeout.current)
    if (position === 'inside' && collapsedChapters[target.id]) {
      dropTimeout.current = window.setTimeout(() => toggleChapter(target.id), 450)
    }
  }

  const handleDrop = (event: React.DragEvent, target: DocumentNode): void => {
    event.preventDefault()
    event.stopPropagation()
    const source = project.nodes[draggedId]
    if (!source || !dropTarget) {
      setDraggedId('')
      setDropTarget(null)
      return
    }
    if (dropTarget.position === 'inside') {
      const siblings = getChapterScenes(project, target.id).filter((scene) => scene.id !== source.id)
      moveNode(source.id, target.id, siblings.length)
    } else {
      const parentId =
        target.type === 'chapter'
          ? MANUSCRIPT_ID
          : target.type === 'note'
            ? RESEARCH_ID
            : target.parentId
      const siblings = Object.values(project.nodes)
        .filter((node) => node.parentId === parentId && node.id !== source.id)
        .sort((a, b) => a.order - b.order)
      const targetIndex = siblings.findIndex((node) => node.id === target.id)
      const index = targetIndex < 0 ? siblings.length : dropTarget.position === 'before' ? targetIndex : targetIndex + 1
      moveNode(source.id, parentId, index)
    }
    setDraggedId('')
    setDropTarget(null)
  }

  const handleRootDrop = (event: React.DragEvent, rootId: ID): void => {
    event.preventDefault()
    const source = project.nodes[draggedId]
    if (!source) return
    if (rootId === MANUSCRIPT_ID && source.type === 'chapter') {
      const siblings = chapters.filter((chapter) => chapter.id !== source.id)
      moveNode(source.id, MANUSCRIPT_ID, siblings.length)
    }
    if (rootId === RESEARCH_ID && source.type === 'note') {
      const siblings = notes.filter((note) => note.id !== source.id)
      moveNode(source.id, RESEARCH_ID, siblings.length)
    }
    setDraggedId('')
    setDropTarget(null)
  }

  const renderChapter = (chapter: DocumentNode, depth: number): React.ReactNode => {
    const scenes = getChapterScenes(project, chapter.id)
    const isCollapsed = collapsedChapters[chapter.id]
    const chapterWordCount = scenes.reduce((total, scene) => total + scene.wordCount, 0)
    return (
      <div key={chapter.id}>
        <div
          className={`tree-row chapter ${selectedDocumentId === chapter.id ? 'selected' : ''} ${
            draggedId === chapter.id ? 'dragging' : ''
          } ${dropTarget?.id === chapter.id ? `drop-${dropTarget.position}` : ''}`}
          style={{ '--depth': depth } as React.CSSProperties}
          draggable={editingId !== chapter.id}
          onDragStart={(event) => handleDragStart(event, chapter)}
          onDragOver={(event) => handleDragOver(event, chapter)}
          onDrop={(event) => handleDrop(event, chapter)}
          onDragEnd={() => {
            setDraggedId('')
            setDropTarget(null)
          }}
          onClick={() => selectDocument(chapter.id)}
          onDoubleClick={() => beginEdit(chapter)}
          onContextMenu={(event) => openMenu(event, chapter)}
          data-testid={`chapter-row-${chapter.id}`}
        >
          <button
            className={`tree-chevron ${isCollapsed ? '' : 'open'}`}
            onClick={(event) => {
              event.stopPropagation()
              toggleChapter(chapter.id)
            }}
            aria-label={isCollapsed ? 'Expandir capítulo' : 'Contraer capítulo'}
          >
            <ChevronRight size={12} />
          </button>
          <span className="tree-icon">
            <BookOpen size={13} />
          </span>
          {editingId === chapter.id ? (
            <input
              className="tree-inline-input"
              value={editValue}
              autoFocus
              onChange={(event) => setEditValue(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={commitEdit}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitEdit()
                if (event.key === 'Escape') cancelEdit()
              }}
            />
          ) : (
            <span className="tree-title">{chapter.title}</span>
          )}
          {!normalizedQuery && <span className="tree-meta">{formatNumber(chapterWordCount)}</span>}
          <button
            className="tree-add"
            title="Añadir escena"
            onClick={(event) => {
              event.stopPropagation()
              addScene(chapter.id)
            }}
          >
            <Plus size={12} />
          </button>
          <span className="tree-drag" title="Arrastrar">
            <GripVertical size={12} />
          </span>
        </div>
        {!isCollapsed &&
          scenes
            .filter(
              (scene) =>
                !normalizedQuery ||
                `${scene.title} ${scene.summary} ${scene.tags.join(' ')}`.toLowerCase().includes(normalizedQuery) ||
                `${chapter.title} ${chapter.summary}`.toLowerCase().includes(normalizedQuery)
            )
            .map((scene) => (
              <div
                className={`tree-row ${selectedDocumentId === scene.id ? 'selected' : ''} ${
                  draggedId === scene.id ? 'dragging' : ''
                } ${dropTarget?.id === scene.id ? `drop-${dropTarget.position}` : ''}`}
                style={{ '--depth': depth + 1 } as React.CSSProperties}
                key={scene.id}
                draggable={editingId !== scene.id}
                onDragStart={(event) => handleDragStart(event, scene)}
                onDragOver={(event) => handleDragOver(event, scene)}
                onDrop={(event) => handleDrop(event, scene)}
                onDragEnd={() => {
                  setDraggedId('')
                  setDropTarget(null)
                }}
                onClick={() => selectDocument(scene.id)}
                onDoubleClick={() => beginEdit(scene)}
                onContextMenu={(event) => openMenu(event, scene)}
                data-testid={`scene-row-${scene.id}`}
              >
                <span className="tree-chevron blank" />
                <span className={`status-dot ${scene.status}`} />
                {editingId === scene.id ? (
                  <input
                    className="tree-inline-input"
                    value={editValue}
                    autoFocus
                    onChange={(event) => setEditValue(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={commitEdit}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitEdit()
                      if (event.key === 'Escape') cancelEdit()
                    }}
                  />
                ) : (
                  <span className="tree-title">{scene.title}</span>
                )}
                {!normalizedQuery && <span className="tree-meta">{formatNumber(scene.wordCount || 0)}</span>}
                <span className="tree-drag" title={getStatusLabel(scene.status)}>
                  <GripVertical size={12} />
                </span>
              </div>
            ))}
        {!isCollapsed && !scenes.length && (
          <div className="tree-empty">
            Capítulo vacío.{' '}
            <button className="text-link" onClick={() => addScene(chapter.id)}>
              Añadir escena
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="sidebar-toolbar">
        <div className="search-box">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en la estructura..."
            aria-label="Buscar documentos"
          />
        </div>
      </div>
      <div className="sidebar-scroll">
        <button
          className={`dashboard-link ${!selectedDocumentId ? 'active' : ''}`}
          onClick={openDashboard}
        >
          <LayoutDashboard size={14} />
          <span>Vista general</span>
          <span className="dashboard-link-meta">{progress}%</span>
        </button>
        <div className="tree-section">
          <div className="tree-section-head">
            <span className="tree-section-title">Manuscrito</span>
            <span className="tree-section-count">{chapterCount}</span>
            <button className="tree-section-action" title="Nuevo capítulo" onClick={() => addChapter()}>
              <Plus size={13} />
            </button>
          </div>
          <div
            className={`tree-list ${draggedId && project.nodes[draggedId]?.type === 'chapter' ? 'drag-active' : ''}`}
            onDragOver={(event) => {
              const source = project.nodes[draggedId]
              if (source?.type === 'chapter') {
                event.preventDefault()
                setDropTarget({ id: MANUSCRIPT_ID, position: 'inside' })
              }
            }}
            onDrop={(event) => handleRootDrop(event, MANUSCRIPT_ID)}
          >
            {filteredChapters.map((chapter) => renderChapter(chapter, 0))}
            {!filteredChapters.length && (
              <div className="tree-empty">
                {normalizedQuery ? 'Sin capítulos que coincidan.' : 'Empieza creando un capítulo.'}
              </div>
            )}
            {draggedId && project.nodes[draggedId]?.type === 'chapter' && (
              <div className={`tree-drop-root ${dropTarget?.id === MANUSCRIPT_ID ? 'drag-active' : ''}`} />
            )}
          </div>
        </div>

        <div className="tree-section">
          <div className="tree-section-head">
            <span className="tree-section-title">Investigación</span>
            <span className="tree-section-count">{notesCount}</span>
            <button className="tree-section-action" title="Nueva nota" onClick={() => addNote()}>
              <Plus size={13} />
            </button>
          </div>
          <div
            className={`tree-list ${draggedId && project.nodes[draggedId]?.type === 'note' ? 'drag-active' : ''}`}
            onDragOver={(event) => {
              const source = project.nodes[draggedId]
              if (source?.type === 'note') {
                event.preventDefault()
                setDropTarget({ id: RESEARCH_ID, position: 'inside' })
              }
            }}
            onDrop={(event) => handleRootDrop(event, RESEARCH_ID)}
          >
            {filteredNotes.map((note) => (
              <div
                className={`tree-row ${selectedDocumentId === note.id ? 'selected' : ''} ${
                  draggedId === note.id ? 'dragging' : ''
                } ${dropTarget?.id === note.id ? `drop-${dropTarget.position}` : ''}`}
                key={note.id}
                draggable={editingId !== note.id}
                onDragStart={(event) => handleDragStart(event, note)}
                onDragOver={(event) => handleDragOver(event, note)}
                onDrop={(event) => handleDrop(event, note)}
                onDragEnd={() => {
                  setDraggedId('')
                  setDropTarget(null)
                }}
                onClick={() => selectDocument(note.id)}
                onDoubleClick={() => beginEdit(note)}
                onContextMenu={(event) => openMenu(event, note)}
                data-testid={`note-row-${note.id}`}
              >
                <span className="tree-chevron blank" />
                <span className="tree-icon">
                  <NotebookPen size={13} />
                </span>
                {editingId === note.id ? (
                  <input
                    className="tree-inline-input"
                    value={editValue}
                    autoFocus
                    onChange={(event) => setEditValue(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={commitEdit}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitEdit()
                      if (event.key === 'Escape') cancelEdit()
                    }}
                  />
                ) : (
                  <span className="tree-title">{note.title}</span>
                )}
                {note.pinned && <span className="pinned-mark">fijada</span>}
                {!normalizedQuery && <span className="tree-meta">{formatNumber(note.wordCount || 0)}</span>}
                <span className="tree-drag" title="Arrastrar">
                  <GripVertical size={12} />
                </span>
              </div>
            ))}
            {!filteredNotes.length && (
              <div className="tree-empty">
                {normalizedQuery ? 'Sin notas que coincidan.' : 'Notas, referencias y documentación.'}
              </div>
            )}
            {draggedId && project.nodes[draggedId]?.type === 'note' && (
              <div className={`tree-drop-root ${dropTarget?.id === RESEARCH_ID ? 'drag-active' : ''}`} />
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="goal-line">
          <span>
            {formatNumber(totalWords)} / {formatNumber(project.wordGoal)}
          </span>
          <span className="goal-value">{progress}%</span>
        </div>
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="sidebar-footer-meta">
          <span>{chapterCount} capítulos</span>
          <span>{notesCount} notas</span>
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteNode(deleting.id)
        }}
        title="Mover a la papelera"
        message={
          deleting?.type === 'chapter'
            ? `Se moverá «${deleting?.title}» y todas sus escenas a la papelera. ${
                trashRetentionDays > 0
                  ? `Podrás restaurarlo durante ${trashRetentionDays} ${trashRetentionDays === 1 ? 'día' : 'días'}.`
                  : 'Podrás restaurarlo hasta que vacíes la papelera.'
              }`
            : `Se moverá «${deleting?.title}» a la papelera. ${
                trashRetentionDays > 0
                  ? `Podrás restaurarlo durante ${trashRetentionDays} ${trashRetentionDays === 1 ? 'día' : 'días'}.`
                  : 'Podrás restaurarlo hasta que vacíes la papelera.'
              }`
        }
        confirmLabel="Mover a la papelera"
        danger
      />
    </>
  )
}
