import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { getTopic, listTopicBoards } from '../topics/api'
import type { Topic, TopicBoard } from '../topics/schemas'

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; topic: Topic; boards: TopicBoard[] }

export function TopicPage() {
  const slug = useParams().slug ?? ''
  const { client, loading } = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (loading || !client) return
    let live = true
    setState({ kind: 'loading' })
    void Promise.all([getTopic(client, slug), listTopicBoards(client, slug)]).then(
      ([topic, boards]) => live && setState(topic ? { kind: 'ready', topic, boards } : { kind: 'missing' }),
      (e: unknown) => live && setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load the topic' }),
    )
    return () => {
      live = false
    }
  }, [client, loading, slug])

  return (
    <>
      <main className="page">
        {state.kind === 'loading' && <p role="status">Loading...</p>}
        {state.kind === 'error' && <p role="alert">{state.message}</p>}
        {state.kind === 'missing' && <><h1>Topic not found</h1><p><Link to="/topics">All topics</Link></p></>}
        {state.kind === 'ready' && (
          <>
            <p><Link to="/topics">All topics</Link></p>
            <h1>{state.topic.title}</h1>
            {state.topic.summary && <p>{state.topic.summary}</p>}
            {state.boards.length === 0 ? (
              <p>No public boards on this topic yet.</p>
            ) : (
              <ul aria-label="Boards on this topic">
                {state.boards.map((b) => (
                  <li key={b.slug}><Link to={`/b/${b.slug}`}>{b.title}</Link></li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  )
}
