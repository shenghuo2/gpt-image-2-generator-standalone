'use client'
import { useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faGear, faKey, faPlus, faXmark, faCircleQuestion, faTriangleExclamation, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { DEFAULTS, GPTGOD_CUSTOM_SIZE_MODEL, getProviderNotice, isBuiltinProvider, isRetiredProvider, resolveProviderCustomSizeSupport, RETIRED_PROVIDER_MESSAGE, type ProviderEntry, type MultiImageLayout } from '@/lib/config'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ImageModelSelector } from './ImageModelSelector'

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
  configSaveError: string
  onCloseAutoFocus: () => void
}

function scrollIntoView(e: React.FocusEvent<HTMLInputElement>) {
  setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
}

export function ConfigModal({ activeProvider, draftProviders, setDraftProviders, draftActiveId, setDraftActiveId, draftMaxStorageMB, setDraftMaxStorageMB, draftMaxHistoryItems, setDraftMaxHistoryItems, draftMultiImageLayout, setDraftMultiImageLayout, historyCount, localStorageUsage, imageCount, showKey, setShowKey, storageUsage, setGuideOpen, onClose, onSave, configSaveError, onCloseAutoFocus }: Props) {
  const [settingsTab, setSettingsTab] = useState<'providers' | 'preferences'>('providers')
  const [fieldError, setFieldError] = useState<{ providerId: string; field: 'name' | 'baseUrl' | 'model'; message: string } | null>(null)
  const selectedProvider = draftProviders.find(p => p.id === draftActiveId)
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const apiKey = selectedProvider?.apiKey ?? activeProvider.apiKey
  const initialDraft = useRef(JSON.stringify([draftProviders, draftActiveId, draftMaxStorageMB, draftMaxHistoryItems, draftMultiImageLayout]))
  const requestClose = () => {
    const current = JSON.stringify([draftProviders, draftActiveId, draftMaxStorageMB, draftMaxHistoryItems, draftMultiImageLayout])
    if (current !== initialDraft.current && !window.confirm('设置尚未保存，确定放弃修改吗？')) return
    onClose()
  }
  const saveDraft = () => {
    for (const provider of draftProviders) {
      let field: 'name' | 'baseUrl' | 'model' | null = null
      let message = ''
      if (!provider.model.trim() || /\s/.test(provider.model.trim())) {
        field = 'model'
        message = '请填写完整的模型 ID，不能包含空格或换行。'
      } else if (!isBuiltinProvider(provider) && !provider.name.trim()) {
        field = 'name'
        message = '请填写供应商名称'
      } else if (!isBuiltinProvider(provider)) {
        try {
          const url = new URL(provider.baseUrl.trim())
          if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid URL')
        } catch {
          field = 'baseUrl'
          message = '请输入完整的 http:// 或 https:// 地址'
        }
      }
      if (field) {
        setSettingsTab('providers')
        setDraftActiveId(provider.id)
        setFieldError({ providerId: provider.id, field, message })
        requestAnimationFrame(() => document.getElementById(`provider-${field}-${provider.id}`)?.focus())
        return
      }
    }
    setFieldError(null)
    onSave()
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => { event.preventDefault(); onCloseAutoFocus() }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: '#fff', height: 'min(680px, calc(100vh - 32px))', maxHeight: '100%', display: 'flex', flexDirection: 'column' }}
        >
        <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
            <FontAwesomeIcon icon={faGear} className="h-4 w-4" style={{ color: '#616161' }} />
          </div>
          <div>
            <DialogPrimitive.Title className="text-base font-semibold" style={{ color: '#1a1a1a' }}>设置</DialogPrimitive.Title>
            <p className={`text-xs rounded-md px-2 py-1 ${!apiKey ? 'font-medium' : ''}`} style={{ color: apiKey ? '#616161' : '#b33a24', background: apiKey ? '' : 'rgb(211 72 43 / 0.06)' }}>纯静态站点，数据均在浏览器本地，无服务端</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="关闭设置" className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]">
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" style={{ color: '#616161' }} />
          </button>
        </div>
        <Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as 'providers' | 'preferences')} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-5 pt-4">
            <TabsList className="relative flex h-10 w-full rounded-xl p-1" style={{ background: 'rgb(0 0 0 / 0.04)' }}>
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-1 rounded-lg transition-transform duration-300 ease-out"
                style={{ left: '4px', width: 'calc(50% - 4px)', background: '#fff', boxShadow: '0 1px 3px rgb(0 0 0 / 0.1)', transform: settingsTab === 'providers' ? 'translateX(0)' : 'translateX(100%)' }} />
              <TabsTrigger value="providers" className="h-8 flex-1 rounded-lg px-3 text-xs font-medium transition-colors"
                style={{ position: 'relative', zIndex: 1, background: 'transparent', color: settingsTab === 'providers' ? '#1a1a1a' : '#616161', boxShadow: 'none' }}>
                供应商配置
              </TabsTrigger>
              <TabsTrigger value="preferences" className="h-8 flex-1 rounded-lg px-3 text-xs font-medium transition-colors"
                style={{ position: 'relative', zIndex: 1, background: 'transparent', color: settingsTab === 'preferences' ? '#1a1a1a' : '#616161', boxShadow: 'none' }}>
                偏好与存储
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1">
            <TabsContent value="providers" className="h-full space-y-4 overflow-y-auto p-5" style={{ marginTop: 0 }}>
          <button onClick={() => setGuideOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left transition-colors hover:opacity-90"
            style={{ background: 'rgb(52 106 234 / 0.06)', borderColor: 'rgb(52 106 234 / 0.25)' }}
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="h-4 w-4 shrink-0" style={{ color: '#346aea' }} />
            <span className="text-[13px] font-semibold" style={{ color: '#346aea' }}>使用方法</span>
            <span className="text-[11px] ml-auto" style={{ color: '#2251bc' }}>中转站注册 →</span>
          </button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#616161' }}>供应商</span>
              <button
                onClick={() => {
                  const id = `custom_${Date.now()}`
                  setDraftProviders([...draftProviders, { id, name: '自定义', model: DEFAULTS.model, apiKey: '', baseUrl: '', supportsResponseFormat: false, supportsCustomSize: true, maxConcurrency: 1 }])
                  setDraftActiveId(id)
                  setAdvancedOpen(true)
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: '#346aea', background: 'rgb(52 106 234 / 0.06)', borderColor: 'rgb(52 106 234 / 0.22)' }}
                title="添加自定义中转站"
                aria-label="添加自定义中转站"
              >
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                <span>添加自定义中转站</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftProviders.map((p) => {
                const builtin = isBuiltinProvider(p)
                const retired = isRetiredProvider(p)
                return (
                  <div key={p.id} className="relative group">
                    <button type="button" aria-pressed={draftActiveId === p.id} onClick={() => { setDraftActiveId(p.id); setAdvancedOpen(true) }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#346aea]"
                      title={retired ? RETIRED_PROVIDER_MESSAGE : undefined}
                      style={{ background: draftActiveId === p.id ? '#346aea' : retired ? 'rgb(211 72 43 / 0.08)' : 'rgb(0 0 0 / 0.04)', color: draftActiveId === p.id ? '#fff' : retired ? '#b33a24' : '#616161' }}>
                      {retired && <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" />}
                      <span className={retired ? 'line-through' : undefined}>{p.name}</span>
                    </button>
                    {(!builtin || retired) && (
                      <button
                        onClick={() => {
                          const remaining = draftProviders.filter(x => x.id !== p.id)
                          setDraftProviders(remaining)
                          if (draftActiveId === p.id) {
                            setDraftActiveId(remaining[0]?.id || '')
                            setAdvancedOpen(Boolean(remaining[0]))
                          }
                        }}
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-[#346aea]"
                        aria-label={`删除供应商 ${p.name}`}
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
            const isBuiltin = isBuiltinProvider(dp)
            const notice = getProviderNotice(dp)
            const updateModel = (value: string) => {
              setFieldError(null)
              setDraftProviders(draftProviders.map(p => p.id === dp.id ? {
                ...p,
                model: value,
                supportsCustomSize: resolveProviderCustomSizeSupport(p.id, value, p.supportsCustomSize),
              } : p))
            }
            return (
              <>
                {notice && (
                  <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs" role="alert"
                    style={{ color: '#b33a24', background: 'rgb(211 72 43 / 0.06)', borderColor: 'rgb(211 72 43 / 0.22)' }}>
                    <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{notice.message}{dp.id === 'yunwu' && <>{' '}<a href="https://openlux.ai/" target="_blank" rel="noopener noreferrer" className="underline rounded focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#2251bc' }}>前往 OpenLux 创建 API Key ↗</a></>}</span>
                  </div>
                )}
                {!isBuiltin && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>名称</span>
                    <input id={`provider-name-${dp.id}`} name="provider-name" autoComplete="off" aria-invalid={fieldError?.providerId === dp.id && fieldError.field === 'name'} aria-describedby={fieldError?.providerId === dp.id && fieldError.field === 'name' ? `provider-name-error-${dp.id}` : undefined} value={dp.name} onChange={(e) => { setFieldError(null); setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, name: e.target.value } : p)) }} onFocus={scrollIntoView}
                      className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                      style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} placeholder="供应商名称" />
                    {fieldError?.providerId === dp.id && fieldError.field === 'name' && <span id={`provider-name-error-${dp.id}`} role="alert" className="mt-1 block text-xs" style={{ color: '#b33a24' }}>{fieldError.message}</span>}
                  </label>
                )}
                <div>
                  <label htmlFor={`api-key-${dp.id}`} className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>API Key</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3.5 h-3.5 w-3.5" style={{ color: '#616161' }} />
                    <input id={`api-key-${dp.id}`} name="api-key" autoComplete="off" spellCheck={false} value={dp.apiKey} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, apiKey: e.target.value } : p))} onFocus={scrollIntoView}
                      type={showKey ? 'text' : 'password'}
                      className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                      style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a', paddingLeft: '2rem', paddingRight: '2.5rem' }} placeholder="sk-..." />
                    <button type="button" aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} onClick={() => setShowKey(!showKey)} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#616161' }}>
                      <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <ImageModelSelector key={dp.id} provider={dp} onChange={updateModel} error={fieldError?.providerId === dp.id && fieldError.field === 'model' ? fieldError.message : undefined} />
                  {dp.id === 'gptgod' && (
                    <span className="mt-1.5 block text-[10px]" style={{ color: dp.supportsCustomSize ? '#20733a' : '#6b6b6b' }}>
                      填入 {GPTGOD_CUSTOM_SIZE_MODEL} 后，本站会开放自定义尺寸选项；还需在 GPTGod 控制台切换到公告指定分组，实际可用性以最新公告为准{dp.supportsCustomSize ? ' · 本站已开启' : ''}
                    </span>
                  )}
                </div>
                {isBuiltin ? (
                  <p className="text-[11px]" style={{ color: '#6b6b6b' }}>
                    Base URL：{dp.baseUrl}{!dp.supportsResponseFormat && ' · 不支持 response_format 参数'}{!dp.supportsCustomSize && ' · 仅支持标准图片尺寸'}
                  </p>
                ) : (
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>Base URL</span>
                    <input id={`provider-baseUrl-${dp.id}`} name="provider-base-url" type="url" inputMode="url" autoComplete="url" spellCheck={false} aria-invalid={fieldError?.providerId === dp.id && fieldError.field === 'baseUrl'} aria-describedby={fieldError?.providerId === dp.id && fieldError.field === 'baseUrl' ? `provider-baseUrl-error-${dp.id}` : undefined} value={dp.baseUrl} onChange={(e) => { setFieldError(null); setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, baseUrl: e.target.value } : p)) }} onBlur={(e) => { const cleaned = e.target.value.trim().replace(/\/+$/, '').replace(/\/v1$/i, ''); setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, baseUrl: cleaned } : p)) }} onFocus={scrollIntoView}
                      className="w-full h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                      style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} placeholder="https://example.com" />
                    {fieldError?.providerId === dp.id && fieldError.field === 'baseUrl' && <span id={`provider-baseUrl-error-${dp.id}`} role="alert" className="mt-1 block text-xs" style={{ color: '#b33a24' }}>{fieldError.message}</span>}
                  </label>
                )}
                <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black/5"
                  style={{ color: '#616161', background: advancedOpen ? 'rgb(0 0 0 / 0.04)' : 'transparent' }}>
                  <span>高级选项</span>
                  <span className="ml-auto text-[10px] font-normal" style={{ color: '#6b6b6b' }}>并发 {dp.maxConcurrency}</span>
                  <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5 transition-transform"
                    style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {advancedOpen && (
                  <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'rgb(0 0 0 / 0.08)', background: 'rgb(0 0 0 / 0.02)' }}>
                    {!isBuiltin && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={dp.supportsResponseFormat}
                            onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, supportsResponseFormat: e.target.checked } : p))}
                            className="h-4 w-4 rounded accent-[#346aea]" />
                          <span className="text-xs" style={{ color: '#616161' }}>支持 response_format (b64_json)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={dp.supportsCustomSize}
                            onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, supportsCustomSize: e.target.checked } : p))}
                            className="h-4 w-4 rounded accent-[#346aea]" />
                          <span className="text-xs" style={{ color: '#616161' }}>支持完全自定义图片尺寸</span>
                        </label>
                      </>
                    )}
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大并发数</span>
                      <input value={dp.maxConcurrency} onChange={(e) => setDraftProviders(draftProviders.map(p => p.id === dp.id ? { ...p, maxConcurrency: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : p))} onFocus={scrollIntoView}
                        type="number" min={1} max={10}
                        className="w-20 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                        style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
                    </label>
                  </div>
                )}
              </>
            )
          })()}

            </TabsContent>

            <TabsContent value="preferences" className="h-full space-y-5 overflow-y-auto p-5" style={{ marginTop: 0 }}>
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

              <label className="block">
                <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大存储上限 (MB)</span>
                <div className="flex items-center gap-2">
                  <input value={draftMaxStorageMB || ''} onChange={(e) => setDraftMaxStorageMB(Number(e.target.value) || 0)} onBlur={() => setDraftMaxStorageMB(Math.max(10, draftMaxStorageMB))} onFocus={scrollIntoView} type="number" min={10}
                    className="w-28 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                    style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
                  <span className="text-xs" style={{ color: '#6b6b6b' }}>当前已用 {(storageUsage / 1024 / 1024).toFixed(1)} MB · {imageCount} 张图片</span>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold" style={{ color: '#616161' }}>最大历史条数</span>
                <div className="flex items-center gap-2">
                  <input value={draftMaxHistoryItems || ''} onChange={(e) => setDraftMaxHistoryItems(Math.min(500, Number(e.target.value) || 0))} onBlur={() => setDraftMaxHistoryItems(Math.max(10, draftMaxHistoryItems))} onFocus={scrollIntoView} type="number" min={10} max={500}
                    className="w-28 h-10 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#346aea]/20 transition-colors"
                    style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
                  <span className="text-xs" style={{ color: '#6b6b6b' }}>当前 {historyCount} 条 · 占用 {(localStorageUsage.usedBytes / 1024).toFixed(1)} KB / {(localStorageUsage.quotaBytes / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </label>
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          {configSaveError && <p role="alert" className="mr-auto min-w-0 flex-1 text-xs" style={{ color: '#b33a24' }}>{configSaveError}</p>}
          <button type="button" onClick={requestClose} className="rounded-lg px-4 py-2 text-sm hover:bg-black/10 transition-colors duration-150" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>取消</button>
          <button onClick={saveDraft} className="rounded-lg px-4 py-2 text-sm font-medium transition-colors" style={{ background: '#346aea', color: '#fff' }}>保存</button>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
