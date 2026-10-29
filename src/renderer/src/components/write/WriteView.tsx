import { useAppStore } from '../../store/useAppStore'
import { Dashboard } from './Dashboard'
import { ChapterOverview } from './ChapterOverview'
import { EditorView } from './EditorView'

export function WriteView() {
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const node = project && selectedDocumentId ? project.nodes[selectedDocumentId] : undefined

  if (!node) return <Dashboard />
  if (node.type === 'chapter') return <ChapterOverview chapter={node} />
  return <EditorView node={node} />
}
