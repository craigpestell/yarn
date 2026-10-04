import { useState } from 'react'
import { LIMITS, SourceSchema, type Widget } from '../../shared/schema'
import { useBoard } from './store'

export function SourcesEditor({ widget }: { widget: Widget }) {
  const patch = useBoard((s) => s.patchWidget)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const parsed = SourceSchema.safeParse({ url: url.trim(), retrievedAt: new Date().toISOString() })
    if (!parsed.success) {
      setError('Enter a valid http(s) URL')
      return
    }
    patch(widget.id, { sources: [...widget.sources, parsed.data] })
    setUrl('')
    setError(null)
  }

  return (
    <fieldset className="sources">
      <legend>Sources ({widget.sources.length})</legend>
      <ul>
        {widget.sources.map((s, i) => (
          <li key={`${s.url}-${i}`}>
            <span className="src-url">{s.url}</span>
            <button type="button" aria-label={`Remove source ${s.url}`} onClick={() => patch(widget.id, { sources: widget.sources.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {widget.sources.length < LIMITS.sources && (
        <>
          <label className="field">
            New source URL
            <input type="url" value={url} maxLength={LIMITS.url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button type="button" onClick={add}>Add source</button>
          {error && <p role="alert" className="err">{error}</p>}
        </>
      )}
    </fieldset>
  )
}
