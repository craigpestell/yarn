import { Frame, type WidgetNodeProps } from './Frame'

export function WantedNode({ data }: WidgetNodeProps) {
  const w = data.widget
  if (w.type !== 'wanted') return null
  const d = w.data
  return (
    <Frame {...data} className="wanted">
      <div className="wanted-head">WANTED</div>
      <div className="wanted-name">{d.name}</div>
      {d.alias && <div className="wanted-alias">&ldquo;{d.alias}&rdquo;</div>}
      <div className="wanted-crime">{d.crime}</div>
      <div className="wanted-desc">{d.description}</div>
      <div className="wanted-reward">
        <span>REWARD</span>
        <strong>{d.reward}</strong>
      </div>
    </Frame>
  )
}
