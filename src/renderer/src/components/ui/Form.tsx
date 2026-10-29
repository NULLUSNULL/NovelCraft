import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ImagePlus, Plus, Search, Trash2, X } from 'lucide-react'
import { initials } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { AppIcon } from '../AppIcon'

export function Field({
  label,
  hint,
  children,
  right,
  className = ''
}: {
  label?: string
  hint?: string
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={`field ${className}`}>
      {(label || right) && (
        <div className="field-label">
          <span>{label}</span>
          {right}
        </div>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export interface MultiOption {
  id: string
  label: string
  sub?: string
  color?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  emptyLabel = 'No hay elementos disponibles',
  compact = false
}: {
  options: MultiOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyLabel?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 260 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = new Set(value)

  const updatePosition = (): void => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 250)
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < 280 && rect.top > 300 ? Math.max(8, rect.top - 290) : rect.bottom + 4
    setPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handlePointer = (event: MouseEvent): void => {
      if (
        !panelRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleScroll = (): void => updatePosition()
    window.addEventListener('mousedown', handlePointer)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const normalized = query.toLowerCase()
    return options.filter((option) => `${option.label} ${option.sub || ''}`.toLowerCase().includes(normalized))
  }, [options, query])

  const toggle = (id: string): void => {
    if (selected.has(id)) onChange(value.filter((item) => item !== id))
    else onChange([...value, id])
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`multi-trigger ${compact ? 'compact' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <div className="multi-trigger-content">
          {value.length === 0 && <span className="multi-placeholder">{placeholder}</span>}
          {value.slice(0, 2).map((id) => {
            const option = options.find((item) => item.id === id)
            if (!option) return null
            return (
              <span className="multi-chip" key={id}>
                {option.color && <span className="entity-dot" style={{ background: option.color }} />}
                {option.label}
              </span>
            )
          })}
          {value.length > 2 && <span className="multi-more">+{value.length - 2}</span>}
        </div>
        <ChevronDown size={13} />
      </button>
      {open &&
        createPortal(
          <div ref={panelRef} className="multi-popover" style={{ top: position.top, left: position.left, width: position.width }}>
            <div className="multi-search">
              <Search size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar..."
                autoFocus
              />
            </div>
            <div className="multi-options">
              {filtered.map((option) => {
                const active = selected.has(option.id)
                return (
                  <button
                    type="button"
                    className={`multi-option ${active ? 'active' : ''}`}
                    key={option.id}
                    onClick={() => toggle(option.id)}
                  >
                    <span className={`multi-check ${active ? 'on' : ''}`}>
                      {active && <Check size={11} />}
                    </span>
                    {option.color && <span className="entity-dot" style={{ background: option.color }} />}
                    <span className="multi-option-text">
                      <span>{option.label}</span>
                      {option.sub && <span className="multi-option-sub">{option.sub}</span>}
                    </span>
                  </button>
                )
              })}
              {!filtered.length && <div className="multi-empty">{emptyLabel}</div>}
            </div>
            {value.length > 0 && (
              <button type="button" className="multi-clear" onClick={() => onChange([])}>
                Limpiar selección
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Añadir etiqueta...'
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const add = (): void => {
    const cleaned = text.trim().replace(/^#/, '')
    if (!cleaned) return
    if (!value.includes(cleaned)) onChange([...value, cleaned])
    setText('')
  }
  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`Quitar ${tag}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          }
          if (event.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
      />
    </div>
  )
}

const SWATCHES = ['#d7a568', '#ca7c6b', '#82a58d', '#7f95b0', '#a586b4', '#67a0a0', '#c4915b', '#a15f72']

export function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="color-picker">
      {SWATCHES.map((color) => (
        <button
          type="button"
          key={color}
          className={`color-swatch ${value.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={`Color ${color}`}
        />
      ))}
      <label className="color-custom" title="Color personalizado">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <Plus size={11} />
      </label>
    </div>
  )
}

export function ImageUpload({
  value,
  onChange,
  name,
  round = false,
  size = 76
}: {
  value: string
  onChange: (value: string) => void
  name: string
  round?: boolean
  size?: number
}) {
  const pushToast = useAppStore((state) => state.pushToast)
  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      pushToast('La imagen debe pesar menos de 4 MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result || ''))
    reader.readAsDataURL(file)
  }
  return (
    <div
      className={`image-upload ${round ? 'round' : ''}`}
      style={{ width: size, height: size, backgroundImage: value ? `url(${value})` : undefined }}
    >
      {!value && <span className="image-initials">{initials(name || '?')}</span>}
      <label className="image-upload-overlay" title="Cambiar imagen">
        <input type="file" accept="image/*" onChange={handleFile} />
        <ImagePlus size={16} />
      </label>
      {value && (
        <button
          type="button"
          className="image-remove"
          onClick={() => onChange('')}
          title="Quitar imagen"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

async function coverFileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onerror = () => reject(new Error('La imagen no es válida.'))
    element.onload = () => resolve(element)
    element.src = raw
  })
  const ratio = Math.min(1, 1400 / image.width, 2100 / image.height)
  if (ratio >= 1 && file.size < 900 * 1024) return raw
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * ratio))
  canvas.height = Math.max(1, Math.round(image.height * ratio))
  const context = canvas.getContext('2d')
  if (!context) return raw
  context.fillStyle = '#f3eee5'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

export function CoverUpload({
  value,
  color,
  title,
  author,
  onChange,
  width = 154,
  height = 218,
  compact = false,
  className = ''
}: {
  value: string
  color: string
  title: string
  author: string
  onChange: (value: string) => void
  width?: number
  height?: number
  compact?: boolean
  className?: string
}) {
  const pushToast = useAppStore((state) => state.pushToast)
  const handleFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      pushToast('Selecciona un archivo de imagen.', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      pushToast('La portada debe pesar menos de 8 MB.', 'error')
      return
    }
    try {
      onChange(await coverFileToDataUrl(file))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }
  return (
    <div
      className={`cover-upload ${compact ? 'compact' : ''} ${className}`}
      style={{ width, height, background: value ? undefined : color }}
    >
      {value ? (
        <img className="cover-upload-image" src={value} alt={`Portada de ${title || 'la novela'}`} />
      ) : (
        <div className="cover-upload-fallback">
          <AppIcon className="cover-upload-mark" />
          {!compact && <strong>{title || 'Tu novela'}</strong>}
          {!compact && <small>{author || 'Autor/a'}</small>}
        </div>
      )}
      <label className="cover-upload-overlay" title={value ? 'Cambiar foto de portada' : 'Subir foto de portada'}>
        <input type="file" accept="image/*" onChange={(event) => void handleFile(event)} />
        <ImagePlus size={compact ? 13 : 16} />
        {!compact && <span>{value ? 'Cambiar foto' : 'Subir foto'}</span>}
      </label>
      {value && (
        <button
          type="button"
          className="image-remove cover-remove"
          onClick={() => onChange('')}
          title="Quitar foto de portada"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

export function EmptyPanel({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}
