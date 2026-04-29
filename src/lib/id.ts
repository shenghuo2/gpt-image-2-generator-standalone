export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
