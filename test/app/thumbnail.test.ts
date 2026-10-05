import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocSchema } from '../../shared/schema'
import { SAMPLE_DOC } from '../../src/editor/sample'
import { renderThumbnailSvg } from '../../src/boards/thumbnailSvg'
import { createThumbnailScheduler, removeAllThumbnails, removeBoardThumbnails, thumbnailPath } from '../../src/boards/thumbnails'

describe('renderThumbnailSvg', () => {
  it('is deterministic and draws every widget and edge', () => {
    const a = renderThumbnailSvg(SAMPLE_DOC)
    expect(renderThumbnailSvg(SAMPLE_DOC)).toBe(a)
    expect(a.match(/<rect /g)?.length).toBe(SAMPLE_DOC.widgets.length + 1) // + background
    expect(a.match(/<line /g)?.length).toBe(SAMPLE_DOC.edges.length)
    expect(a).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  })
  it('renders an empty board as just the background', () => {
    expect(renderThumbnailSvg(DocSchema.parse({ version: 1, widgets: [], edges: [] }))).toMatch(/<rect [^>]*\/><\/svg>$/)
  })
  it('puts thumbnails under the owner uid prefix', () => {
    expect(thumbnailPath('u1', 'b1')).toBe('u1/b1.png')
  })
})

describe('createThumbnailScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const docOf = (n: number) => DocSchema.parse({ version: 1, widgets: [{ id: `w${n}`, type: 'note', x: 0, y: 0, w: 10, h: 10, data: {} }], edges: [] })

  it('uploads once after saves settle, swallows failures, and flushes on stop', async () => {
    const upload = vi.fn(async () => { throw new Error('storage down') })
    const t = createThumbnailScheduler(async () => new Blob(['x']), upload, 1000)
    t.schedule(SAMPLE_DOC)
    t.schedule(SAMPLE_DOC)
    await vi.advanceTimersByTimeAsync(999)
    expect(upload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(upload).toHaveBeenCalledTimes(1)
    t.schedule(SAMPLE_DOC)
    t.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(upload).toHaveBeenCalledTimes(2)
  })
  it('does nothing when no save happened', async () => {
    const upload = vi.fn(async () => {})
    createThumbnailScheduler(async () => new Blob(['x']), upload, 10).stop()
    await vi.advanceTimersByTimeAsync(100)
    expect(upload).not.toHaveBeenCalled()
  })
  it('switching board A to B during stop: A.png only ever gets A\'s doc, and late schedules are ignored', async () => {
    const uploads: { path: string; widget: string }[] = []
    const rendered: string[] = []
    const mk = (path: string) =>
      createThumbnailScheduler(
        async (doc) => (rendered.push(doc.widgets[0]?.id ?? ''), new Blob([doc.widgets[0]?.id ?? ''])),
        async (png) => void uploads.push({ path, widget: await png.text() }),
        4000,
      )
    const a = mk('A.png')
    a.schedule(docOf(1)) // scheduled by A's final flush; A's doc is captured now
    // the editor store switches to board B (docOf(2)) before A's timer fires; A.stop() runs from the cleanup
    a.stop()
    a.schedule(docOf(2)) // anything arriving after stop is ignored
    await vi.advanceTimersByTimeAsync(10_000)
    expect(uploads).toEqual([{ path: 'A.png', widget: 'w1' }])
    expect(rendered).toEqual(['w1'])
  })
})

describe('removeAllThumbnails', () => {
  const files = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ name: `${from + i}.png` }))
  const clientWith = (list: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn>) =>
    ({ storage: { from: () => ({ list, remove }) } }) as unknown as SupabaseClient

  it('pages past 1000 objects and removes every page', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: files(1000), error: null })
      .mockResolvedValueOnce({ data: files(5, 1000), error: null })
      .mockResolvedValue({ data: [], error: null }) // final verification
    const remove = vi.fn(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null }))
    expect(await removeAllThumbnails(clientWith(list, remove), 'u1')).toBeNull()
    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove.mock.calls[0]?.[0]).toHaveLength(1000)
    expect(remove.mock.calls[0]?.[0]?.[0]).toBe('u1/0.png')
  })
  it('reports a remove error instead of pretending success', async () => {
    const list = vi.fn(async () => ({ data: files(2), error: null }))
    const remove = vi.fn(async (_paths: string[]) => ({ data: null, error: { message: 'denied' } }))
    expect(await removeAllThumbnails(clientWith(list, remove), 'u1')).toBe('denied')
  })
  it('reports a list error', async () => {
    const list = vi.fn(async () => ({ data: null, error: { message: 'down' } }))
    expect(await removeAllThumbnails(clientWith(list, vi.fn()), 'u1')).toBe('down')
  })
  it('fails when RLS makes remove() return no error and no deleted objects', async () => {
    const list = vi.fn(async () => ({ data: files(2), error: null }))
    const remove = vi.fn(async (_paths: string[]) => ({ data: [], error: null }))
    expect(await removeAllThumbnails(clientWith(list, remove), 'u1')).toMatch(/could not be removed/)
  })
  it('fails when the folder is still not empty after removal', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: files(2), error: null })
      .mockResolvedValue({ data: files(1), error: null })
    const remove = vi.fn(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null }))
    expect(await removeAllThumbnails(clientWith(list, remove), 'u1')).toMatch(/could not be removed/)
  })
})

describe('removeBoardThumbnails', () => {
  const clientWith = (remove: ReturnType<typeof vi.fn>) => ({ storage: { from: () => ({ remove }) } }) as unknown as SupabaseClient
  it('requests both paths per id', async () => {
    const remove = vi.fn(async () => ({ data: [], error: null }))
    await removeBoardThumbnails(clientWith(remove), 'u1', ['b1', 'b2'])
    expect(remove).toHaveBeenCalledWith(['u1/b1.png', 'u1/pub-b1.png', 'u1/b2.png', 'u1/pub-b2.png'])
  })
  it('does nothing for no ids', async () => {
    const remove = vi.fn()
    await removeBoardThumbnails(clientWith(remove), 'u1', [])
    expect(remove).not.toHaveBeenCalled()
  })
  it('never throws on a rejected remove, an error result or an empty result', async () => {
    await expect(removeBoardThumbnails(clientWith(vi.fn(async () => { throw new Error('down') })), 'u1', ['b1'])).resolves.toBeUndefined()
    await expect(removeBoardThumbnails(clientWith(vi.fn(async () => ({ data: null, error: { message: 'denied' } }))), 'u1', ['b1'])).resolves.toBeUndefined()
    await expect(removeBoardThumbnails(clientWith(vi.fn(async () => ({ data: [], error: null }))), 'u1', ['b1'])).resolves.toBeUndefined()
  })
})
