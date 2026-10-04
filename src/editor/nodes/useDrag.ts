import { useStoreApi } from '@xyflow/react'
import { useRef, type PointerEvent } from 'react'
import { dragDelta, passesThreshold } from '../geometry'
import { useBoard } from '../store'

interface Press {
  startX: number
  startY: number
  lastX: number
  lastY: number
  active: boolean
  pointerId: number
  /** Sub-pixel remainder carried between moves so slow drags at low zoom still move. */
  remX: number
  remY: number
}

/**
 * Pointer drag for a widget. The pointer delta is divided by the current zoom (read at event time,
 * so never stale) and only starts after an activation threshold.
 */
export function useDrag(id: string, locked: boolean) {
  const flow = useStoreApi()
  const press = useRef<Press | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || locked) return
    press.current = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, pointerId: e.pointerId, remX: 0, remY: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.pointerId) return
    if (!p.active) {
      if (!passesThreshold(e.clientX - p.startX, e.clientY - p.startY)) return
      p.active = true
    }
    const { dx, dy } = dragDelta(e.clientX - p.lastX, e.clientY - p.lastY, flow.getState().transform[2])
    p.lastX = e.clientX
    p.lastY = e.clientY
    p.remX += dx
    p.remY += dy
    const ix = Math.round(p.remX)
    const iy = Math.round(p.remY)
    p.remX -= ix
    p.remY -= iy
    if (ix !== 0 || iy !== 0) useBoard.getState().moveBy(id, ix, iy)
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    const p = press.current
    if (p && e.pointerId !== p.pointerId) return
    press.current = null
    if (p) e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (p?.active) {
      // Swallow the click that follows a drag so it does not select / connect.
      const stop = (ev: Event) => ev.stopPropagation()
      window.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
    }
  }
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end }
}
