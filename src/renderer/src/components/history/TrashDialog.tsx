import { useState } from 'react'
import { BookOpen, FileText, NotebookPen, RotateCcw, Trash2 } from 'lucide-react'
import type { TrashEntry } from '@shared/types'
import { formatNumber, formatRelativeDate } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { ConfirmDialog, Modal } from '../ui/Modal'

const KIND_LABELS: Record<TrashEntry['kind'], string> = {
  chapter: 'Capítulo',
  scene: 'Escena',
  note: 'Nota'
}

function entryWords(entry: TrashEntry): number {
  return entry.nodes.reduce((total, node) => total + (node.wordCount || 0), 0)
}

function entryIcon(entry: TrashEntry) {
  if (entry.kind === 'chapter') return <BookOpen size={15} />
  if (entry.kind === 'note') return <NotebookPen size={15} />
  return <FileText size={15} />
}

export function TrashDialog() {
  const open = useAppStore((state) => state.trashOpen)
  const setOpen = useAppStore((state) => state.setTrashOpen)
  const project = useAppStore((state) => state.project)
  const retentionDays = useAppStore((state) => state.settings.backups.trashRetentionDays)
  const restoreTrashEntry = useAppStore((state) => state.restoreTrashEntry)
  const deleteTrashEntry = useAppStore((state) => state.deleteTrashEntry)
  const emptyTrash = useAppStore((state) => state.emptyTrash)
  const [deleting, setDeleting] = useState<TrashEntry | null>(null)
  const [emptyConfirm, setEmptyConfirm] = useState(false)

  if (!project) return null
  const entries = project.trash
  const retentionLabel =
    retentionDays > 0
      ? `Los documentos se conservan ${retentionDays} ${retentionDays === 1 ? 'día' : 'días'}.`
      : 'La papelera conserva los documentos hasta que la vacíes.'

  return (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        eyebrow="Papelera"
        title="Documentos eliminados"
        subtitle={retentionLabel}
        footer={
          <>
            <button className="btn btn-danger" onClick={() => setEmptyConfirm(true)} disabled={!entries.length}>
              <Trash2 size={13} />
              Vaciar papelera
            </button>
            <span className="grow" />
            <button className="btn" onClick={() => setOpen(false)}>Cerrar</button>
          </>
        }
      >
        <div className="trash-intro">
          <span className="trash-intro-icon"><Trash2 size={16} /></span>
          <div>
            <strong>{entries.length} {entries.length === 1 ? 'documento' : 'documentos'}</strong>
            <span>Restaura lo que necesites o elimínalo definitivamente.</span>
          </div>
        </div>
        {entries.length ? (
          <div className="trash-list">
            {entries.map((entry) => (
              <div className="trash-row" key={entry.id}>
                <span className={`trash-kind ${entry.kind}`}>{entryIcon(entry)}</span>
                <div className="trash-main">
                  <strong>{entry.title}</strong>
                  <small>
                    {KIND_LABELS[entry.kind]}
                    {entry.kind === 'chapter' && entry.nodes.length > 1 ? ` · ${entry.nodes.length - 1} escenas` : ''}
                    {` · ${formatNumber(entryWords(entry))} palabras · Eliminado ${formatRelativeDate(entry.deletedAt)}`}
                  </small>
                </div>
                <button className="btn sm" onClick={() => restoreTrashEntry(entry.id)}>
                  <RotateCcw size={12} />
                  Restaurar
                </button>
                <button
                  className="icon-btn sm danger"
                  title="Eliminar definitivamente"
                  onClick={() => setDeleting(entry)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="trash-empty">
            <Trash2 size={22} />
            <strong>La papelera está vacía</strong>
            <p>Los capítulos y documentos que elimines aparecerán aquí.</p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteTrashEntry(deleting.id)
        }}
        title="Eliminar definitivamente"
        message={`«${deleting?.title || ''}» se borrará para siempre. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
      <ConfirmDialog
        open={emptyConfirm}
        onClose={() => setEmptyConfirm(false)}
        onConfirm={emptyTrash}
        title="Vaciar papelera"
        message={`Se eliminarán definitivamente ${entries.length} ${entries.length === 1 ? 'documento' : 'documentos'}. Esta acción no se puede deshacer.`}
        confirmLabel="Vaciar papelera"
        danger
      />
    </>
  )
}
