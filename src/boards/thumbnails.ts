import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Doc } from '../../shared/schema'

export const THUMB_BUCKET = 'thumbnails'
export const thumbnailPath = (ownerId: string, boardId: string): string => `${ownerId}/${boardId}.png`

export async function uploadThumbnail(client: SupabaseClient, ownerId: string, boardId: string, png: Blob): Promise<void> {
  const { error } = await client.storage
    .from(THUMB_BUCKET)
    .upload(thumbnailPath(ownerId, boardId), png, { upsert: true, contentType: 'image/png' })
  if (error) throw new Error(error.message)
}

const SignedSchema = z.array(z.object({ path: z.string().nullable(), signedUrl: z.string().optional() }))

/** Signed URLs (1 hour) for the given boards; boards without a thumbnail are simply absent from the map. */
export async function thumbnailUrls(client: SupabaseClient, ownerId: string, boardIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (boardIds.length === 0) return out
  const paths = boardIds.map((id) => thumbnailPath(ownerId, id))
  const { data, error } = await client.storage.from(THUMB_BUCKET).createSignedUrls(paths, 3600)
  if (error) return out
  const rows = SignedSchema.parse(data)
  rows.forEach((r, i) => {
    const id = boardIds[i]
    if (id && r.path && r.signedUrl) out.set(id, r.signedUrl)
  })
  return out
}

const PAGE = 1000

/**
 * Remove every thumbnail the user owns (before account deletion). Pages through the whole folder.
 * Resolves to an error message, or null when everything was removed.
 */
export async function removeAllThumbnails(client: SupabaseClient, ownerId: string): Promise<string | null> {
  const bucket = client.storage.from(THUMB_BUCKET)
  for (let pass = 0; pass < 100; pass++) {
    // Always list from offset 0: each pass removes what it listed, so the next page moves up.
    const { data, error } = await bucket.list(ownerId, { limit: PAGE, offset: 0 })
    if (error) return error.message
    if (!data || data.length === 0) break
    const paths = data.map((f) => `${ownerId}/${f.name}`)
    const { data: removed, error: rmError } = await bucket.remove(paths)
    if (rmError) return rmError.message
    if (!removed || removed.length < paths.length) return 'some thumbnails could not be removed'
    if (data.length < PAGE) break
  }
  // Storage RLS can make remove() succeed while deleting nothing, so verify the folder is really empty.
  const { data: left, error: leftError } = await bucket.list(ownerId, { limit: 1 })
  if (leftError) return leftError.message
  return left && left.length > 0 ? 'some thumbnails could not be removed' : null
}

/**
 * Debounced thumbnail regeneration. Call `schedule(doc)` after a successful save with the doc that was saved;
 * the doc is captured then, never re-read later, so a thumbnail can only ever show the board it was scheduled for
 * (the editor store may hold a different board by the time the timer fires). Calls after `stop()` are ignored.
 * Failures are swallowed: a thumbnail is never worth an error. `stop()` flushes pending work once.
 */
export function createThumbnailScheduler(
  render: (doc: Doc) => Promise<Blob>,
  upload: (png: Blob) => Promise<void>,
  delayMs = 4000,
): { schedule: (doc: Doc) => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Doc | null = null
  let stopped = false
  const run = async () => {
    timer = undefined
    const doc = pending
    pending = null
    if (!doc) return
    try {
      await upload(await render(doc))
    } catch {
      // ignore; the next save retries
    }
  }
  return {
    schedule: (doc) => {
      if (stopped) return
      pending = doc
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => void run(), delayMs)
    },
    stop: () => {
      if (stopped) return
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      void run()
    },
  }
}
