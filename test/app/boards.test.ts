import { describe, expect, it } from 'vitest'
import { BoardsError, copyTitle, createBoard, duplicateBoard, listBoards, renameBoard, restoreBoard, softDeleteBoard } from '../../src/boards/api'
import { makeSlug } from '../../src/boards/slug'
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
