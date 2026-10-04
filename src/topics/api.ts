import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { TOPIC_COLUMNS, TopicBoardSchema, TopicSchema, type Topic, type TopicBoard } from './schemas'

export class TopicsError extends Error {}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) throw new TopicsError('The server returned data in an unexpected format')
  return r.data
}

export async function listTopics(client: SupabaseClient): Promise<Topic[]> {
  const { data, error } = await client.from('topics').select(TOPIC_COLUMNS).order('title')
  if (error) throw new TopicsError(`Could not load topics: ${error.message}`)
  return parse(z.array(TopicSchema), data)
}

export async function searchTopics(client: SupabaseClient, q: string): Promise<Topic[]> {
  const term = q.trim().slice(0, 100)
  if (!term) return listTopics(client)
  const { data, error } = await client.rpc('search_topics', { p_q: term })
  if (error) throw new TopicsError(`Could not search topics: ${error.message}`)
  return parse(z.array(TopicSchema), data)
}

export async function getTopic(client: SupabaseClient, slug: string): Promise<Topic | null> {
  const { data, error } = await client.from('topics').select(TOPIC_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw new TopicsError(`Could not load the topic: ${error.message}`)
  return data ? parse(TopicSchema, data) : null
}

export async function listTopicBoards(client: SupabaseClient, slug: string): Promise<TopicBoard[]> {
  const { data, error } = await client.rpc('list_topic_boards', { p_topic_slug: slug })
  if (error) throw new TopicsError(`Could not load boards: ${error.message}`)
  return parse(z.array(TopicBoardSchema), data)
}

/** Topic slugs the board is tagged with (the owner's view). */
export async function boardTopicSlugs(client: SupabaseClient, boardId: string): Promise<string[]> {
  const { data, error } = await client.from('board_topics').select('topic_slug').eq('board_id', boardId)
  if (error) throw new TopicsError(`Could not load tags: ${error.message}`)
  return parse(z.array(z.object({ topic_slug: z.string() })), data).map((r) => r.topic_slug)
}

export async function setBoardTopic(client: SupabaseClient, boardId: string, topicSlug: string, on: boolean): Promise<void> {
  const q = on
    ? client.from('board_topics').insert({ board_id: boardId, topic_slug: topicSlug })
    : client.from('board_topics').delete().eq('board_id', boardId).eq('topic_slug', topicSlug)
  const { error } = await q
  if (error) throw new TopicsError(`Could not ${on ? 'add' : 'remove'} the tag: ${error.message}`)
}
