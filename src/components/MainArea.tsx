'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImages } from '@fortawesome/free-solid-svg-icons'
import { ImageGrid, type ImageJob } from './ImageGrid'
import { ImagePreviewModal } from './ImagePreviewModal'
import { generateImage, editImage } from '@/lib/api-client'
import { loadRefImage } from '@/lib/db'
import type { HistoryItem } from '@/lib/types'
import type { ProviderEntry } from '@/lib/config'
import type { Quality, PixelTier } from '@/lib/provider-settings'

interface Props {
  jobs: ImageJob[]
  updateJob: (id: string, patch: Partial<ImageJob>) => void
  visibleHistory: HistoryItem[]
  activeProvider: ProviderEntry
  quality: string
  outputSize: string
  refImages: Array<{ file: File }>
  preview: HistoryItem | null
  setPreview: (item: HistoryItem | null) => void
  deleteHistoryItem: (id: string) => void
  addFiles: (files: FileList | File[]) => void
  clearRefs: () => void
  setPrompt: (v: string) => void
  setRatio: (v: string) => void
  setQuality: (v: Quality) => void
  setCount: (v: number) => void
  setPixelTier: (v: PixelTier) => void
}

function timestamp() { return Date.now() }

export function MainArea({ jobs, updateJob, visibleHistory, activeProvider, quality, outputSize, refImages, preview, setPreview, deleteHistoryItem, addFiles, clearRefs, setPrompt, setRatio, setQuality, setCount, setPixelTier }: Props) {
  return (
    <main className="flex min-w-0 flex-1 flex-col relative" style={{ background: '#f5f5f5' }}>
      <div className="flex-1 overflow-y-auto p-6">
        {jobs.length === 0 && visibleHistory.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center" style={{ color: '#616161' }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              <FontAwesomeIcon icon={faImages} className="text-2xl" style={{ color: '#919191' }} />
            </div>
            <p className="text-sm">生成结果会显示在这里</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ImageGrid jobs={jobs} onRetry={(job) => {
              const isEdit = refImages.length > 0
              const auth = { apiKey: activeProvider.apiKey, baseUrl: activeProvider.baseUrl, supportsResponseFormat: activeProvider.supportsResponseFormat }
              void (async () => {
                const startedAt = timestamp()
                updateJob(job.id, { status: 'running', startedAt, error: undefined })
                try {
                  const url = isEdit
                    ? await editImage(auth, { prompt: job.prompt!, quality, size: outputSize, images: refImages as Array<{ file: File }> })
                    : await generateImage(auth, { prompt: job.prompt!, quality, size: outputSize })
                  updateJob(job.id, { status: 'success', url })
                } catch (error) {
                  const msg = error instanceof Error ? error.message : '未知错误'
                  const isNetwork = error instanceof TypeError
                  updateJob(job.id, { status: 'error', error: isNetwork ? `网络连接异常，请检查网络或供应商地址（${msg}）` : msg })
                }
              })()
            }} onCardClick={setPreview} onDelete={deleteHistoryItem} history={visibleHistory} />
          </div>
        )}
      </div>

      <ImagePreviewModal
        item={preview}
        onClose={() => setPreview(null)}
        onDelete={deleteHistoryItem}
        onReuse={async (item) => {
          setPreview(null)
          setPrompt(item.prompt)
          setRatio(item.params.ratio)
          setQuality(item.params.quality)
          setCount(item.params.count)
          if (item.params.pixelTier) setPixelTier(item.params.pixelTier)
          if (item.refImageKeys?.length) {
            clearRefs()
            const loaded = await Promise.all(item.refImageKeys.map(async (key) => {
              const url = await loadRefImage(key)
              if (!url) return null
              const resp = await fetch(url)
              const blob = await resp.blob()
              return new File([blob], 'ref.png', { type: blob.type || 'image/png' })
            }))
            const files = loaded.filter((f): f is File => f !== null)
            if (files.length) addFiles(files)
          }
        }}
      />
    </main>
  )
}
