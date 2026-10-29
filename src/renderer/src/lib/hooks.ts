import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = (): void => setMatches(media.matches)
    media.addEventListener('change', listener)
    setMatches(media.matches)
    return () => media.removeEventListener('change', listener)
  }, [query])
  return matches
}

export function useAutoSave(): void {
  const saveStatus = useAppStore((state) => state.saveStatus)
  const revision = useAppStore((state) => state.revision)
  const autosaveSeconds = useAppStore((state) => state.settings.general.autosaveSeconds)
  useEffect(() => {
    if (saveStatus !== 'dirty') return
    const delay = Math.max(0.5, autosaveSeconds || 2) * 1000
    const timer = window.setTimeout(() => {
      const store = useAppStore.getState()
      if (store.saveStatus === 'dirty') void store.saveNow()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [saveStatus, revision, autosaveSeconds])
}

export function useAutoSaveSettings(): void {
  const settingsDirty = useAppStore((state) => state.settingsDirty)
  const settings = useAppStore((state) => state.settings)
  useEffect(() => {
    if (!settingsDirty) return
    const timer = window.setTimeout(() => {
      const store = useAppStore.getState()
      if (store.settingsDirty) void store.saveSettingsNow()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [settingsDirty, settings])
}

export function useBeforeClose(): void {
  useEffect(() => {
    return window.novelcraft.onBeforeClose(() => {
      const finish = (): void => window.novelcraft.closeReady()
      const store = useAppStore.getState()
      if (store.settingsDirty) void store.saveSettingsNow().catch(() => undefined)
      if (store.project) {
        void store
          .saveNow()
          .catch(() => undefined)
          .finally(finish)
      } else {
        finish()
      }
    })
  }, [])
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const store = useAppStore.getState()
      const target = event.target as HTMLElement | null
      const editing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable)
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (store.project) void store.saveNow()
        return
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        store.setCommandPaletteOpen(!store.commandPaletteOpen)
        return
      }
      if (modifier && event.key === ',') {
        event.preventDefault()
        store.setSettingsOpen(true)
        return
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        store.setFocusMode(!store.focusMode)
        return
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        if (!store.settings.ai.enabled) return
        if (store.view !== 'write') store.setView('write')
        store.setInspectorOpen(true)
        store.setInspectorTab('ai')
        return
      }
      if (event.key === 'Escape') {
        if (store.commandPaletteOpen) store.setCommandPaletteOpen(false)
        else if (store.settingsOpen) store.setSettingsOpen(false)
        else if (store.snapshotsOpen) store.setSnapshotsOpen(false)
        else if (store.backupManagerOpen) store.setBackupManagerOpen(false)
        else if (store.trashOpen) store.setTrashOpen(false)
        else if (store.projectManagerOpen && store.project) store.setProjectManagerOpen(false)
        else if (store.focusMode) store.setFocusMode(false)
        return
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && !editing) {
        const digit = event.code.startsWith('Digit') ? event.code.slice(5) : event.key
        if (digit === '1') store.setView('write')
        if (digit === '2') store.setView('codex')
        if (digit === '3') store.setView('plots')
        if (digit === '4') store.setView('publish')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

export function useTheme(): void {
  const theme = useAppStore((state) => state.settings.general.theme)
  const accentColor = useAppStore((state) => state.settings.general.accentColor)
  const uiScale = useAppStore((state) => state.settings.general.uiScale)
  const animations = useAppStore((state) => state.settings.general.animations)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => setSystemDark(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])
  useEffect(() => {
    const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.accent = accentColor || 'sage'
    document.documentElement.dataset.animations = animations ? 'on' : 'off'
  }, [theme, accentColor, systemDark, animations])
  useEffect(() => {
    window.novelcraft.setUiScale((Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 100) / 100)
  }, [uiScale])
}
