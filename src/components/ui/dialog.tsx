import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
  'summary',
  'iframe',
  'audio[controls]',
  '[tabindex]',
]
  .map((q) => `${q}:not([tabindex="-1"])`)
  .join(', ')

/** Marks every other child of <body> inert and aria-hidden while the dialog is mounted, then restores what was there. */
function useInertBackground(root: { current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const host = root.current
    const saved = [...document.body.children]
      .filter((el) => el !== host)
      .map((el) => ({ el, inert: el.getAttribute('inert'), hidden: el.getAttribute('aria-hidden') }))
    for (const { el } of saved) {
      el.setAttribute('inert', '')
      el.setAttribute('aria-hidden', 'true')
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      for (const { el, inert, hidden } of saved) {
        if (inert === null) el.removeAttribute('inert')
        else el.setAttribute('inert', inert)
        if (hidden === null) el.removeAttribute('aria-hidden')
        else el.setAttribute('aria-hidden', hidden)
      }
    }
  }, [root])
}

export interface DialogProps {
  /** Id of the element that names the dialog. */
  labelledBy: string
  onClose: () => void
  /** Element to focus on open; defaults to the first focusable control. */
  initialFocus?: (panel: HTMLElement) => HTMLElement | null | undefined
  className?: string
  children: ReactNode
}

/**
 * Modal dialog primitive: portalled to <body>, labelled, background inert, Tab trapped, scroll locked.
 * Escape and a backdrop click call onClose; Escape is consumed here so nothing else (connect mode, menus) also reacts.
 * Mount it only while open. It never restores focus itself: the owner does that (the Canvas focus request).
 */
export function Dialog({ labelledBy, onClose, initialFocus, className, children }: DialogProps) {
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const pick = useRef(initialFocus)
  pick.current = initialFocus
  useInertBackground(root)

  useEffect(() => {
    const p = panel.current
    if (!p) return
    const target = pick.current?.(p) ?? p.querySelector<HTMLElement>(FOCUSABLE) ?? p
    target.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panel.current || !panel.current.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !panel.current.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      ref={root}
      className="tw fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={trap}
        className={cn('flex max-h-full w-full flex-col gap-3 overflow-y-auto border-2 border-border bg-background p-4 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.5)]', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
