import { describe, expect, it } from 'vitest'
import { DEMO_DOC, DEMO_TITLE } from '../../agents/fixtures/demoBoard'
import type { DraftRow } from '../../agents/lib/writeDraft'
import { writeDraft } from '../../agents/lib/writeDraft'
import { optionValue, parsePublishFlags, publishDemo, validateDemo, type DemoRow, type DemoStore } from '../../agents/seed-demo'

const UUID = '00000000-0000-4000-8000-000000000001'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const BANNED = /epstein|maxwell|lolita|minors?\b|trafficking|island/i

describe('demo board fixture', () => {
  it('passes the agents validator without touching the network', async () => {
    const probed: string[] = []
    const res = await validateDemo(async (u) => (probed.push(u), true))
    expect(res.doc.widgets.length).toBeGreaterThan(5)
    expect(probed.length).toBeGreaterThan(0) // only the injected fake resolver ran
    expect(res.warnings).toEqual([])
  })
  it('is sourced, neutral, and only images are licensed Commons files', () => {
    let images = 0
    for (const w of DEMO_DOC.widgets) {
      expect(w.sources.length).toBeGreaterThan(0)
      if ('image' in w.data) {
        images++
        expect(w.type).toBe('photo')
        expect(w.data.image).toMatch(/^https:\/\/upload\.wikimedia\.org\//)
        expect(w.sources.some((s) => s.url.startsWith('https://commons.wikimedia.org/wiki/File:') && /^(Public domain|CC BY)/.test(s.license ?? '') && s.attribution)).toBe(true)
      }
    }
    expect(images).toBe(2)
    expect(`${DEMO_TITLE}\n${JSON.stringify(DEMO_DOC)}`).not.toMatch(BANNED)
  })
  it('writes through writeDraft as a private row', async () => {
    const rows: DraftRow[] = []
    await writeDraft({ insertBoard: async (r) => (rows.push(r), { id: 'x', slug: r.slug }) }, { curatorId: UUID, title: DEMO_TITLE, doc: DEMO_DOC })
    expect(rows[0]).toMatchObject({ visibility: 'private', owner_id: UUID })
  })
})

describe('publishDemo guards', () => {
  const OWNER = UUID
  const ok = async () => true
  const base: DemoRow = { id: 'b1', owner_id: OWNER, title: DEMO_TITLE, doc: structuredClone(DEMO_DOC), revision: 3, deleted_at: null }
  const fake = (row: DemoRow | null) => {
    const calls: string[] = []
    const store: DemoStore = {
      findBySlug: async () => row,
      hasDemoBoard: async () => false,
      uploadThumbnail: async (o, id) => void calls.push(`thumb:${o}/${id}`),
      publish: async (id) => void calls.push(`publish:${id}`),
    }
    return { store, calls }
  }
  it('publishes the untouched demo and uploads the thumbnail', async () => {
    const { store, calls } = fake(base)
    await publishDemo(store, OWNER, 's', ok, new Blob([PNG], { type: 'image/png' }))
    expect(calls).toEqual([`thumb:${OWNER}/b1`, 'publish:b1'])
  })
  it.each([
    ['wrong title', { ...base, title: 'Something else' }],
    ['other owner', { ...base, owner_id: '00000000-0000-4000-8000-000000000002' }],
    ['deleted', { ...base, deleted_at: '2026-01-01' }],
    ['edited doc', { ...base, doc: { ...DEMO_DOC, widgets: DEMO_DOC.widgets.map((w, i) => (i === 0 ? { ...w, x: w.x + 1 } : w)) } }],
    ['invalid doc', { ...base, doc: { version: 1 } }],
  ])('refuses %s', async (_n, row) => {
    const { store, calls } = fake(row)
    await expect(publishDemo(store, OWNER, 's', ok)).rejects.toThrow()
    expect(calls).toEqual([])
  })
  it('refuses a non-PNG thumbnail before any store call', async () => {
    const { store, calls } = fake(base)
    await expect(publishDemo(store, OWNER, 's', ok, new Blob(['not a png at all']))).rejects.toThrow(/not a PNG/)
    expect(calls).toEqual([])
  })
  it('refuses an oversize thumbnail before any store call', async () => {
    const { store, calls } = fake(base)
    const big = new Uint8Array(262145)
    big.set(PNG)
    await expect(publishDemo(store, OWNER, 's', ok, new Blob([big]))).rejects.toThrow(/larger than/)
    expect(calls).toEqual([])
    await publishDemo(store, OWNER, 's', ok, new Blob([big.slice(0, 262144)]))
    expect(calls).toEqual([`thumb:${OWNER}/b1`, 'publish:b1'])
  })
  it.each([
    ['empty', new Blob([])],
    ['under 8 bytes', new Blob([new Uint8Array(PNG.slice(0, 7))])],
  ])('refuses a %s thumbnail before any store call', async (_n, blob) => {
    const { store, calls } = fake(base)
    await expect(publishDemo(store, OWNER, 's', ok, blob)).rejects.toThrow(/not a PNG/)
    expect(calls).toEqual([])
  })
  it('refuses a missing board', async () => {
    await expect(publishDemo(fake(null).store, OWNER, 's', ok)).rejects.toThrow(/not found/)
  })
})

describe('optionValue', () => {
  it('reads a value, or undefined when absent', () => {
    expect(optionValue(['--publish', 'abc'], '--publish', '<slug>')).toBe('abc')
    expect(optionValue(['--yes'], '--publish', '<slug>')).toBeUndefined()
  })
  it.each([[['--publish']], [['--publish', '--yes']], [['--publish', '']]])('rejects a missing value %j', (argv) => {
    expect(() => optionValue(argv, '--publish', '<slug>')).toThrow(/usage/)
  })
  it.each([[['--publish=abc']], [['--thumbnail=a.png']]])('rejects the = form %j', (argv) => {
    expect(() => optionValue(argv, argv[0]!.split('=')[0]!, '<v>')).toThrow(/usage/)
  })
  it('rejects a repeated flag', () => {
    expect(() => optionValue(['--publish', 'a', '--publish', 'b'], '--publish', '<slug>')).toThrow(/only once/)
  })
})

describe('parsePublishFlags', () => {
  it('accepts --publish with or without --thumbnail', () => {
    expect(parsePublishFlags(['--publish', 's', '--thumbnail', 'a.png'])).toEqual({ publishSlug: 's', thumbFile: 'a.png' })
    expect(parsePublishFlags(['--publish', 's'])).toEqual({ publishSlug: 's', thumbFile: undefined })
  })
  it('refuses --thumbnail without --publish', () => {
    expect(() => parsePublishFlags(['--thumbnail', 'a.png'])).toThrow(/requires --publish/)
  })
})
