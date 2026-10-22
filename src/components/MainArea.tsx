'use client'
import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faGear, faImages, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { ImageGrid, type ImageJob } from './ImageGrid'
import { ImagePreviewModal } from './ImagePreviewModal'
import { loadRefImage } from '@/lib/db'
import type { HistoryItem } from '@/lib/types'
import type { MultiImageLayout } from '@/lib/config'
import type { Quality, PixelTier } from '@/lib/provider-settings'

export interface WarningItem {
  id: string
  message: string
  actionLabel?: string
}

interface Props {
  jobs: ImageJob[]
  visibleHistory: HistoryItem[]
  historyPage: number
  historyPageCount: number
  totalHistoryCount: number
  onHistoryPageChange: (page: number) => void
  preview: HistoryItem | null
  onPreviewChange: (item: HistoryItem | null) => void
  deleteHistoryItem: (id: string) => Promise<boolean>
  retryJob: (job: ImageJob) => void
  retryHistoryItem: (item: HistoryItem) => void
  addFiles: (files: FileList | File[]) => void
  clearRefs: () => void
  setPrompt: (v: string) => void
  setRatio: (v: string) => void
  setQuality: (v: Quality) => void
  setCount: (v: number) => void
  setPixelTier: (v: PixelTier) => void
  warnings: WarningItem[]
  searchQuery: string
  onClearSearch: () => void
  multiImageLayout: MultiImageLayout
  onDeleteOldestImages: () => void
  onOpenConfig: () => void
}

export function MainArea({ jobs, visibleHistory, historyPage, historyPageCount, totalHistoryCount, onHistoryPageChange, preview, onPreviewChange, deleteHistoryItem, retryJob, retryHistoryItem, addFiles, clearRefs, setPrompt, setRatio, setQuality, setCount, setPixelTier, warnings, searchQuery, onClearSearch, multiImageLayout, onDeleteOldestImages, onOpenConfig }: Props) {
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const previewTriggerRef = useRef<HTMLElement | null>(null)
  const resultsScrollRef = useRef<HTMLDivElement | null>(null)
  const changeHistoryPage = (page: number) => {
    onHistoryPageChange(page)
    resultsScrollRef.current?.scrollTo({ top: 0 })
    if (window.innerWidth < 1024) document.getElementById('main-content')?.scrollIntoView({ block: 'start' })
  }
  return (
    <main id="main-content" className="flex min-w-0 flex-1 flex-col relative" style={{ background: '#f5f5f5' }}>
      <div ref={resultsScrollRef} className="flex-1 overflow-y-auto p-6">
        {warnings.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {warnings.map((warning) => (
              <div key={warning.id} role={warning.id === 'storage-error' ? 'alert' : 'status'} className="flex flex-wrap items-center gap-2.5 rounded-xl px-4 py-2.5" style={{ background: 'rgb(211 72 43 / 0.08)', border: '1px solid rgb(211 72 43 / 0.2)' }}>
                <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5 shrink-0" style={{ color: '#d3482b' }} />
                <span className="min-w-0 flex-1 text-xs" style={{ color: '#a8321d' }}>{warning.message}</span>
                {warning.actionLabel && (
                  <button
                    onClick={onDeleteOldestImages}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors hover:opacity-90"
                    style={{ background: '#b33a24', color: '#fff' }}
                  >
                    {warning.actionLabel}
                  </button>
                )}
                <button
                  onClick={onOpenConfig}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-90"
                  style={{ border: '1px solid rgb(211 72 43 / 0.4)', color: '#a8321d', background: 'rgb(211 72 43 / 0.06)' }}
                >
                  <FontAwesomeIcon icon={faGear} className="h-3 w-3" />修改设置
                </button>
              </div>
            ))}
          </div>
        )}
        {jobs.length === 0 && visibleHistory.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center" style={{ color: '#616161' }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              <FontAwesomeIcon icon={faImages} className="text-2xl" style={{ color: '#919191' }} />
            </div>
            <p className="text-sm">{searchQuery.trim() ? '没有匹配的历史记录' : '生成结果会显示在这里'}</p>
            {searchQuery.trim() && <button type="button" onClick={onClearSearch} className="rounded-md px-3 py-1.5 text-xs font-medium underline focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#346aea' }}>清除搜索</button>}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ImageGrid jobs={jobs} onRetryJob={retryJob} onRetryHistory={retryHistoryItem} onCardClick={(item, idx) => { previewTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPreviewImageIndex(idx ?? 0); onPreviewChange(item) }} onDelete={deleteHistoryItem} history={visibleHistory} multiImageLayout={multiImageLayout} />
          </div>
        )}
        {historyPageCount > 1 && (
          <nav aria-label="历史记录分页" className="mt-6 flex items-center justify-center gap-3">
            <button type="button" aria-label="上一页历史记录" title="上一页" disabled={historyPage === 1} onClick={() => changeHistoryPage(historyPage - 1)} className="flex h-9 w-9 items-center justify-center rounded-md border bg-white transition-colors hover:bg-black/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#346aea]"><FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" aria-hidden="true" /></button>
            <span aria-live="polite" className="min-w-0 text-center text-xs tabular-nums" style={{ color: '#616161' }}>第 {historyPage} / {historyPageCount} 页 · 共 {totalHistoryCount} 条</span>
            <button type="button" aria-label="下一页历史记录" title="下一页" disabled={historyPage === historyPageCount} onClick={() => changeHistoryPage(historyPage + 1)} className="flex h-9 w-9 items-center justify-center rounded-md border bg-white transition-colors hover:bg-black/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#346aea]"><FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" aria-hidden="true" /></button>
          </nav>
        )}
      </div>

      <ImagePreviewModal
        key={preview?.id ? `${preview.id}-${previewImageIndex}` : undefined}
        item={preview}
        initialImageIndex={previewImageIndex}
        onClose={() => onPreviewChange(null)}
        onCloseAutoFocus={() => previewTriggerRef.current?.isConnected ? previewTriggerRef.current.focus() : document.querySelector<HTMLTextAreaElement>('#generation-prompt')?.focus()}
        onDelete={deleteHistoryItem}
        onReuse={async (item) => {
          onPreviewChange(null)
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
