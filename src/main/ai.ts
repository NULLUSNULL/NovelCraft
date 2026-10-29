import type { AiMessage, AiProvider, AiRequest, AiStreamEvent } from '../shared/types'
import { resolveProvider } from './settings'

const controllers = new Map<string, AbortController>()

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function openAiUrl(baseUrl: string, endpoint: string): string {
  const base = trimTrailingSlash(baseUrl)
  return `${base}${endpoint}`
}

function anthropicUrl(baseUrl: string): string {
  const base = trimTrailingSlash(baseUrl)
  return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`
}

function anthropicModelsUrl(baseUrl: string): string {
  const base = trimTrailingSlash(baseUrl)
  return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
}

function friendlyError(error: unknown, provider: AiProvider): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'fetch failed' || message.includes('ECONNREFUSED')) {
    if (provider.category === 'local') {
      return `No se pudo conectar con ${provider.name} en ${provider.baseUrl}. Comprueba que el servidor local esté en marcha.`
    }
    return `No se pudo conectar con ${provider.name}. Revisa tu conexión y la URL del proveedor.`
  }
  return message
}

async function parseError(response: Response): Promise<string> {
  let detail = ''
  try {
    const text = await response.text()
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    if (typeof parsed.error === 'string') detail = parsed.error
    else if (parsed.error?.message) detail = parsed.error.message
    else if (parsed.message) detail = parsed.message
    else detail = text.slice(0, 400)
  } catch {
    detail = response.statusText
  }
  return `Error ${response.status}: ${detail || response.statusText || 'respuesta no válida'}`
}

async function consumeSse(
  response: Response,
  onData: (data: string) => void
): Promise<void> {
  if (!response.body) throw new Error('El proveedor no devolvió contenido')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data:')) onData(line.slice(5).trim())
    }
  }
  buffer += decoder.decode()
  if (buffer.startsWith('data:')) onData(buffer.slice(5).trim())
}

async function consumeNdjson(response: Response, onLine: (line: string) => void): Promise<void> {
  if (!response.body) throw new Error('El proveedor no devolvió contenido')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) if (line.trim()) onLine(line.trim())
  }
  if (buffer.trim()) onLine(buffer.trim())
}

function authHeaders(provider: AiProvider, anthropic = false): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) {
    if (anthropic) {
      headers['x-api-key'] = provider.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers.Authorization = `Bearer ${provider.apiKey}`
    }
  }
  return headers
}

function openAiMessages(messages: AiMessage[]): AiMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }))
}

function anthropicMessages(messages: AiMessage[]): {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: message.content
    }))
  return { system, messages: conversation }
}

async function streamProvider(
  provider: AiProvider,
  messages: AiMessage[],
  onDelta: (delta: string) => void,
  signal: AbortSignal,
  temperature: number,
  maxTokens: number
): Promise<string> {
  let full = ''

  if (provider.protocol === 'ollama') {
    const response = await fetch(openAiUrl(provider.baseUrl, '/api/chat'), {
      method: 'POST',
      headers: authHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        messages: openAiMessages(messages),
        stream: true,
        options: { temperature, num_predict: maxTokens }
      }),
      signal
    })
    if (!response.ok) throw new Error(await parseError(response))
    await consumeNdjson(response, (line) => {
      try {
        const event = JSON.parse(line) as {
          message?: { content?: string }
          error?: string
          done?: boolean
        }
        if (event.error) throw new Error(event.error)
        const delta = event.message?.content || ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch (error) {
        if (error instanceof SyntaxError) return
        throw error
      }
    })
    return full
  }

  if (provider.protocol === 'anthropic') {
    const payload = anthropicMessages(messages)
    const response = await fetch(anthropicUrl(provider.baseUrl), {
      method: 'POST',
      headers: authHeaders(provider, true),
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        system: payload.system || undefined,
        messages: payload.messages,
        stream: true
      }),
      signal
    })
    if (!response.ok) throw new Error(await parseError(response))
    await consumeSse(response, (data) => {
      if (!data || data === '[DONE]') return
      try {
        const event = JSON.parse(data) as {
          type?: string
          delta?: { type?: string; text?: string }
          error?: { message?: string }
        }
        if (event.type === 'error') throw new Error(event.error?.message || 'Error de Anthropic')
        if (event.type === 'content_block_delta' && event.delta?.text) {
          full += event.delta.text
          onDelta(event.delta.text)
        }
      } catch (error) {
        if (error instanceof SyntaxError) return
        throw error
      }
    })
    return full
  }

  const response = await fetch(openAiUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      messages: openAiMessages(messages),
      stream: true,
      temperature,
      max_tokens: maxTokens
    }),
    signal
  })
  if (!response.ok) throw new Error(await parseError(response))
  await consumeSse(response, (data) => {
    if (!data || data === '[DONE]') return
    try {
      const event = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string }; text?: string; finish_reason?: string }>
        error?: { message?: string }
      }
      if (event.error?.message) throw new Error(event.error.message)
      const delta = event.choices?.[0]?.delta?.content || event.choices?.[0]?.text || ''
      if (delta) {
        full += delta
        onDelta(delta)
      }
    } catch (error) {
      if (error instanceof SyntaxError) return
      throw error
    }
  })
  return full
}

async function completeProvider(
  provider: AiProvider,
  messages: AiMessage[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal
): Promise<string> {
  if (provider.protocol === 'ollama') {
    const response = await fetch(openAiUrl(provider.baseUrl, '/api/chat'), {
      method: 'POST',
      headers: authHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        messages: openAiMessages(messages),
        stream: false,
        options: { temperature, num_predict: maxTokens }
      }),
      signal
    })
    if (!response.ok) throw new Error(await parseError(response))
    const data = (await response.json()) as { message?: { content?: string }; error?: string }
    if (data.error) throw new Error(data.error)
    return data.message?.content || ''
  }
  if (provider.protocol === 'anthropic') {
    const payload = anthropicMessages(messages)
    const response = await fetch(anthropicUrl(provider.baseUrl), {
      method: 'POST',
      headers: authHeaders(provider, true),
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        system: payload.system || undefined,
        messages: payload.messages
      }),
      signal
    })
    if (!response.ok) throw new Error(await parseError(response))
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    }
    if (data.error) throw new Error(data.error.message)
    return (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('')
  }
  const response = await fetch(openAiUrl(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      messages: openAiMessages(messages),
      stream: false,
      temperature,
      max_tokens: maxTokens
    }),
    signal
  })
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  if (data.error) throw new Error(data.error.message)
  return data.choices?.[0]?.message?.content || ''
}

export async function streamAiChat(
  request: AiRequest,
  onEvent: (event: AiStreamEvent) => void
): Promise<{ content: string }> {
  const provider = await resolveProvider(request.providerId)
  if (!provider) {
    const error = 'No hay un proveedor de IA configurado. Añade uno en Ajustes → IA.'
    onEvent({ requestId: request.requestId, error, done: true })
    throw new Error(error)
  }
  if (!provider.baseUrl || !provider.model) {
    const error = 'El proveedor de IA necesita una URL y un modelo.'
    onEvent({ requestId: request.requestId, error, done: true })
    throw new Error(error)
  }
  const controller = new AbortController()
  controllers.set(request.requestId, controller)
  try {
    const content = await streamProvider(
      provider,
      request.messages,
      (delta) => onEvent({ requestId: request.requestId, delta }),
      controller.signal,
      request.temperature ?? provider.temperature,
      request.maxTokens ?? provider.maxTokens
    )
    onEvent({ requestId: request.requestId, done: true })
    return { content }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      onEvent({ requestId: request.requestId, done: true })
      return { content: '' }
    }
    const message = friendlyError(error, provider)
    onEvent({ requestId: request.requestId, error: message, done: true })
    throw new Error(message)
  } finally {
    controllers.delete(request.requestId)
  }
}

export async function aiComplete(
  providerId: string,
  messages: AiMessage[],
  temperature?: number,
  maxTokens?: number
): Promise<{ content: string }> {
  const provider = await resolveProvider(providerId)
  if (!provider) throw new Error('No hay un proveedor de IA configurado')
  try {
    const content = await completeProvider(
      provider,
      messages,
      temperature ?? provider.temperature,
      maxTokens ?? provider.maxTokens
    )
    return { content }
  } catch (error) {
    throw new Error(friendlyError(error, provider))
  }
}

export function cancelAiRequest(requestId: string): void {
  controllers.get(requestId)?.abort()
  controllers.delete(requestId)
}

export async function discoverModels(
  providerId: string,
  override?: AiProvider
): Promise<string[]> {
  const provider = await resolveProvider(providerId, override)
  if (!provider) throw new Error('Proveedor no encontrado')
  try {
    if (provider.protocol === 'ollama') {
      const response = await fetch(openAiUrl(provider.baseUrl, '/api/tags'), {
        headers: authHeaders(provider)
      })
      if (!response.ok) throw new Error(await parseError(response))
      const data = (await response.json()) as { models?: Array<{ name?: string }> }
      return (data.models || []).map((model) => model.name || '').filter(Boolean)
    }
    if (provider.protocol === 'anthropic') {
      const response = await fetch(anthropicModelsUrl(provider.baseUrl), {
        headers: authHeaders(provider, true)
      })
      if (!response.ok) throw new Error(await parseError(response))
      const data = (await response.json()) as { data?: Array<{ id?: string }> }
      const models = (data.data || []).map((model) => model.id || '').filter(Boolean)
      return models.length ? models : [provider.model]
    }
    const response = await fetch(openAiUrl(provider.baseUrl, '/models'), {
      headers: authHeaders(provider)
    })
    if (!response.ok) throw new Error(await parseError(response))
    const data = (await response.json()) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string }> }
    const models = (data.data || data.models || []).map((model) => model.id || '').filter(Boolean)
    return models.length ? models : [provider.model]
  } catch (error) {
    throw new Error(friendlyError(error, provider))
  }
}

export async function testAiProvider(
  providerId: string,
  override?: AiProvider
): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    const models = await discoverModels(providerId, override)
    return {
      ok: true,
      message:
        models.length > 0
          ? `Conexión correcta. ${models.length} modelo${models.length === 1 ? '' : 's'} disponible${models.length === 1 ? '' : 's'}.`
          : 'Conexión correcta.',
      models
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'No se pudo conectar' }
  }
}
