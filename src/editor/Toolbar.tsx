import { useRef, type ChangeEvent } from 'react'
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
    <div className="toolbar" role="toolbar" aria-label="Board tools">
      {WIDGET_TYPES.map((t) => (
        <button key={t} type="button" onClick={() => useBoard.getState().addWidget(t)}>{ADD_LABEL[t]}</button>
      ))}
      <button type="button" aria-pressed={connect.active} onClick={() => useBoard.getState().toggleConnectMode()}>
        Connect yarn
      </button>
      <button type="button" disabled={busy} onClick={() => void organize()}>
        {busy ? 'Organizing...' : 'Auto-organize'}
      </button>
      <button type="button" onClick={() => download('board.json', useBoard.getState().exportJson())}>Export JSON</button>
      <button type="button" onClick={() => file.current?.click()}>Import JSON</button>
      <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import JSON file" onChange={(e) => void onImport(e)} />
      {connect.active && (
        <span className="hint" role="status">
          {connect.source ? 'Pick the target widget' : 'Pick the source widget'} (Esc cancels)
        </span>
      )}
    </div>
  )
}
