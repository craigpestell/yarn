import React from 'react'
import styled from 'styled-components'
import { useDraggable } from '@dnd-kit/core'
import { Edit, Eraser } from 'lucide-react'
import type { LinedPaper, DrawingPath } from '../types'
import DrawingOverlay from './DrawingOverlay'
import { CommonActionButton, CommonClearButton } from './BaseComponent'

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
  isPenMode?: boolean
  penColor?: string
  penWidth?: number
  onDrawingModeChange?: (isDrawing: boolean) => void
}

const LinedPaperComponent: React.FC<LinedPaperProps> = ({
  paper,
  onClick,
  onConnectionStart,
  onDrawingsUpdate,
  isConnecting = false,
  isConnectionSource = false,
  isConnectedToSource = false,
  isPenMode = false,
  penColor = '#000000',
  penWidth = 2,
  onDrawingModeChange
}) => {
  // Remove local drawing state, use global pen mode
  const isDrawingMode = isPenMode
  
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

  const handleDrawingsUpdate = (drawings: unknown[]) => {
    onDrawingsUpdate(paper.id, drawings as DrawingPath[])
  }

  const handleClearDrawings = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDrawingsUpdate(paper.id, [])
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
      <CommonActionButton onClick={onClick}>
        <Edit size={16} />
      </CommonActionButton>
      
      <CommonClearButton 
        $visible={!!isPenMode && !!(paper.drawings && paper.drawings.length > 0)}
        onClick={handleClearDrawings}
        title="Clear drawings"
      >
        <Eraser size={16} />
      </CommonClearButton>
      
      <PaperContent>
        {paper.content || 'Write your notes here...'}
      </PaperContent>
      
      <DrawingOverlay
        width={255}
        height={330}
        drawings={paper.drawings || []}
        isDrawingMode={isDrawingMode}
        onDrawingsChange={handleDrawingsUpdate}
        penColor={penColor}
        penWidth={penWidth}
      />
    </PaperContainer>
  )
}

export default LinedPaperComponent
