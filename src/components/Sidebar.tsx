'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown, faCropSimple,
  faGear, faMinus, faPlus, faWandMagicSparkles,
  faXmark, faLayerGroup, faCheck, faTriangleExclamation, faArrowLeft, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { RATIO_OPTIONS, round16, availableTiersFor, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, getProviderNotice, isRetiredProvider, type ProviderEntry, type MultiImageLayout } from '@/lib/config'
import type { RefItem } from '@/lib/types'
import { UsageGuide } from './UsageGuide'
import { ConfigModal } from './ConfigModal'

const QUALITIES: Quality[] = ['low', 'medium', 'high']
const QUALITY_LABELS: Record<Quality, string> = {
  auto: '自动', low: '低', medium: '中', high: '高',
  standard: '标准', hd: '高清',
}
const PIXEL_TIERS: Array<{ value: PixelTier; label: string; estimate: string }> = [
  { value: '1k', label: '1K', estimate: '~60s' },
  { value: '2k', label: '2K', estimate: '~90s' },
  { value: '4k', label: '4K', estimate: '~120s' },
]

const APPROX_RATIO_HINT: Record<string, string> = {
  '16:9': '16px 对齐约束下该比例为最优近似（误差 <0.4%）',
  '9:16': '16px 对齐约束下该比例为最优近似（误差 <0.4%）',
  '3:4': '16px 对齐约束下部分档位为近似值（误差 <0.5%）',
}

function clamp(value: number) { return Math.max(1, Math.min(10, value)) }

interface Props {
  prompt: string; setPrompt: (v: string) => void
  ratio: string; setRatio: (v: string) => void
  customSize: { w: number; h: number }; setCustomSize: (v: { w: number; h: number }) => void; customSizeErrors: string[]
  pixelTier: PixelTier; setPixelTier: (v: PixelTier) => void
  quality: Quality; setQuality: (v: Quality) => void
  count: number; setCount: (v: number) => void
  refImages: RefItem[]; addFiles: (files: FileList | File[]) => void
  refImportError: string
  removeRef: (id: string) => void; clearRefs: () => void; onReorderRefs: (from: number, to: number) => void
  onReorderActive: (v: boolean) => void
  sizeOpen: boolean; setSizeOpen: (v: boolean) => void
  providers: ProviderEntry[]; activeProvider: ProviderEntry; concurrency: number; outputSize: string
  onQuickProviderChange: (providerId: string) => void
  loading: boolean; historyReady: boolean; hasPrompt: boolean; apiKey: string
  handleSubmit: () => void; autoOptions: Array<{ value: string; title: string; subtitle: string; ratio: string }>
  selectedSizeLabel: string
  configOpen: boolean; setConfigOpen: (v: boolean) => void; onOpenConfig: () => void
  draftProviders: ProviderEntry[]; setDraftProviders: (v: ProviderEntry[]) => void
  draftActiveId: string; setDraftActiveId: (v: string) => void
  draftMaxStorageMB: number; setDraftMaxStorageMB: (v: number) => void
  draftMaxHistoryItems: number; setDraftMaxHistoryItems: (v: number) => void
  draftMultiImageLayout: MultiImageLayout; setDraftMultiImageLayout: (v: MultiImageLayout) => void
  historyCount: number; localStorageUsage: { usedBytes: number; quotaBytes: number }; imageCount: number
  showKey: boolean; setShowKey: (v: boolean) => void
  storageUsage: number
  guideOpen: boolean; setGuideOpen: (v: boolean) => void
  onSaveConfig: () => void
  configSaveError: string
  onConfigCloseAutoFocus: () => void
}

export function Sidebar({
  prompt, setPrompt, ratio, setRatio, customSize, setCustomSize, customSizeErrors, pixelTier, setPixelTier,
  quality, setQuality, count, setCount, refImages, addFiles, refImportError, removeRef, clearRefs, onReorderRefs, onReorderActive,
  sizeOpen, setSizeOpen, providers, activeProvider, concurrency, outputSize, onQuickProviderChange,
  loading, historyReady, hasPrompt, apiKey, handleSubmit, autoOptions, selectedSizeLabel,
  configOpen, setConfigOpen, onOpenConfig,
  draftProviders, setDraftProviders, draftActiveId, setDraftActiveId,
  draftMaxStorageMB, setDraftMaxStorageMB,
  draftMaxHistoryItems, setDraftMaxHistoryItems,
  draftMultiImageLayout, setDraftMultiImageLayout,
  historyCount, localStorageUsage, imageCount,
  showKey, setShowKey, storageUsage, guideOpen, setGuideOpen, onSaveConfig, configSaveError, onConfigCloseAutoFocus,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [previewRefUrl, setPreviewRefUrl] = useState<string | null>(null)
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const sizeButtonRef = useRef<HTMLButtonElement>(null)
  const sizeMenuRef = useRef<HTMLDivElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const providerButtonRef = useRef<HTMLButtonElement>(null)
  const providerFirstOptionRef = useRef<HTMLButtonElement>(null)
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null)
  const guideTriggerRef = useRef<HTMLElement | null>(null)
  const [sizeMenuStyle, setSizeMenuStyle] = useState<React.CSSProperties>({})

  const visibleTiers = useMemo(
    () => !activeProvider.supportsCustomSize
      ? PIXEL_TIERS.slice(0, 1)
      : ratio === 'custom' || ratio === 'auto' || ratio.startsWith('auto:')
      ? PIXEL_TIERS
      : PIXEL_TIERS.filter(t => availableTiersFor(ratio).includes(t.value)),
    [ratio, activeProvider.supportsCustomSize]
  )

  useEffect(() => {
    if (!visibleTiers.some(t => t.value === pixelTier)) {
      setPixelTier(visibleTiers[visibleTiers.length - 1].value)
    }
  }, [visibleTiers, pixelTier, setPixelTier])

  useEffect(() => {
    if (!activeProvider.supportsCustomSize && ratio === 'custom') setRatio('1:1')
  }, [activeProvider.supportsCustomSize, ratio, setRatio])

  useEffect(() => {
    if (!providerMenuOpen) return
    providerFirstOptionRef.current?.focus()
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!providerMenuRef.current?.contains(event.target as Node)) setProviderMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setProviderMenuOpen(false); providerButtonRef.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [providerMenuOpen])

  useEffect(() => {
    if (!sizeOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSizeOpen(false); sizeButtonRef.current?.focus() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [sizeOpen, setSizeOpen])

  useEffect(() => {
    if (!sizeOpen || !sizeButtonRef.current) return
    const update = () => {
      const rect = sizeButtonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuW = 186
      const menuH = sizeMenuRef.current?.offsetHeight || 400
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const openAbove = spaceBelow < Math.min(menuH, 300) && spaceAbove > spaceBelow
      const maxH = openAbove ? spaceAbove : spaceBelow
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 8))
      setSizeMenuStyle(openAbove
        ? { bottom: window.innerHeight - rect.top + 4, left, maxHeight: maxH }
        : { top: rect.bottom + 4, left, maxHeight: maxH })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [sizeOpen])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b lg:w-[400px] lg:overflow-hidden lg:border-b-0 lg:border-r" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
      <div className="flex-1 px-5 pb-4 pt-5 lg:overflow-y-auto custom-scrollbar">
        {/* Ref images */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>参考图片<span className="text-[10px] font-normal ml-1" style={{ color: '#3c3a3a' }}>（拖拽可改变顺序）</span></span>
            <span className="text-xs" style={{ color: '#616161' }}>{refImages.length}/16</span>
          </div>
          <button
            onClick={() => document.getElementById('ref-input')?.click()}
            className="flex h-20 w-20 items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-all duration-200 hover:border-[#346aea] hover:text-[#346aea]"
            style={{ borderColor: 'rgb(0 0 0 / 0.15)', color: '#616161', background: 'rgb(0 0 0 / 0.03)' }}
          >
            <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />添加
          </button>
          {refImages.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {refImages.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => { onReorderActive(true); setDragIdx(idx) }}
                  onDragEnter={() => { if (dragIdx != null && dragIdx !== idx) { onReorderRefs(dragIdx, idx); setDragIdx(idx) } }}
                  onDragEnd={() => { onReorderActive(false); setDragIdx(null) }}
                  onDrop={(e) => e.preventDefault()}
                  className={`group relative aspect-square overflow-hidden rounded-lg border transition-opacity duration-150 ${dragIdx === idx ? 'opacity-40' : ''}`}
                  style={{ background: '#ececec', borderColor: 'rgb(0 0 0 / 0.08)' }}
                >
                  <button type="button" onClick={(event) => { previewTriggerRef.current = event.currentTarget; setPreviewRefUrl(item.url) }} aria-label={`预览参考图 ${idx + 1}`} className="block h-full w-full focus-visible:outline-2 focus-visible:outline-[#346aea]">
                    <img src={item.url} alt={`参考图 ${idx + 1}`} className="image-checkerboard h-full w-full object-cover pointer-events-none" />
                  </button>
                  <button type="button" onClick={() => removeRef(item.id)} aria-label={`移除参考图 ${idx + 1}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white focus-visible:outline-2 focus-visible:outline-[#346aea]">
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 flex gap-1">
                    <button type="button" disabled={idx === 0} onClick={() => onReorderRefs(idx, idx - 1)} aria-label={`将参考图 ${idx + 1} 前移`} className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#346aea]"><FontAwesomeIcon icon={faArrowLeft} className="h-2.5 w-2.5" /></button>
                    <button type="button" disabled={idx === refImages.length - 1} onClick={() => onReorderRefs(idx, idx + 1)} aria-label={`将参考图 ${idx + 1} 后移`} className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#346aea]"><FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input id="ref-input" name="reference-images" aria-label="选择参考图片" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
          <p className="mt-1.5 text-[10px]" style={{ color: '#3c3a3a' }}>支持粘贴 / Ctrl+V / 拖拽添加图片</p>
          {refImportError && <p role="alert" className="mt-1.5 text-xs" style={{ color: '#b33a24' }}>{refImportError}</p>}
          {refImages.length > 0 && (
            <button onClick={clearRefs} className="mt-2 text-xs" style={{ color: '#616161' }}>清空参考图</button>
          )}
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <label htmlFor="generation-prompt" className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>提示词</label>
          <div className="overflow-hidden rounded-xl border transition-colors duration-200 focus-within:border-[#346aea] hover:border-black/20" style={{ background: 'rgb(0 0 0 / 0.04)', borderColor: 'rgb(0 0 0 / 0.15)' }}>
            <textarea id="generation-prompt" name="prompt" autoComplete="off" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              placeholder="描述你想生成的图片..."
              className="h-36 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20"
              style={{ color: '#1a1a1a' }} />
          </div>
        </div>

        {/* Controls: count + size + pixel */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center overflow-hidden rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            <button type="button" aria-label="减少生成数量" onClick={() => setCount(clamp(count - 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#616161' }}>
              <FontAwesomeIcon icon={faMinus} className="h-3 w-3" />
            </button>
            <span className="w-7 text-center text-sm font-semibold" style={{ color: '#1a1a1a' }}>{count}</span>
            <button type="button" aria-label="增加生成数量" onClick={() => setCount(clamp(count + 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#616161' }}>
              <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
            </button>
          </div>

          <div className="relative flex-1">
            <button type="button" ref={sizeButtonRef} aria-label={`图片尺寸：${selectedSizeLabel}`} aria-expanded={sizeOpen} onClick={() => setSizeOpen(!sizeOpen)} className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm hover:bg-black/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#1a1a1a' }}>
              <span className="inline-flex items-center gap-2 truncate">
                <FontAwesomeIcon icon={faCropSimple} className="h-3.5 w-3.5" style={{ color: '#616161' }} />
                <span className="text-xs">{selectedSizeLabel}</span>
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5" style={{ color: '#616161' }} />
            </button>
            {sizeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSizeOpen(false)} />
                <div ref={sizeMenuRef} className="fixed z-50 w-[186px] overflow-y-auto rounded-xl border bg-white py-1 shadow-2xl" style={{ borderColor: 'rgb(0 0 0 / 0.1)', ...sizeMenuStyle }}>
                {(autoOptions.length ? autoOptions : [{ value: 'auto', title: 'auto', subtitle: '自动', ratio: '1:1' }]).map((o) => (
                  <SizeOption key={o.value} title={o.title} subtitle={o.subtitle} onClick={() => { setRatio(o.value); setSizeOpen(false) }} />
                ))}
                <div className="my-1 h-px" style={{ background: 'rgb(0 0 0 / 0.08)' }} />
                {RATIO_OPTIONS.filter(o => o.value !== 'auto').map((o) => (
                  <SizeOption key={o.value} title={o.title} subtitle={o.subtitle} onClick={() => { setRatio(o.value); setSizeOpen(false) }} wide={o.w > o.h} />
                ))}
                {activeProvider.supportsCustomSize && (
                  <>
                    <div className="my-1 h-px" style={{ background: 'rgb(0 0 0 / 0.08)' }} />
                    <button onClick={() => { setRatio('custom'); setSizeOpen(false) }} className="flex h-9 w-full items-center gap-3 px-4 text-sm hover:bg-black/10 transition-colors duration-150">
                      <span className="flex h-5 w-5 items-center justify-center text-[10px] font-bold" style={{ color: '#616161' }}>W×H</span>
                      <span className="font-medium" style={{ color: '#1a1a1a' }}>自定义</span>
                      <span className="text-xs" style={{ color: '#616161' }}>输入像素</span>
                    </button>
                  </>
                )}
              </div>
              </>
            )}
          </div>

          {activeProvider.supportsCustomSize && ratio !== 'custom' && (
          <div className="relative flex h-10 shrink-0 items-center overflow-hidden rounded-lg" style={{ width: '5.5rem', background: 'rgb(0 0 0 / 0.04)' }}>
            <div className="absolute inset-y-0.5 rounded-md transition-all duration-300 ease-out" style={{
              left: `calc(${visibleTiers.findIndex(t => t.value === pixelTier)} * 100% / ${visibleTiers.length} + 2px)`,
              width: `calc(100% / ${visibleTiers.length} - 4px)`,
              background: 'rgb(0 0 0 / 0.1)',
            }} />
            {visibleTiers.map((tier) => (
              <button key={tier.value} type="button" aria-pressed={pixelTier === tier.value} onClick={() => setPixelTier(tier.value)} className="relative h-full flex-1 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]"
                style={{ color: pixelTier === tier.value ? '#1a1a1a' : '#6b6b6b' }} title={tier.estimate}>{tier.label}</button>
            ))}
          </div>
          )}
        </div>
        {!activeProvider.supportsCustomSize && (
          <p className="mb-4 -mt-2 text-[10px] leading-relaxed" style={{ color: '#8a4f00' }}>该供应商仅支持标准图片尺寸，所选比例会自动映射为最接近的方图、横图或竖图</p>
        )}
        {activeProvider.supportsCustomSize && visibleTiers.length < 3 && ratio !== 'custom' && (
          <p className="mb-4 -mt-2 text-[10px] leading-relaxed" style={{ color: '#b33a24' }}>因最大边长限制（&lt; 3840px），该比例仅支持最高 2K 分辨率</p>
        )}
        {activeProvider.supportsCustomSize && APPROX_RATIO_HINT[ratio] && (
          <p className="mb-4 -mt-2 text-[10px] leading-relaxed" style={{ color: '#6b6b6b' }}>{APPROX_RATIO_HINT[ratio]}</p>
        )}

        {activeProvider.supportsCustomSize && ratio === 'custom' && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <input aria-label="自定义宽度（像素）" name="image-width" value={customSize.w || ''} onChange={(e) => setCustomSize({ ...customSize, w: Number(e.target.value) || 0 })}
                onBlur={() => setCustomSize({ ...customSize, w: round16(Math.max(16, customSize.w)) })}
                type="number" min={16} step={16} placeholder="宽"
                className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: customSizeErrors.length ? 'rgb(211 72 43 / 0.5)' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-sm font-medium shrink-0" style={{ color: '#919191' }}>×</span>
              <input aria-label="自定义高度（像素）" name="image-height" value={customSize.h || ''} onChange={(e) => setCustomSize({ ...customSize, h: Number(e.target.value) || 0 })}
                onBlur={() => setCustomSize({ ...customSize, h: round16(Math.max(16, customSize.h)) })}
                type="number" min={16} step={16} placeholder="高"
                className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: customSizeErrors.length ? 'rgb(211 72 43 / 0.5)' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-[10px] shrink-0" style={{ color: '#6b6b6b' }}>{(round16(customSize.w) * round16(customSize.h) / 1000000).toFixed(2)}M px</span>
            </div>
            {customSizeErrors.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {customSizeErrors.map((err, i) => (
                  <span key={i} className="text-[10px]" style={{ color: '#b33a24' }}>{err}</span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[10px]" style={{ color: '#6b6b6b' }}>宽高自动对齐到 16 倍数，长短边比 ≤ 3:1，边长 &lt; 3840</p>
          </div>
        )}

        {/* Quality */}
        <div className="mb-4">
          <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>质量</label>
          <div className="relative flex gap-1 overflow-hidden rounded-lg p-0.5" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            <div className="absolute inset-y-0.5 rounded-md transition-all duration-300 ease-out" style={{
              left: `calc(${QUALITIES.findIndex(q => q === quality)} * 100% / 3 + 2px)`,
              width: `calc(100% / 3 - 4px)`,
              background: '#1a1a1a',
            }} />
            {QUALITIES.map((item) => (
              <button key={item} type="button" aria-pressed={quality === item} onClick={() => setQuality(item)} className="relative h-8 flex-1 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]"
                style={{ color: quality === item ? '#fff' : '#616161' }}>{QUALITY_LABELS[item]}</button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: '#3c3a3a' }}>提示词越长、分辨率越高、质量越高，生成等待时间都会更长</p>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 pt-2 pb-1" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
        <span className="text-[10px]" style={{ color: '#6b6b6b' }}>图片与配置保存在本地；生成请求直达供应商</span>
      </div>
      <div className="shrink-0 space-y-3 border-t p-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
        <div ref={providerMenuRef} className="relative">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
            <button type="button" ref={providerButtonRef} onClick={() => setProviderMenuOpen(!providerMenuOpen)} aria-expanded={providerMenuOpen}
              className="flex h-8 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors hover:bg-black/5"
              style={{ maxWidth: '150px', color: '#346aea', background: providerMenuOpen ? 'rgb(52 106 234 / 0.08)' : 'rgb(52 106 234 / 0.04)', borderColor: 'rgb(52 106 234 / 0.18)' }}
              title="快速切换供应商">
              <FontAwesomeIcon icon={faLayerGroup} className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium">{activeProvider.name}</span>
              <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5 shrink-0 transition-transform"
                style={{ transform: providerMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
            <span className="ml-auto shrink-0 text-[10px]" style={{ color: '#6b6b6b' }}>并发 {concurrency} · {outputSize}</span>
            <button
              onClick={() => { setProviderMenuOpen(false); onOpenConfig() }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.1)', border: apiKey ? '' : '1px solid rgb(211 72 43 / 0.3)' }}
              title="打开完整设置"
              aria-label="打开完整设置"
            >
              <FontAwesomeIcon icon={faGear} className={`${apiKey ? '' : 'animate-pulse'} h-3.5 w-3.5`} />
            </button>
          </div>
          {providerMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 z-[60] mb-2 overflow-y-auto rounded-xl border p-1.5 shadow-2xl"
              style={{ maxHeight: 'min(280px, 45vh)', background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-semibold" style={{ color: '#1a1a1a' }}>快速切换供应商</span>
                <span className="max-w-[160px] truncate text-[10px]" style={{ color: '#6b6b6b' }}>{activeProvider.model || DEFAULTS.model}</span>
              </div>
              <div className="space-y-1">
                {providers.map((provider, index) => {
                  const selected = provider.id === activeProvider.id
                  const retired = isRetiredProvider(provider)
                  return (
                    <button key={provider.id} ref={index === 0 ? providerFirstOptionRef : undefined} type="button" disabled={retired}
                      onClick={() => { onQuickProviderChange(provider.id); setProviderMenuOpen(false); providerButtonRef.current?.focus() }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/5 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#346aea]"
                      style={{ background: selected ? 'rgb(52 106 234 / 0.08)' : 'transparent', opacity: retired ? 0.58 : 1 }}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: retired ? '#b33a24' : selected ? '#346aea' : '#616161', background: retired ? 'rgb(211 72 43 / 0.08)' : selected ? 'rgb(52 106 234 / 0.1)' : 'rgb(0 0 0 / 0.04)' }}>
                        <FontAwesomeIcon icon={retired ? faTriangleExclamation : faLayerGroup} className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`truncate text-xs font-medium ${retired ? 'line-through' : ''}`} style={{ color: retired ? '#b33a24' : '#1a1a1a' }}>{provider.name}</span>
                          {!provider.apiKey && !retired && (
                            <span className="shrink-0 rounded px-1 py-0.5 text-[9px]" style={{ color: '#a35a00', background: 'rgb(245 158 11 / 0.1)' }}>未配置 Key</span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px]" style={{ color: retired ? '#b33a24' : '#6b6b6b' }}>
                          {getProviderNotice(provider)?.label || `${provider.model || DEFAULTS.model} · ${provider.baseUrl}`}
                        </span>
                      </span>
                      {selected && !retired && <FontAwesomeIcon icon={faCheck} className="h-3 w-3 shrink-0" style={{ color: '#346aea' }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={apiKey ? handleSubmit : onOpenConfig} disabled={Boolean(apiKey && (loading || !historyReady || !hasPrompt || customSizeErrors.length > 0))}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#346aea]"
          style={{
            background: (!apiKey || (hasPrompt && historyReady && !loading && !customSizeErrors.length)) ? '#346aea' : 'rgb(0 0 0 / 0.04)',
            color: (!apiKey || (hasPrompt && historyReady && !loading && !customSizeErrors.length)) ? '#fff' : '#6b6b6b',
            cursor: (!apiKey || (hasPrompt && historyReady && !loading && !customSizeErrors.length)) ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.8 : 1,
          }}
        >
          <FontAwesomeIcon icon={apiKey ? faWandMagicSparkles : faGear} className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          <span>{!apiKey ? '配置 API Key' : loading ? '生成中…' : !historyReady ? '读取历史记录…' : '生成'}</span>
        </button>
      </div>

      <UsageGuide open={guideOpen} onClose={() => setGuideOpen(false)} onCloseAutoFocus={() => guideTriggerRef.current?.isConnected ? guideTriggerRef.current.focus() : document.querySelector<HTMLTextAreaElement>('#generation-prompt')?.focus()} />

      <DialogPrimitive.Root open={Boolean(previewRefUrl)} onOpenChange={(open) => { if (!open) setPreviewRefUrl(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70]" style={{ background: 'rgba(0,0,0,0.85)' }} />
          <DialogPrimitive.Content aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); if (previewTriggerRef.current?.isConnected) previewTriggerRef.current.focus(); else document.querySelector<HTMLTextAreaElement>('#generation-prompt')?.focus() }} className="fixed inset-4 z-[70] flex items-center justify-center focus:outline-none">
            <DialogPrimitive.Title className="sr-only">参考图预览</DialogPrimitive.Title>
            <button type="button" onClick={() => setPreviewRefUrl(null)} aria-label="关闭参考图预览" className="absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors focus-visible:outline-2 focus-visible:outline-white">
              <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
            </button>
            {previewRefUrl && <img src={previewRefUrl} alt="放大的参考图" className="image-checkerboard max-w-full max-h-full object-contain rounded-lg" />}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {configOpen && (
        <ConfigModal
          activeProvider={activeProvider}
          draftProviders={draftProviders} setDraftProviders={setDraftProviders}
          draftActiveId={draftActiveId} setDraftActiveId={setDraftActiveId}
          draftMaxStorageMB={draftMaxStorageMB} setDraftMaxStorageMB={setDraftMaxStorageMB}
          draftMaxHistoryItems={draftMaxHistoryItems} setDraftMaxHistoryItems={setDraftMaxHistoryItems}
          draftMultiImageLayout={draftMultiImageLayout} setDraftMultiImageLayout={setDraftMultiImageLayout}
          historyCount={historyCount} localStorageUsage={localStorageUsage} imageCount={imageCount}
          showKey={showKey} setShowKey={setShowKey}
          storageUsage={storageUsage}
          setGuideOpen={(open) => { if (open) guideTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGuideOpen(open) }}
          onClose={() => setConfigOpen(false)} onSave={onSaveConfig}
          configSaveError={configSaveError}
          onCloseAutoFocus={onConfigCloseAutoFocus}
        />
      )}
    </aside>
  )
}

function SizeOption({ title, subtitle, onClick, wide }: { title: string; subtitle: string; onClick: () => void; wide?: boolean }) {
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
