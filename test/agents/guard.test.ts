import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanDir } from '../../scripts/checkBundle'

const ROOT = new URL('../../', import.meta.url).pathname
function* files(dir: string): Generator<string> {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* files(p)
    else if (/\.(ts|tsx|js|mjs|css|html)$/.test(n)) yield p
  }
}

describe('service-role isolation', () => {
  const shipped = ['src', 'shared', 'layout', 'migrate', 'api'].flatMap((d) => [...files(join(ROOT, d))])

  it('scans a non-trivial set of files', () => expect(shipped.length).toBeGreaterThan(20))

  it('nothing shipped imports from agents/', () => {
    const offenders = shipped.filter((f) => /(?:from|import)\s*\(?\s*['"][^'"]*\bagents\//.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('nothing shipped references SERVICE_ROLE or the Agent SDK', () => {
    const offenders = shipped.filter((f) => /service[_-]?role|claude-agent-sdk/i.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([])
  })
})

describe('bundle scan', () => {
  const make = (content: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'assets', 'a.js'), content)
    return dir
  }
  it('passes a clean bundle', () => expect(scanDir(make('console.log("hi")'))).toEqual([]))
  it.each([
    ['env name', 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY'],
    ['jwt payload', `x="${Buffer.from('{"role":"service_role"}').toString('base64')}"`],
    ['sb_secret key', `k="${'sb_' + 'secret_'}${'x'.repeat(24)}"`],
    ['agent sdk', 'import "@anthropic-ai/claude-agent-sdk"'],
  ])('flags %s', (_n, content) => expect(scanDir(make(content)).length).toBeGreaterThan(0))
  it('does not flag the supabase-js prefix check', () => expect(scanDir(make('e.startsWith(`sb_secret_`)'))).toEqual([]))
})

describe('jwt marker alignments', () => {
  it('flags a service_role JWT payload at any alignment', () => {
    for (const pad of ['', 'a', 'ab']) {
      const payload = Buffer.from(`${pad}"role":"service_role","exp":1`).toString('base64').replace(/=+$/, '')
      const dir = mkdtempSync(join(tmpdir(), 'dist-'))
      writeFileSync(join(dir, 'a.js'), `x="${payload}"`)
      // the literal word is absent from base64 text, so only the marker can catch it
      expect(scanDir(dir).some((h) => h.includes('JWT'))).toBe(true)
    }
  })
})
