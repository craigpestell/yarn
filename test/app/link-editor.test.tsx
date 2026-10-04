import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { Inspector } from '../../src/editor/Inspector'
import { SAMPLE_DOC, SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'
import { LinksContext, type LinksValue } from '../../src/links/LinksContext'
import type { LinkView } from '../../src/links/schemas'
import { row } from './fakeClient'

const ME = '00000000-0000-4000-8000-0000000000a1'
const OTHER = '00000000-0000-4000-8000-0000000000a2'
const REMOTE = '00000000-0000-4000-8000-0000000000a3'

function stub() {
  const rpc = vi.fn(async (name: string, args: { p_slug?: string }) => {
    if (name === 'resolve_board') return { data: args.p_slug === 'remote-board' ? [{ id: REMOTE, slug: 'remote-board', title: 'Remote' }] : [], error: null }
    if (name === 'set_widget_link') return { data: '00000000-0000-4000-8000-0000000000f1', error: null }
    return { data: null, error: { message: 'unexpected' } }
  })
  const eq2 = vi.fn(async () => ({ error: null }))
  const from = vi.fn((table: string) => {
    if (table === 'boards') return { select: () => ({ order: async () => ({ data: [row({ id: ME, title: 'This one' }), row({ id: OTHER, title: 'Other board' })], error: null }) }) }
    if (table === 'board_links') return { delete: () => ({ eq: () => ({ eq: eq2 }) }) }
    throw new Error(`unexpected ${table}`)
  })
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, eq2 }
}

const ctx = (s: ReturnType<typeof stub>, links: LinkView[] = [], onChanged = vi.fn()): LinksValue => ({
  links: new Map(links.map((l) => [l.widgetId, l])),
  from: { slug: 'this-one', title: 'This one' },
  editor: { client: s.client, boardId: ME, onChanged },
})

beforeEach(() => {
  useBoard.getState().loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
  useBoard.getState().select({ kind: 'widget', id: 'w-note1' })
  window.sessionStorage.clear()
})

describe('widget link editor (inspector)', () => {
  it('links to one of your boards, excluding the current board', async () => {
    const s = stub()
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<LinksContext.Provider value={ctx(s, [], onChanged)}><Inspector /></LinksContext.Provider>)
    const select = await screen.findByRole('combobox', { name: 'Your boards' })
    await waitFor(() => expect(screen.getByRole('option', { name: 'Other board' })).toBeInTheDocument())
    expect(screen.queryByRole('option', { name: 'This one' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'Other board')
    await user.click(screen.getByRole('button', { name: 'Link to this board' }))
    await waitFor(() => expect(s.rpc).toHaveBeenCalledWith('set_widget_link', { p_board_id: ME, p_widget_id: 'w-note1', p_to_board_id: OTHER }))
    expect(onChanged).toHaveBeenCalled()
  })

  it('links by pasted /b/ URL (another owner) and rejects bad addresses', async () => {
    const s = stub()
    const user = userEvent.setup()
    render(<LinksContext.Provider value={ctx(s)}><Inspector /></LinksContext.Provider>)
    const input = await screen.findByLabelText('Or paste a board address')
    await user.type(input, 'https://other.example/edit/123')
    await user.click(screen.getByRole('button', { name: 'Link by address' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Paste a board address/)
    await user.clear(input)
    await user.type(input, 'https://other.example/b/missing-board')
    await user.click(screen.getByRole('button', { name: 'Link by address' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found or is not shared/)
    await user.clear(input)
    await user.type(input, 'https://other.example/b/remote-board')
    await user.click(screen.getByRole('button', { name: 'Link by address' }))
    await waitFor(() => expect(s.rpc).toHaveBeenCalledWith('set_widget_link', { p_board_id: ME, p_widget_id: 'w-note1', p_to_board_id: REMOTE }))
  })

  it('clears an existing link', async () => {
    const s = stub()
    const user = userEvent.setup()
    const link: LinkView = { linkId: 'l1', widgetId: 'w-note1', toBoardId: OTHER, title: 'Other board', slug: 'other-board' }
    render(<LinksContext.Provider value={ctx(s, [link])}><Inspector /></LinksContext.Provider>)
    await user.click(await screen.findByRole('button', { name: 'Clear link' }))
    await waitFor(() => expect(s.eq2).toHaveBeenCalledWith('from_widget_id', 'w-note1'))
  })

  it('renders nothing without an editor (sandbox, readers)', () => {
    render(<Inspector />)
    expect(screen.queryByText('Linked board')).not.toBeInTheDocument()
  })
})

describe('link chip on widgets', () => {
  it('shows an open link, records the breadcrumb on click, and an unavailable placeholder without a title', async () => {
    const s = stub()
    const links: LinkView[] = [
      { linkId: 'l1', widgetId: 'w-keeper', toBoardId: OTHER, title: 'Other board', slug: 'other-board' },
      { linkId: 'l2', widgetId: 'w-lamp', toBoardId: REMOTE, title: null, slug: null },
    ]
    render(<LinksContext.Provider value={ctx(s, links)}><App /></LinksContext.Provider>)
    const a = await screen.findByRole('link', { name: /Open board: Other board/ })
    expect(a).toHaveAttribute('href', '/b/other-board')
    a.addEventListener('click', (e) => e.preventDefault())
    await act(async () => a.click())
    expect(JSON.parse(window.sessionStorage.getItem('yarns.trail') ?? '{}')).toMatchObject({ pendingTo: 'other-board', trail: [{ slug: 'this-one', title: 'This one' }] })
    expect(screen.getAllByText('Board unavailable')).toHaveLength(1)
  })
})
