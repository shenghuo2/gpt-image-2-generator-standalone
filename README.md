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

GPT-image-2 模型生图效果很棒，但 ChatGPT 网站版不提供分辨率和画幅比参数的使用，使用中转站 API 有超低的价格（虽然慢点）。 
但找了一圈网上现有的项目，没找到好用的纯静态版本，对不懂技术的朋友来说，使用中转站的门槛偏高。

于是用 vibe coding 快速搓了这个项目，开箱即用。

## 特性

- **纯前端** — 零服务端依赖，请求从浏览器直接发出
- **多供应商** — 预置 NowCoding / YunWu，支持自定义，数据自动迁移不丢失
- **本地配置** — API Key 仅存 localStorage，各供应商独立存储切换
- **文生图 / 图生图** — 参考图片支持粘贴、拖拽、文件选择，最多 16 张
- **多图并发** — 可配置生成数量与并发数（最多 3 并发）
- **物理尺寸** — 11 种宽高比 × 3 档像素（1K / 2K / 4K），算法精确匹配 16px 对齐
- **图片持久化** — IndexedDB 存储生成图片与参考图，刷新不丢，可配置存储上限
- **参考图复用** — 历史记录中的参考图自动去重持久，可在预览中一键复用
- **历史管理** — 卡片悬浮显示删除按钮，支持单条清除（图片 + 记录）
- **手机适配** — 响应式网格，小屏自动单列堆叠
- **file:// 直开** — 相对路径打包，`index.html` 双击即用

## 配置

点击左下角齿轮，填写以下信息，保存至浏览器本地。

| 设置项 | 说明 |
|------|------|
| 供应商 | 预置 NowCoding / YunWu，支持自定义添加 |
| API Key | 各供应商独立存储，切换自动切换密钥 |
| Base URL | 内置供应商固定地址，自定义可自由填写 |
| 存储上限 | 默认 500MB，IndexedDB 图片留存上限 |

> 默认预置 **NowCoding**（nowcoding.ai）：实测了 6 家中转站中，在 `¥0.03/张` 这个价位，唯一支持自定义分辨率的。审核可能敏感一些，会改动你的提示词（响应中可见 `revised_prompt` 字段）。
>
> 如追求更高画质，可尝试 **YunWu**（yunwu.ai）：不改动提示词，生图质量接近官方 API。但高峰期可能返回 429，建议配合重试。注册链接：[带邀请码](https://yunwu.ai/register?aff=HE7h) / [无邀请码](https://yunwu.ai/register)。YunWu 不支持 `response_format` 参数，切换后会自动关闭。

## 尺寸参考

所有预置比例均满足：宽高 16px 对齐、长短边比 ≤ 3:1、像素 655K\~8.3M、最大边长 < 3840px。

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