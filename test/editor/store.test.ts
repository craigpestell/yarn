import { beforeEach, describe, expect, it } from 'vitest'
import { DocSchema } from '../../shared/schema'
import { SAMPLE_DOC, SAMPLE_TITLE } from '../../src/editor/sample'
import { isDialogOpen, useBoard, type Selection } from '../../src/editor/store'

const s = () => useBoard.getState()
beforeEach(() => {
  s().loadBoard(SAMPLE_TITLE, { version: 1, widgets: [], edges: [] })
})
const addTwo = () => {
  s().addWidget('note')
  s().addWidget('photo')
  const [a, b] = s().doc.widgets
  if (!a || !b) throw new Error('setup')
  return [a.id, b.id] as const
}

describe('store actions', () => {
  it('sample doc is valid', () => {
    expect(DocSchema.safeParse(SAMPLE_DOC).success).toBe(true)
  })
  it('adds widgets with type-specific size, rotation range, and selects them', () => {
    s().addWidget('photo', () => 1)
    s().addWidget('note', () => 0)
    const [p, n] = s().doc.widgets
    expect([p?.w, p?.h, p?.rotation]).toEqual([200, 240, 10])
    expect([n?.w, n?.h, n?.rotation]).toEqual([200, 200, -5])
    expect(s().selection).toEqual({ kind: 'widget', id: n?.id })
  })
  it('keeps random rotations in range', () => {
    for (let i = 0; i < 40; i++) s().addWidget(i % 2 ? 'photo' : 'paper')
    for (const w of s().doc.widgets) expect(Math.abs(w.rotation)).toBeLessThanOrEqual(w.type === 'photo' ? 10 : 5)
  })
  it('deleting a widget cascades its edges', () => {
    const [a, b] = addTwo()
    s().activateWidget(a)
    s().toggleConnectMode()
    s().activateWidget(a)
    s().activateWidget(b)
    expect(s().doc.edges).toHaveLength(1)
    s().deleteWidget(a)
    expect(s().doc.edges).toHaveLength(0)
    expect(DocSchema.safeParse(s().doc).success).toBe(true)
  })
  it('connect toggles and dedupes in both directions; rejects self edges', () => {
    const [a, b] = addTwo()
    s().toggleConnectMode()
    s().activateWidget(a)
    s().activateWidget(a) // self: deselects source
    expect(s().doc.edges).toHaveLength(0)
    s().activateWidget(a)
    s().activateWidget(b)
    expect(s().doc.edges).toHaveLength(1)
    s().activateWidget(b)
    s().activateWidget(a) // reverse direction toggles the same edge off
    expect(s().doc.edges).toHaveLength(0)
    s().activateWidget(b)
    s().activateWidget(a)
    s().activateWidget(a)
    s().activateWidget(b)
    expect(s().doc.edges).toHaveLength(0)
  })
  it('escape-style cancel and stage click leave connect mode', () => {
    const [a] = addTwo()
    s().toggleConnectMode()
    s().activateWidget(a)
    s().cancelConnect()
    expect(s().connect).toEqual({ active: false, source: null })
    s().toggleConnectMode()
    s().stageClick()
    expect(s().connect.active).toBe(false)
  })
  it('does not move locked widgets and moves others by delta', () => {
    const [a, b] = addTwo()
    s().patchWidget(a, { locked: true })
    const before = s().doc.widgets.map((w) => [w.x, w.y])
    s().moveBy(a, 10, 10)
    s().moveBy(b, 10, 20)
    const after = s().doc.widgets.map((w) => [w.x, w.y])
    expect(after[0]).toEqual(before[0])
    expect(after[1]).toEqual([(before[1]?.[0] ?? 0) + 10, (before[1]?.[1] ?? 0) + 20])
  })
  it('patches fields through validation and ignores invalid patches', () => {
    const [a] = addTwo()
    s().patchWidget(a, { data: { text: 'hello', color: '#123456' } })
    s().patchWidget(a, { data: { color: 'not-a-color' } })
    const w = s().doc.widgets[0]
    expect(w?.type === 'note' && [w.data.text, w.data.color]).toEqual(['hello', '#123456'])
  })
  it('title: rejects empty and over-long titles', () => {
    expect(s().setTitle('New')).toBe(true)
    expect(s().setTitle('   ')).toBe(false)
    expect(s().setTitle('x'.repeat(51))).toBe(false)
    expect(s().title).toBe('New')
  })
  it('auto-organize keeps ids and edges', async () => {
    s().loadBoard('t', SAMPLE_DOC)
    await s().organize()
    expect(s().error).toBeNull()
    expect(s().doc.widgets.map((w) => w.id)).toEqual(SAMPLE_DOC.widgets.map((w) => w.id))
    expect(s().doc.edges).toEqual(SAMPLE_DOC.edges)
  })
  it('reports (instead of silently ignoring) rejected patches and empty titles', () => {
    const [a] = addTwo()
    s().clearError()
    s().patchWidget(a, { data: { color: 'nope' } })
    expect(s().error).toMatch(/rejected/)
    s().clearError()
    expect(s().setTitle('')).toBe(false)
    expect(s().error).toMatch(/Title/)
  })
  it('reports a failed connect', () => {
    const [a, b] = addTwo()
    const edges = Array.from({ length: 2000 }, (_, i) => ({ id: `x${i}`, source: 'p', target: 'q', color: '#e53e3e' }))
    // Valid doc is not required here: the cap check happens before any pair lookup.
    useBoard.setState((st) => ({ doc: { ...st.doc, edges } }))
    s().toggleConnectMode()
    s().activateWidget(a)
    s().activateWidget(b)
    expect(s().error).toMatch(/limit/)
  })
})

describe('sample board layout', () => {
  it('has no overlapping widgets (60px margin covers cosmetic rotation)', () => {
    const m = 60
    const ws = SAMPLE_DOC.widgets
    for (const [i, a] of ws.entries())
      for (const b of ws.slice(i + 1)) {
        const apart = a.x + a.w + m <= b.x || b.x + b.w + m <= a.x || a.y + a.h + m <= b.y || b.y + b.h + m <= a.y
        expect(apart, `${a.id} vs ${b.id}`).toBe(true)
      }
  })
})

describe('isDialogOpen', () => {
  it('is true only when the selection resolves to an existing widget or yarn', () => {
    s().loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
    const widget = SAMPLE_DOC.widgets[0]
    const edge = SAMPLE_DOC.edges[0]
    if (!widget || !edge) throw new Error('setup')
    const open = (selection: Selection | null) => isDialogOpen({ doc: s().doc, selection })
    expect(open(null)).toBe(false)
    expect(open({ kind: 'widget', id: widget.id })).toBe(true)
    expect(open({ kind: 'edge', id: edge.id })).toBe(true)
    expect(open({ kind: 'widget', id: 'missing' })).toBe(false)
    expect(open({ kind: 'edge', id: 'missing' })).toBe(false)
    expect(open({ kind: 'edge', id: widget.id })).toBe(false)
  })
})
