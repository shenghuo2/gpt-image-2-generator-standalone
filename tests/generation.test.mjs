import assert from 'node:assert/strict'
import { test } from 'node:test'
import { oldestImageDeletePlan, partialFailureMessage, referencedImageKeys, remainingRetryCount, runBatch } from '../src/lib/generation.ts'
import { getDefaultConfig, supportedActiveProviderId } from '../src/lib/config.ts'

test('batch keeps result order and respects the concurrency limit', async () => {
  let active = 0
  let peak = 0
  const starts = []
  const results = await runBatch([0, 1, 2, 3, 4], 2, async value => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, value % 2 ? 1 : 5))
    active--
    if (value === 3) throw new Error('failed')
    return value * 10
  }, undefined, index => starts.push(index))

  assert.equal(peak, 2)
  assert.deepEqual(starts.sort(), [0, 1, 2, 3, 4])
  assert.equal(results[0].value, 0)
  assert.equal(results[2].value, 20)
  assert.equal(results[3].status, 'rejected')
  assert.equal(results[4].value, 40)
})

test('retry count never exceeds the original batch target', () => {
  assert.equal(remainingRetryCount(2, 3), 1)
  assert.equal(remainingRetryCount(2, 3, 1), 0)
  assert.equal(remainingRetryCount(3, 3), 0)
  assert.equal(remainingRetryCount(4, 3), 0)
  assert.equal(partialFailureMessage(2, 3, 'network'), '已生成 2/3 张，失败 1 张：network')
})

test('cleanup respects oldest order and shared reference keys', () => {
  const items = [
    { id: 'new', images: ['a'], refImageKeys: ['shared'] },
    { id: 'old', images: ['b', 'c'], refImageKeys: ['shared', 'old-only'] },
  ]
  assert.deepEqual(oldestImageDeletePlan(items, 2), { ids: ['old'], imageCount: 2, recordCount: 1 })
  assert.deepEqual([...referencedImageKeys(items.slice(0, 1))], ['shared'])
})

test('a retired provider cannot remain active after configuration migration', () => {
  const providers = [
    ...getDefaultConfig().providers,
    { id: 'nowcoding', name: 'NowCoding', apiKey: 'old-key' },
  ]
  assert.equal(supportedActiveProviderId(providers, 'nowcoding'), 'yunwu')
  assert.equal(providers[2].apiKey, 'old-key')
})
