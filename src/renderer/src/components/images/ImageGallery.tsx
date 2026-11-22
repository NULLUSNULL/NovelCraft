import { useMemo, useState } from 'react'
import { Image, LayoutGrid, List, ScanEye, Trash2 } from 'lucide-react'
import type { CodexImage, EntityKind, ImageKind, ImageSource } from '@shared/types'
import { formatDateTime } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'

const KIND_LABELS: Record<ImageKind, string> = {
  cover: 'Portada',
  avatar: 'Avatar',
  object: 'Objeto',
  location: 'Lugar',
  pose: 'Pose',
  memory: 'Recuerdo'
}

const SOURCE_LABELS: Record<ImageSource, string> = {
  generated: 'Generada',
  uploaded: 'Subida'
}

const SOURCE_COLORS: Record<ImageSource, string> = {
  generated: 'var(--accent)',
  uploaded: 'var(--blue)'
}

interface ImageGalleryProps {
  images: CodexImage[]
  onSelect: (image: CodexImage, visibleImages?: CodexImage[]) => void
  onDelete: (id: string) => void
  selectedId: string | null
  showHeader?: boolean
  showControls?: boolean
}

const ENTITY_LABELS: Record<EntityKind | '', string> = {
  character: 'Personaje',
  location: 'Lugar',
  item: 'Ítem',
  '': '—'
}

export function ImageGallery({
  images,
  onSelect,
  onDelete,
  selectedId,
  showHeader = true,
  showControls = true
}: ImageGalleryProps) {
  const project = useAppStore((state) => state.project)
  const [category, setCategory] = useState<EntityKind | 'cover' | 'independent' | ''>('')
  const [viewMode, setViewMode] = useState<'details' | 'thumbnails' | 'preview'>('thumbnails')
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...images].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [images]
  )
  const filtered = useMemo(
    () => sorted.filter((image) => {
      if (!category) return true
      if (category === 'cover') return image.kind === 'cover'
      if (category === 'independent') return image.kind !== 'cover' && !image.entityKind
      return image.entityKind === category
    }),
    [category, sorted]
  )
  const previewImage = filtered.find((image) => image.id === previewImageId) || filtered[0]

  const handleDelete = (id: string, event: React.MouseEvent): void => {
    event.stopPropagation()
    onDelete(id)
  }

  if (images.length === 0) {
    return (
      <div className="image-gallery-empty">
        <Image size={32} style={{ opacity: 0.5 }} />
        <h3>Aún no hay imágenes</h3>
        <p>Genera o sube tus primeras fotos desde el panel de la izquierda.</p>
      </div>
    )
  }

  return (
    <div className="image-gallery">
      {showHeader && (
        <div className="image-gallery-head">
          <h3>Biblioteca de imágenes</h3>
          <span className="image-gallery-count">{filtered.length} / {sorted.length}</span>
        </div>
      )}
      {showControls && (
        <div className="image-gallery-toolbar">
          <label className="image-gallery-filter">
            <span>Mostrar</span>
            <select
              className="select sm"
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
            >
              <option value="">Todas las categorías</option>
              <option value="character">Personajes</option>
              <option value="location">Lugares</option>
              <option value="item">Objetos</option>
              <option value="cover">Portadas</option>
              <option value="independent">Independientes</option>
            </select>
          </label>
          <div className="image-gallery-view-switch" role="group" aria-label="Modo de visualización">
            <button type="button" className={`icon-btn sm ${viewMode === 'details' ? 'active' : ''}`} onClick={() => setViewMode('details')} aria-pressed={viewMode === 'details'} aria-label="Vista de detalle" title="Detalle">
              <List size={15} />
            </button>
            <button type="button" className={`icon-btn sm ${viewMode === 'thumbnails' ? 'active' : ''}`} onClick={() => setViewMode('thumbnails')} aria-pressed={viewMode === 'thumbnails'} aria-label="Vista de miniaturas" title="Miniaturas">
              <LayoutGrid size={15} />
            </button>
            <button type="button" className={`icon-btn sm ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')} aria-pressed={viewMode === 'preview'} aria-label="Vista previa" title="Previsualización">
              <ScanEye size={15} />
            </button>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="image-gallery-empty image-gallery-filter-empty">
          <Image size={25} />
          <strong>No hay imágenes en esta categoría</strong>
          <button type="button" className="text-link" onClick={() => setCategory('')}>Mostrar toda la biblioteca</button>
        </div>
      ) : viewMode === 'preview' ? (
        <div className="image-gallery-preview">
          <div className="image-gallery-preview-stage">
            {previewImage && (
              <>
                <img src={previewImage.url} alt={previewImage.title} />
                <div className="image-gallery-preview-caption">
                  <strong>{previewImage.title || 'Imagen sin título'}</strong>
                  <button type="button" className="btn sm" onClick={() => onSelect(previewImage, filtered)}>
                    <ScanEye size={13} /> Abrir detalles
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="image-gallery-preview-list" aria-label="Imágenes">
            {filtered.map((image) => (
              <button
                type="button"
                key={image.id}
                className={`image-gallery-preview-item ${image.id === previewImage?.id ? 'active' : ''}`}
                onClick={() => setPreviewImageId(image.id)}
                aria-pressed={image.id === previewImage?.id}
              >
                <img src={image.url} alt="" loading="lazy" />
                <span>{image.title || 'Sin título'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className={`image-gallery-grid ${viewMode === 'details' ? 'details' : 'thumbnails'}`}>
        {filtered.map((image) => {
          const selected = selectedId === image.id
          const entityLabel = image.kind === 'cover'
            ? 'Portada'
            : image.entityKind
              ? ENTITY_LABELS[image.entityKind]
              : 'Independiente'
          const entityName = image.entityKind && image.entityId
            ? image.entityKind === 'character'
              ? project?.characters.find((entity) => entity.id === image.entityId)?.name
              : image.entityKind === 'location'
                ? project?.locations.find((entity) => entity.id === image.entityId)?.name
                : project?.items.find((entity) => entity.id === image.entityId)?.name
            : undefined
          const entityColor = image.entityKind === 'character'
            ? project?.characters.find((entity) => entity.id === image.entityId)?.color
            : image.entityKind === 'location'
              ? project?.locations.find((entity) => entity.id === image.entityId)?.color
              : image.entityKind === 'item'
                ? project?.items.find((entity) => entity.id === image.entityId)?.color
                : undefined
          if (viewMode === 'details') {
            return (
              <article className={`image-gallery-detail-row ${selected ? 'selected' : ''}`} key={image.id}>
                <button type="button" className="image-gallery-detail-open" onClick={() => onSelect(image, filtered)}>
                  <img src={image.url} alt="" loading="lazy" />
                  <span className="image-gallery-detail-title">
                    <strong>{image.title || 'Imagen sin título'}</strong>
                    <small>{KIND_LABELS[image.kind]} · {SOURCE_LABELS[image.source]}</small>
                  </span>
                  <span className="image-gallery-detail-category">{entityName ? `${entityLabel} · ${entityName}` : entityLabel}</span>
                  <time dateTime={image.createdAt}>{formatDateTime(image.createdAt)}</time>
                </button>
                <button type="button" className="image-card-remove" onClick={(event) => handleDelete(image.id, event)} title={`Eliminar ${image.title}`} aria-label={`Eliminar ${image.title}`}>
                  <Trash2 size={12} />
                </button>
              </article>
            )
          }
          return (
            <article
              key={image.id}
              className={`image-card ${selected ? 'selected' : ''}`}
            >
              <button
                type="button"
                className="image-card-open"
                onClick={() => onSelect(image, filtered)}
                aria-label={`Abrir imagen: ${image.title}`}
              >
                <div className="image-card-media">
                  <img src={image.url} alt="" loading="lazy" />
                  <span className="image-card-kind-badge">{KIND_LABELS[image.kind]}</span>
                  <span
                    className="image-card-source-badge"
                    style={{ background: SOURCE_COLORS[image.source] }}
                  >
                    {SOURCE_LABELS[image.source]}
                  </span>
                </div>
                <div className="image-card-body">
                  <div className="image-card-title">{image.title}</div>
                  {image.tags?.length ? (
                    <div className="image-card-tags" aria-label="Etiquetas">
                      {image.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                      {image.tags.length > 3 && <span>+{image.tags.length - 3}</span>}
                    </div>
                  ) : null}
                  {image.prompt && <div className="image-card-prompt">{image.prompt}</div>}
                  <div className="image-card-footer">
                    <span
                      className="image-card-category"
                      style={entityColor ? {
                        borderColor: entityColor,
                        background: `color-mix(in srgb, ${entityColor} 22%, var(--bg-1))`
                      } : undefined}
                    >
                      {entityName ? `${entityLabel} · ${entityName}` : entityLabel}
                    </span>
                    <time dateTime={image.createdAt}>{formatDateTime(image.createdAt)}</time>
                  </div>
                </div>
              </button>
              <div className="image-card-media-actions">
                <button
                  type="button"
                  className="image-card-remove"
                  onClick={(event) => handleDelete(image.id, event)}
                  title={`Eliminar ${image.title} del historial`}
                  aria-label={`Eliminar ${image.title} del historial`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </article>
          )
        })}
      </div>
      )}
    </div>
  )
}
