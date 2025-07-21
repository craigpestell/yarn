import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { X, Trash2 } from 'lucide-react'
import type { StickyNote } from '../types'

const EditorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const EditorModal = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
`

const EditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`

const EditorTitle = styled.h2`
  margin: 0;
  color: #333;
  font-size: 24px;
`

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  
  &:hover {
    background: #f3f4f6;
    color: #333;
  }
`

const FormGroup = styled.div`
  margin-bottom: 20px;
`

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
`

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 16px;
  font-family: 'Permanent Marker', cursive;
  font-weight: 400;
  color: #2c3e50;
  text-shadow: 0.5px 0.5px 0px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.3px;
  line-height: 1.4;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  &::placeholder {
    color: #9ca3af;
    font-style: italic;
  }
`

const ColorPicker = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 8px;
`

const ColorOption = styled.button<{ $color: string; $isSelected: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.$color};
  border: 3px solid ${props => props.$isSelected ? '#333' : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.1);
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 24px;
`

const Button = styled.button<{ $variant?: 'primary' | 'danger' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  ${props => props.$variant === 'primary' && `
    background: #3b82f6;
    color: white;
    
    &:hover {
      background: #2563eb;
    }
  `}
  
  ${props => props.$variant === 'danger' && `
    background: #ef4444;
    color: white;
    
    &:hover {
      background: #dc2626;
    }
  `}
  
  ${props => !props.$variant && `
    background: #f3f4f6;
    color: #374151;
    
    &:hover {
      background: #e5e7eb;
    }
  `}
`

const STICKY_NOTE_COLORS = [
  '#fef08a', // Yellow
  '#fed7aa', // Orange
  '#fecaca', // Red
  '#ddd6fe', // Purple
  '#bfdbfe', // Blue
  '#bbf7d0', // Green
]

interface StickyNoteEditorProps {
  note: StickyNote | null
  onSave: (note: StickyNote) => void
  onDelete: (noteId: string) => void
  onClose: () => void
}

const StickyNoteEditor: React.FC<StickyNoteEditorProps> = ({
  note,
  onSave,
  onDelete,
  onClose
}) => {
  const [text, setText] = useState('')
  const [color, setColor] = useState(STICKY_NOTE_COLORS[0])

  useEffect(() => {
    if (note) {
      setText(note.text)
      setColor(note.color)
    } else {
      setText('')
      setColor(STICKY_NOTE_COLORS[0])
    }
  }, [note])

  const handleSave = () => {
    if (!text.trim()) return

    const noteToSave: StickyNote = {
      id: note?.id || `note-${Date.now()}`,
      text: text.trim(),
      color,
      x: note?.x || Math.random() * (window.innerWidth - 200),
      y: note?.y || Math.random() * (window.innerHeight - 200),
      rotation: note?.rotation || (Math.random() - 0.5) * 10, // Random rotation between -5 and 5 degrees
    }

    onSave(noteToSave)
    onClose()
  }

  const handleDelete = () => {
    if (note && window.confirm('Are you sure you want to delete this sticky note?')) {
      onDelete(note.id)
      onClose()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <EditorOverlay onClick={handleOverlayClick}>
      <EditorModal>
        <EditorHeader>
          <EditorTitle>{note ? 'Edit Sticky Note' : 'New Sticky Note'}</EditorTitle>
          <CloseButton onClick={onClose}>
            <X size={24} />
          </CloseButton>
        </EditorHeader>

        <FormGroup>
          <Label>Text</Label>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your note here..."
            autoFocus
          />
        </FormGroup>

        <FormGroup>
          <Label>Color</Label>
          <ColorPicker>
            {STICKY_NOTE_COLORS.map((colorOption) => (
              <ColorOption
                key={colorOption}
                $color={colorOption}
                $isSelected={color === colorOption}
                onClick={() => setColor(colorOption)}
              />
            ))}
          </ColorPicker>
        </FormGroup>

        <ButtonGroup>
          <div>
            {note && (
              <Button $variant="danger" onClick={handleDelete}>
                <Trash2 size={18} />
                Delete
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button $variant="primary" onClick={handleSave} disabled={!text.trim()}>
              {note ? 'Save Changes' : 'Create Note'}
            </Button>
          </div>
        </ButtonGroup>
      </EditorModal>
    </EditorOverlay>
  )
}

export default StickyNoteEditor
