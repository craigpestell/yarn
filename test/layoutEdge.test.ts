import { describe, expect, it } from 'vitest'
import { autoOrganize, autoOrganizeDetailed } from '../layout/autoOrganize'
import { overlaps, score } from '../layout/score'
import type { Doc } from '../shared/schema'
import { anyOverlap, boxesOf, crossings, edge, linksOf, note } from './helpers'

const doc = (widgets: ReturnType<typeof note>[], edges: ReturnType<typeof edge>[]): Doc => ({ version: 1, widgets, edges })

describe('autoOrganize on a synthetic doc', () => {
  const crossing = doc(
    [note('a', 0, 0), note('b', 600, 0), note('c', 0, 600), note('d', 600, 600)],
    [edge('e1', 'a', 'd'), edge('e2', 'b', 'c')],
  )
  it('removes the crossing and keeps rotation', async () => {
    expect(crossings(crossing)).toBe(1)
    const out = await autoOrganize(crossing, { seed: 1 })
    expect(crossings(out)).toBe(0)
    expect(out.widgets.every((w) => w.rotation === 3)).toBe(true)
    expect(anyOverlap(out)).toBe(false)
  })
  it('handles empty docs', async () => {
    expect(await autoOrganize({ version: 1, widgets: [], edges: [] }, { seed: 1 })).toEqual({ version: 1, widgets: [], edges: [] })
  })
  it('does not mutate its input', async () => {
    const copy = structuredClone(crossing)
    await autoOrganize(crossing, { seed: 1 })
    expect(crossing).toEqual(copy)
  })
})

describe('autoOrganize edge cases', () => {
  it('handles a single widget', async () => {
    const out = await autoOrganize(doc([note('a', 500, 500)], []), { seed: 1 })
    expect(out.widgets).toHaveLength(1)
    expect(anyOverlap(out)).toBe(false)
  })
  it('handles docs with no edges and spreads overlapping widgets apart', async () => {
    const out = await autoOrganize(doc([note('a', 0, 0), note('b', 10, 10), note('c', 20, 20)], []), { seed: 1 })
    expect(anyOverlap(out)).toBe(false)
  })
  it('handles disconnected components', async () => {
    const d = doc(
      [note('a', 0, 0), note('b', 300, 0), note('c', 0, 300), note('d', 300, 300), note('e', 900, 900)],
      [edge('e1', 'a', 'b'), edge('e2', 'c', 'd')],
    )
    const out = await autoOrganize(d, { seed: 5 })
    expect(anyOverlap(out)).toBe(false)
    expect(out.widgets).toHaveLength(5)
  })
  it('leaves an all-locked doc unchanged', async () => {
    const d = doc([note('a', 0, 0, { locked: true }), note('b', 400, 0, { locked: true })], [edge('e1', 'a', 'b')])
    const { doc: out, meta } = await autoOrganizeDetailed(d, { seed: 1 })
    expect(out).toEqual(d)
    expect(meta.lockedOverlaps).toEqual([])
  })
  it('copies locked widgets rather than returning them by reference', async () => {
    const d = doc([note('a', 0, 0, { locked: true }), note('b', 400, 0)], [edge('e1', 'a', 'b')])
    const out = await autoOrganize(d, { seed: 1 })
    expect(out.widgets[0]).not.toBe(d.widgets[0])
    expect(out.widgets[0]).toEqual(d.widgets[0])
  })
  it('keeps movable widgets off locked ones, including a locked widget sitting on the seed position', async () => {
    const d = doc(
      [note('L', 0, 0, { locked: true, w: 1000, h: 1000 }), note('a', 0, 0), note('b', 50, 50), note('c', 90, 90)],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    )
    const out = await autoOrganize(d, { seed: 2 })
    expect(anyOverlap(out)).toBe(false)
    expect(out.widgets[0]).toEqual(d.widgets[0])
  })
  it('finds a free spot far beyond the ring search when locked widgets are huge', async () => {
    const d = doc(
      [note('L', 0, 0, { locked: true, w: 4000, h: 4000 }), note('a', 100, 100), note('b', 100, 100)],
      [edge('e1', 'a', 'b')],
    )
    const out = await autoOrganize(d, { seed: 2, gridSize: 20 })
    expect(anyOverlap(out)).toBe(false)
  })
  it('reports locked widgets that overlap each other', async () => {
    const d = doc([note('a', 0, 0, { locked: true }), note('b', 50, 50, { locked: true }), note('c', 600, 600)], [edge('e1', 'a', 'c')])
    const { doc: out, meta } = await autoOrganizeDetailed(d, { seed: 1 })
    expect(meta.lockedOverlaps).toEqual([['a', 'b']])
    // locked boxes are untouched; the movable one still avoids both
    const boxes = boxesOf(out)
    expect([boxes.get('a')?.x, boxes.get('a')?.y, boxes.get('b')?.x, boxes.get('b')?.y]).toEqual([0, 0, 50, 50])
    const c = boxes.get('c')!
    expect(overlaps(c, boxes.get('a')!)).toBe(false)
    expect(overlaps(c, boxes.get('b')!)).toBe(false)
  })
  it('throws a clear ZodError on dangling edges', async () => {
    await expect(autoOrganize(doc([note('a', 0, 0)], [edge('e1', 'a', 'zzz')]), { seed: 1 })).rejects.toThrow(/dangling target zzz/)
  })
  it('validates gridSize and iterations', async () => {
    const d = doc([note('a', 0, 0)], [])
    for (const gridSize of [0, -20, 2.5, Number.NaN]) {
      await expect(autoOrganize(d, { seed: 1, gridSize })).rejects.toThrow(RangeError)
    }
    for (const iterations of [-1, 1.5, Number.NaN]) {
      await expect(autoOrganize(d, { seed: 1, iterations })).rejects.toThrow(RangeError)
    }
    await expect(autoOrganize(d, { seed: 1, iterations: 0 })).resolves.toBeDefined()
  })
})

describe('autoOrganize never makes a clean layout worse', () => {
  // tight, crossing-free, overlap-free row: ELK's wider spacing would score worse
  const tight = doc(
    [note('a', 0, 0), note('b', 220, 0), note('c', 440, 0)],
    [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
  )
  it('returns the input positions when the optimizer cannot beat them', async () => {
    const { doc: out, meta } = await autoOrganizeDetailed(tight, { seed: 1, iterations: 0 })
    expect(meta.keptInput).toBe(true)
    expect(out).toEqual(tight)
    expect(meta.scoreAfter).toBe(meta.scoreBefore)
  })
  it('with annealing, score is never above the input score', async () => {
    for (const seed of [1, 2, 3, 42]) {
      const out = await autoOrganize(tight, { seed })
      expect(score(boxesOf(out), linksOf(out))).toBeLessThanOrEqual(score(boxesOf(tight), linksOf(tight)))
    }
  })
})
