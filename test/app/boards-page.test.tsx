import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import { fakeClient, row } from './fakeClient'
import { renderApp } from './ui'

const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b2'
const T = '00000000-0000-4000-8000-0000000000c3'
const rows = () => [
  row({ id: A, title: 'Alpha', visibility: 'public' }),
  row({ id: B, title: 'Beta' }),
  row({ id: T, title: 'Gone', deleted_at: '2026-10-01T00:00:00Z' }),
]

describe('My boards', () => {
  it('lists live boards with visibility badges, trash separately, and has no axe violations', async () => {
    const { container } = renderApp(fakeClient({ rows: rows() }).client, '/boards')
    const grid = await screen.findByRole('list', { name: 'Your boards' })
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2)
    expect(within(grid).getByText('Public')).toBeInTheDocument()
    expect(within(grid).getByText('Private')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Trashed boards' })).getByText('Gone')).toBeInTheDocument()
    expect((await axe(container)).violations).toEqual([])
  })
  it('creates a board and opens it in the editor', async () => {
    const f = fakeClient({ rows: rows() })
    const user = userEvent.setup()
    renderApp(f.client, '/boards')
    await user.click(await screen.findByRole('button', { name: 'New board' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/edit\//))
    expect(f.insert).toHaveBeenCalled()
  })
  it('renames, soft-deletes, duplicates and restores', async () => {
    const f = fakeClient({ rows: rows() })
    const user = userEvent.setup()
    renderApp(f.client, '/boards')
    await user.click(await screen.findByRole('button', { name: 'Rename Alpha' }))
    const input = screen.getByLabelText('New title for Alpha')
    await user.clear(input)
    await user.type(input, 'Alpha2{Enter}')
    expect(f.update).toHaveBeenCalledWith(A, { title: 'Alpha2' })
    expect(await screen.findByRole('heading', { name: 'Alpha2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move to trash: Beta' }))
    expect(f.update).toHaveBeenCalledWith(B, { deleted_at: expect.any(String) })
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Trashed boards' })).getByText('Beta')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Restore Gone' }))
    expect(f.update).toHaveBeenCalledWith(T, { deleted_at: null })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Restore Gone' })).not.toBeInTheDocument())

    await user.click(await screen.findByRole('button', { name: 'Duplicate Alpha2' }))
    expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Copy of Alpha2', visibility: 'private' }))
  })
  it('shows an alert when loading fails validation', async () => {
    const f = fakeClient({ rows: [{ ...row({ id: A }), revision: 'x' } as never] })
    renderApp(f.client, '/boards')
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent)).toBe(true))
  })
})
