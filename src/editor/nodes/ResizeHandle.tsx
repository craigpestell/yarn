import { useStoreApi } from '@xyflow/react'
import { useRef, type PointerEvent } from 'react'
import { localDelta, RESIZE_RULES, resizedSize, type ResizableType } from '../geometry'
import { useBoard } from '../store'
import { LIMITS, type Widget } from '../../../shared/schema'

interface Press {
  x: number
  y: number
  w: number
  h: number
  pointerId: number
}

/** Bottom-right drag handle. Sizes along the widget's own axes, so it works on rotated widgets and at any zoom. */
export function ResizeHandle({ widget, type }: { widget: Widget; type: ResizableType }) {
  const flow = useStoreApi()
  const press = useRef<Press | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // Keep the widget's own drag and the node click out of this gesture.
    e.stopPropagation()
    e.preventDefault()
    press.current = { x: e.clientX, y: e.clientY, w: widget.w, h: widget.h, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.pointerId) return
    e.stopPropagation()
    const { dx, dy } = localDelta(e.clientX - p.x, e.clientY - p.y, widget.rotation, flow.getState().transform[2])
    const next = resizedSize(p, dx, dy, RESIZE_RULES[type], LIMITS.maxSize)
    useBoard.getState().resizeTo(widget.id, next.w, next.h)
  }
  const end = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.pointerId) return
    e.stopPropagation()
    press.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      className="resize-handle"
      data-testid="resize-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(e) => e.stopPropagation()}
      aria-hidden="true"
    />
  )
}
