import { beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '../../shared/schema'
import { RESIZE_RULES, isResizable, localDelta, resizedSize } from '../../src/editor/geometry'
import { SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'

const s = () => useBoard.getState()
beforeEach(() => {
  s().loadBoard(SAMPLE_TITLE, { version: 1, widgets: [], edges: [] })
})
const add = (type: 'photo' | 'paper' | 'note') => {
  s().addWidget(type)
  const w = s().doc.widgets.at(-1)
  if (!w) throw new Error('setup')
  return w.id
}
const size = (id: string) => {
  const w = s().doc.widgets.find((x) => x.id === id)
  return [w?.w, w?.h]
}

describe('localDelta', () => {
  it('divides by zoom and is the identity when unrotated', () => {
    expect(localDelta(40, 20, 0, 2)).toEqual({ dx: 20, dy: 10 })
  })
  it('projects onto rotated axes', () => {
    const { dx, dy } = localDelta(10, 0, 90, 1)
    expect(dx).toBeCloseTo(0)
    expect(dy).toBeCloseTo(-10)
  })
})

describe('resizedSize', () => {
  const start = { w: 200, h: 240 }
  it('keeps aspect ratio for photos and follows the larger axis', () => {
    expect(resizedSize(start, 100, 0, RESIZE_RULES.photo, 5000)).toEqual({ w: 300, h: 360 })
    expect(resizedSize(start, 0, 240, RESIZE_RULES.photo, 5000)).toEqual({ w: 400, h: 480 })
  })
  it('never goes below the minimum, in either dimension', () => {
    const r = resizedSize(start, -500, -500, RESIZE_RULES.photo, 5000)
    expect(r.w).toBeGreaterThanOrEqual(RESIZE_RULES.photo.minW)
    expect(r.h).toBeGreaterThanOrEqual(RESIZE_RULES.photo.minH)
  })
  it('resizes paper freely and clamps to min and max', () => {
    expect(resizedSize({ w: 250, h: 300 }, 50, -100, RESIZE_RULES.paper, 5000)).toEqual({ w: 300, h: 200 })
    expect(resizedSize({ w: 250, h: 300 }, -999, -999, RESIZE_RULES.paper, 5000)).toEqual({ w: 140, h: 140 })
    expect(resizedSize({ w: 250, h: 300 }, 99999, 99999, RESIZE_RULES.paper, 5000)).toEqual({ w: 5000, h: 5000 })
  })
  it('stays inside the max for photos too', () => {
    const r = resizedSize(start, 99999, 99999, RESIZE_RULES.photo, 5000)
    expect(r.w).toBeLessThanOrEqual(5000)
    expect(r.h).toBeLessThanOrEqual(5000)
  })
})

describe('resizeTo', () => {
  it('only photos and papers are resizable', () => {
    expect([isResizable('photo'), isResizable('paper'), isResizable('note'), isResizable('wanted')]).toEqual([true, true, false, false])
  })
  it('sets a clamped integer size', () => {
    const id = add('paper')
    s().resizeTo(id, 301.4, 1)
    expect(size(id)).toEqual([301, RESIZE_RULES.paper.minH])
    s().resizeTo(id, 99999, 99999)
    expect(size(id)).toEqual([LIMITS.maxSize, LIMITS.maxSize])
  })
  it('ignores NaN, locked and non-resizable widgets', () => {
    const paper = add('paper')
    s().resizeTo(paper, Number.NaN, 200)
    expect(size(paper)).toEqual([250, 300])
    s().patchWidget(paper, { locked: true })
    s().resizeTo(paper, 400, 400)
    expect(size(paper)).toEqual([250, 300])
    const note = add('note')
    s().resizeTo(note, 400, 400)
    expect(size(note)).toEqual([200, 200])
  })
  it('keeps the doc identity when nothing changes', () => {
    const id = add('photo')
    const before = s().doc
    s().resizeTo(id, 200, 240)
    expect(s().doc).toBe(before)
  })
})
