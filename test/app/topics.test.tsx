import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { TopicPage } from '../../src/pages/TopicPage'
import { TopicsPage } from '../../src/pages/TopicsPage'
import { fakeClient } from './fakeClient'

const TOPICS = [
  { slug: 'dyatlov', title: 'Dyatlov Pass', summary: 'Nine hikers', tags: ['ural'] },
  { slug: 'moon', title: 'Moon landing', summary: null, tags: [] },
]

function setup() {
  const f = fakeClient({ session: null })
  const eq = vi.fn((_c: string, v: string) => ({ maybeSingle: async () => ({ data: TOPICS.find((t) => t.slug === v) ?? null, error: null }) }))
  Object.assign(f.client, {
    from: vi.fn(() => ({ select: () => ({ order: async () => ({ data: TOPICS, error: null }), eq }) })),
  })
  f.rpc.mockImplementation((async (name: string, args: { p_q?: string; p_topic_slug?: string }) => {
    if (name === 'search_topics') return { data: TOPICS.filter((t) => t.title.toLowerCase().includes((args.p_q ?? '').toLowerCase())), error: null }
    if (name === 'list_topic_boards') return { data: args.p_topic_slug === 'dyatlov' ? [{ slug: 'dyatlov-board', title: 'The Pass' }] : [], error: null }
    return { data: null, error: { message: 'unexpected' } }
  }) as never)
  const r = render(
    <MemoryRouter initialEntries={['/topics']}>
      <AuthProvider client={f.client}>
        <Routes>
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:slug" element={<TopicPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { f, ...r }
}

describe('topics pages', () => {
  it('browses, searches and opens a topic with its public boards', async () => {
    const user = userEvent.setup()
    const { container, f } = setup()
    const list = await screen.findByRole('list', { name: 'Topics' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect((await axe(container)).violations).toEqual([])
    await user.type(screen.getByRole('searchbox', { name: 'Search topics' }), 'moon{Enter}')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Topics' })).getAllByRole('listitem')).toHaveLength(1))
    expect(f.rpc).toHaveBeenCalledWith('search_topics', { p_q: 'moon' })
    await user.clear(screen.getByRole('searchbox', { name: 'Search topics' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search topics' }), 'zzz{Enter}')
    expect(await screen.findByText('No topics match your search.')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search topics' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('link', { name: 'Dyatlov Pass' }))
    expect(await screen.findByRole('heading', { name: 'Dyatlov Pass' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'The Pass' })).toHaveAttribute('href', '/b/dyatlov-board')
  })
})
