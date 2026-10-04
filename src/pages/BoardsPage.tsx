import { useNavigate } from 'react-router'
import { BoardCard } from '../boards/BoardCard'
import { useBoards } from '../boards/useBoards'
import { NavBar } from './NavBar'

export function BoardsPage() {
  const { boards, thumbs, error, create, duplicate, rename, trash, restore } = useBoards()
  const navigate = useNavigate()
  const live = boards?.filter((b) => b.deleted_at === null) ?? []
  const trashed = boards?.filter((b) => b.deleted_at !== null) ?? []

  const onCreate = async () => {
    const b = await create()
    if (b) void navigate(`/edit/${b.id}`)
  }

  return (
    <>
      <NavBar />
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
          <h2 id="trash-h">Trash</h2>
          {trashed.length === 0 ? (
            <p className="muted">Trash is empty.</p>
          ) : (
            <ul className="trash-list" aria-label="Trashed boards">
              {trashed.map((b) => (
                <li key={b.id}>
                  <span>{b.title}</span>
                  <button type="button" onClick={() => void restore(b.id)} aria-label={`Restore ${b.title}`}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
