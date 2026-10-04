import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { limitsFromEnv, loadEnv, requireEnv } from '../../agents/lib/env'
import { setEnvIfMissing } from '../../agents/lib/envFile'
import { writeDraft, type DraftRow, type DraftStore } from '../../agents/lib/writeDraft'
import { CURATOR_EMAIL, ensureCurator } from '../../agents/seed-curator'
import { runPipeline } from '../../agents/pipeline'
import { FIXTURE_TOPIC, fakeDeps } from '../../agents/testing/fakes'
import type { SupabaseClient } from '@supabase/supabase-js'

const CURATOR = '11111111-2222-4333-8444-555555555555'

describe('writeDraft', () => {
  it('inserts a private board owned by the curator with a valid slug and the validated doc', async () => {
    const { doc } = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    const rows: DraftRow[] = []
    const store: DraftStore = { insertBoard: async (r) => (rows.push(r), { id: 'b1', slug: r.slug }) }
    const out = await writeDraft(store, { curatorId: CURATOR, title: FIXTURE_TOPIC, doc, rand: () => 'abcd1234' })
    expect(out.slug).toBe('dyatlov-pass-incident-abcd1234')
    expect(rows[0]).toMatchObject({ owner_id: CURATOR, visibility: 'private', title: FIXTURE_TOPIC, doc })
    expect(rows[0]?.slug).toMatch(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/)
    expect(rows[0]?.slug).not.toMatch(/--/)
  })

  it('retries once with a fresh slug on a unique violation, then gives up', async () => {
    const { doc } = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    const slugs: string[] = []
    let n = 0
    const clash: DraftStore = { insertBoard: async (r) => (slugs.push(r.slug), { error: { code: '23505', message: 'dup' } }) }
    await expect(writeDraft(clash, { curatorId: CURATOR, title: 't', doc, rand: () => `s${++n}` })).rejects.toThrow(/dup/)
    expect(slugs).toEqual(['t-s1', 't-s2'])
  })

  it('does not retry other errors, and rejects an invalid doc or curator id before any write', async () => {
    let calls = 0
    const store: DraftStore = { insertBoard: async () => (calls++, { error: { code: '42501', message: 'denied' } }) }
    const { doc } = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    await expect(writeDraft(store, { curatorId: CURATOR, title: 't', doc })).rejects.toThrow(/denied/)
    expect(calls).toBe(1)
    await expect(writeDraft(store, { curatorId: CURATOR, title: 't', doc: { version: 1 } })).rejects.toThrow()
    await expect(writeDraft(store, { curatorId: 'not-a-uuid', title: 't', doc })).rejects.toThrow(/uuid/)
    expect(calls).toBe(1)
  })
})

describe('env helpers', () => {
  it('setEnvIfMissing appends, fills empty placeholders, never overwrites, and sets mode 600', () => {
    const dir = mkdtempSync(join(tmpdir(), 'envf-'))
    const f = join(dir, '.env')
    writeFileSync(f, 'A=1\nCURATOR_USER_ID=\nB=2\n', { mode: 0o644 })
    expect(setEnvIfMissing(f, 'CURATOR_USER_ID', 'x1')).toBe('added')
    expect(readFileSync(f, 'utf8')).toBe('A=1\nCURATOR_USER_ID=x1\nB=2\n')
    expect(setEnvIfMissing(f, 'CURATOR_USER_ID', 'other')).toBe('present')
    expect(readFileSync(f, 'utf8')).toContain('CURATOR_USER_ID=x1')
    expect((statSync(f).mode & 0o777).toString(8)).toBe('600')
    const g = join(dir, 'new.env')
    expect(setEnvIfMissing(g, 'CURATOR_USER_ID', 'y')).toBe('added')
    expect(readFileSync(g, 'utf8')).toBe('CURATOR_USER_ID=y\n')
  })

  it('loadEnv exposes only allow-listed names; requireEnv names missing vars without values', () => {
    const env = loadEnv('/nonexistent', { SUPABASE_URL: 'u', OTHER_SECRET: 's', AGENT_MODEL: '' } as NodeJS.ProcessEnv)
    expect(env).toEqual({ SUPABASE_URL: 'u' })
    expect(() => requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')).toThrow('missing env var(s): SUPABASE_SERVICE_ROLE_KEY')
    expect(limitsFromEnv({})).toEqual({ model: 'claude-sonnet-5', maxTurns: 40, maxBudgetUsd: 2 })
    expect(limitsFromEnv({ AGENT_MODEL: 'm', AGENT_MAX_TURNS: '3', AGENT_MAX_BUDGET_USD: '0.5' })).toEqual({ model: 'm', maxTurns: 3, maxBudgetUsd: 0.5 })
    expect(() => limitsFromEnv({ AGENT_MAX_TURNS: 'abc' })).toThrow(/AGENT_MAX_TURNS/)
  })
})

describe('ensureCurator', () => {
  const fakeAdmin = (existing: { id: string; email: string }[]) => {
    const created: unknown[] = []
    const client = {
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: existing }, error: null }),
          createUser: async (a: { email: string }) => (created.push(a), { data: { user: { id: CURATOR } }, error: null }),
        },
      },
    } as unknown as SupabaseClient
    return { client, created }
  }
  it('creates the curator once and is idempotent afterwards', async () => {
    const first = fakeAdmin([])
    expect(await ensureCurator(first.client)).toEqual({ id: CURATOR, created: true })
    expect(first.created).toHaveLength(1)
    const again = fakeAdmin([{ id: CURATOR, email: CURATOR_EMAIL.toUpperCase() }])
    expect(await ensureCurator(again.client)).toEqual({ id: CURATOR, created: false })
    expect(again.created).toHaveLength(0)
  })
})
