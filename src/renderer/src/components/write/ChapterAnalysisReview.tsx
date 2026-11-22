import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, Loader2, RotateCw, Settings2, X } from 'lucide-react'
import type {
  AiProvider,
  ChapterPlotConnectionProposal,
  ChapterPlotProposal,
  ChapterReviewProposal,
  Project
} from '@shared/types'
import { getAiSkillPrompt } from '@shared/aiSkills'
import { parseChapterReviewOutput } from '@shared/chapterAnalysis'
import { getChapterScenes, getManuscriptChapters, getManuscriptScenes, makeId, stripHtml } from '@shared/project'
import { useAppStore } from '../../store/useAppStore'
import { Modal } from '../ui/Modal'

type ReviewState = 'loading' | 'ready' | 'error' | 'cancelled'
type Decision = 'accepted' | 'dismissed'

type AnalysisMode = 'chapter' | 'plots'

function mergeNovelPlotProposals(proposals: ChapterReviewProposal[]): ChapterReviewProposal[] {
  const merged: ChapterReviewProposal[] = []
  const plotIndexes = new Map<string, number>()
  const connectionIndexes = new Set<string>()
  const seenConflicts = new Set<string>()

  for (const proposal of proposals) {
    if (proposal.type === 'plot') {
      const key = proposal.plotId
        ? `plot:${proposal.plotId}`
        : `new:${proposal.title.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()}`
      const existingIndex = plotIndexes.get(key)
      if (existingIndex === undefined) {
        const conflictsWith = proposal.conflictsWith.filter((conflict) => {
          const signature = [proposal.plotId || key, conflict.plotId].sort().join(':')
          if (seenConflicts.has(signature)) return false
          seenConflicts.add(signature)
          return true
        })
        plotIndexes.set(key, merged.length)
        merged.push({ ...proposal, id: `novel-plot-${merged.length}`, conflictsWith })
        continue
      }

      const existing = merged[existingIndex]
      if (existing.type !== 'plot') continue
      const conflictMap = new Map(existing.conflictsWith.map((conflict) => [conflict.plotId, conflict]))
      for (const conflict of proposal.conflictsWith) {
        const signature = [proposal.plotId || key, conflict.plotId].sort().join(':')
        if (!seenConflicts.has(signature)) {
          seenConflicts.add(signature)
          conflictMap.set(conflict.plotId, conflict)
        }
      }
      merged[existingIndex] = {
        ...existing,
        chapterIds: [...new Set([...existing.chapterIds, ...proposal.chapterIds, proposal.chapterId])],
        sceneIds: [...new Set([...existing.sceneIds, ...proposal.sceneIds])],
        characterIds: [...new Set([...existing.characterIds, ...proposal.characterIds])],
        locationIds: [...new Set([...existing.locationIds, ...proposal.locationIds])],
        itemIds: [...new Set([...existing.itemIds, ...proposal.itemIds])],
        summary: proposal.summary.length > existing.summary.length ? proposal.summary : existing.summary,
        premise: proposal.premise.length > existing.premise.length ? proposal.premise : existing.premise,
        conflict: proposal.conflict.length > existing.conflict.length ? proposal.conflict : existing.conflict,
        stakes: proposal.stakes.length > existing.stakes.length ? proposal.stakes : existing.stakes,
        theme: proposal.theme.length > existing.theme.length ? proposal.theme : existing.theme,
        resolution: proposal.resolution.length > existing.resolution.length ? proposal.resolution : existing.resolution,
        conflictsWith: [...conflictMap.values()],
        rationale: proposal.rationale.length > existing.rationale.length ? proposal.rationale : existing.rationale,
        status: proposal.status
      }
      continue
    }

    if (proposal.type === 'plot-connection') {
      const signature = [proposal.sourcePlotId, proposal.targetPlotId].sort().join(':')
      if (connectionIndexes.has(signature)) continue
      connectionIndexes.add(signature)
      merged.push({ ...proposal, id: `novel-connection-${merged.length}` } satisfies ChapterPlotConnectionProposal)
    }
  }
  return merged
}

function buildChapterContext(project: Project, chapterId: string, mode: AnalysisMode): string {
  const chapter = project.nodes[chapterId]
  let remainingSceneCharacters = mode === 'plots' ? 18000 : 28000
  const sceneLimit = mode === 'plots' ? 4000 : 6000
  const chapterScenes = getChapterScenes(project, chapterId)
  const scenes = chapterScenes.map((scene, index) => {
    const text = stripHtml(scene.content)
    const remainingScenes = chapterScenes.length - index
    const textLimit = Math.min(sceneLimit, Math.floor(remainingSceneCharacters / remainingScenes))
    const excerpt = text.slice(0, textLimit)
    remainingSceneCharacters -= excerpt.length
    return {
    id: scene.id,
    title: scene.title,
    summary: scene.summary,
    povId: scene.pov,
    characterIds: scene.characterIds,
    storyDate: scene.storyDate,
    text: excerpt
    }
  })
  const characters = project.characters.map(({ id, name, role }) => ({ id, name, role }))
  const items = project.items.map(({ id, name, type, currentHolderId }) => ({
    id,
    name,
    type,
    currentHolderId
  }))
  const locations = project.locations.map(({ id, name, type, description }) => ({ id, name, type, description }))
  const otherChapters = getManuscriptChapters(project)
    .filter((entry) => entry.id !== chapterId)
    .slice(-20)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      summary: entry.summary.slice(0, 180),
      scenes: getChapterScenes(project, entry.id).slice(0, 3).map((scene) => ({
        id: scene.id,
        title: scene.title,
        summary: scene.summary.slice(0, 180),
        plotIds: scene.plotIds,
        characterIds: scene.characterIds,
        locationId: scene.locationId,
        itemIds: scene.itemIds
      }))
    }))
  const plots = project.plots.map(({
    id, title, type, status, summary, premise, conflict, stakes, theme, resolution,
    sceneIds, characterIds, locationIds, itemIds, chapterIds
  }) => ({
    id,
    title,
    type,
    status,
    summary,
    premise,
    conflict,
    stakes,
    theme,
    resolution,
    sceneIds,
    characterIds,
    locationIds,
    itemIds,
    chapterIds
  }))
  const plotEdges = project.plotEdges.map(({ source, target, type, label }) => ({ source, target, type, label }))
  return JSON.stringify({
    projectLanguage: project.language,
    chapter: {
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      text: scenes.length ? undefined : stripHtml(chapter.content).slice(0, 6000)
    },
    scenes,
    characters,
    items,
    locations,
    otherChapters,
    plots,
    plotEdges
  })
}

export function ChapterAnalysisReview({
  project,
  chapterId,
  provider,
  onClose,
  mode = 'chapter',
  wholeNovel = false
}: {
  project: Project
  chapterId: string
  provider: AiProvider
  onClose: () => void
  mode?: AnalysisMode
  wholeNovel?: boolean
}) {
  const applyProposal = useAppStore((state) => state.applyChapterReviewProposal)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const [state, setState] = useState<ReviewState>('loading')
  const [proposals, setProposals] = useState<ChapterReviewProposal[]>([])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [error, setError] = useState('')
  const [rawOutput, setRawOutput] = useState('')
  const [proposalErrors, setProposalErrors] = useState<Record<string, string>>({})
  const requestId = useRef<string | null>(null)
  const analysisRunId = useRef<string | null>(null)
  const [chapterProgress, setChapterProgress] = useState({ current: 0, total: wholeNovel ? getManuscriptChapters(project).length : 1, title: '' })

  const analyze = async (): Promise<void> => {
    const run = makeId('analysis-run')
    analysisRunId.current = run
    setState('loading')
    setError('')
    setRawOutput('')
    setProposals([])
    setDecisions({})
    setProposalErrors({})
    const selectedChapter = project.nodes[chapterId]
    const chapters = wholeNovel
      ? getManuscriptChapters(project)
      : selectedChapter?.type === 'chapter' ? [selectedChapter] : []
    if (!chapters.length) {
      setError('No hay capítulos disponibles para analizar.')
      setState('error')
      return
    }
    setChapterProgress({ current: 0, total: chapters.length, title: '' })
    let currentChapterTitle = ''
    const originalOutputs: string[] = []
    try {
      const initialMaxTokens = Math.min(8000, Math.max(1, provider.maxTokens || 4000))
      const collected: ChapterReviewProposal[] = []

      for (const [index, chapter] of chapters.entries()) {
        if (analysisRunId.current !== run) return
        const currentChapterId = chapter.id
        currentChapterTitle = chapter.title || 'Capítulo sin título'
        const request = makeId('chapter-analysis')
        requestId.current = request
        setChapterProgress({ current: index + 1, total: chapters.length, title: chapter.title || 'Capítulo sin título' })
        const context = buildChapterContext(project, currentChapterId, mode)
        const messages = [
          {
            role: 'system' as const,
            content: getAiSkillPrompt(mode === 'plots' ? 'plot-tracking-analysis' : 'chapter-review')
          },
          {
            role: 'user' as const,
            content: mode === 'plots'
              ? `Analiza las tramas que aparecen o cambian en el capítulo «${chapter.title || 'Capítulo'}» (${index + 1} de ${chapters.length}) del proyecto «${project.title}». ${wholeNovel
                ? 'Esta ejecución recorre la novela capítulo a capítulo: detecta continuidad y evolución de tramas largas, usa los resúmenes de otros capítulos como contexto y asocia este resultado únicamente al capítulo actual. No crees otra trama por el mero cambio de capítulo: actualiza la trama existente cuando corresponda.'
                : 'Analiza solo cambios respaldados por este capítulo. Usa los resúmenes de otros capítulos únicamente para reconocer continuidad y evitar duplicar tramas.'} Devuelve solo propuestas de trama según el formato indicado.\n\nDATOS DEL PROYECTO Y CAPÍTULO:\n${context}`
              : `Analiza el capítulo «${chapter.title || 'Capítulo'}» del proyecto «${project.title}». Identifica cambios relevantes de trama y eventos de posesión de objetos. Devuelve el formato JSON indicado.\n\nDATOS DEL PROYECTO Y CAPÍTULO:\n${context}`
          }
        ]
        let response: { content: string }
        try {
          response = await window.novelcraft.aiComplete({
            requestId: request,
            providerId: provider.id,
            temperature: 0.2,
            maxTokens: initialMaxTokens,
            messages
          })
        } catch (firstError) {
          const firstMessage = firstError instanceof Error ? firstError.message : String(firstError)
          const retryMaxTokens = Math.min(16000, Math.max(initialMaxTokens * 2, 8000))
          if (
            analysisRunId.current !== run ||
            requestId.current !== request ||
            retryMaxTokens <= initialMaxTokens ||
            !/exhausted its output token limit|output token limit|maximum output tokens/i.test(firstMessage)
          ) {
            throw firstError
          }
          response = await window.novelcraft.aiComplete({
            requestId: request,
            providerId: provider.id,
            temperature: 0.2,
            maxTokens: retryMaxTokens,
            messages
          })
        }
        if (analysisRunId.current !== run || requestId.current !== request) return
        let parsedProposals: ChapterReviewProposal[]
        let outputEntryIndex = -1
        try {
          parsedProposals = parseChapterReviewOutput(response.content, project, currentChapterId)
        } catch (validationError) {
          const invalidOutput = response.content
          outputEntryIndex = originalOutputs.length
          originalOutputs.push(`## ${chapter.title}\nRespuesta que no superó la validación:\n${invalidOutput}`)
          const repairRequest = makeId('chapter-analysis-repair')
          requestId.current = repairRequest
          const validationMessage = validationError instanceof Error ? validationError.message : String(validationError)
          response = await window.novelcraft.aiComplete({
            requestId: repairRequest,
            providerId: provider.id,
            temperature: 0.1,
            maxTokens: Math.min(16000, Math.max(initialMaxTokens * 2, 8000)),
            messages: [
              ...messages,
              { role: 'assistant', content: invalidOutput },
              {
                role: 'user',
                content: `La respuesta anterior no superó la validación del formato o de las referencias. Corrige exclusivamente esa respuesta: conserva las propuestas y los hechos válidos, usa solo IDs del contexto y devuelve JSON estricto según el esquema del mensaje de sistema. No añadas Markdown ni explicaciones. Error de validación: ${validationMessage}`
              }
            ]
          })
          if (analysisRunId.current !== run || requestId.current !== repairRequest) return
          try {
            parsedProposals = parseChapterReviewOutput(response.content, project, currentChapterId)
          } catch (repairError) {
            const repairMessage = repairError instanceof Error ? repairError.message : String(repairError)
            originalOutputs[outputEntryIndex] += `\n\nRespuesta tras corrección:\n${response.content}`
            throw new Error(`El formato siguió sin ser válido después de un intento de corrección: ${repairMessage}`)
          }
        }
        if (outputEntryIndex >= 0) {
          originalOutputs[outputEntryIndex] = `## ${chapter.title}\n${response.content}`
        } else {
          originalOutputs.push(`## ${chapter.title}\n${response.content}`)
        }
        collected.push(...parsedProposals)
        requestId.current = null
      }
      if (analysisRunId.current !== run) return
      setRawOutput(originalOutputs.join('\n\n'))
      setProposals(wholeNovel && mode === 'plots' ? mergeNovelPlotProposals(collected) : collected)
      setState('ready')
    } catch (requestError) {
      if (analysisRunId.current !== run) return
      setRawOutput(originalOutputs.join('\n\n'))
      const requestMessage = requestError instanceof Error ? requestError.message : String(requestError)
      const message = wholeNovel && currentChapterTitle
        ? `Falló el análisis de «${currentChapterTitle}»: ${requestMessage}`
        : requestMessage
      if (/cancel/i.test(message)) {
        setState('cancelled')
      } else {
        const actionableMessage = /exhausted its output token limit|output token limit|maximum output tokens/i.test(message)
          ? `${message} Se intentó ampliar el límite de salida; si vuelve a ocurrir, reduce el esfuerzo de razonamiento o aumenta «Tokens máximos» en Ajustes → IA.`
          : message
        setError(actionableMessage)
        setState('error')
      }
    } finally {
      if (analysisRunId.current === run) {
        requestId.current = null
        analysisRunId.current = null
      }
    }
  }

  useEffect(() => {
    void analyze()
    return () => {
      const activeRequest = requestId.current
      requestId.current = null
      analysisRunId.current = null
      if (activeRequest) {
        void window.novelcraft.cancelAi(activeRequest).catch((cancelError: unknown) => {
          console.error('No se pudo cancelar el análisis del capítulo al cerrar:', cancelError)
        })
      }
    }
  }, [])

  const cancel = (): void => {
    const activeRequest = requestId.current
    requestId.current = null
    analysisRunId.current = null
    if (activeRequest) {
      void window.novelcraft.cancelAi(activeRequest).catch((cancelError: unknown) => {
        const message = cancelError instanceof Error ? cancelError.message : String(cancelError)
        setError(`No se pudo detener la solicitud de análisis: ${message}`)
        setState('error')
      })
    }
    setState('cancelled')
    setError('')
  }

  const decide = (proposal: ChapterReviewProposal, decision: Decision): void => {
    if (decision === 'dismissed') {
      setDecisions((current) => ({ ...current, [proposal.id]: decision }))
      return
    }
    try {
      if (!applyProposal(proposal)) throw new Error('No hay un proyecto abierto para aplicar el cambio.')
      setDecisions((current) => ({ ...current, [proposal.id]: decision }))
      setProposalErrors((current) => {
        const next = { ...current }
        delete next[proposal.id]
        return next
      })
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : String(applyError)
      setProposalErrors((current) => ({ ...current, [proposal.id]: message }))
    }
  }

  const chapterScenes = wholeNovel ? getManuscriptScenes(project) : getChapterScenes(project, chapterId)
  const proposalTitle = (proposal: ChapterReviewProposal): string => {
    if (proposal.type === 'plot') {
      return proposal.action === 'create' ? `Nueva trama: ${proposal.title}` : `Actualizar trama: ${proposal.title}`
    }
    if (proposal.type === 'plot-connection') {
      const source = project.plots.find((plot) => plot.id === proposal.sourcePlotId)
      const target = project.plots.find((plot) => plot.id === proposal.targetPlotId)
      return `Conflicto: ${source?.title || 'Trama'} ↔ ${target?.title || 'Trama'}`
    }
    const item = project.items.find((entry) => entry.id === proposal.itemId)
    const action = proposal.action === 'acquisition' ? 'Adquisición' : proposal.action === 'loss' ? 'Pérdida' : 'Transferencia'
    return `${action}: ${item?.name || 'Objeto'}`
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'plots'
        ? wholeNovel ? 'Revisión de tramas de la novela' : 'Revisión de tramas del capítulo'
        : 'Revisión del capítulo'}
      eyebrow={mode === 'plots' ? 'Análisis de tramas' : 'Análisis asistido'}
      size="xl"
      closeOnBackdrop={state !== 'loading'}
      subtitle={`${provider.name} · ${provider.model || 'modelo sin identificar'} · Nada se aplica hasta que aceptes una propuesta.`}
      footer={(
        <>
          <span className="field-hint" style={{ margin: 0 }}>
            {state === 'ready' && proposals.length ? `${Object.keys(decisions).length} de ${proposals.length} revisadas` : ''}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            <X size={14} /> Cerrar
          </button>
        </>
      )}
    >
      {state === 'loading' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 4px' }}>
          {wholeNovel ? <BookOpen size={20} /> : <Loader2 size={20} className="spinner" />}
          <div style={{ flex: 1 }}>
            <strong>
              {wholeNovel
                ? `Analizando capítulo ${chapterProgress.current} de ${chapterProgress.total}: «${chapterProgress.title}»`
                : `Analizando «${project.nodes[chapterId]?.title || 'capítulo'}»…`}
            </strong>
            <div className="field-hint">
              {wholeNovel
                ? 'Se procesan los capítulos secuencialmente y se consolidan las tramas recurrentes.'
                : 'La IA compara sus escenas con las tramas y los objetos del proyecto.'}
            </div>
            {wholeNovel && (
              <div
                className="chapter-analysis-progress"
                role="progressbar"
                aria-label="Progreso del análisis de la novela"
                aria-valuemin={0}
                aria-valuemax={chapterProgress.total}
                aria-valuenow={chapterProgress.current}
              >
                <span style={{ width: `${chapterProgress.total ? (chapterProgress.current / chapterProgress.total) * 100 : 0}%` }} />
              </div>
            )}
          </div>
          <button type="button" className="btn btn-sm" onClick={cancel}>
            <X size={14} /> Cancelar
          </button>
        </div>
      )}

      {state === 'error' && (
        <div role="alert" style={{ display: 'grid', gap: 12 }}>
          <div className="form-card">
            <strong>No se pudo completar o validar el análisis.</strong>
            <p style={{ marginBottom: 0 }}>{error}</p>
            <p className="field-hint" style={{ marginBottom: 0 }}>
              Modelo usado: {provider.name} · {provider.model || 'sin modelo'}. Comprueba la cuota, la clave API y el modelo activo, o cámbialo antes de volver a intentarlo.
            </p>
          </div>
          {rawOutput && (
            <details>
              <summary>Ver respuesta original de la IA</summary>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 260, overflow: 'auto' }}>{rawOutput}</pre>
            </details>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setSettingsOpen(true, 'ai')}>
              <Settings2 size={14} /> Configurar modelo IA
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void analyze()}>
              <RotateCw size={14} /> Volver a analizar
            </button>
          </div>
        </div>
      )}

      {state === 'cancelled' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 4px' }}>
          <span>El análisis se canceló. No se modificó el proyecto.</span>
          <button type="button" className="btn btn-primary" onClick={() => void analyze()}>
            <RotateCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {state === 'ready' && (
        <>
          {!proposals.length ? (
            <div role="status" className="form-card">
              <strong>No se detectaron cambios claros.</strong>
              <p style={{ marginBottom: 0 }}>Puedes cerrar esta revisión o analizar de nuevo después de editar el capítulo.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <p className="field-hint" style={{ margin: 0 }}>
                {proposals.filter((proposal) => !decisions[proposal.id]).length} propuestas pendientes de revisar.
              </p>
              {proposals.map((proposal) => {
                const decision = decisions[proposal.id]
                const sceneIds = proposal.type === 'plot'
                  ? proposal.sceneIds
                  : proposal.type === 'possession'
                    ? [proposal.sceneId]
                    : []
                const sceneNames = sceneIds
                  .map((id) => chapterScenes.find((scene) => scene.id === id)?.title)
                  .filter(Boolean)
                const characterLabels = proposal.type === 'plot'
                  ? proposal.characterIds.map((id) => ({
                    id,
                    label: `Personaje: ${project.characters.find((character) => character.id === id)?.name || 'Sin nombre'}`
                  }))
                  : proposal.type === 'possession' ? [
                    proposal.fromCharacterId && {
                      id: proposal.fromCharacterId,
                      label: `${proposal.action === 'loss' ? 'Pierde' : 'Entrega'}: ${project.characters.find((character) => character.id === proposal.fromCharacterId)?.name || 'Sin nombre'}`
                    },
                    proposal.toCharacterId && {
                      id: proposal.toCharacterId,
                      label: `${proposal.action === 'acquisition' ? 'Adquiere' : 'Recibe'}: ${project.characters.find((character) => character.id === proposal.toCharacterId)?.name || 'Sin nombre'}`
                    }
                  ].filter((entry): entry is { id: string; label: string } => Boolean(entry)) : []
                return (
                  <article className="form-card" key={proposal.id} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div className="card-eyebrow">
                          {proposal.type === 'plot' ? 'Trama' : proposal.type === 'possession' ? 'Posesión de objeto' : 'Conexión de tramas'}
                        </div>
                        <h3 style={{ margin: '4px 0 0' }}>{proposalTitle(proposal)}</h3>
                      </div>
                      {decision && <span className="chip">{decision === 'accepted' ? 'Aceptada' : 'Descartada'}</span>}
                    </div>
                    <p style={{ margin: 0 }}>
                      {proposal.type === 'plot-connection' ? proposal.label : proposal.summary}
                    </p>
                    {proposal.type === 'plot' && (
                      <div className="chapter-analysis-plot-fields">
                        {[
                          ['Premisa', proposal.premise],
                          ['Conflicto central', proposal.conflict],
                          ['Apuestas', proposal.stakes],
                          ['Tema', proposal.theme],
                          ['Resolución propuesta', proposal.resolution]
                        ].filter(([, value]) => value).map(([label, value]) => (
                          <div key={label}>
                            <strong>{label}</strong>
                            <span>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {sceneNames.map((name, index) => <span className="chip" key={`${name}-${index}`}>Escena: {name}</span>)}
                      {characterLabels.map((entry) => <span className="chip" key={entry.id}>{entry.label}</span>)}
                      {proposal.type === 'plot' && (
                        <>
                          {proposal.chapterIds.map((id) => (
                            <span className="chip" key={`chapter-${id}`}>Capítulo: {project.nodes[id]?.title || 'Capítulo'}</span>
                          ))}
                          {proposal.locationIds.map((id) => (
                            <span className="chip" key={`location-${id}`}>Lugar: {project.locations.find((location) => location.id === id)?.name || 'Lugar'}</span>
                          ))}
                          {proposal.itemIds.map((id) => (
                            <span className="chip" key={`item-${id}`}>Objeto: {project.items.find((item) => item.id === id)?.name || 'Objeto'}</span>
                          ))}
                          <span className="chip">Tipo: {proposal.plotType}</span>
                          <span className="chip">Estado sugerido: {proposal.status}</span>
                          {proposal.conflictsWith.map((conflict) => (
                            <span className="chip plot-conflict-proposal-chip" key={conflict.plotId}>
                              Conflicto con: {project.plots.find((plot) => plot.id === conflict.plotId)?.title || 'Trama vinculada'}
                            </span>
                          ))}
                        </>
                      )}
                      {proposal.type === 'plot-connection' && (
                        <span className="chip plot-conflict-proposal-chip">Conector: Conflicto</span>
                      )}
                      {proposal.type === 'possession' && (
                        <span className="chip">
                          {proposal.action === 'acquisition' ? 'Adquisición' : proposal.action === 'loss' ? 'Pérdida' : 'Transferencia'}
                        </span>
                      )}
                    </div>
                    <p className="field-hint" style={{ margin: 0 }}>Motivo: {proposal.rationale}</p>
                    {proposalErrors[proposal.id] && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{proposalErrors[proposal.id]}</p>}
                    {!decision && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-sm" onClick={() => decide(proposal, 'dismissed')}>
                          <X size={13} /> Descartar
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(proposal, 'accepted')}>
                          <Check size={13} /> Aceptar y aplicar
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

    </Modal>
  )
}
