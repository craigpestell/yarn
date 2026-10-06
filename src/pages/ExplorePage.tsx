import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { listPublicBoards } from '../explore/api'
import { ExploreCard } from '../explore/ExploreCard'
import type { PublicBoard } from '../explore/schemas'
import { signThumbnailPaths } from '../explore/thumbnails'

/** Browse published public boards, newest first. Public: works without an account. */
export function ExplorePage() {
  const { client, loading } = useAuth()
  const [items, setItems] = useState<PublicBoard[] | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (after?: PublicBoard) => {
      if (!client) return
      setBusy(true)
      setError(null)
      try {
        const page = await listPublicBoards(client, after)
        const urls = await signThumbnailPaths(client, page.items.map((b) => b.thumbnail_path))
        setThumbs((prev) => new Map([...prev, ...urls]))
        setItems((prev) => {
          const seen = new Set((prev ?? []).map((b) => b.id))
          return [...(prev ?? []), ...page.items.filter((b) => !seen.has(b.id))]
        })
        setHasMore(page.hasMore)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load boards')
      } finally {
        setBusy(false)
      }
    },
    [client],
  )

  useEffect(() => {
    if (loading || !client) return
    void load()
  }, [client, loading, load])

  const last = items && items.length > 0 ? items[items.length - 1] : undefined
  return (
    <main className="page">
      <h1>Explore</h1>
      {!client && <p role="alert">Explore is not available in this build.</p>}
      {error && <p role="alert" className="form-alert">{error}</p>}
      {items === null ? (
        client && !error && <p role="status">Loading...</p>
      ) : items.length === 0 ? (
        <p>No public boards yet.</p>
      ) : (
        <ul className="board-grid" aria-label="Public boards">
          {items.map((b) => (
            <ExploreCard key={b.id} board={b} thumbUrl={thumbs.get(b.thumbnail_path)} />
          ))}
        </ul>
      )}
      {items !== null && items.length > 0 && hasMore && (
        <p>
          <button type="button" disabled={busy} aria-busy={busy} onClick={() => void load(last)}>
            {busy ? 'Loading...' : 'Load more'}
          </button>
        </p>
      )}
    </main>
  )
}
