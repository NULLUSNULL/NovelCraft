import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { DocumentNode } from '@shared/types'
import { useWritingGuidePoints, type WritingGuideItem } from './writingGuideState'

type MatchedEntity = { kind: 'character' | 'location' | 'item'; id: string }

function matchEntity(project: ReturnType<typeof useAppStore.getState>['project'], title: string): MatchedEntity | null {
  const text = title.toLowerCase()
  for (const character of project?.characters || []) {
    if (character.name && text.includes(character.name.toLowerCase())) return { kind: 'character', id: character.id }
  }
  for (const location of project?.locations || []) {
    if (location.name && text.includes(location.name.toLowerCase())) return { kind: 'location', id: location.id }
  }
  for (const worldItem of project?.items || []) {
    if (worldItem.name && text.includes(worldItem.name.toLowerCase())) return { kind: 'item', id: worldItem.id }
  }
  return null
}

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
  match,
  onCommit,
  onChecked,
  selectEntity
}: {
  item: WritingGuideItem
  match: MatchedEntity | null
  onCommit: (patch: Partial<WritingGuideItem>) => void
  onChecked: () => void
  selectEntity: (match: MatchedEntity) => void
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
        {match ? (
          <a
            className="writing-guide-link"
            title={item.description || item.title}
            onClick={(event) => {
              event.stopPropagation()
              selectEntity(match)
            }}
          >
            {item.title}
          </a>
        ) : (
          <EditableText
            value={item.title}
            onCommit={(title) => onCommit({ title })}
            className="writing-guide-item-title"
          />
        )}
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
  const project = useAppStore((state) => state.project)
  const node = useAppStore((state) => state.project?.nodes[state.selectedDocumentId])
  const updateNode = useAppStore((state) => state.updateNode)
  const openEntity = useAppStore((state) => state.selectEntity)
  const writingPlan = node?.type === 'scene' ? node.writingPlan || '' : ''
  const { items, toggle } = useWritingGuidePoints(writingPlan)
  if (!node || node.type !== 'scene') return null
  const writeBack = (updated: WritingGuideItem[]) => {
    updateNode(node.id, { writingPlan: updated.map((item) => item.description || item.title).join('\n') })
  }
  return (
    <div className="writing-guide-items">
      {items.map((item) => {
        const match = matchEntity(project, item.title)
        return (
          <WritingGuidePoint
            key={item.id}
            item={item}
            match={match}
            onChecked={() => toggle(item)}
            onCommit={(patch) => writeBack(items.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)))}
            selectEntity={(m) => openEntity(m.kind, m.id)}
          />
        )
      })}
      {!items.length && (
        <p className="form-empty-text">
          El esquema de escritura está vacío. Escribe una idea por línea en el campo «Esquema de escritura» o pide al asistente un plan de la escena.
        </p>
      )}
    </div>
  )
}
