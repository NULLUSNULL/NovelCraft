import type { AiProvider, CoverGenerateRequest } from '../shared/types'
import { getSettings, resolveProvider } from './settings'
import { authHeaders, friendlyError, openAiUrl, parseError } from './http'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

function guessMime(base64: string, fallback = 'image/jpeg'): string {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  void fallback
  return 'image/jpeg'
}

function toDataUrl(base64: string, mime?: string): string {
  const clean = base64.replace(/\s/g, '')
  if (clean.startsWith('data:image/')) return clean
  return `data:${mime || guessMime(clean)};base64,${clean}`
}

function validateSize(byteLength: number): void {
  if (byteLength > MAX_IMAGE_BYTES) {
    throw new Error('La imagen generada supera los 12 MB. Prueba con un modelo o proveedor distinto.')
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`No se pudo descargar la imagen generada (Error ${response.status}).`)
  const buffer = Buffer.from(await response.arrayBuffer())
  validateSize(buffer.byteLength)
  const mime = response.headers.get('content-type')?.split(';')[0]
  if (!buffer.byteLength) throw new Error('El proveedor devolvió una imagen vacía.')
  return toDataUrl(buffer.toString('base64'), mime && mime.startsWith('image/') ? mime : undefined)
}

function aspectToOpenAiSize(width: number, height: number): string {
  if (Math.abs(width - height) < 1) return '1024x1024'
  return width > height ? '1536x1024' : '1024x1536'
}

async function generateWithOpenAi(
  provider: AiProvider,
  prompt: string,
  width: number,
  height: number
): Promise<string> {
  const response = await fetch(openAiUrl(provider.baseUrl, '/images/generations'), {
    method: 'POST',
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      prompt,
      n: 1,
      size: aspectToOpenAiSize(width, height),
      response_format: 'b64_json'
    })
  })
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(data.error.message)
  const item = data.data?.[0]
  if (!item) throw new Error('El proveedor no devolvió ninguna imagen.')
  if (item.b64_json) {
    validateSize(Math.ceil((item.b64_json.length * 3) / 4))
    return toDataUrl(item.b64_json)
  }
  if (item.url) return fetchImageAsDataUrl(item.url)
  throw new Error('La respuesta del proveedor no contenía la imagen.')
}

async function generateWithOllama(provider: AiProvider, prompt: string): Promise<string> {
  const response = await fetch(openAiUrl(provider.baseUrl, '/api/generate'), {
    method: 'POST',
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: provider.temperature }
    })
  })
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as {
    response?: string
    images?: string[]
    image?: string
    error?: string
  }
  if (data.error) throw new Error(data.error)
  if (data.images?.[0]) {
    validateSize(Math.ceil((data.images[0].length * 3) / 4))
    return toDataUrl(data.images[0])
  }
  if (data.image) {
    validateSize(Math.ceil((data.image.length * 3) / 4))
    return toDataUrl(data.image)
  }
  const text = (data.response || '').trim()
  if (!text) throw new Error('El modelo de Ollama no devolvió contenido.')
  let payload: unknown = null
  try {
    payload = JSON.parse(text)
  } catch {
    const match = text.match(/(?:data:image\/[a-z]+;base64,|base64,)?([A-Za-z0-9+/=\s]{2000,})/)
    if (match?.[1]) {
      const base64 = match[1].replace(/\s/g, '')
      validateSize(Math.ceil((base64.length * 3) / 4))
      return toDataUrl(base64)
    }
    throw new Error(
      `El modelo «${provider.model}» no generó una imagen. Usa un modelo de generación de imágenes (p. ej. con el plugin Stable Diffusion de Ollama) o selecciona otro proveedor en Ajustes → IA.`
    )
  }
  const extracted = extractBase64Image(payload)
  if (!extracted) {
    throw new Error(
      `El modelo «${provider.model}» respondió sin una imagen. Selecciona un proveedor capaz de generar imágenes en Ajustes → IA.`
    )
  }
  validateSize(Math.ceil((extracted.length * 3) / 4))
  return toDataUrl(extracted)
}

function extractBase64Image(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null
  if (typeof value === 'string') {
    const match = value.match(/^data:image\/[a-z+]+;base64,(.+)$/s) || value.match(/^([A-Za-z0-9+/]{2000,}={0,2})$/)
    return match ? match[1] : null
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = extractBase64Image(entry, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['image', 'image_base64', 'b64_json', 'base64', 'images']) {
      if (key in record) {
        const found = extractBase64Image(record[key], depth + 1)
        if (found) return found
      }
    }
  }
  return null
}

async function generateWithAnthropic(provider: AiProvider, prompt: string): Promise<string> {
  const base = openAiUrl(provider.baseUrl, '')
  const endpoint = /\/v\d+$/.test(base) ? `${base}/messages` : `${base}/v1/messages`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(provider, true),
    body: JSON.stringify({
      model: provider.model,
      max_tokens: provider.maxTokens,
      messages: [
        {
          role: 'user',
          content: `You are an image generator. Generate exactly one image and nothing else.\nPrompt: ${prompt}`
        }
      ]
    })
  })
  if (!response.ok) throw new Error(await parseError(response))
  const data = (await response.json()) as {
    content?: Array<{ type: string; source?: { type?: string; media_type?: string; data?: string } }>
    stop_reason?: string
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(data.error.message)
  const block = (data.content || []).find((entry) => entry.type === 'image' && entry.source?.data)
  if (!block?.source?.data) {
    throw new Error(
      `El modelo «${provider.model}» no devolvió una imagen. Los modelos de Anthropic actuales no generan imágenes; usa un proveedor compatible con OpenAI (DALL·E, gpt-image-1) u Ollama con Stable Diffusion.`
    )
  }
  validateSize(Math.ceil((block.source.data.length * 3) / 4))
  return toDataUrl(block.source.data, block.source.media_type)
}

export async function generateCoverImage(request: CoverGenerateRequest): Promise<string> {
  const prompt = request.prompt.trim()
  if (!prompt) throw new Error('Escribe una descripción para la portada antes de generarla.')
  const settings = await getSettings()
  const providerId = request.providerId || settings.ai.imageProviderId || settings.ai.activeProviderId
  const provider = await resolveProvider(providerId)
  if (!provider) throw new Error('No hay ningún proveedor configurado. Añade uno en Ajustes → IA.')
  if (!provider.baseUrl || !provider.model) {
    throw new Error(`El proveedor «${provider.name}» necesita una URL y un modelo de imágenes.`)
  }
  const width = Math.min(2048, Math.max(256, request.width || 1024))
  const height = Math.min(2048, Math.max(256, request.height || 1536))
  try {
    if (provider.protocol === 'ollama') return await generateWithOllama(provider, prompt)
    if (provider.protocol === 'anthropic') return await generateWithAnthropic(provider, prompt)
    return await generateWithOpenAi(provider, prompt, width, height)
  } catch (error) {
    throw new Error(friendlyError(error, provider))
  }
}
