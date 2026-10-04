import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { getBoard } from './api'
import { forkBoard } from './fork'
import { renderThumbnailPng } from './thumbnailSvg'
import { uploadThumbnail } from './thumbnails'
import { withTimeout } from './withTimeout'

const THUMB_TIMEOUT_MS = 5000

/** Fork a board, upload a thumbnail of the copy (best effort, never blocks), then open it in the editor. */
export function useFork() {
  const { client, user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uid = user?.id

  const fork = useCallback(
    async (sourceId: string) => {
      if (!client || !uid || busy) return
      setBusy(true)
      setError(null)
      try {
        const copy = await forkBoard(client, sourceId)
        try {
          // the copy's doc (storage images stripped), not the source's, so the thumbnail matches what the forker owns
          const png = async () => renderThumbnailPng((await getBoard(client, copy.id)).doc)
          await withTimeout(png().then((b) => uploadThumbnail(client, uid, copy.id, b)), THUMB_TIMEOUT_MS, undefined)
        } catch {
          // a missing thumbnail is not worth failing the fork
        }
        void navigate(`/edit/${copy.id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
        setBusy(false)
      }
    },
    [client, uid, busy, navigate],
  )

  return { fork, busy, error }
}
