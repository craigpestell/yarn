import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DetailView } from '../../src/components/widget-dialog/DetailView'
import type { Widget } from '../../shared/schema'
import type { LinkView } from '../../src/links/schemas'

const base = { id: 'w', x: 0, y: 0, w: 200, h: 200, rotation: 0, sources: [] }
const LONG = 'Long line that would be clipped on the board. '.repeat(20).trim()

describe('DetailView', () => {
  it('shows the full text of a note, plain and unclipped, on its colour', () => {
    const w: Widget = { ...base, type: 'note', status: 'disputed', data: { text: `${LONG}\nSecond line`, color: '#fef08a' } }
    const { container } = render(<DetailView widget={w} />)
    expect(container.querySelector('p')?.textContent).toBe(`${LONG}\nSecond line`)
    expect(screen.getByText('disputed')).toBeInTheDocument()
    expect(container.querySelector('label')).toBeNull()
    expect(container.querySelector('.note, .paper, .wanted, .polaroid, .link-chip')).toBeNull()
  })
  it('shows every non-empty field of a wanted poster and skips empty ones', () => {
    const w: Widget = { ...base, type: 'wanted', data: { name: 'Captain Ardent', alias: '', crime: 'Selling fog charts', description: LONG, reward: '50 gulls' } }
    const { container } = render(<DetailView widget={w} />)
    for (const t of ['Captain Ardent', 'Selling fog charts', LONG, '50 gulls']) expect(screen.getByText(t)).toBeInTheDocument()
    expect(container.querySelectorAll('p')).toHaveLength(4)
  })
  it('shows paper content in full', () => {
    const w: Widget = { ...base, type: 'paper', data: { content: 'Ferry timetable\n\nMon: 9:10' } }
    const { container } = render(<DetailView widget={w} />)
    expect(container.querySelector('p')?.textContent).toBe('Ferry timetable\n\nMon: 9:10')
  })
  it('shows a photo image only when present (https), with title and caption', () => {
    const w: Widget = { ...base, type: 'photo', data: { title: 'The tent', caption: 'At dusk', image: 'https://upload.wikimedia.org/a.jpg' } }
    const { container, rerender } = render(<DetailView widget={w} />)
    expect(screen.getByRole('img', { name: 'The tent' })).toHaveAttribute('src', 'https://upload.wikimedia.org/a.jpg')
    expect(screen.getByText('At dusk')).toBeInTheDocument()
    rerender(<DetailView widget={{ ...w, data: { title: 'The tent', caption: 'At dusk' } }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })
  it('renders sources as text, linking only http(s) URLs safely', () => {
    const w: Widget = {
      ...base,
      type: 'note',
      data: { text: 'x', color: '#fef08a' },
      sources: [
        { url: 'https://example.com/a', title: 'Source A', license: 'CC BY 4.0', attribution: 'Jane Doe', retrievedAt: '2026-01-01T00:00:00Z' },
        { url: 'http://example.com/b', retrievedAt: '2026-01-01T00:00:00Z' },
        { url: 'ftp://example.com/c', retrievedAt: '2026-01-01T00:00:00Z' },
      ],
    }
    render(<DetailView widget={w} />)
    const a = screen.getByRole('link', { name: 'https://example.com/a' })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'http://example.com/b' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText('ftp://example.com/c')).toBeInTheDocument()
    for (const t of ['Source A', 'CC BY 4.0', 'Jane Doe']) expect(screen.getByText(t)).toBeInTheDocument()
  })
  it('shows the linked board as a plain anchor, reporting the follow', () => {
    const link: LinkView = { linkId: 'l', widgetId: 'w', toBoardId: 'b', title: 'Other board', slug: 'other-board' }
    const onFollow = vi.fn()
    const w: Widget = { ...base, type: 'paper', data: { content: 'x' } }
    render(<DetailView widget={w} link={link} onFollow={onFollow} />)
    const a = screen.getByRole('link', { name: 'Open board: Other board' })
    expect(a).toHaveAttribute('href', '/b/other-board')
    a.addEventListener('click', (e) => e.preventDefault())
    a.click()
    expect(onFollow).toHaveBeenCalledWith('other-board')
  })
  it('shows "Board unavailable" as a note, with no title or slug', () => {
    const link: LinkView = { linkId: 'l', widgetId: 'w', toBoardId: 'b', title: null, slug: null }
    const w: Widget = { ...base, type: 'paper', data: { content: 'x' } }
    render(<DetailView widget={w} link={link} />)
    expect(within(screen.getByRole('note')).queryByRole('link')).toBeNull()
    expect(screen.getByRole('note')).toHaveTextContent('Board unavailable')
  })
})
