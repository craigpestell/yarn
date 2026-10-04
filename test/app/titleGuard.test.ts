import { describe, expect, it } from 'vitest'
import type { Doc } from '../../shared/schema'
import { editorTitle, guardTitle } from '../../src/boards/titleGuard'

type S = { title: string; doc: Doc }
const empty = (): Doc => ({ version: 1, widgets: [], edges: [] })

function store(title: string) {
  let state: S = { title, doc: empty() }
  const subs = new Set<(s: S, p: S) => void>()
  const set = (patch: Partial<S>) => {
    const prev = state
    state = { ...state, ...patch }
    subs.forEach((f) => f(state, prev))
  }
  return { getState: () => state, subscribe: (f: (s: S, p: S) => void) => (subs.add(f), () => subs.delete(f)), set }
}

const LONG = 'L'.repeat(120)

describe('guardTitle', () => {
  it('sends no title when a 120-char stored title is only truncated for display and the doc is edited', () => {
    const s = store(editorTitle(LONG))
    const g = guardTitle(s, LONG)
    const seen: (string | null)[] = []
    g.subscribe((cur) => seen.push(cur.title))
    s.set({ doc: { ...empty() } })
    expect(editorTitle(LONG)).toHaveLength(50)
    expect(seen).toEqual([null])
    expect(g.getState().title).toBeNull()
  })
  it('sends the title once the user changes it, and keeps sending it', () => {
    const s = store(editorTitle(LONG))
    const g = guardTitle(s, LONG)
    const seen: { cur: string | null; prev: string | null }[] = []
    g.subscribe((cur, prev) => seen.push({ cur: cur.title, prev: prev.title }))
    s.set({ title: 'Renamed' })
    expect(seen[0]).toEqual({ cur: 'Renamed', prev: null }) // a change the autosave will notice
    s.set({ title: editorTitle(LONG) }) // back to the truncated form: still the user's explicit choice
    expect(g.getState().title).toBe(editorTitle(LONG))
  })
})
