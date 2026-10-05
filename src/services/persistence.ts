const STORAGE_KEY = 'gsb64:haccp-platform'

let simulateFailure = false
let lastCommitted: string | null = null
const listeners = new Set<(message: string) => void>()

export function initPersistence() {
  try {
    lastCommitted = localStorage.getItem(STORAGE_KEY)
  } catch {
    lastCommitted = null
  }
}

export function storageKey() {
  return STORAGE_KEY
}

export function setSimulatePersistFailure(value: boolean) {
  simulateFailure = value
}

export function isSimulatingPersistFailure() {
  return simulateFailure
}

export function persistState(raw: string) {
  if (simulateFailure) throw new Error('存储写入失败（模拟）')
  localStorage.setItem(STORAGE_KEY, raw)
  lastCommitted = raw
}

export function getLastCommitted() {
  return lastCommitted
}

export function onPersistFailure(listener: (message: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitPersistFailure(message: string) {
  listeners.forEach((listener) => listener(message))
}
