export type ID = string

export const MANUSCRIPT_ID = 'manuscript'
export const RESEARCH_ID = 'research'
export const ROOT_IDS = [MANUSCRIPT_ID, RESEARCH_ID] as const

export type RootId = (typeof ROOT_IDS)[number]
export type DocumentType = 'chapter' | 'scene' | 'note'
export type ChapterKind = 'chapter' | 'prologue' | 'epilogue' | 'special'
export type SceneStatus = 'idea' | 'outline' | 'draft' | 'revised' | 'final'
export type PlotType = 'principal' | 'secundaria' | 'romance' | 'misterio' | 'conflicto' | 'tema'
export type PlotStatus = 'latente' | 'activa' | 'resuelta' | 'abandonada'
export type EntityKind = 'character' | 'location' | 'item'
export type AppView = 'write' | 'codex' | 'plots' | 'publish' | 'images' | 'guide'
export type ThemeMode = 'dark' | 'light' | 'sepia' | 'system'
export type AccentColor = 'amber' | 'rose' | 'sage' | 'ocean' | 'violet' | 'graphite'
export type AiProtocol = 'openai' | 'anthropic' | 'ollama' | 'comfyui'
export type AiCategory = 'cloud' | 'local'
export type ImageGenStyle = 'auto' | 'illustration' | 'painting' | 'photo' | 'minimal'
export type ImageKind = 'cover' | 'avatar' | 'object' | 'location' | 'pose' | 'memory'
export type ImageSource = 'generated' | 'uploaded'

export interface CodexImage {
  id: ID
  kind: ImageKind
  title: string
  prompt: string
  url: string
  source: ImageSource
  entityKind: EntityKind | ''
  entityId: ID | ''
  tags?: string[]
  aspect: 'square' | 'portrait' | 'landscape'
  style: ImageGenStyle
  width: number
  height: number
  createdAt: string
}

export interface ImageGenerateRequest {
  providerId: ID
  prompt: string
  referenceImage?: string
  requestId?: string
  kind: ImageKind
  aspect: 'square' | 'portrait' | 'landscape'
  style: ImageGenStyle
  width?: number
  height?: number
  entityKind: EntityKind | ''
  entityId: ID | ''
}

export interface ImageQueueJob {
  id: ID
  projectId: ID
  request: ImageGenerateRequest
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error: string
  createdAt: string
  completedAt?: string
}

export interface DocumentNode {
  id: ID
  type: DocumentType
  parentId: ID
  title: string
  content: string
  order: number
  wordCount: number
  createdAt: string
  updatedAt: string
  summary: string
  status: SceneStatus
  pov: ID | ''
  locationId: ID | ''
  characterIds: ID[]
  plotIds: ID[]
  itemIds: ID[]
  goal: string
  conflict: string
  outcome: string
  dramaticTension?: string
  writingPlan?: string
  storyDate: string
  storyTime: string
  tags: string[]
  wordGoal: number
  noteColor: string
  pinned: boolean
  chapterKind?: ChapterKind
}

export interface Character {
  id: ID
  name: string
  role: string
  age: string
  height?: string
  weight?: string
  pronouns: string
  occupation: string
  appearance: string
  personality: string
  motivation: string
  goal: string
  conflict: string
  backstory: string
  arc: string
  secret: string
  voice: string
  relationships: CharacterRelationship[]
  color: string
  avatar: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CharacterRelationship {
  id: ID
  characterId: ID
  label: string
}

export interface Location {
  id: ID
  name: string
  type: string
  description: string
  atmosphere: string
  history: string
  significance: string
  color: string
  image: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface WorldItem {
  id: ID
  name: string
  type: string
  description: string
  origin: string
  significance: string
  currentHolderId: ID | ''
  locationId: ID | ''
  color: string
  image: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Plot {
  id: ID
  title: string
  type: PlotType
  status: PlotStatus
  color: string
  summary: string
  premise: string
  conflict: string
  stakes: string
  theme: string
  resolution: string
  temporalStart: string
  temporalEnd: string
  characterIds: ID[]
  locationIds: ID[]
  itemIds: ID[]
  chapterIds: ID[]
  sceneIds: ID[]
  tags: string[]
  position: { x: number; y: number }
  createdAt: string
  updatedAt: string
}

export interface PlotEdge {
  id: ID
  source: ID
  target: ID
  label: string
  type: 'causa' | 'conflicto' | 'convergencia' | 'contrapunto'
}

export type ItemPossessionAction = 'acquisition' | 'loss' | 'transfer'

export interface ItemPossessionEvent {
  id: ID
  itemId: ID
  chapterId: ID
  sceneId: ID
  action: ItemPossessionAction
  fromCharacterId: ID | ''
  toCharacterId: ID | ''
  summary: string
  rationale: string
  source: 'chapter-analysis'
  createdAt: string
}

export interface ChapterPlotProposal {
  id: string
  type: 'plot'
  chapterId: ID
  action: 'create' | 'update'
  plotId: ID | null
  title: string
  summary: string
  plotType: PlotType
  status: PlotStatus
  sceneIds: ID[]
  characterIds: ID[]
  chapterIds: ID[]
  locationIds: ID[]
  itemIds: ID[]
  premise: string
  conflict: string
  stakes: string
  theme: string
  resolution: string
  conflictsWith: { plotId: ID; label: string }[]
  rationale: string
}

export interface ChapterPossessionProposal {
  id: string
  type: 'possession'
  chapterId: ID
  action: ItemPossessionAction
  itemId: ID
  sceneId: ID
  fromCharacterId: ID | ''
  toCharacterId: ID | ''
  summary: string
  rationale: string
}

export interface ChapterPlotConnectionProposal {
  id: string
  type: 'plot-connection'
  chapterId: ID
  sourcePlotId: ID
  targetPlotId: ID
  label: string
  rationale: string
}

export type ChapterReviewProposal =
  | ChapterPlotProposal
  | ChapterPossessionProposal
  | ChapterPlotConnectionProposal

export interface Project {
  schemaVersion: 1
  id: ID
  title: string
  author: string
  genre: string
  language: string
  synopsis: string
  description: string
  coverColor: string
  coverImage?: string
  wordGoal: number
  targetDate: string
  createdAt: string
  updatedAt: string
  lastDocumentId: ID | ''
  nodes: Record<ID, DocumentNode>
  characters: Character[]
  locations: Location[]
  items: WorldItem[]
  plots: Plot[]
  plotEdges: PlotEdge[]
  itemPossessionEvents: ItemPossessionEvent[]
  trash: TrashEntry[]
  codexImages: CodexImage[]
}

export interface TrashEntry {
  id: ID
  kind: DocumentType
  title: string
  deletedAt: string
  parentId: ID
  order: number
  nodes: DocumentNode[]
}

export interface LibraryEntry {
  id: ID
  title: string
  author: string
  genre: string
  coverColor: string
  coverImage?: string
  wordCount: number
  wordGoal: number
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  path: string
}

export interface AiProvider {
  id: ID
  name: string
  protocol: AiProtocol
  category: AiCategory
  baseUrl: string
  model: string
  apiKey?: string
  hasApiKey?: boolean
  clearApiKey?: boolean
  temperature: number
  maxTokens: number
  supportsImages?: boolean
  supportsText?: boolean
}

export interface EditorSettings {
  fontFamily: 'serif' | 'sans' | 'mono'
  fontSize: number
  lineHeight: number
  maxWidth: number
  spellcheck: boolean
  focusDim: boolean
}

export interface AiSettings {
  enabled: boolean
  selectionActions: boolean
  activeProviderId: ID
  imageProviderId: ID
  coverStyle: ImageGenStyle
  includeManuscript: boolean
  includeCodex: boolean
  includePlots: boolean
  includeSceneContent: boolean
}

export interface CoverPromptInput {
  title: string
  author?: string
  genre?: string
  synopsis?: string
  description?: string
  style?: ImageGenStyle
}

export interface CoverGenerateRequest {
  providerId: ID
  prompt: string
  width?: number
  height?: number
}

export type LocalComfyUiStatus = 'running' | 'starting' | 'stopped'

export interface LocalComfyUiState {
  status: LocalComfyUiStatus
  error: string
}

export interface BackupSettings {
  snapshotsEnabled: boolean
  snapshotLimit: number
  autoBackupMinutes: number
  backupLimit: number
  backupOnExit: boolean
  trashRetentionDays: number
}

export interface GeneralSettings {
  theme: ThemeMode
  accentColor: AccentColor
  uiScale: number
  tourCompleted: boolean
  reopenLastProject: boolean
  showWordCount: boolean
  animations: boolean
  autosaveSeconds: number
  language: string
}

export interface AppSettings {
  general: GeneralSettings
  editor: EditorSettings
  ai: AiSettings
  backups: BackupSettings
  providers: AiProvider[]
}

export interface BackupInfo {
  id: string
  fileName: string
  size: number
  createdAt: string
  kind: 'manual' | 'auto' | 'safety'
}

export interface SnapshotInfo {
  id: string
  documentId: ID
  title: string
  createdAt: string
  wordCount: number
  content: string
  preview: string
}

export interface CreateProjectInput {
  title: string
  author: string
  genre: string
  language: string
  synopsis: string
  description: string
  coverColor: string
  coverImage?: string
  wordGoal: number
  targetDate?: string
}

export type ProjectUpdateInput = CreateProjectInput

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiRequest {
  requestId: string
  providerId: ID
  messages: AiMessage[]
  temperature?: number
  maxTokens?: number
}

export interface AiStreamEvent {
  requestId: string
  delta?: string
  done?: boolean
  error?: string
}

export interface AppInfo {
  version: string
  platform: string
  electron: string
  chrome: string
  dataPath: string
}

export interface SaveResult {
  savedAt: string
  snapshots: number
  backupCreated: boolean
}

export interface ExportResult {
  canceled: boolean
  filePath?: string
}

export type ManuscriptFormat = 'pdf' | 'html' | 'markdown' | 'txt' | 'epub'

export interface EpubChapter {
  title: string
  html: string
}

export interface EpubExportData {
  author: string
  genre: string
  language: string
  synopsis: string
  includeTitlePage: boolean
  chapters: EpubChapter[]
}

export interface ManuscriptExportPayload {
  html: string
  markdown: string
  title: string
  coverImage?: string
  format: ManuscriptFormat
  epub?: EpubExportData
  outputPath?: string
}

export interface NovelCraftApi {
  getAppInfo: () => Promise<AppInfo>
  listProjects: () => Promise<LibraryEntry[]>
  createProject: (project: Project) => Promise<LibraryEntry>
  getProject: (id: string) => Promise<Project>
  openProject: (id: string) => Promise<Project>
  saveProject: (project: Project) => Promise<SaveResult>
  deleteProject: (id: string) => Promise<void>
  importProject: () => Promise<LibraryEntry | null>
  exportProject: (id: string) => Promise<ExportResult>
  revealProject: (id: string) => Promise<void>
  createBackup: (id: string) => Promise<BackupInfo>
  listBackups: (id: string) => Promise<BackupInfo[]>
  restoreBackup: (id: string, backupId: string) => Promise<Project>
  deleteBackup: (id: string, backupId: string) => Promise<void>
  listSnapshots: (id: string, documentId: string) => Promise<SnapshotInfo[]>
  createSnapshot: (id: string, documentId: string) => Promise<SnapshotInfo>
  deleteSnapshot: (id: string, documentId: string, snapshotId: string) => Promise<void>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  listModels: (providerId: string, provider?: AiProvider) => Promise<string[]>
  testProvider: (providerId: string, provider?: AiProvider) => Promise<{ ok: boolean; message: string; models?: string[] }>
  aiChat: (request: AiRequest) => Promise<{ content: string }>
  aiComplete: (request: Omit<AiRequest, 'requestId'> & { requestId?: string }) => Promise<{ content: string }>
  cancelAi: (requestId: string) => Promise<void>
  generateCover: (request: CoverGenerateRequest) => Promise<string>
  generateImage: (request: ImageGenerateRequest, requestId?: string) => Promise<string>
  cancelImageGeneration: (requestId: string) => Promise<void>
  addGeneratedImageToProject: (projectId: string, image: CodexImage) => Promise<LibraryEntry>
  getLocalComfyUiStatus: () => Promise<LocalComfyUiState>
  startLocalComfyUi: () => Promise<LocalComfyUiState>
  onAiStream: (callback: (event: AiStreamEvent) => void) => () => void
  exportManuscript: (payload: ManuscriptExportPayload) => Promise<ExportResult>
  minimizeWindow: () => Promise<void>
  setUiScale: (factor: number) => void
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void
  setWindowDirty: (dirty: boolean) => void
  onBeforeClose: (callback: () => void) => () => void
  closeReady: () => void
  openExternal: (url: string) => Promise<void>
}
