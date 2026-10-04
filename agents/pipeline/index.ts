import { autoOrganize } from '../../layout/autoOrganize'
import type { Doc } from '../../shared/schema'
import type { Llm } from '../lib/llm'
import type { UrlResolver } from '../lib/web'
import { buildDoc } from './builder'
import { classify } from './classifier'
import { research } from './researcher'
import { scout } from './scout'
import { validateBoard, type ValidationError, type ValidationWarning } from './validator'

export interface PipelineDeps {
  llm: Llm
  resolver: UrlResolver
  now: () => string
  newId: () => string
}

export interface PipelineResult {
  title: string
  doc: Doc
  warnings: ValidationWarning[]
  stats: { entities: number; facts: number; claims: number; widgets: number; edges: number }
}

export class ValidationFailed extends Error {
  constructor(readonly errors: ValidationError[]) {
    super(`board failed validation (${errors.length} error(s)): ${errors.map((e) => `${e.code}@${e.path}`).join(', ')}`)
    this.name = 'ValidationFailed'
  }
}

/** Stable 32-bit seed from the topic so the same topic always lays out the same way. */
export function seedFor(topic: string): number {
  let h = 2166136261
  for (const ch of topic) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
  return h
}

/** scout -> researcher -> classifier -> builder -> validator -> autoOrganize. Writes nothing. */
export async function runPipeline(deps: PipelineDeps, topic: string): Promise<PipelineResult> {
  const scouted = await scout(deps.llm, topic)
  const researched = await research(deps, topic, scouted)
  const claims = await classify(deps.llm, researched.facts)
  const draft = buildDoc({ entities: scouted.entities, claims, images: researched.images, newId: deps.newId })
  const verdict = await validateBoard(draft, { resolver: deps.resolver })
  if (!verdict.ok) throw new ValidationFailed(verdict.errors)
  const doc = await autoOrganize(verdict.doc, { seed: seedFor(topic) })
  return {
    title: topic.slice(0, 200),
    doc,
    warnings: verdict.warnings,
    stats: { entities: scouted.entities.length, facts: researched.facts.length, claims: claims.length, widgets: doc.widgets.length, edges: doc.edges.length },
  }
}
