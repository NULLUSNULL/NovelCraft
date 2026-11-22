import { describe, expect, it } from 'vitest'
import {
  createDemoProject,
  getManuscriptScenes,
  scenesForCharacter,
  scenesForItem,
  scenesForLocation
} from '../src/shared/project'

describe('entity appearances in manuscript scenes', () => {
  it('finds character, location, and item names mentioned in scene prose', () => {
    const project = createDemoProject()
    const scene = getManuscriptScenes(project)[0]
    const character = project.characters[0]
    const location = project.locations[0]
    const item = project.items[0]
    scene.content = `<p>${character.name} entra en ${location.name} y encuentra ${item.name}.</p>`
    scene.characterIds = []
    scene.pov = ''
    scene.locationId = ''
    scene.itemIds = []

    expect(scenesForCharacter(project, character.id)).toContain(scene)
    expect(scenesForLocation(project, location.id)).toContain(scene)
    expect(scenesForItem(project, item.id)).toContain(scene)
  })

  it('does not count a name when it is only a substring of another word', () => {
    const project = createDemoProject()
    const scene = getManuscriptScenes(project)[0]
    const character = project.characters[0]
    scene.content = `<p>${character.name}a cruza el pasillo.</p>`
    scene.characterIds = []
    scene.pov = ''

    expect(scenesForCharacter(project, character.id)).not.toContain(scene)
  })
})
