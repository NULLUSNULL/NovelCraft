import { app, BrowserWindow, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import type { AiProvider, AiRequest, AppSettings, Project } from '../shared/types'
import {
  createBackup,
  createExitBackup,
  createProject,
  createSnapshot,
  getProject,
  deleteBackup,
  deleteProject,
  deleteSnapshot,
  exportProjectArchive,
  importProject,
  listBackups,
  listProjects,
  listSnapshots,
  openProject,
  restoreBackup,
  revealProject,
  saveProject
} from './projects'
import { cancelAiRequest, aiComplete, discoverModels, streamAiChat, testAiProvider } from './ai'
import { exportManuscript } from './exporter'
import { getBaseDir, ensureBaseDirs } from './storage'
import { getSettings, saveSettings } from './settings'

let mainWindow: BrowserWindow | null = null
let allowClose = false
let closingHandshake = false
let exitBackupDone = false
let closeTimer: NodeJS.Timeout | null = null

async function finishClose(): Promise<void> {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  mainWindow?.hide()
  if (!exitBackupDone) {
    exitBackupDone = true
    try {
      await createExitBackup()
    } catch {
      undefined
    }
  }
  allowClose = true
  mainWindow?.close()
}

app.setName('NovelCraft')

const windowIcon = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'assets', 'icon.png')

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    dataPath: getBaseDir()
  }))
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_event, project: Project) => createProject(project))
  ipcMain.handle('projects:get', (_event, projectId: string) => getProject(projectId))
  ipcMain.handle('projects:open', (_event, projectId: string) => openProject(projectId))
  ipcMain.handle('projects:save', (_event, project: Project) => saveProject(project))
  ipcMain.handle('projects:delete', (_event, projectId: string) => deleteProject(projectId))
  ipcMain.handle('projects:import', () => importProject())
  ipcMain.handle('projects:export', (_event, projectId: string) => exportProjectArchive(projectId))
  ipcMain.handle('projects:reveal', (_event, projectId: string) => revealProject(projectId))
  ipcMain.handle('backups:create', (_event, projectId: string) => createBackup(projectId, 'manual'))
  ipcMain.handle('backups:list', (_event, projectId: string) => listBackups(projectId))
  ipcMain.handle('backups:restore', (_event, projectId: string, backupId: string) =>
    restoreBackup(projectId, backupId)
  )
  ipcMain.handle('backups:delete', (_event, projectId: string, backupId: string) =>
    deleteBackup(projectId, backupId)
  )
  ipcMain.handle('snapshots:list', (_event, projectId: string, documentId: string) =>
    listSnapshots(projectId, documentId)
  )
  ipcMain.handle('snapshots:create', (_event, projectId: string, documentId: string) =>
    createSnapshot(projectId, documentId)
  )
  ipcMain.handle(
    'snapshots:delete',
    (_event, projectId: string, documentId: string, snapshotId: string) =>
      deleteSnapshot(projectId, documentId, snapshotId)
  )
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(settings))
  ipcMain.handle('ai:models', (_event, providerId: string) => discoverModels(providerId))
  ipcMain.handle(
    'ai:test',
    (_event, providerId: string, provider?: AiProvider) => testAiProvider(providerId, provider)
  )
  ipcMain.handle('ai:chat', async (event, request: AiRequest) => {
    return streamAiChat(request, (streamEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:stream', streamEvent)
    })
  })
  ipcMain.handle(
    'ai:complete',
    (_event, request: Omit<AiRequest, 'requestId'>) =>
      aiComplete(request.providerId, request.messages, request.temperature, request.maxTokens)
  )
  ipcMain.handle('ai:cancel', (_event, requestId: string) => cancelAiRequest(requestId))
  ipcMain.handle('export:manuscript', (_event, payload: Parameters<typeof exportManuscript>[0]) =>
    exportManuscript(payload)
  )
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.on('window:dirty', (_event, dirty: boolean) => {
    if (!mainWindow) return
    mainWindow.setDocumentEdited(dirty)
    mainWindow.setTitle(`${dirty ? '● ' : ''}NovelCraft — ${mainWindow.getTitle().replace(/^● NovelCraft — /, '')}`)
  })
  ipcMain.on('app:close-ready', () => {
    if (!closingHandshake) return
    void finishClose()
  })
  ipcMain.handle('app:open-external', async (_event, url: string) => {
    try {
      const parsed = new URL(url)
      if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) await shell.openExternal(url)
    } catch {
      return
    }
  })
}

function buildMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 620,
    show: false,
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 18, y: 17 } : undefined,
    backgroundColor: '#0e0f12',
    title: 'NovelCraft',
    icon: windowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    modernizeWindow()
    void getSettings()
      .then((settings) => {
        const scale = settings.general.uiScale || 100
        if (Number.isFinite(scale) && scale !== 100) {
          mainWindow?.webContents.setZoomFactor(Math.min(2, Math.max(0.5, scale / 100)))
        }
      })
      .catch(() => undefined)
  })

  mainWindow.on('close', (event) => {
    if (allowClose) return
    if (!mainWindow) return
    event.preventDefault()
    if (closingHandshake) return
    closingHandshake = true
    mainWindow.webContents.send('app:before-close')
    closeTimer = setTimeout(() => {
      void finishClose()
    }, 4000)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (closeTimer) clearTimeout(closeTimer)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL() || ''
    if (url !== currentUrl) {
      event.preventDefault()
      if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function modernizeWindow(): void {
  if (!mainWindow) return
  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(true)
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.novelcraft.app')
  nativeTheme.themeSource = 'dark'
  await ensureBaseDirs()
  registerIpc()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      allowClose = false
      closingHandshake = false
      exitBackupDone = false
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  allowClose = true
})
