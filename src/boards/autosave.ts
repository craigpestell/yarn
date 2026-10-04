import type { Doc } from '../../shared/schema'
import type { ReconcileFn, SaveFn, SaveOutcome, SavePayload } from './save'
import { withTimeout } from './withTimeout'

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'offline'; message: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'unauthenticated' }
  | { kind: 'conflict' }

interface State {
  /** null = do not touch the stored title. */
  title: string | null
  doc: Doc
}
interface Source {
  getState: () => State
  subscribe: (fn: (s: State, prev: State) => void) => () => void
}

export interface AutosaveOptions {
  boardId: string
  initialRevision: number
  save: SaveFn
  /** Re-reads the server after a lost response, before a conflict is declared. */
  reconcile?: ReconcileFn
  onStatus: (s: SaveStatus) => void
  /** Called after every successful save with exactly what was saved (e.g. to schedule a thumbnail of that doc). */
  onSaved?: (saved: SavePayload) => void
  delayMs?: number
  /** Retry delays for transport failures; the last value repeats. */
  retryMs?: readonly number[]
  /** Upper bound for stop()'s final flush (a hanging request must not block navigation). */
  stopTimeoutMs?: number
}

export interface Autosave {
  /** Wait for any in-flight save and the queued follow-up. Resolves true when nothing unsaved remains. */
  flush: () => Promise<boolean>
  /** flush(), then detach. */
  stop: () => Promise<void>
}

/**
 * Debounced, single-flight autosave with an optimistic revision.
 * - At most one request is in flight; edits made meanwhile trigger one follow-up save with the new revision.
 * - A conflict stops saving for good (the caller must reload or export); nothing is overwritten.
 * - Transport failures retry with backoff and when the browser comes back online; edits are never dropped.
 * - If a failed attempt may have been applied (lost response), a later "stale" answer is checked against the
 *   server before it is reported as a conflict.
 */
export function startServerAutosave(source: Source, opts: AutosaveOptions): Autosave {
  const delay = opts.delayMs ?? 1500
  const retry = opts.retryMs ?? [2000, 5000, 15000]
  let revision = opts.initialRevision
  let dirty = false
  let inflight: Promise<boolean> | null = null
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  /** Payloads whose response was lost: any of them may have been applied by the server. Newest last. */
  let uncertain: SavePayload[] = []
  /** Set when stop() begins: this instance must no longer touch UI status (a newer instance may own it). */
  let quiet = false
  /** State captured when stop() was requested, so a follow-up save cannot pick up a different board loaded afterwards. */
  let frozen: State | null = null

  const status = (s: SaveStatus) => {
    if (!quiet) opts.onStatus(s)
  }
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const schedule = (ms: number) => {
    clear()
    timer = setTimeout(() => void kick(), ms)
  }

  /** One save attempt. Resolves true on success. */
  async function attempt(): Promise<boolean> {
    dirty = false
    const { title, doc } = frozen ?? source.getState()
    const payload: SavePayload = { id: opts.boardId, expectedRevision: revision, title, doc }
    status({ kind: 'saving' })
    let out: SaveOutcome = await opts.save(payload)
    if (out.kind === 'conflict' && uncertain.length > 0 && opts.reconcile) {
      // The server moved on. Before calling that a conflict, check whether an earlier attempt whose response we
      // lost actually landed (newest first). Reconcile against THOSE payloads, not the rebuilt current state.
      let verdict: SaveOutcome = { kind: 'conflict' }
      for (const lost of [...uncertain].reverse()) {
        const r = await opts.reconcile(lost)
        if (r.kind === 'applied') {
          revision = r.revision
          uncertain = []
          if (lost.doc === payload.doc && lost.title === payload.title) verdict = { kind: 'saved', revision: r.revision }
          else {
            // Our lost write landed, but the user has edited since: send the current state on top of it.
            dirty = true
            if (!stopped) schedule(0)
            return true
          }
          break
        }
        if (r.kind === 'offline') {
          verdict = r
          break
        }
      }
      out = verdict
    }
    if (out.kind === 'saved') {
      revision = out.revision
      failures = 0
      uncertain = []
      opts.onSaved?.(payload)
      if (dirty) {
        if (!stopped) schedule(0)
      } else status({ kind: 'saved' })
      return true
    }
    dirty = true
    if (out.kind === 'conflict') {
      stopped = true
      status({ kind: 'conflict' })
    } else if (out.kind === 'offline') {
      uncertain = [...uncertain, payload].slice(-5)
      status({ kind: 'offline', message: out.message })
      if (!stopped) schedule(retry[Math.min(failures, retry.length - 1)] ?? 5000)
      failures += 1
    } else if (out.kind === 'unauthenticated') {
      status({ kind: 'unauthenticated' })
    } else {
      status({ kind: 'rejected', message: out.message })
    }
    return false
  }

  /** Start a save if none is running and there is something to save. */
  function kick(): Promise<boolean> | null {
    clear()
    if (stopped || inflight || !dirty) return inflight
    const p = attempt().finally(() => {
      inflight = null
    })
    inflight = p
    return p
  }

  const unsub = source.subscribe((s, prev) => {
    if (stopped || frozen || (s.doc === prev.doc && s.title === prev.title)) return
    dirty = true
    status({ kind: 'dirty' })
    if (!inflight) schedule(delay)
  })
  const onOnline = () => {
    if (dirty && !inflight && !stopped) schedule(0)
  }
  const onHide = () => void flush()
  globalThis.addEventListener?.('online', onOnline)
  globalThis.addEventListener?.('pagehide', onHide)

  async function flush(): Promise<boolean> {
    for (;;) {
      if (inflight) {
        const ok = await inflight
        if (!ok) return false
      }
      if (!dirty) return true
      if (stopped) return false // conflict: nothing more may be written
      const p = kick()
      if (!p) return !dirty
      if (!(await p)) return false
    }
  }

  return {
    flush,
    stop: async () => {
      frozen = source.getState()
      quiet = true
      await withTimeout(flush(), opts.stopTimeoutMs ?? 8000, false)
      stopped = true
      clear()
      unsub()
      globalThis.removeEventListener?.('online', onOnline)
      globalThis.removeEventListener?.('pagehide', onHide)
    },
  }
}
