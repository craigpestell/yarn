import { useParams } from 'react-router'
import { z } from 'zod'
import { App } from '../App'
import { LeaveGuard } from '../boards/LeaveGuard'
import { SaveBanner } from '../boards/SaveBanner'
import { useServerBoard } from '../boards/useServerBoard'
import { NavBar } from './NavBar'

/** Owner editor for a stored board at /edit/:id. */
export function EditorPage() {
  const parsed = z.uuid().safeParse(useParams().id)
  if (!parsed.success) {
    return (
      <>
        <NavBar />
        <main className="page"><h1>Board not found</h1><p role="alert">There is no board at this address.</p></main>
      </>
    )
  }
  return <ServerEditor id={parsed.data} />
}

function ServerEditor({ id }: { id: string }) {
  const { phase, status, reloadFromServer } = useServerBoard(id)
  if (phase.kind !== 'ready') {
    return (
      <>
        <NavBar />
        {phase.kind === 'error' ? <p role="alert" className="page">{phase.message}</p> : <p role="status" className="page">Loading board...</p>}
      </>
    )
  }
  const unsaveable = ['offline', 'rejected', 'unauthenticated', 'conflict'].includes(status.kind)
  return (
    <App
      banner={
        <>
          <SaveBanner status={status} onReload={reloadFromServer} />
          <LeaveGuard active={unsaveable} />
        </>
      }
      nav={<NavBar />}
    />
  )
}
