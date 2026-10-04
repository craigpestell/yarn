import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { flushActiveSave } from '../boards/activeSave'
import type { Visibility } from '../boards/schemas'
import { renderThumbnailPng } from '../boards/thumbnailSvg'
import { removePublishedThumbnail, uploadPublishedThumbnail } from '../boards/thumbnails'
import { useBoard } from '../editor/store'
import { getPublishState, publishBoard, setShowBacklinks, unpublishBoard } from './api'
import type { PublishState } from './schemas'
import { SharePanel } from './SharePanel'
import { TopicTags } from './TopicTags'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const LABEL: Record<Visibility, string> = {
  private: 'Private (only people you share with)',
  unlisted: 'Unlisted (anyone with the link)',
  public: 'Public (anyone, and listed in topics)',
}

interface Props {
  client: SupabaseClient
  ownerId: string
  boardId: string
  slug: string
}

/** Publish dialog for the editor: visibility, snapshot, unpublish, share list, backlinks toggle and topic tags. */
export function PublishPanel({ client, ownerId, boardId, slug }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PublishState | null>(null)
  const [visibility, setVisibility] = useState<Visibility>('unlisted')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await getPublishState(client, boardId)
      setState(s)
      if (s.published_revision !== null) setVisibility(s.visibility)
    } catch (e) {
      setError(message(e))
    }
  }, [client, boardId])
  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(ok)
      await refresh()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const publish = () =>
    run(async () => {
      // Publish what is saved: wait for autosave first so the snapshot is the board on screen.
      if (!(await flushActiveSave())) throw new Error('Your latest edits could not be saved yet. Fix the save problem first, then publish.')
      await publishBoard(client, boardId, visibility)
      if (visibility === 'private') {
        await removePublishedThumbnail(client, ownerId, boardId)
        return
      }
      try {
        await uploadPublishedThumbnail(client, ownerId, boardId, await renderThumbnailPng(useBoard.getState().doc))
      } catch {
        // a missing share preview image is not worth failing the publish, but never leave the old one for the new snapshot
        await removePublishedThumbnail(client, ownerId, boardId)
      }
    }, 'Published. Readers now see this version.')
  const unpublish = () =>
    run(async () => {
      await unpublishBoard(client, boardId)
      await removePublishedThumbnail(client, ownerId, boardId)
    }, 'Unpublished. The board is private again.')

  const published = state !== null && state.published_revision !== null
  const stale = state !== null && published && state.revision !== state.published_revision
  const url = `${window.location.origin}/b/${slug}`
  return (
    <div className="publish">
      <button type="button" aria-expanded={open} aria-controls="publish-panel" onClick={() => setOpen((o) => !o)}>
        Publish and share
      </button>
      {open && (
        <section id="publish-panel" className="publish-panel" aria-label="Publish and share">
          {state === null ? (
            <p role="status">Loading...</p>
          ) : (
            <>
              <p role="status">
                {published ? `Published (visibility: ${state.visibility}).${stale ? ' You have changes that are not published yet.' : ''}` : 'Not published. Only you can see this board.'}
              </p>
              <label className="field">
                Who can read it
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                  {(['private', 'unlisted', 'public'] as const).map((v) => (
                    <option key={v} value={v}>{LABEL[v]}</option>
                  ))}
                </select>
              </label>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => void publish()}>{published ? 'Publish changes' : 'Publish'}</button>
                {published && <button type="button" className="danger" disabled={busy} onClick={() => void unpublish()}>Unpublish</button>}
              </div>
              {published && (
                <p>
                  Link: <a href={`/b/${slug}`}>{url}</a>
                </p>
              )}
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={state.show_backlinks}
                  disabled={busy}
                  onChange={(e) => void run(() => setShowBacklinks(client, boardId, e.target.checked), 'Backlinks setting saved.')}
                />
                Show &quot;Linked from&quot; on the public page
              </label>
              <SharePanel client={client} boardId={boardId} />
              {published && state.visibility === 'public' && <TopicTags client={client} boardId={boardId} />}
            </>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && <p className="err" role="alert">{error}</p>}
        </section>
      )}
    </div>
  )
}
