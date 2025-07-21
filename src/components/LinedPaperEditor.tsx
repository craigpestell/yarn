import React, { useState } from 'react'
import styled from 'styled-components'
import { X, Save, Trash2 } from 'lucide-react'
import type { LinedPaper } from '../types'

const EditorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`

const EditorPanel = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  position: relative;
`

const EditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
`

const EditorTitle = styled.h2`
  font-family: 'Courier New', monospace;
  font-size: 1.25rem;
  color: #2d3748;
  margin: 0;
`

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: #718096;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f7fafc;
    color: #2d3748;
  }
`

const FormGroup = styled.div`
  margin-bottom: 20px;
`

const Label = styled.label`
  display: block;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  color: #4a5568;
  margin-bottom: 8px;
  font-size: 0.9rem;
`

const ContentTextarea = styled.textarea`
  width: 100%;
  min-height: 300px;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Permanent Marker', cursive;
  font-size: 14px;
  line-height: 1.6;
  color: #2d3748;
  background: #fefefe;
  resize: vertical;
  transition: border-color 0.2s ease;
  
  /* Lined paper background */
  background-image: 
    /* Red margin line */
    linear-gradient(to right, transparent 40px, #ff6b6b 40px, #ff6b6b 41px, transparent 41px),
    /* Blue horizontal lines */
    repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 22px,
      #4285f4 22px,
      #4285f4 23px
    );
  background-color: #fefefe;
  
  &:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
  }
  
  &::placeholder {
    color: #a0aec0;
    font-style: italic;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
`

const Button = styled.button<{ $variant?: 'primary' | 'danger' }>`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  
  ${props => props.$variant === 'primary' && `
    background: #4299e1;
    color: white;
    
    &:hover {
      background: #3182ce;
      transform: translateY(-1px);
    }
  `}
  
  ${props => props.$variant === 'danger' && `
    background: #e53e3e;
    color: white;
    
    &:hover {
      background: #c53030;
      transform: translateY(-1px);
    }
  `}
  
  ${props => !props.$variant && `
    background: #e2e8f0;
    color: #4a5568;
    
    &:hover {
      background: #cbd5e0;
      transform: translateY(-1px);
    }
  `}
`

interface LinedPaperEditorProps {
  paper: LinedPaper
  onSave: (paper: LinedPaper) => void
  onDelete: (paperId: string) => void
  onClose: () => void
}

const LinedPaperEditor: React.FC<LinedPaperEditorProps> = ({
  paper,
  onSave,
  onDelete,
  onClose
}) => {
  const [content, setContent] = useState(paper.content)

  const handleSave = () => {
    onSave({
      ...paper,
      content: content.trim()
    })
    onClose()
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this paper?')) {
      onDelete(paper.id)
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
      <EditorPanel>
        <EditorHeader>
          <EditorTitle>📝 Edit Lined Paper</EditorTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </EditorHeader>

        <FormGroup>
          <Label htmlFor="content">Content:</Label>
          <ContentTextarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your notes here..."
          />
        </FormGroup>

        <ButtonGroup>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button $variant="danger" onClick={handleDelete}>
            <Trash2 size={16} />
            Delete
          </Button>
          <Button $variant="primary" onClick={handleSave}>
            <Save size={16} />
            Save Paper
          </Button>
        </ButtonGroup>
      </EditorPanel>
    </EditorOverlay>
  )
}

export default LinedPaperEditor
