'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown, faCropSimple,
  faGear, faMinus, faPlus, faWandMagicSparkles,
  faXmark, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { RATIO_OPTIONS, type PixelTier, type Quality } from '@/lib/provider-settings'
import { DEFAULTS, type ProviderEntry } from '@/lib/config'
import { UsageGuide } from './UsageGuide'
import { ConfigModal } from './ConfigModal'

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

function clamp(value: number) { return Math.max(1, Math.min(10, value)) }

interface Props {
  prompt: string; setPrompt: (v: string) => void
  ratio: string; setRatio: (v: string) => void
  pixelTier: PixelTier; setPixelTier: (v: PixelTier) => void
  quality: Quality; setQuality: (v: Quality) => void
  count: number; setCount: (v: number) => void
  refImages: RefItem[]; addFiles: (files: FileList | File[]) => void
  removeRef: (id: string) => void; clearRefs: () => void
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
  showKey: boolean; setShowKey: (v: boolean) => void
  storageUsage: number
  guideOpen: boolean; setGuideOpen: (v: boolean) => void
  onSaveConfig: () => void
}

export function Sidebar({
  prompt, setPrompt, ratio, setRatio, pixelTier, setPixelTier,
  quality, setQuality, count, setCount, refImages, addFiles, removeRef, clearRefs,
  sizeOpen, setSizeOpen, activeProvider, concurrency, outputSize,
  loading, hasPrompt, apiKey, handleSubmit, autoOptions, selectedSizeLabel,
  configOpen, setConfigOpen, providers, activeProviderId,
  draftProviders, setDraftProviders, draftActiveId, setDraftActiveId,
  maxStorageMB, draftMaxStorageMB, setDraftMaxStorageMB,
  showKey, setShowKey, storageUsage, guideOpen, setGuideOpen, onSaveConfig,
}: Props) {
  return (
    <aside className="flex w-full lg:w-[400px] shrink-0 flex-col lg:overflow-hidden border-b lg:border-b-0 lg:border-r" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5 custom-scrollbar">
        {/* Ref images */}
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
            <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />添加
          </button>
          {refImages.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {refImages.map((item) => (
                <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border" style={{ background: '#ececec', borderColor: 'rgb(0 0 0 / 0.08)' }}>
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removeRef(item.id)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input id="ref-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <p className="mt-1.5 text-[10px]" style={{ color: '#bfbfbf' }}>支持粘贴 / Ctrl+V / 拖拽添加图片</p>
          {refImages.length > 0 && (
            <button onClick={clearRefs} className="mt-2 text-xs" style={{ color: '#616161' }}>清空参考图</button>
          )}
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>提示词</label>
          <div className="overflow-hidden rounded-xl border transition-colors focus-within:border-[#336aea]" style={{ background: 'rgb(0 0 0 / 0.04)', borderColor: 'rgb(0 0 0 / 0.15)' }}>
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
            <button onClick={() => setSizeOpen(!sizeOpen)} className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm hover:bg-black/10 transition-colors duration-150" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#1a1a1a' }}>
              <span className="inline-flex items-center gap-2 truncate">
                <FontAwesomeIcon icon={faCropSimple} className="h-3.5 w-3.5" style={{ color: '#616161' }} />
                <span className="text-xs">{selectedSizeLabel}</span>
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5" style={{ color: '#616161' }} />
            </button>
            {sizeOpen && (
              <div className="absolute bottom-12 left-0 z-30 w-[186px] overflow-hidden rounded-xl border bg-white py-1 shadow-2xl" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
                {(autoOptions.length ? autoOptions : [{ value: 'auto', title: 'auto', subtitle: '自动', ratio: '1:1' }]).map((o) => (
                  <SizeOption key={o.value} title={o.title} subtitle={o.subtitle} onClick={() => { setRatio(o.value); setSizeOpen(false) }} />
                ))}
                <div className="my-1 h-px" style={{ background: 'rgb(0 0 0 / 0.08)' }} />
                {RATIO_OPTIONS.filter(o => o.value !== 'auto').map((o) => (
                  <SizeOption key={o.value} title={o.title} subtitle={o.subtitle} onClick={() => { setRatio(o.value); setSizeOpen(false) }} wide={o.w > o.h} />
                ))}
              </div>
            )}
          </div>

          <div className="flex h-10 items-center overflow-hidden rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            {PIXEL_TIERS.map((tier) => (
              <button key={tier.value} onClick={() => setPixelTier(tier.value)} className="h-full flex-1 rounded-md px-2.5 text-xs font-medium transition-colors"
                style={{ background: pixelTier === tier.value ? 'rgb(0 0 0 / 0.1)' : 'transparent', color: '#1a1a1a' }} title={tier.estimate}>{tier.label}</button>
            ))}
          </div>
        </div>

        {/* Quality */}
        <div className="mb-4">
          <label className="mb-2.5 block text-sm font-medium" style={{ color: '#1a1a1a' }}>质量</label>
          <div className="flex gap-1 overflow-hidden rounded-lg p-0.5" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            {QUALITIES.map((item) => (
              <button key={item} onClick={() => setQuality(item)} className="h-8 flex-1 rounded-md text-xs font-medium transition-all"
                style={{ background: quality === item ? '#1a1a1a' : 'transparent', color: quality === item ? '#fff' : '#616161' }}>{QUALITY_LABELS[item]}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1" style={{ background: '#fff' }}>
        <span className="text-[10px]" style={{ color: '#919191' }}>纯静态站点，数据均在浏览器本地，无服务端</span>
        <a href="https://github.com/shenghuo2/gpt-image-2-generator-standalone" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] hover:underline" style={{ color: '#919191' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>源码
        </a>
      </div>
      <div className="space-y-3 border-t p-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
          <FontAwesomeIcon icon={faLayerGroup} className="h-3 w-3" />
          <span className="truncate">{activeProvider.name} · {DEFAULTS.model} · 并发 {concurrency} · {outputSize}</span>
          <button
            onClick={() => { setDraftProviders(providers.map(p => ({ ...p }))); setDraftActiveId(activeProviderId); setDraftMaxStorageMB(maxStorageMB); setConfigOpen(true) }}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
            style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.1)', border: apiKey ? '' : '1px solid rgb(211 72 43 / 0.3)' }}
          >
            <FontAwesomeIcon icon={faGear} className={`${apiKey ? '' : 'animate-pulse'} h-3.5 w-3.5`} />
          </button>
        </div>
        <button onClick={handleSubmit} disabled={loading || !hasPrompt || !apiKey}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: hasPrompt && !loading && apiKey ? '#346aea' : 'rgb(0 0 0 / 0.04)', color: hasPrompt && !loading && apiKey ? '#fff' : '#919191', cursor: hasPrompt && !loading && apiKey ? 'pointer' : 'not-allowed' }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} className="h-4 w-4" />
          <span>{!apiKey ? '请先配置 API Key' : loading ? '生成中...' : '生成'}</span>
        </button>
      </div>

      <UsageGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      {configOpen && (
        <ConfigModal
          activeProvider={activeProvider}
          draftProviders={draftProviders} setDraftProviders={setDraftProviders}
          draftActiveId={draftActiveId} setDraftActiveId={setDraftActiveId}
          draftMaxStorageMB={draftMaxStorageMB} setDraftMaxStorageMB={setDraftMaxStorageMB}
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
