import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { DrawingPath } from '../types'

// Base component interface
interface BaseComponentProps {
  id: string
  x: number
  y: number
  drawings?: DrawingPath[]
  onClick: () => void
  onConnectionStart: () => void
  onDrawingsUpdate: (id: string, drawings: DrawingPath[]) => void
  isConnecting?: boolean
  dragData: {
    type: string
    [key: string]: unknown
  }
  width: number
  height: number
}

// Hook for common functionality
export const useBaseComponent = ({
  id,
  x,
  y,
  drawings,
  onClick,
  onConnectionStart,
  onDrawingsUpdate,
  isConnecting = false,
  dragData,
  width,
  height
}: BaseComponentProps) => {
  const [isDrawingMode, setIsDrawingMode] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: dragData,
    disabled: isDrawingMode,
  })

  const handleClick = (e: React.MouseEvent) => {
    if (isDrawingMode) {
      e.stopPropagation()
      return
    }
    
    e.stopPropagation()
    
    if (isConnecting) {
      onConnectionStart()
    } else {
      onClick()
    }
  }

  const handleDrawingToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDrawingMode(!isDrawingMode)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClick()
  }

  const handleDrawingsChange = (newDrawings: unknown[]) => {
    onDrawingsUpdate(id, newDrawings as DrawingPath[])
  }

  const style = {
    left: x,
    top: y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return {
    isDrawingMode,
    setNodeRef,
    style,
    listeners: !isDrawingMode ? listeners : {},
    attributes,
    handleClick,
    handleDrawingToggle,
    handleMenuClick,
    handleDrawingsChange,
    isDragging,
    width,
    height,
    drawings
  }
}
