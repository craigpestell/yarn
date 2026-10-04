import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhotoImage } from '../../src/editor/nodes/PhotoNode'

describe('PhotoImage', () => {
  it('shows an https image with its title as alt text', () => {
    const { container } = render(<PhotoImage image="https://upload.wikimedia.org/a.jpg" title="The tent" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://upload.wikimedia.org/a.jpg')
    expect(img).toHaveAttribute('alt', 'The tent')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  })
  it('falls back to the placeholder with no image, a Storage path, or a load error', () => {
    for (const image of [undefined, 'u1/pic.png']) {
      const { container, unmount } = render(<PhotoImage image={image} title="x" />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
    const { container } = render(<PhotoImage image="https://upload.wikimedia.org/gone.jpg" title="x" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
