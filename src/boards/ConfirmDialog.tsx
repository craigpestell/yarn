import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from 'react'

interface Props {
  heading: string
  /** Boards that will be permanently deleted (advisory: the server re-checks what is still in the trash). */
  count: number
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Receives focus on close when the opener is gone (e.g. its row was deleted). */
  fallbackFocus?: RefObject<HTMLElement | null>
}

/**
 * In-page accessible confirmation (not window.confirm). Focus moves to Cancel on open, Tab is trapped between the
 * two buttons, Escape cancels, and focus returns to the element that opened it when the dialog closes (or to `fallbackFocus` if it was removed).
 */
export function ConfirmDialog({ heading, count, confirmLabel, busy, onConfirm, onCancel, fallbackFocus }: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement
    cancel.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
      else fallbackFocus?.current?.focus()
    }
    // capture the opener once, on mount
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (!busy) onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (document.activeElement === last || !root.current?.contains(document.activeElement))) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="confirm-backdrop">
      <div ref={root} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`} onKeyDown={onKeyDown}>
        <h2 id={`${id}-h`}>{heading}</h2>
        <p id={`${id}-d`}>
          {count === 1 ? '1 board' : `${count} boards`} currently in the trash will be permanently deleted. This cannot be undone.
        </p>
        <div className="actions">
          <button ref={cancel} type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
