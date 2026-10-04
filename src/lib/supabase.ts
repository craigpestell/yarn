import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null | undefined

/** The browser client, or null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (sandbox-only mode). Public anon key only. */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  cached = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
  return cached
}
