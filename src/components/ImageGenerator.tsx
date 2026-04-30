'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faCropSimple,
  faEye,
  faEyeSlash,
  faGear,
  faImages,
  faKey,
  faMinus,
  faPlus,
  faSearch,
  faWandMagicSparkles,
  faXmark,
  faLayerGroup,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { ImageGrid, type ImageJob } from './ImageGrid'
import { ImagePreviewModal } from './ImagePreviewModal'
import { RATIO_OPTIONS, simplifyRatio, sizeFromRatio, type AspectRatio, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, loadConfig, saveConfig, type StandaloneConfig } from '@/lib/config'
import { generateImage, editImage } from '@/lib/api-client'
import { saveImages, loadImages, deleteImages, saveRefImage, loadRefImage, getStorageUsage } from '@/lib/db'
import { makeId } from '@/lib/id'
import type { HistoryItem } from '@/lib/types'

type RefItem = {
  id: string
  file: File
  url: string
  width?: number
  height?: number
}

const QUALITIES: Quality[] = ['auto', 'low', 'medium', 'high']
const QUALITY_LABELS: Record<Quality, string> = {
  auto: '自动', low: '低', medium: '中', high: '高',
  standard: '标准', hd: '高清',
}

const PIXEL_TIERS: Array<{ value: PixelTier; label: string; estimate: string }> = [
  { value: '1k', label: '1K', estimate: '~60s' },
  { value: '2k', label: '2K', estimate: '~90s' },
  { value: '4k', label: '4K', estimate: '~120s' },
]

function chineseIndex(index: number) {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] || String(index + 1)
}

function clampCount(value: number) {
  return Math.max(1, Math.min(10, value))
}

function timestamp() {
  return new Date().getTime()
}


const PROMPT_HISTORY_KEY = 'gpt-image-prompt-history'
const MAX_PROMPTS = 50

function loadPromptHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(PROMPT_HISTORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    // Migration: old format was string[], new format is HistoryItem[]
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
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://nowcoding.ai')
  const [draftApiKey, setDraftApiKey] = useState('')
  const [draftBaseUrl, setDraftBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxStorageMB, setMaxStorageMB] = useState(500)
  const [draftMaxStorageMB, setDraftMaxStorageMB] = useState(500)
  const [storageUsage, setStorageUsage] = useState(0)
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

  useEffect(() => {
    refImagesRef.current = refImages
  }, [refImages])

  useEffect(() => {
    return () => refImagesRef.current.forEach((item) => URL.revokeObjectURL(item.url))
  }, [])

  useEffect(() => {
    const cfg = loadConfig()
    setApiKey(cfg.apiKey)
    setBaseUrl(cfg.baseUrl)
    setMaxStorageMB(cfg.maxStorageMB)
    // Load history from localStorage, then restore images from IndexedDB
    void (async () => {
      const items = loadPromptHistory()
      const restored = await Promise.all(items.map(async (item) => {
        if (item.images) {
          const count = item.images.length || 10 // fallback for old saves
          item.images = await loadImages(item.id, count)
        }
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


  const isEditMode = refImages.length > 0
  const autoOptions = useMemo(
    () => refImages
      .map((item, index) => item.width && item.height
        ? { value: `auto:${item.id}`, title: `auto-${simplifyRatio(item.width, item.height)}`, subtitle: `图${chineseIndex(index)}`, ratio: simplifyRatio(item.width, item.height) }
        : null)
      .filter(Boolean) as Array<{ value: string; title: string; subtitle: string; ratio: string }>,
    [refImages]
  )

  const activeRatio = useMemo(() => {
    if (ratio.startsWith('auto:')) return autoOptions.find((option) => option.value === ratio)?.ratio || '1:1'
    if (ratio === 'auto') return autoOptions[0]?.ratio || '1:1'
    return ratio
  }, [autoOptions, ratio])

  const outputSize = useMemo(
    () => sizeFromRatio(activeRatio, pixelTier, DEFAULTS.supportsCustomSize),
    [activeRatio, pixelTier]
  )
  const estimateSeconds = DEFAULTS.defaultEstimateSeconds + (pixelTier === '2k' ? 30 : pixelTier === '4k' ? 60 : 0)
  const concurrency = Math.min(DEFAULTS.maxConcurrency, count)

  // Hide prompt-only history cards that have a running job (avoid duplicate display)
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
      startedAt: timestamp(), estimateSeconds,
      apiKey, baseUrl,
    }

    const batch: ImageJob[] = Array.from({ length: snap.count }, (_, index) => ({
      id: `${snap.batchId}:${index}`, index, status: 'queued' as const, estimateSeconds: snap.estimateSeconds,
      prompt: snap.count === 1 ? snap.prompt : `${snap.prompt} (${index + 1}/${snap.count})`,
      ratioLabel: snap.ratio !== 'auto' ? snap.ratio : undefined,
      size: snap.outputSize,
      providerName: DEFAULTS.model,
      type: snap.isEdit ? 'edit' : 'generate',
      imageCount: snap.count,
    }))
    setJobs(prev => [...prev, ...batch])
    setLoading(true)

    // Save ref images to IndexedDB (deduplicated), snapshot URLs for session display
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

    // Add history entry immediately (no images yet), save to localStorage
    const promptEntry: HistoryItem = {
      id: snap.batchId,
      timestamp: timestamp(),
      prompt: snap.prompt,
      params: {
        ratio: snap.ratio, quality: snap.quality, count: snap.count,
        pixelTier: snap.pixelTier, size: snap.outputSize,
        provider: { providerName: DEFAULTS.model, model: DEFAULTS.model, baseUrl: snap.baseUrl },
        durationSeconds: Math.round((timestamp() - snap.startedAt) / 1000),
      },
      images: [],
      refImages: refImageUrls.length ? refImageUrls : undefined,
      refImageKeys: refImageKeys.length ? refImageKeys : undefined,
      type: snap.isEdit ? 'edit' : 'generate',
    }
    // Save prompt-only entry to localStorage immediately
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
          const startedAt = timestamp()
          updateJob(job.id, { status: 'running', startedAt, error: undefined })
          try {
            const auth = { apiKey: snap.apiKey, baseUrl: snap.baseUrl }
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
      // Persist generated images to IndexedDB
      if (images.length) await saveImages(snap.batchId, images)
      const allFailed = images.length === 0 && errors.length > 0
      // Update the history entry with generated images and save to localStorage
      setHistory(prev => {
        const next = prev.map(p => {
          if (p.id !== snap.batchId) return p
          return {
            ...p,
            images: images.length ? images : p.images,
            error: allFailed ? (errors[0] || '全部请求失败') : undefined,
            params: { ...p.params, durationSeconds: Math.round((timestamp() - snap.startedAt) / 1000) },
          }
        })
        // Save to localStorage after state update, strip blob URLs but keep count
        setTimeout(() => saveHistory(next), 0)
        return next
      })
      // Keep error jobs visible for retry; remove only success/queued jobs
      setJobs(prev => prev.filter(j => j.id.startsWith(snap.batchId) ? j.status === 'error' : true))
      setStorageUsage(await getStorageUsage())
    })()

    await new Promise(r => setTimeout(r, 100))
    setLoading(false)
    submittingRef.current = false
  }

  const deleteHistoryItem = async (id: string) => {
    await deleteImages(id)
    setHistory(prev => {
      const next = prev.filter(p => p.id !== id)
      saveHistory(next)
      return next
    })
    setStorageUsage(await getStorageUsage())
  }

  const removeRef = (id: string) => {
    setRefImages((items) => {
      const item = items.find((current) => current.id === id)
      if (item) URL.revokeObjectURL(item.url)
      return items.filter((current) => current.id !== id)
    })
  }

  const clearRefs = () => {
    refImages.forEach((item) => URL.revokeObjectURL(item.url))
    setRefImages([])
  }

  const hasPrompt = prompt.trim().length > 0
  const selectedSizeLabel = ratio === 'auto'
    ? (autoOptions[0] ? `${autoOptions[0].title}（${autoOptions[0].subtitle}）` : 'auto')
    : autoOptions.find((option) => option.value === ratio)?.title || ratio

  return (
    <div className="flex flex-col min-h-screen lg:h-screen">
      {/* Top navigation */}
      <nav className="flex h-12 shrink-0 items-center border-b" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.08)' }}>
        <div className="flex items-center gap-2 shrink-0 px-3 lg:w-[400px] lg:px-4">
          <img src="./logo.png" alt="" className="h-5 w-5 rounded" />
          <span className="text-[13px] font-semibold truncate" style={{ color: '#1a1a1a' }}>
            <span className="hidden lg:inline">shenghuo2的 GPT-image-2 图片生成站</span>
            <span className="lg:hidden">生蚝的生图站</span>
          </span>
        </div>
        <div className="flex-1 flex items-center min-w-0 gap-2 px-3 lg:px-4">
          <div className="relative w-[120px] lg:w-[220px]">
            <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none" style={{ color: '#919191' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery('') }}
              placeholder="过滤历史..."
              className="w-full h-7 rounded-md border text-xs outline-none transition-colors focus:border-[#346aea]"
              style={{ background: 'rgb(0 0 0 / 0.03)', borderColor: 'rgb(0 0 0 / 0.1)', color: '#1a1a1a', paddingLeft: '2rem', paddingRight: '2rem' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/10"
              >
                <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" style={{ color: '#919191' }} />
              </button>
            )}
          </div>
          <a href="https://github.com/shenghuo2/gpt-image-2-generator-standalone" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:underline shrink-0 ml-auto" style={{ color: '#616161' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span className="hidden lg:inline">GitHub</span>
          </a>
        </div>
      </nav>

      <div
        className="flex flex-col lg:flex-row lg:overflow-hidden"
        style={{ flex: 1, minHeight: 0, background: '#f5f5f5' }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files) }}
      >
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm">
            <p className="text-base font-medium" style={{ color: '#1a1a1a' }}>松开后添加参考图</p>
          </div>
        )}

        <aside className="flex w-full lg:w-[400px] shrink-0 flex-col lg:overflow-hidden border-b lg:border-b-0 lg:border-r" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5 custom-scrollbar">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>参考图片</span>
              <span className="text-xs" style={{ color: '#616161' }}>{refImages.length}/16</span>
            </div>
            <button
              onClick={() => document.getElementById('ref-input')?.click()}
              className="flex h-20 w-20 items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-all duration-200"
              style={{ borderColor: 'rgb(0 0 0 / 0.15)', color: '#616161', background: 'rgb(0 0 0 / 0.03)' }}
            >
              <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
              添加
            </button>
            {refImages.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {refImages.map((item) => (
                  <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border" style={{ background: '#ececec', borderColor: 'rgb(0 0 0 / 0.08)' }}>
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeRef(item.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input id="ref-input" type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} />
            <p className="mt-1.5 text-[10px]" style={{ color: '#bfbfbf' }}>支持粘贴 / Ctrl+V / 拖拽添加图片</p>
            {refImages.length > 0 && (
              <button onClick={clearRefs} className="mt-2 text-xs" style={{ color: '#616161' }}>清空参考图</button>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>提示词</label>
            <div
              className="overflow-hidden rounded-xl border transition-colors focus-within:border-[#336aea]"
              style={{ background: 'rgb(0 0 0 / 0.04)', borderColor: 'rgb(0 0 0 / 0.15)' }}
            >
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSubmit() }}
                placeholder="描述你想生成的图片..."
                className="h-36 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20"
                style={{ color: '#1a1a1a' }}
              />
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 items-center overflow-hidden rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              <button onClick={() => setCount((value) => clampCount(value - 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150" style={{ color: '#616161' }}>
                <FontAwesomeIcon icon={faMinus} className="h-3 w-3" />
              </button>
              <span className="w-7 text-center text-sm font-semibold" style={{ color: '#1a1a1a' }}>{count}</span>
              <button onClick={() => setCount((value) => clampCount(value + 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150" style={{ color: '#616161' }}>
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
              </button>
            </div>

            <div className="relative flex-1">
              <button
                onClick={() => setSizeOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm hover:bg-black/10 transition-colors duration-150"
                style={{ background: 'rgb(0 0 0 / 0.04)', color: '#1a1a1a' }}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <FontAwesomeIcon icon={faCropSimple} className="h-3.5 w-3.5" style={{ color: '#616161' }} />
                  <span className="text-xs">{selectedSizeLabel}</span>
                </span>
                <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5" style={{ color: '#616161' }} />
              </button>
              {sizeOpen && (
                <div className="absolute bottom-12 left-0 z-30 w-[186px] overflow-hidden rounded-xl border bg-white py-1 shadow-2xl" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
                  {(autoOptions.length ? autoOptions : [{ value: 'auto', title: 'auto', subtitle: '自动', ratio: '1:1' }]).map((option) => (
                    <SizeOption key={option.value} title={option.title} subtitle={option.subtitle} onClick={() => { setRatio(option.value); setSizeOpen(false) }} />
                  ))}
                  <div className="my-1 h-px" style={{ background: 'rgb(0 0 0 / 0.08)' }} />
                  {RATIO_OPTIONS.filter((option) => option.value !== 'auto').map((option) => (
                    <SizeOption key={option.value} title={option.title} subtitle={option.subtitle} onClick={() => { setRatio(option.value); setSizeOpen(false) }} wide={option.w > option.h} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex h-10 items-center overflow-hidden rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              {PIXEL_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => setPixelTier(tier.value)}
                  className="h-full flex-1 rounded-md px-2.5 text-xs font-medium transition-colors"
                  style={{
                    background: pixelTier === tier.value ? 'rgb(0 0 0 / 0.1)' : 'transparent',
                    color: '#1a1a1a',
                  }}
                  title={tier.estimate}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>质量</label>
            <div className="flex gap-1 overflow-hidden rounded-lg p-0.5" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              {QUALITIES.map((item) => (
                <button
                  key={item}
                  onClick={() => setQuality(item)}
                  className="h-8 flex-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: quality === item ? '#1a1a1a' : 'transparent',
                    color: quality === item ? '#fff' : '#616161',
                  }}
                >
                  {QUALITY_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-2 pb-1" style={{ background: '#fff' }}>
          <span className="text-[10px]" style={{ color: '#919191' }}>纯静态站点，数据均在浏览器本地，无服务端</span>
          <a href="https://github.com/shenghuo2/gpt-image-2-generator-standalone" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] hover:underline" style={{ color: '#919191' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          源码
          </a>
        </div>
        <div className="space-y-3 border-t p-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
            <FontAwesomeIcon icon={faLayerGroup} className="h-3 w-3" />
            <span className="truncate">{DEFAULTS.model} · 并发 {concurrency} · {outputSize}</span>
            <button
              onClick={() => { setDraftApiKey(apiKey); setDraftBaseUrl(baseUrl); setDraftMaxStorageMB(maxStorageMB); setConfigOpen(true) }}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.1)', border: apiKey ? '' : '1px solid rgb(211 72 43 / 0.3)' }}
            >
              <FontAwesomeIcon icon={faGear} className={`${apiKey ? '' : 'animate-pulse'} h-3.5 w-3.5`} />
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !hasPrompt || !apiKey}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: hasPrompt && !loading && apiKey ? '#346aea' : 'rgb(0 0 0 / 0.04)',
              color: hasPrompt && !loading && apiKey ? '#fff' : '#919191',
              cursor: hasPrompt && !loading && apiKey ? 'pointer' : 'not-allowed',
            }}
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} className="h-4 w-4" />
            <span>{!apiKey ? '请先配置 API Key' : loading ? '生成中...' : '生成'}</span>
          </button>
        </div>
      </aside>

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
                const isEdit = refImagesRef.current.length > 0
                const auth = { apiKey, baseUrl }
                void (async () => {
                  const startedAt = timestamp()
                  updateJob(job.id, { status: 'running', startedAt, error: undefined })
                  try {
                    const url = isEdit
                      ? await editImage(auth, { prompt: job.prompt!, quality, size: outputSize, images: refImagesRef.current })
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
      </main>

      <span className="fixed bottom-3 right-4 text-[10px] select-none pointer-events-none z-30" style={{ color: 'rgb(0 0 0 / 0.08)' }}>@shenghuo2 使用 DeepSeek 制作</span>

      <ImagePreviewModal
        item={preview}
        onClose={() => setPreview(null)}
        onDelete={deleteHistoryItem}
        onReuse={async (item) => {
          setPrompt(item.prompt)
          setRatio(item.params.ratio)
          setQuality(item.params.quality)
          setCount(item.params.count)
          if (item.params.pixelTier) setPixelTier(item.params.pixelTier)
          // Restore ref images from IndexedDB
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

      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfigOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl" style={{ background: '#fff' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
                <FontAwesomeIcon icon={faGear} className="h-4 w-4" style={{ color: '#616161' }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: '#1a1a1a' }}>API 设置</h2>
                <p className={`text-xs rounded-md px-2 py-1 ${!apiKey ? 'font-medium' : ''}`} style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.06)' }}>纯静态站点，数据均在浏览器本地，无服务端</p>
              </div>
              <button onClick={() => setConfigOpen(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 transition-colors duration-150">
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" style={{ color: '#616161' }} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>API Key</span>
                <div className="relative">
                  <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3.5 h-3.5 w-3.5" style={{ color: '#616161' }} />
                  <input
                    value={draftApiKey}
                    onChange={(e) => setDraftApiKey(e.target.value)}
                    type={showKey ? 'text' : 'password'}
                    className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                    style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a', paddingLeft: '2rem', paddingRight: '2.5rem' }}
                    placeholder="sk-..."
                  />
                  <button onClick={() => setShowKey(v => !v)} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-black/5" style={{ color: '#616161' }}>
                    <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>Base URL</span>
                <input
                  value={draftBaseUrl}
                  onChange={(e) => setDraftBaseUrl(e.target.value)}
                  className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                  style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }}
                  placeholder="https://nowcoding.ai"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大存储上限 (MB)</span>
                <div className="flex items-center gap-2">
                  <input
                    value={draftMaxStorageMB}
                    onChange={(e) => setDraftMaxStorageMB(Math.max(10, Number(e.target.value) || 10))}
                    type="number" min={10}
                    className="w-28 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                    style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }}
                  />
                  <span className="text-xs" style={{ color: '#919191' }}>当前已用 {(storageUsage / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
              <button onClick={() => setConfigOpen(false)} className="rounded-lg px-4 py-2 text-sm hover:bg-black/10 transition-colors duration-150" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>取消</button>
              <button
                onClick={() => {
                  const cfg = { apiKey: draftApiKey, baseUrl: draftBaseUrl, maxStorageMB: draftMaxStorageMB }
                  saveConfig(cfg)
                  setApiKey(cfg.apiKey)
                  setBaseUrl(cfg.baseUrl)
                  setMaxStorageMB(cfg.maxStorageMB)
                  setConfigOpen(false)
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ background: '#346aea', color: '#fff' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function SizeOption({ title, subtitle, onClick, wide = false }: { title: string; subtitle: string; onClick: () => void; wide?: boolean }) {
  return (
    <button onClick={onClick} className="flex h-9 w-full items-center gap-3 px-4 text-sm hover:bg-black/10 transition-colors duration-150">
      <span className="flex h-5 w-5 items-center justify-center">
        <span className="block rounded-[2px] border border-[#1a1a1a]" style={{ width: wide ? 16 : 10, height: wide ? 8 : 14 }} />
      </span>
      <span className="w-12 text-left font-medium" style={{ color: '#1a1a1a' }}>{title}</span>
      <span className="text-left text-xs" style={{ color: '#616161' }}>{subtitle}</span>
    </button>
  )
}
