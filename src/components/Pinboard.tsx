import React, { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Stage, Layer, Line } from 'react-konva'
import type { Stage as KonvaStage } from 'konva/lib/Stage'
import PolaroidPhoto from './PolaroidPhoto'
import StickyNote from './StickyNote'
import WantedPoster from './WantedPoster'
import LinedPaper from './LinedPaper'
import type { Photo, StickyNote as StickyNoteType, WantedPoster as WantedPosterType, LinedPaper as LinedPaperType, YarnConnection } from '../types'

const CSSThumbTack = styled.div`
  position: absolute;
  width: 16px;
  height: 16px;
  pointer-events: none;
  z-index: 50; /* Lower z-index to avoid interfering with components */
  
  /* Main pin head */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #ff6b6b, #e74c3c);
    box-shadow: 
      0 2px 4px rgba(0, 0, 0, 0.3),
      inset 0 1px 2px rgba(255, 255, 255, 0.4);
  }
  
  /* Pin center hole */
  &::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    background: #8b0000;
    border-radius: 50%;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
  }
`

const PinboardContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  /* Remove old background - let parent's corkboard image show through */
`

interface PinboardProps {
  photos: Photo[]
  notes: StickyNoteType[]
  wantedPosters: WantedPosterType[]
  papers: LinedPaperType[]
  connections: YarnConnection[]
  onPhotoClick: (photo: Photo) => void
  onNoteClick: (note: StickyNoteType) => void
  onWantedClick: (poster: WantedPosterType) => void
  onPaperClick: (paper: LinedPaperType) => void
  onPhotoDrawingsUpdate: (photoId: string, drawings: unknown[]) => void
  onNoteDrawingsUpdate: (noteId: string, drawings: unknown[]) => void
  onWantedDrawingsUpdate: (posterId: string, drawings: unknown[]) => void
  onPaperDrawingsUpdate: (paperId: string, drawings: unknown[]) => void
  onAddConnection: (fromItemId: string, toItemId: string, fromItemType: 'photo' | 'note' | 'wanted' | 'paper', toItemType: 'photo' | 'note' | 'wanted' | 'paper') => void
  isConnectionMode?: boolean
}

const Pinboard: React.FC<PinboardProps> = ({
  photos,
  notes,
  wantedPosters,
  papers,
  connections,
  onPhotoClick,
  onNoteClick,
  onWantedClick,
  onPaperClick,
  onPhotoDrawingsUpdate,
  onNoteDrawingsUpdate,
  onWantedDrawingsUpdate,
  onPaperDrawingsUpdate,
  onAddConnection,
  isConnectionMode = false
}) => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectingFromType, setConnectingFromType] = useState<'photo' | 'note' | 'wanted' | 'paper' | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const stageRef = useRef<KonvaStage>(null)

  // Update local connection state based on external connection mode
  useEffect(() => {
    if (!isConnectionMode) {
      setIsConnecting(false)
      setConnectingFrom(null)
    }
  }, [isConnectionMode])

  // Handle zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const scaleBy = 1.1
    const stage = stageRef.current
    if (!stage) return

    const oldScale = scale
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    }

    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
    
    // Clamp scale between 0.1 and 3
    const clampedScale = Math.max(0.1, Math.min(3, newScale))
    
    setScale(clampedScale)
    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    })
  }

  const handlePhotoConnectionStart = (photoId: string) => {
    // If we're in global connection mode or local connecting mode
    const inConnectionMode = isConnectionMode || isConnecting
    
    if (inConnectionMode && connectingFrom && connectingFrom !== photoId) {
      // Complete the connection
      const fromType = connectingFromType || 'photo'
      onAddConnection(connectingFrom, photoId, fromType, 'photo')
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingFromType(null)
    } else if (inConnectionMode && !connectingFrom) {
      // Start a new connection
      setIsConnecting(true)
      setConnectingFrom(photoId)
      setConnectingFromType('photo')
    } else if (!inConnectionMode) {
      // Start connection mode if not already active
      setIsConnecting(true)
      setConnectingFrom(photoId)
      setConnectingFromType('photo')
    }
  }

  const handleNoteConnectionStart = (noteId: string) => {
    // If we're in global connection mode or local connecting mode
    const inConnectionMode = isConnectionMode || isConnecting
    
    if (inConnectionMode && connectingFrom && connectingFrom !== noteId) {
      // Complete the connection
      const fromType = connectingFromType || 'note'
      onAddConnection(connectingFrom, noteId, fromType, 'note')
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingFromType(null)
    } else if (inConnectionMode && !connectingFrom) {
      // Start a new connection
      setIsConnecting(true)
      setConnectingFrom(noteId)
      setConnectingFromType('note')
    } else if (!inConnectionMode) {
      // Start connection mode if not already active
      setIsConnecting(true)
      setConnectingFrom(noteId)
      setConnectingFromType('note')
    }
  }

  const handleWantedConnectionStart = (wantedId: string) => {
    // If we're in global connection mode or local connecting mode
    const inConnectionMode = isConnectionMode || isConnecting
    
    if (inConnectionMode && connectingFrom && connectingFrom !== wantedId) {
      // Complete the connection
      const fromType = connectingFromType || 'wanted'
      onAddConnection(connectingFrom, wantedId, fromType, 'wanted')
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingFromType(null)
    } else if (inConnectionMode && !connectingFrom) {
      // Start a new connection
      setIsConnecting(true)
      setConnectingFrom(wantedId)
      setConnectingFromType('wanted')
    } else if (!inConnectionMode) {
      // Start connection mode if not already active
      setIsConnecting(true)
      setConnectingFrom(wantedId)
      setConnectingFromType('wanted')
    }
  }

  const handlePaperConnectionStart = (paperId: string) => {
    // If we're in global connection mode or local connecting mode
    const inConnectionMode = isConnectionMode || isConnecting
    
    if (inConnectionMode && connectingFrom && connectingFrom !== paperId) {
      // Complete the connection
      const fromType = connectingFromType || 'paper'
      onAddConnection(connectingFrom, paperId, fromType, 'paper')
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingFromType(null)
    } else if (inConnectionMode && !connectingFrom) {
      // Start a new connection
      setIsConnecting(true)
      setConnectingFrom(paperId)
      setConnectingFromType('paper')
    } else if (!inConnectionMode) {
      // Start connection mode if not already active
      setIsConnecting(true)
      setConnectingFrom(paperId)
      setConnectingFromType('paper')
    }
  }

  const handleStageClick = () => {
    if (isConnecting) {
      setIsConnecting(false)
      setConnectingFrom(null)
      setConnectingFromType(null)
    }
  }

  const getItemCenter = (itemId: string, itemType: 'photo' | 'note' | 'wanted' | 'paper') => {
    // Position connections near the top of each component
    if (itemType === 'photo') {
      const photo = photos.find(p => p.id === itemId)
      if (!photo) return { x: 0, y: 0 }
      return { x: photo.x + 100, y: photo.y + 30 } // Center horizontally, near top
    } else if (itemType === 'note') {
      const note = notes.find(n => n.id === itemId)
      if (!note) return { x: 0, y: 0 }
      return { x: note.x + 100, y: note.y + 30 } // Center horizontally, near top
    } else if (itemType === 'wanted') {
      const wanted = wantedPosters.find(w => w.id === itemId)
      if (!wanted) return { x: 0, y: 0 }
      return { x: wanted.x + 100, y: wanted.y + 30 } // Center horizontally, near top
    } else {
      const paper = papers.find(p => p.id === itemId)
      if (!paper) return { x: 0, y: 0 }
      return { x: paper.x + 125, y: paper.y + 30 } // Center horizontally, near top
    }
  }

  const areItemsConnected = (itemId1: string, itemId2: string) => {
    return connections.some(conn => 
      (conn.fromItemId === itemId1 && conn.toItemId === itemId2) ||
      (conn.fromItemId === itemId2 && conn.toItemId === itemId1)
    )
  }

  return (
    <PinboardContainer 
      onWheel={handleWheel}
      onMouseDown={(e) => {
        // Only start panning if we're not in connection mode
        if (isConnectionMode || isConnecting) return
        
        // Check if the target is a component (has a data-component attribute) or is inside one
        const target = e.target as HTMLElement
        const isComponent = target.closest('[data-component]') !== null
        
        if (!isComponent) {
          setIsDragging(true)
          setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
          e.preventDefault()
        }
      }}
      onMouseMove={(e) => {
        if (!isDragging) return
        
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }}
      onMouseUp={() => {
        setIsDragging(false)
      }}
      onMouseLeave={() => {
        setIsDragging(false)
      }}
      style={{
        cursor: isDragging ? 'grabbing' : (isConnectionMode || isConnecting ? 'crosshair' : 'default')
      }}
    >
      {/* Components layer */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'auto'
        }}
      >
        {photos.map(photo => (
          <PolaroidPhoto
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(photo)}
            onConnectionStart={() => handlePhotoConnectionStart(photo.id)}
            onDrawingsUpdate={onPhotoDrawingsUpdate}
            isConnecting={isConnectionMode || isConnecting}
            isConnectionSource={connectingFrom === photo.id}
            isConnectedToSource={connectingFrom ? areItemsConnected(connectingFrom, photo.id) : false}
          />
        ))}

        {notes.map(note => (
          <StickyNote
            key={note.id}
            note={note}
            onClick={() => onNoteClick(note)}
            onConnectionStart={() => handleNoteConnectionStart(note.id)}
            onDrawingsUpdate={onNoteDrawingsUpdate}
            isConnecting={isConnectionMode || isConnecting}
            isConnectionSource={connectingFrom === note.id}
            isConnectedToSource={connectingFrom ? areItemsConnected(connectingFrom, note.id) : false}
          />
        ))}

        {wantedPosters.map(poster => (
          <WantedPoster
            key={poster.id}
            poster={poster}
            onClick={() => onWantedClick(poster)}
            onConnectionStart={() => handleWantedConnectionStart(poster.id)}
            onDrawingsUpdate={onWantedDrawingsUpdate}
            isConnecting={isConnectionMode || isConnecting}
            isConnectionSource={connectingFrom === poster.id}
            isConnectedToSource={connectingFrom ? areItemsConnected(connectingFrom, poster.id) : false}
          />
        ))}

        {papers.map(paper => (
          <LinedPaper
            key={paper.id}
            paper={paper}
            onClick={() => onPaperClick(paper)}
            onConnectionStart={() => handlePaperConnectionStart(paper.id)}
            onDrawingsUpdate={onPaperDrawingsUpdate}
            isConnecting={isConnectionMode || isConnecting}
            isConnectionSource={connectingFrom === paper.id}
            isConnectedToSource={connectingFrom ? areItemsConnected(connectingFrom, paper.id) : false}
          />
        ))}

        {/* CSS Thumbtacks for connection endpoints - inside transformed container */}
        {connections.map(connection => {
          const fromCenter = getItemCenter(connection.fromItemId, connection.fromItemType)
          const toCenter = getItemCenter(connection.toItemId, connection.toItemType)
          
          return (
            <React.Fragment key={`thumbtacks-${connection.id}`}>
              {/* Thumbtack at start */}
              <CSSThumbTack
                style={{
                  left: `${fromCenter.x - 8}px`,
                  top: `${fromCenter.y - 8}px`,
                }}
              />
              {/* Thumbtack at end */}
              <CSSThumbTack
                style={{
                  left: `${toCenter.x - 8}px`,
                  top: `${toCenter.y - 8}px`,
                }}
              />
            </React.Fragment>
          )
        })}
      </div>

      {/* Yarn connections layer - renders on top */}
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        ref={stageRef}
        onClick={handleStageClick}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          pointerEvents: 'none' // Allow clicks to pass through to components below
        }}
      >
        <Layer
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
        >
          {connections.map(connection => {
            const fromCenter = getItemCenter(connection.fromItemId, connection.fromItemType)
            const toCenter = getItemCenter(connection.toItemId, connection.toItemType)
            
            return (
              <React.Fragment key={connection.id}>
                {/* Yarn line */}
                <Line
                  points={[fromCenter.x, fromCenter.y, toCenter.x, toCenter.y]}
                  stroke={connection.color}
                  strokeWidth={3}
                  lineCap="round"
                  tension={0.2}
                  shadowColor="rgba(0, 0, 0, 0.3)"
                  shadowBlur={4}
                  shadowOffset={{ x: 2, y: 2 }}
                />
              </React.Fragment>
            )
          })}
        </Layer>
      </Stage>
    </PinboardContainer>
  )
}

export default Pinboard
