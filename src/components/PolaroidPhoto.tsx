import React from 'react'
import styled from 'styled-components'
import { Edit, Eraser } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { Photo, DrawingPath } from '../types'
import DrawingOverlay from './DrawingOverlay'
import { CommonActionButton, CommonClearButton } from './BaseComponent'

const PolaroidContainer = styled.div<{
  $rotation: number
  $isConnecting: boolean
  $isConnectionSource: boolean
  $isConnectedToSource: boolean
}>`
  position: absolute;
  width: 200px;
  height: 240px;
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.1),
    0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 16px 16px 50px 16px;
  cursor: ${props => props.$isConnecting ? 'crosshair' : 'pointer'};
  transition: all 0.2s ease;
  transform: rotate(${props => props.$rotation}deg);
  z-index: 10;
  overflow: hidden;

  border: 3px solid ${props => 
    props.$isConnectionSource ? '#38a169' : 
    props.$isConnectedToSource ? '#f56500' : 
    'transparent'
  };

  &:hover {
    transform: rotate(${props => props.$rotation}deg) scale(1.05);
    box-shadow: 
      0 8px 16px rgba(0, 0, 0, 0.15),
      0 12px 30px rgba(0, 0, 0, 0.2);
    z-index: 100;
  }
`

const PhotoFrame = styled.div`
  width: 100%;
  height: 140px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 12px;
  position: relative;
`

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0aec0;
  font-size: 14px;
  background: linear-gradient(45deg, transparent 40%, #e2e8f0 40%, #e2e8f0 60%, transparent 60%);
`

const PhotoNote = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: #2d3748;
  margin-bottom: 8px;
  min-height: 30px;
  white-space: pre-wrap;
  word-break: break-word;
`

const PhotoUrl = styled.div`
  position: absolute;
  bottom: 12px;
  left: 16px;
  right: 16px;
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: #718096;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface PolaroidPhotoProps {
  photo: Photo
  onClick: () => void
  onConnectionStart: () => void
  onDrawingsUpdate: (photoId: string, drawings: DrawingPath[]) => void
  isConnecting?: boolean
  isConnectionSource?: boolean
  isConnectedToSource?: boolean
  isPenMode?: boolean
  penColor?: string
  penWidth?: number
  onDrawingModeChange?: (isDrawing: boolean) => void
}

const PolaroidPhoto: React.FC<PolaroidPhotoProps> = ({
  photo,
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
    id: photo.id,
    data: {
      type: 'photo',
      photo: photo,
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
    onDrawingsUpdate(photo.id, drawings as DrawingPath[])
  }

  const handleClearDrawings = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDrawingsUpdate(photo.id, [])
  }

  const style = {
    left: photo.x,
    top: photo.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <PolaroidContainer
      ref={setNodeRef}
      style={style}
      {...(!isDrawingMode ? listeners : {})}
      {...attributes}
      onClick={handleClick}
      $rotation={photo.rotation}
      $isConnecting={isConnecting}
      $isConnectionSource={isConnectionSource}
      $isConnectedToSource={isConnectedToSource}
      data-component="photo"
    >
      <CommonActionButton onClick={onClick}>
        <Edit size={16} />
      </CommonActionButton>

      <CommonClearButton 
        $visible={!!isPenMode && !!(photo.drawings && photo.drawings.length > 0)}
        onClick={handleClearDrawings}
        title="Clear drawings"
      >
        <Eraser size={16} />
      </CommonClearButton>

      <PhotoFrame>
        {photo.imageUrl ? (
          <Image src={photo.imageUrl} alt={photo.title} />
        ) : (
          <ImagePlaceholder>No Image</ImagePlaceholder>
        )}
      </PhotoFrame>
      
      <PhotoNote>{photo.notes}</PhotoNote>
      <PhotoUrl>{photo.url}</PhotoUrl>

      <DrawingOverlay
        width={200}
        height={240}
        drawings={photo.drawings || []}
        isDrawingMode={isDrawingMode}
        onDrawingsChange={handleDrawingsUpdate}
        penColor={penColor}
        penWidth={penWidth}
      />
    </PolaroidContainer>
  )
}

export default PolaroidPhoto
