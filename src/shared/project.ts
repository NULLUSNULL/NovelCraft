import type {
  AiSettings,
  Character,
  CreateProjectInput,
  DocumentNode,
  ID,
  Location,
  Plot,
  Project,
  SceneStatus,
  WorldItem
} from './types'
import { MANUSCRIPT_ID, RESEARCH_ID } from './types'
import { COVER_COLORS } from './defaults'

export function makeId(prefix = 'id'): string {
  const cryptoObject = globalThis.crypto
  if (cryptoObject?.randomUUID) return `${prefix}_${cryptoObject.randomUUID()}`
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/h[1-6]>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function countWords(html: string): number {
  const text = stripHtml(html)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function createDocument(
  type: DocumentNode['type'],
  parentId: ID,
  title: string,
  order: number,
  overrides: Partial<DocumentNode> = {}
): DocumentNode {
  const timestamp = nowIso()
  return {
    id: makeId(type),
    type,
    parentId,
    title,
    content: '',
    order,
    wordCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    summary: '',
    status: 'idea',
    pov: '',
    locationId: '',
    characterIds: [],
    plotIds: [],
    itemIds: [],
    goal: '',
    conflict: '',
    outcome: '',
    storyDate: '',
    storyTime: '',
    tags: [],
    wordGoal: 0,
    noteColor: COVER_COLORS[1],
    pinned: false,
    ...overrides
  }
}

export function createProject(input: CreateProjectInput): Project {
  const projectId = makeId('project')
  const timestamp = nowIso()
  const chapter = createDocument('chapter', MANUSCRIPT_ID, 'Capítulo 1', 0, {
    summary: 'Presenta a tu protagonista y el mundo de la historia.'
  })
  const scene = createDocument('scene', chapter.id, 'Escena 1', 0, {
    status: 'draft',
    summary: 'La primera escena abre la novela.',
    wordGoal: 1200,
    storyDate: new Date().toISOString().slice(0, 10),
    content:
      '<p>Escribe aquí el comienzo de tu historia...</p><p>Todo puede empezar con una imagen, una voz o una pregunta que no te deje dormir.</p>'
  })
  scene.wordCount = countWords(scene.content)
  return {
    schemaVersion: 1,
    id: projectId,
    title: input.title.trim() || 'Novela sin título',
    author: input.author.trim(),
    genre: input.genre,
    language: input.language,
    synopsis: input.synopsis,
    description: input.description,
    coverColor: input.coverColor || COVER_COLORS[0],
    coverImage: input.coverImage || '',
    wordGoal: input.wordGoal || 80000,
    targetDate: input.targetDate || '',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastDocumentId: scene.id,
    nodes: {
      [chapter.id]: chapter,
      [scene.id]: scene
    },
    characters: [],
    locations: [],
    items: [],
    plots: [],
    plotEdges: [],
    trash: []
  }
}

export function getRootChildren(project: Project, rootId: ID): DocumentNode[] {
  return Object.values(project.nodes)
    .filter((node) => node.parentId === rootId)
    .sort((a, b) => a.order - b.order)
}

export function getChapterScenes(project: Project, chapterId: ID): DocumentNode[] {
  return Object.values(project.nodes)
    .filter((node) => node.parentId === chapterId && node.type === 'scene')
    .sort((a, b) => a.order - b.order)
}

export function getNoteChildren(project: Project): DocumentNode[] {
  return getRootChildren(project, RESEARCH_ID)
}

export function getManuscriptChapters(project: Project): DocumentNode[] {
  return getRootChildren(project, MANUSCRIPT_ID)
}

export function getManuscriptScenes(project: Project): DocumentNode[] {
  return getManuscriptChapters(project).flatMap((chapter) => getChapterScenes(project, chapter.id))
}

export function getOrderedManuscript(project: Project): DocumentNode[] {
  return getManuscriptChapters(project).flatMap((chapter) => [chapter, ...getChapterScenes(project, chapter.id)])
}

export function getNodeBreadcrumbs(project: Project, nodeId: ID): DocumentNode[] {
  const node = project.nodes[nodeId]
  if (!node) return []
  const parents: DocumentNode[] = []
  let current: DocumentNode | undefined = node
  while (current && current.parentId !== MANUSCRIPT_ID && current.parentId !== RESEARCH_ID) {
    const parent: DocumentNode | undefined = project.nodes[current.parentId]
    if (!parent) break
    parents.unshift(parent)
    current = parent
  }
  return [...parents, node]
}

export function getParentLabel(project: Project, node: DocumentNode): string {
  if (node.type === 'note') return 'Investigación'
  if (node.type === 'chapter') return 'Manuscrito'
  return project.nodes[node.parentId]?.title || 'Manuscrito'
}

export function getProjectWordCount(project: Project): number {
  return Object.values(project.nodes).reduce((total, node) => total + (node.wordCount || 0), 0)
}

export function getProjectStats(project: Project): {
  words: number
  chapters: number
  scenes: number
  notes: number
  characters: number
  locations: number
  items: number
  plots: number
  progress: number
  averageSceneWords: number
} {
  const words = getProjectWordCount(project)
  const chapters = getManuscriptChapters(project).length
  const scenes = getManuscriptScenes(project)
  const notes = getNoteChildren(project).length
  return {
    words,
    chapters,
    scenes: scenes.length,
    notes,
    characters: project.characters.length,
    locations: project.locations.length,
    items: project.items.length,
    plots: project.plots.length,
    progress: project.wordGoal > 0 ? Math.min(100, Math.round((words / project.wordGoal) * 100)) : 0,
    averageSceneWords: scenes.length ? Math.round(words / scenes.length) : 0
  }
}

export function getStatusLabel(status: SceneStatus): string {
  return {
    idea: 'Idea',
    outline: 'Esquema',
    draft: 'Borrador',
    revised: 'Revisada',
    final: 'Final'
  }[status]
}

export function getNextOrder(project: Project, parentId: ID): number {
  const siblings = Object.values(project.nodes).filter((node) => node.parentId === parentId)
  return siblings.length ? Math.max(...siblings.map((node) => node.order)) + 1 : 0
}

export function descendantDocumentIds(project: Project, parentId: ID): ID[] {
  const direct = Object.values(project.nodes)
    .filter((node) => node.parentId === parentId)
    .map((node) => node.id)
  return direct.flatMap((id) => [id, ...descendantDocumentIds(project, id)])
}

export function projectEntities(project: Project): Array<{
  id: ID
  kind: 'character' | 'location' | 'item' | 'plot'
  name: string
  detail: string
}> {
  return [
    ...project.characters.map((character) => ({
      id: character.id,
      kind: 'character' as const,
      name: character.name,
      detail: character.role || 'Personaje'
    })),
    ...project.locations.map((location) => ({
      id: location.id,
      kind: 'location' as const,
      name: location.name,
      detail: location.type || 'Ubicación'
    })),
    ...project.items.map((item) => ({
      id: item.id,
      kind: 'item' as const,
      name: item.name,
      detail: item.type || 'Ítem'
    })),
    ...project.plots.map((plot) => ({
      id: plot.id,
      kind: 'plot' as const,
      name: plot.title,
      detail: `Trama ${plot.type}`
    }))
  ]
}

export function buildProjectContext(
  project: Project,
  selectedDocumentId: ID | '',
  settings: AiSettings
): string {
  const parts: string[] = []
  parts.push(
    `PROYECTO: ${project.title}\nAUTOR/A: ${project.author || 'Sin especificar'}\nGÉNERO: ${project.genre}\nIDIOMA: ${project.language}\nOBJETIVO: ${project.wordGoal} palabras\nSINOPSIS: ${project.synopsis || 'Sin sinopsis'}`
  )

  if (settings.includeManuscript) {
    const outline: string[] = ['ESTRUCTURA DEL MANUSCRITO:']
    for (const chapter of getManuscriptChapters(project)) {
      outline.push(`\n## ${chapter.title}${chapter.summary ? ` — ${chapter.summary}` : ''}`)
      for (const scene of getChapterScenes(project, chapter.id)) {
        const metadata = [
          scene.status,
          scene.pov ? `POV: ${project.characters.find((c) => c.id === scene.pov)?.name || 'desconocido'}` : '',
          scene.storyDate ? `fecha: ${scene.storyDate}` : '',
          scene.summary ? `resumen: ${scene.summary}` : ''
        ]
          .filter(Boolean)
          .join(' · ')
        outline.push(`- ${scene.title}${metadata ? ` [${metadata}]` : ''}`)
        if (settings.includeSceneContent && scene.content) {
          const text = stripHtml(scene.content)
          outline.push(`  Texto: ${text.slice(0, 4000)}${text.length > 4000 ? '…' : ''}`)
        }
      }
    }
    parts.push(outline.join('\n'))
  }

  if (settings.includeCodex) {
    if (project.characters.length) {
      parts.push(
        `PERSONAJES:\n${project.characters
          .map(
            (character) =>
              `- ${character.name} (${character.role || 'sin rol'}): ${character.personality || character.appearance || ''} Motivación: ${character.motivation || '—'}. Arco: ${character.arc || '—'}`
          )
          .join('\n')}`
      )
    }
    if (project.locations.length) {
      parts.push(
        `UBICACIONES:\n${project.locations
          .map((location) => `- ${location.name} (${location.type || 'lugar'}): ${location.description || '—'}`)
          .join('\n')}`
      )
    }
    if (project.items.length) {
      parts.push(
        `ÍTEMS:\n${project.items
          .map((item) => `- ${item.name} (${item.type || 'objeto'}): ${item.description || '—'}`)
          .join('\n')}`
      )
    }
  }

  if (settings.includePlots) {
    if (project.plots.length) {
      parts.push(
        `TRAMAS:\n${project.plots
          .map(
            (plot) =>
              `- ${plot.title} [${plot.type}, ${plot.status}]: ${plot.summary || '—'} Conflicto: ${plot.conflict || '—'}. Resolución: ${plot.resolution || '—'}. Temporalidad: ${plot.temporalStart || '?'} → ${plot.temporalEnd || '?'}`
          )
          .join('\n')}`
      )
    }
    const chronologicalScenes = getManuscriptScenes(project)
      .filter((scene) => scene.storyDate)
      .sort((a, b) => `${a.storyDate} ${a.storyTime}`.localeCompare(`${b.storyDate} ${b.storyTime}`))
    if (chronologicalScenes.length) {
      parts.push(
        `CRONOLOGÍA DE ESCENAS:\n${chronologicalScenes
          .map((scene) => `- ${scene.storyDate}${scene.storyTime ? ` ${scene.storyTime}` : ''}: ${scene.title}`)
          .join('\n')}`
      )
    }
  }

  if (selectedDocumentId && project.nodes[selectedDocumentId]) {
    const selected = project.nodes[selectedDocumentId]
    const chapter = selected.type === 'scene' ? project.nodes[selected.parentId] : undefined
    parts.push(
      `DOCUMENTO ACTIVO: ${chapter ? `${chapter.title} / ` : ''}${selected.title}\nRESUMEN: ${selected.summary || '—'}\nCONTENIDO:\n${stripHtml(selected.content).slice(0, 12000) || '(vacío)'}`
    )
  }

  return parts.join('\n\n').slice(0, 32000)
}

export interface AiActionMeta {
  label: string
  instruction: string
  group: 'Reescribir' | 'Desarrollar' | 'Revisar e idear'
  allowInstructions?: boolean
}

export const AI_ACTION_PROMPTS: Record<string, AiActionMeta> = {
  continue: {
    label: 'Continuar la escena',
    group: 'Desarrollar',
    allowInstructions: true,
    instruction:
      'Continúa la escritura desde donde termina el fragmento. Mantén la voz, el tiempo verbal, el ritmo y el punto de vista. Escribe entre 120 y 250 palabras. Devuelve solo el texto narrativo, sin explicaciones.'
  },
  improve: {
    label: 'Mejorar prosa',
    group: 'Reescribir',
    instruction:
      'Reescribe el fragmento para mejorar la claridad, el ritmo y la precisión sensorial sin cambiar los hechos ni la voz narrativa. Devuelve solo la versión reescrita.'
  },
  shorten: {
    label: 'Condensar',
    group: 'Reescribir',
    allowInstructions: true,
    instruction:
      'Condensa el fragmento eliminando redundancias y muletillas sin perder información ni intención. Devuelve solo la versión condensada.'
  },
  expand: {
    label: 'Expandir',
    group: 'Reescribir',
    allowInstructions: true,
    instruction:
      'Expande el fragmento con detalle sensorial, subtexto y microacciones coherentes con el contexto. Duplica aproximadamente su extensión. Devuelve solo el texto narrativo.'
  },
  describe: {
    label: 'Describir sensorialmente',
    group: 'Desarrollar',
    allowInstructions: true,
    instruction:
      'Añade una descripción sensorial breve y precisa del entorno o la acción del fragmento, sin detener el ritmo. Devuelve solo el texto narrativo.'
  },
  dialogue: {
    label: 'Mejorar diálogo',
    group: 'Reescribir',
    allowInstructions: true,
    instruction:
      'Reescribe el diálogo para que cada personaje tenga una voz distintiva y el subtexto sea más rico. Conserva las acciones y los hechos. Devuelve solo la escena reescrita.'
  },
  continuity: {
    label: 'Revisar continuidad',
    group: 'Revisar e idear',
    instruction:
      'Analiza el fragmento frente al contexto del proyecto. Señala incoherencias de personajes, objetos, cronología o mundo en una lista breve y ofrece correcciones concretas. No reescribas todo el texto.'
  },
  brainstorm: {
    label: 'Proponer alternativas',
    group: 'Revisar e idear',
    allowInstructions: true,
    instruction:
      'Propón tres alternativas narrativas concretas para el fragmento, con una breve explicación de su efecto dramático. Usa una lista numerada.'
  }
}

function sceneContent(paragraphs: string[]): string {
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')
}

export function createDemoProject(): Project {
  const projectId = makeId('project')
  const timestamp = nowIso()
  const characterValeria: Character = {
    id: makeId('character'),
    name: 'Valeria Solís',
    role: 'Protagonista · relojera',
    age: '34',
    pronouns: 'ella',
    occupation: 'Relojera y restauradora',
    appearance: 'Pelo oscuro recogido con un lápiz, manos manchadas de aceite, abrigo azul marino.',
    personality: 'Observadora, obstinada, compasiva. Desconfía de las promesas fáciles.',
    motivation: 'Recuperar los recuerdos que le fueron arrebatados la noche del incendio.',
    goal: 'Reparar el Reloj de las Mareas antes de la última campanada.',
    conflict: 'Cada recuerdo recuperado altera una parte de su presente.',
    backstory: 'Creció entre los engranajes del taller de su madre, en el barrio de los tintoreros.',
    arc: 'De la búsqueda de una verdad privada a la elección de qué merece ser recordado.',
    secret: 'Ella misma pidió que le borraran una noche de su memoria.',
    voice: 'Habla poco; usa imágenes concretas. Evita las preguntas directas.',
    relationships: [],
    color: '#d7a568',
    avatar: '',
    tags: ['protagonista', 'memoria', 'relojería'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const characterTomas: Character = {
    id: makeId('character'),
    name: 'Tomás Arriaga',
    role: 'Deuteragonista · archivero',
    age: '41',
    pronouns: 'él',
    occupation: 'Archivero municipal',
    appearance: 'Gafas redondas, chaleco de tweed, una cicatriz fina en la ceja izquierda.',
    personality: 'Metódico, irónico, leal. Colecciona principios que nunca cumple.',
    motivation: 'Probar que la ciudad ha borrado sistemáticamente su historia.',
    goal: 'Publicar el archivo prohibido de las horas perdidas.',
    conflict: 'Ama el orden, pero necesita romperlo para salvar a Valeria.',
    backstory: 'Fue aprendiz de la madre de Valeria y guarda la única llave del archivo.',
    arc: 'Aprende que conservar no equivale a encerrar.',
    secret: 'Falsificó el registro del incendio para proteger a Valeria.',
    voice: 'Frases largas cuando miente, cortas cuando teme.',
    relationships: [
      {
        id: makeId('rel'),
        characterId: characterValeria.id,
        label: 'Amor de juventud, cómplices renuentes'
      }
    ],
    color: '#82a58d',
    avatar: '',
    tags: ['aliado', 'archivo', 'culpa'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const characterInes: Character = {
    id: makeId('character'),
    name: 'Inés Varela',
    role: 'Antagonista · cronista de la ciudad',
    age: '58',
    pronouns: 'ella',
    occupation: 'Cronista oficial',
    appearance: 'Siempre de blanco; guantes de seda; una voz que no necesita alzarse.',
    personality: 'Elegante, paciente, aterradora. Cree que el olvido es una forma de misericordia.',
    motivation: 'Mantener la paz de Lúmena preservando una versión limpia de su pasado.',
    goal: 'Destruir el Reloj de las Mareas antes del equinoccio.',
    conflict: 'Sabe que la ciudad se sostiene sobre una mentira que ella misma heredó.',
    backstory: 'Fue la primera cronista capaz de leer las horas perdidas.',
    arc: 'De guardiana del orden a prisionera de su propio relato.',
    secret: 'No puede olvidar nada; ha memorizado cada crimen de la ciudad.',
    voice: 'Nunca amenaza: describe consecuencias.',
    relationships: [
      {
        id: makeId('rel'),
        characterId: characterTomas.id,
        label: 'Antigua mentora'
      }
    ],
    color: '#c87960',
    avatar: '',
    tags: ['antagonista', 'orden', 'cronista'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const locationCiudad: Location = {
    id: makeId('location'),
    name: 'Lúmena',
    type: 'Ciudad',
    description:
      'Ciudad portuaria construida en terrazas sobre un acantilado. Sus calles huelen a sal, tinta y cobre.',
    atmosphere: 'Niebla persistente, campanas que nunca coinciden, faroles de gas.',
    history: 'Fundada por cartógrafos que decidieron borrar el nombre de su isla de origen.',
    significance: 'Toda la novela es un mapa de sus ausencias.',
    color: '#7187a2',
    image: '',
    tags: ['escenario principal', 'puerto'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const locationJardin: Location = {
    id: makeId('location'),
    name: 'El Jardín de las Horas',
    type: 'Jardín monumental',
    description: 'Un jardín circular con doce estanques y un reloj solar que marca horas imposibles.',
    atmosphere: 'Silencio de invernadero, agua quieta, luz que cambia de estación en minutos.',
    history: 'Fue el observatorio de los primeros cronistas de Lúmena.',
    significance: 'Allí se guarda y se pierde la memoria de la ciudad.',
    color: '#9a7ba8',
    image: '',
    tags: ['final', 'símbolo', 'secreto'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const locationCafe: Location = {
    id: makeId('location'),
    name: 'Café Aurora',
    type: 'Café',
    description: 'Café de esquina con espejos biselados y una gramola que solo toca tres canciones.',
    atmosphere: 'Calor de horno, conversaciones a media voz, lluvia en los cristales.',
    history: 'Punto de encuentro de la antigua sociedad de relojeros.',
    significance: 'Espacio seguro para Valeria y Tomás.',
    color: '#c4915b',
    image: '',
    tags: ['refugio', 'encuentros'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const itemReloj: WorldItem = {
    id: makeId('item'),
    name: 'Reloj de las Mareas',
    type: 'Artefacto',
    description: 'Reloj de bolsillo de doble esfera que avanza y retrocede al mismo tiempo.',
    origin: 'Construido por la madre de Valeria con piezas de un faro hundido.',
    significance: 'Permite recuperar una memoria a cambio de perder otra.',
    currentHolderId: characterValeria.id,
    locationId: locationJardin.id,
    color: '#d7a568',
    image: '',
    tags: ['artefacto', 'memoria', 'central'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const itemMapa: WorldItem = {
    id: makeId('item'),
    name: 'Mapa de la lluvia',
    type: 'Documento',
    description: 'Mapa de Lúmena que solo revela las calles cuando está mojado.',
    origin: 'Robado del despacho de Inés por Tomás.',
    significance: 'Conduce al archivo bajo el jardín.',
    currentHolderId: characterTomas.id,
    locationId: locationCiudad.id,
    color: '#6f90a8',
    image: '',
    tags: ['pista', 'mapa'],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const itemCuaderno: WorldItem = {
    id: makeId('item'),
    name: 'Cuaderno de hojas azules',
    type: 'Cuaderno',
    description: 'Cuaderno de Valeria donde anota los recuerdos que no reconoce como suyos.',
    origin: 'Regalo de su madre la mañana del incendio.',
    significance: 'Sus páginas cambian de orden cuando ella duerme.',
    currentHolderId: characterValeria.id,
    locationId: '',
    color: '#7c8ea8',
    image: '',
    tags: ['diario', 'recuerdos'],
    createdAt: timestamp,
    updatedAt: timestamp
  }

  const chapter1 = createDocument('chapter', MANUSCRIPT_ID, 'El mapa de la lluvia', 0, {
    summary: 'Valeria recibe una llave y descubre que alguien ha estado recordando por ella.',
    status: 'revised'
  })
  const scene1 = createDocument('scene', chapter1.id, 'La puerta de cobre', 0, {
    summary:
      'Valeria encuentra una puerta que no existía en el taller y recibe el Reloj de las Mareas de manos de un mensajero.',
    status: 'revised',
    pov: characterValeria.id,
    locationId: locationCiudad.id,
    characterIds: [characterValeria.id],
    itemIds: [itemReloj.id],
    storyDate: '2026-09-14',
    storyTime: '06:40',
    goal: 'Abrir el taller y descubrir quién dejó la puerta.',
    conflict: 'La puerta no tiene cerradura y el reloj ya está en marcha.',
    outcome: 'Valeria acepta reparar el reloj sin saber por qué lo reconoce.',
    wordGoal: 1400,
    tags: ['apertura', 'lluvia'],
    content: sceneContent([
      'La lluvia llegó a Lúmena antes que el amanecer. Valeria la escuchó recorrer el tejado del taller, contando las gotas que se colaban por la claraboya. Era una costumbre vieja, heredada de su madre: si el agua encontraba un camino, alguien había dejado una puerta abierta.',
      'Aquella mañana, la puerta no estaba en la pared. Estaba en el aire, entre dos estanterías de muelles y engranajes, con el pomo de cobre vuelto hacia dentro. Valeria se detuvo con la taza a medio camino. La puerta no reflejaba la habitación. Reflejaba una calle al atardecer, con faroles encendidos y una niña de abrigo azul que corría hacia ella.',
      '—No la abras —dijo una voz desde el umbral.',
      'El mensajero dejó sobre el mostrador un reloj de doble esfera y una nota sin firma. «Para la relojera que todavía recuerda». Valeria no lo tocó. El reloj, sin embargo, empezó a andar.'
    ])
  })
  const scene2 = createDocument('scene', chapter1.id, 'Un nombre en el margen', 1, {
    summary:
      'En el Café Aurora, Tomás reconoce el reloj y le advierte a Valeria que no pregunte por la noche del incendio.',
    status: 'draft',
    pov: characterValeria.id,
    locationId: locationCafe.id,
    characterIds: [characterValeria.id, characterTomas.id],
    itemIds: [itemReloj.id, itemCuaderno.id],
    plotIds: [],
    storyDate: '2026-09-14',
    storyTime: '12:15',
    goal: 'Descubrir el origen del reloj.',
    conflict: 'Tomás sabe más de lo que admite.',
    outcome: 'Valeria descubre su propio nombre en un margen del archivo de Tomás.',
    wordGoal: 1500,
    tags: ['encuentro', 'secreto'],
    content: sceneContent([
      'El Café Aurora olía a canela y a papel mojado. Tomás ocupaba la mesa del fondo, como siempre, con tres libros abiertos en abanico y una taza que ya no humeaba.',
      'Valeria dejó el reloj sobre el mármol. Tomás dejó de respirar durante un segundo entero, el tiempo exacto que tarda un péndulo en cambiar de lado.',
      '—¿Dónde lo has encontrado? —preguntó.',
      '—En mi taller. Lo ha traído alguien que no tenía cara.',
      'Tomás pasó el pulgar por la esfera. En el borde interior había una inscripción diminuta: un nombre, una fecha, una hora. El nombre era el de Valeria. La fecha, la noche del incendio.',
      '—Hay cosas que se recuerdan mejor cuando no se buscan —dijo él, y cerró los libros uno por uno.'
    ])
  })
  const scene3 = createDocument('scene', chapter1.id, 'La hora azul', 2, {
    summary: 'El reloj retrocede y Valeria ve una memoria que no le pertenece.',
    status: 'outline',
    pov: characterValeria.id,
    locationId: locationCiudad.id,
    characterIds: [characterValeria.id, characterInes.id],
    itemIds: [itemReloj.id, itemCuaderno.id],
    storyDate: '2026-09-14',
    storyTime: '19:30',
    goal: 'Probar si el reloj puede devolverle un recuerdo.',
    conflict: 'La memoria la muestra cometiendo un crimen que no recuerda.',
    outcome: 'Aparece Inés en la memoria y la llama por un nombre que Valeria no reconoce.',
    wordGoal: 1700,
    tags: ['giro', 'memoria'],
    content: sceneContent([
      'A las siete y media, la ciudad se quedó sin sonido. No fue un apagón ni una pausa del viento: fue como si alguien hubiese levantado una aguja de un disco enorme.',
      'Valeria giró la corona del reloj. La esfera exterior marcó las seis. La interior, las once. Entre ambas, una tercera aguja que no había visto antes empezó a moverse hacia atrás.',
      'La cocina desapareció. En su lugar hubo un pasillo de piedra, una puerta entreabierta y su propia mano sosteniendo una lámpara. Al fondo, Inés Varela la esperaba con guantes blancos.',
      '—Has vuelto antes de tiempo, Mara —dijo Inés.',
      'Valeria quiso responder, pero la boca de su recuerdo no era la suya. La lámpara cayó. El pasillo se llenó de humo.'
    ])
  })

  const chapter2 = createDocument('chapter', MANUSCRIPT_ID, 'Los que recuerdan', 1, {
    summary: 'Valeria y Tomás entran en el archivo prohibido y descubren el precio de la memoria.',
    status: 'draft'
  })
  const scene4 = createDocument('scene', chapter2.id, 'El archivo de las horas perdidas', 0, {
    summary: 'Bajo el ayuntamiento, Tomás abre el archivo y encuentran expedientes con fechas futuras.',
    status: 'draft',
    pov: characterTomas.id,
    locationId: locationCiudad.id,
    characterIds: [characterValeria.id, characterTomas.id, characterInes.id],
    itemIds: [itemMapa.id],
    storyDate: '2026-09-15',
    storyTime: '02:10',
    goal: 'Encontrar el registro de la noche del incendio.',
    conflict: 'Los archivos recuerdan un futuro que aún no ha ocurrido.',
    outcome: 'Descubren que Inés lleva décadas reescribiendo la historia de Lúmena.',
    wordGoal: 1800,
    tags: ['archivo', 'revelación'],
    content: sceneContent([
      'El mapa de la lluvia los guió por calles que no figuraban en ningún plano. Tomás lo sostenía abierto bajo el paraguas; cada gota dibujaba una esquina, un callejón, una escalera que descendía.',
      'El archivo olía a piedra húmeda y a tinta reciente. Miles de carpetas dormían en estanterías de hierro, ordenadas no por años sino por horas.',
      '—Aquí —dijo Tomás, y sacó un expediente con el nombre de Valeria—. Nació diez años después de lo que dice su partida de nacimiento.',
      'Valeria abrió la carpeta. La primera página era una fotografía de ella con el Reloj de las Mareas en la mano, en un jardín que aún no había visitado. La segunda era un recorte de periódico con la fecha del día siguiente.',
      'En el margen, con tinta azul, alguien había escrito: «No dejes que recuerde sola».'
    ])
  })
  const scene5 = createDocument('scene', chapter2.id, 'La deuda', 1, {
    summary: 'Inés ofrece a Valeria recuperar su pasado a cambio del reloj.',
    status: 'idea',
    pov: characterValeria.id,
    locationId: locationCafe.id,
    characterIds: [characterValeria.id, characterInes.id, characterTomas.id],
    itemIds: [itemReloj.id],
    storyDate: '2026-09-16',
    storyTime: '18:00',
    goal: 'Decidir si acepta el trato de Inés.',
    conflict: 'El recuerdo que busca podría destruir a Tomás.',
    outcome: 'Valeria acepta fingir que entrega el reloj.',
    wordGoal: 1600,
    tags: ['trato', 'tensión'],
    content: ''
  })

  const chapter3 = createDocument('chapter', MANUSCRIPT_ID, 'El jardín de las horas', 2, {
    summary: 'El equinoccio llega y Valeria debe elegir qué recordar y qué dejar ir.',
    status: 'idea'
  })
  const scene6 = createDocument('scene', chapter3.id, 'Bajo el reloj', 0, {
    summary: 'La confrontación final en el jardín revela el verdadero origen de Valeria.',
    status: 'idea',
    pov: characterValeria.id,
    locationId: locationJardin.id,
    characterIds: [characterValeria.id, characterTomas.id, characterInes.id],
    itemIds: [itemReloj.id, itemCuaderno.id],
    storyDate: '2026-09-21',
    storyTime: '23:59',
    goal: 'Detener el reloj antes de la última campanada.',
    conflict: 'Salvar la memoria de la ciudad exige sacrificar la suya.',
    outcome: 'Valeria elige recordar solo lo suficiente para empezar de nuevo.',
    wordGoal: 2200,
    tags: ['clímax', 'equinoccio'],
    content: ''
  })
  const scene7 = createDocument('scene', chapter3.id, 'La última página', 1, {
    summary: 'Epílogo. Años después, una niña entra en el taller con un reloj parado.',
    status: 'idea',
    pov: '',
    locationId: locationCiudad.id,
    characterIds: [characterValeria.id],
    itemIds: [itemReloj.id, itemCuaderno.id],
    storyDate: '2031-09-21',
    storyTime: '06:30',
    goal: 'Cerrar el círculo sin negar la pérdida.',
    conflict: 'El ciclo de la memoria vuelve a empezar.',
    outcome: 'Valeria enseña a la niña a escuchar la lluvia.',
    wordGoal: 900,
    tags: ['epílogo', 'cíclico'],
    content: ''
  })

  const note1 = createDocument('note', RESEARCH_ID, 'Reglas del reloj', 0, {
    summary: 'Una memoria recuperada exige perder otra del mismo peso emocional.',
    noteColor: '#d7a568',
    pinned: true,
    tags: ['magia', 'reglas'],
    content:
      '<p><strong>Reglas del Reloj de las Mareas</strong></p><p>1. Solo devuelve recuerdos que pertenecen a quien lo usa.</p><p>2. Toda recuperación necesita una pérdida de peso emocional equivalente.</p><p>3. La tercera esfera nunca debe completar una vuelta.</p><p>4. El reloj no distingue entre pasado y futuro cuando está cerca de su creador.</p>'
  })
  const note2 = createDocument('note', RESEARCH_ID, 'Cronología de Lúmena', 1, {
    summary: 'Fechas clave del mundo y del incendio de 2019.',
    noteColor: '#82a58d',
    tags: ['mundo', 'cronología'],
    content:
      '<p><strong>Lúmena</strong></p><p>1891: fundación sobre el antiguo faro.</p><p>1934: primer archivo de las horas.</p><p>2019: incendio del taller Solís. Muere Elisa Solís. Valeria sobrevive sin recuerdos de la noche.</p><p>2026: equinoccio de septiembre. El reloj vuelve a andar.</p>'
  })
  const note3 = createDocument('note', RESEARCH_ID, 'Voces y expresiones', 2, {
    summary: 'Notas de estilo para los diálogos.',
    noteColor: '#7c8ea8',
    tags: ['estilo', 'diálogo'],
    content:
      '<p>Inés evita las órdenes; describe consecuencias.</p><p>Tomás cita libros que no ha leído completos.</p><p>Valeria usa el lenguaje de los mecanismos: tensión, holgura, cuerda, desgaste.</p>'
  })

  scene2.plotIds = []
  const plotMain: Plot = {
    id: makeId('plot'),
    title: 'La memoria robada',
    type: 'principal',
    status: 'activa',
    color: '#d7a568',
    summary: 'Valeria descubre que la historia de Lúmena ha sido editada y que su propio pasado es una de las páginas arrancadas.',
    premise: 'Una relojera recibe un artefacto capaz de devolver recuerdos y descubre que la ciudad se sostiene sobre el olvido.',
    conflict: 'Cada recuerdo que recupera pone en peligro la estabilidad de la ciudad y la vida de quienes ama.',
    stakes: 'Si el reloj completa su tercera vuelta, Lúmena perderá colectivamente la memoria de lo ocurrido.',
    theme: '¿Quién decide qué merece ser recordado?',
    resolution: 'Valeria rompe el mecanismo y devuelve a la ciudad la libertad de recordar sin garantías.',
    temporalStart: '2026-09-14',
    temporalEnd: '2026-09-21',
    characterIds: [characterValeria.id, characterInes.id],
    sceneIds: [scene1.id, scene3.id, scene4.id, scene6.id],
    tags: ['central', 'memoria'],
    position: { x: 160, y: 130 },
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const plotRomance: Plot = {
    id: makeId('plot'),
    title: 'Valeria y Tomás',
    type: 'romance',
    status: 'activa',
    color: '#c87960',
    summary: 'Dos antiguos amantes vuelven a encontrarse entre secretos que hicieron imposible su relación.',
    premise: 'La persona que puede ayudarla es la misma que la traicionó.',
    conflict: 'Tomás oculta que falsificó el registro del incendio para salvarla.',
    stakes: 'Reconstruir la confianza exige confesar lo que ambos han borrado.',
    theme: 'La intimidad como forma de archivo compartido.',
    resolution: 'Eligen recordar juntos sin exigirse una versión perfecta del pasado.',
    temporalStart: '2019-10-02',
    temporalEnd: '2026-09-21',
    characterIds: [characterValeria.id, characterTomas.id],
    sceneIds: [scene2.id, scene5.id, scene6.id],
    tags: ['romance', 'subtexto'],
    position: { x: 500, y: 330 },
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const plotOrder: Plot = {
    id: makeId('plot'),
    title: 'El precio del orden',
    type: 'conflicto',
    status: 'activa',
    color: '#82a58d',
    summary: 'Inés cree que el olvido es la única forma de mantener la paz, y ha pagado un precio terrible por imponerlo.',
    premise: 'La guardiana del orden es también su prisionera.',
    conflict: 'Inés recuerda todo y no puede olvidar ninguno de sus crímenes.',
    stakes: 'Su control sobre la memoria colectiva es lo único que la mantiene cuerda.',
    theme: 'La tiranía del relato único.',
    resolution: 'Valeria le ofrece la posibilidad de ser recordada sin ser perdonada.',
    temporalStart: '1991-01-01',
    temporalEnd: '2026-09-21',
    characterIds: [characterInes.id, characterTomas.id],
    sceneIds: [scene3.id, scene5.id, scene6.id],
    tags: ['antagonista', 'tema'],
    position: { x: 840, y: 150 },
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const edge1 = {
    id: makeId('edge'),
    source: plotRomance.id,
    target: plotMain.id,
    label: 'complica la búsqueda',
    type: 'conflicto' as const
  }
  const edge2 = {
    id: makeId('edge'),
    source: plotMain.id,
    target: plotOrder.id,
    label: 'desafía el orden',
    type: 'causa' as const
  }
  const edge3 = {
    id: makeId('edge'),
    source: plotRomance.id,
    target: plotOrder.id,
    label: 'expone la mentira',
    type: 'convergencia' as const
  }

  scene1.plotIds = [plotMain.id]
  scene2.plotIds = [plotRomance.id]
  scene3.plotIds = [plotMain.id, plotOrder.id]
  scene4.plotIds = [plotMain.id, plotOrder.id]
  scene5.plotIds = [plotRomance.id, plotOrder.id]
  scene6.plotIds = [plotMain.id, plotRomance.id, plotOrder.id]

  for (const scene of [scene1, scene2, scene3, scene4, scene5, scene6, scene7]) {
    scene.wordCount = countWords(scene.content)
  }

  return {
    schemaVersion: 1,
    id: projectId,
    title: 'El Jardín de las Horas',
    author: 'Ada Lumen',
    genre: 'Fantasía',
    language: 'Español',
    synopsis:
      'En Lúmena, una ciudad que ha borrado su propia historia, la relojera Valeria Solís recibe un reloj capaz de devolver recuerdos a cambio de otros. Mientras lo repara, descubre que su pasado y el de la ciudad están en manos de una cronista que nunca ha olvidado nada.',
    description:
      'Una novela sobre la memoria, los archivos que construimos con quienes amamos y el derecho a elegir qué historias nos sostienen.',
    coverColor: '#d7a568',
    wordGoal: 90000,
    targetDate: '2027-06-01',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastDocumentId: scene2.id,
    nodes: {
      [chapter1.id]: chapter1,
      [scene1.id]: scene1,
      [scene2.id]: scene2,
      [scene3.id]: scene3,
      [chapter2.id]: chapter2,
      [scene4.id]: scene4,
      [scene5.id]: scene5,
      [chapter3.id]: chapter3,
      [scene6.id]: scene6,
      [scene7.id]: scene7,
      [note1.id]: note1,
      [note2.id]: note2,
      [note3.id]: note3
    },
    characters: [characterValeria, characterTomas, characterInes],
    locations: [locationCiudad, locationJardin, locationCafe],
    items: [itemReloj, itemMapa, itemCuaderno],
    plots: [plotMain, plotRomance, plotOrder],
    plotEdges: [edge1, edge2, edge3],
    trash: []
  }
}

export function characterName(project: Project, id: ID): string {
  return project.characters.find((character) => character.id === id)?.name || 'Sin asignar'
}

export function scenesForCharacter(project: Project, characterId: ID): DocumentNode[] {
  return getManuscriptScenes(project).filter(
    (scene) => scene.characterIds.includes(characterId) || scene.pov === characterId
  )
}

export function scenesForLocation(project: Project, locationId: ID): DocumentNode[] {
  return getManuscriptScenes(project).filter((scene) => scene.locationId === locationId)
}

export function scenesForItem(project: Project, itemId: ID): DocumentNode[] {
  return getManuscriptScenes(project).filter((scene) => scene.itemIds.includes(itemId))
}

export function scenesForPlot(project: Project, plotId: ID): DocumentNode[] {
  return getManuscriptScenes(project).filter((scene) => scene.plotIds.includes(plotId))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value)
}

export function formatRelativeDate(iso: string): string {
  if (!iso) return 'Sin fecha'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function normalizeSiblingOrders(project: Project, parentId: ID): void {
  const siblings = Object.values(project.nodes)
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.order - b.order)
  siblings.forEach((node, index) => {
    node.order = index
  })
}

export function statusOrder(status: SceneStatus): number {
  return ['idea', 'outline', 'draft', 'revised', 'final'].indexOf(status)
}
