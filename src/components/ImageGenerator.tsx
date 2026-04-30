'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { simplifyRatio, sizeFromRatio, type AspectRatio, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, loadConfig, saveConfig, getActiveProvider, type StandaloneConfig, type ProviderEntry } from '@/lib/config'
import { generateImage, editImage } from '@/lib/api-client'
import { saveImages, loadImages, deleteImages, saveRefImage, loadRefImage, getStorageUsage } from '@/lib/db'
import { makeId } from '@/lib/id'
import type { HistoryItem } from '@/lib/types'
import { NavBar } from './NavBar'
import { Sidebar } from './Sidebar'
import { MainArea } from './MainArea'
import type { ImageJob } from './ImageGrid'

type RefItem = {
  id: string
  file: File
  url: string
  width?: number
  height?: number
}

function clampCount(value: number) {
  return Math.max(1, Math.min(10, value))
}
function timestamp() {
  return new Date().getTime()
}
function chineseIndex(index: number) {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] || String(index + 1)
}

const PROMPT_HISTORY_KEY = 'gpt-image-prompt-history'
const MAX_PROMPTS = 50

function loadPromptHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(PROMPT_HISTORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    if (raw.length && typeof raw[0] === 'string') return []
    return raw.filter((item: HistoryItem) => item && typeof item === 'object' && item.id && item.prompt)
  } catch { return [] }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === 'undefined') return
  const stripped = items.map(({ images, ...rest }) => ({
    ...rest,
    images: images.length ? new Array(images.length).fill('') : [],
  }))
  localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(stripped))
}

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState<string>('auto')
  const [pixelTier, setPixelTier] = useState<PixelTier>('1k')
  const [quality, setQuality] = useState<Quality>(DEFAULTS.defaultQuality)
  const [count, setCount] = useState(1)
  const [refImages, setRefImages] = useState<RefItem[]>([])
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<HistoryItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [activeProviderId, setActiveProviderId] = useState('')
  const [draftProviders, setDraftProviders] = useState<ProviderEntry[]>([])
  const [draftActiveId, setDraftActiveId] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxStorageMB, setMaxStorageMB] = useState(500)
  const [draftMaxStorageMB, setDraftMaxStorageMB] = useState(500)
  const [storageUsage, setStorageUsage] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const refImagesRef = useRef<RefItem[]>([])
  const submittingRef = useRef(false)

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!valid.length) return
    setRefImages((current) => {
      const room = Math.max(0, 16 - current.length)
      const nextItems = valid.slice(0, room).map((file) => {
        const id = makeId()
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          setRefImages((items) =>
            items.map((item) => item.id === id ? { ...item, width: img.naturalWidth, height: img.naturalHeight } : item)
          )
          img.onload = null
        }
        img.src = url
        return { id, file, url }
      })
      return [...current, ...nextItems]
    })
  }, [])

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      if (event.clipboardData?.files.length) addFiles(event.clipboardData.files)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [addFiles])

  useEffect(() => { refImagesRef.current = refImages }, [refImages])
  useEffect(() => { return () => refImagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)) }, [])

  useEffect(() => {
    const cfg = loadConfig()
    setProviders(cfg.providers)
    setActiveProviderId(cfg.activeProviderId)
    setMaxStorageMB(cfg.maxStorageMB)
    void (async () => {
      const items = loadPromptHistory()
      const restored = await Promise.all(items.map(async (item) => {
        if (item.images) item.images = await loadImages(item.id, item.images.length || 10)
        if (item.refImageKeys?.length) {
          const refs = await Promise.all(item.refImageKeys.map(k => loadRefImage(k)))
          item.refImages = refs.filter((r): r is string => r !== null)
        }
        return item
      }))
      setHistory(restored)
      setStorageUsage(await getStorageUsage())
    })()
  }, [])

  const autoOptions = useMemo(
    () => refImages.map((item, index) => item.width && item.height
      ? { value: `auto:${item.id}`, title: `auto-${simplifyRatio(item.width, item.height)}`, subtitle: `图${chineseIndex(index)}`, ratio: simplifyRatio(item.width, item.height) }
      : null).filter(Boolean) as Array<{ value: string; title: string; subtitle: string; ratio: string }>,
    [refImages]
  )

  const activeRatio = useMemo(() => {
    if (ratio.startsWith('auto:')) return autoOptions.find((option) => option.value === ratio)?.ratio || '1:1'
    if (ratio === 'auto') return autoOptions[0]?.ratio || '1:1'
    return ratio
  }, [autoOptions, ratio])

  const activeProvider = useMemo(
    () => getActiveProvider({ providers, activeProviderId, maxStorageMB }),
    [providers, activeProviderId]
  )

  const outputSize = useMemo(
    () => sizeFromRatio(activeRatio, pixelTier, DEFAULTS.supportsCustomSize),
    [activeRatio, pixelTier]
  )
  const concurrency = Math.min(DEFAULTS.maxConcurrency, count)

  const visibleHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const activeBatchIds = new Set(jobs.map(j => j.id.split(':')[0]))
    let items = history.filter(item => item.images.length > 0 || !activeBatchIds.has(item.id))
    if (q) items = items.filter(item => item.prompt.toLowerCase().includes(q))
    return items
  }, [history, jobs, searchQuery])

  const updateJob = (id: string, patch: Partial<ImageJob>) => {
    setJobs((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || submittingRef.current) return
    submittingRef.current = true

    const snap = {
      prompt: prompt.trim(), quality, count, pixelTier, outputSize,
      ratio: (ratio === 'auto' ? 'auto' : activeRatio) as AspectRatio,
      isEdit: refImages.length > 0, concurrency, batchId: makeId(),
      startedAt: timestamp(), estimateSeconds: DEFAULTS.defaultEstimateSeconds + (pixelTier === '2k' ? 30 : pixelTier === '4k' ? 60 : 0),
      apiKey: activeProvider.apiKey, baseUrl: activeProvider.baseUrl, providerSupportsResponseFormat: activeProvider.supportsResponseFormat,
    }

    const batch: ImageJob[] = Array.from({ length: snap.count }, (_, index) => ({
      id: `${snap.batchId}:${index}`, index, status: 'queued' as const, estimateSeconds: snap.estimateSeconds,
      prompt: snap.prompt,
      ratioLabel: snap.ratio !== 'auto' ? snap.ratio : undefined, size: snap.outputSize,
      providerName: activeProvider.name, type: snap.isEdit ? 'edit' : 'generate', imageCount: snap.count,
    }))
    setJobs(prev => [...prev, ...batch])
    setLoading(true)

    const refImageKeys: string[] = []
    const refImageUrls: string[] = []
    if (snap.isEdit) {
      for (const ref of refImagesRef.current) {
        try {
          const blob = await fetch(ref.url).then(r => r.blob())
          const key = await saveRefImage(blob)
          refImageKeys.push(key)
          refImageUrls.push(ref.url)
        } catch { /* skip */ }
      }
    }

    const promptEntry: HistoryItem = {
      id: snap.batchId, timestamp: timestamp(), prompt: snap.prompt,
      params: { ratio: snap.ratio, quality: snap.quality, count: snap.count, pixelTier: snap.pixelTier, size: snap.outputSize, provider: { providerName: activeProvider.name, model: DEFAULTS.model, baseUrl: snap.baseUrl }, durationSeconds: Math.round((timestamp() - snap.startedAt) / 1000) },
      images: [], refImages: refImageUrls.length ? refImageUrls : undefined, refImageKeys: refImageKeys.length ? refImageKeys : undefined, type: snap.isEdit ? 'edit' : 'generate',
    }
    const entryNoImages = { ...promptEntry, images: [] as string[] }
    saveHistory([entryNoImages, ...history.filter(p => p.id !== promptEntry.id)].slice(0, MAX_PROMPTS))
    setHistory(prev => [promptEntry, ...prev.filter(p => p.id !== promptEntry.id)].slice(0, MAX_PROMPTS))

    void (async () => {
      const urls: Array<string | null> = Array(batch.length).fill(null)
      const errors: string[] = []
      let cursor = 0
      const workers = Array.from({ length: snap.concurrency }, async () => {
        while (cursor < batch.length) {
          const job = batch[cursor]
          cursor += 1
          updateJob(job.id, { status: 'running', startedAt: timestamp(), error: undefined })
          try {
            const auth = { apiKey: snap.apiKey, baseUrl: snap.baseUrl, supportsResponseFormat: snap.providerSupportsResponseFormat }
            const url = snap.isEdit
              ? await editImage(auth, { prompt: job.prompt!, quality: snap.quality, size: snap.outputSize, images: refImagesRef.current })
              : await generateImage(auth, { prompt: job.prompt!, quality: snap.quality, size: snap.outputSize })
            updateJob(job.id, { status: 'success', url })
            urls[job.index] = url
          } catch (error) {
            const msg = error instanceof Error ? error.message : '未知错误'
            const isNetwork = error instanceof TypeError
            const displayMsg = isNetwork ? `网络连接异常，请检查网络或供应商地址（${msg}）` : msg
            errors.push(displayMsg)
            updateJob(job.id, { status: 'error', error: displayMsg })
          }
        }
      })
      await Promise.all(workers)

      const images = urls.filter(Boolean) as string[]
      if (images.length) await saveImages(snap.batchId, images)
      const allFailed = images.length === 0 && errors.length > 0
      setHistory(prev => {
        const next = prev.map(p => p.id !== snap.batchId ? p : {
          ...p, images: images.length ? images : p.images,
          error: allFailed ? (errors[0] || '全部请求失败') : undefined,
          params: { ...p.params, durationSeconds: Math.round((timestamp() - snap.startedAt) / 1000) },
        })
        setTimeout(() => saveHistory(next), 0)
        return next
      })
      setJobs(prev => prev.filter(j => j.id.startsWith(snap.batchId) ? j.status === 'error' : true))
      setStorageUsage(await getStorageUsage())
    })()

    await new Promise(r => setTimeout(r, 100))
    setLoading(false)
    submittingRef.current = false
  }

  const deleteHistoryItem = async (id: string) => {
    await deleteImages(id)
    setHistory(prev => { const next = prev.filter(p => p.id !== id); saveHistory(next); return next })
    setStorageUsage(await getStorageUsage())
  }

  const removeRef = (id: string) => {
    setRefImages((items) => { const item = items.find((c) => c.id === id); if (item) URL.revokeObjectURL(item.url); return items.filter((c) => c.id !== id) })
  }

  const clearRefs = () => { refImages.forEach((item) => URL.revokeObjectURL(item.url)); setRefImages([]) }

  const hasPrompt = prompt.trim().length > 0
  const selectedSizeLabel = ratio === 'auto'
    ? (autoOptions[0] ? `${autoOptions[0].title}（${autoOptions[0].subtitle}）` : 'auto')
    : autoOptions.find((option) => option.value === ratio)?.title || ratio

  const handleSaveConfig = () => {
    const cfg: StandaloneConfig = { providers: draftProviders, activeProviderId: draftActiveId, maxStorageMB: draftMaxStorageMB }
    saveConfig(cfg)
    setProviders(cfg.providers)
    setActiveProviderId(cfg.activeProviderId)
    setMaxStorageMB(cfg.maxStorageMB)
    setConfigOpen(false)
  }

  const refImagesForMain = refImages as Array<{ file: File }>

  return (
    <div className="flex flex-col min-h-screen lg:h-screen">
      <NavBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <div className="flex flex-col lg:flex-row lg:overflow-hidden" style={{ flex: 1, minHeight: 0, background: '#f5f5f5' }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
      >
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm">
            <p className="text-base font-medium" style={{ color: '#1a1a1a' }}>松开后添加参考图</p>
          </div>
        )}

        <Sidebar
          prompt={prompt} setPrompt={setPrompt}
          ratio={ratio} setRatio={setRatio}
          pixelTier={pixelTier} setPixelTier={setPixelTier}
          quality={quality} setQuality={setQuality}
          count={count} setCount={setCount}
          refImages={refImages} addFiles={addFiles} removeRef={removeRef} clearRefs={clearRefs}
          sizeOpen={sizeOpen} setSizeOpen={setSizeOpen}
          activeProvider={activeProvider} concurrency={concurrency} outputSize={outputSize}
          loading={loading} hasPrompt={hasPrompt} apiKey={activeProvider.apiKey}
          handleSubmit={handleSubmit} autoOptions={autoOptions} selectedSizeLabel={selectedSizeLabel}
          configOpen={configOpen} setConfigOpen={setConfigOpen}
          providers={providers} activeProviderId={activeProviderId}
          draftProviders={draftProviders} setDraftProviders={setDraftProviders}
          draftActiveId={draftActiveId} setDraftActiveId={setDraftActiveId}
          maxStorageMB={maxStorageMB} draftMaxStorageMB={draftMaxStorageMB} setDraftMaxStorageMB={setDraftMaxStorageMB}
          showKey={showKey} setShowKey={setShowKey}
          storageUsage={storageUsage}
          guideOpen={guideOpen} setGuideOpen={setGuideOpen}
          onSaveConfig={handleSaveConfig}
        />

        <MainArea
          jobs={jobs} updateJob={updateJob}
          visibleHistory={visibleHistory}
          activeProvider={activeProvider}
          quality={quality} outputSize={outputSize}
          refImages={refImagesForMain}
          preview={preview} setPreview={setPreview}
          deleteHistoryItem={deleteHistoryItem}
          addFiles={addFiles} clearRefs={clearRefs}
          setPrompt={setPrompt} setRatio={setRatio}
          setQuality={setQuality} setCount={setCount}
          setPixelTier={setPixelTier}
        />
      </div>

      <span className="fixed bottom-3 right-4 text-[10px] select-none pointer-events-none z-30" style={{ color: 'rgb(0 0 0 / 0.08)' }}>@shenghuo2 使用 DeepSeek 制作</span>
    </div>
  )
}
