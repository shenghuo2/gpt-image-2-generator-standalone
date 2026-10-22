const DEFAULTS = {
  model: 'gpt-image-2',
  generatePath: '/v1/images/generations',
  editPath: '/v1/images/edits',
  defaultQuality: 'medium' as const,
  defaultEstimateSeconds: 60,
}

const STORAGE_KEY = 'gpt-image-standalone-config'

export interface ProviderEntry {
  id: string
  name: string
  model: string
  apiKey: string
  baseUrl: string
  supportsResponseFormat: boolean
  supportsCustomSize: boolean
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
  { id: 'yunwu', name: 'YunWu', model: DEFAULTS.model, apiKey: '', baseUrl: 'https://yunwu.ai', supportsResponseFormat: false, supportsCustomSize: true, maxConcurrency: 2 },
  { id: 'gptgod', name: 'GPTGod', model: DEFAULTS.model, apiKey: '', baseUrl: 'https://new.gptgod.cloud', supportsResponseFormat: true, supportsCustomSize: false, maxConcurrency: 5 },
  // Kept only so existing browser configs can be migrated without losing their Key.
  // New users never receive this retired provider in getDefaultConfig().
  { id: 'nowcoding', name: 'NowCoding', model: DEFAULTS.model, apiKey: '', baseUrl: 'https://nowcoding.ai', supportsResponseFormat: true, supportsCustomSize: false, maxConcurrency: 1 },
]

const CUSTOM_PROVIDER_ID = '__custom__'
const RETIRED_PROVIDER_IDS = new Set(['nowcoding'])
export const GPTGOD_CUSTOM_SIZE_MODEL = 'gpt-image-2-vip'

export const RETIRED_PROVIDER_MESSAGE = 'NowCoding 已下线 GPT-image-2 模型，请切换到其他供应商。'

export function isBuiltinProvider(provider: Pick<ProviderEntry, 'id'> | string) {
  const id = typeof provider === 'string' ? provider : provider.id
  return BUILTIN_PROVIDERS.some(p => p.id === id)
}

export function isRetiredProvider(provider: Pick<ProviderEntry, 'id'> | string) {
  const id = typeof provider === 'string' ? provider : provider.id
  return RETIRED_PROVIDER_IDS.has(id)
}

export function supportedActiveProviderId(providers: ProviderEntry[], requestedId: string) {
  return providers.find(p => p.id === requestedId && !isRetiredProvider(p))?.id
    || providers.find(p => !isRetiredProvider(p))?.id
    || getDefaultConfig().activeProviderId
}

export function resolveProviderCustomSizeSupport(providerId: string, model: string, fallback: boolean) {
  return providerId === 'gptgod' ? model.trim().toLowerCase() === GPTGOD_CUSTOM_SIZE_MODEL : fallback
}

function mergeBuiltinProvider(preset: ProviderEntry, existing?: Partial<ProviderEntry>): ProviderEntry {
  const model = typeof existing?.model === 'string' && existing.model.trim() ? existing.model.trim() : preset.model
  return {
    ...preset,
    model,
    apiKey: typeof existing?.apiKey === 'string' ? existing.apiKey : '',
    maxConcurrency: typeof existing?.maxConcurrency === 'number' ? existing.maxConcurrency : preset.maxConcurrency,
    supportsCustomSize: resolveProviderCustomSizeSupport(preset.id, model, preset.supportsCustomSize),
  }
}

export function getDefaultConfig(): StandaloneConfig {
  const providers = BUILTIN_PROVIDERS.filter(p => !isRetiredProvider(p)).map(p => ({ ...p }))
  return {
    providers,
    activeProviderId: providers[0].id,
    maxStorageMB: 500,
    maxHistoryItems: 300,
    multiImageLayout: 'horizontal' as MultiImageLayout,
  }
}

function isLegacyConfig(raw: Record<string, unknown>): boolean {
  return typeof raw.apiKey === 'string' || typeof raw.baseUrl === 'string'
}

function migrateLegacy(raw: Record<string, unknown>): StandaloneConfig {
  const cfg = getDefaultConfig()
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey : ''
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : DEFAULTS.model
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : cfg.providers[0].baseUrl
  const maxStorageMB = typeof raw.maxStorageMB === 'number' ? raw.maxStorageMB : 500

  // Try to match the old baseUrl to a built-in provider
  const matched = BUILTIN_PROVIDERS.find(p => p.baseUrl === baseUrl.replace(/\/+$/, ''))
  if (matched) {
    const migratedProvider = mergeBuiltinProvider(matched, { apiKey, model })
    if (cfg.providers.some(p => p.id === matched.id)) {
      cfg.providers = cfg.providers.map(p => p.id === matched.id ? migratedProvider : p)
    } else {
      cfg.providers.push(migratedProvider)
    }
    cfg.activeProviderId = supportedActiveProviderId(cfg.providers, matched.id)
  } else if (apiKey) {
    // Custom provider — add it
    cfg.providers.push({ id: CUSTOM_PROVIDER_ID, name: '自定义', model, apiKey, baseUrl, supportsResponseFormat: false, supportsCustomSize: true, maxConcurrency: 1 })
    cfg.activeProviderId = CUSTOM_PROVIDER_ID
  }
  cfg.maxStorageMB = maxStorageMB
  return cfg
}

export function loadConfig(): StandaloneConfig {
  if (typeof window === 'undefined') return getDefaultConfig()
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (isLegacyConfig(raw)) {
      const migrated = migrateLegacy(raw)
      saveConfig(migrated)
      return migrated
    }
    if (Array.isArray(raw.providers) && typeof raw.activeProviderId === 'string') {
      // Merge any new built-in providers that don't exist yet
      const merged = getDefaultConfig()
      merged.providers = merged.providers.map(p => {
        const existing = (raw.providers as ProviderEntry[]).find((e: ProviderEntry) => e.id === p.id)
        return mergeBuiltinProvider(p, existing)
      })
      // Preserve custom providers
      for (const p of (raw.providers as ProviderEntry[])) {
        if (!merged.providers.find(m => m.id === p.id)) {
          const builtin = BUILTIN_PROVIDERS.find(b => b.id === p.id)
          merged.providers.push(builtin
            ? mergeBuiltinProvider(builtin, p)
            : {
                ...p,
                model: typeof p.model === 'string' && p.model.trim() ? p.model.trim() : DEFAULTS.model,
                supportsResponseFormat: p.supportsResponseFormat ?? false,
                supportsCustomSize: p.supportsCustomSize ?? true,
                maxConcurrency: p.maxConcurrency ?? 1,
              })
        }
      }
      merged.activeProviderId = supportedActiveProviderId(merged.providers, raw.activeProviderId)
      merged.maxStorageMB = typeof raw.maxStorageMB === 'number' ? raw.maxStorageMB : 500
      merged.maxHistoryItems = typeof raw.maxHistoryItems === 'number' ? raw.maxHistoryItems : 300
      merged.multiImageLayout = (raw.multiImageLayout === 'vertical' ? 'vertical' : 'horizontal') as MultiImageLayout
      return merged
    }
    return getDefaultConfig()
  } catch {
    return getDefaultConfig()
  }
}

export function saveConfig(config: StandaloneConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function getActiveProvider(config: StandaloneConfig): ProviderEntry {
  const activeId = supportedActiveProviderId(config.providers, config.activeProviderId)
  return config.providers.find(p => p.id === activeId) || getDefaultConfig().providers[0]
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
