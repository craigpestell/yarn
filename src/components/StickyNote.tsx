import React, { useState } from 'react'
import styled from 'styled-components'
import { useDraggable } from '@dnd-kit/core'
import { Pen, Edit } from 'lucide-react'
import type { StickyNote, DrawingPath } from '../types'
import DrawingOverlay from './DrawingOverlay'
import { CommonActionButton, CommonDrawButton } from './BaseComponent'

const StickyNoteContainer = styled.div<{ 
  $rotation: number 
  $color: string
  $isConnecting: boolean
  $isConnectionSource: boolean
  $isConnectedToSource: boolean
  $isGrouped: boolean
  $groupIndex: number
}>`
  position: absolute;
  width: 200px;
  height: 200px;
  background: ${props => props.$color};
  padding: 16px;
  font-family: 'Permanent Marker', cursive;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.4;
  color: #2c3e50;
  text-shadow: 0.5px 0.5px 0px rgba(0, 0, 0, 0.1);
  cursor: ${props => props.$isConnecting ? 'crosshair' : 'move'};
  transform: rotate(${props => props.$rotation}deg);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.1),
    0 6px 20px rgba(0, 0, 0, 0.05);
  border: 3px solid ${props => 
    props.$isConnectionSource ? '#22c55e' : 
    props.$isConnectedToSource ? '#f97316' : 
    'transparent'
  };
  transition: border-color 0.2s ease;
  overflow: hidden;
  word-wrap: break-word;
  z-index: ${props => props.$isGrouped ? (10 - props.$groupIndex) : 1}; /* Layer grouped notes correctly */
  
  /* Paper texture */
  background-image: 
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 24px,
      rgba(0, 0, 0, 0.1) 25px
    );
  
  &:hover {
    box-shadow: 
      0 6px 12px rgba(0, 0, 0, 0.15),
      0 8px 25px rgba(0, 0, 0, 0.08);
  }
  
  /* Sticky note fold effect */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(
      -45deg,
      transparent 46%,
      rgba(0, 0, 0, 0.1) 50%,
      rgba(0, 0, 0, 0.05) 54%,
      transparent 58%
    );
    pointer-events: none;
  }
`

const NoteText = styled.div`
  width: 100%;
  height: 100%;
  outline: none;
  background: transparent;
  border: none;
  resize: none;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  line-height: inherit;
  text-shadow: inherit;
  overflow: hidden; /* Remove scrollbar */
  white-space: pre-wrap;
  letter-spacing: 0.3px;
  
  /* Hide scrollbar for webkit browsers */
  &::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for Firefox */
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  /* Add slight randomness to make it look more handwritten */
  transform: skew(-0.3deg) rotate(0.1deg);
`

const ContinuationIndicator = styled.div`
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
`

const GroupIndicator = styled.div<{ $groupIndex: number }>`
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(59, 130, 246, 0.8);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 50%;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  min-width: 16px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`

interface StickyNoteProps {
  note: StickyNote
  onClick: () => void
  onConnectionStart: () => void
  onDrawingsUpdate: (noteId: string, drawings: DrawingPath[]) => void
  isConnecting?: boolean
  isConnectionSource?: boolean
  isConnectedToSource?: boolean
}

const StickyNoteComponent: React.FC<StickyNoteProps> = ({
  note,
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
    id: note.id,
    data: {
      type: 'note',
      note: note,
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
    onDrawingsUpdate(note.id, drawings as DrawingPath[])
  }

  // Truncate text to fit in sticky note (approximately 150 characters)
  const maxCharsPerNote = 150
  const displayText = note.text.length > maxCharsPerNote 
    ? note.text.substring(0, maxCharsPerNote) + '...'
    : note.text
  const hasMoreText = note.text.length > maxCharsPerNote

  const style = {
    left: note.x,
    top: note.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <StickyNoteContainer
      ref={setNodeRef}
      style={style}
      {...(!isDrawingMode ? listeners : {})}
      {...attributes}
      onClick={handleClick}
      $rotation={note.rotation}
      $color={note.color}
      $isConnecting={isConnecting}
      $isConnectionSource={isConnectionSource}
      $isConnectedToSource={isConnectedToSource}
      $isGrouped={!!note.groupId}
      $groupIndex={note.groupIndex || 0}
      data-component="note"
    >
      {note.groupId && (
        <GroupIndicator $groupIndex={note.groupIndex || 0}>
          {(note.groupIndex || 0) + 1}
        </GroupIndicator>
      )}
      
      <CommonActionButton onClick={onClick}>
        <Edit size={16} />
      </CommonActionButton>
      
      <CommonDrawButton 
        $active={isDrawingMode}
        onClick={handleDrawingToggle}
      >
        <Pen size={16} />
      </CommonDrawButton>
      
      <NoteText>{displayText}</NoteText>
      
      {hasMoreText && (
        <ContinuationIndicator>...</ContinuationIndicator>
      )}
      
      <DrawingOverlay
        width={200}
        height={200}
        drawings={note.drawings || []}
        isDrawingMode={isDrawingMode}
        onDrawingsChange={handleDrawingsUpdate}
      />
    </StickyNoteContainer>
  )
}

export default StickyNoteComponent
