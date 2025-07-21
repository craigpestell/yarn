import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { X, Save, Trash2, ExternalLink } from 'lucide-react'
import type { Photo } from '../types'

const EditorOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
`

const EditorPanel = styled.div`
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`

const EditorHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
`

const EditorTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  color: #2d3748;
  font-family: 'Courier New', monospace;
  flex: 1;
`

const CloseButton = styled.button`
  background: none;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #718096;
  transition: all 0.2s ease;

  &:hover {
    background: #f7fafc;
    color: #4a5568;
  }
`

const EditorContent = styled.div`
  padding: 24px;
`

const FormGroup = styled.div`
  margin-bottom: 20px;
`

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #4a5568;
  font-size: 0.9rem;
`

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #4299e1;
  }
`

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #4299e1;
  }
`

const PreviewSection = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`

const PreviewLabel = styled.div`
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 8px;
  font-size: 0.9rem;
`

const PreviewImage = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  justify-content: space-between;
`

const Button = styled.button<{ $variant?: 'primary' | 'danger' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;

  ${props => props.$variant === 'primary' && `
    background: #4299e1;
    color: white;
    
    &:hover {
      background: #3182ce;
    }
  `}

  ${props => props.$variant === 'danger' && `
    background: #e53e3e;
    color: white;
    
    &:hover {
      background: #c53030;
    }
  `}

  ${props => !props.$variant && `
    background: #e2e8f0;
    color: #4a5568;
    
    &:hover {
      background: #cbd5e0;
    }
  `}
`

interface PhotoEditorProps {
  photo: Photo
  onUpdate: (photo: Photo) => void
  onDelete: (photoId: string) => void
  onClose: () => void
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({
  photo,
  onUpdate,
  onDelete,
  onClose
}) => {
  const [formData, setFormData] = useState({
    title: photo.title,
    url: photo.url,
    notes: photo.notes,
    imageUrl: photo.imageUrl
  })

  useEffect(() => {
    setFormData({
      title: photo.title,
      url: photo.url,
      notes: photo.notes,
      imageUrl: photo.imageUrl
    })
  }, [photo])

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  const handleSave = () => {
    onUpdate({
      ...photo,
      ...formData
    })
    onClose()
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      onDelete(photo.id)
    }
  }

  const openUrl = () => {
    if (formData.url) {
      window.open(formData.url, '_blank')
    }
  }

  return (
    <EditorOverlay onClick={onClose}>
      <EditorPanel onClick={e => e.stopPropagation()}>
        <EditorHeader>
          <EditorTitle>Edit Photo</EditorTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </EditorHeader>

        <EditorContent>
          <FormGroup>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange('title')}
              placeholder="Enter photo title..."
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={handleInputChange('url')}
              placeholder="https://example.com"
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={handleInputChange('imageUrl')}
              placeholder="https://example.com/image.jpg"
            />
          </FormGroup>

          {formData.imageUrl && (
            <PreviewSection>
              <PreviewLabel>Image Preview</PreviewLabel>
              <PreviewImage 
                src={formData.imageUrl} 
                alt="Preview"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </PreviewSection>
          )}

          <FormGroup>
            <Label htmlFor="notes">Notes</Label>
            <TextArea
              id="notes"
              value={formData.notes}
              onChange={handleInputChange('notes')}
              placeholder="Add your conspiracy notes here..."
            />
          </FormGroup>
        </EditorContent>

        <ActionButtons>
          <Button $variant="danger" onClick={handleDelete}>
            <Trash2 size={16} />
            Delete
          </Button>

          <div style={{ display: 'flex', gap: '12px' }}>
            {formData.url && (
              <Button onClick={openUrl}>
                <ExternalLink size={16} />
                Visit URL
              </Button>
            )}
            
            <Button $variant="primary" onClick={handleSave}>
              <Save size={16} />
              Save Changes
            </Button>
          </div>
        </ActionButtons>
      </EditorPanel>
    </EditorOverlay>
  )
}

export default PhotoEditor
