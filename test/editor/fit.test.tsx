import { ReactFlowProvider, useStore } from '@xyflow/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Canvas, toNodes } from '../../src/editor/Canvas'
import { SAMPLE_DOC, SAMPLE_TITLE } from '../../src/editor/sample'
import { useBoard } from '../../src/editor/store'

let initialized: boolean | null = null
function Probe() {
  initialized = useStore((s) => s.nodesInitialized)
  return null
}

beforeEach(() => {
  useBoard.getState().loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
})

/**
 * Nodes must carry explicit `measured` dimensions so `useNodesInitialized` stays true while we rebuild node
 * objects on every doc/selection change.
 */
describe('fit view prerequisites', () => {
  it('every node carries explicit measured size equal to the widget size', () => {
    for (const n of toNodes(SAMPLE_DOC, null, { active: false, source: null })) {
      expect(n.measured).toEqual({ width: n.data.widget.w, height: n.data.widget.h })
    }
  })
  it('stays initialized after node objects are rebuilt (selection, move, add)', () => {
    render(
      <ReactFlowProvider>
        <Canvas />
        <Probe />
      </ReactFlowProvider>,
    )
    expect(initialized).toBe(true)
    act(() => useBoard.getState().select({ kind: 'widget', id: 'w-lamp' }))
    expect(initialized).toBe(true)
    act(() => useBoard.getState().moveBy('w-lamp', 10, 10))
    expect(initialized).toBe(true)
    act(() => useBoard.getState().addWidget('note'))
    expect(initialized).toBe(true)
  })
})


let transform: [number, number, number] = [0, 0, 1]
function TransformProbe() {
  transform = useStore((s) => s.transform)
  return null
}
const mount = () =>
  render(
    <ReactFlowProvider initialWidth={1000} initialHeight={800}>
      <Canvas />
      <TransformProbe />
    </ReactFlowProvider>,
  )

/** Regression: xyflow's own fitView never resolves in our controlled setup, so we fit ourselves. */
describe('fit view', () => {
  it('fits on mount', async () => {
    mount()
    await waitFor(() => expect(transform).not.toEqual([0, 0, 1]))
    expect(transform[2]).toBeGreaterThan(0)
  })
  it('refits when a board is imported', async () => {
    mount()
    await waitFor(() => expect(transform).not.toEqual([0, 0, 1]))
    const before = [...transform]
    const far = { ...SAMPLE_DOC, widgets: SAMPLE_DOC.widgets.map((w) => ({ ...w, x: w.x + 5000 })) }
    act(() => void useBoard.getState().importJson(JSON.stringify({ title: 'Far', doc: far })))
    await waitFor(() => expect(transform).not.toEqual(before))
  })
  it('the Fit view button refits after the user pans', async () => {
    mount()
    await waitFor(() => expect(transform).not.toEqual([0, 0, 1]))
    const fitted = [...transform]
    fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }))
    await waitFor(() => expect(transform).not.toEqual(fitted))
    fireEvent.click(screen.getByRole('button', { name: 'Fit view' }))
    await waitFor(() => expect(transform).toEqual(fitted))
  })
})
