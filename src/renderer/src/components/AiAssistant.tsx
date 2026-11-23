import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  FileText,
  MessageSquare,
  PanelRightClose,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  WandSparkles
} from 'lucide-react'
import { buildProjectContext } from '@shared/project'
import { getAiSkillPrompt } from '@shared/aiSkills'
import type { DocumentNode, ID } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

type SceneProposal = Partial<Pick<
  DocumentNode,
  'pov' | 'locationId' | 'characterIds' | 'plotIds' | 'itemIds' |
  'goal' | 'conflict' | 'outcome' | 'dramaticTension' | 'writingPlan'
>> & {
  newCharacters?: Array<{ title: string; description?: string }>
  newPlaces?: Array<{ title: string }>
  newItems?: Array<{ title: string }>
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  error?: boolean
  sceneId?: ID
  sceneTitle?: string
  sceneProposal?: SceneProposal
  proposalApplied?: boolean
  isInspiration?: boolean
}

const SUGGESTIONS = [
  '¿Detectas incoherencias en la cronología de mi novela?',
  'Resume la trama principal y sus conflictos abiertos.',
  'Propón tres giros que encajen con el tema.',
  'Analiza la voz de mi protagonista y cómo hacerla más distintiva.'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function MessageText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n')
        const isList = lines.every((line) => /^\s*[-*]\s+/.test(line)) && lines.length > 0
        if (isList) {
          return (
            <ul key={blockIndex} className="chat-list">
              {lines.map((line, index) => (
                <li key={index}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          )
        }
        if (/^#{1,4}\s+/.test(block)) {
          return <h4 key={blockIndex}>{inline(block.replace(/^#{1,4}\s+/, ''))}</h4>
        }
        if (/^\d+\.\s+/.test(block)) {
          const items = block.split('\n')
          return (
            <ol key={blockIndex} className="chat-list ordered">
              {items.map((line, index) => (
                <li key={index}>{inline(line.replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          )
        }
        return <p key={blockIndex}>{inline(block)}</p>
      })}
    </>
  )
}

function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    return <span key={index}>{part}</span>
  })
}

function readChatMessages(value: string | null): ChatMessage[] {
  if (!value) return []
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) throw new Error('El historial guardado no tiene el formato esperado.')
  return parsed.filter((message): message is ChatMessage => {
    if (!isRecord(message)) return false
    const candidate = message
    return (
      typeof candidate.id === 'string' &&
      (candidate.role === 'user' || candidate.role === 'assistant') &&
      typeof candidate.content === 'string' &&
      typeof candidate.createdAt === 'string'
    )
  }).slice(-50)
}

function extractSceneProposal(content: string): { content: string; proposal?: SceneProposal } {
  const marker = /<NOVELCRAFT_SCENE_PLAN>\s*([\s\S]*?)\s*<\/NOVELCRAFT_SCENE_PLAN>/i
  const match = content.match(marker)
  if (!match) return { content }
  try {
    const parsed: unknown = JSON.parse(match[1])
    if (!isRecord(parsed)) return { content }
    const source = parsed
    const proposal: SceneProposal = {}
    const stringFields = ['pov', 'locationId', 'goal', 'conflict', 'outcome', 'dramaticTension', 'writingPlan'] as const
    for (const field of stringFields) {
      if (typeof source[field] === 'string') proposal[field] = source[field]
    }
    const listFields = ['characterIds', 'plotIds', 'itemIds'] as const
    for (const field of listFields) {
      if (Array.isArray(source[field]) && source[field].every((item) => typeof item === 'string')) {
        proposal[field] = source[field].filter((item): item is string => typeof item === 'string')
      }
    }
    const entityFields = ['newCharacters', 'newPlaces', 'newItems'] as const
    for (const field of entityFields) {
      if (Array.isArray(source[field])) {
        const entries = source[field].filter(
          (item): item is { title: string; description?: string } => isRecord(item) && typeof item.title === 'string'
        )
        if (entries.length) proposal[field] = entries
      }
    }
    if (!Object.keys(proposal).length) return { content }
    return { content: content.replace(marker, '').trim(), proposal }
  } catch {
    return { content }
  }
}

function parseIdeas(content: string): string[] {
  return content
    .replace(/;\s*(?=\d+[.)]\s)/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean)
}

export function AiAssistant() {
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const settings = useAppStore((state) => state.settings)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const pushToast = useAppStore((state) => state.pushToast)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadedStorageKey, setLoadedStorageKey] = useState('')
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const requestRef = useRef('')
  const messagesRef = useRef<ChatMessage[]>([])
  const storageKey = project ? `novelcraft:chat:${project.id}` : ''

  const provider = settings.providers.find((item) => item.id === settings.ai.activeProviderId)
  const selectedNode = project && selectedDocumentId ? project.nodes[selectedDocumentId] : undefined
  const contextLength = useMemo(() => {
    if (!project) return 0
    return buildProjectContext(project, selectedDocumentId, settings.ai).length
  }, [project, selectedDocumentId, settings.ai])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!storageKey) return
    setLoadedStorageKey('')
    try {
      setMessages(readChatMessages(localStorage.getItem(storageKey)))
    } catch (error) {
      setMessages([])
      pushToast(
        `No se pudo recuperar el historial del asistente: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      )
    } finally {
      setLoadedStorageKey(storageKey)
    }
  }, [storageKey, pushToast])

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)))
    } catch (error) {
      pushToast(
        `No se pudo guardar el historial del asistente: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      )
    }
  }, [loadedStorageKey, messages, pushToast, storageKey])

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, streaming])

  useEffect(() => {
    const unsubscribe = window.novelcraft.onAiStream((event) => {
      if (event.requestId !== requestRef.current) return
      if (event.delta) {
        setMessages((current) =>
          current.map((message) =>
            message.id === event.requestId
              ? { ...message, content: message.content + (event.delta || '') }
              : message
          )
        )
      }
      if (event.error) {
        setMessages((current) =>
          current.map((message) =>
            message.id === event.requestId
              ? { ...message, content: event.error || 'Error de la IA', error: true }
              : message
          )
        )
      }
      if (event.done) {
        setMessages((current) =>
          current.map((message) => {
            if (message.id !== event.requestId || !message.sceneId || message.error) return message
            const extracted = extractSceneProposal(message.content)
            return { ...message, content: extracted.content, sceneProposal: extracted.proposal }
          })
        )
        setStreaming(false)
        setRequestId('')
        requestRef.current = ''
      }
    })
    return () => {
      unsubscribe()
      if (requestRef.current) void window.novelcraft.cancelAi(requestRef.current)
    }
  }, [])

  const send = async (text?: string, inspiration = false): Promise<void> => {
    const content = (text ?? draft).trim()
    if (!content || !project || !provider || streaming || loadedStorageKey !== storageKey) return
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const userMessage: ChatMessage = {
      id: `user_${id}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    }
    const assistantMessage: ChatMessage = {
      id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      ...(selectedNode?.type === 'scene' ? { sceneId: selectedNode.id, sceneTitle: selectedNode.title } : {}),
      ...(inspiration ? { isInspiration: true } : {})
    }
    const conversation = [...messagesRef.current, userMessage].filter((message) => !message.error)
    setMessages([...messagesRef.current, userMessage, assistantMessage])
    setDraft('')
    setStreaming(true)
    setRequestId(id)
    requestRef.current = id
    try {
      const context = buildProjectContext(project, selectedDocumentId, settings.ai)
      const previousHistory = conversation.slice(0, -12).slice(-20)
        .map((message) => `${message.role === 'user' ? 'Autor' : 'Asistente'}: ${message.content.replace(/\s+/g, ' ').slice(0, 220)}`)
        .join('\n')
        .slice(-4000)
      const scenePlanInstruction = selectedNode?.type === 'scene'
        ? `\n\n${getAiSkillPrompt('scene-planning')}\n\n${getAiSkillPrompt('inspiración-literaria')}`
        : ''
      const historyContext = previousHistory
        ? `\n\nMEMORIA BREVE DE MENSAJES ANTERIORES:\n${previousHistory}\nÚsala para mantener continuidad, pero da prioridad a la petición actual y al canon del proyecto.`
        : ''
      const system = `${getAiSkillPrompt('literary-assistant')}\n\nCONTEXTO DEL PROYECTO:\n${context}${historyContext}${scenePlanInstruction}`
      const requestMessages = [
        { role: 'system' as const, content: system },
        ...conversation.slice(-12).map((message) => ({ role: message.role, content: message.content }))
      ]
      await window.novelcraft.aiChat({
        requestId: id,
        providerId: provider.id,
        messages: requestMessages,
        temperature: 0.65,
        maxTokens: Math.max(1200, Math.min(provider.maxTokens, 3000))
      })
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(error)
      setMessages((current) =>
        current.map((entry) =>
          entry.id === id && !entry.content
            ? { ...entry, content: message, error: true }
            : entry
        )
      )
      setStreaming(false)
      setRequestId('')
      requestRef.current = ''
    }
  }

  const stop = (): void => {
    if (requestRef.current) void window.novelcraft.cancelAi(requestRef.current)
    setStreaming(false)
    setRequestId('')
    requestRef.current = ''
  }

  const clear = (): void => {
    setMessages([])
    if (storageKey) localStorage.removeItem(storageKey)
  }

  const planScene = (): void => {
    if (selectedNode?.type !== 'scene') return
    void send(`Prepara un plan de escritura para la escena «${selectedNode.title}». Analiza el contexto y propón, cuando tenga sentido, el punto de vista, la ubicación, los personajes, las tramas y los ítems relevantes, además de la tensión dramática, el objetivo, el conflicto, el resultado y un esquema breve de desarrollo. No inventes hechos del canon.`)
  }

  const inspire = (): void => {
    if (selectedNode?.type !== 'scene') return
    void send(`Analiza el contexto y propón una inspiración literaria para la escena activa «${selectedNode.title}»: 2–4 ideas concretas y distintas que surjan del personaje, del conflicto actual y del tema. Para cada idea, di en una línea qué apuesta narrativa hace y pon un esquema ejecutable por beats (objetivo, conflicto, resultado). Identifica los elementos relevantes — punto de vista, ubicación, personajes, tramas y ítems — solo con IDs existentes del contexto, y las conexiones entre tramas y personajes. Al final añade el bloque <NOVELCRAFT_SCENE_PLAN> con el JSON propuesto. No inventes hechos del canon.`, true)
  }

  const applySceneProposal = (message: ChatMessage): void => {
    if (!project || !message.sceneId || !message.sceneProposal) return
    const scene = project.nodes[message.sceneId]
    if (!scene || scene.type !== 'scene') {
      pushToast('La escena de esta propuesta ya no existe.', 'error')
      return
    }
    const proposal = message.sceneProposal
    const patch: Partial<DocumentNode> = {}
    const createdCharacterIds: string[] = []
    for (const entry of proposal.newCharacters || []) {
      if (!entry.title) continue
      const existing = project.characters.find((c) => c.name.toLowerCase() === entry.title.toLowerCase())
      if (existing) { createdCharacterIds.push(existing.id); continue }
      const before = new Set(useAppStore.getState().project?.characters.map((c) => c.id) || [])
      useAppStore.getState().addCharacter()
      const created = (useAppStore.getState().project?.characters || []).find((c) => !before.has(c.id))
      if (created) {
        useAppStore.getState().updateCharacter(created.id, { name: entry.title })
        createdCharacterIds.push(created.id)
      }
    }
    if (createdCharacterIds.length) patch.characterIds = [...(patch.characterIds || []), ...createdCharacterIds]
    const createdPlaceIds: string[] = []
    for (const entry of proposal.newPlaces || []) {
      if (!entry.title) continue
      const existing = project.locations.find((l) => l.name.toLowerCase() === entry.title.toLowerCase())
      if (existing) { createdPlaceIds.push(existing.id); continue }
      const before = new Set(useAppStore.getState().project?.locations.map((l) => l.id) || [])
      useAppStore.getState().addLocation()
      const created = (useAppStore.getState().project?.locations || []).find((l) => !before.has(l.id))
      if (created) {
        useAppStore.getState().updateLocation(created.id, { name: entry.title, type: created.type })
        createdPlaceIds.push(created.id)
      }
    }
    if (createdPlaceIds.length) patch.locationId = patch.locationId || createdPlaceIds[0]
    const createdItemIds: string[] = []
    for (const entry of proposal.newItems || []) {
      if (!entry.title) continue
      const existing = project.items.find((i) => i.name.toLowerCase() === entry.title.toLowerCase())
      if (existing) { createdItemIds.push(existing.id); continue }
      const before = new Set(useAppStore.getState().project?.items.map((i) => i.id) || [])
      useAppStore.getState().addItem()
      const created = (useAppStore.getState().project?.items || []).find((i) => !before.has(i.id))
      if (created) {
        useAppStore.getState().updateItem(created.id, { name: entry.title })
        createdItemIds.push(created.id)
      }
    }
    if (createdItemIds.length) patch.itemIds = [...(patch.itemIds || []), ...createdItemIds]
    const skippedAssociations: string[] = []
    if (typeof proposal.pov === 'string') {
      if (!proposal.pov || project.characters.some((character) => character.id === proposal.pov)) patch.pov = proposal.pov
      else skippedAssociations.push('POV')
    }
    if (typeof proposal.locationId === 'string') {
      if (!proposal.locationId || project.locations.some((location) => location.id === proposal.locationId)) patch.locationId = proposal.locationId
      else skippedAssociations.push('ubicación')
    }
    if (proposal.characterIds) {
      if (proposal.characterIds.every((id) => project.characters.some((character) => character.id === id))) patch.characterIds = proposal.characterIds
      else skippedAssociations.push('personajes')
    }
    if (proposal.plotIds) {
      if (proposal.plotIds.every((id) => project.plots.some((plot) => plot.id === id))) patch.plotIds = proposal.plotIds
      else skippedAssociations.push('tramas')
    }
    if (proposal.itemIds) {
      if (proposal.itemIds.every((id) => project.items.some((item) => item.id === id))) patch.itemIds = proposal.itemIds
      else skippedAssociations.push('ítems')
    }
    for (const field of ['goal', 'conflict', 'outcome', 'dramaticTension', 'writingPlan'] as const) {
      if (typeof proposal[field] === 'string') patch[field] = proposal[field]
    }
    if (!Object.keys(patch).length) {
      pushToast('La propuesta no contiene campos válidos para esta escena.', 'error')
      return
    }
    useAppStore.getState().updateNode(message.sceneId, patch)
    setMessages((current) => current.map((entry) => entry.id === message.id ? { ...entry, proposalApplied: true } : entry))
    pushToast(`Plan aplicado a «${scene.title}». Revisa los campos antes de escribir.`, 'success')
    if (skippedAssociations.length) {
      pushToast(`Se omitieron asociaciones no válidas: ${skippedAssociations.join(', ')}.`, 'error')
    }
  }

  const copy = async (message: ChatMessage): Promise<void> => {
    await navigator.clipboard.writeText(message.content)
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(''), 1500)
  }

  if (!project) return null

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-head">
        <div className="ai-assistant-title">
          <span className="ai-orb">
            <Sparkles size={14} />
          </span>
          <div>
            <strong>Asistente literario</strong>
            <span>{provider ? `${provider.name} · ${provider.model}` : 'Sin proveedor configurado'}</span>
            <span className="ai-history-count">Historial del proyecto · {messages.length} mensajes</span>
          </div>
        </div>
        <div className="row">
          <button
            className="icon-btn sm"
            onClick={() => setInspectorOpen(false)}
            title="Minimizar asistente"
            aria-label="Minimizar asistente"
          >
            <PanelRightClose size={14} />
          </button>
          <button className="icon-btn sm" onClick={() => setSettingsOpen(true)} title="Configurar IA">
            <Settings2 size={14} />
          </button>
          <button className="icon-btn sm" onClick={clear} title="Borrar conversación" disabled={!messages.length}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="ai-context-bar">
        <span className="ai-context-item">
          <Check size={10} />
          Proyecto
        </span>
        {settings.ai.includeManuscript && <span className="ai-context-item">Manuscrito</span>}
        {settings.ai.includeCodex && <span className="ai-context-item">Codex</span>}
        {settings.ai.includePlots && <span className="ai-context-item">Tramas</span>}
        {selectedNode && <span className="ai-context-item active">{selectedNode.title}</span>}
        <span className="ai-context-size">{Math.round(contextLength / 1000)}k</span>
      </div>

      <div className="ai-messages" ref={scrollRef} role="log" aria-label="Historial de conversación">
        {!messages.length && (
          <div className="ai-welcome">
            <div className="ai-welcome-orb">
              <WandSparkles size={23} />
            </div>
            <h3>Tu editor de confianza</h3>
            <p>
              Conozco la estructura, los personajes, las tramas y el documento activo. Pregúntame lo que necesites para desbloquear la historia.
            </p>
            {!provider && (
              <button className="btn btn-primary sm" onClick={() => setSettingsOpen(true)}>
                Configurar un modelo de IA
              </button>
            )}
            <div className="ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => void send(suggestion)} disabled={!provider}>
                  <MessageSquare size={12} />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div className={`chat-message ${message.role} ${message.error ? 'error' : ''}`} key={message.id}>
            <div className="chat-avatar">
              {message.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="chat-content">
              <div className="chat-meta">
                <span>{message.role === 'assistant' ? 'Asistente' : 'Tú'}</span>
                {message.role === 'assistant' && streaming && message.id === requestId && (
                  <span className="chat-typing">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              <div className="chat-text">
                {message.content ? <MessageText text={message.content} /> : <span className="chat-placeholder">Pensando con el contexto de tu novela...</span>}
              </div>
              {message.sceneProposal && message.sceneId && !message.isInspiration && (
                <div className="ai-scene-proposal">
                  <div className="ai-scene-proposal-title">
                    <FileText size={13} />
                    <span>Plan para {message.sceneTitle || 'la escena'}</span>
                  </div>
                  <p>
                    {[
                      message.sceneProposal.goal && 'objetivo',
                      message.sceneProposal.conflict && 'conflicto',
                      message.sceneProposal.outcome && 'resultado',
                      message.sceneProposal.dramaticTension && 'tensión',
                      message.sceneProposal.writingPlan && 'esquema',
                      message.sceneProposal.pov && 'POV',
                      message.sceneProposal.locationId && 'ubicación',
                      message.sceneProposal.characterIds?.length && 'personajes',
                      message.sceneProposal.plotIds?.length && 'tramas',
                      message.sceneProposal.itemIds?.length && 'ítems'
                    ].filter(Boolean).join(' · ')}
                  </p>
                  <button
                    className="btn btn-primary sm"
                    onClick={() => applySceneProposal(message)}
                    disabled={message.proposalApplied}
                  >
                    <Check size={12} />
                    {message.proposalApplied ? 'Aplicado a la escena' : 'Aplicar a la escena'}
                  </button>
                </div>
              )}
              {message.role === 'assistant' && message.content && !streaming && (
                <button className="chat-copy" onClick={() => void copy(message)}>
                  {copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === message.id ? 'Copiado' : 'Copiar'}
                </button>
              )}
              {message.isInspiration && parseIdeas(message.content).length > 0 && (
                <div className="ai-idea-buttons">
                  {parseIdeas(message.content).map((idea, index) => (
                    <button
                      key={index}
                      className="btn sm"
                      onClick={() => void send(`Aplica esta idea: ${idea}`)}
                    >
                      {idea.slice(0, 72)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ai-composer">
        {selectedNode?.type === 'scene' && (
          <>
            <button className="ai-scene-plan-trigger" onClick={inspire} disabled={!provider || streaming}>
              <WandSparkles size={13} />
              Inspirar
            </button>
            <button className="ai-scene-plan-trigger" onClick={planScene} disabled={!provider || streaming}>
              <WandSparkles size={13} />
              Preparar plan de escena
            </button>
          </>
        )}
        {!provider && (
          <div className="ai-provider-warning">
            No hay ningún modelo configurado.
            <button onClick={() => setSettingsOpen(true)}>Abrir ajustes</button>
          </div>
        )}
        <div className={`ai-input-wrap ${streaming ? 'streaming' : ''}`}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={provider ? 'Pregunta, planifica o pide ayuda con la escena...' : 'Configura un proveedor para conversar'}
            rows={3}
            disabled={!provider}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div className="ai-input-actions">
            <span className="ai-input-hint">Enter para enviar · Shift+Enter salto</span>
            {streaming ? (
              <button className="ai-send-btn stop" onClick={stop} title="Detener">
                <Square size={12} />
              </button>
            ) : (
              <button className="ai-send-btn" onClick={() => void send()} disabled={!draft.trim() || !provider} title="Enviar">
                <ArrowUp size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="ai-disclaimer">
          <Sparkles size={10} />
          La IA puede equivocarse. Revisa siempre sus propuestas.
        </div>
      </div>
    </div>
  )
}
