import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, Download, ImagePlus } from 'lucide-react'
import type { CodexImage, EntityKind, ImageGenStyle, ImageKind } from '@shared/types'
import { formatDateTime } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { TagInput } from '../ui/Form'
import { Modal } from '../ui/Modal'

const KIND_LABELS: Record<ImageKind, string> = {
  cover: 'Portada',
  avatar: 'Avatar',
  object: 'Objeto',
  location: 'Lugar',
  pose: 'Pose',
  memory: 'Recuerdo'
}

const STYLE_LABELS: Record<ImageGenStyle, string> = {
  auto: 'Automático',
  illustration: 'Ilustración',
  painting: 'Pintura',
  photo: 'Fotografía',
  minimal: 'Minimalista'
}

const ASPECT_LABELS: Record<CodexImage['aspect'], string> = {
  square: 'Cuadrada (1:1)',
  portrait: 'Retrato (2:3)',
  landscape: 'Paisaje (3:2)'
}

function targetKindForImage(kind: ImageKind): EntityKind | null {
  if (kind === 'cover') return null
  if (kind === 'avatar' || kind === 'pose' || kind === 'memory') return 'character'
  if (kind === 'location') return 'location'
  return 'item'
}

function fileExtension(url: string): string {
  const mime = url.match(/^data:image\/([a-zA-Z0-9.+-]+);/)
  if (mime) return mime[1] === 'jpeg' ? 'jpg' : mime[1]
  try {
    const pathname = new URL(url).pathname
    const extension = pathname.split('.').pop()
    return extension && /^[a-zA-Z0-9]{2,5}$/.test(extension) ? extension : 'png'
  } catch {
    return 'png'
  }
}

interface CodexImageViewerProps {
  images: CodexImage[]
  imageId: string | null
  onImageChange: (imageId: string) => void
  onClose: () => void
}

export function CodexImageViewer({ images, imageId, onImageChange, onClose }: CodexImageViewerProps) {
  const project = useAppStore((state) => state.project)
  const updateCodexImage = useAppStore((state) => state.updateCodexImage)
  const updateCharacter = useAppStore((state) => state.updateCharacter)
  const updateLocation = useAppStore((state) => state.updateLocation)
  const updateItem = useAppStore((state) => state.updateItem)
  const updateProjectMeta = useAppStore((state) => state.updateProjectMeta)
  const pushToast = useAppStore((state) => state.pushToast)
  const imageIndex = images.findIndex((entry) => entry.id === imageId)
  const image = imageIndex >= 0 ? images[imageIndex] : undefined
  const targetKind = image ? targetKindForImage(image.kind) : null
  const targets = !project || !targetKind
    ? []
    : targetKind === 'character'
      ? project.characters
      : targetKind === 'location'
        ? project.locations
        : project.items
  const selectedTarget = image?.entityId
    ? targets.find((entry) => entry.id === image.entityId)
    : undefined

  const navigate = (direction: -1 | 1): void => {
    if (imageIndex < 0 || !images.length) return
    const nextIndex = (imageIndex + direction + images.length) % images.length
    onImageChange(images[nextIndex].id)
  }

  useEffect(() => {
    if (!image) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
      if (event.key === 'ArrowLeft' && imageIndex > 0) {
        event.preventDefault()
        navigate(-1)
      } else if (event.key === 'ArrowRight' && imageIndex < images.length - 1) {
        event.preventDefault()
        navigate(1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [image, imageIndex, images, onImageChange])

  if (!image || !project) return null

  const changeKind = (kind: ImageKind): void => {
    const nextTargetKind = targetKindForImage(kind)
    const association = nextTargetKind && image.entityKind === nextTargetKind
      ? { entityKind: image.entityKind, entityId: image.entityId }
      : { entityKind: '' as const, entityId: '' as const }
    updateCodexImage(image.id, { kind, ...association })
  }

  const changeTarget = (entityId: string): void => {
    updateCodexImage(image.id, {
      entityKind: entityId && targetKind ? targetKind : '',
      entityId
    })
  }

  const applyImage = (): void => {
    if (image.kind === 'cover') {
      updateProjectMeta({ coverImage: image.url })
      pushToast('Imagen aplicada como portada de la novela.', 'success')
      return
    }
    if (!targetKind || !selectedTarget) return
    if (image.kind === 'avatar' && targetKind === 'character') {
      updateCharacter(selectedTarget.id, { avatar: image.url })
    } else if (image.kind === 'location' && targetKind === 'location') {
      updateLocation(selectedTarget.id, { image: image.url })
    } else if (image.kind === 'object' && targetKind === 'item') {
      updateItem(selectedTarget.id, { image: image.url })
    }
    pushToast(`Imagen asociada a «${selectedTarget.name}».`, 'success')
  }

  const hasPrevious = imageIndex > 0
  const hasNext = imageIndex >= 0 && imageIndex < images.length - 1
  const filename = (image.title.trim() || `imagen-${image.id}`)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 100)

  return (
    <Modal
      open
      onClose={onClose}
      title={image.title || 'Imagen'}
      subtitle={`${KIND_LABELS[image.kind]} · ${image.source === 'generated' ? 'Generada' : 'Subida'}`}
      eyebrow={`Biblioteca de imágenes · ${imageIndex + 1} de ${images.length}`}
      size="xl"
      className="image-viewer-modal"
      footer={
        <>
          <a
            className="btn"
            href={image.url}
            download={`${filename}.${fileExtension(image.url)}`}
            aria-label={`Descargar imagen ${image.title}`}
          >
            <Download size={14} />
            Descargar
          </a>
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyImage}
            disabled={image.kind !== 'cover' && !selectedTarget}
          >
            <ImagePlus size={14} />
            {image.kind === 'cover'
              ? 'Usar como portada'
              : image.kind === 'avatar'
                ? `Usar como avatar${selectedTarget ? ` · ${selectedTarget.name}` : ''}`
                : image.kind === 'pose' || image.kind === 'memory'
                  ? `Asociar al personaje${selectedTarget ? ` · ${selectedTarget.name}` : ''}`
                  : `Aplicar a ${selectedTarget?.name || 'ficha'}`}
          </button>
        </>
      }
    >
      <div className="image-viewer-content">
        <div className="image-viewer-stage">
          <button
            type="button"
            className="image-viewer-nav previous"
            onClick={() => navigate(-1)}
            disabled={!hasPrevious}
            aria-label="Ver imagen anterior"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="image-viewer-main">
            <figure className="image-viewer-figure">
              <img
                src={image.url}
                alt={image.title || KIND_LABELS[image.kind]}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget
                  if (image.width !== naturalWidth || image.height !== naturalHeight) {
                    updateCodexImage(image.id, { width: naturalWidth, height: naturalHeight })
                  }
                }}
              />
            </figure>
            <dl className="image-viewer-facts">
              <div><dt>Origen</dt><dd>{image.source === 'generated' ? 'Generada' : 'Subida'}</dd></div>
              <div><dt>Resolución</dt><dd>{image.width > 0 && image.height > 0 ? `${image.width} × ${image.height} px` : 'No registrada'} · {ASPECT_LABELS[image.aspect]}</dd></div>
              <div><dt>Creada</dt><dd>{formatDateTime(image.createdAt)}</dd></div>
            </dl>
          </div>
          <button
            type="button"
            className="image-viewer-nav next"
            onClick={() => navigate(1)}
            disabled={!hasNext}
            aria-label="Ver imagen siguiente"
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="image-viewer-info">
          <div className="image-viewer-metadata-grid">
            <Field label="Título" className="image-viewer-title-field">
              <input
                className="input"
                value={image.title}
                onChange={(event) => updateCodexImage(image.id, { title: event.target.value })}
              />
            </Field>
            <Field label="Tipo de imagen" className="image-viewer-kind-field">
              <select className="select" value={image.kind} onChange={(event) => changeKind(event.target.value as ImageKind)}>
                {Object.entries(KIND_LABELS).map(([kind, label]) => (
                  <option key={kind} value={kind}>{label}</option>
                ))}
              </select>
            </Field>
            {targetKind && (
              <Field
                className="image-viewer-target-field"
                label={targetKind === 'character' ? 'Personaje asociado' : targetKind === 'location' ? 'Lugar asociado' : 'Objeto asociado'}
                hint={image.kind === 'pose' || image.kind === 'memory'
                  ? 'Las poses y recuerdos se guardan en la galería del personaje.'
                  : 'Puedes cambiar la ficha asociada; el cambio se guarda al seleccionarla.'}
              >
                <select
                  className="select"
                  value={image.entityKind === targetKind ? image.entityId : ''}
                  onChange={(event) => changeTarget(event.target.value)}
                >
                  <option value="">
                    {image.kind === 'pose' || image.kind === 'memory'
                      ? 'Selecciona un personaje…'
                      : 'Independiente'}
                  </option>
                  {!targets.length && <option disabled>No hay fichas disponibles</option>}
                  {targets.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
                {selectedTarget?.color && (
                  <span
                    className="image-viewer-entity-tag"
                    style={{
                      borderColor: selectedTarget.color,
                      background: `color-mix(in srgb, ${selectedTarget.color} 22%, var(--bg-1))`
                    }}
                  >
                    {selectedTarget.name}
                  </span>
                )}
              </Field>
            )}
            <Field label="Estilo">
              <select
                className="select"
                value={image.style}
                onChange={(event) => updateCodexImage(image.id, { style: event.target.value as ImageGenStyle })}
              >
                {Object.entries(STYLE_LABELS).map(([style, label]) => (
                  <option key={style} value={style}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Proporción">
              <select
                className="select"
                value={image.aspect}
                onChange={(event) => updateCodexImage(image.id, { aspect: event.target.value as CodexImage['aspect'] })}
              >
                {Object.entries(ASPECT_LABELS).map(([aspect, label]) => (
                  <option key={aspect} value={aspect}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Etiquetas">
            <TagInput
              value={image.tags || []}
              onChange={(tags) => updateCodexImage(image.id, { tags })}
              placeholder="Añadir etiquetas para clasificar..."
            />
          </Field>
          <Field label="Prompt / descripción">
            <textarea
              className="textarea image-viewer-prompt-editor"
              value={image.prompt}
              onChange={(event) => updateCodexImage(image.id, { prompt: event.target.value })}
              placeholder="Sin prompt guardado."
              rows={4}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function Field({
  label,
  children,
  hint,
  className = ''
}: {
  label: string
  children: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
