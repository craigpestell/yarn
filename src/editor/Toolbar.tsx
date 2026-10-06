import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'
import { Button } from '@/components/ui/button'
import { WIDGET_TYPES, type WidgetType } from '../../shared/schema'
import { useBoard } from './store'
import { DownloadIcon, LayoutIcon, LinkIcon, NoteIcon, PaperIcon, PhotoIcon, PlusIcon, TransferIcon, UploadIcon, WantedIcon } from './icons'

const ADD_LABEL: Record<WidgetType, string> = {
  photo: 'Add photo',
  note: 'Add note',
  wanted: 'Add wanted poster',
  paper: 'Add paper',
}

const ADD_ICON: Record<WidgetType, ReactNode> = {
  photo: <PhotoIcon />,
  note: <NoteIcon />,
  wanted: <WantedIcon />,
  paper: <PaperIcon />,
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** The popup renders inside the toolbar's DOM; keep its arrow keys from moving the toolbar's roving focus. */
const keepArrowsInMenu = (e: ReactKeyboardEvent<HTMLElement>) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

/** A button that opens a small list of actions; closes on pick, outside click or Escape. */
function Menu({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
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
      <BaseToolbar.Button render={<Button className="aria-expanded:bg-primary-hover" />} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{icon}{label} ▾</BaseToolbar.Button>
      {open && <div role="menu" onKeyDown={keepArrowsInMenu} className="absolute left-0 top-[calc(100%+6px)] z-20 flex min-w-44 flex-col gap-0.5 rounded-[4px] border border-tape-edge bg-[#33231a] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">{children(() => setOpen(false))}</div>}
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
    <BaseToolbar.Root className="tw relative flex flex-wrap items-center gap-1.5" aria-label="Board tools">
      <Menu label="Add" icon={<PlusIcon />}>
        {(close) => WIDGET_TYPES.map((t) => (
          <Button key={t} variant="menuitem" role="menuitem" onClick={() => { useBoard.getState().addWidget(t); close() }}>{ADD_ICON[t]}{ADD_LABEL[t]}</Button>
        ))}
      </Menu>
      <BaseToolbar.Button render={<Button variant="toggle" />} aria-pressed={connect.active} onClick={() => useBoard.getState().toggleConnectMode()}>
        <LinkIcon />Connect yarn
      </BaseToolbar.Button>
      <BaseToolbar.Button render={<Button className="data-[disabled]:cursor-progress data-[disabled]:opacity-60 data-[disabled]:hover:bg-primary" />} disabled={busy} onClick={() => void organize()}>
        <LayoutIcon />{busy ? 'Organizing...' : 'Auto-organize'}
      </BaseToolbar.Button>
      <Menu label="Import / export" icon={<TransferIcon />}>
        {(close) => (
          <>
            <Button variant="menuitem" role="menuitem" onClick={() => { download('board.json', useBoard.getState().exportJson()); close() }}><DownloadIcon />Export JSON</Button>
            <Button variant="menuitem" role="menuitem" onClick={() => { file.current?.click(); close() }}><UploadIcon />Import JSON</Button>
          </>
        )}
      </Menu>
      <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import JSON file" onChange={(e) => void onImport(e)} />
      {connect.active && (
        <span className="absolute left-0 top-[calc(100%+4px)] z-10 whitespace-nowrap rounded-[3px] bg-[#33231a] px-2 py-0.5 text-[0.9rem] text-amber-200 shadow-[0_2px_6px_rgba(0,0,0,0.4)]" role="status">
          {connect.source ? 'Pick the target widget' : 'Pick the source widget'} (Esc cancels)
        </span>
      )}
    </BaseToolbar.Root>
  )
}
