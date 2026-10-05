import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { ReactNode } from 'react'
import type { Widget, WidgetType } from '../../../shared/schema'
import { LinkChip } from '../../links/LinkChip'
import { isResizable } from '../geometry'
import { ResizeHandle } from './ResizeHandle'
import { Thumbtack } from './Thumbtack'
import { useDrag } from './useDrag'

export interface WidgetNodeData extends Record<string, unknown> {
  widget: Widget
  /** Connection-mode highlight: green source, orange already connected to the source. */
  role: 'source' | 'connected' | null
  selected: boolean
  /** Reader mode: the widget cannot be dragged. */
  readOnly?: boolean
}
export type WidgetNode = Node<WidgetNodeData, WidgetType>
export type WidgetNodeProps = NodeProps<WidgetNode>

export const PIN_HANDLE = 'pin'
/** Invisible 2x2 handle whose top-centre sits exactly on the pin point (w/2, 10). */
const pinStyle = (w: number) => ({ left: w / 2 - 1, top: 10, width: 2, height: 2, minWidth: 0, minHeight: 0, transform: 'none', opacity: 0, pointerEvents: 'none' as const, border: 'none' })

export function Frame({ widget, role, selected, readOnly, className, children }: WidgetNodeData & { className: string; children: ReactNode }) {
  const drag = useDrag(widget.id, widget.locked === true || readOnly === true)
  const state = role === 'source' ? 'sel-source' : role === 'connected' ? 'sel-connected' : selected ? 'sel' : ''
  return (
    <div className={`widget nopan ${widget.locked || readOnly ? 'locked' : ''}`} style={{ width: widget.w, height: widget.h }} {...drag}>
      <div className={`art ${className} ${state}`} style={{ transform: `rotate(${widget.rotation}deg)` }}>
        {children}
      </div>
      {widget.status && <span className={`badge badge-${widget.status}`}>{widget.status}</span>}
      <LinkChip widgetId={widget.id} />
      {!widget.locked && !readOnly && isResizable(widget.type) && <ResizeHandle widget={widget} type={widget.type} />}
      <Thumbtack width={widget.w} />
      <Handle id={PIN_HANDLE} type="source" position={Position.Top} isConnectable={false} style={pinStyle(widget.w)} />
      <Handle id={PIN_HANDLE} type="target" position={Position.Top} isConnectable={false} style={pinStyle(widget.w)} />
    </div>
  )
}
