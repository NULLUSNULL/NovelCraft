import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  BookOpen,
  BookUp,
  Clock3,
  FilePlus2,
  FileText,
  Focus,
  History,
  LayoutDashboard,
  LayoutGrid,
  Library,
  MapPin,
  Network,
  NotebookPen,
  Package,
  PanelLeft,
  PanelRight,
  PenLine,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  X
} from 'lucide-react'
import type { AppView } from '@shared/types'
import {
  getManuscriptChapters,
  getManuscriptScenes,
  getNoteChildren
} from '@shared/project'
import { useAppStore } from '../../store/useAppStore'

interface CommandItem {
  id: string
  label: string
  sub?: string
  group: string
  icon: ReactNode
  shortcut?: string
  keywords?: string
  action: () => void
}

export function CommandPalette() {
  const open = useAppStore((state) => state.commandPaletteOpen)
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen)
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const settings = useAppStore((state) => state.settings)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  const commands = useMemo<CommandItem[]>(() => {
    const store = useAppStore.getState()
    const close = (): void => setOpen(false)
    const go = (view: AppView): void => {
      store.setView(view)
      close()
    }
    const commandsList: CommandItem[] = [
      {
        id: 'write',
        label: 'Ir al manuscrito',
        sub: 'Planifica y escribe',
        group: 'Navegación',
        icon: <PenLine size={15} />,
        shortcut: 'Alt 1',
        keywords: 'escribir editor escenas',
        action: () => go('write')
      },
      {
        id: 'dashboard',
        label: 'Vista general del proyecto',
        sub: 'Progreso y actividad reciente',
        group: 'Navegación',
        icon: <LayoutDashboard size={15} />,
        keywords: 'inicio dashboard resumen',
        action: () => {
          store.openDashboard()
          close()
        }
      },
      {
        id: 'codex',
        label: 'Abrir el codex',
        sub: 'Personajes, lugares e ítems',
        group: 'Navegación',
        icon: <UsersRound size={15} />,
        shortcut: 'Alt 2',
        keywords: 'enciclopedia fichas personajes mundo',
        action: () => go('codex')
      },
      {
        id: 'plots',
        label: 'Abrir el grafo de tramas',
        sub: 'Relaciones y cronología',
        group: 'Navegación',
        icon: <Network size={15} />,
        shortcut: 'Alt 3',
        keywords: 'argumento narrativa lineas',
        action: () => go('plots')
      },
      {
        id: 'publish',
        label: 'Compilar y publicar',
        sub: 'Exportar el manuscrito',
        group: 'Navegación',
        icon: <BookUp size={15} />,
        shortcut: 'Alt 4',
        keywords: 'pdf epub exportar imprimir',
        action: () => go('publish')
      },
      {
        id: 'library',
        label: 'Abrir la biblioteca',
        sub: 'Cambiar o crear un proyecto',
        group: 'Navegación',
        icon: <Library size={15} />,
        keywords: 'proyectos abrir biblioteca',
        action: () => {
          store.setProjectManagerOpen(true)
          close()
        }
      }
    ]

    if (project) {
      const selected = project.nodes[selectedDocumentId]
      const activeChapter = selected?.type === 'chapter' ? selected : selected?.type === 'scene' ? project.nodes[selected.parentId] : undefined
      commandsList.push(
        {
          id: 'save',
          label: 'Guardar proyecto ahora',
          group: 'Acciones',
          icon: <Save size={15} />,
          shortcut: 'Ctrl S',
          keywords: 'guardar disco',
          action: () => {
            void store.saveNow()
            close()
          }
        },
        {
          id: 'new-chapter',
          label: 'Nuevo capítulo',
          group: 'Acciones',
          icon: <FilePlus2 size={15} />,
          keywords: 'crear añadir capitulo',
          action: () => {
            store.addChapter()
            close()
          }
        },
        {
          id: 'new-scene',
          label: 'Nueva escena',
          sub: activeChapter?.title,
          group: 'Acciones',
          icon: <FileText size={15} />,
          keywords: 'crear añadir escena',
          action: () => {
            if (activeChapter) store.addScene(activeChapter.id)
            close()
          }
        },
        {
          id: 'new-note',
          label: 'Nueva nota de investigación',
          group: 'Acciones',
          icon: <NotebookPen size={15} />,
          keywords: 'crear nota research',
          action: () => {
            store.addNote()
            close()
          }
        },
        {
          id: 'new-plot',
          label: 'Nueva trama',
          group: 'Acciones',
          icon: <Plus size={15} />,
          keywords: 'crear argumento trama',
          action: () => {
            store.addPlot()
            close()
          }
        },
        {
          id: 'new-character',
          label: 'Nuevo personaje',
          group: 'Acciones',
          icon: <UserRound size={15} />,
          keywords: 'crear personaje codex',
          action: () => {
            store.addCharacter()
            close()
          }
        },
        {
          id: 'new-location',
          label: 'Nueva ubicación',
          group: 'Acciones',
          icon: <MapPin size={15} />,
          keywords: 'crear lugar codex ubicacion',
          action: () => {
            store.addLocation()
            close()
          }
        },
        {
          id: 'new-item',
          label: 'Nuevo ítem',
          group: 'Acciones',
          icon: <Package size={15} />,
          keywords: 'crear objeto codex item',
          action: () => {
            store.addItem()
            close()
          }
        },
        {
          id: 'history',
          label: 'Historial de versiones',
          sub: selected?.title,
          group: 'Herramientas',
          icon: <History size={15} />,
          keywords: 'snapshots versiones restaurar',
          action: () => {
            store.setSnapshotsOpen(true)
            close()
          }
        },
        {
          id: 'backups',
          label: 'Copias de seguridad',
          group: 'Herramientas',
          icon: <Clock3 size={15} />,
          keywords: 'backup zip restaurar',
          action: () => {
            store.setBackupManagerOpen(true)
            close()
          }
        },
        {
          id: 'trash',
          label: 'Abrir la papelera',
          sub: `${project.trash.length} ${project.trash.length === 1 ? 'documento' : 'documentos'} eliminados`,
          group: 'Herramientas',
          icon: <Trash2 size={15} />,
          keywords: 'papelera eliminar restaurar retención',
          action: () => {
            store.setTrashOpen(true)
            close()
          }
        },
        {
          id: 'focus',
          label: store.focusMode ? 'Salir del modo concentración' : 'Entrar en modo concentración',
          group: 'Herramientas',
          icon: <Focus size={15} />,
          shortcut: 'Ctrl ⇧ F',
          keywords: 'concentracion focus',
          action: () => {
            store.setFocusMode(!store.focusMode)
            close()
          }
        },
        {
          id: 'sidebar',
          label: store.sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral',
          group: 'Herramientas',
          icon: <PanelLeft size={15} />,
          keywords: 'sidebar barra',
          action: () => {
            store.setSidebarOpen(!store.sidebarOpen)
            close()
          }
        },
        {
          id: 'inspector',
          label: store.inspectorOpen ? 'Ocultar inspector' : 'Mostrar inspector',
          group: 'Herramientas',
          icon: <PanelRight size={15} />,
          keywords: 'inspector panel derecho',
          action: () => {
            store.setInspectorOpen(!store.inspectorOpen)
            close()
          }
        }
      )
      if (settings.ai.enabled) {
        commandsList.push({
          id: 'ai',
          label: 'Abrir el asistente literario',
          sub: settings.providers.find((provider) => provider.id === settings.ai.activeProviderId)?.name,
          group: 'Herramientas',
          icon: <Sparkles size={15} />,
          shortcut: 'Ctrl ⇧ A',
          keywords: 'ia inteligencia chat modelo',
          action: () => {
            if (store.view !== 'write') store.setView('write')
            store.setInspectorOpen(true)
            store.setInspectorTab('ai')
            close()
          }
        })
      }

      const documents = [
        ...getManuscriptChapters(project),
        ...getManuscriptScenes(project),
        ...getNoteChildren(project)
      ]
      for (const node of documents) {
        commandsList.push({
          id: `doc-${node.id}`,
          label: node.title,
          sub: node.type === 'chapter' ? 'Capítulo' : node.type === 'note' ? 'Nota' : project.nodes[node.parentId]?.title || 'Escena',
          group: 'Documentos',
          icon: node.type === 'chapter' ? <BookOpen size={15} /> : node.type === 'note' ? <NotebookPen size={15} /> : <FileText size={15} />,
          keywords: `${node.summary} ${node.tags.join(' ')}`,
          action: () => {
            store.selectDocument(node.id)
            close()
          }
        })
      }

      for (const character of project.characters) {
        commandsList.push({
          id: `character-${character.id}`,
          label: character.name,
          sub: character.role || 'Personaje',
          group: 'Codex',
          icon: <UserRound size={15} />,
          keywords: character.tags.join(' '),
          action: () => {
            store.selectEntity('character', character.id)
            close()
          }
        })
      }
      for (const location of project.locations) {
        commandsList.push({
          id: `location-${location.id}`,
          label: location.name,
          sub: location.type || 'Ubicación',
          group: 'Codex',
          icon: <MapPin size={15} />,
          keywords: location.tags.join(' '),
          action: () => {
            store.selectEntity('location', location.id)
            close()
          }
        })
      }
      for (const item of project.items) {
        commandsList.push({
          id: `item-${item.id}`,
          label: item.name,
          sub: item.type || 'Ítem',
          group: 'Codex',
          icon: <Package size={15} />,
          keywords: item.tags.join(' '),
          action: () => {
            store.selectEntity('item', item.id)
            close()
          }
        })
      }
      for (const plot of project.plots) {
        commandsList.push({
          id: `plot-${plot.id}`,
          label: plot.title,
          sub: `${plot.type} · ${plot.sceneIds.length} escenas`,
          group: 'Tramas',
          icon: <Network size={15} />,
          keywords: `${plot.summary} ${plot.tags.join(' ')}`,
          action: () => {
            store.selectPlot(plot.id)
            store.setView('plots')
            close()
          }
        })
      }
    }

    commandsList.push({
      id: 'settings',
      label: 'Abrir ajustes',
      group: 'Sistema',
      icon: <Settings size={15} />,
      shortcut: 'Ctrl ,',
      keywords: 'preferencias configuracion',
      action: () => {
        store.setSettingsOpen(true)
        close()
      }
    })
    commandsList.push({
      id: 'projects',
      label: 'Gestionar proyectos',
      group: 'Sistema',
      icon: <LayoutGrid size={15} />,
      keywords: 'biblioteca proyectos abrir',
      action: () => {
        store.setProjectManagerOpen(true)
        close()
      }
    })

    return commandsList
  }, [project, selectedDocumentId, setOpen, settings])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return commands.slice(0, 18)
    return commands
      .filter((command) => `${command.label} ${command.sub || ''} ${command.group} ${command.keywords || ''}`.toLowerCase().includes(normalized))
      .slice(0, 40)
  }, [commands, query])

  useEffect(() => {
    setActive((current) => Math.max(0, Math.min(current, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const grouped: Array<{ group: string; items: CommandItem[] }> = []
  for (const item of filtered) {
    const last = grouped[grouped.length - 1]
    if (last?.group === item.group) last.items.push(item)
    else grouped.push({ group: item.group, items: [item] })
  }

  let flatIndex = -1

  return createPortal(
    <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="command-input-row">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca documentos, personajes o comandos..."
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((current) => Math.min(filtered.length - 1, current + 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((current) => Math.max(0, current - 1))
              }
              if (event.key === 'Enter' && filtered[active]) {
                event.preventDefault()
                filtered[active].action()
              }
              if (event.key === 'Escape') setOpen(false)
            }}
          />
          {query ? (
            <button className="icon-btn sm" onClick={() => setQuery('')} title="Limpiar búsqueda"><X size={14} /></button>
          ) : (
            <span className="kbd">Esc</span>
          )}
        </div>
        <div className="command-results" ref={listRef}>
          {grouped.map((section) => (
            <div className="command-group" key={section.group}>
              <div className="command-group-label">{section.group}</div>
              {section.items.map((item) => {
                flatIndex += 1
                const index = flatIndex
                return (
                  <button
                    key={item.id}
                    data-index={index}
                    className={`command-item ${active === index ? 'active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={item.action}
                  >
                    <span className="command-icon">{item.icon}</span>
                    <span className="command-text">
                      <span>{item.label}</span>
                      {item.sub && <small>{item.sub}</small>}
                    </span>
                    {item.shortcut && <span className="kbd">{item.shortcut}</span>}
                    {active === index && <ArrowDown size={12} className="command-enter" />}
                  </button>
                )
              })}
            </div>
          ))}
          {!filtered.length && (
            <div className="command-empty">
              <Search size={22} />
              <p>No hay resultados para «{query}».</p>
              <span>Prueba con otro título, personaje o acción.</span>
            </div>
          )}
        </div>
        <div className="command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
          <span className="grow" />
          <span>{filtered.length} resultados</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
