'use client'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

interface Props {
  open: boolean
  onClose: () => void
  onCloseAutoFocus: () => void
}

export function UsageGuide({ open, onClose, onCloseAutoFocus }: Props) {
  if (!open) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.4)' }} />
        <DialogPrimitive.Content aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); onCloseAutoFocus() }} className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl shadow-2xl lg:max-w-2xl" style={{ background: '#fff' }}>
        <div className="overflow-y-auto rounded-2xl">
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'rgb(0 0 0 / 0.1)' }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(52 106 234 / 0.1)' }}>
            <FontAwesomeIcon icon={faCircleQuestion} className="h-4 w-4" style={{ color: '#346aea' }} />
          </div>
          <DialogPrimitive.Title className="text-base font-semibold" style={{ color: '#1a1a1a' }}>使用方法</DialogPrimitive.Title>
          <button type="button" onClick={onClose} aria-label="关闭使用方法" className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#346aea]">
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" style={{ color: '#616161' }} />
          </button>
        </div>
        <div className="p-5 lg:p-6 space-y-5 lg:space-y-6 text-sm lg:text-[15px]" style={{ color: '#1a1a1a', lineHeight: 1.75 }}>
          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>什么是中转站？</h3>
            <p className="text-[13px] lg:text-sm" style={{ color: '#616161' }}>
              中转站（API Proxy）是一个中间服务，提供与 OpenAI 兼容的 API 接口，底层调用 GPT-image-2 等模型。
              ChatGPT 网页版目前未开放自定义分辨率参数；中转站通常价格更低，但尺寸能力取决于接入渠道：<span title="该限制由 Codex 反代渠道于 6 月下旬新增" style={{ borderBottom: '1px dotted #919191' }}>低价反代渠道普遍只能使用标准尺寸</span><sup style={{ marginLeft: 2, color: '#919191', fontSize: 9 }}>注</sup>，Azure API 等直连渠道则可完整自定义。
            </p>
            <p className="mt-1 text-[10px]" style={{ color: '#6b6b6b' }}>
              注：这是 Codex 反代渠道在 6 月下旬新增的限制；后续规则可能调整，请以中转站最新公告为准。
            </p>
            <p className="text-[13px] lg:text-sm mt-1" style={{ color: '#616161' }}>
              目前推荐以下两家，也可以在设置中点击「+」添加自己已有的中转站。
            </p>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border p-3 text-[13px] lg:text-sm" style={{ borderColor: 'rgb(0 0 0 / 0.08)', background: 'rgb(0 0 0 / 0.02)' }}>
                <span className="font-semibold" style={{ color: '#1a1a1a' }}>OpenLux</span>
                <span className="ml-1.5 text-[11px]" style={{ color: '#6b6b6b' }}>openlux.ai</span>
                <p className="mt-1" style={{ color: '#616161' }}>当前首选的海外站，API 地址为 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)', overflowWrap: 'anywhere' }}>https://api.openlux.ai</code>。默认模型为 gpt-image-2.5-sunburst，适合精品商业图像创作；Flare 偏向均衡、低延迟。无 -c 后缀的这两款在 OpenLux 按量计费，-c 版本按次计费；可用模型、尺寸与价格以控制台和令牌分组为准。</p>
                <div className="mt-1.5 space-y-1 text-[11px]">
                  <div>带邀请码：<a href="https://www.openlux.ai/register?aff=o3QY" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>https://www.openlux.ai/register?aff=o3QY</a></div>
                  <div>无邀请码：<a href="https://www.openlux.ai/register" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>https://www.openlux.ai/register</a></div>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: '#a8321d' }}>YunWu 官方邮件通知 10 月 16 日关站，本站暂保留可选。建议迁移至 OpenLux，并在新站创建独立 Key。</p>
              </div>
              <div className="rounded-lg border p-3 text-[13px] lg:text-sm" style={{ borderColor: 'rgb(0 0 0 / 0.08)', background: 'rgb(0 0 0 / 0.02)' }}>
                <span className="font-semibold" style={{ color: '#1a1a1a' }}>GPTGod</span>
                <a href="https://new.gptgod.cloud/" target="_blank" rel="noopener noreferrer" className="ml-1.5 text-[11px] underline" style={{ color: '#346aea' }}>new.gptgod.cloud</a>
                <p className="mt-1" style={{ color: '#616161' }}>当前低价推荐，最低约 ¥0.02/张，最低充值金额为 ¥10。普通模型仅支持标准尺寸；如需自定义分辨率，请将模型 ID 填为 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)' }}>gpt-image-2-vip</code>，并在 GPTGod 控制台切换到公告指定的分组。完成两项配置后应可使用自定义分辨率；具体分组、可用性与计费请以中转站最新公告为准。</p>
                <p className="mt-1.5 text-[11px]" style={{ color: '#616161' }}>本站默认使用 gpt-image-2.5。GPTGod 模型广场另有 gpt-image-2.5-flare、gpt-image-2.5-vip，三者均按次计费；「标准」与「充值」展示的价格口径不同，请结合令牌分组核算。2.5 VIP 与旧版 gpt-image-2-vip 是不同型号，本站不会据此自动开放自定义尺寸。</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>如何开始？</h3>
            <ol className="text-[13px] lg:text-sm space-y-3 list-decimal pl-4" style={{ color: '#616161' }}>
              <li>选择一个中转站注册账号：首选 <a href="https://www.openlux.ai/register?aff=o3QY" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>OpenLux</a>，低价优先也可选择 <a href="https://new.gptgod.cloud/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#346aea' }}>GPTGod</a></li>
              <li>注册后进入「令牌管理 / API 令牌」页面，点击「添加令牌」创建新 Key</li>
              <li>复制 Key（格式 <code className="text-[11px] rounded px-1" style={{ background: 'rgb(0 0 0 / 0.06)', color: '#1a1a1a' }}>sk-xxxxx</code>），回到本站左下角齿轮</li>
              <li>在设置中切换到你注册的供应商，填入 API Key，保存</li>
              <li>输入提示词，点击生成即可出图</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>模型与透明背景</h3>
            <ul className="text-[13px] lg:text-sm space-y-1.5 list-disc pl-4" style={{ color: '#616161', overflowWrap: 'anywhere' }}>
              <li><span translate="no">gpt-image-2.5-sunburst</span>：默认模型，细节和提示词还原更强，适合精品商业图像。</li>
              <li><span translate="no">gpt-image-2.5-flare</span>：均衡、低延迟，适合批量快速出图。</li>
              <li><span translate="no">gpt-image-2.5-sunburst-c</span> 和 <span translate="no">gpt-image-2.5-flare-c</span>：OpenLux 按次计费版本。其模型广场说明默认支持 1K，Gpt-Image-2/3 分组支持 1K、2K、4K；在控制台确认令牌分组后再选分辨率。</li>
              <li><span translate="no">gpt-image-2.5</span>：GPTGod 默认型号；其 2.5、Flare、2.5 VIP 均按次计费，不能只凭是否有 -c 后缀判断计费方式。</li>
              <li>在设置的「供应商配置」中切换模型，只展示接口返回的图像模型；列表获取失败或为空时，请手动填写模型 ID，保存后生效。</li>
              <li>需要透明背景时，请在提示词中明确说明；图生图也请重新写明保留透明背景，实际是否透明取决于渠道返回。棋盘格只用于预览，下载保留原图已有的透明层。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm lg:text-base font-semibold mb-3" style={{ color: '#1a1a1a' }}>注意事项</h3>
            <ul className="text-[13px] lg:text-sm space-y-1.5 list-disc pl-4" style={{ color: '#616161' }}>
              <li>API Key 保存在本地浏览器；生成时会直接发送给所选供应商</li>
              <li>生成图片存储在浏览器 IndexedDB 中，可在设置中配置存储上限</li>
              <li>图生图模式下，参考图片会一并存储到本地，用于后续复用和去重</li>
              <li>不同中转站的审核策略和定价不同，建议按需切换</li>
              <li>请求尺寸可能与实际出图尺寸不同，请在图片预览中查看「实际」尺寸；例如 GPTGod 的 2.5 渠道可能按提示词返回其他分辨率。</li>
              <li>以上模型与计费说明依据 2026 年 10 月 28 日的供应商模型广场核对，后续调整以供应商为准。</li>
            </ul>
          </section>
        </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
