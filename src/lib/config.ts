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

interface StandaloneConfig {
  apiKey: string
  baseUrl: string
  maxStorageMB: number
}

function loadConfig(): StandaloneConfig {
  if (typeof window === 'undefined') return { apiKey: '', baseUrl: 'https://nowcoding.ai', maxStorageMB: 500 }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      apiKey: saved.apiKey || '',
      baseUrl: saved.baseUrl || 'https://nowcoding.ai',
      maxStorageMB: Number(saved.maxStorageMB) || 500,
    }
  } catch {
    return { apiKey: '', baseUrl: 'https://nowcoding.ai', maxStorageMB: 500 }
  }
}

function saveConfig(config: StandaloneConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export { DEFAULTS, loadConfig, saveConfig }
export type { StandaloneConfig }
