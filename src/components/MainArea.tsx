'use client'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImages, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { ImageGrid, type ImageJob } from './ImageGrid'
import { ImagePreviewModal } from './ImagePreviewModal'
import { generateImage, editImage } from '@/lib/api-client'
import { loadRefImage } from '@/lib/db'
import type { HistoryItem } from '@/lib/types'
import type { ProviderEntry, MultiImageLayout } from '@/lib/config'
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
  warnings: string[]
  multiImageLayout: MultiImageLayout
}

export function MainArea({ jobs, updateJob, visibleHistory, activeProvider, quality, outputSize, refImages, preview, setPreview, deleteHistoryItem, addFiles, clearRefs, setPrompt, setRatio, setQuality, setCount, setPixelTier, warnings, multiImageLayout }: Props) {
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  return (
    <main className="flex min-w-0 flex-1 flex-col relative" style={{ background: '#f5f5f5' }}>
      <div className="flex-1 overflow-y-auto p-6">
        {warnings.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {warnings.map((msg, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-4 py-2.5" style={{ background: 'rgb(211 72 43 / 0.08)', border: '1px solid rgb(211 72 43 / 0.2)' }}>
                <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5 shrink-0" style={{ color: '#d3482b' }} />
                <span className="text-xs" style={{ color: '#d3482b' }}>{msg}</span>
              </div>
            ))}
          </div>
        )}
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
              const jobQuality = job.quality || quality
              const jobSize = job.size || outputSize
              void (async () => {
                const startedAt = Date.now()
                updateJob(job.id, { status: 'running', startedAt, error: undefined })
                try {
                  const url = isEdit
                    ? await editImage(auth, { prompt: job.prompt!, quality: jobQuality, size: jobSize, images: refImages as Array<{ file: File }> })
                    : await generateImage(auth, { prompt: job.prompt!, quality: jobQuality, size: jobSize })
                  updateJob(job.id, { status: 'success', url })
                } catch (error) {
                  const msg = error instanceof Error ? error.message : '未知错误'
                  const isNetwork = error instanceof TypeError
                  updateJob(job.id, { status: 'error', error: isNetwork ? `网络连接异常，请检查网络或供应商地址（${msg}）` : msg })
                }
              })()
            }} onCardClick={(item, idx) => { setPreviewImageIndex(idx ?? 0); setPreview(item) }} onDelete={deleteHistoryItem} history={visibleHistory} multiImageLayout={multiImageLayout} />
          </div>
        )}
      </div>

      <ImagePreviewModal
        item={preview}
        initialImageIndex={previewImageIndex}
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
