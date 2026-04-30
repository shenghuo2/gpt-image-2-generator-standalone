'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown, faCropSimple,
  faGear, faMinus, faPlus, faWandMagicSparkles,
  faXmark, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { RATIO_OPTIONS, round16, availableTiersFor, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, type ProviderEntry, type MultiImageLayout } from '@/lib/config'
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

function clamp(value: number) { return Math.max(1, Math.min(10, value)) }

interface Props {
  prompt: string; setPrompt: (v: string) => void
  ratio: string; setRatio: (v: string) => void
  customSize: { w: number; h: number }; setCustomSize: (v: { w: number; h: number }) => void; customSizeErrors: string[]
  pixelTier: PixelTier; setPixelTier: (v: PixelTier) => void
  quality: Quality; setQuality: (v: Quality) => void
  count: number; setCount: (v: number) => void
  refImages: RefItem[]; addFiles: (files: FileList | File[]) => void
  removeRef: (id: string) => void; clearRefs: () => void; onReorderRefs: (from: number, to: number) => void
  onReorderActive: (v: boolean) => void
  sizeOpen: boolean; setSizeOpen: (v: boolean) => void
  activeProvider: ProviderEntry; concurrency: number; outputSize: string
  loading: boolean; hasPrompt: boolean; apiKey: string
  handleSubmit: () => void; autoOptions: Array<{ value: string; title: string; subtitle: string; ratio: string }>
  selectedSizeLabel: string
  configOpen: boolean; setConfigOpen: (v: boolean) => void
  providers: ProviderEntry[]; activeProviderId: string
  draftProviders: ProviderEntry[]; setDraftProviders: (v: ProviderEntry[]) => void
  draftActiveId: string; setDraftActiveId: (v: string) => void
  maxStorageMB: number; draftMaxStorageMB: number; setDraftMaxStorageMB: (v: number) => void
  maxHistoryItems: number; draftMaxHistoryItems: number; setDraftMaxHistoryItems: (v: number) => void
  multiImageLayout: MultiImageLayout; draftMultiImageLayout: MultiImageLayout; setDraftMultiImageLayout: (v: MultiImageLayout) => void
  historyCount: number; localStorageUsage: { usedBytes: number; quotaBytes: number }; imageCount: number
  showKey: boolean; setShowKey: (v: boolean) => void
  storageUsage: number
  guideOpen: boolean; setGuideOpen: (v: boolean) => void
  onSaveConfig: () => void
}

export function Sidebar({
  prompt, setPrompt, ratio, setRatio, customSize, setCustomSize, customSizeErrors, pixelTier, setPixelTier,
  quality, setQuality, count, setCount, refImages, addFiles, removeRef, clearRefs, onReorderRefs, onReorderActive,
  sizeOpen, setSizeOpen, activeProvider, concurrency, outputSize,
  loading, hasPrompt, apiKey, handleSubmit, autoOptions, selectedSizeLabel,
  configOpen, setConfigOpen, providers, activeProviderId,
  draftProviders, setDraftProviders, draftActiveId, setDraftActiveId,
  maxStorageMB, draftMaxStorageMB, setDraftMaxStorageMB,
  maxHistoryItems, draftMaxHistoryItems, setDraftMaxHistoryItems,
  multiImageLayout, draftMultiImageLayout, setDraftMultiImageLayout,
  historyCount, localStorageUsage, imageCount,
  showKey, setShowKey, storageUsage, guideOpen, setGuideOpen, onSaveConfig,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [previewRefUrl, setPreviewRefUrl] = useState<string | null>(null)
  const sizeButtonRef = useRef<HTMLButtonElement>(null)
  const sizeMenuRef = useRef<HTMLDivElement>(null)
  const [sizeMenuStyle, setSizeMenuStyle] = useState<React.CSSProperties>({})

  const visibleTiers = useMemo(
    () => ratio === 'custom' || ratio === 'auto' || ratio.startsWith('auto:')
      ? PIXEL_TIERS
      : PIXEL_TIERS.filter(t => availableTiersFor(ratio).includes(t.value)),
    [ratio]
  )

  useEffect(() => {
    if (!visibleTiers.some(t => t.value === pixelTier)) {
      setPixelTier(visibleTiers[visibleTiers.length - 1].value)
    }
  }, [visibleTiers, pixelTier, setPixelTier])

  useEffect(() => {
    if (!previewRefUrl) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewRefUrl(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewRefUrl])

  useEffect(() => {
    if (!sizeOpen || !sizeButtonRef.current) return
    const update = () => {
      const rect = sizeButtonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuH = sizeMenuRef.current?.offsetHeight || 400
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const openAbove = spaceBelow < Math.min(menuH, 300) && spaceAbove > spaceBelow
      const maxH = openAbove ? spaceAbove : spaceBelow
      setSizeMenuStyle(openAbove
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxHeight: maxH }
        : { top: rect.bottom + 4, left: rect.left, maxHeight: maxH })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [sizeOpen])

  return (
    <aside className="flex w-full max-h-[70vh] lg:max-h-none lg:w-[400px] shrink-0 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5 custom-scrollbar">
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
                  onClick={() => setPreviewRefUrl(item.url)}
                  className={`group relative aspect-square overflow-hidden rounded-lg border transition-opacity duration-150 ${dragIdx === idx ? 'opacity-40' : ''}`}
                  style={{ background: '#ececec', borderColor: 'rgb(0 0 0 / 0.08)', cursor: 'pointer' }}
                >
                  <img src={item.url} alt="" className="h-full w-full object-cover pointer-events-none" />
                  <button onClick={(e) => { e.stopPropagation(); removeRef(item.id) }} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input id="ref-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <p className="mt-1.5 text-[10px]" style={{ color: '#3c3a3a' }}>支持粘贴 / Ctrl+V / 拖拽添加图片</p>
          {refImages.length > 0 && (
            <button onClick={clearRefs} className="mt-2 text-xs" style={{ color: '#616161' }}>清空参考图</button>
          )}
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>提示词</label>
          <div className="overflow-hidden rounded-xl border transition-colors duration-200 focus-within:border-[#346aea] hover:border-black/20" style={{ background: 'rgb(0 0 0 / 0.04)', borderColor: 'rgb(0 0 0 / 0.15)' }}>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              placeholder="描述你想生成的图片..."
              className="h-36 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20"
              style={{ color: '#1a1a1a' }} />
          </div>
        </div>

        {/* Controls: count + size + pixel */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 items-center overflow-hidden rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            <button onClick={() => setCount(clamp(count - 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150" style={{ color: '#616161' }}>
              <FontAwesomeIcon icon={faMinus} className="h-3 w-3" />
            </button>
            <span className="w-7 text-center text-sm font-semibold" style={{ color: '#1a1a1a' }}>{count}</span>
            <button onClick={() => setCount(clamp(count + 1))} className="flex h-10 w-9 items-center justify-center text-sm hover:bg-black/10 transition-colors duration-150" style={{ color: '#616161' }}>
              <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
            </button>
          </div>

          <div className="relative flex-1">
            <button ref={sizeButtonRef} onClick={() => setSizeOpen(!sizeOpen)} className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm hover:bg-black/10 transition-colors duration-150" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#1a1a1a' }}>
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
                <div className="my-1 h-px" style={{ background: 'rgb(0 0 0 / 0.08)' }} />
                <button onClick={() => { setRatio('custom'); setSizeOpen(false) }} className="flex h-9 w-full items-center gap-3 px-4 text-sm hover:bg-black/10 transition-colors duration-150">
                  <span className="flex h-5 w-5 items-center justify-center text-[10px] font-bold" style={{ color: '#616161' }}>W×H</span>
                  <span className="font-medium" style={{ color: '#1a1a1a' }}>自定义</span>
                  <span className="text-xs" style={{ color: '#616161' }}>输入像素</span>
                </button>
              </div>
              </>
            )}
          </div>

          {ratio !== 'custom' && (
          <div className="relative flex h-10 shrink-0 items-center overflow-hidden rounded-lg" style={{ width: '5.5rem', background: 'rgb(0 0 0 / 0.04)' }}>
            <div className="absolute inset-y-0.5 rounded-md transition-all duration-300 ease-out" style={{
              left: `calc(${visibleTiers.findIndex(t => t.value === pixelTier)} * 100% / ${visibleTiers.length} + 2px)`,
              width: `calc(100% / ${visibleTiers.length} - 4px)`,
              background: 'rgb(0 0 0 / 0.1)',
            }} />
            {visibleTiers.map((tier) => (
              <button key={tier.value} onClick={() => setPixelTier(tier.value)} className="relative h-full flex-1 rounded-md text-xs font-medium transition-colors duration-150"
                style={{ color: pixelTier === tier.value ? '#1a1a1a' : '#919191' }} title={tier.estimate}>{tier.label}</button>
            ))}
          </div>
          )}
        </div>
        {visibleTiers.length < 3 && ratio !== 'custom' && (
          <p className="mb-4 -mt-2 text-[10px] leading-relaxed" style={{ color: '#d3482b' }}>因最大边长限制（&lt; 3840px），该比例仅支持最高 2K 分辨率</p>
        )}

        {ratio === 'custom' && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <input value={customSize.w || ''} onChange={(e) => setCustomSize({ ...customSize, w: Number(e.target.value) || 0 })}
                onBlur={() => setCustomSize({ ...customSize, w: round16(Math.max(16, customSize.w)) })}
                type="number" min={16} step={16} placeholder="宽"
                className="h-10 w-24 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: customSizeErrors.length ? 'rgb(211 72 43 / 0.5)' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-sm font-medium" style={{ color: '#919191' }}>×</span>
              <input value={customSize.h || ''} onChange={(e) => setCustomSize({ ...customSize, h: Number(e.target.value) || 0 })}
                onBlur={() => setCustomSize({ ...customSize, h: round16(Math.max(16, customSize.h)) })}
                type="number" min={16} step={16} placeholder="高"
                className="h-10 w-24 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: customSizeErrors.length ? 'rgb(211 72 43 / 0.5)' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-[10px]" style={{ color: '#919191' }}>{(round16(customSize.w) * round16(customSize.h) / 1000000).toFixed(2)}M px</span>
            </div>
            {customSizeErrors.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {customSizeErrors.map((err, i) => (
                  <span key={i} className="text-[10px]" style={{ color: '#d3482b' }}>{err}</span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[10px]" style={{ color: '#bfbfbf' }}>宽高自动对齐到 16 倍数，长短边比 ≤ 3:1，边长 &lt; 3840</p>
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
              <button key={item} onClick={() => setQuality(item)} className="relative h-8 flex-1 rounded-md text-xs font-medium transition-colors duration-150"
                style={{ color: quality === item ? '#fff' : '#616161' }}>{QUALITY_LABELS[item]}</button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: '#3c3a3a' }}>提示词越长、分辨率越高、质量越高，生成等待时间都会更长</p>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 pt-2 pb-1" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
        <span className="text-[10px]" style={{ color: '#919191' }}>纯静态站点，数据均在浏览器本地，无服务端</span>
      </div>
      <div className="shrink-0 space-y-3 border-t p-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
          <FontAwesomeIcon icon={faLayerGroup} className="h-3 w-3 shrink-0" />
          <span className="truncate">{activeProvider.name} · {DEFAULTS.model}</span>
          <span className="shrink-0 ml-auto text-[10px]" style={{ color: '#919191' }}>并发 {concurrency} · {outputSize}</span>
          <button
            onClick={() => { setDraftProviders(providers.map(p => ({ ...p }))); setDraftActiveId(activeProviderId); setDraftMaxStorageMB(maxStorageMB); setDraftMaxHistoryItems(maxHistoryItems); setDraftMultiImageLayout(multiImageLayout); setConfigOpen(true) }}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.1)', border: apiKey ? '' : '1px solid rgb(211 72 43 / 0.3)' }}
          >
            <FontAwesomeIcon icon={faGear} className={`${apiKey ? '' : 'animate-pulse'} h-3.5 w-3.5`} />
          </button>
        </div>
        <button onClick={handleSubmit} disabled={loading || !hasPrompt || !apiKey || customSizeErrors.length > 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:active:scale-100"
          style={{
            background: hasPrompt && !loading && apiKey && !customSizeErrors.length ? '#346aea' : 'rgb(0 0 0 / 0.04)',
            color: hasPrompt && !loading && apiKey && !customSizeErrors.length ? '#fff' : '#919191',
            cursor: hasPrompt && !loading && apiKey && !customSizeErrors.length ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.8 : 1,
            transform: loading ? 'scale(0.98)' : undefined,
          }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{!apiKey ? '请先配置 API Key' : loading ? '生成中...' : '生成'}</span>
        </button>
      </div>

      <UsageGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      {previewRefUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setPreviewRefUrl(null)}>
          <button onClick={() => setPreviewRefUrl(null)} className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
            <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
          </button>
          <img src={previewRefUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

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
          setGuideOpen={setGuideOpen}
          onClose={() => setConfigOpen(false)} onSave={onSaveConfig}
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
