<p align="center">
  <img src="public/logo.png" alt="logo" width="100" />
</p>

<h3 align="center">生蚝的 GPT-image-2 图片生成站</h3>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/纯静态-无后端-4c1" />
</p>

<p align="center">纯静态图片生成站，浏览器直连 OpenAI 兼容 API，无需后端，历史记录本地缓存。</p>

## 快速开始

| 方式 | 地址 |
|------|------|
| 在线 | **[gpt-image.shenghuo2.top](https://gpt-image.shenghuo2.top/)** <br> <sub>EdgeOne Pages + 自定义域名 · 推荐，三网可用 · [测速对比](docs/speed-test.md)</sub> |
| 备用 | **[shenghuo2.github.io/gpt-image-2-generator-standalone](https://shenghuo2.github.io/gpt-image-2-generator-standalone/)** <br> <sub>不推荐，GitHub Pages 移动网络 DNS 污染严重</sub> |
| 离线 | [Releases](https://github.com/shenghuo2/gpt-image-2-generator-standalone/releases) 下载 zip，解压后浏览器打开 `index.html` |

 如果有帮到你的话，请点个 star 喵 :star: 

## 背景

GPT-image-2 模型生图效果很棒，但 ChatGPT 网站版不提供分辨率和画幅比参数。中转站 API 的价格通常更低，不过不同接入渠道支持的图片尺寸能力也不同。
但找了一圈网上现有的项目，没找到好用的纯静态版本，对不懂技术的朋友来说，使用中转站的门槛偏高。

于是用 vibe coding 快速搓了这个项目，开箱即用。

## 特性

- **纯前端** — 零服务端依赖，请求从浏览器直接发出
- **多供应商** — 首选 OpenLux，保留 YunWu / GPTGod，支持自定义，老配置自动迁移不丢失
- **多模型切换** — 在设置的「供应商配置」中通过 `/v1/models` 同步白名单内的图像模型，支持手动填写模型 ID；接口失败或列表为空时不提供预设选项，保存设置后生效
- **独立模型 ID** — 每个供应商独立保存模型；默认 `gpt-image-2.5-sunburst`，GPTGod 默认 `gpt-image-2.5`
- **透明图片预览** — 生成图、历史预览和参考图以棋盘格底纹显示透明区域，下载保留原图透明层；需要透明背景时请在提示词中说明
- **本地配置** — API Key 仅存 localStorage，各供应商独立存储切换
- **文生图 / 图生图** — 参考图片支持粘贴、拖拽、文件选择，最多 16 张
- **多图并发** — 可配置生成数量与并发数（最多 3 并发）
- **物理尺寸** — 支持自定义尺寸的渠道可使用 11 种宽高比 × 3 档像素（1K / 2K / 4K），算法精确匹配 16px 对齐
- **图片持久化** — IndexedDB 存储生成图片与参考图，刷新不丢，可配置存储上限
- **参考图复用** — 历史记录中的参考图自动去重持久，可在预览中一键复用
- **历史管理** — 卡片悬浮显示删除按钮，支持单条清除（图片 + 记录）
- **手机适配** — 响应式网格，小屏自动单列堆叠
- **file:// 直开** — 相对路径打包，`index.html` 双击即用

## 配置

点击左下角齿轮，填写以下信息，保存至浏览器本地。

| 设置项 | 说明 |
|------|------|
| 供应商 | 首选 OpenLux，保留 YunWu / GPTGod，支持自定义添加 |
| API Key | 各供应商独立存储，切换自动切换密钥 |
| 模型 ID | 各供应商独立配置，默认 `gpt-image-2.5-sunburst`；GPTGod 默认 `gpt-image-2.5`，保留已保存的模型 |
| Base URL | 内置供应商固定地址，自定义可自由填写 |
| 存储上限 | 默认 500MB，IndexedDB 图片留存上限 |

> 默认首选 **OpenLux**（openlux.ai）：API 地址为 `https://api.openlux.ai`。注册链接：[带邀请码](https://www.openlux.ai/register?aff=o3QY) / [无邀请码](https://www.openlux.ai/register)。YunWu 官方邮件通知 10 月 16 日关站，本站暂保留可选并提示迁移。原有 YunWu 配置、模型和 Key 会继续保留；请在 OpenLux 创建独立 API Key。
>
> 低价优先也可选择 **GPTGod**（new.gptgod.cloud）：最低约 `¥0.02/张`，最低充值金额为 `¥10`。普通模型仅支持标准尺寸；如需自定义分辨率，请将模型 ID 填为 `gpt-image-2-vip`，并在 GPTGod 控制台切换到公告指定的分组。完成两项配置后应可使用自定义分辨率；具体分组、可用性与计费请以中转站最新公告为准。
>
> GPTGod 默认使用 `gpt-image-2.5`。其模型广场另有 `gpt-image-2.5-flare` 和 `gpt-image-2.5-vip`，三者均按次计费；「标准」与「充值」价格口径不同，请结合令牌分组核算。`gpt-image-2.5-vip` 与旧版 `gpt-image-2-vip` 是不同型号，本站不会据此自动开放自定义尺寸。
>
> 升级前已保存的 NowCoding 配置会继续保留并标注“已下线”，以免丢失本地 Key；新用户不再显示该供应商。

### 图像模型

| 模型 ID | 用途 |
|------|------|
| `gpt-image-2.5-sunburst` | 高精度，细节与提示词还原更强，面向精品商业图像；OpenLux 按量计费 |
| `gpt-image-2.5-flare` | 均衡、低延迟，适合批量快速出图；OpenLux 按量计费，GPTGod 按次计费 |
| `gpt-image-2.5-sunburst-c` | OpenLux Sunburst 按次计费版本 |
| `gpt-image-2.5-flare-c` | OpenLux Flare 按次计费版本 |
| `gpt-image-2.5` | 2.5 通用版本，GPTGod 新配置默认使用，按次计费 |
| `gpt-image-2.5-vip` | GPTGod 2.5 VIP 型号，按次计费；分组、尺寸能力需向供应商确认 |
| `gpt-image-2` / `gpt-image-2-vip` | 兼容原有模型与 GPTGod 自定义尺寸渠道 |

模型选择位于设置的「供应商配置」中，下拉仅展示 `/v1/models` 实际返回、且在上述白名单内的模型，不展示文本模型。没有 Key、正在加载、请求失败或白名单结果为空时，保留当前配置并提供手动模型 ID 输入，不推测供应商支持哪些模型。修改模型后点击「保存」生效。

上述模型描述与计费方式依据 [OpenLux 模型广场](https://www.openlux.ai/console/models?view=table&keyword=ge-2.5) 和 [GPTGod 模型广场](https://new.gptgod.cloud/pricing) 于 **2026-10-28** 核对，属于供应商渠道说明。OpenLux 的两个 `-c` 型号说明默认支持 1K，`Gpt-Image-2/3` 分组支持 1K、2K、4K；分辨率和价格需结合实际令牌分组确认。同名模型在不同供应商的计费方式可能不同，不应仅凭 `-c` 后缀判断。

需要透明背景时，请在提示词中说明；图生图也应重新说明保留透明背景，实际格式与透明层取决于渠道返回。本站不额外发送 `background`、`format` 或 `output_format` 参数，以兼容不同中转站；图片显示时使用棋盘格底纹，下载保留供应商返回的原图和透明层。

请求尺寸可能与供应商实际出图尺寸不同，请在预览中查看「实际」尺寸。2026-10-28 的 GPTGod 实测中，`gpt-image-2.5` 请求 `1024x1024` 返回 `1254x1254`；Flare 的横图请求 `1536x1024`，提示词要求 16:9，实际返回 `1672x941`。这是本次渠道结果，不代表其他渠道也有相同行为。

## 尺寸参考

使用支持自定义尺寸的供应商时，所有预置比例均满足：宽高 16px 对齐、长短边比 ≤ 3:1、像素 655K\~8.3M、最大边长 < 3840px。不支持自定义尺寸的供应商会自动映射为最接近方向的标准尺寸。

| 比例 | 名称 | 1K | 像素 | 2K | 像素 | 4K | 像素 |
|------|------|-----|------|-----|------|-----|------|
| 1:1 | 正方形 | 1024×1024 | 1.05M | 2048×2048 | 4.19M | 2880×2880 | 8.29M |
| 4:3 | 经典 | 1152×864 | 1.00M | 2368×1776 | 4.21M | 3264×2448 | 7.99M |
| 3:2 | 标准 | 1248×832 | 1.04M | 2496×1664 | 4.15M | 3504×2336 | 8.19M |
| 2:3 | 肖像 | 832×1248 | 1.04M | 1664×2496 | 4.15M | 2336×3504 | 8.19M |
| 16:9 | 宽屏 | 1360×768 | 1.04M | 2736×1536 | 4.20M | 3808×2144 | 8.16M |
| 9:16 | 竖屏 | 768×1360 | 1.04M | 1536×2736 | 4.20M | 2144×3808 | 8.16M |
| 21:9 | 超宽 | 1568×672 | 1.05M | 3136×1344 | 4.21M | — | — |
| 2:1 | 水平 | 1440×720 | 1.04M | 2880×1440 | 4.15M | — | — |
| 3:1 | 横幅 | 1776×592 | 1.05M | 3552×1184 | 4.21M | — | — |
| 3:4 | 传统 | 880×1168 | 1.03M | 1776×2368 | 4.21M | 2448×3264 | 7.99M |

> 21:9 和 3:1 在高档位受 <3840px 边长约束限制，无法达到目标像素数。无预置标准尺寸的比例/档位组合由算法动态计算。

## 开发

```bash
npm install
npm run dev     # 本地开发服务器
npm run build   # 生产构建，输出在 out/
npm run lint    # ESLint 检查
```

> 构建分两步：`build:css`（Tailwind v4 → `public/tailwind.css`）→ `next build`（静态导出）。`next.config.ts` 中 `output: 'export'` + `assetPrefix: './'` 确保产物可通过 `file://` 协议直接打开。

## 其他

本网站使用 DeepSeek-V4-Pro 快速开发，由于 Vibe coding 可能维护性不算太好，请轻点喷

### 特别感谢
  
  本项目是由本人私用的带后端版本硬分叉出来的，动力来源于「比奇鲍」的群友，在此进行感谢

  感谢「猫捉鱼铃」的群友在中转站评测期间提供的一些帮助

## 许可证

[MIT](LICENSE)
