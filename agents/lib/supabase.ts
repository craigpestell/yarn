import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv, type EnvName } from './env'

/** Service-role client. Only ever constructed inside /agents; never import this from src/. */
export function createServiceClient(env: Partial<Record<EnvName, string>>): SupabaseClient {
  const e = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
  return createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
