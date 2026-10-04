import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { boardTopicSlugs, listTopics, setBoardTopic } from '../topics/api'
import type { Topic } from '../topics/schemas'

/** Tag your own public board with topics (RLS enforces owner + public; this UI is only shown for public boards). */
export function TopicTags({ client, boardId }: { client: SupabaseClient; boardId: string }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [on, setOn] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void Promise.all([listTopics(client), boardTopicSlugs(client, boardId)]).then(
      ([t, s]) => {
        if (!live) return
        setTopics(t)
        setOn(new Set(s))
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load topics'),
    )
    return () => {
      live = false
    }
  }, [client, boardId])

  const toggle = async (slug: string, checked: boolean) => {
    setError(null)
    try {
      await setBoardTopic(client, boardId, slug, checked)
      setOn((prev) => {
        const next = new Set(prev)
        if (checked) next.add(slug)
        else next.delete(slug)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the tag')
    }
  }
  return (
    <fieldset className="topic-tags">
      <legend>Topics</legend>
      {topics.length === 0 && !error && <p className="muted">No topics exist yet.</p>}
      {topics.map((t) => (
        <label key={t.slug} className="field inline">
          <input type="checkbox" checked={on.has(t.slug)} onChange={(e) => void toggle(t.slug, e.target.checked)} />
          {t.title}
        </label>
      ))}
      {error && <p className="err" role="alert">{error}</p>}
    </fieldset>
  )
}
