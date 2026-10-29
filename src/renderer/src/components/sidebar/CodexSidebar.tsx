import { useMemo, useState } from 'react'
import { MapPin, Package, Search, UserRound, UsersRound } from 'lucide-react'
import type { EntityKind } from '@shared/types'
import { initials } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'

const CATEGORY_LABELS: Record<EntityKind, string> = {
  character: 'Personajes',
  location: 'Ubicaciones',
  item: 'Ítems'
}

export function CodexSidebar() {
  const project = useAppStore((state) => state.project)
  const category = useAppStore((state) => state.codexCategory)
  const selectedEntity = useAppStore((state) => state.selectedEntity)
  const setCodexCategory = useAppStore((state) => state.setCodexCategory)
  const selectEntity = useAppStore((state) => state.selectEntity)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const addLocation = useAppStore((state) => state.addLocation)
  const addItem = useAppStore((state) => state.addItem)
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    if (!project) return []
    if (category === 'character') return project.characters
    if (category === 'location') return project.locations
    return project.items
  }, [category, project])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return list
    return list.filter((entity) => {
      const generic = entity as { name: string; role?: string; type?: string; description?: string; tags: string[] }
      return `${generic.name} ${generic.role || ''} ${generic.type || ''} ${generic.description || ''} ${generic.tags.join(' ')}`
        .toLowerCase()
        .includes(normalized)
    })
  }, [category, list, query])

  if (!project) return null

  const add = (): void => {
    if (category === 'character') addCharacter()
    else if (category === 'location') addLocation()
    else addItem()
  }

  return (
    <>
      <div className="sidebar-toolbar">
        <div className="search-box">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${CATEGORY_LABELS[category].toLowerCase()}...`}
          />
        </div>
        <button className="icon-btn sm" onClick={add} title={`Nuevo elemento en ${CATEGORY_LABELS[category]}`}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
        </button>
      </div>
      <div className="sidebar-scroll">
        <div className="segmented codex-tabs">
          <button className={category === 'character' ? 'active' : ''} onClick={() => setCodexCategory('character')}>
            Personajes
          </button>
          <button className={category === 'location' ? 'active' : ''} onClick={() => setCodexCategory('location')}>
            Lugares
          </button>
          <button className={category === 'item' ? 'active' : ''} onClick={() => setCodexCategory('item')}>
            Ítems
          </button>
        </div>
        <div className="sidebar-section-label">
          {CATEGORY_LABELS[category]} · {filtered.length}
        </div>
        <div className="entity-list">
          {filtered.map((entity) => {
            const selected = selectedEntity?.kind === category && selectedEntity.id === entity.id
            if (category === 'character') {
              const character = entity as (typeof project.characters)[number]
              return (
                <button
                  className={`entity-row ${selected ? 'selected' : ''}`}
                  key={character.id}
                  onClick={() => selectEntity('character', character.id)}
                >
                  <span
                    className="entity-avatar round"
                    style={{
                      background: character.avatar ? undefined : character.color,
                      color: 'var(--accent-contrast)',
                      backgroundImage: character.avatar ? `url(${character.avatar})` : undefined
                    }}
                  >
                    {!character.avatar && initials(character.name)}
                  </span>
                  <span className="entity-main">
                    <span className="entity-name">{character.name}</span>
                    <span className="entity-sub">{character.role || 'Sin rol definido'}</span>
                  </span>
                  <span className="entity-dot" style={{ background: character.color }} />
                </button>
              )
            }
            const generic = entity as (typeof project.locations)[number] | (typeof project.items)[number]
            const Icon = category === 'location' ? MapPin : Package
            return (
              <button
                className={`entity-row ${selected ? 'selected' : ''}`}
                key={generic.id}
                onClick={() => selectEntity(category, generic.id)}
              >
                <span className="entity-avatar" style={{ background: generic.color, color: 'var(--accent-contrast)' }}>
                  <Icon size={14} />
                </span>
                <span className="entity-main">
                  <span className="entity-name">{generic.name}</span>
                  <span className="entity-sub">{generic.type || 'Sin categoría'}</span>
                </span>
                <span className="entity-dot" style={{ background: generic.color }} />
              </button>
            )
          })}
          {!filtered.length && (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">
                {category === 'character' ? <UsersRound size={19} /> : category === 'location' ? <MapPin size={19} /> : <Package size={19} />}
              </div>
              <h3>{query ? 'Sin resultados' : `Sin ${CATEGORY_LABELS[category].toLowerCase()}`}</h3>
              <p>
                {query
                  ? 'Prueba con otro término.'
                  : 'Crea fichas para mantener la coherencia de tu mundo.'}
              </p>
              {!query && (
                <button className="btn sm mt-12" onClick={add}>
                  <UserRound size={12} />
                  Crear ficha
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="sidebar-footer codex-footer">
        <div className="codex-stat">
          <span>{project.characters.length}</span>
          <small>Personajes</small>
        </div>
        <div className="codex-stat">
          <span>{project.locations.length}</span>
          <small>Lugares</small>
        </div>
        <div className="codex-stat">
          <span>{project.items.length}</span>
          <small>Ítems</small>
        </div>
      </div>
    </>
  )
}
