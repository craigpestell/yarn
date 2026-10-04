import { ControlButton, Controls, ReactFlow, ReactFlowProvider, useNodesInitialized } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef } from 'react'
import type { Doc } from '../../shared/schema'
import { toEdges, toNodes, useFit } from '../editor/Canvas'
import { edgeTypes } from '../editor/edges/YarnEdge'
import { ZOOM_MAX, ZOOM_MIN } from '../editor/geometry'
import { nodeTypes } from '../editor/nodes'

const IDLE = { active: false, source: null } as const

function FitOnce({ doc }: { doc: Doc }) {
  const getWidgets = useMemo(() => () => doc.widgets, [doc])
  const fit = useFit(getWidgets)
  const fitRef = useRef(fit)
  fitRef.current = fit
  const ready = useNodesInitialized()
  useEffect(() => {
    if (!ready) return
    let tries = 0
    let id = 0
    const attempt = () => {
      if (!fitRef.current() && ++tries <= 30) id = window.setTimeout(attempt, 16)
    }
    id = window.setTimeout(attempt, 16)
    return () => window.clearTimeout(id)
  }, [ready, doc])
  return (
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton onClick={() => fitRef.current()} title="Fit view" aria-label="Fit view">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      </ControlButton>
    </Controls>
  )
}

/** Pan/zoom only: nothing can be selected, dragged, connected or edited. Used by the /b/:slug reader. */
export function ReadOnlyCanvas({ doc }: { doc: Doc }) {
  const nodes = useMemo(() => toNodes(doc, null, IDLE, true), [doc])
  const edges = useMemo(() => toEdges(doc, null), [doc])
  return (
    <div className="canvas reader-canvas">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={ZOOM_MIN}
          maxZoom={ZOOM_MAX}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          aria-label="Conspiracy board (read only)"
        >
          <FitOnce doc={doc} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
