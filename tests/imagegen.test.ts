import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiProvider } from '../src/shared/types'
import { DEFAULT_SETTINGS } from '../src/shared/defaults'

vi.mock('../src/main/settings', () => ({
  getSettings: vi.fn(),
  resolveProvider: vi.fn()
}))

import { getSettings, resolveProvider } from '../src/main/settings'
import { cancelImageGeneration, generateImage } from '../src/main/imagegen'

describe('image generation', () => {
  const provider: AiProvider = {
    id: 'comfyui-test',
    name: 'ComfyUI test',
    protocol: 'comfyui',
    category: 'local',
    baseUrl: 'http://127.0.0.1:8188',
    model: 'test-checkpoint.safetensors',
    temperature: 0.7,
    maxTokens: 2048,
    supportsImages: true
  }
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    const settings = structuredClone(DEFAULT_SETTINGS)
    settings.ai.imageProviderId = provider.id
    settings.providers = [provider]
    vi.mocked(getSettings).mockResolvedValue(settings)
    vi.mocked(resolveProvider).mockResolvedValue(provider)

    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname === '/object_info/CheckpointLoaderSimple') {
        return new Response(JSON.stringify({
          CheckpointLoaderSimple: {
            input: { required: { ckpt_name: [['test-checkpoint.safetensors']] } }
          }
        }))
      }
      if (url.pathname === '/prompt') {
        return new Response(JSON.stringify({ prompt_id: 'test-prompt-id', node_errors: {} }))
      }
      if (url.pathname === '/history/test-prompt-id') {
        return new Response(JSON.stringify({
          'test-prompt-id': {
            status: { status_str: 'success', completed: true },
            outputs: {
              '7': { images: [{ filename: 'NovelCraft_00001_.png', subfolder: '', type: 'output' }] }
            }
          }
        }))
      }
      if (url.pathname === '/view') {
        return new Response(Uint8Array.from([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png' }
        })
      }
      throw new Error(`Unexpected ComfyUI request: ${init?.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('submits the standard workflow endpoint and retrieves the generated image', async () => {
    const result = await generateImage({
      providerId: provider.id,
      prompt: 'A lighthouse in a storm',
      kind: 'cover',
      aspect: 'portrait',
      style: 'illustration',
      width: 1024,
      height: 1536,
      entityKind: '',
      entityId: ''
    })

    expect(result).toMatch(/^data:image\/png;base64,/)
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/object_info/CheckpointLoaderSimple',
      '/prompt',
      '/history/test-prompt-id',
      '/view'
    ])
    const submitted = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>
    }
    expect(submitted.prompt['1'].inputs.ckpt_name).toBe('test-checkpoint.safetensors')
    expect(submitted.prompt['4'].inputs).toMatchObject({ width: 1024, height: 1536 })
    expect(submitted.prompt['7'].class_type).toBe('SaveImage')
  })

  it('aborts an in-flight image request by request ID', async () => {
    const cloudProvider: AiProvider = {
      ...provider,
      id: 'openai-cancel-test',
      protocol: 'openai',
      category: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      apiKey: 'test-api-key'
    }
    vi.mocked(resolveProvider).mockResolvedValue(cloudProvider)
    let requestSignal: AbortSignal | undefined
    fetchMock = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      requestSignal = init?.signal as AbortSignal
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const generation = generateImage({
      providerId: cloudProvider.id,
      prompt: 'A character pose',
      requestId: 'cancel-me',
      kind: 'pose', aspect: 'portrait', style: 'auto',
      entityKind: 'character', entityId: 'character-1'
    })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    cancelImageGeneration('cancel-me')

    await expect(generation).rejects.toThrow('se canceló')
    expect(requestSignal?.aborted).toBe(true)
  })

  it('interrupts ComfyUI only when the exact prompt ID is running', async () => {
    const requestId = 'comfy-cancel-me'
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname === '/object_info/CheckpointLoaderSimple') {
        return new Response(JSON.stringify({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['test-checkpoint.safetensors']] } } } }))
      }
      if (url.pathname === '/prompt') return new Response(JSON.stringify({ prompt_id: 'our-prompt-id', node_errors: {} }))
      if (url.pathname === '/queue' && init?.method !== 'POST') {
        return new Response(JSON.stringify({
          queue_running: [[1, 'another-running-prompt']],
          queue_pending: []
        }))
      }
      if (url.pathname === '/interrupt') return new Response('{}')
      throw new Error(`Unexpected ComfyUI request: ${init?.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const generation = generateImage({
      providerId: provider.id, prompt: 'A character pose', requestId,
      kind: 'pose', aspect: 'portrait', style: 'auto',
      entityKind: 'character', entityId: 'character-1'
    })
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === '/prompt')).toBe(true))
    await expect(cancelImageGeneration(requestId)).resolves.toBeUndefined()
    await expect(generation).rejects.toThrow('se canceló')
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === '/interrupt')).toBe(false)
    expect(fetchMock.mock.calls.some(([url, init]) => new URL(String(url)).pathname === '/queue' && init?.method === 'POST')).toBe(false)
  })

  it('removes only its queued ComfyUI prompt on cancellation', async () => {
    const requestId = 'comfy-pending-cancel'
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname === '/object_info/CheckpointLoaderSimple') {
        return new Response(JSON.stringify({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['test-checkpoint.safetensors']] } } } }))
      }
      if (url.pathname === '/prompt') return new Response(JSON.stringify({ prompt_id: 'our-pending-id', node_errors: {} }))
      if (url.pathname === '/queue' && init?.method === 'POST') return new Response('{}')
      if (url.pathname === '/queue') {
        return new Response(JSON.stringify({ queue_running: [], queue_pending: [[2, 'our-pending-id']] }))
      }
      throw new Error(`Unexpected ComfyUI request: ${init?.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const generation = generateImage({
      providerId: provider.id, prompt: 'A character pose', requestId,
      kind: 'pose', aspect: 'portrait', style: 'auto',
      entityKind: 'character', entityId: 'character-1'
    })
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === '/prompt')).toBe(true))
    await expect(cancelImageGeneration(requestId)).resolves.toBeUndefined()
    await expect(generation).rejects.toThrow('se canceló')

    const deleteCall = fetchMock.mock.calls.find(([url, init]) => new URL(String(url)).pathname === '/queue' && init?.method === 'POST')
    expect(JSON.parse(String(deleteCall?.[1]?.body))).toEqual({ delete: ['our-pending-id'] })
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).pathname === '/interrupt')).toBe(false)
  })

  it('uses the cloud OpenAI Images API without the unsupported response_format for gpt-image models', async () => {
    const cloudProvider: AiProvider = {
      ...provider,
      id: 'openai-images-test',
      name: 'OpenAI Images',
      protocol: 'openai',
      category: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      apiKey: 'test-api-key'
    }
    vi.mocked(resolveProvider).mockResolvedValue(cloudProvider)
    fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toMatchObject({
        model: 'gpt-image-1',
        prompt: 'A lighthouse in a storm',
        size: '1024x1536',
        n: 1
      })
      expect(body).not.toHaveProperty('response_format')
      return new Response(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage({
      providerId: cloudProvider.id,
      prompt: 'A lighthouse in a storm',
      kind: 'cover',
      aspect: 'portrait',
      style: 'illustration',
      width: 1024,
      height: 1536,
      entityKind: '',
      entityId: ''
    })

    expect(result).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('uses multipart OpenAI image edits when a reference image is provided', async () => {
    const cloudProvider: AiProvider = {
      ...provider,
      id: 'openai-edit-test',
      name: 'OpenAI Images',
      protocol: 'openai',
      category: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      apiKey: 'test-api-key'
    }
    vi.mocked(resolveProvider).mockResolvedValue(cloudProvider)
    fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-api-key' })
      expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined()
      expect(init?.body).toBeInstanceOf(FormData)
      const form = init?.body as FormData
      expect(form.get('model')).toBe('gpt-image-1')
      expect(form.get('prompt')).toBe('Keep this character recognizable')
      expect(form.get('n')).toBe('1')
      expect(form.get('size')).toBe('1024x1536')
      const image = form.get('image') as File
      expect(image.type).toBe('image/png')
      expect(image.name).toBe('reference.png')
      expect(Buffer.from(await image.arrayBuffer()).toString('base64')).toBe('iVBORw0KGgo=')
      return new Response(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage({
      providerId: cloudProvider.id,
      prompt: 'Keep this character recognizable',
      referenceImage: 'data:image/png;base64,iVBORw0KGgo=',
      kind: 'pose', aspect: 'portrait', style: 'auto', width: 1024, height: 1536,
      entityKind: 'character', entityId: 'character-1'
    })

    expect(result).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/v1/images/edits')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects reference images for unsupported providers without making a request', async () => {
    await expect(generateImage({
      providerId: provider.id, prompt: 'A pose',
      referenceImage: 'data:image/png;base64,iVBORw0KGgo=',
      kind: 'pose', aspect: 'portrait', style: 'auto',
      entityKind: 'character', entityId: 'character-1'
    })).rejects.toThrow('no admite imágenes de referencia')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid and oversized reference data URLs before making a request', async () => {
    const request = {
      providerId: 'openai-images-invalid', prompt: 'A pose',
      kind: 'pose' as const, aspect: 'portrait' as const, style: 'auto' as const,
      entityKind: 'character' as const, entityId: 'character-1'
    }
    const cloudProvider: AiProvider = {
      ...provider, id: request.providerId, protocol: 'openai', category: 'cloud',
      baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1', apiKey: 'test-api-key'
    }
    vi.mocked(resolveProvider).mockResolvedValue(cloudProvider)

    await expect(generateImage({ ...request, referenceImage: 'https://example.com/image.png' }))
      .rejects.toThrow('no es válida')
    const oversizedDataUrl = `data:image/png;base64,${Buffer.alloc(12 * 1024 * 1024 + 1).toString('base64')}`
    await expect(generateImage({ ...request, referenceImage: oversizedDataUrl }))
      .rejects.toThrow('supera el límite de 12 MB')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains when a cloud image provider has no API key configured', async () => {
    const cloudProvider: AiProvider = {
      ...provider,
      id: 'openai-images-no-key',
      name: 'OpenAI Images',
      protocol: 'openai',
      category: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1'
    }
    vi.mocked(resolveProvider).mockResolvedValue(cloudProvider)

    await expect(generateImage({
      providerId: cloudProvider.id,
      prompt: 'A lighthouse in a storm',
      kind: 'cover',
      aspect: 'portrait',
      style: 'illustration',
      width: 1024,
      height: 1536,
      entityKind: '',
      entityId: ''
    })).rejects.toThrow('Falta la clave API de «OpenAI Images»')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
