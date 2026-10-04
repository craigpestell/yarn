import type { NodeTypes } from '@xyflow/react'
import { NoteNode } from './NoteNode'
import { PaperNode } from './PaperNode'
import { PhotoNode } from './PhotoNode'
import { WantedNode } from './WantedNode'

export const nodeTypes: NodeTypes = { photo: PhotoNode, note: NoteNode, wanted: WantedNode, paper: PaperNode }
