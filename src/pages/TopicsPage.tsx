import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { searchTopics } from '../topics/api'
import type { Topic } from '../topics/schemas'

/** Browse and search topics. Public: works without an account. */
export function TopicsPage() {
  const { client, loading } = useAuth()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !client) return
    let live = true
    setTopics(null)
    searchTopics(client, query).then(
      (t) => {
        if (!live) return
        setTopics(t)
        setError(null)
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load topics'),
    )
    return () => {
      live = false
    }
  }, [client, loading, query])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setQuery(input)
  }
  return (
    <>
      <main className="page">
        <h1>Topics</h1>
        <form role="search" className="rename-form" onSubmit={onSubmit}>
          <label className="visually-hidden" htmlFor="topic-q">Search topics</label>
          <input id="topic-q" type="search" maxLength={100} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search topics" />
          <button type="submit">Search</button>
        </form>
        {!client && <p role="alert">Topics are not available in this build.</p>}
        {error && <p role="alert" className="form-alert">{error}</p>}
        {topics === null ? (
          client && !error && <p role="status">Loading...</p>
        ) : topics.length === 0 ? (
          <p>{query.trim() ? 'No topics match your search.' : 'No topics yet.'}</p>
        ) : (
          <ul className="topic-list" aria-label="Topics">
            {topics.map((t) => (
              <li key={t.slug}>
                <h2><Link to={`/topics/${t.slug}`}>{t.title}</Link></h2>
                {t.summary && <p>{t.summary}</p>}
                {t.tags.length > 0 && <p className="muted">{t.tags.join(', ')}</p>}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
