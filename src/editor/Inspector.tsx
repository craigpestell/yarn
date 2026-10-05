import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS, type Widget } from '../../shared/schema'
import { WidgetLinkEditor } from '../links/WidgetLinkEditor'
import { widgetLabel } from './docOps'
import { FIELDS, STATUSES } from './fields'
import { RESIZE_RULES } from './geometry'
import { SourcesEditor } from './SourcesEditor'
import { useBoard } from './store'

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

/** The edit part of the widget dialog, driven by the field table. Renders standalone (no modal, heading or close). */
export function Inspector() {
  const selection = useBoard((s) => s.selection)
  const doc = useBoard((s) => s.doc)
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
    <div className="tw flex flex-col gap-2.5 text-foreground" data-edit-part>
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
    </div>
  )
}
