'use client'
import { useEffect, useState } from 'react'
import type { ProviderEntry } from './config'
import { fetchImageModels } from './api-client'

type ModelResult = { key: string; status: 'loading' | 'ready' | 'error'; models: string[] }

export function useImageModels(provider: ProviderEntry) {
  const { id, baseUrl, apiKey } = provider
  let validBaseUrl = false
  try { validBaseUrl = ['http:', 'https:'].includes(new URL(baseUrl.trim()).protocol) } catch { /* Wait for a complete URL. */ }
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([id, baseUrl, apiKey, revision])
  const [result, setResult] = useState<ModelResult | null>(null)

  useEffect(() => {
    if (!apiKey.trim() || !validBaseUrl) return
    const controller = new AbortController()
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const debounce = setTimeout(() => { void (async () => {
      if (cancelled) return
      timeout = setTimeout(() => controller.abort(), 15000)
      setResult({ key, status: 'loading', models: [] })
      try {
        const models = await fetchImageModels({ apiKey, baseUrl }, controller.signal)
        if (!cancelled) setResult({ key, status: 'ready', models })
      } catch {
        if (!cancelled) setResult({ key, status: 'error', models: [] })
      } finally { clearTimeout(timeout) }
    })() }, 350)
    return () => { cancelled = true; clearTimeout(debounce); clearTimeout(timeout); controller.abort() }
  }, [key, apiKey, baseUrl, validBaseUrl, revision])

  const current = result?.key === key ? result : null
  return {
    models: current?.models || [],
    status: !apiKey.trim() ? 'needs-key' as const : !validBaseUrl ? 'needs-url' as const : current?.status || 'loading' as const,
    refresh: () => setRevision(value => value + 1),
  }
}
