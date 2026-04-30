'use client'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faDownload, faRedo, faXmark, faChevronLeft, faChevronRight, faTrash } from '@fortawesome/free-solid-svg-icons'
import { gcd, QUALITY_CN } from '@/lib/utils'
import type { HistoryItem } from '@/lib/types'

interface Props {
  item: HistoryItem | null
  initialImageIndex?: number
  onClose: () => void
  onReuse: (item: HistoryItem) => void
  onDelete: (id: string) => void
}

function ratioLabel(w: number, h: number) {
  const d = gcd(w, h)
  return `${w / d}:${h / d}`
}

export function ImagePreviewModal({ item, initialImageIndex = 0, onClose, onReuse, onDelete }: Props) {
  const [previewRef, setPreviewRef] = useState<string | null>(null)
  const [currentImg, setCurrentImg] = useState(initialImageIndex)
  const [actualSize, setActualSize] = useState<{ w: number; h: number } | null>(null)

  const [copyMsg, setCopyMsg] = useState('')
  const [copyImgMsg, setCopyImgMsg] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, onClose])

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
      try {
        const ta = document.createElement('textarea')
        ta.value = item.prompt
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopyMsg('已复制')
      } catch {
        setCopyMsg('复制需要 HTTPS，请手动选中文字复制')
      }
    }
  }

  const copyImage = async (url: string) => {
    try {
      const blob = await fetch(url).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      setCopyImgMsg('已复制')
    } catch {
      setCopyImgMsg('复制失败，非 HTTPS 环境')
      setToast('本功能必须HTTPS，请尝试自行部署或者使用在线版本')
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
    <>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
        <div
          className="relative flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ width: hasImages ? 'min(95vw, 1200px)' : 'min(95vw, 520px)', maxHeight: '90vh', background: '#fff' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5" style={{ color: '#616161' }}>
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
              onClick={() => { onDelete(item.id); onClose() }}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-50"
              style={{ color: '#d3482b' }}
              title="删除"
            >
              <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body: image left + info right, stack on mobile */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-y-auto">
            {hasImages && (
            <div className="relative flex flex-1 items-center justify-center" style={{ background: '#f5f5f5', minHeight: 300 }}>
              <img
                src={img}
                alt=""
                className="max-h-full max-w-full object-contain"
                onLoad={(e) => setActualSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              {item.images.length > 1 && (
                <>
                  <button onClick={() => { setActualSize(null); setCurrentImg((v) => (v - 1 + item.images.length) % item.images.length) }}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-colors hover:bg-white"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a1a' }}>
                    <FontAwesomeIcon icon={faChevronLeft} className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { setActualSize(null); setCurrentImg((v) => (v + 1) % item.images.length) }}
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
              <p className="text-sm leading-relaxed" style={{ color: '#1a1a1a' }}>{item.prompt}</p>
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
                    <button key={i} onClick={() => setPreviewRef(refUrl)} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-colors hover:border-[#346aea]" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
                      <img src={refUrl} alt="" className="h-full w-full object-cover" />
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
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 z-[80] -translate-x-1/2 rounded-lg px-4 py-2.5 text-xs font-medium shadow-lg" style={{ background: '#d3482b', color: '#fff' }}>
          {toast}
        </div>
      )}

      {/* Reference image preview overlay */}
      {previewRef && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={() => setPreviewRef(null)}>
          <img src={previewRef} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewRef(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10" style={{ color: '#fff' }}>
            <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  )
}
