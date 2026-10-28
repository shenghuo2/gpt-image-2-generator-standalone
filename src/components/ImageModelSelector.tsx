'use client'
import { getImageModelPreset, type ProviderEntry } from '@/lib/config'
import { useImageModels } from '@/lib/use-image-models'
import { useState } from 'react'

interface Props {
  provider: ProviderEntry
  onChange: (model: string) => void
  error?: string
}

export function ImageModelSelector({ provider, onChange, error }: Props) {
  const [manual, setManual] = useState(false)
  const { models, status, refresh } = useImageModels(provider)
  const hasModels = status === 'ready' && models.length > 0
  const useList = hasModels && !manual
  const id = `provider-model-${provider.id}`
  const perImageBilling = (model: string) => getImageModelPreset(model)?.perImageBilling || (provider.id === 'gptgod' && ['gpt-image-2.5', 'gpt-image-2.5-flare', 'gpt-image-2.5-vip'].includes(model.trim()))
  const modelDescription = getImageModelPreset(provider.model)?.description
  const description = modelDescription && `${modelDescription}${provider.id === 'gptgod' && perImageBilling(provider.model) ? ' GPTGod 按次计费，价格与分组以模型广场为准。' : ''}`
  const hint = status === 'needs-key' ? '填写 API Key 后可同步模型，也可手动填写。'
    : status === 'needs-url' ? '填写有效的 Base URL 后可同步模型，也可手动填写。'
    : status === 'loading' ? '正在同步模型，也可手动填写。'
    : status === 'error' ? '无法获取模型列表，请手动填写模型 ID。'
    : !models.length ? '暂无匹配的图像模型，请手动填写。'
    : !models.includes(provider.model) ? '当前模型未在接口列表中，请确认可用性；保存设置后生效。'
    : '已同步图像模型，保存设置后生效。'
  const describedBy = `${id}-status${description ? ` ${id}-description` : ''}${error ? ` ${id}-error` : ''}`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold" style={{ color: '#616161' }}>模型 ID</label>
        <div className="flex items-center gap-2">
          {hasModels && (
            <button type="button" onClick={() => {
              setManual(!manual)
              requestAnimationFrame(() => document.getElementById(id)?.focus())
            }} className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#346aea' }}>
              {manual ? '从列表选择' : '手动输入'}
            </button>
          )}
          <button type="button" onClick={refresh} disabled={status === 'needs-key' || status === 'needs-url' || status === 'loading'}
            className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-black/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#346aea' }}>
            {status === 'loading' ? '同步中…' : '刷新模型'}
          </button>
        </div>
      </div>
      {useList ? (
        <select id={id} name="provider-model" value={provider.model} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy}
          className="h-10 w-full rounded-lg border px-3 text-xs focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ background: '#fff', borderColor: error ? '#b33a24' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }}>
          {!models.includes(provider.model) && <option value={provider.model} disabled>{provider.model ? `${provider.model}（当前配置）` : '请选择模型'}</option>}
          {models.map(model => <option key={model} value={model}>{model}{perImageBilling(model) ? ' · 按次计费' : ''}</option>)}
        </select>
      ) : (
        <input id={id} name="provider-model" autoComplete="off" spellCheck={false} value={provider.model} onChange={event => onChange(event.target.value)} onBlur={event => onChange(event.target.value.trim())}
          aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder="供应商提供的模型 ID…"
          className="h-10 w-full rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ background: '#fff', borderColor: error ? '#b33a24' : 'rgb(0 0 0 / 0.15)', color: '#1a1a1a' }} />
      )}
      {description && <p id={`${id}-description`} className="mt-1.5 text-[11px] leading-relaxed" style={{ color: '#616161' }}>{description}</p>}
      <p id={`${id}-status`} role="status" className="mt-1.5 text-[11px] leading-relaxed" style={{ color: status === 'error' ? '#a8321d' : '#6b6b6b' }}>{hint}</p>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs" style={{ color: '#b33a24' }}>{error}</p>}
    </div>
  )
}
