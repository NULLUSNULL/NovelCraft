import { useMemo, useState } from 'react'

export interface WritingGuideItem {
  id: string
  title: string
  description: string
  checked: boolean
}

const CHECKED_KEY = 'novelcraft-writing-guide-checked'

function readCheckedMap(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(CHECKED_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (typeof parsed === 'object' && parsed !== null) {
        const result: Record<string, boolean> = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'boolean') result[key] = value
        }
        return result
      }
    }
  } catch {
    // Opcional: sin permiso de almacenamiento
  }
  return {}
}

function writeCheckedMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(map))
  } catch {
    // Opcional: sin permiso de almacenamiento
  }
}

export function parseEsquemaPoints(writingPlan: string): WritingGuideItem[] {
  const seen = new Set<string>()
  const items: WritingGuideItem[] = []
  for (const beat of writingPlan.split(/\r?\n/)) {
    const text = beat.trim().replace(/^[-*•·]\s+/, '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    items.push({ id: text, title: text.slice(0, 90), description: text, checked: false })
  }
  return items
}

export function useWritingGuidePoints(writingPlan: string): {
  items: WritingGuideItem[]
  toggle: (item: WritingGuideItem) => void
} {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(readCheckedMap)
  const items = useMemo(
    () => parseEsquemaPoints(writingPlan).map((item) => ({ ...item, checked: checkedMap[item.id] ?? false })),
    [writingPlan, checkedMap]
  )
  const toggle = (item: WritingGuideItem) => {
    setCheckedMap((previous) => {
      const next = { ...previous, [item.id]: !item.checked }
      writeCheckedMap(next)
      return next
    })
  }
  return { items, toggle }
}
