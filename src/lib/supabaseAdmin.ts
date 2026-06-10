import { createClient } from "@supabase/supabase-js"
// Prefer reading the service role key from server-only env (`process.env`).
// Do NOT expose the service role key to the client (avoid `VITE_` prefix).
const _proc = typeof globalThis !== "undefined" ? (globalThis as any).process : undefined
const serviceKey = (_proc?.env?.SUPABASE_SERVICE_ROLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined)

// The admin client should only be created server-side. Creating it in the
// browser spawns an additional GoTrueClient and can produce race warnings
// and undefined behavior. Return `null` in the browser and require server-
// side execution for admin actions.
const isBrowser = typeof window !== "undefined"

let _supabaseAdmin: any = null
if (!isBrowser && serviceKey) {
  const _g = globalThis as any
  if (!_g.__supabaseAdmin) {
    _g.__supabaseAdmin = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  _supabaseAdmin = _g.__supabaseAdmin
}

export const supabaseAdmin = _supabaseAdmin
