import { useState, useCallback, useEffect } from 'react'
import styled from 'styled-components'
import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import Pinboard from './components/Pinboard'
import Toolbar from './components/Toolbar'
import CharlieComponent from './components/CharlieComponent'
import PhotoEditor from './components/PhotoEditor'
import StickyNoteEditor from './components/StickyNoteEditor'
import WantedPosterEditor from './components/WantedPosterEditor'
import LinedPaperEditor from './components/LinedPaperEditor'
import PenToolbar from './components/PenToolbar'
import Notification, { type NotificationType } from './components/Notification'
import type { Photo, StickyNote, WantedPoster, LinedPaper, CharlieImage, YarnConnection } from './types'
import { saveBoard, loadBoard } from './utils/boardStorage'
import './App.css'

const DEFAULT_IMAGE_URL = 'https://i.abcnewsfe.com/a/62e523b1-5c89-4f82-80f7-06a7f8b18fd4/Jeffrey-Epstein-ap-gmh-240104_1704386953481_hpMain_16x9.jpg?w=1500'
const DEFAULT_URL = 'https://en.wikipedia.org/wiki/Jeffrey_Epstein'

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  background-image: url('/corkboard-background-with-seamless-cork-texture.jpg');
  background-repeat: repeat;
  background-size: 400px 400px;
  background-position: 0 0;
  overflow: hidden;
  position: relative;
`

const AppTitle = styled.h1`
  position: absolute;
  top: 20px;
  left: 20px;
  color: #f7fafc;
  font-family: 'Courier New', monospace;
  font-size: 1.5rem;
  z-index: 1000;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  user-select: none;
  
  &:hover {
    color: #e2e8f0;
  }
`

const TitleEditor = styled.input`
  position: absolute;
  top: 20px;
  left: 60px; /* Account for emoji width */
  color: #f7fafc;
  font-family: 'Courier New', monospace;
  font-size: 1.5rem;
  z-index: 1000;
  margin: 0;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid #4a5568;
  border-radius: 4px;
  padding: 4px 8px;
  outline: none;
  
  &:focus {
    border-color: #63b3ed;
    background: rgba(0, 0, 0, 0.8);
  }
`

const InstructionPanel = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 80px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #f7fafc;
  padding: 16px 20px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  max-width: 300px;
  z-index: 1000;
  transform: translateY(${props => props.$visible ? '0' : '-20px'});
  opacity: ${props => props.$visible ? '1' : '0'};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
  transition: all 0.3s ease;
  
  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }
  
  li {
    margin: 4px 0;
  }
`

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [notes, setNotes] = useState<StickyNote[]>([])
  const [wantedPosters, setWantedPosters] = useState<WantedPoster[]>([])
  const [papers, setPapers] = useState<LinedPaper[]>([])
  const [charlieImages, setCharlieImages] = useState<CharlieImage[]>([{
    id: 'charlie-1',
    x: 50,
    y: window.innerHeight - 250,
    width: 200,
    height: 200
  }])
  const [connections, setConnections] = useState<YarnConnection[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedNote, setSelectedNote] = useState<StickyNote | null>(null)
  const [selectedWanted, setSelectedWanted] = useState<WantedPoster | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<LinedPaper | null>(null)
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false)
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [isWantedEditorOpen, setIsWantedEditorOpen] = useState(false)
  const [isPaperEditorOpen, setIsPaperEditorOpen] = useState(false)
  const [isConnectionMode, setIsConnectionMode] = useState(false)
  const [boardTitle, setBoardTitle] = useState('Jeffrey Epstein Conspiracy Board')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [notification, setNotification] = useState<{ message: string; type: NotificationType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false
  })
  
  // Load initial data from file on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const response = await fetch('/initial-data.json')
        if (response.ok) {
          const data = await response.json()
          setPhotos(data.photos || [])
          setNotes(data.notes || [])
          setWantedPosters(data.wantedPosters || [])
          setPapers(data.papers || [])
          setConnections(data.connections || [])
          setBoardTitle(data.title || 'Jeffrey Epstein Conspiracy Board')
          
          // Set Charlie image if it exists in the data
          if (data.charlieImage) {
            setCharlieImages([data.charlieImage])
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
        // If loading fails, we'll just start with empty arrays (already set as defaults)
      }
    }
    
    loadInitialData()
  }, [])
  
  // Pen toolbar state
  const [isAnyComponentDrawing, setIsAnyComponentDrawing] = useState(false)
  const [isPenMode, setIsPenMode] = useState(false)
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(2)
  
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  })
  
  const sensors = useSensors(mouseSensor)

  const showNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type, visible: true })
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }))
    }, 3000)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    
    if (active && delta) {
      const activeData = active.data.current
      
      if (activeData?.type === 'photo') {
        setPhotos(prev => prev.map(photo => 
          photo.id === active.id 
            ? { ...photo, x: photo.x + delta.x, y: photo.y + delta.y }
            : photo
        ))
      } else if (activeData?.type === 'note') {
        setNotes(prev => prev.map(note => {
          const draggedNote = prev.find(n => n.id === active.id)
          
          // If the dragged note is part of a group, move all notes in the group
          if (draggedNote?.groupId) {
            const isInSameGroup = note.groupId === draggedNote.groupId
            return isInSameGroup
              ? { ...note, x: note.x + delta.x, y: note.y + delta.y }
              : note
          }
          
          // If not in a group, just move the individual note
          return note.id === active.id 
            ? { ...note, x: note.x + delta.x, y: note.y + delta.y }
            : note
        }))
      } else if (activeData?.type === 'wanted') {
        setWantedPosters(prev => prev.map(poster => 
          poster.id === active.id 
            ? { ...poster, x: poster.x + delta.x, y: poster.y + delta.y }
            : poster
        ))
      } else if (activeData?.type === 'paper') {
        setPapers(prev => prev.map(paper => 
          paper.id === active.id 
            ? { ...paper, x: paper.x + delta.x, y: paper.y + delta.y }
            : paper
        ))
      } else if (activeData?.type === 'charlie') {
        setCharlieImages(prev => prev.map(charlie => 
          charlie.id === active.id 
            ? { ...charlie, x: charlie.x + delta.x, y: charlie.y + delta.y }
            : charlie
        ))
      }
    }
  }, [])

  const addPhoto = useCallback(() => {
    const newPhoto: Photo = {
      id: `photo-${Date.now()}`,
      url: DEFAULT_URL,
      title: 'New Photo',
      notes: '',
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      imageUrl: DEFAULT_IMAGE_URL,
      rotation: (Math.random() - 0.5) * 20 // Random rotation between -10 and 10 degrees
    }
    setPhotos(prev => [...prev, newPhoto])
    setSelectedPhoto(newPhoto)
    setIsPhotoEditorOpen(true)
  }, [])

  const addNote = useCallback(() => {
    const newNote: StickyNote = {
      id: `note-${Date.now()}`,
      text: '',
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      color: '#fef08a', // Default yellow
      rotation: (Math.random() - 0.5) * 10 // Random rotation between -5 and 5 degrees
    }
    setNotes(prev => [...prev, newNote])
    setSelectedNote(newNote)
    setIsNoteEditorOpen(true)
  }, [])

  const addWanted = useCallback(() => {
    const newPoster: WantedPoster = {
      id: `wanted-${Date.now()}`,
      name: '',
      alias: '',
      crime: '',
      description: '',
      reward: '$10,000',
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      imageUrl: '',
      rotation: (Math.random() - 0.5) * 10
    }
    setWantedPosters(prev => [...prev, newPoster])
    setSelectedWanted(newPoster)
    setIsWantedEditorOpen(true)
  }, [])

  const addPaper = useCallback(() => {
    const newPaper: LinedPaper = {
      id: `paper-${Date.now()}`,
      content: '',
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      rotation: (Math.random() - 0.5) * 10
    }
    setPapers(prev => [...prev, newPaper])
    setSelectedPaper(newPaper)
    setIsPaperEditorOpen(true)
  }, [])

  const updatePhoto = useCallback((updatedPhoto: Photo) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === updatedPhoto.id ? updatedPhoto : photo
    ))
    setSelectedPhoto(updatedPhoto)
  }, [])

  const updateNote = useCallback((updatedNote: StickyNote) => {
    // Check if text content would overflow and needs to be split
    const maxCharsPerNote = 150 // Approximate character limit per sticky note
    
    if (updatedNote.text.length > maxCharsPerNote) {
      // Split the text into chunks
      const words = updatedNote.text.split(' ')
      const chunks: string[] = []
      let currentChunk = ''
      
      for (const word of words) {
        if ((currentChunk + ' ' + word).length > maxCharsPerNote && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = word
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + word : word
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      
      // Create a group ID for all related notes
      const groupId = `group-${Date.now()}`
      const overlapAmount = 160 // Vertical overlap (note height is 200px)
      
      // Update the original note with the first chunk and group info
      const firstNote = { 
        ...updatedNote, 
        text: chunks[0],
        groupId,
        groupIndex: 0
      }
      setNotes(prev => prev.map(note => 
        note.id === updatedNote.id ? firstNote : note
      ))
      setSelectedNote(firstNote)
      
      // Create additional notes for the remaining chunks, positioned vertically with overlap
      const additionalNotes: StickyNote[] = chunks.slice(1).map((chunk, index) => ({
        id: `note-${Date.now()}-${index + 1}`,
        text: chunk,
        x: updatedNote.x,
        y: updatedNote.y + (index + 1) * overlapAmount, // Vertical positioning with overlap
        color: updatedNote.color,
        rotation: updatedNote.rotation + (Math.random() - 0.5) * 3, // Minimal rotation variation
        groupId,
        groupIndex: index + 1
      }))
      
      if (additionalNotes.length > 0) {
        setNotes(prev => [...prev, ...additionalNotes])
        showNotification(`Note split into ${chunks.length} parts due to length`, 'info')
      }
    } else {
      // Normal update for short text
      setNotes(prev => prev.map(note => 
        note.id === updatedNote.id ? updatedNote : note
      ))
      setSelectedNote(updatedNote)
    }
  }, [showNotification])

  const updateWanted = useCallback((updatedPoster: WantedPoster) => {
    setWantedPosters(prev => prev.map(poster => 
      poster.id === updatedPoster.id ? updatedPoster : poster
    ))
    setSelectedWanted(updatedPoster)
  }, [])

  const updatePaper = useCallback((updatedPaper: LinedPaper) => {
    setPapers(prev => prev.map(paper => 
      paper.id === updatedPaper.id ? updatedPaper : paper
    ))
    setSelectedPaper(updatedPaper)
  }, [])

  const deletePhoto = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== photoId))
    setConnections(prev => prev.filter(conn => 
      conn.fromItemId !== photoId && conn.toItemId !== photoId
    ))
    setIsPhotoEditorOpen(false)
    setSelectedPhoto(null)
  }, [])

  const deleteNote = useCallback((noteId: string) => {
    // Find the note being deleted
    const noteToDelete = notes.find(note => note.id === noteId)
    
    if (noteToDelete?.groupId) {
      // If it's part of a group, delete all notes in the group
      const groupNotes = notes.filter(note => note.groupId === noteToDelete.groupId)
      const groupNoteIds = groupNotes.map(note => note.id)
      
      setNotes(prev => prev.filter(note => !groupNoteIds.includes(note.id)))
      setConnections(prev => prev.filter(conn => 
        !groupNoteIds.includes(conn.fromItemId) && !groupNoteIds.includes(conn.toItemId)
      ))
    } else {
      // Delete single note
      setNotes(prev => prev.filter(note => note.id !== noteId))
      setConnections(prev => prev.filter(conn => 
        conn.fromItemId !== noteId && conn.toItemId !== noteId
      ))
    }
    
    setIsNoteEditorOpen(false)
    setSelectedNote(null)
  }, [notes])

  const deleteWanted = useCallback((posterId: string) => {
    setWantedPosters(prev => prev.filter(poster => poster.id !== posterId))
    setConnections(prev => prev.filter(conn => 
      conn.fromItemId !== posterId && conn.toItemId !== posterId
    ))
    setIsWantedEditorOpen(false)
    setSelectedWanted(null)
  }, [])

  const deletePaper = useCallback((paperId: string) => {
    setPapers(prev => prev.filter(paper => paper.id !== paperId))
    setConnections(prev => prev.filter(conn => 
      conn.fromItemId !== paperId && conn.toItemId !== paperId
    ))
    setIsPaperEditorOpen(false)
    setSelectedPaper(null)
  }, [])

  const openPhotoEditor = useCallback((photo: Photo) => {
    setSelectedPhoto(photo)
    setIsPhotoEditorOpen(true)
  }, [])

  const openNoteEditor = useCallback((note: StickyNote) => {
    setSelectedNote(note)
    setIsNoteEditorOpen(true)
  }, [])

  const openWantedEditor = useCallback((poster: WantedPoster) => {
    setSelectedWanted(poster)
    setIsWantedEditorOpen(true)
  }, [])

  const openPaperEditor = useCallback((paper: LinedPaper) => {
    setSelectedPaper(paper)
    setIsPaperEditorOpen(true)
  }, [])

  const closePhotoEditor = useCallback(() => {
    setIsPhotoEditorOpen(false)
    setSelectedPhoto(null)
  }, [])

  const closeNoteEditor = useCallback(() => {
    setIsNoteEditorOpen(false)
    setSelectedNote(null)
  }, [])

  const closeWantedEditor = useCallback(() => {
    setIsWantedEditorOpen(false)
    setSelectedWanted(null)
  }, [])

  const closePaperEditor = useCallback(() => {
    setIsPaperEditorOpen(false)
    setSelectedPaper(null)
  }, [])

  const toggleConnection = useCallback((fromItemId: string, toItemId: string, fromItemType: 'photo' | 'note' | 'wanted' | 'paper', toItemType: 'photo' | 'note' | 'wanted' | 'paper') => {
    // Check if connection already exists (in either direction)
    const existingConnection = connections.find(conn => 
      (conn.fromItemId === fromItemId && conn.toItemId === toItemId) ||
      (conn.fromItemId === toItemId && conn.toItemId === fromItemId)
    )

    if (existingConnection) {
      // Remove existing connection
      setConnections(prev => prev.filter(conn => conn.id !== existingConnection.id))
    } else {
      // Add new connection with red yarn
      const newConnection: YarnConnection = {
        id: `connection-${Date.now()}`,
        fromItemId,
        toItemId,
        fromItemType,
        toItemType,
        color: '#e53e3e' // Red yarn only
      }
      setConnections(prev => [...prev, newConnection])
    }
  }, [connections])

  const updatePhotoDrawings = useCallback((photoId: string, drawings: unknown[]) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === photoId ? { ...photo, drawings: drawings as typeof photo.drawings } : photo
    ))
  }, [])

  const updateNoteDrawings = useCallback((noteId: string, drawings: unknown[]) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, drawings: drawings as typeof note.drawings } : note
    ))
  }, [])

  const updateWantedDrawings = useCallback((posterId: string, drawings: unknown[]) => {
    setWantedPosters(prev => prev.map(poster => 
      poster.id === posterId ? { ...poster, drawings: drawings as typeof poster.drawings } : poster
    ))
  }, [])

  const updatePaperDrawings = useCallback((paperId: string, drawings: unknown[]) => {
    setPapers(prev => prev.map(paper => 
      paper.id === paperId ? { ...paper, drawings: drawings as typeof paper.drawings } : paper
    ))
  }, [])

  const updateCharlieSize = useCallback((charlieId: string, width: number, height: number) => {
    setCharlieImages(prev => prev.map(charlie => 
      charlie.id === charlieId ? { ...charlie, width, height } : charlie
    ))
  }, [])

  const toggleConnectionMode = useCallback(() => {
    setIsConnectionMode(prev => !prev)
  }, [])

  const togglePenMode = useCallback(() => {
    const newPenMode = !isPenMode
    setIsPenMode(newPenMode)
    setIsAnyComponentDrawing(newPenMode)
  }, [isPenMode])

  const startEditingTitle = useCallback(() => {
    setTempTitle(boardTitle)
    setIsEditingTitle(true)
  }, [boardTitle])

  const saveTitle = useCallback(() => {
    if (tempTitle.trim()) {
      setBoardTitle(tempTitle.trim())
    }
    setIsEditingTitle(false)
    setTempTitle('')
  }, [tempTitle])

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false)
    setTempTitle('')
  }, [])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle()
    } else if (e.key === 'Escape') {
      cancelEditingTitle()
    }
  }, [saveTitle, cancelEditingTitle])

  const handleSaveBoard = useCallback(() => {
    try {
      const charlieImage = charlieImages[0] // Get the first (and only) Charlie image
      saveBoard(boardTitle, photos, notes, wantedPosters, papers, charlieImage, connections)
      showNotification('Board saved successfully!', 'success')
    } catch (error) {
      showNotification('Failed to save board', 'error')
      console.error('Save error:', error)
    }
  }, [boardTitle, photos, notes, wantedPosters, papers, charlieImages, connections, showNotification])

  const handleLoadBoard = useCallback(async () => {
    try {
      const boardData = await loadBoard()
      if (boardData) {
        setPhotos(boardData.photos)
        setNotes(boardData.notes)
        setWantedPosters(boardData.wantedPosters)
        setPapers(boardData.papers)
        setConnections(boardData.connections)
        setBoardTitle(boardData.title)
        
        // Set Charlie image if it exists, otherwise use default
        if (boardData.charlieImage) {
          setCharlieImages([boardData.charlieImage])
        }
        
        // Close any open editors
        setIsPhotoEditorOpen(false)
        setIsNoteEditorOpen(false)
        setIsWantedEditorOpen(false)
        setIsPaperEditorOpen(false)
        setSelectedPhoto(null)
        setSelectedNote(null)
        setSelectedWanted(null)
        setSelectedPaper(null)
        
        showNotification(`Board "${boardData.title}" loaded successfully!`, 'success')
      }
    } catch (error) {
      showNotification('Failed to load board', 'error')
      console.error('Load error:', error)
    }
  }, [showNotification])

  return (
    <AppContainer>
      {isEditingTitle ? (
        <>
          <AppTitle style={{ color: '#a0aec0' }}>🧵</AppTitle>
          <TitleEditor
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={saveTitle}
            autoFocus
            maxLength={50}
            placeholder="Enter board title..."
          />
        </>
      ) : (
        <AppTitle onClick={startEditingTitle} title="Click to edit title">
          🧵 {boardTitle}
        </AppTitle>
      )}
      
      <InstructionPanel $visible={isConnectionMode}>
        <strong>🔗 Connection Mode Active</strong>
        <ul>
          <li><span style={{color: '#90EE90'}}>Green border</span> = Connection source</li>
          <li><span style={{color: '#FFA500'}}>Orange border</span> = Already connected</li>
          <li>Click connected photos to <strong>remove</strong> connection</li>
          <li>Click unconnected photos to <strong>add</strong> connection</li>
        </ul>
      </InstructionPanel>
      
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Pinboard
          photos={photos}
          notes={notes}
          wantedPosters={wantedPosters}
          papers={papers}
          connections={connections}
          onPhotoClick={openPhotoEditor}
          onNoteClick={openNoteEditor}
          onWantedClick={openWantedEditor}
          onPaperClick={openPaperEditor}
          onPhotoDrawingsUpdate={updatePhotoDrawings}
          onNoteDrawingsUpdate={updateNoteDrawings}
          onWantedDrawingsUpdate={updateWantedDrawings}
          onPaperDrawingsUpdate={updatePaperDrawings}
          onAddConnection={toggleConnection}
          isConnectionMode={isConnectionMode}
          isPenMode={isPenMode}
          penColor={penColor}
          penWidth={penWidth}
          onDrawingModeChange={setIsAnyComponentDrawing}
        />

        {charlieImages.map(charlie => (
          <CharlieComponent
            key={charlie.id}
            charlie={charlie}
            onSizeChange={updateCharlieSize}
          />
        ))}
      </DndContext>

      <Toolbar 
        onAddPhoto={addPhoto}
        onAddNote={addNote}
        onAddWanted={addWanted}
        onAddPaper={addPaper}
        onSaveBoard={handleSaveBoard}
        onLoadBoard={handleLoadBoard}
        onToggleConnectionMode={toggleConnectionMode}
        isConnectionMode={isConnectionMode}
        onTogglePenMode={togglePenMode}
        isPenMode={isPenMode}
      />

      {isPhotoEditorOpen && selectedPhoto && (
        <PhotoEditor
          photo={selectedPhoto}
          onUpdate={updatePhoto}
          onDelete={deletePhoto}
          onClose={closePhotoEditor}
        />
      )}

      {isNoteEditorOpen && selectedNote && (
        <StickyNoteEditor
          note={selectedNote}
          onSave={updateNote}
          onDelete={deleteNote}
          onClose={closeNoteEditor}
        />
      )}

      {isWantedEditorOpen && selectedWanted && (
        <WantedPosterEditor
          poster={selectedWanted}
          onSave={updateWanted}
          onDelete={deleteWanted}
          onClose={closeWantedEditor}
        />
      )}

      {isPaperEditorOpen && selectedPaper && (
        <LinedPaperEditor
          paper={selectedPaper}
          onSave={updatePaper}
          onDelete={deletePaper}
          onClose={closePaperEditor}
        />
      )}

      <Notification
        message={notification.message}
        type={notification.type}
        visible={notification.visible}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />

      <PenToolbar
        visible={isAnyComponentDrawing}
        currentColor={penColor}
        currentWidth={penWidth}
        onColorChange={setPenColor}
        onWidthChange={setPenWidth}
        onClose={() => setIsAnyComponentDrawing(false)}
      />
    </AppContainer>
  )
}

export default App
