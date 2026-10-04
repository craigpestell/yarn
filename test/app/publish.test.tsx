import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SupabaseClient } from '@supabase/supabase-js'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { PublishPanel } from '../../src/publish/PublishPanel'

const BOARD = '00000000-0000-4000-8000-0000000000b1'
const OWNER = '00000000-0000-4000-8000-0000000000a1'
const PUB_THUMB = `${OWNER}/pub-${BOARD}.png`

function stub(initial: { visibility: string; revision: number; published_revision: number | null; show_backlinks?: boolean }) {
  const state = { show_backlinks: true, ...initial }
  const shares: { email: string }[] = []
  const tags = new Set<string>()
  const calls: [string, unknown][] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args])
    if (name === 'publish_board') {
      state.published_revision = state.revision
      if (args.p_visibility) state.visibility = String(args.p_visibility)
      return { data: state.revision, error: null }
    }
    if (name === 'unpublish_board') {
      state.published_revision = null
      state.visibility = 'private'
      return { data: true, error: null }
    }
    if (name === 'list_board_shares') return { data: shares, error: null }
    if (name === 'share_board') {
      shares.push({ email: String(args.p_email) }) // the server stores any address and answers the same
      return { data: true, error: null }
    }
    if (name === 'unshare_board') {
      const i = shares.findIndex((x) => x.email === args.p_email)
      if (i >= 0) shares.splice(i, 1)
      return { data: true, error: null }
    }
    return { data: null, error: { message: `unexpected rpc ${name}` } }
  })
  const from = vi.fn((table: string) => {
    if (table === 'boards') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...state }, error: null }) }) }),
        update: (patch: { show_backlinks: boolean }) => ({
          eq: () => ({ select: async () => (Object.assign(state, patch), calls.push(['update', patch]), { data: [{ id: BOARD }], error: null }) }),
        }),
      }
    }
    if (table === 'topics') return { select: () => ({ order: async () => ({ data: [{ slug: 'dyatlov', title: 'Dyatlov Pass', summary: null, tags: [] }], error: null }) }) }
    if (table === 'board_topics') {
      return {
        select: () => ({ eq: async () => ({ data: [...tags].map((topic_slug) => ({ topic_slug })), error: null }) }),
        insert: async (row: { topic_slug: string }) => (tags.add(row.topic_slug), { error: null }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  const removed: string[][] = []
  const storage = { from: () => ({ upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async (paths: string[]) => (removed.push(paths), { data: [], error: null })) }) }
  return { client: { rpc, from, storage } as unknown as SupabaseClient, calls, state, tags, removed }
}

const renderPanel = (client: SupabaseClient) => render(<PublishPanel client={client} ownerId={OWNER} boardId={BOARD} slug="my-board" />)

describe('publish panel', () => {
  it('publishes with the chosen visibility, shows the link, and unpublishes', async () => {
    const s = stub({ visibility: 'private', revision: 3, published_revision: null })
    const user = userEvent.setup()
    const { container } = renderPanel(s.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    expect(await screen.findByText('Not published. Only you can see this board.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Who can read it'), 'public')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(s.calls).toContainEqual(['publish_board', { p_id: BOARD, p_visibility: 'public' }]))
    expect(await screen.findByText(/Published \(visibility: public\)\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\/b\/my-board$/ })).toHaveAttribute('href', '/b/my-board')
    expect((await axe(container)).violations).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByText('Not published. Only you can see this board.')).toBeInTheDocument()
    expect(s.state.visibility).toBe('private')
    await waitFor(() => expect(s.removed).toContainEqual([PUB_THUMB]))
  })

  it('removes the published thumbnail when publishing as private', async () => {
    const s = stub({ visibility: 'public', revision: 2, published_revision: 1 })
    const user = userEvent.setup()
    renderPanel(s.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    await user.selectOptions(await screen.findByLabelText('Who can read it'), 'private')
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    await waitFor(() => expect(s.calls).toContainEqual(['publish_board', { p_id: BOARD, p_visibility: 'private' }]))
    await waitFor(() => expect(s.removed).toContainEqual([PUB_THUMB]))
  })

  it('warns about unpublished changes and republishes', async () => {
    const s = stub({ visibility: 'unlisted', revision: 5, published_revision: 2 })
    const user = userEvent.setup()
    renderPanel(s.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    expect(await screen.findByText(/changes that are not published yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    await waitFor(() => expect(screen.queryByText(/changes that are not published yet/)).not.toBeInTheDocument())
    expect(s.calls).toContainEqual(['publish_board', { p_id: BOARD, p_visibility: 'unlisted' }])
  })

  it('manages the share list by email without confirming the account exists', async () => {
    const s = stub({ visibility: 'private', revision: 1, published_revision: 1 })
    const user = userEvent.setup()
    renderPanel(s.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    await user.type(await screen.findByLabelText('Email address'), 'bob@test.dev')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    const list = await screen.findByRole('list', { name: 'Shared with' })
    expect(within(list).getByText(/bob@test.dev/)).toBeInTheDocument()
    expect(screen.getByText('Shared. Anyone who signs in with that email can read the published board.')).toBeInTheDocument()
    // an address with no account is listed and answered exactly the same way
    await user.type(screen.getByLabelText('Email address'), 'nobody@test.dev')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await within(list).findByText(/nobody@test.dev/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop sharing with nobody@test.dev' }))
    await waitFor(() => expect(within(list).queryByText(/nobody@test.dev/)).not.toBeInTheDocument())
    expect(s.calls).toContainEqual(['unshare_board', { p_board_id: BOARD, p_email: 'nobody@test.dev' }])
    await user.click(screen.getByRole('button', { name: 'Stop sharing with bob@test.dev' }))
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Shared with' })).not.toBeInTheDocument())
    await user.type(screen.getByLabelText('Email address'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByText(/enter a valid email address/)).toBeInTheDocument()
  })

  it('toggles backlinks and shows topic tags only for a published public board', async () => {
    const pub = stub({ visibility: 'public', revision: 1, published_revision: 1 })
    const user = userEvent.setup()
    const { unmount } = renderPanel(pub.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    await user.click(await screen.findByRole('checkbox', { name: /Linked from/ }))
    await waitFor(() => expect(pub.state.show_backlinks).toBe(false))
    await user.click(await screen.findByRole('checkbox', { name: 'Dyatlov Pass' }))
    await waitFor(() => expect(pub.tags.has('dyatlov')).toBe(true))
    unmount()
    const unl = stub({ visibility: 'unlisted', revision: 1, published_revision: 1 })
    renderPanel(unl.client)
    await user.click(screen.getByRole('button', { name: 'Publish and share' }))
    await screen.findByText(/Published \(visibility: unlisted\)/)
    expect(screen.queryByRole('group', { name: 'Topics' })).not.toBeInTheDocument()
  })
})
