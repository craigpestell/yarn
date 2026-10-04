import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { clearWidgetLink, fetchLinks, parseBoardUrl, resolveBoard, setWidgetLink } from '../../src/links/api'

const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const rpcClient = (data: unknown, error: { message: string } | null = null) => {
  const rpc = vi.fn(async () => ({ data, error }))
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('parseBoardUrl', () => {
  it.each([
    ['https://yarns.example/b/my-board', 'my-board'],
    ['http://localhost:5188/b/my-board/', 'my-board'],
    ['/b/my-board', 'my-board'],
    ['  https://yarns.example/b/my-board?x=1#y ', 'my-board'],
  ])('accepts %s', (input, slug) => expect(parseBoardUrl(input)).toBe(slug))
  it.each(['', 'my-board', 'https://x.test/edit/abc', 'https://x.test/b/', 'https://x.test/b/A_B', 'javascript:alert(1)//b/my-board', 'https://x.test/b/a--b', 'https://x.test/b/new/extra', 'ftp://x.test/b/my-board', '/b/ab', 'not a url'])('rejects %j', (input) => expect(parseBoardUrl(input)).toBeNull())
})

describe('links api', () => {
  it('maps links per widget and treats a null title as unavailable', async () => {
    const { client } = rpcClient([
      { id: U(1), from_widget_id: 'w1', to_board_id: U(2), label: null, pinned_revision: null, to_title: 'Child', to_slug: 'child-board' },
      { id: U(3), from_widget_id: 'w2', to_board_id: U(4), label: null, pinned_revision: null, to_title: null, to_slug: null },
      { id: U(5), from_widget_id: null, to_board_id: U(4), label: null, pinned_revision: null, to_title: null, to_slug: null },
    ])
    const m = await fetchLinks(client, U(9))
    expect(m.get('w1')).toMatchObject({ title: 'Child', slug: 'child-board' })
    expect(m.get('w2')).toMatchObject({ title: null, slug: null })
    expect(m.size).toBe(2)
  })
  it('rejects malformed server data and surfaces rpc errors', async () => {
    await expect(fetchLinks(rpcClient([{ id: 'x' }]).client, U(9))).rejects.toThrow(/unexpected data/)
    await expect(fetchLinks(rpcClient(null, { message: 'boom' }).client, U(9))).rejects.toThrow(/boom/)
  })
  it('resolves a board, or null when it is not readable', async () => {
    expect(await resolveBoard(rpcClient([{ id: U(2), slug: 'child-board', title: 'Child' }]).client, 'child-board')).toEqual({ id: U(2), slug: 'child-board', title: 'Child' })
    expect(await resolveBoard(rpcClient([]).client, 'child-board')).toBeNull()
  })
  it('setWidgetLink fails when the server refuses (null)', async () => {
    const ok = rpcClient(U(7))
    await setWidgetLink(ok.client, U(1), 'w1', U(2))
    expect(ok.rpc).toHaveBeenCalledWith('set_widget_link', { p_board_id: U(1), p_widget_id: 'w1', p_to_board_id: U(2) })
    await expect(setWidgetLink(rpcClient(null).client, U(1), 'w1', U(2))).rejects.toThrow(/cannot link/)
  })
  it('clearWidgetLink deletes by board and widget', async () => {
    const eq2 = vi.fn(async () => ({ error: null }))
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const client = { from: () => ({ delete: () => ({ eq: eq1 }) }) } as unknown as SupabaseClient
    await clearWidgetLink(client, U(1), 'w1')
    expect(eq1).toHaveBeenCalledWith('from_board_id', U(1))
    expect(eq2).toHaveBeenCalledWith('from_widget_id', 'w1')
  })
})
