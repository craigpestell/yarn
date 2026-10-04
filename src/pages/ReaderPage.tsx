import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useFork } from '../boards/useFork'
import { Backlinks } from '../links/Backlinks'
import { Breadcrumb } from '../links/Breadcrumb'
import { fetchBacklinks, fetchLinks } from '../links/api'
import { LinksContext, type LinksValue } from '../links/LinksContext'
import { SlugSchema, type Backlink, type LinkView } from '../links/schemas'
import { resolveTrail, type TrailEntry } from '../links/trail'
import { fetchForkSource, loadReaderBoard } from '../reader/api'
import { ReadOnlyCanvas } from '../reader/ReadOnlyCanvas'
import type { ForkSource, ReaderBoard } from '../reader/schemas'

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; board: ReaderBoard }

/** Read-only viewer at /b/:slug. Non-owners see the published snapshot; the owner sees the live board. */
export function ReaderPage() {
  const slug = SlugSchema.safeParse(useParams().slug)
  const { client, user, loading } = useAuth()
  const uid = user?.id ?? null
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [links, setLinks] = useState<ReadonlyMap<string, LinkView>>(new Map())
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const [forkSource, setForkSource] = useState<ForkSource | null>(null)
  const { fork, busy: forking, error: forkError } = useFork()
  const [trail, setTrail] = useState<TrailEntry[]>([])
  const slugValue = slug.success ? slug.data : null

  useEffect(() => {
    if (loading || !slugValue) return
    if (!client) return setState({ kind: 'error', message: 'Boards are not available in this build.' })
    let live = true
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const board = await loadReaderBoard(client, slugValue, uid !== null)
        if (!live) return
        if (!board) return setState({ kind: 'missing' })
        setTrail(resolveTrail(window.sessionStorage, board.slug))
        const [l, b, f] = await Promise.all([
          fetchLinks(client, board.id).catch(() => new Map<string, LinkView>()),
          fetchBacklinks(client, board.id).catch(() => []),
          uid ? fetchForkSource(client, board.id).catch(() => null) : null,
        ])
        if (!live) return
        setLinks(l)
        setBacklinks(b)
        setForkSource(f)
        setState({ kind: 'ready', board })
      } catch (e) {
        if (live) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load the board' })
      }
    })()
    return () => {
      live = false
    }
  }, [client, uid, loading, slugValue])

  const board = state.kind === 'ready' ? state.board : null
  const value = useMemo<LinksValue>(
    () => ({ links, from: board ? { slug: board.slug, title: board.title.slice(0, 200) } : null, editor: null }),
    [links, board],
  )

  if (state.kind !== 'ready') {
    return (
      <>
        <main className="page">
          {!slugValue || state.kind === 'missing' ? (
            <><h1>Board not found</h1><p role="alert">There is no board here, or you do not have access to it.</p></>
          ) : state.kind === 'error' ? (
            <p role="alert">{state.message}</p>
          ) : (
            <p role="status">Loading board...</p>
          )}
        </main>
      </>
    )
  }
  return (
    <div className="app">
      <header className="topbar reader-head">
        <h1 className="title">{state.board.title}</h1>
        {state.board.isOwner && <Link to={`/edit/${state.board.id}`}>Edit this board</Link>}
        {state.board.isOwner && <span className="hint">You are viewing your live board.</span>}
        {!state.board.isOwner && uid && (
          <button type="button" disabled={forking} onClick={() => void fork(state.board.id)}>Fork</button>
        )}
        {!state.board.isOwner && !uid && (
          <Link to="/login" state={{ from: `/b/${state.board.slug}` }}>Log in to fork</Link>
        )}
        {forkSource?.kind === 'available' && (
          <span className="hint">Forked from <Link to={`/b/${forkSource.slug}`}>{forkSource.title}</Link></span>
        )}
        {forkSource?.kind === 'unavailable' && <span className="hint">Forked from an unavailable board</span>}
        <div role="alert" className="form-alert">{forkError}</div>
      </header>
      <Breadcrumb trail={trail} current={state.board.title} />
      <LinksContext.Provider value={value}>
        <main className="stage reader-stage">
          <ReadOnlyCanvas doc={state.board.doc} />
        </main>
      </LinksContext.Provider>
      <Backlinks items={backlinks} />
    </div>
  )
}
