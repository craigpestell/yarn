import type { Options, Query } from '@anthropic-ai/claude-agent-sdk'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Budget } from '../../agents/lib/budget'
import { buildSdkEnv, createClaudeLlm, createToolGate, gateTool } from '../../agents/lib/llm'

const pub = async () => ['93.184.216.34']

describe('buildSdkEnv', () => {
  it('passes only the minimal allow-list and no secrets', () => {
    const env = buildSdkEnv({
      PATH: '/bin', HOME: '/h', ANTHROPIC_API_KEY: 'k', HTTPS_PROXY: 'p',
      SUPABASE_SERVICE_ROLE_KEY: 's', SUPABASE_URL: 'u', CURATOR_USER_ID: 'c', AWS_SECRET_ACCESS_KEY: 'a', GITHUB_TOKEN: 'g',
    })
    expect(Object.keys(env).sort()).toEqual(['ANTHROPIC_API_KEY', 'HOME', 'HTTPS_PROXY', 'PATH'])
  })
})

describe('createClaudeLlm (fake SDK)', () => {
  const run = async (web: boolean) => {
    let seen: Options | undefined
    const query = ((params: { options?: Options }) => {
      seen = params.options
      return (async function* () {
        yield { type: 'result', subtype: 'success', is_error: false, num_turns: 1, total_cost_usd: 0.01, structured_output: { ok: true } }
      })() as unknown as Query
    }) as never
    const llm = createClaudeLlm({
      model: 'm', budget: new Budget({ maxTurns: 5, maxBudgetUsd: 1 }), query,
      env: { PATH: '/bin', ANTHROPIC_API_KEY: 'k', SUPABASE_SERVICE_ROLE_KEY: 's', SUPABASE_URL: 'u' } as NodeJS.ProcessEnv,
    })
    const out = await llm.complete({ stage: 'scout', system: 's', prompt: 'p', schema: z.object({ ok: z.boolean() }), web })
    return { out, seen: seen as Options }
  }

  it('hands the SDK an explicit env without SUPABASE_* keys', async () => {
    const { out, seen } = await run(true)
    expect(out).toEqual({ ok: true })
    expect(seen.env).toEqual({ PATH: '/bin', ANTHROPIC_API_KEY: 'k' })
    expect(Object.keys(seen.env ?? {}).some((k) => k.startsWith('SUPABASE'))).toBe(false)
  })

  it('restricts tools: web only for the researcher, nothing pre-approved, gate installed', async () => {
    const web = (await run(true)).seen
    expect(web.tools).toEqual(['WebSearch', 'WebFetch'])
    expect(web.allowedTools).toBeUndefined()
    expect(web.disallowedTools).toContain('Bash')
    expect(web.disallowedTools).not.toContain('WebFetch')
    expect(web.permissionMode).toBe('default')
    expect(web.cwd).toBeTruthy()
    expect(web.cwd).not.toBe(process.cwd())
    expect(web.cwd?.startsWith(tmpdir())).toBe(true)
    expect(web.canUseTool).toBeTypeOf('function')
    expect(web.hooks?.PreToolUse).toHaveLength(1)
    const plain = (await run(false)).seen
    expect(plain.tools).toEqual([])
  })

  it('fails on an error result', async () => {
    const query = (() => (async function* () {
      yield { type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 9, total_cost_usd: 0.5 }
    })() as unknown as Query) as never
    const llm = createClaudeLlm({ model: 'm', budget: new Budget({ maxTurns: 5, maxBudgetUsd: 1 }), query, env: {} })
    await expect(llm.complete({ stage: 'scout', system: 's', prompt: 'p', schema: z.object({}) })).rejects.toThrow(/error_max_turns/)
  })
})

describe('tool gate', () => {
  it.each([
    ['public https', 'https://example.org/a', true],
    ['http', 'http://example.org/a', false],
    ['localhost', 'https://localhost/a', false],
    ['loopback ip', 'https://127.0.0.1/a', false],
    ['cloud metadata', 'https://169.254.169.254/latest/meta-data', false],
    ['private ip', 'https://10.0.0.8/a', false],
    ['credentials in url', 'https://user:pw@example.org/a', false],
    ['not a url', 'nope', false],
    ['missing url', undefined, false],
  ])('WebFetch %s', async (_n, url, allowed) => {
    expect((await gateTool('WebFetch', { url }, pub)).allow).toBe(allowed)
  })

  it('denies WebFetch when DNS resolves to a private address', async () => {
    expect((await gateTool('WebFetch', { url: 'https://rebind.example/' }, async () => ['10.0.0.1'])).allow).toBe(false)
  })

  it('allows WebSearch and denies every other tool', async () => {
    expect((await gateTool('WebSearch', { query: 'x' })).allow).toBe(true)
    for (const t of ['Bash', 'Read', 'Write', 'Edit', 'mcp__x__y']) expect((await gateTool(t, {})).allow).toBe(false)
  })

  it('canUseTool and the PreToolUse hook both enforce it', async () => {
    const gate = createToolGate(pub)
    const opts = { signal: new AbortController().signal, toolUseID: 't' } as never
    expect(await gate.canUseTool('WebFetch', { url: 'https://169.254.169.254/' }, opts)).toMatchObject({ behavior: 'deny' })
    expect(await gate.canUseTool('WebFetch', { url: 'https://example.org/' }, opts)).toMatchObject({ behavior: 'allow' })
    const hook = gate.hooks?.PreToolUse?.[0]?.hooks[0]
    const input = (url: string) => ({ hook_event_name: 'PreToolUse', tool_name: 'WebFetch', tool_input: { url } }) as never
    const sig = { signal: new AbortController().signal }
    expect(await hook?.(input('https://localhost/'), 't', sig)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } })
    expect(await hook?.(input('https://example.org/'), 't', sig)).toEqual({})
  })
})

describe('cliJsonSchema', () => {
  it('omits $schema so the Claude Code CLI can validate it', async () => {
    const { cliJsonSchema } = await import('../../agents/lib/llm')
    const { z } = await import('zod')
    const out = cliJsonSchema(z.object({ a: z.string() }))
    expect(out).not.toHaveProperty('$schema')
    expect(out).toMatchObject({ type: 'object' })
  })
})

describe('createClaudeLlm error results', () => {
  it('reports an is_error result (e.g. not logged in) instead of failing schema parse', async () => {
    const { createClaudeLlm } = await import('../../agents/lib/llm')
    const { z } = await import('zod')
    const { Budget } = await import('../../agents/lib/budget')
    const query = (() => (async function* () {
      yield { type: 'result', subtype: 'success', is_error: true, result: 'Not logged in', num_turns: 1, total_cost_usd: 0 }
    })()) as never
    const llm = createClaudeLlm({ model: 'm', budget: new Budget({ maxTurns: 5, maxBudgetUsd: 1 }), query })
    await expect(llm.complete({ stage: 'scout', prompt: 'p', system: 's', schema: z.object({}) } as never)).rejects.toThrow(/Not logged in/)
  })
})
