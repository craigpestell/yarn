import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { supabaseDraftStore, writeDraft } from '../../agents/lib/writeDraft'
import { ensureCurator } from '../../agents/seed-curator'
import { runPipeline } from '../../agents/pipeline'
import { FIXTURE_TOPIC, fakeDeps } from '../../agents/testing/fakes'

/**
 * Integration test against the LOCAL Supabase stack only. Skipped unless the three variables are set, e.g.
 *   set -a; eval "$(supabase status -o env 2>/dev/null)"; set +a
 *   LOCAL_SUPABASE_URL=$API_URL LOCAL_ANON_KEY=$ANON_KEY LOCAL_SERVICE_KEY=$SERVICE_ROLE_KEY npx vitest run test/agents/localStack
 * (keys never get echoed). Refuses any non-loopback URL.
 */
const url = process.env.LOCAL_SUPABASE_URL
const anonKey = process.env.LOCAL_ANON_KEY
const serviceKey = process.env.LOCAL_SERVICE_KEY
const enabled = Boolean(url && anonKey && serviceKey)
const isLoopback = (u: string) => ['127.0.0.1', 'localhost'].includes(new URL(u).hostname)

describe.skipIf(!enabled)('agent draft on the local stack', () => {
  it('writes a private draft as the curator that anon cannot read', async () => {
    expect(isLoopback(url as string)).toBe(true)
    const opts = { auth: { persistSession: false, autoRefreshToken: false } }
    const admin = createClient(url as string, serviceKey as string, opts)
    const anon = createClient(url as string, anonKey as string, opts)

    const first = await ensureCurator(admin)
    const second = await ensureCurator(admin)
    expect(second).toEqual({ id: first.id, created: false })

    const { doc, title } = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    const board = await writeDraft(supabaseDraftStore(admin), { curatorId: first.id, title, doc })
    try {
      const row = await admin.from('boards').select('owner_id, visibility, published_doc, doc').eq('id', board.id).single()
      expect(row.data).toMatchObject({ owner_id: first.id, visibility: 'private', published_doc: null, doc })

      const viaView = await anon.from('public_boards').select('slug').eq('slug', board.slug)
      expect(viaView.data ?? []).toEqual([])
      const viaRpc = await anon.rpc('get_published_board', { p_slug: board.slug })
      expect(viaRpc.data ?? []).toEqual([])
      const direct = await anon.from('boards').select('id').eq('id', board.id)
      expect(direct.data ?? []).toEqual([])
    } finally {
      await admin.from('boards').delete().eq('id', board.id)
      if (first.created) await admin.auth.admin.deleteUser(first.id)
    }
  })
})
