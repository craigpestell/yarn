import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BoardCard } from '../boards/BoardCard'
import { ConfirmDialog } from '../boards/ConfirmDialog'
import { useBoards } from '../boards/useBoards'

export function BoardsPage() {
  const { boards, thumbs, error, create, duplicate, rename, trash, restore, emptyTrash, deleteForever } = useBoards()
  const navigate = useNavigate()
  // null: closed; 'all': empty the trash; otherwise the id of the one board to delete forever
  const [confirming, setConfirming] = useState<'all' | { id: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const trashHeading = useRef<HTMLHeadingElement>(null)
  const live = boards?.filter((b) => b.deleted_at === null) ?? []
  const trashed = boards?.filter((b) => b.deleted_at !== null) ?? []

  const onCreate = async () => {
    const b = await create()
    if (b) void navigate(`/edit/${b.id}`)
  }

  const onConfirm = async () => {
    if (!confirming) return
    setBusy(true)
    try {
      await (confirming === 'all' ? emptyTrash() : deleteForever(confirming.id))
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  return (
    <>
      <main className="page">
        <h1>My boards</h1>
        <div role="alert" className="form-alert">{error}</div>
        <p><button type="button" onClick={() => void onCreate()}>New board</button></p>
        {boards === null ? (
          <p role="status">Loading...</p>
        ) : live.length === 0 ? (
          <p>You have no boards yet.</p>
        ) : (
          <ul className="board-grid" aria-label="Your boards">
            {live.map((b) => (
              <BoardCard
                key={b.id}
                board={b}
                thumbUrl={thumbs.get(b.id)}
                onRename={(t) => void rename(b.id, t)}
                onDuplicate={() => void duplicate(b.id)}
                onTrash={() => void trash(b.id)}
              />
            ))}
          </ul>
        )}
        <section aria-labelledby="trash-h">
          <h2 id="trash-h" ref={trashHeading} tabIndex={-1}>Trash</h2>
          {trashed.length === 0 ? (
            <p className="muted">Trash is empty.</p>
          ) : (
            <>
              <p><button type="button" onClick={() => setConfirming('all')} disabled={busy}>Empty trash</button></p>
              <ul className="trash-list" aria-label="Trashed boards">
                {trashed.map((b) => (
                  <li key={b.id}>
                    <span>{b.title}</span>
                    <button type="button" onClick={() => void restore(b.id)} aria-label={`Restore ${b.title}`} disabled={busy}>Restore</button>
                    <button type="button" onClick={() => setConfirming({ id: b.id })} aria-label={`Delete forever: ${b.title}`} disabled={busy}>Delete forever</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {confirming && (
          <ConfirmDialog
            heading={confirming === 'all' ? 'Empty trash?' : 'Delete forever?'}
            count={confirming === 'all' ? trashed.length : 1}
            confirmLabel={confirming === 'all' ? 'Empty trash' : 'Delete forever'}
            busy={busy}
            onConfirm={() => void onConfirm()}
            onCancel={() => setConfirming(null)}
            fallbackFocus={trashHeading}
          />
        )}
      </main>
    </>
  )
}
