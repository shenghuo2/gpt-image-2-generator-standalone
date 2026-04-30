const DEFAULTS = {
  model: 'gpt-image-2',
  generatePath: '/v1/images/generations',
  editPath: '/v1/images/edits',
  supportsCustomSize: true,
  maxConcurrency: 3,
  defaultQuality: 'low' as const,
  defaultEstimateSeconds: 60,
}

const STORAGE_KEY = 'gpt-image-standalone-config'

export interface ProviderEntry {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  supportsResponseFormat: boolean
}

export interface StandaloneConfig {
  providers: ProviderEntry[]
  activeProviderId: string
  maxStorageMB: number
}

export const BUILTIN_PROVIDERS: ProviderEntry[] = [
  { id: 'nowcoding', name: 'NowCoding', apiKey: '', baseUrl: 'https://nowcoding.ai', supportsResponseFormat: true },
  { id: 'yunwu', name: 'YunWu', apiKey: '', baseUrl: 'https://yunwu.ai', supportsResponseFormat: false },
]

const CUSTOM_PROVIDER_ID = '__custom__'

function createDefaultConfig(): StandaloneConfig {
  return {
    providers: BUILTIN_PROVIDERS.map(p => ({ ...p })),
    activeProviderId: BUILTIN_PROVIDERS[0].id,
    maxStorageMB: 500,
  }
}

function isLegacyConfig(raw: Record<string, unknown>): boolean {
  return typeof raw.apiKey === 'string' || typeof raw.baseUrl === 'string'
}

function migrateLegacy(raw: Record<string, unknown>): StandaloneConfig {
  const cfg = createDefaultConfig()
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey : ''
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : BUILTIN_PROVIDERS[0].baseUrl
  const maxStorageMB = typeof raw.maxStorageMB === 'number' ? raw.maxStorageMB : 500

  // Try to match the old baseUrl to a built-in provider
  const matched = BUILTIN_PROVIDERS.find(p => p.baseUrl === baseUrl.replace(/\/+$/, ''))
  if (matched) {
    cfg.providers = cfg.providers.map(p => p.id === matched.id ? { ...p, apiKey } : p)
    cfg.activeProviderId = matched.id
  } else if (apiKey) {
    // Custom provider — add it
    cfg.providers.push({ id: CUSTOM_PROVIDER_ID, name: '自定义', apiKey, baseUrl, supportsResponseFormat: false })
    cfg.activeProviderId = CUSTOM_PROVIDER_ID
  }
  cfg.maxStorageMB = maxStorageMB
  return cfg
}

export function loadConfig(): StandaloneConfig {
  if (typeof window === 'undefined') return createDefaultConfig()
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (isLegacyConfig(raw)) {
      const migrated = migrateLegacy(raw)
      saveConfig(migrated)
      return migrated
    }
    if (Array.isArray(raw.providers) && typeof raw.activeProviderId === 'string') {
      // Merge any new built-in providers that don't exist yet
      const merged = createDefaultConfig()
      merged.providers = merged.providers.map(p => {
        const existing = (raw.providers as ProviderEntry[]).find((e: ProviderEntry) => e.id === p.id)
        return existing ? { ...p, apiKey: existing.apiKey || '' } : p
      })
      // Preserve custom providers
      for (const p of (raw.providers as ProviderEntry[])) {
        if (!merged.providers.find(m => m.id === p.id)) {
          merged.providers.push({ ...p, supportsResponseFormat: p.supportsResponseFormat ?? false })
        }
      }
      merged.activeProviderId = raw.activeProviderId as string
      merged.maxStorageMB = typeof raw.maxStorageMB === 'number' ? raw.maxStorageMB : 500
      return merged
    }
    return createDefaultConfig()
  } catch {
    return createDefaultConfig()
  }
}

export function saveConfig(config: StandaloneConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function getActiveProvider(config: StandaloneConfig): ProviderEntry {
  const found = config.providers.find(p => p.id === config.activeProviderId)
  return found || config.providers[0] || BUILTIN_PROVIDERS[0]
}

export { DEFAULTS, CUSTOM_PROVIDER_ID }
