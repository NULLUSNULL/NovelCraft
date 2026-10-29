import { safeStorage } from 'electron'
import { DEFAULT_SETTINGS } from '../shared/defaults'
import type { AiProvider, AppSettings } from '../shared/types'
import { getSecretsFile, getSettingsFile, readJson, writeJsonAtomic } from './storage'

type StoredProvider = Omit<AiProvider, 'apiKey' | 'hasApiKey' | 'clearApiKey'>
interface StoredSettings {
  general: AppSettings['general']
  editor: AppSettings['editor']
  ai: AppSettings['ai']
  backups: AppSettings['backups']
  providers: StoredProvider[]
}
type SecretMap = Record<string, string>

function normalizeSettings(raw: Partial<AppSettings> | null): AppSettings {
  const defaults = structuredClone(DEFAULT_SETTINGS)
  if (!raw) return defaults
  return {
    general: { ...defaults.general, ...(raw.general || {}) },
    editor: { ...defaults.editor, ...(raw.editor || {}) },
    ai: { ...defaults.ai, ...(raw.ai || {}) },
    backups: { ...defaults.backups, ...(raw.backups || {}) },
    providers:
      Array.isArray(raw.providers) && raw.providers.length
        ? raw.providers.map((provider) => ({ ...provider }))
        : defaults.providers
  }
}

function encryptSecret(value: string): string {
  if (!value) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString('base64')}`
    }
  } catch {
    return `b64:${Buffer.from(value, 'utf8').toString('base64')}`
  }
  return `b64:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decryptSecret(value: string | undefined): string {
  if (!value) return ''
  try {
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    }
    if (value.startsWith('b64:')) return Buffer.from(value.slice(4), 'base64').toString('utf8')
  } catch {
    return ''
  }
  return ''
}

async function readSecrets(): Promise<SecretMap> {
  return readJson<SecretMap>(getSecretsFile(), {})
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await readJson<Partial<AppSettings> | null>(getSettingsFile(), null)
  const settings = normalizeSettings(raw)
  const secrets = await readSecrets()
  settings.providers = settings.providers.map((provider) => ({
    ...provider,
    apiKey: '',
    hasApiKey: Boolean(secrets[provider.id]),
    clearApiKey: false
  }))
  if (!settings.providers.some((provider) => provider.id === settings.ai.activeProviderId)) {
    settings.ai.activeProviderId = settings.providers[0]?.id || ''
  }
  return settings
}

export async function saveSettings(input: AppSettings): Promise<AppSettings> {
  const secrets = await readSecrets()
  const providers: StoredProvider[] = input.providers.map((provider) => {
    const secret = secrets[provider.id]
    if (provider.clearApiKey) {
      delete secrets[provider.id]
    } else if (provider.apiKey?.trim()) {
      secrets[provider.id] = encryptSecret(provider.apiKey.trim())
    } else if (!secret && provider.hasApiKey) {
      secrets[provider.id] = ''
    }
    return {
      id: provider.id,
      name: provider.name.trim() || 'Proveedor sin nombre',
      protocol: provider.protocol,
      category: provider.category,
      baseUrl: provider.baseUrl.trim(),
      model: provider.model.trim(),
      temperature: Number.isFinite(provider.temperature) ? provider.temperature : 0.7,
      maxTokens: Number.isFinite(provider.maxTokens) ? provider.maxTokens : 2048
    }
  })
  const providerIds = new Set(providers.map((provider) => provider.id))
  for (const id of Object.keys(secrets)) {
    if (!providerIds.has(id)) delete secrets[id]
  }
  const stored: StoredSettings = {
    general: input.general,
    editor: input.editor,
    ai: {
      ...input.ai,
      activeProviderId: providers.some((provider) => provider.id === input.ai.activeProviderId)
        ? input.ai.activeProviderId
        : providers[0]?.id || ''
    },
    backups: input.backups,
    providers
  }
  await writeJsonAtomic(getSettingsFile(), stored)
  await writeJsonAtomic(getSecretsFile(), secrets)
  return getSettings()
}

export async function getProviderWithSecret(providerId: string): Promise<AiProvider | null> {
  const settings = await getSettings()
  const provider = settings.providers.find((candidate) => candidate.id === providerId)
  if (!provider) return null
  const secrets = await readSecrets()
  return { ...provider, apiKey: decryptSecret(secrets[providerId]) }
}

export async function resolveProvider(
  providerId: string,
  override?: AiProvider
): Promise<AiProvider | null> {
  if (override) {
    const stored = await getProviderWithSecret(providerId)
    const apiKey = override.apiKey?.trim() || stored?.apiKey || ''
    return { ...override, apiKey, hasApiKey: Boolean(apiKey) }
  }
  return getProviderWithSecret(providerId)
}
