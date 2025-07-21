import type { Photo, StickyNote, WantedPoster, LinedPaper, YarnConnection } from '../types'

export interface BoardData {
  version: string
  timestamp: string
  title: string
  photos: Photo[]
  notes: StickyNote[]
  wantedPosters: WantedPoster[]
  papers: LinedPaper[]
  connections: YarnConnection[]
}

export const saveBoard = (
  title: string,
  photos: Photo[],
  notes: StickyNote[],
  wantedPosters: WantedPoster[],
  papers: LinedPaper[],
  connections: YarnConnection[]
): void => {
  const boardData: BoardData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    title: title || 'Conspiracy Board',
    photos,
    notes,
    wantedPosters,
    papers,
    connections
  }

  const jsonString = JSON.stringify(boardData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(title || 'conspiracy-board')}-${formatDate(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

export const loadBoard = (): Promise<BoardData | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const boardData: BoardData = JSON.parse(content)
          
          // Validate the board data structure
          if (validateBoardData(boardData)) {
            resolve(boardData)
          } else {
            console.error('Invalid board data format')
            resolve(null)
          }
        } catch (error) {
          console.error('Error parsing board file:', error)
          resolve(null)
        }
      }
      
      reader.readAsText(file)
    }
    
    input.click()
  })
}

const validateBoardData = (data: unknown): data is BoardData => {
  if (!data || typeof data !== 'object') {
    return false
  }
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.version === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.photos) &&
    Array.isArray(obj.notes) &&
    Array.isArray(obj.wantedPosters) &&
    Array.isArray(obj.papers) &&
    Array.isArray(obj.connections)
  )
}

const sanitizeFilename = (filename: string): string => {
  // Remove invalid filename characters
  return filename.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').toLowerCase()
}

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] // YYYY-MM-DD format
}
