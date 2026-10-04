import { useRef, useState, type KeyboardEvent } from 'react'
import { TITLE_MAX } from './boardIO'
import { useBoard } from './store'

/** Inline board title: Enter (or blur) saves, Escape cancels. */
export function TitleEdit() {
  const title = useBoard((s) => s.title)
  const setTitle = useBoard((s) => s.setTitle)
  const [draft, setDraft] = useState<string | null>(null)

  // Set by Escape so the blur that follows (or races with) it cannot save the abandoned draft.
  const cancelled = useRef(false)

  const commit = () => {
    if (!cancelled.current && draft !== null) setTitle(draft)
    setDraft(null)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') {
      cancelled.current = true
      setDraft(null)
    }
  }

  if (draft === null) {
    return (
      <h1 className="title">
        <button type="button" onClick={() => {
            cancelled.current = false
            setDraft(title)
          }} aria-label={`Board title: ${title}. Click to edit`}>
          {title}
        </button>
      </h1>
    )
  }
  return (
    <h1 className="title">
      <input autoFocus aria-label="Board title" maxLength={TITLE_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={commit} />
    </h1>
  )
}
