import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = RO
if (!('DOMMatrixReadOnly' in globalThis)) {
  class M {
    m22: number
    constructor(t?: string) {
      const m = /matrix\(([^)]+)\)/.exec(t ?? '')
      this.m22 = m ? Number((m[1] ?? '').split(',')[3]) : 1
    }
  }
  Object.assign(globalThis, { DOMMatrixReadOnly: M })
}
afterEach(() => cleanup())

// user-event dispatches mouse events without `view`, and d3-zoom (inside xyflow) reads event.view.document
// on mousedown. Real browsers always set `view`; drop such synthetic mousedowns before d3 sees them.
// Only pan/zoom is skipped; click, focus and React handlers are unaffected.
window.addEventListener('mousedown', (e) => { if (!e.view) e.stopImmediatePropagation() }, true)
