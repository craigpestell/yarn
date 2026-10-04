import { render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { ReaderPage } from '../../src/pages/ReaderPage'
import { SAMPLE_DOC } from '../../src/editor/sample'
import { FORK_FAILED } from '../../src/boards/fork'
import { fakeClient, USER_ID, type RpcHandlers } from './fakeClient'
import { fakeServer, type SBoard } from './fakeServer'

vi.mock('../../src/boards/thumbnailSvg', () => ({ renderThumbnailPng: async () => new Blob(['png'], { type: 'image/png' }) }))

const SECRET = 'TOP SECRET TITLE'
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const DRAFT_DOC = { ...SAMPLE_DOC, widgets: SAMPLE_DOC.widgets.map((w) => (w.id === 'w-note1' ? { ...w, data: { ...w.data, text: 'DRAFT ONLY TEXT' } } : w)) }
const board = (n: number, over: Partial<SBoard>): SBoard => ({
  id: id(n), slug: `board-${n}`, title: `Live ${n}`, visibility: 'public', doc: DRAFT_DOC, publishedDoc: SAMPLE_DOC, publishedTitle: `Published ${n}`, ...over,
})

const page = (client: SupabaseClient, path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={client}>
        <Routes>
          <Route path="/b/:slug" element={<ReaderPage />} />
          <Route path="/edit/:id" element={<main>editor</main>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

beforeEach(() => window.sessionStorage.clear())

describe('/b/:slug as an anonymous reader (network payload)', () => {
  const boards = [
    board(1, { slug: 'hub' }),
    board(2, { slug: 'open-child', publishedTitle: 'Open child' }),
    board(3, { slug: 'secret-child', visibility: 'private', publishedTitle: SECRET, title: SECRET, publishedDoc: SAMPLE_DOC }),
  ]
  const links = { [id(1)]: [
    { id: id(7), widget: 'w-keeper', to: id(2) },
    { id: id(8), widget: 'w-lamp', to: id(3) },
  ] }

  it('renders the published snapshot, never `doc`, and shows an unavailable placeholder without the title', async () => {
    const s = fakeServer(boards, links, { [id(1)]: [{ slug: 'open-child', title: 'Open child' }] })
    const { container } = page(s.client, '/b/hub')
    expect(await screen.findByRole('heading', { name: 'Published 1' })).toBeInTheDocument()
    expect(await screen.findByText('Board unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open board: Open child/ })).toHaveAttribute('href', '/b/open-child')
    expect(screen.getByRole('region', { name: 'Linked from' })).toBeInTheDocument()
    // the draft text is never rendered
    expect(container.textContent).not.toContain('DRAFT ONLY TEXT')
    expect(container.textContent).toContain('Logbook ends mid-sentence')

    // network: every request and response, as sent over the wire
    const wire = s.log.map((l) => `${l.method} ${l.url}\n${l.body}\n${l.response}`).join('\n---\n')
    expect(wire).not.toContain(SECRET)
    expect(wire).not.toContain('DRAFT ONLY TEXT')
    expect(s.log.some((l) => l.url.includes('/rest/v1/boards'))).toBe(false) // no direct table reads (no `doc` column) for anon
    expect(container.innerHTML).not.toContain(SECRET)
    expect(document.body.textContent).not.toContain(SECRET)
    expect((await axe(container)).violations).toEqual([])
  })

  it('shows the same not-found page for a private and an unknown board', async () => {
    const a = page(fakeServer(boards, links).client, '/b/secret-child')
    expect(await screen.findByRole('heading', { name: 'Board not found' })).toBeInTheDocument()
    const textA = a.container.textContent
    a.unmount()
    const b = page(fakeServer(boards, links).client, '/b/nothing-here')
    expect(await screen.findByRole('heading', { name: 'Board not found' })).toBeInTheDocument()
    expect(b.container.textContent).toBe(textA)
    expect(document.body.textContent).not.toContain(SECRET)
  })

  it('builds a breadcrumb from the followed link and drops it when going back', async () => {
    const s = fakeServer(boards, links)
    window.sessionStorage.setItem('yarns.trail', JSON.stringify({ trail: [{ slug: 'hub', title: 'Published 1' }], pendingTo: 'open-child', current: 'hub' }))
    const r = page(s.client, '/b/open-child')
    const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' })
    expect(within(nav).getByRole('link', { name: 'Published 1' })).toHaveAttribute('href', '/b/hub')
    expect(nav.textContent).toContain('Open child')
    r.unmount()
    page(s.client, '/b/hub')
    await screen.findByRole('heading', { name: 'Published 1' })
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  })

  it('ignores a tampered trail', async () => {
    window.sessionStorage.setItem('yarns.trail', '{"trail":[{"slug":"../evil","title":1}],"pendingTo":"open-child"}')
    page(fakeServer(boards, links).client, '/b/open-child')
    await screen.findByRole('heading', { name: 'Open child' })
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  })
})

describe('/b/:slug as the owner', () => {
  it('shows the live board with an edit link', async () => {
    const f = fakeClient()
    const own = { id: id(1), slug: 'mine', title: 'Mine live', deleted_at: null, doc: DRAFT_DOC }
    const select = vi.fn()
    Object.assign(f.client, {
      from: vi.fn(() => ({ select: (cols: string) => ({ eq: (c: string, v: string) => ({ maybeSingle: async () => (select(cols, c, v), { data: v === 'mine' ? own : null, error: null }) }) }) })),
    })
    f.rpc.mockImplementation((async () => ({ data: [], error: null })) as never)
    page(f.client, '/b/mine')
    expect(await screen.findByRole('heading', { name: 'Mine live' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit this board' })).toHaveAttribute('href', `/edit/${id(1)}`)
    await waitFor(() => expect(document.body.textContent).toContain('DRAFT ONLY TEXT'))
    expect(select).toHaveBeenCalledWith('id, slug, title, deleted_at, doc', 'slug', 'mine')
    expect(screen.queryByRole('button', { name: 'Fork' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in to fork' })).not.toBeInTheDocument()
  })
})

const NEW_ID = '00000000-0000-4000-8000-0000000001aa'
const published = { id: id(1), owner_id: id(9), slug: 'hub', title: 'Published 1', visibility: 'public', published_revision: 1, published_doc: SAMPLE_DOC }
const signedInRpc = (over: RpcHandlers = {}): RpcHandlers => ({
  get_published_board: () => ({ data: [published], error: null }),
  get_board_links: () => ({ data: [], error: null }),
  get_backlinks: () => ({ data: [], error: null }),
  get_fork_source: () => ({ data: [], error: null }),
  fork_board: () => ({ data: [{ new_id: NEW_ID, new_slug: 'fork-000000000001' }], error: null }),
  ...over,
})
const forkedRow = { id: NEW_ID, slug: 'fork-000000000001', title: 'Fork of Published 1', visibility: 'private' as const, revision: 0, updated_at: '2026-10-03T00:00:00Z', deleted_at: null, doc: SAMPLE_DOC }

describe('/b/:slug fork controls', () => {
  it('shows "Log in to fork" to a signed-out reader and no Fork button', async () => {
    const s = fakeServer([board(1, { slug: 'hub' })], {})
    const { container } = page(s.client, '/b/hub')
    expect(await screen.findByRole('link', { name: 'Log in to fork' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: 'Fork' })).not.toBeInTheDocument()
    expect(s.log.some((l) => l.url.includes('get_fork_source'))).toBe(false)
    expect((await axe(container)).violations).toEqual([])
  })

  it('forks for a signed-in non-owner: calls the rpc, uploads the copy thumbnail and opens the editor', async () => {
    const f = fakeClient({ rows: [{ ...forkedRow }], rpc: signedInRpc() })
    const { container } = page(f.client, '/b/hub')
    const btn = await screen.findByRole('button', { name: 'Fork' })
    expect((await axe(container)).violations).toEqual([])
    await userEvent.click(btn)
    expect(await screen.findByText('editor')).toBeInTheDocument()
    expect(f.rpc).toHaveBeenCalledWith('fork_board', { p_source_id: id(1) })
    expect(f.bucket.upload).toHaveBeenCalledWith(`${USER_ID}/${NEW_ID}.png`, expect.anything(), expect.objectContaining({ contentType: 'image/png' }))
  })

  it('still navigates when the thumbnail upload fails', async () => {
    const f = fakeClient({ rows: [{ ...forkedRow }], rpc: signedInRpc() })
    f.bucket.upload.mockResolvedValueOnce({ error: { message: 'storage down' } } as never)
    page(f.client, '/b/hub')
    await userEvent.click(await screen.findByRole('button', { name: 'Fork' }))
    expect(await screen.findByText('editor')).toBeInTheDocument()
  })

  it('shows a generic alert and stays on the page when the server rejects the fork (cap or unavailable)', async () => {
    const f = fakeClient({ rpc: signedInRpc({ fork_board: () => ({ data: null, error: { message: 'fork unavailable' } }) }) })
    const { container } = page(f.client, '/b/hub')
    await userEvent.click(await screen.findByRole('button', { name: 'Fork' }))
    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent(FORK_FAILED)
    expect(screen.queryByText('editor')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fork' })).toBeEnabled()
    expect(f.bucket.upload).not.toHaveBeenCalled()
    expect((await axe(container)).violations).toEqual([])
  })

  it('labels the provenance with a link when the source is readable, without it otherwise', async () => {
    const readable = fakeClient({ rpc: signedInRpc({ get_fork_source: () => ({ data: [{ source_slug: 'origin', source_title: 'Origin board' }], error: null }) }) })
    const a = page(readable.client, '/b/hub')
    expect(await screen.findByRole('link', { name: 'Origin board' })).toHaveAttribute('href', '/b/origin')
    expect(a.container.textContent).toContain('Forked from')
    a.unmount()
    const hidden = fakeClient({ rpc: signedInRpc({ get_fork_source: () => ({ data: [{ source_slug: null, source_title: null }], error: null }) }) })
    const b = page(hidden.client, '/b/hub')
    expect(await screen.findByText('Forked from an unavailable board')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Origin board' })).not.toBeInTheDocument()
    expect((await axe(b.container)).violations).toEqual([])
  })
})
