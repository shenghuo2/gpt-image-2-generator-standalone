'use client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

interface Props {
  open: boolean
  onClose: () => void
}

export function UsageGuide({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-lg lg:max-w-2xl max-h-full flex flex-col rounded-2xl shadow-2xl" style={{ background: '#fff' }} onClick={(e) => e.stopPropagation()}>
        <div className="overflow-y-auto rounded-2xl">
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(52 106 234 / 0.1)' }}>
            <FontAwesomeIcon icon={faCircleQuestion} className="h-4 w-4" style={{ color: '#346aea' }} />
          </div>
          <h2 className="text-base font-semibold" style={{ color: '#1a1a1a' }}>使用方法</h2>
          <button onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 transition-colors duration-150">
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" style={{ color: '#616161' }} />
          </button>
        </div>
        <div className="p-5 lg:p-6 space-y-5 lg:space-y-6 text-sm lg:text-[15px]" style={{ color: '#1a1a1a', lineHeight: 1.75 }}>
          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>什么是中转站？</h3>
            <p className="text-[13px] lg:text-sm" style={{ color: '#616161' }}>
              中转站（API Proxy）是一个中间服务，提供与 OpenAI 兼容的 API 接口，底层调用 GPT-image-2 等模型。
              ChatGPT 网页版未开放自定义分辨率参数，且价格更高；中转站提供标准 API，支持自定义尺寸，价格更低。
            </p>
            <p className="text-[13px] lg:text-sm mt-1" style={{ color: '#616161' }}>
              本人推荐这两家，也可以使用自己现有的中转站（设置中点击 + 添加自定义供应商）。
            </p>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border p-3 text-[13px] lg:text-sm" style={{ borderColor: 'rgb(0 0 0 / 0.08)', background: 'rgb(0 0 0 / 0.02)' }}>
                <span className="font-semibold" style={{ color: '#1a1a1a' }}>NowCoding</span>
                <span className="ml-1.5 text-[11px]" style={{ color: '#919191' }}>nowcoding.ai</span>
                <p className="mt-1" style={{ color: '#616161' }}>默认预置供应商。约 ¥0.03/张，支持自定义分辨率。审核相对敏感，可能改动提示词（响应含 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)' }}>revised_prompt</code>）。</p>
              </div>
              <div className="rounded-lg border p-3 text-[13px] lg:text-sm" style={{ borderColor: 'rgb(0 0 0 / 0.08)', background: 'rgb(0 0 0 / 0.02)' }}>
                <span className="font-semibold" style={{ color: '#1a1a1a' }}>YunWu</span>
                <span className="ml-1.5 text-[11px]" style={{ color: '#919191' }}>yunwu.ai</span>
                <p className="mt-1" style={{ color: '#616161' }}>不改动提示词，画质接近官方 API。高峰期可能返回 429。不支持 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)' }}>response_format</code> 参数（切换后自动关闭）。</p>
                <div className="mt-1.5 space-y-1 text-[11px]">
                  <div>带邀请码：<a href="https://yunwu.ai/register?aff=HE7h" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>https://yunwu.ai/register?aff=HE7h</a></div>
                  <div>无邀请码：<a href="https://yunwu.ai/register" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>https://yunwu.ai/register</a></div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>如何开始？</h3>
            <ol className="text-[13px] lg:text-sm space-y-3 list-decimal pl-4" style={{ color: '#616161' }}>
              <li>选择一个中转站注册账号（如 <a href="https://nowcoding.ai" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>nowcoding.ai</a> 或 <a href="https://yunwu.ai/register?aff=HE7h" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>yunwu.ai</a>）</li>
              <li>注册后进入「令牌管理 / API 令牌」页面，点击「添加令牌」创建新 Key</li>
              <li>复制 Key（格式 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)', color: '#1a1a1a' }}>sk-xxxxx</code>），回到本站左下角齿轮</li>
              <li>在设置中切换到你注册的供应商，填入 API Key，保存</li>
              <li>输入提示词，点击生成即可出图</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>注意事项</h3>
            <ul className="text-[13px] lg:text-sm space-y-1.5 list-disc pl-4" style={{ color: '#616161' }}>
              <li>API Key 仅存储在浏览器本地（localStorage），不会上传到任何服务器</li>
              <li>生成图片存储在浏览器 IndexedDB 中，可在设置中配置存储上限</li>
              <li>图生图模式下，参考图片会一并存储到本地，用于后续复用和去重</li>
              <li>不同中转站的审核策略和定价不同，建议按需切换</li>
            </ul>
          </section>
        </div>
        </div>
      </div>
    </div>
  )
}
