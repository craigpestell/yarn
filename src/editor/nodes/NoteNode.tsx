import { readableText } from '../geometry'
import { Frame, type WidgetNodeProps } from './Frame'

export function NoteNode({ data }: WidgetNodeProps) {
  const w = data.widget
  if (w.type !== 'note') return null
  return (
    <Frame {...data} className="note">
      <div className="note-body" style={{ background: w.data.color, color: readableText(w.data.color) }}>
        <div className="note-text">{w.data.text}</div>
        <div className="note-fold" />
      </div>
    </Frame>
  )
}
