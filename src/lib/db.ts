const DB_NAME = 'gpt-image-standalone'
const DB_VERSION = 1
const IMAGE_STORE = 'images'
const REF_STORE = 'ref-images'

let dbPromise: Promise<IDBDatabase> | null = null
let cachedUsage: number | null = null
let usageScan: Promise<number> | null = null
let usageRevision = 0
let mutationQueue: Promise<void> = Promise.resolve()

function queueMutation<T>(work: () => Promise<T>): Promise<T> {
  const task = mutationQueue.then(work)
  mutationQueue = task.then(() => undefined, () => undefined)
  return task
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
        cachedUsage = null
      }
      resolve(db)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE)
      if (!db.objectStoreNames.contains(REF_STORE)) db.createObjectStore(REF_STORE)
    }
  }).catch(error => {
    dbPromise = null
    throw error
  })
  dbPromise = opening
  return opening
}

function imageRange(historyId: string) {
  const prefix = `${historyId}_`
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`)
}

function recordUsageChange(delta: number) {
  usageRevision++
  if (cachedUsage !== null) cachedUsage = Math.max(0, cachedUsage + delta)
}

async function putBlob(storeName: string, key: string, blob: Blob, maxBytes?: number) {
  const db = await openDB()
  const previous = await new Promise<Blob | undefined>((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
  const delta = blob.size - (previous?.size || 0)
  if (maxBytes !== undefined && await getStorageUsage() + delta > maxBytes) {
    throw new Error('图片存储空间已达到设置的上限，请先清理历史记录或提高上限')
  }
  await new Promise<void>((resolve, reject) => {
    const txn = db.transaction(storeName, 'readwrite')
    txn.objectStore(storeName).put(blob, key)
    txn.oncomplete = () => resolve()
    txn.onerror = () => reject(txn.error)
    txn.onabort = () => reject(txn.error)
  })
  recordUsageChange(delta)
}

export async function saveImage(historyId: string, index: number, url: string, maxBytes?: number): Promise<{ saved: boolean; error?: string }> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`图片下载失败（HTTP ${resp.status}）`)
    const blob = await resp.blob()
    if (!blob.size || blob.type.startsWith('text/')) throw new Error('供应商返回的图片内容无效')
    await queueMutation(() => putBlob(IMAGE_STORE, `${historyId}_${index}`, blob, maxBytes))
    return { saved: true }
  } catch (error) {
    console.error('saveImage failed for index', index, error)
    return { saved: false, error: error instanceof Error ? error.message : '图片保存失败' }
  }
}

export async function saveImages(historyId: string, urls: string[], maxBytes?: number) {
  let saved = 0
  for (const url of urls) {
    if ((await saveImage(historyId, saved, url, maxBytes)).saved) saved++
  }
  return saved
}

export async function loadImages(historyId: string, count: number): Promise<string[]> {
  const db = await openDB()
  const entries = await new Promise<Array<{ index: number; blob: Blob }>>((resolve, reject) => {
    const found: Array<{ index: number; blob: Blob }> = []
    const txn = db.transaction(IMAGE_STORE, 'readonly')
    const req = txn.objectStore(IMAGE_STORE).openCursor(imageRange(historyId))
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const index = Number(String(cursor.key).slice(historyId.length + 1))
      if (Number.isInteger(index) && index >= 0 && index < count && cursor.value instanceof Blob) {
        found.push({ index, blob: cursor.value })
      }
      cursor.continue()
    }
    txn.oncomplete = () => resolve(found)
    txn.onerror = () => reject(txn.error)
    txn.onabort = () => reject(txn.error)
  })
  return entries.sort((a, b) => a.index - b.index).map(({ blob }) => URL.createObjectURL(blob))
}

export async function deleteImages(historyId: string) {
  await queueMutation(async () => {
    const db = await openDB()
    let deletedBytes = 0
    await new Promise<void>((resolve, reject) => {
      const txn = db.transaction(IMAGE_STORE, 'readwrite')
      const req = txn.objectStore(IMAGE_STORE).openCursor(imageRange(historyId))
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        if (cursor.value instanceof Blob) deletedBytes += cursor.value.size
        cursor.delete()
        cursor.continue()
      }
      txn.oncomplete = () => resolve()
      txn.onerror = () => reject(txn.error)
      txn.onabort = () => reject(txn.error)
    })
    recordUsageChange(-deletedBytes)
  })
}

async function contentHash(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  try {
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    // Hash the whole file, then compare bytes before reusing a key.
    let first = 2166136261
    let second = 2166136261 ^ 0x9e3779b9
    for (const byte of bytes) {
      first = Math.imul(first ^ byte, 16777619)
      second = Math.imul(second ^ byte, 16777619)
    }
    return `fnv-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}-${bytes.length}`
  }
}

async function sameBlob(first: Blob, second: Blob) {
  if (first.size !== second.size) return false
  const [a, b] = await Promise.all([first.arrayBuffer(), second.arrayBuffer()])
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  return left.every((byte, index) => byte === right[index])
}

export async function saveRefImage(blob: Blob, maxBytes?: number, onStored?: (key: string) => void): Promise<string> {
  const baseKey = await contentHash(blob)
  return queueMutation(async () => {
    const db = await openDB()
    let key = baseKey
    let suffix = 1
    while (true) {
      const existing = await new Promise<Blob | undefined>((resolve, reject) => {
        const req = db.transaction(REF_STORE, 'readonly').objectStore(REF_STORE).get(key)
        req.onsuccess = () => resolve(req.result as Blob | undefined)
        req.onerror = () => reject(req.error)
      })
      if (!existing) break
      if (await sameBlob(existing, blob)) {
        onStored?.(key)
        return key
      }
      key = `${baseKey}-${suffix++}`
    }
    await putBlob(REF_STORE, key, blob, maxBytes)
    onStored?.(key)
    return key
  })
}

export async function loadRefImage(key: string): Promise<string | null> {
  try {
    const db = await openDB()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = db.transaction(REF_STORE, 'readonly').objectStore(REF_STORE).get(key)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
    return blob ? URL.createObjectURL(blob) : null
  } catch { return null }
}

export async function pruneRefImages(usedKeys: () => Iterable<string>) {
  await queueMutation(async () => {
    const keep = new Set(usedKeys())
    const db = await openDB()
    let deletedBytes = 0
    await new Promise<void>((resolve, reject) => {
      const txn = db.transaction(REF_STORE, 'readwrite')
      const req = txn.objectStore(REF_STORE).openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        if (!keep.has(String(cursor.key))) {
          if (cursor.value instanceof Blob) deletedBytes += cursor.value.size
          cursor.delete()
        }
        cursor.continue()
      }
      txn.oncomplete = () => resolve()
      txn.onerror = () => reject(txn.error)
      txn.onabort = () => reject(txn.error)
    })
    if (deletedBytes) recordUsageChange(-deletedBytes)
  })
}

async function scanStorageUsage(): Promise<number> {
  const db = await openDB()
  let total = 0
  for (const name of [IMAGE_STORE, REF_STORE]) {
    await new Promise<void>((resolve, reject) => {
      const txn = db.transaction(name, 'readonly')
      const req = txn.objectStore(name).openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return
        if (cursor.value instanceof Blob) total += cursor.value.size
        cursor.continue()
      }
      txn.oncomplete = () => resolve()
      txn.onerror = () => reject(txn.error)
      txn.onabort = () => reject(txn.error)
    })
  }
  return total
}

export async function getStorageUsage(): Promise<number> {
  if (cachedUsage !== null) return cachedUsage
  if (usageScan) return usageScan
  const revision = usageRevision
  usageScan = scanStorageUsage().then(async total => {
    usageScan = null
    if (revision !== usageRevision) return getStorageUsage()
    cachedUsage = total
    return total
  }).catch(error => {
    usageScan = null
    throw error
  })
  return usageScan
}

export async function getImageCount(): Promise<number> {
  const db = await openDB()
  return new Promise<number>((resolve, reject) => {
    const req = db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
