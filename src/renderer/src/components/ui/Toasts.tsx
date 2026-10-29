import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts)
  const dismiss = useAppStore((state) => state.dismissToast)
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id}>
          {toast.tone === 'success' && <CheckCircle2 size={15} className="accent" />}
          {toast.tone === 'error' && <AlertCircle size={15} style={{ color: 'var(--danger)' }} />}
          {toast.tone === 'info' && <Info size={15} className="accent" />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
