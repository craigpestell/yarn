import { describe, expect, it } from 'vitest'
import { LICENSE_RE, validateBoard, type ValidationCode } from '../../agents/pipeline/validator'
import { allResolve } from '../../agents/testing/fakes'

const NOW = '2026-10-04T12:00:00.000Z'
const src = (url = 'https://example.org/a', extra: object = {}) => ({ url, retrievedAt: NOW, ...extra })
const note = (id: string, sources: object[] = [src()]) => ({
  id, type: 'note', x: 0, y: 0, w: 200, h: 200, rotation: 0, sources, data: { text: 'hi', color: '#fef08a' },
})
const photo = (id: string, image: string | undefined, sources: object[]) => ({
  id, type: 'photo', x: 300, y: 0, w: 200, h: 240, rotation: 0, sources, data: { title: 't', caption: '', ...(image ? { image } : {}) },
})
const CC = src('https://commons.wikimedia.org/wiki/File:A.jpg', { license: 'CC BY-SA 4.0', attribution: 'A. Author' })
const IMG = 'https://upload.wikimedia.org/wikipedia/commons/a.jpg'
const doc = (widgets: object[], edges: object[] = []) => ({ version: 1, widgets, edges })
const edge = (id: string, source: string, target: string) => ({ id, source, target, color: '#e53e3e' })

describe('validateBoard', () => {
  it('accepts a good board, with a licensed Commons image', async () => {
    const res = await validateBoard(doc([note('a'), photo('b', IMG, [src(), CC])], [edge('e1', 'a', 'b')]), { resolver: allResolve })
    expect(res.ok).toBe(true)
  })

  const bad: [string, unknown, ValidationCode][] = [
    ['not an object', 'nope', 'schema'],
    ['bad widget type', doc([{ ...note('a'), type: 'video' }]), 'schema'],
    ['http source (schema allows it, validator does not)', doc([note('a', [src('http://example.org/x')])]), 'unsafe_url'],
    ['javascript: source', doc([note('a', [src('javascript:alert(1)')])]), 'schema'],
    ['missing retrievedAt', doc([note('a', [{ url: 'https://example.org/a' }])]), 'schema'],
    ['dangling edge target', doc([note('a')], [edge('e1', 'a', 'ghost')]), 'dangling'],
    ['dangling edge source', doc([note('a')], [edge('e1', 'ghost', 'a')]), 'dangling'],
    ['duplicate widget id', doc([note('a'), note('a')]), 'duplicate'],
    ['self edge', doc([note('a')], [edge('e1', 'a', 'a')]), 'self_edge'],
    ['widget without sources', doc([note('a', [])]), 'ungrounded'],
    ['localhost source', doc([note('a', [src('https://localhost/x')])]), 'unsafe_url'],
    ['private ip source', doc([note('a', [src('https://10.0.0.5/x')])]), 'unsafe_url'],
  ]
  it.each(bad)('rejects: %s', async (_name, input, code) => {
    const res = await validateBoard(input, { resolver: allResolve })
    expect(res.ok).toBe(false)
    expect(res.errors.map((e) => e.code)).toContain(code)
  })

  it('rejects an unresolvable claim source with its path', async () => {
    const res = await validateBoard(doc([note('a', [src('https://example.org/dead')])]), { resolver: async (u) => u !== 'https://example.org/dead' })
    expect(res.ok).toBe(false)
    expect(res.errors.filter((e) => e.code === 'unresolvable_url').map((e) => e.path)).toEqual(['widgets.0.sources.0.url'])
  })

  it('drops an unresolvable image with a warning instead of failing the board', async () => {
    const res = await validateBoard(doc([photo('b', IMG, [src(), CC])]), { resolver: async (u) => u !== IMG })
    expect(res.ok).toBe(true)
    expect(res.warnings.map((w) => w.code)).toEqual(['image_dropped'])
    const w = res.ok ? res.doc.widgets[0] : undefined
    expect(w?.type === 'photo' && w.data.image).toBeFalsy()
  })

  it('drops a shared failing image from every widget and removes the orphaned licence source', async () => {
    const res = await validateBoard(doc([photo('b', IMG, [src(), CC]), photo('c', IMG, [src('https://example.org/c'), CC])]), { resolver: async (u) => u !== IMG })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.warnings.map((w) => w.path)).toEqual(['widgets.0.data.image', 'widgets.1.data.image'])
    for (const w of res.doc.widgets) {
      expect(w.type === 'photo' && w.data.image).toBeFalsy()
      expect(w.sources.some((s) => s.license)).toBe(false)
      expect(w.sources).toHaveLength(1)
    }
  })

  it('rejects an image or licence url with a non-default port', async () => {
    const bad = src('https://commons.wikimedia.org:8443/wiki/File:A.jpg', { license: 'CC0', attribution: 'A' })
    const res = await validateBoard(doc([photo('b', IMG, [src(), bad])]), { resolver: allResolve })
    expect(res.warnings.map((w) => w.code)).toContain('image_dropped')
    const res2 = await validateBoard(doc([photo('b', 'https://upload.wikimedia.org:8443/a.jpg', [src(), CC])]), { resolver: allResolve })
    expect(res2.warnings.map((w) => w.code)).toContain('image_dropped')
    expect(JSON.stringify(res2.doc)).not.toContain(':8443')
  })

  it('a url that is both claim source and image stays fatal', async () => {
    const res = await validateBoard(doc([photo('b', IMG, [src(IMG), CC])]), { resolver: async (u) => u !== IMG })
    expect(res.ok).toBe(false)
  })

  it('probes at most 6 urls at once', async () => {
    let live = 0
    let peak = 0
    const resolver = async () => {
      peak = Math.max(peak, ++live)
      await new Promise((r) => setTimeout(r, 2))
      live--
      return true
    }
    const widgets = Array.from({ length: 20 }, (_, i) => note(`n${i}`, [src(`https://example.org/${i}`)]))
    expect((await validateBoard(doc(widgets), { resolver })).ok).toBe(true)
    expect(peak).toBeLessThanOrEqual(6)
    expect(peak).toBeGreaterThan(1)
  })

  it.each([
    'CC0', 'CC0 1.0', 'cc by 4.0', 'CC BY', 'CC BY-SA 3.0', ' CC BY-SA 4.0 ', 'Public domain', 'PD',
  ])('accepts licence %j', (l) => expect(LICENSE_RE.test(l.trim())).toBe(true))
  it.each([
    'CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 4.0', 'PD-US', 'CC0 but not really', 'CC BY-SA 4.0 extra', '', 'GFDL',
  ])('rejects licence %j', (l) => expect(LICENSE_RE.test(l.trim())).toBe(false))

  it.each([
    ['licence source on another host', src('https://example.org/File:A.jpg', { license: 'CC BY-SA 4.0', attribution: 'A' })],
    ['licence source on a lookalike host', src('https://commons.wikimedia.org.evil.example/x', { license: 'CC BY-SA 4.0', attribution: 'A' })],
    ['NC licence on Commons', src('https://commons.wikimedia.org/wiki/File:A.jpg', { license: 'CC BY-NC 4.0', attribution: 'A' })],
  ])('drops the image (board stays valid) when %s', async (_n, licenceSource) => {
    const res = await validateBoard(doc([photo('b', IMG, [src(), licenceSource])]), { resolver: allResolve })
    expect(res.ok).toBe(true)
    expect(res.warnings.map((w) => w.code)).toContain('image_dropped')
    expect(JSON.stringify(res.doc)).not.toContain(IMG)
  })

  it('rejects the whole board when a licence source is plain http (schema)', async () => {
    const res = await validateBoard(doc([photo('b', IMG, [src(), src('http://commons.wikimedia.org/wiki/File:A.jpg', { license: 'CC BY-SA 4.0', attribution: 'A' })])]), { resolver: allResolve })
    expect(res.ok).toBe(false)
  })

  it.each([
    ['news photo hotlink', photo('b', 'https://cdn.news.example/p.jpg', [src(), CC])],
    ['storage path image', photo('b', 'bucket/uid/pic.png', [src(), CC])],
    ['allowed host but no licence record', photo('b', IMG, [src()])],
    ['licence without attribution', photo('b', IMG, [src(), src('https://commons.wikimedia.org/wiki/File:A.jpg', { license: 'CC0' })])],
    ['non-free licence', photo('b', IMG, [src('https://commons.wikimedia.org/wiki/File:A.jpg', { license: 'All rights reserved', attribution: 'X' })])],
  ])('drops an unlicensed image with a warning: %s', async (_n, w) => {
    const res = await validateBoard(doc([w]), { resolver: allResolve })
    expect(res.ok).toBe(true)
    expect(res.warnings.map((x) => x.code)).toContain('image_dropped')
    expect(res.errors).toEqual([])
  })

  it('drops an image on a lookalike host', async () => {
    const res = await validateBoard(doc([photo('b', 'https://upload.wikimedia.org.evil.example/a.jpg', [src(), CC])]), { resolver: allResolve })
    expect(res.ok).toBe(true)
    expect(res.warnings.map((w) => w.code)).toContain('image_dropped')
  })

  it('never calls the resolver for unsafe urls', async () => {
    const seen: string[] = []
    await validateBoard(doc([note('a', [src('https://127.0.0.1/x')])]), { resolver: async (u) => (seen.push(u), true) })
    expect(seen).toEqual([])
  })

  it('honours an injected image host allow-list', async () => {
    const res = await validateBoard(doc([photo('b', IMG, [src(), CC])]), { resolver: allResolve, imageHosts: ['other.example'] })
    expect(res.warnings.map((w) => w.code)).toContain('image_dropped')
  })
})
