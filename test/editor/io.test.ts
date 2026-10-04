import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBoard, parseBoard } from '../../src/editor/boardIO'
import { loadSaved, saveBoard, startAutosave, STORAGE_KEY } from '../../src/editor/persist'
import { SAMPLE_DOC, SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'

const s = () => useBoard.getState()
beforeEach(() => {
  s().loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
})

describe('import / export', () => {
  it('round-trips through the store', () => {
    s().addWidget('wanted')
    const json = s().exportJson()
    const { doc, title } = s()
    s().loadBoard('Other', { version: 1, widgets: [], edges: [] })
    expect(s().importJson(json)).toBe(true)
    expect(s().doc).toEqual(doc)
    expect(s().title).toBe(title)
  })
  it('accepts a bare Doc', () => {
    const r = parseBoard(JSON.stringify(SAMPLE_DOC))
    expect(r.ok && r.title).toBeNull()
  })
  const bad: [string, string][] = [
    ['not json', '{nope'],
    ['wrong shape', '{"hello":1}'],
    ['array', '[]'],
    ['dangling edge', JSON.stringify({ version: 1, widgets: [], edges: [{ id: 'e', source: 'a', target: 'b' }] })],
    ['dangling in envelope', JSON.stringify({ title: 'x', doc: { version: 1, widgets: [], edges: [{ id: 'e', source: 'a', target: 'b' }] } })],
    ['bad widget', JSON.stringify({ version: 1, widgets: [{ id: 'a', type: 'photo' }], edges: [] })],
    ['javascript url', exportBoard('t', { ...SAMPLE_DOC, widgets: [{ ...SAMPLE_DOC.widgets[0]!, sources: [{ url: 'javascript:alert(1)', retrievedAt: '2026-01-01T00:00:00Z' }] }] })],
  ]
  it.each(bad)('rejects %s with an error and no state change', (_n, text) => {
    const before = { doc: s().doc, title: s().title }
    expect(s().importJson(text)).toBe(false)
    expect(s().error).toBeTruthy()
    expect(s().doc).toBe(before.doc)
    expect(s().title).toBe(before.title)
  })
})

describe('persistence', () => {
  const fake = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  it('round-trips and rejects corrupt saved data', () => {
    const st = fake()
    expect(saveBoard('Hi', SAMPLE_DOC, st)).toBe(true)
    expect(loadSaved(st)).toEqual({ kind: 'ok', title: 'Hi', doc: SAMPLE_DOC })
    expect(loadSaved(fake())).toEqual({ kind: 'none' })
  })
  it('keeps an unloadable blob in a backup key instead of discarding it', () => {
    const st = fake()
    st.setItem(STORAGE_KEY, '{"bad":true}')
    const r = loadSaved(st)
    expect(r.kind).toBe('corrupt')
    expect(r.kind === 'corrupt' && r.backupKey && st.getItem(r.backupKey)).toBe('{"bad":true}')
    expect(st.getItem(STORAGE_KEY)).toBe('{"bad":true}')
  })
  it('autosave reports a failed save once and recovers', () => {
    vi.useFakeTimers()
    let fail = true
    const st = { getItem: () => null, setItem: () => { if (fail) throw new Error('quota') } }
    const errors: string[] = []
    const stop = startAutosave(useBoard, st, (t) => errors.push(t))
    s().setTitle('A')
    vi.advanceTimersByTime(400)
    s().setTitle('B')
    vi.advanceTimersByTime(400)
    expect(errors).toHaveLength(1)
    fail = false
    s().setTitle('C')
    vi.advanceTimersByTime(400)
    stop()
    vi.useRealTimers()
    expect(errors).toHaveLength(1)
  })
  it('refuses to add past the widget cap with a visible error', () => {
    s().loadBoard('t', { version: 1, widgets: [], edges: [] })
    for (let i = 0; i < 500; i++) s().addWidget('note')
    expect(s().doc.widgets).toHaveLength(500)
    s().addWidget('note')
    expect(s().doc.widgets).toHaveLength(500)
    expect(s().error).toMatch(/full/)
    expect(parseBoard(s().exportJson()).ok).toBe(true)
  })
  it('never throws when storage fails', () => {
    const boom = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('quota') } }
    expect(saveBoard('t', SAMPLE_DOC, boom)).toBe(false)
    expect(loadSaved(boom)).toEqual({ kind: 'none' })
  })
})
