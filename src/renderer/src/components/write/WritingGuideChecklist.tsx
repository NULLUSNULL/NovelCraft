import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { DocumentNode } from '@shared/types'
import { useWritingGuidePoints, type WritingGuideItem } from './writingGuideState'

function EditableText({
  value,
  onCommit,
  className
}: {
  value: string
  onCommit: (next: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next !== value && next) onCommit(next)
    else setDraft(value)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className={`writing-guide-point-input ${className || ''}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') cancel()
        }}
        autoFocus
      />
    )
  }
  return (
    <span
      className={`writing-guide-point-editable ${className || ''}`}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
    >
      {value}
    </span>
  )
}

function WritingGuidePoint({
  item,
  onCommit,
  onChecked
}: {
  item: WritingGuideItem
  onCommit: (patch: Partial<WritingGuideItem>) => void
  onChecked: () => void
}) {
  return (
    <div className={`writing-guide-item ${item.checked ? 'checked' : ''}`}>
      <input
        type="checkbox"
        className="writing-guide-checkbox"
        checked={item.checked}
        onChange={onChecked}
        title={item.description}
      />
      <span className="writing-guide-item-body">
        <EditableText
          value={item.title}
          onCommit={(title) => onCommit({ title })}
          className="writing-guide-item-title"
        />
        <EditableText
          value={item.description}
          onCommit={(description) => onCommit({ description })}
          className="writing-guide-item-desc"
        />
      </span>
    </div>
  )
}

export function WritingGuideChecklist() {
  const node = useAppStore((state) => state.project?.nodes[state.selectedDocumentId])
  const updateNode = useAppStore((state) => state.updateNode)
  const writingPlan = node?.type === 'scene' ? node.writingPlan || '' : ''
  const { items, toggle } = useWritingGuidePoints(writingPlan)
  if (!node || node.type !== 'scene') return null
  const writeBack = (updated: WritingGuideItem[]) => {
    updateNode(node.id, { writingPlan: updated.map((item) => item.description || item.title).join('\n') })
  }
  return (
    <div className="writing-guide-items">
      {items.map((item) => (
        <WritingGuidePoint
          key={item.id}
          item={item}
          onChecked={() => toggle(item)}
          onCommit={(patch) => writeBack(items.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)))}
        />
      ))}
      {!items.length && (
        <p className="form-empty-text">
          El esquema de escritura está vacío. Escribe una idea por línea en el campo «Esquema de escritura» o pide al asistente un plan de la escena.
        </p>
      )}
    </div>
  )
}
