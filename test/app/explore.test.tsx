import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { EXPLORE_PAGE_SIZE, listPublicBoards } from '../../src/explore/api'
import { signThumbnailPaths } from '../../src/explore/thumbnails'
import { ExplorePage } from '../../src/pages/ExplorePage'
import { fakeClient, session, type RpcHandlers } from './fakeClient'

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001'
const uuid = (n: number) => `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`
const board = (n: number) => ({
  slug: `board-${n}`,
  published_title: `Board ${n}`,
  published_at: `2026-03-${String(30 - (n % 28)).padStart(2, '0')}T00:00:00+00:00`,
  id: uuid(n),
  thumbnail_path: `${OWNER}/pub-${uuid(n)}.png`,
})
const boards = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => board(from + i))

function setup(rpc: RpcHandlers, signedIn = false) {
  const f = fakeClient({ session: signedIn ? session : null, rpc })
  f.bucket.createSignedUrls.mockImplementation((async (paths: string[]) => ({
    data: paths.map((p, i) => ({ path: p, signedUrl: i === 1 ? null : `https://signed.test/${p}`, error: null })),
    error: null,
  })) as never)
  const r = render(
    <MemoryRouter initialEntries={['/explore']}>
      <AuthProvider client={f.client}>
        <Routes><Route path="/explore" element={<ExplorePage />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { f, ...r }
}

describe('ExplorePage', () => {
  it.each([[false], [true]])('lists boards as single-link cards, axe clean (signed in: %s)', async (signedIn) => {
    const { container, f } = setup({ list_public_boards: () => ({ data: boards(1, 3), error: null }) }, signedIn)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    const list = await screen.findByRole('list', { name: 'Public boards' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Board 1' })).toHaveAttribute('href', '/b/board-1')
    for (const c of cards) expect(within(c).getAllByRole('link')).toHaveLength(1)
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(2) // the middle card's signedUrl is null: placeholder
    expect(container.querySelectorAll('.thumb-empty')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    expect(f.rpc).toHaveBeenCalledWith('list_public_boards', { p_before_at: null, p_before_id: null, p_limit: EXPLORE_PAGE_SIZE + 1 })
    expect((await axe(container)).violations).toEqual([])
  })

  it('loads more with the keyset cursor, appends, and hides the button when exhausted', async () => {
    const pages: Record<string, unknown[]> = { start: boards(1, 25), next: boards(25, 26) }
    const { f } = setup({ list_public_boards: (a) => ({ data: a.p_before_id ? pages.next : pages.start, error: null }) })
    const user = userEvent.setup()
    expect(await screen.findAllByRole('listitem')).toHaveLength(24)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('link', { name: 'Board 26' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(26) // board 25 is not duplicated
    expect(f.rpc).toHaveBeenLastCalledWith('list_public_boards', {
      p_before_at: board(24).published_at, p_before_id: uuid(24), p_limit: EXPLORE_PAGE_SIZE + 1,
    })
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    const { container } = setup({ list_public_boards: () => ({ data: [], error: null }) })
    expect(await screen.findByText('No public boards yet.')).toBeInTheDocument()
    expect((await axe(container)).violations).toEqual([])
  })

  it('shows an alert on RPC failure and on malformed data', async () => {
    const a = setup({ list_public_boards: () => ({ data: null, error: { message: 'boom' } }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load boards: boom')
    a.unmount()
    setup({ list_public_boards: () => ({ data: [{ slug: 'x' }], error: null }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected format')
  })
})

describe('explore api and signing', () => {
  it('rejects rows carrying an unusable shape and ignores extra owner data', async () => {
    const f = fakeClient({ rpc: { list_public_boards: () => ({ data: [{ ...board(1), id: 'nope' }], error: null }) } })
    await expect(listPublicBoards(f.client)).rejects.toThrow(/unexpected format/)
  })
  it('signs paths of many owners, tolerating null urls, errors and bad shapes', async () => {
    const f = fakeClient()
    f.bucket.createSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'o1/pub-a.png', signedUrl: 'https://s/1' }, { path: 'o2/pub-b.png', signedUrl: null }, { path: null, signedUrl: 'x' }],
      error: null,
    } as never)
    expect([...(await signThumbnailPaths(f.client, ['o1/pub-a.png', 'o2/pub-b.png']))]).toEqual([['o1/pub-a.png', 'https://s/1']])
    f.bucket.createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'no' } } as never)
    expect((await signThumbnailPaths(f.client, ['a'])).size).toBe(0)
    f.bucket.createSignedUrls.mockResolvedValueOnce({ data: 'junk', error: null } as never)
    expect((await signThumbnailPaths(f.client, ['a'])).size).toBe(0)
    f.bucket.createSignedUrls.mockRejectedValueOnce(new Error('net'))
    expect((await signThumbnailPaths(f.client, ['a'])).size).toBe(0)
    expect((await signThumbnailPaths(f.client, [])).size).toBe(0)
  })
})
