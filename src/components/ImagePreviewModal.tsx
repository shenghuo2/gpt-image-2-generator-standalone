'use client'
import { useState, useEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faDownload, faRedo, faXmark, faChevronLeft, faChevronRight, faTrash } from '@fortawesome/free-solid-svg-icons'
import { gcd, QUALITY_CN } from '@/lib/utils'
import type { HistoryItem } from '@/lib/types'

interface Props {
  item: HistoryItem | null
  initialImageIndex?: number
  onClose: () => void
  onCloseAutoFocus: () => void
  onReuse: (item: HistoryItem) => void
  onDelete: (id: string) => Promise<boolean>
}

function ratioLabel(w: number, h: number) {
  const d = gcd(w, h)
  return `${w / d}:${h / d}`
}

export function ImagePreviewModal({ item, initialImageIndex = 0, onClose, onCloseAutoFocus, onReuse, onDelete }: Props) {
  const [previewRef, setPreviewRef] = useState<string | null>(null)
  const [currentImg, setCurrentImg] = useState(initialImageIndex)
  const [actualSize, setActualSize] = useState<{ w: number; h: number } | null>(null)

  const [copyMsg, setCopyMsg] = useState('')
  const [copyImgMsg, setCopyImgMsg] = useState('')
  const [toast, setToast] = useState('')
  const refPreviewTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!copyMsg) return
    const t = setTimeout(() => setCopyMsg(''), 2000)
    return () => clearTimeout(t)
  }, [copyMsg])

  useEffect(() => {
    if (!copyImgMsg) return
    const t = setTimeout(() => setCopyImgMsg(''), 2000)
    return () => clearTimeout(t)
  }, [copyImgMsg])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  if (!item) return null

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(item.prompt)
      setCopyMsg('已复制')
    } catch {
      // Fallback for HTTP (non-secure context)
      const ta = document.createElement('textarea')
      try {
        ta.value = item.prompt
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        if (!document.execCommand('copy')) throw new Error('copy failed')
        setCopyMsg('已复制')
      } catch {
        setToast('复制失败，请选中文字复制')
      } finally {
        ta.remove()
      }
    }
  }

  const copyImage = async (url: string) => {
    try {
      const blob = await fetch(url).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      setCopyImgMsg('已复制')
    } catch {
      const message = window.isSecureContext
        ? '无法读取图片或剪贴板不支持该格式，请尝试下载'
        : '当前环境不支持复制图片，请尝试 HTTPS 在线版本或下载图片'
      setCopyImgMsg('复制失败')
      setToast(message)
    }
  }

  const download = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'image.png'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const img = item.images[currentImg] || item.images[0]
  const requestedSize = item.params.size || ''
  const hasImages = item.images.length > 0

  return (
    <DialogPrimitive.Root open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.6)' }} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => { event.preventDefault(); onCloseAutoFocus() }}
          className="fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ width: hasImages ? 'min(95vw, 1200px)' : 'min(95vw, 520px)', maxHeight: '90vh', background: '#fff' }}
        >
          <DialogPrimitive.Title className="sr-only">图片预览</DialogPrimitive.Title>
          {/* Header bar */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
            <button type="button" onClick={onClose} aria-label="关闭图片预览" className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ color: '#616161' }}>
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium" style={{ color: '#616161' }}>
              {hasImages ? `${currentImg + 1} / ${item.images.length}` : '提示词记录'}
            </span>
            {hasImages && (
              <>
                <button onClick={() => copyImage(img!)} className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5" style={{ border: '1px solid rgb(0 0 0 / 0.15)', color: '#1a1a1a' }}>
                  <FontAwesomeIcon icon={faCopy} className="h-3 w-3" />{copyImgMsg || '复制'}
                </button>
                <button onClick={() => download(img!)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ background: '#346aea', color: '#fff' }}>
                  <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />下载
                </button>
              </>
            )}
            <button
              type="button"
              onClick={async () => { if (await onDelete(item.id)) onClose() }}
              aria-label="删除这条记录"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-50"
              style={{ color: '#d3482b' }}
              title="删除"
            >
              <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
            </button>
          </div>
          {toast && <p role="status" aria-live="polite" className="shrink-0 px-4 py-2 text-xs" style={{ background: 'rgb(179 58 36 / 0.08)', color: '#a8321d' }}>{toast}</p>}

          {/* Body: image left + info right, stack on mobile */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-y-auto">
            {hasImages && (
            <div className="relative flex flex-1 items-center justify-center" style={{ background: '#f5f5f5', minHeight: 300 }}>
              <img
                src={img}
                alt={item.prompt}
                className="image-checkerboard max-h-full max-w-full object-contain"
                onLoad={(e) => setActualSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              {item.images.length > 1 && (
                <>
                  <button type="button" aria-label="上一张图片" onClick={() => { setActualSize(null); setCurrentImg((v) => (v - 1 + item.images.length) % item.images.length) }}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-colors hover:bg-white"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a1a' }}>
                    <FontAwesomeIcon icon={faChevronLeft} className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="下一张图片" onClick={() => { setActualSize(null); setCurrentImg((v) => (v + 1) % item.images.length) }}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-colors hover:bg-white"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a1a' }}>
                    <FontAwesomeIcon icon={faChevronRight} className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
            )}

            {/* Info panel */}
            <div className="flex w-full lg:w-72 shrink-0 flex-col gap-3 p-4" style={{ background: '#fafafa', borderLeft: hasImages ? '1px solid rgb(0 0 0 / 0.08)' : 'none', borderTop: '1px solid rgb(0 0 0 / 0.05)' }}>
              <p className="min-w-0 text-sm leading-relaxed" style={{ color: '#1a1a1a', overflowWrap: 'anywhere' }}>{item.prompt}</p>
              <div className="flex gap-2">
                <button onClick={copyPrompt} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5" style={{ border: '1px solid rgb(0 0 0 / 0.15)', color: '#1a1a1a' }}>
                  <FontAwesomeIcon icon={faCopy} className="h-3 w-3" />{copyMsg || '复制提示词'}
                </button>
                <button onClick={() => { onReuse(item); onClose() }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors" style={{ background: '#346aea', color: '#fff' }}>
                  <FontAwesomeIcon icon={faRedo} className="h-3 w-3" />复用提示词
                </button>
              </div>
              {item.refImages && item.refImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.refImages.map((refUrl, i) => (
                    <button key={i} type="button" aria-label={`预览参考图 ${i + 1}`} onClick={(event) => { refPreviewTriggerRef.current = event.currentTarget; setPreviewRef(refUrl) }} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-colors hover:border-[#346aea] focus-visible:outline-2 focus-visible:outline-[#346aea]" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
                      <img src={refUrl} alt={`参考图 ${i + 1}`} className="image-checkerboard h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>{requestedSize ? `请求 ${requestedSize}` : item.params.ratio}</span>
                {actualSize && (<span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>实际 {actualSize.w}x{actualSize.h} ({ratioLabel(actualSize.w, actualSize.h)})</span>)}
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>质量：{QUALITY_CN[item.params.quality] || item.params.quality}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>{item.type === 'edit' ? '图生图' : '文生图'}</span>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* Reference image preview overlay */}
      <DialogPrimitive.Root open={Boolean(previewRef)} onOpenChange={(open) => { if (!open) setPreviewRef(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80" />
          <DialogPrimitive.Content aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); if (refPreviewTriggerRef.current?.isConnected) refPreviewTriggerRef.current.focus() }} className="fixed inset-6 z-[60] flex items-center justify-center focus:outline-none">
            <DialogPrimitive.Title className="sr-only">参考图预览</DialogPrimitive.Title>
            {previewRef && <img src={previewRef} alt="放大的参考图" className="image-checkerboard max-h-[90vh] max-w-full rounded-lg object-contain" />}
            <button type="button" aria-label="关闭参考图预览" onClick={() => setPreviewRef(null)} className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" style={{ color: '#fff' }}>
              <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
            </button>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </DialogPrimitive.Root>
  )
}
