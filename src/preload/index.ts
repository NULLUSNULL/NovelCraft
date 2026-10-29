import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { AiProvider, AiRequest, AiStreamEvent, AppSettings, NovelCraftApi, Project } from '../shared/types'

const api: NovelCraftApi = {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (project: Project) => ipcRenderer.invoke('projects:create', project),
  getProject: (id: string) => ipcRenderer.invoke('projects:get', id),
  openProject: (id: string) => ipcRenderer.invoke('projects:open', id),
  saveProject: (project: Project) => ipcRenderer.invoke('projects:save', project),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  importProject: () => ipcRenderer.invoke('projects:import'),
  exportProject: (id: string) => ipcRenderer.invoke('projects:export', id),
  revealProject: (id: string) => ipcRenderer.invoke('projects:reveal', id),
  createBackup: (id: string) => ipcRenderer.invoke('backups:create', id),
  listBackups: (id: string) => ipcRenderer.invoke('backups:list', id),
  restoreBackup: (id: string, backupId: string) => ipcRenderer.invoke('backups:restore', id, backupId),
  deleteBackup: (id: string, backupId: string) => ipcRenderer.invoke('backups:delete', id, backupId),
  listSnapshots: (id: string, documentId: string) => ipcRenderer.invoke('snapshots:list', id, documentId),
  createSnapshot: (id: string, documentId: string) => ipcRenderer.invoke('snapshots:create', id, documentId),
  deleteSnapshot: (id: string, documentId: string, snapshotId: string) =>
    ipcRenderer.invoke('snapshots:delete', id, documentId, snapshotId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  listModels: (providerId: string) => ipcRenderer.invoke('ai:models', providerId),
  testProvider: (providerId: string, provider?: AiProvider) =>
    ipcRenderer.invoke('ai:test', providerId, provider),
  aiChat: (request: AiRequest) => ipcRenderer.invoke('ai:chat', request),
  aiComplete: (request: Omit<AiRequest, 'requestId'>) => ipcRenderer.invoke('ai:complete', request),
  cancelAi: (requestId: string) => ipcRenderer.invoke('ai:cancel', requestId),
  onAiStream: (callback: (event: AiStreamEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AiStreamEvent): void => callback(data)
    ipcRenderer.on('ai:stream', listener)
    return () => ipcRenderer.removeListener('ai:stream', listener)
  },
  exportManuscript: (payload) => ipcRenderer.invoke('export:manuscript', payload),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  setUiScale: (factor: number) => webFrame.setZoomFactor(Math.min(2, Math.max(0.5, factor))),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setWindowDirty: (dirty: boolean) => ipcRenderer.send('window:dirty', dirty),
  onBeforeClose: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:before-close', listener)
    return () => ipcRenderer.removeListener('app:before-close', listener)
  },
  closeReady: () => ipcRenderer.send('app:close-ready'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)
}

contextBridge.exposeInMainWorld('novelcraft', api)
