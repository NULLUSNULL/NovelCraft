import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Image,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X
} from 'lucide-react'
import type { Character, CharacterRelationship, CodexImage, ItemPossessionEvent, Location, Project, WorldItem } from '@shared/types'
import {
  formatNumber,
  getStatusLabel,
  initials,
  makeId,
  nowIso,
  scenesForCharacter,
  scenesForItem,
  scenesForLocation,
  getManuscriptScenes
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ColorPicker, EmptyPanel, Field, ImageUpload, MultiSelect, TagInput } from '../ui/Form'
import { ConfirmDialog } from '../ui/Modal'
import { CodexImageViewer } from '../images/CodexImageViewer'
import { CodexAiDraftField } from './CodexAiDraftField'

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

function PossessionHistory({
  events,
  project,
  onOpen
}: {
  events: ItemPossessionEvent[]
  project: Project
  onOpen: (sceneId: string) => void
}) {
  const sceneOrder = new Map(getManuscriptScenes(project).map((scene, index) => [scene.id, index]))
  const sortedEvents = [...events].sort((left, right) =>
    (sceneOrder.get(left.sceneId) ?? Number.MAX_SAFE_INTEGER) -
      (sceneOrder.get(right.sceneId) ?? Number.MAX_SAFE_INTEGER) ||
    left.createdAt.localeCompare(right.createdAt)
  )

  if (!sortedEvents.length) return <p className="form-empty-text">Todavía no hay cambios de posesión aceptados.</p>

  return (
    <div className="appearance-list">
      {sortedEvents.map((event) => {
        const scene = project.nodes[event.sceneId]
        const chapter = project.nodes[event.chapterId]
        const item = project.items.find((entry) => entry.id === event.itemId)
        const from = project.characters.find((entry) => entry.id === event.fromCharacterId)
        const to = project.characters.find((entry) => entry.id === event.toCharacterId)
        const description = event.action === 'acquisition'
          ? `${to?.name || 'Un personaje'} adquiere «${item?.name || 'objeto'}»`
          : event.action === 'loss'
            ? `${from?.name || 'Un personaje'} pierde «${item?.name || 'objeto'}»`
            : `${from?.name || 'Un personaje'} transfiere «${item?.name || 'objeto'}» a ${to?.name || 'otro personaje'}`
        return (
          <button type="button" className="appearance-row possession-event-row" key={event.id} onClick={() => onOpen(event.sceneId)}>
            <span className="appearance-main">
              <span className="appearance-title">{description}</span>
              <span className="appearance-sub">{chapter?.title || 'Capítulo'} · {scene?.title || 'Escena'}</span>
              {event.summary && <span className="appearance-sub">{event.summary}</span>}
            </span>
            <ArrowRight size={13} />
          </button>
        )
      })}
    </div>
  )
}

function makeUploadedCodexImage(
  kind: CodexImage['kind'],
  entityKind: CodexImage['entityKind'],
  entityId: string,
  title: string,
  url: string
): CodexImage {
  return {
    id: makeId('img'),
    kind,
    title,
    prompt: '',
    url,
    source: 'uploaded',
    entityKind,
    entityId,
    aspect: 'square',
    style: 'auto',
    width: 0,
    height: 0,
    createdAt: nowIso()
  }
}

function EntityVisualLibrary({
  name,
  entityLabel,
  color,
  image,
  images,
  onUpload,
  onOpenImage,
  onOpenPrimary,
  onGenerate,
  onMakePrimary,
  onDeleteImage
}: {
  name: string
  entityLabel: 'lugar' | 'objeto'
  color: string
  image: string
  images: CodexImage[]
  onUpload: (value: string) => void
  onOpenImage: (image: CodexImage) => void
  onOpenPrimary: () => void
  onGenerate: () => void
  onMakePrimary: (image: CodexImage) => void
  onDeleteImage: (image: CodexImage) => void
}) {
  return (
    <section
      className="entity-visual-library"
      aria-label={`Imagen y galería del ${entityLabel}`}
      style={{ '--entity-visual-color': color } as React.CSSProperties}
    >
      <button
        type="button"
        className="entity-visual-hero"
        onClick={onOpenPrimary}
        disabled={!image}
        aria-label={image ? `Ampliar imagen de ${name}` : `Sin imagen para ${name}`}
      >
        {image ? <img src={image} alt={`Imagen de ${name}`} /> : <span>{initials(name || '?')}</span>}
      </button>
      <div className="entity-visual-content">
        <div className="entity-visual-heading">
          <div>
            <span className="entity-eyebrow"><Image size={12} /> Perfil visual</span>
            <h3>Imágenes de {name || (entityLabel === 'lugar' ? 'lugar' : 'objeto')}</h3>
            <p>Imagen principal y referencias para mantener el mundo narrativo coherente.</p>
          </div>
          <div className="entity-visual-actions">
            <ImageUpload value={image} onChange={onUpload} name={name} compact />
            {image && (
              <button type="button" className="btn sm" onClick={() => onUpload('')}>
                Quitar imagen
              </button>
            )}
            <button type="button" className="btn sm btn-primary" onClick={onGenerate}>
              <Sparkles size={13} />
              Generar imagen
            </button>
          </div>
        </div>
        {images.length ? (
          <div className="character-image-shelf">
            {images.map((entry) => (
              <article className="character-image-card" key={entry.id}>
                <button
                  type="button"
                  className="character-image-open"
                  onClick={() => onOpenImage(entry)}
                  aria-label={`Ampliar ${entry.title}`}
                >
                  <img src={entry.url} alt="" loading="lazy" />
                  <span className="character-image-kind">{entry.kind === 'location' ? 'Lugar' : 'Objeto'}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn danger entity-visual-delete"
                  onClick={() => onDeleteImage(entry)}
                  aria-label={`Eliminar ${entry.title}`}
                  title={`Eliminar ${entry.title}`}
                >
                  <Trash2 size={12} />
                </button>
                <div className="character-image-card-caption">
                  <span title={entry.title}>{entry.title}</span>
                  {entry.url !== image && (
                    <button type="button" className="text-link" onClick={() => onMakePrimary(entry)}>
                      Usar como principal
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="character-image-empty">
            <Image size={18} />
            <span>Aún no hay imágenes asociadas.</span>
            <span>Sube una imagen o genera una ilustración desde el estudio.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export function CodexView() {
  const project = useAppStore((state) => state.project)
  const selectedEntity = useAppStore((state) => state.selectedEntity)
  const category = useAppStore((state) => state.codexCategory)
  const selectEntity = useAppStore((state) => state.selectEntity)
  const updateCharacter = useAppStore((state) => state.updateCharacter)
  const deleteCharacter = useAppStore((state) => state.deleteCharacter)
  const updateLocation = useAppStore((state) => state.updateLocation)
  const deleteLocation = useAppStore((state) => state.deleteLocation)
  const updateItem = useAppStore((state) => state.updateItem)
  const deleteItem = useAppStore((state) => state.deleteItem)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const addLocation = useAppStore((state) => state.addLocation)
  const addItem = useAppStore((state) => state.addItem)
  const addCodexImage = useAppStore((state) => state.addCodexImage)
  const updateCodexImage = useAppStore((state) => state.updateCodexImage)
  const deleteCodexImage = useAppStore((state) => state.deleteCodexImage)
  const openImageStudioForEntity = useAppStore((state) => state.openImageStudioForEntity)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeCodexImageId, setActiveCodexImageId] = useState<string | null>(null)
  const [characterImageTab, setCharacterImageTab] = useState<'avatar' | 'pose' | 'memory' | 'all'>('avatar')

  const character = useMemo(
    () =>
      selectedEntity?.kind === 'character'
        ? project?.characters.find((entity) => entity.id === selectedEntity.id)
        : undefined,
    [project, selectedEntity]
  )
  const characterImages = useMemo<CodexImage[]>(
    () =>
      (project?.codexImages || []).filter(
        (img) => img.entityKind === 'character' && img.entityId === character?.id
      ),
    [project, character?.id]
  )
  const sortedCharacterImages = useMemo(
    () => [...characterImages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [characterImages]
  )
  useEffect(() => {
    setActiveCodexImageId(null)
    setCharacterImageTab('avatar')
  }, [selectedEntity?.kind, selectedEntity?.id])
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
  const locationImages = useMemo<CodexImage[]>(
    () => (project?.codexImages || []).filter((image) => image.entityKind === 'location' && image.entityId === location?.id),
    [project?.codexImages, location?.id]
  )
  const itemImages = useMemo<CodexImage[]>(
    () => (project?.codexImages || []).filter((image) => image.entityKind === 'item' && image.entityId === item?.id),
    [project?.codexImages, item?.id]
  )
  const sortedLocationImages = useMemo(
    () => [...locationImages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [locationImages]
  )
  const sortedItemImages = useMemo(
    () => [...itemImages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [itemImages]
  )

  if (!project) return null

  const openScene = (id: string): void => selectDocument(id)
  const deleteImageFromCodex = (image: CodexImage): void => {
    if (!window.confirm(`¿Eliminar «${image.title}» de la biblioteca de imágenes?`)) return
    deleteCodexImage(image.id)
    if (image.entityKind === 'character') {
      const owner = project.characters.find((entry) => entry.id === image.entityId)
      if (owner?.avatar === image.url) updateCharacter(owner.id, { avatar: '' })
    } else if (image.entityKind === 'location') {
      const owner = project.locations.find((entry) => entry.id === image.entityId)
      if (owner?.image === image.url) updateLocation(owner.id, { image: '' })
    } else if (image.entityKind === 'item') {
      const owner = project.items.find((entry) => entry.id === image.entityId)
      if (owner?.image === image.url) updateItem(owner.id, { image: '' })
    }
    if (activeCodexImageId === image.id) setActiveCodexImageId(null)
  }

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
    const carriedItems = project.items.filter((worldItem) => worldItem.currentHolderId === character.id)
    const characterPossessionEvents = (project.itemPossessionEvents || []).filter(
      (event) => event.fromCharacterId === character.id || event.toCharacterId === character.id
    )
    const relationships = character.relationships
    const incomingRelationships = project.characters.flatMap((source) =>
      source.id === character.id
        ? []
        : source.relationships
          .filter((relationship) => relationship.characterId === character.id)
          .map((relationship) => ({ source, relationship }))
    )
    const visibleCharacterImages = sortedCharacterImages.filter((image) =>
      characterImageTab === 'all' || image.kind === characterImageTab
    )
    const characterImageCounts = {
      avatar: sortedCharacterImages.filter((image) => image.kind === 'avatar').length,
      pose: sortedCharacterImages.filter((image) => image.kind === 'pose').length,
      memory: sortedCharacterImages.filter((image) => image.kind === 'memory').length,
      all: sortedCharacterImages.length
    }
    const updateRelationships = (next: CharacterRelationship[]): void =>
      updateCharacter(character.id, { relationships: next })
    const availableCharacters = project.characters.filter((entity) => entity.id !== character.id)

    const openCharacterAvatar = (): void => {
      if (!character.avatar) return
      const existing = (project.codexImages || []).find((entry) => entry.url === character.avatar)
      if (existing) {
        updateCodexImage(existing.id, {
          kind: 'avatar',
          entityKind: 'character',
          entityId: character.id
        })
        setActiveCodexImageId(existing.id)
        return
      }
      const image: CodexImage = {
        id: makeId('img'),
        kind: 'avatar',
        title: `${character.name} · Avatar`,
        prompt: '',
        url: character.avatar,
        source: 'uploaded',
        entityKind: 'character',
        entityId: character.id,
        aspect: 'square',
        style: 'auto',
        width: 0,
        height: 0,
        createdAt: nowIso()
      }
      addCodexImage(image)
      setActiveCodexImageId(image.id)
    }

    const saveCharacterAvatar = (avatar: string): void => {
      updateCharacter(character.id, { avatar })
      if (!avatar) return
      const existing = (project.codexImages || []).find((entry) => entry.url === avatar)
      if (existing) {
        updateCodexImage(existing.id, {
          kind: 'avatar',
          title: existing.title || `${character.name} · Avatar`,
          entityKind: 'character',
          entityId: character.id
        })
        setActiveCodexImageId(existing.id)
        return
      }
      const image: CodexImage = {
        id: makeId('img'),
        kind: 'avatar',
        title: `${character.name} · Avatar`,
        prompt: '',
        url: avatar,
        source: 'uploaded',
        entityKind: 'character',
        entityId: character.id,
        aspect: 'square',
        style: 'auto',
        width: 0,
        height: 0,
        createdAt: nowIso()
      }
      addCodexImage(image)
      setActiveCodexImageId(image.id)
    }

    return (
      <div className="view">
        <div className="entity-page">
          <header className="entity-page-head">
            <div className="entity-page-identity">
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

          <section className="character-visual-library" aria-label="Avatar y galería del personaje">
            <button
              type="button"
              className={`character-avatar-hero ${character.avatar ? 'has-image' : ''}`}
              onClick={openCharacterAvatar}
              disabled={!character.avatar}
              aria-label={character.avatar ? `Ampliar avatar de ${character.name}` : `Sin avatar para ${character.name}`}
              style={{ borderColor: character.color }}
            >
              {character.avatar
                ? <img src={character.avatar} alt={`Avatar de ${character.name}`} />
                : <span>{initials(character.name || '?')}</span>}
              {character.avatar && <span className="character-avatar-zoom"><Image size={14} /> Ver avatar</span>}
            </button>
            <div className="character-visual-content">
              <div className="character-visual-heading">
                <div>
                  <span className="entity-eyebrow"><Image size={12} /> Perfil visual</span>
                  <h3>Imágenes de {character.name || 'personaje'}</h3>
                  <p>Avatar, poses y recuerdos, reunidos junto a la ficha.</p>
                </div>
                <div className="character-visual-actions">
                  <ImageUpload
                    value={character.avatar}
                    onChange={saveCharacterAvatar}
                    name={character.name}
                    compact
                  />
                  {character.avatar && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => updateCharacter(character.id, { avatar: '' })}
                    >
                      Quitar avatar
                    </button>
                  )}
                  <button className="btn sm btn-primary" onClick={() => openImageStudioForEntity('character', character.id)}>
                    <Sparkles size={13} />
                    Generar imagen
                  </button>
                </div>
              </div>
              <>
                <div className="character-image-tabs" role="group" aria-label="Filtrar imágenes del personaje">
                  {([
                    ['avatar', 'Avatar'],
                    ['pose', 'Poses'],
                    ['memory', 'Recuerdos'],
                    ['all', 'Todas']
                  ] as const).map(([imageKind, label]) => (
                    <button
                      type="button"
                      key={imageKind}
                      className={`character-image-tab ${characterImageTab === imageKind ? 'active' : ''}`}
                      aria-pressed={characterImageTab === imageKind}
                      onClick={() => setCharacterImageTab(imageKind)}
                    >
                      {label}
                      <span className="character-image-tab-count">{characterImageCounts[imageKind]}</span>
                    </button>
                  ))}
                </div>
                {visibleCharacterImages.length ? <div className="character-image-shelf">
                  {visibleCharacterImages.map((image) => (
                    <article className="character-image-card" key={image.id}>
                      <button
                        type="button"
                        className="character-image-open"
                        onClick={() => setActiveCodexImageId(image.id)}
                        aria-label={`Ampliar ${image.title}`}
                      >
                        <img src={image.url} alt="" loading="lazy" />
                        <span className="character-image-kind">{image.kind === 'avatar'
                          ? 'Avatar'
                          : image.kind === 'pose'
                            ? 'Pose'
                            : image.kind === 'memory'
                              ? 'Recuerdo'
                              : image.kind === 'cover'
                                ? 'Portada'
                                : image.kind === 'location'
                                  ? 'Lugar'
                                  : 'Objeto'}</span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger entity-visual-delete"
                        onClick={() => deleteImageFromCodex(image)}
                        aria-label={`Eliminar ${image.title}`}
                        title={`Eliminar ${image.title}`}
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="character-image-card-caption">
                        <span title={image.title}>{image.title}</span>
                        {image.kind === 'avatar' && image.url !== character.avatar && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              updateCharacter(character.id, { avatar: image.url })
                              updateCodexImage(image.id, {
                                kind: 'avatar',
                                entityKind: 'character',
                                entityId: character.id
                              })
                            }}
                            title="Usar esta imagen de categoría Avatar"
                          >
                            Usar como avatar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                : <div className="character-image-tab-empty">
                    {characterImageTab === 'avatar'
                      ? character.avatar
                        ? 'La imagen principal de avatar está destacada arriba. Sube o genera otras imágenes de tipo Avatar para archivarlas aquí.'
                        : 'Todavía no hay avatar. Sube una imagen o genera una desde el estudio; solo las imágenes de tipo Avatar pueden ser la imagen principal.'
                      : `Todavía no hay imágenes de tipo ${characterImageTab === 'pose' ? 'Pose' : characterImageTab === 'memory' ? 'Recuerdo' : 'avatar, pose o recuerdo'}.`}
                </div>}
              </>
            </div>
          </section>

          <div className="entity-layout">
            <div className="entity-main-column">
              <SectionCard title="Identidad y aspecto" icon={<UserRound size={14} />}>
                <Field label="Rol narrativo">
                  <input className="input" value={character.role} onChange={(event) => updateCharacter(character.id, { role: event.target.value })} placeholder="Protagonista, aliado..." />
                </Field>
                <div className="field-row">
                  <Field label="Edad">
                    <input className="input" value={character.age} onChange={(event) => updateCharacter(character.id, { age: event.target.value })} />
                  </Field>
                  <Field label="Género">
                    <input className="input" value={character.pronouns} onChange={(event) => updateCharacter(character.id, { pronouns: event.target.value })} placeholder="femenino, masculino, no binario..." />
                  </Field>
                </div>
                <div className="field-row">
                  <Field label="Altura" hint="Opcional; ayuda a mantener la escala visual.">
                    <input className="input" value={character.height || ''} onChange={(event) => updateCharacter(character.id, { height: event.target.value })} placeholder="1,72 m" />
                  </Field>
                  <Field label="Peso o complexión" hint="Opcional.">
                    <input className="input" value={character.weight || ''} onChange={(event) => updateCharacter(character.id, { weight: event.target.value })} placeholder="Complexión atlética" />
                  </Field>
                </div>
                <Field label="Ocupación">
                  <input className="input" value={character.occupation} onChange={(event) => updateCharacter(character.id, { occupation: event.target.value })} />
                </Field>
                <CodexAiDraftField
                  label="Apariencia"
                  skill="character-codex"
                  value={character.appearance}
                  context={`Personaje: ${character.name}. Rol: ${character.role}. Edad: ${character.age}. Pronombres: ${character.pronouns}. Altura: ${character.height || 'sin definir'}. Complexión: ${character.weight || 'sin definir'}. Ocupación: ${character.occupation}. Personalidad: ${character.personality}. Pasado: ${character.backstory}`}
                  onChange={(appearance) => updateCharacter(character.id, { appearance })}
                  placeholder="Rasgos físicos, forma de vestir, gestos recurrentes..."
                />
                <Field label="Etiquetas">
                  <TagInput value={character.tags} onChange={(tags) => updateCharacter(character.id, { tags })} />
                </Field>
                <Field label="Color de ficha">
                  <ColorPicker value={character.color} onChange={(color) => updateCharacter(character.id, { color })} />
                </Field>
              </SectionCard>

              <SectionCard title="Psicología y voz" icon={<Sparkles size={14} />}>
                <CodexAiDraftField
                  label="Personalidad"
                  skill="character-codex"
                  value={character.personality}
                  context={`Personaje: ${character.name}. Rol: ${character.role}. Objetivo: ${character.goal}. Conflicto: ${character.conflict}. Motivación: ${character.motivation}. Secreto: ${character.secret}.`}
                  onChange={(personality) => updateCharacter(character.id, { personality })}
                  placeholder="Luces y sombras, contradicciones, manías..."
                />
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
                {incomingRelationships.length > 0 && (
                  <div className="relationship-incoming">
                    <span className="field-label">También relacionada con este personaje</span>
                    {incomingRelationships.map(({ source, relationship }) => (
                      <button
                        type="button"
                        className="relationship-incoming-row"
                        key={`${source.id}-${relationship.id}`}
                        onClick={() => selectEntity('character', source.id)}
                        title={`Abrir la ficha de ${source.name}`}
                      >
                        <span className="plot-swatch" style={{ background: source.color }} />
                        <span><strong>{source.name}</strong><small>{relationship.label || 'Relación sin tipo'}</small></span>
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Objetos que lleva" icon={<Package size={14} />}>
                {carriedItems.length ? (
                  <div className="linked-plot-list">
                    {carriedItems.map((worldItem) => (
                      <button
                        type="button"
                        className="linked-plot entity-link-row"
                        key={worldItem.id}
                        onClick={() => selectEntity('item', worldItem.id)}
                        title={`Abrir la ficha de ${worldItem.name}`}
                      >
                        <span className="plot-swatch" style={{ background: worldItem.color }} />
                        <span>{worldItem.name}</span>
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                ) : <p className="form-empty-text">No hay objetos asignados como posesión actual.</p>}
              </SectionCard>

              <SectionCard title="Historial de posesiones">
                <PossessionHistory
                  events={characterPossessionEvents}
                  project={project}
                  onOpen={openScene}
                />
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
        <CodexImageViewer
          images={sortedCharacterImages}
          imageId={activeCodexImageId}
          onImageChange={setActiveCodexImageId}
          onClose={() => setActiveCodexImageId(null)}
        />
      </div>
    )
  }

  if (location) {
    const appearances = getSceneDetails(scenesForLocation(project, location.id))
    const relatedItems = project.items.filter((entity) => entity.locationId === location.id)
    const saveLocationImage = (imageUrl: string): void => {
      updateLocation(location.id, { image: imageUrl })
      if (!imageUrl) return
      const existing = (project.codexImages || []).find((entry) => entry.url === imageUrl)
      if (existing) {
        updateCodexImage(existing.id, {
          kind: 'location',
          entityKind: 'location',
          entityId: location.id
        })
        setActiveCodexImageId(existing.id)
        return
      }
      const image = makeUploadedCodexImage('location', 'location', location.id, `${location.name} · Imagen`, imageUrl)
      addCodexImage(image)
      setActiveCodexImageId(image.id)
    }
    const openLocationImage = (): void => {
      if (!location.image) return
      const existing = (project.codexImages || []).find((entry) => entry.url === location.image)
      if (existing) {
        setActiveCodexImageId(existing.id)
      } else {
        const image = makeUploadedCodexImage('location', 'location', location.id, `${location.name} · Imagen`, location.image)
        addCodexImage(image)
        setActiveCodexImageId(image.id)
      }
    }
    const setPrimaryLocationImage = (image: CodexImage): void => {
      updateLocation(location.id, { image: image.url })
      updateCodexImage(image.id, { kind: 'location', entityKind: 'location', entityId: location.id })
    }
    return (
      <div className="view">
        <div className="entity-page">
          <header className="entity-page-head">
            <div className="entity-page-identity">
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
              <button className="btn sm" onClick={() => openImageStudioForEntity('location', location.id)}>
                <Sparkles size={13} />
                Generar imagen
              </button>
              <button className="icon-btn danger" onClick={() => setConfirmDelete(true)} title="Eliminar ubicación"><Trash2 size={15} /></button>
            </div>
          </header>
          <EntityVisualLibrary
            name={location.name}
            entityLabel="lugar"
            color={location.color}
            image={location.image}
            images={locationImages}
            onUpload={saveLocationImage}
            onOpenImage={(image) => setActiveCodexImageId(image.id)}
            onOpenPrimary={openLocationImage}
            onGenerate={() => openImageStudioForEntity('location', location.id)}
            onMakePrimary={setPrimaryLocationImage}
            onDeleteImage={deleteImageFromCodex}
          />
          <div className="entity-layout">
            <div className="entity-main-column">
              <SectionCard title="Identidad" icon={<MapPin size={14} />}>
                <Field label="Tipo de lugar"><input className="input" value={location.type} onChange={(event) => updateLocation(location.id, { type: event.target.value })} placeholder="Ciudad, bosque, interior..." /></Field>
                <CodexAiDraftField
                  label="Descripción"
                  skill="location-codex"
                  value={location.description}
                  context={`Lugar: ${location.name}. Tipo: ${location.type}. Atmósfera: ${location.atmosphere}. Historia: ${location.history}. Significado: ${location.significance}.`}
                  onChange={(description) => updateLocation(location.id, { description })}
                />
                <CodexAiDraftField
                  label="Atmósfera sensorial"
                  skill="location-codex"
                  value={location.atmosphere}
                  context={`Lugar: ${location.name}. Tipo: ${location.type}. Descripción: ${location.description}. Historia: ${location.history}.`}
                  onChange={(atmosphere) => updateLocation(location.id, { atmosphere })}
                  placeholder="Olores, sonidos, luz, temperatura..."
                />
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
        <CodexImageViewer
          images={sortedLocationImages}
          imageId={activeCodexImageId}
          onImageChange={setActiveCodexImageId}
          onClose={() => setActiveCodexImageId(null)}
        />
      </div>
    )
  }

  const currentItem = item as WorldItem
  const appearances = getSceneDetails(scenesForItem(project, currentItem.id))
  const itemPossessionEvents = (project.itemPossessionEvents || []).filter(
    (event) => event.itemId === currentItem.id
  )
  const holderOptions = project.characters.map((entity) => ({ id: entity.id, label: entity.name, color: entity.color }))
  const locationOptions = project.locations.map((entity) => ({ id: entity.id, label: entity.name, sub: entity.type, color: entity.color }))
  const saveItemImage = (imageUrl: string): void => {
    updateItem(currentItem.id, { image: imageUrl })
    if (!imageUrl) return
    const existing = (project.codexImages || []).find((entry) => entry.url === imageUrl)
    if (existing) {
      updateCodexImage(existing.id, {
        kind: 'object',
        entityKind: 'item',
        entityId: currentItem.id
      })
      setActiveCodexImageId(existing.id)
      return
    }
    const image = makeUploadedCodexImage('object', 'item', currentItem.id, `${currentItem.name} · Imagen`, imageUrl)
    addCodexImage(image)
    setActiveCodexImageId(image.id)
  }
  const openItemImage = (): void => {
    if (!currentItem.image) return
    const existing = (project.codexImages || []).find((entry) => entry.url === currentItem.image)
    if (existing) {
      setActiveCodexImageId(existing.id)
    } else {
      const image = makeUploadedCodexImage('object', 'item', currentItem.id, `${currentItem.name} · Imagen`, currentItem.image)
      addCodexImage(image)
      setActiveCodexImageId(image.id)
    }
  }
  const setPrimaryItemImage = (image: CodexImage): void => {
    updateItem(currentItem.id, { image: image.url })
    updateCodexImage(image.id, { kind: 'object', entityKind: 'item', entityId: currentItem.id })
  }

  return (
    <div className="view">
      <div className="entity-page">
        <header className="entity-page-head">
          <div className="entity-page-identity">
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
            <button className="btn sm" onClick={() => openImageStudioForEntity('item', currentItem.id)}>
              <Sparkles size={13} />
              Generar imagen
            </button>
            <button className="icon-btn danger" onClick={() => setConfirmDelete(true)} title="Eliminar ítem"><Trash2 size={15} /></button>
          </div>
        </header>
        <EntityVisualLibrary
          name={currentItem.name}
          entityLabel="objeto"
          color={currentItem.color}
          image={currentItem.image}
          images={itemImages}
          onUpload={saveItemImage}
          onOpenImage={(image) => setActiveCodexImageId(image.id)}
          onOpenPrimary={openItemImage}
          onGenerate={() => openImageStudioForEntity('item', currentItem.id)}
          onMakePrimary={setPrimaryItemImage}
          onDeleteImage={deleteImageFromCodex}
        />
        <div className="entity-layout">
          <div className="entity-main-column">
            <SectionCard title="Identidad y naturaleza" icon={<Package size={14} />}>
              <Field label="Tipo de objeto"><input className="input" value={currentItem.type} onChange={(event) => updateItem(currentItem.id, { type: event.target.value })} placeholder="Artefacto, documento, arma..." /></Field>
              <CodexAiDraftField
                label="Descripción"
                skill="item-codex"
                value={currentItem.description}
                context={`Objeto: ${currentItem.name}. Tipo: ${currentItem.type}. Origen: ${currentItem.origin}. Significado narrativo: ${currentItem.significance}.`}
                onChange={(description) => updateItem(currentItem.id, { description })}
              />
              <CodexAiDraftField
                label="Origen"
                skill="item-codex"
                value={currentItem.origin}
                context={`Objeto: ${currentItem.name}. Tipo: ${currentItem.type}. Descripción: ${currentItem.description}. Significado: ${currentItem.significance}.`}
                onChange={(origin) => updateItem(currentItem.id, { origin })}
              />
              <CodexAiDraftField
                label="Significado narrativo"
                skill="item-codex"
                value={currentItem.significance}
                context={`Objeto: ${currentItem.name}. Tipo: ${currentItem.type}. Descripción: ${currentItem.description}. Origen: ${currentItem.origin}.`}
                onChange={(significance) => updateItem(currentItem.id, { significance })}
              />
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
            <SectionCard title="Historial de posesión">
              <PossessionHistory
                events={itemPossessionEvents}
                project={project}
                onOpen={openScene}
              />
            </SectionCard>
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
      <CodexImageViewer
        images={sortedItemImages}
        imageId={activeCodexImageId}
        onImageChange={setActiveCodexImageId}
        onClose={() => setActiveCodexImageId(null)}
      />
    </div>
  )
}
