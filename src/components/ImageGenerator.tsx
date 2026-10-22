'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { snapRatioToStandard, sizeFromRatio, validateSize, round16, type AspectRatio, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, getDefaultConfig, loadConfig, saveConfig, getActiveProvider, getLocalStorageUsage, isRetiredProvider, supportedActiveProviderId, type StandaloneConfig, type ProviderEntry, type MultiImageLayout } from '@/lib/config'
import { generateImage, editImage } from '@/lib/api-client'
import { saveImage, loadImages, deleteImages, saveRefImage, loadRefImage, pruneRefImages, getStorageUsage, getImageCount } from '@/lib/db'
import { oldestImageDeletePlan, partialFailureMessage, referencedImageKeys, remainingRetryCount, runBatch } from '@/lib/generation'
import { makeId } from '@/lib/id'
import type { HistoryItem, RefItem } from '@/lib/types'
import { NavBar } from './NavBar'
import { Sidebar } from './Sidebar'
import { MainArea, type WarningItem } from './MainArea'
import type { ImageJob } from './ImageGrid'

function chineseIndex(index: number) {
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] || String(index + 1)
}

const PROMPT_HISTORY_KEY = 'gpt-image-prompt-history'
const MAX_REF_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_REF_BATCH_BYTES = 100 * 1024 * 1024
const HISTORY_PAGE_SIZE = 24

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
    // refImages holds session-only blob: URLs that can't survive a reload —
    // persisting them only stores dead strings that bloat localStorage. They're
    // rebuilt from refImageKeys lazily when a preview opens (see handlePreviewChange).
    refImages: undefined,
  }))
  localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(stripped))
}

function revokeImageUrls(images: string[]) {
  for (const url of images) {
    // Only object URLs need releasing; remote https URLs are a no-op for revoke.
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}

function retainPendingKey(pending: Map<string, number>, key: string) {
  pending.set(key, (pending.get(key) || 0) + 1)
}

function releasePendingKeys(pending: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    const remaining = (pending.get(key) || 0) - 1
    if (remaining > 0) pending.set(key, remaining)
    else pending.delete(key)
  }
}

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState<string>('auto')
  const [customSize, setCustomSize] = useState({ w: 1024, h: 1024 })
  const [pixelTier, setPixelTier] = useState<PixelTier>('1k')
  const [quality, setQuality] = useState<Quality>(DEFAULTS.defaultQuality)
  const [count, setCount] = useState(1)
  const [refImages, setRefImages] = useState<RefItem[]>([])
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<HistoryItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  // Keep the server render and the first client render identical. Browser config
  // is applied after hydration so an existing provider cannot change SSR text.
  const [initialConfig] = useState(() => getDefaultConfig())
  const [providers, setProviders] = useState<ProviderEntry[]>(() => initialConfig.providers)
  const [activeProviderId, setActiveProviderId] = useState(() => initialConfig.activeProviderId)
  const [draftProviders, setDraftProviders] = useState<ProviderEntry[]>([])
  const [draftActiveId, setDraftActiveId] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxStorageMB, setMaxStorageMB] = useState(() => initialConfig.maxStorageMB)
  const [maxHistoryItems, setMaxHistoryItems] = useState(() => initialConfig.maxHistoryItems)
  const [multiImageLayout, setMultiImageLayout] = useState<MultiImageLayout>(() => initialConfig.multiImageLayout)
  const [draftMaxStorageMB, setDraftMaxStorageMB] = useState(500)
  const [draftMaxHistoryItems, setDraftMaxHistoryItems] = useState(300)
  const [draftMultiImageLayout, setDraftMultiImageLayout] = useState<MultiImageLayout>('horizontal')
  const [storageUsage, setStorageUsage] = useState(0)
  const [imageCount, setImageCount] = useState(0)
  const [localStorageUsage, setLocalStorageUsage] = useState({ usedBytes: 0, quotaBytes: 5 * 1024 * 1024 })
  const [guideOpen, setGuideOpen] = useState(false)
  const [refImportError, setRefImportError] = useState('')
  const [storageIssue, setStorageIssue] = useState('')
  const [configSaveError, setConfigSaveError] = useState('')
  const refImagesRef = useRef<RefItem[]>([])
  const historyRef = useRef<HistoryItem[]>([])
  const retryPersistenceRef = useRef<Promise<unknown>>(Promise.resolve())
  const retryingIdsRef = useRef(new Set<string>())
  const pendingRefKeysRef = useRef(new Map<string, number>())
  const loadingHistoryIdsRef = useRef(new Set<string>())
  const mountedRef = useRef(false)
  const configTriggerRef = useRef<HTMLElement | null>(null)
  const previewLoadedUrlsRef = useRef<string[]>([])
  const previewIdRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const reorderDraggingRef = useRef(false)
  const onReorderActive = (v: boolean) => { reorderDraggingRef.current = v }

  const addFiles = useCallback((files: FileList | File[]) => {
    const selected = Array.from(files)
    const room = Math.max(0, 16 - refImagesRef.current.length)
    let remainingBytes = Math.max(0, MAX_REF_BATCH_BYTES - refImagesRef.current.reduce((total, item) => total + item.file.size, 0))
    const accepted: File[] = []
    const rejected: string[] = []
    for (const file of selected) {
      if (!file.type.startsWith('image/')) rejected.push('仅支持图片文件')
      else if (file.size > MAX_REF_IMAGE_BYTES) rejected.push('单张图片不能超过 20 MB')
      else if (accepted.length >= room) rejected.push('最多添加 16 张参考图')
      else if (file.size > remainingBytes) rejected.push('参考图总大小不能超过 100 MB')
      else { accepted.push(file); remainingBytes -= file.size }
    }
    setRefImportError([...new Set(rejected)].join('；'))
    if (!accepted.length) return
    setRefImages((current) => {
      const room = Math.max(0, 16 - current.length)
      const nextItems = accepted.slice(0, room).map((file) => {
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
  useEffect(() => { historyRef.current = history }, [history])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => { return () => refImagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)) }, [])
  useEffect(() => { return () => historyRef.current.forEach(item => revokeImageUrls([...item.images, ...(item.refImages || [])])) }, [])
  useEffect(() => { return () => revokeImageUrls(previewLoadedUrlsRef.current) }, [])

  const refreshStorageStats = useCallback(async () => {
    try {
      const [usage, count] = await Promise.all([getStorageUsage(), getImageCount()])
      setStorageUsage(usage)
      setImageCount(count)
      setLocalStorageUsage(getLocalStorageUsage())
    } catch (error) {
      setStorageIssue(error instanceof Error ? `无法读取浏览器图片存储：${error.message}` : '无法读取浏览器图片存储')
    }
  }, [])

  useEffect(() => {
    void (async () => {
      // Yield once so these browser-only values are applied after hydration.
      await Promise.resolve()
      const saved = loadConfig()
      setProviders(saved.providers)
      setActiveProviderId(saved.activeProviderId)
      setMaxStorageMB(saved.maxStorageMB)
      setMaxHistoryItems(saved.maxHistoryItems)
      setMultiImageLayout(saved.multiImageLayout)
      setLocalStorageUsage(getLocalStorageUsage())
    })()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const restored = loadPromptHistory().map(item => ({
        ...item,
        images: new Array(item.images?.length || 0).fill('') as string[],
        refImages: undefined,
      }))
      if (cancelled) return
      const currentIds = new Set(historyRef.current.map(item => item.id))
      const recovered = restored.filter(item => !currentIds.has(item.id))
      const merged = [...historyRef.current, ...recovered]
      historyRef.current = merged
      setHistory(merged)
      setHistoryReady(true)
      try { await pruneRefImages(() => new Set([...referencedImageKeys(historyRef.current), ...pendingRefKeysRef.current.keys()])) }
      catch { setStorageIssue('无法清理未使用的参考图') }
      if (!cancelled) await refreshStorageStats()
    })()
    return () => { cancelled = true }
  }, [refreshStorageStats])

  const autoOptions = useMemo(
    () => refImages.map((item, index) => item.width && item.height
      ? { value: `auto:${item.id}`, title: `auto-${snapRatioToStandard(item.width, item.height)}`, subtitle: `图${chineseIndex(index)}`, ratio: snapRatioToStandard(item.width, item.height) }
      : null).filter(Boolean) as Array<{ value: string; title: string; subtitle: string; ratio: string }>,
    [refImages]
  )

  const activeRatio = useMemo(() => {
    if (ratio.startsWith('auto:')) return autoOptions.find((option) => option.value === ratio)?.ratio || '1:1'
    if (ratio === 'auto') return autoOptions[0]?.ratio || '1:1'
    return ratio
  }, [autoOptions, ratio])

  const activeProvider = useMemo(
    () => getActiveProvider({ providers, activeProviderId, maxStorageMB, maxHistoryItems, multiImageLayout }),
    [providers, activeProviderId, maxStorageMB, maxHistoryItems, multiImageLayout]
  )
  const customSizeErrors = ratio === 'custom' && activeProvider.supportsCustomSize ? validateSize(round16(customSize.w), round16(customSize.h)) : []

  const outputSize = useMemo(() => {
    if (ratio === 'custom' && activeProvider.supportsCustomSize) {
      return `${round16(customSize.w)}x${round16(customSize.h)}`
    }
    const requestedRatio = ratio === 'custom' ? `${customSize.w}:${customSize.h}` : activeRatio
    return sizeFromRatio(requestedRatio, pixelTier, activeProvider.supportsCustomSize)
  }, [ratio, customSize, activeRatio, pixelTier, activeProvider.supportsCustomSize])
  const concurrency = Math.min(activeProvider.maxConcurrency || 1, count)

  const visibleHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const activeBatchIds = new Set(jobs.map(j => j.id.split(':')[0]))
    let items = history.filter(item => item.images.length > 0 || !activeBatchIds.has(item.id))
    if (q) items = items.filter(item => item.prompt.toLowerCase().includes(q))
    return items
  }, [history, jobs, searchQuery])

  const historyPageCount = Math.max(1, Math.ceil(visibleHistory.length / HISTORY_PAGE_SIZE))
  const currentHistoryPage = Math.min(historyPage, historyPageCount)
  const pageHistory = useMemo(
    () => visibleHistory.slice((currentHistoryPage - 1) * HISTORY_PAGE_SIZE, currentHistoryPage * HISTORY_PAGE_SIZE),
    [visibleHistory, currentHistoryPage]
  )

  useEffect(() => {
    for (const item of pageHistory) {
      if (!item.images.length || !item.images.every(url => !url) || loadingHistoryIdsRef.current.has(item.id)) continue
      loadingHistoryIdsRef.current.add(item.id)
      void loadImages(item.id, item.images.length).then(urls => {
        loadingHistoryIdsRef.current.delete(item.id)
        const current = historyRef.current.find(entry => entry.id === item.id)
        if (!mountedRef.current || !current || !current.images.every(url => !url)) {
          revokeImageUrls(urls)
          return
        }
        const next = historyRef.current.map(entry => entry.id === item.id ? {
          ...entry,
          images: urls,
          error: urls.length ? entry.error : entry.error || '历史图片无法读取，可能已被浏览器清理',
        } : entry)
        historyRef.current = next
        setHistory(next)
      }).catch(error => {
        loadingHistoryIdsRef.current.delete(item.id)
        if (!mountedRef.current) return
        const next = historyRef.current.map(entry => entry.id === item.id ? {
          ...entry,
          images: [],
          error: '历史图片读取失败，请刷新页面重试',
        } : entry)
        historyRef.current = next
        setHistory(next)
        setStorageIssue(error instanceof Error ? `部分历史图片无法读取：${error.message}` : '部分历史图片无法读取')
      })
    }
  }, [pageHistory])

  const updateJob = (id: string, patch: Partial<ImageJob>) => {
    setJobs((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const maxStorageBytes = maxStorageMB * 1024 * 1024
  const canSubmit = Boolean(historyReady && prompt.trim() && activeProvider.apiKey.trim() && !loading && !isRetiredProvider(activeProvider) && customSizeErrors.length === 0)

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true
    setStorageIssue('')

    const snap = {
      prompt: prompt.trim(), quality, count, pixelTier, outputSize,
      ratio: (ratio === 'auto' ? 'auto' : activeRatio) as AspectRatio,
      isEdit: refImages.length > 0, concurrency, batchId: makeId(),
      startedAt: Date.now(), estimateSeconds: DEFAULTS.defaultEstimateSeconds + (pixelTier === '2k' ? 30 : pixelTier === '4k' ? 60 : 0),
      apiKey: activeProvider.apiKey, baseUrl: activeProvider.baseUrl, model: activeProvider.model || DEFAULTS.model, providerSupportsResponseFormat: activeProvider.supportsResponseFormat,
      maxStorageBytes,
    }
    const frozenRefs = [...refImagesRef.current]

    const batch: ImageJob[] = Array.from({ length: snap.count }, (_, index) => ({
      id: `${snap.batchId}:${index}`, index, status: 'queued' as const, estimateSeconds: snap.estimateSeconds,
      prompt: snap.prompt, quality: snap.quality,
      ratioLabel: snap.ratio !== 'auto' ? snap.ratio : undefined, size: snap.outputSize,
      providerName: activeProvider.name, type: snap.isEdit ? 'edit' : 'generate', imageCount: snap.count,
    }))
    setHistoryPage(1)
    setJobs(prev => [...prev, ...batch])
    setLoading(true)

    const refImageKeys: string[] = []
    try {
      const refSaveErrors: string[] = []
      if (snap.isEdit) {
        for (const ref of frozenRefs) {
          try {
            const key = await saveRefImage(ref.file, snap.maxStorageBytes, key => retainPendingKey(pendingRefKeysRef.current, key))
            refImageKeys.push(key)
          }
          catch (error) { refSaveErrors.push(error instanceof Error ? error.message : '参考图保存失败') }
        }
      }

      const promptEntry: HistoryItem = {
        id: snap.batchId, timestamp: Date.now(), prompt: snap.prompt,
        params: { ratio: snap.ratio, quality: snap.quality, count: snap.count, pixelTier: snap.pixelTier, size: snap.outputSize, provider: { providerName: activeProvider.name, model: snap.model, baseUrl: snap.baseUrl }, durationSeconds: 0 },
        images: [], refImages: snap.isEdit ? frozenRefs.map(ref => ref.url) : undefined,
        refImageKeys: refImageKeys.length ? refImageKeys : undefined, type: snap.isEdit ? 'edit' : 'generate',
      }
      const allItems = [promptEntry, ...historyRef.current.filter(item => item.id !== promptEntry.id)]
      const kept = allItems.slice(0, maxHistoryItems)
      const truncated = allItems.slice(maxHistoryItems)
      saveHistory(kept)
      historyRef.current = kept
      setHistory(kept)
      releasePendingKeys(pendingRefKeysRef.current, refImageKeys)
      if (truncated.length) {
        for (const item of truncated) {
          try { await deleteImages(item.id); revokeImageUrls(item.images) }
          catch { setStorageIssue('旧图片清理失败，可能占用额外存储空间') }
        }
        try { await pruneRefImages(() => new Set([...referencedImageKeys(historyRef.current), ...pendingRefKeysRef.current.keys()])) }
        catch { setStorageIssue('未使用的参考图清理失败') }
      }
      await refreshStorageStats()

      void (async () => {
        try {
          const auth = { apiKey: snap.apiKey, baseUrl: snap.baseUrl, model: snap.model, supportsResponseFormat: snap.providerSupportsResponseFormat }
          const results = await runBatch(batch, snap.concurrency,
            job => snap.isEdit
              ? editImage(auth, { prompt: job.prompt!, quality: snap.quality, size: snap.outputSize, images: frozenRefs })
              : generateImage(auth, { prompt: job.prompt!, quality: snap.quality, size: snap.outputSize }),
            (index, result) => {
              const job = batch[index]
              if (result.status === 'fulfilled') updateJob(job.id, { status: 'success', url: result.value })
              else {
                const reason = result.reason
                const message = reason instanceof Error ? reason.message : '未知错误'
                updateJob(job.id, { status: 'error', error: reason instanceof TypeError ? `网络连接异常，请检查网络或供应商地址（${message}）` : message })
              }
            },
            index => updateJob(batch[index].id, { status: 'running', startedAt: Date.now(), error: undefined }),
          )

          await (retryPersistenceRef.current = retryPersistenceRef.current.catch(() => undefined).then(async () => {
            const latest = historyRef.current
            const target = latest.find(item => item.id === snap.batchId)
            if (!target) return
            const generated = results.filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled').map(result => result.value)
            const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
            const saveErrors: string[] = []
            let savedIndex = target.images.length
            for (const url of generated) {
              const saved = await saveImage(snap.batchId, savedIndex, url, snap.maxStorageBytes)
              if (saved.saved) savedIndex++
              else saveErrors.push(saved.error || '图片保存失败')
            }
            const images = [...target.images, ...generated].slice(0, batch.length)
            const parts = [
              failed ? partialFailureMessage(images.length, batch.length, failed.reason instanceof Error ? failed.reason.message : '未知错误') : undefined,
              saveErrors.length ? `${saveErrors.length} 张图片未保存到浏览器，刷新前请先下载：${saveErrors[0]}` : undefined,
              refSaveErrors.length ? '部分参考图未保存，刷新后可能无法复用' : undefined,
            ].filter(Boolean)
            const next = latest.map(item => item.id !== snap.batchId ? item : {
              ...item,
              images,
              error: parts.join('；') || undefined,
              params: { ...item.params, durationSeconds: Math.round((Date.now() - snap.startedAt) / 1000) },
            })
            try { saveHistory(next) }
            catch { setStorageIssue('历史记录保存失败，刷新前请下载本次图片') }
            historyRef.current = next
            setHistory(next)
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知错误'
          setStorageIssue(`生成结果处理失败：${message}`)
          const next = historyRef.current.map(item => item.id === snap.batchId ? { ...item, error: `生成结果处理失败：${message}` } : item)
          historyRef.current = next
          setHistory(next)
          try { saveHistory(next) } catch { /* surfaced above */ }
        } finally {
          setJobs(prev => prev.filter(job => !job.id.startsWith(`${snap.batchId}:`)))
          await refreshStorageStats()
        }
      })()
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      setStorageIssue(`无法开始生成：${message}`)
      setJobs(prev => prev.map(job => job.id.startsWith(`${snap.batchId}:`) ? { ...job, status: 'error', error: `无法开始生成：${message}` } : job))
      releasePendingKeys(pendingRefKeysRef.current, refImageKeys)
      try { await pruneRefImages(() => new Set([...referencedImageKeys(historyRef.current), ...pendingRefKeysRef.current.keys()])) }
      catch { /* original error is already shown */ }
    } finally {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setLoading(false)
      submittingRef.current = false
    }
  }

  const deleteHistoryItem = async (id: string) => {
    if (!window.confirm('确定删除这条记录及其图片吗？删除后无法恢复。')) return false
    const removed = historyRef.current.find(p => p.id === id)
    if (!removed) return false
    const next = historyRef.current.filter(p => p.id !== id)
    try {
      saveHistory(next)
      historyRef.current = next
      setHistory(next)
      if (previewIdRef.current === id) {
        previewIdRef.current = null
        revokeImageUrls(previewLoadedUrlsRef.current)
        previewLoadedUrlsRef.current = []
        setPreview(null)
      }
      await deleteImages(id)
      revokeImageUrls([...removed.images, ...(removed.refImages || [])])
      await pruneRefImages(() => new Set([...referencedImageKeys(historyRef.current), ...pendingRefKeysRef.current.keys()]))
      await refreshStorageStats()
      return true
    } catch (error) {
      setStorageIssue(error instanceof Error ? `删除未完成：${error.message}` : '删除未完成')
      return false
    }
  }

  const retryHistoryItem = (item: HistoryItem) => {
    const current = historyRef.current.find(entry => entry.id === item.id)
    if (!current || !remainingRetryCount(current.images.length, current.params.count) || retryingIdsRef.current.has(item.id)) return
    if (!activeProvider.apiKey.trim()) { setStorageIssue('请先在设置中填写当前供应商的 API Key'); return }
    const previousProvider = current.params.provider
    if (previousProvider?.baseUrl && previousProvider.baseUrl !== activeProvider.baseUrl &&
        !window.confirm(`原记录使用 ${previousProvider.providerName}。现在将用 ${activeProvider.name} 重试，是否继续？`)) return
    retryingIdsRef.current.add(item.id)
    const jobId = `${item.id}:${makeId()}`
    const estimateSeconds = DEFAULTS.defaultEstimateSeconds + (item.params.pixelTier === '2k' ? 30 : item.params.pixelTier === '4k' ? 60 : 0)
    const job: ImageJob = {
      id: jobId,
      index: item.images.length,
      status: 'queued',
      estimateSeconds,
      prompt: item.prompt,
      quality: item.params.quality,
      ratioLabel: item.params.ratio !== 'auto' ? item.params.ratio : undefined,
      size: item.params.size || outputSize,
      providerName: activeProvider.name,
      type: item.type,
      imageCount: item.params.count,
    }

    setJobs(prev => [...prev, job])

    void (async () => {
      const startedAt = Date.now()
      updateJob(jobId, { status: 'running', startedAt, error: undefined })
      try {
        const auth = { apiKey: activeProvider.apiKey, baseUrl: activeProvider.baseUrl, model: activeProvider.model, supportsResponseFormat: activeProvider.supportsResponseFormat }
        const size = item.params.size || outputSize
        const url = item.type === 'edit'
          ? await editImage(auth, { prompt: item.prompt, quality: item.params.quality, size, images: await loadHistoryRefFiles(item) })
          : await generateImage(auth, { prompt: item.prompt, quality: item.params.quality, size })

        updateJob(jobId, { status: 'success', url })
        await persistHistoryImage(item.id, url, Math.round((Date.now() - startedAt) / 1000))
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误'
        const isNetwork = error instanceof TypeError
        const displayMsg = isNetwork ? `网络连接异常，请检查网络或供应商地址（${msg}）` : msg
        updateJob(jobId, { status: 'error', error: displayMsg })
        const next = historyRef.current.map(p => p.id !== item.id ? p : { ...p, error: displayMsg })
        historyRef.current = next
        setHistory(next)
        try { saveHistory(next) } catch { setStorageIssue('重试状态未能保存，刷新前请下载已有图片') }
      } finally {
        retryingIdsRef.current.delete(item.id)
        setJobs(prev => prev.filter(j => j.id !== jobId))
      }
    })()
  }

  const retryJob = (job: ImageJob) => {
    const historyId = job.id.split(':')[0]
    const existing = historyRef.current.find(item => item.id === historyId)
    if (existing) {
      retryHistoryItem(existing)
      if (retryingIdsRef.current.has(existing.id)) setJobs(prev => prev.filter(item => item.id !== job.id))
      return
    }

    if (!activeProvider.apiKey.trim()) { updateJob(job.id, { error: '请先配置 API Key' }); return }

    const isEdit = (job.type === 'edit') || (!job.type && refImagesRef.current.length > 0)
    const fallback: HistoryItem = {
      id: historyId,
      timestamp: job.startedAt || 0,
      prompt: job.prompt || prompt.trim(),
      params: {
        ratio: (job.ratioLabel || activeRatio) as AspectRatio,
        quality: (job.quality || quality) as Quality,
        count: job.imageCount || 1,
        pixelTier,
        size: job.size || outputSize,
        provider: { providerName: job.providerName || activeProvider.name, model: activeProvider.model || DEFAULTS.model, baseUrl: activeProvider.baseUrl },
      },
      images: [],
      error: job.error,
      // Session-only URLs let the retry run immediately; refImageKeys are
      // persisted below so a reload can still rebuild the reference images.
      refImages: isEdit ? refImagesRef.current.map(item => item.url) : undefined,
      type: isEdit ? 'edit' : 'generate',
    }
    const next = [fallback, ...historyRef.current]
    try { saveHistory(next) }
    catch (error) { updateJob(job.id, { error: error instanceof Error ? error.message : '历史记录无法保存' }); return }
    historyRef.current = next
    setHistory(next)
    setJobs(prev => prev.filter(item => item.id !== job.id))
    if (isEdit) {
      void (async () => {
        const keys: string[] = []
        for (const ref of refImagesRef.current) {
          try {
            const key = await saveRefImage(ref.file, maxStorageBytes, key => retainPendingKey(pendingRefKeysRef.current, key))
            keys.push(key)
          } catch { /* skip */ }
        }
        if (!keys.length) return
        const withKeys = historyRef.current.map(p => p.id !== historyId ? p : { ...p, refImageKeys: keys })
        historyRef.current = withKeys
        try { saveHistory(withKeys) } catch { setStorageIssue('参考图状态未能保存') }
        setHistory(withKeys)
        releasePendingKeys(pendingRefKeysRef.current, keys)
      })()
    }
    retryHistoryItem(fallback)
  }

  const loadHistoryRefFiles = async (item: HistoryItem): Promise<Array<{ file: File }>> => {
    const fromStorage = Boolean(item.refImageKeys?.length)
    const urls = fromStorage
      ? (await Promise.all(item.refImageKeys!.map(key => loadRefImage(key)))).filter((url): url is string => Boolean(url))
      : item.refImages || []
    try {
      const files = await Promise.all(urls.map(async (url, index) => {
        const resp = await fetch(url)
        const blob = await resp.blob()
        return { file: new File([blob], `ref-${index + 1}.png`, { type: blob.type || 'image/png' }) }
      }))
      if (!files.length || (fromStorage && files.length !== item.refImageKeys?.length)) throw new Error('参考图不完整，无法重试图生图')
      return files
    } finally {
      if (fromStorage) revokeImageUrls(urls)
    }
  }

  const handlePreviewChange = useCallback((item: HistoryItem | null) => {
    revokeImageUrls(previewLoadedUrlsRef.current)
    previewLoadedUrlsRef.current = []
    previewIdRef.current = item?.id || null
    if (!item) { setPreview(null); return }
    // Open immediately, then lazy-load reference images only for this preview —
    // avoids creating blob URLs for every history entry on startup.
    setPreview(item)
    const keys = item.refImageKeys
    if (keys?.length && !item.refImages?.length) {
      void (async () => {
        const refs = await Promise.all(keys.map(k => loadRefImage(k)))
        const refImages = refs.filter((r): r is string => r !== null)
        if (previewIdRef.current !== item.id) revokeImageUrls(refImages)
        else {
          previewLoadedUrlsRef.current = refImages
          setPreview(prev => prev && prev.id === item.id ? { ...prev, refImages } : prev)
        }
      })()
    }
  }, [])

  const deleteOldestImageRecords = useCallback(async () => {
    const current = historyRef.current
    const plan = oldestImageDeletePlan(current)
    if (!plan.ids.length) return
    if (!window.confirm(`确定删除最旧的 ${plan.imageCount} 张图片及 ${plan.recordCount} 条记录吗？删除后无法恢复。`)) return

    const deletedIds = new Set(plan.ids)
    const next = current.filter(item => !deletedIds.has(item.id))
    try {
      saveHistory(next)
      historyRef.current = next
      setHistory(next)
      if (previewIdRef.current && deletedIds.has(previewIdRef.current)) {
        previewIdRef.current = null
        revokeImageUrls(previewLoadedUrlsRef.current)
        previewLoadedUrlsRef.current = []
        setPreview(null)
      }
      for (const item of current.filter(item => deletedIds.has(item.id))) {
        await deleteImages(item.id)
        revokeImageUrls([...item.images, ...(item.refImages || [])])
      }
      await pruneRefImages(() => new Set([...referencedImageKeys(historyRef.current), ...pendingRefKeysRef.current.keys()]))
      await refreshStorageStats()
    } catch (error) {
      setStorageIssue(error instanceof Error ? `清理未完成：${error.message}` : '清理未完成')
    }
  }, [refreshStorageStats])

  const persistHistoryImage = useCallback(async (historyId: string, url: string, durationSeconds?: number) => {
    const task = retryPersistenceRef.current.catch(() => undefined).then(async () => {
      const current = historyRef.current
      const item = current.find(p => p.id === historyId)
      if (!item || !remainingRetryCount(item.images.length, item.params.count)) return false

      const saved = await saveImage(historyId, item.images.length, url, maxStorageBytes)
      const latest = historyRef.current
      const next = latest.map(p => {
        if (p.id !== historyId) return p
        const images = [...p.images, url]
        return {
          ...p,
          images,
          error: saved.saved ? partialFailureMessage(images.length, p.params.count)
            : `图片未保存到浏览器，刷新前请先下载：${saved.error || '未知错误'}`,
          params: { ...p.params, durationSeconds: durationSeconds ?? p.params.durationSeconds },
        }
      })
      try { saveHistory(next) }
      catch { setStorageIssue('重试图片的历史记录未能保存，刷新前请先下载') }
      historyRef.current = next
      setHistory(next)
      await refreshStorageStats()
      return saved.saved
    })
    retryPersistenceRef.current = task
    return task
  }, [maxStorageBytes, refreshStorageStats])

  const removeRef = (id: string) => {
    setRefImages((items) => { const item = items.find((c) => c.id === id); if (item) URL.revokeObjectURL(item.url); return items.filter((c) => c.id !== id) })
  }

  const clearRefs = () => { refImages.forEach((item) => URL.revokeObjectURL(item.url)); setRefImages([]) }

  const reorderRefs = (from: number, to: number) => {
    setRefImages(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const hasPrompt = prompt.trim().length > 0
  const requestedSizeLabel = ratio === 'custom'
    ? `${round16(customSize.w)}×${round16(customSize.h)}`
    : ratio === 'auto'
      ? (autoOptions[0] ? `${autoOptions[0].title}（${autoOptions[0].subtitle}）` : 'auto')
      : autoOptions.find((option) => option.value === ratio)?.title || ratio
  const selectedSizeLabel = activeProvider.supportsCustomSize
    ? requestedSizeLabel
    : `${requestedSizeLabel} → ${outputSize.replace('x', '×')}`

  const imageCleanupPlan = useMemo(() => oldestImageDeletePlan(history), [history])

  const warnings = useMemo(() => {
    const msgs: WarningItem[] = []
    if (storageIssue) msgs.push({ id: 'storage-error', message: storageIssue })
    if (storageUsage >= maxStorageMB * 0.9 * 1024 * 1024) {
      const isOverLimit = storageUsage > maxStorageMB * 1024 * 1024
      const cleanupHint = imageCleanupPlan.imageCount > 0
        ? `，可删除最旧 ${imageCleanupPlan.imageCount} 张（${imageCleanupPlan.recordCount} 条记录）释放空间`
        : ''
      msgs.push({
        id: 'image-storage',
        message: `图片存储${isOverLimit ? '已超过' : '即将达到'}上限（${(storageUsage / 1024 / 1024).toFixed(1)} / ${maxStorageMB} MB，共 ${imageCount} 张）${cleanupHint}`,
        actionLabel: imageCleanupPlan.imageCount > 0 ? `删除 ${imageCleanupPlan.imageCount} 张` : undefined,
      })
    }
    if (history.length >= maxHistoryItems * 0.9)
      msgs.push({ id: 'history', message: `历史记录即将达到上限（${history.length} / ${maxHistoryItems} 条），最早的记录将被自动清理` })
    if (localStorageUsage.usedBytes >= localStorageUsage.quotaBytes * 0.8)
      msgs.push({ id: 'local-storage', message: `浏览器本地存储空间即将用尽（${(localStorageUsage.usedBytes / 1024).toFixed(0)} KB / ${(localStorageUsage.quotaBytes / 1024 / 1024).toFixed(1)} MB）` })
    return msgs
  }, [storageIssue, storageUsage, maxStorageMB, imageCount, imageCleanupPlan, history.length, maxHistoryItems, localStorageUsage])

  const handleQuickProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider || isRetiredProvider(provider) || providerId === activeProviderId) return
    const cfg: StandaloneConfig = { providers, activeProviderId: providerId, maxStorageMB, maxHistoryItems, multiImageLayout }
    try { saveConfig(cfg) }
    catch { setStorageIssue('供应商切换未能保存，请检查浏览器本地存储空间'); return }
    setActiveProviderId(providerId)
    setLocalStorageUsage(getLocalStorageUsage())
  }

  const handleOpenConfig = () => {
    configTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setConfigSaveError('')
    // Sync draft to current values on open so the modal never shows stale edits
    // from a previous session (e.g. after storage/history limits changed).
    setDraftProviders(providers.map(p => ({ ...p })))
    setDraftActiveId(activeProviderId)
    setDraftMaxStorageMB(maxStorageMB)
    setDraftMaxHistoryItems(maxHistoryItems)
    setDraftMultiImageLayout(multiImageLayout)
    setConfigOpen(true)
  }

  const handleSaveConfig = () => {
    const cfg: StandaloneConfig = { providers: draftProviders, activeProviderId: supportedActiveProviderId(draftProviders, draftActiveId), maxStorageMB: draftMaxStorageMB, maxHistoryItems: draftMaxHistoryItems, multiImageLayout: draftMultiImageLayout }
    try { saveConfig(cfg) }
    catch { setConfigSaveError('设置未能保存，请检查浏览器本地存储空间'); return }
    setConfigSaveError('')
    setProviders(cfg.providers)
    setActiveProviderId(cfg.activeProviderId)
    setMaxStorageMB(cfg.maxStorageMB)
    setMaxHistoryItems(cfg.maxHistoryItems)
    setMultiImageLayout(cfg.multiImageLayout)
    setConfigOpen(false)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setHistoryPage(1)
  }

  return (
    <div className="flex flex-col min-h-screen lg:h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-[#1a1a1a] focus:outline-2 focus:outline-[#346aea]">跳转到结果区域</a>
      <NavBar searchQuery={searchQuery} setSearchQuery={handleSearchChange} />

      <div className="flex flex-col lg:flex-row lg:overflow-hidden" style={{ flex: 1, minHeight: 0, background: '#f5f5f5' }}
        onDragOver={(e) => { e.preventDefault(); if (!reorderDraggingRef.current) setIsDragging(true) }}
        onDragLeave={() => { if (!reorderDraggingRef.current) setIsDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!reorderDraggingRef.current) addFiles(e.dataTransfer.files) }}
      >
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm">
            <p className="text-base font-medium" style={{ color: '#1a1a1a' }}>松开后添加参考图</p>
          </div>
        )}

        <Sidebar
          prompt={prompt} setPrompt={setPrompt}
          ratio={ratio} setRatio={setRatio}
          customSize={customSize} setCustomSize={setCustomSize} customSizeErrors={customSizeErrors}
          pixelTier={pixelTier} setPixelTier={setPixelTier}
          quality={quality} setQuality={setQuality}
          count={count} setCount={setCount}
          refImages={refImages} addFiles={addFiles} removeRef={removeRef} clearRefs={clearRefs} onReorderRefs={reorderRefs} onReorderActive={onReorderActive}
          refImportError={refImportError}
          sizeOpen={sizeOpen} setSizeOpen={setSizeOpen}
          providers={providers} activeProvider={activeProvider} concurrency={concurrency} outputSize={outputSize}
          onQuickProviderChange={handleQuickProviderChange}
          loading={loading} historyReady={historyReady} hasPrompt={hasPrompt} apiKey={activeProvider.apiKey}
          handleSubmit={handleSubmit} autoOptions={autoOptions} selectedSizeLabel={selectedSizeLabel}
          configOpen={configOpen} setConfigOpen={setConfigOpen} onOpenConfig={handleOpenConfig}
          draftProviders={draftProviders} setDraftProviders={setDraftProviders}
          draftActiveId={draftActiveId} setDraftActiveId={setDraftActiveId}
          draftMaxStorageMB={draftMaxStorageMB} setDraftMaxStorageMB={setDraftMaxStorageMB}
          draftMaxHistoryItems={draftMaxHistoryItems} setDraftMaxHistoryItems={setDraftMaxHistoryItems}
          draftMultiImageLayout={draftMultiImageLayout} setDraftMultiImageLayout={setDraftMultiImageLayout}
          historyCount={history.length} localStorageUsage={localStorageUsage} imageCount={imageCount}
          showKey={showKey} setShowKey={setShowKey}
          storageUsage={storageUsage}
          guideOpen={guideOpen} setGuideOpen={setGuideOpen}
          onSaveConfig={handleSaveConfig}
          configSaveError={configSaveError}
          onConfigCloseAutoFocus={() => configTriggerRef.current?.focus()}
        />

        <MainArea
          jobs={jobs}
          visibleHistory={pageHistory}
          historyPage={currentHistoryPage} historyPageCount={historyPageCount} totalHistoryCount={visibleHistory.length} onHistoryPageChange={setHistoryPage}
          preview={preview} onPreviewChange={handlePreviewChange}
          deleteHistoryItem={deleteHistoryItem}
          retryJob={retryJob}
          retryHistoryItem={retryHistoryItem}
          addFiles={addFiles} clearRefs={clearRefs}
          setPrompt={setPrompt} setRatio={setRatio}
          setQuality={setQuality} setCount={setCount}
          setPixelTier={setPixelTier}
          warnings={warnings}
          searchQuery={searchQuery} onClearSearch={() => handleSearchChange('')}
          multiImageLayout={multiImageLayout}
          onDeleteOldestImages={deleteOldestImageRecords}
          onOpenConfig={handleOpenConfig}
        />
      </div>

      <span className="fixed bottom-3 right-4 text-[10px] select-none pointer-events-none z-30" style={{ color: 'rgb(0 0 0 / 0.08)' }}>@shenghuo2 使用 DeepSeek 制作</span>
    </div>
  )
}
