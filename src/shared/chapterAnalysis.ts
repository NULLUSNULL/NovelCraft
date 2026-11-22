import type {
  ChapterPossessionProposal,
  ChapterReviewProposal,
  ChapterPlotConnectionProposal,
  ChapterPlotProposal,
  ID,
  ItemPossessionAction,
  PlotStatus,
  PlotType,
  Project
} from './types'
import { getChapterScenes, getManuscriptScenes, makeId, nowIso } from './project'

const plotTypes: PlotType[] = ['principal', 'secundaria', 'romance', 'misterio', 'conflicto', 'tema']
const plotStatuses: PlotStatus[] = ['latente', 'activa', 'resuelta', 'abandonada']
const possessionActions: ItemPossessionAction[] = ['acquisition', 'loss', 'transfer']
const plotColors = ['#d7a568', '#c87960', '#82a58d', '#8298bb', '#a88ab8', '#c89b72', '#6fa6a1', '#bb7c8e']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(
  value: unknown,
  label: string,
  proposalIndex: number,
  maximumLength = 2000
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximumLength) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» debe ser texto y no superar ${maximumLength} caracteres.`)
  }
  return value.trim()
}

function optionalString(value: unknown, label: string, proposalIndex: number, maximumLength = 2000): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.length > maximumLength) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» debe ser texto y no superar ${maximumLength} caracteres.`)
  }
  return value.trim()
}

function idList(
  value: unknown,
  label: string,
  proposalIndex: number,
  validIds: Set<ID>,
  allowEmpty = true
): ID[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» debe ser una lista de identificadores válida.`)
  }
  const ids = value as string[]
  const missing = ids.find((id) => !validIds.has(id))
  if (missing) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» referencia un elemento que no existe en este capítulo o proyecto.`)
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» contiene identificadores repetidos.`)
  }
  return ids
}

function nullableId(value: unknown, label: string, proposalIndex: number): ID | '' {
  if (value === null || value === '') return ''
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Propuesta ${proposalIndex}: «${label}» debe ser un identificador o null.`)
  }
  return value
}

function normalizedName(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}

function unwrapJson(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function parsePlotProposal(
  value: Record<string, unknown>,
  index: number,
  chapterId: ID,
  project: Project,
  sceneIds: Set<ID>,
  characterIds: Set<ID>,
  locationIds: Set<ID>,
  itemIds: Set<ID>
): ChapterPlotProposal {
  const action = value.action
  if (action !== 'create' && action !== 'update') {
    throw new Error(`Propuesta ${index}: la acción de trama debe ser «create» o «update».`)
  }

  const title = requiredString(value.title, 'title', index, 160)
  const plotIdValue = value.plotId
  let plotId: ID | null
  if (action === 'create') {
    if (plotIdValue !== null) throw new Error(`Propuesta ${index}: una trama nueva debe usar «plotId: null».`)
    plotId = null
    if (project.plots.some((plot) => normalizedName(plot.title) === normalizedName(title))) {
      throw new Error(`Propuesta ${index}: «${title}» ya coincide con una trama existente; debe proponer una actualización con su identificador.`)
    }
  } else {
    if (typeof plotIdValue !== 'string') {
      throw new Error(`Propuesta ${index}: una actualización necesita el identificador de una trama existente.`)
    }
    const existing = project.plots.find((plot) => plot.id === plotIdValue)
    if (!existing) throw new Error(`Propuesta ${index}: el identificador de trama no existe en este proyecto.`)
    if (normalizedName(existing.title) !== normalizedName(title)) {
      throw new Error(`Propuesta ${index}: el identificador de trama no coincide con «${title}».`)
    }
    plotId = existing.id
  }

  if (!plotTypes.includes(value.plotType as PlotType)) {
    throw new Error(`Propuesta ${index}: «plotType» no es un tipo de trama reconocido.`)
  }
  if (!plotStatuses.includes(value.status as PlotStatus)) {
    throw new Error(`Propuesta ${index}: «status» no es un estado de trama reconocido.`)
  }

  const conflictsWith = value.conflictsWith === undefined ? [] : value.conflictsWith
  if (!Array.isArray(conflictsWith)) {
    throw new Error(`Propuesta ${index}: «conflictsWith» debe ser una lista de conflictos con tramas existentes.`)
  }
  const conflictTargets = new Set<ID>()
  const parsedConflicts = conflictsWith.map((candidate) => {
    if (!isRecord(candidate)) {
      throw new Error(`Propuesta ${index}: cada elemento de «conflictsWith» debe indicar una trama y una etiqueta.`)
    }
    const targetPlotId = requiredString(candidate.plotId, 'conflictsWith.plotId', index, 160)
    const targetPlot = project.plots.find((plot) => plot.id === targetPlotId)
    if (!targetPlot || targetPlotId === plotId) {
      throw new Error(`Propuesta ${index}: «conflictsWith» debe referenciar otra trama existente.`)
    }
    if (conflictTargets.has(targetPlotId)) {
      throw new Error(`Propuesta ${index}: «conflictsWith» contiene una trama repetida.`)
    }
    conflictTargets.add(targetPlotId)
    return {
      plotId: targetPlotId,
      label: requiredString(candidate.label, 'conflictsWith.label', index, 120)
    }
  })

  const parsedSceneIds = idList(value.sceneIds ?? [], 'sceneIds', index, sceneIds)
  const parsedCharacterIds = idList(value.characterIds ?? [], 'characterIds', index, characterIds)
  const parsedChapterIds = idList(value.chapterIds ?? [chapterId], 'chapterIds', index, new Set([chapterId]))
  const parsedLocationIds = idList(value.locationIds ?? [], 'locationIds', index, locationIds)
  const parsedItemIds = idList(value.itemIds ?? [], 'itemIds', index, itemIds)

  return {
    id: `proposal_${index}`,
    type: 'plot',
    chapterId,
    action,
    plotId,
    title,
    summary: optionalString(value.summary, 'summary', index),
    plotType: value.plotType as PlotType,
    status: value.status as PlotStatus,
    sceneIds: parsedSceneIds,
    characterIds: parsedCharacterIds,
    chapterIds: parsedChapterIds.length ? parsedChapterIds : [chapterId],
    locationIds: parsedLocationIds,
    itemIds: parsedItemIds,
    premise: optionalString(value.premise, 'premise', index),
    conflict: optionalString(value.conflict, 'conflict', index),
    stakes: optionalString(value.stakes, 'stakes', index),
    theme: optionalString(value.theme, 'theme', index),
    resolution: optionalString(value.resolution, 'resolution', index),
    conflictsWith: parsedConflicts,
    rationale: optionalString(value.rationale, 'rationale', index)
  }
}

function parsePossessionProposal(
  value: Record<string, unknown>,
  index: number,
  chapterId: ID,
  sceneIds: Set<ID>,
  itemIds: Set<ID>,
  characterIds: Set<ID>
): ChapterPossessionProposal {
  if (!possessionActions.includes(value.action as ItemPossessionAction)) {
    throw new Error(`Propuesta ${index}: la acción debe ser acquisition, loss o transfer.`)
  }
  const action = value.action as ItemPossessionAction
  const itemId = requiredString(value.itemId, 'itemId', index, 160)
  if (!itemIds.has(itemId)) throw new Error(`Propuesta ${index}: el objeto no existe en este proyecto.`)
  const sceneId = requiredString(value.sceneId, 'sceneId', index, 160)
  if (!sceneIds.has(sceneId)) throw new Error(`Propuesta ${index}: la escena no pertenece a este capítulo.`)
  const fromCharacterId = nullableId(value.fromCharacterId, 'fromCharacterId', index)
  const toCharacterId = nullableId(value.toCharacterId, 'toCharacterId', index)

  if (fromCharacterId && !characterIds.has(fromCharacterId)) {
    throw new Error(`Propuesta ${index}: el personaje que entrega o pierde el objeto no existe en este proyecto.`)
  }
  if (toCharacterId && !characterIds.has(toCharacterId)) {
    throw new Error(`Propuesta ${index}: el personaje que recibe el objeto no existe en este proyecto.`)
  }
  if (
    (action === 'acquisition' && (fromCharacterId || !toCharacterId)) ||
    (action === 'loss' && (!fromCharacterId || toCharacterId)) ||
    (action === 'transfer' && (!fromCharacterId || !toCharacterId || fromCharacterId === toCharacterId))
  ) {
    throw new Error(`Propuesta ${index}: los personajes no corresponden a una adquisición, pérdida o transferencia válida.`)
  }

  return {
    id: `proposal_${index}`,
    type: 'possession',
    chapterId,
    action,
    itemId,
    sceneId,
    fromCharacterId,
    toCharacterId,
    summary: requiredString(value.summary, 'summary', index),
    rationale: requiredString(value.rationale, 'rationale', index)
  }
}

function parsePlotConnectionProposal(
  value: Record<string, unknown>,
  index: number,
  chapterId: ID,
  project: Project
): ChapterPlotConnectionProposal {
  const sourcePlotId = requiredString(value.sourcePlotId, 'sourcePlotId', index, 160)
  const targetPlotId = requiredString(value.targetPlotId, 'targetPlotId', index, 160)
  if (sourcePlotId === targetPlotId) {
    throw new Error(`Propuesta ${index}: una relación de conflicto debe conectar dos tramas distintas.`)
  }
  const source = project.plots.find((plot) => plot.id === sourcePlotId)
  const target = project.plots.find((plot) => plot.id === targetPlotId)
  if (!source || !target) {
    throw new Error(`Propuesta ${index}: las dos tramas de la relación deben existir en este proyecto.`)
  }
  const alreadyConnected = project.plotEdges.some((edge) =>
    edge.type === 'conflicto' &&
    ((edge.source === sourcePlotId && edge.target === targetPlotId) ||
      (edge.source === targetPlotId && edge.target === sourcePlotId))
  )
  if (alreadyConnected) {
    throw new Error(`Propuesta ${index}: estas tramas ya tienen una conexión de conflicto en el grafo.`)
  }
  return {
    id: `proposal_${index}`,
    type: 'plot-connection',
    chapterId,
    sourcePlotId,
    targetPlotId,
    label: requiredString(value.label, 'label', index, 120),
    rationale: requiredString(value.rationale, 'rationale', index)
  }
}

export function parseChapterReviewOutput(raw: string, project: Project, chapterId: ID): ChapterReviewProposal[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(unwrapJson(raw))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'respuesta no interpretable'
    throw new Error(`La IA no devolvió JSON válido. Vuelve a analizar el capítulo o revisa la respuesta original. Detalle: ${detail}`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.proposals)) {
    throw new Error('La respuesta debe tener el formato {"proposals": [...]}. Vuelve a analizar el capítulo y revisa la respuesta original.')
  }
  if (parsed.proposals.length > 30) {
    throw new Error('La IA devolvió más de 30 propuestas. Reduce el alcance del capítulo y vuelve a analizarlo.')
  }

  const chapter = project.nodes[chapterId]
  if (!chapter || chapter.type !== 'chapter') throw new Error('El capítulo ya no existe en el proyecto. Cierra la revisión y vuelve a intentarlo.')

  const chapterScenes = getChapterScenes(project, chapterId)
  const scenes = new Set(chapterScenes.map((scene) => scene.id))
  const characters = new Set(project.characters.map((character) => character.id))
  const items = new Set(project.items.map((item) => item.id))
  const locations = new Set(project.locations.map((location) => location.id))

  return parsed.proposals.map((candidate, offset) => {
    const index = offset + 1
    if (!isRecord(candidate)) throw new Error(`Propuesta ${index}: se esperaba un objeto JSON.`)
    if (candidate.type === 'plot') {
      return parsePlotProposal(candidate, index, chapterId, project, scenes, characters, locations, items)
    }
    if (candidate.type === 'possession') {
      return parsePossessionProposal(candidate, index, chapterId, scenes, items, characters)
    }
    if (candidate.type === 'plot-connection') {
      return parsePlotConnectionProposal(candidate, index, chapterId, project)
    }
    throw new Error(`Propuesta ${index}: el tipo debe ser «plot», «possession» o «plot-connection».`)
  })
}

function assertProposalContext(project: Project, chapterId: ID, sceneIds: ID[]): void {
  const chapter = project.nodes[chapterId]
  if (!chapter || chapter.type !== 'chapter') throw new Error('El capítulo ya no está disponible.')
  const currentScenes = new Set(getChapterScenes(project, chapterId).map((scene) => scene.id))
  if (sceneIds.some((sceneId) => !currentScenes.has(sceneId))) {
    throw new Error('Una escena de esta propuesta ya no pertenece al capítulo. Analízalo de nuevo antes de aceptar.')
  }
}

function assertPlotProposalContext(project: Project, proposal: ChapterPlotProposal): void {
  const chapterIds = new Set([...proposal.chapterIds, proposal.chapterId])
  for (const chapterId of chapterIds) {
    const chapter = project.nodes[chapterId]
    if (!chapter || chapter.type !== 'chapter') {
      throw new Error('Un capítulo de esta propuesta ya no está disponible. Analiza de nuevo antes de aceptar.')
    }
  }
  const currentScenes = new Set(
    [...chapterIds].flatMap((chapterId) => getChapterScenes(project, chapterId).map((scene) => scene.id))
  )
  if (proposal.sceneIds.some((sceneId) => !currentScenes.has(sceneId))) {
    throw new Error('Una escena de esta propuesta ya no pertenece a los capítulos indicados. Analiza de nuevo antes de aceptar.')
  }
}

export function applyChapterReviewProposal(project: Project, proposal: ChapterReviewProposal): Project {
  const next = structuredClone(project)

  if (proposal.type === 'plot-connection') {
    assertProposalContext(next, proposal.chapterId, [])
    const source = next.plots.find((plot) => plot.id === proposal.sourcePlotId)
    const target = next.plots.find((plot) => plot.id === proposal.targetPlotId)
    if (!source || !target || source.id === target.id) {
      throw new Error('Una de las tramas ya no existe o la conexión no es válida. Analiza el capítulo de nuevo.')
    }
    const existing = next.plotEdges.find((edge) =>
      edge.type === 'conflicto' &&
      ((edge.source === source.id && edge.target === target.id) ||
        (edge.source === target.id && edge.target === source.id))
    )
    if (existing) {
      throw new Error('Estas tramas ya están conectadas por un conflicto en el grafo.')
    }
    next.plotEdges.push({
      id: makeId('plot-edge'),
      source: source.id,
      target: target.id,
      label: proposal.label,
      type: 'conflicto'
    })
    return next
  }

  if (proposal.type === 'plot') {
    assertPlotProposalContext(next, proposal)
    if (proposal.characterIds.some((id) => !next.characters.some((character) => character.id === id))) {
      throw new Error('Un personaje de esta propuesta ya no existe. Analiza el capítulo de nuevo antes de aceptar.')
    }
    if (proposal.locationIds.some((id) => !next.locations.some((location) => location.id === id))) {
      throw new Error('Un lugar de esta propuesta ya no existe. Analiza el capítulo de nuevo antes de aceptar.')
    }
    if (proposal.itemIds.some((id) => !next.items.some((item) => item.id === id))) {
      throw new Error('Un objeto de esta propuesta ya no existe. Analiza el capítulo de nuevo antes de aceptar.')
    }

    const timestamp = nowIso()
    const associatedScenes = proposal.sceneIds
      .map((sceneId) => next.nodes[sceneId])
      .filter((scene) => scene?.type === 'scene')
    const characterIds = [...new Set([
      ...proposal.characterIds,
      ...associatedScenes.flatMap((scene) => [...scene.characterIds, scene.pov].filter(Boolean))
    ])]
    const locationIds = [...new Set([
      ...proposal.locationIds,
      ...associatedScenes.map((scene) => scene.locationId).filter(Boolean)
    ])]
    const itemIds = [...new Set([
      ...proposal.itemIds,
      ...associatedScenes.flatMap((scene) => scene.itemIds)
    ])]
    if (proposal.action === 'create') {
      if (next.plots.some((plot) => normalizedName(plot.title) === normalizedName(proposal.title))) {
        throw new Error('Ya existe una trama con ese título. Analiza el capítulo de nuevo para evitar duplicados.')
      }
      const index = next.plots.length
      const plot: Project['plots'][number] = {
        id: makeId('plot'),
        title: proposal.title,
        type: proposal.plotType,
        status: proposal.status,
        color: nextPlotColor(next.plots),
        summary: proposal.summary,
        premise: proposal.premise,
        conflict: proposal.conflict,
        stakes: proposal.stakes,
        theme: proposal.theme,
        resolution: proposal.resolution,
        temporalStart: '',
        temporalEnd: '',
        characterIds,
        locationIds,
        itemIds,
        chapterIds: [...new Set([...proposal.chapterIds, proposal.chapterId])],
        sceneIds: [...proposal.sceneIds],
        tags: [],
        position: { x: 180 + (index % 3) * 280, y: 120 + Math.floor(index / 3) * 200 },
        createdAt: timestamp,
        updatedAt: timestamp
      }
      next.plots.push(plot)
      syncPlotSceneLinks(next, plot.id, plot.sceneIds, plot.chapterIds)
      addConflictEdges(next, plot.id, proposal.conflictsWith)
    } else {
      const plot = next.plots.find((entry) => entry.id === proposal.plotId)
      if (!plot || normalizedName(plot.title) !== normalizedName(proposal.title)) {
        throw new Error('La trama vinculada ya no existe o cambió de nombre. Analiza el capítulo de nuevo antes de aceptar.')
      }
      plot.type = proposal.plotType
      plot.status = proposal.status
      if (proposal.summary) plot.summary = proposal.summary
      if (proposal.premise) plot.premise = proposal.premise
      if (proposal.conflict) plot.conflict = proposal.conflict
      if (proposal.stakes) plot.stakes = proposal.stakes
      if (proposal.theme) plot.theme = proposal.theme
      if (proposal.resolution) plot.resolution = proposal.resolution
      plot.sceneIds = [...new Set([...plot.sceneIds, ...proposal.sceneIds])]
      plot.chapterIds = [...new Set([...(plot.chapterIds || []), ...proposal.chapterIds, proposal.chapterId])]
      plot.characterIds = [...new Set([...plot.characterIds, ...characterIds])]
      plot.locationIds = [...new Set([...(plot.locationIds || []), ...locationIds])]
      plot.itemIds = [...new Set([...(plot.itemIds || []), ...itemIds])]
      plot.updatedAt = timestamp
      syncPlotSceneLinks(next, plot.id, plot.sceneIds, plot.chapterIds)
      addConflictEdges(next, plot.id, proposal.conflictsWith)
    }
    return next
  }

  function nextPlotColor(plots: Project['plots']): string {
    const used = new Set(plots.map((plot) => plot.color.toLocaleLowerCase()))
    const unused = plotColors.find((color) => !used.has(color))
    if (unused) return unused
    const previous = plots.at(-1)?.color.toLocaleLowerCase()
    return plotColors.find((color) => color.toLocaleLowerCase() !== previous) || plotColors[0]
  }

  assertProposalContext(next, proposal.chapterId, [proposal.sceneId])
  const item = next.items.find((entry) => entry.id === proposal.itemId)
  if (!item) throw new Error('El objeto de esta propuesta ya no existe. Analiza el capítulo de nuevo antes de aceptar.')
  if (
    (proposal.fromCharacterId && !next.characters.some((entry) => entry.id === proposal.fromCharacterId)) ||
    (proposal.toCharacterId && !next.characters.some((entry) => entry.id === proposal.toCharacterId))
  ) {
    throw new Error('Un personaje de esta propuesta ya no existe. Analiza el capítulo de nuevo antes de aceptar.')
  }

  const timestamp = nowIso()
  next.itemPossessionEvents = next.itemPossessionEvents || []
  next.itemPossessionEvents.push({
    id: makeId('possession'),
    itemId: item.id,
    chapterId: proposal.chapterId,
    sceneId: proposal.sceneId,
    action: proposal.action,
    fromCharacterId: proposal.fromCharacterId,
    toCharacterId: proposal.toCharacterId,
    summary: proposal.summary,
    rationale: proposal.rationale,
    source: 'chapter-analysis',
    createdAt: timestamp
  })
  const sceneOrder = new Map(getManuscriptScenes(next).map((scene, index) => [scene.id, index]))
  const latestEvent = next.itemPossessionEvents
    .filter((event) => event.itemId === item.id)
    .sort((left, right) => {
      const leftOrder = sceneOrder.get(left.sceneId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = sceneOrder.get(right.sceneId) ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder || left.createdAt.localeCompare(right.createdAt)
    })
    .at(-1)
  item.currentHolderId = latestEvent?.toCharacterId || ''
  item.updatedAt = timestamp
  return next
}

function addConflictEdges(
  project: Project,
  plotId: ID,
  conflictsWith: ChapterPlotProposal['conflictsWith']
): void {
  for (const conflict of conflictsWith) {
    const target = project.plots.find((plot) => plot.id === conflict.plotId)
    if (!target || target.id === plotId) {
      throw new Error('Una trama vinculada ya no existe o la conexión de conflicto no es válida. Analiza el capítulo de nuevo.')
    }
    const existing = project.plotEdges.find((edge) =>
      edge.type === 'conflicto' &&
      ((edge.source === plotId && edge.target === target.id) ||
        (edge.source === target.id && edge.target === plotId))
    )
    if (existing) {
      existing.label = conflict.label
      continue
    }
    project.plotEdges.push({
      id: makeId('plot-edge'),
      source: plotId,
      target: target.id,
      label: conflict.label,
      type: 'conflicto'
    })
  }
}

function syncPlotSceneLinks(project: Project, plotId: ID, sceneIds: ID[], chapterIds: ID[]): void {
  const linkedScenes = new Set(sceneIds)
  const linkedChapters = new Set(chapterIds)
  for (const scene of Object.values(project.nodes)) {
    if (scene.type === 'chapter') {
      const hasLink = scene.plotIds.includes(plotId)
      if (linkedChapters.has(scene.id) && !hasLink) scene.plotIds.push(plotId)
      else if (!linkedChapters.has(scene.id) && hasLink) {
        scene.plotIds = scene.plotIds.filter((id) => id !== plotId)
      }
      continue
    }
    if (scene.type !== 'scene') continue
    const hasLink = scene.plotIds.includes(plotId)
    if (linkedScenes.has(scene.id) && !hasLink) scene.plotIds.push(plotId)
    else if (!linkedScenes.has(scene.id) && hasLink) {
      scene.plotIds = scene.plotIds.filter((id) => id !== plotId)
    }
  }
}
