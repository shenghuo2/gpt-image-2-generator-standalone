import type { AspectRatio, PixelTier, ProviderSettings, Quality } from './provider-settings'

export interface HistoryItem {
  id: string
  timestamp: number
  prompt: string
  params: { ratio: AspectRatio; quality: Quality; count: number; pixelTier?: PixelTier; size?: string; style?: string; durationSeconds?: number; provider?: Pick<ProviderSettings, 'providerName' | 'model' | 'baseUrl'> }
  images: string[]
  error?: string
  refImages?: string[]
  refImageKeys?: string[]
  type: 'generate' | 'edit'
}

export type { AspectRatio, PixelTier, ProviderSettings, Quality }
