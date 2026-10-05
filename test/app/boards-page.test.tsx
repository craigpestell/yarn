import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import { fakeClient, row, USER_ID, type Row } from './fakeClient'
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

  describe('permanent delete', () => {
    const T2 = '00000000-0000-4000-8000-0000000000d4'
    const trashRows = () => [...rows(), row({ id: T2, title: 'Gone too', deleted_at: '2026-10-02T00:00:00Z' })]
    // Like the real RPCs, the handlers remove the rows, so a reload is observable as the rows disappearing.
    const handlers = (calls: string[], data: Row[] = []) => ({
      empty_my_trash: (): { data: unknown; error: null } => {
        calls.push('empty')
        for (const id of [T, T2]) {
          const i = data.findIndex((r) => r.id === id)
          if (i >= 0) data.splice(i, 1)
        }
        return { data: [T, T2], error: null }
      },
      delete_trashed_board: (a: Record<string, unknown>): { data: unknown; error: null } => {
        calls.push(`delete:${String(a.p_id)}`)
        const i = data.findIndex((r) => r.id === a.p_id)
        if (i >= 0) data.splice(i, 1)
        return { data: true, error: null }
      },
    })

    it('hides Empty trash when the trash is empty', async () => {
      renderApp(fakeClient({ rows: rows().slice(0, 2) }).client, '/boards')
      await screen.findByText('Trash is empty.')
      expect(screen.queryByRole('button', { name: 'Empty trash' })).not.toBeInTheDocument()
    })
    it('confirms, empties the trash, reloads and requests thumbnail removal; axe clean closed and open', async () => {
      const calls: string[] = []
      const data = trashRows()
      const f = fakeClient({ rows: data, rpc: handlers(calls, data) })
      const user = userEvent.setup()
      const { container } = renderApp(f.client, '/boards')
      const trigger = await screen.findByRole('button', { name: 'Empty trash' })
      expect((await axe(container)).violations).toEqual([])
      await user.click(trigger)
      const dialog = screen.getByRole('alertdialog', { name: 'Empty trash?' })
      expect(dialog).toHaveAccessibleDescription(/2 boards currently in the trash will be permanently deleted\. This cannot be undone\./)
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect((await axe(container)).violations).toEqual([])
      await user.tab()
      expect(within(dialog).getByRole('button', { name: 'Empty trash' })).toHaveFocus()
      await user.tab()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      await user.click(within(dialog).getByRole('button', { name: 'Empty trash' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(calls).toEqual(['empty'])
      // the list reloaded: the trash is now empty and the button is gone
      expect(await screen.findByText('Trash is empty.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Empty trash' })).not.toBeInTheDocument()
      expect(f.bucket.remove).toHaveBeenCalledWith([
        `${USER_ID}/${T}.png`, `${USER_ID}/pub-${T}.png`, `${USER_ID}/${T2}.png`, `${USER_ID}/pub-${T2}.png`,
      ])
    })
    it('cancel (button and Escape) deletes nothing and restores focus to the trigger', async () => {
      const calls: string[] = []
      const user = userEvent.setup()
      renderApp(fakeClient({ rows: trashRows(), rpc: handlers(calls) }).client, '/boards')
      const trigger = await screen.findByRole('button', { name: 'Delete forever: Gone' })
      await user.click(trigger)
      expect(screen.getByRole('alertdialog', { name: 'Delete forever?' })).toHaveAccessibleDescription(/^1 board currently/)
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
      await user.click(trigger)
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
      expect(calls).toEqual([])
    })
    it('traps Shift+Tab inside the dialog', async () => {
      const user = userEvent.setup()
      renderApp(fakeClient({ rows: trashRows(), rpc: handlers([]) }).client, '/boards')
      await user.click(await screen.findByRole('button', { name: 'Empty trash' }))
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(within(dialog).getByRole('button', { name: 'Empty trash' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    })
    it.each([
      ['rejects', () => Promise.reject(new Error('storage down'))],
      ['resolves with an error', () => Promise.resolve({ data: null, error: { message: 'denied' } })],
      ['resolves with nothing removed', () => Promise.resolve({ data: [], error: null })],
    ])('shows no error and still reloads when bucket.remove %s', async (_name, remove) => {
      const calls: string[] = []
      const data = trashRows()
      const f = fakeClient({ rows: data, rpc: handlers(calls, data) })
      f.bucket.remove.mockImplementation(remove as never)
      const user = userEvent.setup()
      renderApp(f.client, '/boards')
      await user.click(await screen.findByRole('button', { name: 'Delete forever: Gone too' }))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete forever' }))
      await waitFor(() => expect(screen.queryByText('Gone too')).not.toBeInTheDocument())
      expect(f.bucket.remove).toHaveBeenCalled()
      expect(calls).toEqual([`delete:${T2}`])
      expect(screen.getByText('Gone')).toBeInTheDocument()
      expect(screen.getAllByRole('alert').every((a) => !a.textContent)).toBe(true)
    })
    it('deletes one board forever through its own RPC', async () => {
      const calls: string[] = []
      const data = trashRows()
      const f = fakeClient({ rows: data, rpc: handlers(calls, data) })
      const user = userEvent.setup()
      renderApp(f.client, '/boards')
      await user.click(await screen.findByRole('button', { name: 'Delete forever: Gone too' }))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete forever' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(calls).toEqual([`delete:${T2}`])
      await waitFor(() => expect(screen.queryByText('Gone too')).not.toBeInTheDocument())
      expect(screen.getByText('Gone')).toBeInTheDocument()
      // the opener row is gone, so focus falls back to the Trash heading
      expect(screen.getByRole('heading', { name: 'Trash' })).toHaveFocus()
      expect(f.bucket.remove).toHaveBeenCalledWith([`${USER_ID}/${T2}.png`, `${USER_ID}/pub-${T2}.png`])
    })
    it('shows the failure in the alert and disables controls while busy', async () => {
      let release: () => void = () => undefined
      const gate = new Promise<void>((r) => { release = r })
      const f = fakeClient({
        rows: trashRows(),
        rpc: { empty_my_trash: async () => { await gate; return { data: null, error: { message: 'boom' } } } },
      })
      const user = userEvent.setup()
      renderApp(f.client, '/boards')
      await user.click(await screen.findByRole('button', { name: 'Empty trash' }))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Empty trash' }))
      expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Empty trash' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Restore Gone' })).toBeDisabled()
      release()
      await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /Could not empty the trash: boom/.test(a.textContent ?? ''))).toBe(true))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(f.bucket.remove).not.toHaveBeenCalled()
    })
  })
})
