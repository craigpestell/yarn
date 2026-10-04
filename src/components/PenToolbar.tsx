import React from 'react'
import styled from 'styled-components'
import { Palette, Minus, Plus, X } from 'lucide-react'

const ToolbarContainer = styled.div<{ $visible: boolean }>`
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  padding: 20px;
  display: ${props => props.$visible ? 'flex' : 'none'};
  flex-direction: column;
  gap: 16px;
  align-items: center;
  z-index: 2000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 80px;
`

const ToolbarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: bold;
`

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const ColorSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
`

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const ColorButton = styled.button<{ $color: string; $active: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 3px solid ${props => props.$active ? '#fff' : 'rgba(255, 255, 255, 0.2)'};
  background: ${props => props.$color};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    border-color: #fff;
    transform: scale(1.1);
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    background: ${props => props.$active ? (props.$color === '#ffffff' ? '#000' : '#fff') : 'transparent'};
    border-radius: 50%;
  }
`

const WidthSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
`

const WidthControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const WidthButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const WidthDisplay = styled.div`
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  min-width: 40px;
  text-align: center;
`

const WidthPreview = styled.div<{ $width: number; $color: string }>`
  width: 40px;
  height: ${props => Math.max(2, props.$width)}px;
  background: ${props => props.$color};
  border-radius: ${props => props.$width / 2}px;
  margin: 4px 0;
`

const SectionLabel = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Courier New', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
`

interface PenToolbarProps {
  visible: boolean
  currentColor: string
  currentWidth: number
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onClose: () => void
}

const colors = [
  '#000000', // Black
  '#ffffff', // White
  '#e53e3e', // Red
  '#3182ce', // Blue
  '#38a169', // Green
  '#d69e2e', // Yellow
  '#805ad5', // Purple
  '#ec4899', // Pink
  '#f56500', // Orange
  '#319795', // Teal
]

const PenToolbar: React.FC<PenToolbarProps> = ({
  visible,
  currentColor,
  currentWidth,
  onColorChange,
  onWidthChange,
  onClose
}) => {
  const handleWidthDecrease = () => {
    if (currentWidth > 1) {
      onWidthChange(currentWidth - 1)
    }
  }

  const handleWidthIncrease = () => {
    if (currentWidth < 20) {
      onWidthChange(currentWidth + 1)
    }
  }

  return (
    <ToolbarContainer $visible={visible}>
      <ToolbarHeader>
        <Palette size={16} />
        <CloseButton onClick={onClose}>
          <X size={14} />
        </CloseButton>
      </ToolbarHeader>
      
      <ColorSection>
        <SectionLabel>Color</SectionLabel>
        <ColorGrid>
          {colors.map(color => (
            <ColorButton
              key={color}
              $color={color}
              $active={currentColor === color}
              onClick={() => onColorChange(color)}
              title={`Select ${color}`}
            />
          ))}
        </ColorGrid>
      </ColorSection>
      
      <WidthSection>
        <SectionLabel>Width</SectionLabel>
        <WidthControls>
          <WidthButton
            onClick={handleWidthDecrease}
            disabled={currentWidth <= 1}
            title="Decrease width"
          >
            <Minus size={12} />
          </WidthButton>
          <WidthDisplay>{currentWidth}px</WidthDisplay>
          <WidthButton
            onClick={handleWidthIncrease}
            disabled={currentWidth >= 20}
            title="Increase width"
          >
            <Plus size={12} />
          </WidthButton>
        </WidthControls>
        <WidthPreview $width={currentWidth} $color={currentColor} />
      </WidthSection>
    </ToolbarContainer>
  )
}

export default PenToolbar
