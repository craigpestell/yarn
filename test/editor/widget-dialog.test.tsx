import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/App'
import { SAMPLE_DOC, SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'

const s = () => useBoard.getState()
beforeEach(() => {
  s().loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
})
const node = (label: string) => screen.getByRole('group', { name: new RegExp(`^(Photo|Note|Wanted poster|Paper): ${label}`) })
const dialog = () => screen.queryByRole('dialog')

describe('widget dialog: opening', () => {
  it('opens on a click, with a heading name, aria-modal, Detail view and Inspector', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(node('Harbor at dawn'))
    const d = screen.getByRole('dialog', { name: 'Photo: Harbor at dawn' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(d.querySelector('[data-detail-view]')).not.toBeNull()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).toBeNull()
  })
  it('opens on Space', async () => {
    const user = userEvent.setup()
    render(<App />)
    node('Harbor at dawn').focus()
    await user.keyboard(' ')
    expect(dialog()).not.toBeNull()
  })
  it('does not open for an arrow-key nudge or Delete', async () => {
    const user = userEvent.setup()
    render(<App />)
    node('Lantern room').focus()
    await user.keyboard('{ArrowRight}')
    expect(dialog()).toBeNull()
    await user.keyboard('{Delete}')
    expect(dialog()).toBeNull()
  })
  it('does not open for any click in connect mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Connect yarn' }))
    await user.click(node('The keeper'))
    await user.click(node('Harbor at dawn'))
    await user.click(container.querySelector('.react-flow__edge .yarn-main') as Element)
    expect(dialog()).toBeNull()
  })
  it('does not open after a drag or a resize-handle release', () => {
    const { container } = render(<App />)
    const widget = container.querySelector('[data-id="w-keeper"] .widget') as HTMLElement
    fireEvent.pointerDown(widget, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(widget, { clientX: 80, clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(widget, { clientX: 80, clientY: 80, pointerId: 1 })
    fireEvent.click(widget)
    expect(s().doc.widgets.find((w) => w.id === 'w-keeper')?.x).not.toBe(60) // the drag really ran
    expect(dialog()).toBeNull()
    const handle = container.querySelector('[data-id="w-keeper"] [data-testid="resize-handle"]') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0, pointerId: 2 })
    fireEvent.pointerMove(handle, { clientX: 30, clientY: 30, pointerId: 2 })
    fireEvent.pointerUp(handle, { clientX: 30, clientY: 30, pointerId: 2 })
    fireEvent.click(handle)
    expect(s().doc.widgets.find((w) => w.id === 'w-keeper')?.w).not.toBe(200) // the resize really ran
    expect(dialog()).toBeNull()
  })
})

describe('widget dialog: modal behaviour', () => {
  it('focuses the Close control on open and traps Tab and Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(node('Harbor at dawn'))
    const d = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Delete widget' })).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    for (let i = 0; i < 40; i++) {
      await user.tab()
      expect(d.contains(document.activeElement)).toBe(true)
    }
  })
  it('makes the background inert and aria-hidden, and locks body scroll, until closed', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(node('Harbor at dawn'))
    expect(container).toHaveAttribute('inert')
    expect(container).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.queryByRole('group', { name: /^Photo: Harbor/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(container).not.toHaveAttribute('inert')
    expect(container).not.toHaveAttribute('aria-hidden')
    expect(document.body.style.overflow).toBe('')
  })
  it('Escape closes only the dialog, leaving connect mode alone', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(node('Harbor at dawn'))
    s().toggleConnectMode() // as if connect mode were already active behind the dialog
    await user.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(s().selection).toBeNull()
    expect(s().connect.active).toBe(true)
    await waitFor(() => expect(document.activeElement?.getAttribute('data-id')).toBe('w-photo3'))
  })
  it('Escape in connect mode with no dialog still cancels it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Connect yarn' }))
    await user.keyboard('{Escape}')
    expect(s().connect.active).toBe(false)
  })
  it('a backdrop click closes and returns focus; a click inside does not close', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(node('Harbor at dawn'))
    await user.click(screen.getByRole('dialog'))
    expect(dialog()).not.toBeNull()
    await user.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(dialog()).toBeNull()
    await waitFor(() => expect(document.activeElement?.getAttribute('data-id')).toBe('w-photo3'))
  })
  it('Close returns focus to the node; Delete widget and Delete yarn end on the canvas', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(node('Harbor at dawn'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(document.activeElement?.getAttribute('data-id')).toBe('w-photo3'))
    await user.click(node('Harbor at dawn'))
    await user.click(screen.getByRole('button', { name: 'Delete widget' }))
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.canvas')))
    s().select({ kind: 'edge', id: 'e1' })
    await user.click(await screen.findByRole('button', { name: 'Delete yarn' }))
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.canvas')))
  })
})

describe('widget dialog: robustness', () => {
  it('a selection pointing at a missing widget does not swallow later focus requests', async () => {
    const { container } = render(<App />)
    act(() => {
      s().select({ kind: 'widget', id: 'gone' })
      s().requestFocus('canvas')
    })
    expect(dialog()).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.canvas')))
  })
  it('re-applies initial focus when the selection changes while open', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const modal = (open: boolean) => {
      if (open) {
        expect(container).toHaveAttribute('inert')
        expect(container).toHaveAttribute('aria-hidden', 'true')
        expect(document.body.style.overflow).toBe('hidden')
      } else {
        expect(container).not.toHaveAttribute('inert')
        expect(container).not.toHaveAttribute('aria-hidden')
        expect(document.body.style.overflow).toBe('')
      }
    }
    modal(false)
    act(() => s().select({ kind: 'widget', id: 'w-keeper' }))
    const close = await screen.findByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    modal(true)
    act(() => s().select({ kind: 'edge', id: 'e1' }))
    expect(screen.getByRole('dialog', { name: 'Yarn' })).toContainElement(document.activeElement as HTMLElement)
    modal(true)
    act(() => s().select({ kind: 'widget', id: 'w-lamp' }))
    expect(screen.getByRole('dialog', { name: /Lantern room/ })).toContainElement(document.activeElement as HTMLElement)
    modal(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    modal(false)
  })
  it('does not let a focus request steal focus from the open dialog', async () => {
    render(<App />)
    act(() => s().select({ kind: 'widget', id: 'w-keeper' }))
    await screen.findByRole('dialog')
    act(() => (document.activeElement as HTMLElement).blur())
    expect(document.activeElement).toBe(document.body)
    act(() => s().requestFocus('w-keeper'))
    await act(async () => {})
    expect(document.activeElement).toBe(document.body)
  })
  it('Tab from the last control wraps to the first, Shift+Tab from the first to the last', async () => {
    const user = userEvent.setup()
    render(<App />)
    act(() => s().select({ kind: 'edge', id: 'e1' }))
    const first = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'Delete yarn' })
    last.focus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })
})
