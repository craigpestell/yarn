import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useBoard } from '../editor/store'
import { getBoard } from './api'
import { registerActiveSave } from './activeSave'
import { startServerAutosave, type SaveStatus } from './autosave'
import { createReconcileFn, createSaveFn } from './save'
import { editorTitle, guardTitle } from './titleGuard'
import { renderThumbnailPng } from './thumbnailSvg'
import { createThumbnailScheduler, uploadThumbnail } from './thumbnails'
import { useUnloadGuard } from './useUnloadGuard'

export type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' }

/** Loads an owned board into the editor store and keeps it synced to the server (autosave + thumbnail). */
export function useServerBoard(boardId: string) {
  const { client, user } = useAuth()
  const uid = user?.id
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [status, setStatus] = useState<SaveStatus>({ kind: 'saved' })
  const [generation, setGeneration] = useState(0)
  useUnloadGuard(status)

  useEffect(() => {
    if (!client || !uid) return
    let cancelled = false
    let stop: (() => void) | undefined
    setPhase({ kind: 'loading' })
    setStatus({ kind: 'saved' })
    void (async () => {
      try {
        const board = await getBoard(client, boardId)
        if (cancelled) return
        if (board.deleted_at !== null) return setPhase({ kind: 'error', message: 'This board is in the trash. Restore it from My boards to edit it.' })
        if (!useBoard.getState().loadBoard(editorTitle(board.title), board.doc)) {
          return setPhase({ kind: 'error', message: 'This board could not be loaded because its data is invalid.' })
        }
        const thumbs = createThumbnailScheduler(
          renderThumbnailPng,
          (png) => uploadThumbnail(client, uid, boardId, png),
        )
        const save = startServerAutosave(guardTitle(useBoard, board.title), {
          boardId,
          initialRevision: board.revision,
          save: createSaveFn(client),
          reconcile: createReconcileFn(client),
          onStatus: setStatus,
          onSaved: (saved) => thumbs.schedule(saved.doc),
        })
        const unregister = registerActiveSave(save.flush)
        stop = () => {
          unregister()
          void save.stop().then(thumbs.stop)
        }
        setPhase({ kind: 'ready' })
      } catch (e) {
        if (!cancelled) setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load the board' })
      }
    })()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [client, uid, boardId, generation])

  /** Discard local edits and reload the server's version (also restarts autosave with the new revision). */
  const reloadFromServer = useCallback(() => setGeneration((g) => g + 1), [])
  return { phase, status, reloadFromServer }
}
