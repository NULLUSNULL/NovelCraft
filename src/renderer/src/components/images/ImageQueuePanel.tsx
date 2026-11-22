import { LoaderCircle, Sparkles, StopCircle, X } from 'lucide-react'
import type { ImageQueueJob } from '@shared/types'

interface ImageQueuePanelProps {
  jobs: ImageQueueJob[]
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
  onSettings: () => void
}

export function ImageQueuePanel({ jobs, onCancel, onRemove, onClear, onSettings }: ImageQueuePanelProps) {
  const pendingCount = jobs.filter((job) => job.status === 'queued' || job.status === 'processing').length
  const finishedCount = jobs.length - pendingCount
  const recentFirst = jobs
    .map((job, index) => ({ job, index }))
    .sort((left, right) =>
      right.job.createdAt.localeCompare(left.job.createdAt) || right.index - left.index
    )
    .map(({ job }) => job)

  return (
    <section className="image-queue image-queue-under-library" aria-label="Cola de generación de imágenes">
      <div className="image-queue-head">
        <div>
          <Sparkles size={14} />
          <strong>Cola de generación</strong>
          <span>{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</span>
        </div>
        {finishedCount > 0 && (
          <button type="button" className="btn sm" onClick={onClear}>
            Limpiar terminadas
          </button>
        )}
      </div>
      {jobs.length ? (
        <div className="image-queue-list">
          {recentFirst.map((job) => (
            <div className={`image-queue-item ${job.status}`} key={job.id}>
              <span className="image-queue-state">
                {job.status === 'processing'
                  ? <LoaderCircle size={13} className="image-queue-spinner" />
                  : job.status === 'completed'
                    ? '✓'
                    : job.status === 'failed'
                      ? '!'
                      : job.status === 'cancelled'
                        ? <X size={13} />
                        : '…'}
                {job.status === 'processing'
                  ? 'Generando'
                  : job.status === 'completed'
                    ? 'Lista'
                    : job.status === 'failed'
                      ? 'Error'
                      : job.status === 'cancelled'
                        ? 'Cancelada'
                        : 'En cola'}
              </span>
              <span className="image-queue-prompt" title={job.request.prompt}>{job.request.prompt}</span>
              {job.request.referenceImage && <span className="image-queue-reference">Con foto de referencia</span>}
              {job.status === 'failed' && <span className="image-queue-error" title={job.error}>{job.error}</span>}
              {job.status === 'failed' && (
                <button type="button" className="text-link" onClick={onSettings}>
                  Configurar servicio
                </button>
              )}
              {(job.status === 'queued' || job.status === 'processing') ? (
                <button
                  type="button"
                  className="image-queue-cancel"
                  onClick={() => onCancel(job.id)}
                  title={job.status === 'processing' ? 'Cancelar generación' : 'Cancelar elemento en cola'}
                  aria-label={job.status === 'processing' ? 'Cancelar generación' : 'Cancelar elemento en cola'}
                >
                  <StopCircle size={14} />
                  Cancelar
                </button>
              ) : (
                <button type="button" className="icon-btn" onClick={() => onRemove(job.id)} title="Quitar de la cola" aria-label="Quitar de la cola">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="image-queue-empty">
          <span>Las generaciones aparecen aquí mientras se procesan.</span>
          <span>Podrás cancelarlas sin abandonar la biblioteca.</span>
        </div>
      )}
    </section>
  )
}
