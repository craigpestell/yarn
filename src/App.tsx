import { useState, useCallback } from 'react'
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

// Starter data for demonstration
const starterPhotos: Photo[] = [
  {
    id: 'starter-1',
    title: 'Area 51',
    url: 'https://en.wikipedia.org/wiki/Area_51',
    notes: 'Top secret military installation. What are they really hiding? UFO testing facility or something more?',
    x: 150,
    y: 200,
    imageUrl: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=300&fit=crop&crop=center',
    rotation: -5
  },
  {
    id: 'starter-2',
    title: 'Roswell Incident',
    url: 'https://en.wikipedia.org/wiki/Roswell_incident',
    notes: 'The 1947 crash that started it all. Weather balloon or extraterrestrial craft? The timing is suspicious...',
    x: 450,
    y: 150,
    imageUrl: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=300&fit=crop&crop=center',
    rotation: 8
  },
  {
    id: 'starter-3',
    title: 'Project Blue Book',
    url: 'https://en.wikipedia.org/wiki/Project_Blue_Book',
    notes: 'Official USAF investigation into UFOs (1952-1969). Officially concluded most sightings were misidentified natural phenomena. But what about the 700+ "unidentified" cases?',
    x: 200,
    y: 450,
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center',
    rotation: -3
  },
]

const starterNotes: StickyNote[] = [
  {
    id: 'note-1',
    text: 'All incidents happen near military bases. Coincidence?',
    x: 350,
    y: 300,
    color: '#fef08a',
    rotation: -8
  },
  {
    id: 'note-2', 
    text: 'Government cover-up timeline:\n1947 - Roswell\n1952 - Blue Book begins\n1969 - Blue Book ends\n\nWhy the sudden stop?',
    x: 750,
    y: 200,
    color: '#fed7aa',
    rotation: 5
  }
]

const starterWanted: WantedPoster[] = [
  {
    id: 'wanted-1',
    name: 'Edward J. Snowden',
    alias: 'The Whistleblower',
    crime: 'Espionage, Theft of Government Property',
    description: 'Former NSA contractor. 5\'9", brown hair, brown eyes. Known for intelligence leaks.',
    reward: '$500,000',
    x: 900,
    y: 100,
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    rotation: -6
  }
]

const starterPapers: LinedPaper[] = [
  {
    id: 'paper-1',
    content: 'Timeline of Events:\n\n1947 - Roswell Incident\n1952 - Project Blue Book begins\n1969 - Blue Book officially ends\n1984 - Majestic 12 documents surface\n\nQuestions:\n- Why did Blue Book end so abruptly?\n- Are the MJ-12 documents authentic?\n- What happened to the unidentified cases?',
    x: 1200,
    y: 250,
    rotation: 4
  }
]

const starterConnections: YarnConnection[] = [
  {
    id: 'connection-1',
    fromItemId: 'starter-1',
    toItemId: 'starter-2',
    fromItemType: 'photo',
    toItemType: 'photo',
    color: '#e53e3e'
  },
  {
    id: 'connection-2',
    fromItemId: 'starter-2',
    toItemId: 'starter-3',
    fromItemType: 'photo',
    toItemType: 'photo',
    color: '#e53e3e'
  },
  {
    id: 'connection-5',
    fromItemId: 'note-1',
    toItemId: 'starter-1',
    fromItemType: 'note',
    toItemType: 'photo',
    color: '#e53e3e'
  },
  {
    id: 'connection-6',
    fromItemId: 'note-2',
    toItemId: 'starter-3',
    fromItemType: 'note',
    toItemType: 'photo',
    color: '#e53e3e'
  }
]

function App() {
  const [photos, setPhotos] = useState<Photo[]>(starterPhotos)
  const [notes, setNotes] = useState<StickyNote[]>(starterNotes)
  const [wantedPosters, setWantedPosters] = useState<WantedPoster[]>(starterWanted)
  const [papers, setPapers] = useState<LinedPaper[]>(starterPapers)
  const [charlieImages, setCharlieImages] = useState<CharlieImage[]>([{
    id: 'charlie-1',
    x: 50,
    y: window.innerHeight - 250,
    width: 200,
    height: 200
  }])
  const [connections, setConnections] = useState<YarnConnection[]>(starterConnections)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedNote, setSelectedNote] = useState<StickyNote | null>(null)
  const [selectedWanted, setSelectedWanted] = useState<WantedPoster | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<LinedPaper | null>(null)
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false)
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [isWantedEditorOpen, setIsWantedEditorOpen] = useState(false)
  const [isPaperEditorOpen, setIsPaperEditorOpen] = useState(false)
  const [isConnectionMode, setIsConnectionMode] = useState(false)
  const [boardTitle, setBoardTitle] = useState('UFO Conspiracy Board')
  const [notification, setNotification] = useState<{ message: string; type: NotificationType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false
  })
  
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

  const handleSaveBoard = useCallback(() => {
    try {
      saveBoard(boardTitle, photos, notes, wantedPosters, papers, connections)
      showNotification('Board saved successfully!', 'success')
    } catch (error) {
      showNotification('Failed to save board', 'error')
      console.error('Save error:', error)
    }
  }, [boardTitle, photos, notes, wantedPosters, papers, connections, showNotification])

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
      <AppTitle>🧵 {boardTitle}</AppTitle>
      
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
    </AppContainer>
  )
}

export default App
