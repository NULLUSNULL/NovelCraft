import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  FileClock,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react'
import type { SnapshotInfo } from '@shared/types'
import { formatDateTime, formatNumber, stripHtml } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ConfirmDialog, Modal } from '../ui/Modal'

export function SnapshotsDialog() {
  const open = useAppStore((state) => state.snapshotsOpen)
  const setOpen = useAppStore((state) => state.setSnapshotsOpen)
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const node = project && selectedDocumentId ? project.nodes[selectedDocumentId] : undefined
  const updateNode = useAppStore((state) => state.updateNode)
  const saveNow = useAppStore((state) => state.saveNow)
  const pushToast = useAppStore((state) => state.pushToast)
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null)
  const [deleting, setDeleting] = useState<SnapshotInfo | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!project || !node) {
      setSnapshots([])
      return
    }
    setLoading(true)
    try {
      const result = await window.novelcraft.listSnapshots(project.id, node.id)
      setSnapshots(result)
      setSelectedId((current) => (result.some((snapshot) => snapshot.id === current) ? current : result[0]?.id || ''))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [node, project, pushToast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const selected = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedId), [selectedId, snapshots])

  if (!project || !node) {
    return (
      <Modal open={open} onClose={() => setOpen(false)} title="Historial de versiones" size="md">
        <div className="history-empty">
          <History size={26} />
          <h3>Sin documento activo</h3>
          <p>Abre una escena o nota para consultar sus versiones anteriores.</p>
        </div>
      </Modal>
    )
  }

  const createManual = async (): Promise<void> => {
    setCreating(true)
    try {
      await saveNow()
      const snapshot = await window.novelcraft.createSnapshot(project.id, node.id)
      await load()
      setSelectedId(snapshot.id)
      pushToast('Versión guardada en el historial.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setCreating(false)
    }
  }

  const removeSnapshot = async (snapshot: SnapshotInfo): Promise<void> => {
    try {
      await window.novelcraft.deleteSnapshot(project.id, node.id, snapshot.id)
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id))
      if (selectedId === snapshot.id) setSelectedId('')
      pushToast('Versión eliminada.', 'info')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const restoreSnapshot = (snapshot: SnapshotInfo): void => {
    updateNode(node.id, { content: snapshot.content })
    setOpen(false)
    pushToast(`Versión del ${formatDateTime(snapshot.createdAt)} restaurada.`, 'success')
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        className="history-modal"
        eyebrow="Versiones"
        title={node.title}
        subtitle="Cada guardado con cambios relevantes crea una instantánea de esta escena."
        footer={
          <>
            <button className="btn" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} style={{ animation: 'spin 800ms linear infinite' }} /> : <History size={13} />}
              Actualizar
            </button>
            <span className="grow" />
            <button className="btn" onClick={() => setOpen(false)}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => void createManual()} disabled={creating}>
              {creating ? <Loader2 size={13} style={{ animation: 'spin 800ms linear infinite' }} /> : <Plus size={13} />}
              Guardar versión actual
            </button>
          </>
        }
      >
        <div className="history-layout">
          <aside className="history-list-panel">
            <div className="history-list-head">
              <FileClock size={13} />
              <span>{snapshots.length} {snapshots.length === 1 ? 'versión' : 'versiones'}</span>
              <span className="grow" />
              <span className="faint">{formatNumber(node.wordCount)} palabras ahora</span>
            </div>
            <div className="history-list">
              {loading && !snapshots.length && (
                <div className="history-loading"><Loader2 size={18} style={{ animation: 'spin 800ms linear infinite' }} /><span>Cargando historial...</span></div>
              )}
              {!loading && !snapshots.length && (
                <div className="history-empty-list">
                  <Clock3 size={20} />
                  <strong>Aún no hay versiones</strong>
                  <p>Se crean automáticamente al guardar cambios en esta escena.</p>
                  <button className="btn sm" onClick={() => void createManual()}>Guardar la primera</button>
                </div>
              )}
              {snapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  className={`history-item ${selectedId === snapshot.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(snapshot.id)}
                >
                  <span className="history-item-dot" />
                  <span className="history-item-main">
                    <span>{formatDateTime(snapshot.createdAt)}</span>
                    <small>{formatNumber(snapshot.wordCount)} palabras</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <section className="history-preview-panel">
            {selected ? (
              <>
                <div className="history-preview-head">
                  <div>
                    <span className="card-eyebrow">Instantánea</span>
                    <strong>{formatDateTime(selected.createdAt)}</strong>
                    <span>{formatNumber(selected.wordCount)} palabras</span>
                  </div>
                  <div className="row">
                    <button className="icon-btn sm danger" title="Eliminar versión" onClick={() => setDeleting(selected)}>
                      <Trash2 size={14} />
                    </button>
                    <button className="btn sm" onClick={() => setRestoring(selected)}>
                      <RotateCcw size={12} />
                      Restaurar
                    </button>
                  </div>
                </div>
                <div className="history-preview-content">
                  {stripHtml(selected.content)
                    ? stripHtml(selected.content).split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)
                    : <p className="faint">Esta versión estaba vacía.</p>}
                </div>
                <div className="history-compare-note">
                  Restaurar reemplazará el texto actual de la escena. La versión actual seguirá disponible si vuelves a guardar.
                </div>
              </>
            ) : (
              <div className="history-no-selection">
                <History size={23} />
                <p>Selecciona una versión para leerla y restaurarla.</p>
              </div>
            )}
          </section>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(restoring)}
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) restoreSnapshot(restoring)
        }}
        title="Restaurar versión"
        message={`Se reemplazará el texto actual de «${node.title}» por la versión del ${restoring ? formatDateTime(restoring.createdAt) : ''}.`}
        confirmLabel="Restaurar"
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removeSnapshot(deleting)
        }}
        title="Eliminar versión"
        message="Esta instantánea se borrará del historial de forma permanente."
        confirmLabel="Eliminar"
        danger
      />
    </>
  )
}
