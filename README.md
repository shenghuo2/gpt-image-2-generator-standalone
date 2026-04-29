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
| 在线 | **[gpt-image-2-generator-standalone.edgeone.app](https://gpt-image-2-generator-standalone.edgeone.app/)** <br> <sub>EdgeOne Pages · 推荐，三网可用 · [测速对比](docs/speed-test.md)</sub> |
| 备用 | **[shenghuo2.github.io/gpt-image-2-generator-standalone](https://shenghuo2.github.io/gpt-image-2-generator-standalone/)** <br> <sub>不推荐，GitHub Pages 移动网络 DNS 污染严重</sub> |
| 离线 | [Releases](https://github.com/shenghuo2/gpt-image-2-generator-standalone/releases) 下载 zip，解压后浏览器打开 `index.html` |

 如果有帮到你的话，请点个 star 喵 :star: 

## 背景

GPT-image-2 模型生图效果出色，但 ChatGPT 官方不提供分辨率和画幅比参数，而中转站 API 又超低价。网上现有的项目没有好用的纯静态版本，对不懂技术的朋友门槛偏高。于是用 vibe coding 快速搓了这个项目，开箱即用。

## 特性

- **纯前端** — 零服务端依赖，请求从浏览器直接发出
- **本地配置** — API Key 仅存 localStorage，不经过任何服务器
- **文生图 / 图生图** — 参考图片支持粘贴、拖拽、文件选择
- **多图并发** — 可配置生成数量与并发数
- **物理尺寸** — 11 种宽高比 × 3 档像素（1K / 2K / 4K）
- **图片持久化** — IndexedDB 存储生成图片与参考图，刷新不丢，可配上限
- **手机适配** — 响应式布局，自然滚动
- **file:// 直开** — 相对路径打包，`index.html` 双击即用

## 配置

点击左下角齿轮，填写 API Key 与 Base URL，保存至浏览器本地。

| 字段 | 示例 |
|------|------|
| API Key | `sk-xxx` |
| Base URL | `https://nowcoding.ai` |

> 默认预置 NowCoding：实测 6 家中转站中，唯一对自定义尺寸参数比较忠实的，约 0.03¥/张。审核相对敏感，需要其他供应商可自行切换。

## 开发

```bash
npm install
npm run build   # 输出在 out/
```

## 其他

本网站使用 DeepSeek-V4-Pro 快速开发，由于 Vibe coding 可能维护性不算太好，请轻点喷

### 特别感谢
  
  本项目是由本人私用的带后端版本硬分叉出来的，动力来源于「比奇鲍」的群友，在此进行感谢

  中转站测试，感谢「猫捉鱼零」的群友提供的一些帮助