import React, { useState } from 'react'
import styled from 'styled-components'
import { Plus, Move, Link, StickyNote, FileText, File, Save, FolderOpen, Image } from 'lucide-react'

const ToolbarContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 50px;
  padding: 12px 20px;
  display: flex;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  border: 1px solid rgba(255, 255, 255, 0.2);
`

const ToolButton = styled.button<{ $active?: boolean }>`
  background: none;
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #4a5568;

  ${props => props.$active && `
    background: #4299e1;
    color: white;
    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
  `}

  &:hover {
    background: ${props => props.$active ? '#3182ce' : '#e2e8f0'};
    color: ${props => props.$active ? 'white' : '#2d3748'};
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`

const ToolLabel = styled.span`
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: #718096;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  font-family: 'Courier New', monospace;

  ${ToolButton}:hover & {
    opacity: 1;
  }
`

const MenuContainer = styled.div`
  position: relative;
`

const ExpandableMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  transform: translateX(-50%) ${props => props.$isOpen ? 'translateY(0)' : 'translateY(10px)'};
  transition: all 0.2s ease;
  z-index: 1001;
`

const MenuButton = styled.button`
  background: none;
  border: none;
  border-radius: 12px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #4a5568;
  position: relative;

  &:hover {
    background: #e2e8f0;
    color: #2d3748;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`

const MenuLabel = styled.span`
  position: absolute;
  left: -80px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: #718096;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  backdrop-filter: blur(5px);

  ${MenuButton}:hover & {
    opacity: 1;
  }
`

interface ToolbarProps {
  onAddPhoto: () => void
  onAddNote: () => void
  onAddWanted: () => void
  onAddPaper: () => void
  onSaveBoard: () => void
  onLoadBoard: () => void
  onToggleConnectionMode: () => void
  isConnectionMode: boolean
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddPhoto, onAddNote, onAddWanted, onAddPaper, onSaveBoard, onLoadBoard, onToggleConnectionMode, isConnectionMode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleMenuAction = (action: () => void) => {
    action()
    setIsMenuOpen(false)
  }

  return (
    <ToolbarContainer>
      {/* Expandable Add Components Menu */}
      <MenuContainer>
        <ToolButton 
          onClick={toggleMenu} 
          title="Add Components"
          $active={isMenuOpen}
        >
          <Plus size={24} style={{ transform: isMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
          <ToolLabel>Add Components</ToolLabel>
        </ToolButton>
        
        <ExpandableMenu $isOpen={isMenuOpen}>
          <MenuButton onClick={() => handleMenuAction(onAddPhoto)} title="Add Photo">
            <Image size={22} />
            <MenuLabel>Add Photo</MenuLabel>
          </MenuButton>
          
          <MenuButton onClick={() => handleMenuAction(onAddNote)} title="Add Sticky Note">
            <StickyNote size={22} />
            <MenuLabel>Add Note</MenuLabel>
          </MenuButton>
          
          <MenuButton onClick={() => handleMenuAction(onAddWanted)} title="Add Wanted Poster">
            <FileText size={22} />
            <MenuLabel>Add Wanted</MenuLabel>
          </MenuButton>
          
          <MenuButton onClick={() => handleMenuAction(onAddPaper)} title="Add Lined Paper">
            <File size={22} />
            <MenuLabel>Add Paper</MenuLabel>
          </MenuButton>
        </ExpandableMenu>
      </MenuContainer>
      
      <ToolButton onClick={onSaveBoard} title="Save Board">
        <Save size={24} />
        <ToolLabel>Save Board</ToolLabel>
      </ToolButton>
      
      <ToolButton onClick={onLoadBoard} title="Load Board">
        <FolderOpen size={24} />
        <ToolLabel>Load Board</ToolLabel>
      </ToolButton>
      
      <ToolButton title="Drag Mode">
        <Move size={24} />
        <ToolLabel>Drag Mode</ToolLabel>
      </ToolButton>
      
      <ToolButton 
        onClick={onToggleConnectionMode} 
        $active={isConnectionMode}
        title="Connection Mode"
      >
        <Link size={24} />
        <ToolLabel>{isConnectionMode ? 'Exit Connect' : 'Connect'}</ToolLabel>
      </ToolButton>
    </ToolbarContainer>
  )
}

export default Toolbar
