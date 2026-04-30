import { DEFAULTS } from './config'

interface ApiAuth { apiKey: string; baseUrl: string; supportsResponseFormat?: boolean }

function b64ToBlobUrl(b64: string) {
  const byteChars = atob(b64)
  const byteNums = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/png' })
  return URL.createObjectURL(blob)
}

function extractImageUrl(data: Record<string, unknown>) {
  const images = (data as { data?: Array<{ b64_json?: string; url?: string }> }).data
    || (data as { images?: Array<{ b64_json?: string; url?: string }> }).images
  const image = images?.[0]
  if (!image) throw new Error('供应商没有返回图片')
  if (image.b64_json) return b64ToBlobUrl(image.b64_json)
  if (image.url) return image.url
  throw new Error('供应商没有返回图片')
}

export async function generateImage(auth: ApiAuth, params: { prompt: string; quality: string; size: string }) {
  const endpoint = `${auth.baseUrl}${DEFAULTS.generatePath}`
  const body: Record<string, unknown> = {
    model: DEFAULTS.model,
    prompt: params.prompt,
    n: 1,
    size: params.size,
    quality: params.quality,
  }
  if (auth.supportsResponseFormat !== false) body.response_format = 'b64_json'
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error((data as { error?: { message?: string } }).error?.message || resp.statusText)
  }

  return extractImageUrl(await resp.json())
}

export async function editImage(auth: ApiAuth, params: { prompt: string; quality: string; size: string; images: Array<{ file: File }> }) {
  const endpoint = `${auth.baseUrl}${DEFAULTS.editPath}`
  const form = new FormData()
  form.append('prompt', params.prompt)
  form.append('model', DEFAULTS.model)
  form.append('size', params.size)
  form.append('quality', params.quality)
  form.append('n', '1')
  if (auth.supportsResponseFormat !== false) form.append('response_format', 'b64_json')
  params.images.forEach((img, i) => form.append(i === 0 ? 'image' : 'images', img.file))

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${auth.apiKey}` },
    body: form,
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    throw new Error((data as { error?: { message?: string } }).error?.message || resp.statusText)
  }

  return extractImageUrl(await resp.json())
}
