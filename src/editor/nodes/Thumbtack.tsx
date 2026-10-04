/** SVG thumbtack centred on the pin point (top centre, 10px down). Not rotated with the widget. */
export function Thumbtack({ width }: { width: number }) {
  return (
    <svg className="tack" width={24} height={24} style={{ left: width / 2 - 12, top: -2 }} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse cx="13" cy="15" rx="8" ry="6" fill="rgba(0,0,0,0.3)" />
      <circle cx="12" cy="12" r="8" fill="#b91c1c" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#7f1d1d" strokeWidth="1" />
      <circle cx="9.5" cy="9.5" r="2.6" fill="#fca5a5" opacity="0.85" />
    </svg>
  )
}
