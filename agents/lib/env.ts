import { existsSync } from 'node:fs'

/** Names this package reads. Values are never logged or echoed. */
export const ENV_NAMES = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CURATOR_USER_ID',
  'ANTHROPIC_API_KEY',
  'AGENT_MODEL',
  'AGENT_MAX_TURNS',
  'AGENT_MAX_BUDGET_USD',
] as const
export type EnvName = (typeof ENV_NAMES)[number]

export const DEFAULT_MODEL = 'claude-sonnet-5'
export const DEFAULT_ENV_FILE = new URL('../.env', import.meta.url).pathname

/**
 * Load an env file into process.env (existing variables win), then return only the
 * allow-listed names. Nothing else from the file is exposed to callers.
 */
export function loadEnv(file: string = DEFAULT_ENV_FILE, source: NodeJS.ProcessEnv = process.env): Partial<Record<EnvName, string>> {
  if (source === process.env && existsSync(file)) process.loadEnvFile(file)
  const out: Partial<Record<EnvName, string>> = {}
  for (const name of ENV_NAMES) {
    const v = source[name]
    if (v !== undefined && v !== '') out[name] = v
  }
  return out
}

/** Throws naming the missing variable (never its value). */
export function requireEnv(env: Partial<Record<EnvName, string>>, ...names: EnvName[]): Record<EnvName, string> {
  const missing = names.filter((n) => !env[n])
  if (missing.length) throw new Error(`missing env var(s): ${missing.join(', ')}`)
  return env as Record<EnvName, string>
}

const posNumber = (v: string | undefined, fallback: number, name: string): number => {
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`)
  return n
}
export function limitsFromEnv(env: Partial<Record<EnvName, string>>) {
  return {
    model: env.AGENT_MODEL ?? DEFAULT_MODEL,
    maxTurns: Math.floor(posNumber(env.AGENT_MAX_TURNS, 40, 'AGENT_MAX_TURNS')),
    maxBudgetUsd: posNumber(env.AGENT_MAX_BUDGET_USD, 2, 'AGENT_MAX_BUDGET_USD'),
  }
}
