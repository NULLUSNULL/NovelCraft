import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  MessageSquare,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  WandSparkles
} from 'lucide-react'
import { buildProjectContext } from '@shared/project'
import { useAppStore } from '../store/useAppStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  error?: boolean
}

const SUGGESTIONS = [
  '¿Detectas incoherencias en la cronología de mi novela?',
  'Resume la trama principal y sus conflictos abiertos.',
  'Propón tres giros que encajen con el tema.',
  'Analiza la voz de mi protagonista y cómo hacerla más distintiva.'
]

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

export function AiAssistant() {
  const project = useAppStore((state) => state.project)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const settings = useAppStore((state) => state.settings)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const pushToast = useAppStore((state) => state.pushToast)
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
    try {
      const stored = localStorage.getItem(storageKey)
      setMessages(stored ? (JSON.parse(stored) as ChatMessage[]) : [])
    } catch {
      setMessages([])
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)))
    } catch {
      undefined
    }
  }, [messages, storageKey])

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

  const send = async (text?: string): Promise<void> => {
    const content = (text ?? draft).trim()
    if (!content || !project || !provider || streaming) return
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
      createdAt: new Date().toISOString()
    }
    const conversation = [...messagesRef.current, userMessage].filter((message) => !message.error)
    setMessages([...messagesRef.current, userMessage, assistantMessage])
    setDraft('')
    setStreaming(true)
    setRequestId(id)
    requestRef.current = id
    try {
      const context = buildProjectContext(project, selectedDocumentId, settings.ai)
      const system = `Eres el asistente literario de NovelCraft. Ayudas al autor a planificar, revisar y escribir su novela con respeto absoluto por su voz y su canon. Tienes acceso al siguiente contexto del proyecto:\n\n${context}\n\nResponde en el idioma del proyecto. Sé concreto, útil y honesto. Si el contexto no contiene la respuesta, dilo en lugar de inventar. Puedes proponer alternativas, pero no reescribas el manuscrito salvo que se te pida. Usa párrafos breves y listas cuando aporten claridad.`
      const requestMessages = [
        { role: 'system' as const, content: system },
        ...conversation.slice(-12).map((message) => ({ role: message.role, content: message.content })),
        { role: 'user' as const, content }
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
          </div>
        </div>
        <div className="row">
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

      <div className="ai-messages" ref={scrollRef}>
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
              {message.role === 'assistant' && message.content && !streaming && (
                <button className="chat-copy" onClick={() => void copy(message)}>
                  {copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === message.id ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ai-composer">
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
