import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Draft } from 'immer'
import type {
  AiProvider,
  AppInfo,
  AppSettings,
  AppView,
  Character,
  CreateProjectInput,
  DocumentNode,
  EntityKind,
  ID,
  LibraryEntry,
  Location,
  Plot,
  PlotEdge,
  Project,
  ProjectUpdateInput,
  WorldItem
} from '@shared/types'
import { MANUSCRIPT_ID, RESEARCH_ID } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import {
  countWords,
  createDemoProject,
  createDocument,
  createProject,
  formatNumber,
  getChapterScenes,
  getManuscriptChapters,
  getNextOrder,
  getNoteChildren,
  makeId,
  nowIso
} from '@shared/project'
import { emptyCharacter, emptyItem, emptyLocation, emptyPlot, emptyPlotEdge } from '../lib/factories'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

export interface SelectedEntity {
  kind: Exclude<EntityKind, never>
  id: ID
}

export type InspectorTab = 'scene' | 'ai'

interface AppState {
  booted: boolean
  bootError: string
  project: Project | null
  library: LibraryEntry[]
  settings: AppSettings
  appInfo: AppInfo | null
  view: AppView
  selectedDocumentId: ID
  selectedEntity: SelectedEntity | null
  codexCategory: EntityKind
  selectedPlotId: ID
  selectedEdgeId: ID
  sidebarOpen: boolean
  inspectorOpen: boolean
  inspectorTab: InspectorTab
  focusMode: boolean
  projectManagerOpen: boolean
  settingsOpen: boolean
  commandPaletteOpen: boolean
  snapshotsOpen: boolean
  backupManagerOpen: boolean
  trashOpen: boolean
  saveStatus: SaveStatus
  saveError: string
  savedAt: string
  settingsDirty: boolean
  revision: number
  toasts: ToastItem[]
  collapsedChapters: Record<string, boolean>
  bootstrap: () => Promise<void>
  refreshLibrary: () => Promise<void>
  createProjectFromInput: (input: CreateProjectInput) => Promise<void>
  updateProjectFromInput: (projectId: ID, input: ProjectUpdateInput) => Promise<void>
  createDemo: () => Promise<void>
  openProjectById: (id: string) => Promise<void>
  closeProject: () => Promise<void>
  deleteProjectById: (id: string) => Promise<void>
  importProject: () => Promise<void>
  setView: (view: AppView) => void
  selectDocument: (id: ID, options?: { selectChapter?: boolean }) => void
  openDashboard: () => void
  selectEntity: (kind: EntityKind, id: ID) => void
  setCodexCategory: (kind: EntityKind) => void
  selectPlot: (id: ID) => void
  selectEdge: (id: ID) => void
  setSidebarOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  setInspectorTab: (tab: InspectorTab) => void
  setFocusMode: (focus: boolean) => void
  setProjectManagerOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSnapshotsOpen: (open: boolean) => void
  setBackupManagerOpen: (open: boolean) => void
  setTrashOpen: (open: boolean) => void
  toggleChapter: (id: ID) => void
  mutateProject: (mutator: (draft: Draft<Project>) => void) => void
  updateNode: (id: ID, patch: Partial<DocumentNode>) => void
  updateNodeContent: (id: ID, content: string, wordCount: number) => void
  addChapter: () => ID | null
  addScene: (chapterId: ID) => ID | null
  addNote: () => ID | null
  duplicateNode: (id: ID) => void
  deleteNode: (id: ID) => void
  restoreTrashEntry: (id: ID) => void
  deleteTrashEntry: (id: ID) => void
  emptyTrash: () => void
  moveNode: (id: ID, parentId: ID, index: number) => void
  updateProjectMeta: (patch: Partial<Project>) => void
  addCharacter: () => void
  updateCharacter: (id: ID, patch: Partial<Character>) => void
  deleteCharacter: (id: ID) => void
  addLocation: () => void
  updateLocation: (id: ID, patch: Partial<Location>) => void
  deleteLocation: (id: ID) => void
  addItem: () => void
  updateItem: (id: ID, patch: Partial<WorldItem>) => void
  deleteItem: (id: ID) => void
  addPlot: () => void
  updatePlot: (id: ID, patch: Partial<Plot>) => void
  deletePlot: (id: ID) => void
  addPlotEdge: (source: ID, target: ID) => void
  updatePlotEdge: (id: ID, patch: Partial<PlotEdge>) => void
  deletePlotEdge: (id: ID) => void
  updateSettings: (updater: (draft: Draft<AppSettings>) => void) => void
  saveSettingsNow: () => Promise<void>
  replaceProvider: (provider: AiProvider) => void
  removeProvider: (id: ID) => void
  saveNow: () => Promise<void>
  setProjectFromBackup: (project: Project) => void
  pushToast: (message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
  markDirty: () => void
}

const fallbackSettings = structuredClone(DEFAULT_SETTINGS)

export function normalizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/^Error invoking remote method '[^']+': Error: /, '')
    .replace(/^Error: /, '')
}

function nextDocumentTitle(project: Project, parentId: ID, prefix: string): string {
  const siblings = Object.values(project.nodes).filter((node) => node.parentId === parentId)
  return `${prefix} ${siblings.length + 1}`
}

function selectFallbackDocument(project: Project): ID {
  const chapters = getManuscriptChapters(project)
  const firstScene = chapters.length ? getChapterScenes(project, chapters[0].id)[0] : undefined
  return firstScene?.id || chapters[0]?.id || getNoteChildren(project)[0]?.id || ''
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}

function reindexSiblings(project: Draft<Project>, parentId: ID): void {
  sortByOrder(
    Object.values(project.nodes).filter((node) => node.parentId === parentId) as Draft<DocumentNode>[]
  ).forEach((node, index) => {
    node.order = index
  })
}

function ensureSelectionAfterDelete(state: Draft<AppState>, project: Draft<Project>): void {
  if (state.selectedDocumentId && !project.nodes[state.selectedDocumentId]) {
    state.selectedDocumentId = selectFallbackDocument(project as Project)
  }
  if (!project.nodes[state.selectedDocumentId]) state.selectedDocumentId = ''
  if (state.selectedPlotId && !project.plots.some((plot) => plot.id === state.selectedPlotId)) {
    state.selectedPlotId = project.plots[0]?.id || ''
  }
  if (state.selectedEntity) {
    const exists =
      (state.selectedEntity.kind === 'character' &&
        project.characters.some((entity) => entity.id === state.selectedEntity?.id)) ||
      (state.selectedEntity.kind === 'location' &&
        project.locations.some((entity) => entity.id === state.selectedEntity?.id)) ||
      (state.selectedEntity.kind === 'item' &&
        project.items.some((entity) => entity.id === state.selectedEntity?.id))
    if (!exists) state.selectedEntity = null
  }
}

function setDirtyState(state: Draft<AppState>): void {
  state.revision += 1
  state.saveStatus = 'dirty'
  state.saveError = ''
  window.novelcraft.setWindowDirty(true)
}

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    booted: false,
    bootError: '',
    project: null,
    library: [],
    settings: structuredClone(fallbackSettings),
    appInfo: null,
    view: 'write',
    selectedDocumentId: '',
    selectedEntity: null,
    codexCategory: 'character',
    selectedPlotId: '',
    selectedEdgeId: '',
    sidebarOpen: true,
    inspectorOpen: true,
    inspectorTab: 'scene',
    focusMode: false,
    projectManagerOpen: false,
    settingsOpen: false,
    commandPaletteOpen: false,
    snapshotsOpen: false,
    backupManagerOpen: false,
    trashOpen: false,
    saveStatus: 'idle',
    saveError: '',
    savedAt: '',
    settingsDirty: false,
    revision: 0,
    toasts: [],
    collapsedChapters: {},

    bootstrap: async () => {
      try {
        const [settings, appInfo, library] = await Promise.all([
          window.novelcraft.getSettings(),
          window.novelcraft.getAppInfo(),
          window.novelcraft.listProjects()
        ])
        set((state) => {
          state.settings = settings
          state.appInfo = appInfo
          state.library = library
          state.booted = true
        })
        const recent = [...library].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))[0]
        if (settings.general.reopenLastProject && recent) {
          await get().openProjectById(recent.id)
        } else {
          set((state) => {
            state.projectManagerOpen = true
          })
        }
      } catch (error) {
        set((state) => {
          state.bootError = normalizeError(error)
          state.booted = true
          state.projectManagerOpen = true
        })
      }
    },

    refreshLibrary: async () => {
      const library = await window.novelcraft.listProjects()
      set((state) => {
        state.library = library
      })
    },

    createProjectFromInput: async (input) => {
      const project = createProject(input)
      const entry = await window.novelcraft.createProject(project)
      set((state) => {
        state.library = [entry, ...state.library.filter((item) => item.id !== entry.id)]
        state.project = project
        state.projectManagerOpen = false
        state.view = 'write'
        state.selectedDocumentId = project.lastDocumentId || selectFallbackDocument(project)
        state.selectedEntity = null
        state.selectedPlotId = project.plots[0]?.id || ''
        state.saveStatus = 'saved'
        state.savedAt = nowIso()
        state.revision = 0
        state.inspectorTab = 'scene'
      })
      get().pushToast('Proyecto creado. Tu historia empieza aquí.', 'success')
    },

    updateProjectFromInput: async (projectId, input) => {
      const clean: ProjectUpdateInput = {
        ...input,
        title: input.title.trim() || 'Novela sin título',
        author: input.author.trim(),
        wordGoal: Math.max(0, Number(input.wordGoal) || 80000),
        targetDate: input.targetDate || ''
      }
      if (get().project?.id === projectId) {
        get().updateProjectMeta(clean)
        await get().saveNow()
        if (get().saveStatus === 'error') return
      } else {
        const project = await window.novelcraft.getProject(projectId)
        await window.novelcraft.saveProject({
          ...project,
          ...clean,
          updatedAt: nowIso()
        })
        const library = await window.novelcraft.listProjects()
        set((state) => {
          state.library = library
        })
      }
      get().pushToast('Proyecto actualizado.', 'success')
    },

    createDemo: async () => {
      const project = createDemoProject()
      const entry = await window.novelcraft.createProject(project)
      set((state) => {
        state.library = [entry, ...state.library.filter((item) => item.id !== entry.id)]
        state.project = project
        state.projectManagerOpen = false
        state.view = 'write'
        state.selectedDocumentId = project.lastDocumentId || selectFallbackDocument(project)
        state.selectedEntity = null
        state.selectedPlotId = project.plots[0]?.id || ''
        state.saveStatus = 'saved'
        state.savedAt = nowIso()
        state.revision = 0
      })
      get().pushToast('Proyecto de ejemplo abierto.', 'success')
    },

    openProjectById: async (id) => {
      try {
        const project = await window.novelcraft.openProject(id)
        const library = await window.novelcraft.listProjects()
        set((state) => {
          state.project = project
          state.library = library
          state.projectManagerOpen = false
          state.selectedDocumentId = project.nodes[project.lastDocumentId]?.id || selectFallbackDocument(project)
          state.selectedEntity = null
          state.selectedPlotId = project.plots[0]?.id || ''
          state.selectedEdgeId = ''
          state.view = 'write'
          state.saveStatus = 'saved'
          state.savedAt = project.updatedAt
          state.revision = 0
          state.saveError = ''
        })
      } catch (error) {
        get().pushToast(normalizeError(error), 'error')
      }
    },

    closeProject: async () => {
      if (get().saveStatus === 'dirty' || get().saveStatus === 'saving') await get().saveNow()
      set((state) => {
        state.project = null
        state.projectManagerOpen = true
        state.selectedDocumentId = ''
        state.selectedEntity = null
        state.saveStatus = 'idle'
        state.sidebarOpen = true
        state.focusMode = false
      })
    },

    deleteProjectById: async (id) => {
      await window.novelcraft.deleteProject(id)
      set((state) => {
        state.library = state.library.filter((entry) => entry.id !== id)
        if (state.project?.id === id) {
          state.project = null
          state.projectManagerOpen = true
          state.selectedDocumentId = ''
        }
      })
      get().pushToast('Proyecto eliminado.', 'info')
    },

    importProject: async () => {
      try {
        const entry = await window.novelcraft.importProject()
        if (entry) {
          await get().refreshLibrary()
          get().pushToast('Proyecto importado correctamente.', 'success')
          await get().openProjectById(entry.id)
        }
      } catch (error) {
        get().pushToast(normalizeError(error), 'error')
      }
    },

    setView: (view) => {
      set((state) => {
        state.view = view
        state.sidebarOpen = true
        state.focusMode = false
        if (view === 'codex' && !state.selectedEntity && state.project) {
          const preferred = state.codexCategory
          const list = preferred === 'character' ? state.project.characters : preferred === 'location' ? state.project.locations : state.project.items
          const first = list[0]
          if (first) state.selectedEntity = { kind: preferred, id: first.id }
        }
        if (view === 'plots' && !state.selectedPlotId && state.project) {
          state.selectedPlotId = state.project.plots[0]?.id || ''
        }
        if (view === 'write' && !state.selectedDocumentId && state.project) {
          state.selectedDocumentId = selectFallbackDocument(state.project)
        }
      })
    },

    selectDocument: (id, options) => {
      const project = get().project
      if (!project?.nodes[id]) return
      const node = project.nodes[id]
      const targetId = options?.selectChapter && node.type === 'scene' ? node.parentId : id
      set((state) => {
        state.selectedDocumentId = targetId
        state.view = 'write'
        state.selectedEntity = null
        state.inspectorTab = 'scene'
        if (state.project) {
          state.project.lastDocumentId = targetId
          state.project.updatedAt = nowIso()
        }
      })
      const target = project.nodes[targetId]
      if (target.type === 'scene' || target.type === 'note') get().markDirty()
    },

    openDashboard: () => {
      set((state) => {
        state.selectedDocumentId = ''
        state.view = 'write'
        state.selectedEntity = null
        state.inspectorTab = 'scene'
      })
    },

    selectEntity: (kind, id) => {
      set((state) => {
        state.selectedEntity = { kind, id }
        state.codexCategory = kind
        state.view = 'codex'
      })
    },

    setCodexCategory: (kind) => {
      set((state) => {
        state.codexCategory = kind
        if (!state.project) return
        const list = kind === 'character' ? state.project.characters : kind === 'location' ? state.project.locations : state.project.items
        state.selectedEntity = list[0] ? { kind, id: list[0].id } : null
        state.view = 'codex'
      })
    },

    selectPlot: (id) => {
      set((state) => {
        state.selectedPlotId = id
        state.selectedEdgeId = ''
      })
    },

    selectEdge: (id) => {
      set((state) => {
        state.selectedEdgeId = id
      })
    },

    setSidebarOpen: (open) => set((state) => void (state.sidebarOpen = open)),
    setInspectorOpen: (open) => set((state) => void (state.inspectorOpen = open)),
    setInspectorTab: (tab) => set((state) => void (state.inspectorTab = tab)),
    setFocusMode: (focus) =>
      set((state) => {
        state.focusMode = focus
        if (focus) state.inspectorOpen = false
        else state.inspectorOpen = true
      }),
    setProjectManagerOpen: (open) => set((state) => void (state.projectManagerOpen = open)),
    setSettingsOpen: (open) => set((state) => void (state.settingsOpen = open)),
    setCommandPaletteOpen: (open) => set((state) => void (state.commandPaletteOpen = open)),
    setSnapshotsOpen: (open) => set((state) => void (state.snapshotsOpen = open)),
    setBackupManagerOpen: (open) => set((state) => void (state.backupManagerOpen = open)),
    setTrashOpen: (open) => {
      if (open) {
        const project = get().project
        const retentionDays = get().settings.backups.trashRetentionDays
        if (project && retentionDays > 0 && project.trash.length) {
          const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
          const next = project.trash.filter((entry) => {
            const deletedAt = new Date(entry.deletedAt).getTime()
            return Number.isFinite(deletedAt) && deletedAt >= cutoff
          })
          if (next.length !== project.trash.length) {
            get().mutateProject((draft) => {
              draft.trash = next
            })
          }
        }
      }
      set((state) => void (state.trashOpen = open))
    },
    toggleChapter: (id) =>
      set((state) => {
        state.collapsedChapters[id] = !state.collapsedChapters[id]
      }),

    mutateProject: (mutator) => {
      set((state) => {
        if (!state.project) return
        mutator(state.project)
        state.project.updatedAt = nowIso()
        setDirtyState(state)
      })
    },

    updateNode: (id, patch) => {
      get().mutateProject((project) => {
        const node = project.nodes[id]
        if (!node) return
        Object.assign(node, patch)
        if (patch.content !== undefined) node.wordCount = countWords(patch.content)
        node.updatedAt = nowIso()
      })
    },

    updateNodeContent: (id, content, wordCount) => {
      get().mutateProject((project) => {
        const node = project.nodes[id]
        if (!node || node.content === content) return
        node.content = content
        node.wordCount = wordCount
        node.updatedAt = nowIso()
      })
    },

    addChapter: () => {
      const project = get().project
      if (!project) return null
      const chapter = createDocument('chapter', MANUSCRIPT_ID, nextDocumentTitle(project, MANUSCRIPT_ID, 'Capítulo'), getNextOrder(project, MANUSCRIPT_ID))
      set((state) => {
        if (!state.project) return
        state.project.nodes[chapter.id] = chapter
        state.project.updatedAt = nowIso()
        state.selectedDocumentId = chapter.id
        state.view = 'write'
        state.inspectorTab = 'scene'
        state.project.lastDocumentId = chapter.id
        setDirtyState(state)
      })
      return chapter.id
    },

    addScene: (chapterId) => {
      const project = get().project
      if (!project?.nodes[chapterId]) return null
      const scene = createDocument('scene', chapterId, nextDocumentTitle(project, chapterId, 'Escena'), getNextOrder(project, chapterId), {
        status: 'draft'
      })
      set((state) => {
        if (!state.project) return
        state.project.nodes[scene.id] = scene
        state.project.updatedAt = nowIso()
        state.selectedDocumentId = scene.id
        state.inspectorTab = 'scene'
        state.project.lastDocumentId = scene.id
        setDirtyState(state)
      })
      return scene.id
    },

    addNote: () => {
      const project = get().project
      if (!project) return null
      const note = createDocument('note', RESEARCH_ID, nextDocumentTitle(project, RESEARCH_ID, 'Nota'), getNextOrder(project, RESEARCH_ID), {
        noteColor: '#82a58d',
        content: '<p></p>'
      })
      set((state) => {
        if (!state.project) return
        state.project.nodes[note.id] = note
        state.project.updatedAt = nowIso()
        state.selectedDocumentId = note.id
        state.view = 'write'
        state.inspectorTab = 'scene'
        state.project.lastDocumentId = note.id
        setDirtyState(state)
      })
      return note.id
    },

    duplicateNode: (id) => {
      const project = get().project
      if (!project) return
      const source = project.nodes[id]
      if (!source) return
      const timestamp = nowIso()
      const duplicatedIds: ID[] = []
      set((state) => {
        if (!state.project) return
        const original = state.project.nodes[id]
        const copy = structuredClone(original)
        copy.id = crypto.randomUUID ? `doc_${crypto.randomUUID()}` : `doc_${Date.now()}`
        copy.title = `${original.title} (copia)`
        copy.createdAt = timestamp
        copy.updatedAt = timestamp
        copy.order = original.order + 0.5
        state.project.nodes[copy.id] = copy
        duplicatedIds.push(copy.id)
        if (original.type === 'chapter') {
          const children = Object.values(state.project.nodes)
            .filter((node) => node.parentId === original.id && node.type === 'scene')
            .sort((a, b) => a.order - b.order)
          children.forEach((child, index) => {
            if (!state.project) return
            const childCopy = structuredClone(child)
            childCopy.id = crypto.randomUUID ? `doc_${crypto.randomUUID()}` : `doc_${Date.now()}_${index}`
            childCopy.parentId = copy.id
            childCopy.order = index
            childCopy.createdAt = timestamp
            childCopy.updatedAt = timestamp
            state.project.nodes[childCopy.id] = childCopy
          })
        }
        reindexSiblings(state.project, original.parentId)
        state.selectedDocumentId = copy.id
        state.project.lastDocumentId = copy.id
        state.project.updatedAt = timestamp
        setDirtyState(state)
      })
      if (duplicatedIds.length) get().pushToast('Documento duplicado.', 'success')
    },

    deleteNode: (id) => {
      const project = get().project
      if (!project) return
      const node = project.nodes[id]
      if (!node) return
      const toDelete = new Set<ID>([id])
      if (node.type === 'chapter') {
        for (const scene of getChapterScenes(project, id)) toDelete.add(scene.id)
      }
      const trashNodes = [...toDelete]
        .map((nodeId) => project.nodes[nodeId])
        .filter((candidate): candidate is DocumentNode => Boolean(candidate))
        .map((candidate) => structuredClone(candidate))
      const deletedAt = nowIso()
      set((state) => {
        if (!state.project) return
        const parent = state.project.nodes[id]?.parentId
        const title = state.project.nodes[id]?.title || 'Documento'
        for (const deletedId of toDelete) delete state.project.nodes[deletedId]
        for (const plot of state.project.plots) {
          plot.sceneIds = plot.sceneIds.filter((sceneId) => !toDelete.has(sceneId))
        }
        state.project.trash = state.project.trash || []
        state.project.trash.unshift({
          id: makeId('trash'),
          kind: node.type,
          title,
          deletedAt,
          parentId: parent || '',
          order: node.order,
          nodes: trashNodes
        })
        if (parent) reindexSiblings(state.project, parent)
        state.project.updatedAt = deletedAt
        ensureSelectionAfterDelete(state, state.project)
        state.project.lastDocumentId = state.selectedDocumentId
        setDirtyState(state)
        state.toasts.push({
          id: `toast_${Date.now()}`,
          message: `«${title}» movido a la papelera.`,
          tone: 'info'
        })
      })
    },

    restoreTrashEntry: (id) => {
      const project = get().project
      const entry = project?.trash.find((item) => item.id === id)
      if (!project || !entry) return
      if (
        entry.parentId &&
        entry.parentId !== MANUSCRIPT_ID &&
        entry.parentId !== RESEARCH_ID &&
        !project.nodes[entry.parentId]
      ) {
        get().pushToast('No se puede restaurar: el documento contenedor ya no existe.', 'error')
        return
      }
      set((state) => {
        if (!state.project) return
        const current = state.project
        for (const node of entry.nodes) {
          current.nodes[node.id] = structuredClone(node)
        }
        for (const node of entry.nodes) {
          if (node.type !== 'scene') continue
          for (const plotId of node.plotIds) {
            const plot = current.plots.find((item) => item.id === plotId)
            if (plot && !plot.sceneIds.includes(node.id)) plot.sceneIds.push(node.id)
          }
        }
        current.trash = current.trash.filter((item) => item.id !== id)
        if (entry.parentId) reindexSiblings(current, entry.parentId)
        current.updatedAt = nowIso()
        state.selectedDocumentId = entry.nodes[0]?.id || state.selectedDocumentId
        current.lastDocumentId = state.selectedDocumentId
        state.view = 'write'
        setDirtyState(state)
      })
      get().pushToast(`«${entry.title}» restaurado.`, 'success')
    },

    deleteTrashEntry: (id) => {
      let removed = false
      set((state) => {
        if (!state.project) return
        const before = state.project.trash.length
        state.project.trash = state.project.trash.filter((entry) => entry.id !== id)
        if (state.project.trash.length === before) return
        removed = true
        state.project.updatedAt = nowIso()
        setDirtyState(state)
      })
      if (removed) get().pushToast('Documento eliminado definitivamente.', 'success')
    },

    emptyTrash: () => {
      let emptied = false
      set((state) => {
        if (!state.project || !state.project.trash.length) return
        state.project.trash = []
        emptied = true
        state.project.updatedAt = nowIso()
        setDirtyState(state)
      })
      if (emptied) get().pushToast('Papelera vaciada.', 'success')
    },

    moveNode: (id, parentId, index) => {
      const project = get().project
      if (!project) return
      const node = project.nodes[id]
      if (!node) return
      const parent = project.nodes[parentId]
      if (node.type === 'chapter' && parentId !== MANUSCRIPT_ID) return
      if (node.type === 'note' && parentId !== RESEARCH_ID) return
      if (node.type === 'scene' && (!parent || parent.type !== 'chapter')) return
      if (node.type === 'chapter' && parentId === id) return
      set((state) => {
        if (!state.project) return
        const moving = state.project.nodes[id]
        if (!moving) return
        const oldParent = moving.parentId
        const siblings = sortByOrder(
          Object.values(state.project.nodes).filter(
            (candidate) => candidate.parentId === parentId && candidate.id !== id
          ) as Draft<DocumentNode>[]
        )
        const safeIndex = Math.max(0, Math.min(index, siblings.length))
        siblings.splice(safeIndex, 0, moving)
        moving.parentId = parentId
        siblings.forEach((sibling, position) => {
          sibling.order = position
        })
        if (oldParent !== parentId) reindexSiblings(state.project, oldParent)
        state.project.updatedAt = nowIso()
        setDirtyState(state)
      })
    },

    updateProjectMeta: (patch) => {
      get().mutateProject((project) => {
        Object.assign(project, patch)
      })
    },

    addCharacter: () => {
      const character = emptyCharacter()
      set((state) => {
        if (!state.project) return
        state.project.characters.unshift(character)
        state.selectedEntity = { kind: 'character', id: character.id }
        state.codexCategory = 'character'
        state.selectedPlotId = ''
        state.selectedDocumentId = ''
        state.view = 'codex'
        setDirtyState(state)
      })
    },

    updateCharacter: (id, patch) => {
      get().mutateProject((project) => {
        const character = project.characters.find((entity) => entity.id === id)
        if (!character) return
        Object.assign(character, patch)
        character.updatedAt = nowIso()
      })
    },

    deleteCharacter: (id) => {
      set((state) => {
        if (!state.project) return
        state.project.characters = state.project.characters.filter((entity) => entity.id !== id)
        for (const scene of Object.values(state.project.nodes)) {
          scene.characterIds = scene.characterIds.filter((characterId) => characterId !== id)
          if (scene.pov === id) scene.pov = ''
        }
        for (const plot of state.project.plots) {
          plot.characterIds = plot.characterIds.filter((characterId) => characterId !== id)
        }
        for (const item of state.project.items) {
          if (item.currentHolderId === id) item.currentHolderId = ''
        }
        for (const character of state.project.characters) {
          character.relationships = character.relationships.filter((relationship) => relationship.characterId !== id)
        }
        ensureSelectionAfterDelete(state, state.project)
        setDirtyState(state)
      })
    },

    addLocation: () => {
      const location = emptyLocation()
      set((state) => {
        if (!state.project) return
        state.project.locations.unshift(location)
        state.selectedEntity = { kind: 'location', id: location.id }
        state.codexCategory = 'location'
        state.selectedDocumentId = ''
        state.view = 'codex'
        setDirtyState(state)
      })
    },

    updateLocation: (id, patch) => {
      get().mutateProject((project) => {
        const location = project.locations.find((entity) => entity.id === id)
        if (!location) return
        Object.assign(location, patch)
        location.updatedAt = nowIso()
      })
    },

    deleteLocation: (id) => {
      set((state) => {
        if (!state.project) return
        state.project.locations = state.project.locations.filter((entity) => entity.id !== id)
        for (const scene of Object.values(state.project.nodes)) {
          if (scene.locationId === id) scene.locationId = ''
        }
        for (const item of state.project.items) {
          if (item.locationId === id) item.locationId = ''
        }
        ensureSelectionAfterDelete(state, state.project)
        setDirtyState(state)
      })
    },

    addItem: () => {
      const item = emptyItem()
      set((state) => {
        if (!state.project) return
        state.project.items.unshift(item)
        state.selectedEntity = { kind: 'item', id: item.id }
        state.codexCategory = 'item'
        state.selectedDocumentId = ''
        state.view = 'codex'
        setDirtyState(state)
      })
    },

    updateItem: (id, patch) => {
      get().mutateProject((project) => {
        const item = project.items.find((entity) => entity.id === id)
        if (!item) return
        Object.assign(item, patch)
        item.updatedAt = nowIso()
      })
    },

    deleteItem: (id) => {
      set((state) => {
        if (!state.project) return
        state.project.items = state.project.items.filter((entity) => entity.id !== id)
        for (const scene of Object.values(state.project.nodes)) {
          scene.itemIds = scene.itemIds.filter((itemId) => itemId !== id)
        }
        ensureSelectionAfterDelete(state, state.project)
        setDirtyState(state)
      })
    },

    addPlot: () => {
      const plot = emptyPlot(get().project?.plots.length || 0)
      set((state) => {
        if (!state.project) return
        state.project.plots.push(plot)
        state.selectedPlotId = plot.id
        state.selectedEdgeId = ''
        state.selectedEntity = null
        state.selectedDocumentId = ''
        state.view = 'plots'
        setDirtyState(state)
      })
    },

    updatePlot: (id, patch) => {
      get().mutateProject((project) => {
        const plot = project.plots.find((entity) => entity.id === id)
        if (!plot) return
        Object.assign(plot, patch)
        plot.updatedAt = nowIso()
      })
    },

    deletePlot: (id) => {
      set((state) => {
        if (!state.project) return
        state.project.plots = state.project.plots.filter((plot) => plot.id !== id)
        state.project.plotEdges = state.project.plotEdges.filter(
          (edge) => edge.source !== id && edge.target !== id
        )
        for (const scene of Object.values(state.project.nodes)) {
          scene.plotIds = scene.plotIds.filter((plotId) => plotId !== id)
        }
        ensureSelectionAfterDelete(state, state.project)
        setDirtyState(state)
      })
    },

    addPlotEdge: (source, target) => {
      if (source === target) return
      set((state) => {
        if (!state.project) return
        if (state.project.plotEdges.some((edge) => edge.source === source && edge.target === target)) return
        state.project.plotEdges.push(emptyPlotEdge(source, target))
        state.selectedEdgeId = state.project.plotEdges[state.project.plotEdges.length - 1].id
        setDirtyState(state)
      })
    },

    updatePlotEdge: (id, patch) => {
      get().mutateProject((project) => {
        const edge = project.plotEdges.find((item) => item.id === id)
        if (!edge) return
        Object.assign(edge, patch)
      })
    },

    deletePlotEdge: (id) => {
      set((state) => {
        if (!state.project) return
        state.project.plotEdges = state.project.plotEdges.filter((edge) => edge.id !== id)
        state.selectedEdgeId = ''
        setDirtyState(state)
      })
    },

    updateSettings: (updater) => {
      set((state) => {
        updater(state.settings)
        state.settingsDirty = true
      })
    },

    replaceProvider: (provider) => {
      set((state) => {
        const index = state.settings.providers.findIndex((item) => item.id === provider.id)
        if (index >= 0) state.settings.providers[index] = provider
        else state.settings.providers.push(provider)
        state.settingsDirty = true
      })
    },

    removeProvider: (id) => {
      set((state) => {
        state.settings.providers = state.settings.providers.filter((provider) => provider.id !== id)
        if (state.settings.ai.activeProviderId === id) {
          state.settings.ai.activeProviderId = state.settings.providers[0]?.id || ''
        }
        state.settingsDirty = true
      })
    },

    saveSettingsNow: async () => {
      try {
        const saved = await window.novelcraft.saveSettings(get().settings)
        set((state) => {
          state.settings = saved
          state.settingsDirty = false
        })
      } catch (error) {
        get().pushToast(normalizeError(error), 'error')
      }
    },

    saveNow: async () => {
      const { project, revision } = get()
      if (!project) return
      set((state) => {
        state.saveStatus = 'saving'
        state.saveError = ''
      })
      try {
        const result = await window.novelcraft.saveProject(project)
        set((state) => {
          state.library = state.library.map((entry) =>
            entry.id === project.id
              ? {
                  ...entry,
                  title: project.title,
                  author: project.author,
                  genre: project.genre,
                  coverColor: project.coverColor,
                  coverImage: project.coverImage || ''
                }
              : entry
          )
          if (state.revision === revision) {
            state.saveStatus = 'saved'
            state.savedAt = result.savedAt
            state.revision = 0
            state.saveError = ''
            window.novelcraft.setWindowDirty(false)
          } else {
            state.saveStatus = 'dirty'
          }
        })
      } catch (error) {
        set((state) => {
          state.saveStatus = 'error'
          state.saveError = normalizeError(error)
        })
        get().pushToast(`No se pudo guardar: ${normalizeError(error)}`, 'error')
      }
    },

    setProjectFromBackup: (project) => {
      set((state) => {
        state.project = project
        state.selectedDocumentId = project.nodes[project.lastDocumentId]
          ? project.lastDocumentId
          : selectFallbackDocument(project)
        state.selectedEntity = null
        state.selectedPlotId = project.plots[0]?.id || ''
        state.saveStatus = 'saved'
        state.savedAt = nowIso()
        state.revision = 0
        ensureSelectionAfterDelete(state, state.project as Draft<Project>)
        window.novelcraft.setWindowDirty(false)
      })
    },

    pushToast: (message, tone = 'info') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      set((state) => {
        state.toasts.push({ id, message, tone })
      })
      setTimeout(() => {
        set((state) => {
          state.toasts = state.toasts.filter((toast) => toast.id !== id)
        })
      }, 4200)
    },

    dismissToast: (id) =>
      set((state) => {
        state.toasts = state.toasts.filter((toast) => toast.id !== id)
      }),

    markDirty: () => {
      set((state) => {
        if (!state.project) return
        setDirtyState(state)
      })
    }
  }))
)

export function useProjectStats() {
  const project = useAppStore((state) => state.project)
  if (!project) {
    return {
      words: 0,
      chapters: 0,
      scenes: 0,
      notes: 0,
      characters: 0,
      locations: 0,
      items: 0,
      plots: 0,
      progress: 0,
      averageSceneWords: 0
    }
  }
  const words = Object.values(project.nodes).reduce((total, node) => total + (node.wordCount || 0), 0)
  const chapters = getManuscriptChapters(project).length
  const scenes = Object.values(project.nodes).filter((node) => node.type === 'scene').length
  const notes = Object.values(project.nodes).filter((node) => node.type === 'note').length
  return {
    words,
    chapters,
    scenes,
    notes,
    characters: project.characters.length,
    locations: project.locations.length,
    items: project.items.length,
    plots: project.plots.length,
    progress: project.wordGoal > 0 ? Math.min(100, Math.round((words / project.wordGoal) * 100)) : 0,
    averageSceneWords: scenes ? Math.round(words / scenes) : 0
  }
}

export function wordsLabel(words: number): string {
  return `${formatNumber(words)} palabras`
}
