import { describe, expect, it } from 'vitest'
import { getAiSkillPrompt } from '../src/shared/aiSkills'

describe('task-specific AI skills', () => {
  it('provides distinct instructions for every AI task family', () => {
    const prompts = [
      'literary-assistant',
      'scene-planning',
      'editorial-action',
      'character-codex',
      'location-codex',
      'item-codex',
      'plot-resolution',
      'image-prompt',
      'chapter-review',
      'plot-tracking-analysis',
      'character-relationship-tracking',
      'ai-call-reference'
    ] as const

    for (const prompt of prompts) {
      expect(getAiSkillPrompt(prompt).trim().length).toBeGreaterThan(100)
    }

    expect(getAiSkillPrompt('plot-tracking-analysis')).toContain('PASO 1')
    expect(getAiSkillPrompt('plot-tracking-analysis')).toContain('V\u00ednculos entre personajes y tramas')
    expect(getAiSkillPrompt('scene-planning')).toContain('<NOVELCRAFT_SCENE_PLAN>')
    expect(getAiSkillPrompt('character-relationship-tracking')).toContain('characterLinks')
    expect(getAiSkillPrompt('ai-call-reference')).toContain('TABLA DE SKILLS')
  })
})
