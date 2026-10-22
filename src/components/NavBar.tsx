'use client'
import { useSyncExternalStore } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare, faSearch, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'

interface Props {
  searchQuery: string
  setSearchQuery: (v: string) => void
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION
const APP_COMMIT_SHA = process.env.NEXT_PUBLIC_APP_COMMIT_SHA
const APP_BUILD_TIME = process.env.NEXT_PUBLIC_APP_BUILD_TIME
const REPOSITORY_URL = 'https://github.com/shenghuo2/gpt-image-2-generator-standalone'

function subscribeToLocationChange(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  return () => {
    window.removeEventListener('hashchange', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
  }
}

function getIsHttps() {
  return window.location.protocol === 'https:'
}

function getServerIsHttps() {
  return false
}

function getLocationHref() {
  return window.location.href
}

function getServerLocationHref() {
  return ''
}

function StatusDot({ isHttps, size = 6 }: { isHttps: boolean; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 9999,
        background: isHttps ? '#3fb950' : '#f59e0b',
      }}
      aria-hidden="true"
    />
  )
}

export function NavBar({ searchQuery, setSearchQuery }: Props) {
  const isHttps = useSyncExternalStore(subscribeToLocationChange, getIsHttps, getServerIsHttps)
  const currentUrl = useSyncExternalStore(subscribeToLocationChange, getLocationHref, getServerLocationHref)
  const statusLabel = isHttps ? 'HTTPS 部署' : '非 HTTPS 环境'
  const statusDescription = isHttps ? '当前页面通过加密连接访问。' : '当前页面不是 HTTPS，部分浏览器能力可能受限。'

  return (
    <nav className="flex h-12 shrink-0 items-center border-b" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.08)' }}>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 lg:w-[400px] lg:flex-none lg:px-5">
        <img src="./logo.png" alt="" className="h-5 w-5 rounded" />
        <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: '#1a1a1a' }}>
          <span className="hidden lg:inline">shenghuo2 的 GPT-image-2 图片生成站</span>
          <span className="lg:hidden">生蚝的生图站</span>
        </span>
        {APP_VERSION && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex h-[18px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0 text-[11px] font-normal leading-none transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#346aea]/30"
                style={{ background: '#f7f7f7', borderColor: 'rgb(0 0 0 / 0.12)', color: '#5f5f5f' }}
                aria-label={`打开关于信息，当前版本 ${APP_VERSION}`}
              >
                <StatusDot isHttps={isHttps} />
                <span>{APP_VERSION}</span>
              </button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-32px)] max-w-sm overflow-hidden border p-0" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.1)' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.08)' }}>
                <DialogTitle className="text-base font-semibold" style={{ color: '#1a1a1a' }}>关于</DialogTitle>
                <DialogDescription className="mt-1 text-xs" style={{ color: '#707070' }}>
                  shenghuo2 的 GPT-image-2 图片生成站
                </DialogDescription>
              </div>

              <div className="space-y-3 px-5 py-4">
                <div className="rounded-lg border px-3 py-2.5" style={{ background: '#fafafa', borderColor: 'rgb(0 0 0 / 0.08)' }}>
                  <div className="mb-1 text-[11px]" style={{ color: '#6b6b6b' }}>版本</div>
                  <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#1a1a1a' }}>
                    <StatusDot isHttps={isHttps} />
                    {APP_COMMIT_SHA ? (
                      <a
                        href={`${REPOSITORY_URL}/commit/${APP_COMMIT_SHA}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`查看版本 ${APP_VERSION} 对应的提交（在新标签页打开）`}
                        className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-[#346aea] underline underline-offset-2 transition-colors hover:text-[#2251bc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#346aea]"
                      >
                        <span className="truncate">{APP_VERSION}</span>
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="truncate">{APP_VERSION}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-xs">
                  {APP_BUILD_TIME && (
                    <>
                      <span style={{ color: '#6b6b6b' }}>最近构建</span>
                      <time dateTime={APP_BUILD_TIME} className="min-w-0 break-words tabular-nums" style={{ color: '#616161' }}>
                        {new Intl.DateTimeFormat('zh-CN', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          hourCycle: 'h23', timeZoneName: 'short',
                        }).format(new Date(APP_BUILD_TIME))}
                      </time>
                    </>
                  )}
                  <span style={{ color: '#6b6b6b' }}>部署状态</span>
                  <span className="flex items-center gap-2" style={{ color: isHttps ? '#20733a' : '#9a5a00' }}>
                    <StatusDot isHttps={isHttps} />
                    {statusLabel}
                  </span>

                  <span style={{ color: '#6b6b6b' }}>当前地址</span>
                  <span className="min-w-0 truncate" style={{ color: '#616161' }}>{currentUrl || '浏览器运行时获取'}</span>
                </div>

                <div className="space-y-2 rounded-lg px-3 py-2.5" style={{ background: 'rgb(0 0 0 / 0.03)' }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
                    <StatusDot isHttps={true} />
                    <span>绿色表示 HTTPS 加密访问。</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#616161' }}>
                    <StatusDot isHttps={false} />
                    <span>橙色表示本地或非 HTTPS 访问。</span>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: '#6b6b6b' }}>{statusDescription}</p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex-1 flex items-center min-w-0 gap-2 px-3 lg:px-4">
        <div className="relative max-w-[120px] lg:max-w-[220px] flex-1 min-w-0">
          <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none" style={{ color: '#919191' }} />
          <input
            name="history-search"
            aria-label="搜索历史提示词"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery('') }}
            placeholder="搜索提示词..."
            className="w-full h-7 rounded-md border text-xs outline-none transition-colors focus:border-[#346aea] pl-9 lg:pl-8 pr-8"
            style={{ background: 'rgb(0 0 0 / 0.03)', borderColor: 'rgb(0 0 0 / 0.1)', color: '#1a1a1a' }}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/10"
            >
              <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" style={{ color: '#919191' }} />
            </button>
          )}
        </div>
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:underline shrink-0 ml-auto" style={{ color: '#616161' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span className="hidden lg:inline">GitHub</span>
        </a>
      </div>
    </nav>
  )
}
