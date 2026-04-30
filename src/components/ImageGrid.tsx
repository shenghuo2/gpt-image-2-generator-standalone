'use client'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRotateRight, faTriangleExclamation, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { HistoryItem } from '@/lib/types'

export type ImageJob = {
  id: string
  index: number
  status: 'queued' | 'running' | 'success' | 'error'
  url?: string
  error?: string
  startedAt?: number
  estimateSeconds: number
  prompt?: string
  quality?: string
  ratioLabel?: string
  size?: string
  providerName?: string
  type?: 'generate' | 'edit'
  imageCount?: number
}


interface Props {
  jobs: ImageJob[]
  onRetry: (job: ImageJob) => void
  onCardClick: (item: HistoryItem) => void
  onDelete: (id: string) => void
  history: HistoryItem[]
}

function timestamp() { return Date.now() }

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

interface CardFooterProps {
  prompt?: string
  ratio?: string
  size?: string
  quality?: string
  providerName?: string
  type?: 'generate' | 'edit'
  imageCount?: number
  durationSeconds?: number
  timestamp?: number
  error?: string
  onRetry?: () => void
  children?: React.ReactNode
}

const QUALITY_CN: Record<string, string> = { auto: '自动', low: '低', medium: '中', high: '高', standard: '标准', hd: '高清' }

function CardFooter({ prompt, ratio, size, quality, providerName, type, imageCount, durationSeconds, timestamp, error, onRetry, children }: CardFooterProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-t-xl p-2.5" style={{ background: '#fafafa' }}>
      {prompt && <p className="line-clamp-1 text-xs font-medium" style={{ color: '#1a1a1a' }}>{prompt}</p>}
      {children}
      <div className="flex items-center gap-2 flex-wrap">
        {ratio && ratio !== 'auto' && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>{ratio}</span>
        )}
        {size && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>{size}</span>
        )}
        {providerName && (
          <span className="text-[10px]" style={{ color: '#919191' }}>{providerName}</span>
        )}
        {type && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: type === 'edit' ? 'rgb(37 99 235 / 0.08)' : 'rgb(22 163 74 / 0.08)', color: type === 'edit' ? '#2563eb' : '#16a34a' }}>{type === 'edit' ? '图生图' : '文生图'}</span>
        )}
        {quality && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>质量：{QUALITY_CN[quality] || quality}</span>
        )}
        {imageCount != null && imageCount > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgb(0 0 0 / 0.04)', color: '#616161' }}>{imageCount} 张</span>
        )}
        {error && onRetry && (
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-90 ml-auto" style={{ background: '#d3482b', color: '#fff' }}>
            <FontAwesomeIcon icon={faArrowRotateRight} className="h-3 w-3" />重试
          </button>
        )}
      </div>
      {(durationSeconds != null || timestamp != null) && (
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: '#919191' }}>{durationSeconds != null ? formatSeconds(durationSeconds) : ''}</span>
          {timestamp != null && <span className="text-[10px]" style={{ color: '#bfbfbf' }}>{formatTime(timestamp)}</span>}
        </div>
      )}
    </div>
  )
}

export function ImageGrid({ jobs, onRetry, onCardClick, onDelete, history }: Props) {
  const [now, setNow] = useState(timestamp())

  const running = jobs.some(j => j.status === 'running')
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(timestamp()), 1000)
    return () => clearInterval(t)
  }, [running])

  const pending = jobs.filter(j => j.status !== 'success')
  const successJobs = jobs.filter(j => j.status === 'success' && j.url)

  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {pending.map((job) => {
        const elapsed = job.startedAt ? Math.max(0, Math.floor((now - job.startedAt) / 1000)) : 0
        const progress = job.status === 'running'
          ? Math.min(99, Math.max(8, Math.round((elapsed / job.estimateSeconds) * 100)))
          : 0

        return (
          <div key={job.id} className="overflow-hidden rounded-xl border" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
            {(() => {
              const footer = { prompt: job.prompt, ratio: job.ratioLabel, size: job.size, providerName: job.providerName, type: job.type, imageCount: job.imageCount }
              return job.status === 'error' ? (
                <>
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: '#f5f5f5' }}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgb(211 72 43 / 0.1)', color: '#d3482b' }}>
                      <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>生成失败</p>
                    <p className="line-clamp-2 text-xs" style={{ color: '#616161' }}>{job.error}</p>
                  </div>
                  <CardFooter {...footer} error={job.error} onRetry={() => onRetry(job)} />
                </>
              ) : (
                <>
                  <div className="flex aspect-[4/3] w-full items-center justify-center" style={{ background: '#f5f5f5' }}>
                    <div className="w-full max-w-[200px] rounded-xl border p-3" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
                      <div className="mb-2 flex items-center justify-between text-xs" style={{ color: '#616161' }}>
                        <span>{job.status === 'queued' ? '排队中' : '生成中...'}</span>
                        <span>{job.status === 'running' ? formatSeconds(elapsed) : `第 ${job.index + 1} 张`}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgb(0 0 0 / 0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: '#346aea' }} />
                      </div>
                    </div>
                  </div>
                  <CardFooter {...footer} />
                </>
              )
            })()}
          </div>
        )
      })}
      {successJobs.map((job) => (
        <div key={job.id} className="overflow-hidden rounded-xl border" style={{ borderColor: 'rgb(0 0 0 / 0.1)', background: '#fff' }}>
          <img loading="lazy" src={job.url || ''} alt="" style={{ width: '100%', height: 'auto', minHeight: 120, display: 'block', background: '#f5f5f5' }} />
          <div className="p-2.5 flex items-center justify-end" style={{ background: '#fafafa' }}>
            <span className="text-[10px]" style={{ color: '#bfbfbf' }}>生成成功</span>
          </div>
        </div>
      ))}
      {history.map((item) => {
        const hasImages = item.images.length > 0
        return (
        <div
          key={item.id}
          className="group/card relative cursor-pointer overflow-hidden rounded-xl border transition-shadow duration-200 hover:shadow-lg"
          style={{ borderColor: hasImages ? 'rgb(0 0 0 / 0.1)' : 'rgb(234 179 8 / 0.3)', background: hasImages ? '#fff' : '#fffbeb' }}
          onClick={() => onCardClick(item)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-600"
          >
            <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
          </button>
          {hasImages ? (
            <>
              {item.images.map((url, i) => (
                <img
                  loading="lazy"
                  key={i}
                  src={url}
                  alt=""
                  style={{ width: '100%', height: 'auto', minHeight: 120, display: 'block', background: '#f5f5f5' }}
                />
              ))}
              <CardFooter prompt={item.prompt} ratio={item.params.ratio} size={item.params.size} quality={item.params.quality} providerName={item.params.provider?.providerName} type={item.type} imageCount={item.images.length} durationSeconds={item.params.durationSeconds} timestamp={item.timestamp} />
            </>
          ) : (
            <>
              {item.error && (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center" style={{ background: '#f5f5f5' }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgb(211 72 43 / 0.1)', color: '#d3482b' }}>
                    <FontAwesomeIcon icon={faTriangleExclamation} className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#d3482b' }}>生成失败</p>
                  <p className="line-clamp-2 text-[11px]" style={{ color: '#616161' }}>{item.error}</p>
                </div>
              )}
              <CardFooter prompt={item.prompt} ratio={item.params.ratio} size={item.params.size} quality={item.params.quality} providerName={item.params.provider?.providerName} type={item.type} imageCount={item.images.length} durationSeconds={item.params.durationSeconds} timestamp={item.timestamp} />
            </>
          )}
        </div>
      )})}
    </div>
  )
}
