import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { THUMB_BUCKET } from '../boards/thumbnails'

const SignedSchema = z.array(z.object({ path: z.string().nullable(), signedUrl: z.string().nullish() }))

/**
 * Signed URLs (1 hour) for published thumbnail paths of any owners. Returns path -> url; paths that could not be
 * signed (missing file, null signedUrl, storage error, unexpected shape) are simply absent so the card shows
 * the placeholder. Never throws.
 */
export async function signThumbnailPaths(client: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (paths.length === 0) return out
  try {
    const { data, error } = await client.storage.from(THUMB_BUCKET).createSignedUrls(paths, 3600)
    if (error) return out
    const parsed = SignedSchema.safeParse(data)
    if (!parsed.success) return out
    for (const r of parsed.data) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
  } catch {
    // a thumbnail is never worth an error
  }
  return out
}
