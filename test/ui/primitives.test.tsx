import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/fieldset'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

describe('ui primitives', () => {
  it('Button defaults to type=button and allows override', () => {
    render(<><Button>a</Button><Button type="submit">b</Button></>)
    expect(screen.getByText('a')).toHaveAttribute('type', 'button')
    expect(screen.getByText('b')).toHaveAttribute('type', 'submit')
  })
  it('applies variant classes', () => {
    render(<Button variant="destructive">x</Button>)
    expect(screen.getByText('x')).toHaveClass('bg-destructive-soft')
  })
  it('cn merges conflicting utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('FieldError has role alert', () => {
    render(<FieldError>bad</FieldError>)
    expect(screen.getByRole('alert')).toHaveTextContent('bad')
  })
  it('Label inline does not leak to the DOM', () => {
    const { container } = render(<Label inline>t<input /></Label>)
    expect(container.querySelector('label')?.hasAttribute('inline')).toBe(false)
  })
})
