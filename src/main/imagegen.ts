import type { AiProvider, CoverGenerateRequest, ImageGenerateRequest } from '../shared/types'
import { getSettings, resolveProvider } from './settings'
import { authHeaders, friendlyError, openAiUrl, parseError, requireProviderApiKey, trimTrailingSlash } from './http'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_REFERENCE_IMAGE_BYTES = 12 * 1024 * 1024
const imageGenerationControllers = new Map<string, AbortController>()
const comfyImageRequests = new Map<string, { baseUrl: URL; headers: Record<string, string>; promptId: string }>()

function requestSignal(signal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('La generación de imágenes se canceló.')
}

async function waitForNextAttempt(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('La generación de imágenes se canceló.')
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, 2000)
    const onAbort = (): void => {
      clearTimeout(timeout)
      reject(new Error('La generación de imágenes se canceló.'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

export async function cancelImageGeneration(requestId: string): Promise<void> {
  imageGenerationControllers.get(requestId)?.abort()
  const comfyRequest = comfyImageRequests.get(requestId)
  if (!comfyRequest) return

  const queueUrl = new URL('/queue', comfyRequest.baseUrl)
  const queueResponse = await fetch(queueUrl, {
    method: 'GET',
    headers: comfyRequest.headers,
    signal: AbortSignal.timeout(5_000),
    redirect: 'error'
  })
  if (!queueResponse.ok) {
    throw new Error(`No se pudo comprobar la cola de ComfyUI para cancelar la tarea (HTTP ${queueResponse.status}).`)
  }
  const queue = await queueResponse.json() as {
    queue_running?: unknown[][]
    queue_pending?: unknown[][]
  }
  const isExactPrompt = (entry: unknown[]): boolean => entry[1] === comfyRequest.promptId
  const isRunning = (queue.queue_running || []).some(isExactPrompt)
  const isPending = (queue.queue_pending || []).some(isExactPrompt)

  if (isRunning) {
    const response = await fetch(new URL('/interrupt', comfyRequest.baseUrl), {
      method: 'POST',
      headers: comfyRequest.headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5_000),
      redirect: 'error'
    })
    if (!response.ok) throw new Error(`ComfyUI no pudo interrumpir la tarea activa (HTTP ${response.status}).`)
  } else if (isPending) {
    const response = await fetch(queueUrl, {
      method: 'POST',
      headers: comfyRequest.headers,
      body: JSON.stringify({ delete: [comfyRequest.promptId] }),
      signal: AbortSignal.timeout(5_000),
      redirect: 'error'
    })
    if (!response.ok) throw new Error(`ComfyUI no pudo quitar la tarea pendiente de la cola (HTTP ${response.status}).`)
  }
}

interface ReferenceImage {
  bytes: Buffer
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
}

function parseReferenceImage(dataUrl: string): ReferenceImage {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[2].length % 4 !== 0) {
    throw new Error('La imagen de referencia no es válida. Usa una imagen PNG, JPEG o WebP como data:image URL.')
  }
  if (match[2].length > Math.ceil(MAX_REFERENCE_IMAGE_BYTES / 3) * 4) {
    throw new Error('La imagen de referencia supera el límite de 12 MB. Usa una imagen más pequeña.')
  }
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.toString('base64') !== match[2]) {
    throw new Error('La imagen de referencia no contiene datos base64 válidos.')
  }
  if (bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error('La imagen de referencia supera el límite de 12 MB. Usa una imagen más pequeña.')
  }
  return { bytes, mimeType: match[1] as ReferenceImage['mimeType'] }
}

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

async function fetchImageAsDataUrl(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal: requestSignal(signal, 30_000), redirect: 'error' })
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

async function generateWithComfyUI(
  provider: AiProvider,
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal,
  requestId?: string
): Promise<string> {
  let baseUrl: URL
  try {
    baseUrl = new URL(provider.baseUrl)
  } catch {
    throw new Error(`La URL de ComfyUI «${provider.baseUrl}» no es válida.`)
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('La URL de ComfyUI debe usar HTTP o HTTPS y no puede incluir credenciales.')
  }
  baseUrl.pathname = trimTrailingSlash(baseUrl.pathname)
  baseUrl.search = ''
  baseUrl.hash = ''
  const endpoint = (path: string): string => new URL(path, baseUrl).toString()
  const headers = authHeaders(provider)
  const checkpointResponse = await fetch(endpoint('/object_info/CheckpointLoaderSimple'), {
    headers,
    signal: requestSignal(signal, 10_000),
    redirect: 'error'
  })
  if (!checkpointResponse.ok) {
    throw new Error(`No se pudieron consultar los checkpoints de ComfyUI (HTTP ${checkpointResponse.status}).`)
  }
  const checkpointInfo = (await checkpointResponse.json()) as {
    CheckpointLoaderSimple?: { input?: { required?: { ckpt_name?: [string[]] } } }
  }
  const checkpoints = checkpointInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []
  const requestedCheckpoint = provider.model.replace(/\\/g, '/').split('/').pop() || provider.model
  const checkpoint =
    checkpoints.find((name) => name === requestedCheckpoint) ||
    checkpoints.find((name) => name.replace(/\.[^.]+$/, '') === requestedCheckpoint.replace(/\.[^.]+$/, ''))
  if (!checkpoint) {
    throw new Error(
      `ComfyUI no tiene instalado el checkpoint «${requestedCheckpoint}». Selecciona un modelo disponible en Ajustes → IA.`
    )
  }
  const workflow = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint }
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['1', 1] }
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: ['1', 1] }
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 }
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        steps: 24,
        cfg: 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0]
      }
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] }
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'NovelCraft', images: ['6', 0] }
    }
  }
  const response = await fetch(endpoint('/prompt'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: workflow }),
    signal: requestSignal(signal, 30_000),
    redirect: 'error'
  })

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 405) {
      throw new Error(`ComfyUI rechazó POST /prompt (HTTP 405). Configura la URL base del servidor, por ejemplo http://127.0.0.1:8188, sin añadir /api.`)
    }
    throw new Error(`Error enviando la generación a ComfyUI (HTTP ${response.status}): ${text.slice(0, 500) || response.statusText}`)
  }

  const result = (await response.json()) as {
    prompt_id?: string
    error?: { message?: string; details?: string }
    node_errors?: Record<string, unknown>
  }

  const nodeErrorEntries = Object.entries(result.node_errors || {})
  if (result.error?.message || nodeErrorEntries.length > 0) {
    const nodeErrors = nodeErrorEntries
      .map(([nodeId, details]) => `${nodeId}: ${JSON.stringify(details)}`)
      .join('; ')
    throw new Error(`ComfyUI: ${result.error?.message || nodeErrors}`)
  }

  if (!result.prompt_id) {
    throw new Error('ComfyUI no devolvió un prompt_id. Comprueba que la URL apunta a la raíz del servidor.')
  }
  if (requestId) {
    comfyImageRequests.set(requestId, { baseUrl, headers, promptId: result.prompt_id })
  }

  const maxAttempts = 150
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await waitForNextAttempt(signal)
    const historyResponse = await fetch(endpoint(`/history/${encodeURIComponent(result.prompt_id)}`), {
      headers,
      signal: requestSignal(signal, 10_000),
      redirect: 'error'
    })

    if (historyResponse.status === 404) continue
    if (!historyResponse.ok) {
      throw new Error(`Error consultando el historial de ComfyUI (HTTP ${historyResponse.status}).`)
    }

    const history = (await historyResponse.json()) as Record<string, {
      status?: { status_str?: string; completed?: boolean; messages?: unknown[] }
      outputs?: Record<string, { images?: Array<{ filename?: string; subfolder?: string; type?: string }> }>
    }>
    const job = history[result.prompt_id]
    if (job?.status?.status_str === 'error') {
      throw new Error(`ComfyUI no pudo ejecutar el workflow: ${JSON.stringify(job.status.messages || []).slice(0, 500)}`)
    }
    if (job?.status?.completed || job?.status?.status_str === 'success') {
      const image = Object.values(job.outputs || {})
        .flatMap((output) => output.images || [])
        .find((item) => item.filename)
      if (!image?.filename) {
        throw new Error('ComfyUI terminó la petición, pero no devolvió ninguna imagen.')
      }
      const imageUrl = new URL('/view', baseUrl)
      imageUrl.searchParams.set('filename', image.filename)
      imageUrl.searchParams.set('subfolder', image.subfolder || '')
      imageUrl.searchParams.set('type', image.type || 'output')
      return fetchImageAsDataUrlWithHeaders(imageUrl.toString(), headers, signal)
    }
  }

  throw new Error('ComfyUI no completó la generación en cinco minutos. Comprueba el estado del servidor y el modelo.')
}

async function fetchImageAsDataUrlWithHeaders(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers,
    signal: requestSignal(signal, 30_000),
    redirect: 'error'
  })
  if (!response.ok) throw new Error(`No se pudo descargar la imagen de ComfyUI (HTTP ${response.status}).`)
  const buffer = Buffer.from(await response.arrayBuffer())
  validateSize(buffer.byteLength)
  if (!buffer.byteLength) throw new Error('ComfyUI devolvió una imagen vacía.')
  const mime = response.headers.get('content-type')?.split(';')[0]
  return toDataUrl(buffer.toString('base64'), mime?.startsWith('image/') ? mime : undefined)
}

async function generateWithOpenAi(
  provider: AiProvider,
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<string> {
  const response = await fetch(openAiUrl(provider.baseUrl, '/images/generations'), {
    method: 'POST',
    headers: authHeaders(provider),
    signal: requestSignal(signal, 120_000),
    body: JSON.stringify({
      model: provider.model,
      prompt,
      n: 1,
      size: aspectToOpenAiSize(width, height),
      ...(/^gpt-image-/i.test(provider.model) ? {} : { response_format: 'b64_json' })
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
    return toDataUrl(item.b64_json, /^gpt-image-/i.test(provider.model) ? 'image/png' : undefined)
  }
  if (item.url) return fetchImageAsDataUrl(item.url, signal)
  throw new Error('La respuesta del proveedor no contenía la imagen.')
}

async function editWithOpenAi(
  provider: AiProvider,
  prompt: string,
  width: number,
  height: number,
  referenceImage: ReferenceImage,
  signal: AbortSignal
): Promise<string> {
  const form = new FormData()
  form.set('model', provider.model)
  form.set('prompt', prompt)
  form.set('n', '1')
  form.set('size', aspectToOpenAiSize(width, height))
  form.set(
    'image',
    new Blob([Uint8Array.from(referenceImage.bytes)], { type: referenceImage.mimeType }),
    `reference.${referenceImage.mimeType.split('/')[1]}`
  )

  const headers = authHeaders(provider)
  delete headers['Content-Type']
  const response = await fetch(openAiUrl(provider.baseUrl, '/images/edits'), {
    method: 'POST',
    headers,
    signal: requestSignal(signal, 120_000),
    body: form
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
    return toDataUrl(item.b64_json, /^gpt-image-/i.test(provider.model) ? 'image/png' : undefined)
  }
  if (item.url) return fetchImageAsDataUrl(item.url, signal)
  throw new Error('La respuesta del proveedor no contenía la imagen.')
}

async function generateWithOllama(provider: AiProvider, prompt: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(openAiUrl(provider.baseUrl, '/api/generate'), {
    method: 'POST',
    headers: authHeaders(provider),
    signal: requestSignal(signal, 120_000),
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

async function generateWithAnthropic(provider: AiProvider, prompt: string, signal: AbortSignal): Promise<string> {
  const base = openAiUrl(provider.baseUrl, '')
  const endpoint = /\/v\d+$/.test(base) ? `${base}/messages` : `${base}/v1/messages`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(provider, true),
    signal: requestSignal(signal, 120_000),
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

function generateImageImpl(
  provider: AiProvider,
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal = new AbortController().signal,
  referenceImage?: ReferenceImage,
  requestId?: string
): Promise<string> {
  if (referenceImage) {
    if (provider.protocol !== 'openai') {
      throw new Error(`El proveedor «${provider.name}» no admite imágenes de referencia. Selecciona un proveedor OpenAI compatible con /images/edits.`)
    }
    return editWithOpenAi(provider, prompt, width, height, referenceImage, signal)
  }
  if (provider.protocol === 'comfyui') return generateWithComfyUI(provider, prompt, width, height, signal, requestId)
  if (provider.protocol === 'ollama') return generateWithOllama(provider, prompt, signal)
  if (provider.protocol === 'anthropic') return generateWithAnthropic(provider, prompt, signal)
  return generateWithOpenAi(provider, prompt, width, height, signal)
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
  requireProviderApiKey(provider)
  const width = Math.min(2048, Math.max(256, request.width || 1024))
  const height = Math.min(2048, Math.max(256, request.height || 1536))
  try {
    return await generateImageImpl(provider, prompt, width, height)
  } catch (error) {
    throw new Error(friendlyError(error, provider))
  }
}

export async function generateImage(request: ImageGenerateRequest, requestId = request.requestId): Promise<string> {
  const controller = new AbortController()
  if (requestId) {
    imageGenerationControllers.get(requestId)?.abort()
    imageGenerationControllers.set(requestId, controller)
  }
  let provider: AiProvider | null = null
  try {
    const prompt = request.prompt.trim()
    if (!prompt) throw new Error('Escribe una descripción para la imagen antes de generarla.')
    const settings = await getSettings()
    const providerId = request.providerId || settings.ai.imageProviderId || settings.ai.activeProviderId
    provider = await resolveProvider(providerId)
    if (!provider) throw new Error('No hay ningún proveedor configurado. Añade uno en Ajustes → IA.')
    if (!provider.baseUrl || !provider.model) {
      throw new Error(`El proveedor «${provider.name}» necesita una URL y un modelo de imágenes.`)
    }
    requireProviderApiKey(provider)
    throwIfAborted(controller.signal)
    const referenceImage = request.referenceImage === undefined
      ? undefined
      : parseReferenceImage(request.referenceImage)
    const width = Math.min(2048, Math.max(256, request.width || 1024))
    const height = Math.min(2048, Math.max(256, request.height || 1024))
    return await generateImageImpl(provider, prompt, width, height, controller.signal, referenceImage, requestId)
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La generación de imágenes se canceló.')
    if (provider) throw new Error(friendlyError(error, provider))
    throw error
  } finally {
    if (requestId && imageGenerationControllers.get(requestId) === controller) {
      imageGenerationControllers.delete(requestId)
      comfyImageRequests.delete(requestId)
    }
  }
}
