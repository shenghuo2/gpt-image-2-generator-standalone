'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faXmark } from '@fortawesome/free-solid-svg-icons'

interface Props {
  searchQuery: string
  setSearchQuery: (v: string) => void
}

export function NavBar({ searchQuery, setSearchQuery }: Props) {
  return (
    <nav className="flex h-12 shrink-0 items-center border-b" style={{ background: '#fff', borderColor: 'rgb(0 0 0 / 0.08)' }}>
      <div className="flex items-center gap-2 shrink-0 px-5 lg:w-[400px]">
        <img src="./logo.png" alt="" className="h-5 w-5 rounded" />
        <span className="text-[13px] font-semibold truncate" style={{ color: '#1a1a1a' }}>
          <span className="hidden lg:inline">shenghuo2 的 GPT-image-2 图片生成站</span>
          <span className="lg:hidden">生蚝的生图站</span>
        </span>
      </div>
      <div className="flex-1 flex items-center min-w-0 gap-2 px-3 lg:px-4">
        <div className="relative max-w-[120px] lg:max-w-[220px] flex-1 min-w-0">
          <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none" style={{ color: '#919191' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery('') }}
            placeholder="搜索提示词..."
            className="w-full h-7 rounded-md border text-xs outline-none transition-colors focus:border-[#346aea] pl-9 lg:pl-8 pr-8"
            style={{ background: 'rgb(0 0 0 / 0.03)', borderColor: 'rgb(0 0 0 / 0.1)', color: '#1a1a1a' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/10"
            >
              <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" style={{ color: '#919191' }} />
            </button>
          )}
        </div>
        <a href="https://github.com/shenghuo2/gpt-image-2-generator-standalone" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] hover:underline shrink-0 ml-auto" style={{ color: '#616161' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span className="hidden lg:inline">GitHub</span>
        </a>
      </div>
    </nav>
  )
}
