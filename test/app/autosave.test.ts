import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Doc } from '../../shared/schema'
import { startServerAutosave, type SaveStatus } from '../../src/boards/autosave'
import type { ReconcileFn, SaveFn, SaveOutcome, SavePayload } from '../../src/boards/save'

type S = { title: string | null; doc: Doc }
const doc = (): Doc => ({ version: 1, widgets: [], edges: [] })

function fakeStore() {
  let state: S = { title: 'T', doc: doc() }
  const subs = new Set<(s: S, p: S) => void>()
  return {
    getState: () => state,
    subscribe: (fn: (s: S, p: S) => void) => (subs.add(fn), () => subs.delete(fn)),
    edit: (title: string) => {
      const prev = state
      state = { title, doc: { ...state.doc } }
      subs.forEach((f) => f(state, prev))
    },
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(outcomes: (p: SavePayload, call: number) => Promise<SaveOutcome> | SaveOutcome, reconcile?: ReconcileFn, extra: { onSaved?: (p: SavePayload) => void; stopTimeoutMs?: number } = {}) {
  const store = fakeStore()
  const calls: SavePayload[] = []
  const statuses: SaveStatus[] = []
  const save: SaveFn = async (p) => {
    calls.push(p)
    return outcomes(p, calls.length)
  }
  const a = startServerAutosave(store, { boardId: 'b', initialRevision: 5, save, reconcile, ...extra, onStatus: (s) => statuses.push(s), delayMs: 100, retryMs: [1000, 2000] })
  return { store, calls, statuses, a }
}

describe('startServerAutosave', () => {
  it('debounces many edits into one save with the expected revision', async () => {
    const { store, calls } = setup((p) => ({ kind: 'saved', revision: p.expectedRevision + 1 }))
    store.edit('a')
    store.edit('b')
    store.edit('c')
    await vi.advanceTimersByTimeAsync(99)
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: 'b', expectedRevision: 5, title: 'c' })
  })

  it('never double-saves: edits during a request produce one follow-up with the new revision', async () => {
    let release: (o: SaveOutcome) => void = () => {}
    const { store, calls } = setup((p, n) =>
      n === 1 ? new Promise<SaveOutcome>((r) => (release = r)) : { kind: 'saved', revision: p.expectedRevision + 1 },
    )
    store.edit('one')
    await vi.advanceTimersByTimeAsync(101)
    expect(calls).toHaveLength(1)
    store.edit('two')
    store.edit('three')
    await vi.advanceTimersByTimeAsync(500)
    expect(calls).toHaveLength(1) // still in flight: no concurrent save
    release({ kind: 'saved', revision: 6 })
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ expectedRevision: 6, title: 'three' })
  })

  it('does not save when nothing changed and reports saved after success', async () => {
    const { calls, statuses, store } = setup((p) => ({ kind: 'saved', revision: p.expectedRevision + 1 }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(0)
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    expect(statuses.at(-1)).toEqual({ kind: 'saved' })
  })

  it('stops on a stale revision: surfaces a conflict and never retries or overwrites', async () => {
    const { store, calls, statuses } = setup(() => ({ kind: 'conflict' }))
    store.edit('mine')
    await vi.advanceTimersByTimeAsync(101)
    expect(statuses.at(-1)).toEqual({ kind: 'conflict' })
    store.edit('more')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(1)
  })

  it('retries with backoff while offline and keeps the edit', async () => {
    const { store, calls, statuses } = setup((p, n) => (n < 3 ? { kind: 'offline', message: 'down' } : { kind: 'saved', revision: p.expectedRevision + 1 }))
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    expect(statuses.at(-1)).toMatchObject({ kind: 'offline' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(calls).toHaveLength(3)
    expect(calls.every((c) => c.expectedRevision === 5 && c.title === 'x')).toBe(true)
    expect(statuses.at(-1)).toEqual({ kind: 'saved' })
  })

  it('retries immediately when the browser comes back online', async () => {
    const { store, calls } = setup((_p, n) => (n === 1 ? { kind: 'offline', message: 'down' } : { kind: 'saved', revision: 6 }))
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(2)
  })

  it('does not auto-retry a rejected save, but saves again on the next edit', async () => {
    const { store, calls, statuses } = setup((p, n) => (n === 1 ? { kind: 'rejected', message: 'too big' } : { kind: 'saved', revision: p.expectedRevision + 1 }))
    store.edit('x')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)
    expect(statuses.at(-1)).toMatchObject({ kind: 'rejected' })
    store.edit('y')
    await vi.advanceTimersByTimeAsync(101)
    expect(calls).toHaveLength(2)
  })

  it('flushes pending changes on stop', async () => {
    const { store, calls, a } = setup((p) => ({ kind: 'saved', revision: p.expectedRevision + 1 }))
    store.edit('x')
    await a.stop()
    expect(calls).toHaveLength(1)
    store.edit('after stop')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)
  })

  it('stop() waits for an in-flight save, then runs the queued follow-up with the new revision', async () => {
    let release: (o: SaveOutcome) => void = () => {}
    const { store, calls, a } = setup((p, n) =>
      n === 1 ? new Promise<SaveOutcome>((r) => (release = r)) : { kind: 'saved', revision: p.expectedRevision + 1 },
    )
    store.edit('one')
    await vi.advanceTimersByTimeAsync(101)
    store.edit('two') // edited while the first save is in flight
    let done = false
    const stopping = a.stop().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(10)
    expect(done).toBe(false)
    expect(calls).toHaveLength(1)
    release({ kind: 'saved', revision: 6 })
    await stopping
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ expectedRevision: 6, title: 'two' })
  })

  it('flush() resolves false when edits could not be saved (offline) and true when clean', async () => {
    const { store, a } = setup((_p, n) => (n === 1 ? { kind: 'offline', message: 'down' } : { kind: 'saved', revision: 6 }))
    expect(await a.flush()).toBe(true)
    store.edit('x')
    expect(await a.flush()).toBe(false)
  })

  it('reports a missing session as unauthenticated, keeps edits, and does not retry on a timer', async () => {
    const { store, calls, statuses } = setup(() => ({ kind: 'unauthenticated' }))
    store.edit('x')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(statuses.at(-1)).toEqual({ kind: 'unauthenticated' })
    expect(calls).toHaveLength(1)
  })

  it('after a lost response, a stale answer is reconciled: our own write is treated as saved', async () => {
    const reconcile = vi.fn(async () => ({ kind: 'applied' as const, revision: 6 }))
    const { store, calls, statuses } = setup((_p, n) => (n === 1 ? { kind: 'offline', message: 'lost' } : { kind: 'conflict' }), reconcile)
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(2)
    expect(reconcile).toHaveBeenCalledTimes(1)
    expect(statuses.at(-1)).toEqual({ kind: 'saved' })
    store.edit('y')
    await vi.advanceTimersByTimeAsync(101)
    expect(calls[2]).toMatchObject({ expectedRevision: 6 })
  })

  it('after a lost response, a genuinely different server state is still a conflict', async () => {
    const reconcile = vi.fn(async () => ({ kind: 'conflict' as const }))
    const { store, statuses } = setup((_p, n) => (n === 1 ? { kind: 'offline', message: 'lost' } : { kind: 'conflict' }), reconcile)
    store.edit('x')
    await vi.advanceTimersByTimeAsync(1200)
    expect(statuses.at(-1)).toEqual({ kind: 'conflict' })
  })

  it('does not consult reconcile for a plain stale save (no lost response)', async () => {
    const reconcile = vi.fn(async () => ({ kind: 'applied' as const, revision: 9 }))
    const { store, statuses } = setup(() => ({ kind: 'conflict' }), reconcile)
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    expect(reconcile).not.toHaveBeenCalled()
    expect(statuses.at(-1)).toEqual({ kind: 'conflict' })
  })

  it('a follow-up save during stop uses the state captured at stop, not a board loaded afterwards', async () => {
    let release: (o: SaveOutcome) => void = () => {}
    const { store, calls, a } = setup((p, n) =>
      n === 1 ? new Promise<SaveOutcome>((r) => (release = r)) : { kind: 'saved', revision: p.expectedRevision + 1 },
    )
    store.edit('first')
    await vi.advanceTimersByTimeAsync(101)
    store.edit('second')
    const stopping = a.stop()
    store.edit('belongs to another board')
    release({ kind: 'saved', revision: 6 })
    await stopping
    expect(calls[1]).toMatchObject({ title: 'second' })
  })

  it('reconciles against the lost payload (D1), not the current state (D2), then re-sends D2 on the new revision', async () => {
    const reconcile = vi.fn<ReconcileFn>(async (p) => (p.title === 'D1' ? { kind: 'applied', revision: 6 } : { kind: 'conflict' }))
    const { store, calls, statuses } = setup((p, n) => {
      if (n === 1) return { kind: 'offline', message: 'response lost (D1 actually landed)' }
      if (n === 2) return { kind: 'conflict' } // D2 on revision 5 is stale because D1 made it 6
      return { kind: 'saved', revision: p.expectedRevision + 1 }
    }, reconcile)
    store.edit('D1')
    await vi.advanceTimersByTimeAsync(101)
    store.edit('D2')
    await vi.advanceTimersByTimeAsync(2000)
    expect(reconcile.mock.calls.map((c) => c[0].title)).toEqual(['D1'])
    expect(calls.map((c) => [c.title, c.expectedRevision])).toEqual([['D1', 5], ['D2', 5], ['D2', 6]])
    expect(statuses.at(-1)).toEqual({ kind: 'saved' })
  })

  it('calls onSaved with exactly the payload that was saved', async () => {
    const onSaved = vi.fn()
    const { store } = setup((p) => ({ kind: 'saved', revision: p.expectedRevision + 1 }), undefined, { onSaved })
    store.edit('A')
    await vi.advanceTimersByTimeAsync(101)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ title: 'A', id: 'b', expectedRevision: 5 })
  })

  it('stop() gives up on a hanging save after the timeout instead of blocking forever', async () => {
    const { store, a } = setup(() => new Promise<SaveOutcome>(() => {}), undefined, { stopTimeoutMs: 500 })
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    let done = false
    void a.stop().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(done).toBe(true)
  })

  it('an instance that is stopping never reports status again (a newer instance owns the UI)', async () => {
    let release: (o: SaveOutcome) => void = () => {}
    const { store, statuses, a } = setup((_p, n) => (n === 1 ? new Promise<SaveOutcome>((r) => (release = r)) : { kind: 'saved', revision: 7 }))
    store.edit('x')
    await vi.advanceTimersByTimeAsync(101)
    const stopping = a.stop()
    const before = statuses.length
    release({ kind: 'saved', revision: 6 })
    await stopping
    store.edit('late')
    await vi.advanceTimersByTimeAsync(5000)
    expect(statuses.length).toBe(before)
  })
})
