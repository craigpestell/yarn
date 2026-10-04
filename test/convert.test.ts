import { describe, expect, it } from 'vitest'
import { convertV1, convertV1Detailed } from '../migrate/convertV1'
import { DocSchema } from '../shared/schema'
import { NOW } from './helpers'

const photo = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: 'T', x: 0, y: 0, ...extra })
const board = (extra: Record<string, unknown>) => ({ photos: [], ...extra })

describe('convertV1 (synthetic)', () => {
  it('drops invalid connections and reports them, keeping the Doc schema-valid', () => {
    const con = (id: string, fromItemId: string, toItemId: string) => ({ id, fromItemId, toItemId })
    const { doc, dropped } = convertV1Detailed(
      board({
        photos: [photo('a'), photo('b'), photo('c')],
        connections: [
          con('ok', 'a', 'b'),
          con('dangling', 'a', 'zz'),
          con('self', 'c', 'c'),
          con('dup', 'b', 'a'),
          con('', 'a', 'c'),
          con('a', 'a', 'c'), // collides with a widget id
          con('ok', 'b', 'c'), // collides with an earlier edge id
          con('ok2', 'b', 'c'),
        ],
      }),
      { now: NOW },
    )
    expect(doc.edges.map((e) => e.id)).toEqual(['ok', 'ok2'])
    expect(dropped.map((d) => [d.id, d.reason])).toEqual([
      ['dangling', 'dangling'], ['self', 'self'], ['dup', 'duplicate'], ['', 'bad-id'], ['a', 'bad-id'], ['ok', 'bad-id'],
    ])
    expect(DocSchema.safeParse(doc).success).toBe(true)
    expect(convertV1(board({ photos: [photo('a')], connections: [con('c', 'a', 'b')] }), { now: NOW }).edges).toEqual([])
  })
  it('requires a valid ISO now', () => {
    expect(() => convertV1(board({}), { now: 'today' })).toThrow()
  })
  it('uses the v1 timestamp when valid ISO, else the supplied now (never 1970)', () => {
    const p = [photo('a', { url: 'https://example.com/a' })]
    const at = (timestamp?: string) => {
      const w = convertV1(board({ photos: p, timestamp }), { now: NOW }).widgets[0]
      return w?.sources[0]?.retrievedAt
    }
    expect(at('2025-07-21T15:30:00.000Z')).toBe('2025-07-21T15:30:00.000Z')
    expect(at(undefined)).toBe(NOW)
    expect(at('July 21, 2025')).toBe(NOW)
    expect(at('')).toBe(NOW)
  })
  it('skips a non-http(s) v1 url instead of aborting', () => {
    for (const url of ['not a url', 'javascript:alert(1)', 'file:///etc/passwd']) {
      const doc = convertV1(board({ photos: [photo('a', { url })] }), { now: NOW })
      expect(doc.widgets[0]?.sources).toEqual([])
    }
  })
  it('drops non-https images and bad colors, truncates long photo titles', () => {
    const doc = convertV1(
      board({
        photos: [photo('a', { title: 'x'.repeat(80), imageUrl: 'http://example.com/a.png' }), photo('b', { imageUrl: 'https://example.com/b.png' })],
        notes: [{ id: 'n', text: 'hi', color: 'red', x: 0, y: 0 }],
      }),
      { now: NOW },
    )
    const [a, b, n] = doc.widgets
    expect(a?.type === 'photo' && a.data.title.length).toBe(50)
    expect(a?.type === 'photo' && a.data.image).toBeUndefined()
    expect(b?.type === 'photo' && b.data.image).toBe('https://example.com/b.png')
    expect(n?.type === 'note' && n.data.color).toBe('#fef08a')
  })
  it('does not leave a dangling surrogate when truncating', () => {
    const title = `${'a'.repeat(49)}\u{1F600}`
    const w = convertV1(board({ photos: [photo('a', { title })] }), { now: NOW }).widgets[0]
    expect(w?.type === 'photo' && w.data.title).toBe('a'.repeat(49))
  })
  it('keeps a stable order: photos, notes, wanted, papers, each in input order', () => {
    const input = board({
      photos: [photo('p2'), photo('p1')],
      notes: [{ id: 'n2', x: 0, y: 0 }, { id: 'n1', x: 0, y: 0 }],
      papers: [{ id: 'q', x: 0, y: 0 }],
    })
    expect(convertV1(input, { now: NOW }).widgets.map((w) => w.id)).toEqual(['p2', 'p1', 'n2', 'n1', 'q'])
  })
  it('is pure: same input gives equal output', () => {
    const input = board({ photos: [photo('a', { url: 'https://example.com' })] })
    expect(convertV1(input, { now: NOW })).toEqual(convertV1(input, { now: NOW }))
  })
})
