import { describe, expect, it } from 'vitest'
import { applyChapterReviewProposal, parseChapterReviewOutput } from '../src/shared/chapterAnalysis'
import { createDemoProject, createProject, getManuscriptChapters, getChapterScenes } from '../src/shared/project'

function projectWithEntities() {
  const project = createProject({
    title: 'La llave del faro',
    author: 'A. Escritora',
    genre: 'Misterio',
    language: 'Español',
    synopsis: '',
    description: '',
    coverColor: '#222222',
    wordGoal: 50000
  })
  const chapter = getManuscriptChapters(project)[0]
  const scene = getChapterScenes(project, chapter.id)[0]
  const timestamp = new Date().toISOString()
  project.locations.push({
    id: 'location_lighthouse',
    name: 'Faro de la Niebla',
    type: 'Faro',
    description: 'Un faro aislado junto al acantilado.',
    atmosphere: '',
    history: '',
    significance: '',
    color: '#8298bb',
    image: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  })
  scene.locationId = 'location_lighthouse'
  scene.itemIds = ['item_key']
  project.characters.push({
    id: 'character_ada',
    name: 'Ada',
    role: 'Protagonista',
    age: '30',
    height: '',
    weight: '',
    pronouns: 'ella',
    occupation: 'Cartógrafa',
    appearance: '',
    personality: '',
    motivation: '',
    goal: '',
    conflict: '',
    backstory: '',
    arc: '',
    secret: '',
    voice: '',
    relationships: [],
    color: '#d7a568',
    avatar: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  })
  project.items.push({
    id: 'item_key',
    name: 'Llave de latón',
    type: 'Llave',
    description: '',
    origin: '',
    significance: '',
    currentHolderId: '',
    locationId: '',
    color: '#d7a568',
    image: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  })
  return { project, chapter, scene }
}

describe('chapter analysis output', () => {
  it('initializes possession history for new and demo projects', () => {
    expect(createProject({
      title: 'Nueva historia',
      author: '',
      genre: '',
      language: 'Español',
      synopsis: '',
      description: '',
      coverColor: '#222222',
      wordGoal: 50000
    }).itemPossessionEvents).toEqual([])
    expect(createDemoProject().itemPossessionEvents).toEqual([])
  })

  it('validates entity references and only applies an accepted possession event', () => {
    const { project, chapter, scene } = projectWithEntities()
    const output = JSON.stringify({
      proposals: [{
        type: 'possession',
        action: 'acquisition',
        itemId: 'item_key',
        sceneId: scene.id,
        fromCharacterId: null,
        toCharacterId: 'character_ada',
        summary: 'Ada encuentra la llave bajo el faro.',
        rationale: 'La escena describe cómo la recoge.'
      }]
    })

    const [proposal] = parseChapterReviewOutput(output, project, chapter.id)
    expect(project.items[0].currentHolderId).toBe('')
    expect(project.itemPossessionEvents).toHaveLength(0)

    const updated = applyChapterReviewProposal(project, proposal)
    expect(updated.items[0].currentHolderId).toBe('character_ada')
    expect(updated.itemPossessionEvents).toMatchObject([{
      itemId: 'item_key',
      chapterId: chapter.id,
      sceneId: scene.id,
      action: 'acquisition',
      toCharacterId: 'character_ada',
      source: 'chapter-analysis'
    }])
    expect(project.items[0].currentHolderId).toBe('')
  })

  it('rejects malformed or out-of-project proposals instead of dropping them', () => {
    const { project, chapter, scene } = projectWithEntities()
    const validProposal = {
      type: 'possession',
      action: 'acquisition',
      itemId: 'item_key',
      sceneId: scene.id,
      fromCharacterId: null,
      toCharacterId: 'character_ada',
      summary: 'Encuentra la llave.',
      rationale: 'La encuentra en escena.'
    }

    expect(() => parseChapterReviewOutput('No es JSON', project, chapter.id)).toThrow(/JSON válido/)
    expect(() => parseChapterReviewOutput(JSON.stringify({
      proposals: [
        validProposal,
        { ...validProposal, itemId: 'item_missing' }
      ]
    }), project, chapter.id)).toThrow(/no existe/)
  })

  it('matches and creates a plot using only scenes and characters in the project', () => {
    const { project, chapter, scene } = projectWithEntities()
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'create',
        plotId: null,
        title: 'El secreto del faro',
        summary: 'Ada descubre la relación entre la llave y el faro.',
        plotType: 'misterio',
        status: 'activa',
        sceneIds: [scene.id],
        characterIds: ['character_ada'],
        rationale: 'La escena introduce una pista relacionada con el faro.'
      }]
    }), project, chapter.id)

    const updated = applyChapterReviewProposal(project, proposal)
    expect(updated.plots).toHaveLength(1)
    expect(updated.plots[0]).toMatchObject({
      title: 'El secreto del faro',
      status: 'activa',
      sceneIds: [scene.id],
      characterIds: ['character_ada']
    })
    expect(updated.nodes[scene.id].plotIds).toContain(updated.plots[0].id)
  })

  it('creates a conflict connector when an accepted plot proposal names an existing conflicting plot', () => {
    const { project, chapter, scene } = projectWithEntities()
    const relatedPlot = createDemoProject().plots[0]
    relatedPlot.title = 'La disputa del faro'
    project.plots.push(relatedPlot)
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'create',
        plotId: null,
        title: 'La investigación de Ada',
        summary: 'Ada descubre una pista que amenaza el control del faro.',
        plotType: 'misterio',
        status: 'activa',
        sceneIds: [scene.id],
        characterIds: ['character_ada'],
        conflictsWith: [{
          plotId: relatedPlot.id,
          label: 'La investigación amenaza el control del faro'
        }],
        rationale: 'La escena enfrenta los objetivos de ambas tramas.'
      }]
    }), project, chapter.id)

    expect(proposal.type).toBe('plot')
    if (proposal.type !== 'plot') throw new Error('Expected plot proposal')
    expect(proposal.conflictsWith).toEqual([{
      plotId: relatedPlot.id,
      label: 'La investigación amenaza el control del faro'
    }])

    const updated = applyChapterReviewProposal(project, proposal)
    expect(updated.plotEdges).toContainEqual(expect.objectContaining({
      source: updated.plots.at(-1)?.id,
      target: relatedPlot.id,
      label: 'La investigación amenaza el control del faro',
      type: 'conflicto'
    }))
  })

  it('updates the label of an existing conflict instead of rejecting a repeated analysis', () => {
    const { project, chapter, scene } = projectWithEntities()
    const existingPlot = createDemoProject().plots[0]
    existingPlot.title = 'El control del faro'
    project.plots.push(existingPlot)
    const newPlotId = 'plot_investigation'
    project.plots.push({
      ...existingPlot,
      id: newPlotId,
      title: 'La investigación de Ada'
    })
    project.plotEdges.push({
      id: 'edge_existing_conflict',
      source: newPlotId,
      target: existingPlot.id,
      label: 'Conflicto anterior',
      type: 'conflicto'
    })
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'update',
        plotId: newPlotId,
        title: 'La investigación de Ada',
        summary: 'Ada revela una pista más precisa.',
        plotType: 'misterio',
        status: 'activa',
        chapterIds: [chapter.id],
        sceneIds: [scene.id],
        characterIds: ['character_ada'],
        locationIds: ['location_lighthouse'],
        itemIds: ['item_key'],
        conflictsWith: [{
          plotId: existingPlot.id,
          label: 'La investigación amenaza el control del faro'
        }],
        rationale: 'La nueva pista agudiza el conflicto.'
      }]
    }), project, chapter.id)

    const updated = applyChapterReviewProposal(project, proposal)

    expect(updated.plotEdges).toHaveLength(1)
    expect(updated.plotEdges[0]).toMatchObject({
      id: 'edge_existing_conflict',
      label: 'La investigación amenaza el control del faro'
    })
  })

  it('fills plot fields and preserves chapter, scene, character, location and item associations', () => {
    const { project, chapter, scene } = projectWithEntities()
    const competingPlot = createDemoProject().plots[0]
    competingPlot.title = 'El control del faro'
    project.plots.push(competingPlot)
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'create',
        plotId: null,
        title: 'La investigación de Ada',
        summary: 'Ada encuentra una pista decisiva.',
        premise: 'Una cartógrafa reconstruye una desaparición a partir de mapas alterados.',
        conflict: 'La verdad amenaza a quienes mantienen el faro bajo su control.',
        stakes: 'Si fracasa, el pueblo olvidará quién desapareció.',
        theme: 'La memoria frente a la conveniencia.',
        resolution: 'Propuesta: Ada publica el mapa original y obliga al pueblo a decidir qué hacer.',
        plotType: 'misterio',
        status: 'activa',
        chapterIds: [chapter.id],
        sceneIds: [scene.id],
        characterIds: ['character_ada'],
        locationIds: ['location_lighthouse'],
        itemIds: ['item_key'],
        conflictsWith: [{
          plotId: competingPlot.id,
          label: 'La investigación amenaza el secreto del faro'
        }],
        rationale: 'La escena revela un mapa que contradice la versión oficial.'
      }]
    }), project, chapter.id)

    expect(proposal.type).toBe('plot')
    if (proposal.type !== 'plot') throw new Error('Expected plot proposal')
    const updated = applyChapterReviewProposal(project, proposal)
    const created = updated.plots.at(-1)
    expect(created).toMatchObject({
      summary: 'Ada encuentra una pista decisiva.',
      premise: 'Una cartógrafa reconstruye una desaparición a partir de mapas alterados.',
      conflict: 'La verdad amenaza a quienes mantienen el faro bajo su control.',
      stakes: 'Si fracasa, el pueblo olvidará quién desapareció.',
      theme: 'La memoria frente a la conveniencia.',
      resolution: 'Propuesta: Ada publica el mapa original y obliga al pueblo a decidir qué hacer.',
      chapterIds: [chapter.id],
      sceneIds: [scene.id],
      characterIds: ['character_ada'],
      locationIds: ['location_lighthouse'],
      itemIds: ['item_key']
    })
    expect(created?.color).not.toBe(competingPlot.color)
    expect(updated.nodes[chapter.id].plotIds).toContain(created?.id)
    expect(updated.nodes[scene.id].plotIds).toContain(created?.id)
    expect(updated.plotEdges).toContainEqual(expect.objectContaining({
      source: created?.id,
      target: competingPlot.id,
      type: 'conflicto'
    }))
  })

  it('supports a chapter written as a single unit without child scenes', () => {
    const { project, chapter } = projectWithEntities()
    for (const scene of getChapterScenes(project, chapter.id)) {
      delete project.nodes[scene.id]
    }
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'create',
        plotId: null,
        title: 'La búsqueda sin escenas',
        summary: 'Ada reconstruye la desaparición en el capítulo.',
        premise: 'Una cartógrafa busca la verdad.',
        conflict: 'La versión oficial la contradice.',
        stakes: 'El pueblo podría perder su historia.',
        theme: 'La memoria.',
        resolution: 'Propuesta: revelar el mapa original.',
        plotType: 'principal',
        status: 'activa',
        chapterIds: [chapter.id],
        sceneIds: [],
        characterIds: ['character_ada'],
        locationIds: [],
        itemIds: [],
        conflictsWith: [],
        rationale: 'El capítulo presenta la investigación completa.'
      }]
    }), project, chapter.id)

    expect(proposal.type).toBe('plot')
    if (proposal.type !== 'plot') throw new Error('Expected plot proposal')
    const updated = applyChapterReviewProposal(project, proposal)
    expect(updated.plots[0].chapterIds).toContain(chapter.id)
    expect(updated.plots[0].sceneIds).toEqual([])
    expect(updated.nodes[chapter.id].plotIds).toContain(updated.plots[0].id)
  })

  it('applies one plot proposal associated with scenes across multiple chapters', () => {
    const { project, chapter, scene } = projectWithEntities()
    const nextChapter = {
      ...chapter,
      id: 'chapter_second',
      title: 'Capítulo 2',
      order: chapter.order + 1
    }
    const nextScene = {
      ...scene,
      id: 'scene_second',
      parentId: nextChapter.id,
      title: 'Escena del segundo capítulo',
      order: 0
    }
    project.nodes[nextChapter.id] = nextChapter
    project.nodes[nextScene.id] = nextScene

    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot',
        action: 'create',
        plotId: null,
        title: 'La investigación de Ada',
        summary: 'Ada sigue las pistas a lo largo de la novela.',
        premise: 'Una cartógrafa reconstruye una desaparición.',
        conflict: 'La verdad amenaza a quienes controlan el faro.',
        stakes: 'El pueblo podría perder su historia.',
        theme: 'La memoria.',
        resolution: 'Propuesta: Ada revela el mapa original.',
        plotType: 'misterio',
        status: 'activa',
        chapterIds: [chapter.id],
        sceneIds: [scene.id],
        characterIds: ['character_ada'],
        locationIds: ['location_lighthouse'],
        itemIds: ['item_key'],
        conflictsWith: [],
        rationale: 'La investigación continúa.'
      }]
    }), project, chapter.id)

    expect(proposal.type).toBe('plot')
    if (proposal.type !== 'plot') throw new Error('Expected plot proposal')
    const novelProposal = {
      ...proposal,
      chapterIds: [chapter.id, nextChapter.id],
      sceneIds: [scene.id, nextScene.id]
    }
    const updated = applyChapterReviewProposal(project, novelProposal)

    expect(updated.plots[0].chapterIds).toEqual([chapter.id, nextChapter.id])
    expect(updated.plots[0].sceneIds).toEqual([scene.id, nextScene.id])
    expect(updated.nodes[chapter.id].plotIds).toContain(updated.plots[0].id)
    expect(updated.nodes[nextChapter.id].plotIds).toContain(updated.plots[0].id)
    expect(updated.nodes[scene.id].plotIds).toContain(updated.plots[0].id)
    expect(updated.nodes[nextScene.id].plotIds).toContain(updated.plots[0].id)
  })

  it('proposes and applies a conflict connector between existing plots', () => {
    const { project, chapter, scene } = projectWithEntities()
    const [source, target] = createDemoProject().plots
    source.title = 'La desaparición de la llave'
    target.title = 'La disputa del faro'
    source.sceneIds = [scene.id]
    target.sceneIds = [scene.id]
    project.plots.push(source, target)
    const [proposal] = parseChapterReviewOutput(JSON.stringify({
      proposals: [{
        type: 'plot-connection',
        sourcePlotId: source.id,
        targetPlotId: target.id,
        label: 'Compiten por la llave',
        rationale: 'Ambos objetivos chocan en esta escena.'
      }]
    }), project, chapter.id)

    expect(proposal.type).toBe('plot-connection')
    if (proposal.type !== 'plot-connection') throw new Error('Expected plot connection proposal')
    const updated = applyChapterReviewProposal(project, proposal)

    expect(updated.plotEdges).toContainEqual(expect.objectContaining({
      source: source.id,
      target: target.id,
      label: 'Compiten por la llave',
      type: 'conflicto'
    }))
  })
})
