import type { AiProvider } from '../shared/types'

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function openAiUrl(baseUrl: string, endpoint: string): string {
  const base = trimTrailingSlash(baseUrl)
  return `${base}${endpoint}`
}

export function friendlyError(error: unknown, provider: AiProvider): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'fetch failed' || message.includes('ECONNREFUSED')) {
    if (provider.category === 'local') {
      return `No se pudo conectar con ${provider.name} en ${provider.baseUrl}. Comprueba que el servidor local esté en marcha.`
    }
    return `No se pudo conectar con ${provider.name}. Revisa tu conexión y la URL del proveedor.`
  }
  return message
}

export async function parseError(response: Response): Promise<string> {
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

export function authHeaders(provider: AiProvider, anthropic = false): Record<string, string> {
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
