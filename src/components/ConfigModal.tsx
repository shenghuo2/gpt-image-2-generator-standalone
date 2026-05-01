'use client'
import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faGear, faKey, faPlus, faXmark, faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { BUILTIN_PROVIDERS, type ProviderEntry, type MultiImageLayout } from '@/lib/config'

interface Props {
  activeProvider: ProviderEntry
  draftProviders: ProviderEntry[]; setDraftProviders: (v: ProviderEntry[]) => void
  draftActiveId: string; setDraftActiveId: (v: string) => void
  draftMaxStorageMB: number; setDraftMaxStorageMB: (v: number) => void
  draftMaxHistoryItems: number; setDraftMaxHistoryItems: (v: number) => void
  draftMultiImageLayout: MultiImageLayout; setDraftMultiImageLayout: (v: MultiImageLayout) => void
  historyCount: number; localStorageUsage: { usedBytes: number; quotaBytes: number }; imageCount: number
  showKey: boolean; setShowKey: (v: boolean) => void
  storageUsage: number
  setGuideOpen: (v: boolean) => void
  onClose: () => void; onSave: () => void
}

export function ConfigModal({ activeProvider, draftProviders, setDraftProviders, draftActiveId, setDraftActiveId, draftMaxStorageMB, setDraftMaxStorageMB, draftMaxHistoryItems, setDraftMaxHistoryItems, draftMultiImageLayout, setDraftMultiImageLayout, historyCount, localStorageUsage, imageCount, showKey, setShowKey, storageUsage, setGuideOpen, onClose, onSave }: Props) {
  const apiKey = activeProvider.apiKey

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl" style={{ background: '#fff', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            <FontAwesomeIcon icon={faGear} className="h-4 w-4" style={{ color: '#616161' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1a1a1a' }}>API 设置</h2>
            <p className={`text-xs rounded-md px-2 py-1 ${!apiKey ? 'font-medium' : ''}`} style={{ color: apiKey ? '#616161' : '#d3482b', background: apiKey ? '' : 'rgb(211 72 43 / 0.06)' }}>纯静态站点，数据均在浏览器本地，无服务端</p>
          </div>
          <button onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 transition-colors duration-150">
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" style={{ color: '#616161' }} />
          </button>
        </div>
        <div className="space-y-4 p-5 overflow-y-auto">
          <button onClick={() => setGuideOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left transition-colors hover:opacity-90"
            style={{ background: 'rgb(52 106 234 / 0.06)', borderColor: 'rgb(52 106 234 / 0.25)' }}
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="h-4 w-4 shrink-0" style={{ color: '#346aea' }} />
            <span className="text-[13px] font-semibold" style={{ color: '#346aea' }}>使用方法</span>
            <span className="text-[11px] ml-auto" style={{ color: '#346aea', opacity: 0.6 }}>中转站注册 →</span>
          </button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#616161' }}>供应商</span>
              <button
                onClick={() => {
                  const id = `custom_${Date.now()}`
                  setDraftProviders([...draftProviders, { id, name: '自定义', apiKey: '', baseUrl: 'https://', supportsResponseFormat: false, maxConcurrency: 1 }])
                  setDraftActiveId(id)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/10 transition-colors" title="添加自定义供应商"
              >
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" style={{ color: '#616161' }} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftProviders.map((p) => {
                const builtin = BUILTIN_PROVIDERS.some(b => b.id === p.id)
                return (
                  <div key={p.id} className="relative group">
                    <button onClick={() => setDraftActiveId(p.id)} className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ background: draftActiveId === p.id ? '#346aea' : 'rgb(0 0 0 / 0.04)', color: draftActiveId === p.id ? '#fff' : '#616161' }}>{p.name}</button>
                    {!builtin && (
                      <button
                        onClick={() => {
                          setDraftProviders(draftProviders.filter(x => x.id !== p.id))
                          if (draftActiveId === p.id && draftProviders.length > 1) setDraftActiveId(draftProviders[0].id)
                        }}
                        className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <FontAwesomeIcon icon={faXmark} className="h-2 w-2" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {(() => {
            const dp = draftProviders.find(p => p.id === draftActiveId)
            if (!dp) return null
            const isBuiltin = BUILTIN_PROVIDERS.some(b => b.id === dp.id)
            return (
              <>
                {!isBuiltin && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>名称</span>
                    <input value={dp.name} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, name: e.target.value } : p))}
                      className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                      style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} placeholder="供应商名称" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>API Key</span>
                  <div className="relative">
                    <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3.5 h-3.5 w-3.5" style={{ color: '#616161' }} />
                    <input value={dp.apiKey} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, apiKey: e.target.value } : p))}
                      type={showKey ? 'text' : 'password'}
                      className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                      style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a', paddingLeft: '2rem', paddingRight: '2.5rem' }} placeholder="sk-..." />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-black/5" style={{ color: '#616161' }}>
                      <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </label>
                {isBuiltin ? (
                  <p className="text-[11px]" style={{ color: '#919191' }}>
                    Base URL：{dp.baseUrl}{!dp.supportsResponseFormat && ' · 不支持 response_format 参数'}
                  </p>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>Base URL</span>
                      <input value={dp.baseUrl} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, baseUrl: e.target.value } : p))}
                        className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                        style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} placeholder="https://" />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={dp.supportsResponseFormat}
                        onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, supportsResponseFormat: e.target.checked } : p))}
                        className="h-4 w-4 rounded accent-[#346aea]" />
                      <span className="text-xs" style={{ color: '#616161' }}>支持 response_format (b64_json)</span>
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大并发数</span>
                  <input value={dp.maxConcurrency} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, maxConcurrency: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : p))}
                    type="number" min={1} max={10}
                    className="w-20 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                    style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
                </label>
              </>
            )
          })()}

          <label className="block">
            <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大存储上限 (MB)</span>
            <div className="flex items-center gap-2">
              <input value={draftMaxStorageMB || ''} onChange={(e) => setDraftMaxStorageMB(Number(e.target.value) || 0)} onBlur={() => setDraftMaxStorageMB(Math.max(10, draftMaxStorageMB))} type="number" min={10}
                className="w-28 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-xs" style={{ color: '#919191' }}>当前已用 {(storageUsage / 1024 / 1024).toFixed(1)} MB · {imageCount} 张图片</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大历史条数</span>
            <div className="flex items-center gap-2">
              <input value={draftMaxHistoryItems || ''} onChange={(e) => setDraftMaxHistoryItems(Math.min(500, Number(e.target.value) || 0))} onBlur={() => setDraftMaxHistoryItems(Math.max(10, draftMaxHistoryItems))} type="number" min={10} max={500}
                className="w-28 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
              <span className="text-xs" style={{ color: '#919191' }}>当前 {historyCount} 条 · 占用 {(localStorageUsage.usedBytes / 1024).toFixed(1)} KB / {(localStorageUsage.quotaBytes / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          </label>

          <div>
            <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>多图卡片布局</span>
            <div className="relative flex gap-1 overflow-hidden rounded-lg p-0.5" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              <div className="absolute inset-y-0.5 rounded-md transition-all duration-300 ease-out" style={{
                left: draftMultiImageLayout === 'horizontal' ? '2px' : 'calc(50% + 2px)',
                width: 'calc(50% - 4px)',
                background: '#1a1a1a',
              }} />
              <button onClick={() => setDraftMultiImageLayout('horizontal')} className="relative h-8 flex-1 rounded-md text-xs font-medium transition-colors duration-150"
                style={{ color: draftMultiImageLayout === 'horizontal' ? '#fff' : '#616161' }}>横向</button>
              <button onClick={() => setDraftMultiImageLayout('vertical')} className="relative h-8 flex-1 rounded-md text-xs font-medium transition-colors duration-150"
                style={{ color: draftMultiImageLayout === 'vertical' ? '#fff' : '#616161' }}>纵向</button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-black/10 transition-colors duration-150" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>取消</button>
          <button onClick={onSave} className="rounded-lg px-4 py-2 text-sm font-medium transition-colors" style={{ background: '#346aea', color: '#fff' }}>保存</button>
        </div>
      </div>
    </div>
  )
}
