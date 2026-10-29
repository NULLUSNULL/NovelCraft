import { app, dialog, shell } from 'electron'
import AdmZip from 'adm-zip'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  BackupInfo,
  ExportResult,
  LibraryEntry,
  Project,
  SaveResult,
  SnapshotInfo
} from '../shared/types'
import { makeId, nowIso, stripHtml } from '../shared/project'
import {
  assertSafeId,
  ensureBaseDirs,
  getLibraryFile,
  getProjectDir,
  getProjectFile,
  getProjectsDir,
  pathExists,
  readJson,
  safeRemoveDir,
  validateProject,
  writeJsonAtomic
} from './storage'
import { getSettings } from './settings'

function totalWords(project: Project): number {
  return Object.values(project.nodes).reduce((total, node) => total + (node.wordCount || 0), 0)
}

function purgeExpiredTrash(project: Project, retentionDays: number): boolean {
  if (!Array.isArray(project.trash)) {
    project.trash = []
    return false
  }
  if (retentionDays <= 0) return false
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const next = project.trash.filter((entry) => {
    const deletedAt = new Date(entry.deletedAt).getTime()
    return Number.isFinite(deletedAt) && deletedAt >= cutoff
  })
  if (next.length === project.trash.length) return false
  project.trash = next
  return true
}

function toEntry(project: Project, projectPath: string, lastOpenedAt = nowIso()): LibraryEntry {
  return {
    id: project.id,
    title: project.title,
    author: project.author,
    genre: project.genre,
    coverColor: project.coverColor,
    coverImage: project.coverImage || '',
    wordCount: totalWords(project),
    wordGoal: project.wordGoal,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastOpenedAt,
    path: projectPath
  }
}

export async function readLibrary(): Promise<LibraryEntry[]> {
  await ensureBaseDirs()
  const library = await readJson<LibraryEntry[]>(getLibraryFile(), [])
  return Array.isArray(library) ? library : []
}

async function writeLibrary(library: LibraryEntry[]): Promise<void> {
  await writeJsonAtomic(getLibraryFile(), library)
}

async function upsertLibrary(project: Project, lastOpenedAt?: string): Promise<LibraryEntry> {
  const library = await readLibrary()
  const existing = library.find((entry) => entry.id === project.id)
  const entry = toEntry(project, getProjectDir(project.id), lastOpenedAt || existing?.lastOpenedAt || nowIso())
  const next = existing ? library.map((item) => (item.id === project.id ? entry : item)) : [...library, entry]
  await writeLibrary(next)
  return entry
}

async function removeLibrary(projectId: string): Promise<void> {
  const library = await readLibrary()
  await writeLibrary(library.filter((entry) => entry.id !== projectId))
}

async function readProject(projectId: string): Promise<Project> {
  assertSafeId(projectId)
  await ensureBaseDirs()
  const project = validateProject(await readJson<unknown>(getProjectFile(projectId), null))
  return project
}

export async function getProject(projectId: string): Promise<Project> {
  return readProject(projectId)
}

export async function listProjects(): Promise<LibraryEntry[]> {
  const library = await readLibrary()
  const valid: LibraryEntry[] = []
  for (const entry of library) {
    if (await pathExists(path.join(entry.path, 'project.json'))) valid.push(entry)
  }
  if (valid.length !== library.length) await writeLibrary(valid)
  return valid.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
}

export async function createProject(project: Project): Promise<LibraryEntry> {
  await ensureBaseDirs()
  validateProject(project)
  const projectDir = getProjectDir(project.id)
  if (await pathExists(projectDir)) throw new Error('Ya existe un proyecto con ese identificador')
  project.updatedAt = nowIso()
  await fs.mkdir(projectDir, { recursive: true })
  await writeJsonAtomic(getProjectFile(project.id), project)
  return upsertLibrary(project)
}

export async function openProject(projectId: string): Promise<Project> {
  const project = await readProject(projectId)
  const settings = await getSettings()
  if (purgeExpiredTrash(project, settings.backups.trashRetentionDays)) {
    await writeJsonAtomic(getProjectFile(project.id), project)
  }
  await upsertLibrary(project, nowIso())
  return project
}

export async function saveProject(input: Project): Promise<SaveResult> {
  const project = validateProject(structuredClone(input))
  const settings = await getSettings()
  purgeExpiredTrash(project, settings.backups.trashRetentionDays)
  const previous = await readJson<Project | null>(getProjectFile(project.id), null)
  let snapshotCount = 0
  if (settings.backups.snapshotsEnabled && previous?.nodes) {
    for (const [documentId, node] of Object.entries(previous.nodes)) {
      const nextNode = project.nodes[documentId]
      if (!nextNode) continue
      if ((node.content || '') !== (nextNode.content || '') && stripHtml(node.content || '')) {
        await writeSnapshot(project.id, {
          documentId,
          title: node.title,
          content: node.content,
          wordCount: node.wordCount,
          createdAt: node.updatedAt || nowIso()
        })
        snapshotCount += 1
      }
    }
    await trimSnapshots(project.id, settings.backups.snapshotLimit)
  }
  project.updatedAt = nowIso()
  await writeJsonAtomic(getProjectFile(project.id), project)
  await upsertLibrary(project, nowIso())
  const backupCreated = await maybeAutoBackup(project.id, settings.backups.autoBackupMinutes, settings.backups.backupLimit)
  return { savedAt: project.updatedAt, snapshots: snapshotCount, backupCreated }
}

function snapshotDir(projectId: string, documentId: string): string {
  assertSafeId(projectId)
  assertSafeId(documentId)
  return path.join(getProjectDir(projectId), 'snapshots', documentId)
}

function snapshotToInfo(id: string, data: Omit<SnapshotInfo, 'id' | 'preview'>): SnapshotInfo {
  const text = stripHtml(data.content)
  return {
    ...data,
    id,
    preview: text.slice(0, 260)
  }
}

async function writeSnapshot(
  projectId: string,
  data: {
    documentId: string
    title: string
    content: string
    wordCount: number
    createdAt: string
  }
): Promise<SnapshotInfo> {
  const dir = snapshotDir(projectId, data.documentId)
  await fs.mkdir(dir, { recursive: true })
  const safeTimestamp = (data.createdAt || nowIso()).replace(/[:.]/g, '-')
  const id = `${safeTimestamp}-${Math.random().toString(36).slice(2, 7)}`
  const info = snapshotToInfo(id, data)
  const stored = {
    ...data,
    id
  }
  await writeJsonAtomic(path.join(dir, `${id}.json`), stored)
  return info
}

async function trimSnapshots(projectId: string, limit: number): Promise<void> {
  const safeLimit = Math.max(1, Math.min(500, limit || 40))
  const snapshotsRoot = path.join(getProjectDir(projectId), 'snapshots')
  let docDirs: string[] = []
  try {
    docDirs = await fs.readdir(snapshotsRoot)
  } catch {
    return
  }
  for (const docDir of docDirs) {
    const dir = path.join(snapshotsRoot, docDir)
    try {
      const files = (await fs.readdir(dir)).filter((file) => file.endsWith('.json')).sort().reverse()
      for (const file of files.slice(safeLimit)) {
        await fs.rm(path.join(dir, file), { force: true }).catch(() => undefined)
      }
    } catch {
      continue
    }
  }
}

export async function listSnapshots(projectId: string, documentId: string): Promise<SnapshotInfo[]> {
  const dir = snapshotDir(projectId, documentId)
  assertSafeId(projectId)
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const snapshots: SnapshotInfo[] = []
  for (const file of files.filter((entry) => entry.endsWith('.json')).sort().reverse()) {
    try {
      const raw = await readJson<{
        documentId: string
        title: string
        content: string
        wordCount: number
        createdAt: string
      } | null>(path.join(dir, file), null)
      if (!raw) continue
      snapshots.push(snapshotToInfo(file.replace(/\.json$/, ''), raw))
    } catch {
      continue
    }
  }
  return snapshots
}

export async function createSnapshot(projectId: string, documentId: string): Promise<SnapshotInfo> {
  const project = await readProject(projectId)
  const node = project.nodes[documentId]
  if (!node) throw new Error('Documento no encontrado')
  return writeSnapshot(projectId, {
    documentId,
    title: node.title,
    content: node.content,
    wordCount: node.wordCount,
    createdAt: nowIso()
  })
}

export async function deleteSnapshot(
  projectId: string,
  documentId: string,
  snapshotId: string
): Promise<void> {
  if (!/^[A-Za-z0-9_.-]+$/.test(snapshotId)) throw new Error('Snapshot no válido')
  const target = path.join(snapshotDir(projectId, documentId), `${snapshotId}.json`)
  await fs.rm(target, { force: true })
}

function backupDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'backups')
}

function backupKind(fileName: string): BackupInfo['kind'] {
  if (fileName.includes('-auto-')) return 'auto'
  if (fileName.includes('-safety-')) return 'safety'
  return 'manual'
}

async function archiveProject(projectId: string, destination: string): Promise<void> {
  const zip = new AdmZip()
  const projectFile = getProjectFile(projectId)
  zip.addLocalFile(projectFile, '', 'project.json')
  const snapshotsRoot = path.join(getProjectDir(projectId), 'snapshots')
  if (await pathExists(snapshotsRoot)) zip.addLocalFolder(snapshotsRoot, 'snapshots')
  const project = await readProject(projectId)
  zip.addFile(
    'manifest.json',
    Buffer.from(
      JSON.stringify(
        {
          app: 'NovelCraft',
          version: 1,
          projectId: project.id,
          title: project.title,
          author: project.author,
          exportedAt: nowIso()
        },
        null,
        2
      ),
      'utf8'
    )
  )
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await zip.writeZipPromise(destination, { overwrite: true })
}

export async function createBackup(projectId: string, kind: BackupInfo['kind'] = 'manual'): Promise<BackupInfo> {
  const dir = backupDir(projectId)
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `novelcraft-${kind}-${stamp}.zip`
  const destination = path.join(dir, fileName)
  await archiveProject(projectId, destination)
  const stat = await fs.stat(destination)
  return {
    id: fileName,
    fileName,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
    kind
  }
}

export async function listBackups(projectId: string): Promise<BackupInfo[]> {
  const dir = backupDir(projectId)
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const backups: BackupInfo[] = []
  for (const fileName of files.filter((file) => file.endsWith('.zip'))) {
    try {
      const stat = await fs.stat(path.join(dir, fileName))
      backups.push({
        id: fileName,
        fileName,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        kind: backupKind(fileName)
      })
    } catch {
      continue
    }
  }
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function trimBackups(projectId: string, limit: number): Promise<void> {
  const backups = await listBackups(projectId)
  const safeLimit = Math.max(1, limit || 20)
  for (const backup of backups.slice(safeLimit)) {
    await fs.rm(path.join(backupDir(projectId), backup.id), { force: true }).catch(() => undefined)
  }
}

async function maybeAutoBackup(
  projectId: string,
  intervalMinutes: number,
  backupLimit: number
): Promise<boolean> {
  if (!intervalMinutes || intervalMinutes <= 0) return false
  const backups = await listBackups(projectId)
  const latestAuto = backups.find((backup) => backup.kind === 'auto')
  if (latestAuto) {
    const elapsed = Date.now() - new Date(latestAuto.createdAt).getTime()
    if (elapsed < intervalMinutes * 60_000) return false
  }
  await createBackup(projectId, 'auto')
  await trimBackups(projectId, backupLimit)
  return true
}

function validateBackupId(backupId: string): void {
  if (!/^[A-Za-z0-9_.-]+\.zip$/.test(backupId) || backupId.includes('..')) {
    throw new Error('Backup no válido')
  }
}

export async function restoreBackup(projectId: string, backupId: string): Promise<Project> {
  validateBackupId(backupId)
  const current = await readProject(projectId)
  const backupPath = path.join(backupDir(projectId), backupId)
  if (!(await pathExists(backupPath))) throw new Error('El backup ya no existe')
  const zip = new AdmZip(backupPath)
  const entry = zip.getEntry('project.json')
  if (!entry) throw new Error('El backup no contiene un proyecto válido')
  const project = validateProject(JSON.parse(entry.getData().toString('utf8')))
  if (project.id !== current.id) throw new Error('El backup pertenece a otro proyecto')
  await createBackup(projectId, 'safety')
  project.updatedAt = nowIso()
  await writeJsonAtomic(getProjectFile(projectId), project)
  await upsertLibrary(project, nowIso())
  await trimBackups(projectId, (await getSettings()).backups.backupLimit)
  return project
}

export async function deleteBackup(projectId: string, backupId: string): Promise<void> {
  validateBackupId(backupId)
  await fs.rm(path.join(backupDir(projectId), backupId), { force: true })
}

export async function deleteProject(projectId: string): Promise<void> {
  assertSafeId(projectId)
  await safeRemoveDir(getProjectDir(projectId), getProjectsDir())
  await removeLibrary(projectId)
}

export async function exportProjectArchive(projectId: string): Promise<ExportResult> {
  const project = await readProject(projectId)
  const safeName = project.title.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'proyecto'
  const result = await dialog.showSaveDialog({
    title: 'Exportar proyecto NovelCraft',
    defaultPath: `${safeName}.novelcraft.zip`,
    filters: [{ name: 'Proyecto NovelCraft', extensions: ['zip'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await archiveProject(projectId, result.filePath)
  return { canceled: false, filePath: result.filePath }
}

export async function importProject(): Promise<LibraryEntry | null> {
  const result = await dialog.showOpenDialog({
    title: 'Importar proyecto NovelCraft',
    properties: ['openFile'],
    filters: [{ name: 'Proyecto NovelCraft', extensions: ['zip'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const zip = new AdmZip(result.filePaths[0])
  const entry = zip.getEntry('project.json')
  if (!entry) throw new Error('El archivo no es un proyecto NovelCraft')
  const project = validateProject(JSON.parse(entry.getData().toString('utf8')))
  await ensureBaseDirs()
  const existing = await readLibrary()
  if (existing.some((item) => item.id === project.id) || (await pathExists(getProjectDir(project.id)))) {
    project.id = makeId('project')
    project.title = `${project.title} (importado)`
  }
  project.createdAt = project.createdAt || nowIso()
  project.updatedAt = nowIso()
  await fs.mkdir(getProjectDir(project.id), { recursive: true })
  await writeJsonAtomic(getProjectFile(project.id), project)
  return upsertLibrary(project, nowIso())
}

export async function revealProject(projectId: string): Promise<void> {
  shell.showItemInFolder(getProjectFile(projectId))
}

export async function createExitBackup(): Promise<void> {
  const settings = await getSettings()
  if (!settings.backups.backupOnExit) return
  const latest = await readLibrary()
  const recent = latest.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))[0]
  if (!recent) return
  if (!(await pathExists(getProjectFile(recent.id)))) return
  const backups = await listBackups(recent.id)
  const newest = backups[0]
  if (newest && Date.now() - new Date(newest.createdAt).getTime() < 5 * 60_000) return
  await createBackup(recent.id, 'auto')
  await trimBackups(recent.id, settings.backups.backupLimit)
}

export function getDefaultProjectPath(): string {
  return getProjectsDir()
}

export function getApplicationDataPath(): string {
  return app.getPath('userData')
}
