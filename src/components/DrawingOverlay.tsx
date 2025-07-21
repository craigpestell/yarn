import React, { useState, useRef, useCallback } from 'react'
import styled from 'styled-components'
import { Stage, Layer, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { DrawingPath } from '../types'

const DrawingContainer = styled.div<{ $isDrawing: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: ${props => props.$isDrawing ? 'all' : 'none'};
  z-index: ${props => props.$isDrawing ? 100 : 10};
  cursor: ${props => props.$isDrawing ? 'crosshair' : 'default'};
`

const DrawingControls = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 6px;
  padding: 6px;
  display: ${props => props.$visible ? 'flex' : 'none'};
  gap: 6px;
  align-items: center;
  z-index: 101;
`

const ColorButton = styled.button<{ $color: string; $active: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${props => props.$active ? '#fff' : 'transparent'};
  background: ${props => props.$color};
  cursor: pointer;
  
  &:hover {
    border-color: #ccc;
  }
`

const StrokeButton = styled.button<{ $active: boolean }>`
  background: ${props => props.$active ? '#4a5568' : 'transparent'};
  color: white;
  border: 1px solid #666;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  cursor: pointer;
  
  &:hover {
    background: #4a5568;
  }
`

const ClearButton = styled.button`
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  cursor: pointer;
  
  &:hover {
    background: #c53030;
  }
`

interface DrawingOverlayProps {
  width: number
  height: number
  drawings: unknown[]
  isDrawingMode: boolean
  onDrawingsChange: (drawings: unknown[]) => void
}

const colors = ['#000000', '#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#ec4899']
const strokeWidths = [2, 4, 6]

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  width,
  height,
  drawings,
  isDrawingMode,
  onDrawingsChange
}) => {
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<number[]>([])
  const stageRef = useRef(null)

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawingMode) return
    
    e.evt.stopPropagation() // Prevent event bubbling
    setIsDrawing(true)
    const pos = e.target.getStage()?.getPointerPosition()
    if (pos) {
      setCurrentPath([pos.x, pos.y])
    }
  }, [isDrawingMode])

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !isDrawingMode) return
    
    e.evt.stopPropagation() // Prevent event bubbling
    const stage = e.target.getStage()
    const point = stage?.getPointerPosition()
    if (point) {
      setCurrentPath(prev => [...prev, point.x, point.y])
    }
  }, [isDrawing, isDrawingMode])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !isDrawingMode) return
    
    setIsDrawing(false)
    if (currentPath.length > 4) { // Only save if there are at least 2 points
      const newPath: DrawingPath = {
        id: `path-${Date.now()}`,
        points: currentPath,
        color: currentColor,
        strokeWidth: currentStrokeWidth
      }
      onDrawingsChange([...drawings, newPath])
    }
    setCurrentPath([])
  }, [isDrawing, isDrawingMode, currentPath, currentColor, currentStrokeWidth, drawings, onDrawingsChange])

  const clearDrawings = useCallback(() => {
    onDrawingsChange([])
  }, [onDrawingsChange])

  return (
    <DrawingContainer $isDrawing={isDrawingMode}>
      <DrawingControls $visible={isDrawingMode}>
        {colors.map(color => (
          <ColorButton
            key={color}
            $color={color}
            $active={currentColor === color}
            onClick={() => setCurrentColor(color)}
          />
        ))}
        {strokeWidths.map(width => (
          <StrokeButton
            key={width}
            $active={currentStrokeWidth === width}
            onClick={() => setCurrentStrokeWidth(width)}
          >
            {width}px
          </StrokeButton>
        ))}
        <ClearButton onClick={clearDrawings}>
          Clear
        </ClearButton>
      </DrawingControls>
      
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
      >
        <Layer>
          {/* Existing drawings */}
          {drawings.map(path => {
            const drawingPath = path as DrawingPath
            return (
              <Line
                key={drawingPath.id}
                points={drawingPath.points}
                stroke={drawingPath.color}
                strokeWidth={drawingPath.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            )
          })}
          
          {/* Current drawing path */}
          {isDrawing && currentPath.length > 0 && (
            <Line
              points={currentPath}
              stroke={currentColor}
              strokeWidth={currentStrokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </Layer>
      </Stage>
    </DrawingContainer>
  )
}

export default DrawingOverlay
