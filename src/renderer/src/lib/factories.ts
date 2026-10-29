import type { Character, Location, Plot, PlotEdge, WorldItem } from '@shared/types'
import { makeId, nowIso } from '@shared/project'
import { COVER_COLORS } from '@shared/defaults'

const COLORS = ['#d7a568', '#82a58d', '#c87960', '#7f95b0', '#a586b4', '#67a0a0']

export function emptyCharacter(name = 'Nuevo personaje'): Character {
  const timestamp = nowIso()
  return {
    id: makeId('character'),
    name,
    role: '',
    age: '',
    pronouns: '',
    occupation: '',
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
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    avatar: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function emptyLocation(name = 'Nueva ubicación'): Location {
  const timestamp = nowIso()
  return {
    id: makeId('location'),
    name,
    type: '',
    description: '',
    atmosphere: '',
    history: '',
    significance: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    image: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function emptyItem(name = 'Nuevo ítem'): WorldItem {
  const timestamp = nowIso()
  return {
    id: makeId('item'),
    name,
    type: '',
    description: '',
    origin: '',
    significance: '',
    currentHolderId: '',
    locationId: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    image: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function emptyPlot(index = 0, title = 'Nueva trama'): Plot {
  const timestamp = nowIso()
  return {
    id: makeId('plot'),
    title,
    type: index === 0 ? 'principal' : 'secundaria',
    status: 'latente',
    color: COLORS[index % COLORS.length],
    summary: '',
    premise: '',
    conflict: '',
    stakes: '',
    theme: '',
    resolution: '',
    temporalStart: '',
    temporalEnd: '',
    characterIds: [],
    sceneIds: [],
    tags: [],
    position: { x: 180 + (index % 3) * 280, y: 120 + Math.floor(index / 3) * 200 },
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function emptyPlotEdge(source: string, target: string): PlotEdge {
  return {
    id: makeId('edge'),
    source,
    target,
    label: 'relación',
    type: 'causa'
  }
}

export function randomCoverColor(): string {
  return COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]
}
