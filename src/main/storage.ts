import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { LibraryEntry, Project } from '../shared/types'

let cachedBaseDir = ''
let migrationPromise: Promise<void> | null = null

export function getBaseDir(): string {
  if (cachedBaseDir) return cachedBaseDir
  cachedBaseDir = process.env.NOVELCRAFT_DATA_DIR || path.join(app.getPath('userData'), 'data')
  return cachedBaseDir
}

export function getProjectsDir(): string {
  if (process.env.NOVELCRAFT_DATA_DIR) return path.join(getBaseDir(), 'projects')
  return path.join(app.getPath('documents'), 'NovelCraft')
}

async function moveProjectDir(source: string, destination: string): Promise<void> {
  try {
    await fs.rename(source, destination)
  } catch {
    await fs.cp(source, destination, { recursive: true })
    await fs.rm(source, { recursive: true, force: true })
  }
}

async function migrateProjectsLocation(): Promise<void> {
  const targetRoot = getProjectsDir()
  const legacyRoot = path.join(getBaseDir(), 'projects')
  const rootsDiffer = path.resolve(legacyRoot) !== path.resolve(targetRoot)

  if (rootsDiffer && (await pathExists(legacyRoot))) {
    const entries = await fs.readdir(legacyRoot, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const source = path.join(legacyRoot, entry.name)
      const destination = path.join(targetRoot, entry.name)
      if (await pathExists(destination)) continue
      await moveProjectDir(source, destination).catch(() => undefined)
    }
    await fs.rmdir(legacyRoot).catch(() => undefined)
  }

  const library = await readJson<LibraryEntry[]>(getLibraryFile(), [])
  if (!Array.isArray(library) || !library.length) return
  let changed = false
  for (const item of library) {
    const targetPath = path.join(targetRoot, item.id)
    if (await pathExists(path.join(targetPath, 'project.json'))) {
      if (item.path !== targetPath) {
        item.path = targetPath
        changed = true
      }
      continue
    }
    if (item.path && item.path !== targetPath && (await pathExists(path.join(item.path, 'project.json')))) {
      await moveProjectDir(item.path, targetPath).catch(() => undefined)
      if (await pathExists(path.join(targetPath, 'project.json'))) {
        item.path = targetPath
        changed = true
      }
    }
  }
  if (changed) await writeJsonAtomic(getLibraryFile(), library)
}

export function getProjectDir(projectId: string): string {
  assertSafeId(projectId)
  return path.join(getProjectsDir(), projectId)
}

export function getProjectFile(projectId: string): string {
  return path.join(getProjectDir(projectId), 'project.json')
}

export function getLibraryFile(): string {
  return path.join(getBaseDir(), 'library.json')
}

export function getSettingsFile(): string {
  return path.join(getBaseDir(), 'settings.json')
}

export function getSecretsFile(): string {
  return path.join(getBaseDir(), 'secrets.json')
}

export function assertSafeId(id: string): void {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(id)) {
    throw new Error('Identificador no válido')
  }
}

export async function ensureBaseDirs(): Promise<void> {
  await fs.mkdir(getProjectsDir(), { recursive: true })
  if (!migrationPromise) migrationPromise = migrateProjectsLocation().catch(() => undefined)
  await migrationPromise
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fallback
    if (error instanceof SyntaxError) {
      const backup = `${filePath}.corrupt-${Date.now()}`
      await fs.copyFile(filePath, backup).catch(() => undefined)
      return fallback
    }
    throw error
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const payload = JSON.stringify(data, null, 2)
  await fs.writeFile(tempPath, payload, 'utf8')
  await fs.rename(tempPath, filePath)
}

export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('El archivo del proyecto no es válido')
  const project = value as Project
  if (!project.id || !/^[A-Za-z0-9_-]{3,160}$/.test(project.id)) {
    throw new Error('El proyecto no tiene un identificador válido')
  }
  if (!project.title || typeof project.title !== 'string') throw new Error('El proyecto no tiene título')
  if (!project.nodes || typeof project.nodes !== 'object') throw new Error('El proyecto no contiene documentos')
  if (!Array.isArray(project.characters)) project.characters = []
  if (!Array.isArray(project.locations)) project.locations = []
  if (!Array.isArray(project.items)) project.items = []
  if (!Array.isArray(project.plots)) project.plots = []
  if (!Array.isArray(project.plotEdges)) project.plotEdges = []
  if (!Array.isArray(project.trash)) project.trash = []
  if (!project.schemaVersion) project.schemaVersion = 1
  return project
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function safeRemoveDir(target: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (resolvedTarget === resolvedRoot || !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Ruta de borrado no permitida')
  }
  await fs.rm(resolvedTarget, { recursive: true, force: true })
}
