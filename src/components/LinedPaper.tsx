import React, { useState } from 'react'
import styled from 'styled-components'
import { useDraggable } from '@dnd-kit/core'
import { Pen } from 'lucide-react'
import type { LinedPaper, DrawingPath } from '../types'
import DrawingOverlay from './DrawingOverlay'

const PaperContainer = styled.div<{ 
  $rotation: number 
  $isConnecting: boolean
  $isConnectionSource: boolean
  $isConnectedToSource: boolean
}>`
  position: absolute;
  width: 255px; /* 8.5 inches scaled down */
  height: 330px; /* 11 inches scaled down */
  background: #ffffff;
  border: 1px solid #e0e0e0;
  cursor: ${props => props.$isConnecting ? 'crosshair' : 'move'};
  transform: rotate(${props => props.$rotation}deg);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.1),
    0 6px 20px rgba(0, 0, 0, 0.05);
  border: 2px solid ${props => 
    props.$isConnectionSource ? '#22c55e' : 
    props.$isConnectedToSource ? '#f97316' : 
    '#e0e0e0'
  };
  transition: border-color 0.2s ease;
  overflow: hidden;
  
  /* Paper texture */
  background-image: 
    /* Red margin line */
    linear-gradient(to right, transparent 40px, #ff6b6b 40px, #ff6b6b 41px, transparent 41px),
    /* Blue horizontal lines */
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 19px,
      #4285f4 19px,
      #4285f4 20px
    ),
    /* Three-hole punch */
    radial-gradient(circle at 42px 60px, transparent 4px, white 4px, white 6px, #f0f0f0 6px, #f0f0f0 8px, transparent 8px),
    radial-gradient(circle at 42px 165px, transparent 4px, white 4px, white 6px, #f0f0f0 6px, #f0f0f0 8px, transparent 8px),
    radial-gradient(circle at 42px 270px, transparent 4px, white 4px, white 6px, #f0f0f0 6px, #f0f0f0 8px, transparent 8px);
    
  background-color: #fefefe;
  
  /* Subtle paper grain */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 1px,
        rgba(0, 0, 0, 0.01) 1px,
        rgba(0, 0, 0, 0.01) 2px
      );
    pointer-events: none;
  }
`

const DrawButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: ${props => props.$active ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)'};
  color: ${props => props.$active ? 'white' : '#374151'};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s ease;
  z-index: 110;
  
  &:hover {
    opacity: 1;
    background: ${props => props.$active ? '#2563eb' : 'rgba(255, 255, 255, 1)'};
    transform: scale(1.1);
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`

const PaperContent = styled.div`
  position: absolute;
  top: 30px;
  left: 50px;
  right: 20px;
  bottom: 20px;
  font-family: 'Permanent Marker', cursive;
  font-size: 14px;
  line-height: 20px;
  color: #2d3748;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  
  /* Handwritten text effect */
  text-shadow: 0.5px 0.5px 0.5px rgba(0, 0, 0, 0.1);
`

interface LinedPaperProps {
  paper: LinedPaper
  onClick: () => void
  onConnectionStart: () => void
  onDrawingsUpdate: (paperId: string, drawings: DrawingPath[]) => void
  isConnecting?: boolean
  isConnectionSource?: boolean
  isConnectedToSource?: boolean
}

const LinedPaperComponent: React.FC<LinedPaperProps> = ({
  paper,
  onClick,
  onConnectionStart,
  onDrawingsUpdate,
  isConnecting = false,
  isConnectionSource = false,
  isConnectedToSource = false
}) => {
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: paper.id,
    data: {
      type: 'paper',
      paper: paper,
    },
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
    setIsDrawingMode(!isDrawingMode)
  }

  const handleDrawingsUpdate = (drawings: unknown[]) => {
    onDrawingsUpdate(paper.id, drawings as DrawingPath[])
  }

  const style = {
    left: paper.x,
    top: paper.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <PaperContainer
      ref={setNodeRef}
      style={style}
      {...(!isDrawingMode ? listeners : {})}
      {...attributes}
      onClick={handleClick}
      $rotation={paper.rotation}
      $isConnecting={isConnecting}
      $isConnectionSource={isConnectionSource}
      $isConnectedToSource={isConnectedToSource}
      data-component="paper"
    >
      <DrawButton
        $active={isDrawingMode}
        onClick={handleDrawingToggle}
      >
        <Pen />
      </DrawButton>
      
      <PaperContent>
        {paper.content || 'Write your notes here...'}
      </PaperContent>
      
      <DrawingOverlay
        width={255}
        height={330}
        drawings={paper.drawings || []}
        isDrawingMode={isDrawingMode}
        onDrawingsChange={handleDrawingsUpdate}
      />
    </PaperContainer>
  )
}

export default LinedPaperComponent
