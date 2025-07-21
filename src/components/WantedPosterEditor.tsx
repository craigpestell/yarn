import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { X, Trash2, Upload } from 'lucide-react'
import type { WantedPoster } from '../types'

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
  max-width: 600px;
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

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
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

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`

const ImagePreview = styled.div`
  width: 100px;
  height: 100px;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  overflow: hidden;
`

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const UploadPlaceholder = styled.div`
  color: #9ca3af;
  text-align: center;
  font-size: 12px;
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

interface WantedPosterEditorProps {
  poster: WantedPoster | null
  onSave: (poster: WantedPoster) => void
  onDelete: (posterId: string) => void
  onClose: () => void
}

const WantedPosterEditor: React.FC<WantedPosterEditorProps> = ({
  poster,
  onSave,
  onDelete,
  onClose
}) => {
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [crime, setCrime] = useState('')
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState('$10,000')
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    if (poster) {
      setName(poster.name)
      setAlias(poster.alias)
      setCrime(poster.crime)
      setDescription(poster.description)
      setReward(poster.reward)
      setImageUrl(poster.imageUrl)
    } else {
      setName('')
      setAlias('')
      setCrime('')
      setDescription('')
      setReward('$10,000')
      setImageUrl('')
    }
  }, [poster])

  const handleSave = () => {
    if (!name.trim()) return

    const posterToSave: WantedPoster = {
      id: poster?.id || `wanted-${Date.now()}`,
      name: name.trim(),
      alias: alias.trim(),
      crime: crime.trim(),
      description: description.trim(),
      reward: reward.trim(),
      imageUrl: imageUrl.trim(),
      x: poster?.x || Math.random() * (window.innerWidth - 220),
      y: poster?.y || Math.random() * (window.innerHeight - 300),
      rotation: poster?.rotation || (Math.random() - 0.5) * 10,
    }

    onSave(posterToSave)
    onClose()
  }

  const handleDelete = () => {
    if (poster && window.confirm('Are you sure you want to delete this wanted poster?')) {
      onDelete(poster.id)
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
          <EditorTitle>{poster ? 'Edit Wanted Poster' : 'New Wanted Poster'}</EditorTitle>
          <CloseButton onClick={onClose}>
            <X size={24} />
          </CloseButton>
        </EditorHeader>

        <FormRow>
          <FormGroup>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </FormGroup>
          
          <FormGroup>
            <Label>Alias</Label>
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Known aliases"
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup>
            <Label>Crime</Label>
            <Input
              value={crime}
              onChange={(e) => setCrime(e.target.value)}
              placeholder="Charges or crimes"
            />
          </FormGroup>
          
          <FormGroup>
            <Label>Reward</Label>
            <Input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="$10,000"
            />
          </FormGroup>
        </FormRow>

        <FormGroup>
          <Label>Description</Label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Physical description, distinguishing features..."
          />
        </FormGroup>

        <FormGroup>
          <Label>Photo URL</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          <ImagePreview>
            {imageUrl ? (
              <PreviewImage src={imageUrl} alt="Preview" />
            ) : (
              <UploadPlaceholder>
                <Upload size={24} />
                <div>Photo Preview</div>
              </UploadPlaceholder>
            )}
          </ImagePreview>
        </FormGroup>

        <ButtonGroup>
          <div>
            {poster && (
              <Button $variant="danger" onClick={handleDelete}>
                <Trash2 size={18} />
                Delete
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button $variant="primary" onClick={handleSave} disabled={!name.trim()}>
              {poster ? 'Save Changes' : 'Create Poster'}
            </Button>
          </div>
        </ButtonGroup>
      </EditorModal>
    </EditorOverlay>
  )
}

export default WantedPosterEditor
