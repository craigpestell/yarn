import { describe, expect, it } from 'vitest'
import { BoardsError, copyTitle, createBoard, deleteTrashedBoard, duplicateBoard, emptyTrash, listBoards, renameBoard, restoreBoard, softDeleteBoard } from '../../src/boards/api'
import { FORK_FAILED, ForkError, forkBoard } from '../../src/boards/fork'
import { makeSlug } from '../../src/boards/slug'
import { fetchForkSource } from '../../src/reader/api'
import { fakeServer, type SBoard } from './fakeServer'
import { fakeClient, row, USER_ID } from './fakeClient'

const ID = '00000000-0000-4000-8000-000000000010'

describe('makeSlug', () => {
  it('produces slugs the DB check accepts', () => {
    const re = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/
    for (const t of ['Hello World', '  !!!  ', 'Ünïcode  títle', 'x'.repeat(200), '--a--b--']) {
      const s = makeSlug(t, () => 'abc12345')
      expect(s).toMatch(re)
      expect(s).not.toContain('--')
    }
    expect(makeSlug('Hello World', () => 'abc12345')).toBe('hello-world-abc12345')
  })
})

describe('boards api', () => {
  it('parses rows at the boundary and rejects malformed ones', async () => {
    const ok = fakeClient({ rows: [row({ id: ID })] })
    expect(await listBoards(ok.client)).toHaveLength(1)
    const bad = fakeClient({ rows: [{ ...row({ id: ID }), visibility: 'secret' } as never] })
    await expect(listBoards(bad.client)).rejects.toThrow()
  })
  it('creates a private board owned by the caller with a valid slug', async () => {
    const f = fakeClient()
    await createBoard(f.client, USER_ID, 'My title')
    expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: USER_ID, title: 'My title', visibility: 'private', slug: expect.stringMatching(/^my-title-/) }))
  })
  it('duplicates with the same doc and a "Copy of" title capped at 50', async () => {
    const f = fakeClient({ rows: [row({ id: ID, title: 'T'.repeat(50) })] })
    await duplicateBoard(f.client, USER_ID, ID)
    const arg = f.insert.mock.calls[0]?.[0] as { title: string }
    expect(arg.title).toHaveLength(50)
    expect(copyTitle('A')).toBe('Copy of A')
  })
  it('renames (validated), soft-deletes and restores', async () => {
    const f = fakeClient({ rows: [row({ id: ID })] })
    await renameBoard(f.client, ID, '  New  ')
    expect(f.update).toHaveBeenCalledWith(ID, { title: 'New' })
    await expect(renameBoard(f.client, ID, '   ')).rejects.toThrow(/title/)
    await softDeleteBoard(f.client, ID, new Date('2026-10-03T00:00:00Z'))
    expect(f.update).toHaveBeenLastCalledWith(ID, { deleted_at: '2026-10-03T00:00:00.000Z' })
    await restoreBoard(f.client, ID)
    expect(f.update).toHaveBeenLastCalledWith(ID, { deleted_at: null })
  })
  it('reports a missing board instead of silently succeeding', async () => {
    const f = fakeClient({ rows: [] })
    await expect(restoreBoard(f.client, ID)).rejects.toThrow(/not found/)
  })
  it('retries once with a fresh slug on a unique violation, then gives up', async () => {
    const f = fakeClient({ insertErrors: [{ code: '23505', message: 'dup' }] })
    await createBoard(f.client, USER_ID, 'T')
    expect(f.insert).toHaveBeenCalledTimes(2)
    const g = fakeClient({ insertErrors: [{ code: '23505', message: 'dup' }, { code: '23505', message: 'dup' }] })
    await expect(createBoard(g.client, USER_ID, 'T')).rejects.toThrow(BoardsError)
  })
  it('wraps malformed server data in a BoardsError without raw zod output', async () => {
    const bad = fakeClient({ rows: [{ ...row({ id: ID }), visibility: 'secret' } as never] })
    const err = await listBoards(bad.client).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BoardsError)
    expect((err as Error).message).not.toMatch(/[{\[]/)
  })
})

describe('fork api', () => {
  const doc = { version: 1, widgets: [], edges: [] }
  const sid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
  const sb = (n: number, over: Partial<SBoard> = {}): SBoard => ({ id: sid(n), slug: `b-${n}`, title: `Live ${n}`, visibility: 'public', doc, publishedDoc: doc, publishedTitle: `Pub ${n}`, ...over })

  it('parses the rpc result and returns the new id and slug', async () => {
    const f = fakeClient({ rpc: { fork_board: () => ({ data: [{ new_id: ID, new_slug: 'fork-abc123def456' }], error: null }) } })
    expect(await forkBoard(f.client, ID)).toEqual({ id: ID, slug: 'fork-abc123def456' })
    expect(f.rpc).toHaveBeenCalledWith('fork_board', { p_source_id: ID })
  })
  it('rejects malformed results and never surfaces the server message', async () => {
    const bad = fakeClient({ rpc: { fork_board: () => ({ data: [{ new_id: 'nope', new_slug: 'x' }], error: null }) } })
    await expect(forkBoard(bad.client, ID)).rejects.toThrow(FORK_FAILED)
    const err = fakeClient({ rpc: { fork_board: () => ({ data: null, error: { message: 'relation boards does not exist' } }) } })
    const e = await forkBoard(err.client, ID).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ForkError)
    expect((e as Error).message).toBe(FORK_FAILED)
  })
  it('gives the identical error for unreadable, missing and over-cap sources and creates nothing', async () => {
    const boards = [sb(1), sb(2, { visibility: 'private' }), sb(3, { publishedDoc: null, publishedTitle: null })]
    const s = fakeServer(boards, {}, {}, { forkCap: 1 })
    const messages: string[] = []
    for (const target of [sid(2), sid(3), sid(7)]) messages.push(((await forkBoard(s.client, target).catch((x: unknown) => x)) as Error).message)
    expect(new Set(messages)).toEqual(new Set([FORK_FAILED]))
    expect(boards).toHaveLength(3)
    expect((await forkBoard(s.client, sid(1))).slug).toMatch(/^fork-/)
    const over = (await forkBoard(s.client, sid(1)).catch((x: unknown) => x)) as Error
    expect(over.message).toBe(FORK_FAILED) // the (N+1)th fork gets the same generic error
    expect(boards).toHaveLength(4)
  })
  it('reads provenance: none, readable, and unavailable without a title; a deleted source leaves no label', async () => {
    const boards = [sb(1), sb(2, { visibility: 'private', publishedTitle: 'SECRET' }), sb(3, { forkedFrom: sid(1) }), sb(4, { forkedFrom: sid(2) }), sb(5, { forkedFrom: sid(8) })]
    const s = fakeServer(boards, {})
    expect(await fetchForkSource(s.client, sid(1))).toBeNull()
    expect(await fetchForkSource(s.client, sid(3))).toEqual({ kind: 'available', slug: 'b-1', title: 'Pub 1' })
    expect(await fetchForkSource(s.client, sid(4))).toEqual({ kind: 'unavailable' })
    expect(JSON.stringify(s.log.map((l) => l.response))).not.toContain('SECRET')
    const gone = fakeClient({ rpc: { get_fork_source: () => ({ data: [], error: null }) } })
    expect(await fetchForkSource(gone.client, sid(5))).toBeNull()
    const malformed = fakeClient({ rpc: { get_fork_source: () => ({ data: [{ source_slug: 'Bad Slug', source_title: 1 }], error: null }) } })
    await expect(fetchForkSource(malformed.client, sid(5))).rejects.toThrow()
  })
})

describe('trash api', () => {
  it('emptyTrash returns the uuid list and rejects malformed results and errors', async () => {
    const ok = fakeClient({ rpc: { empty_my_trash: () => ({ data: [ID], error: null }) } })
    expect(await emptyTrash(ok.client)).toEqual([ID])
    const bad = fakeClient({ rpc: { empty_my_trash: () => ({ data: ['nope'], error: null }) } })
    await expect(emptyTrash(bad.client)).rejects.toThrow(BoardsError)
    const err = fakeClient({ rpc: { empty_my_trash: () => ({ data: null, error: { message: 'x' } }) } })
    await expect(emptyTrash(err.client)).rejects.toThrow(/Could not empty the trash: x/)
  })
  it('deleteTrashedBoard maps the boolean to ids and validates it', async () => {
    const yes = fakeClient({ rpc: { delete_trashed_board: () => ({ data: true, error: null }) } })
    expect(await deleteTrashedBoard(yes.client, ID)).toEqual([ID])
    expect(yes.rpc).toHaveBeenCalledWith('delete_trashed_board', { p_id: ID })
    const no = fakeClient({ rpc: { delete_trashed_board: () => ({ data: false, error: null }) } })
    expect(await deleteTrashedBoard(no.client, ID)).toEqual([])
    const bad = fakeClient({ rpc: { delete_trashed_board: () => ({ data: 'yes', error: null }) } })
    await expect(deleteTrashedBoard(bad.client, ID)).rejects.toThrow(BoardsError)
  })
})
