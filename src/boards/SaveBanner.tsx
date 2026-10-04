import { useEffect, useRef, useState } from 'react'
import { download } from '../editor/Toolbar'
import { useBoard } from '../editor/store'
import type { SaveStatus } from './autosave'

const keepCopy = () => download('board-local-copy.json', useBoard.getState().exportJson())

function KeepCopyButton() {
  return <button type="button" onClick={keepCopy}>Keep my copy (download JSON)</button>
}

const FAILURES: ReadonlySet<SaveStatus['kind']> = new Set(['offline', 'rejected', 'unauthenticated', 'conflict'])

/** Polite announcement only for "saved" after a failure; routine saving/saved is visible text but silent. */
function useRecoveryAnnouncement(kind: SaveStatus['kind']): string {
  const [text, setText] = useState('')
  const failed = useRef(false)
  useEffect(() => {
    if (FAILURES.has(kind)) {
      failed.current = true
      setText('')
    } else if (kind === 'saved' && failed.current) {
      failed.current = false
      setText('Your changes are saved again.')
    } else if (kind !== 'saved') {
      setText('')
    }
  }, [kind])
  return text
}

/** Save indicator plus the failure and conflict UI. Failures are role=alert; routine progress is not announced. */
export function SaveBanner({ status, onReload }: { status: SaveStatus; onReload: () => void }) {
  const recovered = useRecoveryAnnouncement(status.kind)
  switch (status.kind) {
    case 'conflict':
      return (
        <div className="error" role="alert">
          <span>
            This board was changed somewhere else (another tab or device), so your latest edits were not saved and nothing was
            overwritten. Choose how to continue.
          </span>
          <span className="actions">
            <KeepCopyButton />
            <button type="button" onClick={onReload}>Reload server version (discards my edits)</button>
          </span>
        </div>
      )
    case 'unauthenticated':
      return (
        <div className="error" role="alert">
          <span>Your session has ended, so your latest edits were not saved. Please log in again. Your edits are still in this tab; download a copy to be safe.</span>
          <span className="actions"><KeepCopyButton /></span>
        </div>
      )
    case 'offline':
      return (
        <p className="save-status" role="alert">
          Offline. Your changes are kept here and will save when the connection returns.
        </p>
      )
    case 'rejected':
      return (
        <p className="save-status" role="alert">
          The server rejected the last save: {status.message}
        </p>
      )
    default:
      return (
        <>
          <p className="save-status">{status.kind === 'saved' ? 'All changes saved' : status.kind === 'saving' ? 'Saving...' : 'Unsaved changes'}</p>
          <span className="visually-hidden" role="status">{recovered}</span>
        </>
      )
  }
}
