import { parseBoard, exportBoard } from './boardIO'
import { makeId } from './docOps'
import type { Doc } from '../../shared/schema'

export const STORAGE_KEY = 'yarns-v2:board'
export const SAVE_DELAY_MS = 300

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): Store | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; title: string; doc: Doc }
  /** A blob exists but is unloadable. `backupKey` is where it was preserved (null if the backup failed). */
  | { kind: 'corrupt'; backupKey: string | null }

/** Load and validate the autosaved board. An unloadable blob is copied to a backup key, never discarded. */
export function loadSaved(storage: Store | null = defaultStorage()): LoadResult {
  let text: string | null | undefined
  try {
    text = storage?.getItem(STORAGE_KEY)
  } catch {
    return { kind: 'none' }
  }
  if (!text) return { kind: 'none' }
  const r = parseBoard(text)
  if (r.ok && r.title !== null) return { kind: 'ok', title: r.title, doc: r.doc }
  const backupKey = `${STORAGE_KEY}:backup:${makeId()}`
  try {
    storage?.setItem(backupKey, text)
    return { kind: 'corrupt', backupKey }
  } catch {
    return { kind: 'corrupt', backupKey: null }
  }
}

export function saveBoard(title: string, doc: Doc, storage: Store | null = defaultStorage()): boolean {
  try {
    storage?.setItem(STORAGE_KEY, exportBoard(title, doc))
    return storage !== null
  } catch {
    return false // quota exceeded, private mode, etc.
  }
}

interface Subscribable {
  getState: () => { title: string; doc: Doc }
  subscribe: (fn: (s: { title: string; doc: Doc }, prev: { title: string; doc: Doc }) => void) => () => void
}

/** Debounced autosave of title + doc. Returns a stop function that flushes pending work. */
export function startAutosave(
  store: Subscribable,
  storage: Store | null = defaultStorage(),
  onError: (text: string) => void = () => {},
): () => void {
  let failing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    const { title, doc } = store.getState()
    const ok = saveBoard(title, doc, storage)
    if (!ok && !failing) onError('Changes could not be saved in this browser (storage is full or unavailable). Export JSON to keep a copy.')
    failing = !ok
  }
  const unsub = store.subscribe((s, prev) => {
    if (s.doc === prev.doc && s.title === prev.title) return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  })
  globalThis.addEventListener?.('pagehide', flush)
  return () => {
    flush()
    unsub()
    globalThis.removeEventListener?.('pagehide', flush)
  }
}
