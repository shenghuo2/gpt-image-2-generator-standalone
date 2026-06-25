const DEFAULTS = {
  model: 'gpt-image-2',
  generatePath: '/v1/images/generations',
  editPath: '/v1/images/edits',
  supportsCustomSize: true,
  defaultQuality: 'medium' as const,
  defaultEstimateSeconds: 60,
}

const STORAGE_KEY = 'gpt-image-standalone-config'

export interface ProviderEntry {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  supportsResponseFormat: boolean
  maxConcurrency: number
}

export type MultiImageLayout = 'horizontal' | 'vertical'

export interface StandaloneConfig {
  providers: ProviderEntry[]
  activeProviderId: string
  maxStorageMB: number
  maxHistoryItems: number
  multiImageLayout: MultiImageLayout
}

export const BUILTIN_PROVIDERS: ProviderEntry[] = [
  { id: 'nowcoding', name: 'NowCoding', apiKey: '', baseUrl: 'https://nowcoding.ai', supportsResponseFormat: true, maxConcurrency: 4 },
  { id: 'yunwu', name: 'YunWu', apiKey: '', baseUrl: 'https://yunwu.ai', supportsResponseFormat: false, maxConcurrency: 1 },
]

const CUSTOM_PROVIDER_ID = '__custom__'

function createDefaultConfig(): StandaloneConfig {
  return {
    providers: BUILTIN_PROVIDERS.map(p => ({ ...p })),
    activeProviderId: BUILTIN_PROVIDERS[0].id,
    maxStorageMB: 500,
    maxHistoryItems: 300,
    multiImageLayout: 'horizontal' as MultiImageLayout,
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
    cfg.providers.push({ id: CUSTOM_PROVIDER_ID, name: '自定义', apiKey, baseUrl, supportsResponseFormat: false, maxConcurrency: 1 })
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
          merged.providers.push({ ...p, supportsResponseFormat: p.supportsResponseFormat ?? false, maxConcurrency: p.maxConcurrency ?? 1 })
        }
      }
      merged.activeProviderId = raw.activeProviderId as string
      merged.maxStorageMB = typeof raw.maxStorageMB === 'number' ? raw.maxStorageMB : 500
      merged.maxHistoryItems = typeof raw.maxHistoryItems === 'number' ? raw.maxHistoryItems : 300
      merged.multiImageLayout = (raw.multiImageLayout === 'vertical' ? 'vertical' : 'horizontal') as MultiImageLayout
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

// localStorage quota is defined in UTF-16 code units (chars), ~5M per origin.
// Measure usage in the same unit so the warning threshold is accurate.
const LS_QUOTA_BYTES = 5 * 1024 * 1024

export function getLocalStorageUsage(): { usedBytes: number; quotaBytes: number } {
  if (typeof window === 'undefined') return { usedBytes: 0, quotaBytes: LS_QUOTA_BYTES }
  let usedBytes = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const val = localStorage.getItem(key) || ''
      usedBytes += key.length + val.length
    }
  }
  return { usedBytes, quotaBytes: LS_QUOTA_BYTES }
}
