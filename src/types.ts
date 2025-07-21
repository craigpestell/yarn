export interface DrawingPath {
  id: string
  points: number[]
  color: string
  strokeWidth: number
}

export interface Photo {
  id: string
  url: string
  title: string
  notes: string
  x: number
  y: number
  imageUrl: string
  rotation: number
  drawings?: DrawingPath[]
}

export interface StickyNote {
  id: string
  text: string
  x: number
  y: number
  color: string
  rotation: number
  drawings?: DrawingPath[]
  groupId?: string // For linking related notes together
  groupIndex?: number // Position within the group (0 = first, 1 = second, etc.)
}

export interface WantedPoster {
  id: string
  name: string
  alias: string
  crime: string
  description: string
  reward: string
  x: number
  y: number
  imageUrl: string
  rotation: number
  drawings?: DrawingPath[]
}

export interface LinedPaper {
  id: string
  content: string
  x: number
  y: number
  rotation: number
  drawings?: DrawingPath[]
}

export interface CharlieImage {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface YarnConnection {
  id: string
  fromItemId: string
  toItemId: string
  fromItemType: 'photo' | 'note' | 'wanted' | 'paper'
  toItemType: 'photo' | 'note' | 'wanted' | 'paper'
  color: string
}

export interface Position {
  x: number
  y: number
}
