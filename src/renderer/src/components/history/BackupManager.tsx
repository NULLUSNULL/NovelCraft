import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  CalendarClock,
  Database,
  Download,
  FolderOpen,
  HardDriveDownload,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import type { BackupInfo } from '@shared/types'
import { formatDateTime } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ConfirmDialog, Modal } from '../ui/Modal'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const KIND_LABEL: Record<BackupInfo['kind'], string> = {
  manual: 'Manual',
  auto: 'Automática',
  safety: 'Seguridad'
}

const KIND_ICON: Record<BackupInfo['kind'], typeof ShieldCheck> = {
  manual: Database,
  auto: CalendarClock,
  safety: ShieldCheck
}

export function BackupManager() {
  const open = useAppStore((state) => state.backupManagerOpen)
  const setOpen = useAppStore((state) => state.setBackupManagerOpen)
  const project = useAppStore((state) => state.project)
  const saveNow = useAppStore((state) => state.saveNow)
  const setProjectFromBackup = useAppStore((state) => state.setProjectFromBackup)
  const refreshLibrary = useAppStore((state) => state.refreshLibrary)
  const pushToast = useAppStore((state) => state.pushToast)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<BackupInfo | null>(null)
  const [deleting, setDeleting] = useState<BackupInfo | null>(null)
  const [workingId, setWorkingId] = useState('')

  const load = useCallback(async (): Promise<void> => {
    if (!project) {
      setBackups([])
      return
    }
    setLoading(true)
    try {
      setBackups(await window.novelcraft.listBackups(project.id))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [project, pushToast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  if (!project) {
    return (
      <Modal open={open} onClose={() => setOpen(false)} title="Copias de seguridad" size="md">
        <div className="history-empty">
          <Database size={26} />
          <h3>Sin proyecto abierto</h3>
          <p>Abre una novela para gestionar sus copias de seguridad.</p>
        </div>
      </Modal>
    )
  }

  const create = async (): Promise<void> => {
    setCreating(true)
    try {
      await saveNow()
      const backup = await window.novelcraft.createBackup(project.id)
      await load()
      pushToast(`Copia creada (${formatSize(backup.size)}).`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setCreating(false)
    }
  }

  const restore = async (backup: BackupInfo): Promise<void> => {
    setWorkingId(backup.id)
    try {
      await saveNow()
      const restored = await window.novelcraft.restoreBackup(project.id, backup.id)
      setProjectFromBackup(restored)
      await refreshLibrary()
      await load()
      pushToast('Proyecto restaurado desde la copia de seguridad.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setWorkingId('')
    }
  }

  const remove = async (backup: BackupInfo): Promise<void> => {
    setWorkingId(backup.id)
    try {
      await window.novelcraft.deleteBackup(project.id, backup.id)
      setBackups((current) => current.filter((item) => item.id !== backup.id))
      pushToast('Copia eliminada.', 'info')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setWorkingId('')
    }
  }

  const exportArchive = async (): Promise<void> => {
    try {
      const result = await window.novelcraft.exportProject(project.id)
      if (!result.canceled) pushToast(`Archivo exportado: ${result.filePath}`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const reveal = async (): Promise<void> => {
    try {
      await window.novelcraft.revealProject(project.id)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const totalSize = backups.reduce((total, backup) => total + backup.size, 0)

  return (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        className="backup-modal"
        eyebrow="Seguridad"
        title="Copias de seguridad"
        subtitle={`${project.title} · ${backups.length} copias · ${formatSize(totalSize)}`}
        footer={
          <>
            <button className="btn" onClick={() => void reveal()}><FolderOpen size={13} />Mostrar carpeta</button>
            <button className="btn" onClick={() => void exportArchive()}><Download size={13} />Exportar ZIP</button>
            <span className="grow" />
            <button className="btn" onClick={() => setOpen(false)}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => void create()} disabled={creating}>
              {creating ? <Loader2 size={13} style={{ animation: 'spin 800ms linear infinite' }} /> : <Plus size={13} />}
              Crear copia
            </button>
          </>
        }
      >
        <div className="backup-intro">
          <div className="backup-intro-icon"><HardDriveDownload size={21} /></div>
          <div>
            <strong>Tu novela completa en un archivo</strong>
            <p>Las copias incluyen el manuscrito, el codex, las tramas y el historial de versiones. Restaurar crea antes una copia de seguridad del estado actual.</p>
          </div>
        </div>

        <div className="backup-list-head">
          <span>Copias disponibles</span>
          <span className="faint">Las copias automáticas se crean mientras trabajas</span>
        </div>

        {loading && !backups.length && (
          <div className="history-loading"><Loader2 size={18} style={{ animation: 'spin 800ms linear infinite' }} /><span>Buscando copias...</span></div>
        )}

        {!loading && !backups.length && (
          <div className="backup-empty">
            <Archive size={25} />
            <h3>Todavía no hay copias</h3>
            <p>Crea una copia manual ahora o deja que NovelCraft las genere automáticamente.</p>
            <button className="btn btn-primary" onClick={() => void create()} disabled={creating}>
              {creating ? <Loader2 size={13} /> : <Plus size={13} />}
              Crear primera copia
            </button>
          </div>
        )}

        {backups.length > 0 && (
          <div className="backup-list">
            {backups.map((backup) => {
              const Icon = KIND_ICON[backup.kind]
              const busy = workingId === backup.id
              return (
                <div className="backup-row" key={backup.id}>
                  <span className={`backup-kind-icon ${backup.kind}`}><Icon size={15} /></span>
                  <span className="backup-row-main">
                    <span className="backup-file">{backup.fileName}</span>
                    <span className="backup-meta">
                      <span>{formatDateTime(backup.createdAt)}</span>
                      <span className="dot-sep" />
                      <span>{formatSize(backup.size)}</span>
                      <span className={`chip ${backup.kind === 'safety' ? 'green' : ''}`}>{KIND_LABEL[backup.kind]}</span>
                    </span>
                  </span>
                  <div className="backup-actions">
                    <button className="btn sm" onClick={() => setRestoring(backup)} disabled={busy}>
                      {busy ? <Loader2 size={12} style={{ animation: 'spin 800ms linear infinite' }} /> : <RotateCcw size={12} />}
                      Restaurar
                    </button>
                    <button className="icon-btn sm danger" title="Eliminar copia" onClick={() => setDeleting(backup)} disabled={busy}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(restoring)}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) void restore(restoring)
        }}
        title="Restaurar copia de seguridad"
        message={`El proyecto volverá al estado guardado el ${restoring ? formatDateTime(restoring.createdAt) : ''}. Antes se creará una copia de seguridad del estado actual.`}
        confirmLabel="Restaurar proyecto"
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remove(deleting)
        }}
        title="Eliminar copia"
        message={`Se eliminará «${deleting?.fileName || ''}» de forma permanente.`}
        confirmLabel="Eliminar"
        danger
      />
    </>
  )
}
