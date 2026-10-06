import { useId, useState } from 'react'
import { Frame, type WidgetNodeProps } from './Frame'

function PhotoArt() {
  const gid = useId()
  return (
    <svg width="100%" height="100%" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
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

/** The photo itself: an https image when the widget has one (Storage paths are not rendered yet), otherwise, or if it fails to load, the placeholder. */
export function PhotoImage({ image, title }: { image?: string; title: string }) {
  const [failed, setFailed] = useState(false)
  if (!image || !image.startsWith('https://') || failed) return <PhotoArt />
  return (
    <img
      src={image}
      alt={title}
      loading="lazy"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

export function PhotoNode({ data }: WidgetNodeProps) {
  const w = data.widget
  if (w.type !== 'photo') return null
  return (
    <Frame {...data} className="polaroid">
      <div className="polaroid-img"><PhotoImage image={w.data.image} title={w.data.title} /></div>
      <div className="polaroid-title">{w.data.title}</div>
      <div className="polaroid-caption">{w.data.caption}</div>
    </Frame>
  )
}
