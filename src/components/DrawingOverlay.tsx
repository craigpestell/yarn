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

interface DrawingOverlayProps {
  width: number
  height: number
  drawings: unknown[]
  isDrawingMode: boolean
  onDrawingsChange: (drawings: unknown[]) => void
  penColor?: string
  penWidth?: number
}

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  width,
  height,
  drawings,
  isDrawingMode,
  onDrawingsChange,
  penColor = '#000000',
  penWidth = 2
}) => {
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
        color: penColor,
        strokeWidth: penWidth
      }
      onDrawingsChange([...drawings, newPath])
    }
    setCurrentPath([])
  }, [isDrawing, isDrawingMode, currentPath, penColor, penWidth, drawings, onDrawingsChange])

  return (
    <DrawingContainer $isDrawing={isDrawingMode}>
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
              stroke={penColor}
              strokeWidth={penWidth}
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
