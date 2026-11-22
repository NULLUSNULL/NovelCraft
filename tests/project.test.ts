import { describe, expect, it } from 'vitest'
import { buildCoverPrompt, randomCoverComposition } from '../src/shared/project'

describe('cover prompt composition', () => {
  it('creates a random visual direction inspired by the synopsis', () => {
    const synopsis = 'Una cartógrafa busca a su hermano en una ciudad sumergida.'
    const direction = randomCoverComposition(synopsis)
    const prompt = buildCoverPrompt({
      title: 'La ciudad sumergida',
      genre: 'Fantasía',
      synopsis,
      description: direction
    })

    expect(direction).toContain(synopsis)
    expect(direction).toContain('Dirección visual elegida al azar')
    expect(prompt).toContain('La ciudad sumergida')
    expect(prompt).toContain(synopsis)
    expect(prompt).toContain('sin texto')
  })
})
