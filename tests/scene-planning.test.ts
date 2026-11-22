import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/defaults'
import {
  buildProjectContext,
  createDemoProject,
  createDocument,
  getManuscriptScenes
} from '../src/shared/project'

describe('scene planning context', () => {
  it('provides scene associations and planning fields to the literary assistant', () => {
    const project = createDemoProject()
    const scene = getManuscriptScenes(project)[0]
    const character = project.characters[0]
    const location = project.locations[0]
    const plot = project.plots[0]
    const item = project.items[0]

    scene.pov = character.id
    scene.locationId = location.id
    scene.characterIds = [character.id]
    scene.plotIds = [plot.id]
    scene.itemIds = [item.id]
    scene.goal = 'Recuperar el reloj'
    scene.conflict = 'El mecanismo reescribe los recuerdos'
    scene.outcome = 'Valeria descubre una pista'
    scene.dramaticTension = 'La última campanada se acerca'
    scene.writingPlan = 'Investigar, confrontar y tomar una decisión'

    const context = buildProjectContext(project, scene.id, DEFAULT_SETTINGS.ai)

    expect(context).toContain(`POV: ${character.name}`)
    expect(context).toContain(`Ubicación: ${location.name}`)
    expect(context).toContain(`Tramas: ${plot.title}`)
    expect(context).toContain(`Ítems: ${item.name}`)
    expect(context).toContain('Tensión dramática: La última campanada se acerca')
    expect(context).toContain(`Plan de escritura: ${scene.writingPlan}`)
    expect(context).toContain(`${character.id}=${character.name}`)
  })

  it('initializes the scene writing guide fields on new documents', () => {
    const scene = createDocument('scene', 'chapter-id', 'Escena nueva', 0)

    expect(scene.dramaticTension).toBe('')
    expect(scene.writingPlan).toBe('')
  })
})
