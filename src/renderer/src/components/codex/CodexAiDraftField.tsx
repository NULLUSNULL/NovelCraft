import { useEffect, useId, useRef, useState } from 'react'
import { Check, LoaderCircle, Sparkles, StopCircle, X } from 'lucide-react'
import { getAiSkillPrompt, type AiSkillId } from '@shared/aiSkills'
import { makeId } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'

interface CodexAiDraftFieldProps {
  label: string
  skill: Extract<AiSkillId, 'character-codex' | 'location-codex' | 'item-codex' | 'plot-resolution'>
  value: string
  context: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

export function CodexAiDraftField({
  label,
  skill,
  value,
  context,
  onChange,
  rows = 4,
  placeholder
}: CodexAiDraftFieldProps) {
  const settings = useAppStore((state) => state.settings)
  const project = useAppStore((state) => state.project)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const pushToast = useAppStore((state) => state.pushToast)
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef<string | null>(null)
  const fieldId = useId()
  const textProviders = settings.providers.filter(
    (entry) => entry.protocol !== 'comfyui' && entry.supportsText !== false
  )
  const provider = textProviders.find((entry) => entry.id === settings.ai.activeProviderId) || textProviders[0]

  useEffect(() => () => {
    const activeRequestId = requestId.current
    if (activeRequestId) {
      void window.novelcraft.cancelAi(activeRequestId).catch((caught: unknown) => {
        console.error('No se pudo cancelar la sugerencia de la ficha:', caught)
      })
    }
  }, [])

  const generate = async (): Promise<void> => {
    if (!provider) {
      setSettingsOpen(true, 'ai')
      pushToast('Configura un proveedor de texto en Ajustes → IA.', 'error')
      return
    }
    const currentRequestId = makeId('codex-ai')
    requestId.current = currentRequestId
    setLoading(true)
    setError('')
    setSuggestion('')
    try {
      const response = await window.novelcraft.aiComplete({
        requestId: currentRequestId,
        providerId: provider.id,
        messages: [
          {
            role: 'system',
            content: `${getAiSkillPrompt(skill)}\n\nIDIOMA DE RESPUESTA: ${project?.language || 'español'}.`
          },
          {
            role: 'user',
            content: `NOVELA: ${project?.title || 'Sin título'}\n\nDATOS DE LA FICHA:\n${context}\n\nCAMPO: ${label}\n\nTEXTO ACTUAL:\n${value.trim() || '(vacío)'}\n\nPropón una versión útil para este campo. Conserva los hechos conocidos y deja margen para que el autor la edite.`
          }
        ],
        temperature: 0.7,
        maxTokens: 1200
      })
      if (requestId.current === currentRequestId) {
        const content = response.content.trim()
        if (content) setSuggestion(content)
        else setError('El proveedor devolvió una respuesta vacía. Prueba de nuevo o revisa el proveedor en Ajustes → IA.')
      }
    } catch (caught) {
      if (requestId.current !== currentRequestId) return
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      if (requestId.current === currentRequestId) {
        requestId.current = null
        setLoading(false)
      }
    }
  }

  const cancel = (): void => {
    const currentRequestId = requestId.current
    if (!currentRequestId) return
    requestId.current = null
    setLoading(false)
    void window.novelcraft.cancelAi(currentRequestId).catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(`No se pudo cancelar la sugerencia: ${message}`)
    })
  }

  const applySuggestion = (append: boolean): void => {
    const nextValue = append && value.trim()
      ? `${value.trimEnd()}\n\n${suggestion}`
      : suggestion
    onChange(nextValue)
    setSuggestion('')
  }

  return (
    <div className="field codex-ai-draft-field">
      <label className="field-label" htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        className="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
      <div className="codex-ai-actions">
        <span className="field-hint">{provider ? `Asistente · ${provider.name}` : 'Configura un proveedor de texto para inspirarte.'}</span>
        {loading ? (
          <button type="button" className="btn sm" onClick={cancel}>
            <StopCircle size={12} /> Cancelar
          </button>
        ) : (
          <button type="button" className="btn sm" onClick={() => void generate()}>
            <Sparkles size={12} /> Inspirar con IA
          </button>
        )}
      </div>
      {loading && <div className="codex-ai-status"><LoaderCircle size={13} className="image-queue-spinner" /> Preparando una propuesta…</div>}
      {error && <div className="codex-ai-error" role="alert">{error}</div>}
      {suggestion && (
        <div className="codex-ai-suggestion">
          <div className="codex-ai-suggestion-head"><Sparkles size={13} /><strong>Propuesta · revísala antes de aplicar</strong></div>
          <p>{suggestion}</p>
          <div className="codex-ai-suggestion-actions">
            <button type="button" className="btn sm btn-primary" onClick={() => applySuggestion(false)}><Check size={12} /> Sustituir texto</button>
            <button type="button" className="btn sm" onClick={() => applySuggestion(true)}>Añadir al texto</button>
            <button type="button" className="icon-btn sm" onClick={() => setSuggestion('')} aria-label="Descartar sugerencia"><X size={12} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
