export function partialFailureMessage(done: number, total: number, firstError?: string) {
  const missing = Math.max(0, total - done)
  if (missing === 0) return undefined
  const prefix = done > 0 ? `已生成 ${done}/${total} 张，失败 ${missing} 张` : `生成失败 ${missing}/${total} 张`
  return firstError ? `${prefix}：${firstError}` : `${prefix}，可继续重试`
}

export function remainingRetryCount(done: number, total: number, running = 0) {
  return Math.max(0, total - done - running)
}

export function oldestImageDeletePlan<T extends { id: string; images: readonly string[] }>(items: readonly T[], minImages = 5) {
  const ids: string[] = []
  let imageCount = 0
  for (let i = items.length - 1; i >= 0 && imageCount < minImages; i--) {
    const item = items[i]
    if (!item.images.length) continue
    ids.push(item.id)
    imageCount += item.images.length
  }
  return { ids, imageCount, recordCount: ids.length }
}

export function referencedImageKeys(items: readonly { refImageKeys?: readonly string[] }[]) {
  return new Set(items.flatMap(item => item.refImageKeys || []))
}

export async function runBatch<T, R>(
  items: readonly T[],
  concurrency: number,
  work: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number, result: PromiseSettledResult<R>) => void,
  onStart?: (index: number) => void,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length)
  let cursor = 0
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1))
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      onStart?.(index)
      try {
        results[index] = { status: 'fulfilled', value: await work(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
      onSettled?.(index, results[index])
    }
  }))
  return results
}
