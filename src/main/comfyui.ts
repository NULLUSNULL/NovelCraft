import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { LocalComfyUiState } from '../shared/types'

const LOCAL_COMFYUI_URL = 'http://127.0.0.1:8188'
let serverProcess: ChildProcess | null = null
let startPromise: Promise<LocalComfyUiState> | null = null
let lastError = ''
let stderrTail = ''

async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_COMFYUI_URL}/system_stats`, {
      signal: AbortSignal.timeout(1200),
      redirect: 'error'
    })
    return response.ok
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) {
      return false
    }
    throw error
  }
}

export async function getLocalComfyUiStatus(): Promise<LocalComfyUiState> {
  if (await isServerReady()) return { status: 'running', error: '' }
  if (serverProcess && serverProcess.exitCode === null && !serverProcess.killed) {
    return { status: 'starting', error: '' }
  }
  return { status: 'stopped', error: lastError }
}

async function startServer(): Promise<LocalComfyUiState> {
  if (await isServerReady()) return { status: 'running', error: '' }
  if (serverProcess && serverProcess.exitCode === null && !serverProcess.killed) {
    return { status: 'starting', error: '' }
  }

  const comfyDirectory = join(app.getAppPath(), 'ComfyUI')
  const entryPoint = join(comfyDirectory, 'main.py')
  try {
    await access(entryPoint)
  } catch {
    throw new Error(
      `No se encontró ComfyUI/main.py en ${comfyDirectory}. El servidor local solo puede iniciarse desde la copia de desarrollo.`
    )
  }

  const python = process.env.NOVELCRAFT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  const child = spawn(python, [entryPoint, '--listen', '127.0.0.1', '--port', '8188'], {
    cwd: comfyDirectory,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  })

  serverProcess = child
  lastError = ''
  stderrTail = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-2000)
  })
  child.once('error', (error) => {
    lastError = `No se pudo iniciar ComfyUI con «${python}»: ${error.message}`
    if (serverProcess === child) serverProcess = null
  })
  child.once('exit', (code, signal) => {
    if (serverProcess === child) serverProcess = null
    if (code !== 0) {
      const detail = stderrTail.trim()
      lastError = `ComfyUI terminó ${signal ? `por la señal ${signal}` : `con código ${code}`}.${detail ? ` ${detail.slice(-1200)}` : ''}`
    }
  })

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', (error) => reject(new Error(`No se pudo iniciar ComfyUI con «${python}»: ${error.message}`)))
  })
  child.unref()
  return { status: 'starting', error: '' }
}

export function startLocalComfyUi(): Promise<LocalComfyUiState> {
  if (!startPromise) {
    startPromise = startServer().finally(() => {
      startPromise = null
    })
  }
  return startPromise
}

export function stopLocalComfyUi(): void {
  serverProcess?.kill()
  serverProcess = null
}
