import type { Llm, LlmRequest } from '../lib/llm'
import type { UrlResolver } from '../lib/web'
import type { PipelineDeps } from '../pipeline'

export const FIXED_NOW = '2026-10-04T12:00:00.000Z'
export const FIXTURE_TOPIC = 'Dyatlov Pass incident'

const src = (path: string) => ({ url: `https://example.org/${path}`, title: path })
const FIXTURE_REPLIES = {
  scout: {
    subtopics: [
      { name: 'The expedition', summary: 'Ural hiking group, February 1959.' },
      { name: 'The investigation', summary: 'Soviet inquiry and later reviews.' },
    ],
    entities: [
      { name: 'Igor Dyatlov', kind: 'person', summary: 'Group leader.' },
      { name: 'Kholat Syakhl', kind: 'place', summary: 'Mountain near the tent site.' },
      { name: 'Case file', kind: 'document', summary: 'Official inquiry records.' },
      { name: 'Tent', kind: 'object', summary: 'Found cut open from inside.' },
    ],
  },
  researcher: {
    facts: [
      { entity: 'Igor Dyatlov', text: 'Led a ten-person ski trek.', source: src('trek'), corroborating: [{ url: 'https://other.example/trek' }], relatedEntities: ['Kholat Syakhl'] },
      { entity: 'Kholat Syakhl', text: 'Group camped on its eastern slope.', source: src('slope'), corroborating: [{ url: 'https://another.example/slope' }], relatedEntities: ['Tent'] },
      { entity: 'Case file', text: 'Inquiry closed citing an unknown compelling force.', source: src('case'), relatedEntities: ['Tent'] },
      { entity: 'Tent', text: 'Found cut open from the inside.', source: src('tent'), relatedEntities: [] },
    ],
    images: [
      {
        entity: 'Kholat Syakhl',
        url: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
        license: 'CC BY-SA 4.0',
        attribution: 'Example Author, via Wikimedia Commons',
      },
    ],
  },
  classifier: {
    verdicts: [
      { factId: 'f1', verdict: 'confirmed', rationale: '' },
      { factId: 'f2', verdict: 'confirmed', rationale: '' },
      { factId: 'f3', verdict: 'disputed', rationale: '' },
      { factId: 'f4', verdict: 'alleged', rationale: '' },
    ],
  },
} as const

/** Deterministic fake LLM: returns canned replies per stage, re-validated by the caller's schema. */
export function fakeLlm(replies: Partial<Record<LlmRequest<unknown>['stage'], unknown>> = {}): Llm & { calls: LlmRequest<unknown>['stage'][] } {
  const calls: LlmRequest<unknown>['stage'][] = []
  return {
    calls,
    async complete<T>(req: LlmRequest<T>): Promise<T> {
      calls.push(req.stage)
      return req.schema.parse(req.stage in replies ? replies[req.stage] : FIXTURE_REPLIES[req.stage])
    },
  }
}

export const allResolve: UrlResolver = async () => true

export function fakeDeps(over: Partial<PipelineDeps> = {}): PipelineDeps {
  let n = 0
  return { llm: fakeLlm(), resolver: allResolve, now: () => FIXED_NOW, newId: () => `id${++n}`, ...over }
}

