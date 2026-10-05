import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { WIDGET_TYPES, type WidgetType } from '../../shared/schema'
import { useBoard } from './store'

const ADD_LABEL: Record<WidgetType, string> = {
  photo: 'Add photo',
  note: 'Add note',
  wanted: 'Add wanted poster',
  paper: 'Add paper',
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** A button that opens a small list of actions; closes on pick, outside click or Escape. */
function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={root}>
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label} ▾</Button>
      {open && <div role="menu" className="absolute left-0 top-[calc(100%+4px)] z-20 flex min-w-44 flex-col gap-1 rounded-md border border-border bg-background p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.3)]">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function Toolbar() {
  const connect = useBoard((s) => s.connect)
  const busy = useBoard((s) => s.busy)
  const file = useRef<HTMLInputElement>(null)

  const organize = async () => {
    await useBoard.getState().organize()
  }
  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    useBoard.getState().importJson(await f.text())
  }

  return (
    <div className="tw flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Board tools">
      <Menu label="Add">
        {(close) => WIDGET_TYPES.map((t) => (
          <Button key={t} variant="menuitem" role="menuitem" onClick={() => { useBoard.getState().addWidget(t); close() }}>{ADD_LABEL[t]}</Button>
        ))}
      </Menu>
      <Button variant="toggle" aria-pressed={connect.active} onClick={() => useBoard.getState().toggleConnectMode()}>
        Connect yarn
      </Button>
      <Button disabled={busy} className="disabled:cursor-progress" onClick={() => void organize()}>
        {busy ? 'Organizing...' : 'Auto-organize'}
      </Button>
      <Menu label="Import / export">
        {(close) => (
          <>
            <Button variant="menuitem" role="menuitem" onClick={() => { download('board.json', useBoard.getState().exportJson()); close() }}>Export JSON</Button>
            <Button variant="menuitem" role="menuitem" onClick={() => { file.current?.click(); close() }}>Import JSON</Button>
          </>
        )}
      </Menu>
      <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import JSON file" onChange={(e) => void onImport(e)} />
      {connect.active && (
        <span className="text-[0.9rem] text-amber-200" role="status">
          {connect.source ? 'Pick the target widget' : 'Pick the source widget'} (Esc cancels)
        </span>
      )}
    </div>
  )
}
