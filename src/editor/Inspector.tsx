import { LIMITS, type Widget, type WidgetType } from '../../shared/schema'
import { widgetLabel } from './docOps'
import { SourcesEditor } from './SourcesEditor'
import { useBoard } from './store'

interface Field {
  key: string
  label: string
  max: number
  multiline?: boolean
}
const FIELDS: Record<WidgetType, Field[]> = {
  photo: [
    { key: 'title', label: 'Title', max: LIMITS.photoTitle },
    { key: 'caption', label: 'Caption', max: LIMITS.caption, multiline: true },
  ],
  note: [{ key: 'text', label: 'Text', max: LIMITS.noteText, multiline: true }],
  wanted: [
    { key: 'name', label: 'Name', max: LIMITS.short },
    { key: 'alias', label: 'Alias', max: LIMITS.short },
    { key: 'crime', label: 'Crime', max: LIMITS.short },
    { key: 'description', label: 'Description', max: LIMITS.description, multiline: true },
    { key: 'reward', label: 'Reward', max: LIMITS.short },
  ],
  paper: [{ key: 'content', label: 'Content', max: LIMITS.paperContent, multiline: true }],
}
const STATUSES = ['claim', 'disputed', 'verified', 'speculation'] as const

function WidgetFields({ w }: { w: Widget }) {
  const patch = useBoard((s) => s.patchWidget)
  const data: Record<string, unknown> = w.data
  const text = (key: string) => (typeof data[key] === 'string' ? data[key] : '')
  return (
    <>
      {FIELDS[w.type].map((f) => (
        <label key={f.key} className="field">
          {f.label}
          {f.multiline ? (
            <textarea rows={4} maxLength={f.max} value={text(f.key)} onChange={(e) => patch(w.id, { data: { [f.key]: e.target.value } })} />
          ) : (
            <input type="text" maxLength={f.max} value={text(f.key)} onChange={(e) => patch(w.id, { data: { [f.key]: e.target.value } })} />
          )}
        </label>
      ))}
      {w.type === 'note' && (
        <label className="field">
          Color
          <input type="color" value={w.data.color} onChange={(e) => patch(w.id, { data: { color: e.target.value } })} />
        </label>
      )}
      <label className="field">
        Status
        <select value={w.status ?? ''} onChange={(e) => patch(w.id, { status: e.target.value || undefined })}>
          <option value="">None</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field inline">
        <input type="checkbox" checked={w.locked === true} onChange={(e) => patch(w.id, { locked: e.target.checked })} />
        Locked (cannot be moved)
      </label>
      <SourcesEditor widget={w} />
    </>
  )
}

/** The single, generic inspector: edits whatever is selected, driven by the field table above. */
export function Inspector() {
  const selection = useBoard((s) => s.selection)
  const doc = useBoard((s) => s.doc)
  const select = useBoard((s) => s.select)
  const deleteWidget = useBoard((s) => s.deleteWidget)
  const deleteEdge = useBoard((s) => s.deleteEdge)
  const patchEdge = useBoard((s) => s.patchEdge)
  const requestFocus = useBoard((s) => s.requestFocus)
  if (!selection) return null

  const widget = selection.kind === 'widget' ? doc.widgets.find((w) => w.id === selection.id) : undefined
  const edge = selection.kind === 'edge' ? doc.edges.find((e) => e.id === selection.id) : undefined
  if (!widget && !edge) return null
  const name = (id: string) => {
    const w = doc.widgets.find((x) => x.id === id)
    return w ? widgetLabel(w) : id
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-head">
        <h2>{widget ? widgetLabel(widget) : 'Yarn'}</h2>
        <button type="button" onClick={() => {
          select(null)
          requestFocus(selection.id)
        }}>Close</button>
      </div>
      {widget && <WidgetFields w={widget} />}
      {widget && <button type="button" className="danger" onClick={() => {
        requestFocus('canvas')
        deleteWidget(widget.id)
      }}>Delete widget</button>}
      {edge && (
        <>
          <p>{name(edge.source)} to {name(edge.target)}</p>
          <label className="field">
            Yarn color
            <input type="color" value={edge.color.length === 7 ? edge.color : '#e53e3e'} onChange={(e) => patchEdge(edge.id, e.target.value)} />
          </label>
          <button type="button" className="danger" onClick={() => {
            requestFocus('canvas')
            deleteEdge(edge.id)
          }}>Delete yarn</button>
        </>
      )}
    </aside>
  )
}
