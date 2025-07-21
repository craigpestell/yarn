import React, { useState, useRef, useCallback } from 'react'
import styled from 'styled-components'
import { useDraggable } from '@dnd-kit/core'
import type { CharlieImage as CharlieImageType } from '../types'

const CharlieContainer = styled.div<{
  $width: number
  $height: number
  $isDragging: boolean
}>`
  position: absolute;
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  cursor: ${props => props.$isDragging ? 'grabbing' : 'grab'};
  user-select: none;
  z-index: ${props => props.$isDragging ? 1000 : 10};
  opacity: ${props => props.$isDragging ? 0.8 : 1};
  transition: ${props => props.$isDragging ? 'none' : 'opacity 0.2s ease'};
`

const CharlieImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
`

const ResizeHandle = styled.div`
  position: absolute;
  bottom: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: rgba(59, 130, 246, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 100;

  ${CharlieContainer}:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(59, 130, 246, 0.8);
    transform: scale(1.1);
  }
`

interface CharlieComponentProps {
  charlie: CharlieImageType
  onSizeChange: (id: string, width: number, height: number) => void
}

const CharlieComponent: React.FC<CharlieComponentProps> = ({
  charlie,
  onSizeChange
}) => {
  const { x, y, width = 200, height = 200 } = charlie
  const [isResizing, setIsResizing] = useState(false)
  const [currentWidth, setCurrentWidth] = useState(width)
  const [currentHeight, setCurrentHeight] = useState(height)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: charlie.id,
    data: {
      type: 'charlie',
    },
    disabled: isResizing,
  })

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: currentWidth,
      height: currentHeight
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return

      const deltaX = moveEvent.clientX - resizeStartRef.current.x
      
      // Maintain aspect ratio
      const aspectRatio = resizeStartRef.current.width / resizeStartRef.current.height
      const newWidth = Math.max(50, resizeStartRef.current.width + deltaX)
      const newHeight = newWidth / aspectRatio

      setCurrentWidth(newWidth)
      setCurrentHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      onSizeChange(charlie.id, currentWidth, currentHeight)
      resizeStartRef.current = null
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [currentWidth, currentHeight, charlie.id, onSizeChange])

  const style = {
    left: x,
    top: y,
    transform: transform && !isResizing ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  }

  return (
    <CharlieContainer
      ref={setNodeRef}
      style={style}
      {...(!isResizing ? listeners : {})}
      {...attributes}
      $width={currentWidth}
      $height={currentHeight}
      $isDragging={isDragging}
      data-component="charlie"
    >
      <CharlieImage 
        src="/charlie.png" 
        alt="Charlie" 
        draggable={false}
      />
      
      <ResizeHandle 
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />
    </CharlieContainer>
  )
}

export default CharlieComponent
