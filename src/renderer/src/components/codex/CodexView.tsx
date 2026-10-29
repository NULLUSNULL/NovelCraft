import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X
} from 'lucide-react'
import type { Character, CharacterRelationship, Location, WorldItem } from '@shared/types'
import {
  formatNumber,
  getStatusLabel,
  initials,
  makeId,
  scenesForCharacter,
  scenesForItem,
  scenesForLocation
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker, EmptyPanel, Field, ImageUpload, MultiSelect, TagInput } from '../ui/Form'
import { ConfirmDialog } from '../ui/Modal'

function SectionCard({
  title,
  icon,
  children,
  className = ''
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`form-card ${className}`}>
      <div className="form-card-head">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Appearances({
  scenes,
  onOpen
}: {
  scenes: Array<{ id: string; title: string; wordCount: number; status: string; chapterTitle: string }>
  onOpen: (id: string) => void
}) {
  if (!scenes.length) {
    return <p className="form-empty-text">Todavía no aparece en ninguna escena.</p>
  }
  return (
    <div className="appearance-list">
      {scenes.map((scene) => (
        <button key={scene.id} className="appearance-row" onClick={() => onOpen(scene.id)}>
          <span className={`status-dot ${scene.status}`} />
          <span className="appearance-main">
            <span className="appearance-title">{scene.title}</span>
            <span className="appearance-sub">{scene.chapterTitle}</span>
          </span>
          <span className="appearance-words">{formatNumber(scene.wordCount)}</span>
          <ArrowRight size={13} />
        </button>
      ))}
    </div>
  )
}

export function CodexView() {
  const project = useAppStore((state) => state.project)
  const selectedEntity = useAppStore((state) => state.selectedEntity)
  const category = useAppStore((state) => state.codexCategory)
  const updateCharacter = useAppStore((state) => state.updateCharacter)
  const deleteCharacter = useAppStore((state) => state.deleteCharacter)
  const updateLocation = useAppStore((state) => state.updateLocation)
  const deleteLocation = useAppStore((state) => state.deleteLocation)
  const updateItem = useAppStore((state) => state.updateItem)
  const deleteItem = useAppStore((state) => state.deleteItem)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const addLocation = useAppStore((state) => state.addLocation)
  const addItem = useAppStore((state) => state.addItem)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const character = useMemo(
    () =>
      selectedEntity?.kind === 'character'
        ? project?.characters.find((entity) => entity.id === selectedEntity.id)
        : undefined,
    [project, selectedEntity]
  )
  const location = useMemo(
    () =>
      selectedEntity?.kind === 'location'
        ? project?.locations.find((entity) => entity.id === selectedEntity.id)
        : undefined,
    [project, selectedEntity]
  )
  const item = useMemo(
    () =>
      selectedEntity?.kind === 'item'
        ? project?.items.find((entity) => entity.id === selectedEntity.id)
        : undefined,
    [project, selectedEntity]
  )

  if (!project) return null

  const openScene = (id: string): void => selectDocument(id)

  const getSceneDetails = (scenes: Array<{ id: string; title: string; wordCount: number; status: string; parentId: string }>) =>
    scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      wordCount: scene.wordCount,
      status: scene.status,
      chapterTitle: project.nodes[scene.parentId]?.title || 'Sin capítulo'
    }))

  const deleteCurrent = (): void => {
    if (character) deleteCharacter(character.id)
    else if (location) deleteLocation(location.id)
    else if (item) deleteItem(item.id)
  }

  if (!character && !location && !item) {
    const labels = { character: 'personajes', location: 'ubicaciones', item: 'ítems' }
    return (
      <div className="view">
        <EmptyPanel
          icon={category === 'character' ? <UsersRound size={27} /> : category === 'location' ? <MapPin size={27} /> : <Package size={27} />}
          title={`Sin ${labels[category]}`}
          description="Crea fichas ricas en metadatos para que cada elemento de tu historia tenga coherencia y profundidad."
          action={
            <button
              className="btn btn-primary"
              onClick={() => (category === 'character' ? addCharacter() : category === 'location' ? addLocation() : addItem())}
            >
              <Plus size={14} />
              Crear {category === 'character' ? 'personaje' : category === 'location' ? 'ubicación' : 'ítem'}
            </button>
          }
        />
      </div>
    )
  }

  if (character) {
    const appearances = getSceneDetails(scenesForCharacter(project, character.id))
    const relatedPlots = project.plots.filter((plot) => plot.characterIds.includes(character.id))
    const relationships = character.relationships
    const updateRelationships = (next: CharacterRelationship[]): void =>
      updateCharacter(character.id, { relationships: next })
    const availableCharacters = project.characters.filter((entity) => entity.id !== character.id)

    return (
      <div className="view">
        <div className="entity-page">
          <header className="entity-page-head">
            <div className="entity-page-identity">
              <ImageUpload
                value={character.avatar}
                onChange={(avatar) => updateCharacter(character.id, { avatar })}
                name={character.name}
                round
                size={84}
              />
              <div className="grow">
                <div className="entity-eyebrow">
                  <UserRound size={12} />
                  Personaje
                  <span className="entity-eyebrow-dot" />
                  {character.role || 'Sin rol definido'}
                </div>
                <input
                  className="entity-title-input"
                  value={character.name}
                  onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                  aria-label="Nombre del personaje"
                />
                <div className="entity-header-tags">
                  {character.tags.slice(0, 4).map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {!character.tags.length && <span className="faint" style={{ fontSize: 11 }}>Añade etiquetas para organizar el codex.</span>}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => addCharacter()}>
                <Plus size={13} />
                Nuevo
              </button>
              <button className="icon-btn danger" onClick={() => setConfirmDelete(true)} title="Eliminar personaje">
                <Trash2 size={15} />
              </button>
            </div>
          </header>

          <div className="entity-layout">
            <div className="entity-main-column">
              <SectionCard title="Identidad" icon={<UserRound size={14} />}>
                <div className="field-row">
                  <Field label="Nombre">
                    <input className="input" value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} />
                  </Field>
                  <Field label="Rol narrativo">
                    <input className="input" value={character.role} onChange={(event) => updateCharacter(character.id, { role: event.target.value })} placeholder="Protagonista, aliado..." />
                  </Field>
                </div>
                <div className="field-row">
                  <Field label="Edad">
                    <input className="input" value={character.age} onChange={(event) => updateCharacter(character.id, { age: event.target.value })} />
                  </Field>
                  <Field label="Género">
                    <input className="input" value={character.pronouns} onChange={(event) => updateCharacter(character.id, { pronouns: event.target.value })} placeholder="femenino, masculino, no binario..." />
                  </Field>
                </div>
                <Field label="Ocupación">
                  <input className="input" value={character.occupation} onChange={(event) => updateCharacter(character.id, { occupation: event.target.value })} />
                </Field>
                <Field label="Apariencia">
                  <textarea className="textarea" value={character.appearance} onChange={(event) => updateCharacter(character.id, { appearance: event.target.value })} placeholder="Rasgos físicos, forma de vestir, gestos recurrentes..." />
                </Field>
                <Field label="Etiquetas">
                  <TagInput value={character.tags} onChange={(tags) => updateCharacter(character.id, { tags })} />
                </Field>
                <Field label="Color de ficha">
                  <ColorPicker value={character.color} onChange={(color) => updateCharacter(character.id, { color })} />
                </Field>
              </SectionCard>

              <SectionCard title="Psicología y voz" icon={<Sparkles size={14} />}>
                <Field label="Personalidad">
                  <textarea className="textarea" value={character.personality} onChange={(event) => updateCharacter(character.id, { personality: event.target.value })} placeholder="Luces y sombras, contradicciones, manías..." />
                </Field>
                <Field label="Motivación profunda">
                  <textarea className="textarea" value={character.motivation} onChange={(event) => updateCharacter(character.id, { motivation: event.target.value })} />
                </Field>
                <div className="field-row">
                  <Field label="Objetivo externo">
                    <textarea className="textarea" value={character.goal} onChange={(event) => updateCharacter(character.id, { goal: event.target.value })} />
                  </Field>
                  <Field label="Conflicto interno">
                    <textarea className="textarea" value={character.conflict} onChange={(event) => updateCharacter(character.id, { conflict: event.target.value })} />
                  </Field>
                </div>
                <Field label="Voz y manera de hablar">
                  <textarea className="textarea" value={character.voice} onChange={(event) => updateCharacter(character.id, { voice: event.target.value })} placeholder="Ritmo, vocabulario, tics, qué evita decir..." />
                </Field>
                <Field label="Secreto">
                  <textarea className="textarea" value={character.secret} onChange={(event) => updateCharacter(character.id, { secret: event.target.value })} />
                </Field>
              </SectionCard>

              <SectionCard title="Historia y arco" icon={<BookOpen size={14} />}>
                <Field label="Pasado">
                  <textarea className="textarea" value={character.backstory} onChange={(event) => updateCharacter(character.id, { backstory: event.target.value })} />
                </Field>
                <Field label="Arco de transformación">
                  <textarea className="textarea" value={character.arc} onChange={(event) => updateCharacter(character.id, { arc: event.target.value })} />
                </Field>
              </SectionCard>
            </div>

            <div className="entity-side-column">
              <SectionCard title="Relaciones" icon={<UsersRound size={14} />}>
                <div className="relationship-list">
                  {relationships.map((relationship) => (
                    <div className="relationship-row" key={relationship.id}>
                      <select
                        className="select sm"
                        value={relationship.characterId}
                        onChange={(event) =>
                          updateRelationships(
                            relationships.map((entry) =>
                              entry.id === relationship.id ? { ...entry, characterId: event.target.value } : entry
                            )
                          )
                        }
                      >
                        <option value="">Seleccionar personaje</option>
                        {availableCharacters.map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input sm"
                        value={relationship.label}
                        onChange={(event) =>
                          updateRelationships(
                            relationships.map((entry) =>
                              entry.id === relationship.id ? { ...entry, label: event.target.value } : entry
                            )
                          )
                        }
                        placeholder="Tipo de relación"
                      />
                      <button
                        className="icon-btn sm danger"
                        onClick={() => updateRelationships(relationships.filter((entry) => entry.id !== relationship.id))}
                        title="Eliminar relación"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn sm btn-block mt-8"
                  disabled={!availableCharacters.length}
                  onClick={() =>
                    updateRelationships([
                      ...relationships,
                      { id: makeId('rel'), characterId: '', label: '' }
                    ])
                  }
                >
                  <Plus size={12} />
                  Añadir relación
                </button>
              </SectionCard>

              <SectionCard title="Apariciones">
                <Appearances scenes={appearances} onOpen={openScene} />
              </SectionCard>

              <SectionCard title="Tramas vinculadas">
                {relatedPlots.length ? (
                  <div className="linked-plot-list">
                    {relatedPlots.map((plot) => (
                      <div className="linked-plot" key={plot.id}>
                        <span className="plot-swatch" style={{ background: plot.color }} />
                        <span>{plot.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="form-empty-text">Sin tramas vinculadas.</p>
                )}
              </SectionCard>

              <div className="entity-meta-foot">
                <span>Creado {new Date(character.createdAt).toLocaleDateString('es-ES')}</span>
                <span>Editado {new Date(character.updatedAt).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={deleteCurrent}
          title="Eliminar personaje"
          message={`Se eliminará «${character.name}» y se desvinculará de todas las escenas y tramas.`}
          confirmLabel="Eliminar personaje"
          danger
        />
      </div>
    )
  }

  if (location) {
    const appearances = getSceneDetails(scenesForLocation(project, location.id))
    const relatedItems = project.items.filter((entity) => entity.locationId === location.id)
    return (
      <div className="view">
        <div className="entity-page">
          <header className="entity-page-head">
            <div className="entity-page-identity">
              <ImageUpload value={location.image} onChange={(image) => updateLocation(location.id, { image })} name={location.name} size={84} />
              <div className="grow">
                <div className="entity-eyebrow">
                  <MapPin size={12} />
                  Ubicación
                  <span className="entity-eyebrow-dot" />
                  {location.type || 'Sin tipo'}
                </div>
                <input className="entity-title-input" value={location.name} onChange={(event) => updateLocation(location.id, { name: event.target.value })} aria-label="Nombre de la ubicación" />
                <div className="entity-header-tags">
                  {location.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => addLocation()}><Plus size={13} />Nueva</button>
              <button className="icon-btn danger" onClick={() => setConfirmDelete(true)} title="Eliminar ubicación"><Trash2 size={15} /></button>
            </div>
          </header>
          <div className="entity-layout">
            <div className="entity-main-column">
              <SectionCard title="Identidad" icon={<MapPin size={14} />}>
                <div className="field-row">
                  <Field label="Nombre"><input className="input" value={location.name} onChange={(event) => updateLocation(location.id, { name: event.target.value })} /></Field>
                  <Field label="Tipo de lugar"><input className="input" value={location.type} onChange={(event) => updateLocation(location.id, { type: event.target.value })} placeholder="Ciudad, bosque, interior..." /></Field>
                </div>
                <Field label="Descripción"><textarea className="textarea" value={location.description} onChange={(event) => updateLocation(location.id, { description: event.target.value })} /></Field>
                <Field label="Atmósfera sensorial"><textarea className="textarea" value={location.atmosphere} onChange={(event) => updateLocation(location.id, { atmosphere: event.target.value })} placeholder="Olores, sonidos, luz, temperatura..." /></Field>
                <Field label="Etiquetas"><TagInput value={location.tags} onChange={(tags) => updateLocation(location.id, { tags })} /></Field>
                <Field label="Color de ficha"><ColorPicker value={location.color} onChange={(color) => updateLocation(location.id, { color })} /></Field>
              </SectionCard>
              <SectionCard title="Historia y significado" icon={<BookOpen size={14} />}>
                <Field label="Historia del lugar"><textarea className="textarea" value={location.history} onChange={(event) => updateLocation(location.id, { history: event.target.value })} /></Field>
                <Field label="Significado narrativo"><textarea className="textarea" value={location.significance} onChange={(event) => updateLocation(location.id, { significance: event.target.value })} /></Field>
              </SectionCard>
            </div>
            <div className="entity-side-column">
              <SectionCard title="Apariciones"><Appearances scenes={appearances} onOpen={openScene} /></SectionCard>
              <SectionCard title="Ítems vinculados">
                {relatedItems.length ? (
                  <div className="linked-plot-list">
                    {relatedItems.map((entity) => (
                      <div className="linked-plot" key={entity.id}>
                        <span className="plot-swatch" style={{ background: entity.color }} />
                        <span>{entity.name}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="form-empty-text">Ningún ítem está asociado a este lugar.</p>}
              </SectionCard>
              <div className="entity-meta-foot">
                <span>Editado {new Date(location.updatedAt).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={deleteCurrent}
          title="Eliminar ubicación"
          message={`Se eliminará «${location.name}» y se desvinculará de las escenas e ítems.`}
          confirmLabel="Eliminar ubicación"
          danger
        />
      </div>
    )
  }

  const currentItem = item as WorldItem
  const appearances = getSceneDetails(scenesForItem(project, currentItem.id))
  const holderOptions = project.characters.map((entity) => ({ id: entity.id, label: entity.name, color: entity.color }))
  const locationOptions = project.locations.map((entity) => ({ id: entity.id, label: entity.name, sub: entity.type, color: entity.color }))

  return (
    <div className="view">
      <div className="entity-page">
        <header className="entity-page-head">
          <div className="entity-page-identity">
            <ImageUpload value={currentItem.image} onChange={(image) => updateItem(currentItem.id, { image })} name={currentItem.name} size={84} />
            <div className="grow">
              <div className="entity-eyebrow">
                <Package size={12} />
                Ítem
                <span className="entity-eyebrow-dot" />
                {currentItem.type || 'Sin tipo'}
              </div>
              <input className="entity-title-input" value={currentItem.name} onChange={(event) => updateItem(currentItem.id, { name: event.target.value })} aria-label="Nombre del ítem" />
              <div className="entity-header-tags">
                {currentItem.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
              </div>
            </div>
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => addItem()}><Plus size={13} />Nuevo</button>
            <button className="icon-btn danger" onClick={() => setConfirmDelete(true)} title="Eliminar ítem"><Trash2 size={15} /></button>
          </div>
        </header>
        <div className="entity-layout">
          <div className="entity-main-column">
            <SectionCard title="Identidad" icon={<Package size={14} />}>
              <div className="field-row">
                <Field label="Nombre"><input className="input" value={currentItem.name} onChange={(event) => updateItem(currentItem.id, { name: event.target.value })} /></Field>
                <Field label="Tipo de objeto"><input className="input" value={currentItem.type} onChange={(event) => updateItem(currentItem.id, { type: event.target.value })} placeholder="Artefacto, documento, arma..." /></Field>
              </div>
              <Field label="Descripción"><textarea className="textarea" value={currentItem.description} onChange={(event) => updateItem(currentItem.id, { description: event.target.value })} /></Field>
              <Field label="Origen"><textarea className="textarea" value={currentItem.origin} onChange={(event) => updateItem(currentItem.id, { origin: event.target.value })} /></Field>
              <Field label="Significado narrativo"><textarea className="textarea" value={currentItem.significance} onChange={(event) => updateItem(currentItem.id, { significance: event.target.value })} /></Field>
              <Field label="Etiquetas"><TagInput value={currentItem.tags} onChange={(tags) => updateItem(currentItem.id, { tags })} /></Field>
              <Field label="Color de ficha"><ColorPicker value={currentItem.color} onChange={(color) => updateItem(currentItem.id, { color })} /></Field>
            </SectionCard>
            <SectionCard title="Localización y posesión">
              <Field label="En poder de">
                <MultiSelect
                  options={holderOptions}
                  value={currentItem.currentHolderId ? [currentItem.currentHolderId] : []}
                  onChange={(next) => updateItem(currentItem.id, { currentHolderId: next[0] || '' })}
                  placeholder="Sin propietario"
                />
              </Field>
              <Field label="Ubicado en">
                <MultiSelect
                  options={locationOptions}
                  value={currentItem.locationId ? [currentItem.locationId] : []}
                  onChange={(next) => updateItem(currentItem.id, { locationId: next[0] || '' })}
                  placeholder="Sin ubicación"
                />
              </Field>
            </SectionCard>
          </div>
          <div className="entity-side-column">
            <SectionCard title="Apariciones"><Appearances scenes={appearances} onOpen={openScene} /></SectionCard>
            <div className="entity-meta-foot">
              <span>Editado {new Date(currentItem.updatedAt).toLocaleDateString('es-ES')}</span>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteCurrent}
        title="Eliminar ítem"
        message={`Se eliminará «${currentItem.name}» y se desvinculará de las escenas.`}
        confirmLabel="Eliminar ítem"
        danger
      />
    </div>
  )
}
