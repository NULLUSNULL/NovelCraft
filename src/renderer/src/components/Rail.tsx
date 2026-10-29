import { BookOpen, Feather, Network, Settings, UsersRound } from 'lucide-react'
import type { AppView } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

const NAV_ITEMS: Array<{ view: AppView; label: string; icon: typeof Feather }> = [
  { view: 'write', label: 'Manuscrito', icon: Feather },
  { view: 'codex', label: 'Codex', icon: UsersRound },
  { view: 'plots', label: 'Tramas', icon: Network },
  { view: 'publish', label: 'Publicar', icon: BookOpen }
]

export function Rail() {
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)

  return (
    <nav className="rail" aria-label="Navegación principal">
      <div className="rail-nav">
        {NAV_ITEMS.map(({ view: itemView, label, icon: Icon }) => (
          <button
            key={itemView}
            className={`rail-btn ${view === itemView ? 'active' : ''}`}
            onClick={() => setView(itemView)}
            title={label}
            aria-label={label}
            aria-current={view === itemView ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.9} />
          </button>
        ))}
      </div>
      <div className="rail-spacer" />
      <button className="rail-btn" onClick={() => setSettingsOpen(true)} title="Ajustes" aria-label="Ajustes">
        <Settings size={18} strokeWidth={1.9} />
      </button>
    </nav>
  )
}
