import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ENV_FILE, loadEnv } from './lib/env'
import { setEnvIfMissing } from './lib/envFile'
import { createServiceClient } from './lib/supabase'

export const CURATOR_EMAIL = 'curator@yarns.invalid'

/** Idempotent: finds the curator by email (paging through users) or creates it with a throwaway password. Returns the id. */
export async function ensureCurator(client: SupabaseClient): Promise<{ id: string; created: boolean }> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const found = data.users.find((u) => u.email?.toLowerCase() === CURATOR_EMAIL)
    if (found) return { id: found.id, created: false }
    if (data.users.length < 200) break
  }
  const { data, error } = await client.auth.admin.createUser({
    email: CURATOR_EMAIL,
    password: randomBytes(32).toString('base64url'), // never stored or shown; the account is not meant to log in
    email_confirm: true,
    user_metadata: { role: 'curator' },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? 'no user'}`)
  return { id: data.user.id, created: true }
}

/** Returns the target host; throws for a non-local Supabase URL unless `yes` is set. */
export function checkTarget(url: string | undefined, yes: boolean): string {
  const host = new URL(url ?? 'https://unset.invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host) && !yes) {
    throw new Error('non-local Supabase target: re-run with --yes to confirm this target')
  }
  return host
}

async function main() {
  const fileFlag = process.argv.indexOf('--env')
  const file = fileFlag >= 0 ? (process.argv[fileFlag + 1] ?? DEFAULT_ENV_FILE) : DEFAULT_ENV_FILE
  const env = loadEnv(file)
  const host = checkTarget(env.SUPABASE_URL, process.argv.includes('--yes'))
  console.log(`target Supabase host: ${host}`)
  const { id, created } = await ensureCurator(createServiceClient(env))
  const status = setEnvIfMissing(file, 'CURATOR_USER_ID', id)
  const differs = env.CURATOR_USER_ID !== undefined && env.CURATOR_USER_ID !== id
  console.log(
    `curator ${created ? 'created' : 'exists'}; CURATOR_USER_ID ${status === 'added' ? 'written to' : 'already set in'} ${file}` +
      (differs ? ' (WARNING: the existing value differs from this project\'s curator)' : ''),
  )
}

if (process.argv[1]?.endsWith('seed-curator.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'unknown error')
    process.exit(1)
  })
}
