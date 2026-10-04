export interface RunArgs {
  topic: string
  dryRun: boolean
  /** Real runs spend API credits and write to Supabase; they need an explicit --yes. */
  yes: boolean
  print: boolean
  maxTurns?: number
  maxBudgetUsd?: number
}

const num = (flag: string, v: string | undefined): number => {
  const n = Number(v)
  if (!v || !Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number`)
  return n
}

export function parseArgs(argv: string[]): RunArgs {
  const out: RunArgs = { topic: '', dryRun: false, yes: false, print: false }
  const words: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--yes') out.yes = true
    else if (a === '--print') out.print = true
    else if (a === '--max-turns') out.maxTurns = Math.floor(num(a, argv[++i]))
    else if (a === '--max-budget-usd') out.maxBudgetUsd = num(a, argv[++i])
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`)
    else words.push(a)
  }
  out.topic = words.join(' ').trim()
  if (!out.topic) throw new Error('usage: tsx agents/run.ts "<topic>" [--dry-run] [--yes] [--print] [--max-turns N] [--max-budget-usd N]')
  return out
}
