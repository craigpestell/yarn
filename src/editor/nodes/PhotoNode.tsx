import { useId } from 'react'
import { Frame, type WidgetNodeProps } from './Frame'

function PhotoArt() {
  const gid = useId()
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <rect width="140" height="140" fill={`url(#${gid})`} />
      <circle cx="100" cy="40" r="14" fill="#fff7ed" opacity="0.9" />
      <path d="M0 110 L40 70 L70 100 L100 60 L140 105 V140 H0 Z" fill="#64748b" />
      <path d="M0 125 Q40 105 80 122 T140 118 V140 H0 Z" fill="#334155" />
    </svg>
  )
}

export function PhotoNode({ data }: WidgetNodeProps) {
  const w = data.widget
  if (w.type !== 'photo') return null
  return (
    <Frame {...data} className="polaroid">
      <div className="polaroid-img"><PhotoArt /></div>
      <div className="polaroid-title">{w.data.title}</div>
      <div className="polaroid-caption">{w.data.caption}</div>
    </Frame>
  )
}
