import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getActiveProvider, getDefaultConfig, getProviderNotice, isRetiredProvider, loadConfig, parseImageModelList } from '../src/lib/config.ts'

function storedConfig(t, raw) {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const storage = new Map([['gpt-image-standalone-config', JSON.stringify(raw)]])
  globalThis.window = {}
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  })
  return loadConfig()
}

test('new users start on OpenLux Sunburst while GPTGod defaults to 2.5', () => {
  const config = getDefaultConfig()
  const active = getActiveProvider(config)
  assert.equal(active.id, 'openlux')
  assert.equal(active.baseUrl, 'https://api.openlux.ai')
  assert.equal(active.model, 'gpt-image-2.5-sunburst')
  assert.equal(config.providers.find(provider => provider.id === 'gptgod').model, 'gpt-image-2.5')
  assert.ok(config.providers.some(provider => provider.id === 'yunwu'))
  assert.equal(isRetiredProvider('yunwu'), false)
  assert.match(getProviderNotice('yunwu').message, /10 月 16 日关站/)
})

test('migration adds OpenLux without moving YunWu credentials or changing saved models', t => {
  const config = storedConfig(t, {
    providers: [
      { id: 'yunwu', apiKey: 'local-yunwu-fixture', model: 'saved-yunwu-image-model' },
      { id: 'gptgod', apiKey: 'local-gptgod-fixture', model: 'gpt-image-2-vip' },
    ], activeProviderId: 'yunwu',
  })
  assert.equal(config.activeProviderId, 'yunwu')
  assert.equal(getActiveProvider(config).apiKey, 'local-yunwu-fixture')
  assert.equal(getActiveProvider(config).model, 'saved-yunwu-image-model')
  assert.equal(config.providers.find(provider => provider.id === 'openlux').apiKey, '')
  assert.equal(config.providers.find(provider => provider.id === 'gptgod').model, 'gpt-image-2-vip')
})

test('an empty saved GPTGod model uses its provider default', t => {
  const config = storedConfig(t, { providers: [{ id: 'gptgod', model: ' ' }], activeProviderId: 'gptgod' })
  assert.equal(getActiveProvider(config).model, 'gpt-image-2.5')
})

test('legacy URLs with /v1 still migrate to YunWu without losing the key', t => {
  const config = storedConfig(t, { baseUrl: 'https://yunwu.ai/v1/', apiKey: 'legacy-local-fixture' })
  assert.equal(config.activeProviderId, 'yunwu')
  assert.equal(getActiveProvider(config).model, 'gpt-image-2')
  assert.equal(getActiveProvider(config).apiKey, 'legacy-local-fixture')
})

test('a legacy key without an explicit URL stays on the former YunWu default', t => {
  const config = storedConfig(t, { apiKey: 'legacy-local-fixture' })
  assert.equal(config.activeProviderId, 'yunwu')
  assert.equal(getActiveProvider(config).apiKey, 'legacy-local-fixture')
  assert.equal(config.providers.find(provider => provider.id === 'openlux').apiKey, '')
})

test('model discovery filters text and unknown variants, deduplicating real image models', () => {
  assert.deepEqual(parseImageModelList({ data: [
    { id: 'gpt-5' }, { id: 'gpt-image-2.5-flare-c' }, { id: 'gpt-image-2.5-sunburst' },
    { id: 'gpt-image-2.5-unannounced' }, { id: 'gpt-image-2.5-sunburst' },
    { id: 'gpt-image-2.5' }, { id: 'gpt-image-2' }, null, {},
  ] }), ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare-c', 'gpt-image-2.5', 'gpt-image-2'])
})

test('empty or unrelated model results never invent preset options', () => {
  assert.deepEqual(parseImageModelList({ data: [] }), [])
  assert.deepEqual(parseImageModelList({ data: [{ id: 'gpt-4o' }] }), [])
  assert.throws(() => parseImageModelList({ data: null }), /模型列表格式无效/)
})
