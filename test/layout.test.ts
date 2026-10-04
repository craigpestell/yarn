import { beforeAll, describe, expect, it } from 'vitest'
import { autoOrganize } from '../layout/autoOrganize'
import { convertV1 } from '../migrate/convertV1'
import { DocSchema, type Doc } from '../shared/schema'
import { NOW, anyOverlap, crossings, hasFixture, loadFixture } from './helpers'
import { stretchedLadder, syntheticV1Board } from './fixtures/synthetic'

const counts = (doc: Doc) => {
  const n = (t: string) => doc.widgets.filter((w) => w.type === t).length
  return [n('photo'), n('note'), n('wanted'), n('paper'), doc.edges.length]
}

/** AC 17-18, run against a doc source: the committed synthetic board always, the private fixture when present. */
function layoutSuite(getDoc: () => Doc) {
  let doc: Doc
  let before: number
  beforeAll(() => {
    doc = getDoc()
    before = crossings(doc)
  })

  it('is deterministic for the same input and seed', async () => {
    expect(await autoOrganize(doc, { seed: 42 })).toEqual(await autoOrganize(doc, { seed: 42 }))
  })
  it('starts with crossings, ends with strictly fewer, and has no overlaps', async () => {
    expect(before).toBeGreaterThan(0)
    const out = await autoOrganize(doc, { seed: 42 })
    expect(crossings(out)).toBeLessThanOrEqual(before)
    expect(crossings(out)).toBeLessThan(before)
    expect(anyOverlap(out)).toBe(false)
    expect(DocSchema.safeParse(out).success).toBe(true)
  })
  it('preserves rotation and everything but x/y', async () => {
    const out = await autoOrganize(doc, { seed: 7 })
    out.widgets.forEach((w, i) => {
      const o = doc.widgets[i]!
      expect({ ...w, x: 0, y: 0 }).toEqual({ ...o, x: 0, y: 0 })
    })
  })
  it('keeps locked widgets unmoved', async () => {
    const locked: Doc = { ...doc, widgets: doc.widgets.map((w, i) => (i % 4 === 0 ? { ...w, locked: true } : w)) }
    const out = await autoOrganize(locked, { seed: 3 })
    expect(locked.widgets.filter((w) => w.locked).length).toBeGreaterThan(0)
    locked.widgets.forEach((w, i) => {
      if (w.locked) expect([out.widgets[i]!.x, out.widgets[i]!.y]).toEqual([w.x, w.y])
    })
    expect(anyOverlap(out)).toBe(false)
  })
}

describe('convertV1 on the synthetic fixture', () => {
  const doc = convertV1(syntheticV1Board(), { now: NOW })
  it('is schema-valid with the expected shape', () => {
    expect(DocSchema.safeParse(doc).success).toBe(true)
    expect(counts(doc)).toEqual([8, 5, 2, 3, 16])
  })
  it('maps photo url to sources and imageUrl to image', () => {
    const p = doc.widgets.find((w) => w.id === 'photo-1')
    expect(p?.type).toBe('photo')
    if (p?.type !== 'photo') return
    expect(p.sources[0]?.url).toBe('https://example.com/source/1')
    expect(p.sources[0]?.retrievedAt).toBe('2025-01-02T03:04:05.000Z')
    expect(p.data.image).toBe('https://example.com/images/1.png')
  })
})

describe('autoOrganize on the synthetic fixture (AC 17-18)', () => {
  layoutSuite(() => convertV1(syntheticV1Board(), { now: NOW }))
})

describe('autoOrganize never increases crossings', () => {
  it('holds on a large stretched board where edge length could outweigh crossings', async () => {
    const doc = convertV1(stretchedLadder(), { now: NOW })
    expect(doc.widgets).toHaveLength(48)
    expect(crossings(doc)).toBe(0)
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = await autoOrganize(doc, { seed })
      expect(crossings(out)).toBe(0)
      expect(anyOverlap(out)).toBe(false)
    }
  })
})

describe.skipIf(!hasFixture)('private fixture (extra, skipped when absent)', () => {
  it('converts to a schema-valid doc of the expected shape', () => {
    const doc = convertV1(loadFixture(), { now: NOW })
    expect(DocSchema.safeParse(doc).success).toBe(true)
    expect(counts(doc)).toEqual([8, 5, 2, 3, 16])
  })
  describe('autoOrganize', () => {
    layoutSuite(() => convertV1(loadFixture(), { now: NOW }))
  })
})
