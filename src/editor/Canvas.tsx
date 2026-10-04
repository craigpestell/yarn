import { ControlButton, Controls, Position, ReactFlow, getNodesBounds, getViewportForBounds, useNodesInitialized, useReactFlow, useStoreApi, type Edge, type NodeHandle } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { Doc } from '../../shared/schema'
import { connectedTo, widgetLabel } from './docOps'
import { edgeTypes, type YarnEdgeType } from './edges/YarnEdge'
import { nudgeFor, ZOOM_MAX, ZOOM_MIN } from './geometry'
import { PIN_HANDLE, type WidgetNode } from './nodes/Frame'
import { nodeTypes } from './nodes'
import { useBoard, type ConnectState, type Selection } from './store'

/**
 * Pre-measured pin handles, only a fallback for environments that cannot measure the DOM (jsdom).
 * In a browser xyflow measures the real <Handle> elements rendered by Frame, which replace these.
 */
const pinHandles = (w: number): NodeHandle[] =>
  (['source', 'target'] as const).map((type) => ({ id: PIN_HANDLE, type, position: Position.Top, x: w / 2 - 1, y: 10, width: 2, height: 2 }))

export function toNodes(doc: Doc, sel: Selection | null, connect: ConnectState): WidgetNode[] {
  const near = connect.active && connect.source ? connectedTo(doc, connect.source) : new Set<string>()
  return doc.widgets.map((widget) => ({
    id: widget.id,
    type: widget.type,
    position: { x: widget.x, y: widget.y },
    width: widget.w,
    height: widget.h,
    // Explicit `measured` keeps `useNodesInitialized` true: we rebuild node objects on every state change.
    measured: { width: widget.w, height: widget.h },
    handles: pinHandles(widget.w),
    draggable: false,
    ariaLabel: `${widgetLabel(widget)}${widget.locked ? ' (locked)' : ''}`,
    data: {
      widget,
      role: connect.source === widget.id ? 'source' : near.has(widget.id) ? 'connected' : null,
      selected: sel?.kind === 'widget' && sel.id === widget.id,
    },
  }))
}

export function toEdges(doc: Doc, sel: Selection | null): YarnEdgeType[] {
  const label = new Map(doc.widgets.map((w) => [w.id, widgetLabel(w)]))
  return doc.edges.map((e) => ({
    id: e.id,
    type: 'yarn',
    source: e.source,
    target: e.target,
    sourceHandle: PIN_HANDLE,
    targetHandle: PIN_HANDLE,
    selected: sel?.kind === 'edge' && sel.id === e.id,
    ariaLabel: `Yarn between ${label.get(e.source)} and ${label.get(e.target)}`,
    data: { color: e.color },
  }))
}

/**
 * xyflow's own fitView only runs when a queued setNodes is consumed, which never happens in our controlled
 * setup (no onNodesChange), so the Controls fit button and the `fitView` prop silently do nothing in a browser.
 * Compute the viewport ourselves instead.
 */
export function useFit() {
  const store = useStoreApi()
  const rf = useReactFlow()
  return useCallback(() => {
    // Bounds come from the doc (not xyflow's lookup) so a fit right after a board change is not a tick stale.
    const widgets = useBoard.getState().doc.widgets
    const { width, height } = store.getState()
    if (!widgets.length) return true
    if (!width || !height) return false // container not measured yet
    const bounds = getNodesBounds(widgets.map((w) => ({ id: w.id, position: { x: w.x, y: w.y }, width: w.w, height: w.h, data: {} })))
    void rf.setViewport(getViewportForBounds(bounds, width, height, ZOOM_MIN, Math.min(ZOOM_MAX, 1.5), 0.1))
    return true
  }, [rf, store])
}

function FitControls() {
  const fit = useFit()
  return (
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton onClick={fit} title="Fit view" aria-label="Fit view">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      </ControlButton>
    </Controls>
  )
}

/** Fits once nodes are ready, and again whenever the whole board is replaced (load, import, organize). */
function AutoFit() {
  const fit = useFit()
  const fitRef = useRef(fit)
  fitRef.current = fit
  const ready = useNodesInitialized()
  const seq = useBoard((s) => s.fitSeq)
  const done = useRef<number | null>(null)
  useEffect(() => {
    if (!ready || done.current === seq) return
    let id = 0
    let tries = 0
    const attempt = () => {
      // Retry for a short while (timers, not rAF, so a background tab still fits): the doc and xyflow's measured container size can lag the request by a tick.
      if (fitRef.current() || ++tries > 30) done.current = seq
      else id = window.setTimeout(attempt, 16)
    }
    id = window.setTimeout(attempt, 16)
    return () => window.clearTimeout(id)
  }, [ready, seq])
  return null
}

export function Canvas() {
  const doc = useBoard((s) => s.doc)
  const selection = useBoard((s) => s.selection)
  const connect = useBoard((s) => s.connect)
  const nodes = useMemo(() => toNodes(doc, selection, connect), [doc, selection, connect])
  const edges = useMemo(() => toEdges(doc, selection), [doc, selection])

  const focus = useBoard((s) => s.focus)
  const wrapper = useRef<HTMLDivElement>(null)

  // Honour focus requests once xyflow has rendered the target (it renders nodes a tick after props change).
  const handled = useRef(focus?.seq) // ignore a request left over from before this mount
  useEffect(() => {
    if (!focus || focus.seq === handled.current) return
    handled.current = focus.seq
    const started = document.activeElement
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const attempt = () => {
      const root = wrapper.current
      if (!root) return
      // The user moved focus themselves (e.g. into the inspector) while we waited: do not steal it.
      if (document.activeElement !== started && document.activeElement !== document.body) return
      const el = focus.target === 'canvas' ? null : root.querySelector<HTMLElement | SVGElement>(`[data-id="${CSS.escape(focus.target)}"]`)
      if (el) el.focus()
      else if (focus.target === 'canvas' || tries >= 10) root.focus()
      else {
        tries++
        timer = setTimeout(attempt, 20)
      }
    }
    attempt()
    return () => clearTimeout(timer)
  }, [focus])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Element)) return
    const el = e.target.closest<Element>('.react-flow__node, .react-flow__edge')
    const id = el?.getAttribute('data-id')
    if (!el || !id) return
    const isEdge = el.classList.contains('react-flow__edge')
    const s = useBoard.getState()
    if (e.key === 'Delete') {
      e.preventDefault()
      // Hand focus to the next (else previous) sibling, or the canvas, before the element disappears.
      const siblings = [...(wrapper.current?.querySelectorAll(isEdge ? '.react-flow__edge' : '.react-flow__node') ?? [])]
      const i = siblings.indexOf(el)
      const neighbour = (siblings[i + 1] ?? siblings[i - 1])?.getAttribute('data-id')
      s.requestFocus(neighbour ?? 'canvas')
      if (isEdge) s.deleteEdge(id)
      else s.deleteWidget(id)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isEdge) s.activateEdge(id)
      else s.activateWidget(id)
    } else if (!isEdge && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const n = nudgeFor(e.key, e.shiftKey)
      if (!n) return
      e.preventDefault()
      s.moveBy(id, n.dx, n.dy)
    }
  }

  return (
    <div className="canvas" ref={wrapper} tabIndex={-1} onKeyDown={onKeyDown}>
      <ReactFlow<WidgetNode, YarnEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={ZOOM_MIN}
        maxZoom={ZOOM_MAX}
        nodesDraggable={false}
        nodesConnectable={false}
        deleteKeyCode={null}
        disableKeyboardA11y
        zoomOnDoubleClick={false}
        onNodeClick={(_, n) => useBoard.getState().activateWidget(n.id)}
        onEdgeClick={(_, e: Edge) => useBoard.getState().activateEdge(e.id)}
        onPaneClick={() => useBoard.getState().stageClick()}
        aria-label="Conspiracy board"
      >
        <AutoFit />
        <FitControls />
      </ReactFlow>
    </div>
  )
}
