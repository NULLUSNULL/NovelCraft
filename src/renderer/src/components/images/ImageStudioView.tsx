import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  Cloud,
  HardDrive,
  Image,
  ImagePlus,
  Loader2,
  Play,
  Server,
  Sparkles,
  StopCircle,
  Trash2,
  UserRound,
  UsersRound,
  UserPlus,
  X
} from 'lucide-react'
import type {
  CodexImage,
  EntityKind,
  AiProvider,
  ImageGenStyle,
  ImageKind,
  LocalComfyUiState,
  Project
} from '@shared/types'
import { nowIso } from '@shared/project'
import { getAiSkillPrompt } from '@shared/aiSkills'
import { useAppStore } from '../../store/useAppStore'
import { ImageUpload } from '../ui/Form'
import { ImageGallery } from './ImageGallery'
import { CodexImageViewer } from './CodexImageViewer'
import { ImageQueuePanel } from './ImageQueuePanel'

const KIND_LABELS: Record<ImageKind, string> = {
  cover: 'Portada de novela',
  avatar: 'Avatar de personaje',
  object: 'Objeto',
  location: 'Lugar',
  pose: 'Pose de personaje',
  memory: 'Recuerdo'
}

const KIND_ICONS: Record<ImageKind, React.ReactNode> = {
  cover: <Image size={14} />,
  avatar: <UserRound size={14} />,
  object: <ImagePlus size={14} />,
  location: <UsersRound size={14} />,
  pose: <UserRound size={14} />,
  memory: <Sparkles size={14} />
}

const ASPECT_DIMS: Record<'square' | 'portrait' | 'landscape', { w: number; h: number; label: string }> = {
  square: { w: 1024, h: 1024, label: 'Cuadrada (1:1)' },
  portrait: { w: 1024, h: 1536, label: 'Retrato (2:3)' },
  landscape: { w: 1536, h: 1024, label: 'Paisaje (3:2)' }
}

const STYLE_LABELS: Record<ImageGenStyle, string> = {
  auto: 'Automático',
  illustration: 'Ilustración',
  painting: 'Pintura',
  photo: 'Fotografía',
  minimal: 'Minimalista'
}

const STYLE_PROMPT_DETAILS: Record<Exclude<ImageGenStyle, 'auto'>, string> = {
  illustration: 'Ilustración digital, líneas limpias y detalle pictórico.',
  painting: 'Pintura tradicional, textura visible de pincel y luz atmosférica.',
  photo: 'Fotografía realista, composición de cámara natural y luz verosímil.',
  minimal: 'Diseño minimalista, formas esenciales y composición despejada.'
}

const COVER_COMPOSITIONS = [
  'una composición simbólica con un elemento central y detalles narrativos alrededor',
  'una escena cinematográfica que sugiera el conflicto principal sin revelar el desenlace',
  'una silueta protagonista frente a un paisaje evocador',
  'un bodegón narrativo con objetos clave de la historia'
]

const COVER_MOODS = [
  'una atmósfera de misterio y luz contenida',
  'una sensación de aventura y amplitud',
  'un tono íntimo y melancólico',
  'una energía dramática con contrastes marcados'
]

interface EntityOption {
  id: string
  label: string
}

const EMPTY_CODEX_IMAGES: CodexImage[] = []

function createRandomCoverPrompt(project: Project): string {
  const pick = <T,>(options: T[]): T => options[Math.floor(Math.random() * options.length)]
  const synopsis = project.synopsis.trim() || project.description.trim()
  return [
    `Diseña una portada editorial original para la novela «${project.title}»${project.genre ? `, del género ${project.genre}` : ''}.`,
    `Inspiración narrativa: ${synopsis || project.title}.`,
    `Composición: ${pick(COVER_COMPOSITIONS)}.`,
    `Dirección artística: ${pick(COVER_MOODS)}.`,
    'Jerarquía visual clara, imagen memorable, acabado profesional de cubierta de novela. No incluyas letras, títulos, tipografía, logotipos ni marcas.'
  ].join('\n\n')
}

function isBundledLocalComfyUi(provider: AiProvider | undefined): boolean {
  if (!provider || provider.protocol !== 'comfyui' || provider.category !== 'local') return false
  try {
    const url = new URL(provider.baseUrl)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === '8188'
  } catch {
    return false
  }
}

function targetKindForImage(kind: ImageKind): EntityKind | null {
  if (kind === 'cover') return null
  if (kind === 'avatar' || kind === 'pose' || kind === 'memory') return 'character'
  if (kind === 'location') return 'location'
  return 'item'
}

export function ImageStudioView() {
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const images = useAppStore((state) => state.project?.codexImages ?? EMPTY_CODEX_IMAGES)
  const sortedImages = useMemo(
    () => [...images].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [images]
  )
  const studioEntityKind = useAppStore((state) => state.imageStudioEntityKind)
  const studioEntityId = useAppStore((state) => state.imageStudioEntityId)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const updateCharacter = useAppStore((state) => state.updateCharacter)
  const updateLocation = useAppStore((state) => state.updateLocation)
  const updateItem = useAppStore((state) => state.updateItem)
  const updateProjectMeta = useAppStore((state) => state.updateProjectMeta)
  const addCodexImage = useAppStore((state) => state.addCodexImage)
  const deleteCodexImage = useAppStore((state) => state.deleteCodexImage)
  const addLocation = useAppStore((state) => state.addLocation)
  const addItem = useAppStore((state) => state.addItem)
  const pushToast = useAppStore((state) => state.pushToast)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const openAiSettings = (): void => useAppStore.getState().setSettingsOpen(true, 'ai')
  const imageQueue = useAppStore((state) => state.imageQueue)
  const enqueueImageGeneration = useAppStore((state) => state.enqueueImageGeneration)
  const removeImageQueueJob = useAppStore((state) => state.removeImageQueueJob)
  const cancelImageQueueJob = useAppStore((state) => state.cancelImageQueueJob)
  const clearFinishedImageJobs = useAppStore((state) => state.clearFinishedImageJobs)

  const [tab, setTab] = useState<'generate' | 'gallery'>('generate')
  const [kind, setKind] = useState<ImageKind>('avatar')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<ImageGenStyle>('auto')
  const [aspect, setAspect] = useState<'square' | 'portrait' | 'landscape'>('portrait')
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [promptProviderId, setPromptProviderId] = useState(settings.ai.activeProviderId)
  const [promptError, setPromptError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [entityKind, setEntityKind] = useState<EntityKind | ''>('')
  const [entityId, setEntityId] = useState('')
  const [referenceImageId, setReferenceImageId] = useState('')
  const [customReferenceImage, setCustomReferenceImage] = useState('')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [viewerImageIds, setViewerImageIds] = useState<string[] | null>(null)
  const [comfyUiStatus, setComfyUiStatus] = useState<LocalComfyUiState>({ status: 'stopped', error: '' })
  const [startingComfyUi, setStartingComfyUi] = useState(false)
  const [providerStatus, setProviderStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [providerStatusError, setProviderStatusError] = useState('')
  const imageTargetSelectRef = useRef<HTMLSelectElement>(null)
  const focusImageTargetSelectRef = useRef(false)
  const promptRequestIdRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (promptRequestIdRef.current) {
      void window.novelcraft.cancelAi(promptRequestIdRef.current).catch((error: unknown) => {
        console.error('No se pudo cancelar la mejora del prompt:', error)
      })
    }
  }, [])

  const dims = ASPECT_DIMS[aspect]

  const imageProviders = settings.providers.filter(
    (provider) => provider.supportsImages || provider.protocol === 'comfyui'
  )
  const imageProvider =
    imageProviders.find((provider) => provider.id === settings.ai.imageProviderId) ||
    imageProviders.find((provider) => provider.id === settings.ai.activeProviderId) ||
    imageProviders[0]
  const providerId = imageProvider?.id || ''
  const activeImageJob = imageQueue.find((job) => job.status === 'processing')
  const textProviders = settings.providers.filter(
    (provider) => provider.protocol !== 'comfyui' && provider.supportsText !== false
  )
  const textProvider = textProviders.find((provider) => provider.id === promptProviderId)
  const imageTargetKind = targetKindForImage(kind)
  const imageTargetOptions: EntityOption[] = imageTargetKind === 'character'
    ? (project?.characters || []).map((entry) => ({ id: entry.id, label: entry.name }))
    : imageTargetKind === 'location'
      ? (project?.locations || []).map((entry) => ({ id: entry.id, label: entry.name }))
      : imageTargetKind === 'item'
        ? (project?.items || []).map((entry) => ({ id: entry.id, label: entry.name }))
        : []
  const selectedCharacter = entityKind === 'character'
    ? project?.characters.find((entry) => entry.id === entityId)
    : undefined
  const characterReferenceImages = useMemo(() => {
    if (!selectedCharacter) return []
    const savedImages = images.filter(
      (image) =>
        image.entityKind === 'character' &&
        image.entityId === selectedCharacter.id &&
        ['avatar', 'pose'].includes(image.kind)
    )
    const avatar = selectedCharacter.avatar && !savedImages.some((image) => image.url === selectedCharacter.avatar)
      ? [{
          id: 'character-avatar',
          title: `${selectedCharacter.name} · Avatar actual`,
          url: selectedCharacter.avatar
        }]
      : []
    return [
      ...avatar,
      ...savedImages.map((image) => ({ id: image.id, title: image.title, url: image.url }))
    ]
  }, [images, selectedCharacter])
  const referenceImageUrl = customReferenceImage ||
    characterReferenceImages.find((image) => image.id === referenceImageId)?.url ||
    ''

  useEffect(() => {
    if (kind !== 'pose' && kind !== 'memory') {
      setReferenceImageId('')
      setCustomReferenceImage('')
      return
    }
    setCustomReferenceImage('')
    const avatar = characterReferenceImages.find((image) => image.url === selectedCharacter?.avatar)
    setReferenceImageId(avatar?.id || '')
  }, [entityId, kind, selectedCharacter?.avatar])
  useEffect(() => {
    setPromptProviderId(settings.ai.activeProviderId)
  }, [settings.ai.activeProviderId])

  useEffect(() => {
    if (!settings.providers.some(
      (provider) => provider.id === promptProviderId && provider.protocol !== 'comfyui' && provider.supportsText !== false
    )) {
      const fallback = settings.providers.find(
        (provider) => provider.id === settings.ai.activeProviderId && provider.protocol !== 'comfyui' && provider.supportsText !== false
      )
      setPromptProviderId(fallback?.id || '')
    }
  }, [settings.providers, promptProviderId, settings.ai.activeProviderId])

  useEffect(() => {
    if (!focusImageTargetSelectRef.current || !imageTargetKind) return
    focusImageTargetSelectRef.current = false
    imageTargetSelectRef.current?.focus()
  }, [kind])

  useEffect(() => {
    if (!imageProvider || isBundledLocalComfyUi(imageProvider)) {
      setProviderStatus('checking')
      setProviderStatusError('')
      return
    }

    let active = true
    setProviderStatus('checking')
    setProviderStatusError('')
    void window.novelcraft.testProvider(imageProvider.id).then((result) => {
      if (!active) return
      setProviderStatus(result.ok ? 'online' : 'offline')
      setProviderStatusError(result.ok ? '' : result.message)
    }).catch((error: unknown) => {
      if (!active) return
      setProviderStatus('offline')
      setProviderStatusError(error instanceof Error ? error.message : String(error))
    })
    return () => {
      active = false
    }
  }, [imageProvider?.id, imageProvider?.baseUrl, imageProvider?.model])

  const entityDescription = useMemo(() => {
    if (!project || !entityKind || !entityId) {
      return kind === 'memory'
        ? [project?.synopsis, project?.description].filter(Boolean).join('\n')
        : ''
    }
    if (entityKind === 'character') {
      const character = project.characters.find((entry) => entry.id === entityId)
      if (!character) return ''
      return [
        `Personaje: ${character.name}`,
        character.age && `Edad: ${character.age}`,
        character.pronouns && `Pronombres: ${character.pronouns}`,
        character.height && `Altura: ${character.height}`,
        character.weight && `Peso o complexión: ${character.weight}`,
        character.appearance && `Apariencia: ${character.appearance}`,
      ].filter(Boolean).join('\n')
    }
    if (entityKind === 'location') {
      const location = project.locations.find((entry) => entry.id === entityId)
      if (!location) return ''
      return [
        `Lugar: ${location.name}`,
        location.type && `Tipo: ${location.type}`,
        location.description && `Descripción: ${location.description}`,
        location.atmosphere && `Atmósfera: ${location.atmosphere}`,
        location.history && `Historia: ${location.history}`,
        location.significance && `Importancia: ${location.significance}`
      ].filter(Boolean).join('\n')
    }
    const item = project.items.find((entry) => entry.id === entityId)
    if (!item) return ''
    return [
      `Objeto: ${item.name}`,
      item.type && `Tipo: ${item.type}`,
      item.description && `Descripción: ${item.description}`,
      item.origin && `Origen: ${item.origin}`,
      item.significance && `Importancia: ${item.significance}`
    ].filter(Boolean).join('\n')
  }, [project, entityKind, entityId, kind])

  useEffect(() => {
    let active = true
    const refreshStatus = async (): Promise<void> => {
      try {
        const status = await window.novelcraft.getLocalComfyUiStatus()
        if (active) setComfyUiStatus(status)
      } catch (error) {
        if (active) {
          setComfyUiStatus({
            status: 'stopped',
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
    void refreshStatus()
    const interval = window.setInterval(() => void refreshStatus(), 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const startComfyUi = async (): Promise<void> => {
    setStartingComfyUi(true)
    try {
      const status = await window.novelcraft.startLocalComfyUi()
      setComfyUiStatus(status)
      pushToast(
        status.status === 'running' ? 'ComfyUI ya está disponible.' : 'ComfyUI se está iniciando; puede tardar un poco.',
        'info'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setComfyUiStatus({ status: 'stopped', error: message })
      pushToast(message, 'error')
    } finally {
      setStartingComfyUi(false)
    }
  }

  const ensureBundledComfyUiReady = useCallback(async (): Promise<void> => {
    if (!isBundledLocalComfyUi(imageProvider) || comfyUiStatus.status === 'running') return
    setStartingComfyUi(true)
    try {
      let status = await window.novelcraft.startLocalComfyUi()
      setComfyUiStatus(status)
      for (let attempt = 0; status.status !== 'running' && attempt < 150; attempt += 1) {
        if (status.status === 'stopped' && status.error) throw new Error(status.error)
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
        status = await window.novelcraft.getLocalComfyUiStatus()
        setComfyUiStatus(status)
      }
      if (status.status !== 'running') {
        throw new Error('ComfyUI sigue iniciándose después de cinco minutos. Revisa la consola del servidor o configura un proveedor online.')
      }
    } finally {
      setStartingComfyUi(false)
    }
  }, [imageProvider, comfyUiStatus.status])

  // Pre-rellenar el estudio con datos del codex cuando se abre desde una ficha
  useEffect(() => {
    if (!studioEntityKind || !studioEntityId) return
    if (!project) return
    setEntityKind(studioEntityKind)
    setEntityId(studioEntityId)
    if (studioEntityKind === 'character') setKind('avatar')
    else if (studioEntityKind === 'location') setKind('location')
    else if (studioEntityKind === 'item') setKind('object')
    const entity =
      project.characters.find((c) => c.id === studioEntityId) ||
      project.locations.find((l) => l.id === studioEntityId) ||
      project.items.find((i) => i.id === studioEntityId)
    if (entity) {
      setPrompt(`Ilustración de ${entity.name} para la novela`)
    }
  }, [studioEntityKind, studioEntityId, project])

  const buildPromptFromSheet = (): string => {
    const subject =
      entityKind === 'character'
        ? 'Retrato de personaje'
        : entityKind === 'location'
          ? 'Escena de lugar'
          : entityKind === 'item'
            ? 'Ilustración de objeto'
            : kind === 'cover'
              ? 'Portada editorial'
              : kind === 'memory'
                ? 'Ilustración de un recuerdo'
                : KIND_LABELS[kind]
    return [
      `${subject}${project?.title ? ` para «${project.title}»` : ''}.`,
      `Estilo: ${STYLE_LABELS[style]}. Formato: ${ASPECT_DIMS[aspect].label}.`,
      entityDescription.trim(),
      'Composición clara, sujeto principal reconocible, iluminación cuidada y fondo coherente. No añadir texto ni letras.'
    ].filter(Boolean).join('\n\n')
  }

  const loadEntityDescription = (): void => {
    setPrompt(buildPromptFromSheet())
    setPromptError('')
    pushToast('Prompt base creado con los datos visuales disponibles. Puedes editarlo antes de generar.', 'success')
  }

  const selectImageKind = (nextKind: ImageKind): void => {
    setKind(nextKind)
    if (nextKind === 'cover') {
      setEntityKind('')
      setEntityId('')
      return
    }

    const targetKind: EntityKind | null =
      nextKind === 'avatar' || nextKind === 'pose' || nextKind === 'memory'
        ? 'character'
        : nextKind === 'location'
          ? 'location'
          : 'item'
    if (entityKind !== targetKind) {
      setEntityKind(targetKind)
      setEntityId('')
    }
    const hasTargets = targetKind === 'character'
      ? Boolean(project?.characters.length)
      : targetKind === 'location'
        ? Boolean(project?.locations.length)
        : Boolean(project?.items.length)
    if (targetKind && hasTargets) {
      focusImageTargetSelectRef.current = true
      if ((nextKind === 'pose' || nextKind === 'memory') && targetKind === 'character') {
        const currentCharacterExists = project?.characters.some((entry) => entry.id === entityId)
        if (!currentCharacterExists) setEntityId(project?.characters[0]?.id || '')
      }
      if (imageTargetKind === targetKind && kind === nextKind) {
        focusImageTargetSelectRef.current = false
        imageTargetSelectRef.current?.focus()
      }
    }
  }

  const generatePromptWithAi = async (): Promise<void> => {
    if (!textProvider) {
      setPromptError('Selecciona un proveedor de texto configurado en Ajustes → IA antes de redactar el prompt.')
      pushToast('Selecciona un proveedor de texto en Ajustes → IA antes de redactar el prompt.', 'error')
      return
    }
    if (!entityDescription.trim() && !prompt.trim()) {
      pushToast('Selecciona una ficha o escribe una idea base para el prompt.', 'error')
      return
    }
    setGeneratingPrompt(true)
    setPromptError('')
    const requestId = `image-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    promptRequestIdRef.current = requestId
    try {
      const response = await window.novelcraft.aiComplete({
        requestId,
        providerId: textProvider.id,
        temperature: 0.6,
        maxTokens: 900,
        messages: [
          {
            role: 'system',
            content: getAiSkillPrompt('image-prompt')
          },
          {
            role: 'user',
            content: [
              `Proyecto: ${project?.title || ''}`,
              `Tipo de imagen: ${KIND_LABELS[kind]}`,
              `Estilo visual: ${STYLE_LABELS[style]}`,
              `Formato: ${ASPECT_DIMS[aspect].label}`,
              `Datos visuales de la ficha:\n${entityDescription || 'No se ha seleccionado una ficha.'}`,
              `Idea o prompt actual:\n${prompt.trim() || 'Propón una composición coherente a partir de la ficha.'}`
            ].join('\n\n')
          }
        ]
      })
      if (promptRequestIdRef.current !== requestId) return
      if (!response.content.trim()) throw new Error('El proveedor de texto devolvió un prompt vacío.')
      setPrompt(response.content.trim())
      pushToast('Prompt redactado. Revísalo y edítalo antes de enviarlo a la cola.', 'success')
    } catch (error) {
      if (promptRequestIdRef.current !== requestId) return
      const message = error instanceof Error ? error.message : 'No se pudo redactar el prompt.'
      const actionableMessage = /Vulkan|allocate|memoria|buffer/i.test(message)
        ? `${message} El modelo local no tiene memoria suficiente; selecciona un proveedor de texto online en Ajustes o crea el prompt base sin IA.`
        : /clave API|bearer authentication|401/i.test(message)
          ? `${message} Revisa que la clave API esté guardada y que el proveedor online sea válido.`
        : message
      setPromptError(actionableMessage)
      pushToast(actionableMessage, 'error')
    } finally {
      if (promptRequestIdRef.current === requestId) {
        promptRequestIdRef.current = null
        setGeneratingPrompt(false)
      }
    }
  }

  const cancelPromptGeneration = (): void => {
    const requestId = promptRequestIdRef.current
    if (!requestId) return
    promptRequestIdRef.current = null
    void window.novelcraft.cancelAi(requestId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      pushToast(`No se pudo cancelar la mejora del prompt: ${message}`, 'error')
    })
    setGeneratingPrompt(false)
    pushToast('Mejora del prompt cancelada.', 'info')
  }

  const generate = useCallback(async (): Promise<void> => {
    if (!project) {
      pushToast('Abre un proyecto antes de añadir imágenes a la cola.', 'error')
      return
    }
    const effectivePrompt = prompt.trim() || (kind === 'cover' ? createRandomCoverPrompt(project) : '')
    if (!effectivePrompt) {
      pushToast('Escribe una descripción para la imagen.', 'error')
      return
    }
    if (!prompt.trim() && kind === 'cover') setPrompt(effectivePrompt)
    if (!providerId) {
      pushToast('Configura un proveedor de imágenes en Ajustes → IA.', 'error')
      return
    }
    if ((kind === 'pose' || kind === 'memory') && (entityKind !== 'character' || !entityId)) {
      pushToast('Selecciona un personaje para generar una pose o un recuerdo.', 'error')
      return
    }
    if (referenceImageUrl && imageProvider?.protocol !== 'openai') {
      pushToast('Las imágenes de referencia requieren un proveedor OpenAI compatible con /images/edits. Cambia de proveedor o desactiva la referencia.', 'error')
      return
    }
    try {
      await ensureBundledComfyUiReady()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setComfyUiStatus({ status: 'stopped', error: message })
      pushToast(`No se puede usar el servidor local. ${message} Puedes configurar un proveedor online desde Ajustes → IA.`, 'error')
      return
    }
    enqueueImageGeneration(project.id, {
      providerId,
      prompt: [
        referenceImageUrl
          ? 'Usa la imagen de referencia para conservar la identidad visual del mismo personaje. Mantén sus rasgos reconocibles y crea una pose, entorno y composición nuevos; no copies el fondo ni la postura de la referencia.'
          : '',
        effectivePrompt,
        style !== 'auto' ? `Estilo visual: ${STYLE_PROMPT_DETAILS[style]}` : ''
      ].filter(Boolean).join('\n\n'),
      kind,
      aspect,
      style,
      width: dims.w,
      height: dims.h,
      entityKind,
      entityId,
      referenceImage: referenceImageUrl || undefined
    })
    pushToast('Imagen añadida a la cola. Puedes seguir trabajando mientras se genera.', 'info')
  }, [prompt, kind, aspect, style, dims, entityKind, entityId, referenceImageUrl, imageProvider?.protocol, providerId, project, ensureBundledComfyUiReady, enqueueImageGeneration, pushToast])

  const saveUploaded = useCallback((): void => {
    if (!uploadedUrl || !project) return
    const image: CodexImage = {
      id: `img_${Date.now()}`,
      kind,
      title: `Imagen subida · ${KIND_LABELS[kind]}`,
      prompt: '',
      url: uploadedUrl,
      source: 'uploaded',
      entityKind,
      entityId,
      aspect,
      style,
      width: dims.w,
      height: dims.h,
      createdAt: nowIso()
    }
    addCodexImage(image)

    if (kind === 'cover') {
      updateProjectMeta({ coverImage: uploadedUrl })
    } else if (entityKind && entityId) {
      if (kind === 'avatar' && entityKind === 'character') {
        updateCharacter(entityId, { avatar: uploadedUrl })
      } else if (kind === 'location' && entityKind === 'location') {
        updateLocation(entityId, { image: uploadedUrl })
      } else if (kind === 'object' && entityKind === 'item') {
        updateItem(entityId, { image: uploadedUrl })
      }
    }

    setUploadedUrl(null)
    pushToast('Imagen subida guardada en el códex.', 'success')
  }, [uploadedUrl, kind, entityKind, entityId, aspect, style, dims, project, addCodexImage, updateCharacter, updateLocation, updateItem, updateProjectMeta, pushToast])

  const handleDeleteGallery = (id: string): void => {
    if (!window.confirm('¿Eliminar esta imagen del historial del códex?')) return
    deleteCodexImage(id)
    if (selectedImageId === id) {
      setSelectedImageId(null)
      setViewerImageIds(null)
    }
    pushToast('Imagen eliminada del historial.', 'info')
  }

  const openImageDetails = (image: CodexImage, visibleImages?: CodexImage[]): void => {
    setViewerImageIds(visibleImages?.map((entry) => entry.id) || null)
    setSelectedImageId(image.id)
  }
  const viewerImages = viewerImageIds
    ? sortedImages.filter((image) => viewerImageIds.includes(image.id))
    : sortedImages

  return (
    <div className="image-studio">
      <header className="image-studio-head">
        <div className="image-studio-brand">
          <Sparkles size={16} />
          <h2>Estudio de imágenes</h2>
        </div>
        <div className="image-studio-tabs">
          <button
            className={`image-tab ${tab === 'generate' ? 'active' : ''}`}
            onClick={() => setTab('generate')}
          >
            Generar
          </button>
          <button
            className={`image-tab ${tab === 'gallery' ? 'active' : ''}`}
            onClick={() => setTab('gallery')}
          >
            Galería del códex
          </button>
        </div>
      </header>

      <div className="image-provider-bar">
        {imageProviders.length > 0 ? (
          <label className="image-provider-field">
            <span className="field-label">Servidor de imágenes</span>
            <select
              className="select"
              value={providerId}
              onChange={(event) =>
                updateSettings((draft) => {
                  draft.ai.imageProviderId = event.target.value
                })
              }
            >
              {imageProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.category === 'cloud' ? 'online' : 'local'}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="image-provider-empty">
            <span>No hay servidores habilitados para generar imágenes.</span>
            <button type="button" className="btn sm" onClick={openAiSettings}>
              Configurar proveedor
            </button>
          </div>
        )}
        {imageProvider && isBundledLocalComfyUi(imageProvider) ? (
          <div className={`image-provider-status ${comfyUiStatus.status}`}>
            <span className="image-provider-status-label">
              <HardDrive size={14} />
              {comfyUiStatus.status === 'running'
                ? 'Servidor local activo'
                : comfyUiStatus.status === 'starting'
                  ? 'Iniciando servidor local…'
                  : 'Servidor local detenido'}
            </span>
            {comfyUiStatus.status !== 'running' && (
            <button
              type="button"
              className="btn sm"
              onClick={() => void startComfyUi()}
              disabled={startingComfyUi || comfyUiStatus.status === 'starting'}
            >
              {startingComfyUi ? <Loader2 size={12} /> : <Play size={12} />}
              Iniciar servidor local
            </button>
            )}
            {comfyUiStatus.error && <span className="field-hint comfyui-status-error">{comfyUiStatus.error}</span>}
            {comfyUiStatus.status === 'stopped' && !comfyUiStatus.error && (
              <span className="comfyui-status-help">Inicia el servidor local o selecciona uno online.</span>
            )}
          </div>
        ) : imageProvider ? (
          <div className={`image-provider-status ${providerStatus}`}>
            <span className="image-provider-status-label">
              {imageProvider.category === 'cloud' ? <Cloud size={14} /> : <HardDrive size={14} />}
              {providerStatus === 'checking'
                ? `Comprobando ${imageProvider.category === 'cloud' ? 'nube' : 'servidor local'}…`
                : providerStatus === 'online'
                  ? `${imageProvider.category === 'cloud' ? 'Nube' : 'Servidor local'} disponible`
                  : `${imageProvider.category === 'cloud' ? 'Nube' : 'Servidor local'} sin conexión`}
            </span>
            {providerStatusError && <span className="field-hint image-provider-status-error">{providerStatusError}</span>}
          </div>
        ) : null}
        <button type="button" className="btn sm image-provider-settings" onClick={openAiSettings}>
          Configurar servicios online
        </button>
      </div>

      {tab === 'generate' ? (
        <div className="image-studio-layout">
          <div className="image-studio-body">
          <div className="image-studio-col-left">
            <section className="form-card">
              <div className="form-card-head image-generator-head">
                <Sparkles size={13} />
                <div className="image-generator-heading">
                  <h3>Generador</h3>
                  <span>Prepara una imagen para el códex o la portada</span>
                </div>
              </div>
              <div className="field">
                <span className="field-label image-step-label"><span>01</span> Tipo de imagen</span>
                <div className="kind-grid">
                  {Object.entries(KIND_LABELS).map(([key, label]) => {
                    const k = key as ImageKind
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`kind-btn ${kind === k ? 'active' : ''}`}
                        onClick={() => selectImageKind(k)}
                        aria-pressed={kind === k}
                        title={label}
                      >
                        {KIND_ICONS[k]}
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {kind === 'cover' ? (
                <div className="image-cover-target">
                  <span className="image-step-label"><span>02</span> Destino</span>
                  <strong>Portada de {project?.title ? `«${project.title}»` : 'la novela'}</strong>
                  <p>Al terminar, se añadirá a la biblioteca y se actualizará la portada del proyecto.</p>
                </div>
              ) : imageTargetKind ? (
                <Field
                  className="image-target-field"
                  label={`02 · ${imageTargetKind === 'character'
                    ? kind === 'pose' ? 'Personaje para la pose' : kind === 'memory' ? 'Personaje del recuerdo' : 'Personaje para el avatar'
                    : imageTargetKind === 'location' ? 'Lugar de la imagen' : 'Objeto de la imagen'}`}
                  hint={imageTargetKind === 'character'
                    ? 'La imagen quedará vinculada a la ficha del personaje.'
                    : `La imagen quedará vinculada a la ficha de ${imageTargetKind === 'location' ? 'lugar' : 'objeto'}.`}
                >
                  {imageTargetOptions.length ? (
                    <select
                      ref={imageTargetSelectRef}
                      className="select"
                      value={entityKind === imageTargetKind ? entityId : ''}
                      onChange={(event) => {
                        setEntityKind(event.target.value ? imageTargetKind : '')
                        setEntityId(event.target.value)
                      }}
                    >
                      {kind !== 'pose' && kind !== 'memory' && <option value="">Sin asociar · independiente</option>}
                      {imageTargetOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="image-target-empty">
                      <span>No hay {imageTargetKind === 'character' ? 'personajes' : imageTargetKind === 'location' ? 'lugares' : 'objetos'} en el códex.</span>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={imageTargetKind === 'character' ? addCharacter : imageTargetKind === 'location' ? addLocation : addItem}
                      >
                        <UserPlus size={13} />
                        Crear {imageTargetKind === 'character' ? 'personaje' : imageTargetKind === 'location' ? 'lugar' : 'objeto'}
                      </button>
                    </div>
                  )}
                </Field>
              ) : null}
              {(kind === 'pose' || kind === 'memory') && entityKind === 'character' && entityId && (
                <Field
                  className="image-reference-field"
                  label="Foto de coherencia del personaje (opcional)"
                  hint={referenceImageUrl
                    ? 'Se enviará como imagen de referencia al proveedor OpenAI. Ayuda a mantener el aspecto, pero no garantiza una identidad exacta.'
                    : 'Elige el avatar u otra imagen de esta ficha, o carga una referencia. Requiere un proveedor OpenAI compatible con edición de imágenes.'}
                >
                  <select
                    className="select"
                    value={customReferenceImage ? 'uploaded-reference' : referenceImageId}
                    onChange={(event) => {
                      setCustomReferenceImage('')
                      setReferenceImageId(event.target.value)
                    }}
                  >
                    <option value="">Sin foto de referencia</option>
                    {characterReferenceImages.map((image) => (
                      <option key={image.id} value={image.id}>{image.title}</option>
                    ))}
                    {customReferenceImage && <option value="uploaded-reference">Foto cargada para esta generación</option>}
                  </select>
                  <div className="image-reference-upload-row">
                    <ImageUpload
                      value={customReferenceImage}
                      onChange={(value) => {
                        setCustomReferenceImage(value)
                        if (value) setReferenceImageId('')
                      }}
                      name={`Referencia visual de ${selectedCharacter?.name || 'personaje'}`}
                      compact
                    />
                    {customReferenceImage && (
                      <button type="button" className="btn sm" onClick={() => setCustomReferenceImage('')}>
                        Quitar referencia
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="03 · Descripción (prompt)">
                <textarea
                  className="textarea"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ej.: una biblioteca antigua con luz de velas, libro abierto sobre una mesa de roble..."
                  rows={4}
                />
                <span className="field-hint">
                  La imagen se guardará automáticamente en la biblioteca al terminar.
                </span>

                <div className="image-prompt-actions">
                  <button type="button" className="btn sm" onClick={loadEntityDescription} title="Rellenar el prompt con la información disponible de la ficha">
                    <ImagePlus size={12} />
                    Prompt base
                  </button>
                  {generatingPrompt ? (
                    <button type="button" className="btn sm" onClick={cancelPromptGeneration} title="Cancelar la mejora del prompt">
                      <StopCircle size={12} />
                      Cancelar IA
                    </button>
                  ) : (
                    <button type="button" className="btn sm" onClick={() => void generatePromptWithAi()} disabled={!entityDescription.trim() && !prompt.trim()} title="Mejorar el prompt con el proveedor de texto seleccionado">
                      <Sparkles size={12} />
                      Mejorar IA
                    </button>
                  )}
                  <button type="button" className="btn sm" onClick={openAiSettings} title="Configurar proveedores de texto e imagen">
                    <Server size={12} />
                    Servicios
                  </button>
                </div>
                {promptError && (
                  <div className="image-prompt-error" role="alert">
                    <strong>No se pudo redactar el prompt</strong>
                    <span>{promptError}</span>
                    <button type="button" className="text-link" onClick={openAiSettings}>
                      Revisar proveedores en Ajustes
                    </button>
                  </div>
                )}
               
              </Field>
              
              <details className="image-advanced-options">
                <summary>Opciones avanzadas <span>{STYLE_LABELS[style]} · {ASPECT_DIMS[aspect].label}</span></summary>
                <div className="field-row">
                  <Field label="Estilo visual">
                    <select className="select" value={style} onChange={(event) => setStyle(event.target.value as ImageGenStyle)}>
                      {Object.entries(STYLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Proporción">
                    <select className="select" value={aspect} onChange={(event) => setAspect(event.target.value as 'square' | 'portrait' | 'landscape')}>
                      {Object.entries(ASPECT_DIMS).map(([key, info]) => (
                        <option key={key} value={key}>{info.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Resolución de salida">
                  <span className="field-value">{dims.w} × {dims.h} px</span>
                  <span className="field-hint">La proporción define las dimensiones enviadas al proveedor; el estilo se añade al prompt.</span>
                </Field>
                <Field
                  label="Proveedor de texto para mejorar el prompt"
                  hint="Si un modelo local falla por falta de memoria, elige un proveedor online en Ajustes → IA."
                >
                  <select
                    className="select sm"
                    value={promptProviderId}
                    onChange={(event) => {
                      setPromptProviderId(event.target.value)
                      setPromptError('')
                    }}
                  >
                    {textProviders.length === 0 && <option value="">Configura un proveedor de texto</option>}
                    {textProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} · {provider.category === 'cloud' ? 'online' : 'local'} · {provider.model}
                      </option>
                    ))}
                  </select>
                </Field>
              </details>
            </section>
 <button
                  type="button"
                  className="btn lg btn-primary"
                  onClick={generate}
                >
                  <Sparkles size={13} />
                  Generar imagen
                </button>
          </div>
                

          <div className="image-studio-col-right">
            <section className="form-card image-recent-card">
              <div className="form-card-head image-library-head">
                <div className="image-library-title">
                  <Image size={13} />
                  <div className="image-library-heading">
                    <h3>Biblioteca de imágenes</h3>
                    <span>Historial reciente · {Math.min(images.length, 8)} de {images.length}</span>
                  </div>
                  <span className="image-gallery-count" aria-label={`${images.length} imágenes guardadas`}>{images.length}</span>
                </div>
                <div className="image-library-actions">
                  <ImageUpload
                    value={uploadedUrl || ''}
                    onChange={setUploadedUrl}
                    name="Imagen subida"
                    compact
                  />
                  {uploadedUrl && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={saveUploaded} disabled={!project}>
                        <Download size={13} /> Guardar
                      </button>
                      <button type="button" className="btn outline image-upload-clear" onClick={() => setUploadedUrl(null)}>
                        <X size={13} /> Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
              <ImageGallery
                images={images.slice(0, 8)}
                onSelect={openImageDetails}
                onDelete={handleDeleteGallery}
                selectedId={selectedImageId}
                showHeader={false}
                showControls={false}
              />
            </section>
            <ImageQueuePanel
              jobs={imageQueue}
              onCancel={cancelImageQueueJob}
              onRemove={removeImageQueueJob}
              onClear={clearFinishedImageJobs}
              onSettings={openAiSettings}
            />
          </div>
          </div>
        </div>
      ) : (
        <>
          <ImageGallery
            images={images}
            onSelect={openImageDetails}
            onDelete={handleDeleteGallery}
            selectedId={selectedImageId}
          />
          <ImageQueuePanel
            jobs={imageQueue}
            onCancel={cancelImageQueueJob}
            onRemove={removeImageQueueJob}
            onClear={clearFinishedImageJobs}
            onSettings={openAiSettings}
          />
        </>
      )}

      <CodexImageViewer
        images={viewerImages}
        imageId={selectedImageId}
        onImageChange={setSelectedImageId}
        onClose={() => {
          setSelectedImageId(null)
          setViewerImageIds(null)
        }}
      />
    </div>
  )
}


function Field({
  label,
  children,
  hint,
  className = ''
}: {
  label?: string
  children: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
