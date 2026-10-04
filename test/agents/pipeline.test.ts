import { describe, expect, it } from 'vitest'
import { registrableDomain } from '../../agents/lib/domain'
import { Budget, BudgetExceeded } from '../../agents/lib/budget'
import { parseArgs } from '../../agents/lib/args'
import { runPipeline, seedFor, ValidationFailed } from '../../agents/pipeline'
import { buildDoc } from '../../agents/pipeline/builder'
import { classify } from '../../agents/pipeline/classifier'
import { research } from '../../agents/pipeline/researcher'
import { scout } from '../../agents/pipeline/scout'
import { FIXED_NOW, FIXTURE_TOPIC, fakeDeps, fakeLlm } from '../../agents/testing/fakes'
import { DocSchema } from '../../shared/schema'

describe('stages', () => {
  it('scout returns schema-valid subtopics and entities', async () => {
    const s = await scout(fakeLlm(), FIXTURE_TOPIC)
    expect(s.entities.length).toBeGreaterThan(0)
  })

  it('scout rejects a malformed model reply (zod at the boundary)', async () => {
    await expect(scout(fakeLlm({ scout: { subtopics: [], entities: [] } }), 't')).rejects.toThrow()
  })

  it('researcher stamps retrievedAt itself and drops facts about unknown entities', async () => {
    const llm = fakeLlm({
      researcher: {
        facts: [
          { entity: 'A', text: 'x', source: { url: 'https://example.org/1' }, relatedEntities: ['A', 'Nope', 'B'] },
          { entity: 'Stranger', text: 'y', source: { url: 'https://example.org/2' } },
        ],
      },
    })
    const scouted = { subtopics: [{ name: 's', summary: 's' }], entities: [{ name: 'A', kind: 'note' as never, summary: '' }] }
    const out = await research({ llm, now: () => FIXED_NOW }, 't', {
      ...scouted,
      entities: [{ name: 'A', kind: 'event', summary: 's' }, { name: 'B', kind: 'event', summary: 's' }],
    })
    expect(out.facts).toHaveLength(1)
    expect(out.facts[0]?.source.retrievedAt).toBe(FIXED_NOW)
    expect(out.facts[0]?.relatedEntities).toEqual(['B'])
  })

  it('classifier maps verdicts to schema statuses; unclassified facts default to claim; sources are kept', async () => {
    const fact = (i: number, corroborating: { url: string; retrievedAt: string }[] = []) => ({
      id: `f${i}`, entity: 'A', text: 't', relatedEntities: [], corroborating,
      source: { url: `https://example.org/${i}`, retrievedAt: FIXED_NOW },
    })
    const facts = [fact(1, [{ url: 'https://other.example/1', retrievedAt: FIXED_NOW }]), fact(2), fact(3)]
    const llm = fakeLlm({ classifier: { verdicts: [{ factId: 'f1', verdict: 'confirmed' }, { factId: 'f2', verdict: 'speculative' }, { factId: 'zzz', verdict: 'disputed' }] } })
    const claims = await classify(llm, facts)
    expect(claims.map((c) => c.status)).toEqual(['verified', 'speculation', 'claim'])
    expect(claims.every((c) => c.source.url && c.source.retrievedAt)).toBe(true)
  })

  it('confirmed needs two distinct source hosts, otherwise it is capped to claim', async () => {
    const mk = (id: string, extra: string[]) => ({
      id, entity: 'A', text: 't', relatedEntities: [],
      source: { url: 'https://example.org/a', retrievedAt: FIXED_NOW },
      corroborating: extra.map((url) => ({ url, retrievedAt: FIXED_NOW })),
    })
    const facts = [mk('one', []), mk('samehost', ['https://www.example.org/b', 'https://example.org/c']), mk('two', ['https://other.example/x'])]
    const llm = fakeLlm({ classifier: { verdicts: facts.map((f) => ({ factId: f.id, verdict: 'confirmed' })) } })
    expect((await classify(llm, facts)).map((c) => c.status)).toEqual(['claim', 'claim', 'verified'])
  })

  it.each([
    ['trailing dot', 'https://example.com/a', 'https://example.com./b'],
    ['port', 'https://example.com/a', 'https://example.com:443/b'],
    ['subdomains of one site', 'https://en.wikipedia.org/a', 'https://fr.wikipedia.org/b'],
    ['www and bare', 'https://www.example.com/a', 'https://example.com/b'],
    ['co.uk subdomains', 'https://news.bbc.co.uk/a', 'https://www.bbc.co.uk/b'],
    ['case', 'https://Example.COM/a', 'https://example.com/b'],
  ])('confirmed is capped when the second url is the same site: %s', async (_n, a, b) => {
    const f = { id: 'f', entity: 'A', text: 't', relatedEntities: [], source: { url: a, retrievedAt: FIXED_NOW }, corroborating: [{ url: b, retrievedAt: FIXED_NOW }] }
    const llm = fakeLlm({ classifier: { verdicts: [{ factId: 'f', verdict: 'confirmed' }] } })
    expect((await classify(llm, [f]))[0]?.status).toBe('claim')
  })

  it.each([
    ['distinct sites', 'https://example.com/a', 'https://example.org/b'],
    ['distinct co.uk sites', 'https://www.bbc.co.uk/a', 'https://www.theguardian.co.uk/b'],
    ['same label, different suffix', 'https://example.co.uk/a', 'https://example.com/b'],
  ])('confirmed holds for %s', async (_n, a, b) => {
    const f = { id: 'f', entity: 'A', text: 't', relatedEntities: [], source: { url: a, retrievedAt: FIXED_NOW }, corroborating: [{ url: b, retrievedAt: FIXED_NOW }] }
    const llm = fakeLlm({ classifier: { verdicts: [{ factId: 'f', verdict: 'confirmed' }] } })
    expect((await classify(llm, [f]))[0]?.status).toBe('verified')
  })

  it('registrableDomain', () => {
    expect(registrableDomain('https://a.b.example.com./x')).toBe('example.com')
    expect(registrableDomain('https://x.y.org.uk/')).toBe('y.org.uk')
    expect(registrableDomain('https://[2606:4700::1]/')).toContain('2606')
    expect(registrableDomain('nope')).toBe('')
  })

  it('builder flags person_of_interest posters for human review and keeps corroborating sources', () => {
    let n = 0
    const claim = {
      id: 'f1', entity: 'P', text: 'named', relatedEntities: [], status: 'claim' as const,
      source: { url: 'https://example.org/p', retrievedAt: FIXED_NOW },
      corroborating: [{ url: 'https://other.example/p', retrievedAt: FIXED_NOW }],
    }
    const doc = buildDoc({ entities: [{ name: 'P', kind: 'person_of_interest', summary: '' }], claims: [claim], images: [], newId: () => `i${++n}` })
    const w = doc.widgets[0]
    expect(w?.type === 'wanted' && w.data.description.startsWith('DRAFT: needs human review before publishing.')).toBe(true)
    expect(w?.sources).toHaveLength(2)
  })

  it('builder grounds every widget and edge in claims', async () => {
    let n = 0
    const deps = fakeDeps()
    const scouted = await scout(deps.llm, 't')
    const r = await research(deps, 't', scouted)
    const claims = await classify(deps.llm, r.facts)
    // drop all claims about "Tent": it must disappear, and so must edges to it
    const grounded = claims.filter((c) => c.entity !== 'Tent')
    const doc = buildDoc({ entities: scouted.entities, claims: grounded, images: r.images, newId: () => `i${++n}` })
    expect(DocSchema.safeParse(doc).success).toBe(true)
    expect(doc.widgets).toHaveLength(3)
    expect(doc.widgets.every((w) => w.sources.length > 0)).toBe(true)
    const ids = new Set(doc.widgets.map((w) => w.id))
    expect(doc.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true)
    expect(doc.widgets.map((w) => w.type).sort()).toEqual(['note', 'paper', 'photo'])
    const photo = doc.widgets.find((w) => w.type === 'photo')
    expect(photo?.sources.some((s) => s.license && s.attribution)).toBe(true)
    expect(doc.widgets.find((w) => w.type === 'paper')?.status).toBe('disputed')
  })
})

describe('runPipeline (fakes)', () => {
  it('is deterministic: same topic and fakes give identical docs', async () => {
    const a = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    const b = await runPipeline(fakeDeps(), FIXTURE_TOPIC)
    expect(b).toEqual(a)
    expect(DocSchema.safeParse(a.doc).success).toBe(true)
    expect(a.stats).toMatchObject({ entities: 4, claims: 4, widgets: 4 })
  })

  it('calls the stages in order', async () => {
    const llm = fakeLlm()
    await runPipeline(fakeDeps({ llm }), FIXTURE_TOPIC)
    expect(llm.calls).toEqual(['scout', 'researcher', 'classifier'])
  })

  it('stops with structured errors when the validator fails (unresolvable url)', async () => {
    const err = await runPipeline(fakeDeps({ resolver: async () => false }), FIXTURE_TOPIC).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ValidationFailed)
    expect((err as ValidationFailed).errors.some((e) => e.code === 'unresolvable_url')).toBe(true)
  })

  it('refuses a news-photo hotlink from the model', async () => {
    const base = fakeDeps()
    const llm = fakeLlm({
      researcher: {
        facts: [{ entity: 'Tent', text: 'x', source: { url: 'https://example.org/t' }, relatedEntities: [] }],
        images: [{ entity: 'Tent', url: 'https://cdn.news.example/p.jpg', pageUrl: 'https://example.org/p', license: 'CC0', attribution: 'x' }],
      },
    })
    await expect(runPipeline({ ...base, llm }, FIXTURE_TOPIC)).rejects.toThrow(/unlicensed_image/)
  })

  it('seedFor is stable', () => {
    expect(seedFor('a')).toBe(seedFor('a'))
    expect(seedFor('a')).not.toBe(seedFor('b'))
  })
})

describe('budget and args', () => {
  it('caps calls, turns and spend', () => {
    const b = new Budget({ maxTurns: 5, maxBudgetUsd: 1, maxCalls: 2 })
    expect(b.start()).toEqual({ maxTurns: 5, maxBudgetUsd: 1 })
    b.record(3, 0.4)
    expect(b.start()).toEqual({ maxTurns: 2, maxBudgetUsd: 0.6 })
    expect(() => b.start()).toThrow(BudgetExceeded)
    const t = new Budget({ maxTurns: 1, maxBudgetUsd: 1 })
    t.start()
    t.record(1, 0)
    expect(() => t.start()).toThrow(/turns/)
    const u = new Budget({ maxTurns: 9, maxBudgetUsd: 1 })
    u.start()
    u.record(1, 1.5)
    expect(() => u.start()).toThrow(/usd/)
  })

  it('parses flags', () => {
    expect(parseArgs(['Dyatlov', 'Pass', '--dry-run', '--max-turns', '7'])).toMatchObject({ topic: 'Dyatlov Pass', dryRun: true, maxTurns: 7, yes: false })
    expect(() => parseArgs([])).toThrow(/usage/)
    expect(() => parseArgs(['t', '--bogus'])).toThrow(/unknown flag/)
    expect(() => parseArgs(['t', '--max-turns', '-1'])).toThrow()
  })
})
