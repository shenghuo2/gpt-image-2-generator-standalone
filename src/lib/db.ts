const DB_NAME = 'gpt-image-standalone'
const DB_VERSION = 1
const IMAGE_STORE = 'images'
const REF_STORE = 'ref-images'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE)
      if (!db.objectStoreNames.contains(REF_STORE)) db.createObjectStore(REF_STORE)
    }
  })
}

// === Images store (key: `${historyId}_${index}`) ===

export async function saveImages(historyId: string, urls: string[]) {
  const db = await openDB()
  let saved = 0
  for (let i = 0; i < urls.length; i++) {
    try {
      const resp = await fetch(urls[i])
      const blob = await resp.blob()
      await new Promise<void>((resolve, reject) => {
        const txn = db.transaction(IMAGE_STORE, 'readwrite')
        const store = txn.objectStore(IMAGE_STORE)
        store.put(blob, `${historyId}_${i}`)
        txn.oncomplete = () => resolve()
        txn.onerror = () => reject(txn.error)
      })
      saved++
    } catch (e) { console.error('saveImages failed for index', i, e) }
  }
  return saved
}

export async function loadImages(historyId: string, count: number): Promise<string[]> {
  const db = await openDB()
  const txn = db.transaction(IMAGE_STORE, 'readonly')
  const store = txn.objectStore(IMAGE_STORE)
  const urls: string[] = []
  for (let i = 0; i < count; i++) {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = store.get(`${historyId}_${i}`)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
    if (blob) urls.push(URL.createObjectURL(blob))
    else break
  }
  return urls
}

export async function deleteImages(historyId: string) {
  const db = await openDB()
  const store = db.transaction(IMAGE_STORE, 'readwrite').objectStore(IMAGE_STORE)
  // Delete all entries with matching prefix
  const keys = await new Promise<string[]>((resolve, reject) => {
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => reject(req.error)
  })
  const txn = db.transaction(IMAGE_STORE, 'readwrite')
  const s = txn.objectStore(IMAGE_STORE)
  for (const key of keys) {
    if (typeof key === 'string' && key.startsWith(`${historyId}_`)) s.delete(key)
  }
  await new Promise<void>((resolve) => { txn.oncomplete = () => resolve() })
}

// === Ref images store (key: content hash) ===

async function sha256Prefix(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  try {
    // Try Web Crypto (needs HTTPS/localhost)
    const hash = await crypto.subtle.digest('SHA-256', buf)
    const arr = Array.from(new Uint8Array(hash))
    return arr.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback: FNV-1a hash for HTTP contexts
    const arr = new Uint8Array(buf.slice(0, 1024))
    let h = 2166136261
    for (let i = 0; i < arr.length; i++) {
      h ^= arr[i]
      h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(16).padStart(8, '0')
  }
}

export async function saveRefImage(blob: Blob): Promise<string> {
  const key = await sha256Prefix(blob)
  const db = await openDB()
  const store = db.transaction(REF_STORE, 'readwrite').objectStore(REF_STORE)
  // Check if already exists
  const exists = await new Promise<boolean>((resolve, reject) => {
    const req = store.getKey(key)
    req.onsuccess = () => resolve(!!req.result)
    req.onerror = () => reject(req.error)
  })
  if (!exists) {
    store.put(blob, key)
    await new Promise<void>((resolve) => {
      store.transaction.oncomplete = () => resolve()
    })
  }
  return key
}

export async function loadRefImage(key: string): Promise<string | null> {
  try {
    const db = await openDB()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = db.transaction(REF_STORE, 'readonly').objectStore(REF_STORE).get(key)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
    if (!blob) return null
    return URL.createObjectURL(blob)
  } catch { return null }
}

export async function deleteRefImage(key: string) {
  const db = await openDB()
  const store = db.transaction(REF_STORE, 'readwrite').objectStore(REF_STORE)
  store.delete(key)
  await new Promise<void>((resolve) => { store.transaction.oncomplete = () => resolve() })
}

// === Storage usage ===

export async function getStorageUsage(): Promise<number> {
  try {
    const db = await openDB()
    let total = 0
    for (const name of [IMAGE_STORE, REF_STORE]) {
      const store = db.transaction(name, 'readonly').objectStore(name)
      const values = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
      })
      for (const v of values) {
        if (v instanceof Blob) total += v.size
      }
    }
    return total
  } catch { return 0 }
}

// Get all stored ref image keys (for listing)
export async function getAllRefKeys(): Promise<string[]> {
  const db = await openDB()
  const keys = await new Promise<string[]>((resolve, reject) => {
    const req = db.transaction(REF_STORE, 'readonly').objectStore(REF_STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => reject(req.error)
  })
  return keys
}
