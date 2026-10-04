import { describe, expect, it } from 'vitest'
import { clampZoom, dragDelta, nudgeFor, passesThreshold, yarnPath } from '../../src/editor/geometry'

describe('dragDelta', () => {
  it('divides the screen delta by zoom', () => {
    expect(dragDelta(100, 50, 2)).toEqual({ dx: 50, dy: 25 })
    expect(dragDelta(30, -30, 0.5)).toEqual({ dx: 60, dy: -60 })
    expect(dragDelta(10, 10, 1)).toEqual({ dx: 10, dy: 10 })
  })
  it('clamps absurd zoom values instead of dividing by zero', () => {
    expect(dragDelta(30, 0, 0)).toEqual({ dx: 300, dy: 0 })
    expect(dragDelta(30, 0, 100).dx).toBe(10)
    expect(dragDelta(30, 0, Number.NaN).dx).toBe(30)
  })
})
describe('geometry helpers', () => {
  it('clamps zoom to 0.1-3', () => {
    expect(clampZoom(0.01)).toBe(0.1)
    expect(clampZoom(9)).toBe(3)
    expect(clampZoom(1.5)).toBe(1.5)
  })
  it('has an activation threshold', () => {
    expect(passesThreshold(1, 1)).toBe(false)
    expect(passesThreshold(4, 0)).toBe(true)
  })
  it('maps arrows to nudges', () => {
    expect(nudgeFor('ArrowLeft', false)).toEqual({ dx: -10, dy: 0 })
    expect(nudgeFor('ArrowDown', true)).toEqual({ dx: 0, dy: 50 })
    expect(nudgeFor('a', false)).toBeNull()
  })
  it('sags below the straight line', () => {
    expect(yarnPath(0, 0, 100, 0)).toBe('M 0 0 Q 50 18 100 0')
  })
})
