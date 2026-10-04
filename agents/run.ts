import { nanoid } from 'nanoid'
import { parseArgs } from './lib/args'
import { Budget } from './lib/budget'
import { limitsFromEnv, loadEnv, requireEnv } from './lib/env'
import { createClaudeLlm } from './lib/llm'
import { createServiceClient } from './lib/supabase'
import { createResolver } from './lib/web'
import { supabaseDraftStore, writeDraft } from './lib/writeDraft'
import { runPipeline, type PipelineDeps } from './pipeline'
import { fakeDeps } from './testing/fakes'

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = loadEnv()

  if (args.dryRun) {
    // Fakes only: no network, no API credits, nothing written.
    const result = await runPipeline(fakeDeps(), args.topic)
    console.log(`dry run ok: ${JSON.stringify(result.stats)} (nothing written), ${result.warnings.length} warning(s)`)
    if (args.print) console.log(JSON.stringify(result.doc, null, 2))
    return
  }

  const limits = limitsFromEnv(env)
  const maxTurns = args.maxTurns ?? limits.maxTurns
  const maxBudgetUsd = args.maxBudgetUsd ?? limits.maxBudgetUsd
  requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CURATOR_USER_ID')
  if (!args.yes) {
    throw new Error(
      `real run spends Claude API credits (model ${limits.model}, cap ${maxTurns} turns / $${maxBudgetUsd}) and writes a private draft board to ${new URL(env.SUPABASE_URL as string).host}. Re-run with --yes to proceed, or --dry-run.`,
    )
  }
  const budget = new Budget({ maxTurns, maxBudgetUsd })
  const deps: PipelineDeps = {
    llm: createClaudeLlm({ model: limits.model, budget }),
    resolver: createResolver(),
    now: () => new Date().toISOString(),
    newId: () => nanoid(),
  }
  const result = await runPipeline(deps, args.topic)
  const board = await writeDraft(supabaseDraftStore(createServiceClient(env)), {
    curatorId: env.CURATOR_USER_ID as string,
    title: result.title,
    doc: result.doc,
  })
  console.log(`draft written: id=${board.id} slug=${board.slug} stats=${JSON.stringify(result.stats)} warnings=${result.warnings.length} spent=$${budget.usd.toFixed(4)} turns=${budget.turns}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error')
  process.exit(1)
})
