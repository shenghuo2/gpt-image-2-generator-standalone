import { gcd } from './utils'

export type Quality = 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd'
export type AspectRatio = 'auto' | '1:1' | '2:1' | '3:1' | '2:3' | '3:2' | '3:4' | '4:3' | '16:9' | '9:16' | '21:9'
export type PixelTier = '1k' | '2k' | '4k'

export type ProviderSettings = {
  providerName: string
  model: string
  baseUrl: string
}

export const RATIO_OPTIONS: Array<{ value: AspectRatio; title: string; subtitle: string; w: number; h: number }> = [
  { value: 'auto', title: 'auto', subtitle: '自动', w: 1, h: 1 },
  { value: '1:1', title: '1:1', subtitle: '正方形', w: 1, h: 1 },
  { value: '2:1', title: '2:1', subtitle: '水平', w: 2, h: 1 },
  { value: '3:1', title: '3:1', subtitle: '横幅', w: 3, h: 1 },
  { value: '2:3', title: '2:3', subtitle: '肖像', w: 2, h: 3 },
  { value: '3:2', title: '3:2', subtitle: '标准', w: 3, h: 2 },
  { value: '3:4', title: '3:4', subtitle: '传统', w: 3, h: 4 },
  { value: '4:3', title: '4:3', subtitle: '经典', w: 4, h: 3 },
  { value: '16:9', title: '16:9', subtitle: '宽屏', w: 16, h: 9 },
  { value: '9:16', title: '9:16', subtitle: '社交故事', w: 9, h: 16 },
  { value: '21:9', title: '21:9', subtitle: '超宽', w: 21, h: 9 },
]

const FALLBACK_SIZE_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '2:3': '1024x1536',
  '3:2': '1536x1024',
}

// Standard resolutions from display/photography conventions, matched to pixel tiers.
// Falls back to algorithm when no standard size is within ±25% of the pixel target.
const STANDARD_SIZES: Record<string, Record<PixelTier, string | null>> = {
  '1:1':  { '1k': '1024x1024', '2k': '2048x2048', '4k': null },
  '4:3':  { '1k': '1184x896',  '2k': '2368x1776', '4k': null },
  '3:2':  { '1k': '1248x832',  '2k': '2512x1680', '4k': null },
  '2:3':  { '1k': '832x1248',  '2k': '1680x2528', '4k': null },
  '16:9': { '1k': '1360x768',  '2k': '2736x1536', '4k': '3840x2160' },
  '9:16': { '1k': '768x1360',  '2k': '1536x2736', '4k': '2160x3840' },
  '21:9': { '1k': null,        '2k': null,        '4k': null },
  '2:1':  { '1k': '1456x736',  '2k': '2896x1440', '4k': null },
  '3:1':  { '1k': '1776x592',  '2k': '3552x1184', '4k': null },
  '3:4':  { '1k': '880x1168',  '2k': '1776x2368', '4k': null },
}

const PIXEL_TARGETS: Record<PixelTier, number> = {
  '1k': 1024 * 1024,
  '2k': 2048 * 2048,
  '4k': 8294400,
}

export function simplifyRatio(width: number, height: number) {
  const divisor = gcd(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`
}

export function sizeFromRatio(ratio: string, tier: PixelTier, supportsCustomSize: boolean) {
  if (!supportsCustomSize) return FALLBACK_SIZE_MAP[ratio] ?? '1024x1024'

  const [rawW, rawH] = ratio.split(':').map(Number)
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH) || rawH <= 0) return '1024x1024'
  const ratioNumber = rawW / rawH
  const safeRatio = Math.min(3, Math.max(1 / 3, ratioNumber))
  const targetPixels = PIXEL_TARGETS[tier]

  // Standard size lookup: prefer convention over algorithmic precision
  const std = STANDARD_SIZES[ratio]?.[tier]
  if (std) {
    const [sw, sh] = std.split('x').map(Number)
    if (sw > 0 && sh > 0) {
      const stdPixels = sw * sh
      const err = Math.abs(stdPixels - targetPixels) / targetPixels
      if (err <= 0.35) return std
    }
  }

  function round16(v: number) { return Math.max(16, Math.round(v / 16) * 16) }

  interface Cand { w: number; h: number; exact: boolean }
  const seen = new Set<string>()
  function add(cands: Cand[], w: number, h: number, exact: boolean) {
    if (w < 16 || h < 16 || w / h > 3 || h / w > 3) return
    if (w >= 3840 || h >= 3840 || w * h > 8294400) return
    const key = `${w}x${h}`
    if (seen.has(key)) return
    seen.add(key)
    cands.push({ w, h, exact })
  }

  const exactCands: Cand[] = []
  // Exact ratio candidates via stepK
  const stepW = 16 / gcd(rawW, 16)
  const stepH = 16 / gcd(rawH, 16)
  const stepK = stepW * stepH / gcd(stepW, stepH)
  const base = rawW * rawH * stepK * stepK
  const n0 = Math.max(1, Math.round(Math.sqrt(targetPixels / base)))
  for (const dn of [-30, -20, -15, -10, -8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30]) {
    const nn = n0 + dn
    if (nn < 1) continue
    add(exactCands, rawW * stepK * nn, rawH * stepK * nn, true)
  }

  const approxCands: Cand[] = []
  // Approximate: round W to 16, compute H → round to 16
  const targetW = Math.sqrt(targetPixels * safeRatio)
  const targetH = targetW / safeRatio
  for (const dw of [-32, -16, 0, 16, 32]) {
    const w = round16(targetW + dw)
    const h = round16(w / safeRatio)
    add(approxCands, w, h, false)
  }
  // Approximate: round H, compute W → round to 16
  for (const dh of [-32, -16, 0, 16, 32]) {
    const h = round16(targetH + dh)
    const w = round16(h * safeRatio)
    add(approxCands, w, h, false)
  }

  function pixErr(c: Cand) { return Math.abs(c.w * c.h - targetPixels) / targetPixels }

  // Prefer exact ratio; within exact candidates, pick closest to pixel target
  // Overshoot bias: slightly smaller is better than slightly larger
  function sortKey(c: Cand) {
    const e = pixErr(c)
    // Penalize overshoot by 100%
    return c.w * c.h > targetPixels ? e * 2 : e
  }
  exactCands.sort((a, b) => sortKey(a) - sortKey(b))
  approxCands.sort((a, b) => sortKey(a) - sortKey(b))

  if (exactCands.length === 0 && approxCands.length > 0) {
    for (const c of approxCands) add(exactCands, c.w, c.h, false)
    exactCands.sort((a, b) => sortKey(a) - sortKey(b))
  }

  if (exactCands.length === 0) return '1024x1024'

  let best = exactCands[0]
  // If best exact candidate is >25% off pixel target and an approximate candidate
  // is much closer with <1% ratio error, prefer the approximate one
  if (pixErr(best) > 0.25 && approxCands.length > 0) {
    approxCands.sort((a, b) => {
      const reA = Math.abs(a.w / a.h - safeRatio) / safeRatio
      const reB = Math.abs(b.w / b.h - safeRatio) / safeRatio
      if (reA < 0.01 && reB >= 0.01) return -1
      if (reB < 0.01 && reA >= 0.01) return 1
      return sortKey(a) - sortKey(b)
    })
    const alt = approxCands[0]
    if (Math.abs(alt.w / alt.h - safeRatio) / safeRatio < 0.01 && pixErr(alt) < pixErr(best) * 0.5) {
      best = alt
    }
  }

  let width = best.w, height = best.h
  let pixels = width * height

  if (pixels > 8294400 || width >= 3840 || height >= 3840) {
    for (const c of exactCands) { if (c.w * c.h <= 8294400 && c.w < 3840 && c.h < 3840) { width = c.w; height = c.h; pixels = width * height; break } }
  }
  if (pixels < 655360) {
    for (const c of exactCands.reverse()) { if (c.w * c.h >= 655360 && c.w < 3840 && c.h < 3840) { width = c.w; height = c.h; pixels = width * height; break } }
  }

  return `${width}x${height}`
}
