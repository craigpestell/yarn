import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { TITLE_MAX } from '../editor/boardIO'
import type { BoardSummary } from './schemas'

const VISIBILITY_LABEL = { private: 'Private', unlisted: 'Unlisted', public: 'Public' } as const

interface Props {
  board: BoardSummary
  thumbUrl?: string
  onRename: (title: string) => void
  onDuplicate: () => void
  onTrash: () => void
}

export function BoardCard({ board, thumbUrl, onRename, onDuplicate, onTrash }: Props) {
  const [editing, setEditing] = useState(false)
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onRename(String(new FormData(e.currentTarget).get('title') ?? ''))
    setEditing(false)
  }
  return (
    <li className="board-card">
      <Link to={`/edit/${board.id}`} className="thumb-link" aria-label={`Open ${board.title}`}>
        {thumbUrl ? <img src={thumbUrl} alt="" width={320} height={200} /> : <div className="thumb-empty" aria-hidden="true" />}
      </Link>
      <div className="board-meta">
        {editing ? (
          <form onSubmit={submit} className="rename-form">
            <label className="visually-hidden" htmlFor={`rename-${board.id}`}>New title for {board.title}</label>
            <input id={`rename-${board.id}`} name="title" defaultValue={board.title} maxLength={TITLE_MAX} required autoFocus />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <h2>{board.title}</h2>
        )}
        <span className={`vis vis-${board.visibility}`}>{VISIBILITY_LABEL[board.visibility]}</span>
      </div>
      <div className="board-actions">
        <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${board.title}`}>Rename</button>
        <button type="button" onClick={onDuplicate} aria-label={`Duplicate ${board.title}`}>Duplicate</button>
        <button type="button" onClick={onTrash} aria-label={`Move to trash: ${board.title}`}>Move to trash</button>
      </div>
    </li>
  )
}
