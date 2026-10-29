import type { AiProvider, AppSettings, CreateProjectInput } from './types'

export const DEFAULT_PROVIDERS: AiProvider[] = [
  {
    id: 'ollama-local',
    name: 'Ollama',
    protocol: 'ollama',
    category: 'local',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio',
    protocol: 'openai',
    category: 'local',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    id: 'openai-cloud',
    name: 'OpenAI',
    protocol: 'openai',
    category: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    id: 'anthropic-cloud',
    name: 'Anthropic',
    protocol: 'anthropic',
    category: 'cloud',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    temperature: 0.7,
    maxTokens: 2048
  }
]

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: 'dark',
    accentColor: 'sage',
    uiScale: 100,
    tourCompleted: false,
    reopenLastProject: true,
    showWordCount: true,
    animations: true,
    autosaveSeconds: 2,
    language: 'es'
  },
  editor: {
    fontFamily: 'serif',
    fontSize: 19,
    lineHeight: 1.8,
    maxWidth: 760,
    spellcheck: true,
    focusDim: false
  },
  ai: {
    enabled: true,
    selectionActions: true,
    activeProviderId: 'ollama-local',
    includeManuscript: true,
    includeCodex: true,
    includePlots: true,
    includeSceneContent: false
  },
  backups: {
    snapshotsEnabled: true,
    snapshotLimit: 40,
    autoBackupMinutes: 30,
    backupLimit: 20,
    backupOnExit: true,
    trashRetentionDays: 30
  },
  providers: DEFAULT_PROVIDERS
}

export const COVER_COLORS = [
  '#c4915b',
  '#7d9b83',
  '#a96f5b',
  '#7c8ea8',
  '#9a7ba8',
  '#b78c55',
  '#5e8f8f',
  '#a15f72'
]

export const GENRES = [
  'Fantasía',
  'Ciencia ficción',
  'Misterio',
  'Thriller',
  'Romance',
  'Histórica',
  'Contemporánea',
  'Terror',
  'Aventura',
  'Literaria'
]

export const PROJECT_COLORS = ['#d7a568', '#82a58d', '#c87960', '#8096b3', '#a586b4', '#67a0a0']

export const EMPTY_PROJECT_INPUT: CreateProjectInput = {
  title: '',
  author: '',
  genre: 'Fantasía',
  language: 'Español',
  synopsis: '',
  description: '',
  coverColor: COVER_COLORS[0],
  coverImage: '',
  wordGoal: 80000
}

export const LOCAL_PROVIDER_PRESETS: Omit<AiProvider, 'id'>[] = [
  {
    name: 'Ollama',
    protocol: 'ollama',
    category: 'local',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    name: 'LM Studio',
    protocol: 'openai',
    category: 'local',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    name: 'OpenAI compatible',
    protocol: 'openai',
    category: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    temperature: 0.7,
    maxTokens: 2048
  },
  {
    name: 'Anthropic',
    protocol: 'anthropic',
    category: 'cloud',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    temperature: 0.7,
    maxTokens: 2048
  }
]
