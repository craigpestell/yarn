import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS, type Widget, type WidgetType } from '../../shared/schema'
import { WidgetLinkEditor } from '../links/WidgetLinkEditor'
import { widgetLabel } from './docOps'
import { RESIZE_RULES } from './geometry'
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

/** Keyboard route to resizing: width always, height only where it is not tied to the width. */
function SizeFields({ w }: { w: Extract<Widget, { type: 'photo' | 'paper' }> }) {
  const resizeTo = useBoard((s) => s.resizeTo)
  const rule = RESIZE_RULES[w.type]
  const num = (v: string) => (v === '' ? NaN : Number(v))
  return (
    <>
      <Label>
        Width
        <Input
          type="number"
          min={rule.minW}
          max={LIMITS.maxSize}
          value={w.w}
          disabled={w.locked === true}
          onChange={(e) => {
            const nw = num(e.target.value)
            resizeTo(w.id, nw, rule.keepAspect ? nw * (w.h / w.w) : w.h)
          }}
        />
      </Label>
      {!rule.keepAspect && (
        <Label>
          Height
          <Input type="number" min={rule.minH} max={LIMITS.maxSize} value={w.h} disabled={w.locked === true} onChange={(e) => resizeTo(w.id, w.w, num(e.target.value))} />
        </Label>
      )}
    </>
  )
}

function WidgetFields({ w }: { w: Widget }) {
  const patch = useBoard((s) => s.patchWidget)
  const data: Record<string, unknown> = w.data
  const text = (key: string) => (typeof data[key] === 'string' ? data[key] : '')
  return (
    <>
      {FIELDS[w.type].map((f) => (
        <Label key={f.key}>
          {f.label}
          {f.multiline ? (
            <Textarea rows={4} maxLength={f.max} value={text(f.key)} onChange={(e) => patch(w.id, { data: { [f.key]: e.target.value } })} />
          ) : (
            <Input type="text" maxLength={f.max} value={text(f.key)} onChange={(e) => patch(w.id, { data: { [f.key]: e.target.value } })} />
          )}
        </Label>
      ))}
      {w.type === 'note' && (
        <Label>
          Color
          <Input type="color" value={w.data.color} onChange={(e) => patch(w.id, { data: { color: e.target.value } })} />
        </Label>
      )}
      {(w.type === 'photo' || w.type === 'paper') && <SizeFields w={w} />}
      <Label>
        Status
        <Select value={w.status ?? ''} onChange={(e) => patch(w.id, { status: e.target.value || undefined })}>
          <option value="">None</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Label>
      <Label inline>
        <Input type="checkbox" checked={w.locked === true} onChange={(e) => patch(w.id, { locked: e.target.checked })} />
        Locked (cannot be moved)
      </Label>
      <SourcesEditor widget={w} />
      <WidgetLinkEditor widgetId={w.id} />
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
    <aside className="tw flex w-[300px] max-w-[45vw] flex-col gap-2.5 overflow-y-auto border-l-2 border-border bg-background p-3 text-foreground shadow-[-6px_0_14px_rgba(0,0,0,0.35)]" aria-label="Inspector">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-marker text-lg leading-tight [overflow-wrap:anywhere]">{widget ? widgetLabel(widget) : 'Yarn'}</h2>
        <Button onClick={() => {
          select(null)
          requestFocus(selection.id)
        }}>Close</Button>
      </div>
      {widget && <WidgetFields w={widget} />}
      {widget && <Button variant="destructive" onClick={() => {
        requestFocus('canvas')
        deleteWidget(widget.id)
      }}>Delete widget</Button>}
      {edge && (
        <>
          <p>{name(edge.source)} to {name(edge.target)}</p>
          <Label>
            Yarn color
            <Input type="color" value={edge.color.length === 7 ? edge.color : '#e53e3e'} onChange={(e) => patchEdge(edge.id, e.target.value)} />
          </Label>
          <Button variant="destructive" onClick={() => {
            requestFocus('canvas')
            deleteEdge(edge.id)
          }}>Delete yarn</Button>
        </>
      )}
    </aside>
  )
}
