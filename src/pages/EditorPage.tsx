import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { App } from '../App'
import { useAuth } from '../auth/AuthProvider'
import { LeaveGuard } from '../boards/LeaveGuard'
import { SaveBanner } from '../boards/SaveBanner'
import { useServerBoard } from '../boards/useServerBoard'
import { useBoard } from '../editor/store'
import { fetchLinks } from '../links/api'
import { LinksContext, type LinksValue } from '../links/LinksContext'
import type { LinkView } from '../links/schemas'
import { PublishPanel } from '../publish/PublishPanel'

/** Owner editor for a stored board at /edit/:id. */
export function EditorPage() {
  const parsed = z.uuid().safeParse(useParams().id)
  if (!parsed.success) {
    return (
      <>
        <main className="page"><h1>Board not found</h1><p role="alert">There is no board at this address.</p></main>
      </>
    )
  }
  return <ServerEditor id={parsed.data} />
}

function ServerEditor({ id }: { id: string }) {
  const { client, user } = useAuth()
  const { phase, status, reloadFromServer, slug } = useServerBoard(id)
  const title = useBoard((s) => s.title)
  const [links, setLinks] = useState<ReadonlyMap<string, LinkView>>(new Map())
  const ready = phase.kind === 'ready'

  const reloadLinks = useCallback(() => {
    if (!client) return
    fetchLinks(client, id).then(setLinks, () => undefined)
  }, [client, id])
  useEffect(() => {
    if (ready) reloadLinks()
  }, [ready, reloadLinks])

  const value = useMemo<LinksValue>(
    () => ({
      links,
      from: slug ? { slug, title: title.slice(0, 200) } : null,
      editor: client ? { client, boardId: id, onChanged: reloadLinks } : null,
    }),
    [links, slug, title, client, id, reloadLinks],
  )

  if (phase.kind !== 'ready') {
    return (
      <>
        {phase.kind === 'error' ? <p role="alert" className="page">{phase.message}</p> : <p role="status" className="page">Loading board...</p>}
      </>
    )
  }
  const unsaveable = ['offline', 'rejected', 'unauthenticated', 'conflict'].includes(status.kind)
  return (
    <LinksContext.Provider value={value}>
      <App
        banner={
          <>
            <SaveBanner status={status} onReload={reloadFromServer} />
            <LeaveGuard active={unsaveable} />
          </>
        }
        tools={client && user && slug ? <PublishPanel client={client} ownerId={user.id} boardId={id} slug={slug} /> : null}
      />
    </LinksContext.Provider>
  )
}
