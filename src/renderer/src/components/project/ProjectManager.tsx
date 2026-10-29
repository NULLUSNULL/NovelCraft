import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Download,
  Feather,
  FolderOpen,
  Import,
  Library,
  Loader2,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  X
} from 'lucide-react'
import type { CreateProjectInput, LibraryEntry, Project, ProjectUpdateInput } from '@shared/types'
import { COVER_COLORS, EMPTY_PROJECT_INPUT, GENRES } from '@shared/defaults'
import { formatNumber, stripHtml } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { AppIcon } from '../AppIcon'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { CoverUpload, Field } from '../ui/Form'

function coverStyle(color: string, image?: string): React.CSSProperties {
  if (image) {
    return {
      backgroundColor: color,
      backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.52)), url(${image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {
    background: `linear-gradient(150deg, color-mix(in srgb, ${color} 88%, #1a1410), color-mix(in srgb, ${color} 35%, #111217))`
  }
}

function formatDate(iso: string): string {
  if (!iso) return 'Sin actividad'
  const date = new Date(iso)
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 2) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function projectToForm(project: Project): ProjectUpdateInput {
  return {
    title: project.title,
    author: project.author,
    genre: project.genre,
    language: project.language,
    synopsis: project.synopsis,
    description: project.description,
    coverColor: project.coverColor,
    coverImage: project.coverImage || '',
    wordGoal: project.wordGoal,
    targetDate: project.targetDate || ''
  }
}

export function ProjectForm({
  open,
  onClose,
  initial,
  mode = 'create',
  projectId
}: {
  open: boolean
  onClose: () => void
  initial?: ProjectUpdateInput
  mode?: 'create' | 'edit'
  projectId?: string
}) {
  const createProjectFromInput = useAppStore((state) => state.createProjectFromInput)
  const updateProjectFromInput = useAppStore((state) => state.updateProjectFromInput)
  const pushToast = useAppStore((state) => state.pushToast)
  const emptyForm = (): ProjectUpdateInput => ({ ...structuredClone(EMPTY_PROJECT_INPUT), targetDate: '' })
  const [form, setForm] = useState<ProjectUpdateInput>(initial || emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initial || emptyForm())
  }, [open, projectId])

  const patch = (values: Partial<ProjectUpdateInput>): void => setForm((current) => ({ ...current, ...values }))

  const submit = async (): Promise<void> => {
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      const payload: ProjectUpdateInput = {
        ...form,
        title: form.title.trim(),
        author: form.author.trim(),
        wordGoal: Math.max(0, Number(form.wordGoal) || 80000)
      }
      if (mode === 'edit' && projectId) {
        await updateProjectFromInput(projectId, payload)
      } else {
        await createProjectFromInput(payload)
      }
      onClose()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={mode === 'edit' ? 'Editar proyecto' : 'Nueva novela'}
      title={mode === 'edit' ? 'Detalles del proyecto' : 'Empieza una historia'}
      subtitle={
        mode === 'edit'
          ? 'Actualiza la información de la obra. Los cambios se guardan en el proyecto.'
          : 'Solo necesitas un título. Todo lo demás puede cambiar mientras escribes.'
      }
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!form.title.trim() || saving}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 800ms linear infinite' }} /> : mode === 'edit' ? <Save size={13} /> : <Sparkles size={13} />}
            {mode === 'edit' ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </>
      }
    >
      <div className="new-project-layout">
        <div className="new-project-main">
          <Field label="Título de la novela">
            <input
              className="input"
              value={form.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="El nombre que llevará tu historia"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
          </Field>
          <div className="field-row mt-16">
            <Field label="Autoría">
              <input className="input" value={form.author} onChange={(event) => patch({ author: event.target.value })} placeholder="Tu nombre o seudónimo" />
            </Field>
            <Field label="Género">
              <select className="select" value={form.genre} onChange={(event) => patch({ genre: event.target.value })}>
                {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row mt-16">
            <Field label="Idioma">
              <select className="select" value={form.language} onChange={(event) => patch({ language: event.target.value })}>
                <option value="Español">Español</option>
                <option value="English">English</option>
                <option value="Français">Français</option>
                <option value="Deutsch">Deutsch</option>
                <option value="Português">Português</option>
                <option value="Italiano">Italiano</option>
              </select>
            </Field>
            <Field label="Objetivo de palabras">
              <input className="input" type="number" min={0} step={5000} value={form.wordGoal} onChange={(event) => patch({ wordGoal: Number(event.target.value) || 0 })} />
            </Field>
          </div>
          {mode === 'edit' && (
            <Field label="Fecha objetivo" className="mt-16" hint="Opcional. Aparecerá en la vista general del proyecto.">
              <input className="input" type="date" value={form.targetDate || ''} onChange={(event) => patch({ targetDate: event.target.value })} />
            </Field>
          )}
          <Field label="Sinopsis" className="mt-16" hint="Una brújula, no un contrato. Puedes cambiarla siempre que quieras.">
            <textarea className="textarea" rows={4} value={form.synopsis} onChange={(event) => patch({ synopsis: event.target.value })} placeholder="¿De qué trata tu novela?" />
          </Field>
          <Field label="Notas iniciales" className="mt-16">
            <textarea className="textarea" rows={2} value={form.description} onChange={(event) => patch({ description: event.target.value })} placeholder="Temas, atmósfera, ideas sueltas..." />
          </Field>
        </div>
        <div className="new-project-cover">
          <CoverUpload
            value={form.coverImage || ''}
            color={form.coverColor}
            title={form.title}
            author={form.author}
            onChange={(coverImage) => patch({ coverImage })}
          />
          <div className="cover-color-row">
            {COVER_COLORS.map((color) => (
              <button
                key={color}
                className={`cover-color ${form.coverColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => patch({ coverColor: color })}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
          <p className="new-project-hint">Haz clic en la portada para subir una foto. El color identifica tu proyecto en la biblioteca.</p>
        </div>
      </div>
    </Modal>
  )
}

function ProjectCard({
  entry,
  onOpen,
  onMenu
}: {
  entry: LibraryEntry
  onOpen: () => void
  onMenu: (event: React.MouseEvent) => void
}) {
  const progress = entry.wordGoal > 0 ? Math.min(100, Math.round((entry.wordCount / entry.wordGoal) * 100)) : 0
  return (
    <article className="project-card" onClick={onOpen} data-testid={`project-card-${entry.id}`}>
      <div className="project-cover" style={coverStyle(entry.coverColor, entry.coverImage)}>
        <AppIcon className="project-cover-mark" />
        <strong>{entry.title}</strong>
        <span>{entry.author || 'Autor/a sin definir'}</span>
        <em>{entry.genre}</em>
        <span className="project-cover-spine" />
      </div>
      <div className="project-card-body">
        <div className="project-card-heading">
          <div>
            <h3>{entry.title}</h3>
            <p>{entry.genre}</p>
          </div>
          <button className="icon-btn sm" onClick={(event) => { event.stopPropagation(); onMenu(event) }} title="Más opciones">
            <MoreHorizontal size={15} />
          </button>
        </div>
        <div className="project-card-stats">
          <span><strong>{formatNumber(entry.wordCount)}</strong> palabras</span>
          <span><strong>{progress}%</strong> del objetivo</span>
        </div>
        <div className="project-card-progress"><span style={{ width: `${progress}%`, background: entry.coverColor }} /></div>
        <div className="project-card-foot">
          <span><CalendarDays size={11} />{formatDate(entry.lastOpenedAt)}</span>
          <span className="project-open-label">Abrir <ArrowRight size={11} /></span>
        </div>
      </div>
    </article>
  )
}

export function ProjectManager() {
  const open = useAppStore((state) => state.projectManagerOpen)
  const library = useAppStore((state) => state.library)
  const project = useAppStore((state) => state.project)
  const appInfo = useAppStore((state) => state.appInfo)
  const bootError = useAppStore((state) => state.bootError)
  const setOpen = useAppStore((state) => state.setProjectManagerOpen)
  const openProjectById = useAppStore((state) => state.openProjectById)
  const deleteProjectById = useAppStore((state) => state.deleteProjectById)
  const importProject = useAppStore((state) => state.importProject)
  const createDemo = useAppStore((state) => state.createDemo)
  const pushToast = useAppStore((state) => state.pushToast)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: LibraryEntry } | null>(null)
  const [importing, setImporting] = useState(false)
  const [creatingDemo, setCreatingDemo] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormOpen(false)
      setEditing(null)
      setMenu(null)
    }
  }, [open])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return library
    return library.filter((entry) => `${entry.title} ${entry.author} ${entry.genre}`.toLowerCase().includes(normalized))
  }, [library, query])

  const totalWords = useMemo(() => library.reduce((total, entry) => total + entry.wordCount, 0), [library])

  if (!open) return null

  const canClose = Boolean(project)

  const importAction = async (): Promise<void> => {
    setImporting(true)
    try {
      await importProject()
    } finally {
      setImporting(false)
    }
  }

  const demoAction = async (): Promise<void> => {
    setCreatingDemo(true)
    try {
      await createDemo()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setCreatingDemo(false)
    }
  }

  const exportEntry = async (entry: LibraryEntry): Promise<void> => {
    try {
      const result = await window.novelcraft.exportProject(entry.id)
      if (!result.canceled) pushToast(`Proyecto exportado: ${result.filePath}`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const revealEntry = async (entry: LibraryEntry): Promise<void> => {
    try {
      await window.novelcraft.revealProject(entry.id)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const editEntry = async (entry: LibraryEntry): Promise<void> => {
    try {
      const loaded = project?.id === entry.id ? project : await window.novelcraft.getProject(entry.id)
      setEditing(loaded)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const menuItems = (entry: LibraryEntry): ContextMenuItem[] => [
    { id: 'open', label: 'Abrir proyecto', icon: <BookOpen size={13} />, action: () => void openProjectById(entry.id) },
    { id: 'edit', label: 'Editar proyecto', icon: <Pencil size={13} />, action: () => void editEntry(entry) },
    { id: 'export', label: 'Exportar archivo', icon: <Download size={13} />, action: () => void exportEntry(entry) },
    { id: 'reveal', label: 'Mostrar carpeta', icon: <FolderOpen size={13} />, action: () => void revealEntry(entry) },
    { id: 'sep', divider: true },
    { id: 'delete', label: 'Eliminar proyecto', icon: <Trash2 size={13} />, danger: true, action: () => setDeleting(entry) }
  ]

  return (
    <div className="project-manager" data-testid="project-manager">
      <div className="project-manager-glow" />
      <header className="library-header">
        <div className="library-brand">
          <AppIcon className="brand-mark lg" />
          <div>
            <span className="library-eyebrow">NovelCraft</span>
            <h1>Tu biblioteca</h1>
          </div>
        </div>
        <div className="library-header-actions">
          <button className="btn" onClick={() => void demoAction()} disabled={creatingDemo}>
            {creatingDemo ? <Loader2 size={14} style={{ animation: 'spin 800ms linear infinite' }} /> : <Sparkles size={14} />}
            Proyecto de ejemplo
          </button>
          <button className="btn" onClick={() => void importAction()} disabled={importing}>
            {importing ? <Loader2 size={14} style={{ animation: 'spin 800ms linear infinite' }} /> : <Import size={14} />}
            Importar
          </button>
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} />
            Nueva novela
          </button>
          {canClose && (
            <button className="icon-btn library-close" onClick={() => setOpen(false)} title="Cerrar biblioteca">
              <X size={18} />
            </button>
          )}
          {appInfo?.platform !== 'darwin' && (
            <div className="window-controls library-window-controls">
              <button className="window-control" onClick={() => window.novelcraft.minimizeWindow()} title="Minimizar">
                <Minus size={14} />
              </button>
              <button
                className="window-control"
                onClick={async () => setMaximized(await window.novelcraft.maximizeWindow())}
                title={maximized ? 'Restaurar' : 'Maximizar'}
              >
                <Square size={11} />
              </button>
              <button className="window-control close" onClick={() => window.novelcraft.closeWindow()} title="Cerrar aplicación">
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      {bootError && <div className="library-error">{bootError}</div>}

      <div className="library-toolbar">
        <div className="library-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, autor o género..." />
        </div>
        <div className="library-summary">
          <span>{library.length} proyectos</span>
          <span className="dot-sep" />
          <span>{formatNumber(totalWords)} palabras escritas</span>
        </div>
      </div>

      <div className="library-content">
        {filtered.length > 0 ? (
          <div className="project-grid">
            <button className="new-project-card" onClick={() => setFormOpen(true)}>
              <span className="new-project-card-icon"><Plus size={22} /></span>
              <strong>Empezar otra historia</strong>
              <p>Una novela nueva, una página en blanco y todo por descubrir.</p>
            </button>
            {filtered.map((entry) => (
              <ProjectCard
                key={entry.id}
                entry={entry}
                onOpen={() => void openProjectById(entry.id)}
                onMenu={(event) => setMenu({ x: event.clientX, y: event.clientY, entry })}
              />
            ))}
          </div>
        ) : library.length > 0 ? (
          <div className="library-empty">
            <Search size={24} />
            <h2>Sin coincidencias</h2>
            <p>Prueba con otro título, autor o género.</p>
            <button className="btn" onClick={() => setQuery('')}>Limpiar búsqueda</button>
          </div>
        ) : (
          <div className="library-empty library-welcome">
            <div className="library-welcome-icon"><Library size={29} /></div>
            <span className="library-eyebrow">Tu espacio creativo</span>
            <h2>Todo comienza con una idea</h2>
            <p>Planifica tu novela, organiza su mundo, teje sus tramas y escribe sin distracciones. Tus archivos viven en tu equipo.</p>
            <div className="library-welcome-actions">
              <button className="btn btn-primary lg" onClick={() => setFormOpen(true)}>
                <Feather size={15} />
                Crear mi primera novela
              </button>
              <button className="btn lg" onClick={() => void demoAction()} disabled={creatingDemo}>
                {creatingDemo ? <Loader2 size={15} /> : <Sparkles size={15} />}
                Explorar con un ejemplo
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="library-footer">
        <span><Check size={11} />Guardado local y privado</span>
        <span className="grow" />
        {project && <span className="faint">Proyecto abierto: {project.title}</span>}
      </footer>

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ProjectForm
        open={Boolean(editing)}
        mode="edit"
        projectId={editing?.id}
        initial={editing ? projectToForm(editing) : undefined}
        onClose={() => setEditing(null)}
      />

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.entry)} onClose={() => setMenu(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteProjectById(deleting.id).catch((error) => pushToast(String(error), 'error'))
        }}
        title="Eliminar proyecto"
        message={`Se eliminará «${deleting?.title}» de tu biblioteca y del disco, incluyendo sus snapshots y backups. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar definitivamente"
        danger
      />
    </div>
  )
}
