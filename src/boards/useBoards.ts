import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { renderThumbnailPng } from './thumbnailSvg'
import { createBoard, duplicateBoard, listBoards, renameBoard, restoreBoard, softDeleteBoard } from './api'
import type { BoardSummary } from './schemas'
import { thumbnailUrls, uploadThumbnail } from './thumbnails'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** State and actions for the My Boards screen. Every action reloads the list afterwards. */
export function useBoards() {
  const { client, user } = useAuth()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const uid = user?.id

  const reload = useCallback(async () => {
    if (!client || !uid) return
    try {
      const list = await listBoards(client)
      setBoards(list)
      setThumbs(await thumbnailUrls(client, uid, list.map((b) => b.id)))
      setError(null)
    } catch (e) {
      setError(message(e))
    }
  }, [client, uid])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(
    async <T,>(fn: (c: SupabaseClient, ownerId: string) => Promise<T>): Promise<T | null> => {
      if (!client || !uid) return null
      try {
        const r = await fn(client, uid)
        await reload()
        return r
      } catch (e) {
        setError(message(e))
        return null
      }
    },
    [client, uid, reload],
  )

  return {
    boards,
    thumbs,
    error,
    create: () => run((c, owner) => createBoard(c, owner, 'Untitled board')),
    duplicate: (boardId: string) =>
      run(async (c, owner) => {
        const copy = await duplicateBoard(c, owner, boardId)
        try {
          await uploadThumbnail(c, owner, copy.id, await renderThumbnailPng(copy.doc))
        } catch {
          // a missing thumbnail is not worth failing the duplicate
        }
        return copy
      }),
    rename: (boardId: string, title: string) => run((c) => renameBoard(c, boardId, title)),
    trash: (boardId: string) => run((c) => softDeleteBoard(c, boardId)),
    restore: (boardId: string) => run((c) => restoreBoard(c, boardId)),
  }
}
