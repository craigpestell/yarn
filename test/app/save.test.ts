import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createReconcileFn, createSaveFn } from '../../src/boards/save'

const payload = { id: 'b1', expectedRevision: 3, title: 'T', doc: { version: 1 as const, widgets: [], edges: [] } }
const clientWith = (rpc: () => Promise<unknown>, hasSession = true) =>
  ({ rpc: vi.fn(rpc), auth: { getSession: async () => ({ data: { session: hasSession ? {} : null } }) } }) as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> }

describe('createSaveFn', () => {
  it('sends the expected revision and returns the new one', async () => {
    const c = clientWith(async () => ({ data: 4, error: null }))
    expect(await createSaveFn(c)(payload)).toEqual({ kind: 'saved', revision: 4 })
    expect(c.rpc).toHaveBeenCalledWith('save_board', { p_id: 'b1', p_expected_revision: 3, p_doc: payload.doc, p_title: 'T' })
  })
  it('reports null with no session as unauthenticated, not a conflict', async () => {
    expect(await createSaveFn(clientWith(async () => ({ data: null, error: null }), false))(payload)).toEqual({ kind: 'unauthenticated' })
  })
  it('reports a stale revision (null) as a conflict', async () => {
    expect(await createSaveFn(clientWith(async () => ({ data: null, error: null })))(payload)).toEqual({ kind: 'conflict' })
  })
  it('treats code-less errors and thrown fetch failures as offline', async () => {
    expect((await createSaveFn(clientWith(async () => ({ data: null, error: { message: 'Failed to fetch', code: '' } })))(payload)).kind).toBe('offline')
    expect((await createSaveFn(clientWith(async () => { throw new TypeError('network') }))(payload)).kind).toBe('offline')
  })
  it('treats coded server errors as rejected, and malformed data as rejected', async () => {
    expect((await createSaveFn(clientWith(async () => ({ data: null, error: { message: 'too big', code: '23514' } })))(payload)).kind).toBe('rejected')
    expect((await createSaveFn(clientWith(async () => ({ data: 'x', error: null })))(payload)).kind).toBe('rejected')
  })
})

describe('createReconcileFn', () => {
  const row = (over: Record<string, unknown>) => ({
    id: '00000000-0000-4000-8000-000000000001', slug: 'abc', title: 'T', visibility: 'private', revision: 4,
    updated_at: 'x', deleted_at: null, doc: payload.doc, ...over,
  })
  const reader = (data: unknown, error: unknown = null) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) }) as unknown as SupabaseClient
  const p = { ...payload, expectedRevision: 3 }

  it('treats an advanced revision with our doc as our own applied write', async () => {
    expect(await createReconcileFn(reader(row({})))(p)).toEqual({ kind: 'applied', revision: 4 })
  })
  it('is a conflict when the server doc differs', async () => {
    const other = { version: 1, widgets: [], edges: [{ id: 'e', source: 'a', target: 'b', color: '#e53e3e' }] }
    expect((await createReconcileFn(reader(row({ doc: other })))(p)).kind).toBe('conflict')
  })
  it('is a conflict when the revision did not advance, or the title we sent differs', async () => {
    expect((await createReconcileFn(reader(row({ revision: 3 })))(p)).kind).toBe('conflict')
    expect((await createReconcileFn(reader(row({ title: 'Other' })))(p)).kind).toBe('conflict')
    expect((await createReconcileFn(reader(row({ title: 'Other' })))({ ...p, title: null })).kind).toBe('applied')
  })
  it('ignores undefined-valued keys when comparing (the DB copy never has them)', async () => {
    const withUndefined = { ...p, doc: { version: 1 as const, widgets: [], edges: [], extra: undefined } as never }
    expect(await createReconcileFn(reader(row({})))(withUndefined)).toEqual({ kind: 'applied', revision: 4 })
  })
  it('stays offline when the re-read itself fails', async () => {
    expect((await createReconcileFn(reader(null, { message: 'x' }))(p)).kind).toBe('offline')
  })
})
