import React from 'react'
import styled from 'styled-components'
import { useDraggable } from '@dnd-kit/core'
import { Edit, Eraser } from 'lucide-react'
import type { WantedPoster, DrawingPath } from '../types'
import DrawingOverlay from './DrawingOverlay'
import { CommonActionButton, CommonClearButton } from './BaseComponent'

const WantedContainer = styled.div<{ 
  $rotation: number 
  $isConnecting: boolean
  $isConnectionSource: boolean
  $isConnectedToSource: boolean
}>`
  position: absolute;
  width: 220px;
  height: 300px;
  background: #f8f6f0;
  border: 2px solid #8b4513;
  padding: 16px;
  font-family: 'Courier New', monospace;
  cursor: ${props => props.$isConnecting ? 'crosshair' : 'move'};
  transform: rotate(${props => props.$rotation}deg);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.15),
    0 6px 20px rgba(0, 0, 0, 0.1);
  border: 3px solid ${props => 
    props.$isConnectionSource ? '#22c55e' : 
    props.$isConnectedToSource ? '#f97316' : 
    '#8b4513'
  };
  transition: border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  
  /* Aged paper texture */
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(139, 69, 19, 0.05) 1px, transparent 1px),
    radial-gradient(circle at 80% 70%, rgba(160, 82, 45, 0.04) 1px, transparent 1px),
    linear-gradient(0deg, transparent 24px, rgba(139, 69, 19, 0.02) 25px);
  background-size: 30px 25px, 35px 30px, 100% 25px;
  
  &:hover {
    box-shadow: 
      0 6px 12px rgba(0, 0, 0, 0.2),
      0 8px 25px rgba(0, 0, 0, 0.15);
    transform: rotate(${props => props.$rotation}deg) scale(1.02);
  }
`

const WantedHeader = styled.div`
  text-align: center;
  margin-bottom: 8px;
  flex-shrink: 0;
`

const WantedTitle = styled.h1`
  font-size: 18px;
  font-weight: bold;
  color: #8b0000;
  margin: 0;
  letter-spacing: 2px;
`

const WantedSubtitle = styled.h2`
  font-size: 10px;
  color: #8b4513;
  margin: 2px 0 0 0;
  font-weight: bold;
`

const PhotoFrame = styled.div`
  width: 100px;
  height: 100px;
  margin: 0 auto 8px auto;
  background: #ffffff;
  border: 2px solid #8b4513;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`

const WantedImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: sepia(20%) contrast(1.1);
`

const PlaceholderIcon = styled.div`
  color: #8b4513;
  font-size: 2rem;
`

const WantedInfo = styled.div`
  font-size: 10px;
  line-height: 1.2;
  color: #2d1810;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const InfoRow = styled.div`
  margin-bottom: 4px;
  display: flex;
  flex-wrap: wrap;
  min-height: 0;
`

const InfoLabel = styled.span`
  font-weight: bold;
  color: #8b0000;
  min-width: 45px;
  font-size: 9px;
`

const InfoValue = styled.span`
  flex: 1;
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 9px;
  line-height: 1.1;
`

const RewardSection = styled.div`
  text-align: center;
  margin-top: 8px;
  padding: 6px;
  background: rgba(139, 0, 0, 0.1);
  border: 1px solid #8b0000;
  border-radius: 4px;
  flex-shrink: 0;
`

const RewardText = styled.div`
  font-size: 11px;
  font-weight: bold;
  color: #8b0000;
  margin-bottom: 2px;
`

const RewardAmount = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: #228b22;
`

interface WantedPosterProps {
  poster: WantedPoster
  onClick: () => void
  onConnectionStart: () => void
  onDrawingsUpdate: (posterId: string, drawings: DrawingPath[]) => void
  isConnecting?: boolean
  isConnectionSource?: boolean
  isConnectedToSource?: boolean
  isPenMode?: boolean
  penColor?: string
  penWidth?: number
  onDrawingModeChange?: (isDrawing: boolean) => void
}

const WantedPosterComponent: React.FC<WantedPosterProps> = ({
  poster,
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
    id: poster.id,
    data: {
      type: 'wanted',
      poster: poster,
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
    onDrawingsUpdate(poster.id, drawings as DrawingPath[])
  }

  const handleClearDrawings = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDrawingsUpdate(poster.id, [])
  }

  const style = {
    left: poster.x,
    top: poster.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <WantedContainer
      ref={setNodeRef}
      style={style}
      {...(!isDrawingMode ? listeners : {})}
      {...attributes}
      onClick={handleClick}
      $rotation={poster.rotation}
      $isConnecting={isConnecting}
      $isConnectionSource={isConnectionSource}
      $isConnectedToSource={isConnectedToSource}
      data-component="wanted"
    >
      <CommonActionButton onClick={onClick}>
        <Edit size={16} />
      </CommonActionButton>
      
      <CommonClearButton 
        $visible={!!isPenMode && !!(poster.drawings && poster.drawings.length > 0)}
        onClick={handleClearDrawings}
        title="Clear drawings"
      >
        <Eraser size={16} />
      </CommonClearButton>
      
      <WantedHeader>
        <WantedTitle>WANTED</WantedTitle>
        <WantedSubtitle>DEAD OR ALIVE</WantedSubtitle>
      </WantedHeader>

      <PhotoFrame>
        {poster.imageUrl ? (
          <WantedImage src={poster.imageUrl} alt={poster.name} />
        ) : (
          <PlaceholderIcon>👤</PlaceholderIcon>
        )}
      </PhotoFrame>

      <WantedInfo>
        <InfoRow>
          <InfoLabel>NAME:</InfoLabel>
          <InfoValue>{poster.name || 'Unknown'}</InfoValue>
        </InfoRow>
        
        <InfoRow>
          <InfoLabel>ALIAS:</InfoLabel>
          <InfoValue>{poster.alias || 'None'}</InfoValue>
        </InfoRow>
        
        <InfoRow>
          <InfoLabel>CRIME:</InfoLabel>
          <InfoValue>{poster.crime || 'Various charges'}</InfoValue>
        </InfoRow>
        
        <InfoRow>
          <InfoLabel>DESC:</InfoLabel>
          <InfoValue>{poster.description || 'See photo'}</InfoValue>
        </InfoRow>
      </WantedInfo>

      <RewardSection>
        <RewardText>REWARD</RewardText>
        <RewardAmount>{poster.reward || '$10,000'}</RewardAmount>
      </RewardSection>
      
      <DrawingOverlay
        width={220}
        height={300}
        drawings={poster.drawings || []}
        isDrawingMode={isDrawingMode}
        onDrawingsChange={handleDrawingsUpdate}
        penColor={penColor}
        penWidth={penWidth}
      />
    </WantedContainer>
  )
}

export default WantedPosterComponent
