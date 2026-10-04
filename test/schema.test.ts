import { describe, expect, it } from 'vitest'
import { DocSchema } from '../shared/schema'

const w = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'note', x: 0, y: 0, w: 200, h: 200, rotation: 0, data: { text: 'hi' }, ...extra,
})
const e = (id: string, source: string, target: string) => ({ id, source, target, color: '#e53e3e' })
const doc = (widgets: unknown[], edges: unknown[]) => ({ version: 1, widgets, edges })
const messages = (d: unknown) => {
  const r = DocSchema.safeParse(d)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('DocSchema', () => {
  it('accepts a good doc and applies defaults', () => {
    const r = DocSchema.parse(doc([w('a'), w('b')], [e('e1', 'a', 'b')]))
    expect(r.widgets[0]?.sources).toEqual([])
  })
  it('accepts all four widget types', () => {
    const types = [
      { type: 'photo', data: { title: 'T' } },
      { type: 'note', data: {} },
      { type: 'wanted', data: { name: 'N' } },
      { type: 'paper', data: { content: 'c' } },
    ]
    const widgets = types.map((t, i) => w(`w${i}`, t))
    expect(DocSchema.safeParse(doc(widgets, [])).success).toBe(true)
  })
  it('rejects unknown widget type and mismatched data', () => {
    expect(DocSchema.safeParse(doc([w('a', { type: 'blob' })], [])).success).toBe(false)
    expect(DocSchema.safeParse(doc([w('a', { type: 'photo', data: { title: 5 } })], [])).success).toBe(false)
  })
  it('validates sources', () => {
    const bad = w('a', { sources: [{ url: 'not a url', retrievedAt: '2026-01-01T00:00:00.000Z' }] })
    expect(DocSchema.safeParse(doc([bad], [])).success).toBe(false)
    const good = w('a', { sources: [{ url: 'https://example.com', retrievedAt: '2026-01-01T00:00:00.000Z' }] })
    expect(DocSchema.safeParse(doc([good], [])).success).toBe(true)
  })
  it('rejects duplicate ids', () => {
    expect(messages(doc([w('a'), w('a')], []))).toContain('duplicate id a')
    expect(messages(doc([w('a'), w('b')], [e('a', 'a', 'b')]))).toContain('duplicate id a')
    expect(messages(doc([w('a'), w('b'), w('c')], [e('x', 'a', 'b'), e('x', 'b', 'c')]))).toContain('duplicate id x')
  })
  it('rejects dangling endpoints', () => {
    expect(messages(doc([w('a')], [e('e1', 'a', 'zzz')]))).toContain('dangling target zzz')
    expect(messages(doc([w('a')], [e('e1', 'zzz', 'a')]))).toContain('dangling source zzz')
  })
  it('rejects self-edges', () => {
    expect(messages(doc([w('a')], [e('e1', 'a', 'a')]))).toContain('self-edge')
  })
  it('rejects duplicate pairs in either direction', () => {
    const ws = [w('a'), w('b')]
    expect(messages(doc(ws, [e('e1', 'a', 'b'), e('e2', 'a', 'b')]))).toContain('duplicate edge pair')
    expect(messages(doc(ws, [e('e1', 'a', 'b'), e('e2', 'b', 'a')]))).toContain('duplicate edge pair')
  })
  it('rejects wrong version and non-finite coords', () => {
    expect(DocSchema.safeParse({ version: 2, widgets: [], edges: [] }).success).toBe(false)
    expect(DocSchema.safeParse(doc([w('a', { x: Number.NaN })], [])).success).toBe(false)
  })
})

const ok = (d: unknown) => DocSchema.safeParse(d).success
const src = (url: string, retrievedAt = '2026-01-01T00:00:00.000Z') => w('a', { sources: [{ url, retrievedAt }] })
const photo = (data: Record<string, unknown>) => w('a', { type: 'photo', data })

describe('DocSchema bounds and safety', () => {
  it('accepts only http(s) source urls', () => {
    expect(ok(doc([src('http://example.com/x')], []))).toBe(true)
    expect(ok(doc([src('https://example.com/x')], []))).toBe(true)
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://example.com/x']) {
      expect(ok(doc([src(bad)], []))).toBe(false)
    }
    expect(ok(doc([src(`https://example.com/${'a'.repeat(2100)}`)], []))).toBe(false)
  })
  it('requires ISO datetimes for retrievedAt', () => {
    expect(ok(doc([src('https://example.com', '2026-01-01')], []))).toBe(false)
    expect(ok(doc([src('https://example.com', 'yesterday')], []))).toBe(false)
    expect(ok(doc([src('https://example.com', '2026-01-01T10:00:00+02:00')], []))).toBe(true)
  })
  it('accepts https or storage-path images only', () => {
    for (const image of ['https://example.com/a.png', 'boards/abc/thumb.png', 'bucket/a-b_c/1.jpg']) {
      expect(ok(doc([photo({ image })], []))).toBe(true)
    }
    for (const image of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '/etc/passwd', 'a/../b', 'a/./b', '../x', 'a//b', 'justname']) {
      expect(ok(doc([photo({ image })], []))).toBe(false)
    }
  })
  it('bounds string lengths', () => {
    expect(ok(doc([photo({ title: 'a'.repeat(51) })], []))).toBe(false)
    expect(ok(doc([w('a', { data: { text: 'a'.repeat(5001) } })], []))).toBe(false)
    expect(ok(doc([w('a', { id: 'x'.repeat(101) })], []))).toBe(false)
    expect(ok(doc([w('a', { type: 'paper', data: { content: 'a'.repeat(20001) } })], []))).toBe(false)
  })
  it('bounds widget and edge counts', () => {
    const many = Array.from({ length: 501 }, (_, i) => w(`w${i}`))
    expect(ok(doc(many, []))).toBe(false)
    expect(ok(doc(many.slice(0, 500), []))).toBe(true)
    const two = [w('a'), w('b')]
    const edges = Array.from({ length: 2001 }, (_, i) => e(`e${i}`, 'a', 'b'))
    expect(ok(doc(two, edges))).toBe(false)
  })
  it('bounds size and rotation', () => {
    expect(ok(doc([w('a', { w: 5001 })], []))).toBe(false)
    expect(ok(doc([w('a', { h: 0 })], []))).toBe(false)
    expect(ok(doc([w('a', { rotation: 361 })], []))).toBe(false)
    expect(ok(doc([w('a', { rotation: -360, w: 5000 })], []))).toBe(true)
    expect(ok(doc([w('a', { x: 2_000_000 })], []))).toBe(false)
  })
  it('requires hex colors on notes and edges', () => {
    expect(ok(doc([w('a', { data: { color: 'red' } })], []))).toBe(false)
    expect(ok(doc([w('a', { data: { color: 'url(javascript:x)' } })], []))).toBe(false)
    expect(ok(doc([w('a', { data: { color: '#abc' } })], []))).toBe(true)
    expect(ok(doc([w('a'), w('b')], [{ ...e('e1', 'a', 'b'), color: 'expression(x)' }]))).toBe(false)
  })
  it('bounds optional strokes', () => {
    const stroke = { points: [[0, 0], [1, 1]], color: '#000000', width: 2 }
    expect(ok(doc([w('a', { strokes: [stroke] })], []))).toBe(true)
    expect(ok(doc([w('a', { strokes: 'junk' })], []))).toBe(false)
    expect(ok(doc([w('a', { strokes: Array.from({ length: 501 }, () => stroke) })], []))).toBe(false)
    // provisional shape: any JSON is accepted on read, bounded by serialised size
    expect(ok(doc([w('a', { strokes: [{ future: { format: 'v2' } }, 'opaque', 3] })], []))).toBe(true)
    expect(ok(doc([w('a', { strokes: [{ points: Array.from({ length: 20000 }, () => [0, 0]) }] })], []))).toBe(false)
  })
})
