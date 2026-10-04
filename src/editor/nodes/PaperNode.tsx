import { Frame, type WidgetNodeProps } from './Frame'

export function PaperNode({ data }: WidgetNodeProps) {
  const w = data.widget
  if (w.type !== 'paper') return null
  return (
    <Frame {...data} className="paper">
      <div className="paper-text">{w.data.content}</div>
    </Frame>
  )
}
