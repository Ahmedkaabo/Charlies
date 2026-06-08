import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const _g = globalThis as any
if (!_g.__supabase) {
  // Persist single client instance across HMR/dev reloads to avoid
  // multiple GoTrueClient instances and related race warnings.
  _g.__supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase = _g.__supabase
